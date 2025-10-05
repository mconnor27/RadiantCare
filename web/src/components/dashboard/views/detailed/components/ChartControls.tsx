
import { useEffect, useState, useRef } from 'react'
import type { IncomeMode } from '../../../shared/types'
import { getColorScheme, getSiteColors } from '../config/chartConfig'
import ColorSchemeSelector from './ColorSchemeSelector'
import { createTooltip, removeTooltip } from '../../../shared/tooltips'

export interface ChartControlsProps {
  environment: 'production' | 'sandbox'
  isNormalized: boolean
  setIsNormalized: (normalized: boolean) => void
  showCombined: boolean
  setShowCombined: (combined: boolean) => void
  combineStatistic: 'mean' | 'median' | null
  setCombineStatistic: (stat: 'mean' | 'median' | null) => void
  combineError: 'std' | 'ci' | null
  setCombineError: (error: 'std' | 'ci' | null) => void
  chartMode: 'line' | 'bar' | 'proportion'
  setChartMode: (mode: 'line' | 'bar' | 'proportion') => void
  timeframe: 'year' | 'quarter' | 'month'
  setTimeframe: (timeframe: 'year' | 'quarter' | 'month') => void
  showAllMonths: boolean
  setShowAllMonths: (show: boolean) => void
  incomeMode: IncomeMode
  setIncomeMode: (mode: IncomeMode) => void
  smoothing: number
  setSmoothing: (smoothing: number) => void
  loading: boolean
  variant?: 'inline' | 'sidebar'
  selectedYears: number[]
  setSelectedYears: (years: number[]) => void
  visibleSites: { lacey: boolean, centralia: boolean, aberdeen: boolean }
  setVisibleSites: (sites: { lacey: boolean, centralia: boolean, aberdeen: boolean }) => void
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'
  setColorScheme: (scheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare') => void
  siteColorScheme: 'rgb' | 'radiantCare' | 'jama'
  setSiteColorScheme: (scheme: 'rgb' | 'radiantCare' | 'jama') => void
}

export default function ChartControls({
  environment,
  isNormalized,
  setIsNormalized,
  showCombined,
  setShowCombined,
  combineStatistic,
  setCombineStatistic,
  combineError,
  setCombineError,
  chartMode,
  setChartMode,
  timeframe,
  setTimeframe,
  showAllMonths,
  setShowAllMonths,
  incomeMode,
  setIncomeMode,
  smoothing,
  setSmoothing,
  loading,
  variant = 'inline',
  selectedYears,
  setSelectedYears,
  visibleSites,
  setVisibleSites,
  colorScheme,
  setColorScheme,
  siteColorScheme,
  setSiteColorScheme
}: ChartControlsProps) {
  
  // Calculate available months for projection mode based on selected years
  const calculateAvailableMonths = () => {
    if (chartMode !== 'proportion') return 10

    // Get current date info to determine how many months of 2025 data we have
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

  const maxSmoothing = calculateAvailableMonths()
  const clampedSmoothing = Math.min(smoothing, maxSmoothing)
  const isSidebar = variant === 'sidebar'
  
  // Get colors based on selected color scheme
  const colors = getColorScheme(colorScheme)
  const HISTORICAL_COLORS = colors.historical
  const SITE_COLORS = getSiteColors(siteColorScheme)
  
  // Historical data popup state
  const [isHistoricalPopupOpen, setIsHistoricalPopupOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const years = Array.from({ length: 9 }, (_, i) => 2024 - i) // 2024-2016 (reverse order)
  
  // Auto-clamp smoothing when chart mode or selected years change
  useEffect(() => {
    if (smoothing > maxSmoothing) {
      setSmoothing(maxSmoothing)
    }
  }, [chartMode, smoothing, maxSmoothing, setSmoothing, selectedYears])

  // Auto-clear mean/median and error selections when only one year is selected
  useEffect(() => {
    if (selectedYears.length <= 1 && (combineStatistic !== null || combineError !== null)) {
      setCombineStatistic(null)
      setCombineError(null)
      setShowCombined(false)
    }
  }, [selectedYears, combineStatistic, combineError, setCombineStatistic, setCombineError, setShowCombined])

  // Auto-select Month and Per Site when in Projection mode
  useEffect(() => {
    if (chartMode === 'proportion') {
      setTimeframe('month')
      setIncomeMode('per-site')
    }
  }, [chartMode, setTimeframe, setIncomeMode])
  
  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsHistoricalPopupOpen(false)
      }
    }
    if (isHistoricalPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isHistoricalPopupOpen])
  
  // Range slider state for projection mode
  const sortedSelectedYears = [...selectedYears].sort((a, b) => a - b)
  const rangeStart = sortedSelectedYears.length > 0 ? sortedSelectedYears[0] : 2016

  // Year selection handlers
  const handleYearToggle = (year: number) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year))
    } else {
      setSelectedYears([...selectedYears, year])
    }
  }

  const handleRangeChange = (start: number) => {
    if (start > 2024) {
      // If moved all the way to the right, select nothing
      setSelectedYears([])
    } else {
      const range: number[] = []
      for (let year = start; year <= 2024; year++) {
        range.push(year)
      }
      setSelectedYears(range)
    }
  }

  const handleSelectAll = () => {
    setSelectedYears([...years])
  }

  const handleSelectNone = () => {
    setSelectedYears([])
  }

  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)

  // Sync state
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Load last sync timestamp on mount
  useEffect(() => {
    if (environment === 'production') {
      fetch('/api/qbo/cached-2025')
        .then(res => res.ok ? res.json() : null)
        .then(cache => {
          if (cache?.lastSyncTimestamp) {
            setLastSyncTimestamp(cache.lastSyncTimestamp)
          }
        })
        .catch(() => {})
    }
  }, [environment])

  // Handle sync button click
  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const response = await fetch('/api/qbo/sync-2025', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'already_synced_today') {
          setSyncError('Already synced today')
          setLastSyncTimestamp(data.lastSyncTimestamp)
        } else if (data.error === 'not_connected') {
          setSyncError('not_connected')
        } else {
          setSyncError(data.message || 'Sync failed')
        }
      } else {
        setLastSyncTimestamp(data.lastSyncTimestamp)
        // Reload the page to refresh data
        window.location.reload()
      }
    } catch {
      setSyncError('Network error')
    } finally {
      setSyncing(false)
    }
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div style={{
      marginBottom: isSidebar ? 0 : 16,
      border: '1px solid #ccc',
      borderRadius: 4,
      padding: 10,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      minWidth: 360,
      maxWidth: 'fit-content',
      width: 'fit-content',
      position: 'relative'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: 16,
        fontWeight: 700
      }}>Chart Controls</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(105px, auto) 1fr',
        gap: '0 16px',
        alignItems: 'start',
        justifyItems: 'start'
      }}>
        {/* Group 1: Color Scheme */}
        <>
          <label style={{
            fontSize: 14,
            fontWeight: 500,
            paddingTop: 6,
            padding: '8px 0'
          }}>Color Scheme:</label>
          <div style={{
            padding: '12px',
            background: '#f9fafb',
            justifySelf: 'stretch',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            margin: '4px 0'
          }}>
            <ColorSchemeSelector
              totalColorScheme={colorScheme}
              setTotalColorScheme={setColorScheme}
              siteColorScheme={siteColorScheme}
              setSiteColorScheme={setSiteColorScheme}
            />
          </div>
        </>

        {/* Group 2: Income Mode + Site Visibility */}
        <>
          <label style={{
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            paddingTop: 6,
            opacity: chartMode === 'proportion' ? 0.5 : 1,
            padding: '8px 0'
          }}>Income Mode:</label>
          <div style={{
            padding: '12px',
            background: '#f9fafb',
            justifySelf: 'stretch',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            margin: '4px 0'
          }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'inline-flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
                <button
                  onClick={() => chartMode !== 'proportion' && setIncomeMode('total')}
                  disabled={chartMode === 'proportion'}
                  style={{
                    padding: '4px 12px',
                    border: 'none',
                    background: incomeMode === 'total' ? '#1e40af' : '#fff',
                    color: incomeMode === 'total' ? '#fff' : '#333',
                    fontSize: 14,
                    cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    opacity: chartMode === 'proportion' ? 0.5 : 1
                  }}
                >
                  Total
                </button>
                <button
                  onClick={() => chartMode !== 'proportion' && setIncomeMode('per-site')}
                  disabled={chartMode === 'proportion'}
                  style={{
                    padding: '4px 12px',
                    border: 'none',
                    background: incomeMode === 'per-site' ? '#1e40af' : '#fff',
                    color: incomeMode === 'per-site' ? '#fff' : '#333',
                    fontSize: 14,
                    cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    opacity: chartMode === 'proportion' ? 0.5 : 1
                  }}
                >
                  Per Site
                </button>
              </div>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                  opacity: chartMode === 'proportion' ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (chartMode !== 'proportion') {
                    createTooltip('income-mode-info', 'Total Income data available daily. Per Site data available through last complete month', e)
                  }
                }}
                onMouseLeave={() => removeTooltip('income-mode-info')}
              >
                  <span style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#6b7280',
                    userSelect: 'none'
                  }}>
                    i
                  </span>
              </div>
            </div>

            {/* Actual vs Normalized radio buttons */}
            <div style={{ display: 'flex', gap: 12, paddingLeft: 0 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                opacity: chartMode === 'proportion' ? 0.5 : 1
              }}>
                <input
                  type="radio"
                  checked={chartMode === 'proportion' ? false : !isNormalized}
                  onChange={() => chartMode !== 'proportion' && setIsNormalized(false)}
                  disabled={chartMode === 'proportion'}
                  style={{ margin: 0, cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer' }}
                />
                Actual
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                  opacity: chartMode === 'proportion' ? 0.5 : 1,
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'normalized-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  tooltip.textContent = 'Normalized to % of total annual income'
                  document.body.appendChild(tooltip)
                  const rect = e.currentTarget.getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => {
                  const tooltip = document.getElementById('normalized-tooltip')
                  if (tooltip) tooltip.remove()
                }}
              >
                <input
                  type="radio"
                  checked={chartMode === 'proportion' ? true : isNormalized}
                  onChange={() => chartMode !== 'proportion' && setIsNormalized(true)}
                  disabled={chartMode === 'proportion'}
                  style={{ margin: 0, cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer' }}
                />
                Normalized
              </label>
            </div>

            {/* Site visibility legend - show in per-site mode or proportion mode */}
            {(incomeMode === 'per-site' || chartMode === 'proportion') && (
              <div style={{ display: 'flex', gap: 6, paddingLeft: 0 }}>
                {[
                  { key: 'lacey' as const, label: 'Lacey', color: SITE_COLORS.lacey.current },
                  { key: 'centralia' as const, label: 'Centralia', color: SITE_COLORS.centralia.current },
                  { key: 'aberdeen' as const, label: 'Aberdeen', color: SITE_COLORS.aberdeen.current }
                ].map(site => {
                  const visibleCount = Object.values(visibleSites).filter(v => v).length
                  const isLastVisible = visibleSites[site.key] && visibleCount === 1

                  return (
                    <button
                      key={site.key}
                      onClick={() => {
                        if (!isLastVisible) {
                          setVisibleSites({ ...visibleSites, [site.key]: !visibleSites[site.key] })
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 6px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 3,
                        background: '#fff',
                        cursor: isLastVisible ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: visibleSites[site.key] ? 1 : 0.4
                      }}
                    >
                      <div style={{
                        width: 12,
                        height: 12,
                        background: site.color,
                        border: '1px solid #ccc',
                        borderRadius: 2
                      }} />
                      <span style={{ fontSize: 11, color: '#333' }}>{site.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        </>

        {/* Group 3: Historical Data + Mean/Median */}
        <>
          <label style={{
            fontSize: 14,
            fontWeight: 500,
            paddingTop: 6,
            padding: '8px 0'
          }}>Historical Data:</label>
          <div style={{
            position: 'relative',
            padding: '12px',
            background: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            justifySelf: 'stretch',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            margin: '4px 0'
          }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => setIsHistoricalPopupOpen(!isHistoricalPopupOpen)}
            style={{
              padding: '4px 12px',
              border: '1px solid #ccc',
              borderRadius: 4,
              background: '#fff',
              color: '#333',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '120px',
              textAlign: 'left'
            }}
          >
            {(() => {
              if (selectedYears.length === 0) return 'None';
              if (selectedYears.length === years.length) return 'All (2016-24)';

              // Check if selected years form a continuous range
              const sortedYears = [...selectedYears].sort((a, b) => a - b);
              const isContinuous = sortedYears.every((year, index) =>
                index === 0 || year === sortedYears[index - 1] + 1
              );

              if (isContinuous && sortedYears.length >= 2) {
                return `${sortedYears[0]}-${sortedYears[sortedYears.length - 1]}`;
              }

              return `${selectedYears.length} selected`;
            })()}
            <span style={{ float: 'right' }}>▾</span>
          </button>

          {isHistoricalPopupOpen && (
            <div
              ref={popupRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 4,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                padding: '6px',
                zIndex: 1000,
                minWidth: chartMode === 'proportion' ? '220px' : '120px',
                width: chartMode === 'proportion' ? '220px' : '120px'
              }}
            >
              {chartMode === 'proportion' ? (
                /* Range slider mode for projection */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>
                    {selectedYears.length === 0 ? 'No historical data' : `Year Range: ${rangeStart}–2024`}
                  </div>

                  {/* Dual-handle range slider (right handle fixed) */}
                  <div style={{ position: 'relative', padding: '10px 0' }}>
                    <style>{`
                      .dual-range-slider {
                        position: absolute;
                        width: 100%;
                        height: 6px;
                        top: 0;
                        left: 0;
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent;
                        outline: none;
                        pointer-events: none;
                        margin: 0;
                        padding: 0;
                      }
                      .dual-range-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #1e40af;
                        border: 3px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        cursor: grab;
                        pointer-events: auto;
                        margin-top: -7px;
                      }
                      .dual-range-slider::-webkit-slider-thumb:active {
                        cursor: grabbing;
                        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                      }
                      .dual-range-slider::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #1e40af;
                        border: 3px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        cursor: grab;
                        pointer-events: auto;
                      }
                      .dual-range-slider::-moz-range-thumb:active {
                        cursor: grabbing;
                        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                      }
                      .dual-range-slider::-webkit-slider-runnable-track {
                        width: 100%;
                        height: 6px;
                        background: #e5e7eb;
                        border-radius: 3px;
                      }
                      .dual-range-slider::-moz-range-track {
                        width: 100%;
                        height: 6px;
                        background: #e5e7eb;
                        border-radius: 3px;
                      }
                      .dual-range-slider.range-min::-webkit-slider-runnable-track {
                        background: linear-gradient(to right,
                          #e5e7eb 0%,
                          #e5e7eb ${selectedYears.length === 0 ? 100 : ((rangeStart - 2016) / 9) * 100}%,
                          #1e40af ${selectedYears.length === 0 ? 100 : ((rangeStart - 2016) / 9) * 100}%,
                          #1e40af ${(8 / 9) * 100}%,
                          #e5e7eb ${(8 / 9) * 100}%,
                          #e5e7eb 100%);
                      }
                      .dual-range-slider.range-max::-webkit-slider-runnable-track {
                        background: transparent;
                      }
                      .dual-range-slider.range-max::-webkit-slider-thumb {
                        cursor: default;
                        pointer-events: none;
                      }
                      .dual-range-slider.range-max::-moz-range-thumb {
                        cursor: default;
                        pointer-events: none;
                      }
                    `}</style>

                    {/* Container for both sliders on same track */}
                    <div style={{ position: 'relative', height: 6 }}>
                      {/* Min slider with colored track - movable */}
                      <input
                        type="range"
                        className="dual-range-slider range-min"
                        min="2016"
                        max="2025"
                        value={selectedYears.length === 0 ? 2025 : rangeStart}
                        onChange={(e) => {
                          handleRangeChange(parseInt(e.target.value))
                        }}
                        style={{ zIndex: 5 }}
                      />

                      {/* Max slider (transparent track) - fixed at 2025, not movable */}
                      <input
                        type="range"
                        className="dual-range-slider range-max"
                        min="2016"
                        max="2025"
                        value={2025}
                        readOnly
                        style={{ zIndex: 5 }}
                      />
                    </div>

                    {/* Year labels */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 12,
                      fontSize: 9,
                      color: '#999'
                    }}>
                      <span>2016</span>
                      <span>2020</span>
                      <span>2024</span>
                      <span>2025</span>
                    </div>
                  </div>

                  {/* Quick select buttons */}
                  <div style={{ display: 'flex', gap: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => handleRangeChange(2016)}
                      style={{
                        flex: 1,
                        padding: '3px 6px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#f0f9ff',
                        color: '#333',
                        fontSize: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      All
                    </button>
                    <button
                      onClick={() => handleRangeChange(2019)}
                      style={{
                        flex: 1,
                        padding: '3px 6px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#fff',
                        color: '#333',
                        fontSize: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      Last 6
                    </button>
                    <button
                      onClick={() => handleRangeChange(2025)}
                      style={{
                        flex: 1,
                        padding: '3px 6px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#fef2f2',
                        color: '#333',
                        fontSize: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      2025
                    </button>
                  </div>

                  {/* Apply button */}
                  <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => setIsHistoricalPopupOpen(false)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#1e40af',
                        color: '#fff',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                /* Checkbox list mode for other chart types */
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6, paddingBottom: 6, borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={handleSelectAll}
                      style={{
                        padding: '3px 6px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#f0f9ff',
                        color: '#333',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500,
                        width: '100%'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleSelectNone}
                      style={{
                        padding: '3px 6px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#fef2f2',
                        color: '#333',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500,
                        width: '100%'
                      }}
                    >
                      Select None
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {years.map((year, index) => {
                      const yearColor = HISTORICAL_COLORS[index % HISTORICAL_COLORS.length]
                      return (
                        <label
                          key={year}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 4px',
                            borderRadius: 2,
                            transition: 'background 0.2s',
                            background: selectedYears.includes(year) ? '#f0f9ff' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedYears.includes(year)}
                            onChange={() => handleYearToggle(year)}
                            style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1 }}>{year}</span>
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              background: yearColor,
                              border: '1px solid #ccc',
                              borderRadius: 2,
                              flexShrink: 0
                            }}
                          />
                        </label>
                      )
                    })}
                  </div>

                  {/* Apply button */}
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => setIsHistoricalPopupOpen(false)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        background: '#1e40af',
                        color: '#fff',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          {/* Mean/Median and Std Dev/CI */}
          <div style={{ display: 'flex', gap: 12 }}>
                {/* Statistic group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                cursor: (chartMode === 'proportion' || selectedYears.length <= 1) ? 'not-allowed' : 'pointer',
                opacity: (chartMode === 'proportion' || selectedYears.length <= 1) ? 0.5 : 1
              }}>
                <input
                  type="checkbox"
                  checked={combineStatistic === 'mean'}
                  disabled={chartMode === 'proportion' || selectedYears.length <= 1}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCombineStatistic('mean')
                      // Auto-select std dev as default if no error type selected
                      if (combineError === null) {
                        setCombineError('std')
                      }
                      setShowCombined(true)
                    } else {
                      setCombineStatistic(null)
                      // Also clear error selection when turning off statistic
                      setCombineError(null)
                      setShowCombined(false)
                    }
                  }}
                  style={{ margin: 0, cursor: (chartMode === 'proportion' || selectedYears.length <= 1) ? 'not-allowed' : 'pointer' }}
                />
                Mean
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                cursor: (chartMode === 'proportion' || selectedYears.length <= 1) ? 'not-allowed' : 'pointer',
                opacity: (chartMode === 'proportion' || selectedYears.length <= 1) ? 0.5 : 1
              }}>
                <input
                  type="checkbox"
                  checked={combineStatistic === 'median'}
                  disabled={chartMode === 'proportion' || selectedYears.length <= 1}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCombineStatistic('median')
                      // Auto-select std dev as default if no error type selected
                      if (combineError === null) {
                        setCombineError('std')
                      }
                      setShowCombined(true)
                    } else {
                      setCombineStatistic(null)
                      // Also clear error selection when turning off statistic
                      setCombineError(null)
                      setShowCombined(false)
                    }
                  }}
                  style={{ margin: 0, cursor: (chartMode === 'proportion' || selectedYears.length <= 1) ? 'not-allowed' : 'pointer' }}
                />
                Median
              </label>
            </div>

            {/* Error group - disabled if no statistic selected, in projection mode, or only one year selected */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                cursor: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 'pointer' : 'not-allowed',
                opacity: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 1 : 0.5
              }}>
                <input
                  type="checkbox"
                  checked={combineError === 'std'}
                  disabled={!combineStatistic || chartMode === 'proportion' || selectedYears.length <= 1}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCombineError('std')
                    } else {
                      setCombineError(null)
                    }
                  }}
                  style={{ margin: 0, cursor: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 'pointer' : 'not-allowed' }}
                />
                Std Dev
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                cursor: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 'pointer' : 'not-allowed',
                opacity: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 1 : 0.5
              }}>
                <input
                  type="checkbox"
                  checked={combineError === 'ci'}
                  disabled={!combineStatistic || chartMode === 'proportion' || selectedYears.length <= 1}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCombineError('ci')
                    } else {
                      setCombineError(null)
                    }
                  }}
                  style={{ margin: 0, cursor: (combineStatistic && chartMode !== 'proportion' && selectedYears.length > 1) ? 'pointer' : 'not-allowed' }}
                />
                95% CI
              </label>
            </div>
              </div>
          </div>
        </>

        {/* Group 4: Chart Type + Smoothing */}
        <>
          <label style={{
            fontSize: 14,
            fontWeight: 500,
            paddingTop: 6,
            padding: '8px 0'
          }}>Chart Type:</label>
          <div style={{
            padding: '12px',
            background: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'flex-start',
            justifySelf: 'stretch',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            margin: '4px 0'
          }}>
            <div style={{ display: 'inline-flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => setChartMode('line')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: chartMode === 'line' ? '#1e40af' : '#fff',
                color: chartMode === 'line' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Line
            </button>
            <button
              onClick={() => setChartMode('bar')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: chartMode === 'bar' ? '#1e40af' : '#fff',
                color: chartMode === 'bar' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Bar
            </button>
            <button
              onClick={() => incomeMode !== 'total' && setChartMode('proportion')}
              disabled={incomeMode === 'total'}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: chartMode === 'proportion' ? '#1e40af' : '#fff',
                color: chartMode === 'proportion' ? '#fff' : '#333',
                fontSize: 14,
                cursor: incomeMode === 'total' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: incomeMode === 'total' ? 0.5 : 1
              }}
            >
              Proportion
            </button>
            </div>

            {/* Smoothing */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: chartMode === 'bar' ? 0.5 : 1, width: '100%' }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Smoothing:</label>
          <input
            type="range"
            min="0"
            max={maxSmoothing}
            step="1"
            value={clampedSmoothing}
            onChange={(e) => {
              const newValue = parseInt(e.target.value)
              setSmoothing(newValue)
            }}
            disabled={chartMode === 'bar'}
            style={{
              width: '80px',
              height: '20px',
              cursor: chartMode === 'bar' ? 'not-allowed' : 'pointer'
            }}
          />
          <span style={{ fontSize: 11, color: '#666', minWidth: '20px' }}>
            {chartMode === 'proportion' ? `${clampedSmoothing} month window` : `${clampedSmoothing}`}
          </span>
        </div>
          </div>
        </>

        {/* Group 5: Timeframe + Monthly Toggle */}
        <>
          <label style={{
            fontSize: 14,
            fontWeight: 500,
            paddingTop: 6,
            opacity: chartMode === 'proportion' ? 0.5 : 1,
            padding: '8px 0'
          }}>Timeframe:</label>
          <div style={{
            padding: '12px',
            background: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'flex-start',
            justifySelf: 'stretch',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            margin: '4px 0'
          }}>
            <div style={{ display: 'inline-flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => chartMode !== 'proportion' && setTimeframe('year')}
              disabled={chartMode === 'proportion'}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'year' ? '#1e40af' : '#fff',
                color: timeframe === 'year' ? '#fff' : '#333',
                fontSize: 14,
                cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: chartMode === 'proportion' ? 0.5 : 1
              }}
            >
              Year
            </button>
            <button
              onClick={() => chartMode !== 'proportion' && setTimeframe('quarter')}
              disabled={chartMode === 'proportion'}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'quarter' ? '#1e40af' : '#fff',
                color: timeframe === 'quarter' ? '#fff' : '#333',
                fontSize: 14,
                cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: chartMode === 'proportion' ? 0.5 : 1
              }}
            >
              Quarter
            </button>
            <button
              onClick={() => chartMode !== 'proportion' && setTimeframe('month')}
              disabled={chartMode === 'proportion'}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'month' ? '#1e40af' : '#fff',
                color: timeframe === 'month' ? '#fff' : '#333',
                fontSize: 14,
                cursor: chartMode === 'proportion' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: chartMode === 'proportion' ? 0.5 : 1
              }}
            >
              Month
            </button>
            </div>

            {/* Monthly view mode toggle - shown below buttons when conditions are met */}
            {timeframe === 'month' && chartMode === 'bar' && !showCombined && (
              <label style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showAllMonths}
                  onChange={(e) => setShowAllMonths(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Show all 12 months
              </label>
            )}
          </div>
        </>
      </div>
      {!isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>Loading…</div>}
      {isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>Loading…</div>}
    </div>
  )
}
