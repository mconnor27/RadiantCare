import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const OAUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2'

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

  const environment = (req.query.env as string) || 'production'
  const credentials = getCredentials(environment)

  if (!credentials.clientId || !credentials.clientSecret) {
    return res.status(500).json({ 
      error: 'missing_credentials',
      message: `Missing QuickBooks ${environment} credentials` 
    })
  }

  // Get the base URL from environment or construct from request
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
  
  const redirectUri = `${baseUrl}/api/qbo/callback`

  console.log('QBO Connect - Environment:', environment)
  console.log('QBO Connect - Redirect URI:', redirectUri)

  // Encode environment in state parameter
  const stateData = {
    random: crypto.randomBytes(8).toString('hex'),
    env: environment
  }
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

  const params = new URLSearchParams()
  params.set('client_id', credentials.clientId)
  params.set('redirect_uri', redirectUri)
  params.set('response_type', 'code')
  params.set('scope', 'com.intuit.quickbooks.accounting')
  params.set('state', state)
  
  if (environment === 'sandbox') {
    params.set('environment', 'sandbox')
  }

  res.redirect(307, `${OAUTH_BASE}?${params.toString()}`)
}

