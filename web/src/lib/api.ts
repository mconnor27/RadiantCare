import { supabase } from './supabase'

/**
 * Make an authenticated API request
 * Automatically includes the Authorization header with the current session token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Add Authorization header
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  
  // Make the request
  return fetch(url, {
    ...options,
    headers,
  })
}

