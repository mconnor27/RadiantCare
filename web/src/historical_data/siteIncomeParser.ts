import historical2025Data from './2025_daily.json'
import historical2024Data from './2024.json'
import historical2023Data from './2023.json'
import historical2022Data from './2022.json'
import historical2021Data from './2021.json'
import historical2020Data from './2020.json'
import historical2019Data from './2019.json'
import historical2018Data from './2018.json'
import historical2017Data from './2017.json'
import historical2016Data from './2016.json'
import type { YTDPointWithSites, SiteData } from '../components/dashboard/shared/types'

// Function to parse site-specific therapy income from 2025 daily data
export function parseSiteIncomeFromSummary(): YTDPointWithSites[] {
  try {
    const report = historical2025Data as any
    
    // Find therapy account rows for each site
    const findTherapyAccountRow = (rows: any[], accountName: string): any => {
      for (const row of rows) {
        // Check if this row matches the account name we're looking for (try both Summary and direct ColData)
        if (row?.Summary?.ColData?.[0]?.value === accountName) {
          return row
        }
        if (row?.ColData?.[0]?.value === accountName) {
          return row
        }
        // Recursively search in nested rows
        if (row?.Rows?.Row) {
          const found = findTherapyAccountRow(row.Rows.Row, accountName)
          if (found) return found
        }
        // Also check if there are nested rows in a different structure
        if (row?.Row) {
          const found = findTherapyAccountRow(row.Row, accountName)
          if (found) return found
        }
      }
      return null
    }
    
    // Look for site-specific therapy income accounts
    const laceyRow = findTherapyAccountRow(report?.Rows?.Row || [], '7105 Therapy - Lacey')
    const centraliaRow = findTherapyAccountRow(report?.Rows?.Row || [], '7110 Therapy - Centralia') 
    const aberdeenRow = findTherapyAccountRow(report?.Rows?.Row || [], '7108 Therapy - Aberdeen')
    
    
    // Calculate cumulative totals for each site using the same method as total income parser
    const calculateSiteCumulative = (siteRow: any): number => {
      // Check both Summary and direct ColData structures
      const colData = siteRow?.Summary?.ColData || siteRow?.ColData
      if (!colData) return 0
      
      // Get all columns and metadata to identify valid date columns (same as therapyIncomeParser)
      const allColumns = (report?.Columns?.Column || []).slice(1) // Skip first column (account names)
      
      // Filter out columns without valid dates and sort chronologically
      const validColumns = allColumns
        .map((col: any, index: number) => ({
          column: col,
          originalIndex: index,
          startDate: col?.MetaData?.find((m: any) => m.Name === 'StartDate')?.Value
        }))
        .filter((item: any) => item.startDate) // Only keep columns with valid dates
        .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) // Sort chronologically
      
      // Extract daily values for this site using the same approach as total parser
      const allDailyValues = colData.slice(1).map((col: any) => 
        Number(col.value || 0)
      )
      
      // Build cumulative series with proper dates using sorted columns (same as total parser)
      let cumulativeTotal = 0
      
      for (const { originalIndex } of validColumns) {
        const dailyIncome = allDailyValues[originalIndex] || 0
        cumulativeTotal += dailyIncome
      }
      
      return cumulativeTotal
    }
    
    const laceyValue = calculateSiteCumulative(laceyRow)
    const centraliaValue = calculateSiteCumulative(centraliaRow)
    const aberdeenValue = calculateSiteCumulative(aberdeenRow)
    
    // Return a single point representing YTD through August 2025
    return [{
      date: '2025-08-31',
      monthDay: '08-31',
      cumulativeIncome: laceyValue + centraliaValue + aberdeenValue,
      sites: {
        lacey: laceyValue,
        centralia: centraliaValue,
        aberdeen: aberdeenValue
      }
    }]
    
  } catch (error) {
    console.error('Error parsing 2025 site income data:', error)
    return []
  }
}

// Internal helpers to extract site rows and column metadata from any report
function findTherapyAccountRowGeneric(rows: any[], accountName: string): any {
  for (const row of rows) {
    if (row?.Summary?.ColData?.[0]?.value === accountName) return row
    if (row?.ColData?.[0]?.value === accountName) return row
    if (row?.Rows?.Row) {
      const found = findTherapyAccountRowGeneric(row.Rows.Row, accountName)
      if (found) return found
    }
    if (row?.Row) {
      const found = findTherapyAccountRowGeneric(row.Row, accountName)
      if (found) return found
    }
  }
  return null
}

function getValidColumns(report: any) {
  const allColumns = (report?.Columns?.Column || []).slice(1)
  const validColumns = allColumns
    .map((col: any, index: number) => ({
      originalIndex: index,
      startDate: col?.MetaData?.find((m: any) => m.Name === 'StartDate')?.Value
    }))
    .filter((item: any) => item.startDate)
    .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  return validColumns
}

function getSiteRowValues(row: any): number[] {
  const colData = row?.Summary?.ColData || row?.ColData || []
  return colData.slice(1).map((col: any) => Number(col.value || 0))
}

function resolveYearReport(year: string): any | null {
  switch (year) {
    case '2016': return historical2016Data
    case '2017': return historical2017Data
    case '2018': return historical2018Data
    case '2019': return historical2019Data
    case '2020': return historical2020Data
    case '2021': return historical2021Data
    case '2022': return historical2022Data
    case '2023': return historical2023Data
    case '2024': return historical2024Data
    case '2025': return historical2025Data
    default: return null
  }
}

export function getSiteYearTotals(year: string): SiteData {
  const report = resolveYearReport(year)
  if (!report) return { lacey: 0, centralia: 0, aberdeen: 0 }
  try {
    const laceyRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7105 Therapy - Lacey')
    const centraliaRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7110 Therapy - Centralia')
    const aberdeenRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7108 Therapy - Aberdeen')
    const laceyVals = getSiteRowValues(laceyRow)
    const centraliaVals = getSiteRowValues(centraliaRow)
    const aberdeenVals = getSiteRowValues(aberdeenRow)
    
    // For yearly totals, get the final cumulative value (maximum) from the site data
    // This handles the case where site rows contain cumulative daily totals
    const getYearTotal = (arr: number[]) => {
      if (arr.length === 0) return 0
      // Filter out invalid values and get the maximum (final cumulative total)
      const validValues = arr.filter(v => Number.isFinite(v) && v >= 0)
      return validValues.length > 0 ? Math.max(...validValues) : 0
    }
    
    return {
      lacey: getYearTotal(laceyVals),
      centralia: getYearTotal(centraliaVals),
      aberdeen: getYearTotal(aberdeenVals)
    }
  } catch (e) {
    console.error('getSiteYearTotals error', year, e)
    return { lacey: 0, centralia: 0, aberdeen: 0 }
  }
}

export function getSiteQuarterTotals(year: string): { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', sites: SiteData }[] {
  const report = resolveYearReport(year)
  if (!report) return []
  try {
    const validColumns = getValidColumns(report)
    const laceyRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7105 Therapy - Lacey')
    const centraliaRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7110 Therapy - Centralia')
    const aberdeenRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7108 Therapy - Aberdeen')
    const laceyVals = getSiteRowValues(laceyRow)
    const centraliaVals = getSiteRowValues(centraliaRow)
    const aberdeenVals = getSiteRowValues(aberdeenRow)
    const buckets = [{ q:'Q1' as const },{ q:'Q2' as const },{ q:'Q3' as const },{ q:'Q4' as const }]
    const sums = buckets.map(() => ({ lacey: 0, centralia: 0, aberdeen: 0 }))
    for (const { originalIndex, startDate } of validColumns) {
      const d = new Date(startDate + 'T00:00:00Z')
      const month = d.getUTCMonth() + 1
      const quarterIndex = Math.floor((month - 1) / 3)
      sums[quarterIndex].lacey += laceyVals[originalIndex] || 0
      sums[quarterIndex].centralia += centraliaVals[originalIndex] || 0
      sums[quarterIndex].aberdeen += aberdeenVals[originalIndex] || 0
    }
    return buckets.map((b, idx) => ({ quarter: b.q, sites: sums[idx] }))
  } catch (e) {
    console.error('getSiteQuarterTotals error', year, e)
    return []
  }
}

export function getSiteMonthTotals(year: string): { month: string, sites: SiteData }[] {
  const report = resolveYearReport(year)
  if (!report) return []
  try {
    const validColumns = getValidColumns(report)
    const laceyRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7105 Therapy - Lacey')
    const centraliaRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7110 Therapy - Centralia')
    const aberdeenRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7108 Therapy - Aberdeen')
    const laceyVals = getSiteRowValues(laceyRow)
    const centraliaVals = getSiteRowValues(centraliaRow)
    const aberdeenVals = getSiteRowValues(aberdeenRow)
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const sums = monthNames.map(() => ({ lacey: 0, centralia: 0, aberdeen: 0 }))
    for (const { originalIndex, startDate } of validColumns) {
      const d = new Date(startDate + 'T00:00:00Z')
      const monthIndex = d.getUTCMonth()
      sums[monthIndex].lacey += laceyVals[originalIndex] || 0
      sums[monthIndex].centralia += centraliaVals[originalIndex] || 0
      sums[monthIndex].aberdeen += aberdeenVals[originalIndex] || 0
    }
    return monthNames.map((m, i) => ({ month: m, sites: sums[i] }))
  } catch (e) {
    console.error('getSiteMonthTotals error', year, e)
    return []
  }
}

// Function to extract site breakdown from historical yearly data
// Since historical data doesn't have site breakdown, we'll use estimated proportions
// based on 2025 data as a baseline
export function estimateSiteBreakdownForYear(totalIncome: number, year: string): SiteData {
  // Get 2025 proportions as baseline
  const current2025Data = parseSiteIncomeFromSummary()
  if (current2025Data.length === 0 || !current2025Data[0].sites) {
    // Fallback proportions if 2025 data not available
    return {
      lacey: totalIncome * 0.4,      // 40% estimate
      centralia: totalIncome * 0.35, // 35% estimate  
      aberdeen: totalIncome * 0.25   // 25% estimate
    }
  }
  
  const sites = current2025Data[0].sites
  const total2025 = sites.lacey + sites.centralia + sites.aberdeen
  
  if (total2025 === 0) {
    return {
      lacey: totalIncome * 0.4,
      centralia: totalIncome * 0.35,
      aberdeen: totalIncome * 0.25
    }
  }
  
  // Apply 2025 proportions to historical year
  const laceyProportion = sites.lacey / total2025
  const centraliaProportion = sites.centralia / total2025  
  const aberdeenProportion = sites.aberdeen / total2025
  
  console.log(`${year} estimated proportions:`, { laceyProportion, centraliaProportion, aberdeenProportion })
  
  return {
    lacey: totalIncome * laceyProportion,
    centralia: totalIncome * centraliaProportion,
    aberdeen: totalIncome * aberdeenProportion
  }
}

// Function to generate projected site data from grid values
export function generateProjectedSiteData(
  projectedTotalIncome: number,
  currentSiteData?: SiteData
): SiteData {
  // If we have current site data, maintain proportions
  if (currentSiteData) {
    const currentTotal = currentSiteData.lacey + currentSiteData.centralia + currentSiteData.aberdeen
    if (currentTotal > 0) {
      const laceyProportion = currentSiteData.lacey / currentTotal
      const centraliaProportion = currentSiteData.centralia / currentTotal
      const aberdeenProportion = currentSiteData.aberdeen / currentTotal
      
      return {
        lacey: projectedTotalIncome * laceyProportion,
        centralia: projectedTotalIncome * centraliaProportion,
        aberdeen: projectedTotalIncome * aberdeenProportion
      }
    }
  }
  
  // Fallback to estimated proportions
  return estimateSiteBreakdownForYear(projectedTotalIncome, '2025')
}

// Color scheme for sites (ggplot2 default colors)
export const SITE_COLORS = {
  lacey: {
    historical: 'rgba(248, 118, 109, 0.7)',    // Faded red
    current: '#F8766D',                         // Bright red
    projected: 'rgba(248, 118, 109, 0.6)'      // For textured pattern
  },
  centralia: {
    historical: 'rgba(0, 186, 56, 0.7)',       // Faded green  
    current: '#00BA38',                         // Bright green
    projected: 'rgba(0, 186, 56, 0.6)'         // For textured pattern
  },
  aberdeen: {
    historical: 'rgba(97, 156, 255, 0.7)',     // Faded blue
    current: '#619CFF',                         // Bright blue  
    projected: 'rgba(97, 156, 255, 0.6)'       // For textured pattern
  }
}

// Pattern configuration for projected data (same pattern for all sites)
export const SITE_PROJECTED_PATTERNS = {
  lacey: {
    shape: '/',
    size: 6,
    solidity: 0.5
  },
  centralia: {
    shape: '/',
    size: 6, 
    solidity: 0.5
  },
  aberdeen: {
    shape: '/',
    size: 6,
    solidity: 0.5
  }
}
