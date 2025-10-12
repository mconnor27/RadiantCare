import { useEffect, useState } from 'react'
import { useDashboardStore } from '../../../../Dashboard'
import { authenticatedFetch } from '../../../../../lib/api'
import { useAuth } from '../../../../auth/AuthProvider'
import { removeTooltip } from '../../../shared/tooltips'

interface SyncButtonProps {
  environment: 'production' | 'sandbox'
  isLoadingDashboard?: boolean
  onSyncComplete?: () => void
}

type SyncStep = 'daily' | 'summary' | 'equity' | 'complete' | 'error'

// Custom tooltip function that positions below the button
function createSyncTooltip(content: string, e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) {
  const id = 'sync-button-tooltip'
  const existing = document.getElementById(id)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = id
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`

  tooltip.textContent = content
  document.body.appendChild(tooltip)

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tooltip.style.left = `${rect.left+50}px`
  tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`
}

export default function SyncButton({ environment, isLoadingDashboard = false, onSyncComplete }: SyncButtonProps) {
  const { profile } = useAuth()
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null | undefined>(undefined)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncStep, setSyncStep] = useState<SyncStep | null>(null)
  const [syncMessage, setSyncMessage] = useState<string>('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  
  const isAdmin = profile?.is_admin === true

  // Load last sync timestamp on mount - but wait for dashboard loading to complete
  useEffect(() => {
    if (environment === 'production' && !isLoadingDashboard) {
      authenticatedFetch('/api/qbo/cached-2025')
        .then(res => res.ok ? res.json() : null)
        .then(cache => {
          if (cache?.lastSyncTimestamp) {
            setLastSyncTimestamp(cache.lastSyncTimestamp)
          } else {
            setLastSyncTimestamp(null)
          }
        })
        .catch(() => {
          setLastSyncTimestamp(null)
        })
    }
  }, [environment, isLoadingDashboard])

  // Clean up tooltip on unmount
  useEffect(() => {
    return () => {
      removeTooltip('sync-button-tooltip')
    }
  }, [])

  // Import the store to check for custom values
  const store = useDashboardStore()

  // Handle sync button click
  const handleSyncClick = () => {
    const hasCustomValues = Object.keys(store.customProjectedValues).length > 0

    if (hasCustomValues) {
      setShowConfirmDialog(true)
    } else {
      performSync(false)
    }
  }

  const performSync = async (clearCustomValues: boolean) => {
    setShowConfirmDialog(false)
    setSyncing(true)
    setSyncError(null)
    setSyncStep('daily')
    setSyncMessage('Fetching daily P&L report...')
    // Clean up tooltip when sync starts
    removeTooltip('sync-button-tooltip')

    try {
      // Simulate the sync process with step updates
      const response = await authenticatedFetch('/api/qbo/sync-2025', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminOverride: isAdmin // Allow admin to bypass daily sync restriction
        }),
      })

      // Update step to summary
      setSyncStep('summary')
      setSyncMessage('Fetching class summary report...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay for visual feedback

      // Update step to equity
      setSyncStep('equity')
      setSyncMessage('Fetching balance sheet...')
      await new Promise(resolve => setTimeout(resolve, 500))

      const data = await response.json()

      if (!response.ok) {
        setSyncStep('error')
        if (data.error === 'already_synced_today') {
          setSyncMessage('Already synced today')
          setLastSyncTimestamp(data.lastSyncTimestamp)
        } else if (data.error === 'not_connected') {
          setSyncMessage('QuickBooks not connected')
          setSyncError('not_connected')
        } else {
          setSyncMessage(data.message || 'Sync failed')
        }

        // Hide modal after 3 seconds on error
        setTimeout(() => {
          setSyncStep(null)
          setSyncing(false)
        }, 3000)
      } else {
        setSyncStep('complete')
        setSyncMessage('Sync completed successfully!')
        setLastSyncTimestamp(data.lastSyncTimestamp)

        // Clear custom values if user chose to
        if (clearCustomValues) {
          store.resetCustomProjectedValues()
        }

        // Hide modal after 1.5 seconds and refresh data
        setTimeout(() => {
          setSyncStep(null)
          setSyncing(false)
          // Trigger data refresh in parent component
          onSyncComplete?.()
        }, 1500)
      }
    } catch {
      setSyncStep('error')
      setSyncMessage('Network error - please try again')

      // Hide modal after 3 seconds on error
      setTimeout(() => {
        setSyncStep(null)
        setSyncing(false)
      }, 3000)
    }
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const month = date.toLocaleString('en-US', { month: 'short' })
    const day = date.getDate()
    const year = date.getFullYear()
    const time = date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return `${month} ${day}, ${year} at ${time}`
  }

  const getPriorBusinessDay = (date: Date) => {
    const prior = new Date(date)
    prior.setDate(prior.getDate() - 1)

    // Skip back over weekends
    while (prior.getDay() === 0 || prior.getDay() === 6) {
      prior.setDate(prior.getDate() - 1)
    }

    return prior
  }

  const getNextAllowedSync = (timestamp: string | null) => {
    if (!timestamp) return null

    const now = new Date()
    const lastSync = new Date(timestamp)

    // Determine the target date the last sync covered
    let lastSyncCoveredThrough: Date
    if (lastSync.getHours() < 17) {
      // Synced before 5pm - covered through prior business day
      lastSyncCoveredThrough = getPriorBusinessDay(lastSync)
    } else {
      // Synced after 5pm - covered through same day
      lastSyncCoveredThrough = new Date(lastSync)
    }
    lastSyncCoveredThrough.setHours(23, 59, 59, 999) // End of that day

    // Determine what date we need data through now
    let needDataThrough: Date
    if (now.getHours() < 17) {
      // Before 5pm - need data through prior business day
      needDataThrough = getPriorBusinessDay(now)
    } else {
      // After 5pm - need data through today
      needDataThrough = new Date(now)
    }
    needDataThrough.setHours(0, 0, 0, 0) // Start of that day

    // If last sync already covers what we need, calculate next allowed time
    if (lastSyncCoveredThrough >= needDataThrough) {
      // Calculate next time we'll need new data
      const nextNeeded = new Date(needDataThrough)
      nextNeeded.setDate(nextNeeded.getDate() + 1)

      // Skip weekends
      while (nextNeeded.getDay() === 0 || nextNeeded.getDay() === 6) {
        nextNeeded.setDate(nextNeeded.getDate() + 1)
      }

      // Next sync available at 5pm when new data becomes available
      nextNeeded.setHours(17, 0, 0, 0)

      return nextNeeded
    }

    // If we need newer data, calculate when that data will be available
    // Data for needDataThrough becomes available at 5pm on that day
    const dataAvailableAt = new Date(needDataThrough)
    dataAvailableAt.setHours(17, 0, 0, 0)

    // If we're already past that time, sync is allowed now
    if (now >= dataAvailableAt) {
      return null
    }

    // Otherwise, return when the data will become available
    return dataAvailableAt
  }

  const canSyncNow = (timestamp: string | null) => {
    if (!timestamp) return true

    const now = new Date()
    const dayOfWeek = now.getDay()

    // Check if it's a business day (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false // No sync on weekends
    }

    const nextAllowed = getNextAllowedSync(timestamp)
    if (!nextAllowed) return true

    // If the next allowed time is in the future, we can't sync now
    return now >= nextAllowed
  }

  const formatNextAllowedTime = (timestamp: string | null) => {
    const nextAllowed = getNextAllowedSync(timestamp)
    if (!nextAllowed) return ''
    const month = nextAllowed.toLocaleString('en-US', { month: 'short' })
    const day = nextAllowed.getDate()
    const year = nextAllowed.getFullYear()
    const time = nextAllowed.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return `${month} ${day}, ${year} at ${time}`
  }

  if (environment !== 'production') {
    return null
  }

  // Determine if sync is available (handle loading state)
  // Admins can always sync, regular users must respect business day restrictions
  const syncAvailable = isAdmin || (lastSyncTimestamp !== undefined && lastSyncTimestamp !== null && canSyncNow(lastSyncTimestamp)) || (lastSyncTimestamp === null && canSyncNow(null))

  // Generate tooltip text for button
  const getButtonTooltip = () => {
    if (syncing) return 'Sync in progress...'
    if (lastSyncTimestamp === undefined) return 'Loading sync status...'
    if (syncAvailable) {
      return isAdmin ? 'Available to Sync (Admin)' : 'Available to Sync'
    } else {
      const nextTime = formatNextAllowedTime(lastSyncTimestamp)
      return `Next sync allowed: ${nextTime}`
    }
  }

  return (
    <>
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '15vh',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            background: '#fff',
            padding: 32,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: 500,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Manual Changes Detected</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, lineHeight: 1.5, color: '#666' }}>
              You have manually adjusted some projected values in the grid.
              Would you like to keep these manual changes or recalculate them based on the new synced data?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => performSync(false)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Keep Manual Changes
              </button>
              <button
                onClick={() => performSync(true)}
                style={{
                  padding: '8px 16px',
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Recalculate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {syncStep && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '15vh',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{
            background: '#fff',
            padding: 32,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: 400,
            textAlign: 'center',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {syncStep === 'error' ? (
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            ) : syncStep === 'complete' ? (
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            ) : (
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            )}
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: syncStep === 'error' ? '#dc2626' : syncStep === 'complete' ? '#16a34a' : '#333'
            }}>
              {syncMessage}
            </div>
            {syncStep !== 'error' && syncStep !== 'complete' && (
              <div style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'center',
                gap: 8
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: syncStep === 'daily' ? '#0ea5e9' : '#cbd5e1'
                }}></div>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: syncStep === 'summary' ? '#0ea5e9' : '#cbd5e1'
                }}></div>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: syncStep === 'equity' ? '#0ea5e9' : '#cbd5e1'
                }}></div>
              </div>
            )}
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
      )}

      <div style={{
        padding: 8,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <button
            onClick={handleSyncClick}
            disabled={syncing || !syncAvailable || lastSyncTimestamp === undefined}
            onMouseEnter={(e) => createSyncTooltip(getButtonTooltip(), e)}
            onMouseLeave={() => removeTooltip('sync-button-tooltip')}
            onTouchStart={(e) => createSyncTooltip(getButtonTooltip(), e)}
          style={{
            padding: '6px 12px',
            background: syncing || !syncAvailable || lastSyncTimestamp === undefined ? '#94a3b8' : '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 500,
            cursor: syncing || !syncAvailable || lastSyncTimestamp === undefined ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: syncing ? 'spin 1s linear infinite' : 'none'
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          {syncing ? 'Syncing...' : 'Sync QuickBooks'}
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </button>
        {lastSyncTimestamp === undefined ? (
          <div style={{
            minHeight: 20,
            minWidth: 222,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#64748b'
          }}>
            Loading sync status...
          </div>
        ) : (
          <div style={{
            fontSize: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'baseline'
          }}>
            <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>Last synced:</span>
            <span style={{ color: '#64748b' }}>{formatTimestamp(lastSyncTimestamp)}</span>
          </div>
        )}
      </div>
      {syncError && !syncStep && (
        <div style={{ fontSize: 12, color: '#dc2626' }}>
          {syncError === 'not_connected' ? (
            <>
              QuickBooks not connected. <a href="/api/qbo/connect?env=production" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>Connect now</a>
            </>
          ) : (
            syncError
          )}
        </div>
      )}
      </div>
    </>
  )
}
