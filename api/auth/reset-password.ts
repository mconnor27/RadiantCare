import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' })
    return
  }

  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ error: 'missing_email', message: 'Email is required' })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'invalid_email', message: 'Invalid email format' })
      return
    }

    // Get Supabase client
    const supabase = getSupabaseClient()

    // Send password reset email using Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.headers.origin || 'http://localhost:3000'}/auth/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)

      // Handle specific Supabase errors
      if (error.message.includes('Email not confirmed')) {
        res.status(400).json({
          error: 'email_not_confirmed',
          message: 'Please confirm your email address before resetting your password'
        })
        return
      }

      if (error.message.includes('User not found')) {
        // For security, don't reveal if email exists or not
        res.status(200).json({
          success: true,
          message: 'If an account with that email exists, you will receive a password reset link'
        })
        return
      }

      res.status(500).json({ error: 'reset_failed', message: 'Failed to send reset email' })
      return
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Password reset email sent! Check your inbox for further instructions.'
    })

  } catch (error) {
    console.error('Unexpected error in reset-password API:', error)
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred. Please try again later.'
    })
  }
}
