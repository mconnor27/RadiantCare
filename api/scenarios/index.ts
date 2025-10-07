import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth'
import { getSupabaseFromRequest } from '../_lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  // Require authentication
  const user = await requireAuth(req, res)
  if (!user) return

  const supabase = getSupabaseFromRequest(req)

  if (req.method === 'GET') {
    // List scenarios
    try {
      const { search, tags, isPublic, limit = 50, offset = 0 } = req.query

      let query = supabase
        .from('scenarios')
        .select('*', { count: 'exact' })

      // Apply filters
      if (isPublic === 'true') {
        // Only public scenarios
        query = query.eq('is_public', true)
      } else {
        // User's own scenarios + public scenarios
        query = query.or(`user_id.eq.${user.id},is_public.eq.true`)
      }

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
        console.error('Error fetching scenarios:', error)
        return res.status(500).json({ 
          error: 'fetch_failed',
          message: 'Failed to fetch scenarios' 
        })
      }

      return res.status(200).json({
        scenarios: data,
        count,
        limit: Number(limit),
        offset: Number(offset)
      })
    } catch (error) {
      console.error('Error in scenarios GET:', error)
      return res.status(500).json({ 
        error: 'server_error',
        message: 'An error occurred' 
      })
    }
  }

  if (req.method === 'POST') {
    // Create scenario
    try {
      const { name, description, tags, is_public, scenario_a, scenario_b, scenario_b_enabled, view_mode, ytd_settings } = req.body

      // Validation
      if (!name || !scenario_a) {
        return res.status(400).json({ 
          error: 'validation_error',
          message: 'Name and scenario_a are required' 
        })
      }

      // Limit scenario size (10MB max)
      const scenarioSize = JSON.stringify(req.body).length
      if (scenarioSize > 10 * 1024 * 1024) {
        return res.status(413).json({ 
          error: 'too_large',
          message: 'Scenario data exceeds maximum size of 10MB' 
        })
      }

      const { data, error } = await supabase
        .from('scenarios')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          tags: tags || [],
          is_public: is_public || false,
          scenario_a,
          scenario_b: scenario_b || null,
          scenario_b_enabled: scenario_b_enabled || false,
          view_mode: view_mode || 'YTD Detailed',
          ytd_settings: ytd_settings || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating scenario:', error)
        return res.status(500).json({ 
          error: 'create_failed',
          message: 'Failed to create scenario' 
        })
      }

      return res.status(201).json(data)
    } catch (error) {
      console.error('Error in scenarios POST:', error)
      return res.status(500).json({ 
        error: 'server_error',
        message: 'An error occurred' 
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

