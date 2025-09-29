
import { useEffect } from 'react'
import type { IncomeMode } from '../../../shared/types'

interface ChartControlsProps {
  environment: 'production' | 'sandbox'
  setEnvironment: (env: 'production' | 'sandbox') => void
  isNormalized: boolean
  setIsNormalized: (normalized: boolean) => void
  showCombined: boolean
  setShowCombined: (combined: boolean) => void
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
}

export default function ChartControls({
  environment,
  setEnvironment,
  isNormalized,
  setIsNormalized,
  showCombined,
  setShowCombined,
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
  variant = 'inline'
}: ChartControlsProps) {
  
  // Clamp smoothing value when switching chart modes
  const maxSmoothing = chartMode === 'proportion' ? 36 : 10
  const clampedSmoothing = Math.min(smoothing, maxSmoothing)
  const isSidebar = variant === 'sidebar'
  
  // Auto-clamp smoothing when chart mode changes
  useEffect(() => {
    if (smoothing > maxSmoothing) {
      setSmoothing(maxSmoothing)
    }
  }, [chartMode, smoothing, maxSmoothing, setSmoothing])

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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>
            <input 
              type="checkbox"
              checked={showCombined}
              onChange={(e) => setShowCombined(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            {chartMode === 'line' ? 'Show combined (mean ± 95% CI)' : 'Show combined (mean ± σ)'}
          </label>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Income Mode:</label>
          <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => setIncomeMode('total')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: incomeMode === 'total' ? '#1e40af' : '#fff',
                color: incomeMode === 'total' ? '#fff' : '#333',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s'
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
                transition: 'all 0.2s'
              }}
            >
              Per Site
            </button>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            style={{
              width: '80px',
              height: '20px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: 11, color: '#666', minWidth: '20px' }}>
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
      </div>
      {!isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Loading…</div>}
      {isSidebar && loading && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Loading…</div>}
    </div>
  )
}
