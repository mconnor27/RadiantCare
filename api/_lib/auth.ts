import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseFromRequest } from './supabase.js'

export interface AuthenticatedUser {
  id: string
  email: string
  isAdmin: boolean
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  try {
    const supabase = getSupabaseFromRequest(req)

    // Get the current user from the session
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required' })
      return null
    }

    // Get the user's profile to check admin status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      res.status(401).json({ error: 'unauthorized', message: 'User profile not found' })
      return null
    }

    return {
      id: profile.id,
      email: profile.email,
      isAdmin: profile.is_admin || false
    }
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'unauthorized', message: 'Authentication failed' })
    return null
  }
}

export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  const user = await requireAuth(req, res)

  if (!user) {
    return null
  }

  if (!user.isAdmin) {
    res.status(403).json({ error: 'forbidden', message: 'Admin privileges required' })
    return null
  }

  return user
}

// CORS headers for API routes
export function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )
}

// Handle OPTIONS requests for CORS
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  setCorsHeaders(res)
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  
  return false
}

