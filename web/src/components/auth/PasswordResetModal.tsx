import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface PasswordResetModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'reset' | 'change'
}

export default function PasswordResetModal({ isOpen, onClose, mode = 'reset' }: PasswordResetModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'current' | 'new'>('current')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'change') {
        // For change password, first verify current password
        if (step === 'current') {
          // Get current session to verify current password
          const { data: { session } } = await supabase.auth.getSession()

          if (!session) {
            throw new Error('Not authenticated')
          }

          // Verify current password by attempting to sign in
          const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: session.user.email!,
            password: currentPassword
          })

          if (verifyError) {
            setError('Current password is incorrect')
            setLoading(false)
            return
          }

          // If verification successful, move to new password step
          setStep('new')
          setCurrentPassword('')
          setLoading(false)
          return
        } else {
          // Step 2: Update to new password
          if (password !== confirmPassword) {
            setError('Passwords do not match')
            setLoading(false)
            return
          }

          if (password.length < 8) {
            setError('Password must be at least 8 characters')
            setLoading(false)
            return
          }

          const { error } = await supabase.auth.updateUser({
            password: password
          })

          if (error) throw error

          setSuccess(true)

          // Close modal after 2 seconds
          setTimeout(() => {
            onClose()
            resetForm()
          }, 2000)
        }
      } else {
        // Reset password mode (user came from forgot password link)
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.updateUser({
          password: password
        })

        if (error) throw error

        setSuccess(true)

        // Close modal after 2 seconds
        setTimeout(() => {
          onClose()
          resetForm()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'change' ? 'change' : 'reset'} password`)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(false)
    setStep('current')
  }

  function handleClose() {
    resetForm()
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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            {mode === 'change'
              ? (step === 'current' ? 'Verify Current Password' : 'Set New Password')
              : 'Set New Password'
            }
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

        {mode === 'change' && step === 'current' && (
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setStep('new')}
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
              I forgot my password
            </button>
          </div>
        )}

        {mode === 'change' && step === 'new' && (
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setStep('current')}
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
              ← Back
            </button>
          </div>
        )}

        {success ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: '#16a34a',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 500 }}>Password updated successfully!</div>
            <div style={{ fontSize: '14px', marginTop: '8px', color: '#666' }}>Redirecting...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'change' && step === 'current' ? (
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="current-password"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#333',
                  }}
                >
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
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
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="new-password"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#333',
                    }}
                  >
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
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
                    htmlFor="confirm-password"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#333',
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
              </>
            )}

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
              {loading
                ? (mode === 'change' && step === 'current' ? 'Verifying...' : 'Updating...')
                : (mode === 'change' && step === 'current' ? 'Verify Password' : 'Update Password')
              }
            </button>
          </form>
        )}

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
