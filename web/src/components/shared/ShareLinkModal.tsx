import { useState, useRef, useEffect } from 'react'
import { authenticatedFetch } from '../../lib/api'

interface ShareLinkModalProps {
  isOpen: boolean
  onClose: () => void
  viewMode: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'
  scenarioAId: string | null
  scenarioAIsPublic: boolean
  scenarioBId: string | null
  scenarioBIsPublic: boolean
  scenarioBEnabled: boolean
  uiSettings: any
  warningType: 'private' | 'unsaved' | null
  onLinkCreated?: (url: string) => void
}

export default function ShareLinkModal({
  isOpen,
  onClose,
  viewMode,
  scenarioAId,
  scenarioAIsPublic,
  scenarioBId,
  scenarioBIsPublic,
  scenarioBEnabled,
  uiSettings,
  warningType,
  onLinkCreated
}: ShareLinkModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (shareUrl && inputRef.current) {
      inputRef.current.select()
    }
  }, [shareUrl])

  const handleCreateLink = async () => {
    if (!scenarioAId) {
      setError('No scenario loaded')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await authenticatedFetch('/api/shared-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          view_mode: viewMode,
          scenario_a_id: scenarioAId,
          scenario_b_id: scenarioBEnabled ? scenarioBId : null,
          scenario_b_enabled: scenarioBEnabled,
          ui_settings: uiSettings
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create shareable link')
      }

      const data = await response.json()
      setShareUrl(data.url)
      onLinkCreated?.(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback: select text for manual copy
      inputRef.current?.select()
    }
  }

  if (!isOpen) return null

  // Private scenario warning
  if (warningType === 'private') {
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
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '90%',
            padding: '24px',
            animation: 'slideIn 0.3s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Cannot Create Shareable Link
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
            One or more loaded scenarios are private. Only public scenarios can be shared.
          </p>
          <div style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 500 }}>Scenario A:</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                background: scenarioAIsPublic ? '#dcfce7' : '#fee2e2',
                color: scenarioAIsPublic ? '#16a34a' : '#dc2626',
                fontSize: '12px',
                fontWeight: 500
              }}>
                {scenarioAIsPublic ? '🌐 Public' : '🔒 Private'}
              </span>
            </div>
            {scenarioBEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>Scenario B:</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: scenarioBIsPublic ? '#dcfce7' : '#fee2e2',
                  color: scenarioBIsPublic ? '#16a34a' : '#dc2626',
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  {scenarioBIsPublic ? '🌐 Public' : '🔒 Private'}
                </span>
              </div>
            )}
          </div>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5', color: '#666' }}>
            To create a shareable link, please make your scenarios public or load public scenarios.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
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

  // Unsaved changes warning
  if (warningType === 'unsaved' && !shareUrl) {
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
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '90%',
            padding: '24px',
            animation: 'slideIn 0.3s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Unsaved Changes Detected
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
            You have made changes that are not saved to the database.
          </p>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5', color: '#666' }}>
            The shareable link will reflect the last saved version of your scenario, not your current edits.
            Save your scenario first if you want to share your latest changes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLink}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: loading ? '#94a3b8' : '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create Link Anyway'}
            </button>
          </div>
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

  // Success modal with shareable link
  if (shareUrl) {
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
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: '600px',
            width: '90%',
            padding: '24px',
            animation: 'slideIn 0.3s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔗 Shareable Link Created
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
            Share this link with others:
          </p>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            alignItems: 'stretch'
          }}>
            <input
              ref={inputRef}
              type="text"
              value={shareUrl}
              readOnly
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
                background: '#f9fafb',
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                padding: '10px 16px',
                background: copied ? '#16a34a' : '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minWidth: '80px',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p style={{ margin: '0 0 24px 0', fontSize: '13px', lineHeight: '1.5', color: '#6b7280' }}>
            Anyone with this link can view your scenario comparison and chart settings.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
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

  // Default: Create link modal
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          width: '90%',
          padding: '24px',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>
          Create Shareable Link
        </h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5', color: '#666' }}>
          This will create a link that shares your current {viewMode} view, including loaded scenarios and UI settings.
        </p>
        {error && (
          <div style={{
            padding: '12px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#fff',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateLink}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? '#94a3b8' : '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Link'}
          </button>
        </div>
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
