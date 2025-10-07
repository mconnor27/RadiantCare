import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseClient } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authentication
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const supabase = getSupabaseClient()
    const { search, tags, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('scenarios')
      .select('id, name, description, tags, created_at, updated_at, view_mode', { count: 'exact' })
      .eq('is_public', true)

    // Search by name/description/tags
    if (search && typeof search === 'string') {
      query = query.textSearch('search_vector', search)
    }

    // Filter by tags
    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim())
      query = query.contains('tags', tagArray)
    }

    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching public scenarios:', error)
      return res.status(500).json({ 
        error: 'fetch_failed',
        message: 'Failed to fetch public scenarios' 
      })
    }

    return res.status(200).json({
      scenarios: data,
      count,
      limit: Number(limit),
      offset: Number(offset)
    })
  } catch (error) {
    console.error('Error in public scenarios GET:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: 'An error occurred' 
    })
  }
}

