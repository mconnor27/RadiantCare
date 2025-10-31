import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarAlt,
  faSync,
  faCheckCircle,
  faExclamationTriangle,
  faArrowRight,
  faTimes
} from '@fortawesome/free-solid-svg-icons'
import { getSetting, setSetting } from '../../services/settingsService'
import { YEAR_CONFIG, getProjectionYearRange, getPriorYearCutoffDate, shouldUsePriorYearQBO } from '../../config/yearConfig'
import { authenticatedFetch } from '../../lib/api'

interface YearSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function YearSettingsPanel({ isOpen, onClose }: YearSettingsPanelProps) {
  const [baselineYear, setBaselineYear] = useState<number>(2025)
  const [projectionYears, setProjectionYears] = useState<number>(5)
  const [priorYearMarkedComplete, setPriorYearMarkedComplete] = useState<boolean>(false)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [showRolloverModal, setShowRolloverModal] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const [year, projYears, priorComplete] = await Promise.all([
        getSetting('current_fiscal_year'),
        getSetting('projection_years'),
        getSetting('prior_year_marked_complete')
      ])

      if (year) setBaselineYear(parseInt(year, 10))
      if (projYears) setProjectionYears(parseInt(projYears, 10))
      if (priorComplete !== null) setPriorYearMarkedComplete(priorComplete === true || priorComplete === 'true')

      await loadLastSyncTimestamp()
    } catch (err) {
      console.error('Failed to load year settings:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const loadLastSyncTimestamp = async () => {
    try {
      // Query the current calendar year (what the cron syncs)
      const currentCalendarYear = new Date().getFullYear()
      const response = await authenticatedFetch(`/api/qbo/cached?year=${currentCalendarYear}`)
      if (response.ok) {
        const data = await response.json()
        setLastSyncTimestamp(data.last_sync_timestamp)
      }
    } catch (err) {
      console.error('Failed to load sync timestamp:', err)
    }
  }

  const handleSaveSetting = async (key: string, value: any) => {
    try {
      setSaving(true)
      await setSetting(key, value)
      YEAR_CONFIG[key === 'current_fiscal_year' ? 'baselineYear' : 'projectionYears'] = value
      setSuccess('Settings saved')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to save setting:', err)
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePriorYearComplete = async () => {
    const newValue = !priorYearMarkedComplete
    setPriorYearMarkedComplete(newValue)
    await handleSaveSetting('prior_year_marked_complete', newValue)
  }

  const handleManualSync = async (year?: number) => {
    try {
      setSyncing(true)
      const targetYear = year || baselineYear
      const response = await authenticatedFetch(`/api/qbo/sync?year=${targetYear}`, {
        method: 'POST'
      })

      if (response.ok) {
        setSuccess(`Synced ${targetYear} data`)
        await loadLastSyncTimestamp()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error('Sync failed')
      }
    } catch (err) {
      console.error('Manual sync failed:', err)
      setError('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleRolloverToNextYear = async () => {
    try {
      setSaving(true)
      const nextYear = baselineYear + 1
      
      await Promise.all([
        setSetting('current_fiscal_year', nextYear),
        setSetting('prior_year_marked_complete', false),
        setSetting('prior_year_cutoff_date', `${nextYear}-04-15`)
      ])

      window.location.reload()
    } catch (err) {
      console.error('Rollover failed:', err)
      setError('Failed to roll over to next year')
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const cutoffDate = getPriorYearCutoffDate()
  const usePriorYearQBO = shouldUsePriorYearQBO(priorYearMarkedComplete)
  const projectionRange = getProjectionYearRange()
  const priorYear = baselineYear - 1

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          width: 'min(90vw, 600px)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 24 }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            paddingBottom: 12,
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#111827',
              margin: 0
            }}>
              <FontAwesomeIcon icon={faCalendarAlt} style={{ color: '#8b5cf6', fontSize: 18 }} />
              Year Configuration
            </h2>
            <button
              onClick={onClose}
              style={{
                color: '#9ca3af',
                padding: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 4,
                fontSize: 16
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
                e.currentTarget.style.color = '#6b7280'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#9ca3af'
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {error && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: 6,
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              borderRadius: 6,
              fontSize: 14
            }}>
              {success}
            </div>
          )}

          {/* Current Baseline Year */}
          <div style={{
            marginBottom: 20,
            padding: 20,
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12
            }}>
              Current Baseline Year
            </div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#8b5cf6',
              marginBottom: 8
            }}>{baselineYear}</div>
            <div style={{
              fontSize: 13,
              color: '#6b7280',
              marginBottom: 16
            }}>
              Active planning year for scenarios and projections
            </div>
            <button
              onClick={() => setShowRolloverModal(true)}
              disabled={saving}
              style={{
                width: '100%',
                padding: '10px 20px',
                background: saving ? '#d1d5db' : '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 500,
                fontSize: 14
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = '#7c3aed'
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = '#8b5cf6'
              }}
            >
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 12 }} />
              Roll to {baselineYear + 1}
            </button>
          </div>

          {/* Projection Window */}
          <div style={{
            marginBottom: 20,
            padding: 18,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12
            }}>
              Projection Window
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <select
                value={projectionYears}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  setProjectionYears(value)
                  handleSaveSetting('projection_years', value)
                }}
                disabled={saving}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} years
                  </option>
                ))}
              </select>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  {projectionRange[0]} - {projectionRange[projectionRange.length - 1]}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Projection year range</div>
              </div>
            </div>
          </div>

          {/* Prior Year Data */}
          <div style={{
            marginBottom: 20,
            padding: 18,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12
            }}>
              Prior Year ({priorYear}) Data
            </div>

            <div style={{ marginBottom: 14, fontSize: 13, color: '#4b5563' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>Current Source: </span>
                {usePriorYearQBO ? (
                  <span style={{
                    padding: '2px 8px',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500
                  }}>
                    Live QBO
                  </span>
                ) : (
                  <span style={{
                    padding: '2px 8px',
                    background: '#d1fae5',
                    color: '#065f46',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500
                  }}>
                    Snapshot (Final)
                  </span>
                )}
              </div>
              <div>
                <span style={{ fontWeight: 500 }}>Cutoff Date: </span>
                {cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <button
              onClick={handleTogglePriorYearComplete}
              disabled={saving}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: priorYearMarkedComplete ? '#9ca3af' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 500,
                fontSize: 14
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = priorYearMarkedComplete ? '#6b7280' : '#059669'
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = priorYearMarkedComplete ? '#9ca3af' : '#10b981'
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: 13 }} />
              {priorYearMarkedComplete ? `${priorYear} Marked Complete` : `Mark ${priorYear} Complete`}
            </button>

            <div style={{
              fontSize: 11,
              color: '#6b7280',
              marginTop: 8,
              textAlign: 'center'
            }}>
              {priorYearMarkedComplete
                ? `Data for ${priorYear} is locked to snapshot`
                : `Mark complete to lock ${priorYear} data before tax deadline`}
            </div>
          </div>

          {/* QBO Sync */}
          <div style={{
            padding: 18,
            background: '#faf5ff',
            borderRadius: 8,
            border: '1px solid #e9d5ff'
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12
            }}>
              QuickBooks Sync
            </div>

            <div style={{
              marginBottom: 14,
              fontSize: 13,
              color: '#6b7280'
            }}>
              {lastSyncTimestamp ? (
                <>
                  Last Sync: {new Date(lastSyncTimestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </>
              ) : (
                <span style={{ fontStyle: 'italic' }}>No sync data available</span>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 10
            }}>
              <button
                onClick={() => handleManualSync()}
                disabled={syncing}
                style={{
                  padding: '10px 16px',
                  background: syncing ? '#d1d5db' : '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 500,
                  fontSize: 13
                }}
                onMouseEnter={(e) => {
                  if (!syncing) e.currentTarget.style.background = '#7c3aed'
                }}
                onMouseLeave={(e) => {
                  if (!syncing) e.currentTarget.style.background = '#8b5cf6'
                }}
              >
                <FontAwesomeIcon icon={faSync} className={syncing ? 'fa-spin' : ''} style={{ fontSize: 12 }} />
                {syncing ? 'Syncing...' : `Sync ${baselineYear}`}
              </button>
              <button
                onClick={() => handleManualSync(priorYear)}
                disabled={syncing}
                style={{
                  padding: '10px 16px',
                  background: syncing ? '#d1d5db' : '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 500,
                  fontSize: 13
                }}
                onMouseEnter={(e) => {
                  if (!syncing) e.currentTarget.style.background = '#4b5563'
                }}
                onMouseLeave={(e) => {
                  if (!syncing) e.currentTarget.style.background = '#6b7280'
                }}
              >
                <FontAwesomeIcon icon={faSync} className={syncing ? 'fa-spin' : ''} style={{ fontSize: 12 }} />
                {syncing ? 'Syncing...' : `Sync ${priorYear}`}
              </button>
            </div>

            <div style={{
              fontSize: 11,
              textAlign: 'center',
              color: '#7c3aed',
              background: '#f3e8ff',
              borderRadius: 6,
              padding: 8
            }}>
              Auto-sync runs daily on weekdays for current year
            </div>
          </div>

          {/* Rollover Confirmation Modal */}
          {showRolloverModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}>
              <div style={{
                background: '#fff',
                borderRadius: 8,
                padding: 24,
                maxWidth: 480,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#111827',
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#f59e0b', fontSize: 16 }} />
                  Confirm Year Rollover
                </h3>

                <p style={{ color: '#4b5563', marginBottom: 16, fontSize: 14 }}>
                  Roll over from <strong>{baselineYear}</strong> to <strong>{baselineYear + 1}</strong>?
                </p>

                <div style={{
                  background: '#f9fafb',
                  borderRadius: 6,
                  padding: 14,
                  marginBottom: 20,
                  fontSize: 13,
                  color: '#6b7280'
                }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>This will:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Set baseline year to {baselineYear + 1}</li>
                    <li>Update projections to {baselineYear + 2} - {baselineYear + 1 + projectionYears}</li>
                    <li>Reset prior year completion status</li>
                    <li>Reload the application</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowRolloverModal(false)}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      fontSize: 14
                    }}
                    onMouseEnter={(e) => {
                      if (!saving) e.currentTarget.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      if (!saving) e.currentTarget.style.background = '#f3f4f6'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRolloverToNextYear}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      background: saving ? '#d1d5db' : '#8b5cf6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      fontSize: 14
                    }}
                    onMouseEnter={(e) => {
                      if (!saving) e.currentTarget.style.background = '#7c3aed'
                    }}
                    onMouseLeave={(e) => {
                      if (!saving) e.currentTarget.style.background = '#8b5cf6'
                    }}
                  >
                    {saving ? 'Rolling over...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
