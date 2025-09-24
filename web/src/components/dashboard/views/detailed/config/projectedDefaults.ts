/**
 * Projected defaults configuration
 *
 * How to use:
 * - Add an entry keyed by the row/account name shown in your grid/chart.
 * - You can provide a static `defaultValue` (what the app should reset to for full-year).
 * - If a row is missing or `defaultValue` is omitted, it falls back to the computed annualized value.
 * - Configure slider min/max via `bounds` either globally or per-row.
 * - Control the slider's initial value via `sliderInitial` either globally or per-row.
 */

export type SliderBounds =
  | { mode: 'standard' } // min = max(0, currentValue * 0.1), max = currentValue * 3
  | { mode: 'percentOfCurrent'; minPercent: number; maxMultiple: number }
  | { mode: 'absolute'; min: number; max: number }

export type SliderInitial = 'annualized' | 'default' | number

export type FallbackWhenNoDefault = 'annualized'

/**
 * Slider step configuration
 * - number: fixed step in dollars
 * - 'auto': computed from bounds
 */
export type SliderStep = number | 'auto'

export type ProjectedAccountDefaults = {
  /**
   * Default reference value for this account/row. Clicking "Default" sets the slider to this.
   */
  defaultValue?: number

  /**
   * Optional slider bounds for this account. If omitted, the component uses the standard strategy.
   */
  bounds?: SliderBounds

  /**
   * Optional per-row initial slider value source.
   * - 'annualized' uses the computed annualized (from YTD)
   * - 'default' uses this row's defaultValue (or fallback if missing)
   * - number uses that exact value
   */
  sliderInitial?: SliderInitial

  /**
   * Optional per-row slider step (dollars). If omitted, global setting applies.
   */
  sliderStep?: SliderStep
}

/**
 * Global settings that provide obvious defaults. Per-row values override these.
 */
export const projectedDefaultsGlobal: {
  fallbackWhenNoDefault: FallbackWhenNoDefault
  sliderInitial: SliderInitial
  bounds: SliderBounds
  sliderStep: SliderStep
} = {
  // If a row is not configured or has no defaultValue, fall back to the computed annualized value
  fallbackWhenNoDefault: 'annualized',
  // Initial slider position if not specified per-row
  sliderInitial: 'annualized',
  // Default bounds strategy for all rows (10%–3x of current/annualized)
  bounds: { mode: 'standard' },
  // Default step: 'auto' (computed from bounds). Set to a number (e.g., 100) to step by that amount.
  sliderStep: 'auto',
}

/**
 * Map of account/row name -> defaults.
 *
 * Examples below demonstrate the full syntax. Replace keys and numbers with your actual rows.
 */
export const projectedDefaultsByAccount: Record<string, ProjectedAccountDefaults> = {
  // Example rows — replace with your real account/row names
  'Total 7100 Therapy Income': {
    //defaultValue: 125000,      // App default for this row
    // Annualized is computed live from YTD; no need to store
    bounds: { mode: 'absolute', min: 2000000, max: 4000000 },
    sliderInitial: 'annualized',
    sliderStep: 1000, // example: step by $1,000 for this row
  },
  'Medical Director Hours (Shared)': {
    defaultValue: 119374,
    bounds: { mode: 'absolute', min: 0, max: 120000 },
    sliderInitial: 'default',
    // sliderStep: 'auto',
  },
  'Medical Director Hours (PRCS)': {
    bounds: { mode: 'absolute', min: 0, max: 120000 },
    sliderInitial: 'default',
    // sliderStep: 'auto',
  },
  // Add more rows here as needed...
}

/**
 * Helper function to find account config by trimmed name (ignores leading/trailing whitespace)
 */
export function findAccountConfig(accountName: string): ProjectedAccountDefaults | undefined {
  // First try exact match
  if (projectedDefaultsByAccount[accountName]) {
    return projectedDefaultsByAccount[accountName]
  }
  
  // Then try trimmed match
  const trimmedName = accountName.trim()
  if (projectedDefaultsByAccount[trimmedName]) {
    return projectedDefaultsByAccount[trimmedName]
  }
  
  // Finally try finding a config key that matches when both are trimmed
  for (const [configKey, config] of Object.entries(projectedDefaultsByAccount)) {
    if (configKey.trim() === trimmedName) {
      return config
    }
  }
  
  return undefined
}

/**
 * Returns the configured default for an account, falling back to the provided
 * annualized value when configuration is not present.
 */
export function getDefaultValue(
  accountName: string,
  annualizedFallback: number
): number {
  const config = findAccountConfig(accountName)
  if (typeof config?.defaultValue === 'number') return config.defaultValue
  // Currently only supported global fallback is 'annualized'
  if (projectedDefaultsGlobal.fallbackWhenNoDefault === 'annualized') return annualizedFallback
  return annualizedFallback
}

/**
 * Resolves slider min/max based on per-account config or the standard strategy.
 * Standard strategy: min = max(0, currentValue * 0.1), max = currentValue * 3
 */
export function getSliderBounds(
  accountName: string,
  currentValue: number
): { minValue: number; maxValue: number } {
  const config = findAccountConfig(accountName)
  const bounds = config?.bounds ?? projectedDefaultsGlobal.bounds

  if (!bounds || bounds.mode === 'standard') {
    return {
      minValue: Math.max(0, currentValue * 0.1),
      maxValue: currentValue * 3,
    }
  }

  if (bounds.mode === 'percentOfCurrent') {
    const minValue = Math.max(0, currentValue * bounds.minPercent)
    const maxValue = currentValue * bounds.maxMultiple
    return { minValue, maxValue }
  }

  // absolute
  return { minValue: bounds.min, maxValue: bounds.max }
}

/**
 * Resolves the slider's initial value source.
 */
export function getInitialSliderValue(
  accountName: string,
  defaultValue: number,
  annualizedValue: number
): number {
  const row = findAccountConfig(accountName)
  const source = row?.sliderInitial ?? projectedDefaultsGlobal.sliderInitial
  if (source === 'default') return defaultValue
  if (source === 'annualized') return annualizedValue
  if (typeof source === 'number') return source
  return annualizedValue
}

/**
 * Resolves the slider step. If 'auto', compute as max(1, round((max-min)/1000)).
 */
export function getSliderStep(
  accountName: string,
  minValue: number,
  maxValue: number
): number {
  const row = findAccountConfig(accountName)
  const step = row?.sliderStep ?? projectedDefaultsGlobal.sliderStep
  if (step === 'auto') {
    const computed = Math.round((maxValue - minValue) / 1000)
    return Math.max(1, computed)
  }
  const numeric = Number(step)
  if (!isNaN(numeric) && numeric > 0) return numeric
  return 1
}

export default getDefaultValue


