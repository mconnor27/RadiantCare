import { parseTherapyIncome2025 } from '../../../../../historical_data/therapyIncomeParser'
import { loadYearlyGridData } from './yearlyDataTransformer'
import { authenticatedFetch } from '../../../../../lib/api'
import type { Physician } from '../../../shared/types'
import { logger } from '../../../../../lib/logger'

export type CachedYearData = {
  daily: any
  summary: any
  equity: any
}

export type LoadYearResult = {
  ytdPoints: any[]
  cachedData: CachedYearData | null
}

export type ExtractedYearValues = {
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
 * Loads current year data (2025) based on environment mode.
 * In production: tries to fetch cached data from API, falls back to historical JSON
 * In sandbox: uses historical JSON data directly
 *
 * If environment is not specified, tries production first, then falls back to sandbox
 */
export async function loadCurrentYearData(environment?: 'sandbox' | 'production'): Promise<LoadYearResult> {
  if (environment === 'sandbox') {
    logger.info('QBO_CACHE', 'Using sandbox mode - loading historical JSON')
    const ytdPoints = parseTherapyIncome2025()
    return {
      ytdPoints,
      cachedData: null
    }
  }

  // Production mode (or auto-detect): try to load cached data, fall back to historical
  try {
    logger.debug('QBO_CACHE', 'Attempting to load cached 2025 data')
    const res = await authenticatedFetch('/api/qbo/cached?year=2025')

    if (!res.ok) {
      logger.info('QBO_CACHE', 'No cached data available, using historical JSON fallback')
      return {
        ytdPoints: parseTherapyIncome2025(),
        cachedData: null
      }
    }

    const cache = await res.json()

    if (cache?.daily) {
      logger.info('QBO_CACHE', 'Successfully loaded cached 2025 data', {
        hasSummary: !!cache.summary,
        hasEquity: !!cache.equity,
        lastSync: cache.lastSyncTimestamp
      })
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
      logger.warn('QBO_CACHE', 'Cache exists but missing daily data, using fallback')
      return {
        ytdPoints: parseTherapyIncome2025(),
        cachedData: null
      }
    }
  } catch (err) {
    logger.error('QBO_CACHE', 'Error loading cached data, using fallback', err)
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
 * Loads current year (2025) data and extracts all values needed for the store.
 * This combines data loading + grid calculation + value extraction.
 */
export async function loadCurrentYearValuesForReset(
  physicians: Physician[],
  benefitGrowthPct: number,
  locumCosts: number,
  environment?: 'sandbox' | 'production'
): Promise<ExtractedYearValues> {
  // Load the 2025 data
  const { cachedData } = await loadCurrentYearData(environment)

  // Import the actual 2025 PRCS value from defaults
  const { ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS } = await import('../../../shared/defaults')

  // Find default PRCS director (Suszko for 2025)
  const defaultPrcsDirector = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))

  // Load grid data with the cached summary if available
  const gridData = await loadYearlyGridData(
    {}, // collapsed sections - empty for reset
    {}, // custom projected values - empty for reset
    {
      physicians,
      benefitGrowthPct,
      locumCosts,
      prcsDirectorPhysicianId: defaultPrcsDirector?.id,
      prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS
    },
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

  logger.info('DATA_TRANSFORM', 'Extracted 2025 values for reset', {
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

/**
 * Syncs fresh current year (2025) values from QBO cache to the store.
 * This is needed on mobile where YearlyDataGrid doesn't render (and thus doesn't auto-sync).
 * Respects user's custom projected values (grid overrides) from scenarios or desktop edits.
 *
 * @param store - Dashboard store instance
 * @param cachedSummary - Cached QBO summary data
 */
export async function syncStoreFromCurrentYearCache(
  store: any,
  cachedSummary: any | null
): Promise<void> {
  if (!cachedSummary) {
    logger.debug('QBO_CACHE', 'No cached summary, skipping store sync')
    return
  }

  // Use store.ytdData (the YTD store, not scenarioA.future)
  const ytdData = store.ytdData
  if (!ytdData) {
    logger.warn('QBO_CACHE', 'No YTD data found, skipping store sync')
    return
  }

  logger.info('QBO_CACHE', 'Syncing cache to store (mobile mode)')

  try {
    // IMPORTANT: Pass ytdCustomProjectedValues to preserve user overrides from scenarios/desktop
    const gridData = await loadYearlyGridData(
      {}, // collapsed sections
      store.ytdCustomProjectedValues || {}, // YTD custom projected values - preserve these!
      {
        physicians: ytdData.physicians,
        benefitGrowthPct: store.scenarioA.projection.benefitCostsGrowthPct,
        locumCosts: ytdData.locumCosts,
        prcsDirectorPhysicianId: ytdData.prcsDirectorPhysicianId,
        prcsMedicalDirectorHours: ytdData.prcsMedicalDirectorHours,
        medicalDirectorHours: ytdData.medicalDirectorHours,  // ADD THIS!
        consultingServicesAgreement: ytdData.consultingServicesAgreement  // ADD THIS TOO!
      },
      cachedSummary
    )

    // Helper to extract value, respecting custom overrides (same logic as desktop grid)
    const extractValue = (accountName: string): number => {
      // First check if there's a custom value (preserve user overrides)
      const ytdCustomProjectedValues = store.ytdCustomProjectedValues || {}
      if (ytdCustomProjectedValues[accountName] !== undefined) {
        logger.debug('GRID', 'Using custom value', {
          account: accountName,
          value: ytdCustomProjectedValues[accountName]
        })
        return ytdCustomProjectedValues[accountName]
      }

      // Otherwise, extract from grid (QBO cache value)
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
        logger.debug('GRID', 'Extracted grid value', { account: accountName, value })
        return value
      }
      logger.warn('GRID', 'Row not found in grid', { account: accountName })
      return 0
    }

    // Extract all financial values (respecting custom overrides)
    const therapyIncomeTotal = extractValue('Total 7100 Therapy Income')
    const otherIncomeTotal = extractValue('Total Other Income')
    const therapyIncome = therapyIncomeTotal + otherIncomeTotal
    const nonEmploymentCosts = extractValue('Non-Employment Costs')
    const nonMdEmploymentCosts = extractValue('Staff Employment')
    const locumCosts = extractValue('8322 Locums - Salary')
    const miscEmploymentCosts = extractValue('Misc Employment')
    const medicalDirectorHours = extractValue('Medical Director Hours (Shared)')
    const prcsMedicalDirectorHours = extractValue('Medical Director Hours (PRCS)')
    const consultingServicesAgreement = extractValue('Consulting Agreement/Other')

    logger.debug('QBO_CACHE', 'Extracted values from grid', {
      therapyIncomeTotal,
      otherIncomeTotal,
      therapyIncome,
      nonEmploymentCosts,
      nonMdEmploymentCosts,
      locumCosts,
      miscEmploymentCosts,
      medicalDirectorHours,
      prcsMedicalDirectorHours,
      consultingServicesAgreement
    })

    // IMPORTANT: Update store.ytdData (which PartnerCompensation reads from)
    // NOT store.scenarioA.future[2025] (which is only for multi-year projections)
    logger.debug('STORE', 'Updating YTD values from cache')
    store.setYtdValue('therapyIncome', therapyIncome)
    store.setYtdValue('nonEmploymentCosts', nonEmploymentCosts)
    store.setYtdValue('nonMdEmploymentCosts', nonMdEmploymentCosts)
    store.setYtdValue('locumCosts', locumCosts)
    store.setYtdValue('miscEmploymentCosts', miscEmploymentCosts)
    store.setYtdValue('medicalDirectorHours', medicalDirectorHours)
    store.setYtdValue('prcsMedicalDirectorHours', prcsMedicalDirectorHours)
    store.setYtdValue('consultingServicesAgreement', consultingServicesAgreement)

    const customCount = Object.keys(store.ytdCustomProjectedValues || {}).length
    logger.info('QBO_CACHE', 'Store sync completed', {
      customOverrides: customCount,
      values: {
        therapyIncome,
        nonEmploymentCosts,
        nonMdEmploymentCosts,
        locumCosts,
        miscEmploymentCosts,
        medicalDirectorHours,
        prcsMedicalDirectorHours,
        consultingServicesAgreement
      }
    })
  } catch (error) {
    logger.error('QBO_CACHE', 'Failed to sync store from cache', error)
  }
}
