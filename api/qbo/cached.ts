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

    // Get year from query parameter (defaults to current year)
    const targetYear = req.query.year
      ? parseInt(req.query.year as string, 10)
      : new Date().getFullYear()

    // Get cached data for specific year
    const { data, error } = await supabase
      .from('qbo_cache')
      .select('*')
      .eq('year', targetYear)
      .single()

    if (error) {
      console.error(`Supabase error reading cache for year ${targetYear}:`, error)
      return res.status(404).json({
        error: 'no_cached_data',
        message: `No cached data available for year ${targetYear}`,
        details: error.message,
        year: targetYear
      })
    }

    if (!data) {
      console.error(`No data returned from qbo_cache query for year ${targetYear}`)
      return res.status(404).json({
        error: 'no_cached_data',
        message: `No cached data available for year ${targetYear} (no rows returned)`,
        year: targetYear
      })
    }

    console.log(`Successfully returning cached data for year ${targetYear}`)

    // Transform to camelCase for frontend
    const response = {
      year: data.year,
      lastSyncTimestamp: data.last_sync_timestamp,
      daily: data.daily,
      summary: data.summary,
      equity: data.equity,
      retirementAccounts: data.retirement_accounts,
      retirementGLData: data.retirement_gl_data,
      syncedBy: data.synced_by,
      updatedAt: data.updated_at,
      createdAt: data.created_at
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Error reading cache:', error)
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred'
    })
  }
}
