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

export type YTDPoint = { date: string; cumulativeIncome: number; monthDay: string }

// Calculate 7-day rolling average
export function calculateRollingAverage(data: YTDPoint[], windowSize: number = 7): YTDPoint[] {
  if (data.length < windowSize) return data
  
  const result: YTDPoint[] = []
  
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      // For the first few points, use available data
      const availablePoints = data.slice(0, i + 1)
      const avg = availablePoints.reduce((sum, p) => sum + p.cumulativeIncome, 0) / availablePoints.length
      result.push({
        ...data[i],
        cumulativeIncome: avg
      })
    } else {
      // Calculate rolling average for window
      const windowData = data.slice(i - windowSize + 1, i + 1)
      const avg = windowData.reduce((sum, p) => sum + p.cumulativeIncome, 0) / windowSize
      result.push({
        ...data[i],
        cumulativeIncome: avg
      })
    }
  }
  
  return result
}

// Generic function to parse therapy income from any year's data
function parseTherapyIncomeFromReport(report: any, year: string): YTDPoint[] {
  try {
    // Get column definitions to map dates
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
    
    console.log(`${year}: Processing ${validColumns.length} valid columns out of ${allColumns.length} total columns`)
    
    // Find the "Total 7100 Therapy Income" row
    const findTherapyIncomeRow = (rows: any[]): any => {
      for (const row of rows) {
        if (row?.Summary?.ColData?.[0]?.value === 'Total Income') {
          return row
        }
        if (row?.Rows?.Row) {
          const found = findTherapyIncomeRow(row.Rows.Row)
          if (found) return found
        }
      }
      return null
    }
    
    const therapyIncomeRow = findTherapyIncomeRow(report?.Rows?.Row || [])
    if (!therapyIncomeRow) {
      console.error(`Could not find "Total Income" row in ${year} data`)
      return []
    }
    
    // Extract daily values (skip first column which is the label)
    const allDailyValues = therapyIncomeRow.Summary.ColData.slice(1).map((col: any) => 
      Number(col.value || 0)
    )
    
    // Build cumulative series with proper dates using sorted columns
    const points: YTDPoint[] = []
    let cumulativeTotal = 0
    let feb29Income = 0 // Track Feb 29 income to add to Feb 28
    
    for (const { originalIndex, startDate } of validColumns) {
      const dailyIncome = allDailyValues[originalIndex] || 0
      cumulativeTotal += dailyIncome
      
      // Create month-day format for year overlay (MM-DD)
      // Use UTC parsing to avoid timezone issues with date strings
      const dateObj = new Date(startDate + 'T00:00:00Z')
      const month = dateObj.getUTCMonth() + 1
      const day = dateObj.getUTCDate()
      
      // Handle Feb 29 by adding its income to Feb 28
      if (month === 2 && day === 29) {
        feb29Income = dailyIncome
        // Find the Feb 28 entry and add Feb 29 income to it
        const feb28Index = points.findIndex(p => p.monthDay === '02-28')
        if (feb28Index >= 0) {
          points[feb28Index].cumulativeIncome += feb29Income
          // Update all subsequent points with the Feb 29 income
          for (let j = feb28Index + 1; j < points.length; j++) {
            points[j].cumulativeIncome += feb29Income
          }
        }
        continue
      }
      
      const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      points.push({
        date: startDate,
        cumulativeIncome: cumulativeTotal,
        monthDay
      })
    }
    
    console.log(`Parsed ${points.length} days of ${year} therapy income data`)
    console.log(`${year} total therapy income:`, cumulativeTotal)
    
    return points
  } catch (error) {
    console.error(`Error parsing ${year} therapy income data:`, error)
    return []
  }
}

export function parseTherapyIncome2025(cachedData?: any): YTDPoint[] {
  // Use cached data if provided, otherwise fall back to historical JSON
  const dataSource = cachedData || historical2025Data
  return parseTherapyIncomeFromReport(dataSource, '2025')
}

export function parseTherapyIncome2024(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2024Data, '2024')
}

export function parseTherapyIncome2023(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2023Data, '2023')
}

export function parseTherapyIncome2022(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2022Data, '2022')
}

export function parseTherapyIncome2021(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2021Data, '2021')
}

export function parseTherapyIncome2020(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2020Data, '2020')
}

export function parseTherapyIncome2019(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2019Data, '2019')
}

export function parseTherapyIncome2018(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2018Data, '2018')
}

export function parseTherapyIncome2017(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2017Data, '2017')
}

export function parseTherapyIncome2016(): YTDPoint[] {
  return parseTherapyIncomeFromReport(historical2016Data, '2016')
}
