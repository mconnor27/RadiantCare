import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, handleCors } from '../../_lib/auth.js'
import { getSupabaseFromRequest } from '../../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

  try {
    // Get the source scenario
    const { data: source, error: fetchError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !source) {
      return res.status(404).json({ 
        error: 'not_found',
        message: 'Scenario not found' 
      })
    }

    // Check access: owner or public
    if (source.user_id !== user.id && !source.is_public) {
      return res.status(403).json({ 
        error: 'forbidden',
        message: 'Cannot clone private scenario' 
      })
    }

    // Get optional new name from request body
    const { name } = req.body
    const clonedName = name || `${source.name} (Copy)`

    // Create cloned scenario
    const { data: cloned, error: cloneError } = await supabase
      .from('scenarios')
      .insert({
        user_id: user.id, // New owner is current user
        name: clonedName,
        description: source.description ? `Cloned from: ${source.name}\n\n${source.description}` : `Cloned from: ${source.name}`,
        tags: source.tags,
        is_public: false, // Clones are private by default
        scenario_a: source.scenario_a,
        scenario_b: source.scenario_b,
        scenario_b_enabled: source.scenario_b_enabled,
        view_mode: source.view_mode,
        ytd_settings: source.ytd_settings,
      })
      .select()
      .single()

    if (cloneError) {
      console.error('Error cloning scenario:', cloneError)
      return res.status(500).json({ 
        error: 'clone_failed',
        message: 'Failed to clone scenario' 
      })
    }

    return res.status(201).json(cloned)
  } catch (error) {
    console.error('Error in scenario clone:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: 'An error occurred' 
    })
  }
}

