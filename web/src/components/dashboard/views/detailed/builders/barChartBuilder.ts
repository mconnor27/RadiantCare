import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import { calculateRollingAverage } from '../../../../../historical_data/therapyIncomeParser'
import { HISTORICAL_COLORS, CURRENT_YEAR_COLOR, HISTORICAL_MEAN_COLOR } from '../config/chartConfig'
import { 
  getYearlyTotals, 
  getQuarterlyTotals, 
  getMonthlyTotals,
  calculateCombinedQuarterlyStats,
  calculateCombinedMonthlyStats 
} from '../utils/aggregations'

interface BarChartDataProps {
  timeframe: 'year' | 'quarter' | 'month'
  currentYearData: YTDPoint[]
  processedHistoricalData: { year: string, data: YTDPoint[] }[]
  showCombined: boolean
  data: YTDPoint[]
  historical2016Data: YTDPoint[]
  historical2017Data: YTDPoint[]
  historical2018Data: YTDPoint[]
  historical2019Data: YTDPoint[]
  historical2020Data: YTDPoint[]
  historical2021Data: YTDPoint[]
  historical2022Data: YTDPoint[]
  historical2023Data: YTDPoint[]
  historical2024Data: YTDPoint[]
  isNormalized: boolean
}

// Helper function to normalize bar chart data
const normalizeBarData = (data: any[], timeframe: string, isNormalized: boolean) => {
  if (!isNormalized) return data
  
  return data.map((yearData: any) => {
    const periods = timeframe === 'quarter' ? yearData.quarters : yearData.months
    if (!periods) return yearData
    
    // Calculate total for this year
    const yearTotal = periods.reduce((sum: number, period: any) => sum + period.income, 0)
    
    if (yearTotal === 0) return yearData
    
    // Normalize each period to percentage of year total
    const normalizedPeriods = periods.map((period: any) => ({
      ...period,
      income: (period.income / yearTotal) * 100
    }))
    
    return {
      ...yearData,
      [timeframe === 'quarter' ? 'quarters' : 'months']: normalizedPeriods
    }
  })
}

// Helper function to normalize combined bar data
const normalizeCombinedBarData = (data: any[], isNormalized: boolean) => {
  if (!isNormalized || data.length === 0) return data
  
  // For combined data, normalize each period to percentage of the total across all periods
  const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
  if (totalIncome === 0) return data
  
  return data.map(item => ({
    ...item,
    income: (item.income / totalIncome) * 100,
    error: item.error ? (item.error / totalIncome) * 100 : undefined
  }))
}

export const buildBarChartData = ({
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
}: BarChartDataProps) => {
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
      
      // For year mode normalization, normalize against the mean total
      const combinedData = [{ period: 'Historical Mean (2016-2024)', income: meanIncome, error: stdDev }]
      const currentData = [{ period: '2025', income: yearly2025[0].income }]
      
      if (isNormalized) {
        const totalForNormalization = meanIncome
        return {
          combined: totalForNormalization > 0 ? [{
            period: 'Historical Mean (2016-2024)', 
            income: 100, // Mean is always 100% of itself
            error: (stdDev / totalForNormalization) * 100
          }] : combinedData,
          current: totalForNormalization > 0 ? [{
            period: '2025', 
            income: (yearly2025[0].income / totalForNormalization) * 100
          }] : currentData,
          individual: yearlyHistorical.concat(yearly2025).map(item => ({
            ...item,
            income: totalForNormalization > 0 ? (item.income / totalForNormalization) * 100 : item.income
          }))
        }
      }
      
      return {
        combined: combinedData,
        current: currentData,
        individual: yearlyHistorical.concat(yearly2025)
      }
    }
    
    // For individual year mode, normalize against the mean of all years
    if (isNormalized) {
      const allIncomes = yearlyHistorical.concat(yearly2025).map(y => y.income)
      const meanIncome = allIncomes.reduce((sum, val) => sum + val, 0) / allIncomes.length
      
      return {
        combined: [],
        current: meanIncome > 0 ? [{ ...yearly2025[0], income: (yearly2025[0].income / meanIncome) * 100 }] : yearly2025,
        individual: meanIncome > 0 ? yearlyHistorical.concat(yearly2025).map(item => ({
          ...item,
          income: (item.income / meanIncome) * 100
        })) : yearlyHistorical.concat(yearly2025)
      }
    }
    
    return {
      combined: [],
      current: yearly2025,
      individual: yearlyHistorical.concat(yearly2025)
    }
  } else if (timeframe === 'quarter') {
    // Quarter mode - use raw historical data (not smoothed/normalized) for bar charts
    const quarterly2025 = getQuarterlyTotals(calculateRollingAverage(data.filter(p => p.date !== 'Total')))
    const historicalDataRaw = [
      { year: '2016', data: calculateRollingAverage(historical2016Data) },
      { year: '2017', data: calculateRollingAverage(historical2017Data) },
      { year: '2018', data: calculateRollingAverage(historical2018Data) },
      { year: '2019', data: calculateRollingAverage(historical2019Data) },
      { year: '2020', data: calculateRollingAverage(historical2020Data) },
      { year: '2021', data: calculateRollingAverage(historical2021Data) },
      { year: '2022', data: calculateRollingAverage(historical2022Data) },
      { year: '2023', data: calculateRollingAverage(historical2023Data) },
      { year: '2024', data: calculateRollingAverage(historical2024Data) }
    ]
    const historicalData = historicalDataRaw.map(({ data }) => data).filter(data => data.length > 0)
    const combinedQuarterlyStats = calculateCombinedQuarterlyStats(historicalData)
    
    if (showCombined) {
      return {
        combined: normalizeCombinedBarData(combinedQuarterlyStats.mean, isNormalized),
        current: normalizeCombinedBarData(quarterly2025.map(q => ({ period: q.quarter, income: q.income })), isNormalized),
        individual: []
      }
    }
    
    // Non-combined: each year gets separate bars for each quarter
    const individualQuarterly = historicalDataRaw.map(({ year, data }) => ({
      year,
      quarters: getQuarterlyTotals(data)
    })).concat([{ year: '2025', quarters: quarterly2025 }])
    
    return {
      combined: [],
      current: [],
      individual: normalizeBarData(individualQuarterly, 'quarter', isNormalized)
    }
  } else if (timeframe === 'month') {
    // Month mode - use raw historical data (not smoothed/normalized) for bar charts
    const monthly2025 = getMonthlyTotals(calculateRollingAverage(data.filter(p => p.date !== 'Total')))
    const historicalDataRaw = [
      { year: '2016', data: calculateRollingAverage(historical2016Data) },
      { year: '2017', data: calculateRollingAverage(historical2017Data) },
      { year: '2018', data: calculateRollingAverage(historical2018Data) },
      { year: '2019', data: calculateRollingAverage(historical2019Data) },
      { year: '2020', data: calculateRollingAverage(historical2020Data) },
      { year: '2021', data: calculateRollingAverage(historical2021Data) },
      { year: '2022', data: calculateRollingAverage(historical2022Data) },
      { year: '2023', data: calculateRollingAverage(historical2023Data) },
      { year: '2024', data: calculateRollingAverage(historical2024Data) }
    ]
    const historicalData = historicalDataRaw.map(({ data }) => data).filter(data => data.length > 0)
    const combinedMonthlyStats = calculateCombinedMonthlyStats(historicalData)
    
    if (showCombined) {
      return {
        combined: normalizeCombinedBarData(combinedMonthlyStats.mean, isNormalized),
        current: normalizeCombinedBarData(monthly2025.map(m => ({ period: m.month, income: m.income })), isNormalized),
        individual: []
      }
    }
    
    // Non-combined: each year gets separate bars for each month
    const individualMonthly = historicalDataRaw.map(({ year, data }) => ({
      year,
      months: getMonthlyTotals(data)
    })).concat([{ year: '2025', months: monthly2025 }])
    
    return {
      combined: [],
      current: [],
      individual: normalizeBarData(individualMonthly, 'month', isNormalized)
    }
  }
  
  return { combined: [], current: [], individual: [] }
}

export const buildBarChartTraces = (
  barChartData: any,
  timeframe: 'year' | 'quarter' | 'month',
  showCombined: boolean,
  isNormalized: boolean,
  showAllMonths: boolean,
  currentPeriod: { year: number, quarter?: number, month?: number }
) => {
  if (showCombined) {
    return [
      // Historical Mean with error bars
      ...(barChartData.combined.length > 0 ? [
        {
          x: barChartData.combined.map((item: any) => item.period || item.month || item.quarter),
          y: barChartData.combined.map((item: any) => item.income),
          type: 'bar' as const,
          name: 'Historical Mean (2016-2024)',
          marker: { color: HISTORICAL_MEAN_COLOR, opacity: 0.8 },
          error_y: {
            type: 'data' as const,
            array: barChartData.combined.map((item: any) => item.error),
            visible: true,
            color: HISTORICAL_MEAN_COLOR,
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
        marker: { color: CURRENT_YEAR_COLOR, opacity: 0.9 },
        hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
      }] : [])
    ]
  } else {
    return [
      // Non-combined bar chart - individual years
      ...(barChartData.individual.length > 0 && timeframe === 'year' ? 
        barChartData.individual.map((item: any, index: number) => ({
          x: [item.year],
          y: [item.income],
          type: 'bar' as const,
          name: item.year,
          marker: { color: item.year === '2025' ? CURRENT_YEAR_COLOR : HISTORICAL_COLORS[index % HISTORICAL_COLORS.length], opacity: 0.8 },
          hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
        })) : []
      ),
      // For quarter and month non-combined, group bars properly so bargroupgap works
      ...(barChartData.individual.length > 0 && timeframe !== 'year' ?
        barChartData.individual.map((yearData: any, yearIndex: number) => {
          const periods = timeframe === 'quarter' ? yearData.quarters : yearData.months
          
          // For monthly individual mode, filter to single month if not showing all months
          const filteredPeriods = timeframe === 'month' && !showAllMonths && currentPeriod.month
            ? periods.filter((period: any) => {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                const currentMonthName = monthNames[currentPeriod.month! - 1]
                return period.month === currentMonthName
              })
            : periods
          
          return {
            x: filteredPeriods.map((period: any) => period.quarter || period.month),
            y: filteredPeriods.map((period: any) => period.income),
            type: 'bar' as const,
            name: yearData.year,
            marker: { 
              color: yearData.year === '2025' ? CURRENT_YEAR_COLOR : HISTORICAL_COLORS[yearIndex % HISTORICAL_COLORS.length], 
              opacity: 0.8 
            },
            hovertemplate: isNormalized ? `${yearData.year} %{x}<br>%{y:.1f}%<extra></extra>` : `${yearData.year} %{x}<br>$%{y:,}<extra></extra>`
          }
        }) : []
      )
    ]
  }
}
