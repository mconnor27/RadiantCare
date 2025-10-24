import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from '../../lib/supabase'
import { logger } from '../../lib/logger'

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        logger.info('AUTH', 'Session initialized', { userId: session.user.id })
        loadProfile(session.user.id)
      } else {
        logger.debug('AUTH', 'No active session found')
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('AUTH', 'Auth state changed', { event })
      setSession(session)
      if (session) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Listen for sync notifications from cron jobs
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('sync-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_notifications'
        },
        (payload) => {
          // Show toast notification to user
          const message = payload.new.message || 'QuickBooks sync starting'
          logger.info('QBO_SYNC', 'Sync notification received', { message })

          // Create a simple toast notification
          const toast = document.createElement('div')
          toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0ea5e9;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
          `
          toast.textContent = message

          // Add animation styles
          const style = document.createElement('style')
          style.textContent = `
            @keyframes slideInRight {
              from { transform: translateX(400px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `
          document.head.appendChild(style)

          document.body.appendChild(toast)

          // Remove after 5 seconds
          setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse'
            setTimeout(() => toast.remove(), 300)
          }, 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session])

  async function loadProfile(userId: string) {
    try {
      logger.debug('AUTH', 'Loading user profile', { userId })
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      logger.info('AUTH', 'Profile loaded successfully', { isAdmin: data.is_admin })
      setProfile(data)
    } catch (error) {
      logger.error('AUTH', 'Failed to load profile', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    logger.info('AUTH', 'User signing out')
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    // Clear the persisted dashboard state on sign out
    localStorage.removeItem('radiantcare-state-v1')
    logger.debug('AUTH', 'Session and state cleared')
  }

  const value = {
    session,
    profile,
    loading,
    signOut: handleSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

