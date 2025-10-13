import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faSignOutAlt, faKey, faSync, faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import {
  parseTherapyIncome2025,
  type YTDPoint
} from '../../../../historical_data/therapyIncomeParser'
import { authenticatedFetch } from '../../../../lib/api'
import { useDashboardStore } from '../../../Dashboard'
import { useAuth } from '../../../auth/AuthProvider'
import DetailedChart from './components/DetailedChart'
import ChartControls from './components/ChartControls'
import PartnerCompensation from './components/PartnerCompensation'

// Mobile Scenario Load Modal Component
function MobileScenarioLoadModal({
  isOpen,
  onClose,
  onLoad,
  viewMode
}: {
  isOpen: boolean
  onClose: () => void
  onLoad: (id: string) => void
  viewMode: 'YTD Mobile'
}) {
  const { profile } = useAuth()
  const [myScenarios, setMyScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen && profile) {
      loadScenarios()
    }
  }, [isOpen, profile, viewMode])

  async function loadScenarios() {
    if (!profile) return

    setLoading(true)
    setError(null)

    try {
      const { supabase } = await import('../../../../lib/supabase')

      // Load all user's scenarios
      const { data: allData, error: myError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false })

      if (myError) throw myError

      // Filter to only YTD scenarios OR Multi-Year scenarios with 2025 baseline
      const filteredData = (allData || []).filter((scenario: any) => {
        // Include YTD scenarios (they don't have baseline_mode)
        if (scenario.view_mode === 'YTD Detailed') {
          return true
        }
        // Include Multi-Year scenarios with 2025 baseline
        if (scenario.view_mode === 'Multi-Year' && scenario.baseline_mode === '2025 Data') {
          return true
        }
        return false
      })

      setMyScenarios(filteredData)
    } catch (err) {
      console.error('Error loading scenarios:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }

  const scenarios = myScenarios
  const filteredScenarios = scenarios.filter((scenario) => {
    return (
      !searchQuery ||
      scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!isOpen) return null

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
          background: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-in',
          WebkitTapHighlightColor: 'rgba(0,0,0,0)'
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#fff',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
          WebkitTapHighlightColor: 'rgba(0,0,0,0)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Load Scenario
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
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
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 20px' }}>
          <input
            type="text"
            placeholder="🔍 Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
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

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
              Loading scenarios...
            </div>
          ) : filteredScenarios.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '14px',
              }}
            >
              {scenarios.length === 0 ? (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <div>No scenarios yet. Save your first scenario to get started!</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                  <div>No scenarios match your search.</div>
                </>
              )}
            </div>
          ) : (
            <div>
              {filteredScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  style={{
                    padding: '16px',
                    background: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onLoad(scenario.id)
                    onClose()
                  }}
                >
                  {/* Header: Title + Public/Private */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111' }}>
                        {scenario.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: scenario.is_public ? '#dbeafe' : '#f3f4f6',
                          color: scenario.is_public ? '#0369a1' : '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        {scenario.is_public ? '🌐 Public' : '🔒 Private'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {scenario.description && (
                    <p style={{ textAlign: 'left', margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                      {scenario.description}
                    </p>
                  )}

                  {/* Footer: Timestamps and Load Icon */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                      <div>Created: {formatDate(scenario.created_at)}</div>
                    </div>

                    <FontAwesomeIcon
                      icon={faFolderOpen}
                      style={{
                        color: '#0ea5e9',
                        fontSize: 20,
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
    </>
  )
}

interface YTDDetailedMobileProps {
  onRefreshRequest?: (callback: () => void) => void
  onPasswordChange?: () => void
}

export default function YTDDetailedMobile({ onRefreshRequest, onPasswordChange }: YTDDetailedMobileProps) {
  const store = useDashboardStore()
  const { signOut, profile } = useAuth()
  const [showLoadingModal, setShowLoadingModal] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [cachedData, setCachedData] = useState<{ daily?: any, summary?: any, equity?: any } | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false) // Mobile scenario load modal
  const [isScenarioDirty, setIsScenarioDirty] = useState(false) // Track if scenario has been modified

  // Mobile chart settings state
  const [isNormalized, setIsNormalized] = useState(false)
  const [showCombined, setShowCombined] = useState(false)
  const [combineStatistic, setCombineStatistic] = useState<'mean' | 'median' | null>(null)
  const [combineError, setCombineError] = useState<'std' | 'ci' | null>(null)
  const [chartMode, setChartMode] = useState<'line' | 'bar' | 'proportion'>('line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>('year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>({ year: new Date().getFullYear() })
  const [is2025Visible, setIs2025Visible] = useState(true)
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [incomeMode, setIncomeMode] = useState<'total' | 'per-site'>('total')
  const [smoothing, setSmoothing] = useState(10)
  const [selectedYears, setSelectedYears] = useState<number[]>(Array.from({ length: 9 }, (_, i) => 2016 + i))
  const [visibleSites, setVisibleSites] = useState<{ lacey: boolean, centralia: boolean, aberdeen: boolean }>({ lacey: true, centralia: true, aberdeen: true })
  const [colorScheme, setColorScheme] = useState<'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'>('gray')
  const [siteColorScheme, setSiteColorScheme] = useState<'rgb' | 'radiantCare' | 'jama'>('rgb')

  const isAdmin = profile?.is_admin === true

  // Parse 2025 data
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])

  // Get 2025 future year entry
  const fy2025 = store.scenarioA.future.find((f) => f.year === 2025)

  // Ensure 2025 entry exists
  useEffect(() => {
    if (!fy2025) {
      store.ensureBaselineYear('A', 2025)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy2025])

  // Register refresh callback with parent
  useEffect(() => {
    if (onRefreshRequest) {
      onRefreshRequest(() => {
        console.log('🔄 Triggering data refresh after sync')
        setRefreshTrigger(prev => prev + 1)
      })
    }
  }, [onRefreshRequest])

  // Load data
  useEffect(() => {
    const startTime = Date.now()
    setError(null)

    if (refreshTrigger > 0) {
      setShowLoadingModal(true)
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        authenticatedFetch('/api/qbo/cached-2025')
          .then((res: Response) => {
            if (!res.ok) {
              console.log('No cached data available, using historical JSON fallback')
              return { data: historical2025Data, cache: null }
            }
            return res.json().then((cache: any) => {
              if (cache?.daily) {
                const points = parseTherapyIncome2025(cache.daily)
                return {
                  data: points,
                  cache: { daily: cache.daily, summary: cache.summary, equity: cache.equity }
                }
              } else {
                return { data: historical2025Data, cache: null }
              }
            })
          })
          .catch((err: any) => {
            console.error('Error loading cached data, using fallback:', err)
            return { data: historical2025Data, cache: null }
          })
          .then((result: any) => {
            const elapsed = Date.now() - startTime
            const remainingTime = Math.max(0, 1000 - elapsed)

            setTimeout(() => {
              setData(result.data)
              setCachedData(result.cache)
              setShowLoadingModal(false)
            }, remainingTime)
          })
      }, 50)
    })
  }, [historical2025Data, refreshTrigger])

  // Load last sync timestamp
  useEffect(() => {
    if (!showLoadingModal) {
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
  }, [showLoadingModal, refreshTrigger])

  // Check if sync is available
  const canSyncNow = (timestamp: string | null) => {
    if (!timestamp) return true

    const now = new Date()
    const dayOfWeek = now.getDay()

    // No sync on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false
    }

    // Simple check: allow sync if more than 12 hours have passed
    const lastSync = new Date(timestamp)
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)

    return hoursSinceSync >= 12
  }

  const syncAvailable = isAdmin || (lastSyncTimestamp !== undefined && (lastSyncTimestamp === null || canSyncNow(lastSyncTimestamp)))

  // Handle sync
  const handleSync = async () => {
    if (!syncAvailable) {
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2000)
      return
    }

    setSyncing(true)
    setShowTooltip(false)

    try {
      const response = await authenticatedFetch('/api/qbo/sync-2025', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminOverride: isAdmin
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        alert(responseData.message || 'Sync failed')
        if (responseData.lastSyncTimestamp) {
          setLastSyncTimestamp(responseData.lastSyncTimestamp)
        }
      } else {
        setLastSyncTimestamp(responseData.lastSyncTimestamp)
        setRefreshTrigger(prev => prev + 1)
      }
    } catch {
      alert('Network error - please try again')
    } finally {
      setSyncing(false)
    }
  }

  // Handle scenario loading
  const handleLoadScenario = async (scenarioId: string) => {
    if (isScenarioDirty) {
      if (!confirm('You have unsaved changes to the current scenario. Loading another scenario will discard these changes. Continue?')) {
        return
      }
    }

    try {
      await store.loadScenarioFromDatabase(scenarioId, 'A', true)
      setIsScenarioDirty(false)
      setShowLoadModal(false)
      setRefreshTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error loading scenario:', error)
      alert('Failed to load scenario')
    }
  }

  // Get current scenario info from store
  const currentScenarioName = store.currentScenarioName

  // Keep current period in sync with timeframe on mobile
  useEffect(() => {
    const now = new Date()
    const year = 2025
    const month = now.getMonth() + 1
    const quarter = Math.floor((month - 1) / 3) + 1
    if (timeframe === 'year') {
      setCurrentPeriod({ year })
    } else if (timeframe === 'quarter') {
      setCurrentPeriod({ year, quarter })
    } else if (timeframe === 'month') {
      setCurrentPeriod({ year, month })
    }
  }, [timeframe])

  return (
    <>
      {/* Loading Modal - properly unmount when hidden */}
      {showLoadingModal ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-in'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            background: '#fff',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
            minWidth: 250,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <svg
              width="48"
              height="48"
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
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#333',
              marginBottom: 8
            }}>
              Loading Dashboard
            </div>
            <div style={{
              fontSize: 12,
              color: '#666'
            }}>
              Loading data...
            </div>
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
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : null}

      {/* Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '8px 12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        WebkitTapHighlightColor: 'rgba(0,0,0,0)'
      }}>
        {/* Left Icons Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifySelf: 'start' }}>
          {/* Sync Icon Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSync()
              }}
              disabled={syncing || lastSyncTimestamp === undefined}
              style={{
                background: 'none',
                border: 'none',
                color: syncing || !syncAvailable || lastSyncTimestamp === undefined ? '#94a3b8' : '#0ea5e9',
                fontSize: 20,
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 4,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <FontAwesomeIcon icon={faSync} spin={syncing} />
            </button>

            {/* Tooltip */}
            {showTooltip && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                background: '#333',
                color: 'white',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                Sync not available yet
              </div>
            )}
          </div>

          {/* Load Icon Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isScenarioDirty) {
                if (!confirm('You have unsaved changes to the current scenario. Loading another scenario will discard these changes. Continue?')) {
                  return
                }
              }
              setShowLoadModal(true)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0ea5e9',
              fontSize: 20,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 4,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            title="Load scenario"
          >
            <FontAwesomeIcon icon={faFolderOpen} />
          </button>
        </div>

        {/* Title - Center */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          justifyContent: 'center',
          minWidth: 0
        }}>
          <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 36, width: 'auto', display: 'block' }} />
          {/*<div style={{
            fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
            color: '#7c2a83',
            fontWeight: 900,
            fontSize: 24,
            lineHeight: 1,
            whiteSpace: 'nowrap'
          }}>
            Compensation Dashboard
          </div>*/}
        </div>

        {/* User Menu */}
        <div style={{ position: 'relative', justifySelf: 'end' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowUserMenu(!showUserMenu)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0ea5e9',
              fontSize: 20,
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 4,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <FontAwesomeIcon icon={faUser} />
          </button>

          {showUserMenu && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                  WebkitTapHighlightColor: 'rgba(0,0,0,0)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowUserMenu(false)
                }}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                minWidth: 180,
                zIndex: 1000
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUserMenu(false)
                    onPasswordChange?.()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: 14,
                    color: '#333',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderBottom: '1px solid #e5e7eb',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <FontAwesomeIcon icon={faKey} style={{ width: 16, color: '#6b7280' }} />
                  Change Password
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUserMenu(false)
                    signOut()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: 14,
                    color: '#dc2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <FontAwesomeIcon icon={faSignOutAlt} style={{ width: 16 }} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Scenario Manager Section */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb',
        marginTop: '58px', // Account for fixed header height
        WebkitTapHighlightColor: 'rgba(0,0,0,0)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          position: 'relative'
        }}>
          {currentScenarioName && (
            <div style={{
              padding: '4px 8px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 500,
              color: '#0369a1'
            }}>
              <span>Current Scenario: {currentScenarioName}</span>
            </div>
          )}

        </div>
      </div>

      {/* Chart */}
      <div style={{
        padding: 16,
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto',
        WebkitTapHighlightColor: 'rgba(0,0,0,0)'
      }}>
        {error ? (
          <div style={{ color: '#991b1b', textAlign: 'center', padding: 20 }}>{error}</div>
        ) : (
          <div style={{ width: '100%'}}>
            <DetailedChart
              data={data}
              isNormalized={isNormalized}
              showCombined={showCombined}
              combineStatistic={combineStatistic}
              combineError={combineError}
              chartMode={chartMode}
              timeframe={timeframe}
              currentPeriod={currentPeriod}
              setCurrentPeriod={setCurrentPeriod}
              is2025Visible={is2025Visible}
              setIs2025Visible={setIs2025Visible}
              showAllMonths={showAllMonths}
              incomeMode={incomeMode}
              smoothing={smoothing}
              fy2025={fy2025}
              selectedYears={selectedYears}
              visibleSites={visibleSites}
              colorScheme={colorScheme}
              siteColorScheme={siteColorScheme}
              isMobile={true}
              onOpenControls={() => setShowControls(true)}
            />
          </div>
        )}
      </div>

      {/* Partner Compensation */}
      <div style={{ padding: '0 16px 16px' }}>
        <PartnerCompensation
          environment="production"
          cachedSummary={cachedData?.summary}
          cachedEquity={cachedData?.equity}
          isMobile={true}
        />
      </div>

      {/* Mobile Controls Overlay */}
      {showControls && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 10000,
              WebkitTapHighlightColor: 'rgba(0,0,0,0)'
            }}
            onClick={(e) => {
              e.stopPropagation()
              setShowControls(false)
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              background: '#fff',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column',
              WebkitTapHighlightColor: 'rgba(0,0,0,0)'
            }}
          >
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', WebkitTapHighlightColor: 'rgba(0,0,0,0)' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Chart Controls</div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowControls(false)
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 16,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Done
              </button>
            </div>
            <div style={{ padding: 12, overflowY: 'auto' }}>
              <ChartControls
                isNormalized={isNormalized}
                setIsNormalized={setIsNormalized}
                showCombined={showCombined}
                setShowCombined={setShowCombined}
                combineStatistic={combineStatistic}
                setCombineStatistic={setCombineStatistic}
                combineError={combineError}
                setCombineError={setCombineError}
                chartMode={chartMode}
                setChartMode={setChartMode}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                showAllMonths={showAllMonths}
                setShowAllMonths={setShowAllMonths}
                incomeMode={incomeMode}
                setIncomeMode={setIncomeMode}
                smoothing={smoothing}
                setSmoothing={setSmoothing}
                variant="mobile"
                selectedYears={selectedYears}
                setSelectedYears={setSelectedYears}
                visibleSites={visibleSites}
                setVisibleSites={setVisibleSites}
                colorScheme={colorScheme}
                setColorScheme={setColorScheme}
                siteColorScheme={siteColorScheme}
                setSiteColorScheme={setSiteColorScheme}
                fullWidth={true}
              />
            </div>
          </div>
        </>
      )}

      {/* Mobile Scenario Load Modal */}
      <MobileScenarioLoadModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadScenario}
        viewMode="YTD Mobile"
      />
    </>
  )
}
