import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faFloppyDisk, faCopy, faCircleXmark, faGear, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import {
  parseTherapyIncome2025,
  type YTDPoint
} from '../../../../historical_data/therapyIncomeParser'
import { getCurrentDateInfo } from './utils/dataProcessing'
import { authenticatedFetch } from '../../../../lib/api'
import type { IncomeMode } from '../../shared/types'

// Import modular components
import ChartControls from './components/ChartControls'
import YearlyDataGrid from './components/YearlyDataGrid'
import DetailedChart from './components/DetailedChart'
import PartnerCompensation from './components/PartnerCompensation'

// Import dashboard store and physicians editor
import { useDashboardStore } from '../../../Dashboard'
import PhysiciansEditor from '../../shared/components/PhysiciansEditor'
import { DEFAULT_LOCUM_COSTS_2025 } from '../../shared/defaults'
import ModularScenarioSaveDialog from '../../../scenarios/ModularScenarioSaveDialog'
import ScenarioLoadModal from '../../../scenarios/ScenarioLoadModal'
import ShareLinkButton from '../../../shared/ShareLinkButton'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../../lib/supabase'

interface YTDDetailedProps {
  initialSettings?: any
  onSettingsChange?: (settings: any) => void
  onRefreshRequest?: (callback: () => void) => void // Callback to register refresh function with parent
}

export default function YTDDetailed({ initialSettings, onSettingsChange, onRefreshRequest }: YTDDetailedProps) {
  const store = useDashboardStore()
  const { profile } = useAuth()
  const [showLoadingModal, setShowLoadingModal] = useState(true)  // Start as true to show immediately
  const [showLoadModal, setShowLoadModal] = useState(false)  // Scenario load modal
  const [showModularSaveDialog, setShowModularSaveDialog] = useState(false)  // Modular save dialog
  const [isScenarioDirty, setIsScenarioDirty] = useState(false)  // Track if scenario has been modified
  const [scenarioAIsPublic, setScenarioAIsPublic] = useState(false)  // Track if scenario is public
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [environment] = useState<'production' | 'sandbox'>('production')
  const [cachedData, setCachedData] = useState<{ daily?: any, summary?: any, equity?: any } | null>(null)
  const [isResyncingCompensation, setIsResyncingCompensation] = useState(true) // Keep compensation frozen until cache syncs
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger for data refresh after sync
  const [isNormalized, setIsNormalized] = useState(initialSettings?.isNormalized ?? false)
  const [showCombined, setShowCombined] = useState(initialSettings?.showCombined ?? false)
  const [combineStatistic, setCombineStatistic] = useState<'mean' | 'median' | null>(initialSettings?.combineStatistic ?? null) // Off by default
  const [combineError, setCombineError] = useState<'std' | 'ci' | null>(initialSettings?.combineError ?? null) // Off by default
  const [chartMode, setChartMode] = useState<'line' | 'bar' | 'proportion'>(initialSettings?.chartMode ?? 'line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>(initialSettings?.timeframe ?? 'year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>(initialSettings?.currentPeriod ?? { year: new Date().getFullYear() })
  const [is2025Visible, setIs2025Visible] = useState(initialSettings?.is2025Visible ?? true)
  const [showAllMonths, setShowAllMonths] = useState(initialSettings?.showAllMonths ?? true)
  const [incomeMode, setIncomeMode] = useState<IncomeMode>(initialSettings?.incomeMode ?? 'total')
  const [smoothingByMode, setSmoothingByMode] = useState<{
    line: number,
    bar: number,
    proportion: number
  }>(initialSettings?.smoothingByMode ?? {
    line: 10,
    bar: 0, // Bar charts don't use smoothing
    proportion: 12 // Default for proportion mode
  })
  const [selectedYears, setSelectedYears] = useState<number[]>(initialSettings?.selectedYears ?? Array.from({ length: 9 }, (_, i) => 2016 + i)) // Default: all years (2016-2024)
  const [visibleSites, setVisibleSites] = useState<{ lacey: boolean, centralia: boolean, aberdeen: boolean }>(initialSettings?.visibleSites ?? { lacey: true, centralia: true, aberdeen: true })
  const [colorScheme, setColorScheme] = useState<'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'>(initialSettings?.colorScheme ?? 'gray')
  const [siteColorScheme, setSiteColorScheme] = useState<'rgb' | 'radiantCare' | 'jama'>(initialSettings?.siteColorScheme ?? 'rgb')

  // Helper functions for mode-specific smoothing
  const getCurrentSmoothing = () => smoothingByMode[chartMode]
  const setCurrentSmoothing = (value: number) => {
    setSmoothingByMode(prev => ({ ...prev, [chartMode]: value }))
  }

  // Parse 2025 data for loading into the chart component
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])

  // Get YTD data (2025 current year)
  const fy2025 = store.ytdData
  const currentLocumCosts = fy2025?.locumCosts ?? DEFAULT_LOCUM_COSTS_2025

  // Parse YTD Locums amount from summary data (row 8323 Salary Locums, TOTAL column)
  const ytdLocumsAmount = useMemo(() => {
    if (!cachedData?.summary) {
      return 0
    }

    // First, find the TOTAL column index from the column headers
    const columns = cachedData.summary.Columns?.Column || []
    let totalColumnIndex = -1
    columns.forEach((col: any, index: number) => {
      if (col.ColTitle === 'TOTAL') {
        totalColumnIndex = index
      }
    })

    if (totalColumnIndex === -1) {
      return 0
    }

    // Now find the Locums row
    const findRowByPattern = (rows: any[]): any => {
      for (const row of rows) {
        const accountValue = row.ColData?.[0]?.value?.toString() || ''

        // Match "8323 Salary Locums" or similar variations
        if (accountValue.match(/832[23].*Salary.*Locums/i) || accountValue.match(/832[23].*Locums.*Salary/i)) {
          return row
        }

        if (row.Rows?.Row) {
          const found = findRowByPattern(row.Rows.Row)
          if (found) return found
        }
      }
      return null
    }

    const locumsRow = findRowByPattern(cachedData.summary.Rows.Row)
    if (locumsRow?.ColData?.[totalColumnIndex]) {
      const value = Math.abs(parseFloat(locumsRow.ColData[totalColumnIndex]?.value || '0'))
      // Round to nearest 100 to align with slider step
      return Math.round(value / 100) * 100
    }
    return 0
  }, [cachedData?.summary])

  // Ensure 2025 entry exists in the store for PhysiciansEditor to work properly
  useEffect(() => {
    if (!fy2025) {
      store.ensureBaselineYear('A', 2025)
    }
  // Only depend on fy2025 existence, not the entire store object
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

  useEffect(() => {
    const startTime = Date.now()
    setError(null)
    
    // Show loading modal for refreshes after initial load
    if (refreshTrigger > 0) {
      setShowLoadingModal(true)
    }

    // Delay data fetching to ensure modal is rendered first
    // Use requestAnimationFrame + small timeout to ensure paint has occurred
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (environment === 'sandbox') {
          // Sandbox mode: use historical JSON files
          try {
            const loadedData = historical2025Data
            
            // Hold the data until modal is ready to dismiss
            const elapsed = Date.now() - startTime
            const remainingTime = Math.max(0, 1000 - elapsed)
            
            setTimeout(() => {
              setData(loadedData)
              setError(null)
              setShowLoadingModal(false)
            }, remainingTime)
          } catch (e: any) {
            setError(e?.message || 'Failed to load 2025 historical data')
            setShowLoadingModal(false)
          }
        } else {
          // Production mode: try to load cached data, fall back to historical
          authenticatedFetch('/api/qbo/cached-2025')
            .then((res: Response) => {
              if (!res.ok) {
                // No cached data, use fallback
                console.log('No cached data available, using historical JSON fallback')
                return { data: historical2025Data, cache: null }
              }
              return res.json().then((cache: any) => {
                if (cache?.daily) {
                  // Parse the cached daily report
                  const points = parseTherapyIncome2025(cache.daily)
                  return { 
                    data: points, 
                    cache: { daily: cache.daily, summary: cache.summary, equity: cache.equity }
                  }
                } else {
                  // Fallback to historical
                  return { data: historical2025Data, cache: null }
                }
              })
            })
            .catch((err: any) => {
              console.error('Error loading cached data, using fallback:', err)
              return { data: historical2025Data, cache: null }
            })
            .then((result: any) => {
              // Hold the data until modal is ready to dismiss
              const elapsed = Date.now() - startTime
              const remainingTime = Math.max(0, 1000 - elapsed)
              
              setTimeout(() => {
                setData(result.data)
                setCachedData(result.cache)
                setShowLoadingModal(false)
              }, remainingTime)
            })
        }
      }, 50) // Small delay after paint to ensure modal is visible
    })
  }, [historical2025Data, environment, refreshTrigger])

  // Callback for when YearlyDataGrid completes cache sync
  const handleSyncComplete = useCallback(() => {
    console.log('✅ [Desktop] Cache synced to store, waiting for compensation recalc...')
    // Use requestAnimationFrame + small timeout to ensure React has re-rendered
    // with the new values before unfreezing the compensation table
    requestAnimationFrame(() => {
      setTimeout(() => {
        console.log('✅ [Desktop] Unfreezing compensation table')
        setIsResyncingCompensation(false)
      }, 100) // Small delay to ensure compensation has recalculated
    })
  }, [])

  // Load "2025 Default" scenario on mount (only once)
  useEffect(() => {
    store.loadDefaultYTDScenario()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for scenario loads and freeze compensation until grid re-syncs
  useEffect(() => {
    const currentScenarioId = store.currentYearSettingId
    if (currentScenarioId) {
      console.log('🔄 [Desktop] Scenario loaded, freezing compensation until grid re-syncs')
      setIsResyncingCompensation(true)
    }
  }, [store.currentYearSettingId])

  // Initialize current period based on timeframe
  useEffect(() => {
    const currentDate = getCurrentDateInfo()
    if (timeframe === 'year') {
      setCurrentPeriod({ year: currentDate.year })
    } else if (timeframe === 'quarter') {
      setCurrentPeriod({ year: 2025, quarter: currentDate.quarter })
    } else if (timeframe === 'month') {
      setCurrentPeriod({ year: 2025, month: currentDate.month })
    }
  }, [timeframe])

  // Auto-adjust smoothing when switching chart modes
  useEffect(() => {
    // Calculate available months for proportion mode
    const calculateAvailableMonths = () => {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-12

      let totalMonths = 0

      // Count full months from historical years (2016-2024)
      const historicalYears = selectedYears.filter(y => y >= 2016 && y <= 2024)
      totalMonths += historicalYears.length * 12

      // Add partial year from 2025 (only count up to current month)
      if (currentYear === 2025) {
        totalMonths += currentMonth
      }

      // Cap at 36 months maximum
      return Math.min(36, totalMonths)
    }

    const currentSmoothing = getCurrentSmoothing()

    if (chartMode === 'proportion') {
      // When in proportion mode, clamp smoothing to available months
      const maxSmoothing = calculateAvailableMonths()
      if (currentSmoothing > maxSmoothing) {
        setCurrentSmoothing(maxSmoothing)
      }
    } else if (chartMode === 'line') {
      // Line mode: ensure smoothing is reasonable (max 10)
      if (currentSmoothing > 10) {
        setCurrentSmoothing(10)
      }
    } else if (chartMode === 'bar') {
      // Bar mode: smoothing doesn't apply, but keep at 0
      setCurrentSmoothing(0)
    }
  }, [chartMode, selectedYears, getCurrentSmoothing, setCurrentSmoothing])


  // Reset 2025 visibility when switching chart modes
  useEffect(() => {
    if (chartMode === 'bar') {
      setIs2025Visible(true)
    }
  }, [chartMode])

  // Report settings changes to parent for shareable link
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({
        isNormalized,
        showCombined,
        combineStatistic,
        combineError,
        chartMode,
        timeframe,
        currentPeriod,
        is2025Visible,
        showAllMonths,
        incomeMode,
        smoothingByMode,
        selectedYears,
        visibleSites,
        colorScheme,
        siteColorScheme
      })
    }
  }, [
    isNormalized,
    showCombined,
    combineStatistic,
    combineError,
    chartMode,
    timeframe,
    currentPeriod,
    is2025Visible,
    showAllMonths,
    incomeMode,
    smoothingByMode,
    selectedYears,
    visibleSites,
    colorScheme,
    siteColorScheme,
    onSettingsChange
  ])


  // Mark scenario as dirty when scenario data changes compared to loaded snapshot
  useEffect(() => {
    // Skip if no scenario loaded
    if (!store.currentYearSettingId || !store.loadedCurrentYearSettingsSnapshot) {
      setIsScenarioDirty(false)
      return
    }

    // Check if current state differs from snapshot
    const isDirty = store.isCurrentYearSettingsDirty()
    setIsScenarioDirty(isDirty)
  }, [
    store.currentYearSettingId,
    store.loadedCurrentYearSettingsSnapshot,
    // Track changes to scenario data (physician panel, grid, etc.)
    JSON.stringify(fy2025),
    JSON.stringify(store.ytdCustomProjectedValues)
  ])

  // Fetch scenario public status when loaded
  useEffect(() => {
    async function fetchScenarioPublicStatus() {
      if (!store.currentYearSettingId) {
        setScenarioAIsPublic(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('is_public')
          .eq('id', store.currentYearSettingId)
          .single()

        if (!error && data) {
          setScenarioAIsPublic(data.is_public)
        }
      } catch (err) {
        console.error('Failed to fetch scenario public status:', err)
      }
    }

    fetchScenarioPublicStatus()
  }, [store.currentYearSettingId])


  // Reset scenario to original state
  const handleResetScenario = () => {
    if (!store.loadedCurrentYearSettingsSnapshot) return

    if (confirm('Reset scenario to original state? All unsaved changes will be lost.')) {
      // Simple reset from snapshot - no database reload needed
      store.resetCurrentYearSettings()
      // The dirty state will automatically update via the effect that monitors changes
    }
  }

  // Get current scenario info from store
  const currentScenarioName = store.currentYearSettingName
  const currentScenarioUserId = store.currentYearSettingUserId
  const isScenarioOwner = currentScenarioUserId && profile?.id === currentScenarioUserId

  return (
    <>
      {/* Modular Save Dialog */}
      <ModularScenarioSaveDialog
        isOpen={showModularSaveDialog}
        onClose={() => setShowModularSaveDialog(false)}
        onSave={async (_saveType, name, description, isPublic) => {
          // In YTD view, always save as Current Year Settings
          // (It's always 2025 Data mode in this view)
          const ytdSettings = {
            // Required YTDSettings properties
            isNormalized,
            smoothing: getCurrentSmoothing(),
            chartType: chartMode,
            incomeMode,
            showTarget: true, // Default to true
            // Additional YTD-specific properties
            showCombined,
            combineStatistic,
            combineError,
            timeframe,
            currentPeriod,
            is2025Visible,
            showAllMonths,
            smoothingByMode,
            selectedYears,
            visibleSites,
            colorScheme,
            siteColorScheme
          }
          await store.saveCurrentYearSettings(name, description, isPublic, ytdSettings)
        }}
        baselineMode="2025 Data"
        ytdSettings={{
          isNormalized,
          smoothing: getCurrentSmoothing(),
          chartType: chartMode,
          incomeMode,
          showTarget: true
        }}
      />

      {/* Loading Modal - render FIRST before any content */}
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
            padding: 40,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
            minWidth: 300,
            animation: 'slideIn 0.3s ease-out'
          }}>
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
                margin: '0 auto 20px'
              }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#333',
              marginBottom: 8
            }}>
              Loading Dashboard
            </div>
            <div style={{
              fontSize: 14,
              color: '#666'
            }}>
              Loading cached data...
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

      {/* Scenario Manager Section */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {currentScenarioName && (
          <div style={{
            padding: '8px 16px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: 8,
            fontSize: 14,
            fontWeight: 500,
            color: '#0369a1'
          }}>
            <span>Current: {currentScenarioName}</span>
          </div>
        )}

        {/* Load Button */}
        <button
          onClick={() => {
            // Warn if there are unsaved changes
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
            fontSize: 24,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            padding: 2
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          title="Load scenario"
        >
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>

        {/* Save Button - only show if scenario is loaded and user owns it */}
        {currentScenarioName && isScenarioOwner && (
          <button
            onClick={() => {
              if (confirm('Note: Only 2025 data will be saved from this view.\n\nIf you want to save multiple years, please use the MultiYear view instead.\n\nContinue saving?')) {
                const event = new CustomEvent('editCurrentScenario')
                window.dispatchEvent(event)
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#059669',
              fontSize: 24,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              padding: 2
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            title="Save scenario"
          >
            <FontAwesomeIcon icon={faFloppyDisk} />
          </button>
        )}

        {/* Save As Button */}
        <button
          onClick={() => setShowModularSaveDialog(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: 24,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            padding: 2
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          title="Save as new scenario"
        >
          <FontAwesomeIcon icon={faCopy} />
        </button>

        {/* Unload Button - only show if scenario is loaded and not Default */}
        {currentScenarioName && currentScenarioName !== '2025 Default' && (
          <button
            onClick={() => {
              const event = new CustomEvent('unloadScenario')
              window.dispatchEvent(event)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: 24,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              padding: 2
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            title="Unload scenario"
          >
            <FontAwesomeIcon icon={faCircleXmark} />
          </button>
        )}

        {/* Vertical Separator */}
        <div style={{
          width: 1,
          height: 24,
          background: '#d1d5db',
          margin: '0 4px'
        }} />

        {/* Share Link Button */}
        <ShareLinkButton
          viewMode="YTD Detailed"
          scenarioAId={store.currentYearSettingId}
          scenarioAIsPublic={scenarioAIsPublic}
          scenarioBId={null}
          scenarioBIsPublic={false}
          scenarioBEnabled={false}
          isScenarioDirty={isScenarioDirty}
          isScenarioBDirty={false}
          uiSettings={{
            ytdDetailed: {
              isNormalized,
              chartMode,
              smoothing: getCurrentSmoothing(),
              incomeMode,
              colorScheme,
              siteColorScheme,
              timeframe,
              currentPeriod,
              selectedYears,
              visibleSites,
              showCombined,
              combineStatistic,
              combineError,
              smoothingByMode,
              is2025Visible,
              showAllMonths
            }
          }}
        />

        {/* Gear Icon - Full Scenario Manager */}
        <button
          onClick={() => {
            const event = new CustomEvent('openScenarioManager')
            window.dispatchEvent(event)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: 24,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            padding: 2
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          title="Scenario Manager"
        >
          <FontAwesomeIcon icon={faGear} />
        </button>

        {/* Reset Button - only show if scenario is loaded and has been modified */}
        {currentScenarioName && isScenarioDirty && (
          <button
            onClick={handleResetScenario}
            style={{
              background: 'none',
              border: 'none',
              color: '#f59e0b',
              fontSize: 24,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              padding: 2
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            title="Reset to original"
          >
            <FontAwesomeIcon icon={faRotateLeft} />
          </button>
        )}
      </div>

      {/* Scenario Load Modal */}
      <ScenarioLoadModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={async (id) => {
          await store.loadScenarioFromDatabase(id, 'A', true)
          setShowLoadModal(false)
        }}
        viewMode="YTD Detailed"
      />

      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        marginBottom: 24,
        position: 'relative'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Refreshing indicator for chart projections */}
          {environment === 'production' && isResyncingCompensation && (
            <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '4px 10px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 4,
              fontSize: 11,
              color: '#856404',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 100,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Refreshing projections...
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {error === 'not_connected' ? (
            <div>
              <div style={{ marginBottom: 8 }}>Connect your QuickBooks to load real YTD data.</div>
              <a href={`/api/qbo/connect?env=${environment}`} style={{ display: 'inline-block', border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', textDecoration: 'none' }}>Connect QuickBooks ({environment})</a>
            </div>
          ) : error ? (
            <div style={{ color: '#991b1b' }}>{error}</div>
          ) : (
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
              smoothing={getCurrentSmoothing()}
              fy2025={isResyncingCompensation ? undefined : fy2025}
              selectedYears={selectedYears}
              visibleSites={visibleSites}
              colorScheme={colorScheme}
              siteColorScheme={siteColorScheme}
            />
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
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
            smoothing={getCurrentSmoothing()}
            setSmoothing={setCurrentSmoothing}
            variant="sidebar"
            selectedYears={selectedYears}
            setSelectedYears={setSelectedYears}
            visibleSites={visibleSites}
            setVisibleSites={setVisibleSites}
            colorScheme={colorScheme}
            setColorScheme={setColorScheme}
            siteColorScheme={siteColorScheme}
            setSiteColorScheme={setSiteColorScheme}
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        {showLoadingModal || isResyncingCompensation ? (
          // Show loading placeholder during initial data load and cache sync
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 16,
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 18 }}>Physician Compensation</div>
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#666', fontSize: 15 }}>
              Loading compensation data...
            </div>
          </div>
        ) : (
          <PartnerCompensation
            environment={environment}
            cachedSummary={cachedData?.summary}
            cachedEquity={cachedData?.equity}
            isResyncing={isResyncingCompensation}
          />
        )}
      </div>
      <div style={{ width: '900px', margin: '0 auto', marginBottom: 24 }}>
        <PhysiciansEditor
          year={2025}
          scenario="A"
          mode="ytd"
          readOnly={false}
          locumCosts={Math.max(currentLocumCosts, ytdLocumsAmount)}
          onLocumCostsChange={(value) => store.setYtdValue('locumCosts', value)}
          ytdLocumsMin={ytdLocumsAmount}
        />
      </div>
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <YearlyDataGrid
          environment={environment}
          cachedSummary={cachedData?.summary}
          isLoadingCache={showLoadingModal}
          onSyncComplete={handleSyncComplete}
          mode="ytd"
        />
      </div>
    </>
  )
}
