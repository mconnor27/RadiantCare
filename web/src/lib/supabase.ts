import { createClient } from '@supabase/supabase-js'

// Get environment variables - these will be injected by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})

// TypeScript types for database tables
export interface Profile {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface SavedScenario {
  id: string
  user_id: string
  name: string
  description: string | null
  tags: string[]
  is_public: boolean
  scenario_data: {
    physicians: any[]
    projectionSettings: any
    customProjectedValues: Record<string, any>
  }
  created_at: string
  updated_at: string
  creator_email?: string // Joined from profiles
}

export interface UserInvitation {
  id: string
  email: string
  invitation_code: string
  invited_by: string
  expires_at: string | null
  used_at: string | null
  created_at: string
}

// Auth utilities
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  
  return profile
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, invitationCode: string) {
  // First verify the invitation code
  const { data: invitation, error: inviteError } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('invitation_code', invitationCode)
    .is('used_at', null)
    .single()
  
  if (inviteError || !invitation) {
    throw new Error('Invalid or expired invitation code')
  }
  
  // Check if invitation has expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    throw new Error('Invitation code has expired')
  }
  
  // Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Helper to check if user is admin
export async function isUserAdmin(): Promise<boolean> {
  const profile = await getCurrentUser()
  return profile?.is_admin || false
}

