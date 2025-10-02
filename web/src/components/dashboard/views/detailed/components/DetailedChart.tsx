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
  type YTDPoint 
} from '../../../../../historical_data/therapyIncomeParser'
import {
  normalizeData,
  convertToPeriodData,
  filterDataByQuarter,
  filterDataByMonth,
  generateProjectedIncomeData
  } from '../utils/dataProcessing'
import { getTotalIncome } from '../../../shared/calculations'
  import type { FutureYear } from '../../../shared/types'
import { 
  calculateCombinedStats,
  generateDaysForQuarter,
  generateDaysForMonth 
} from '../utils/aggregations'
import { buildStaticLineTraces, buildPulsingTraces } from '../builders/lineChartBuilder'
import { buildSiteLineTraces, buildSitePulsingTraces } from '../builders/siteLineChartBuilder'
import { buildBarChartData, buildBarChartTraces } from '../builders/barChartBuilder'
import { buildSiteBarChartData, buildSiteBarChartTraces } from '../builders/siteBarChartBuilder'
import { buildProportionData, buildProportionTraces, buildProportionLayout } from '../builders/proportionChartBuilder'
import { buildChartLayout } from '../builders/layoutBuilder'
import { RADAR_CONFIG, CHART_CONFIG } from '../config/chartConfig'
import type { IncomeMode } from '../../../shared/types'

interface DetailedChartProps {
  data: YTDPoint[]
  isNormalized: boolean
  showCombined: boolean
  combineStatistic: 'mean' | 'median' | null
  combineError: 'std' | 'ci' | null
  chartMode: 'line' | 'bar' | 'proportion'
  timeframe: 'year' | 'quarter' | 'month'
  currentPeriod: { year: number, quarter?: number, month?: number }
  is2025Visible: boolean
  setIs2025Visible: (visible: boolean) => void
  showAllMonths: boolean
  incomeMode: IncomeMode
  smoothing: number
  fy2025: FutureYear | undefined
  selectedYears: number[]
  visibleSites: { lacey: boolean, centralia: boolean, aberdeen: boolean }
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'
  siteColorScheme: 'rgb' | 'radiantCare' | 'jama'
}

export default function DetailedChart({
  data,
  isNormalized,
  showCombined,
  combineStatistic,
  combineError,
  chartMode,
  timeframe,
  currentPeriod,
  is2025Visible,
  setIs2025Visible,
  showAllMonths,
  incomeMode,
  smoothing,
  fy2025,
  selectedYears,
  visibleSites,
  colorScheme,
  siteColorScheme
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

  // Generate proportion data for proportion chart mode
  const proportionData = useMemo(() => {
    if (chartMode !== 'proportion') return []
    return buildProportionData(selectedYears)
  }, [chartMode, selectedYears])

  // Process data for month-day overlay with optional normalization
  const currentYearData = useMemo(() => {
    const filtered = data.filter(p => p.date !== 'Total')
    if (isNormalized) {
      // Use projected total income as 100% reference for current year normalization
      const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : undefined
      // For quarter/month, we need to calculate the actual projected income for that period
      let referenceForPeriod = projectedTotalIncome
      if (timeframe === 'quarter' && currentPeriod?.quarter && fy2025) {
        // Calculate what the combined data (actual + projected) would be for this quarter
        const combinedData = [...filtered, ...generateProjectedIncomeData(filtered, fy2025).slice(1)]
        const startMonth = (currentPeriod.quarter - 1) * 3 + 1
        const endMonth = startMonth + 2
        const combinedQuarterData = combinedData.filter(point => {
          const [monthStr] = point.monthDay.split('-')
          const month = parseInt(monthStr, 10)
          return month >= startMonth && month <= endMonth
        })
        if (combinedQuarterData.length > 0) {
          const combinedPreQuarterData = combinedData.filter(point => {
            const [monthStr] = point.monthDay.split('-')
            const month = parseInt(monthStr, 10)
            return month < startMonth
          })
          const combinedQuarterStartIncome = combinedPreQuarterData.length > 0 ?
            Math.max(...combinedPreQuarterData.map(p => p.cumulativeIncome)) : 0
          const combinedQuarterEndIncome = Math.max(...combinedQuarterData.map(p => p.cumulativeIncome))
          referenceForPeriod = combinedQuarterEndIncome - combinedQuarterStartIncome
        }
      } else if (timeframe === 'month' && currentPeriod?.month && fy2025) {
        // Calculate what the combined data (actual + projected) would be for this month
        const combinedData = [...filtered, ...generateProjectedIncomeData(filtered, fy2025).slice(1)]
        const monthStr = currentPeriod.month.toString().padStart(2, '0')
        const combinedMonthData = combinedData.filter(point => point.monthDay.startsWith(monthStr))
        
        if (combinedMonthData.length > 0) {
          const combinedPreMonthData = combinedData.filter(point => {
            const [monthStr] = point.monthDay.split('-')
            const month = parseInt(monthStr, 10)
            return month < currentPeriod.month!
          })
          const combinedMonthStartIncome = combinedPreMonthData.length > 0 ?
            Math.max(...combinedPreMonthData.map(p => p.cumulativeIncome)) : 0
          const combinedMonthEndIncome = Math.max(...combinedMonthData.map(p => p.cumulativeIncome))
          referenceForPeriod = combinedMonthEndIncome - combinedMonthStartIncome
        }
      }
      return normalizeData(filtered, timeframe, currentPeriod, referenceForPeriod)
    } else {
      return convertToPeriodData(filtered, timeframe, currentPeriod)
    }
  }, [data, isNormalized, timeframe, currentPeriod, fy2025])

  // Generate projected income data with the same baseline as actual data
  const projectedIncomeData = useMemo(() => {
    if (!fy2025 || currentYearData.length === 0) return []
    
    // Get the raw actual data
    const actualData = data.filter(p => p.date !== 'Total')

    // Generate projected data starting from the last actual point
    const rawProjectedData = generateProjectedIncomeData(actualData, fy2025)
    if (rawProjectedData.length === 0) return []
    
    // Process actual and projected data together to ensure same baseline
    const combinedData = [...actualData, ...rawProjectedData.slice(1)] // Skip duplicate connection point
    
    let processedCombinedData
    if (isNormalized) {
      // Use projected total income as 100% reference for consistency with actual data
      const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : undefined
      // For quarter/month, calculate the actual projected income for that period
      let referenceForPeriod = projectedTotalIncome
      if (timeframe === 'quarter' && currentPeriod?.quarter) {
        const startMonth = (currentPeriod.quarter - 1) * 3 + 1
        const endMonth = startMonth + 2
        const combinedQuarterData = combinedData.filter(point => {
          const [monthStr] = point.monthDay.split('-')
          const month = parseInt(monthStr, 10)
          return month >= startMonth && month <= endMonth
        })
        if (combinedQuarterData.length > 0) {
          const combinedPreQuarterData = combinedData.filter(point => {
            const [monthStr] = point.monthDay.split('-')
            const month = parseInt(monthStr, 10)
            return month < startMonth
          })
          const combinedQuarterStartIncome = combinedPreQuarterData.length > 0 ?
            Math.max(...combinedPreQuarterData.map(p => p.cumulativeIncome)) : 0
          const combinedQuarterEndIncome = Math.max(...combinedQuarterData.map(p => p.cumulativeIncome))
          referenceForPeriod = combinedQuarterEndIncome - combinedQuarterStartIncome
        }
      } else if (timeframe === 'month' && currentPeriod?.month) {
        const monthStr = currentPeriod.month.toString().padStart(2, '0')
        const combinedMonthData = combinedData.filter(point => point.monthDay.startsWith(monthStr))
        
        if (combinedMonthData.length > 0) {
          const combinedPreMonthData = combinedData.filter(point => {
            const [monthStr] = point.monthDay.split('-')
            const month = parseInt(monthStr, 10)
            return month < currentPeriod.month!
          })
          const combinedMonthStartIncome = combinedPreMonthData.length > 0 ?
            Math.max(...combinedPreMonthData.map(p => p.cumulativeIncome)) : 0
          const combinedMonthEndIncome = Math.max(...combinedMonthData.map(p => p.cumulativeIncome))
          referenceForPeriod = combinedMonthEndIncome - combinedMonthStartIncome
        }
      }
      processedCombinedData = normalizeData(combinedData, timeframe, currentPeriod, referenceForPeriod)
    } else {
      processedCombinedData = convertToPeriodData(combinedData, timeframe, currentPeriod)
    }
    
    // Extract the projected portion (everything after the actual data)
    const projectedStartIndex = actualData.length - 1 // Include connection point
    let processedProjectedData = processedCombinedData.slice(projectedStartIndex)
    
    // Apply timeframe filtering to show only relevant portion (used by line charts)
    if (timeframe === 'quarter' && currentPeriod.quarter) {
      processedProjectedData = filterDataByQuarter(processedProjectedData, currentPeriod.year, currentPeriod.quarter)
    } else if (timeframe === 'month' && currentPeriod.month) {
      processedProjectedData = filterDataByMonth(processedProjectedData, currentPeriod.year, currentPeriod.month)
    }
    
    return processedProjectedData
  }, [fy2025, currentYearData, data, isNormalized, timeframe, currentPeriod])
  
  // Separate projected dataset for BAR charts: full-year, unfiltered and unnormalized totals
  // This ensures quarter/month bar modes include all 4 quarters / 12 months of projections
  const projectedIncomeDataForBars = useMemo(() => {
    if (!fy2025 || currentYearData.length === 0) return []

    const actualData = data.filter(p => p.date !== 'Total')
    const rawProjectedData = generateProjectedIncomeData(actualData, fy2025)
    if (rawProjectedData.length === 0) return []

    // Build a full-year combined series (actual + projected) without filtering
    // This lets bar aggregations compute totals for all quarters/months
    const combinedData = [...actualData, ...rawProjectedData.slice(1)]
    return convertToPeriodData(combinedData, 'year', currentPeriod)
  }, [fy2025, currentYearData, data, currentPeriod])

  // Historical data smoothing
  const historical2024Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2024Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2024Data, timeframe, currentPeriod)
    }
  }, [historical2024Data, isNormalized, timeframe, currentPeriod])

  const historical2023Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2023Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2023Data, timeframe, currentPeriod)
    }
  }, [historical2023Data, isNormalized, timeframe, currentPeriod])

  const historical2022Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2022Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2022Data, timeframe, currentPeriod)
    }
  }, [historical2022Data, isNormalized, timeframe, currentPeriod])

  const historical2021Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2021Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2021Data, timeframe, currentPeriod)
    }
  }, [historical2021Data, isNormalized, timeframe, currentPeriod])

  const historical2020Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2020Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2020Data, timeframe, currentPeriod)
    }
  }, [historical2020Data, isNormalized, timeframe, currentPeriod])

  const historical2019Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2019Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2019Data, timeframe, currentPeriod)
    }
  }, [historical2019Data, isNormalized, timeframe, currentPeriod])
  
  const historical2018Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2018Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2018Data, timeframe, currentPeriod)
    }
  }, [historical2018Data, isNormalized, timeframe, currentPeriod])

  const historical2017Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2017Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2017Data, timeframe, currentPeriod)
    }
  }, [historical2017Data, isNormalized, timeframe, currentPeriod])

  const historical2016Smoothed = useMemo(() => {
    if (isNormalized) {
      return normalizeData(historical2016Data, timeframe, currentPeriod)
    } else {
      return convertToPeriodData(historical2016Data, timeframe, currentPeriod)
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

    // Filter by selected years
    const filteredHistoricalData = allHistoricalData.filter(({ year }) => 
      selectedYears.includes(parseInt(year))
    )

    if (timeframe === 'year') {
      return filteredHistoricalData
    } else if (timeframe === 'quarter' && currentPeriod.quarter) {
      return filteredHistoricalData.map(({ year, data }) => ({
        year,
        data: filterDataByQuarter(data, parseInt(year), currentPeriod.quarter!)
      }))
    } else if (timeframe === 'month' && currentPeriod.month) {
      return filteredHistoricalData.map(({ year, data }) => ({
        year,
        data: filterDataByMonth(data, parseInt(year), currentPeriod.month!)
      }))
    }
    return filteredHistoricalData
  }, [
    historical2016Smoothed, historical2017Smoothed, historical2018Smoothed,
    historical2019Smoothed, historical2020Smoothed, historical2021Smoothed,
    historical2022Smoothed, historical2023Smoothed, historical2024Smoothed,
    timeframe, currentPeriod, selectedYears
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

    return calculateCombinedStats(
      allHistoricalData, 
      allowedDays,
      combineStatistic ?? 'mean',
      combineError ?? 'std'
    )
  }, [processedHistoricalData, timeframe, currentPeriod, combineStatistic, combineError])

  // Bar chart data processing based on timeframe
  const barChartData = useMemo(() => {
    return buildBarChartData({
      timeframe,
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
      isNormalized,
      projectedIncomeData: projectedIncomeDataForBars,
      combineStatistic: combineStatistic,
      combineError: combineError
    })
  }, [timeframe, processedHistoricalData, showCombined, chartMode, data, historical2016Data, historical2017Data, historical2018Data, historical2019Data, historical2020Data, historical2021Data, historical2022Data, historical2023Data, historical2024Data, isNormalized, currentPeriod, showAllMonths, projectedIncomeDataForBars, combineStatistic, combineError, selectedYears])


  // Site-specific bar chart data processing
  const siteBarChartData = useMemo(() => {
    if (incomeMode !== 'per-site') return null
    
    return buildSiteBarChartData({
      timeframe,
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
      projectedIncomeData: projectedIncomeDataForBars,
      fy2025,
      combineStatistic: combineStatistic,
      combineError: combineError,
      selectedYears: selectedYears,
      colorScheme
    })
  }, [incomeMode, timeframe, currentYearData, processedHistoricalData, showCombined, data, historical2016Data, historical2017Data, historical2018Data, historical2019Data, historical2020Data, historical2021Data, historical2022Data, historical2023Data, historical2024Data, isNormalized, projectedIncomeDataForBars, fy2025, combineStatistic, combineError, selectedYears, colorScheme])

  // Create stable static traces (memoized separately from animated traces)
  const staticLineTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    if (incomeMode === 'per-site') {
      // Use site-specific line traces
      return buildSiteLineTraces({
        showCombined,
        processedHistoricalData,
        isNormalized,
        is2025Visible,
        timeframe,
        currentPeriod,
        fy2025,
        combineStatistic: combineStatistic,
        combineError: combineError,
        visibleSites,
        selectedYears,
        colorScheme,
        siteColorScheme
      })
    } else {
      // Use total income line traces
      return buildStaticLineTraces({
        showCombined,
        combinedStats,
        processedHistoricalData,
        processedCurrentData,
        projectedIncomeData,
        isNormalized,
        is2025Visible,
        timeframe,
        smoothing,
        combineStatistic,
        combineError,
        selectedYears,
        colorScheme
      })
    }
  }, [
    chartMode, incomeMode, showCombined, combinedStats, processedHistoricalData,
    processedCurrentData, projectedIncomeData, isNormalized, is2025Visible, timeframe, currentPeriod, fy2025, smoothing,
    combineStatistic, combineError, visibleSites, selectedYears, colorScheme, siteColorScheme
  ])

  // Create animated pulsing traces (separate from static traces)
  const pulsingTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    if (incomeMode === 'per-site') {
      // Use site-specific pulsing traces
      return buildSitePulsingTraces(
        is2025Visible,
        pulsePhase,
        isNormalized,
        timeframe,
        currentPeriod,
        fy2025,
        visibleSites,
        colorScheme,
        siteColorScheme
      )
    } else {
      // Use total income pulsing traces
      return buildPulsingTraces(
        processedCurrentData,
        is2025Visible,
        pulsePhase,
        isNormalized,
        colorScheme
      )
    }
  }, [chartMode, incomeMode, processedCurrentData, is2025Visible, chartMode === 'line' ? pulsePhase : 0, isNormalized, timeframe, currentPeriod, fy2025, visibleSites, colorScheme, siteColorScheme])

  // Build chart layout
  const chartLayout = useMemo(() => {
    if (chartMode === 'proportion') {
      // Proportion charts use their own layout
      return null // Will be handled separately in render
    }
    
    return buildChartLayout({
      chartMode: chartMode as 'line' | 'bar',
      timeframe,
      showCombined,
      isNormalized,
      processedCurrentData,
      is2025Visible,
      staticLineTraces,
      currentX,
      currentY,
      currentPeriod,
      incomeMode,
      selectedYears,
      combineStatistic,
      combineError,
      visibleSites
    })
  }, [
    chartMode, timeframe, showCombined, isNormalized, processedCurrentData,
    is2025Visible, staticLineTraces, currentX, currentY, currentPeriod, incomeMode, selectedYears,
    combineStatistic, combineError, visibleSites
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
        data={(chartMode === 'line' ? [
          // Static line traces (memoized for stable legend interaction)
          ...staticLineTraces,
          // Animated pulsing traces (separate memoization for animation)
          ...pulsingTraces
        ] : chartMode === 'proportion'
          ? buildProportionTraces(proportionData, smoothing, visibleSites, colorScheme, siteColorScheme)
          : incomeMode === 'per-site'
            ? buildSiteBarChartTraces(
                siteBarChartData,
                timeframe,
                showCombined,
                isNormalized,
                combineStatistic,
                combineError,
                visibleSites,
                showAllMonths,
                currentPeriod,
                colorScheme,
                siteColorScheme
              )
            : buildBarChartTraces(
                barChartData,
                timeframe,
                showCombined,
                isNormalized,
                showAllMonths,
                currentPeriod,
                combineStatistic,
                combineError,
                colorScheme
              )) as any}
        layout={chartMode === 'proportion' ? buildProportionLayout(isMobile, selectedYears, proportionData, visibleSites, smoothing, siteColorScheme) : (chartLayout || {}) as any}
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
            if (clickedTrace && clickedTrace.name === '2025 Therapy Income') {
              setIs2025Visible(!is2025Visible)
              // Prevent Plotly default so both line and pulsing toggle together via state
              return false
            }
          }
          // Allow default behavior for all other traces in line mode
          return true
        } : chartMode === 'proportion' ? undefined : undefined}
        useResizeHandler={true}
        style={{ width: '100%', height: isMobile ? CHART_CONFIG.mobile.height : CHART_CONFIG.desktop.height }}
      />
    </div>
  )
}
