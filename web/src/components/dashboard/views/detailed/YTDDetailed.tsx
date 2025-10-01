import { useEffect, useMemo, useState } from 'react'
import { 
  parseTherapyIncome2025,
  type YTDPoint 
} from '../../../../historical_data/therapyIncomeParser'
import { getCurrentDateInfo } from './utils/dataProcessing'
import type { IncomeMode } from '../../shared/types'

// Import modular components
import ChartControls from './components/ChartControls'
import NavigationControls from './components/NavigationControls'
import YearlyDataGrid from './components/YearlyDataGrid'
import DetailedChart from './components/DetailedChart'
import PartnerCompensation from './components/PartnerCompensation'

// Import dashboard store and physicians editor
import { useDashboardStore } from '../../../Dashboard'
import PhysiciansEditor from '../../shared/components/PhysiciansEditor'
import { DEFAULT_LOCUM_COSTS_2025 } from '../../shared/defaults'

export default function YTDDetailed() {
  const store = useDashboardStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production')
  const [isNormalized, setIsNormalized] = useState(false)
  const [showCombined, setShowCombined] = useState(false)
  const [combineStatistic, setCombineStatistic] = useState<'mean' | 'median' | null>(null) // Off by default
  const [combineError, setCombineError] = useState<'std' | 'ci' | null>(null) // Off by default
  const [chartMode, setChartMode] = useState<'line' | 'bar' | 'proportion'>('line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>('year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>({ year: new Date().getFullYear() })
  const [is2025Visible, setIs2025Visible] = useState(true)
  const [showAllMonths, setShowAllMonths] = useState(true)
  const [incomeMode, setIncomeMode] = useState<IncomeMode>('total')
  const [smoothing, setSmoothing] = useState(10)
  const [selectedYears, setSelectedYears] = useState<number[]>(Array.from({ length: 9 }, (_, i) => 2016 + i)) // Default: all years (2016-2024)
  const [visibleSites, setVisibleSites] = useState<{ lacey: boolean, centralia: boolean, aberdeen: boolean }>({ lacey: true, centralia: true, aberdeen: true })
  
  // Parse 2025 data for loading into the chart component
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])

  // Get or create the 2025 future year entry for scenario A
  const fy2025 = store.scenarioA.future.find((f) => f.year === 2025)
  const currentLocumCosts = fy2025?.locumCosts ?? DEFAULT_LOCUM_COSTS_2025

  // Ensure 2025 entry exists in the store for PhysiciansEditor to work properly
  useEffect(() => {
    if (!fy2025) {
      store.ensureBaselineYear('A', 2025)
    }
  }, [store, fy2025])

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

  // Auto-adjust smoothing to maximum when switching chart modes
  useEffect(() => {
    if (chartMode === 'proportion') {
      // Calculate available months based on selected years
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
      const maxSmoothing = Math.min(36, totalMonths)
      setSmoothing(maxSmoothing)
    } else {
      setSmoothing(10)
    }
  }, [chartMode, selectedYears])


  // Reset 2025 visibility when switching chart modes
  useEffect(() => {
    if (chartMode === 'bar') {
      setIs2025Visible(true)
    }
  }, [chartMode])


  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <NavigationControls
            chartMode={chartMode}
            timeframe={timeframe}
            showCombined={showCombined}
            showAllMonths={showAllMonths}
            currentPeriod={currentPeriod}
            setCurrentPeriod={setCurrentPeriod}
          />

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
              is2025Visible={is2025Visible}
              setIs2025Visible={setIs2025Visible}
              showAllMonths={showAllMonths}
              incomeMode={incomeMode}
              smoothing={smoothing}
              fy2025={fy2025}
              selectedYears={selectedYears}
              visibleSites={visibleSites}
            />
          )}
        </div>
        <div style={{ width: 340, flexShrink: 0 }}>
          <ChartControls
            environment={environment}
            setEnvironment={setEnvironment}
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
            loading={loading}
            variant="sidebar"
            selectedYears={selectedYears}
            setSelectedYears={setSelectedYears}
            visibleSites={visibleSites}
            setVisibleSites={setVisibleSites}
          />
        </div>
      </div>

      <PartnerCompensation />

      <PhysiciansEditor
        year={2025}
        scenario="A"
        readOnly={false}
        locumCosts={currentLocumCosts}
        onLocumCostsChange={(value) => store.setFutureValue('A', 2025, 'locumCosts', value)}
      />

      <YearlyDataGrid />
    </div>
  )
}
