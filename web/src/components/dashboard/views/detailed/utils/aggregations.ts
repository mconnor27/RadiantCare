import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import { generateAllDaysOfYear, generateDaysForQuarter, generateDaysForMonth } from './dataProcessing'

// Helper function to calculate median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Helper function to calculate combined statistics (mean/median and std dev/CI) across all years
export const calculateCombinedStats = (
  allYearData: YTDPoint[][], 
  allowedDays?: string[],
  statistic: 'mean' | 'median' | null = 'mean',
  errorType: 'std' | 'ci' | null = 'ci'
): { 
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
      if (allowedDays && !allowedDays.includes(point.monthDay)) return
      if (!dayValueMap.has(point.monthDay)) {
        dayValueMap.set(point.monthDay, [])
      }
      dayValueMap.get(point.monthDay)!.push(point.cumulativeIncome)
    })
  })
  
  // Fill in missing days with interpolated values for each year
  const allDays = allowedDays && allowedDays.length > 0 ? allowedDays : generateAllDaysOfYear()
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
  const sortedDays = allDays
  
  sortedDays.forEach(monthDay => {
    const values = dayValueMap.get(monthDay)!
    
    // Calculate center statistic (mean or median), default to mean if null
    const centerValue = statistic === 'median' 
      ? calculateMedian(values)
      : values.reduce((sum, val) => sum + val, 0) / values.length
    
    // Calculate standard deviation (needed for both std and CI)
    const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    mean.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: centerValue
    })
    
    // Calculate error bounds based on type (if errorType is not null)
    const errorMargin = errorType === 'ci'
      ? 1.96 * stdDev  // 95% confidence interval
      : errorType === 'std'
      ? stdDev         // Standard deviation
      : 0              // No error if null
    
    upperBound.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: centerValue + errorMargin
    })
    
    lowerBound.push({
      date: monthDay,
      monthDay,
      cumulativeIncome: Math.max(0, centerValue - errorMargin) // Don't go below 0
    })
  })
  
  return { mean, upperBound, lowerBound }
}

// Helper function to extract month name from month-day string
export const getMonthName = (monthDay: string): string => {
  const month = monthDay.substring(0, 2)
  const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = monthNames.indexOf(month)
  return monthIndex >= 0 ? monthLabels[monthIndex] : month
}

// Helper function to calculate actual monthly income (not cumulative)
export const getMonthlyTotals = (data: YTDPoint[]): { month: string, income: number }[] => {
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
export const calculateCombinedMonthlyStats = (
  allYearData: YTDPoint[][],
  statistic: 'mean' | 'median' | null = 'mean',
  errorType: 'std' | 'ci' | null = 'ci'
): {
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
  
  // Calculate center statistic and error for each month
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mean = Array.from(monthlyData.entries())
    .map(([month, values]) => {
      // Calculate center statistic (mean or median), default to mean if null
      const centerIncome = statistic === 'median'
        ? calculateMedian(values)
        : values.reduce((sum, val) => sum + val, 0) / values.length
      
      // Calculate standard deviation (needed for both std and CI)
      const meanIncome = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)
      
      // Calculate error based on type (if errorType is not null)
      const errorValue = errorType === 'ci'
        ? 1.96 * stdDev  // 95% confidence interval
        : errorType === 'std'
        ? stdDev         // Standard deviation
        : 0              // No error if null
      
      return {
        month,
        income: centerIncome,
        error: errorValue
      }
    })
    .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month))
  
  return { mean, monthlyData }
}

// Helper function to get quarter totals from yearly data
export const getQuarterlyTotals = (data: YTDPoint[]): { quarter: string, income: number }[] => {
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
export const calculateCombinedQuarterlyStats = (
  allYearData: YTDPoint[][],
  statistic: 'mean' | 'median' | null = 'mean',
  errorType: 'std' | 'ci' | null = 'ci'
): {
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
  
  // Calculate center statistic and error for each quarter
  const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4']
  const mean = quarterOrder.map(quarter => {
    const values = quarterlyData.get(quarter) || []
    if (values.length === 0) return { quarter, income: 0, error: 0 }
    
    // Calculate center statistic (mean or median), default to mean if null
    const centerIncome = statistic === 'median'
      ? calculateMedian(values)
      : values.reduce((sum, val) => sum + val, 0) / values.length
    
    // Calculate standard deviation (needed for both std and CI)
    const meanIncome = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    // Calculate error based on type (if errorType is not null)
    const errorValue = errorType === 'ci'
      ? 1.96 * stdDev  // 95% confidence interval
      : errorType === 'std'
      ? stdDev         // Standard deviation
      : 0              // No error if null
    
    return {
      quarter,
      income: centerIncome,
      error: errorValue
    }
  })
  
  return { mean, quarterlyData }
}

// Helper function to get yearly totals for bar chart
export const getYearlyTotals = (allYearDataWithLabels: { year: string, data: YTDPoint[] }[]): { year: string, income: number }[] => {
  return allYearDataWithLabels.map(({ year, data }) => {
    const finalTotal = data.length > 0 ? data[data.length - 1]?.cumulativeIncome || 0 : 0
    return { year, income: finalTotal }
  })
}

// Re-export the day generation functions
export { generateDaysForQuarter, generateDaysForMonth }
