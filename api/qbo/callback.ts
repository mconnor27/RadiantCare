import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase.js'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = req.query.code as string
  const realmId = req.query.realmId as string
  const state = req.query.state as string

  if (!code || !realmId) {
    return res.status(400).json({ 
      error: 'bad_request',
      message: 'Missing code or realmId' 
    })
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

  console.log('QBO Callback - Environment:', environment)

  const credentials = getCredentials(environment)
  if (!credentials.clientId || !credentials.clientSecret) {
    return res.status(500).json({ 
      error: 'missing_credentials',
      message: `Missing QuickBooks ${environment} credentials` 
    })
  }

  // Get the redirect URI (must match what was used in connect)
  const redirectUri = process.env.QBO_REDIRECT_URI || 
    (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/qbo/callback`
      : `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/qbo/callback`)

  // Exchange code for tokens
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', redirectUri)

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Token exchange failed:', response.status, text)
      return res.status(500).json({ 
        error: 'token_exchange_failed',
        message: 'Failed to exchange authorization code for tokens' 
      })
    }

    const json = await response.json()
    const expiresAt = Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600)

    // Store tokens in Supabase (admin client to bypass RLS)
    const supabase = getSupabaseAdmin()
    
    const { error: upsertError } = await supabase
      .from('qbo_tokens')
      .upsert({
        id: 1, // Single row
        realm_id: realmId,
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: expiresAt,
        environment,
      })

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError)
      return res.status(500).json({ 
        error: 'storage_failed',
        message: 'Failed to store QuickBooks tokens' 
      })
    }

    // Redirect back to app root
    res.redirect(307, '/')
  } catch (error) {
    console.error('QBO callback error:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: 'An error occurred during QuickBooks authentication' 
    })
  }
}

