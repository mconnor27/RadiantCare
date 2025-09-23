import { useEffect, useMemo, useState } from 'react'
import { 
  parseTherapyIncome2025,
  type YTDPoint 
} from '../../../../historical_data/therapyIncomeParser'
import { getCurrentDateInfo } from './utils/dataProcessing'

// Import modular components
import ChartControls from './components/ChartControls'
import NavigationControls from './components/NavigationControls'
import YearlyDataGrid from './components/YearlyDataGrid'
import DetailedChart from './components/DetailedChart'

export default function YTDDetailed() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production')
  const [isNormalized, setIsNormalized] = useState(false)
  const [showCombined, setShowCombined] = useState(false)
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>('year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>({ year: new Date().getFullYear() })
  const [is2025Visible, setIs2025Visible] = useState(true)
  const [showAllMonths, setShowAllMonths] = useState(true)
  
  // Parse 2025 data for loading into the chart component
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])

  useEffect(() => {
    // Use 2025 historical data instead of API call
    setLoading(true)
    setError(null)
    
    // Simulate a brief loading delay to match the original UX
    const timer = setTimeout(() => {
      try {
        setData(historical2025Data)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load 2025 historical data')
      } finally {
        setLoading(false)
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [historical2025Data, environment])

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

  // Reset 2025 visibility when switching chart modes
  useEffect(() => {
    if (chartMode === 'bar') {
      setIs2025Visible(true)
    }
  }, [chartMode])


  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <ChartControls
        environment={environment}
        setEnvironment={setEnvironment}
        isNormalized={isNormalized}
        setIsNormalized={setIsNormalized}
        showCombined={showCombined}
        setShowCombined={setShowCombined}
        chartMode={chartMode}
        setChartMode={setChartMode}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        showAllMonths={showAllMonths}
        setShowAllMonths={setShowAllMonths}
        loading={loading}
      />

      <NavigationControls
        chartMode={chartMode}
        timeframe={timeframe}
        showCombined={showCombined}
        showAllMonths={showAllMonths}
        currentPeriod={currentPeriod}
        setCurrentPeriod={setCurrentPeriod}
      />

      <YearlyDataGrid />

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
          chartMode={chartMode}
          timeframe={timeframe}
          currentPeriod={currentPeriod}
          is2025Visible={is2025Visible}
          setIs2025Visible={setIs2025Visible}
          showAllMonths={showAllMonths}
        />
      )}
    </div>
  )
}
