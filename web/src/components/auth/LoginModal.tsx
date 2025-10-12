import { useState } from 'react'
import { signIn } from '../../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faLock, faEnvelope } from '@fortawesome/free-solid-svg-icons'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignup: () => void
  embedded?: boolean
}

export default function LoginModal({ isOpen, onClose, onSwitchToSignup, embedded = false }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        if (!embedded) onClose()
        // Reset form
        setEmail('')
        setPassword('')
      } else if (mode === 'forgot') {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to send reset email')
        }

        setMode('login')
        setError('Password reset email sent! Check your inbox.')
        setEmail('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'login' ? 'sign in' : 'send reset email'}`)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setEmail('')
    setPassword('')
    setError(null)
    setMode('login')
    onClose()
  }

  // Render embedded form (no modal overlay)
  const formContent = (
    <>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            {mode === 'login' ? 'Sign In' : 'Reset Password'}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}

      {mode === 'forgot' && (
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0ea5e9',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px',
              padding: 0,
            }}
          >
            ← Back to Sign In
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {mode === 'forgot' ? (
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
              }}
            >
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon
                icon={faEnvelope}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999',
                  fontSize: '14px',
                }}
              />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#333',
                }}
              >
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon
                  icon={faUser}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999',
                    fontSize: '14px',
                  }}
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#333',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon
                  icon={faLock}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999',
                    fontSize: '14px',
                  }}
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              background: error.includes('sent') ? '#d1fae5' : '#fee2e2',
              border: error.includes('sent') ? '1px solid #a7f3d0' : '1px solid #fecaca',
              borderRadius: '4px',
              color: error.includes('sent') ? '#065f46' : '#dc2626',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: loading ? '#94a3b8' : '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
          }}
        >
          {loading
            ? (mode === 'login' ? 'Signing in...' : 'Sending...')
            : (mode === 'login' ? 'Sign In' : 'Send Reset Email')
          }
        </button>

        <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0,
                  marginRight: '8px',
                }}
              >
                Forgot password?
              </button>
              {' | '}
              Have an invitation code?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px',
                }}
              >
                Create account
              </button>
            </>
          ) : (
            <>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px',
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </>
  )

  // If embedded, just return the form without modal wrapper
  if (embedded) {
    return formContent
  }

  // Otherwise, render as a modal
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-in',
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '100%',
          animation: 'slideIn 0.3s ease-out',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {formContent}

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @media (max-width: 640px) {
            div[style*="padding: 24px"] {
              padding: 20px !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}

