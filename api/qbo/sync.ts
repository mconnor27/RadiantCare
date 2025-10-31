import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'
import { fetchEquityAccounts, fetchGeneralLedgerForAccount, type RetirementGLData } from '../_lib/qbo-retirement.js'

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
    lastSyncCoveredThrough.setHours(0, 0, 0, 0)
  }

  // Determine what date we'd sync through now
  const latestCoverageDate = now.getHours() < 17
    ? getPriorBusinessDay(now)
    : now

  latestCoverageDate.setHours(0, 0, 0, 0)

  // We can sync if latestCoverageDate is after lastSyncCoveredThrough
  return latestCoverageDate.getTime() > lastSyncCoveredThrough.getTime()
}

function getPriorBusinessDayEnd(date: Date): string {
  const now = date
  const isAfter5pm = now.getHours() >= 17

  let targetDate: Date
  if (isAfter5pm) {
    targetDate = new Date(now)
    targetDate.setHours(0, 0, 0, 0)
  } else {
    targetDate = getPriorBusinessDay(now)
  }

  return targetDate.toISOString().slice(0, 10)
}

async function refreshTokenIfNeeded(tokenData: QboToken): Promise<QboToken> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = Number(tokenData.expires_at)
  const fiveMinutes = 5 * 60

  if (expiresAt - now > fiveMinutes) {
    return tokenData
  }

  console.log('Token expired or expiring soon, refreshing...')
  const credentials = getCredentials(tokenData.environment)
  const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')

  const body = new URLSearchParams()
  body.append('grant_type', 'refresh_token')
  body.append('refresh_token', tokenData.refresh_token)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Token refresh failed:', response.status, text)
    throw new Error(`Token refresh failed: ${response.status} ${text}`)
  }

  const refreshData = (await response.json()) as QboRefreshTokenResponse
  const newExpiresAt = now + refreshData.expires_in

  const newToken: QboToken = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokenData.refresh_token,
    expires_at: newExpiresAt,
    environment: tokenData.environment,
    realm_id: tokenData.realm_id,
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('qbo_tokens')
    .update(newToken)
    .eq('id', 1)

  if (error) {
    console.error('Failed to save refreshed token:', error)
  } else {
    console.log('Token refreshed and saved successfully')
  }

  return newToken
}

async function logCronExecution(supabase: any, status: 'success' | 'error', details: any) {
  try {
    await supabase.from('cron_logs').insert({
      job_name: 'qbo_sync',
      status,
      details,
      executed_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log cron execution:', error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now()

  if (handleCors(req, res)) return

  try {
    const supabase = getSupabaseAdmin()

    // Check auth
    const isCronRequest = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
    let user
    if (!isCronRequest) {
      user = await requireAuth(req, res)
      if (!user) return
    }

    // Get target year from query parameter (defaults to current year)
    const targetYear = req.query.year
      ? parseInt(req.query.year as string, 10)
      : new Date().getFullYear()

    console.log(`\n=== QBO Sync Started for year ${targetYear} ===`)
    console.log('Time:', new Date().toISOString())
    console.log('Is Cron:', isCronRequest)

    // Get token
    const { data: tokenData, error: tokenError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .eq('id', 1)
      .single()

    if (tokenError || !tokenData) {
      console.error('Failed to fetch QBO token:', tokenError)
      return res.status(500).json({
        error: 'token_fetch_failed',
        message: 'Failed to fetch QuickBooks token',
        details: tokenError
      })
    }

    // Check for existing cache for this year
    const { data: cacheData } = await supabase
      .from('qbo_cache')
      .select('last_sync_timestamp')
      .eq('year', targetYear)
      .single()

    // Check if admin override
    const isAdmin = !isCronRequest && user?.isAdmin === true

    if (!isAdmin && cacheData?.last_sync_timestamp) {
      if (!canSyncNow(cacheData.last_sync_timestamp)) {
        console.log('Sync already performed today')
        return res.status(200).json({
          success: true,
          error: 'already_synced_today',
          message: 'Data has already been synced this business day. Please wait until the next business day at 5pm.',
          lastSyncTimestamp: cacheData.last_sync_timestamp,
        })
      }
    }

    if (isAdmin && cacheData?.last_sync_timestamp && !canSyncNow(cacheData.last_sync_timestamp)) {
      console.log('Admin override: allowing sync even though data was synced today')
    }

    // Refresh token if needed
    console.log('Token expires at:', new Date(Number(tokenData.expires_at) * 1000).toISOString())
    const token = await refreshTokenIfNeeded(tokenData)
    console.log('Token refreshed, new expires at:', new Date(Number(token.expires_at) * 1000).toISOString())

    const now = new Date()
    const start = `${targetYear}-01-01`
    // Simplified: just use yesterday (no need for federal holidays - cron runs M-F only)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const end = yesterday.toISOString().slice(0, 10)

    const realmId = token.realm_id
    const baseUrl = token.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    console.log(`Fetching data for year ${targetYear}, date range: ${start} to ${end}`)

    // Fetch all reports

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

    const dailyData = await dailyRes.json() as any
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

    const summaryData = await summaryRes.json() as any
    console.log('Class P&L fetched successfully, rows:', summaryData?.Rows?.Row?.length || 0)

    // 3. Balance Sheet
    const equityUrl = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/BalanceSheet`)
    equityUrl.searchParams.set('date_macro', 'This Fiscal Year-to-date')
    equityUrl.searchParams.set('accounting_method', 'Cash')
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

    const equityData = await equityRes.json() as any
    console.log('Balance Sheet fetched successfully, rows:', equityData?.Rows?.Row?.length || 0)

    // 4. Fetch retirement account IDs
    console.log('Fetching retirement account IDs...')
    const retirementAccounts = await fetchEquityAccounts(token.access_token, realmId, baseUrl)
    console.log('Found retirement accounts:', Object.keys(retirementAccounts))

    // 5. Fetch GL data for each retirement account
    console.log('Fetching General Ledger data for retirement accounts...')
    const retirementGLData: Record<string, RetirementGLData> = {}

    for (const [physician, accountInfo] of Object.entries(retirementAccounts)) {
      console.log(`Fetching GL for ${physician} (account ${accountInfo.accountId})...`)
      const glData = await fetchGeneralLedgerForAccount(
        token.access_token,
        realmId,
        baseUrl,
        accountInfo.accountId,
        start,
        end
      )
      retirementGLData[physician] = glData
      console.log(`${physician} retirement totals:`, glData.totals)
    }

    // Store in year-specific cache
    const lastSyncTimestamp = new Date().toISOString()
    console.log(`Updating cache for year ${targetYear} with timestamp:`, lastSyncTimestamp)

    const { error: cacheError } = await supabase
      .from('qbo_cache')
      .upsert({
        year: targetYear,
        last_sync_timestamp: lastSyncTimestamp,
        daily: dailyData,
        summary: summaryData,
        equity: equityData,
        retirement_accounts: retirementAccounts,
        retirement_gl_data: retirementGLData,
        synced_by: isCronRequest ? null : user?.id,
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
        year: targetYear,
        lastSyncTimestamp,
        executionTime,
        targetDateRange: { start, end },
        dataFetched: {
          dailyPL: true,
          classPL: true,
          balanceSheet: true,
          retirementAccounts: Object.keys(retirementAccounts).length
        }
      })
    }

    res.status(200).json({
      success: true,
      year: targetYear,
      lastSyncTimestamp,
      message: `Successfully synced all ${targetYear} data`
    })
  } catch (error) {
    console.error('Sync error:', error)

    const supabase = getSupabaseAdmin()
    const isCronRequest = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`

    if (isCronRequest) {
      await logCronExecution(supabase, 'error', {
        year: req.query.year || new Date().getFullYear(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    }

    res.status(500).json({
      error: 'sync_failed',
      message: 'Failed to sync QuickBooks data',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
