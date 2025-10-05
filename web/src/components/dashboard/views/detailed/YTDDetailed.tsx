import { useEffect, useMemo, useState } from 'react'
import { 
  parseTherapyIncome2025,
  type YTDPoint 
} from '../../../../historical_data/therapyIncomeParser'
import { getCurrentDateInfo } from './utils/dataProcessing'
import type { IncomeMode } from '../../shared/types'

// Import modular components
import ChartControls from './components/ChartControls'
import YearlyDataGrid from './components/YearlyDataGrid'
import DetailedChart from './components/DetailedChart'
import PartnerCompensation from './components/PartnerCompensation'
import SyncButton from './components/SyncButton'

// Import dashboard store and physicians editor
import { useDashboardStore } from '../../../Dashboard'
import PhysiciansEditor from '../../shared/components/PhysiciansEditor'
import { DEFAULT_LOCUM_COSTS_2025 } from '../../shared/defaults'

export default function YTDDetailed() {
  const store = useDashboardStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [environment] = useState<'production' | 'sandbox'>('production')
  const [cachedData, setCachedData] = useState<{ daily?: any, summary?: any, equity?: any } | null>(null)
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
  const [smoothingByMode, setSmoothingByMode] = useState<{
    line: number,
    bar: number,
    proportion: number
  }>({
    line: 10,
    bar: 0, // Bar charts don't use smoothing
    proportion: 12 // Default for proportion mode
  })
  const [selectedYears, setSelectedYears] = useState<number[]>(Array.from({ length: 9 }, (_, i) => 2016 + i)) // Default: all years (2016-2024)
  const [visibleSites, setVisibleSites] = useState<{ lacey: boolean, centralia: boolean, aberdeen: boolean }>({ lacey: true, centralia: true, aberdeen: true })
  const [colorScheme, setColorScheme] = useState<'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'>('gray')
  const [siteColorScheme, setSiteColorScheme] = useState<'rgb' | 'radiantCare' | 'jama'>('rgb')

  // Helper functions for mode-specific smoothing
  const getCurrentSmoothing = () => smoothingByMode[chartMode]
  const setCurrentSmoothing = (value: number) => {
    setSmoothingByMode(prev => ({ ...prev, [chartMode]: value }))
  }

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
    setLoading(true)
    setError(null)

    if (environment === 'sandbox') {
      // Sandbox mode: use historical JSON files
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
    } else {
      // Production mode: try to load cached data, fall back to historical
      fetch('/api/qbo/cached-2025')
        .then(res => {
          if (!res.ok) {
            // No cached data, use fallback
            console.log('No cached data available, using historical JSON fallback')
            setData(historical2025Data)
            setCachedData(null)
            setLoading(false)
            return
          }
          return res.json()
        })
        .then(cache => {
          if (cache?.daily) {
            // Parse the cached daily report
            const points = parseTherapyIncome2025(cache.daily)
            setData(points)
            // Store all cached data for other components
            setCachedData({ daily: cache.daily, summary: cache.summary, equity: cache.equity })
          } else {
            // Fallback to historical
            setData(historical2025Data)
            setCachedData(null)
          }
          setLoading(false)
        })
        .catch(err => {
          console.error('Error loading cached data, using fallback:', err)
          setData(historical2025Data)
          setCachedData(null)
          setLoading(false)
        })
    }
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


  return (
    <div style={{ margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <SyncButton environment={environment} />
      </div>
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        marginBottom: 24
      }}>
        <div style={{ flex: 1 }}>
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
              fy2025={fy2025}
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
            loading={loading}
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
        <PartnerCompensation
          environment={environment}
          cachedSummary={cachedData?.summary}
          cachedEquity={cachedData?.equity}
        />
      </div>
      <div style={{ width: '900px', margin: '0 auto', marginBottom: 24 }}>
        <PhysiciansEditor
          year={2025}
          scenario="A"
          readOnly={false}
          locumCosts={currentLocumCosts}
          onLocumCostsChange={(value) => store.setFutureValue('A', 2025, 'locumCosts', value)}
        />
      </div>
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <YearlyDataGrid
          environment={environment}
          cachedSummary={cachedData?.summary}
        />
      </div>
    </div>
  )
}
