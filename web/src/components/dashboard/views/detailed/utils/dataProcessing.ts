import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import type { FutureYear } from '../../../shared/types'
import { getTotalIncome } from '../../../shared/calculations'

// Helper function to normalize data to percentage based on timeframe
export const normalizeData = (
  data: YTDPoint[],
  timeframe: 'year' | 'quarter' | 'month',
  currentPeriod?: { year: number, quarter?: number, month?: number },
  referenceTotal?: number
): YTDPoint[] => {
  if (data.length === 0) return data
  
  if (timeframe === 'year') {
    // Use provided reference total, or fall back to the final total of the year as 100%
    const finalReferenceTotal = referenceTotal ?? (data[data.length - 1]?.cumulativeIncome || 1)
    return data.map(point => ({
      ...point,
      cumulativeIncome: (point.cumulativeIncome / finalReferenceTotal) * 100
    }))
  } else if (timeframe === 'quarter' && currentPeriod?.quarter) {
    // For quarter mode: normalize so that the income within that quarter represents 0-100%
    const startMonth = (currentPeriod.quarter - 1) * 3 + 1
    const endMonth = startMonth + 2

    // Find the income at the start and end of the quarter
    const quarterData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month >= startMonth && month <= endMonth
    })

    if (quarterData.length === 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }

    // Find income at start of quarter (end of previous quarter)
    const preQuarterData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month < startMonth
    })
    const quarterStartIncome = preQuarterData.length > 0 ?
      Math.max(...preQuarterData.map(p => p.cumulativeIncome)) : 0

    // Find income at end of quarter
    const quarterEndIncome = Math.max(...quarterData.map(p => p.cumulativeIncome))
    const actualQuarterTotalIncome = quarterEndIncome - quarterStartIncome

    // Use projected reference if available, otherwise use actual quarter total
    // Note: referenceTotal for quarter should be the actual projected income for this quarter,
    // not annual/4 (which would be wrong if income isn't evenly distributed)
    const quarterReferenceTotal = referenceTotal || actualQuarterTotalIncome

    if (quarterReferenceTotal <= 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }

    // Normalize: (current - quarter_start) / quarter_reference_total * 100
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, ((point.cumulativeIncome - quarterStartIncome) / quarterReferenceTotal) * 100)
    }))
  } else if (timeframe === 'month' && currentPeriod?.month) {
    // For month mode: normalize so that the income within that month represents 0-100%
    const monthStr = currentPeriod.month.toString().padStart(2, '0')

    // Find the income at the start and end of the month
    const monthData = data.filter(point => point.monthDay.startsWith(monthStr))

    if (monthData.length === 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }

    // Find income at start of month (end of previous month)
    const preMonthData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month < currentPeriod.month!
    })
    const monthStartIncome = preMonthData.length > 0 ?
      Math.max(...preMonthData.map(p => p.cumulativeIncome)) : 0

    // Find income at end of month
    const monthEndIncome = Math.max(...monthData.map(p => p.cumulativeIncome))
    const actualMonthTotalIncome = monthEndIncome - monthStartIncome

    // Use projected reference if available, otherwise use actual month total
    // Note: referenceTotal for month should be the actual projected income for this month,
    // not annual/12 (which would be wrong if income isn't evenly distributed)
    const monthReferenceTotal = referenceTotal || actualMonthTotalIncome

    if (monthReferenceTotal <= 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }

    // Normalize: (current - month_start) / month_reference_total * 100
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, ((point.cumulativeIncome - monthStartIncome) / monthReferenceTotal) * 100)
    }))
  } else {
    // Fallback to year normalization
    const finalReferenceTotal = referenceTotal ?? (data[data.length - 1]?.cumulativeIncome || 1)
    return data.map(point => ({
      ...point,
      cumulativeIncome: (point.cumulativeIncome / finalReferenceTotal) * 100
    }))
  }
}

// Helper function to convert cumulative data to period-specific data (starting from $0)
export const convertToPeriodData = (
  data: YTDPoint[], 
  timeframe: 'year' | 'quarter' | 'month', 
  currentPeriod?: { year: number, quarter?: number, month?: number }
): YTDPoint[] => {
  if (data.length === 0 || timeframe === 'year') return data
  
  if (timeframe === 'quarter' && currentPeriod?.quarter) {
    const startMonth = (currentPeriod.quarter - 1) * 3 + 1
    
    // Find income at start of quarter (end of previous quarter)
    const preQuarterData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month < startMonth
    })
    const quarterStartIncome = preQuarterData.length > 0 ? 
      Math.max(...preQuarterData.map(p => p.cumulativeIncome)) : 0
    
    // Convert all points to show income earned within the quarter (starting from $0)
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, point.cumulativeIncome - quarterStartIncome)
    }))
  } else if (timeframe === 'month' && currentPeriod?.month) {
    // Find income at start of month (end of previous month)
    const preMonthData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month < currentPeriod.month!
    })
    const monthStartIncome = preMonthData.length > 0 ? 
      Math.max(...preMonthData.map(p => p.cumulativeIncome)) : 0
    
    // Convert all points to show income earned within the month (starting from $0)
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, point.cumulativeIncome - monthStartIncome)
    }))
  }
  
  return data
}

// Helper function to filter data by quarter
export const filterDataByQuarter = (data: YTDPoint[], _year: number, quarter: number): YTDPoint[] => {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  
  return data.filter(point => {
    const [monthStr] = point.monthDay.split('-')
    const month = parseInt(monthStr, 10)
    return month >= startMonth && month <= endMonth
  })
}

// Helper function to filter data by month
export const filterDataByMonth = (data: YTDPoint[], _year: number, month: number): YTDPoint[] => {
  const monthStr = month.toString().padStart(2, '0')
  return data.filter(point => point.monthDay.startsWith(monthStr))
}

// Helper function to generate all days of the year (excluding Feb 29)
export const generateAllDaysOfYear = (): string[] => {
  const days: string[] = []
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // Feb has 28 (no leap days)
  
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      days.push(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return days
}

// Helper to generate all days for a specific quarter (1-4)
export const generateDaysForQuarter = (quarter: number): string[] => {
  const days: string[] = []
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  for (let month = startMonth; month <= endMonth; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      days.push(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return days
}

// Helper to generate all days for a specific month (1-12)
export const generateDaysForMonth = (month: number): string[] => {
  const days: string[] = []
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  for (let day = 1; day <= daysInMonth[month - 1]; day++) {
    days.push(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return days
}

// Sort and align all data to complete year timeline
export const sortDataChronologically = (data: YTDPoint[]) => {
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

// Helper function to get current date info
export const getCurrentDateInfo = () => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
    month: now.getMonth() + 1
  }
}

// Generate projected income data from the last actual data point to Dec 31
export const generateProjectedIncomeData = (
  actualData: YTDPoint[], 
  fy2025: FutureYear | undefined
): YTDPoint[] => {
  if (!actualData.length || !fy2025) return []

  // Get the last actual data point
  const lastActualPoint = actualData[actualData.length - 1]
  if (!lastActualPoint) return []

  // Get total projected income using the store's calculation method
  const totalProjectedIncome = getTotalIncome(fy2025)

  // Parse the last actual date to get month and day
  const [lastMonth, lastDay] = lastActualPoint.monthDay.split('-').map(Number)
  
  // Start the projected data with the last actual point for seamless connection
  const projectedPoints: YTDPoint[] = [lastActualPoint]
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  
  // Calculate total days from day after last actual point to end of year for interpolation
  let totalDaysToEnd = 0
  let tempMonth = lastMonth
  const tempDay = lastDay + 1 // Count days after last actual data
  
  while (tempMonth <= 12) {
    const maxDay = daysInMonth[tempMonth - 1]
    if (tempMonth === lastMonth) {
      // For the current month, count from tempDay to end of month
      totalDaysToEnd += maxDay - tempDay + 1
    } else {
      // For subsequent months, count all days
      totalDaysToEnd += maxDay
    }
    tempMonth++
  }

  if (totalDaysToEnd <= 0) return projectedPoints // Already at or past Dec 31, just return the connection point

  // Calculate daily increment for linear interpolation
  const incomeGap = totalProjectedIncome - lastActualPoint.cumulativeIncome
  const dailyIncrement = incomeGap / totalDaysToEnd

  // Generate interpolated points starting from the day after last actual data
  let currentCumulative = lastActualPoint.cumulativeIncome
  let month = lastMonth
  let day = lastDay + 1

  while (month <= 12) {
    const maxDay = daysInMonth[month - 1]
    
    if (day > maxDay) {
      month++
      day = 1
      continue
    }

    currentCumulative += dailyIncrement

    const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    projectedPoints.push({
      date: `2025-${monthDay}`,
      monthDay,
      cumulativeIncome: currentCumulative
    })

    day++
  }

  return projectedPoints
}
