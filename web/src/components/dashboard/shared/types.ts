// Types for Dashboard components
export type YearRow = {
  year: number
  therapyIncome: number // For 2024+, this represents only therapy income (not including medical director income)
  nonEmploymentCosts: number
  employeePayroll?: number
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
  consultingServicesAgreement?: number // Consulting Services Agreement annual amount (overrides projection)
  prcsDirectorPhysicianId?: string | null // null = explicitly deselected, undefined = use default
  physicians: Physician[]
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
  dataMode: 'Custom' | '2024 Data' | '2025 Data'
}

export type ScenarioKey = 'A' | 'B'

// View mode for scenarios
export type ViewMode = 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'

// Baseline mode for Multi-Year scenarios
export type BaselineMode = '2024 Data' | '2025 Data' | 'Custom'

// YTD-specific settings
export type YTDSettings = {
  isNormalized: boolean
  smoothing: number
  chartType: string
  incomeMode: string
  showTarget: boolean
  [key: string]: any // Allow other YTD chart settings
}

// YTD Scenario (2025 baseline customizations + chart settings)
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
  // 2025 baseline customizations (physicians + grid overrides)
  year_2025_data: FutureYear // Physician panel settings for 2025
  custom_projected_values: Record<string, number> // User's grid overrides for 2025
  is_favorite_a?: boolean // Populated by JOIN with user_favorites
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
  created_at: string
  updated_at: string
  creator_email?: string
}

// NEW MODULAR TYPES

// Current Year Settings Scenario (2025 baseline customizations ONLY)
export type CurrentYearSettingsScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  scenario_type: 'current_year'
  view_mode: 'YTD Detailed'
  year_2025_data: Partial<FutureYear> & { year: number, physicians: Physician[] } // Only modified fields saved
  custom_projected_values: Record<string, number> // Grid overrides for 2025 ONLY ('2025-*' keys)
  ytd_settings: null // Chart settings not saved
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null
  is_favorite_a?: boolean
  created_at: string
  updated_at: string
  creator_email?: string
}

// Projection Scenario (projection settings + 2026-2035, optionally 2024/Custom baseline)
export type ProjectionScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  scenario_type: 'projection'
  view_mode: 'Multi-Year'
  baseline_mode: BaselineMode
  baseline_years: FutureYear[] | null // For 2024/Custom modes (basic data, no grid overrides)
  projection_settings: Projection // Growth rates, global params
  future_years: FutureYear[] // 2026-2035 only
  future_custom_values: Record<string, number> // Grid overrides for 2026-2035 ONLY
  baseline_date: string // ISO date (YYYY-MM-DD)
  qbo_sync_timestamp: string | null
  is_favorite_a?: boolean
  is_favorite_b?: boolean
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

export type Store = {
  historic: YearRow[]
  scenarioA: ScenarioState
  scenarioB?: ScenarioState
  scenarioBEnabled: boolean
  customProjectedValues: Record<string, number>
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
  // Legacy snapshot (for backward compat)
  loadedScenarioSnapshot: {
    scenarioA: ScenarioState
    customProjectedValues: Record<string, number>
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
    future_2026_2035: FutureYear[]
    custom_projected_values_future: Record<string, number> // Only non-'2025-*' keys
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
    value: number
  ) => void
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
  setCustomProjectedValue: (accountName: string, value: number) => void
  removeCustomProjectedValue: (accountName: string) => void
  resetCustomProjectedValues: () => void
  setYtdCustomProjectedValue: (accountName: string, value: number) => void
  removeYtdCustomProjectedValue: (accountName: string) => void
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
  saveScenarioBToDatabase: (
    name: string,
    description: string,
    isPublic: boolean
  ) => Promise<SavedScenario>
  // NEW: Modular scenario methods
  setCurrentYearSetting: (id: string | null, name: string | null, userId?: string | null) => void
  setCurrentProjection: (id: string | null, name: string | null, userId?: string | null) => void
  isCurrentYearSettingsDirty: () => boolean
  isProjectionDirty: () => boolean
  resetCurrentYearSettings: () => void
  resetProjection: () => void
  updateCurrentYearSettingsSnapshot: () => void
  updateProjectionSnapshot: () => void
  saveCurrentYearSettings: (
    name: string,
    description: string,
    isPublic: boolean,
    ytdSettings?: YTDSettings | null
  ) => Promise<CurrentYearSettingsScenario>
  saveProjection: (
    name: string,
    description: string,
    isPublic: boolean,
    target?: 'A' | 'B'
  ) => Promise<ProjectionScenario>
  loadCurrentYearSettings: (id: string) => Promise<CurrentYearSettingsScenario>
  loadProjection: (id: string, target?: 'A' | 'B') => Promise<ProjectionScenario>
  loadDefaultYTDScenario: () => Promise<void>
}