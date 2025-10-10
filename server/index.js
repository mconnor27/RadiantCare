/* eslint-disable no-console */
import express from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const app = express()
app.use(express.json())

// Add ngrok-skip-browser-warning header to bypass ngrok warning page
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true')
  next()
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000

// Helper function to get environment-specific credentials
const getCredentials = (env) => {
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

const REDIRECT_URI = 'https://unodored-bethanie-rambunctiously.ngrok-free.app/api/qbo/callback'

const OAUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const API_BASE = 'https://quickbooks.api.intuit.com/v3/company'

const TOKEN_PATH = path.resolve(process.cwd(), 'tokenStore.json')

function readToken() {
  try {
    const raw = fs.readFileSync(TOKEN_PATH, 'utf8')
    const json = JSON.parse(raw)
    return json
  } catch {
    return null
  }
}

function writeToken(data) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2))
}

function isAccessTokenExpired(token) {
  if (!token?.expires_at) return true
  const now = Math.floor(Date.now() / 1000)
  // Refresh 2 minutes before expiry
  return now >= (Number(token.expires_at) - 120)
}

async function refreshAccessTokenIfNeeded() {
  const token = readToken()
  if (!token) return null
  if (!isAccessTokenExpired(token)) return token
  if (!token.refresh_token) return null

  const credentials = getCredentials(token.environment || 'production')
  if (!credentials.clientId || !credentials.clientSecret) {
    console.error(`Missing QuickBooks ${token.environment || 'production'} credentials for token refresh`)
    return null
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
    return null
  }
  const json = await res.json()
  const expires_at = Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600)
  const next = {
    ...token,
    access_token: json.access_token,
    refresh_token: json.refresh_token || token.refresh_token,
    expires_at,
  }
  writeToken(next)
  return next
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/qbo/connect', (req, res) => {
  const environment = req.query.env || 'production' // Get env from query parameter
  const credentials = getCredentials(environment)
  
  if (!credentials.clientId || !credentials.clientSecret) {
    return res.status(500).send(`Missing QuickBooks ${environment} credentials`)
  }
  
  console.log('DEBUG: Using REDIRECT_URI:', REDIRECT_URI)
  console.log('DEBUG: Using environment:', environment)
  
  // Encode environment in state parameter so we get it back in callback
  const stateData = {
    random: crypto.randomBytes(8).toString('hex'),
    env: environment
  }
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64')
  
  const params = new URLSearchParams()
  params.set('client_id', credentials.clientId)
  params.set('redirect_uri', REDIRECT_URI)
  params.set('response_type', 'code')
  params.set('scope', 'com.intuit.quickbooks.accounting')
  params.set('state', state)
  if (environment === 'sandbox') params.set('environment', 'sandbox')
  res.redirect(`${OAUTH_BASE}?${params.toString()}`)
})

app.get('/api/qbo/callback', async (req, res) => {
  const code = req.query.code
  const realmId = req.query.realmId
  const state = req.query.state
  
  if (!code || !realmId) {
    return res.status(400).send('Missing code or realmId')
  }
  
  // Decode environment from state parameter
  let environment = 'production'
  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      environment = stateData.env || 'production'
    }
  } catch (e) {
    console.log('Could not decode state parameter, using production environment')
  }
  
  console.log('DEBUG: Callback using environment:', environment)
  
  const credentials = getCredentials(environment)
  if (!credentials.clientId || !credentials.clientSecret) {
    return res.status(500).send(`Missing QuickBooks ${environment} credentials`)
  }
  
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', String(code))
  body.set('redirect_uri', REDIRECT_URI)

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!r.ok) {
    const text = await r.text()
    console.error('Token exchange failed:', r.status, text)
    return res.status(500).send('Token exchange failed')
  }
  const json = await r.json()
  const expires_at = Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600)
  writeToken({
    realmId: String(realmId),
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at,
    environment, // Store the environment with the token
  })
  // Redirect back to app root
  res.redirect('/')
})

app.get('/api/qbo/disconnect', (_req, res) => {
  try {
    fs.unlinkSync(TOKEN_PATH)
  } catch {}
  res.json({ ok: true })
})

app.get('/api/qbo/ytd-income', async (req, res) => {
  try {
    let token = readToken()
    if (!token) return res.status(401).json({ error: 'not_connected' })
    token = await refreshAccessTokenIfNeeded()
    if (!token) return res.status(401).json({ error: 'not_connected' })

    // Use the environment from the request or from the stored token
    const environment = req.query.env || token.environment || 'production'
    const apiBase = environment === 'sandbox' 
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company'
    
    console.log('DEBUG: YTD request - environment:', environment)
    console.log('DEBUG: YTD request - apiBase:', apiBase)
    console.log('DEBUG: YTD request - realmId:', token.realmId)

    const now = new Date()
    const year = now.getFullYear()
    const start = `${year}-01-01`
    const end = now.toISOString().slice(0, 10)

    const url = new URL(`${apiBase}/${encodeURIComponent(token.realmId)}/reports/ProfitAndLoss`)
    url.searchParams.set('start_date', start)
    url.searchParams.set('end_date', end)
    url.searchParams.set('summarize_column_by', 'Days')
    url.searchParams.set('minorversion', '65')
    url.searchParams.set('accounting_method', 'Accrual')

    const r = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
      },
    })
    if (!r.ok) {
      const text = await r.text()
      console.error('QBO report failed:', r.status, text)
      console.error('Request URL:', url.toString())
      console.error('Environment:', environment)
      if (r.status === 401) return res.status(401).json({ error: 'not_connected' })
      return res.status(500).json({ error: 'QBO API error', status: r.status, details: text })
    }
    const report = await r.json()
    const points = extractDailyIncomeFromPL(report)
    res.json({ points })
  } catch (e) {
    console.error(e)
    res.status(500).send('Server error')
  }
})

function extractDailyIncomeFromPL(report) {
  try {
    const columns = (report?.Columns?.Column || []).map(c => c.ColTitle).filter(Boolean)
    // Find the Income section rows
    const incomeSection = (report?.Rows?.Row || []).find(r => r?.Header?.ColData?.[0]?.value === 'Income')
    const rows = incomeSection?.Rows?.Row || []
    // Sum each column across all income lines
    const sums = new Array(columns.length).fill(0)
    for (const row of rows) {
      const colData = row?.ColData || []
      for (let i = 0; i < columns.length; i++) {
        const v = Number(colData?.[i + 1]?.value || 0) // first column is row label
        if (!isNaN(v)) sums[i] += v
      }
    }
    // Build cumulative series
    const points = []
    let acc = 0
    for (let i = 0; i < columns.length; i++) {
      acc += sums[i]
      // Column title is date like 1/21/2025 depending on locale; try to parse
      const d = new Date(columns[i])
      const iso = isNaN(d.getTime()) ? columns[i] : d.toISOString().slice(0, 10)
      points.push({ date: iso, cumulativeIncome: acc })
    }
    return points
  } catch {
    return []
  }
}

// Cache management for 2025 data
const CACHE_PATH = path.resolve(process.cwd(), 'qboCache.json')

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCache(data) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2))
}

function getPriorBusinessDay(date) {
  const prior = new Date(date)
  prior.setDate(prior.getDate() - 1)

  // Skip back over weekends
  while (prior.getDay() === 0 || prior.getDay() === 6) {
    prior.setDate(prior.getDate() - 1)
  }

  return prior
}

function canSyncNow(lastSyncTimestamp) {
  if (!lastSyncTimestamp) return true

  const now = new Date()
  const dayOfWeek = now.getDay()

  // Check if it's a business day (Monday = 1, Friday = 5)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false // No sync on weekends
  }

  const lastSync = new Date(lastSyncTimestamp)

  // Determine the target date the last sync covered
  let lastSyncCoveredThrough
  if (lastSync.getHours() < 17) {
    // Synced before 5pm - covered through prior business day
    lastSyncCoveredThrough = getPriorBusinessDay(lastSync)
  } else {
    // Synced after 5pm - covered through same day
    lastSyncCoveredThrough = new Date(lastSync)
  }
  lastSyncCoveredThrough.setHours(23, 59, 59, 999) // End of that day

  // Determine what date we need data through now
  let needDataThrough
  if (now.getHours() < 17) {
    // Before 5pm - need data through prior business day
    needDataThrough = getPriorBusinessDay(now)
  } else {
    // After 5pm - need data through today
    needDataThrough = new Date(now)
  }
  needDataThrough.setHours(0, 0, 0, 0) // Start of that day

  // Can sync if last sync doesn't cover what we need now
  return lastSyncCoveredThrough < needDataThrough
}

function getPriorBusinessDayEnd(now) {
  // If before 5pm, query through yesterday
  // If after 5pm, query through today
  const queryDate = new Date(now)

  if (now.getHours() < 17) {
    // Before 5pm: query through yesterday
    queryDate.setDate(queryDate.getDate() - 1)
  }

  // Format as YYYY-MM-DD using local timezone, not UTC
  const year = queryDate.getFullYear()
  const month = String(queryDate.getMonth() + 1).padStart(2, '0')
  const day = String(queryDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Sync endpoint for all 2025 data
app.post('/api/qbo/sync-2025', async (req, res) => {
  try {
    let token = readToken()
    if (!token) return res.status(401).json({ error: 'not_connected' })
    token = await refreshAccessTokenIfNeeded()
    if (!token) return res.status(401).json({ error: 'not_connected' })

    // Check if sync is allowed now (allow admin override via request body)
    const cache = readCache()
    const isAdminOverride = req.body?.adminOverride === true
    if (cache?.lastSyncTimestamp && !canSyncNow(cache.lastSyncTimestamp) && !isAdminOverride) {
      return res.status(429).json({
        error: 'already_synced_today',
        message: 'Data has already been synced this business day. Please wait until the next business day at 5pm.',
        lastSyncTimestamp: cache.lastSyncTimestamp,
        data: cache
      })
    }
    if (isAdminOverride) {
      console.log('Admin override: allowing sync even though data was synced today')
    }

    const now = new Date()
    const year = now.getFullYear()
    const start = `${year}-01-01`
    const end = getPriorBusinessDayEnd(now)

    // Fetch all three reports
    const realmId = token.realmId
    const baseUrl = 'https://quickbooks.api.intuit.com'

    // 1. Daily P&L (replaces 2025_daily.json)
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
      if (dailyRes.status === 401 || dailyRes.status === 403) {
        return res.status(401).json({ error: 'not_connected', message: 'QuickBooks authorization failed. Please reconnect.' })
      }
      return res.status(500).json({ error: 'daily_pl_failed', message: 'Failed to fetch daily P&L report', details: text })
    }
    const dailyData = await dailyRes.json()

    // 2. Class Summary P&L (replaces 2025_summary.json)
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
      if (summaryRes.status === 401 || summaryRes.status === 403) {
        return res.status(401).json({ error: 'not_connected', message: 'QuickBooks authorization failed. Please reconnect.' })
      }
      return res.status(500).json({ error: 'class_pl_failed', message: 'Failed to fetch class P&L report', details: text })
    }
    const summaryData = await summaryRes.json()

    // 3. Balance Sheet (replaces 2025_equity.json)
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
      if (equityRes.status === 401 || equityRes.status === 403) {
        return res.status(401).json({ error: 'not_connected', message: 'QuickBooks authorization failed. Please reconnect.' })
      }
      return res.status(500).json({ error: 'balance_sheet_failed', message: 'Failed to fetch balance sheet', details: text })
    }
    const equityData = await equityRes.json()

    // Cache the results
    const cacheData = {
      lastSyncTimestamp: new Date().toISOString(),
      daily: dailyData,
      summary: summaryData,
      equity: equityData
    }
    writeCache(cacheData)

    res.json({
      success: true,
      lastSyncTimestamp: cacheData.lastSyncTimestamp,
      message: 'Successfully synced all 2025 data'
    })
  } catch (e) {
    console.error('Sync error:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// Get cached 2025 data
app.get('/api/qbo/cached-2025', (req, res) => {
  try {
    const cache = readCache()
    if (!cache) {
      return res.status(404).json({ error: 'no_cached_data' })
    }
    res.json(cache)
  } catch (e) {
    console.error('Error reading cache:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})


