// Types for Dashboard components
export type YearRow = {
  year: number
  therapyIncome: number // For 2024+, this represents only therapy income (not including medical director income)
  nonEmploymentCosts: number
  employeePayroll?: number
  description?: string
}

// Site data for per-site income mode
export type SiteData = {
  lacey: number
  centralia: number
  aberdeen: number
}

export type YTDPointWithSites = { 
  date: string
  cumulativeIncome: number
  monthDay: string
  sites?: SiteData
}

// Income chart modes
export type IncomeMode = 'total' | 'per-site'

export type PhysicianType = 'partner' | 'employee' | 'employeeToPartner' | 'partnerToRetire' | 'newEmployee' | 'employeeToTerminate'

export type Physician = {
  id: string
  name: string
  type: PhysicianType
  salary?: number
  weeksVacation?: number
  // For employee types (employee, newEmployee, employeeToTerminate, employeeToPartner): vacation weeks during employee portion
  employeeWeeksVacation?: number
  // For employeeToPartner: vacation weeks during partner portion of year
  partnerWeeksVacation?: number
  // For mixed type: portion of the year as an employee (0..1). Remainder is partner.
  employeePortionOfYear?: number
  // For partnerToRetire: portion of the year working as partner (0..1). Remainder is retired.
  partnerPortionOfYear?: number
  // For newEmployee: portion of the year when they start (0 = Jan 1, 1 = Dec 31)
  startPortionOfYear?: number
  // For employeeToTerminate: portion of the year when they terminate (0 = Jan 1, 1 = Dec 31)
  terminatePortionOfYear?: number
  // Whether this employee receives benefits (medical/dental/vision)
  receivesBenefits?: boolean
  // Whether this employee receives bonuses
  receivesBonuses?: boolean
  // Relocation/Signing bonus amount
  bonusAmount?: number
  // Whether this partner has Medical Director Hours
  hasMedicalDirectorHours?: boolean
  // Medical Director Hours percentage (0-100)
  medicalDirectorHoursPercentage?: number
  // Buyout cost for retiring partners
  buyoutCost?: number
  // Trailing shared MD dollars for prior-year retirees
  trailingSharedMdAmount?: number
  // Additional Days Worked (Internal Locums) - $2,000 per day
  additionalDaysWorked?: number
}

export type FutureYear = {
  year: number
  therapyIncome: number // Therapy income only (not including medical director income)
  nonEmploymentCosts: number
  nonMdEmploymentCosts: number
  locumCosts: number
  miscEmploymentCosts: number
  // Optional per-site therapy income totals for this year (from grid/store)
  therapyLacey?: number
  therapyCentralia?: number
  therapyAberdeen?: number
  medicalDirectorHours?: number
  prcsMedicalDirectorHours?: number
  prcsMdHoursMode?: 'calculated' | 'annualized' // How PRCS MD Hours are determined (YTD only)
  consultingServicesAgreement?: number // Consulting Services Agreement annual amount (overrides projection)
  prcsDirectorPhysicianId?: string | null // null = explicitly deselected, undefined = use default
  physicians: Physician[]
  // NEW: Track which fields have been explicitly overridden by the user (not computed from formulas)
  _overrides?: {
    therapyIncome?: boolean
    nonEmploymentCosts?: boolean
    nonMdEmploymentCosts?: boolean
    miscEmploymentCosts?: boolean
    locumCosts?: boolean
    medicalDirectorHours?: boolean
    prcsMedicalDirectorHours?: boolean
    consultingServicesAgreement?: boolean
    therapyLacey?: boolean
    therapyCentralia?: boolean
    therapyAberdeen?: boolean
    physicians?: boolean
    prcsDirectorPhysicianId?: boolean
  }
}

export type Projection = {
  incomeGrowthPct: number // Total income growth percentage
  medicalDirectorHours: number // Medical Director Hours annual amount (0-250K)
  prcsMedicalDirectorHours: number // PRCS Medical Director Hours annual amount (0-90K)
  consultingServicesAgreement: number // Consulting Services Agreement annual amount (0-20K)
  nonEmploymentCostsPct: number // Non-Employment Costs growth percentage
  nonMdEmploymentCostsPct: number // Staff Employment Costs growth percentage
  locumsCosts: number // Locums costs in dollars (global override)
  miscEmploymentCostsPct: number // Misc Employment Costs growth percentage
  benefitCostsGrowthPct: number // Benefit Costs growth percentage
}

export type ScenarioState = {
  future: FutureYear[]
  projection: Projection
  selectedYear: number
  dataMode: BaselineMode // Use BaselineMode type for consistency
}

export type ScenarioKey = 'A' | 'B'

// View mode for scenarios
export type ViewMode = 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'

// Baseline mode for Multi-Year scenarios
// NOTE: Now year-agnostic, but keeping old values for backward compat
export type BaselineMode =
  | 'Current Year Data'  // New preferred value
  | 'Prior Year Data'    // New preferred value
  | 'Custom'
  | '2024 Data'          // Legacy (converted to Prior/Current Year Data on load)
  | '2025 Data'          // Legacy (converted to Prior/Current Year Data on load)
  | '2026 Data'          // Legacy (converted to Prior/Current Year Data on load)

// YTD-specific settings
export type YTDSettings = {
  isNormalized: boolean
  smoothing: number
  chartType: string
  incomeMode: string
  showTarget: boolean
  [key: string]: any // Allow other YTD chart settings
}

// YTD Scenario (current year baseline customizations + chart settings)
export type YTDScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  view_mode: 'YTD Detailed'
  ytd_settings: YTDSettings
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null // ISO timestamp
  baseline_year?: number // NEW: Year this scenario was created for (for migration warnings)
  // Current year baseline customizations (physicians + grid overrides)
  baseline_year_data?: FutureYear // NEW: Renamed from year_2025_data
  year_2025_data?: FutureYear // LEGACY: Keep for backward compat, converted on load
  custom_projected_values: Record<string, number> // User's grid overrides for baseline year
  is_favorite_a?: boolean // Populated by JOIN with user_favorites
  is_favorite_current?: boolean // Populated by JOIN with user_favorites
  created_at: string
  updated_at: string
  creator_email?: string
}

// Multi-Year Scenario (complete with baseline + projections)
export type MultiYearScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  view_mode: 'Multi-Year'
  baseline_mode: BaselineMode
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null // ISO timestamp
  scenario_data: {
    scenarioA: ScenarioState
    scenarioBEnabled: boolean
    scenarioB?: ScenarioState
    customProjectedValues: Record<string, number>
  }
  is_favorite_a?: boolean // Populated by JOIN with user_favorites
  is_favorite_b?: boolean // Populated by JOIN with user_favorites
  is_favorite_current?: boolean // Populated by JOIN with user_favorites
  created_at: string
  updated_at: string
  creator_email?: string
}

// NEW MODULAR TYPES

// Current Year Settings Scenario (current year baseline customizations ONLY)
export type CurrentYearSettingsScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  scenario_type: 'current_year'
  view_mode: 'YTD Detailed'
  baseline_year?: number // NEW: Year this scenario was created for (for migration warnings)
  baseline_year_data?: Partial<FutureYear> & { year: number, physicians: Physician[] } // NEW: Renamed
  year_2025_data?: Partial<FutureYear> & { year: number, physicians: Physician[] } // LEGACY: Only modified fields saved
  custom_projected_values: Record<string, number> // Grid overrides for baseline year ONLY
  ytd_settings: null // Chart settings not saved
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null
  is_favorite_a?: boolean
  is_favorite_current?: boolean
  created_at: string
  updated_at: string
  creator_email?: string
}

// Projection Scenario (projection settings + future years, optionally Prior Year/Custom baseline)
export type ProjectionScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  scenario_type: 'projection'
  view_mode: 'Multi-Year'
  baseline_mode: BaselineMode
  baseline_year?: number // NEW: Year this scenario was created for (for migration warnings)
  projection_year_range?: number[] // NEW: Years included in projection [2026, 2027, 2028, 2029, 2030]
  baseline_years: FutureYear[] | null // For Prior Year/Custom modes (basic data, no grid overrides)
  projection_settings: Projection // Growth rates, global params
  future_years: FutureYear[] // Projection years (dynamic based on baseline year)
  future_custom_values: Record<string, number> // Grid overrides for projection years ONLY
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null
  is_favorite_a?: boolean
  is_favorite_b?: boolean
  is_favorite_current?: boolean
  created_at: string
  updated_at: string
  creator_email?: string
}

// Union type for all scenarios (legacy + new modular types)
export type SavedScenario = YTDScenario | MultiYearScenario | CurrentYearSettingsScenario | ProjectionScenario

// Type guard to check if scenario is YTD (legacy)
export function isYTDScenario(scenario: SavedScenario): scenario is YTDScenario {
  return scenario.view_mode === 'YTD Detailed' && !('scenario_type' in scenario)
}

// Type guard to check if scenario is Multi-Year (legacy)
export function isMultiYearScenario(scenario: SavedScenario): scenario is MultiYearScenario {
  return scenario.view_mode === 'Multi-Year' && !('scenario_type' in scenario)
}

// Type guard for Current Year Settings
export function isCurrentYearSettingsScenario(scenario: SavedScenario): scenario is CurrentYearSettingsScenario {
  return 'scenario_type' in scenario && scenario.scenario_type === 'current_year'
}

// Type guard for Projection
export function isProjectionScenario(scenario: SavedScenario): scenario is ProjectionScenario {
  return 'scenario_type' in scenario && scenario.scenario_type === 'projection'
}

/**
 * Normalize baseline mode from legacy year-specific values to generic values
 * @param mode The baseline mode to normalize
 * @param baselineYear The current baseline year (from app settings)
 * @returns Normalized baseline mode
 */
export function normalizeBaselineMode(mode: BaselineMode, baselineYear: number): BaselineMode {
  // Already normalized or Custom
  if (mode === 'Current Year Data' || mode === 'Prior Year Data' || mode === 'Custom') {
    return mode
  }

  // Convert old year-specific modes to generic
  const yearMatch = mode.match(/(\d{4})/)
  if (yearMatch) {
    const modeYear = parseInt(yearMatch[1], 10)
    if (modeYear === baselineYear) return 'Current Year Data'
    if (modeYear === baselineYear - 1) return 'Prior Year Data'
    // If neither, treat as custom (shouldn't happen but safe fallback)
    return 'Custom'
  }

  // Fallback
  return mode
}

export type Store = {
  historic: YearRow[]
  scenarioA: ScenarioState
  scenarioB?: ScenarioState
  scenarioBEnabled: boolean
  // REMOVED: customProjectedValues (legacy - Multi-Year uses _overrides flags)
  suppressNextGridSync?: boolean
  // NEW: Dedicated YTD state (separate from Scenario A/B)
  ytdData: FutureYear // Current year (2025) data for YTD view
  ytdCustomProjectedValues: Record<string, number> // Grid overrides for YTD view (2025-* keys)
  currentScenarioId: string | null // Legacy - for backward compat
  currentScenarioName: string | null // Legacy - for backward compat
  currentScenarioUserId: string | null // Legacy - for backward compat
  currentScenarioBId: string | null
  currentScenarioBName: string | null
  currentScenarioBUserId: string | null
  // NEW: Split scenario tracking
  currentYearSettingId: string | null
  currentYearSettingName: string | null
  currentYearSettingUserId: string | null
  currentProjectionId: string | null
  currentProjectionName: string | null
  currentProjectionUserId: string | null
  // Last active view mode (for session restoration)
  lastViewMode?: 'Multi-Year' | 'YTD Detailed' | 'YTD Mobile'
  // Legacy snapshot (for backward compat)
  loadedScenarioSnapshot: {
    scenarioA: ScenarioState
    // REMOVED: customProjectedValues (legacy)
  } | null
  loadedScenarioBSnapshot: {
    scenarioB: ScenarioState
  } | null
  // NEW: Split snapshots for modular system
  loadedCurrentYearSettingsSnapshot: {
    ytdData: FutureYear
    ytdCustomProjectedValues: Record<string, number> // YTD grid overrides
  } | null
  loadedProjectionSnapshot: {
    baseline_mode: BaselineMode
    baseline_years?: FutureYear[] // For 2024/Custom modes
    projection: Projection
    future_2026_2030: FutureYear[]
    custom_projected_values_future: Record<string, number> // Only non-'2025-*' keys
  } | null
  // Expected projection snapshots (for dirty detection against baseline changes)
  expectedProjectionSnapshotA: {
    baselineYear: FutureYear
    future_2026_2030: FutureYear[]
  } | null
  expectedProjectionSnapshotB: {
    baselineYear: FutureYear
    future_2026_2030: FutureYear[]
  } | null
  setScenarioEnabled: (enabled: boolean) => void
  setFutureValue: (
    scenario: ScenarioKey,
    year: number,
    field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumCosts' | 'miscEmploymentCosts' | 'medicalDirectorHours' | 'prcsMedicalDirectorHours' | 'consultingServicesAgreement' | 'therapyLacey' | 'therapyCentralia' | 'therapyAberdeen',
    value: number
  ) => void
  setYtdValue: (
    field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumCosts' | 'miscEmploymentCosts' | 'medicalDirectorHours' | 'prcsMedicalDirectorHours' | 'consultingServicesAgreement' | 'therapyLacey' | 'therapyCentralia' | 'therapyAberdeen',
    value: number,
    options?: { skipRecompute?: boolean }
  ) => void
  setPrcsMdHoursMode: (mode: 'calculated' | 'annualized', annualizedValue?: number) => void
  upsertPhysician: (scenario: ScenarioKey, year: number, physician: Physician) => void
  removePhysician: (scenario: ScenarioKey, year: number, physicianId: string) => void
  reorderPhysicians: (scenario: ScenarioKey, year: number, fromIndex: number, toIndex: number) => void
  // YTD-specific physician methods
  upsertYtdPhysician: (physician: Physician) => void
  removeYtdPhysician: (physicianId: string) => void
  reorderYtdPhysicians: (fromIndex: number, toIndex: number) => void
  setYtdPrcsDirector: (physicianId?: string | null) => void
  setProjectionField: (scenario: ScenarioKey, field: keyof Projection, value: number) => void
  applyProjectionFromLastActual: (scenario: ScenarioKey) => void
  setSelectedYear: (scenario: ScenarioKey, year: number) => void
  setLastViewMode: (viewMode: 'Multi-Year' | 'YTD Detailed' | 'YTD Mobile') => void
  setDataMode: (scenario: ScenarioKey, mode: 'Custom' | '2024 Data' | '2025 Data') => void
  loadSnapshot: (snapshot: { scenarioA: ScenarioState; scenarioBEnabled: boolean; scenarioB?: ScenarioState }) => void
  resetToDefaults: (skip2025?: boolean) => void
  resetOnly2025: (scenario: ScenarioKey) => Promise<void>
  resetPhysicians: (scenario: ScenarioKey, year: number) => void
  resetAllPhysicians: (scenario: ScenarioKey, skip2025?: boolean) => void
  resetProjectionSettings: (scenario: ScenarioKey, skip2025?: boolean) => void
  resetYearByYearValues: (scenario: ScenarioKey, skip2025?: boolean) => void
  resetViewSettings: (scenario: ScenarioKey, skip2025?: boolean) => void
  setPrcsDirector: (scenario: ScenarioKey, year: number, physicianId?: string | null) => void
  ensureBaselineYear: (scenario: ScenarioKey, year: number) => Promise<void>
  // REMOVED: setCustomProjectedValue, removeCustomProjectedValue, resetCustomProjectedValues (legacy)
  setYtdCustomProjectedValue: (accountName: string, value: number) => void
  removeYtdCustomProjectedValue: (accountName: string) => void
  resetYtdCustomProjectedValues: () => void
  setSuppressNextGridSync: (suppress: boolean) => void
  consumeSuppressNextGridSync: () => boolean
  // Scenario management methods
  saveScenarioToDatabase: (
    name: string, 
    description: string, 
    isPublic: boolean, 
    viewMode: ViewMode,
    ytdSettings?: YTDSettings
  ) => Promise<SavedScenario>
  loadScenarioFromDatabase: (id: string, target?: 'A' | 'B', loadBaseline?: boolean) => Promise<any>
  setCurrentScenario: (id: string | null, name: string | null, userId?: string | null) => void
  setCurrentScenarioB: (id: string | null, name: string | null, userId?: string | null) => void
  updateScenarioSnapshot: (scenario?: 'A' | 'B') => void
  resetScenarioFromSnapshot: (scenario?: 'A' | 'B') => void
  // NEW: Modular scenario methods
  setCurrentYearSetting: (id: string | null, name: string | null, userId?: string | null) => void
  setCurrentProjection: (id: string | null, name: string | null, userId?: string | null) => void
  isCurrentYearSettingsDirty: () => boolean
  isProjectionDirty: (target?: ScenarioKey) => boolean
  resetCurrentYearSettings: () => void
  resetProjection: () => void
  updateCurrentYearSettingsSnapshot: () => void
  updateProjectionSnapshot: () => void
  saveCurrentYearSettings: (
    name: string,
    description: string,
    isPublic: boolean,
    ytdSettings?: YTDSettings | null,
    forceNew?: boolean
  ) => Promise<CurrentYearSettingsScenario>
  saveProjection: (
    name: string,
    description: string,
    isPublic: boolean,
    target?: 'A' | 'B',
    forceNew?: boolean  // Force creating a new scenario (for "Save As")
  ) => Promise<ProjectionScenario>
  loadCurrentYearSettings: (id: string) => Promise<CurrentYearSettingsScenario>
  loadProjection: (id: string, target?: 'A' | 'B') => Promise<ProjectionScenario>
  loadDefaultYTDScenario: (year?: number) => Promise<void>
  // NEW: Projection overlay methods for 2025 baseline
  ensureYtdBaseline2025: () => Promise<void>
  getYtdBaselineFutureYear2025: () => FutureYear
  buildScenarioFromProjection: (params: {
    projection: Projection
    futureYearsFromScenario: FutureYear[]
    baselineYear: FutureYear
    baselineMode: BaselineMode
  }) => { future: FutureYear[] }
  computeExpectedFromBaseline: (params: {
    baselineYear: FutureYear
    projection: Projection
    baselineMode: BaselineMode
  }) => FutureYear[]
  snapshotExpectedProjection: (which: 'A' | 'B') => void
  recomputeProjectionsFromBaseline: () => void
}