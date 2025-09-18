import { Physician, PhysicianType, YearRow, FutureYear } from './types'
import { getPartnerPortionOfYear, computeDefaultNonMdEmploymentCosts } from './calculations'
import { calendarDateToPortion } from './utils'

// Constants
const HISTORIC_DATA: YearRow[] = [
  // 2016-2023: therapyIncome represents total income (no separate medical director data available)
  { year: 2016, therapyIncome: 2325241.84, nonEmploymentCosts: 167375.03, employeePayroll: 188151.97 },
  { year: 2017, therapyIncome: 2376068.79, nonEmploymentCosts: 170366.16, employeePayroll: 180060.96 },
  { year: 2018, therapyIncome: 2386310.08, nonEmploymentCosts: 162454.23, employeePayroll: 357360.09 },
  { year: 2019, therapyIncome: 2503463.49, nonEmploymentCosts: 170088.91, employeePayroll: 533175.95 },
  { year: 2020, therapyIncome: 2535944.52, nonEmploymentCosts: 171824.41, employeePayroll: 573277.22 },
  { year: 2021, therapyIncome: 2686843.84, nonEmploymentCosts: 176887.39, employeePayroll: 655524.05 },
  { year: 2022, therapyIncome: 2582916.38, nonEmploymentCosts: 269191.26, employeePayroll: 503812.98 },
  { year: 2023, therapyIncome: 2963164.73, nonEmploymentCosts: 201243.57, employeePayroll: 790092.00 },
  // 2024+: therapyIncome is now truly therapy income only (medical director income is separate)
  { year: 2024, therapyIncome: 2934770.14, nonEmploymentCosts: 261114.98, employeePayroll: 785924.54 },
  // 2025 actuals per provided figures
  { year: 2025, therapyIncome: 3164006.93, nonEmploymentCosts: 229713.57, employeePayroll:  752155.73  },
]

const DEFAULT_MISC_EMPLOYMENT_COSTS = 29115.51

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
    { id: `2024-JS`, name: 'JS', type: 'partner' as PhysicianType, weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-GA`, name: 'GA', type: 'partner' as PhysicianType, weeksVacation: 16, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-HW`, name: 'HW', type: 'partner' as PhysicianType, weeksVacation: 19, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-MC`, name: 'MC', type: 'employee' as PhysicianType, salary: 341323.02, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-CD`, name: 'CD', type: 'employeeToTerminate' as PhysicianType, terminatePortionOfYear: 30/365, salary: 318640, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Jan 31 termination
    { id: `2024-BT`, name: 'BT', type: 'newEmployee' as PhysicianType, startPortionOfYear: 279/365, salary: 407196, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Oct 7 start
  ]
  return calculateMedicalDirectorHourPercentages(physicians)
}

export function scenarioADefaultsByYear(year: number): Physician[] {
  let physicians: Physician[] = []
  
  if (year === 2025) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 6.96, trailingSharedMdAmount: 8302.50 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
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
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 6.96, trailingSharedMdAmount: 8302.50 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-P5`, name: 'Potential Hire', type: 'newEmployee', startPortionOfYear: 0, salary: 500000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employee', salary: 500000, receivesBenefits: true, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(1, 1, year), salary: 500000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-P5`, name: 'Potential Hire', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2029)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
    ]
  }
  
  // For 2025, medical director percentages are manually set, so return directly
  if (year === 2025) {
    return physicians
  }
  
  return calculateMedicalDirectorHourPercentages(physicians)
}

// Create the base future years array
export const FUTURE_YEARS_BASE: Omit<FutureYear, 'physicians'>[] = Array.from({ length: 5 }).map((_, idx) => {
  const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2025)
  const year = startYear + idx
  return {
    year,
    therapyIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].therapyIncome,
    nonEmploymentCosts:
      HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
    nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
    locumCosts: year === 2026 ? 60000 : 120000,
    miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
  }
})

// Initial future years for scenario A
export const INITIAL_FUTURE_YEARS_A: FutureYear[] = FUTURE_YEARS_BASE.map((b) => {
  const physicians = scenarioADefaultsByYear(b.year)
  const js = physicians.find((p) => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && js ? js.id : undefined,
  }
})

// Export historic data for use in other modules
export { HISTORIC_DATA }
