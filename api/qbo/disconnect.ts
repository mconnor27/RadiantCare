import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, handleCors } from '../_lib/auth'
import { getSupabaseAdmin } from '../_lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require admin privileges
  const user = await requireAdmin(req, res)
  if (!user) return

  try {
    const supabase = getSupabaseAdmin()

    // Delete the QBO tokens (single row with id=1)
    const { error } = await supabase
      .from('qbo_tokens')
      .delete()
      .eq('id', 1)

    if (error) {
      console.error('Failed to delete tokens:', error)
      return res.status(500).json({ 
        error: 'delete_failed',
        message: 'Failed to disconnect QuickBooks' 
      })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('QBO disconnect error:', error)
    return res.status(500).json({ 
      error: 'server_error',
      message: 'An error occurred' 
    })
  }
}

