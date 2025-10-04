import { parseTherapyIncome2025 } from '../../../../../historical_data/therapyIncomeParser'
import historical2025Data from '../../../../../historical_data/2025_daily.json'
import { loadYearlyGridData } from './yearlyDataTransformer'
import type { Physician } from '../../../shared/types'

export type Cached2025Data = {
  daily: any
  summary: any
  equity: any
}

export type Load2025Result = {
  ytdPoints: any[]
  cachedData: Cached2025Data | null
}

export type Extracted2025Values = {
  therapyIncome: number
  therapyLacey: number
  therapyCentralia: number
  therapyAberdeen: number
  nonEmploymentCosts: number
  nonMdEmploymentCosts: number
  locumCosts: number
  miscEmploymentCosts: number
  medicalDirectorHours: number
  prcsMedicalDirectorHours: number
  consultingServicesAgreement: number
}

/**
 * Loads 2025 data based on environment mode.
 * In production: tries to fetch cached data from API, falls back to historical JSON
 * In sandbox: uses historical JSON data directly
 *
 * If environment is not specified, tries production first, then falls back to sandbox
 */
export async function load2025Data(environment?: 'sandbox' | 'production'): Promise<Load2025Result> {
  if (environment === 'sandbox') {
    // Sandbox mode: use historical JSON files
    const ytdPoints = parseTherapyIncome2025()
    return {
      ytdPoints,
      cachedData: null
    }
  }

  // Production mode (or auto-detect): try to load cached data, fall back to historical
  try {
    const res = await fetch('/api/qbo/cached-2025')

    if (!res.ok) {
      // No cached data, use fallback
      console.log('No cached data available, using historical JSON fallback')
      return {
        ytdPoints: parseTherapyIncome2025(),
        cachedData: null
      }
    }

    const cache = await res.json()

    if (cache?.daily) {
      // Parse the cached daily report
      const ytdPoints = parseTherapyIncome2025(cache.daily)
      return {
        ytdPoints,
        cachedData: {
          daily: cache.daily,
          summary: cache.summary,
          equity: cache.equity
        }
      }
    } else {
      // Fallback to historical
      return {
        ytdPoints: parseTherapyIncome2025(),
        cachedData: null
      }
    }
  } catch (err) {
    console.error('Error loading cached data, using fallback:', err)
    return {
      ytdPoints: parseTherapyIncome2025(),
      cachedData: null
    }
  }
}

/**
 * Helper function to extract a value from grid data by account name
 */
function extractGridValue(gridData: { rows: any[], columns: any[] }, accountName: string): number {
  const projectedColIndex = gridData.columns.length - 1

  const row = gridData.rows.find((row: any) => {
    const accountCell = row.cells?.[0] as any
    const cellText = accountCell?.text?.trim() || ''
    return cellText === accountName || cellText.includes(accountName)
  })

  if (row) {
    const projectedCell = row.cells?.[projectedColIndex] as any
    const cellText = projectedCell?.text || '0'
    const value = parseFloat(cellText.replace(/[$,\s]/g, '')) || 0
    return value
  }

  return 0
}

/**
 * Loads 2025 data and extracts all values needed for the store.
 * This combines data loading + grid calculation + value extraction.
 */
export async function load2025ValuesForReset(
  physicians: Physician[],
  benefitGrowthPct: number,
  locumCosts: number,
  environment?: 'sandbox' | 'production'
): Promise<Extracted2025Values> {
  // Load the 2025 data
  const { cachedData } = await load2025Data(environment)

  // Load grid data with the cached summary if available
  const gridData = await loadYearlyGridData(
    {}, // collapsed sections - empty for reset
    {}, // custom projected values - empty for reset
    { physicians, benefitGrowthPct, locumCosts },
    cachedData?.summary
  )

  // Extract therapy income to match YearlyDataGrid logic exactly
  // YearlyDataGrid uses: [ 'Total 7100 Therapy Income', 'Total Other Income' ]
  const therapyIncomeTotal = extractGridValue(gridData, 'Total 7100 Therapy Income')
  const otherIncomeTotal = extractGridValue(gridData, 'Total Other Income')
  const therapyIncome = therapyIncomeTotal + otherIncomeTotal

  // Extract per-site totals using the same row labels YearlyDataGrid sync uses
  const laceyIncome = extractGridValue(gridData, '7105 Therapy - Lacey')
  const centraliaIncome = extractGridValue(gridData, '7110 Therapy - Centralia')
  const aberdeenIncome = extractGridValue(gridData, '7108 Therapy - Aberdeen')

  // Extract other values - use the exact row names that YearlyDataGrid sync uses
  const nonEmploymentCosts = extractGridValue(gridData, 'Non-Employment Costs')
  const nonMdEmploymentCosts = extractGridValue(gridData, 'Staff Employment')
  const locumsSalary = extractGridValue(gridData, '8322 Locums - Salary')
  const miscEmploymentCosts = extractGridValue(gridData, 'Misc Employment')
  const medicalDirectorHours = extractGridValue(gridData, 'Medical Director Hours (Shared)')
  const prcsMedicalDirectorHours = extractGridValue(gridData, 'Medical Director Hours (PRCS)')
  const consultingServicesAgreement = extractGridValue(gridData, 'Consulting Agreement/Other')

  console.log('📦 Extracted 2025 values for reset:', {
    therapyIncome,
    therapyLacey: laceyIncome,
    therapyCentralia: centraliaIncome,
    therapyAberdeen: aberdeenIncome,
    nonEmploymentCosts,
    nonMdEmploymentCosts,
    locumCosts: locumsSalary,
    miscEmploymentCosts,
    medicalDirectorHours,
    prcsMedicalDirectorHours,
    consultingServicesAgreement
  })

  return {
    therapyIncome,
    therapyLacey: laceyIncome,
    therapyCentralia: centraliaIncome,
    therapyAberdeen: aberdeenIncome,
    nonEmploymentCosts,
    nonMdEmploymentCosts,
    locumCosts: locumsSalary,
    miscEmploymentCosts,
    medicalDirectorHours,
    prcsMedicalDirectorHours,
    consultingServicesAgreement
  }
}
