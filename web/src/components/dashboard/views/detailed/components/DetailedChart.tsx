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
import { buildBarChartData, buildBarChartTraces } from '../builders/barChartBuilder'
import { buildSiteBarChartData, buildSiteBarChartTraces } from '../builders/siteBarChartBuilder'
import { buildChartLayout } from '../builders/layoutBuilder'
import { RADAR_CONFIG, CHART_CONFIG } from '../config/chartConfig'
import type { IncomeMode } from '../../../shared/types'

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
  incomeMode: IncomeMode
  fy2025: FutureYear | undefined
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
  showAllMonths,
  incomeMode,
  fy2025
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
      // Use projected total income as 100% reference for current year normalization
      const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : undefined
      // For quarter/month, we need to calculate the actual projected income for that period
      let referenceForPeriod = projectedTotalIncome
      if (timeframe === 'quarter' && currentPeriod?.quarter && fy2025) {
        // Calculate what the combined data (actual + projected) would be for this quarter
        const combinedData = [...smoothed, ...generateProjectedIncomeData(smoothed, fy2025).slice(1)]
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
        const combinedData = [...smoothed, ...generateProjectedIncomeData(smoothed, fy2025).slice(1)]
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
      return normalizeData(smoothed, timeframe, currentPeriod, referenceForPeriod)
    } else {
      return convertToPeriodData(smoothed, timeframe, currentPeriod)
    }
  }, [data, isNormalized, timeframe, currentPeriod, fy2025])

  // DEBUG: Add debug info
  const debugInfo = useMemo(() => {
    if (!isNormalized || !fy2025) return null

    const projectedTotalIncome = getTotalIncome(fy2025)
    const filtered = data.filter(p => p.date !== 'Total')
    const smoothed = calculateRollingAverage(filtered)
    const lastSmoothedPoint = smoothed[smoothed.length - 1]

    const combinedData = [...smoothed, ...generateProjectedIncomeData(smoothed, fy2025).slice(1)]
    const lastCombinedPoint = combinedData[combinedData.length - 1]

    // Calculate quarter-specific values for Q3
    let quarterProjectedTotal = projectedTotalIncome
    let actualQuarterTotalIncome = 0
    let combinedQuarterTotalIncome = 0

    if (timeframe === 'quarter' && currentPeriod?.quarter) {
      const startMonth = (currentPeriod.quarter - 1) * 3 + 1
      const endMonth = startMonth + 2

      // Calculate actual quarter total from smoothed data
      const quarterData = smoothed.filter(point => {
        const [monthStr] = point.monthDay.split('-')
        const month = parseInt(monthStr, 10)
        return month >= startMonth && month <= endMonth
      })

      if (quarterData.length > 0) {
        const preQuarterData = smoothed.filter(point => {
          const [monthStr] = point.monthDay.split('-')
          const month = parseInt(monthStr, 10)
          return month < startMonth
        })
        const quarterStartIncome = preQuarterData.length > 0 ?
          Math.max(...preQuarterData.map(p => p.cumulativeIncome)) : 0
        const quarterEndIncome = Math.max(...quarterData.map(p => p.cumulativeIncome))
        actualQuarterTotalIncome = quarterEndIncome - quarterStartIncome
      }

      // Calculate combined quarter total (this includes projected data)
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
        combinedQuarterTotalIncome = combinedQuarterEndIncome - combinedQuarterStartIncome
      }

      // Use the combined quarter total as the reference (this is the actual projected income for this quarter)
      quarterProjectedTotal = combinedQuarterTotalIncome
    } else if (timeframe === 'month' && currentPeriod?.month) {
      // Calculate actual month total from smoothed data
      const monthStr = currentPeriod.month.toString().padStart(2, '0')
      const monthData = smoothed.filter(point => point.monthDay.startsWith(monthStr))

      if (monthData.length > 0) {
        const preMonthData = smoothed.filter(point => {
          const [monthStr] = point.monthDay.split('-')
          const month = parseInt(monthStr, 10)
          return month < currentPeriod.month!
        })
        const monthStartIncome = preMonthData.length > 0 ?
          Math.max(...preMonthData.map(p => p.cumulativeIncome)) : 0
        const monthEndIncome = Math.max(...monthData.map(p => p.cumulativeIncome))
        actualQuarterTotalIncome = monthEndIncome - monthStartIncome // Reuse variable for month
      }

      // Calculate combined month total (this includes projected data)
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
        combinedQuarterTotalIncome = combinedMonthEndIncome - combinedMonthStartIncome // Reuse variable for month
      }

      // Use the combined month total as the reference (this is the actual projected income for this month)
      quarterProjectedTotal = combinedQuarterTotalIncome // Reuse variable for month
    }

    // Get normalized values at connection point
    // For quarter/month mode, use the quarter/month projected total as reference
    const quarterOrMonthReference = timeframe === 'quarter' ? quarterProjectedTotal : 
                                   timeframe === 'month' ? quarterProjectedTotal : // quarterProjectedTotal is reused for month
                                   projectedTotalIncome
    const normalizedActual = normalizeData(smoothed, timeframe, currentPeriod, quarterOrMonthReference)
    const normalizedCombined = normalizeData(combinedData, timeframe, currentPeriod, quarterOrMonthReference)
    const connectionPointIndex = smoothed.length - 1
    const actualAtConnection = normalizedActual[connectionPointIndex]
    const combinedAtConnection = normalizedCombined[connectionPointIndex]

    // Get values at quarter end
    let actualAtQuarterEnd = 0
    let combinedAtQuarterEnd = 0

    if (timeframe === 'quarter' && currentPeriod?.quarter) {
      // Find the last point in Q3 for both datasets
      const startMonth = (currentPeriod.quarter - 1) * 3 + 1
      const endMonth = startMonth + 2

      // Find the last index in Q3 (manual implementation since findLastIndex not available)
      let actualQuarterEndIndex = -1
      for (let i = normalizedActual.length - 1; i >= 0; i--) {
        const [monthStr] = normalizedActual[i].monthDay.split('-')
        const month = parseInt(monthStr, 10)
        if (month >= startMonth && month <= endMonth) {
          actualQuarterEndIndex = i
          break
        }
      }

      let combinedQuarterEndIndex = -1
      for (let i = normalizedCombined.length - 1; i >= 0; i--) {
        const [monthStr] = normalizedCombined[i].monthDay.split('-')
        const month = parseInt(monthStr, 10)
        if (month >= startMonth && month <= endMonth) {
          combinedQuarterEndIndex = i
          break
        }
      }

      if (actualQuarterEndIndex >= 0) {
        actualAtQuarterEnd = normalizedActual[actualQuarterEndIndex]?.cumulativeIncome || 0
      }
      if (combinedQuarterEndIndex >= 0) {
        combinedAtQuarterEnd = normalizedCombined[combinedQuarterEndIndex]?.cumulativeIncome || 0
      }
    } else if (timeframe === 'month' && currentPeriod?.month) {
      // Find the last point in the month for both datasets
      const monthStr = currentPeriod.month.toString().padStart(2, '0')

      // Find the last index in the month
      let actualMonthEndIndex = -1
      for (let i = normalizedActual.length - 1; i >= 0; i--) {
        if (normalizedActual[i].monthDay.startsWith(monthStr)) {
          actualMonthEndIndex = i
          break
        }
      }

      let combinedMonthEndIndex = -1
      for (let i = normalizedCombined.length - 1; i >= 0; i--) {
        if (normalizedCombined[i].monthDay.startsWith(monthStr)) {
          combinedMonthEndIndex = i
          break
        }
      }

      if (actualMonthEndIndex >= 0) {
        actualAtQuarterEnd = normalizedActual[actualMonthEndIndex]?.cumulativeIncome || 0 // Reuse variable for month
      }
      if (combinedMonthEndIndex >= 0) {
        combinedAtQuarterEnd = normalizedCombined[combinedMonthEndIndex]?.cumulativeIncome || 0 // Reuse variable for month
      }
    }

    return {
      projectedTotal: projectedTotalIncome,
      quarterProjectedTotal,
      actualQuarterTotalIncome,
      combinedQuarterTotalIncome,
      actualFinalRaw: lastSmoothedPoint?.cumulativeIncome || 0,
      combinedFinalRaw: lastCombinedPoint?.cumulativeIncome || 0,
      actualAtConnection: actualAtConnection?.cumulativeIncome || 0,
      combinedAtConnection: combinedAtConnection?.cumulativeIncome || 0,
      actualAtQuarterEnd,
      combinedAtQuarterEnd,
      timeframe,
      currentPeriod
    }
  }, [data, fy2025, isNormalized, timeframe, currentPeriod])

  // Generate projected income data with the same baseline as actual data
  const projectedIncomeData = useMemo(() => {
    if (!fy2025 || currentYearData.length === 0) return []
    
    // Get the raw actual data and smooth it (same as currentYearData processing)
    const actualData = data.filter(p => p.date !== 'Total')
    const smoothedActual = calculateRollingAverage(actualData)
    
    // Generate projected data starting from the last smoothed actual point
    const rawProjectedData = generateProjectedIncomeData(smoothedActual, fy2025)
    if (rawProjectedData.length === 0) return []
    
    // Process actual and projected data together to ensure same baseline
    const combinedData = [...smoothedActual, ...rawProjectedData.slice(1)] // Skip duplicate connection point
    
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
    const projectedStartIndex = smoothedActual.length - 1 // Include connection point
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
    const smoothedActual = calculateRollingAverage(actualData)
    const rawProjectedData = generateProjectedIncomeData(smoothedActual, fy2025)
    if (rawProjectedData.length === 0) return []

    // Build a full-year combined series (actual + projected) without filtering
    // This lets bar aggregations compute totals for all quarters/months
    const combinedData = [...smoothedActual, ...rawProjectedData.slice(1)]
    return convertToPeriodData(combinedData, 'year', currentPeriod)
  }, [fy2025, currentYearData, data, currentPeriod])

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
      isNormalized,
      projectedIncomeData: projectedIncomeDataForBars
    })
  }, [timeframe, currentYearData, processedHistoricalData, showCombined, chartMode, data, historical2016Data, historical2017Data, historical2018Data, historical2019Data, historical2020Data, historical2021Data, historical2022Data, historical2023Data, historical2024Data, isNormalized, currentPeriod, showAllMonths, projectedIncomeDataForBars])


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
      fy2025
    })
  }, [incomeMode, timeframe, currentYearData, processedHistoricalData, showCombined, data, historical2016Data, historical2017Data, historical2018Data, historical2019Data, historical2020Data, historical2021Data, historical2022Data, historical2023Data, historical2024Data, isNormalized, projectedIncomeDataForBars, fy2025])

  // Create stable static traces (memoized separately from animated traces)
  const staticLineTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    return buildStaticLineTraces({
      showCombined,
      combinedStats,
      processedHistoricalData,
      processedCurrentData,
      projectedIncomeData,
      isNormalized,
      is2025Visible,
      timeframe
    })
  }, [
    chartMode, showCombined, combinedStats, processedHistoricalData, 
    processedCurrentData, projectedIncomeData, isNormalized, is2025Visible, timeframe
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
      currentPeriod,
      incomeMode
    })
  }, [
    chartMode, timeframe, showCombined, isNormalized, processedCurrentData,
    is2025Visible, staticLineTraces, currentX, currentY, currentPeriod, incomeMode
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
        {/* DEBUG INFO */}
        {debugInfo && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 1000,
            fontFamily: 'monospace'
          }}>
            <div><strong>DEBUG - Fixed for both quarters and months:</strong></div>
            <div>Annual Projected Total: ${debugInfo.projectedTotal.toLocaleString()}</div>
            <div>Actual {debugInfo.timeframe === 'quarter' ? `Q${debugInfo.currentPeriod?.quarter}` : debugInfo.timeframe === 'month' ? `M${debugInfo.currentPeriod?.month}` : 'Period'} Total: ${debugInfo.actualQuarterTotalIncome.toLocaleString()}</div>
            <div>Combined {debugInfo.timeframe === 'quarter' ? `Q${debugInfo.currentPeriod?.quarter}` : debugInfo.timeframe === 'month' ? `M${debugInfo.currentPeriod?.month}` : 'Period'} Total: ${debugInfo.combinedQuarterTotalIncome.toLocaleString()}</div>
            <div>{debugInfo.timeframe === 'quarter' ? `Q${debugInfo.currentPeriod?.quarter}` : debugInfo.timeframe === 'month' ? `M${debugInfo.currentPeriod?.month}` : 'Period'} Reference (=Combined): ${debugInfo.quarterProjectedTotal.toLocaleString()}</div>
            <div>🔴 Actual at connection: {debugInfo.actualAtConnection.toFixed(2)}%</div>
            <div>🔵 Combined at connection: {debugInfo.combinedAtConnection.toFixed(2)}%</div>
            <div>🔴 Actual at {debugInfo.timeframe === 'quarter' ? `Q${debugInfo.currentPeriod?.quarter}` : debugInfo.timeframe === 'month' ? `M${debugInfo.currentPeriod?.month}` : 'period'} end: {debugInfo.actualAtQuarterEnd.toFixed(2)}%</div>
            <div>🔵 Combined at {debugInfo.timeframe === 'quarter' ? `Q${debugInfo.currentPeriod?.quarter}` : debugInfo.timeframe === 'month' ? `M${debugInfo.currentPeriod?.month}` : 'period'} end: {debugInfo.combinedAtQuarterEnd.toFixed(2)}% ← Should be 100%!</div>
            <div>Timeframe: {debugInfo.timeframe} {debugInfo.currentPeriod?.quarter ? `Q${debugInfo.currentPeriod.quarter}` : debugInfo.currentPeriod?.month ? `M${debugInfo.currentPeriod.month}` : ''}</div>
          </div>
        )}
        
      <Plot
        data={(chartMode === 'line' ? [
          // Static line traces (memoized for stable legend interaction)
          ...staticLineTraces,
          // Animated pulsing traces (separate memoization for animation)
          ...pulsingTraces
        ] : incomeMode === 'per-site' 
          ? buildSiteBarChartTraces(
              siteBarChartData,
              timeframe,
              showCombined,
              isNormalized
            )
          : buildBarChartTraces(
              barChartData,
              timeframe,
              showCombined,
              isNormalized,
              showAllMonths,
              currentPeriod
            )) as any}
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
