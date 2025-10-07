import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../_lib/auth.js'
import { getSupabaseFromRequest } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  // Require authentication
  const user = await requireAuth(req, res)
  if (!user) return

  const supabase = getSupabaseFromRequest(req)
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      error: 'bad_request',
      message: 'Scenario ID is required' 
    })
  }

  if (req.method === 'GET') {
    // Get single scenario
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return res.status(404).json({ 
          error: 'not_found',
          message: 'Scenario not found' 
        })
      }

      // Check access: owner or public
      if (data.user_id !== user.id && !data.is_public) {
        return res.status(403).json({ 
          error: 'forbidden',
          message: 'Access denied' 
        })
      }

      return res.status(200).json(data)
    } catch (error) {
      console.error('Error fetching scenario:', error)
      return res.status(500).json({ 
        error: 'server_error',
        message: 'An error occurred' 
      })
    }
  }

  if (req.method === 'PUT') {
    // Update scenario
    try {
      const { name, description, tags, is_public, scenario_a, scenario_b, scenario_b_enabled, view_mode, ytd_settings } = req.body

      // Check ownership first
      const { data: existing, error: fetchError } = await supabase
        .from('scenarios')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchError || !existing) {
        return res.status(404).json({ 
          error: 'not_found',
          message: 'Scenario not found' 
        })
      }

      if (existing.user_id !== user.id) {
        return res.status(403).json({ 
          error: 'forbidden',
          message: 'Only the owner can update this scenario' 
        })
      }

      // Validation
      if (name && name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'validation_error',
          message: 'Name cannot be empty' 
        })
      }

      // Build update object (only include provided fields)
      const updates: any = {}
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (tags !== undefined) updates.tags = tags
      if (is_public !== undefined) updates.is_public = is_public
      if (scenario_a !== undefined) updates.scenario_a = scenario_a
      if (scenario_b !== undefined) updates.scenario_b = scenario_b
      if (scenario_b_enabled !== undefined) updates.scenario_b_enabled = scenario_b_enabled
      if (view_mode !== undefined) updates.view_mode = view_mode
      if (ytd_settings !== undefined) updates.ytd_settings = ytd_settings

      const { data, error } = await supabase
        .from('scenarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating scenario:', error)
        return res.status(500).json({ 
          error: 'update_failed',
          message: 'Failed to update scenario' 
        })
      }

      return res.status(200).json(data)
    } catch (error) {
      console.error('Error in scenario PUT:', error)
      return res.status(500).json({ 
        error: 'server_error',
        message: 'An error occurred' 
      })
    }
  }

  if (req.method === 'DELETE') {
    // Delete scenario
    try {
      // Check ownership first
      const { data: existing, error: fetchError } = await supabase
        .from('scenarios')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchError || !existing) {
        return res.status(404).json({ 
          error: 'not_found',
          message: 'Scenario not found' 
        })
      }

      if (existing.user_id !== user.id) {
        return res.status(403).json({ 
          error: 'forbidden',
          message: 'Only the owner can delete this scenario' 
        })
      }

      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting scenario:', error)
        return res.status(500).json({ 
          error: 'delete_failed',
          message: 'Failed to delete scenario' 
        })
      }

      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('Error in scenario DELETE:', error)
      return res.status(500).json({ 
        error: 'server_error',
        message: 'An error occurred' 
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

