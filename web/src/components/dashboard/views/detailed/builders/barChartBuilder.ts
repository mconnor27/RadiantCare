import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import { getColorScheme, PROJECTED_BAR_STYLE, desaturateColor, CURRENT_BAR_BORDER } from '../config/chartConfig'
import {
  getYearlyTotals,
  getQuarterlyTotals,
  getMonthlyTotals,
  calculateCombinedQuarterlyStats,
  calculateCombinedMonthlyStats
} from '../utils/aggregations'

interface BarChartDataProps {
  timeframe: 'year' | 'quarter' | 'month'
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
  projectedIncomeData: YTDPoint[]
  combineStatistic?: 'mean' | 'median' | null
  combineError?: 'std' | 'ci' | null
}

// Helper function to calculate median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Helper function to normalize bar chart data
// Optionally provide a mapping of year -> fixed annual total to use as denominator
const normalizeBarData = (data: any[], timeframe: string, isNormalized: boolean, yearAnnualTotals?: Record<string, number>) => {
  if (!isNormalized) return data
  
  return data.map((yearData: any) => {
    const periods = timeframe === 'quarter' ? yearData.quarters : yearData.months
    if (!periods) return yearData
    
    // Calculate total for this year or use provided fixed denominator
    const normalizedYearKey = typeof yearData.year === 'string' && yearData.year.includes('2025') ? '2025' : yearData.year
    const providedTotal = yearAnnualTotals ? yearAnnualTotals[normalizedYearKey] : undefined
    const yearTotal = providedTotal ?? periods.reduce((sum: number, period: any) => sum + period.income, 0)
    
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
// Optionally provide a fixed total to use as denominator
const normalizeCombinedBarData = (data: any[], isNormalized: boolean, fixedTotal?: number) => {
  if (!isNormalized || data.length === 0) return data
  
  // For combined data, normalize each period to percentage of the total across all periods
  const totalIncome = (fixedTotal !== undefined ? fixedTotal : data.reduce((sum, item) => sum + item.income, 0))
  if (totalIncome === 0) return data
  
  return data.map(item => ({
    ...item,
    income: (item.income / totalIncome) * 100,
    error: item.error ? (item.error / totalIncome) * 100 : undefined
  }))
}

export const buildBarChartData = ({
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
  projectedIncomeData,
  combineStatistic = null,
  combineError = null
}: BarChartDataProps) => {
  // If only one historical year is selected, disable error bars
  const hasMultipleYears = processedHistoricalData.length > 1

  if (timeframe === 'year') {
    // Year mode: each year is an x-axis tick
    // Use RAW totals for 2025 so normalization is correct when bars are percent-based
    const actualData2025 = data.filter(p => p.date !== 'Total')
    const actual2025Total = actualData2025.length > 0 ? actualData2025[actualData2025.length - 1]?.cumulativeIncome || 0 : 0
    const projected2025Total = projectedIncomeData.length > 0 ? projectedIncomeData[projectedIncomeData.length - 1]?.cumulativeIncome || 0 : 0

    const yearly2025 = [{ year: '2025', income: actual2025Total }]
    const yearlyHistorical = getYearlyTotals(processedHistoricalData)
    const projected2025 = projectedIncomeData.length > 0 ? [{ year: '2025 Projected', income: projected2025Total }] : []

    if (showCombined) {
      // For combined/bar mode: show mean/median with std dev/CI
      const allYearIncomes = yearlyHistorical.map(y => y.income)

      // Calculate center statistic (mean or median), default to mean if null
      const centerIncome = combineStatistic === 'median'
        ? calculateMedian(allYearIncomes)
        : allYearIncomes.reduce((sum, val) => sum + val, 0) / allYearIncomes.length

      // Calculate standard deviation (needed for both std and CI)
      const meanIncome = allYearIncomes.reduce((sum, val) => sum + val, 0) / allYearIncomes.length
      const variance = allYearIncomes.reduce((sum, val) => sum + Math.pow(val - meanIncome, 2), 0) / allYearIncomes.length
      const stdDev = Math.sqrt(variance)

      // Calculate error based on type (if errorType is not null)
      // Also disable error bars if only one year is selected
      const errorValue = hasMultipleYears && combineError === 'ci'
        ? 1.96 * stdDev
        : hasMultipleYears && combineError === 'std'
        ? stdDev
        : 0  // No error if null or single year

      const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'

      // For year mode normalization, normalize against the 2025 projected total for current/projection
      const combinedData = [{ period: `Historical ${labelSuffix}`, income: centerIncome, error: errorValue }]
      const currentData = [{ period: '2025', income: yearly2025[0].income }]
      const projectedData = projected2025.length > 0 ? [{ period: '2025 Projected', income: projected2025[0].income - yearly2025[0].income }] : []

      if (isNormalized) {
        const denom2025 = projected2025Total
        return {
          combined: centerIncome > 0 ? [{
            period: `Historical ${labelSuffix}`,
            income: 100,
            error: (errorValue / centerIncome) * 100
          }] : combinedData,
          current: denom2025 > 0 ? [{ period: '2025', income: (actual2025Total / denom2025) * 100 }] : [{ period: '2025', income: 0 }],
          projected: denom2025 > 0 && projectedData.length > 0 ? [{ period: '2025 Projected', income: ((projected2025Total - actual2025Total) / denom2025) * 100 }] : projectedData,
          individual: yearlyHistorical.concat(yearly2025).map(item => ({
            ...item,
            income: centerIncome > 0 ? (item.income / centerIncome) * 100 : item.income
          }))
        }
      }

      return {
        combined: combinedData,
        current: currentData,
        projected: projectedData,
        individual: yearlyHistorical.concat(yearly2025)
      }
    }
    
    // For individual year mode, show all historical years as 100%; 2025 splits into actual% + remainder%
    if (isNormalized) {
      const denom2025 = projected2025Total
      const normalizedIndividuals = yearlyHistorical.concat(yearly2025).map(item => {
        if (item.year === '2025') {
          return { ...item, income: denom2025 > 0 ? (actual2025Total / denom2025) * 100 : 0 }
        }
        return { ...item, income: 100 }
      })

      const projectedPercent = denom2025 > 0 ? ((projected2025Total - actual2025Total) / denom2025) * 100 : 0

      return {
        combined: [],
        current: [{ year: '2025', income: denom2025 > 0 ? (actual2025Total / denom2025) * 100 : 0 }],
        projected: projected2025.length > 0 ? [{ year: '2025 Projected', income: projectedPercent }] : [],
        individual: normalizedIndividuals
      }
    }

    return {
      combined: [],
      current: yearly2025,
      projected: projected2025.length > 0 ? [{ year: '2025 Projected', income: projected2025[0].income - yearly2025[0].income }] : [],
      individual: yearlyHistorical.concat(yearly2025)
    }
  } else if (timeframe === 'quarter') {
    // Quarter mode - use raw historical data (not smoothed/normalized) for bar charts
    const actualData2025 = data.filter(p => p.date !== 'Total')
    const quarterly2025 = getQuarterlyTotals(actualData2025)
    // Build a full-year combined series (actual + projected) so period totals are correct
    const combinedForBarsQuarter = projectedIncomeData && projectedIncomeData.length > 0
      ? actualData2025.concat(projectedIncomeData.slice(1))
      : actualData2025
    const projectedQuarterly2025 = getQuarterlyTotals(combinedForBarsQuarter)
    const historicalDataRaw = [
      { year: '2016', data: historical2016Data },
      { year: '2017', data: historical2017Data },
      { year: '2018', data: historical2018Data },
      { year: '2019', data: historical2019Data },
      { year: '2020', data: historical2020Data },
      { year: '2021', data: historical2021Data },
      { year: '2022', data: historical2022Data },
      { year: '2023', data: historical2023Data },
      { year: '2024', data: historical2024Data }
    ]
    // Filter by selected years from processedHistoricalData
    const selectedYearsQuarter = new Set(processedHistoricalData.map(({ year }) => year))
    const historicalData = historicalDataRaw
      .filter(({ year }) => selectedYearsQuarter.has(year))
      .map(({ data }) => data)
      .filter(data => data.length > 0)
    const combinedQuarterlyStats = calculateCombinedQuarterlyStats(historicalData, combineStatistic, hasMultipleYears ? combineError : null)

    if (showCombined) {
      // Calculate projected quarterly amounts as the difference between projected and actual
      const projectedQuarterlyData = projectedQuarterly2025.map((proj, index) => {
        const actual = quarterly2025[index]
        return {
          period: proj.quarter,
          income: proj.income - (actual?.income || 0)
        }
      })

      // Use the full-year combined total as the denominator for normalization
      const annualTotal2025 = projectedQuarterly2025.reduce((sum, q) => sum + q.income, 0)

      return {
        combined: normalizeCombinedBarData(combinedQuarterlyStats.mean, isNormalized),
        current: normalizeCombinedBarData(quarterly2025.map(q => ({ period: q.quarter, income: q.income })), isNormalized, annualTotal2025),
        projected: normalizeCombinedBarData(projectedQuarterlyData, isNormalized, annualTotal2025),
        individual: []
      }
    }

    // Non-combined: each year gets separate bars for each quarter
    // Filter historicalDataRaw by years present in processedHistoricalData (respects year filtering)
    const individualQuarterly = historicalDataRaw
      .filter(({ year }) => selectedYearsQuarter.has(year))
      .map(({ year, data }) => ({
        year,
        quarters: getQuarterlyTotals(data)
      })).concat([{ year: '2025', quarters: quarterly2025 }])

    // Add projected quarters for 2025
    const projectedIndividualQuarterly = projectedQuarterly2025.length > 0 ? [{
      year: '2025 Projected',
      quarters: projectedQuarterly2025.map((proj, index) => {
        const actual = quarterly2025[index]
        return {
          quarter: proj.quarter,
          income: proj.income - (actual?.income || 0)
        }
      })
    }] : []

    // Normalize individual (per-year) bars using the full-year total as denominator
    const yearAnnualTotals: Record<string, number> = {}
    const annualTotal2025 = projectedQuarterly2025.reduce((sum, q) => sum + q.income, 0)
    yearAnnualTotals['2025'] = annualTotal2025
    yearAnnualTotals['2025 Projected'] = annualTotal2025

    return {
      combined: [],
      current: [],
      projected: projectedIndividualQuarterly,
      individual: normalizeBarData(individualQuarterly.concat(projectedIndividualQuarterly), 'quarter', isNormalized, yearAnnualTotals)
    }
  } else if (timeframe === 'month') {
    // Month mode - use raw historical data (not smoothed/normalized) for bar charts
    const actualData2025Month = data.filter(p => p.date !== 'Total')
    const monthly2025 = getMonthlyTotals(actualData2025Month)
    // Build a full-year combined series (actual + projected) so period totals are correct
    const combinedForBarsMonth = projectedIncomeData && projectedIncomeData.length > 0
      ? actualData2025Month.concat(projectedIncomeData.slice(1))
      : actualData2025Month
    const projectedMonthly2025 = getMonthlyTotals(combinedForBarsMonth)
    const historicalDataRaw = [
      { year: '2016', data: historical2016Data },
      { year: '2017', data: historical2017Data },
      { year: '2018', data: historical2018Data },
      { year: '2019', data: historical2019Data },
      { year: '2020', data: historical2020Data },
      { year: '2021', data: historical2021Data },
      { year: '2022', data: historical2022Data },
      { year: '2023', data: historical2023Data },
      { year: '2024', data: historical2024Data }
    ]
    // Filter by selected years from processedHistoricalData
    const selectedYearsMonth = new Set(processedHistoricalData.map(({ year }) => year))
    const historicalData = historicalDataRaw
      .filter(({ year }) => selectedYearsMonth.has(year))
      .map(({ data }) => data)
      .filter(data => data.length > 0)
    const combinedMonthlyStats = calculateCombinedMonthlyStats(historicalData, combineStatistic, hasMultipleYears ? combineError : null)

    if (showCombined) {
      // Calculate projected monthly amounts as the difference between projected and actual
      const projectedMonthlyData = projectedMonthly2025.map((proj, index) => {
        const actual = monthly2025[index]
        return {
          period: proj.month,
          income: proj.income - (actual?.income || 0)
        }
      })

      // Use the full-year combined total as the denominator for normalization
      const annualTotal2025 = projectedMonthly2025.reduce((sum, m) => sum + m.income, 0)

      return {
        combined: normalizeCombinedBarData(combinedMonthlyStats.mean, isNormalized),
        current: normalizeCombinedBarData(monthly2025.map(m => ({ period: m.month, income: m.income })), isNormalized, annualTotal2025),
        projected: normalizeCombinedBarData(projectedMonthlyData, isNormalized, annualTotal2025),
        individual: []
      }
    }

    // Non-combined: each year gets separate bars for each month
    // Filter historicalDataRaw by years present in processedHistoricalData (respects year filtering)
    const individualMonthly = historicalDataRaw
      .filter(({ year }) => selectedYearsMonth.has(year))
      .map(({ year, data }) => ({
        year,
        months: getMonthlyTotals(data)
      })).concat([{ year: '2025', months: monthly2025 }])

    // Add projected months for 2025
    const projectedIndividualMonthly = projectedMonthly2025.length > 0 ? [{
      year: '2025 Projected',
      months: projectedMonthly2025.map((proj, index) => {
        const actual = monthly2025[index]
        return {
          month: proj.month,
          income: proj.income - (actual?.income || 0)
        }
      })
    }] : []

    // Normalize individual bars with full-year total as denominator
    const yearAnnualTotals: Record<string, number> = {}
    const annualTotal2025 = projectedMonthly2025.reduce((sum, m) => sum + m.income, 0)
    yearAnnualTotals['2025'] = annualTotal2025
    yearAnnualTotals['2025 Projected'] = annualTotal2025

    return {
      combined: [],
      current: [],
      projected: projectedIndividualMonthly,
      individual: normalizeBarData(individualMonthly.concat(projectedIndividualMonthly), 'month', isNormalized, yearAnnualTotals)
    }
  }
  
  return { combined: [], current: [], projected: [], individual: [] }
}

export const buildBarChartTraces = (
  barChartData: any,
  timeframe: 'year' | 'quarter' | 'month',
  showCombined: boolean,
  isNormalized: boolean,
  showAllMonths: boolean,
  currentPeriod: { year: number, quarter?: number, month?: number },
  combineStatistic: 'mean' | 'median' | null = null,
  combineError: 'std' | 'ci' | null = null,
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare' = 'gray'
) => {
  const colors = getColorScheme(colorScheme)
  const HISTORICAL_COLORS = colors.historical
  const CURRENT_YEAR_COLOR = colors.current
  const HISTORICAL_MEAN_COLOR = HISTORICAL_COLORS[Math.floor(HISTORICAL_COLORS.length / 2)]
  
  // Helper to create border around entire 2025 stack
  const createStackBorder = () => ({
    color: CURRENT_BAR_BORDER.color,
    width: CURRENT_BAR_BORDER.width
  })
  if (showCombined) {
    const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
    const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'σ' : ''

    return [
      // Historical Mean/Median with error bars (if combineError is not null)
      ...(barChartData.combined.length > 0 ? [
        {
          x: barChartData.combined.map((item: any) => item.period || item.month || item.quarter),
          y: barChartData.combined.map((item: any) => item.income),
          type: 'bar' as const,
          name: `Historical ${labelSuffix} (2016-2024)`,
          marker: { color: desaturateColor(HISTORICAL_MEAN_COLOR, 0.4), opacity: 0.8 },
          offsetgroup: timeframe === 'year' ? undefined : 'historical',
          error_y: combineError ? {
            type: 'data' as const,
            array: barChartData.combined.map((item: any) => item.error),
            visible: true,
            color: desaturateColor(HISTORICAL_MEAN_COLOR, 0.4),
            thickness: 2,
            width: 3
          } : undefined,
          hovertemplate: isNormalized
            ? combineError
              ? `Historical ${labelSuffix}: %{y:.1f}% ± %{error_y.array:.1f}% (${errorLabel})<extra></extra>`
              : `Historical ${labelSuffix}: %{y:.1f}%<extra></extra>`
            : combineError
              ? `Historical ${labelSuffix}: $%{y:,.0f} ± $%{error_y.array:,.0f} (${errorLabel})<extra></extra>`
              : `Historical ${labelSuffix}: $%{y:,.0f}<extra></extra>`
        }
      ] : []),
      // Current Year Data (2025) - NO BORDER on individual segments
      ...(barChartData.current.length > 0 ? [{
        x: barChartData.current.map((item: any) => item.period),
        y: barChartData.current.map((item: any) => item.income),
        type: 'bar' as const,
        name: '2025 Actual',
        offsetgroup: timeframe === 'year' ? undefined : '2025', // Group with 2025 projected
        marker: { 
          color: CURRENT_YEAR_COLOR, 
          opacity: 0.9
        },
        hovertemplate: isNormalized
          ? (timeframe === 'year' ? '%{x}: %{y:.1f}%<extra></extra>' : '2025 %{x}: %{y:.1f}%<extra></extra>')
          : (timeframe === 'year' ? '%{x}: $%{y:,.0f}<extra></extra>' : '2025 %{x}: $%{y:,.0f}<extra></extra>')
      }] : []),
      // Projected Data (stacked on top of current) - NO BORDER on individual segments
      ...(barChartData.projected.length > 0 ? [{
        x: (timeframe === 'year'
          ? barChartData.current.map((item: any) => item.period) // stack on same x label '2025'
          : barChartData.projected.map((item: any) => item.period)),
        y: barChartData.projected.map((item: any) => item.income),
        type: 'bar' as const,
        name: '2025 Projected',
        base: barChartData.current.map((item: any) => item.income), // Stack on top of actual
        offsetgroup: timeframe === 'year' ? undefined : '2025', // Group with 2025 actual
        marker: {
          color: PROJECTED_BAR_STYLE.color,
          pattern: PROJECTED_BAR_STYLE.pattern
        },
        hovertemplate: isNormalized
          ? (timeframe === 'year' ? '%{x} Projected: %{y:.1f}%<extra></extra>' : '2025 %{x} Projected: %{y:.1f}%<extra></extra>')
          : (timeframe === 'year' ? '%{x} Projected: $%{y:,.0f}<extra></extra>' : '2025 %{x} Projected: $%{y:,.0f}<extra></extra>')
      }] : []),
      // INVISIBLE OVERLAY BAR with border - creates outer border only!
      ...(barChartData.current.length > 0 ? [{
        x: barChartData.current.map((item: any) => item.period),
        y: barChartData.current.map((item: any, i: number) => {
          const actualIncome = item.income
          const projectedIncome = barChartData.projected.length > 0 ? barChartData.projected[i]?.income || 0 : 0
          return actualIncome + projectedIncome // Full stack height
        }),
        type: 'bar' as const,
        name: '', // No name in legend
        showlegend: false,
        base: 0, // Start from bottom, don't stack
        offsetgroup: timeframe === 'year' ? undefined : '2025', // Same group as 2025 bars
        marker: {
          color: 'rgba(0, 0, 0, 0)', // Completely transparent
          line: createStackBorder() // Border only on this invisible bar!
        },
        hoverinfo: 'skip' // Don't show hover for this invisible bar
      }] : [])
    ]
  } else {
    const traces = []

    // Non-combined bar chart - individual years
    if (barChartData.individual.length > 0 && timeframe === 'year') {
      // Add historical years
      barChartData.individual.forEach((item: any, index: number) => {
        if (item.year !== '2025' && item.year !== '2025 Projected') {
          // Reverse index so 2024 (last in array) gets darkest color
          const colorIndex = (HISTORICAL_COLORS.length - 1 - index) % HISTORICAL_COLORS.length
          traces.push({
            x: [item.year],
            y: [item.income],
            type: 'bar' as const,
            name: item.year,
            marker: { color: desaturateColor(HISTORICAL_COLORS[colorIndex], 0.4), opacity: 0.8 },
            hovertemplate: isNormalized ? '%{x}: %{y:.1f}%<extra></extra>' : '%{x}: $%{y:,.0f}<extra></extra>'
          })
        }
      })

      // Add 2025 actual - NO BORDER
      const actual2025 = barChartData.individual.find((item: any) => item.year === '2025')
      if (actual2025) {
        traces.push({
          x: [actual2025.year],
          y: [actual2025.income],
          type: 'bar' as const,
          name: '2025 Actual',
          offsetgroup: '2025', // Group with 2025 projected
          marker: { 
            color: CURRENT_YEAR_COLOR, 
            opacity: 0.9
          },
          hovertemplate: isNormalized ? '%{x}: %{y:.1f}%<extra></extra>' : '%{x}: $%{y:,.0f}<extra></extra>'
        })
      }

      // Add 2025 projected (stacked) - NO BORDER
      if (barChartData.projected.length > 0 && barChartData.projected[0].income > 0 && actual2025) {
        traces.push({
          x: ['2025'],
          y: [barChartData.projected[0].income],
          type: 'bar' as const,
          name: '2025 Projected',
          base: [actual2025.income], // Stack on top of actual
          offsetgroup: '2025', // Group with 2025 actual
          marker: {
            color: PROJECTED_BAR_STYLE.color,
            pattern: PROJECTED_BAR_STYLE.pattern
          },
          hovertemplate: isNormalized ? '%{x} Projected: %{y:.1f}%<extra></extra>' : '%{x} Projected: $%{y:,.0f}<extra></extra>'
        })
      }

      // INVISIBLE OVERLAY BAR with border - year mode
      if (actual2025) {
        const totalHeight = actual2025.income + (barChartData.projected.length > 0 ? barChartData.projected[0].income : 0)
        traces.push({
          x: ['2025'],
          y: [totalHeight],
          type: 'bar' as const,
          name: '',
          showlegend: false,
          base: 0, // Start from bottom
          offsetgroup: '2025',
          marker: {
            color: 'rgba(0, 0, 0, 0)', // Transparent
            line: createStackBorder()
          },
          hoverinfo: 'skip'
        })
      }
    }

    // For quarter and month non-combined, group bars properly so bargroupgap works
    if (barChartData.individual.length > 0 && timeframe !== 'year') {
      barChartData.individual.forEach((yearData: any, yearIndex: number) => {
        if (yearData.year !== '2025 Projected') {
          const periods = timeframe === 'quarter' ? yearData.quarters : yearData.months

          // For monthly individual mode, filter to single month if not showing all months
          const filteredPeriods = timeframe === 'month' && !showAllMonths && currentPeriod.month
            ? periods.filter((period: any) => {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                const currentMonthName = monthNames[currentPeriod.month! - 1]
                return period.month === currentMonthName
              })
            : periods

          // Reverse index so 2024 (last in array) gets darkest color
          const colorIndex = (HISTORICAL_COLORS.length - 1 - yearIndex) % HISTORICAL_COLORS.length
          const is2025 = yearData.year === '2025'
          traces.push({
            x: filteredPeriods.map((period: any) => period.quarter || period.month),
            y: filteredPeriods.map((period: any) => period.income),
            type: 'bar' as const,
            name: is2025 ? '2025 Actual' : yearData.year,
            offsetgroup: is2025 ? '2025' : yearData.year, // Group 2025 actual with projected, others separate
            // Don't set width for quarter/month - let Plotly handle spacing with many groups
            marker: {
              color: is2025 ? CURRENT_YEAR_COLOR : desaturateColor(HISTORICAL_COLORS[colorIndex], 0.4),
              opacity: 0.8
            },
            hovertemplate: isNormalized ? `${yearData.year} %{x}: %{y:.1f}%<extra></extra>` : `${yearData.year} %{x}: $%{y:,.0f}<extra></extra>`
          })
        }
      })

      // Add projected data for quarter/month (stacked on 2025)
      const projectedData = barChartData.individual.find((item: any) => item.year === '2025 Projected')
      if (projectedData) {
        const periods = timeframe === 'quarter' ? projectedData.quarters : projectedData.months

        // For monthly individual mode, filter to single month if not showing all months
        const filteredPeriods = timeframe === 'month' && !showAllMonths && currentPeriod.month
          ? periods.filter((period: any) => {
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const currentMonthName = monthNames[currentPeriod.month! - 1]
              return period.month === currentMonthName
            })
          : periods

        // Get the corresponding 2025 actual values for base stacking
        const actual2025Data = barChartData.individual.find((item: any) => item.year === '2025')
        const actual2025Periods = actual2025Data ? (timeframe === 'quarter' ? actual2025Data.quarters : actual2025Data.months) : []
        
        // Filter actual data to match projected periods for base values
        const actualFilteredPeriods = timeframe === 'month' && !showAllMonths && currentPeriod.month
          ? actual2025Periods.filter((period: any) => {
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const currentMonthName = monthNames[currentPeriod.month! - 1]
              return period.month === currentMonthName
            })
          : actual2025Periods

        traces.push({
          x: filteredPeriods.map((period: any) => period.quarter || period.month),
          y: filteredPeriods.map((period: any) => period.income),
          type: 'bar' as const,
          name: '2025 Projected',
          base: actualFilteredPeriods.map((period: any) => period.income), // Stack on top of 2025 actual
          offsetgroup: '2025', // Group with 2025 actual
          marker: {
            color: PROJECTED_BAR_STYLE.color,
            pattern: PROJECTED_BAR_STYLE.pattern
          },
          hovertemplate: isNormalized ? `2025 Projected %{x}: %{y:.1f}%<extra></extra>` : `2025 Projected %{x}: $%{y:,.0f}<extra></extra>`
        })

        // INVISIBLE OVERLAY BAR with border - quarter/month mode
        traces.push({
          x: filteredPeriods.map((period: any) => period.quarter || period.month),
          y: filteredPeriods.map((period: any, i: number) => {
            const actualIncome = actualFilteredPeriods[i]?.income || 0
            const projectedIncome = period.income
            return actualIncome + projectedIncome // Full stack height
          }),
          type: 'bar' as const,
          name: '',
          showlegend: false,
          base: 0, // Start from bottom
          offsetgroup: '2025',
          marker: {
            color: 'rgba(0, 0, 0, 0)', // Transparent
            line: createStackBorder()
          },
          hoverinfo: 'skip'
        })
      }
    }

    return traces
  }
}
