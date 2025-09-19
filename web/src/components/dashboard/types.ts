// Types for Dashboard components
export type YearRow = {
  year: number
  therapyIncome: number // For 2024+, this represents only therapy income (not including medical director income)
  nonEmploymentCosts: number
  employeePayroll?: number
}

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
}

export type FutureYear = {
  year: number
  therapyIncome: number // Therapy income only (not including medical director income)
  nonEmploymentCosts: number
  nonMdEmploymentCosts: number
  locumCosts: number
  miscEmploymentCosts: number
  medicalDirectorHours?: number
  prcsMedicalDirectorHours?: number
  prcsDirectorPhysicianId?: string
  physicians: Physician[]
}

export type Projection = {
  incomeGrowthPct: number // Total income growth percentage
  medicalDirectorHours: number // Medical Director Hours annual amount (0-250K)
  prcsMedicalDirectorHours: number // PRCS Medical Director Hours annual amount (0-90K)
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

export type Store = {
  historic: YearRow[]
  scenarioA: ScenarioState
  scenarioB?: ScenarioState
  scenarioBEnabled: boolean
  setScenarioEnabled: (enabled: boolean) => void
  setFutureValue: (
    scenario: ScenarioKey,
    year: number,
    field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumCosts' | 'miscEmploymentCosts' | 'medicalDirectorHours' | 'prcsMedicalDirectorHours',
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
  resetToDefaults: () => void
  resetPhysicians: (scenario: ScenarioKey, year: number) => void
  resetAllPhysicians: (scenario: ScenarioKey) => void
  resetProjectionSettings: (scenario: ScenarioKey) => void
  resetYearByYearValues: (scenario: ScenarioKey) => void
  resetViewSettings: (scenario: ScenarioKey) => void
  setPrcsDirector: (scenario: ScenarioKey, year: number, physicianId?: string) => void
}