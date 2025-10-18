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

// US Federal Holidays (2025)
const FEDERAL_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
]

function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay()

  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }

  // Check if federal holiday
  const dateStr = date.toISOString().slice(0, 10)
  if (FEDERAL_HOLIDAYS_2025.includes(dateStr)) {
    return false
  }

  return true
}

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

async function logCronExecution(
  supabase: any,
  status: 'success' | 'skipped' | 'error',
  details: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('cron_logs').insert({
      status,
      details,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    // Log to console if Supabase insert fails
    console.error('Failed to log to cron_logs table:', err)
  }
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

  // Check if this is a cron request
  const authHeader = req.headers.authorization
  const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`

  // Allow GET requests for cron jobs, POST for regular requests
  if (!isCronRequest && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isCronRequest && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let user = null
  const supabase = getSupabaseAdmin()
  
  if (isCronRequest) {
    // Cron authentication - check if the TARGET sync date (prior business day) is valid
    // This allows Saturday morning runs to sync Friday's data
    const now = new Date()
    const targetDate = getPriorBusinessDay(now)
    
    if (!isBusinessDay(targetDate)) {
      const skipDetails = {
        reason: 'target_not_business_day',
        executionTime: now.toISOString(),
        targetDate: targetDate.toISOString(),
        dayOfWeek: now.getDay(),
        timezone: 'Pacific'
      }
      console.log('Cron skipped: Target date is not a business day', targetDate.toISOString())
      await logCronExecution(supabase, 'skipped', skipDetails)
      
      return res.status(200).json({
        skipped: true,
        ...skipDetails,
        message: 'Sync skipped - target date is not a business day'
      })
    }

    // Broadcast warning to active users via Supabase
    try {
      await supabase
        .from('sync_notifications')
        .insert({
          message: 'QuickBooks sync starting - your view may refresh shortly',
          created_at: new Date().toISOString()
        })
      console.log('Sync warning broadcast to active users')
    } catch (err) {
      console.error('Failed to broadcast sync warning:', err)
      // Don't fail the sync if notification fails
    }

    // Create a synthetic admin user for cron
    user = { id: 'cron', email: 'cron@system', isAdmin: true }
  } else {
    // Regular authenticated user request
    user = await requireAuth(req, res)
    if (!user) return
  }

  try {
    const startTime = Date.now()

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
    console.log('Token expires at:', new Date(Number(tokenData.expires_at) * 1000).toISOString())
    const token = await refreshTokenIfNeeded(tokenData)
    console.log('Token refreshed, new expires at:', new Date(Number(token.expires_at) * 1000).toISOString())

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

    console.log('Fetching Daily P&L from:', dailyUrl.toString())
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
        details: text,
        url: dailyUrl.toString()
      })
    }

    const dailyData = await dailyRes.json()
    console.log('Daily P&L fetched successfully, rows:', dailyData?.Rows?.Row?.length || 0)

    // 2. Class Summary P&L
    const summaryUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/ProfitAndLoss`)
    summaryUrl.searchParams.set('start_date', start)
    summaryUrl.searchParams.set('end_date', end)
    summaryUrl.searchParams.set('summarize_column_by', 'Classes')
    summaryUrl.searchParams.set('minorversion', '75')

    console.log('Fetching Class P&L from:', summaryUrl.toString())
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
        details: text,
        url: summaryUrl.toString()
      })
    }

    const summaryData = await summaryRes.json()
    console.log('Class P&L fetched successfully, rows:', summaryData?.Rows?.Row?.length || 0)

    // 3. Balance Sheet
    const equityUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/BalanceSheet`)
    equityUrl.searchParams.set('date_macro', 'This Fiscal Year-to-date')
    equityUrl.searchParams.set('minorversion', '75')

    console.log('Fetching Balance Sheet from:', equityUrl.toString())
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
        details: text,
        url: equityUrl.toString()
      })
    }

    const equityData = await equityRes.json()
    console.log('Balance Sheet fetched successfully, rows:', equityData?.Rows?.Row?.length || 0)

    // Store in cache
    const lastSyncTimestamp = new Date().toISOString()
    console.log('Updating cache with timestamp:', lastSyncTimestamp)
    console.log('Cache data sizes - Daily:', JSON.stringify(dailyData).length, 'Summary:', JSON.stringify(summaryData).length, 'Equity:', JSON.stringify(equityData).length)

    const { error: cacheError } = await supabase
      .from('qbo_cache')
      .upsert({
        id: 1,
        last_sync_timestamp: lastSyncTimestamp,
        daily: dailyData,
        summary: summaryData,
        equity: equityData,
        synced_by: isCronRequest ? null : user.id,
      })

    if (cacheError) {
      console.error('Failed to cache data:', cacheError)
      return res.status(500).json({
        error: 'cache_failed',
        message: 'Failed to cache QuickBooks data',
        details: cacheError
      })
    }

    console.log('Cache updated successfully')

    // Log successful cron execution
    if (isCronRequest) {
      const endTime = Date.now()
      const executionTime = endTime - startTime
      await logCronExecution(supabase, 'success', {
        lastSyncTimestamp,
        executionTime,
        executionTimeMs: executionTime,
        executionTimeSec: (executionTime / 1000).toFixed(2),
        targetDateRange: { start, end },
        timezone: 'Pacific',
        dataFetched: {
          dailyPL: true,
          classPL: true,
          balanceSheet: true
        }
      })
    }

    res.status(200).json({
      success: true,
      lastSyncTimestamp,
      message: 'Successfully synced all 2025 data'
    })
  } catch (error) {
    console.error('Sync error:', error)
    
    // Log error for cron executions
    if (isCronRequest) {
      await logCronExecution(supabase, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    }
    
    return res.status(500).json({ 
      error: 'server_error',
      message: error instanceof Error ? error.message : 'An error occurred' 
    })
  }
}

