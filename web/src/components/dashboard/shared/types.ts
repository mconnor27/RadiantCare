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
export type ViewMode = 'YTD Detailed' | 'Multi-Year'

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
  is_favorite_a: boolean // Whether this is the favorite A scenario
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
  is_favorite_a: boolean // Whether this is the favorite A scenario
  is_favorite_b: boolean // Whether this is the favorite B scenario
  created_at: string
  updated_at: string
  creator_email?: string
}

// Union type for all scenarios
export type SavedScenario = YTDScenario | MultiYearScenario

// Type guard to check if scenario is YTD
export function isYTDScenario(scenario: SavedScenario): scenario is YTDScenario {
  return scenario.view_mode === 'YTD Detailed'
}

// Type guard to check if scenario is Multi-Year
export function isMultiYearScenario(scenario: SavedScenario): scenario is MultiYearScenario {
  return scenario.view_mode === 'Multi-Year'
}

export type Store = {
  historic: YearRow[]
  scenarioA: ScenarioState
  scenarioB?: ScenarioState
  scenarioBEnabled: boolean
  customProjectedValues: Record<string, number>
  suppressNextGridSync?: boolean
  currentScenarioId: string | null
  currentScenarioName: string | null
  currentScenarioUserId: string | null
  currentScenarioBId: string | null
  currentScenarioBName: string | null
  currentScenarioBUserId: string | null
  // Snapshot of loaded scenario state for change detection
  loadedScenarioSnapshot: {
    scenarioA: ScenarioState
    customProjectedValues: Record<string, number>
  } | null
  setScenarioEnabled: (enabled: boolean) => void
  setFutureValue: (
    scenario: ScenarioKey,
    year: number,
    field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumCosts' | 'miscEmploymentCosts' | 'medicalDirectorHours' | 'prcsMedicalDirectorHours' | 'consultingServicesAgreement' | 'therapyLacey' | 'therapyCentralia' | 'therapyAberdeen',
    value: number
  ) => void
  upsertPhysician: (scenario: ScenarioKey, year: number, physician: Physician) => void
  removePhysician: (scenario: ScenarioKey, year: number, physicianId: string) => void
  reorderPhysicians: (scenario: ScenarioKey, year: number, fromIndex: number, toIndex: number) => void
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
  saveScenarioBToDatabase: (
    name: string,
    description: string,
    isPublic: boolean
  ) => Promise<SavedScenario>
}