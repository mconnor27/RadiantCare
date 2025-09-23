import { useEffect, useMemo, useState } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
const Plot = createPlotlyComponent(Plotly)
import { useIsMobile } from '../../../shared/hooks'
import { 
  parseTherapyIncome2024, 
  parseTherapyIncome2023, 
  parseTherapyIncome2022, 
  parseTherapyIncome2021,
  parseTherapyIncome2020,
  parseTherapyIncome2019,
  parseTherapyIncome2018,
  parseTherapyIncome2017,
  parseTherapyIncome2016,
  calculateRollingAverage, 
  type YTDPoint 
} from '../../../../../historical_data/therapyIncomeParser'
import { 
  normalizeData, 
  convertToPeriodData, 
  filterDataByQuarter, 
  filterDataByMonth
} from '../utils/dataProcessing'
import { 
  calculateCombinedStats,
  generateDaysForQuarter,
  generateDaysForMonth 
} from '../utils/aggregations'
import { buildStaticLineTraces, buildPulsingTraces } from '../builders/lineChartBuilder'
import { buildBarChartData, buildBarChartTraces } from '../builders/barChartBuilder'
import { buildChartLayout } from '../builders/layoutBuilder'
import { RADAR_CONFIG, CHART_CONFIG } from '../config/chartConfig'

interface DetailedChartProps {
  data: YTDPoint[]
  isNormalized: boolean
  showCombined: boolean
  chartMode: 'line' | 'bar'
  timeframe: 'year' | 'quarter' | 'month'
  currentPeriod: { year: number, quarter?: number, month?: number }
  is2025Visible: boolean
  setIs2025Visible: (visible: boolean) => void
  showAllMonths: boolean
}

export default function DetailedChart({
  data,
  isNormalized,
  showCombined,
  chartMode,
  timeframe,
  currentPeriod,
  is2025Visible,
  setIs2025Visible,
  showAllMonths
}: DetailedChartProps) {
  const isMobile = useIsMobile()
  const [pulsePhase, setPulsePhase] = useState(0)
  
  // Parse historical data once on component mount
  const historical2024Data = useMemo(() => parseTherapyIncome2024(), [])
  const historical2023Data = useMemo(() => parseTherapyIncome2023(), [])
  const historical2022Data = useMemo(() => parseTherapyIncome2022(), [])
  const historical2021Data = useMemo(() => parseTherapyIncome2021(), [])
  const historical2020Data = useMemo(() => parseTherapyIncome2020(), [])
  const historical2019Data = useMemo(() => parseTherapyIncome2019(), [])
  const historical2018Data = useMemo(() => parseTherapyIncome2018(), [])
  const historical2017Data = useMemo(() => parseTherapyIncome2017(), [])
  const historical2016Data = useMemo(() => parseTherapyIncome2016(), [])

  // Animation for pulsing marker - only active in line mode
  useEffect(() => {
    if (chartMode !== 'line') return
    
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % RADAR_CONFIG.frameCount)
    }, RADAR_CONFIG.updateInterval)
    
    return () => clearInterval(interval)
  }, [chartMode])

  // Process data for month-day overlay with rolling averages and optional normalization
  const currentYearData = useMemo(() => {
    const filtered = data.filter(p => p.date !== 'Total')
    const smoothed = calculateRollingAverage(filtered)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [data, isNormalized, timeframe, currentPeriod])
  
  // Historical data smoothing
  const historical2024Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2024Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2024Data, isNormalized, timeframe, currentPeriod])
  
  const historical2023Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2023Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2023Data, isNormalized, timeframe, currentPeriod])
  
  const historical2022Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2022Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2022Data, isNormalized, timeframe, currentPeriod])
  
  const historical2021Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2021Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2021Data, isNormalized, timeframe, currentPeriod])
  
  const historical2020Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2020Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2020Data, isNormalized, timeframe, currentPeriod])
  
  const historical2019Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2019Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2019Data, isNormalized, timeframe, currentPeriod])
  
  const historical2018Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2018Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2018Data, isNormalized, timeframe, currentPeriod])
  
  const historical2017Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2017Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2017Data, isNormalized, timeframe, currentPeriod])
  
  const historical2016Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2016Data)
    if (isNormalized) {
      return normalizeData(smoothed, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [historical2016Data, isNormalized, timeframe, currentPeriod])

  // Process data based on timeframe
  const processedCurrentData = useMemo(() => {
    if (timeframe === 'year') {
      return currentYearData
    } else if (timeframe === 'quarter' && currentPeriod.quarter) {
      return filterDataByQuarter(currentYearData, currentPeriod.year, currentPeriod.quarter)
    } else if (timeframe === 'month' && currentPeriod.month) {
      return filterDataByMonth(currentYearData, currentPeriod.year, currentPeriod.month)
    }
    return currentYearData
  }, [currentYearData, timeframe, currentPeriod])

  // Process historical data based on timeframe
  const processedHistoricalData = useMemo(() => {
    const allHistoricalData = [
      { year: '2016', data: historical2016Smoothed },
      { year: '2017', data: historical2017Smoothed },
      { year: '2018', data: historical2018Smoothed },
      { year: '2019', data: historical2019Smoothed },
      { year: '2020', data: historical2020Smoothed },
      { year: '2021', data: historical2021Smoothed },
      { year: '2022', data: historical2022Smoothed },
      { year: '2023', data: historical2023Smoothed },
      { year: '2024', data: historical2024Smoothed }
    ]

    if (timeframe === 'year') {
      return allHistoricalData
    } else if (timeframe === 'quarter' && currentPeriod.quarter) {
      return allHistoricalData.map(({ year, data }) => ({
        year,
        data: filterDataByQuarter(data, parseInt(year), currentPeriod.quarter!)
      }))
    } else if (timeframe === 'month' && currentPeriod.month) {
      return allHistoricalData.map(({ year, data }) => ({
        year,
        data: filterDataByMonth(data, parseInt(year), currentPeriod.month!)
      }))
    }
    return allHistoricalData
  }, [
    historical2016Smoothed, historical2017Smoothed, historical2018Smoothed,
    historical2019Smoothed, historical2020Smoothed, historical2021Smoothed,
    historical2022Smoothed, historical2023Smoothed, historical2024Smoothed,
    timeframe, currentPeriod
  ])

  // For current year (2025), don't interpolate - just use actual data points to avoid plateau
  const currentX = useMemo(() => processedCurrentData.map(p => p.monthDay), [processedCurrentData])
  const currentY = useMemo(() => processedCurrentData.map(p => p.cumulativeIncome), [processedCurrentData])

  // Calculate combined statistics for all historical years (excluding current 2025 data)
  const combinedStats = useMemo(() => {
    const allHistoricalData = processedHistoricalData
      .map(({ data }) => data)
      .filter(data => data.length > 0)
    
    const allowedDays = timeframe === 'year' ? undefined
      : timeframe === 'quarter' && currentPeriod.quarter ? generateDaysForQuarter(currentPeriod.quarter)
      : timeframe === 'month' && currentPeriod.month ? generateDaysForMonth(currentPeriod.month)
      : undefined

    return calculateCombinedStats(allHistoricalData, allowedDays)
  }, [processedHistoricalData, timeframe, currentPeriod])

  // Bar chart data processing based on timeframe
  const barChartData = useMemo(() => {
    return buildBarChartData({
      timeframe,
      currentYearData,
      processedHistoricalData,
      showCombined,
      data,
      historical2016Data,
      historical2017Data,
      historical2018Data,
      historical2019Data,
      historical2020Data,
      historical2021Data,
      historical2022Data,
      historical2023Data,
      historical2024Data,
      isNormalized
    })
  }, [timeframe, currentYearData, processedHistoricalData, showCombined, chartMode, data, historical2016Data, historical2017Data, historical2018Data, historical2019Data, historical2020Data, historical2021Data, historical2022Data, historical2023Data, historical2024Data, isNormalized, currentPeriod, showAllMonths])

  // Create stable static traces (memoized separately from animated traces)
  const staticLineTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    return buildStaticLineTraces({
      showCombined,
      combinedStats,
      processedHistoricalData,
      processedCurrentData,
      isNormalized,
      is2025Visible,
      timeframe
    })
  }, [
    chartMode, showCombined, combinedStats, processedHistoricalData, 
    processedCurrentData, isNormalized, is2025Visible, timeframe
  ])

  // Create animated pulsing traces (separate from static traces)
  const pulsingTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    return buildPulsingTraces(
      processedCurrentData,
      is2025Visible,
      pulsePhase,
      isNormalized
    )
  }, [chartMode, processedCurrentData, is2025Visible, chartMode === 'line' ? pulsePhase : 0, isNormalized])

  // Build chart layout
  const chartLayout = useMemo(() => {
    return buildChartLayout({
      chartMode,
      timeframe,
      showCombined,
      isNormalized,
      processedCurrentData,
      is2025Visible,
      staticLineTraces,
      currentX,
      currentY,
      currentPeriod
    })
  }, [
    chartMode, timeframe, showCombined, isNormalized, processedCurrentData,
    is2025Visible, staticLineTraces, currentX, currentY, currentPeriod
  ])

  // Check if we have any data to display
  const hasData = data.length > 0 || historical2024Data.length > 0 || historical2023Data.length > 0 || historical2022Data.length > 0 || historical2021Data.length > 0 || historical2020Data.length > 0 || historical2019Data.length > 0 || historical2018Data.length > 0 || historical2017Data.length > 0 || historical2016Data.length > 0

  if (!hasData) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
        No data available for the selected time period.
      </div>
    )
  }

  return (
    <div>
      <Plot
        data={chartMode === 'line' ? [
          // Static line traces (memoized for stable legend interaction)
          ...staticLineTraces,
          // Animated pulsing traces (separate memoization for animation)
          ...pulsingTraces
        ] : buildBarChartTraces(
          barChartData,
          timeframe,
          showCombined,
          isNormalized,
          showAllMonths,
          currentPeriod
        )}
        layout={chartLayout}
        config={{
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
          scrollZoom: false,
          doubleClick: false as any,
        }}
        onLegendClick={chartMode === 'line' ? (data) => {
          // Handle legend click to sync 2025 trace visibility with pulsing animation (line mode only)
          if (data.curveNumber !== undefined) {
            const clickedTrace = staticLineTraces[data.curveNumber]
            if (clickedTrace && clickedTrace.name === '2025 Therapy Income (7-day avg)') {
              setIs2025Visible(!is2025Visible)
              // Prevent Plotly default so both line and pulsing toggle together via state
              return false
            }
          }
          // Allow default behavior for all other traces in line mode
          return true
        } : undefined}
        useResizeHandler={true}
        style={{ width: '100%', height: isMobile ? CHART_CONFIG.mobile.height : CHART_CONFIG.desktop.height }}
      />
    </div>
  )
}
