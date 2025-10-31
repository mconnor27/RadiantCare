/**
 * Year Configuration Module
 *
 * Centralized year configuration for the RadiantCare application.
 * Enables year-agnostic operation with admin-controlled baseline year.
 */

// Will be loaded from app_settings in production
// For now, use constants that can be updated
let _baselineYear = 2025
let _projectionYears = 5

/**
 * Core year configuration
 */
export const YEAR_CONFIG = {
  // Dynamically calculated current calendar year
  getCurrentYear: (): number => {
    // Check for test override (for time-travel testing)
    if (typeof window !== 'undefined') {
      const override = localStorage.getItem('TEST_CURRENT_YEAR')
      if (override) return parseInt(override, 10)
    }
    return new Date().getFullYear()
  },

  // Admin configurable baseline year (stored in database)
  get baselineYear(): number {
    return _baselineYear
  },

  set baselineYear(year: number) {
    _baselineYear = year
  },

  // Number of years to project forward
  get projectionYears(): number {
    return _projectionYears
  },

  set projectionYears(years: number) {
    _projectionYears = years
  },

  // Historical data range
  historicalStartYear: 2016,

  // QBO sync configuration
  priorYearCutoffDate: (year: number): string => `${year}-04-15`,
  usePriorYearQBOUntilCutoff: true,

  // Test helpers (for time-travel testing)
  setTestYear: (year: number): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('TEST_CURRENT_YEAR', year.toString())
    }
  },

  clearTestYear: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('TEST_CURRENT_YEAR')
    }
  }
}

/**
 * Get array of projection years based on baseline
 * @returns Array of projection years (e.g., [2026, 2027, 2028, 2029, 2030])
 */
export const getProjectionYearRange = (): number[] => {
  const baseline = YEAR_CONFIG.baselineYear
  return Array.from({ length: YEAR_CONFIG.projectionYears }, (_, i) => baseline + i + 1)
}

/**
 * Get all years including baseline and projections
 * @returns Array of all years (e.g., [2025, 2026, 2027, 2028, 2029, 2030])
 */
export const getAllYears = (): number[] => {
  return [YEAR_CONFIG.baselineYear, ...getProjectionYearRange()]
}

/**
 * Check if a year is the current baseline year
 */
export const isCurrentYear = (year: number): boolean => {
  return year === YEAR_CONFIG.baselineYear
}

/**
 * Check if a year is the prior year (baseline - 1)
 */
export const isPriorYear = (year: number): boolean => {
  return year === YEAR_CONFIG.baselineYear - 1
}

/**
 * Check if a year is in the projection range
 */
export const isProjectionYear = (year: number): boolean => {
  const range = getProjectionYearRange()
  return year >= range[0] && year <= range[range.length - 1]
}

/**
 * Check if a year is historical (before baseline)
 */
export const isHistoricalYear = (year: number): boolean => {
  return year < YEAR_CONFIG.baselineYear && year >= YEAR_CONFIG.historicalStartYear
}

/**
 * Get year offset from baseline (useful for calculations)
 * @param year The year to check
 * @returns Offset from baseline (0 for baseline, 1 for first projection year, etc.)
 */
export const getYearOffset = (year: number): number => {
  return year - YEAR_CONFIG.baselineYear
}

/**
 * Initialize year config from app settings
 * Should be called on app startup
 */
export const initializeYearConfig = async (
  getSetting: (key: string) => Promise<any>
): Promise<void> => {
  try {
    const baselineYear = await getSetting('current_fiscal_year')
    const projectionYears = await getSetting('projection_years')

    if (baselineYear) {
      YEAR_CONFIG.baselineYear = parseInt(baselineYear, 10)
    }
    if (projectionYears) {
      YEAR_CONFIG.projectionYears = parseInt(projectionYears, 10)
    }
  } catch (error) {
    console.error('Failed to initialize year config from settings:', error)
    // Fall back to defaults
  }
}

/**
 * Get the date when prior year data should switch from QBO to snapshot
 */
export const getPriorYearCutoffDate = (): Date => {
  return new Date(YEAR_CONFIG.priorYearCutoffDate(YEAR_CONFIG.baselineYear))
}

/**
 * Check if we should use prior year QBO data (before April 15th)
 */
export const shouldUsePriorYearQBO = (priorYearMarkedComplete: boolean): boolean => {
  if (!YEAR_CONFIG.usePriorYearQBOUntilCutoff) return false
  if (priorYearMarkedComplete) return false

  const today = new Date()
  const cutoffDate = getPriorYearCutoffDate()

  return today < cutoffDate
}
