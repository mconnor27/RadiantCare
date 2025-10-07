import { useState } from 'react'
import { signIn } from '../../lib/supabase'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignup: () => void
}

export default function LoginModal({ isOpen, onClose, onSwitchToSignup }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
      onClose()
      // Reset form
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setEmail('')
    setPassword('')
    setError(null)
    onClose()
  }

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
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '100%',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Sign In</h2>
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

        <form onSubmit={handleSubmit}>
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
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                color: '#dc2626',
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
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
          </div>
        </form>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

