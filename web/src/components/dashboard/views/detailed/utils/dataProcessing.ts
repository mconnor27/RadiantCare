import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'

// Helper function to normalize data to percentage based on timeframe
export const normalizeData = (
  data: YTDPoint[], 
  timeframe: 'year' | 'quarter' | 'month', 
  currentPeriod?: { year: number, quarter?: number, month?: number }
): YTDPoint[] => {
  if (data.length === 0) return data
  
  if (timeframe === 'year') {
    // Use the final total of the year as 100%
    const referenceTotal = data[data.length - 1]?.cumulativeIncome || 1
    return data.map(point => ({
      ...point,
      cumulativeIncome: (point.cumulativeIncome / referenceTotal) * 100
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
    const quarterTotalIncome = quarterEndIncome - quarterStartIncome
    
    if (quarterTotalIncome <= 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }
    
    // Normalize: (current - quarter_start) / (quarter_end - quarter_start) * 100
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, ((point.cumulativeIncome - quarterStartIncome) / quarterTotalIncome) * 100)
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
    const monthTotalIncome = monthEndIncome - monthStartIncome
    
    if (monthTotalIncome <= 0) {
      return data.map(point => ({ ...point, cumulativeIncome: 0 }))
    }
    
    // Normalize: (current - month_start) / (month_end - month_start) * 100
    return data.map(point => ({
      ...point,
      cumulativeIncome: Math.max(0, ((point.cumulativeIncome - monthStartIncome) / monthTotalIncome) * 100)
    }))
  } else {
    // Fallback to year normalization
    const referenceTotal = data[data.length - 1]?.cumulativeIncome || 1
    return data.map(point => ({
      ...point,
      cumulativeIncome: (point.cumulativeIncome / referenceTotal) * 100
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
