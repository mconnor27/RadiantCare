import type { Physician, PhysicianType, YearRow, FutureYear } from './types'
import { getPartnerPortionOfYear, computeDefaultNonMdEmploymentCosts } from './calculations'
import { calendarDateToPortion } from './utils'

// Constants
const HISTORIC_DATA: YearRow[] = [
  // 2016-2023: therapyIncome represents total gross income (from yearly data grid)
  { year: 2016, therapyIncome: 2325242, nonEmploymentCosts: 167375.03, employeePayroll: 188151.97 },
  { year: 2017, therapyIncome: 2373335, nonEmploymentCosts: 170366.16, employeePayroll: 180060.96 },
  { year: 2018, therapyIncome: 2386310, nonEmploymentCosts: 162454.23, employeePayroll: 357360.09 },
  { year: 2019, therapyIncome: 2503463, nonEmploymentCosts: 170088.91, employeePayroll: 533175.95 },
  { year: 2020, therapyIncome: 2535945, nonEmploymentCosts: 171824.41, employeePayroll: 573277.22 },
  { year: 2021, therapyIncome: 2687332, nonEmploymentCosts: 176887.39, employeePayroll: 655524.05 },
  { year: 2022, therapyIncome: 2609294, nonEmploymentCosts: 269191.26, employeePayroll: 503812.98 },
  { year: 2023, therapyIncome: 2963169, nonEmploymentCosts: 201243.57, employeePayroll: 790092.00 },
  // 2024+: therapyIncome represents total gross income (from yearly data grid)
  { year: 2024, therapyIncome: 2934700, nonEmploymentCosts: 260925, employeePayroll: 809747 },
  // 2025 actuals per provided figures (rounded to whole dollars to match grid display)
  { year: 2025, therapyIncome: 3164007, nonEmploymentCosts: 229714, employeePayroll: 752156 },
]

// Default employment costs
export const DEFAULT_MISC_EMPLOYMENT_COSTS = 29115.51

// Default consulting services agreement values
export const DEFAULT_CONSULTING_SERVICES_2024 = 15693.40
export const DEFAULT_CONSULTING_SERVICES_2025 = 16200
export const DEFAULT_CONSULTING_SERVICES_PROJECTION = 17030

// Actual consulting services agreement values (for baseline years)
export const ACTUAL_2024_CONSULTING_SERVICES = 15693.40
export const ACTUAL_2025_CONSULTING_SERVICES = 16200.00

// Benefits constants (moved from calculations.ts)
export const MONTHLY_BENEFITS_MED = 722.81
export const MONTHLY_BENEFITS_DENTAL = 57.12
export const MONTHLY_BENEFITS_VISION = 6.44
export const ANNUAL_BENEFITS_FULLTIME = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
// Removed NET_PARTNER_POOL_2025 - now calculating dynamically everywhere

// Social Security Wage Bases by year (moved from calculations.ts)
export const SOCIAL_SECURITY_WAGE_BASES = {
  2025: 176100,
  2026: 183600,
  2027: 190800,
  2028: 198900,
  2029: 207000,
  2030: 215400,
} as const

// Tax rate constants (moved from calculations.ts)
export const TAX_RATES = {
  federalUnemploymentRate: 0.006, // FUTA: 0.6%
  federalUnemploymentWageBase: 7000, // FUTA: on first $7,000
  socialSecurityRate: 0.062, // FICA: 6.2%
  medicareRate: 0.0145, // Medicare: 1.45% on all wages
  waUnemploymentRate: 0.009, // WA SUTA: 0.9%
  waUnemploymentWageBase: 72800, // WA SUTA: on first $72,800
  waFamilyLeaveRate: 0.00658, // WA FLI: 0.658% on first SS wage base
  waStateDisabilityRate: 0.00255, // WA SDI: 0.255% on all wages
  washingtonRate: 0.0003, // Washington Rate: 0.030% on all wages
} as const

// ============================================================================
// REFERENCE VALUES (for database configuration only)
// These constants are NOT used as hard-coded defaults in the grid application.
// They should be set in the "Default" scenario in Supabase when configuring
// baseline values for your organization.
// ============================================================================

// Default financial values for fallbacks
// Note: 2025 values are loaded dynamically from actual/cached data, not hardcoded
export const DEFAULT_LOCUM_COSTS_2025 = 54600 // Reference value for Default scenario
export const DEFAULT_LOCUM_COSTS_2026 = 60000

// 2024 actual values for data mode
export const ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS = 157986.94
export const ACTUAL_2024_LOCUM_COSTS = 113400
export const ACTUAL_2024_MISC_EMPLOYMENT_COSTS = 48446
export const ACTUAL_2024_MEDICAL_DIRECTOR_HOURS = 102870
export const ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS = 25805
export const ACTUAL_2024_PARTNER_POOL = 2008467

// 2025 actual/projected values (rounded to whole dollars to match grid display)
// These are REFERENCE values from QBO data - use when creating Default scenario
export const ACTUAL_2025_MEDICAL_DIRECTOR_HOURS = 119374 // From QBO data
export const ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS = 32321 // From QBO data

// Projection defaults for medical director hours (contract maximums)
// Use these when configuring the Default scenario in Supabase
export const DEFAULT_MD_SHARED_PROJECTION = 97200 // Contract maximum
export const DEFAULT_MD_PRCS_PROJECTION = 50000 // Contract maximum

// ============================================================================
// Note: To set application defaults, create a "Default" scenario in Supabase
// with these values in the year_2025_data field. See:
// supabase-insert-default-ytd-scenario-with-data.sql
// ============================================================================

// Partner Compensation Configuration - can be modified for future years
export const PARTNER_COMPENSATION_CONFIG = {
  Connor: '3200 Dr. Connor',
  Allen: '3700 Dr. Allen', 
  Suszko: '3900 Dr Suszko'
}

// Contract terms for tooltips and calculations
export const SHARED_MD_RATE = 270 // $/hour
export const SHARED_MD_ANNUAL_MAX = 97200 // Annual maximum
export const PRCS_MD_RATE = 250 // $/hour
export const PRCS_MD_ANNUAL_MAX = 90000 // Annual maximum

// Tooltip messages using contract terms
export const SHARED_MD_TOOLTIP = `Shared contract terms: $${SHARED_MD_RATE}/hr up to $${SHARED_MD_ANNUAL_MAX.toLocaleString()} maximum annual. Distributed evenly to partners.`
export const PRCS_MD_TOOLTIP = `PRCS contract terms: $${PRCS_MD_RATE}/hr up to $${PRCS_MD_ANNUAL_MAX.toLocaleString()} maximum annual. Applies if a PRCS Medical Director is specified in the Physicians section.`
export const PRCS_MD_TOOLTIP_SHORT = `PRCS contract terms: $${PRCS_MD_RATE}/hr up to $${PRCS_MD_ANNUAL_MAX.toLocaleString()} maximum annual.`

// Projection Settings Tooltips
export const THERAPY_INCOME_GROWTH_TOOLTIP = "Includes: Lacey, Centralia, Aberdeen, Interest"
export const NON_EMPLOYMENT_COSTS_GROWTH_TOOLTIP = `Includes:
Insurance Cost
State/Local Taxes
Communications Cost
Licensure Costs
Promotional Costs
Billing Costs
Office Overhead
Capital Expense`
export const STAFF_W2_TOOLTIP = `Includes: Salary, Payroll Tax, and Benefits for Practice Manager, Billing

Baseline 2025:
RG: Full-time: $31.25/hr, Medical/Dental/Vision
AL: Part-time: $27/hr, 32 hours per week
MW: Part-time: $23/hr, 20 hours per week`
export const BENEFITS_TOOLTIP = `2025 Baseline:
Medical: $722.81 / month
Dental: $57.12 / month
Vision: $6.44 / month

Applies to Physicians only; all costs included in Staff sliders`
export const MISC_EMPLOYMENT_COSTS_TOOLTIP = "Includes: Gifts, Profit Sharing, Relocation, Recruiting"
export const CONSULTING_SERVICES_TOOLTIP = `$26.20 per hour for work actually performed subject to a limit of $17,030 per year
(25 hours per two-week pay period).`

// UI defaults for sliders and inputs
export const UI_DEFAULTS = {
  // Therapy Income slider
  therapyIncomeMin: 2000000,
  therapyIncomeMax: 4000000,
  therapyIncomeStep: 1000,
  therapyIncomeFallback: 3000000,

  // Medical Director Hours sliders
  medicalDirectorHoursMax: 120000,
  medicalDirectorHoursStep: 1000,
  medicalDirectorHoursFallback: 80000,

  // Non-Employment Costs slider
  nonEmploymentCostsMin: 100000,
  nonEmploymentCostsMax: 500000,
  nonEmploymentCostsStep: 1000,
  nonEmploymentCostsFallback: 200000,

  // Non-MD Employment Costs slider
  nonMdEmploymentCostsMin: 50000,
  nonMdEmploymentCostsMax: 300000,
  nonMdEmploymentCostsStep: 1000,
  nonMdEmploymentCostsFallback: 150000,

  // Misc Employment Costs slider
  miscEmploymentCostsMax: 100000,
  miscEmploymentCostsStep: 1000,
  miscEmploymentCostsFallback: 25000,

  // Thresholds
  changeThreshold: 1000, // $1000 threshold for detecting changes
  floatingPointTolerance: 0.001,
}

// Projection defaults
export const PROJECTION_DEFAULTS = {
  A: {
    incomeGrowthPct: 3.7,
    nonEmploymentCostsPct: 5.7,
    nonMdEmploymentCostsPct: 2.4,
    miscEmploymentCostsPct: 3.2,
    benefitCostsGrowthPct: 7.2,
    medicalDirectorHours: DEFAULT_MD_SHARED_PROJECTION,
    prcsMedicalDirectorHours: DEFAULT_MD_PRCS_PROJECTION,
    consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_PROJECTION,
    locumsCosts: 120000,
  },
  B: {
    incomeGrowthPct: 0,
    nonEmploymentCostsPct: 5.7,
    nonMdEmploymentCostsPct: 2.4,
    miscEmploymentCostsPct: 3.2,
    benefitCostsGrowthPct: 7.2,
    medicalDirectorHours: DEFAULT_MD_SHARED_PROJECTION,
    prcsMedicalDirectorHours: DEFAULT_MD_PRCS_PROJECTION,
    consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_PROJECTION,
    locumsCosts: 0, // Scenario B default: $0 locums (except 2026 handled elsewhere)
  }
}

// Slider configuration for ProjectionSettingsControls
export const SLIDER_CONFIGS = {
  medicalDirectorHours: { min: 0, max: 120000, step: 1000 },
  prcsMedicalDirectorHours: { min: 0, max: 120000, step: 1000 },
  consultingServicesAgreement: { min: 0, max: 20000, step: 100 },
  locumsCosts: { min: 0, max: 500000, step: 1000 }
}

export function defaultPhysiciansGeneric(year: number): Physician[] {
  return [
    { id: `${year}-P1`, name: 'Physician 1', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P2`, name: 'Physician 2', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P3`, name: 'Physician 3', type: 'partner', weeksVacation: 4 },
    { id: `${year}-E1`, name: 'Physician 4', type: 'employee', salary: 500000 },
  ]
}

// Helper function to calculate even medical director hour percentages among partners
export function calculateMedicalDirectorHourPercentages(physicians: Physician[]): Physician[] {
  // Calculate total partner work time (sum of partner portions, ignoring vacation as requested)
  const totalPartnerPortions = physicians.reduce((sum, physician) => {
    return sum + getPartnerPortionOfYear(physician)
  }, 0)
  
  // If no partners, return physicians as-is
  if (totalPartnerPortions === 0) {
    return physicians.map(p => ({
      ...p,
      medicalDirectorHoursPercentage: 0,
      hasMedicalDirectorHours: false
    }))
  }
  
  // Distribute percentages evenly among partners based on their portion of year
  return physicians.map(physician => {
    const partnerPortion = getPartnerPortionOfYear(physician)
    const percentage = partnerPortion > 0 ? (partnerPortion / totalPartnerPortions) * 100 : 0
    
    return {
      ...physician,
      medicalDirectorHoursPercentage: percentage,
      hasMedicalDirectorHours: percentage > 0
    }
  })
}

export function scenario2024Defaults(): Physician[] {
  const physicians: Physician[] = [
    { id: `2024-JS`, name: 'Suszko', type: 'partner' as PhysicianType, weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
    { id: `2024-GA`, name: 'Allen', type: 'partner' as PhysicianType, weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
    { id: `2024-HW`, name: 'Werner', type: 'partner' as PhysicianType, weeksVacation: 19, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
    { id: `2024-MC`, name: 'Connor', type: 'employee' as PhysicianType, salary: 341323.02, employeeWeeksVacation: 5, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-CD`, name: 'Deig', type: 'employeeToTerminate' as PhysicianType, terminatePortionOfYear: 30/365, salary: 318640, employeeWeeksVacation: 6, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Jan 31 termination
    { id: `2024-BT`, name: 'Tinnel', type: 'newEmployee' as PhysicianType, startPortionOfYear: 279/365, salary: 407196, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Oct 7 start
  ]
  return calculateMedicalDirectorHourPercentages(physicians)
}

export function scenarioADefaultsByYear(year: number): Physician[] {
  let physicians: Physician[] = []
  
  if (year === 2025) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, employeeWeeksVacation: 5, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33, additionalDaysWorked: 0 },
      { id: `${year}-GA`, name: 'Allen', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33, additionalDaysWorked: 1000 },
      { id: `${year}-HW`, name: 'Werner', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, trailingSharedMdAmount: 8302.50, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-GA`, name: 'Allen', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, employeeWeeksVacation: 4, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-LK`, name: 'Kahn', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, employeeWeeksVacation: 4, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Becomes partner exactly 2 years after hire
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Second year as partner
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'Kahn', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Increases yearly, max 12
    ]
  }
  
  // For 2025, medical director percentages are manually set, so return directly
  if (year === 2025) {
    return physicians
  }
  
  return calculateMedicalDirectorHourPercentages(physicians)
}

export function scenarioBDefaultsByYear(year: number): Physician[] {
  let physicians: Physician[] = []

  if (year === 2025) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, employeeWeeksVacation: 5, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33, additionalDaysWorked: 0 },
      { id: `${year}-GA`, name: 'Allen', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33, additionalDaysWorked: 1000 },
      { id: `${year}-HW`, name: 'Werner', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, trailingSharedMdAmount: 8302.50, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-GA`, name: 'Allen', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, employeeWeeksVacation: 4, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-LK`, name: 'Kahn', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-P5`, name: 'Potential Hire', type: 'newEmployee', startPortionOfYear: 0, salary: 500000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, employeeWeeksVacation: 4, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Becomes partner exactly 2 years after hire
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employee', salary: 500000, receivesBenefits: true, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'Kahn', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Second year as partner
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(1, 1, year), salary: 500000, employeeWeeksVacation: 4, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'Connor', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-JS`, name: 'Suszko', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 },
      { id: `${year}-BT`, name: 'Tinnel', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'Kahn', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Increases yearly, max 12
      { id: `${year}-P5`, name: 'Potential Hire', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2029)), receivesBonuses: false, bonusAmount: 0, additionalDaysWorked: 0 }, // Increases yearly, max 12
    ]
  }
  
  // For 2025, medical director percentages are manually set, so return directly
  if (year === 2025) {
    return physicians
  }
  
  return calculateMedicalDirectorHourPercentages(physicians)
}

// Create the base future years array (function to avoid circular dependency)
export function getFutureYearsBase(): Omit<FutureYear, 'physicians'>[] {
  return Array.from({ length: 5 }).map((_, idx) => {
    const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2025)
    const year = startYear + idx
    return {
      year,
      therapyIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].therapyIncome,
      nonEmploymentCosts:
        HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
      nonMdEmploymentCosts: getDefaultNonMdEmploymentCostsForYear(year),
      locumCosts: PROJECTION_DEFAULTS.A.locumsCosts,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
    }
  })
}

// Local function to avoid circular dependency
function getDefaultNonMdEmploymentCostsForYear(_year: number = 2025): number {
  // Calculate based on standard staff structure
  // Employee 1: $31.25/hr, 40 hrs/week, full-time + benefits
  const emp1Wages = 31.25 * 40 * 52
  const emp1Taxes = emp1Wages * 0.0765 // Simplified tax calculation
  const emp1Total = emp1Wages + emp1Taxes + 10309.16 // Simplified benefits

  // Employee 2: $27/hr, 32 hrs/week, part-time (no benefits)
  const emp2Wages = 27 * 32 * 52
  const emp2Taxes = emp2Wages * 0.0765
  const emp2Total = emp2Wages + emp2Taxes

  // Employee 3: $23/hr, 20 hrs/week, part-time
  const emp3Wages = 23 * 20 * 52
  const emp3Taxes = emp3Wages * 0.0765
  const emp3Total = emp3Wages + emp3Taxes

  return Math.round(emp1Total + emp2Total + emp3Total)
}

// Initial future years for scenario A (function to avoid circular dependency)
export function getInitialFutureYearsA(): FutureYear[] {
  return getFutureYearsBase().map((b) => {
    const physicians = scenarioADefaultsByYear(b.year)
  const suszko = physicians.find((p) => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && suszko ? suszko.id : undefined,
  }
  })
}

// Future years base configuration
export const FUTURE_YEARS_BASE: Omit<FutureYear, 'physicians'>[] = Array.from({ length: 5 }).map((_, idx) => {
  const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2025)
  const year = startYear + idx
  return {
    year,
    therapyIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].therapyIncome,
    nonEmploymentCosts:
      HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
    nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
    locumCosts: PROJECTION_DEFAULTS.A.locumsCosts,
    miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
  }
})

export const INITIAL_FUTURE_YEARS_A: FutureYear[] = FUTURE_YEARS_BASE.map((b) => {
  const physicians = scenarioADefaultsByYear(b.year)
  const suszko = physicians.find((p) => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    consultingServicesAgreement: b.year === 2025 ? DEFAULT_CONSULTING_SERVICES_2025 : DEFAULT_CONSULTING_SERVICES_PROJECTION,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && suszko ? suszko.id : undefined,
  }
})

export const INITIAL_FUTURE_YEARS_B: FutureYear[] = FUTURE_YEARS_BASE.map((b) => {
  const physicians = scenarioBDefaultsByYear(b.year)
  const suszko = physicians.find((p) => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    consultingServicesAgreement: b.year === 2025 ? DEFAULT_CONSULTING_SERVICES_2025 : DEFAULT_CONSULTING_SERVICES_PROJECTION,
    // Scenario B default: $0 locums
    locumCosts: 0,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && suszko ? suszko.id : undefined,
  }
})

// Export historic data for use in other modules
export { HISTORIC_DATA }
