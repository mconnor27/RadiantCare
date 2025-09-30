
import { useEffect, useState, useRef } from 'react'
import type { IncomeMode } from '../../../shared/types'
import { HISTORICAL_COLORS, SITE_COLORS } from '../config/chartConfig'

interface ChartControlsProps {
  environment: 'production' | 'sandbox'
  setEnvironment: (env: 'production' | 'sandbox') => void
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
}

export default function ChartControls({
  environment,
  setEnvironment,
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
  setVisibleSites
}: ChartControlsProps) {
  
  // Clamp smoothing value when switching chart modes
  const maxSmoothing = chartMode === 'proportion' ? 36 : 10
  const clampedSmoothing = Math.min(smoothing, maxSmoothing)
  const isSidebar = variant === 'sidebar'
  
  // Historical data popup state
  const [isHistoricalPopupOpen, setIsHistoricalPopupOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const years = Array.from({ length: 9 }, (_, i) => 2024 - i) // 2024-2016 (reverse order)
  
  // Auto-clamp smoothing when chart mode changes
  useEffect(() => {
    if (smoothing > maxSmoothing) {
      setSmoothing(maxSmoothing)
    }
  }, [chartMode, smoothing, maxSmoothing, setSmoothing])
  
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
  const rangeEnd = 2024 // Fixed end at 2024 (always includes up to 2024)

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

  return (
    <div style={{ display: isSidebar ? 'block' : 'flex', alignItems: isSidebar ? undefined : 'center', justifyContent: isSidebar ? undefined : 'space-between', marginBottom: isSidebar ? 0 : 16 }}>
      <div style={{ display: isSidebar ? 'flex' : 'flex', flexDirection: isSidebar ? 'column' as const : 'row' as const, alignItems: isSidebar ? 'stretch' : 'center', gap: isSidebar ? 12 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Environment:</label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'production' | 'sandbox')}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', marginTop: 6 }}>Income Mode:</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ display: 'inline-flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
              <button
                onClick={() => setIncomeMode('total')}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  background: incomeMode === 'total' ? '#1e40af' : '#fff',
                  color: incomeMode === 'total' ? '#fff' : '#333',
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                Total
              </button>
              <button
                onClick={() => setIncomeMode('per-site')}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  background: incomeMode === 'per-site' ? '#1e40af' : '#fff',
                  color: incomeMode === 'per-site' ? '#fff' : '#333',
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                Per Site
              </button>
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

        {/* Historical Data Popup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Historical Data:</label>
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
                left: 110,
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

        {/* Combine options */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 , marginLeft: 38}}>
          <label style={{ fontSize: 14, fontWeight: 500, marginTop: 8, opacity: (chartMode === 'proportion' || selectedYears.length <= 1) ? 0.5 : 1 }}>Combine:</label>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Chart Type:</label>
          <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
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
              disabled={incomeMode === 'per-site'} // Only bar charts for per-site mode
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
                transition: 'all 0.2s',
                opacity: incomeMode === 'per-site' && chartMode !== 'bar' ? 0.5 : 1
              }}
            >
              Bar
            </button>
            <button
              onClick={() => setChartMode('proportion')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: chartMode === 'proportion' ? '#1e40af' : '#fff',
                color: chartMode === 'proportion' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Projection
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 85}}>
          <label style={{ fontSize: 14, fontWeight: 500, opacity: chartMode === 'bar' ? 0.5 : 1 }}>Smoothing:</label>
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
              cursor: chartMode === 'bar' ? 'not-allowed' : 'pointer',
              opacity: chartMode === 'bar' ? 0.5 : 1
            }}
          />
          <span style={{ fontSize: 11, color: '#666', minWidth: '20px', opacity: chartMode === 'bar' ? 0.5 : 1 }}>
            {chartMode === 'proportion' ? `${clampedSmoothing} month window` : `${clampedSmoothing}`}
          </span>
        </div>


        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Timeframe:</label>
          <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => setTimeframe('year')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'year' ? '#1e40af' : '#fff',
                color: timeframe === 'year' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Year
            </button>
            <button
              onClick={() => setTimeframe('quarter')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'quarter' ? '#1e40af' : '#fff',
                color: timeframe === 'quarter' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Quarter
            </button>
            <button
              onClick={() => setTimeframe('month')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: timeframe === 'month' ? '#1e40af' : '#fff',
                color: timeframe === 'month' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Month
            </button>
          </div>
        </div>

        {/* Monthly view mode toggle - only show for month timeframe and bar mode and individual mode */}
        {timeframe === 'month' && chartMode === 'bar' && !showCombined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={showAllMonths}
                onChange={(e) => setShowAllMonths(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show all 12 months
            </label>
          </div>
        )}

        {/* Normalize checkbox at bottom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isSidebar ? 12 : 0 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={isNormalized}
              onChange={(e) => setIsNormalized(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Normalize (% of year total)
          </label>
        </div>
      </div>
      {!isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Loading…</div>}
      {isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Loading…</div>}
    </div>
  )
}
