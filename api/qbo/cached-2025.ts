import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseFromRequest } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authentication
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const supabase = getSupabaseFromRequest(req)

    // Get cached data
    const { data, error } = await supabase
      .from('qbo_cache')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('Supabase error reading cache:', error)
      return res.status(404).json({ 
        error: 'no_cached_data',
        message: 'No cached data available',
        details: error.message 
      })
    }

    if (!data) {
      console.error('No data returned from qbo_cache query')
      return res.status(404).json({ 
        error: 'no_cached_data',
        message: 'No cached data available (no rows returned)' 
      })
    }

    console.log('Successfully returning cached data')
    res.status(200).json(data)
  } catch (error) {
    console.error('Error reading cache:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: 'An error occurred' 
    })
  }
}

