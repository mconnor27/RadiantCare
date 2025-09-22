import { useEffect, useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { useIsMobile } from './hooks'
import { 
  parseTherapyIncome2025,
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
} from '../../historical_data/therapyIncomeParser'

// Configuration constants
const HISTORICAL_YEAR_LINE_WIDTH = 1.5

// Helper function to normalize data to percentage of final total
const normalizeData = (data: YTDPoint[]): YTDPoint[] => {
  if (data.length === 0) return data
  
  const finalTotal = data[data.length - 1]?.cumulativeIncome || 1 // Avoid division by zero
  return data.map(point => ({
    ...point,
    cumulativeIncome: (point.cumulativeIncome / finalTotal) * 100
  }))
}

// Helper function to generate all days of the year (excluding Feb 29)
const generateAllDaysOfYear = (): string[] => {
  const days: string[] = []
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // Feb has 28 (no leap days)
  
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      days.push(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return days
}

// Helper function to calculate combined statistics (mean and std dev) across all years
const calculateCombinedStats = (allYearData: YTDPoint[][]): { 
  mean: YTDPoint[], 
  upperBound: YTDPoint[], 
  lowerBound: YTDPoint[] 
} => {
  if (allYearData.length === 0) return { mean: [], upperBound: [], lowerBound: [] }
  
  // Create a map of monthDay -> values across all years
  const dayValueMap = new Map<string, number[]>()
  
  // Collect all values for each day across all years
  allYearData.forEach(yearData => {
    yearData.forEach(point => {
      if (!dayValueMap.has(point.monthDay)) {
        dayValueMap.set(point.monthDay, [])
      }
      dayValueMap.get(point.monthDay)!.push(point.cumulativeIncome)
    })
  })
  
  // Fill in missing days with interpolated values for each year
  const allDays = generateAllDaysOfYear()
  allYearData.forEach(yearData => {
    if (yearData.length === 0) return
    
    allDays.forEach(monthDay => {
      if (!dayValueMap.has(monthDay)) {
        dayValueMap.set(monthDay, [])
      }
      
      // If this day doesn't exist in this year's data, interpolate from surrounding days
      const existingPoint = yearData.find(p => p.monthDay === monthDay)
      if (!existingPoint) {
        // Find the closest existing points before and after
        const dayIndex = allDays.indexOf(monthDay)
        let beforeValue = 0
        let afterValue = yearData[yearData.length - 1]?.cumulativeIncome || 0
        
        // Look backwards for the last known value
        for (let i = dayIndex - 1; i >= 0; i--) {
          const beforePoint = yearData.find(p => p.monthDay === allDays[i])
          if (beforePoint) {
            beforeValue = beforePoint.cumulativeIncome
            break
          }
        }
        
        // Look forwards for the next known value
        for (let i = dayIndex + 1; i < allDays.length; i++) {
          const afterPoint = yearData.find(p => p.monthDay === allDays[i])
          if (afterPoint) {
            afterValue = afterPoint.cumulativeIncome
            break
          }
        }
        
        // Use linear interpolation or the last known value
        const interpolatedValue = beforeValue === afterValue ? beforeValue : 
          (beforeValue + afterValue) / 2
        
        dayValueMap.get(monthDay)!.push(interpolatedValue)
      }
    })
  })
  
  // Calculate mean and std dev for each day
  const mean: YTDPoint[] = []
  const upperBound: YTDPoint[] = []
  const lowerBound: YTDPoint[] = []
  
  // Use all days of the year in chronological order
  const sortedDays = generateAllDaysOfYear()
  
  sortedDays.forEach(monthDay => {
    const values = dayValueMap.get(monthDay)!
    const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length
    
    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    mean.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: meanValue
    })
    
    // Use 95% confidence interval (±1.96 * stdDev) for more visible variation
    const confidence95 = 1.96 * stdDev
    
    upperBound.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: meanValue + confidence95
    })
    
    lowerBound.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: Math.max(0, meanValue - confidence95) // Don't go below 0
    })
  })
  
  return { mean, upperBound, lowerBound }
}

// Helper function to extract month name from month-day string
const getMonthName = (monthDay: string): string => {
  const month = monthDay.substring(0, 2)
  const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = monthNames.indexOf(month)
  return monthIndex >= 0 ? monthLabels[monthIndex] : month
}

// Helper function to calculate actual monthly income (not cumulative)
const getMonthlyTotals = (data: YTDPoint[]): { month: string, income: number }[] => {
  const monthEndValues = new Map<string, number>()
  
  // First, find the end-of-month cumulative totals
  data.forEach(point => {
    const monthName = getMonthName(point.monthDay)
    const currentTotal = monthEndValues.get(monthName) || 0
    monthEndValues.set(monthName, Math.max(currentTotal, point.cumulativeIncome || 0))
  })
  
  // Convert to array and sort by month order
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const sortedMonths = Array.from(monthEndValues.entries())
    .map(([month, cumulativeIncome]) => ({ month, cumulativeIncome }))
    .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month))
  
  // Calculate actual monthly income (difference from previous month)
  const monthlyIncome: { month: string, income: number }[] = []
  let previousCumulative = 0
  
  sortedMonths.forEach(({ month, cumulativeIncome }) => {
    const monthlyIncomeAmount = cumulativeIncome - previousCumulative
    monthlyIncome.push({ month, income: monthlyIncomeAmount })
    previousCumulative = cumulativeIncome
  })
  
  return monthlyIncome
}

// Helper function to calculate combined monthly statistics across all years
const calculateCombinedMonthlyStats = (allYearData: YTDPoint[][]): {
  mean: { month: string, income: number, error: number }[],
  monthlyData: Map<string, number[]>
} => {
  const monthlyData = new Map<string, number[]>()
  
  // Collect all monthly totals for each year
  allYearData.forEach((yearData) => {
    const monthlyTotals = getMonthlyTotals(yearData)
    
    monthlyTotals.forEach(({ month, income }) => {
      if (!monthlyData.has(month)) {
        monthlyData.set(month, [])
      }
      monthlyData.get(month)!.push(income)
    })
  })
  
  // Calculate mean and standard deviation for each month
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mean = Array.from(monthlyData.entries())
    .map(([month, values]) => {
      const meanIncome = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)
      const error = stdDev // Standard deviation
      
      return {
        month,
        income: meanIncome,
        error
      }
    })
    .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month))
  
  return { mean, monthlyData }
}

// Helper function to get current date info
const getCurrentDateInfo = () => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
    month: now.getMonth() + 1
  }
}

// Helper function to filter data by quarter
const filterDataByQuarter = (data: YTDPoint[], _year: number, quarter: number): YTDPoint[] => {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  
  return data.filter(point => {
    const [monthStr] = point.monthDay.split('-')
    const month = parseInt(monthStr, 10)
    return month >= startMonth && month <= endMonth
  })
}

// Helper function to filter data by month
const filterDataByMonth = (data: YTDPoint[], _year: number, month: number): YTDPoint[] => {
  const monthStr = month.toString().padStart(2, '0')
  return data.filter(point => point.monthDay.startsWith(monthStr))
}

// Helper function to get quarter totals from yearly data
const getQuarterlyTotals = (data: YTDPoint[]): { quarter: string, income: number }[] => {
  const quarterEndValues = new Map<number, number>()
  
  data.forEach(point => {
    const [monthStr] = point.monthDay.split('-')
    const month = parseInt(monthStr, 10)
    const quarter = Math.floor((month - 1) / 3) + 1
    
    const currentTotal = quarterEndValues.get(quarter) || 0
    quarterEndValues.set(quarter, Math.max(currentTotal, point.cumulativeIncome || 0))
  })
  
  // Convert to quarterly income (difference from previous quarter)
  const quarterlyIncome: { quarter: string, income: number }[] = []
  let previousCumulative = 0
  
  for (let q = 1; q <= 4; q++) {
    const cumulativeIncome = quarterEndValues.get(q) || previousCumulative
    const quarterlyIncomeAmount = cumulativeIncome - previousCumulative
    quarterlyIncome.push({ quarter: `Q${q}`, income: quarterlyIncomeAmount })
    previousCumulative = cumulativeIncome
  }
  
  return quarterlyIncome
}

// Helper function to calculate combined quarterly statistics across all years
const calculateCombinedQuarterlyStats = (allYearData: YTDPoint[][]): {
  mean: { quarter: string, income: number, error: number }[],
  quarterlyData: Map<string, number[]>
} => {
  const quarterlyData = new Map<string, number[]>()
  
  // Collect all quarterly totals for each year
  allYearData.forEach((yearData) => {
    const quarterlyTotals = getQuarterlyTotals(yearData)
    
    quarterlyTotals.forEach(({ quarter, income }) => {
      if (!quarterlyData.has(quarter)) {
        quarterlyData.set(quarter, [])
      }
      quarterlyData.get(quarter)!.push(income)
    })
  })
  
  // Calculate mean and standard deviation for each quarter
  const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4']
  const mean = quarterOrder.map(quarter => {
    const values = quarterlyData.get(quarter) || []
    if (values.length === 0) return { quarter, income: 0, error: 0 }
    
    const meanIncome = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    return {
      quarter,
      income: meanIncome,
      error: stdDev
    }
  })
  
  return { mean, quarterlyData }
}

// Helper function to get yearly totals for bar chart
const getYearlyTotals = (allYearDataWithLabels: { year: string, data: YTDPoint[] }[]): { year: string, income: number }[] => {
  return allYearDataWithLabels.map(({ year, data }) => {
    const finalTotal = data.length > 0 ? data[data.length - 1]?.cumulativeIncome || 0 : 0
    return { year, income: finalTotal }
  })
}

export default function YTDDetailed() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<YTDPoint[]>([])
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production')
  const [isNormalized, setIsNormalized] = useState(false)
  const [showCombined, setShowCombined] = useState(false)
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line')
  const [timeframe, setTimeframe] = useState<'year' | 'quarter' | 'month'>('year')
  const [currentPeriod, setCurrentPeriod] = useState<{ year: number, quarter?: number, month?: number }>({ year: new Date().getFullYear() })
  const [pulsePhase, setPulsePhase] = useState(0)
  const [is2025Visible, setIs2025Visible] = useState(true)
  
  // Parse historical data once on component mount
  const historical2025Data = useMemo(() => parseTherapyIncome2025(), [])
  const historical2024Data = useMemo(() => parseTherapyIncome2024(), [])
  const historical2023Data = useMemo(() => parseTherapyIncome2023(), [])
  const historical2022Data = useMemo(() => parseTherapyIncome2022(), [])
  const historical2021Data = useMemo(() => parseTherapyIncome2021(), [])
  const historical2020Data = useMemo(() => parseTherapyIncome2020(), [])
  const historical2019Data = useMemo(() => parseTherapyIncome2019(), [])
  const historical2018Data = useMemo(() => parseTherapyIncome2018(), [])
  const historical2017Data = useMemo(() => parseTherapyIncome2017(), [])
  const historical2016Data = useMemo(() => parseTherapyIncome2016(), [])

  useEffect(() => {
    // Use 2025 historical data instead of API call
    setLoading(true)
    setError(null)
    
    // Simulate a brief loading delay to match the original UX
    const timer = setTimeout(() => {
      try {
        // Use the parsed 2025 data directly
        setData(historical2025Data)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load 2025 historical data')
      } finally {
        setLoading(false)
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [historical2025Data, environment]) // Keep environment dependency for UI consistency

  // Initialize current period based on timeframe
  useEffect(() => {
    const currentDate = getCurrentDateInfo()
    if (timeframe === 'year') {
      setCurrentPeriod({ year: currentDate.year })
    } else if (timeframe === 'quarter') {
      setCurrentPeriod({ year: currentDate.year, quarter: currentDate.quarter })
    } else if (timeframe === 'month') {
      setCurrentPeriod({ year: currentDate.year, month: currentDate.month })
    }
  }, [timeframe])

  // Animation for pulsing marker - only active in line mode
  useEffect(() => {
    if (chartMode !== 'line') return
    
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 60) // 60 frames for smooth animation
    }, 50) // Update every 50ms for smooth animation
    
    return () => clearInterval(interval)
  }, [chartMode]) // Only run when chartMode changes

  // Reset 2025 visibility when switching chart modes
  useEffect(() => {
    if (chartMode === 'bar') {
      setIs2025Visible(true) // Reset to visible when switching to bar mode
    }
  }, [chartMode])

  // Process data for month-day overlay with rolling averages and optional normalization
  const currentYearData = useMemo(() => {
    const filtered = data.filter(p => p.date !== 'Total')
    const smoothed = calculateRollingAverage(filtered)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [data, isNormalized])
  
  // Historical data smoothing
  const historical2024Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2024Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2024Data, isNormalized])
  
  const historical2023Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2023Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2023Data, isNormalized])
  
  const historical2022Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2022Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2022Data, isNormalized])
  
  const historical2021Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2021Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2021Data, isNormalized])
  
  const historical2020Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2020Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2020Data, isNormalized])
  
  const historical2019Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2019Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2019Data, isNormalized])
  
  const historical2018Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2018Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2018Data, isNormalized])
  
  const historical2017Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2017Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2017Data, isNormalized])
  
  const historical2016Smoothed = useMemo(() => {
    const smoothed = calculateRollingAverage(historical2016Data)
    return isNormalized ? normalizeData(smoothed) : smoothed
  }, [historical2016Data, isNormalized])

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
  
  // Sort and align all data to complete year timeline
  const sortDataChronologically = (data: YTDPoint[]) => {
    const allDays = generateAllDaysOfYear()
    const dataMap = new Map(data.map(point => [point.monthDay, point]))
    
    return allDays.map(monthDay => {
      const existing = dataMap.get(monthDay)
      if (existing) return existing
      
      // Find surrounding points for interpolation
      const dayIndex = allDays.indexOf(monthDay)
      let beforeValue = 0
      let afterValue = data[data.length - 1]?.cumulativeIncome || 0
      
      // Look backwards for the last known value
      for (let i = dayIndex - 1; i >= 0; i--) {
        const beforePoint = dataMap.get(allDays[i])
        if (beforePoint) {
          beforeValue = beforePoint.cumulativeIncome
          break
        }
      }
      
      // Look forwards for the next known value
      for (let i = dayIndex + 1; i < allDays.length; i++) {
        const afterPoint = dataMap.get(allDays[i])
        if (afterPoint) {
          afterValue = afterPoint.cumulativeIncome
          break
        }
      }
      
      // Use interpolated value
      const interpolatedValue = beforeValue === afterValue ? beforeValue : 
        (beforeValue + afterValue) / 2
      
      return {
        date: monthDay,
        monthDay,
        cumulativeIncome: interpolatedValue
      }
    })
  }

  // For current year (2025), don't interpolate - just use actual data points to avoid plateau
  const currentX = useMemo(() => processedCurrentData.map(p => p.monthDay), [processedCurrentData])
  const currentY = useMemo(() => processedCurrentData.map(p => p.cumulativeIncome), [processedCurrentData])

  // Calculate combined statistics for all historical years (excluding current 2025 data)
  const combinedStats = useMemo(() => {
    const allHistoricalData = processedHistoricalData
      .map(({ data }) => data)
      .filter(data => data.length > 0)
    
    return calculateCombinedStats(allHistoricalData)
  }, [processedHistoricalData])
  
  const combinedMeanX = useMemo(() => combinedStats.mean.map(p => p.monthDay), [combinedStats.mean])
  const combinedMeanY = useMemo(() => combinedStats.mean.map(p => p.cumulativeIncome), [combinedStats.mean])
  const combinedUpperY = useMemo(() => combinedStats.upperBound.map(p => p.cumulativeIncome), [combinedStats.upperBound])
  const combinedLowerY = useMemo(() => combinedStats.lowerBound.map(p => p.cumulativeIncome), [combinedStats.lowerBound])

  // Bar chart data processing based on timeframe
  const barChartData = useMemo(() => {
    if (timeframe === 'year') {
      // Year mode: each year is an x-axis tick
      const yearly2025 = [{ year: '2025', income: currentYearData.length > 0 ? currentYearData[currentYearData.length - 1]?.cumulativeIncome || 0 : 0 }]
      const yearlyHistorical = getYearlyTotals(processedHistoricalData)
      
      if (showCombined) {
        // For combined/bar mode: show mean with std dev
        const allYearIncomes = yearlyHistorical.map(y => y.income)
        const meanIncome = allYearIncomes.reduce((sum, val) => sum + val, 0) / allYearIncomes.length
        const variance = allYearIncomes.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / allYearIncomes.length
        const stdDev = Math.sqrt(variance)
        
        return {
          combined: [{ period: 'Historical Mean (2016-2024)', income: meanIncome, error: stdDev }],
          current: [{ period: '2025', income: yearly2025[0].income }],
          individual: yearlyHistorical.concat(yearly2025)
        }
      }
      
      return {
        combined: [],
        current: yearly2025,
        individual: yearlyHistorical.concat(yearly2025)
      }
    } else if (timeframe === 'quarter') {
      // Quarter mode
      const quarterly2025 = getQuarterlyTotals(processedCurrentData)
      const historicalData = processedHistoricalData.map(({ data }) => data).filter(data => data.length > 0)
      const combinedQuarterlyStats = calculateCombinedQuarterlyStats(historicalData)
      
      if (showCombined) {
        return {
          combined: combinedQuarterlyStats.mean,
          current: quarterly2025.map(q => ({ period: q.quarter, income: q.income })),
          individual: []
        }
      }
      
      // Non-combined: each year gets separate bars for each quarter
      const individualQuarterly = processedHistoricalData.map(({ year, data }) => ({
        year,
        quarters: getQuarterlyTotals(data)
      })).concat([{ year: '2025', quarters: quarterly2025 }])
      
      return {
        combined: [],
        current: [],
        individual: individualQuarterly
      }
    } else if (timeframe === 'month') {
      // Month mode
      const monthly2025 = getMonthlyTotals(processedCurrentData)
      const historicalData = processedHistoricalData.map(({ data }) => data).filter(data => data.length > 0)
      const combinedMonthlyStats = calculateCombinedMonthlyStats(historicalData)
      
      if (showCombined) {
        return {
          combined: combinedMonthlyStats.mean,
          current: monthly2025.map(m => ({ period: m.month, income: m.income })),
          individual: []
        }
      }
      
      // Non-combined: each year gets separate bars for each month
      const individualMonthly = processedHistoricalData.map(({ year, data }) => ({
        year,
        months: getMonthlyTotals(data)
      })).concat([{ year: '2025', months: monthly2025 }])
      
      return {
        combined: [],
        current: [],
        individual: individualMonthly
      }
    }
    
    return { combined: [], current: [], individual: [] }
  }, [timeframe, currentYearData, processedCurrentData, processedHistoricalData, showCombined, chartMode])

  // Create stable static traces (memoized separately from animated traces)
  const staticLineTraces = useMemo(() => {
    if (chartMode !== 'line') return []
    
    const traces = []
    
    // Combined statistics (when enabled)
    if (showCombined && combinedStats.mean.length > 0) {
      traces.push(
        // Standard deviation band (upper)
        {
          x: combinedMeanX,
          y: combinedUpperY,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: 'Mean + 95% CI',
          line: { color: 'rgba(0,0,0,0)' },
          showlegend: false,
          hoverinfo: 'skip' as const
        },
        // Standard deviation band (lower)
        {
          x: combinedMeanX,
          y: combinedLowerY,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: 'Mean - 95% CI',
          line: { color: 'rgba(0,0,0,0)' },
          fill: 'tonexty' as const,
          fillcolor: 'rgba(30,144,255,0.2)',
          showlegend: false,
          hoverinfo: 'skip' as const
        },
        // Mean line
        {
          x: combinedMeanX,
          y: combinedMeanY,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: 'Historical Mean (2016-2024)',
          line: { color: '#1e40af', width: 3 },
          hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
        }
      )
    }
    
    // Individual years (when not showing combined)
    if (!showCombined) {
      const colors = ['#e0f2fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#0288d1', '#003366', '#001122', '#000000']
      
      processedHistoricalData.forEach(({ year, data }, index) => {
        if (data.length > 0) {
          const sortedData = timeframe === 'year' ? sortDataChronologically(data) : data
          const xData = sortedData.map((p: YTDPoint) => p.monthDay)
          const yData = sortedData.map((p: YTDPoint) => p.cumulativeIncome)
          
        traces.push({
            x: xData,
            y: yData,
          type: 'scatter' as const,
          mode: 'lines' as const,
            name: `${year} Therapy Income (7-day avg)`,
            line: { color: colors[index % colors.length], width: HISTORICAL_YEAR_LINE_WIDTH },
          hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
        })
      }
      })
    }
    
    // Current Year Data (2025) - always show
    if (processedCurrentData.length > 0) {
      traces.push({
        x: currentX,
        y: currentY,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: '2025 Therapy Income (7-day avg)',
        line: { color: '#2e7d32', width: 4 },
        visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
        hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
      })
    }
    
    return traces
  }, [
    chartMode, showCombined, combinedStats, combinedMeanX, combinedMeanY, combinedUpperY, combinedLowerY,
    processedHistoricalData, processedCurrentData, currentX, currentY, isNormalized, is2025Visible, timeframe
  ])

  // Create animated pulsing traces (separate from static traces)
  const pulsingTraces = useMemo(() => {
    if (chartMode !== 'line' || processedCurrentData.length === 0 || !is2025Visible) return []
    
    const rings = []
    
    // Create 2 expanding rings with different phases
    for (let i = 0; i < 2; i++) {
      const phaseOffset = i * 30 // Stagger each ring by 30 frames (1.5 seconds)
      const ringPhase = (pulsePhase + phaseOffset) % 60
      const progress = ringPhase / 60 // 0 to 1
      
      // Each ring expands from small to large and fades out
      const size = 8 + progress * 25 // 8px to 26px
      const opacity = Math.max(0, 0.5 * (1 - progress)) // Fade out as it expands
      
      // Only show ring if it has meaningful opacity
      if (opacity > 0.01) {
        rings.push({
          x: [currentX[currentX.length - 1]],
          y: [currentY[currentY.length - 1]],
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: `Radar Ring ${i}`,
          marker: {
            color: `rgba(46, 125, 50, ${opacity})`,
            size: size,
            line: { color: `rgba(46, 125, 50, ${Math.min(opacity + 0.15, 0.6)})`, width: 1 }
          },
          showlegend: false,
          hoverinfo: 'skip' as const
        })
      }
    }
    
    // Add the solid center marker
    rings.push({
      x: [currentX[currentX.length - 1]],
      y: [currentY[currentY.length - 1]],
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Current Position',
      marker: {
        color: '#2e7d32',
        size: 8,
        line: { color: '#ffffff', width: 1 }
      },
      showlegend: false,
      hovertemplate: isNormalized ? 'Latest: %{x}<br>%{y:.1f}%<extra></extra>' : 'Latest: %{x}<br>$%{y:,}<extra></extra>'
    })
    
    return rings
  }, [chartMode, processedCurrentData, currentX, currentY, chartMode === 'line' ? pulsePhase : 0, isNormalized, is2025Visible])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
        </div>
        {loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Loading…</div>}
      </div>

      {/* Navigation controls for quarter and month line modes */}
      {chartMode === 'line' && (timeframe === 'quarter' || timeframe === 'month') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <button
            onClick={() => {
              if (timeframe === 'quarter') {
                const newQuarter = currentPeriod.quarter! - 1
                if (newQuarter >= 1) {
                  setCurrentPeriod({ ...currentPeriod, quarter: newQuarter })
                } else {
                  setCurrentPeriod({ year: currentPeriod.year - 1, quarter: 4 })
                }
              } else if (timeframe === 'month') {
                const newMonth = currentPeriod.month! - 1
                if (newMonth >= 1) {
                  setCurrentPeriod({ ...currentPeriod, month: newMonth })
                } else {
                  setCurrentPeriod({ year: currentPeriod.year - 1, month: 12 })
                }
              }
            }}
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
            {timeframe === 'quarter' && `${currentPeriod.year} Q${currentPeriod.quarter}`}
            {timeframe === 'month' && `${currentPeriod.year} ${new Date(0, currentPeriod.month! - 1).toLocaleString('default', { month: 'long' })}`}
          </div>

          <button
            onClick={() => {
              if (timeframe === 'quarter') {
                const newQuarter = currentPeriod.quarter! + 1
                if (newQuarter <= 4) {
                  setCurrentPeriod({ ...currentPeriod, quarter: newQuarter })
                } else {
                  setCurrentPeriod({ year: currentPeriod.year + 1, quarter: 1 })
                }
              } else if (timeframe === 'month') {
                const newMonth = currentPeriod.month! + 1
                if (newMonth <= 12) {
                  setCurrentPeriod({ ...currentPeriod, month: newMonth })
                } else {
                  setCurrentPeriod({ year: currentPeriod.year + 1, month: 1 })
                }
              }
            }}
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
      )}
      {error === 'not_connected' ? (
        <div>
          <div style={{ marginBottom: 8 }}>Connect your QuickBooks to load real YTD data.</div>
          <a href={`/api/qbo/connect?env=${environment}`} style={{ display: 'inline-block', border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', textDecoration: 'none' }}>Connect QuickBooks ({environment})</a>
        </div>
      ) : error ? (
        <div style={{ color: '#991b1b' }}>{error}</div>
      ) : data.length > 0 || historical2025Data.length > 0 || historical2024Data.length > 0 || historical2023Data.length > 0 || historical2022Data.length > 0 || historical2021Data.length > 0 || historical2020Data.length > 0 || historical2019Data.length > 0 || historical2018Data.length > 0 || historical2017Data.length > 0 || historical2016Data.length > 0 ? (
        <div>
          <Plot
            data={chartMode === 'line' ? [
              // Static line traces (memoized for stable legend interaction)
              ...staticLineTraces,
              // Animated pulsing traces (separate memoization for animation)
              ...pulsingTraces
            ] : showCombined ? [
              // BAR CHART DATA - Combined mode
              // Historical Mean with error bars
              ...(barChartData.combined.length > 0 ? [
                {
                  x: barChartData.combined.map((item: any) => item.period || item.month || item.quarter),
                  y: barChartData.combined.map((item: any) => item.income),
                  type: 'bar' as const,
                  name: 'Historical Mean (2016-2024)',
                  marker: { color: '#1e40af', opacity: 0.8 },
                  error_y: {
                    type: 'data' as const,
                    array: barChartData.combined.map((item: any) => item.error),
                    visible: true,
                    color: '#1e40af',
                    thickness: 2,
                    width: 3
                  },
                  hovertemplate: isNormalized ? '%{x}<br>Mean: %{y:.1f}%<br>±%{error_y.array:.1f}% (σ)<extra></extra>' : '%{x}<br>Mean: $%{y:,}<br>±$%{error_y.array:,} (σ)<extra></extra>'
                }
              ] : []),
              // Current Year Data (2025)
              ...(barChartData.current.length > 0 ? [{
                x: barChartData.current.map((item: any) => item.period),
                y: barChartData.current.map((item: any) => item.income),
                type: 'bar' as const,
                name: '2025',
                marker: { color: '#2e7d32', opacity: 0.9 },
                hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
              }] : [])
            ] : [
              // Non-combined bar chart - individual years
              ...(barChartData.individual.length > 0 && timeframe === 'year' ? 
                barChartData.individual.map((item: any, index: number) => {
                  const colors = ['#e0f2fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#0288d1', '#003366', '#001122', '#000000']
                  return {
                    x: [item.year],
                    y: [item.income],
                    type: 'bar' as const,
                    name: item.year,
                    marker: { color: item.year === '2025' ? '#2e7d32' : colors[index % colors.length], opacity: 0.8 },
                    hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
                  }
                }) : []
              ),
              // For quarter and month non-combined, create separate bars for each year
              ...(barChartData.individual.length > 0 && timeframe !== 'year' ?
                barChartData.individual.flatMap((yearData: any, yearIndex: number) => {
                  const colors = ['#e0f2fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#0288d1', '#003366', '#001122', '#000000']
                  const periods = timeframe === 'quarter' ? yearData.quarters : yearData.months
                  return periods.map((period: any) => ({
                    x: [period.quarter || period.month],
                    y: [period.income],
                    type: 'bar' as const,
                    name: `${yearData.year} - ${period.quarter || period.month}`,
                    marker: { 
                      color: yearData.year === '2025' ? '#2e7d32' : colors[yearIndex % colors.length], 
                      opacity: 0.8 
                    },
                    hovertemplate: isNormalized ? `${yearData.year} %{x}<br>%{y:.1f}%<extra></extra>` : `${yearData.year} %{x}<br>$%{y:,}<extra></extra>`
                  }))
                }) : []
              )
            ]}
            layout={{
              title: { 
                text: chartMode === 'line' 
                  ? (isNormalized 
                    ? `Daily Accumulated Income (${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Comparison - Normalized %)`
                    : `Daily Accumulated Income (${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Comparison)`)
                  : (isNormalized
                    ? `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts: Historical Mean ± σ (Normalized %)`
                    : `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts: Historical Mean ± σ`),
                font: { weight: 700 } 
              },
              dragmode: false as any,
              margin: { 
                l: 60, 
                r: chartMode === 'line' && processedCurrentData.length > 0 && is2025Visible ? 60 : 20, // Extra right margin for radar animation
                t: 60, 
                b: 40 
              },
              yaxis: (() => {
                const baseConfig = {
                tickprefix: isNormalized ? '' : '$',
                ticksuffix: isNormalized ? '%' : '',
                separatethousands: !isNormalized,
                tickformat: isNormalized ? '.1f' : ',.0f',
                  rangemode: 'tozero' as const,
                automargin: true,
                }

                // Add buffer for radar animation when in line mode with 2025 data visible
                // Max radar size is 33px (8px base + 25px growth)
                if (chartMode === 'line' && processedCurrentData.length > 0 && is2025Visible) {
                  // Calculate the data range to add appropriate buffer
                  const allYValues = [
                    ...staticLineTraces.flatMap(trace => trace.y || []),
                    ...currentY
                  ].filter(y => typeof y === 'number') as number[]
                  
                  if (allYValues.length > 0) {
                    const maxY = Math.max(...allYValues)
                    const minY = Math.min(...allYValues)
                    const dataRange = maxY - minY
                    
                    // Add 5% buffer on top to account for radar animation
                    const buffer = dataRange * 0.05
                    
                    return {
                      ...baseConfig,
                      autorange: false,
                      range: [Math.max(0, minY - buffer * 0.1), maxY + buffer]
                    }
                  }
                }

                return {
                  ...baseConfig,
                  autorange: true
                }
              })(),
              xaxis: (() => {
                const baseConfig = {
                  title: { text: chartMode === 'line' ? 'Date' : (timeframe.charAt(0).toUpperCase() + timeframe.slice(1)) },
                  type: 'category' as const,
                tickangle: -45,
                  tickmode: chartMode === 'line' ? 'array' as const : 'auto' as const,
                ...(chartMode === 'line' ? {
                  tickvals: ['01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01', '09-01', '10-01', '11-01', '12-01', '12-31'],
                  ticktext: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Dec 31']
                } : {})
                }

                // Fix x-axis range to prevent shrinking during radar animation
                if (chartMode === 'line' && processedCurrentData.length > 0 && is2025Visible) {
                  // Get all x-values from traces to determine the full range
                  const allXValues = [
                    ...staticLineTraces.flatMap(trace => trace.x || []),
                    ...currentX
                  ].filter(x => x !== undefined)
                  
                  if (allXValues.length > 0) {
                    // For categorical axis, we need to set the range as indices
                    // Find the min and max indices, then add some padding
                    const uniqueXValues = [...new Set(allXValues)].sort()
                    const minIndex = 0
                    const maxIndex = uniqueXValues.length - 1
                    
                    return {
                      ...baseConfig,
                      automargin: true,
                      autorange: false,
                      // Set fixed range with some padding on the right for radar animation
                      range: [minIndex - 0.5, maxIndex + 0.5] // Add 0.5 padding on each side
                    }
                  }
                }

                return {
                  ...baseConfig,
                  automargin: true
                }
              })(),
              showlegend: true,
              legend: {
                x: 0,
                y: 1,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#ccc',
                borderwidth: 1
              }
            }}
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
            style={{ width: '100%', height: isMobile ? 360 : 500             }}
          />
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
          No data available for the selected time period.
        </div>
      )}
    </div>
  )
}


