import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faSignOutAlt, faKey, faSync } from '@fortawesome/free-solid-svg-icons'
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

  // Mobile chart settings state
  const [isNormalized, setIsNormalized] = useState(false)
  const [showCombined, setShowCombined] = useState(false)
  const [combineStatistic, setCombineStatistic] = useState<'mean' | 'median' | null>(null)
  const [combineError, setCombineError] = useState<'std' | 'ci' | null>(null)
  const [chartMode, setChartMode] = useState<'line' | 'bar' | 'proportion'>('line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>('year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>({ year: new Date().getFullYear() })
  const [is2025Visible, setIs2025Visible] = useState(true)
  const [showAllMonths, setShowAllMonths] = useState(true)
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
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        gap: 12
      }}>
        {/* Sync Icon Button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={handleSync}
            disabled={syncing || lastSyncTimestamp === undefined}
            style={{
              background: 'none',
              border: 'none',
              color: syncing || !syncAvailable || lastSyncTimestamp === undefined ? '#94a3b8' : '#0ea5e9',
              fontSize: 20,
              cursor: syncing || lastSyncTimestamp === undefined ? 'not-allowed' : (syncAvailable ? 'pointer' : 'pointer'),
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
          <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 48, width: 'auto', display: 'block' }} />
          <div style={{
            fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
            color: '#7c2a83',
            fontWeight: 900,
            fontSize: 24,
            lineHeight: 1,
            whiteSpace: 'nowrap'
          }}>
            Compensation Dashboard
          </div>
        </div>

        {/* User Menu */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
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

      {/* Chart */}
      <div style={{
        padding: 16,
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto'
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
              zIndex: 10000
            }}
            onClick={() => setShowControls(false)}
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
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Chart Controls</div>
              <button
                onClick={() => setShowControls(false)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13
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
    </>
  )
}
