import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseFromRequest } from '../_lib/supabase.js'
import { customAlphabet } from 'nanoid'

// Create nanoid generator with URL-safe characters (10 characters)
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  const supabase = getSupabaseFromRequest(req)

  // GET /api/shared-links?id={linkId} - Fetch shared link by ID
  if (req.method === 'GET') {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Link ID is required'
      })
    }

    try {
      // Fetch the shared link (no auth required - links are publicly readable)
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
      supabase.rpc('increment_shared_link_view', { link_id: id })
        .then(() => {
          // Successfully incremented view count
        }, (err: unknown) => {
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

  // POST /api/shared-links - Create new shared link
  if (req.method === 'POST') {
    // Require authentication
    const user = await requireAuth(req, res)
    if (!user) return

    const { view_mode, scenario_a_id, scenario_b_id, scenario_b_enabled, ui_settings } = req.body

    // Validate required fields
    if (!view_mode || !scenario_a_id) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'view_mode and scenario_a_id are required'
      })
    }

    // Validate view_mode
    if (view_mode !== 'YTD Detailed' && view_mode !== 'Multi-Year') {
      return res.status(400).json({
        error: 'bad_request',
        message: 'view_mode must be either "YTD Detailed" or "Multi-Year"'
      })
    }

    try {
      // Verify scenario A exists and is public
      const { data: scenarioA, error: scenarioAError } = await supabase
        .from('scenarios')
        .select('id, is_public, user_id')
        .eq('id', scenario_a_id)
        .single()

      if (scenarioAError || !scenarioA) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Scenario A not found'
        })
      }

      if (!scenarioA.is_public) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Scenario A must be public to create a shareable link'
        })
      }

      // If scenario B is enabled, verify it exists and is public
      if (scenario_b_enabled && scenario_b_id) {
        const { data: scenarioB, error: scenarioBError } = await supabase
          .from('scenarios')
          .select('id, is_public, user_id')
          .eq('id', scenario_b_id)
          .single()

        if (scenarioBError || !scenarioB) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Scenario B not found'
          })
        }

        if (!scenarioB.is_public) {
          return res.status(403).json({
            error: 'forbidden',
            message: 'Scenario B must be public to create a shareable link'
          })
        }
      }

      // Generate unique link ID
      let linkId = nanoid()
      let attempts = 0
      const maxAttempts = 5

      // Ensure ID is unique (extremely unlikely to collide, but be safe)
      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from('shared_links')
          .select('id')
          .eq('id', linkId)
          .single()

        if (!existing) break // ID is unique

        linkId = nanoid()
        attempts++
      }

      if (attempts >= maxAttempts) {
        return res.status(500).json({
          error: 'server_error',
          message: 'Failed to generate unique link ID'
        })
      }

      // Create shared link
      const { data: sharedLink, error: createError } = await supabase
        .from('shared_links')
        .insert({
          id: linkId,
          user_id: user.id,
          view_mode,
          scenario_a_id,
          scenario_b_id: scenario_b_enabled ? scenario_b_id : null,
          scenario_b_enabled: scenario_b_enabled || false,
          ui_settings: ui_settings || null
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating shared link:', createError)
        return res.status(500).json({
          error: 'create_failed',
          message: 'Failed to create shared link'
        })
      }

      // Construct full URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
      const fullUrl = `${baseUrl}/share/${linkId}`

      return res.status(201).json({
        link_id: linkId,
        url: fullUrl,
        created_at: sharedLink.created_at
      })
    } catch (error) {
      console.error('Error in shared link create:', error)
      return res.status(500).json({
        error: 'server_error',
        message: 'An error occurred'
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
