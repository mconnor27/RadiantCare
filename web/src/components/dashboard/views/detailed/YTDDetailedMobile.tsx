import { useEffect, useMemo, useState, useRef } from 'react'
import { logger } from '../../../../lib/logger'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faSignOutAlt, faKey, faFolderOpen, faStar as faSolidStar } from '@fortawesome/free-solid-svg-icons'
import { faStar as faRegularStar } from '@fortawesome/free-regular-svg-icons'
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
import { syncStoreFromCurrentYearCache } from './utils/loadCurrentYearData'

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
  const [, setFavoritesMap] = useState<Map<string, { is_favorite_a: boolean, is_favorite_b: boolean, is_favorite_current: boolean }>>(new Map())

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

      // Load user's private scenarios and all public scenarios
      const { data: allData, error: myError } = await supabase
        .from('scenarios')
        .select('*')
        .or(`user_id.eq.${profile.id},is_public.eq.true`)
        .order('updated_at', { ascending: false })

      if (myError) throw myError

      // Fetch favorites for current user
      const { data: favoritesData } = await supabase
        .from('user_favorites')
        .select('scenario_id, favorite_type')
        .eq('user_id', profile.id)

      // Create a map of scenario_id -> favorite types
      const favoritesMap = new Map<string, { is_favorite_a: boolean, is_favorite_b: boolean, is_favorite_current: boolean }>()
      favoritesData?.forEach((fav: any) => {
        if (!favoritesMap.has(fav.scenario_id)) {
          favoritesMap.set(fav.scenario_id, { is_favorite_a: false, is_favorite_b: false, is_favorite_current: false })
        }
        const current = favoritesMap.get(fav.scenario_id)!
        if (fav.favorite_type === 'A') current.is_favorite_a = true
        if (fav.favorite_type === 'B') current.is_favorite_b = true
        if (fav.favorite_type === 'CURRENT') current.is_favorite_current = true
      })

      // Filter to only Current Year Settings scenarios (required for YTD Mobile view)
      const filteredData = (allData || []).filter((scenario: any) => {
        // Only include Current Year Settings type scenarios
        return 'scenario_type' in scenario && scenario.scenario_type === 'current_year'
      })

      // Merge favorites into scenario data
      const dataWithFavorites = filteredData.map((s: any) => ({
        ...s,
        is_favorite_a: favoritesMap.get(s.id)?.is_favorite_a || false,
        is_favorite_b: favoritesMap.get(s.id)?.is_favorite_b || false,
        is_favorite_current: favoritesMap.get(s.id)?.is_favorite_current || false,
      }))

      setMyScenarios(dataWithFavorites)
      setFavoritesMap(favoritesMap)
    } catch (err) {
      logger.error('CHART', 'Error loading scenarios:',  err)
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      const { supabase } = await import('../../../../lib/supabase')
      
      const scenario = myScenarios.find(s => s.id === id)
      if (!scenario) return

      const currentFavoriteValue = scenario.is_favorite_current
      const newFavoriteValue = !currentFavoriteValue

      // Optimistically update the local state immediately
      setMyScenarios(prev => prev.map(s => {
        if (s.id === id) {
          return { ...s, is_favorite_current: newFavoriteValue }
        }
        // If setting as favorite, clear other scenarios with this favorite type
        if (newFavoriteValue && s.is_favorite_current) {
          return { ...s, is_favorite_current: false }
        }
        return s
      }))

      // Update favorites map
      setFavoritesMap(prev => {
        const newMap = new Map(prev)
        if (!newMap.has(id)) {
          newMap.set(id, { is_favorite_a: false, is_favorite_b: false, is_favorite_current: false })
        }
        const current = newMap.get(id)!
        current.is_favorite_current = newFavoriteValue
        
        // Clear other scenarios with this favorite type
        if (newFavoriteValue) {
          for (const [scenarioId, favData] of newMap.entries()) {
            if (scenarioId !== id) {
              favData.is_favorite_current = false
            }
          }
        }
        
        return newMap
      })

      // Then update the database in the background
      if (newFavoriteValue) {
        // First, delete any existing CURRENT favorite for this user
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', profile?.id)
          .eq('favorite_type', 'CURRENT')

        // Insert new favorite
        const { error: insertError } = await supabase
          .from('user_favorites')
          .insert({
            user_id: profile?.id,
            scenario_id: id,
            favorite_type: 'CURRENT'
          })

        if (insertError) {
          // If database update fails, reload to get correct state
          await loadScenarios()
          throw insertError
        }
      } else {
        // Remove favorite
        const { error: deleteError } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', profile?.id)
          .eq('scenario_id', id)
          .eq('favorite_type', 'CURRENT')

        if (deleteError) {
          // If database update fails, reload to get correct state
          await loadScenarios()
          throw deleteError
        }
      }
    } catch (err) {
      logger.error('CHART', 'Error toggling favorite:',  err)
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite')
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
        onTouchEnd={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
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
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
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
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onLoad(scenario.id)
                    onClose()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onLoad(scenario.id)
                    onClose()
                  }}
                >
                  {/* Header: Title + Public/Private + Favorite Star */}
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
                      
                      {/* Favorite Star */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleFavorite(scenario.id)
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          position: 'relative',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        <FontAwesomeIcon
                          icon={scenario.is_favorite_current ? faSolidStar : faRegularStar}
                          style={{
                            color: '#fbbf24',
                            fontSize: '16px'
                          }}
                        />
                      </div>
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
  isInitialScenarioLoadComplete?: boolean
  hasPendingSharedLink?: boolean
}

export default function YTDDetailedMobile({ onRefreshRequest, onPasswordChange, isInitialScenarioLoadComplete = false, hasPendingSharedLink }: YTDDetailedMobileProps) {
  const store = useDashboardStore()
  const { signOut, profile } = useAuth()
  
  // iOS Safari touch fix - prevent double-tap zoom and ensure single-tap works
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      // Prevent double-tap zoom only on buttons, not charts or form controls
      let lastTouchEnd = 0
      const preventZoom = (e: TouchEvent) => {
        const target = e.target as HTMLElement
        // Only prevent zoom on buttons, not chart elements or form controls
        if (target && (target.tagName === 'BUTTON' || target.onclick || target.getAttribute('role') === 'button')) {
          const now = Date.now()
          if (now - lastTouchEnd <= 300) {
            e.preventDefault()
          }
          lastTouchEnd = now
        }
      }

      // Force immediate click response only on buttons, NOT on labels or inputs
      const forceClick = (e: TouchEvent) => {
        const target = e.target as HTMLElement
        // Exclude INPUT, LABEL, SELECT, TEXTAREA from force click
        if (target &&
            target.tagName !== 'INPUT' &&
            target.tagName !== 'LABEL' &&
            target.tagName !== 'SELECT' &&
            target.tagName !== 'TEXTAREA' &&
            !target.closest('label') && // Don't force click if inside a label
            (target.tagName === 'BUTTON' || target.onclick || target.getAttribute('role') === 'button')) {
          // Trigger click immediately on touch end
          setTimeout(() => {
            target.click()
          }, 0)
        }
      }

      document.addEventListener('touchend', preventZoom, { passive: false })
      document.addEventListener('touchend', forceClick, { passive: true })

      return () => {
        document.removeEventListener('touchend', preventZoom)
        document.removeEventListener('touchend', forceClick)
      }
    }
  }, [])

  // Ensure mobile mode only uses scenario A - clear scenario B state on mount
  useEffect(() => {
    logger.debug('CHART', '[Mobile] Clearing scenario B state for mobile mode')
    // Disable scenario B and clear all scenario B data
    store.setScenarioEnabled(false)
    // Force clear scenario B data to ensure it's not loaded
    // Note: We use setTimeout to ensure this happens after any potential initialization
    setTimeout(() => {
      // This ensures scenario B is completely cleared from store state
      // The setScenarioEnabled(false) above should handle this, but we're being explicit
    }, 0)
  }, [])

  // Handle shared links in mobile mode
  useEffect(() => {
    const handleSharedLinks = async () => {
      // Check for URL hash shared links (#s=...)
      const hash = window.location.hash
      if (hash && hash.startsWith('#s=')) {
        try {
          const encoded = hash.slice(3)
          const decoded = decodeURIComponent(atob(encoded))
          const data = JSON.parse(decoded)

          await handleSharedLinkData(data)
        } catch (err) {
          logger.error('CHART', 'Failed to load hash-based shared link:',  err)
        }
        return
      }

      // Check for path-based shared links (/share/{id})
      const pathMatch = window.location.pathname.match(/^\/share\/([^\/]+)$/)
      if (pathMatch) {
        const linkId = pathMatch[1]
        try {
          const response = await authenticatedFetch(`/api/shared-links?id=${linkId}`)
          if (response.ok) {
            const data = await response.json()
            await handleSharedLinkData(data)
          }
        } catch (err) {
          logger.error('CHART', 'Failed to load path-based shared link:',  err)
        }
      }
    }

    const handleSharedLinkData = async (data: any) => {
      logger.debug('CHART', '[Mobile] Processing shared link data:',  data)

      // Check if scenario A exists and is in 2025 baseline mode
      if (!data.scenario_a || !data.scenario_a.id) {
        alert('This shared link does not contain scenario data that can be viewed on mobile. Redirecting to main application.')
        window.location.href = '/'
        return
      }

      // Check if scenario A is in 2025 baseline mode (required for mobile)
      const scenarioADataMode = data.scenario_a.baseline_mode || '2025 Data'
      if (scenarioADataMode !== '2025 Data') {
        alert('This shared link contains scenario data that is not in 2025 baseline mode and cannot be viewed on mobile. Redirecting to main application.')
        window.location.href = '/'
        return
      }

      // Warn if scenario B is enabled
      if (data.scenario_b_enabled && data.scenario_b) {
        alert('This shared link contains scenario B data, which cannot be viewed on mobile. Only scenario A data will be displayed.')
      }

      // Load scenario A
      try {
        // Use NEW modular method to load Current Year Settings scenario
        await store.loadCurrentYearSettings(data.scenario_a.id)

        // Apply view mode if it's YTD Detailed (mobile only supports this)
        if (data.view_mode === 'YTD Detailed') {
          // Mobile only supports YTD Detailed view, so this is fine
        } else {
          // If it's Multi-Year, warn that mobile can only show YTD view
          alert('This shared link is configured for Multi-Year view. Mobile can only display YTD Detailed view.')
        }

        // Clear the URL after successful load
        window.history.pushState({}, '', '/')

        logger.debug('CHART', '[Mobile] Successfully loaded shared link')
      } catch (error) {
        logger.error('CHART', 'Error loading shared link scenario:',  error)
        alert('Failed to load shared link scenario')
        window.location.href = '/'
      }
    }

    handleSharedLinks()
  }, [])
  const [showLoadingModal, setShowLoadingModal] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [cachedData, setCachedData] = useState<{ daily?: any, summary?: any, equity?: any, retirementGLData?: any, lastSyncTimestamp?: string } | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false) // Mobile scenario load modal
  const [isScenarioDirty, setIsScenarioDirty] = useState(false) // Track if scenario has been modified
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false) // Sync info modal

  // Track last sync to prevent duplicate post-load resyncs
  const lastSyncRef = useRef<{ scenarioId: string | null, syncTimestamp: string | null }>({
    scenarioId: null,
    syncTimestamp: null
  })

  // Track if we're in the scenario-load → cache-sync cycle (freeze table during this)
  // Start frozen on mount - will unfreeze after QBO cache syncs
  const [isResyncingCompensation, setIsResyncingCompensation] = useState(true)
  
  // DEBUG: Log initial freeze state
  useEffect(() => {
    logger.debug('CHART', '[Mobile] 🔒 Initial freeze state:', {
      isResyncingCompensation: true,
      hasScenarioData: !!store.scenarioA?.future?.length,
      hasSnapshot: !!store.loadedScenarioSnapshot,
      therapyIncome: store.scenarioA?.future?.find(f => f.year === 2025)?.therapyIncome
    })
  }, [])

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
  const [colorScheme, setColorScheme] = useState<'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'>('radiantCare')
  const [siteColorScheme, setSiteColorScheme] = useState<'rgb' | 'radiantCare' | 'jama'>('rgb')

  // Parse 2025 data
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])

  // Get YTD data (2025 current year) - same as desktop
  const fy2025 = store.ytdData

  // Ensure 2025 entry exists in the store (for PhysiciansEditor and other components)
  useEffect(() => {
    if (!fy2025) {
      logger.debug('CHART', '[Mobile] 🆕 Creating baseline year 2025 in YTD store')
      store.ensureBaselineYear('A', 2025)
    } else {
      logger.debug('CHART', '[Mobile] ✅ YTD store has 2025 data:', {
        therapyIncome: fy2025.therapyIncome,
        physicians: fy2025.physicians?.length
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy2025])

  // Load favorite current year scenario or default scenario on mount (only once)
  useEffect(() => {
    const loadInitialScenario = async () => {
      if (!profile?.id) return

      // Skip loading if there's a pending shared link
      if (hasPendingSharedLink) {
        logger.debug('CHART', '[YTD Mobile Init] Skipping default scenario load - shared link pending')
        return
      }

      try {
        // Check if we have persisted ID from localStorage but no data (hybrid persistence)
        const hasPersistedId = !!store.currentYearSettingId
        const hasData = !!store.ytdData

        if (hasPersistedId && !hasData && store.currentYearSettingId) {
          // Reload from persisted ID
          logger.debug('CHART', '[YTD Mobile Init] Reloading from persisted ID:',  store.currentYearSettingId)
          await store.loadCurrentYearSettings(store.currentYearSettingId)
          return
        } else if (hasPersistedId && hasData) {
          // We have both ID and data (shouldn't happen with hybrid persistence, but handle it)
          logger.debug('CHART', '[YTD Mobile Init] Already loaded:',  store.currentYearSettingName)
          return
        }

        const { supabase } = await import('../../../../lib/supabase')

        // No persisted state - load favorite or default
        const { data: favoriteData } = await supabase
          .from('user_favorites')
          .select('scenario_id')
          .eq('user_id', profile.id)
          .eq('favorite_type', 'CURRENT')
          .single()

        if (favoriteData?.scenario_id) {
          // Load the favorite scenario
          await store.loadCurrentYearSettings(favoriteData.scenario_id)
          return
        }

        // No favorite found, load the current year's default scenario
        const currentYear = new Date().getFullYear()
        await store.loadDefaultYTDScenario(currentYear)
      } catch (error) {
        logger.error('CHART', 'Error loading initial scenario:',  error)
        // Fallback to current year default
        const currentYear = new Date().getFullYear()
        await store.loadDefaultYTDScenario(currentYear)
      }
    }

    loadInitialScenario()
  }, [profile?.id, hasPendingSharedLink]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register refresh callback with parent
  useEffect(() => {
    if (onRefreshRequest) {
      onRefreshRequest(() => {
        logger.debug('CHART', '🔄 Triggering data refresh after sync')
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
        authenticatedFetch('/api/qbo/cached?year=2025')
          .then((res: Response) => {
            if (!res.ok) {
              logger.debug('CHART', 'No cached data available,  using historical JSON fallback')
              return { data: historical2025Data, cache: { daily: null, summary: null, equity: null, lastSyncTimestamp: null } }
            }
            return res.json().then((cache: any) => {
              if (cache?.daily) {
                const points = parseTherapyIncome2025(cache.daily)
                return {
                  data: points,
                  cache: {
                    daily: cache.daily,
                    summary: cache.summary,
                    equity: cache.equity,
                    retirementGLData: cache.retirementGLData,
                    lastSyncTimestamp: cache.lastSyncTimestamp
                  }
                }
              } else {
                return { data: historical2025Data, cache: { daily: null, summary: null, equity: null, lastSyncTimestamp: null } }
              }
            })
          })
          .catch((err: any) => {
            logger.error('CHART', 'Error loading cached data,  using fallback:', err)
            return { data: historical2025Data, cache: { daily: null, summary: null, equity: null, lastSyncTimestamp: null } }
          })
          .then(async (result: any) => {
            const elapsed = Date.now() - startTime
            const remainingTime = Math.max(0, 1000 - elapsed)

            // Set data and cache but don't sync yet - wait for scenario load
            setTimeout(() => {
              setData(result.data)
              setCachedData(result.cache)
              setShowLoadingModal(false)
            }, remainingTime)
          })
      }, 50)
    })
  }, [historical2025Data, refreshTrigger, store])

  // Post-load resync: wait for scenarios to load, then sync from cache once
  useEffect(() => {
    console.group('🔄 [Mobile] Post-load resync effect triggered')
    logger.debug('CHART', 'State check:', {
      hasCachedSummary: !!cachedData?.summary,
      hasLoadedSnapshot: !!store.loadedCurrentYearSettingsSnapshot,
      currentYearSettingId: store.currentYearSettingId,
      isInitialScenarioLoadComplete,
      refreshTrigger,
      lastSyncState: lastSyncRef.current
    })

    // Reset sync tracking when refresh happens
    if (refreshTrigger > 0) {
      logger.debug('CHART', '🔃 Manual refresh detected,  resetting sync tracking')
      lastSyncRef.current = { scenarioId: null, syncTimestamp: null }
      setIsResyncingCompensation(true) // Re-freeze on manual refresh
    }

    // Only run if we have cached data, scenarios are loaded, AND initial scenario load is complete
    // NOTE: Use NEW modular fields (currentYearSettingId, loadedCurrentYearSettingsSnapshot) not legacy ones
    if (!cachedData?.summary || !store.loadedCurrentYearSettingsSnapshot || !store.currentYearSettingId || !isInitialScenarioLoadComplete) {
      // Keep frozen while waiting
      if (!isInitialScenarioLoadComplete && cachedData?.summary && store.loadedCurrentYearSettingsSnapshot) {
        logger.debug('CHART', '⏸️  Waiting for Dashboard initial scenario load to complete...')
      } else {
        logger.debug('CHART', '⏸️  Missing prerequisites:', {
          cachedSummary: !!cachedData?.summary,
          loadedSnapshot: !!store.loadedCurrentYearSettingsSnapshot,
          scenarioId: !!store.currentYearSettingId,
          initialLoadComplete: isInitialScenarioLoadComplete
        })
      }
      console.groupEnd()
      return
    }

    // Log current store state BEFORE sync
    logger.debug('CHART', '📊 Store state BEFORE sync:', {
      dataSource: 'store.ytdData',
      therapyIncome: store.ytdData?.therapyIncome,
      nonEmploymentCosts: store.ytdData?.nonEmploymentCosts,
      nonMdEmploymentCosts: store.ytdData?.nonMdEmploymentCosts,
      locumCosts: store.ytdData?.locumCosts,
      medicalDirectorHours: store.ytdData?.medicalDirectorHours,
      prcsMedicalDirectorHours: store.ytdData?.prcsMedicalDirectorHours,
      physicians: store.ytdData?.physicians?.length,
      ytdCustomProjectedValuesCount: Object.keys(store.ytdCustomProjectedValues || {}).length
    })

    // Scenarios are loaded, check if we need to sync
    const syncKey = `${store.currentYearSettingId}|${cachedData.lastSyncTimestamp || 'unknown'}`
    const lastSyncKey = `${lastSyncRef.current.scenarioId}|${lastSyncRef.current.syncTimestamp}`

    // If this is a new scenario or different cache version, run the sync
    if (syncKey !== lastSyncKey) {
      logger.debug('CHART', '🔄 Sync needed (keys differ):', { syncKey, lastSyncKey })

      lastSyncRef.current = {
        scenarioId: store.currentYearSettingId,
        syncTimestamp: cachedData.lastSyncTimestamp || null
      }

      syncStoreFromCurrentYearCache(store, cachedData.summary)
        .then(() => {
          // Log store state AFTER sync
          logger.debug('CHART', '📊 Store state AFTER sync:', {
            dataSource: 'store.ytdData',
            therapyIncome: store.ytdData?.therapyIncome,
            nonEmploymentCosts: store.ytdData?.nonEmploymentCosts,
            nonMdEmploymentCosts: store.ytdData?.nonMdEmploymentCosts,
            locumCosts: store.ytdData?.locumCosts,
            medicalDirectorHours: store.ytdData?.medicalDirectorHours,
            prcsMedicalDirectorHours: store.ytdData?.prcsMedicalDirectorHours
          })

          // Small delay to let React propagate the state updates
          setTimeout(() => {
            logger.debug('CHART', '✅ QBO sync complete,  unfreezing compensation')
            console.groupEnd()
            setIsResyncingCompensation(false)
          }, 100)
        })
        .catch(error => {
          logger.error('CHART', '❌ Post-load resync failed:',  error)
          console.groupEnd()
          setIsResyncingCompensation(false)
        })
    } else {
      // Sync already complete, unfreeze
      logger.debug('CHART', '✅ Sync already complete (keys match), unfreezing')
      console.groupEnd()
      setIsResyncingCompensation(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedData?.summary, cachedData?.lastSyncTimestamp, store.loadedCurrentYearSettingsSnapshot, store.currentYearSettingId, refreshTrigger, isInitialScenarioLoadComplete])

  // Load last sync timestamp
  useEffect(() => {
    if (!showLoadingModal) {
      authenticatedFetch('/api/qbo/cached?year=2025')
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


  // Handle scenario loading
  const handleLoadScenario = async (scenarioId: string) => {
    if (isScenarioDirty) {
      if (!confirm('You have unsaved changes to the current scenario. Loading another scenario will discard these changes. Continue?')) {
        return
      }
    }

    try {
      // Freeze compensation table during scenario load
      setIsResyncingCompensation(true)

      // Disable scenario B for mobile mode - only scenario A is supported
      store.setScenarioEnabled(false)

      // Use NEW modular method to load Current Year Settings scenario
      // This follows the same flow as initial load: defaults → scenario → QBO cache sync
      await store.loadCurrentYearSettings(scenarioId)

      setIsScenarioDirty(false)
      setShowLoadModal(false)

      // Reset sync tracking for new scenario (this will trigger post-load resync)
      lastSyncRef.current = { scenarioId: null, syncTimestamp: null }

      setRefreshTrigger(prev => prev + 1)

      // Note: setIsResyncingCompensation(false) will be called by post-load resync effect
    } catch (error) {
      logger.error('CHART', 'Error loading scenario:',  error)
      alert('Failed to load scenario')
      setIsResyncingCompensation(false)
    }
  }

  // Get current scenario info from store (using NEW modular field for YTD)
  const currentScenarioName = store.currentYearSettingName

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
          {/* Load Icon Button */}
          <button
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (isScenarioDirty) {
                if (!confirm('You have unsaved changes to the current scenario. Loading another scenario will discard these changes. Continue?')) {
                  return
                }
              }
              setShowLoadModal(true)
            }}
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
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowUserMenu(!showUserMenu)
            }}
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
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowUserMenu(false)
                    onPasswordChange?.()
                  }}
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
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowUserMenu(false)
                    signOut()
                  }}
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
          <div style={{
            padding: '4px 8px',
            background: currentScenarioName ? '#f0f9ff' : '#f9fafb',
            border: currentScenarioName ? '1px solid #bae6fd' : '1px solid #e5e7eb',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 500,
            color: currentScenarioName ? '#0369a1' : '#6b7280'
          }}>
            <span>{currentScenarioName ? `Current Scenario: ${currentScenarioName}` : 'Loading Scenario...'}</span>
          </div>
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
        ) : isResyncingCompensation ? (
          // Show loading placeholder during resync to prevent flash of incorrect data
          <div style={{
            width: '100%',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#f9fafb',
            boxShadow: '0 6px 10px rgba(0, 0, 0, 0.15)',
            position: 'relative',
            minHeight: 400
          }}>
            <div style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              color: '#666', 
              fontSize: 14
            }}>
              Loading chart data...
            </div>
          </div>
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
        {isResyncingCompensation ? (
          // Show loading placeholder during resync
          <div style={{
            marginTop: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 6,
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            minHeight: 200
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 17 }}>Physician Compensation</div>
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: 14 }}>
              Loading compensation data...
            </div>
          </div>
        ) : (
          <PartnerCompensation
            environment="production"
            cachedSummary={cachedData?.summary}
            cachedEquity={cachedData?.equity}
            cachedRetirementGL={cachedData?.retirementGLData}
            isMobile={true}
          />
        )}
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
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowControls(false)
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
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowControls(false)
                }}
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

      {/* Last Synced Footer */}
      {lastSyncTimestamp && (
        <div style={{
          padding: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <span
            style={{
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent'
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowSyncInfoModal(true)
            }}
            onClick={(e) => {
              e.stopPropagation()
              setShowSyncInfoModal(true)
            }}
          >
            Last Synced: {new Date(lastSyncTimestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
          </span>
        </div>
      )}

      {/* Sync Info Modal */}
      {showSyncInfoModal && (() => {
        // Calculate data current through date
        const getPriorBusinessDay = (date: Date) => {
          const prior = new Date(date)
          prior.setDate(prior.getDate() - 1)
          while (prior.getDay() === 0 || prior.getDay() === 6) {
            prior.setDate(prior.getDate() - 1)
          }
          return prior
        }
        
        let dataThroughText = ''
        if (lastSyncTimestamp) {
          const syncDate = new Date(lastSyncTimestamp)
          let dataCoveredThrough: Date
          if (syncDate.getHours() < 17) {
            dataCoveredThrough = getPriorBusinessDay(syncDate)
          } else {
            dataCoveredThrough = new Date(syncDate)
          }
          dataThroughText = dataCoveredThrough.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        }
        
        return (
          <>
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
              onTouchEnd={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowSyncInfoModal(false)
              }}
              onClick={(e) => {
                e.stopPropagation()
                setShowSyncInfoModal(false)
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '90%',
                width: '400px',
                zIndex: 10001,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                animation: 'slideIn 0.3s ease-out',
                WebkitTapHighlightColor: 'rgba(0,0,0,0)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
                QuickBooks Sync Schedule
              </h3>
              {dataThroughText && (
                <p style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: '#0f172a',
                  padding: '12px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  Data current through: {dataThroughText}
                </p>
              )}
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.5, color: '#666', textAlign: 'left' }}>
                QuickBooks data is automatically synced every business day (Monday-Friday) at 1:00 AM Pacific Time.
                <br/><br/>
                The sync captures through the previous business day's data, excluding weekends and federal holidays.
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.5, color: '#666', textAlign: 'left' }}>
                To request additional syncs or report sync issues, please contact:
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', textAlign: 'center' }}>
                <a
                  href="mailto:connor@radiantcare.com"
                  style={{
                    color: '#0ea5e9',
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  connor@radiantcare.com
                </a>
              </p>
              <button
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowSyncInfoModal(false)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSyncInfoModal(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Close
              </button>
            </div>
          </>
        )
      })()}
    </>
  )
}
