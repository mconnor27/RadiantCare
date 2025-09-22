
interface ChartControlsProps {
  environment: 'production' | 'sandbox'
  setEnvironment: (env: 'production' | 'sandbox') => void
  isNormalized: boolean
  setIsNormalized: (normalized: boolean) => void
  showCombined: boolean
  setShowCombined: (combined: boolean) => void
  chartMode: 'line' | 'bar'
  setChartMode: (mode: 'line' | 'bar') => void
  timeframe: 'year' | 'quarter' | 'month'
  setTimeframe: (timeframe: 'year' | 'quarter' | 'month') => void
  showAllMonths: boolean
  setShowAllMonths: (show: boolean) => void
  loading: boolean
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
  loading
}: ChartControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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
          </div>
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
      {loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Loading…</div>}
    </div>
  )
}
