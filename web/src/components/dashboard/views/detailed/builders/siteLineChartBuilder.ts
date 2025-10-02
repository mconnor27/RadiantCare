import type { YTDPointWithSites } from '../../../shared/types'
import {
  getSiteMonthlyEndPoints,
  get2025SiteMonthlyEndPoints,
  generateProjectedSiteMonthlyPoints
} from '../../../../../historical_data/siteIncomeParser'
import { getSiteColors, HISTORICAL_YEAR_LINE_WIDTH, RADAR_CONFIG, desaturateColor, SITE_DESATURATION } from '../config/chartConfig'
import { 
  filterDataByQuarter,
  filterDataByMonth
} from '../utils/dataProcessing'

interface SiteLineChartBuilderProps {
  showCombined: boolean
  processedHistoricalData: { year: string, data: any[] }[]
  isNormalized: boolean
  is2025Visible: boolean
  timeframe: 'year' | 'quarter' | 'month'
  currentPeriod: { year: number, quarter?: number, month?: number }
  fy2025: any
  combineStatistic?: 'mean' | 'median' | null
  combineError?: 'std' | 'ci' | null
  visibleSites?: { lacey: boolean, centralia: boolean, aberdeen: boolean }
  selectedYears?: number[]
  colorScheme?: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'
}

// Helper function to process site data for different timeframes
function processSiteDataForTimeframe(
  siteData: YTDPointWithSites[], 
  timeframe: 'year' | 'quarter' | 'month',
  currentPeriod: { year: number, quarter?: number, month?: number },
  isNormalized: boolean = false,
  normalizeReference?: number,
  periodStartSitesOverride?: { lacey: number, centralia: number, aberdeen: number }
): YTDPointWithSites[] {
  if (siteData.length === 0) return []
  
  // Apply normalization BEFORE filtering (so we have full year context for period start calculations)
  let processedData = siteData
  
  if (isNormalized) {
    // Use provided reference total, or calculate from data as fallback
    let reference = normalizeReference
    
    if (!reference && processedData.length > 0) {
      if (timeframe === 'year') {
        // Use the final combined total of all sites for the year
        const finalPoint = processedData[processedData.length - 1]
        reference = finalPoint.cumulativeIncome
      } else if (timeframe === 'quarter' && currentPeriod.quarter) {
        // Calculate the total income earned within this quarter across all sites (using full data)
        const quarterStartIncome = calculatePeriodStartIncome(processedData, currentPeriod.quarter)
        const quarterEndIncome = getQuarterEndIncome(processedData, currentPeriod.quarter)
        reference = quarterEndIncome - quarterStartIncome
      } else if (timeframe === 'month' && currentPeriod.month) {
        // Calculate the total income earned within this month across all sites (using full data)
        const monthStartIncome = calculateMonthStartIncome(processedData, currentPeriod.month)
        const monthEndIncome = getMonthEndIncome(processedData, currentPeriod.month)
        reference = monthEndIncome - monthStartIncome
      }
    }
    
    if (reference && reference > 0) {
      if (timeframe === 'year') {
        // For year mode: each site as percentage of total year income
        processedData = processedData.map(point => ({
          ...point,
          cumulativeIncome: (point.cumulativeIncome / reference!) * 100,
          sites: point.sites ? {
            lacey: (point.sites.lacey / reference!) * 100,
            centralia: (point.sites.centralia / reference!) * 100,
            aberdeen: (point.sites.aberdeen / reference!) * 100
          } : undefined
        }))
      } else {
        // For quarter/month mode: normalize to show progress from 0-100% within that period
        // Calculate the starting site values for this period (using full data)
        const periodStartSites = periodStartSitesOverride 
          ? periodStartSitesOverride 
          : calculatePeriodStartSites(processedData, timeframe, currentPeriod)
          
        processedData = processedData.map(point => ({
          ...point,
          cumulativeIncome: Math.max(0, ((point.cumulativeIncome - (periodStartSites.lacey + periodStartSites.centralia + periodStartSites.aberdeen)) / reference!) * 100),
          sites: point.sites ? {
            lacey: Math.max(0, ((point.sites.lacey - periodStartSites.lacey) / reference!) * 100),
            centralia: Math.max(0, ((point.sites.centralia - periodStartSites.centralia) / reference!) * 100),
            aberdeen: Math.max(0, ((point.sites.aberdeen - periodStartSites.aberdeen) / reference!) * 100)
          } : undefined
        }))
      }
    }
  }
  
  // For non-normalized quarter/month, show absolute income within the period (start from $0)
  if (!isNormalized) {
    if (timeframe === 'quarter' && currentPeriod.quarter) {
      const periodStartSites = periodStartSitesOverride 
        ? periodStartSitesOverride 
        : calculatePeriodStartSites(processedData, 'quarter', currentPeriod)
      const baseIncome = periodStartSites.lacey + periodStartSites.centralia + periodStartSites.aberdeen
      processedData = processedData.map(point => ({
        ...point,
        cumulativeIncome: Math.max(0, point.cumulativeIncome - baseIncome),
        sites: point.sites ? {
          lacey: Math.max(0, point.sites.lacey - periodStartSites.lacey),
          centralia: Math.max(0, point.sites.centralia - periodStartSites.centralia),
          aberdeen: Math.max(0, point.sites.aberdeen - periodStartSites.aberdeen)
        } : undefined
      }))
    } else if (timeframe === 'month' && currentPeriod.month) {
      const periodStartSites = periodStartSitesOverride 
        ? periodStartSitesOverride 
        : calculatePeriodStartSites(processedData, 'month', currentPeriod)
      const baseIncome = periodStartSites.lacey + periodStartSites.centralia + periodStartSites.aberdeen
      processedData = processedData.map(point => ({
        ...point,
        cumulativeIncome: Math.max(0, point.cumulativeIncome - baseIncome),
        sites: point.sites ? {
          lacey: Math.max(0, point.sites.lacey - periodStartSites.lacey),
          centralia: Math.max(0, point.sites.centralia - periodStartSites.centralia),
          aberdeen: Math.max(0, point.sites.aberdeen - periodStartSites.aberdeen)
        } : undefined
      }))
    }
  }
  
  // Apply timeframe filtering AFTER normalization
  if (timeframe === 'quarter' && currentPeriod.quarter) {
    processedData = filterDataByQuarter(processedData, currentPeriod.year, currentPeriod.quarter)
  } else if (timeframe === 'month' && currentPeriod.month) {
    processedData = filterDataByMonth(processedData, currentPeriod.year, currentPeriod.month)
  }
  
  return processedData
}

// Compute a period-specific projected total using the combined series (actual up to last reliable date + projected thereafter)
function computeProjectedPeriodTotal(
  actual: YTDPointWithSites[],
  projected: YTDPointWithSites[],
  timeframe: 'year' | 'quarter' | 'month',
  currentPeriod: { year: number, quarter?: number, month?: number }
): number {
  if (timeframe === 'year') {
    const lastProjected = projected[projected.length - 1]
    return lastProjected ? lastProjected.cumulativeIncome : 0
  }

  // Merge actual + projected and sort by monthDay
  const combined: YTDPointWithSites[] = [...actual, ...projected]
    .sort((a, b) => (a.monthDay > b.monthDay ? 1 : a.monthDay < b.monthDay ? -1 : 0))

  if (combined.length === 0) return 0

  // Compute period start and end from the combined series
  if (timeframe === 'quarter' && currentPeriod.quarter) {
    const periodStart = calculatePeriodStartIncome(combined, currentPeriod.quarter)
    const filtered = filterDataByQuarter(combined as any, currentPeriod.year, currentPeriod.quarter)
    const periodEnd = filtered.length > 0 ? Math.max(...filtered.map(p => p.cumulativeIncome)) : periodStart
    return Math.max(0, periodEnd - periodStart)
  }

  if (timeframe === 'month' && currentPeriod.month) {
    const periodStart = calculateMonthStartIncome(combined, currentPeriod.month)
    const filtered = filterDataByMonth(combined as any, currentPeriod.year, currentPeriod.month)
    const periodEnd = filtered.length > 0 ? Math.max(...filtered.map(p => p.cumulativeIncome)) : periodStart
    return Math.max(0, periodEnd - periodStart)
  }

  return 0
}

// Compute period start site values from the combined actual+projected series
function computePeriodStartSitesCombined(
  actual: YTDPointWithSites[],
  projected: YTDPointWithSites[],
  timeframe: 'quarter' | 'month',
  currentPeriod: { year: number, quarter?: number, month?: number }
): { lacey: number, centralia: number, aberdeen: number } {
  const combined: YTDPointWithSites[] = [...actual, ...projected]
    .sort((a, b) => (a.monthDay > b.monthDay ? 1 : a.monthDay < b.monthDay ? -1 : 0))
  if (combined.length === 0) return { lacey: 0, centralia: 0, aberdeen: 0 }

  if (timeframe === 'quarter' && currentPeriod.quarter) {
    const startMonth = (currentPeriod.quarter - 1) * 3 + 1
    const pre = combined.filter(p => parseInt(p.monthDay.split('-')[0], 10) < startMonth)
    if (pre.length === 0) return { lacey: 0, centralia: 0, aberdeen: 0 }
    const last = pre.reduce((acc, p) => (p.cumulativeIncome > acc.cumulativeIncome ? p : acc))
    return {
      lacey: last.sites?.lacey || 0,
      centralia: last.sites?.centralia || 0,
      aberdeen: last.sites?.aberdeen || 0
    }
  }

  if (timeframe === 'month' && currentPeriod.month) {
    const pre = combined.filter(p => parseInt(p.monthDay.split('-')[0], 10) < currentPeriod.month!)
    if (pre.length === 0) return { lacey: 0, centralia: 0, aberdeen: 0 }
    const last = pre.reduce((acc, p) => (p.cumulativeIncome > acc.cumulativeIncome ? p : acc))
    return {
      lacey: last.sites?.lacey || 0,
      centralia: last.sites?.centralia || 0,
      aberdeen: last.sites?.aberdeen || 0
    }
  }

  return { lacey: 0, centralia: 0, aberdeen: 0 }
}

// Helper function to calculate quarter start income
function calculatePeriodStartIncome(data: YTDPointWithSites[], quarter: number): number {
  const startMonth = (quarter - 1) * 3 + 1
  const preQuarterData = data.filter(point => {
    const [monthStr] = point.monthDay.split('-')
    const month = parseInt(monthStr, 10)
    return month < startMonth
  })
  return preQuarterData.length > 0 ? Math.max(...preQuarterData.map(p => p.cumulativeIncome)) : 0
}

// Helper function to calculate month start income  
function calculateMonthStartIncome(data: YTDPointWithSites[], month: number): number {
  const preMonthData = data.filter(point => {
    const [monthStr] = point.monthDay.split('-')
    const pointMonth = parseInt(monthStr, 10)
    return pointMonth < month
  })
  return preMonthData.length > 0 ? Math.max(...preMonthData.map(p => p.cumulativeIncome)) : 0
}

// Helper function to get quarter end income
function getQuarterEndIncome(data: YTDPointWithSites[], quarter: number): number {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const quarterData = data.filter(point => {
    const [monthStr] = point.monthDay.split('-')
    const month = parseInt(monthStr, 10)
    return month >= startMonth && month <= endMonth
  })
  return quarterData.length > 0 ? Math.max(...quarterData.map(p => p.cumulativeIncome)) : 0
}

// Helper function to get month end income
function getMonthEndIncome(data: YTDPointWithSites[], month: number): number {
  const monthStr = month.toString().padStart(2, '0')
  const monthData = data.filter(point => point.monthDay.startsWith(monthStr))
  return monthData.length > 0 ? Math.max(...monthData.map(p => p.cumulativeIncome)) : 0
}

// Helper function to calculate period start site values
function calculatePeriodStartSites(
  data: YTDPointWithSites[], 
  timeframe: 'quarter' | 'month',
  currentPeriod: { year: number, quarter?: number, month?: number }
): { lacey: number, centralia: number, aberdeen: number } {
  let prePeriodData: YTDPointWithSites[] = []
  
  if (timeframe === 'quarter' && currentPeriod.quarter) {
    const startMonth = (currentPeriod.quarter - 1) * 3 + 1
    prePeriodData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const month = parseInt(monthStr, 10)
      return month < startMonth
    })
  } else if (timeframe === 'month' && currentPeriod.month) {
    prePeriodData = data.filter(point => {
      const [monthStr] = point.monthDay.split('-')
      const pointMonth = parseInt(monthStr, 10)
      return pointMonth < currentPeriod.month!
    })
  }
  
  if (prePeriodData.length === 0) {
    return { lacey: 0, centralia: 0, aberdeen: 0 }
  }
  
  // Find the last point before this period starts
  const lastPrePeriodPoint = prePeriodData.reduce((latest, point) => {
    return point.cumulativeIncome > latest.cumulativeIncome ? point : latest
  })
  
  return {
    lacey: lastPrePeriodPoint.sites?.lacey || 0,
    centralia: lastPrePeriodPoint.sites?.centralia || 0,
    aberdeen: lastPrePeriodPoint.sites?.aberdeen || 0
  }
}

// Helper function to calculate median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Calculate combined statistics for historical site data
function calculateSiteCombinedStats(
  allHistoricalSiteData: YTDPointWithSites[][],
  statistic: 'mean' | 'median' | null = null,
  errorType: 'std' | 'ci' | null = null
): { 
  lacey: { mean: YTDPointWithSites[], upperBound: YTDPointWithSites[], lowerBound: YTDPointWithSites[] },
  centralia: { mean: YTDPointWithSites[], upperBound: YTDPointWithSites[], lowerBound: YTDPointWithSites[] },
  aberdeen: { mean: YTDPointWithSites[], upperBound: YTDPointWithSites[], lowerBound: YTDPointWithSites[] }
} {
  const siteCombinedStats = {
    lacey: { mean: [] as YTDPointWithSites[], upperBound: [] as YTDPointWithSites[], lowerBound: [] as YTDPointWithSites[] },
    centralia: { mean: [] as YTDPointWithSites[], upperBound: [] as YTDPointWithSites[], lowerBound: [] as YTDPointWithSites[] },
    aberdeen: { mean: [] as YTDPointWithSites[], upperBound: [] as YTDPointWithSites[], lowerBound: [] as YTDPointWithSites[] }
  }
  
  if (allHistoricalSiteData.length === 0) return siteCombinedStats
  
  // Create a map of monthDay -> values for each site across all years
  const monthDayMap = new Map<string, { lacey: number[], centralia: number[], aberdeen: number[] }>()
  
  allHistoricalSiteData.forEach(yearData => {
    yearData.forEach(point => {
      if (!point.sites) return
      
      if (!monthDayMap.has(point.monthDay)) {
        monthDayMap.set(point.monthDay, { lacey: [], centralia: [], aberdeen: [] })
      }
      
      const dayData = monthDayMap.get(point.monthDay)!
      dayData.lacey.push(point.sites.lacey)
      dayData.centralia.push(point.sites.centralia)
      dayData.aberdeen.push(point.sites.aberdeen)
    })
  })
  
  // Calculate statistics for each monthDay
  const sortedMonthDays = Array.from(monthDayMap.keys()).sort()
  
  for (const monthDay of sortedMonthDays) {
    const dayData = monthDayMap.get(monthDay)!
    
    // Calculate stats for each site
    const sites = ['lacey', 'centralia', 'aberdeen'] as const
    
    sites.forEach(site => {
      const values = dayData[site]
      if (values.length === 0) return
      
      // Calculate center statistic (mean or median), default to mean if null
      const center = statistic === 'median'
        ? calculateMedian(values)
        : values.reduce((sum, val) => sum + val, 0) / values.length
      
      // Calculate standard deviation (needed for both std and CI)
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)
      
      // Calculate error margin based on type (if errorType is not null)
      const errorMargin = errorType === 'ci'
        ? 1.96 * stdDev  // 95% confidence interval
        : errorType === 'std'
        ? stdDev         // Standard deviation
        : 0              // No error if null
      
      const upperBound = center + errorMargin
      const lowerBound = center - errorMargin
      
      const totalCenter = center + siteCombinedStats.lacey.mean.reduce((sum, p) => sum + (p.sites?.[site] || 0), 0) +
                       siteCombinedStats.centralia.mean.reduce((sum, p) => sum + (p.sites?.[site] || 0), 0) +
                       siteCombinedStats.aberdeen.mean.reduce((sum, p) => sum + (p.sites?.[site] || 0), 0)
      
      siteCombinedStats[site].mean.push({
        date: `2025-${monthDay}`, // Approximate date
        monthDay,
        cumulativeIncome: totalCenter,
        sites: { lacey: site === 'lacey' ? center : 0, centralia: site === 'centralia' ? center : 0, aberdeen: site === 'aberdeen' ? center : 0 }
      })
      
      siteCombinedStats[site].upperBound.push({
        date: `2025-${monthDay}`,
        monthDay,
        cumulativeIncome: totalCenter,
        sites: { lacey: site === 'lacey' ? upperBound : 0, centralia: site === 'centralia' ? upperBound : 0, aberdeen: site === 'aberdeen' ? upperBound : 0 }
      })
      
      siteCombinedStats[site].lowerBound.push({
        date: `2025-${monthDay}`,
        monthDay,
        cumulativeIncome: totalCenter,
        sites: { lacey: site === 'lacey' ? lowerBound : 0, centralia: site === 'centralia' ? lowerBound : 0, aberdeen: site === 'aberdeen' ? lowerBound : 0 }
      })
    })
  }
  
  return siteCombinedStats
}

export const buildSiteLineTraces = ({
  showCombined,
  processedHistoricalData,
  isNormalized,
  is2025Visible,
  timeframe,
  currentPeriod,
  fy2025,
  combineStatistic = null,
  combineError = null,
  visibleSites,
  selectedYears = [],
  colorScheme = 'gray'
}: SiteLineChartBuilderProps) => {
  const traces: any[] = []
  const SITE_COLORS = getSiteColors(colorScheme)

  // Helper to check if a site is visible
  const isSiteVisible = (siteKey: 'lacey' | 'centralia' | 'aberdeen') => {
    return visibleSites ? visibleSites[siteKey] : true
  }

  // Use thicker line if only one year is selected
  const lineWidth = selectedYears.length === 1 ? 3 : HISTORICAL_YEAR_LINE_WIDTH
  
  // Get historical site data for all years
  const allHistoricalSiteData: YTDPointWithSites[][] = []
  const historicalYearLabels: string[] = []
  
  // Extract site data for each historical year (2016-2024)
  for (const { year } of processedHistoricalData) {
    if (parseInt(year) >= 2016 && parseInt(year) <= 2024) {
      const yearSiteData = getSiteMonthlyEndPoints(year)
      if (yearSiteData.length > 0) {
        const processed = processSiteDataForTimeframe(yearSiteData, timeframe, currentPeriod, isNormalized)
        allHistoricalSiteData.push(processed)
        historicalYearLabels.push(year)
      }
    }
  }
  
  // Get 2025 actual site data
  const actual2025SiteData = get2025SiteMonthlyEndPoints()
  
  // Get projected site data
  const projectedSiteData = generateProjectedSiteMonthlyPoints(actual2025SiteData, fy2025)
  
  // Compute projected total for the relevant period using combined actual+projected series
  const projectedPeriodTotal = computeProjectedPeriodTotal(
    actual2025SiteData,
    projectedSiteData,
    timeframe,
    currentPeriod
  )

  // Compute period-start site values from combined series for correct baseline in mixed periods
  const periodStartSitesOverride = (timeframe !== 'year')
    ? computePeriodStartSitesCombined(actual2025SiteData, projectedSiteData, timeframe as 'quarter' | 'month', currentPeriod)
    : undefined
  
  // Process data with projected total as normalization reference for 2025 actual data
  const processed2025Data = processSiteDataForTimeframe(
    actual2025SiteData, 
    timeframe, 
    currentPeriod, 
    isNormalized, 
    isNormalized ? projectedPeriodTotal : undefined,
    periodStartSitesOverride
  )
  const processedProjectedData = processSiteDataForTimeframe(
    projectedSiteData, 
    timeframe, 
    currentPeriod, 
    isNormalized,
    isNormalized ? projectedPeriodTotal : undefined,
    periodStartSitesOverride
  )
  
  // Build traces based on showCombined setting
  if (showCombined && allHistoricalSiteData.length > 0) {
    // Combined mode: show historical mean/median with confidence bands for each site
    const siteCombinedStats = calculateSiteCombinedStats(allHistoricalSiteData, combineStatistic, combineError)
    
    const sites = [
      { key: 'lacey' as const, name: 'Lacey', color: SITE_COLORS.lacey },
      { key: 'centralia' as const, name: 'Centralia', color: SITE_COLORS.centralia },
      { key: 'aberdeen' as const, name: 'Aberdeen', color: SITE_COLORS.aberdeen }
    ]
    
    sites.forEach(({ key, name, color }) => {
      const stats = siteCombinedStats[key]
      
      if (stats.mean.length > 0) {
        const meanX = stats.mean.map(p => p.monthDay)
        const meanY = stats.mean.map(p => p.sites?.[key] || 0)
        const upperY = stats.upperBound.map(p => p.sites?.[key] || 0)
        const lowerY = stats.lowerBound.map(p => p.sites?.[key] || 0)
        
        const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
        const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'Std Dev' : ''

        // Calculate error margins for customdata if needed
        const errorMargins = combineError
          ? meanY.map((mean, i) => Math.abs(upperY[i] - mean))
          : []

        // Only add error bands if combineError is not null
        if (combineError) {
          traces.push(
            // Error band (upper)
            {
              x: meanX,
              y: upperY,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: `${name} ${labelSuffix} + ${errorLabel}`,
              line: { color: 'rgba(0,0,0,0)' },
              visible: isSiteVisible(key),
              showlegend: false,
              hoverinfo: 'skip' as const
            },
            // Error band (lower)
            {
              x: meanX,
              y: lowerY,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: `${name} ${labelSuffix} - ${errorLabel}`,
              line: { color: 'rgba(0,0,0,0)' },
              fill: 'tonexty' as const,
              fillcolor: color.historical.replace('0.7)', '0.2)'), // Make fill more transparent
              visible: isSiteVisible(key),
              showlegend: false,
              hoverinfo: 'skip' as const
            }
          )
        }

        // Create custom text for hover to preserve Mon-D format
        const hoverText = stats.mean.map((p: YTDPointWithSites) => {
          const [month, day] = p.monthDay.split('-')
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthName = monthNames[parseInt(month) - 1]
          return `${monthName}-${parseInt(day)}`
        })

        // Mean/Median line
        const errorSymbol = combineError === 'std' ? '(\u03C3)' : '' // σ symbol in parentheses
        const errorLabelForHover = combineError === 'ci' ? '(95% CI)' : errorSymbol

        traces.push({
          x: meanX,
          y: meanY,
          text: hoverText,
          customdata: combineError ? errorMargins : undefined,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${name} Historical ${labelSuffix} (2016-2024)`,
          line: { color: desaturateColor(color.historical, SITE_DESATURATION), width: 2 },
          visible: isSiteVisible(key),
          opacity: isSiteVisible(key) ? 1 : 0.2,
          hovertemplate: combineError
            ? (isNormalized
                ? `${name} Historical ${labelSuffix} %{text}<br>%{y:.1f}% ± %{customdata:.1f}% ${errorLabelForHover}<extra></extra>`
                : `${name} Historical ${labelSuffix} %{text}<br>$%{y:,.0f} ± $%{customdata:,.0f} ${errorLabelForHover}<extra></extra>`)
            : (isNormalized
                ? `${name} Historical ${labelSuffix} %{text}<br>%{y:.1f}%<extra></extra>`
                : `${name} Historical ${labelSuffix} %{text}<br>$%{y:,.0f}<extra></extra>`)
        })
      }
    })
  } else {
    // Individual years mode: show each historical year as separate faded lines
    allHistoricalSiteData.forEach((yearSiteData, yearIndex) => {
      const year = historicalYearLabels[yearIndex]
      
      const sites = [
        { key: 'lacey' as const, name: 'Lacey', color: SITE_COLORS.lacey },
        { key: 'centralia' as const, name: 'Centralia', color: SITE_COLORS.centralia },
        { key: 'aberdeen' as const, name: 'Aberdeen', color: SITE_COLORS.aberdeen }
      ]
      
      sites.forEach(({ key, name, color }) => {
        const xData = yearSiteData.map(p => p.monthDay)
        const yData = yearSiteData.map(p => p.sites?.[key] || 0)
        // Create custom text for hover to preserve Mon-D format
        const hoverText = yearSiteData.map((p: YTDPointWithSites) => {
          const [month, day] = p.monthDay.split('-')
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthName = monthNames[parseInt(month) - 1]
          return `${monthName}-${parseInt(day)}`
        })

        traces.push({
          x: xData,
          y: yData,
          text: hoverText,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${name} ${year}`,
          line: { color: desaturateColor(color.historical, SITE_DESATURATION), width: lineWidth },
          visible: isSiteVisible(key),
          opacity: isSiteVisible(key) ? 1 : 0.2,
          hovertemplate: isNormalized
            ? `${name} ${year} %{text}<br>%{y:.1f}%<extra></extra>`
            : `${name} ${year} %{text}<br>$%{y:,.0f}<extra></extra>`
        })
      })
    })
  }
  
  // Add 2025 actual data traces (brighter colors)
  if (processed2025Data.length > 0) {
    const sites = [
      { key: 'lacey' as const, name: 'Lacey', color: SITE_COLORS.lacey },
      { key: 'centralia' as const, name: 'Centralia', color: SITE_COLORS.centralia },
      { key: 'aberdeen' as const, name: 'Aberdeen', color: SITE_COLORS.aberdeen }
    ]
    
    sites.forEach(({ key, name, color }) => {
      const xData = processed2025Data.map(p => p.monthDay)
      const yData = processed2025Data.map(p => p.sites?.[key] || 0)
      // Create custom text for hover to preserve Mon-D format
      const hoverText = processed2025Data.map((p: YTDPointWithSites) => {
        const [month, day] = p.monthDay.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthName = monthNames[parseInt(month) - 1]
        return `${monthName}-${parseInt(day)}`
      })

      traces.push({
        x: xData,
        y: yData,
        text: hoverText,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${name} 2025 Therapy Income`,
        line: { color: color.current, width: 3 },
        visible: (is2025Visible && isSiteVisible(key)) ? true : 'legendonly',
        opacity: isSiteVisible(key) ? 1 : 0.2,
        hovertemplate: isNormalized
          ? `${name} 2025 %{text}<br>%{y:.1f}%<extra></extra>`
          : `${name} 2025 %{text}<br>$%{y:,.0f}<extra></extra>`
      })
    })
  }
  
  // Add projected data traces (dotted lines)
  if (processedProjectedData.length > 0) {
    const sites = [
      { key: 'lacey' as const, name: 'Lacey', color: SITE_COLORS.lacey },
      { key: 'centralia' as const, name: 'Centralia', color: SITE_COLORS.centralia },
      { key: 'aberdeen' as const, name: 'Aberdeen', color: SITE_COLORS.aberdeen }
    ]
    
    sites.forEach(({ key, name, color }) => {
      const xData = processedProjectedData.map(p => p.monthDay)
      const yData = processedProjectedData.map(p => p.sites?.[key] || 0)
      // Create custom text for hover to preserve Mon-D format
      const hoverText = processedProjectedData.map((p: YTDPointWithSites) => {
        const [month, day] = p.monthDay.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthName = monthNames[parseInt(month) - 1]
        return `${monthName}-${parseInt(day)}`
      })

      traces.push({
        x: xData,
        y: yData,
        text: hoverText,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${name} 2025 Projected`,
        line: {
          color: color.current,
          width: 2,
          dash: 'dot' // Dotted line for projections
        },
        visible: (is2025Visible && isSiteVisible(key)) ? true : 'legendonly',
        opacity: isSiteVisible(key) ? 1 : 0.2,
        hovertemplate: isNormalized
          ? `${name} 2025 Projected %{text}<br>%{y:.1f}%<extra></extra>`
          : `${name} 2025 Projected %{text}<br>$%{y:,.0f}<extra></extra>`
      })
    })
  }
  
  return traces
}

// Pulsing traces for site data (identical to total mode, just different colors per site)
export const buildSitePulsingTraces = (
  is2025Visible: boolean,
  pulsePhase: number,
  isNormalized: boolean,
  timeframe: 'year' | 'quarter' | 'month',
  currentPeriod: { year: number, quarter?: number, month?: number },
  fy2025: any,
  visibleSites?: { lacey: boolean, centralia: boolean, aberdeen: boolean },
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare' = 'gray'
) => {
  if (!is2025Visible) return []
  const SITE_COLORS = getSiteColors(colorScheme)

  // Helper to check if a site is visible
  const isSiteVisible = (siteKey: 'lacey' | 'centralia' | 'aberdeen') => {
    return visibleSites ? visibleSites[siteKey] : true
  }

  const actual2025SiteData = get2025SiteMonthlyEndPoints()
  
  // Calculate projected total for normalization using combined series (same as line traces)
  const projectedSiteData = generateProjectedSiteMonthlyPoints(actual2025SiteData, fy2025)
  const projectedPeriodTotal = computeProjectedPeriodTotal(
    actual2025SiteData,
    projectedSiteData,
    timeframe,
    currentPeriod
  )

  const periodStartSitesOverride = (timeframe !== 'year')
    ? computePeriodStartSitesCombined(actual2025SiteData, projectedSiteData, timeframe as 'quarter' | 'month', currentPeriod)
    : undefined
  
  const processed2025Data = processSiteDataForTimeframe(
    actual2025SiteData, 
    timeframe, 
    currentPeriod, 
    isNormalized,
    isNormalized ? projectedPeriodTotal : undefined,
    periodStartSitesOverride
  )
  
  if (processed2025Data.length === 0) return []
  
  const rings: any[] = []
  const sites = [
    { key: 'lacey' as const, name: 'Lacey', color: SITE_COLORS.lacey },
    { key: 'centralia' as const, name: 'Centralia', color: SITE_COLORS.centralia },
    { key: 'aberdeen' as const, name: 'Aberdeen', color: SITE_COLORS.aberdeen }
  ]
  
  // Find the true last day of actual data (not filtered by timeframe)
  const lastActualPoint = actual2025SiteData[actual2025SiteData.length - 1]
  if (!lastActualPoint?.sites) return []
  
  // Check if the last actual data point falls within the current timeframe view
  const isLastPointInCurrentTimeframe = processed2025Data.some(p => p.monthDay === lastActualPoint.monthDay)
  if (!isLastPointInCurrentTimeframe) return [] // Don't show radar if last point is outside current timeframe
  
  // Find the corresponding processed point for this date (for proper normalization/period values)
  const lastPoint = processed2025Data.find(p => p.monthDay === lastActualPoint.monthDay) || processed2025Data[processed2025Data.length - 1]
  if (!lastPoint.sites) return []
  
  // Create pulsing effects for each site at their last data point (same as total mode)
  sites.forEach(({ key, name, color }) => {
    const yValue = lastPoint.sites![key]
    
    // Create expanding rings with different phases (same as total mode)
    for (let i = 0; i < RADAR_CONFIG.rings.count; i++) {
      const phaseOffset = i * RADAR_CONFIG.rings.stagger // Stagger each ring
      const ringPhase = (pulsePhase + phaseOffset) % RADAR_CONFIG.frameCount
      const progress = ringPhase / RADAR_CONFIG.frameCount // 0 to 1
      
      // Each ring expands from small to large and fades out (same as total mode)
      const size = RADAR_CONFIG.rings.baseSize + progress * RADAR_CONFIG.rings.maxGrowth
      const opacity = Math.max(0, RADAR_CONFIG.rings.baseOpacity * (1 - progress)) // Fade out as it expands
      
      // Only show ring if it has meaningful opacity and site is visible
      if (opacity > 0.01 && isSiteVisible(key)) {
        rings.push({
          x: [lastActualPoint.monthDay],
          y: [yValue],
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: `${name} Radar Ring ${i}`,
          marker: {
            color: `rgba(${hexToRgb(color.current)}, ${opacity})`,
            size: size,
            line: { color: `rgba(${hexToRgb(color.current)}, ${Math.min(opacity + 0.15, 0.6)})`, width: 1 }
          },
          showlegend: false,
          hoverinfo: 'skip' as const
        })
      }
    }
    
    // Add the solid center marker (same as total mode)
    if (isSiteVisible(key)) {
      // Create custom text for hover to preserve Mon-D format
      const [month, day] = lastActualPoint.monthDay.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[parseInt(month) - 1]
      const hoverText = `${monthName}-${parseInt(day)}`

      rings.push({
        x: [lastActualPoint.monthDay],
        y: [yValue],
        text: [hoverText],
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: `${name} Current Position`,
        marker: {
          color: color.current,
          size: RADAR_CONFIG.rings.baseSize,
          line: { color: '#ffffff', width: 1 }
        },
        showlegend: false,
        hovertemplate: isNormalized
          ? `${name} Latest: %{text}<br>%{y:.1f}%<extra></extra>`
          : `${name} Latest: %{text}<br>$%{y:,.0f}<extra></extra>`
      })
    }
  })
  
  return rings
}

// Helper function to convert hex color to RGB values
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}
