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
import { getTotalIncome } from '../components/dashboard/shared/calculations'

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
  // Use monthly totals and sum them into quarters to match line chart logic
  const monthlyTotals = getSiteMonthTotals(year)
  if (monthlyTotals.length === 0) return []
  
  const buckets = [{ q:'Q1' as const },{ q:'Q2' as const },{ q:'Q3' as const },{ q:'Q4' as const }]
  const quarterSums = buckets.map(() => ({ lacey: 0, centralia: 0, aberdeen: 0 }))
  
  monthlyTotals.forEach((monthData, monthIndex) => {
    const quarterIndex = Math.floor(monthIndex / 3)
    quarterSums[quarterIndex].lacey += monthData.sites.lacey
    quarterSums[quarterIndex].centralia += monthData.sites.centralia
    quarterSums[quarterIndex].aberdeen += monthData.sites.aberdeen
  })
  
  return buckets.map((b, idx) => ({ quarter: b.q, sites: quarterSums[idx] }))
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
      const d = new Date(startDate + 'T00:00:00')
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



// Function to extract end-of-month site data points for line charts
// Since site data is only accurate monthly, we create smooth daily interpolation for better charting
export function getSiteMonthlyEndPoints(year: string): YTDPointWithSites[] {
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
    
    // Group columns by month and calculate monthly totals
    const monthGroups = new Map<string, { originalIndex: number, startDate: string, values: { lacey: number, centralia: number, aberdeen: number } }[]>()
    
    // Group by month
    for (const { originalIndex, startDate } of validColumns) {
      const date = new Date(startDate + 'T00:00:00')
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, [])
      }
      
      monthGroups.get(monthKey)!.push({
        originalIndex,
        startDate,
        values: {
          lacey: laceyVals[originalIndex] || 0,
          centralia: centraliaVals[originalIndex] || 0,
          aberdeen: aberdeenVals[originalIndex] || 0
        }
      })
    }
    
    // Calculate monthly totals and create daily interpolated points using month-to-month interpolation
    const points: YTDPointWithSites[] = []
    const monthlyTotals: { month: number, sites: { lacey: number, centralia: number, aberdeen: number } }[] = []
    let cumulativeLacey = 0
    let cumulativeCentralia = 0
    let cumulativeAberdeen = 0
    
    // Sort months chronologically
    const sortedMonths = Array.from(monthGroups.keys()).sort()
    
    // First pass: calculate monthly totals
    for (const monthKey of sortedMonths) {
      const monthData = monthGroups.get(monthKey)!
      
      // Calculate this month's total for each site
      const monthTotal = monthData.reduce((acc, day) => ({
        lacey: acc.lacey + day.values.lacey,
        centralia: acc.centralia + day.values.centralia,
        aberdeen: acc.aberdeen + day.values.aberdeen
      }), { lacey: 0, centralia: 0, aberdeen: 0 })
      
      // Determine the month and year from monthKey
      const [, monthStr] = monthKey.split('-')
      const monthNum = parseInt(monthStr, 10)
      
      // Update cumulative totals for next month
      cumulativeLacey += monthTotal.lacey
      cumulativeCentralia += monthTotal.centralia
      cumulativeAberdeen += monthTotal.aberdeen
      
      monthlyTotals.push({
        month: monthNum,
        sites: {
          lacey: cumulativeLacey,
          centralia: cumulativeCentralia,
          aberdeen: cumulativeAberdeen
        }
      })
    }
    
    // Second pass: create daily interpolated points using month-to-month interpolation
    for (const monthKey of sortedMonths) {
      const [yearStr, monthStr] = monthKey.split('-')
      const monthNum = parseInt(monthStr, 10)
      
      // Use non-leap year calendar (always 28 days in February)
      const daysInMonth = monthNum === 2 ? 28 : new Date(parseInt(yearStr), monthNum, 0).getDate()
      
      // Find the monthly totals for this month and previous month
      const currentMonthTotal = monthlyTotals.find(m => m.month === monthNum)
      const previousMonthTotal = monthlyTotals.find(m => m.month === monthNum - 1)
      
      if (!currentMonthTotal) continue
      
      // Get starting values (previous month end or zero for January)
      const startLacey = previousMonthTotal ? previousMonthTotal.sites.lacey : 0
      const startCentralia = previousMonthTotal ? previousMonthTotal.sites.centralia : 0
      const startAberdeen = previousMonthTotal ? previousMonthTotal.sites.aberdeen : 0
      
      // Calculate monthly increments
      const monthlyLaceyIncrement = currentMonthTotal.sites.lacey - startLacey
      const monthlyCentraliaIncrement = currentMonthTotal.sites.centralia - startCentralia
      const monthlyAberdeenIncrement = currentMonthTotal.sites.aberdeen - startAberdeen
      
      for (let day = 1; day <= daysInMonth; day++) {
        // Calculate progress through this month (0 to 1)
        const progressThroughMonth = day / daysInMonth
        
        // Interpolate within this month
        const dailyLacey = startLacey + (monthlyLaceyIncrement * progressThroughMonth)
        const dailyCentralia = startCentralia + (monthlyCentraliaIncrement * progressThroughMonth)
        const dailyAberdeen = startAberdeen + (monthlyAberdeenIncrement * progressThroughMonth)
        
        const monthDay = `${monthStr}-${String(day).padStart(2, '0')}`
        
        points.push({
          date: `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`,
          monthDay,
          cumulativeIncome: dailyLacey + dailyCentralia + dailyAberdeen,
          sites: {
            lacey: dailyLacey,
            centralia: dailyCentralia,
            aberdeen: dailyAberdeen
          }
        })
      }
    }
    
    console.log(`Generated ${points.length} interpolated daily points for ${year} site data`)
    return points
    
  } catch (error) {
    console.error(`Error extracting site data for ${year}:`, error)
    return []
  }
}

// Get 2025 daily interpolated points using month-to-month interpolation
// Since site data is only accurate monthly, end at the last complete month
export function get2025SiteMonthlyEndPoints(): YTDPointWithSites[] {
  try {
    const report = historical2025Data as any
    
    // Get the actual date range from the data source (same approach as therapy income parser)
    const allColumns = (report?.Columns?.Column || []).slice(1) // Skip first column (account names)
    const validColumns = allColumns
      .map((col: any, index: number) => ({
        column: col,
        originalIndex: index,
        startDate: col?.MetaData?.find((m: any) => m.Name === 'StartDate')?.Value
      }))
      .filter((item: any) => item.startDate) // Only keep columns with valid dates
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) // Sort chronologically
    
    if (validColumns.length === 0) return []
    
    // Get the last actual date with data
    const lastDataDate = validColumns[validColumns.length - 1].startDate
    const lastDataDateObj = new Date(lastDataDate + 'T00:00:00')
    const lastDataMonth = lastDataDateObj.getMonth() + 1 // 1-based
    const lastDataDay = lastDataDateObj.getDate()
    
    // For site data, we only trust complete months. If we're mid-month, use the previous month end.
    // Check if the last data date is the end of the month
    const daysInLastDataMonth = new Date(2025, lastDataMonth, 0).getDate()
    const isEndOfMonth = lastDataDay === daysInLastDataMonth
    
    const lastReliableMonth = isEndOfMonth ? lastDataMonth : lastDataMonth - 1
    const lastReliableDay = isEndOfMonth ? lastDataDay : new Date(2025, lastReliableMonth, 0).getDate()
    
    if (lastReliableMonth < 1) {
      console.warn('No complete months of site data available')
      return []
    }
    
    console.log(`2025 site data: Last data date is ${lastDataDate}, last reliable site data through ${lastReliableMonth}/${lastReliableDay}/2025`)
    
    // Get the YTD totals for each site
    const current2025Data = parseSiteIncomeFromSummary()
    if (current2025Data.length === 0) return []
    
    const ytdPoint = current2025Data[0]
    if (!ytdPoint.sites) return []
    
    // Create monthly totals by extracting actual monthly data from the source
    const monthlyTotals: { month: number, sites: { lacey: number, centralia: number, aberdeen: number } }[] = []
    
    // Extract site rows and values
    const laceyRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7105 Therapy - Lacey')
    const centraliaRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7110 Therapy - Centralia')
    const aberdeenRow = findTherapyAccountRowGeneric(report?.Rows?.Row || [], '7108 Therapy - Aberdeen')
    
    const laceyVals = getSiteRowValues(laceyRow)
    const centraliaVals = getSiteRowValues(centraliaRow)
    const aberdeenVals = getSiteRowValues(aberdeenRow)
    
    // Group columns by month and calculate monthly totals
    const monthGroups = new Map<string, { originalIndex: number, startDate: string, values: { lacey: number, centralia: number, aberdeen: number } }[]>()
    
    for (const { originalIndex, startDate } of validColumns) {
      const date = new Date(startDate + 'T00:00:00')
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, [])
      }
      
      monthGroups.get(monthKey)!.push({
        originalIndex,
        startDate,
        values: {
          lacey: laceyVals[originalIndex] || 0,
          centralia: centraliaVals[originalIndex] || 0,
          aberdeen: aberdeenVals[originalIndex] || 0
        }
      })
    }
    
    // Calculate monthly totals for each month up to lastReliableMonth
    const sortedMonths = Array.from(monthGroups.keys()).sort()
    let cumulativeLacey = 0
    let cumulativeCentralia = 0
    let cumulativeAberdeen = 0
    
    for (const monthKey of sortedMonths) {
      const [, monthStr] = monthKey.split('-')
      const monthNum = parseInt(monthStr, 10)
      
      if (monthNum > lastReliableMonth) break
      
      const monthData = monthGroups.get(monthKey)!
      
      // Calculate this month's total for each site
      const monthTotal = monthData.reduce((acc, day) => ({
        lacey: acc.lacey + day.values.lacey,
        centralia: acc.centralia + day.values.centralia,
        aberdeen: acc.aberdeen + day.values.aberdeen
      }), { lacey: 0, centralia: 0, aberdeen: 0 })
      
      cumulativeLacey += monthTotal.lacey
      cumulativeCentralia += monthTotal.centralia
      cumulativeAberdeen += monthTotal.aberdeen
      
      monthlyTotals.push({
        month: monthNum,
        sites: {
          lacey: cumulativeLacey,
          centralia: cumulativeCentralia,
          aberdeen: cumulativeAberdeen
        }
      })
    }
    
    // Create daily interpolated points using month-to-month interpolation
    const points: YTDPointWithSites[] = []
    
    for (let month = 1; month <= lastReliableMonth; month++) {
      // Use non-leap year calendar (always 28 days in February)
      const daysInMonth = month === 2 ? 28 : new Date(2025, month, 0).getDate()
      const endDay = month === lastReliableMonth ? Math.min(lastReliableDay, daysInMonth) : daysInMonth
      
      // Find the monthly totals for this month and previous month
      const currentMonthTotal = monthlyTotals.find(m => m.month === month)
      const previousMonthTotal = monthlyTotals.find(m => m.month === month - 1)
      
      if (!currentMonthTotal) continue
      
      // Get starting values (previous month end or zero for January)
      const startLacey = previousMonthTotal ? previousMonthTotal.sites.lacey : 0
      const startCentralia = previousMonthTotal ? previousMonthTotal.sites.centralia : 0
      const startAberdeen = previousMonthTotal ? previousMonthTotal.sites.aberdeen : 0
      
      // Calculate monthly increments
      const monthlyLaceyIncrement = currentMonthTotal.sites.lacey - startLacey
      const monthlyCentraliaIncrement = currentMonthTotal.sites.centralia - startCentralia
      const monthlyAberdeenIncrement = currentMonthTotal.sites.aberdeen - startAberdeen
      
      for (let day = 1; day <= endDay; day++) {
        // Calculate progress through this month (0 to 1)
        const progressThroughMonth = day / daysInMonth
        
        // Interpolate within this month
        const dailyLacey = startLacey + (monthlyLaceyIncrement * progressThroughMonth)
        const dailyCentralia = startCentralia + (monthlyCentraliaIncrement * progressThroughMonth)
        const dailyAberdeen = startAberdeen + (monthlyAberdeenIncrement * progressThroughMonth)
        
        const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        
        points.push({
          date: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          monthDay,
          cumulativeIncome: dailyLacey + dailyCentralia + dailyAberdeen,
          sites: {
            lacey: dailyLacey,
            centralia: dailyCentralia,
            aberdeen: dailyAberdeen
          }
        })
      }
    }
    
    console.log(`Generated ${points.length} month-to-month interpolated daily points for 2025 site data (through end of month ${lastReliableMonth})`)
    return points
    
  } catch (error) {
    console.error('Error extracting 2025 site data:', error)
    return []
  }
}

// Helper function to calculate day of year using non-leap year calendar (365 days, 28 days in Feb)
function getDayOfYearNonLeap(month: number, day: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // Non-leap year
  let dayOfYear = 0
  
  // Add days from previous months
  for (let i = 0; i < month - 1; i++) {
    dayOfYear += daysInMonth[i]
  }
  
  // Add days in current month (capped to Feb 28)
  dayOfYear += Math.min(day, month === 2 ? 28 : daysInMonth[month - 1])
  
  return dayOfYear
}

// Generate projected site data points for line charts
// Start projections from the actual last reliable month end (not interpolated daily point)
export function generateProjectedSiteMonthlyPoints(
  actualSiteData: YTDPointWithSites[],
  fy2025: any
): YTDPointWithSites[] {
  if (actualSiteData.length === 0 || !fy2025) return []
  
  // Find the actual last reliable month end by looking for the last end-of-month point
  // This ensures we start projections from the actual last complete month, not an interpolated daily point
  let lastReliablePoint: YTDPointWithSites | null = null
  let lastReliableMonth = 0
  let lastReliableDay = 0
  
  // Look backwards through the actual data to find the last end-of-month point
  for (let i = actualSiteData.length - 1; i >= 0; i--) {
    const point = actualSiteData[i]
    const [month, day] = point.monthDay.split('-').map(Number)
    
    // Check if this is an end-of-month point
    const daysInMonth = month === 2 ? 28 : new Date(2025, month, 0).getDate()
    if (day === daysInMonth) {
      lastReliablePoint = point
      lastReliableMonth = month
      lastReliableDay = day
      break
    }
  }
  
  // Fallback to the last point if no end-of-month found
  if (!lastReliablePoint) {
    lastReliablePoint = actualSiteData[actualSiteData.length - 1]
    const [month, day] = lastReliablePoint.monthDay.split('-').map(Number)
    lastReliableMonth = month
    lastReliableDay = day
  }
  
  if (!lastReliablePoint.sites) return []
  
  const projectedTotalIncome = getTotalIncome(fy2025)
  // Prefer explicit per-site projections from the store/grid if available
  const hasStoreSiteTotals = typeof fy2025?.therapyLacey === 'number' || typeof fy2025?.therapyCentralia === 'number' || typeof fy2025?.therapyAberdeen === 'number'
  const projectedSiteData = hasStoreSiteTotals
    ? {
        lacey: Number(fy2025?.therapyLacey || 0),
        centralia: Number(fy2025?.therapyCentralia || 0),
        aberdeen: Number(fy2025?.therapyAberdeen || 0)
      } as SiteData
    : generateProjectedSiteData(projectedTotalIncome, lastReliablePoint.sites)
  
  // Generate daily interpolated points from the ACTUAL last reliable month end to end of year
  const projectedPoints: YTDPointWithSites[] = []
  
  // Calculate the remaining days in the year from the last reliable month end
  const remainingDaysInYear = getDaysRemainingInYear(lastReliableMonth, lastReliableDay)
  
  if (remainingDaysInYear <= 0) return [] // No projection needed if we're at end of year
  
  let dayCounter = 0
  
  // Start from the day AFTER the last reliable month end to avoid duplication
  for (let month = lastReliableMonth; month <= 12; month++) {
    // Use non-leap year calendar (always 28 days in February)
    const daysInMonth = month === 2 ? 28 : new Date(2025, month, 0).getDate()
    const startDay = month === lastReliableMonth ? lastReliableDay + 1 : 1
    
    for (let day = startDay; day <= daysInMonth; day++) {
      // Linear interpolation from reliable values to projected year-end values
      const progressThroughProjection = dayCounter / remainingDaysInYear
      
      const projectedLacey = lastReliablePoint.sites.lacey + 
        (projectedSiteData.lacey - lastReliablePoint.sites.lacey) * progressThroughProjection
      const projectedCentralia = lastReliablePoint.sites.centralia + 
        (projectedSiteData.centralia - lastReliablePoint.sites.centralia) * progressThroughProjection
      const projectedAberdeen = lastReliablePoint.sites.aberdeen + 
        (projectedSiteData.aberdeen - lastReliablePoint.sites.aberdeen) * progressThroughProjection
      
      const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      projectedPoints.push({
        date: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        monthDay,
        cumulativeIncome: projectedLacey + projectedCentralia + projectedAberdeen,
        sites: {
          lacey: projectedLacey,
          centralia: projectedCentralia,
          aberdeen: projectedAberdeen
        }
      })

      // Increment AFTER using this day so first point uses progress 0
      dayCounter++
    }
  }
  
  console.log(`Generated ${projectedPoints.length} projected daily points for 2025 site data (from ${lastReliableMonth}/${lastReliableDay} to Dec 31)`)
  return projectedPoints
}

// Helper function to calculate remaining days in year from a given date using non-leap year calendar
function getDaysRemainingInYear(currentMonth: number, currentDay: number): number {
  // Use non-leap year calendar (365 total days)
  const currentDayOfYear = getDayOfYearNonLeap(currentMonth, currentDay)
  const totalDaysInYear = 365 // Non-leap year
  return totalDaysInYear - currentDayOfYear
}
