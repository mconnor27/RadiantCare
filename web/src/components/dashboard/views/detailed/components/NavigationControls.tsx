
interface NavigationControlsProps {
  chartMode: 'line' | 'bar' | 'proportion'
  timeframe: 'year' | 'quarter' | 'month'
  showCombined: boolean
  showAllMonths: boolean
  currentPeriod: { year: number, quarter?: number, month?: number }
  setCurrentPeriod: (period: { year: number, quarter?: number, month?: number }) => void
}

export default function NavigationControls({
  chartMode,
  timeframe,
  showCombined,
  showAllMonths,
  currentPeriod,
  setCurrentPeriod
}: NavigationControlsProps) {
  // Only show navigation controls for quarter and month line modes, or month bar mode when not showing all months
  // Proportion charts don't need navigation controls as they show all historical data
  const shouldShowControls = chartMode !== 'proportion' && (
    (chartMode === 'line' && (timeframe === 'quarter' || timeframe === 'month')) || 
    (chartMode === 'bar' && timeframe === 'month' && !showCombined && !showAllMonths)
  )

  if (!shouldShowControls) {
    return null
  }

  const handlePrevious = () => {
    if (timeframe === 'quarter') {
      const newQuarter = currentPeriod.quarter! - 1
      if (newQuarter >= 1) {
        setCurrentPeriod({ ...currentPeriod, quarter: newQuarter })
      } else {
        setCurrentPeriod({ ...currentPeriod, quarter: 4 })
      }
    } else if (timeframe === 'month') {
      const newMonth = currentPeriod.month! - 1
      if (newMonth >= 1) {
        setCurrentPeriod({ ...currentPeriod, month: newMonth })
      } else {
        setCurrentPeriod({ ...currentPeriod, month: 12 })
      }
    }
  }

  const handleNext = () => {
    if (timeframe === 'quarter') {
      const newQuarter = currentPeriod.quarter! + 1
      if (newQuarter <= 4) {
        setCurrentPeriod({ ...currentPeriod, quarter: newQuarter })
      } else {
        setCurrentPeriod({ ...currentPeriod, quarter: 1 })
      }
    } else if (timeframe === 'month') {
      const newMonth = currentPeriod.month! + 1
      if (newMonth <= 12) {
        setCurrentPeriod({ ...currentPeriod, month: newMonth })
      } else {
        setCurrentPeriod({ ...currentPeriod, month: 1 })
      }
    }
  }

  const getCurrentPeriodLabel = () => {
    if (timeframe === 'quarter') {
      return `Q${currentPeriod.quarter}`
    } else if (timeframe === 'month') {
      return `${new Date(0, currentPeriod.month! - 1).toLocaleString('default', { month: 'long' })}`
    }
    return ''
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
      <button
        onClick={handlePrevious}
        style={{
          padding: '8px 12px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 14
        }}
      >
        ← Previous
      </button>

      <div style={{ fontSize: 16, fontWeight: 500, minWidth: 120, textAlign: 'center' }}>
        {getCurrentPeriodLabel()}
      </div>

      <button
        onClick={handleNext}
        style={{
          padding: '8px 12px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 14
        }}
      >
        Next →
      </button>
    </div>
  )
}
