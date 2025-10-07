import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCors } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  res.status(200).json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    service: 'RadiantCare API'
  })
}

