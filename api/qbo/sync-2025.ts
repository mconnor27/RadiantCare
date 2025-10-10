import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

interface QboToken {
  access_token: string
  refresh_token: string
  expires_at: number
  environment: string
  realm_id: string
}

interface QboRefreshTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function getCredentials(env: string) {
  if (env === 'sandbox') {
    return {
      clientId: process.env.QBO_SANDBOX_CLIENT_ID || '',
      clientSecret: process.env.QBO_SANDBOX_CLIENT_SECRET || ''
    }
  } else {
    return {
      clientId: process.env.QBO_PRODUCTION_CLIENT_ID || '',
      clientSecret: process.env.QBO_PRODUCTION_CLIENT_SECRET || ''
    }
  }
}

function getPriorBusinessDay(date: Date): Date {
  const prior = new Date(date)
  prior.setDate(prior.getDate() - 1)

  // Skip back over weekends
  while (prior.getDay() === 0 || prior.getDay() === 6) {
    prior.setDate(prior.getDate() - 1)
  }

  return prior
}

function canSyncNow(lastSyncTimestamp: string | null): boolean {
  if (!lastSyncTimestamp) return true

  const now = new Date()
  const dayOfWeek = now.getDay()

  // Check if it's a business day (Monday = 1, Friday = 5)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false // No sync on weekends
  }

  const lastSync = new Date(lastSyncTimestamp)

  // Determine the target date the last sync covered
  let lastSyncCoveredThrough: Date
  if (lastSync.getHours() < 17) {
    // Synced before 5pm - covered through prior business day
    lastSyncCoveredThrough = getPriorBusinessDay(lastSync)
  } else {
    // Synced after 5pm - covered through same day
    lastSyncCoveredThrough = new Date(lastSync)
  }
  lastSyncCoveredThrough.setHours(23, 59, 59, 999)

  // Determine what date we need data through now
  let needDataThrough: Date
  if (now.getHours() < 17) {
    // Before 5pm - need data through prior business day
    needDataThrough = getPriorBusinessDay(now)
  } else {
    // After 5pm - need data through today
    needDataThrough = new Date(now)
  }
  needDataThrough.setHours(0, 0, 0, 0)

  // Can sync if last sync doesn't cover what we need now
  return lastSyncCoveredThrough < needDataThrough
}

function getPriorBusinessDayEnd(now: Date): string {
  const queryDate = new Date(now)

  if (now.getHours() < 17) {
    // Before 5pm: query through yesterday
    queryDate.setDate(queryDate.getDate() - 1)
  }

  // Format as YYYY-MM-DD
  return queryDate.toISOString().slice(0, 10)
}

async function refreshTokenIfNeeded(token: QboToken): Promise<QboToken> {
  const now = Math.floor(Date.now() / 1000)
  
  // Refresh 2 minutes before expiry
  if (now < (Number(token.expires_at) - 120)) {
    return token // Token still valid
  }

  const credentials = getCredentials(token.environment || 'production')
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(`Missing QuickBooks ${token.environment} credentials for token refresh`)
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', token.refresh_token)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Refresh token failed:', res.status, text)
    throw new Error('Failed to refresh QuickBooks token')
  }

  const json = await res.json() as QboRefreshTokenResponse
  const expiresAt = Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600)

  const refreshedToken: QboToken = {
    ...token,
    access_token: json.access_token,
    refresh_token: json.refresh_token || token.refresh_token,
    expires_at: expiresAt,
  }

  // Update in database
  const supabase = getSupabaseAdmin()
  await supabase
    .from('qbo_tokens')
    .update({
      access_token: refreshedToken.access_token,
      refresh_token: refreshedToken.refresh_token,
      expires_at: refreshedToken.expires_at,
    })
    .eq('id', 1)

  return refreshedToken
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authentication (any authenticated user can trigger sync)
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const supabase = getSupabaseAdmin()

    // Get QBO token
    const { data: tokenData, error: tokenError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .eq('id', 1)
      .single()

    if (tokenError || !tokenData) {
      return res.status(401).json({ 
        error: 'not_connected',
        message: 'QuickBooks not connected' 
      })
    }

    // Check if sync is allowed now
    const { data: cacheData } = await supabase
      .from('qbo_cache')
      .select('last_sync_timestamp')
      .eq('id', 1)
      .single()

    // Check if already synced (admins can bypass this restriction)
    console.log('Sync check - User:', user.email, 'isAdmin:', user.isAdmin, 'canSyncNow:', canSyncNow(cacheData?.last_sync_timestamp || null))
    if (cacheData?.last_sync_timestamp && !canSyncNow(cacheData.last_sync_timestamp)) {
      if (!user.isAdmin) {
        console.log('Blocking sync - not admin and already synced today')
        return res.status(429).json({
          error: 'already_synced_today',
          message: 'Data has already been synced this business day. Please wait until the next business day at 5pm.',
          lastSyncTimestamp: cacheData.last_sync_timestamp,
        })
      }
      // Admin user - allow sync even if already synced today
      console.log('Admin override: allowing sync even though data was synced today')
    }

    // Refresh token if needed
    const token = await refreshTokenIfNeeded(tokenData)

    const now = new Date()
    const year = now.getFullYear()
    const start = `${year}-01-01`
    const end = getPriorBusinessDayEnd(now)

    const realmId = token.realm_id
    const baseUrl = token.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    // Fetch all three reports
    
    // 1. Daily P&L
    const dailyUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/ProfitAndLoss`)
    dailyUrl.searchParams.set('start_date', start)
    dailyUrl.searchParams.set('end_date', end)
    dailyUrl.searchParams.set('summarize_column_by', 'Days')
    dailyUrl.searchParams.set('minorversion', '75')

    const dailyRes = await fetch(dailyUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
      },
    })

    if (!dailyRes.ok) {
      const text = await dailyRes.text()
      console.error('Daily P&L failed:', dailyRes.status, text)
      return res.status(500).json({ 
        error: 'daily_pl_failed',
        message: 'Failed to fetch daily P&L report',
        details: text 
      })
    }

    const dailyData = await dailyRes.json()

    // 2. Class Summary P&L
    const summaryUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/ProfitAndLoss`)
    summaryUrl.searchParams.set('start_date', start)
    summaryUrl.searchParams.set('end_date', end)
    summaryUrl.searchParams.set('summarize_column_by', 'Classes')
    summaryUrl.searchParams.set('minorversion', '75')

    const summaryRes = await fetch(summaryUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
      },
    })

    if (!summaryRes.ok) {
      const text = await summaryRes.text()
      console.error('Class P&L failed:', summaryRes.status, text)
      return res.status(500).json({ 
        error: 'class_pl_failed',
        message: 'Failed to fetch class P&L report',
        details: text 
      })
    }

    const summaryData = await summaryRes.json()

    // 3. Balance Sheet
    const equityUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/BalanceSheet`)
    equityUrl.searchParams.set('date_macro', 'This Fiscal Year-to-date')
    equityUrl.searchParams.set('minorversion', '75')

    const equityRes = await fetch(equityUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
      },
    })

    if (!equityRes.ok) {
      const text = await equityRes.text()
      console.error('Balance Sheet failed:', equityRes.status, text)
      return res.status(500).json({ 
        error: 'balance_sheet_failed',
        message: 'Failed to fetch balance sheet',
        details: text 
      })
    }

    const equityData = await equityRes.json()

    // Store in cache
    const lastSyncTimestamp = new Date().toISOString()

    const { error: cacheError } = await supabase
      .from('qbo_cache')
      .upsert({
        id: 1,
        last_sync_timestamp: lastSyncTimestamp,
        daily: dailyData,
        summary: summaryData,
        equity: equityData,
        synced_by: user.id,
      })

    if (cacheError) {
      console.error('Failed to cache data:', cacheError)
      return res.status(500).json({ 
        error: 'cache_failed',
        message: 'Failed to cache QuickBooks data' 
      })
    }

    res.status(200).json({
      success: true,
      lastSyncTimestamp,
      message: 'Successfully synced all 2025 data'
    })
  } catch (error) {
    console.error('Sync error:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: error instanceof Error ? error.message : 'An error occurred' 
    })
  }
}

