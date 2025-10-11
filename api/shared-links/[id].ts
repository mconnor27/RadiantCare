import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCors } from '../_lib/auth.js'
import { getSupabaseFromRequest } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getSupabaseFromRequest(req)
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Link ID is required'
    })
  }

  try {
    // Fetch the shared link
    const { data: sharedLink, error: fetchError } = await supabase
      .from('shared_links')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !sharedLink) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Shared link not found'
      })
    }

    // Check if link is expired (if expires_at is set)
    if (sharedLink.expires_at) {
      const expiresAt = new Date(sharedLink.expires_at)
      if (expiresAt < new Date()) {
        return res.status(410).json({
          error: 'expired',
          message: 'This shared link has expired'
        })
      }
    }

    // Fetch scenario A data
    const { data: scenarioA, error: scenarioAError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', sharedLink.scenario_a_id)
      .single()

    if (scenarioAError || !scenarioA) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Scenario A no longer exists'
      })
    }

    // Fetch scenario B data if enabled
    let scenarioB = null
    if (sharedLink.scenario_b_enabled && sharedLink.scenario_b_id) {
      const { data: scenarioBData, error: scenarioBError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', sharedLink.scenario_b_id)
        .single()

      if (scenarioBError || !scenarioBData) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Scenario B no longer exists'
        })
      }

      scenarioB = scenarioBData
    }

    // Increment view count asynchronously (don't wait for it)
    supabase.rpc('increment_shared_link_view', { link_id: id }).then(() => {
      // Ignore result
    }).catch((err) => {
      console.error('Failed to increment view count:', err)
    })

    // Return the shared link data with scenarios
    return res.status(200).json({
      link_id: sharedLink.id,
      view_mode: sharedLink.view_mode,
      scenario_a: scenarioA,
      scenario_b: scenarioB,
      scenario_b_enabled: sharedLink.scenario_b_enabled,
      ui_settings: sharedLink.ui_settings,
      created_at: sharedLink.created_at,
      view_count: sharedLink.view_count
    })
  } catch (error) {
    console.error('Error fetching shared link:', error)
    return res.status(500).json({
      error: 'server_error',
      message: 'An error occurred'
    })
  }
}
