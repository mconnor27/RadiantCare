import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import type { SiteData, FutureYear } from '../../../shared/types'
import {
  estimateSiteBreakdownForYear,
  generateProjectedSiteData,
  parseSiteIncomeFromSummary
} from '../../../../../historical_data/siteIncomeParser'
import { SITE_COLORS, SITE_PROJECTED_PATTERNS } from '../config/chartConfig'
import { getSiteYearTotals, getSiteQuarterTotals, getSiteMonthTotals } from '../../../../../historical_data/siteIncomeParser'
import { 
  getYearlyTotals, 
  getQuarterlyTotals, 
  getMonthlyTotals
} from '../utils/aggregations'
import { getTotalIncome } from '../../../shared/calculations'

interface SiteBarChartDataProps {
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
  projectedIncomeData: YTDPoint[]
  fy2025: FutureYear | undefined
  combineStatistic?: 'mean' | 'median' | null
  combineError?: 'std' | 'ci' | null
}


export const buildSiteBarChartData = ({
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
  projectedIncomeData,
  fy2025,
  combineStatistic = null,
  combineError = null
}: SiteBarChartDataProps) => {
  
  if (timeframe === 'year') {
    // Year mode: each year is an x-axis tick with 3 stacked bars per site
    const actualData2025 = data.filter(p => p.date !== 'Total')
    const actual2025Total = actualData2025.length > 0 ? actualData2025[actualData2025.length - 1]?.cumulativeIncome || 0 : 0
    const projected2025Total = projectedIncomeData.length > 0 ? projectedIncomeData[projectedIncomeData.length - 1]?.cumulativeIncome || 0 : 0

    // Get yearly totals for historical data
    const yearlyHistorical = getYearlyTotals(processedHistoricalData)
    
    // Convert to site-specific data using actual historical site totals
    const historicalSiteData = yearlyHistorical.map(yearData => ({
      year: yearData.year,
      sites: getSiteYearTotals(yearData.year)
    }))
    
    // Get current year site data
    const current2025Sites = actual2025Total > 0 
      ? parseSiteIncomeFromSummary()[0]?.sites || estimateSiteBreakdownForYear(actual2025Total, '2025')
      : { lacey: 0, centralia: 0, aberdeen: 0 }
    
    // Get projected site data
    const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : projected2025Total
    const projected2025Sites: SiteData = (fy2025 && (typeof (fy2025 as any).therapyLacey === 'number' || typeof (fy2025 as any).therapyCentralia === 'number' || typeof (fy2025 as any).therapyAberdeen === 'number'))
      ? {
          lacey: Number((fy2025 as any).therapyLacey || 0),
          centralia: Number((fy2025 as any).therapyCentralia || 0),
          aberdeen: Number((fy2025 as any).therapyAberdeen || 0)
        }
      : generateProjectedSiteData(projectedTotalIncome, current2025Sites)
    
    // Calculate projected increment (projected - actual)
    const projectedIncrementSites = {
      lacey: projected2025Sites.lacey - current2025Sites.lacey,
      centralia: projected2025Sites.centralia - current2025Sites.centralia,
      aberdeen: projected2025Sites.aberdeen - current2025Sites.aberdeen
    }
    
    if (showCombined) {
      // For combined mode: show mean/median with std dev/CI for each site
      const laceyIncomes = historicalSiteData.map(h => h.sites.lacey)
      const centraliaIncomes = historicalSiteData.map(h => h.sites.centralia)  
      const aberdeenIncomes = historicalSiteData.map(h => h.sites.aberdeen)
      
      const calculateMedian = (values: number[]): number => {
        if (values.length === 0) return 0
        const sorted = [...values].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      }
      
      const calculateStats = (values: number[]) => {
        const center = combineStatistic === 'median' 
          ? calculateMedian(values)
          : values.reduce((sum, val) => sum + val, 0) / values.length
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)
        const error = combineError === 'ci' ? 1.96 * stdDev : stdDev
        return { center, error }
      }
      
      const laceyStats = calculateStats(laceyIncomes)
      const centraliaStats = calculateStats(centraliaIncomes)
      const aberdeenStats = calculateStats(aberdeenIncomes)
      
      const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
      
      return {
        historical: [
          { site: 'Lacey', period: `Historical ${labelSuffix} (2016-2024)`, income: laceyStats.center, error: laceyStats.error },
          { site: 'Centralia', period: `Historical ${labelSuffix} (2016-2024)`, income: centraliaStats.center, error: centraliaStats.error },
          { site: 'Aberdeen', period: `Historical ${labelSuffix} (2016-2024)`, income: aberdeenStats.center, error: aberdeenStats.error }
        ],
        current: [
          { site: 'Lacey', period: '2025', income: current2025Sites.lacey },
          { site: 'Centralia', period: '2025', income: current2025Sites.centralia },
          { site: 'Aberdeen', period: '2025', income: current2025Sites.aberdeen }
        ],
        projected: [
          { site: 'Lacey', period: '2025 Projected', income: projectedIncrementSites.lacey },
          { site: 'Centralia', period: '2025 Projected', income: projectedIncrementSites.centralia },
          { site: 'Aberdeen', period: '2025 Projected', income: projectedIncrementSites.aberdeen }
        ]
      }
    }
    
    // Individual year mode
    const allYearSiteData = [
      ...historicalSiteData,
      { year: '2025', sites: current2025Sites }
    ]
    
    return {
      individual: allYearSiteData,
      projected: [{
        year: '2025 Projected',
        sites: projectedIncrementSites
      }]
    }
  }
  
  if (timeframe === 'quarter') {
    // Quarter mode: each quarter is an x-axis tick with 3 stacked bars per site
    
    // Get quarterly totals for historical data using RAW data (not filtered by current quarter)
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
    
    if (showCombined) {
      // For combined mode: calculate quarterly statistics across all years for each site using REAL SITE DATA
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const
      const historicalSiteQuarters = quarters.map(quarter => {
        // Get real site data for this quarter across all historical years
        const siteSamples = historicalDataRaw.map(({ year }) => {
          const yearQuarters = getSiteQuarterTotals(year)
          return yearQuarters.find(q => q.quarter === quarter)?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
        })
        
        // Calculate center statistic and error for each site
        const calculateMedian = (values: number[]): number => {
          if (values.length === 0) return 0
          const sorted = [...values].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        }
        
        const calculateStats = (values: number[]) => {
          const center = combineStatistic === 'median' 
            ? calculateMedian(values)
            : values.reduce((sum, val) => sum + val, 0) / values.length
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
          const stdDev = Math.sqrt(variance)
          const error = combineError === 'ci' ? 1.96 * stdDev : stdDev
          return { center, error }
        }
        
        const laceyStats = calculateStats(siteSamples.map(s => s.lacey))
        const centraliaStats = calculateStats(siteSamples.map(s => s.centralia))
        const aberdeenStats = calculateStats(siteSamples.map(s => s.aberdeen))
        
        return {
          quarter,
          sites: {
            lacey: laceyStats.center,
            centralia: centraliaStats.center,
            aberdeen: aberdeenStats.center
          },
          errors: {
            lacey: laceyStats.error,
            centralia: centraliaStats.error,
            aberdeen: aberdeenStats.error
          }
        }
      })
      
      // Current 2025 quarterly data with REAL site breakdown
      const current2025SiteQuarters = getSiteQuarterTotals('2025')
      
      // Get projected quarterly data using the proper projected data (not naive division)
      const projectedQuarterly2025 = getQuarterlyTotals(projectedIncomeData)
      
      // Calculate projected increment per quarter using PROJECTED site data from grid/store
      // Only show projections for incomplete quarters (current quarter if incomplete + future quarters)
      const currentDate = new Date()
      const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1
      const currentMonth = currentDate.getMonth() + 1
      
      // Get projected site data from grid/store (same as year mode)
      const current2025SitesQuarter = parseSiteIncomeFromSummary()[0]?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
      const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : 0
      const projected2025Sites: SiteData = (fy2025 && (typeof (fy2025 as any).therapyLacey === 'number' || typeof (fy2025 as any).therapyCentralia === 'number' || typeof (fy2025 as any).therapyAberdeen === 'number'))
        ? {
            lacey: Number((fy2025 as any).therapyLacey || 0),
            centralia: Number((fy2025 as any).therapyCentralia || 0),
            aberdeen: Number((fy2025 as any).therapyAberdeen || 0)
          }
        : generateProjectedSiteData(projectedTotalIncome, current2025SitesQuarter)
      
      // Calculate total projected increment per site for the year
      const projectedIncrementSites = {
        lacey: projected2025Sites.lacey - current2025SitesQuarter.lacey,
        centralia: projected2025Sites.centralia - current2025SitesQuarter.centralia,
        aberdeen: projected2025Sites.aberdeen - current2025SitesQuarter.aberdeen
      }
      
      const projectedSiteQuarters = current2025SiteQuarters.map((actualQuarter, index) => {
        const projectedQuarter = projectedQuarterly2025[index]
        const actualTotal = actualQuarter.sites.lacey + actualQuarter.sites.centralia + actualQuarter.sites.aberdeen
        const quarterIncrementTotal = (projectedQuarter?.income || 0) - actualTotal
        
        // Determine if this quarter needs projection
        const quarterNum = index + 1
        const isCurrentQuarter = quarterNum === currentQuarter
        const isFutureQuarter = quarterNum > currentQuarter
        
        // For current quarter, check if it's complete (we're past the last month of the quarter)
        const quarterEndMonth = quarterNum * 3
        const isCurrentQuarterComplete = isCurrentQuarter && currentMonth > quarterEndMonth
        
        // Only show projection if it's a future quarter or current incomplete quarter
        const shouldShowProjection = isFutureQuarter || (isCurrentQuarter && !isCurrentQuarterComplete)
        
        // Use projected site proportions to distribute the quarter increment
        const totalProjectedIncrement = projectedIncrementSites.lacey + projectedIncrementSites.centralia + projectedIncrementSites.aberdeen
        const proportions = totalProjectedIncrement > 0 ? {
          lacey: projectedIncrementSites.lacey / totalProjectedIncrement,
          centralia: projectedIncrementSites.centralia / totalProjectedIncrement,
          aberdeen: projectedIncrementSites.aberdeen / totalProjectedIncrement
        } : { lacey: 0.4, centralia: 0.35, aberdeen: 0.25 }
        
        return {
          quarter: actualQuarter.quarter,
          sites: {
            lacey: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.lacey) : 0,
            centralia: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.centralia) : 0, 
            aberdeen: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.aberdeen) : 0
          }
        }
      })
      
      return {
        historical: historicalSiteQuarters,
        current: current2025SiteQuarters, 
        projected: projectedSiteQuarters
      }
    }
    
    // Individual quarter mode: show all historical years + 2025
    const allYearQuarterData = historicalDataRaw.map(({ year }) => ({
      year,
      quarters: getSiteQuarterTotals(year).map(q => ({
        quarter: q.quarter,
        sites: q.sites
      }))
    }))
    
    // Add 2025 current data with REAL site breakdown
    const current2025Data = {
      year: '2025',
      quarters: getSiteQuarterTotals('2025')
    }
    
    // Calculate projected increments for 2025 using proper projected data
    const projectedQuarterly2025 = getQuarterlyTotals(projectedIncomeData)
    
    const current2025SiteQuarters = getSiteQuarterTotals('2025')
    
    // Only show projections for incomplete quarters using PROJECTED site data from grid/store
    const currentDate = new Date()
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1
    const currentMonth = currentDate.getMonth() + 1
    
    // Get projected site data from grid/store (same as year mode)
    const current2025SitesIndividual = parseSiteIncomeFromSummary()[0]?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
    const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : 0
    const projected2025Sites: SiteData = (fy2025 && (typeof (fy2025 as any).therapyLacey === 'number' || typeof (fy2025 as any).therapyCentralia === 'number' || typeof (fy2025 as any).therapyAberdeen === 'number'))
      ? {
          lacey: Number((fy2025 as any).therapyLacey || 0),
          centralia: Number((fy2025 as any).therapyCentralia || 0),
          aberdeen: Number((fy2025 as any).therapyAberdeen || 0)
        }
      : generateProjectedSiteData(projectedTotalIncome, current2025SitesIndividual)
    
    // Calculate total projected increment per site for the year
    const projectedIncrementSites = {
      lacey: projected2025Sites.lacey - current2025SitesIndividual.lacey,
      centralia: projected2025Sites.centralia - current2025SitesIndividual.centralia,
      aberdeen: projected2025Sites.aberdeen - current2025SitesIndividual.aberdeen
    }
    
    const projected2025Data = {
      year: '2025 Projected',
      quarters: current2025SiteQuarters.map((actualQuarter, index) => {
        const projectedQuarter = projectedQuarterly2025[index]
        const actualTotal = actualQuarter.sites.lacey + actualQuarter.sites.centralia + actualQuarter.sites.aberdeen
        const quarterIncrementTotal = (projectedQuarter?.income || 0) - actualTotal
        
        // Determine if this quarter needs projection
        const quarterNum = index + 1
        const isCurrentQuarter = quarterNum === currentQuarter
        const isFutureQuarter = quarterNum > currentQuarter
        
        // For current quarter, check if it's complete (we're past the last month of the quarter)
        const quarterEndMonth = quarterNum * 3
        const isCurrentQuarterComplete = isCurrentQuarter && currentMonth > quarterEndMonth
        
        // Only show projection if it's a future quarter or current incomplete quarter
        const shouldShowProjection = isFutureQuarter || (isCurrentQuarter && !isCurrentQuarterComplete)
        
        // Use projected site proportions to distribute the quarter increment
        const totalProjectedIncrement = projectedIncrementSites.lacey + projectedIncrementSites.centralia + projectedIncrementSites.aberdeen
        const proportions = totalProjectedIncrement > 0 ? {
          lacey: projectedIncrementSites.lacey / totalProjectedIncrement,
          centralia: projectedIncrementSites.centralia / totalProjectedIncrement,
          aberdeen: projectedIncrementSites.aberdeen / totalProjectedIncrement
        } : { lacey: 0.4, centralia: 0.35, aberdeen: 0.25 }
        
        return {
          quarter: actualQuarter.quarter,
          sites: {
            lacey: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.lacey) : 0,
            centralia: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.centralia) : 0,
            aberdeen: shouldShowProjection ? Math.max(0, quarterIncrementTotal * proportions.aberdeen) : 0
          }
        }
      })
    }
    
    return {
      individual: [...allYearQuarterData, current2025Data],
      projected: [projected2025Data]
    }
  }
  
  if (timeframe === 'month') {
    // Month mode: each month is an x-axis tick with 3 stacked bars per site
    const actualData2025 = data.filter(p => p.date !== 'Total')
    const current2025MonthlyTotals = getMonthlyTotals(actualData2025)

    // Get monthly totals for historical data using RAW data (not filtered by current month)
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
    
    
    if (showCombined) {
      // For combined mode: calculate monthly statistics across all years for each site using REAL SITE DATA
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const historicalSiteMonths = months.map(month => {
        // Get real site data for this month across all historical years
        const siteSamples = historicalDataRaw.map(({ year }) => {
          const yearMonths = getSiteMonthTotals(year)
          return yearMonths.find(m => m.month === month)?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
        })
        
        // Calculate center statistic and error for each site
        const calculateMedian = (values: number[]): number => {
          if (values.length === 0) return 0
          const sorted = [...values].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        }
        
        const calculateStats = (values: number[]) => {
          const center = combineStatistic === 'median' 
            ? calculateMedian(values)
            : values.reduce((sum, val) => sum + val, 0) / values.length
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
          const stdDev = Math.sqrt(variance)
          const error = combineError === 'ci' ? 1.96 * stdDev : stdDev
          return { center, error }
        }
        
        const laceyStats = calculateStats(siteSamples.map(s => s.lacey))
        const centraliaStats = calculateStats(siteSamples.map(s => s.centralia))
        const aberdeenStats = calculateStats(siteSamples.map(s => s.aberdeen))
        
        return {
          month,
          sites: {
            lacey: laceyStats.center,
            centralia: centraliaStats.center,
            aberdeen: aberdeenStats.center
          },
          errors: {
            lacey: laceyStats.error,
            centralia: centraliaStats.error,
            aberdeen: aberdeenStats.error
          }
        }
      })
      
      // Current 2025 monthly data with REAL site breakdown
      const current2025SiteMonths = getSiteMonthTotals('2025')
      
      // Get projected monthly data using the proper projected data (not naive division)
      const projectedMonthly2025 = getMonthlyTotals(projectedIncomeData)
      
      // Calculate projected increment per month using PROJECTED site data from grid/store
      // Only show projections for incomplete months (current month if incomplete + future months)
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1 // 1-based
      
      // Get projected site data from grid/store (same as year mode)
      const current2025SitesMonth = parseSiteIncomeFromSummary()[0]?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
      const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : 0
      const projected2025Sites: SiteData = (fy2025 && (typeof (fy2025 as any).therapyLacey === 'number' || typeof (fy2025 as any).therapyCentralia === 'number' || typeof (fy2025 as any).therapyAberdeen === 'number'))
        ? {
            lacey: Number((fy2025 as any).therapyLacey || 0),
            centralia: Number((fy2025 as any).therapyCentralia || 0),
            aberdeen: Number((fy2025 as any).therapyAberdeen || 0)
          }
        : generateProjectedSiteData(projectedTotalIncome, current2025SitesMonth)
      
      // Calculate total projected increment per site for the year
      const projectedIncrementSites = {
        lacey: projected2025Sites.lacey - current2025SitesMonth.lacey,
        centralia: projected2025Sites.centralia - current2025SitesMonth.centralia,
        aberdeen: projected2025Sites.aberdeen - current2025SitesMonth.aberdeen
      }
      
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const actualByMonth = new Map(current2025MonthlyTotals.map(m => [m.month, m.income]))
      const projectedSiteMonths = monthOrder.map((month, index) => {
        const projectedIncome = projectedMonthly2025.find(p => p.month === month)?.income || 0
        const actualIncome = actualByMonth.get(month) || 0
        const monthIncrementTotal = Math.max(0, projectedIncome - actualIncome)
        
        // Determine if this month needs projection
        const monthNum = index + 1
        const isCurrentMonth = monthNum === currentMonth
        const isFutureMonth = monthNum > currentMonth
        
        // For current month, we could check if it's complete (past the end of month)
        // But for simplicity, let's assume current month is incomplete and future months need projection
        const shouldShowProjection = isFutureMonth || isCurrentMonth
        
        // Use projected site proportions to distribute the month increment
        const totalProjectedIncrement = projectedIncrementSites.lacey + projectedIncrementSites.centralia + projectedIncrementSites.aberdeen
        const proportions = totalProjectedIncrement > 0 ? {
          lacey: projectedIncrementSites.lacey / totalProjectedIncrement,
          centralia: projectedIncrementSites.centralia / totalProjectedIncrement,
          aberdeen: projectedIncrementSites.aberdeen / totalProjectedIncrement
        } : { lacey: 0.4, centralia: 0.35, aberdeen: 0.25 }
        
        return {
          month,
          sites: {
            lacey: shouldShowProjection ? monthIncrementTotal * proportions.lacey : 0,
            centralia: shouldShowProjection ? monthIncrementTotal * proportions.centralia : 0, 
            aberdeen: shouldShowProjection ? monthIncrementTotal * proportions.aberdeen : 0
          }
        }
      })
      
      return {
        historical: historicalSiteMonths,
        current: current2025SiteMonths, 
        projected: projectedSiteMonths
      }
    }
    
    // Individual month mode: show all historical years + 2025
    const allYearMonthData = historicalDataRaw.map(({ year }) => ({
      year,
      months: getSiteMonthTotals(year).map(m => ({
        month: m.month,
        sites: m.sites
      }))
    }))
    
    // Add 2025 current data with REAL site breakdown
    const current2025Data = {
      year: '2025',
      months: getSiteMonthTotals('2025')
    }
    
    // Calculate projected increments for 2025 using proper projected data across all 12 months
    const projectedMonthly2025 = getMonthlyTotals(projectedIncomeData)
    
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const actualByMonth = new Map(current2025MonthlyTotals.map(m => [m.month, m.income]))
    
    // Only show projections for incomplete months using PROJECTED site data from grid/store
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1 // 1-based
    
    // Get projected site data from grid/store (same as year mode)
    const current2025SitesMonthIndividual = parseSiteIncomeFromSummary()[0]?.sites || { lacey: 0, centralia: 0, aberdeen: 0 }
    const projectedTotalIncome = fy2025 ? getTotalIncome(fy2025) : 0
    const projected2025Sites: SiteData = (fy2025 && (typeof (fy2025 as any).therapyLacey === 'number' || typeof (fy2025 as any).therapyCentralia === 'number' || typeof (fy2025 as any).therapyAberdeen === 'number'))
      ? {
          lacey: Number((fy2025 as any).therapyLacey || 0),
          centralia: Number((fy2025 as any).therapyCentralia || 0),
          aberdeen: Number((fy2025 as any).therapyAberdeen || 0)
        }
      : generateProjectedSiteData(projectedTotalIncome, current2025SitesMonthIndividual)
    
    // Calculate total projected increment per site for the year
    const projectedIncrementSites = {
      lacey: projected2025Sites.lacey - current2025SitesMonthIndividual.lacey,
      centralia: projected2025Sites.centralia - current2025SitesMonthIndividual.centralia,
      aberdeen: projected2025Sites.aberdeen - current2025SitesMonthIndividual.aberdeen
    }
    
    const projected2025Data = {
      year: '2025 Projected',
      months: monthOrder.map((month, index) => {
        const projectedIncome = projectedMonthly2025.find(p => p.month === month)?.income || 0
        const actualIncome = actualByMonth.get(month) || 0
        const monthIncrementTotal = Math.max(0, projectedIncome - actualIncome)
        
        // Determine if this month needs projection
        const monthNum = index + 1
        const isCurrentMonth = monthNum === currentMonth
        const isFutureMonth = monthNum > currentMonth
        
        // For current month, we could check if it's complete (past the end of month)
        // But for simplicity, let's assume current month is incomplete and future months need projection
        const shouldShowProjection = isFutureMonth || isCurrentMonth
        
        // Use projected site proportions to distribute the month increment
        const totalProjectedIncrement = projectedIncrementSites.lacey + projectedIncrementSites.centralia + projectedIncrementSites.aberdeen
        const proportions = totalProjectedIncrement > 0 ? {
          lacey: projectedIncrementSites.lacey / totalProjectedIncrement,
          centralia: projectedIncrementSites.centralia / totalProjectedIncrement,
          aberdeen: projectedIncrementSites.aberdeen / totalProjectedIncrement
        } : { lacey: 0.4, centralia: 0.35, aberdeen: 0.25 }
        
        return {
          month,
          sites: {
            lacey: shouldShowProjection ? monthIncrementTotal * proportions.lacey : 0,
            centralia: shouldShowProjection ? monthIncrementTotal * proportions.centralia : 0,
            aberdeen: shouldShowProjection ? monthIncrementTotal * proportions.aberdeen : 0
          }
        }
      })
    }
    
    return {
      individual: [...allYearMonthData, current2025Data],
      projected: [projected2025Data]
    }
  }
  
  // For unsupported timeframes, return empty structure
  return {
    historical: [],
    current: [],
    projected: [],
    individual: []
  }
}

export const buildSiteBarChartTraces = (
  siteBarChartData: any,
  timeframe: 'year' | 'quarter' | 'month',
  showCombined: boolean,
  isNormalized: boolean,
  combineStatistic: 'mean' | 'median' | null = null,
  combineError: 'std' | 'ci' | null = null
) => {
  const traces: any[] = []
  
  // Helpers for normalization
  const sumSites = (sites: SiteData) => (sites?.lacey || 0) + (sites?.centralia || 0) + (sites?.aberdeen || 0)
  const percentArray = (values: number[], denom: number) => {
    if (!isNormalized || denom <= 0) return values
    return values.map(v => (v / denom) * 100)
  }
  const percentErrors = (errors: number[], denom: number) => {
    if (!isNormalized || denom <= 0) return errors
    return errors.map(e => (e / denom) * 100)
  }
  
  if (timeframe === 'quarter') {
    if (showCombined) {
      // Combined mode: Historical means (separate bars) + stacked 2025 actual/projected
      const sites = ['Lacey', 'Centralia', 'Aberdeen']
      
      // First, add historical mean bars (separate group)
      // Normalize per-quarter: denominator is the total across sites for that quarter's historical mean
      const getQuarterDenomHistorical = (quarter: string) => {
        const q = (siteBarChartData.historical || []).find((h: any) => h.quarter === quarter)
        return q ? sumSites(q.sites || {} as SiteData) : 0
      }
      // Denominator per quarter for 2025 = actual quarter total + projected increment for that quarter
      const getQuarterDenom2025 = (quarter: string) => {
        const c = (siteBarChartData.current || []).find((x: any) => x.quarter === quarter)
        const p = (siteBarChartData.projected || []).find((x: any) => x.quarter === quarter)
        // Use actual quarter total if projected is missing (e.g., future quarters not projected yet)
        const denom = (c ? sumSites(c.sites || {} as SiteData) : 0) + (p ? sumSites(p.sites || {} as SiteData) : 0)
        return denom > 0 ? denom : (c ? sumSites(c.sites || {} as SiteData) : 0)
      }
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        if (siteBarChartData.historical?.length > 0) {
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
          const historicalValues: number[] = []
          const historicalErrors: number[] = []
          
          quarters.forEach(quarter => {
            const quarterData = siteBarChartData.historical.find((h: any) => h.quarter === quarter)
            if (quarterData) {
              const denom = getQuarterDenomHistorical(quarter)
              const val = (quarterData.sites?.[siteKey] || 0)
              const err = (quarterData.errors?.[siteKey] || 0)
              if (isNormalized && denom > 0) {
                historicalValues.push((val / denom) * 100)
                historicalErrors.push((err / denom) * 100)
              } else {
                historicalValues.push(val)
                historicalErrors.push(err)
              }
            } else {
              historicalValues.push(0)
              historicalErrors.push(0)
            }
          })
          
          const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
          const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'σ' : ''
          
          traces.push({
            x: quarters,
            y: historicalValues,
            type: 'bar' as const,
            name: `${site} Historical ${labelSuffix} (2016-2024)`,
            offsetgroup: 'historical', // Separate group from 2025 data
            marker: { 
              color: SITE_COLORS[siteKey].historical,
              opacity: 0.9 
            },
            error_y: combineError ? {
              type: 'data' as const,
              array: historicalErrors,
              visible: true,
              color: SITE_COLORS[siteKey].historical,
              thickness: 2,
              width: 3
            } : undefined,
            hovertemplate: isNormalized 
              ? combineError
                ? `${site} Historical ${labelSuffix}<br>%{x}: %{y:.1f}%<br>±%{error_y.array:.1f}% (${errorLabel})<extra></extra>`
                : `${site} Historical ${labelSuffix}<br>%{x}: %{y:.1f}%<extra></extra>`
              : combineError
                ? `${site} Historical ${labelSuffix}<br>%{x}: $%{y:,}<br>±$%{error_y.array:,} (${errorLabel})<extra></extra>`
                : `${site} Historical ${labelSuffix}<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
      })
      
      // Then add 2025 actual/projected stacked bars (same group)
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        // 2025 actual quarterly data (base of stack)
        if (siteBarChartData.current?.length > 0) {
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
          const currentValues: number[] = []
          
          quarters.forEach(quarter => {
            const quarterData = siteBarChartData.current.find((c: any) => c.quarter === quarter)
            const denom = getQuarterDenom2025(quarter)
            const val = quarterData?.sites?.[siteKey] || 0
            currentValues.push(isNormalized && denom > 0 ? (val / denom) * 100 : val)
          })
          
          traces.push({
            x: quarters,
            y: currentValues,
            type: 'bar' as const,
            name: `${site} 2025 Actual`,
            offsetgroup: '2025', // Same group for stacking
            marker: { 
              color: SITE_COLORS[siteKey].current,
              opacity: 0.9 
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Actual<br>%{x}: %{y:.1f}%<extra></extra>`
              : `${site} 2025 Actual<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
        
        // 2025 projected quarterly increment (stacked on top)
        if (siteBarChartData.projected?.length > 0) {
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
          const projectedValues: number[] = []
          
          quarters.forEach(quarter => {
            const quarterData = siteBarChartData.projected.find((p: any) => p.quarter === quarter)
            const denom = getQuarterDenom2025(quarter)
            const val = quarterData?.sites?.[siteKey] || 0
            projectedValues.push(isNormalized && denom > 0 ? (val / denom) * 100 : val)
          })
          
          const hasProjectedData = projectedValues.some(val => val > 0)
          if (hasProjectedData) {
            traces.push({
              x: quarters,
              y: projectedValues,
              type: 'bar' as const,
              name: `${site} 2025 Projected`,
              offsetgroup: '2025', // Same group for stacking
              marker: {
                color: SITE_COLORS[siteKey].projected,
                pattern: SITE_PROJECTED_PATTERNS[siteKey]
              },
              hovertemplate: isNormalized 
                ? `${site} 2025 Projected<br>%{x}: %{y:.1f}%<extra></extra>`
                : `${site} 2025 Projected<br>%{x}: $%{y:,}<extra></extra>`
            })
          }
        }
      })
    } else {
      // Individual mode: Show each historical year as separate bars + 2025 actual + 2025 projected
      const sites = ['Lacey', 'Centralia', 'Aberdeen']
      
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        // Add each historical year as separate bars
        if (siteBarChartData.individual?.length > 0) {
          const historicalYears = siteBarChartData.individual.filter((item: any) => item.year !== '2025' && item.year !== '2025 Projected')
          
          historicalYears.forEach((yearData: any) => {
            const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
            const yearValues: number[] = []
            
            quarters.forEach(quarter => {
              const quarterData = yearData.quarters?.find((q: any) => q.quarter === quarter)
              const denom = quarterData ? sumSites(quarterData.sites || {} as SiteData) : 0
              const val = quarterData?.sites?.[siteKey] || 0
              yearValues.push(isNormalized && denom > 0 ? (val / denom) * 100 : val)
            })
            
            traces.push({
              x: quarters,
              y: yearValues,
              type: 'bar' as const,
              name: `${site} ${yearData.year}`,
              offsetgroup: yearData.year, // Each year gets its own group
              marker: { 
                color: SITE_COLORS[siteKey].historical,
                opacity: 0.6 + (parseInt(yearData.year) - 2016) * 0.04 // Gradually lighter over time
              },
              hovertemplate: isNormalized 
                ? `${site} ${yearData.year}<br>%{x}: %{y:.1f}%<extra></extra>`
                : `${site} ${yearData.year}<br>%{x}: $%{y:,}<extra></extra>`
            })
          })
        }
        
        // 2025 actual quarterly data
        const actual2025 = siteBarChartData.individual?.find((item: any) => item.year === '2025')
        const projected2025 = siteBarChartData.projected?.[0]
        if (actual2025?.quarters) {
          const currentValues = ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
            const quarterData = actual2025.quarters.find((q: any) => q.quarter === quarter)
            const projectedQuarter = projected2025?.quarters?.find((q: any) => q.quarter === quarter)
            const denom = (quarterData ? sumSites(quarterData.sites || {} as SiteData) : 0) + (projectedQuarter ? sumSites(projectedQuarter.sites || {} as SiteData) : 0)
            const val = quarterData?.sites?.[siteKey] || 0
            return (isNormalized && denom > 0) ? (val / denom) * 100 : val
          })
          
          traces.push({
            x: ['Q1', 'Q2', 'Q3', 'Q4'],
            y: currentValues,
            type: 'bar' as const,
            name: `${site} 2025 Actual`,
            offsetgroup: '2025', // Same group for stacking with projected
            marker: { 
              color: SITE_COLORS[siteKey].current,
              opacity: 0.9 
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Actual<br>%{x}: %{y:.1f}%<extra></extra>`
              : `${site} 2025 Actual<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
        
        // 2025 projected increment
        if (siteBarChartData.projected?.length > 0) {
          const projected2025 = siteBarChartData.projected[0]
          if (projected2025?.quarters) {
            const projectedValues = ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
              const quarterData = projected2025.quarters.find((q: any) => q.quarter === quarter)  
              const actualQuarter = actual2025?.quarters?.find((q: any) => q.quarter === quarter)
              const denom = (quarterData ? sumSites(quarterData.sites || {} as SiteData) : 0) + (actualQuarter ? sumSites(actualQuarter.sites || {} as SiteData) : 0)
              const val = quarterData?.sites?.[siteKey] || 0
              return (isNormalized && denom > 0) ? (val / denom) * 100 : val
            })
            
            const hasProjectedData = projectedValues.some(val => val > 0)
            if (hasProjectedData) {
              traces.push({
                x: ['Q1', 'Q2', 'Q3', 'Q4'],
                y: projectedValues,
                type: 'bar' as const,
                name: `${site} 2025 Projected`,
                offsetgroup: '2025', // Same group for stacking
                marker: {
                  color: SITE_COLORS[siteKey].projected,
                  pattern: SITE_PROJECTED_PATTERNS[siteKey]
                },
                hovertemplate: isNormalized 
                  ? `${site} 2025 Projected<br>%{x}: %{y:.1f}%<extra></extra>`
                  : `${site} 2025 Projected<br>%{x}: $%{y:,}<extra></extra>`
              })
            }
          }
        }
      })
    }
    
    return traces
  }
  
  if (timeframe === 'month') {
    if (showCombined) {
      // Combined mode: Historical monthly means (separate bars) + stacked 2025 actual/projected
      const sites = ['Lacey', 'Centralia', 'Aberdeen']
      
      // First, add historical mean bars (separate group)
      const historicalDenom = (siteBarChartData.historical || []).reduce((acc: number, h: any) => acc + sumSites(h.sites || {} as SiteData), 0)
      const denom2025 = (siteBarChartData.current || []).reduce((acc: number, c: any) => acc + sumSites(c.sites || {} as SiteData), 0)
        + (siteBarChartData.projected || []).reduce((acc: number, p: any) => acc + sumSites(p.sites || {} as SiteData), 0)
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        if (siteBarChartData.historical?.length > 0) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const historicalValues: number[] = []
          const historicalErrors: number[] = []
          
          months.forEach(month => {
            const monthData = siteBarChartData.historical.find((h: any) => h.month === month)
            if (monthData) {
              historicalValues.push(monthData.sites[siteKey] || 0)
              historicalErrors.push(monthData.errors?.[siteKey] || 0)
            } else {
              historicalValues.push(0)
              historicalErrors.push(0)
            }
          })
          
          const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
          const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'σ' : ''
          
          traces.push({
            x: months,
            y: percentArray(historicalValues, historicalDenom),
            type: 'bar' as const,
            name: `${site} Historical ${labelSuffix} (2016-2024)`,
            offsetgroup: 'historical', // Separate group from 2025 data
            marker: { 
              color: SITE_COLORS[siteKey].historical,
              opacity: 0.9 
            },
            error_y: combineError ? {
              type: 'data' as const,
              array: percentErrors(historicalErrors, historicalDenom),
              visible: true,
              color: SITE_COLORS[siteKey].historical,
              thickness: 2,
              width: 3
            } : undefined,
            hovertemplate: isNormalized 
              ? combineError
                ? `${site} Historical ${labelSuffix}<br>%{x}: %{y:.1f}%<br>±%{error_y.array:.1f}% (${errorLabel})<extra></extra>`
                : `${site} Historical ${labelSuffix}<br>%{x}: %{y:.1f}%<extra></extra>`
              : combineError
                ? `${site} Historical ${labelSuffix}<br>%{x}: $%{y:,}<br>±$%{error_y.array:,} (${errorLabel})<extra></extra>`
                : `${site} Historical ${labelSuffix}<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
      })
      
      // Then add 2025 actual/projected stacked bars (same group)
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        // 2025 actual monthly data (base of stack)
        if (siteBarChartData.current?.length > 0) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const currentValues: number[] = []
          
          months.forEach(month => {
            const monthData = siteBarChartData.current.find((c: any) => c.month === month)
            currentValues.push(monthData?.sites[siteKey] || 0)
          })
          
          traces.push({
            x: months,
            y: percentArray(currentValues, denom2025),
            type: 'bar' as const,
            name: `${site} 2025 Actual`,
            offsetgroup: '2025', // Same group for stacking
            marker: { 
              color: SITE_COLORS[siteKey].current,
              opacity: 0.9 
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Actual<br>%{x}: %{y:.1f}%<extra></extra>`
              : `${site} 2025 Actual<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
        
        // 2025 projected monthly increment (stacked on top)
        if (siteBarChartData.projected?.length > 0) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const projectedValues: number[] = []
          
          months.forEach(month => {
            const monthData = siteBarChartData.projected.find((p: any) => p.month === month)
            projectedValues.push(monthData?.sites[siteKey] || 0)
          })
          
          const hasProjectedData = projectedValues.some(val => val > 0)
          if (hasProjectedData) {
            traces.push({
              x: months,
              y: percentArray(projectedValues, denom2025),
              type: 'bar' as const,
              name: `${site} 2025 Projected`,
              offsetgroup: '2025', // Same group for stacking
              marker: {
                color: SITE_COLORS[siteKey].projected,
                pattern: SITE_PROJECTED_PATTERNS[siteKey]
              },
              hovertemplate: isNormalized 
                ? `${site} 2025 Projected<br>%{x}: %{y:.1f}%<extra></extra>`
                : `${site} 2025 Projected<br>%{x}: $%{y:,}<extra></extra>`
            })
          }
        }
      })
    } else {
      // Individual mode: Show each historical year as separate bars + 2025 actual + 2025 projected
      const sites = ['Lacey', 'Centralia', 'Aberdeen']
      
      sites.forEach(site => {
        const siteKey = site.toLowerCase() as keyof SiteData
        
        // Add each historical year as separate bars
        if (siteBarChartData.individual?.length > 0) {
          const historicalYears = siteBarChartData.individual.filter((item: any) => item.year !== '2025' && item.year !== '2025 Projected')
          
          historicalYears.forEach((yearData: any) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const yearValues: number[] = []
            const yearDenom = (yearData.months || []).reduce((acc: number, m: any) => acc + sumSites(m.sites || {} as SiteData), 0)
            
            months.forEach(month => {
              const monthData = yearData.months?.find((m: any) => m.month === month)
              yearValues.push(monthData?.sites[siteKey] || 0)
            })
            
            traces.push({
              x: months,
              y: percentArray(yearValues, yearDenom),
              type: 'bar' as const,
              name: `${site} ${yearData.year}`,
              offsetgroup: yearData.year, // Each year gets its own group
              marker: { 
                color: SITE_COLORS[siteKey].historical,
                opacity: 0.6 + (parseInt(yearData.year) - 2016) * 0.04 // Gradually lighter over time
              },
              hovertemplate: isNormalized 
                ? `${site} ${yearData.year}<br>%{x}: %{y:.1f}%<extra></extra>`
                : `${site} ${yearData.year}<br>%{x}: $%{y:,}<extra></extra>`
            })
          })
        }
        
        // 2025 actual monthly data
        const actual2025 = siteBarChartData.individual?.find((item: any) => item.year === '2025')
        const projected2025 = siteBarChartData.projected?.[0]
        const denom2025 = (
          (actual2025?.months || []).reduce((acc: number, m: any) => acc + sumSites(m.sites || {} as SiteData), 0)
          + (projected2025?.months || []).reduce((acc: number, m: any) => acc + sumSites(m.sites || {} as SiteData), 0)
        ) || 0
        if (actual2025?.months) {
          const currentValues = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => {
            const monthData = actual2025.months.find((m: any) => m.month === month)
            return monthData?.sites[siteKey] || 0
          })
          
          traces.push({
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            y: percentArray(currentValues, denom2025),
            type: 'bar' as const,
            name: `${site} 2025 Actual`,
            offsetgroup: '2025', // Same group for stacking with projected
            marker: { 
              color: SITE_COLORS[siteKey].current,
              opacity: 0.9 
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Actual<br>%{x}: %{y:.1f}%<extra></extra>`
              : `${site} 2025 Actual<br>%{x}: $%{y:,}<extra></extra>`
          })
        }
        
        // 2025 projected increment
        if (siteBarChartData.projected?.length > 0) {
          const projected2025 = siteBarChartData.projected[0]
          if (projected2025?.months) {
            const projectedValues = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => {
              const monthData = projected2025.months.find((m: any) => m.month === month)  
              return monthData?.sites[siteKey] || 0
            })
            
            const hasProjectedData = projectedValues.some(val => val > 0)
            if (hasProjectedData) {
              traces.push({
                x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                y: percentArray(projectedValues, denom2025),
                type: 'bar' as const,
                name: `${site} 2025 Projected`,
                offsetgroup: '2025', // Same group for stacking
                marker: {
                  color: SITE_COLORS[siteKey].projected,
                  pattern: SITE_PROJECTED_PATTERNS[siteKey]
                },
                hovertemplate: isNormalized 
                  ? `${site} 2025 Projected<br>%{x}: %{y:.1f}%<extra></extra>`
                  : `${site} 2025 Projected<br>%{x}: $%{y:,}<extra></extra>`
              })
            }
          }
        }
      })
    }
    
    return traces
  }
  
  if (showCombined) {
    // Combined mode - create stacked bars with solid actual + textured projected
    const sites = ['Lacey', 'Centralia', 'Aberdeen']
    
    sites.forEach(site => {
      const siteKey = site.toLowerCase() as keyof SiteData
      
      // Historical mean trace (with error bars)
      if (siteBarChartData.historical?.length > 0) {
        const historicalData = siteBarChartData.historical.find((h: any) => h.site === site)
        const historicalDenom = (siteBarChartData.historical || []).reduce((acc: number, h: any) => acc + (h.income || 0), 0)
        if (historicalData) {
          const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
          const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'σ' : ''
          
          traces.push({
            x: [`Historical ${labelSuffix} (2016-2024)`],
            y: percentArray([historicalData.income || 0], historicalDenom),
            type: 'bar' as const,
            name: `${site} Historical`,
            marker: { 
              color: SITE_COLORS[siteKey].historical,
              opacity: 0.9 
            },
            error_y: combineError ? {
              type: 'data' as const,
              array: percentErrors([historicalData.error || 0], historicalDenom),
              visible: true,
              color: SITE_COLORS[siteKey].historical,
              thickness: 2,
              width: 3
            } : undefined,
            hovertemplate: isNormalized 
              ? combineError
                ? `${site} Historical<br>%{y:.1f}%<br>±%{error_y.array:.1f}% (${errorLabel})<extra></extra>`
                : `${site} Historical<br>%{y:.1f}%<extra></extra>`
              : combineError
                ? `${site} Historical<br>$%{y:,}<br>±$%{error_y.array:,} (${errorLabel})<extra></extra>`
                : `${site} Historical<br>$%{y:,}<extra></extra>`
          })
        }
      }
      
      // 2025 actual trace (solid color)
      if (siteBarChartData.current?.length > 0) {
        const currentData = siteBarChartData.current.find((c: any) => c.site === site)
        const denom2025 = (siteBarChartData.current || []).reduce((acc: number, c: any) => acc + (c.income || 0), 0)
          + (siteBarChartData.projected || []).reduce((acc: number, p: any) => acc + (p.income || 0), 0)
        if (currentData) {
          traces.push({
            x: ['2025'],
            y: percentArray([currentData.income || 0], denom2025),
            type: 'bar' as const,
            name: `${site} 2025 Actual`,
            marker: { 
              color: SITE_COLORS[siteKey].current,
              opacity: 0.9 
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Actual<br>%{y:.1f}%<extra></extra>`
              : `${site} 2025 Actual<br>$%{y:,}<extra></extra>`
          })
        }
      }
      
      // 2025 projected increment trace (textured, stacked on top of actual)
      if (siteBarChartData.projected?.length > 0) {
        const projectedData = siteBarChartData.projected.find((p: any) => p.site === site)
        const denom2025 = (siteBarChartData.current || []).reduce((acc: number, c: any) => acc + (c.income || 0), 0)
          + (siteBarChartData.projected || []).reduce((acc: number, p: any) => acc + (p.income || 0), 0)
        
        if (projectedData && projectedData.income > 0) {
          traces.push({
            x: ['2025'], // Only 2025 has projected data
            y: percentArray([projectedData.income], denom2025), // This is the projected increment (projected - actual)
            type: 'bar' as const,
            name: `${site} 2025 Projected`,
            marker: {
              color: SITE_COLORS[siteKey].projected,
              pattern: SITE_PROJECTED_PATTERNS[siteKey]
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Projected<br>%{y:.1f}%<extra></extra>`
              : `${site} 2025 Projected<br>$%{y:,}<extra></extra>`
          })
        }
      }
    })
  } else {
    // Individual year mode - create stacked bars for each year
    const sites = ['Lacey', 'Centralia', 'Aberdeen']
    
    sites.forEach(site => {
      const siteKey = site.toLowerCase() as keyof SiteData
      
      // Create arrays for historical years only (not including 2025)
      const historicalYears: string[] = []
      const historicalValues: number[] = []
      
      // Historical years (2016-2024)
      if (siteBarChartData.individual?.length > 0) {
        siteBarChartData.individual.forEach((yearData: any) => {
          if (yearData.year !== '2025') {
            historicalYears.push(yearData.year)
            const denom = sumSites(yearData.sites || {} as SiteData)
            historicalValues.push(isNormalized && denom > 0 ? (yearData.sites[siteKey] || 0) / denom * 100 : (yearData.sites[siteKey] || 0))
          }
        })
      }
      
      // Create trace for historical values
      if (historicalYears.length > 0) {
        traces.push({
          x: historicalYears,
          y: historicalValues,
          type: 'bar' as const,
          name: `${site}`,
          marker: { 
            color: SITE_COLORS[siteKey].historical,
            opacity: 0.9 
          },
          hovertemplate: isNormalized 
            ? `${site} %{x}<br>%{y:.1f}%<extra></extra>`
            : `${site} %{x}<br>$%{y:,}<extra></extra>`
        })
      }
      
      // Create separate trace for 2025 actual (solid color)
      const actual2025 = siteBarChartData.individual?.find((item: any) => item.year === '2025')
      const projected2025 = siteBarChartData.projected?.[0]
      const denom2025 = (
        sumSites(actual2025?.sites || {} as SiteData) + sumSites(projected2025?.sites || {} as SiteData)
      ) || 0
      if (actual2025) {
        traces.push({
          x: ['2025'],
          y: percentArray([actual2025.sites[siteKey] || 0], denom2025),
          type: 'bar' as const,
          name: `${site} 2025 Actual`,
          marker: { 
            color: SITE_COLORS[siteKey].current,
            opacity: 0.9 
          },
          hovertemplate: isNormalized 
            ? `${site} 2025 Actual<br>%{y:.1f}%<extra></extra>`
            : `${site} 2025 Actual<br>$%{y:,}<extra></extra>`
        })
      }
      
      // Add projected increment for 2025 only (textured, stacked on top of actual)
      if (siteBarChartData.projected?.length > 0) {
        const projectedData = siteBarChartData.projected[0]
        
        if (projectedData && projectedData.sites[siteKey] > 0) {
          traces.push({
            x: ['2025'], // Only 2025 has projected data
            y: percentArray([projectedData.sites[siteKey]], denom2025), // This should be the projected increment (projected - actual)
            type: 'bar' as const,
            name: `${site} 2025 Projected`,
            marker: {
              color: SITE_COLORS[siteKey].projected,
              pattern: SITE_PROJECTED_PATTERNS[siteKey]
            },
            hovertemplate: isNormalized 
              ? `${site} 2025 Projected<br>%{y:.1f}%<extra></extra>`
              : `${site} 2025 Projected<br>$%{y:,}<extra></extra>`
          })
        }
      }
    })
  }
  
  return traces
}
