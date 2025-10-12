import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faSync, faSignOutAlt, faKey } from '@fortawesome/free-solid-svg-icons'
import {
  parseTherapyIncome2025,
  type YTDPoint
} from '../../../../historical_data/therapyIncomeParser'
import { authenticatedFetch } from '../../../../lib/api'
import { useDashboardStore } from '../../../Dashboard'
import { useAuth } from '../../../auth/AuthProvider'
import DetailedChart from './components/DetailedChart'
import YearlyDataGrid from './components/YearlyDataGrid'

interface YTDDetailedMobileProps {
  onRefreshRequest?: (callback: () => void) => void
  onPasswordChange?: () => void
}

export default function YTDDetailedMobile({ onRefreshRequest, onPasswordChange }: YTDDetailedMobileProps) {
  const store = useDashboardStore()
  const { signOut } = useAuth()
  const [showLoadingModal, setShowLoadingModal] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [cachedData, setCachedData] = useState<{ daily?: any, summary?: any } | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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
                  cache: { daily: cache.daily, summary: cache.summary }
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

  // Handle sync
  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await authenticatedFetch('/api/qbo/sync-2025', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const responseData = await response.json()

      if (!response.ok) {
        alert(responseData.message || 'Sync failed')
      } else {
        setRefreshTrigger(prev => prev + 1)
      }
    } catch {
      alert('Network error - please try again')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      {/* Loading Modal */}
      {showLoadingModal && (
        <div style={{
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
        }}>
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
      )}

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: 'none',
            border: 'none',
            color: syncing ? '#94a3b8' : '#0ea5e9',
            fontSize: 20,
            cursor: syncing ? 'not-allowed' : 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 4
          }}
        >
          <FontAwesomeIcon icon={faSync} spin={syncing} />
        </button>

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
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
              borderRadius: 4
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
                  zIndex: 999
                }}
                onClick={() => setShowUserMenu(false)}
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
                  onClick={() => {
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
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  <FontAwesomeIcon icon={faKey} style={{ width: 16, color: '#6b7280' }} />
                  Change Password
                </button>
                <button
                  onClick={() => {
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
                    gap: 8
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

      {/* Title */}
      <div style={{
        padding: '20px 16px 16px',
        textAlign: 'center',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#0ea5e9',
          marginBottom: 4
        }}>
          RadiantCare
        </div>
        <div style={{
          fontSize: 14,
          color: '#6b7280'
        }}>
          Compensation Dashboard
        </div>
      </div>

      {/* Chart */}
      <div style={{
        padding: 16,
        borderBottom: '1px solid #e5e7eb'
      }}>
        {error ? (
          <div style={{ color: '#991b1b', textAlign: 'center', padding: 20 }}>{error}</div>
        ) : (
          <DetailedChart
            data={data}
            isNormalized={false}
            showCombined={false}
            combineStatistic={null}
            combineError={null}
            chartMode="line"
            timeframe="year"
            currentPeriod={{ year: new Date().getFullYear() }}
            setCurrentPeriod={() => {}}
            is2025Visible={true}
            setIs2025Visible={() => {}}
            showAllMonths={true}
            incomeMode="total"
            smoothing={0}
            fy2025={fy2025}
            selectedYears={Array.from({ length: 10 }, (_, i) => 2016 + i)}
            visibleSites={{ lacey: true, centralia: true, aberdeen: true }}
            colorScheme="gray"
            siteColorScheme="rgb"
          />
        )}
      </div>

      {/* Physician Table */}
      <div style={{ padding: 16 }}>
        <YearlyDataGrid
          environment="production"
          cachedSummary={cachedData?.summary}
          isLoadingCache={showLoadingModal}
        />
      </div>
    </>
  )
}
