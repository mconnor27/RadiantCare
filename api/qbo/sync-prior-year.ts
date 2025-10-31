import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCors } from '../_lib/auth.js'
import handler as syncHandler from './sync.js'

/**
 * Convenience endpoint to sync prior year
 * Redirects to generic sync endpoint with prior year parameter
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  // Get current year from app_settings would be ideal, but for simplicity:
  const currentYear = new Date().getFullYear()
  const priorYear = currentYear - 1

  console.log(`Prior year sync requested, syncing year ${priorYear}`)

  // Redirect to generic sync endpoint with prior year
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  url.searchParams.set('year', priorYear.toString())

  // Create new request with year parameter
  const newReq = {
    ...req,
    url: url.toString(),
    query: {
      ...req.query,
      year: priorYear.toString()
    }
  } as VercelRequest

  return syncHandler(newReq, res)
}
