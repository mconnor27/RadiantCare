import { useMemo, useEffect, useState, Fragment } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import Plot from 'react-plotly.js'
import { DragDropPhysicians } from './DragDropPhysicians'

export type YearRow = {
  year: number
  totalIncome: number
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
  // Buyout cost for retiring partners
  buyoutCost?: number
}

// Responsive helper
function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

// Helper function for creating mobile-friendly tooltips
function createTooltip(id: string, content: string, e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  
  const tooltip = document.createElement('div')
  tooltip.id = id
  const isMobileTooltip = window.innerWidth <= 768
  
  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
          tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
  }
  
  tooltip.textContent = content
  document.body.appendChild(tooltip)
  
  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }
  
  // Auto-hide tooltip on mobile after 3 seconds
  if (isMobileTooltip) {
    setTimeout(() => {
      const t = document.getElementById(id)
      if (t) t.remove()
    }, 3000)
  }
}

function removeTooltip(id: string) {
  const tooltip = document.getElementById(id)
  if (tooltip) tooltip.remove()
}

// Helper function for creating interactive bonus slider tooltip
function createBonusTooltip(
  physicianId: string, 
  currentAmount: number, 
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  isTerminatedEmployee: boolean = false
) {
  const tooltipId = `bonus-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()
  
  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  const isMobileTooltip = window.innerWidth <= 768
  
  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  }
  
  // Set ranges and labels based on employee type
  const minValue = isTerminatedEmployee ? -30000 : 0
  const maxValue = 30000
  const title = isTerminatedEmployee ? 'Bonus Repayment/Return' : 'Relocation/Signing Bonus'
  const displayAmount = isTerminatedEmployee && currentAmount < 0 
    ? `-$${Math.abs(currentAmount || 0).toLocaleString()}`
    : `$${(currentAmount || 0).toLocaleString()}`
  
  // Create tooltip content
  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="500" value="${currentAmount}" 
        style="width: 180px; margin-bottom: 4px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="text-align: center; font-weight: 600; user-select: none;" id="${tooltipId}-amount">${displayAmount}</div>
    </div>
  `
  
  document.body.appendChild(tooltip)
  
  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }
  
  // Add event listener for real-time updates
  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const amountDisplay = document.getElementById(`${tooltipId}-amount`)
  
  if (slider && amountDisplay) {
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newAmount = Number(target.value)
      const displayText = isTerminatedEmployee && newAmount < 0 
        ? `-$${Math.abs(newAmount || 0).toLocaleString()}`
        : `$${(newAmount || 0).toLocaleString()}`
      amountDisplay.textContent = displayText
      onUpdate(physicianId, newAmount)
    })
  }
  
  // Add hover events to tooltip to keep it visible when interacting
  tooltip.addEventListener('mouseenter', () => {
    // Cancel any pending hide timeouts when entering tooltip
    clearTimeout((tooltip as any).hideTimeout)
  })
  
  tooltip.addEventListener('mouseleave', () => {
    // Hide tooltip when leaving tooltip area
    removeTooltip(tooltipId)
  })
  
  // Click outside to close
  const clickOutsideHandler = (event: MouseEvent) => {
    if (!tooltip.contains(event.target as Node) && 
        !document.querySelector(`[data-bonus-id="${physicianId}"]`)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  
  // Add click outside handler after a brief delay to avoid immediate closure
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)
  
  // Auto-hide tooltip on mobile after 8 seconds (longer since it's interactive)
  if (isMobileTooltip) {
    setTimeout(() => removeTooltip(tooltipId), 8000)
  }
}

// Extend FutureYear with nonMdEmploymentCosts
export type FutureYear = {
  year: number
  totalIncome: number
  nonEmploymentCosts: number
  nonMdEmploymentCosts: number
  locumCosts: number
  miscEmploymentCosts: number
  physicians: Physician[]
}

type Projection = {
  incomeGrowthPct: number // Total income growth percentage
  nonEmploymentCostsPct: number // Non-Employment Costs growth percentage
  nonMdEmploymentCostsPct: number // Staff Employment Costs growth percentage
  locumsCosts: number // Locums costs in dollars (global override)
  miscEmploymentCostsPct: number // Misc Employment Costs growth percentage
  benefitCostsGrowthPct: number // Benefit Costs growth percentage
}

type ScenarioState = {
  future: FutureYear[]
  projection: Projection
  selectedYear: number
  dataMode: 'Custom' | '2024 Data' | '2025 Data'
}

type ScenarioKey = 'A' | 'B'

type Store = {
  historic: YearRow[]
  scenarioA: ScenarioState
  scenarioB?: ScenarioState
  scenarioBEnabled: boolean
  setScenarioEnabled: (enabled: boolean) => void
  setFutureValue: (
    scenario: ScenarioKey,
    year: number,
    field: 'totalIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumCosts' | 'miscEmploymentCosts',
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
}

const HISTORIC_DATA: YearRow[] = [
  { year: 2016, totalIncome: 2325241.84, nonEmploymentCosts: 167375.03, employeePayroll: 188151.97 },
  { year: 2017, totalIncome: 2376068.79, nonEmploymentCosts: 170366.16, employeePayroll: 180060.96 },
  { year: 2018, totalIncome: 2386310.08, nonEmploymentCosts: 162454.23, employeePayroll: 357360.09 },
  { year: 2019, totalIncome: 2503463.49, nonEmploymentCosts: 170088.91, employeePayroll: 533175.95 },
  { year: 2020, totalIncome: 2535944.52, nonEmploymentCosts: 171824.41, employeePayroll: 573277.22 },
  { year: 2021, totalIncome: 2686843.84, nonEmploymentCosts: 176887.39, employeePayroll: 655524.05 },
  { year: 2022, totalIncome: 2582916.38, nonEmploymentCosts: 269191.26, employeePayroll: 503812.98 },
  { year: 2023, totalIncome: 2963164.73, nonEmploymentCosts: 201243.57, employeePayroll: 790092.00 },
  { year: 2024, totalIncome: 3079138.54, nonEmploymentCosts: 261114.98, employeePayroll: 785924.54 },
  // 2025 actuals per provided figures
  { year: 2025, totalIncome: 3344068.19, nonEmploymentCosts: 229713.57, employeePayroll:  752155.73  },
]

/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore: kept for future use
function defaultPhysiciansGeneric(year: number): Physician[] {
  return [
    { id: `${year}-P1`, name: 'Physician 1', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P2`, name: 'Physician 2', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P3`, name: 'Physician 3', type: 'partner', weeksVacation: 4 },
    { id: `${year}-E1`, name: 'Physician 4', type: 'employee', salary: 500000 },
  ]
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function scenario2024Defaults(): Physician[] {
  return [
    { id: `2024-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-HW`, name: 'HW', type: 'partner', weeksVacation: 19, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-MC`, name: 'MC', type: 'employee', salary: 341323.02, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-CD`, name: 'CD', type: 'employeeToTerminate', terminatePortionOfYear: 30/365, salary: 318640, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Jan 31 termination
    { id: `2024-BT`, name: 'BT', type: 'newEmployee', startPortionOfYear: 279/365, salary: 407196, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Oct 7 start
  ]
}

function scenarioADefaultsByYear(year: number): Physician[] {
  if (year === 2025) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  if (year === 2026) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: 151/365, salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  if (year === 2027) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  if (year === 2028) {
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: 150/365, salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
    ]
  }
  if (year === 2029) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
    ]
  }
  // 2030+
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
    { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
  ]
}

// Helper: Get Social Security wage base limit for a given year
function getSocialSecurityWageBase(year: number): number {
  const wageBases: Record<number, number> = {
    2025: 176100,
    2026: 183600,
    2027: 190800,
    2028: 198900,
    2029: 207000,
    2030: 215400,
  }
  return wageBases[year] || wageBases[2030] // Use 2030 as fallback for later years
}

// Helper: employer payroll taxes for W2 annual wages (WA State medical practice <50 employees)
function calculateEmployerPayrollTaxes(annualWages: number, year: number = 2025): number {
  const ssWageBase = getSocialSecurityWageBase(year)
  
  // Federal taxes
  const federalUnemploymentTax = Math.min(annualWages, 7000) * 0.006 // FUTA: 0.6% on first $7,000
  const socialSecurityTax = Math.min(annualWages, ssWageBase) * 0.062 // FICA: 6.2%
  const medicareTax = annualWages * 0.0145 // Medicare: 1.45% on all wages
  // Note: Additional Medicare tax (0.9% over $200K) is employee-paid, not employer-paid
  
  // Washington State taxes
  const waUnemploymentTax = Math.min(annualWages, 72800) * 0.009 // WA SUTA: 0.9% on first $72,800
  const waFamilyLeaveTax = Math.min(annualWages, ssWageBase) * 0.00658 // WA FLI: 0.658% on first SS wage base
  const waStateDisabilityTax = annualWages * 0.00255 // WA SDI: 0.255% on all wages
  const washingtonRateTax = annualWages * 0.0003 // Washington Rate: 0.030% on all wages
  
  return federalUnemploymentTax + socialSecurityTax + medicareTax + 
         waUnemploymentTax + waFamilyLeaveTax + waStateDisabilityTax + washingtonRateTax
}

const MONTHLY_BENEFITS_MED = 796.37
const MONTHLY_BENEFITS_DENTAL = 57.12
const MONTHLY_BENEFITS_VISION = 6.44
const ANNUAL_BENEFITS_FULLTIME = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
const NET_PARTNER_POOL_2025 =  2362198.89 
const DEFAULT_MISC_EMPLOYMENT_COSTS = 29115.51

// Helper: Calculate benefit costs for a given year with growth applied
function getBenefitCostsForYear(year: number, benefitGrowthPct: number): number {
  const baseYear = 2025
  const baseCost = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
  if (year <= baseYear) {
    return baseCost
  }
  const yearsOfGrowth = year - baseYear
  const growthMultiplier = Math.pow(1 + benefitGrowthPct / 100, yearsOfGrowth)
  return baseCost * growthMultiplier
}

// Default Staff employment costs (wages + employer taxes + benefits for FT 1)
function computeDefaultNonMdEmploymentCosts(year: number = 2025): number {
  // Return the correct 2025 baseline value
  if (year === 2025) {
    return 164273.25
  }
  
  // For other years, use the original calculation
  // Employee 1: $31.25/hr, 40 hrs/week, full-time + benefits
  const emp1Wages = 31.25 * 40 * 52
  const emp1Taxes = calculateEmployerPayrollTaxes(emp1Wages, year)
  const emp1Total = emp1Wages + emp1Taxes + ANNUAL_BENEFITS_FULLTIME
  // Employee 2: $27/hr, 32 hrs/week, part-time (no benefits specified)
  const emp2Wages = 27 * 32 * 52
  const emp2Taxes = calculateEmployerPayrollTaxes(emp2Wages, year)
  const emp2Total = emp2Wages + emp2Taxes
  // Employee 3: $23/hr, 20 hrs/week, part-time
  const emp3Wages = 23 * 20 * 52
  const emp3Taxes = calculateEmployerPayrollTaxes(emp3Wages, year)
  const emp3Total = emp3Wages + emp3Taxes
  return Math.round(emp1Total + emp2Total + emp3Total)
}


const FUTURE_YEARS_BASE: Omit<FutureYear, 'physicians'>[] = Array.from({ length: 5 }).map((_, idx) => {
  const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2025)
  const year = startYear + idx
  return {
    year,
    totalIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].totalIncome,
    nonEmploymentCosts:
      HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
    nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
    locumCosts: year === 2026 ? 60000 : 120000,
    miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
  }
})

const INITIAL_FUTURE_YEARS_A: FutureYear[] = FUTURE_YEARS_BASE.map((b) => ({
  ...b,
  physicians: scenarioADefaultsByYear(b.year),
}))

function scenarioBDefaultsByYear(year: number): Physician[] {
  if (year === 2025) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  if (year === 2026) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: 151/365, salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  if (year === 2027) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-P5`, name: 'Potential Hire', type: 'newEmployee', startPortionOfYear: 0, salary: 500000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  if (year === 2028) {
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: 150/365, salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employee', salary: 500000, receivesBenefits: true, receivesBonuses: false, bonusAmount: 0 }, // Second year as employee
    ]
  }
  if (year === 2029) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 500000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Transition year - becomes partner
    ]
  }
  // 2030+
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
    { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
    { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
    { id: `${year}-P5`, name: 'Potential Hire', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2029)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly from 2030, max 12
  ]
}

const INITIAL_FUTURE_YEARS_B: FutureYear[] = FUTURE_YEARS_BASE.map((b) => ({
  ...b,
  physicians: scenarioBDefaultsByYear(b.year),
}))
export const useDashboardStore = create<Store>()(
  persist(
    immer<Store>((set, get) => {
      void get
      return {
        historic: HISTORIC_DATA,
        scenarioA: {
          future: INITIAL_FUTURE_YEARS_A,
          projection: { 
            incomeGrowthPct: 3.7, 
            nonEmploymentCostsPct: 7.8, 
            nonMdEmploymentCostsPct: 6.0, 
            locumsCosts: 120000, 
            miscEmploymentCostsPct: 6.7,
            benefitCostsGrowthPct: 5.0
          },
          selectedYear: 2025, // Default to Baseline tab
          dataMode: '2025 Data',
        },
        scenarioB: {
          future: INITIAL_FUTURE_YEARS_B,
          projection: { 
            incomeGrowthPct: 3.7, 
            nonEmploymentCostsPct: 7.8, 
            nonMdEmploymentCostsPct: 6.0, 
            locumsCosts: 0, 
            miscEmploymentCostsPct: 6.7,
            benefitCostsGrowthPct: 5.0
          },
          selectedYear: 2025, // Default to Baseline tab
          dataMode: '2025 Data',
        },
        scenarioBEnabled: true,
        setScenarioEnabled: (enabled) => {
          set((state) => {
            state.scenarioBEnabled = enabled
            if (enabled) {
              // Initialize scenario B with its own defaults instead of cloning A
              state.scenarioB = {
                future: INITIAL_FUTURE_YEARS_B.map((f) => ({ ...f, physicians: [...f.physicians] })),
                projection: { 
                  incomeGrowthPct: 3.7, 
                  nonEmploymentCostsPct: 7.8, 
                  nonMdEmploymentCostsPct: 6.0, 
                  locumsCosts: 0, 
                  miscEmploymentCostsPct: 6.7,
                  benefitCostsGrowthPct: 5.0
                },
                selectedYear: state.scenarioA.selectedYear,
                dataMode: '2025 Data',
              }
            } else {
              state.scenarioB = undefined
            }
          })
          // Apply projections to scenario B if it was just enabled
          if (enabled) {
            const store = useDashboardStore.getState()
            if (store.scenarioB) store.applyProjectionFromLastActual('B')
          }
        },
        setFutureValue: (scenario, year, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (fy) {
              ;(fy as any)[field] = value
            }
          }),
        upsertPhysician: (scenario, year, physician) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return

            // Update or add in the chosen year
            const idx = fy.physicians.findIndex((p) => p.id === physician.id)
            const isNewInYear = idx < 0
            const previousInYear = idx >= 0 ? fy.physicians[idx] : undefined
            const oldName = previousInYear?.name
            if (idx >= 0) fy.physicians[idx] = physician
            else fy.physicians.push(physician)

            // If the physician's name changed, propagate the new name across ALL years
            if (oldName && oldName !== physician.name) {
              for (const fut of sc.future) {
                for (let k = 0; k < fut.physicians.length; k++) {
                  if (fut.physicians[k].name === oldName) {
                    fut.physicians[k] = { ...fut.physicians[k], name: physician.name }
                  }
                }
              }
            }

            // Helper to build a reasonable id for a given future year
            const toIdForYear = (targetYear: number, base: Physician) => {
              const nameSlug = (base.name || 'physician')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
              return `${targetYear}-${nameSlug || 'md'}`
            }

            // Propagation rules across subsequent years
            const targetName = physician.name
            const salarySource = typeof physician.salary === 'number' ? physician.salary : undefined
            const weeksSource = typeof physician.weeksVacation === 'number' ? physician.weeksVacation : undefined
            const becomesPartnerNextYears = physician.type === 'employeeToPartner'
            const retiresThisYear = physician.type === 'partnerToRetire'
            const terminatesThisYear = physician.type === 'employeeToTerminate'

            for (const fut of sc.future) {
              if (fut.year <= year) continue

              // If this physician retires this year, remove them from future years
              if (retiresThisYear) {
                fut.physicians = fut.physicians.filter((p) => p.name !== targetName && p.id !== physician.id)
                continue
              }

              // If this physician terminates employment this year, remove them from future years
              if (terminatesThisYear) {
                fut.physicians = fut.physicians.filter((p) => p.name !== targetName && p.id !== physician.id)
                continue
              }

              // Find same MD by name (preferred) or id
              let j = fut.physicians.findIndex((p) => p.name === targetName)
              if (j < 0) j = fut.physicians.findIndex((p) => p.id === physician.id)

              if (j < 0) {
                // If adding in this year (or if not present later), add them for all subsequent years
                if (isNewInYear) {
                  // Determine type for this future year based on rules:
                  // - Mixed (employeeToPartner) in the edited year -> partner thereafter
                  // - Employee in the edited year -> employee for next year, then employeeToPartner transition year, then partner
                  // - New Employee in the edited year -> employee for next year, then employeeToPartner transition year, then partner
                  // - Employee->Terminate should not propagate (they leave employment)
                  // - partnerToRetire should not propagate (handled above with continue)
                  let computedType: PhysicianType = physician.type
                  if (becomesPartnerNextYears) {
                    computedType = 'partner'
                  } else if (physician.type === 'employee' || physician.type === 'newEmployee') {
                    // Calculate transition year based on start date for newEmployee
                    let transitionYear = year + 2; // Default for regular employees
                    
                    if (physician.type === 'newEmployee' && physician.startPortionOfYear) {
                      // For new employees, calculate how long they've been working to determine partner eligibility
                      // If they start mid-year, they need a full year + transition year
                      const startMonth = Math.floor((physician.startPortionOfYear * 365) / 30.44) + 1; // Approximate month
                      if (startMonth > 6) { // If starting after mid-year (July+), need extra year
                        transitionYear = year + 3;
                      }
                    }
                    
                    if (fut.year < transitionYear) {
                      computedType = 'employee'
                    } else if (fut.year === transitionYear) {
                      // Use employeeToPartner for the transition year to handle delayed W2 payments
                      // This ensures all partner transitions properly account for W2 payments
                      computedType = 'employeeToPartner'
                    } else {
                      computedType = 'partner'
                    }
                  } else if (physician.type === 'partnerToRetire') {
                    // This should not happen since we continue above, but just in case
                    continue
                  }

                  const cloned: Physician = {
                    id: toIdForYear(fut.year, physician),
                    name: physician.name,
                    type: computedType,
                    salary:
                      computedType === 'partner'
                        ? undefined
                        : (physician.type === 'employee' || physician.type === 'employeeToPartner' || physician.type === 'newEmployee' || physician.type === 'employeeToTerminate')
                          ? (physician.salary ?? 500000)
                          : undefined,
                    weeksVacation:
                      computedType === 'partner' || computedType === 'employeeToPartner'
                        ? (physician.weeksVacation ?? 8)
                        : undefined,
                    employeePortionOfYear: 
                      computedType === 'partner' 
                        ? undefined 
                        : computedType === 'employeeToPartner' 
                          ? 0 // Always use Partner->Employee type (employeePortionOfYear = 0) in transition year
                              // This ensures delayed W2 payments are calculated even for Jan 1 start dates
                          : physician.employeePortionOfYear,
                  }
                  fut.physicians.push(cloned)
                  continue
                } else {
                  // If not new but missing later, skip unless we explicitly want to re-create
                  // The requested behavior does not require re-creating on edit
                  continue
                }
              }

              const existing = fut.physicians[j]
              const updated: Physician = { ...existing }

              // Mixed one year -> partner thereafter
              if (becomesPartnerNextYears) {
                updated.type = 'partner'
                updated.salary = undefined
                updated.employeePortionOfYear = undefined
              }

              // Salary minimum propagation for employees
              if (salarySource !== undefined) {
                if (updated.type === 'employee' || updated.type === 'employeeToPartner' || updated.type === 'newEmployee' || updated.type === 'employeeToTerminate') {
                  const currentSalary = typeof updated.salary === 'number' ? updated.salary : 0
                  updated.salary = Math.max(currentSalary, salarySource)
                }
              }

              // Weeks off minimum propagation for partners
              if (weeksSource !== undefined) {
                if (updated.type === 'partner' || updated.type === 'employeeToPartner') {
                  const currentWeeks = typeof updated.weeksVacation === 'number' ? updated.weeksVacation : 0
                  updated.weeksVacation = Math.max(currentWeeks, weeksSource)
                }
              }

              fut.physicians[j] = updated
            }
          }),
        removePhysician: (scenario, year, physicianId) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            // Identify by id and, if possible, by name to remove across years
            const thisYear = sc.future.find((f) => f.year === year)
            if (!thisYear) return
            const toRemove = thisYear.physicians.find((p) => p.id === physicianId)
            const nameKey = toRemove?.name

            for (const fut of sc.future) {
              if (fut.year < year) continue
              fut.physicians = fut.physicians.filter((p) => {
                if (p.id === physicianId) return false
                if (nameKey && p.name === nameKey) return false
                return true
              })
            }
          }),
        reorderPhysicians: (scenario, year, fromIndex, toIndex) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return
            
            // Create a copy of the physicians array and reorder it
            const physicians = [...fy.physicians]
            const [movedPhysician] = physicians.splice(fromIndex, 1)
            physicians.splice(toIndex, 0, movedPhysician)
            
            // Update the physicians array
            fy.physicians = physicians
          }),
        setProjectionField: (scenario, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // Apply appropriate limits based on field type
            if (field === 'locumsCosts') {
              // Locums costs are in dollars, so use reasonable range (0 to 1M)
              sc.projection[field] = Math.max(0, Math.min(1000000, value))
            } else {
              // Percentage fields should be limited to reasonable range (-10% to +20%)
              // Also round to 1 decimal place to avoid floating point artifacts (e.g., 5.700001)
              const clamped = Math.max(-10, Math.min(20, value))
              sc.projection[field] = Math.round(clamped * 10) / 10
            }
            
            // Apply the updated projections to all future years immediately within the same state update
            // Use baseline data based on selected dataMode
            const dataMode = sc.dataMode
            const last2024 = state.historic.find((h) => h.year === 2024)
            const last2025 = state.historic.find((h) => h.year === 2025)
            
            // Determine starting values based on data mode
            let baselineData
            if (dataMode === 'Custom') {
              // For Custom mode, use the existing baseline data from year 2025 in future array
              const customBaseline = sc.future.find(f => f.year === 2025)
              if (customBaseline) {
                baselineData = {
                  totalIncome: customBaseline.totalIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  totalIncome: last2025?.totalIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                totalIncome: last2024.totalIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: 24623.49, // 2024 actual misc employment from image
                nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
              }
            } else if (last2025) {
              baselineData = {
                totalIncome: last2025.totalIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                totalIncome: 3344068.19,
                nonEmploymentCosts: 229713.57,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            
            // Starting values from the selected baseline
            let income = baselineData.totalIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let nonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              nonMdEmploymentCosts = nonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)
              
              fy.totalIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = nonMdEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              fy.locumCosts = fy.year === 2026 ? 60000 : sc.projection.locumsCosts
            }
          }),
        applyProjectionFromLastActual: (scenario) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // Use baseline data based on selected dataMode
            const dataMode = sc.dataMode
            const last2024 = state.historic.find((h) => h.year === 2024)
            const last2025 = state.historic.find((h) => h.year === 2025)
            
            // Determine starting values based on data mode
            let baselineData
            if (dataMode === 'Custom') {
              // For Custom mode, use the existing baseline data from year 2025 in future array
              const customBaseline = sc.future.find(f => f.year === 2025)
              if (customBaseline) {
                baselineData = {
                  totalIncome: customBaseline.totalIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  totalIncome: last2025?.totalIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                totalIncome: last2024.totalIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: 24623.49, // 2024 actual misc employment from image
                nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
              }
            } else if (last2025) {
              baselineData = {
                totalIncome: last2025.totalIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                totalIncome: 3344068.19,
                nonEmploymentCosts: 229713.57,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            
            // Starting values from the selected baseline
            let income = baselineData.totalIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let nonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              nonMdEmploymentCosts = nonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)
              
              fy.totalIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = nonMdEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              
              // Set locums costs from the global override (except 2026 which defaults to 60K)
              fy.locumCosts = fy.year === 2026 ? 60000 : sc.projection.locumsCosts
            }
          }),
        setSelectedYear: (scenario, year) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            sc.selectedYear = year
          }),
        setDataMode: (scenario, mode) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // If switching TO Custom mode, capture current baseline data and make it editable
            if (mode === 'Custom' && sc.dataMode !== 'Custom') {
              const last2024 = state.historic.find((h) => h.year === 2024)
              const last2025 = state.historic.find((h) => h.year === 2025)
              
              let baselineData: FutureYear
              
              if (sc.dataMode === '2024 Data' && last2024) {
                baselineData = {
                  year: 2025,
                  totalIncome: last2024.totalIncome,
                  nonEmploymentCosts: last2024.nonEmploymentCosts,
                  nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
                  locumCosts: 113400, // 2024 actual locums costs
                  miscEmploymentCosts: 24623.49, // 2024 actual misc employment
                  physicians: scenario2024Defaults(),
                }
              } else if (sc.dataMode === '2025 Data' && last2025) {
                baselineData = {
                  year: 2025,
                  totalIncome: last2025.totalIncome,
                  nonEmploymentCosts: last2025.nonEmploymentCosts,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: 54600,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
                }
              } else {
                // Fallback to 2025 defaults
                baselineData = {
                  year: 2025,
                  totalIncome: last2025?.totalIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: 54600,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
                }
              }
              
              // Set the baseline data as the first entry in future years (replacing or adding 2025)
              const existingIndex = sc.future.findIndex(f => f.year === 2025)
              if (existingIndex >= 0) {
                sc.future[existingIndex] = baselineData
              } else {
                sc.future.unshift(baselineData)
              }
            }
            
            sc.dataMode = mode
          }),
        loadSnapshot: (snapshot) =>
          set((state) => {
            state.scenarioA = snapshot.scenarioA
            state.scenarioBEnabled = !!snapshot.scenarioBEnabled
            state.scenarioB = snapshot.scenarioBEnabled && snapshot.scenarioB ? snapshot.scenarioB : undefined
          }),
        resetToDefaults: () => {
          set((state) => {
            // ONLY reset projection parameters - NEVER touch baseline data or future years
            state.scenarioA.projection = { 
              incomeGrowthPct: 3.7, 
              nonEmploymentCostsPct: 7.8, 
              nonMdEmploymentCostsPct: 6.0, 
              locumsCosts: 120000, 
              miscEmploymentCostsPct: 6.7,
              benefitCostsGrowthPct: 5.0
            }
            state.scenarioA.selectedYear = 2025 // Reset to Baseline tab
            
            state.scenarioBEnabled = true
            
            if (state.scenarioB) {
              state.scenarioB.projection = { 
                incomeGrowthPct: 3.7, 
                nonEmploymentCostsPct: 7.8, 
                nonMdEmploymentCostsPct: 6.0, 
                locumsCosts: 0, 
                miscEmploymentCostsPct: 6.7,
                benefitCostsGrowthPct: 5.0
              }
              state.scenarioB.selectedYear = 2025 // Reset to Baseline tab
            }
          }, false)
          // Recalculate future years from existing baseline data using reset projection parameters
          const store = useDashboardStore.getState()
          store.applyProjectionFromLastActual('A')
          if (store.scenarioB) store.applyProjectionFromLastActual('B')
        },
      }
    }),
    {
      name: 'radiantcare-state-v1',
      storage: createJSONStorage((): Storage => localStorage),
      partialize: (state: Store) => ({
        scenarioA: state.scenarioA,
        scenarioBEnabled: state.scenarioBEnabled,
        scenarioB: state.scenarioB,
      }),
    }
  )
)

// Initialize projections on store creation
setTimeout(() => {
  const store = useDashboardStore.getState()
  store.applyProjectionFromLastActual('A')
  store.applyProjectionFromLastActual('B')
}, 0)

function currency(value: number): string {
  // Handle undefined/null values gracefully
  if (value == null || isNaN(value)) {
    value = 0
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// Abbreviated currency for compact displays (e.g., $525k)
function currencyShort(value: number): string {
  const thousands = Math.round(value / 1000)
  return `$${thousands}k`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Calculate when benefits start for a new employee based on the new waiting period rules
function calculateBenefitStartDay(startDay: number, year: number): number {
  const { month: startMonth, day: startDayOfMonth } = dayOfYearToDate(startDay, year)
  
  // Rule: If start date is the first of any month (except February), benefits start next month
  if (startDayOfMonth === 1 && startMonth !== 2) {
    // Benefits start on the first of the next month
    const nextMonth = startMonth === 12 ? 1 : startMonth + 1
    const nextYear = startMonth === 12 ? year + 1 : year
    
    if (nextYear > year) {
      // If it rolls to next year, benefits start after this year ends
      return daysInYear(year) + 1
    }
    
    // Calculate day of year for first of next month
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let dayOfYear = 0
    for (let i = 0; i < nextMonth - 1; i++) {
      dayOfYear += daysInMonth[i]
    }
    return dayOfYear + 1
  }
  
  // Rule: If start is mid-month (or Feb 1st), benefits start one month PLUS rounding up to next month start
  // This means: 30 days + beginning of first full month after that
  const thirtyDaysAfterStart = startDay + 30
  
  if (thirtyDaysAfterStart > daysInYear(year)) {
    // If 30 days after start goes into next year, benefits start after this year
    return daysInYear(year) + 1
  }
  
  // Find what month the 30-day mark falls in
  const { month: month30Days } = dayOfYearToDate(thirtyDaysAfterStart, year)
  
  // Benefits start on the first of the month AFTER the 30-day mark
  const benefitMonth = month30Days === 12 ? 1 : month30Days + 1
  const benefitYear = month30Days === 12 ? year + 1 : year
  
  if (benefitYear > year) {
    // If benefits start next year, return beyond this year
    return daysInYear(year) + 1
  }
  
  // Calculate day of year for first of benefit month
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let dayOfYear = 0
  for (let i = 0; i < benefitMonth - 1; i++) {
    dayOfYear += daysInMonth[i]
  }
  return dayOfYear + 1
}

// Calculate total cost for an employee including benefits and payroll taxes (WA State medical practice <50 employees)
function calculateEmployeeTotalCost(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0): number {
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Monthly benefits (convert to annual) - only if employee receives benefits
  let annualBenefits = 0
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      // For new employees, use the new benefit waiting period calculation
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      // Only count benefits if they start within this year
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        annualBenefits = yearlyBenefitCost * benefitPortion
      }
    } else {
      // For regular employees and mixed types, full benefits if they receive them
      annualBenefits = yearlyBenefitCost
    }
  }
  
  // Calculate all employer payroll taxes using the comprehensive function
  const totalPayrollTaxes = calculateEmployerPayrollTaxes(baseSalary, year)
  
  return baseSalary + annualBenefits + totalPayrollTaxes + bonusAmount
}

// Mixed type helpers
function getEmployeePortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 1
  if (physician.type === 'partner') return 0
  if (physician.type === 'newEmployee') {
    // New employees work from their start date to end of year
    const startPortion = physician.startPortionOfYear ?? 0
    return 1 - startPortion
  }
  if (physician.type === 'employeeToTerminate') {
    // Terminating employees work from beginning of year to termination date
    const terminatePortion = physician.terminatePortionOfYear ?? 1
    return terminatePortion
  }
  const val = physician.employeePortionOfYear ?? 0.5
  return clamp(val, 0, 1)
}

function getPartnerPortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 0
  if (physician.type === 'newEmployee') return 0
  if (physician.type === 'employeeToTerminate') return 0
  if (physician.type === 'partner') return 1
  if (physician.type === 'employeeToPartner') return 1 - getEmployeePortionOfYear(physician)
  if (physician.type === 'partnerToRetire') return physician.partnerPortionOfYear ?? 0.5
  return 0
}

function getPartnerFTEWeight(physician: Physician): number {
  // Allow up to 24 weeks for historical data compatibility
  const weeks = clamp(physician.weeksVacation ?? 0, 0, 24)
  const baseFte = 1 - weeks / 52
  return baseFte * getPartnerPortionOfYear(physician)
}


// Helper functions for date-based employee->partner transition
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

function dayOfYearToDate(dayOfYear: number, year: number): { month: number, day: number } {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let remainingDays = dayOfYear
  let month = 0
  
  while (remainingDays > daysInMonth[month]) {
    remainingDays -= daysInMonth[month]
    month++
  }
  
  return { month: month + 1, day: remainingDays }
}

function dateToString(month: number, day: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[month - 1]} ${day}`
}

function employeePortionToTransitionDay(employeePortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  // If employeePortionOfYear is 0, they transition on Jan 1 (day 1)
  // If employeePortionOfYear is 1, they transition on Jan 1 of next year (day = totalDays + 1)
  return Math.max(1, Math.round(employeePortionOfYear * totalDays) + 1)
}

function transitionDayToEmployeePortion(transitionDay: number, year: number): number {
  const totalDays = daysInYear(year)
  // Day 1 means transition on Jan 1 (0% employee time - partner from day 1)
  // Day N means they were employee for (N-1) days, then partner from day N onward
  return Math.max(0, (transitionDay - 1) / totalDays)
}

// Helper for retirement portion - day 0 means retired in prior year (0 working days), day 1+ means last day of work
function retirementDayToPartnerPortion(retirementDay: number, year: number): number {
  const totalDays = daysInYear(year)
  if (retirementDay === 0) {
    // Day 0 means retired in prior year - 0 working days in current year
    return 0
  }
  return retirementDay / totalDays
}

function partnerPortionToRetirementDay(partnerPortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  if (partnerPortionOfYear === 0) {
    // 0 working portion means day 0 (retired in prior year)
    return 0
  }
  return Math.round(partnerPortionOfYear * totalDays)
}

// Helper for new employee start date - similar to transition day but for start of employment
function startPortionToStartDay(startPortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  // startPortionOfYear 0 means Jan 1 (day 1), 1 means Dec 31 (last day)
  return Math.max(1, Math.round(startPortionOfYear * totalDays) + 1)
}

function startDayToStartPortion(startDay: number, year: number): number {
  const totalDays = daysInYear(year)
  // Day 1 means start on Jan 1 (0% through year), last day means start near end
  return Math.max(0, Math.min(1, (startDay - 1) / totalDays))
}

// Helper function to get quarter start days for a given year (Apr 1, Jul 1, Oct 1)
function getQuarterStartDays(year: number): { q2: number; q3: number; q4: number } {
  const isLeap = isLeapYear(year)
  const q2 = 31 + (isLeap ? 29 : 28) + 31 + 1 // Apr 1
  const q3 = 31 + (isLeap ? 29 : 28) + 31 + 30 + 31 + 30 + 1 // Jul 1
  const q4 = 31 + (isLeap ? 29 : 28) + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 1 // Oct 1
  return { q2, q3, q4 }
}
// Helper function to abbreviate physician names for summary display
function abbreviatePhysicianName(name: string): string {
  // Check if it's a default "Physician X" format
  if (/^Physician\s+\d+$/i.test(name.trim())) {
    return '??'
  }
  
  // If name is 2 characters or less, return as-is
  if (name.trim().length <= 2) {
    return name.trim()
  }
  
  // Split by spaces and take first letter of first two words
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    const firstInitial = words[0].charAt(0).toUpperCase()
    const secondInitial = words[1].charAt(0).toUpperCase()
    return firstInitial + secondInitial
  } else if (words.length === 1) {
    // If only one word, take first two characters
    return words[0].substring(0, 2).toUpperCase()
  }
  
  return name.trim()
}

// Bi-weekly payroll schedule calculations
// Reference: 12/20/2024 pay date for period 11/30/2024-12/13/2024
const REFERENCE_PAY_DATE = new Date('2024-12-20')
const REFERENCE_PERIOD_END = new Date('2024-12-13')

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getPayPeriodsForYear(year: number): Array<{ periodStart: Date; periodEnd: Date; payDate: Date }> {
  const periods: Array<{ periodStart: Date; periodEnd: Date; payDate: Date }> = []
  
  // Start from reference point and work backwards to find the first period of the year
  let currentPeriodEnd = new Date(REFERENCE_PERIOD_END)
  let currentPayDate = new Date(REFERENCE_PAY_DATE)
  
  // Go back to find the first pay period of the target year
  while (currentPeriodEnd.getFullYear() > year || 
         (currentPeriodEnd.getFullYear() === year && currentPeriodEnd.getMonth() > 0) ||
         (currentPeriodEnd.getFullYear() === year && currentPeriodEnd.getMonth() === 0 && currentPeriodEnd.getDate() > 14)) {
    currentPeriodEnd = addDays(currentPeriodEnd, -14)
    currentPayDate = addDays(currentPayDate, -14)
  }
  
  // Now work forward to collect all periods that could affect the target year
  const nextYearEnd = new Date(year + 1, 0, 31) // Include early next year for delayed payments
  
  while (currentPayDate <= nextYearEnd) {
    const periodStart = addDays(currentPeriodEnd, -13) // 14-day period
    
    periods.push({
      periodStart,
      periodEnd: new Date(currentPeriodEnd),
      payDate: new Date(currentPayDate)
    })
    
    // Move to next bi-weekly period
    currentPeriodEnd = addDays(currentPeriodEnd, 14)
    currentPayDate = addDays(currentPayDate, 14)
  }
  
  return periods
}

function calculateDelayedW2Payment(physician: Physician, year: number): { amount: number; taxes: number; periodDetails: string } {
  if (physician.type !== 'employeeToPartner') {
    return { amount: 0, taxes: 0, periodDetails: '' }
  }
  
  // Manual override for MC in 2025
  if (physician.name === 'MC' && year === 2025) {
    return {
      amount: 15289.23,
      taxes: 1493.36,
      periodDetails: '12/14/24-12/27/24, 12/28/24-12/31/24 (manual override)'
    }
  }
  
  const transitionDay = employeePortionToTransitionDay(physician.employeePortionOfYear ?? 0.5, year)
  const transitionDate = new Date(year, 0, transitionDay) // Convert to actual date
  
  const periods = getPayPeriodsForYear(year)
  const salary = physician.salary ?? 0
  
  // Calculate hourly rate: salary ÷ (52 weeks × 5 days × 8 hours)
  const annualWorkHours = 52 * 5 * 8  // 2,080 hours per year
  const hourlyRate = salary / annualWorkHours
  
  let totalWorkDays = 0
  let periodDetails: string[] = []
  
  // Helper function to count business days (Mon-Fri) in a date range
  function countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      // 1 = Monday through 5 = Friday
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }
  
  // Find periods where work was done in prior year but paid in current year
  for (const period of periods) {
    // Skip periods where pay date is before transition date
    if (period.payDate < transitionDate) continue
    
    // Check if work period was in prior year
    if (period.periodStart.getFullYear() < year || period.periodEnd.getFullYear() < year) {
      // Calculate business days in prior year
      const priorYearEnd = new Date(year - 1, 11, 31)
      const periodStartInPriorYear = period.periodStart.getFullYear() < year ? period.periodStart : new Date(year, 0, 1)
      const periodEndInPriorYear = period.periodEnd.getFullYear() < year ? period.periodEnd : priorYearEnd
      
      if (periodStartInPriorYear <= priorYearEnd) {
        const businessDaysInPriorYear = countBusinessDays(periodStartInPriorYear, periodEndInPriorYear)
        totalWorkDays += businessDaysInPriorYear
        
        const periodStartStr = `${periodStartInPriorYear.getMonth() + 1}/${periodStartInPriorYear.getDate()}`
        const periodEndStr = `${periodEndInPriorYear.getMonth() + 1}/${periodEndInPriorYear.getDate()}`
        const payDateStr = `${period.payDate.getMonth() + 1}/${period.payDate.getDate()}`
        periodDetails.push(`${periodStartStr}-${periodEndStr} (paid ${payDateStr}, ${businessDaysInPriorYear} work days)`)
      }
    }
  }
  
  // Calculate total amount: business days × 8 hours/day × hourly rate
  const amount = totalWorkDays * 8 * hourlyRate
  const taxes = calculateEmployerPayrollTaxes(amount, year)
  
  return {
    amount: Math.round(amount),
    taxes: Math.round(taxes),
    periodDetails: periodDetails.join(', ')
  }
}

// Generate tooltip content for employee cost breakdown (WA State medical practice <50 employees)
function getEmployeeCostTooltip(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0, delayedW2Amount: number = 0, delayedW2Taxes: number = 0, delayedW2Details: string = ''): string {
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Calculate benefits with new waiting period for new employees
  let benefits = 0
  let benefitsNote = ''
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        benefits = yearlyBenefitCost * benefitPortion
        
        const { month: benefitMonth, day: benefitDay } = dayOfYearToDate(benefitStartDay, year)
        const benefitStartDate = dateToString(benefitMonth, benefitDay)
        benefitsNote = ` (benefits start ${benefitStartDate})`
      } else {
        benefitsNote = ` (benefits start next year)`
      }
    } else {
      benefits = yearlyBenefitCost
    }
  }
  
  const ssWageBase = getSocialSecurityWageBase(year)
  
  // Federal taxes
  const federalUnemployment = Math.min(baseSalary, 7000) * 0.006
  const socialSecurity = Math.min(baseSalary, ssWageBase) * 0.062
  const medicare = baseSalary * 0.0145
  // Note: Additional Medicare tax is employee-paid, not employer-paid
  
  // Washington State taxes
  const waUnemployment = Math.min(baseSalary, 72800) * 0.009
  const waFamilyLeave = Math.min(baseSalary, ssWageBase) * 0.00658
  const waStateDisability = baseSalary * 0.00255
  const washingtonRate = baseSalary * 0.0003
  
  const totalCost = calculateEmployeeTotalCost(employee, year, benefitGrowthPct)
  const totalCostWithDelayed = totalCost + delayedW2Amount + delayedW2Taxes
  
  return `Employee Total Cost Breakdown (${year}):
Base Salary: ${currency(baseSalary)}${bonusAmount > 0 ? `
Relocation/Signing Bonus: ${currency(bonusAmount)}` : ''}${employee.receivesBenefits ? `
Benefits (Medical/Dental/Vision): ${currency(benefits)}${benefitsNote}` : `
Benefits: None`}

Federal Taxes:
FUTA (0.6% on first $7K): ${currency(federalUnemployment)}
Social Security (6.2% on first ${currency(ssWageBase)}): ${currency(socialSecurity)}
Medicare (1.45%): ${currency(medicare)}

Washington State Taxes:
SUTA (0.9% on first $72.8K): ${currency(waUnemployment)}
Family Leave (0.658% on first ${currency(ssWageBase)}): ${currency(waFamilyLeave)}
State Disability (0.255%): ${currency(waStateDisability)}
Washington Rate (0.030%): ${currency(washingtonRate)}${delayedW2Amount > 0 ? `

Delayed W2 Payments (Prior Year Work):
W2 Amount: ${currency(delayedW2Amount)}
Payroll Taxes: ${currency(delayedW2Taxes)}
Pay Periods: ${delayedW2Details}` : ''}

Total Cost: ${currency(totalCostWithDelayed)}

This total cost is deducted from the partner compensation pool.`
}

function usePartnerComp(year: number, scenario: ScenarioKey) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode
  return useMemo(() => {
    // For baseline year (2025): always derive from the selected data mode unless in Custom.
    // This avoids stale Custom state (e.g., a persisted 2025 entry in future years) from skewing baseline.
    if (year === 2025 && dataMode !== 'Custom') {
      const baselinePhysicians = dataMode === '2024 Data' ? scenario2024Defaults() : scenarioADefaultsByYear(2025)
      const partners = baselinePhysicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
      const partnerFTEs = partners.map((p) => {
        // Allow up to 24 weeks for historical data compatibility
        const weeks = clamp(p.weeksVacation ?? 0, 0, 24)
        const fte = 1 - weeks / 52
        const weight = fte * getPartnerPortionOfYear(p)
        return { p, weight }
      })
      const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
      // For 2025, only account for buyout costs of partners who worked part of the year
      // Partners who retired in prior year (weight = 0) shouldn't reduce the active partner pool
      const buyoutCosts = partners.reduce((sum, p) => {
        if (p.type === 'partnerToRetire') {
          const weight = (1 - (p.weeksVacation ?? 0) / 52) * (p.partnerPortionOfYear ?? 0.5)
          // Only subtract buyout if the partner worked part of the year
          return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
        }
        return sum
      }, 0)
      const delayedW2Costs = partners.reduce((sum, p) => {
        if (p.type === 'employeeToPartner') {
          const delayed = calculateDelayedW2Payment(p, year)
          return sum + delayed.amount + delayed.taxes
        }
        return sum
      }, 0)
      
      // Use different partner pools based on data mode
      const basePool = dataMode === '2024 Data' ? 2032099.02 : NET_PARTNER_POOL_2025
      // NET_PARTNER_POOL_2025 is already net of all costs, so only subtract buyouts
      // delayedW2Costs are already accounted for in the net pool
      const adjustedPool = basePool - buyoutCosts
      
      return partnerFTEs
        .filter(({ p, weight }) => {
          // Exclude partners who retired in prior year and only got buyout (no working portion)
          if (p.type === 'partnerToRetire' && weight === 0) {
            return false
          }
          return true
        })
        .map(({ p, weight }) => ({ 
          id: p.id, 
          name: p.name, 
          comp: (weight / totalWeight) * adjustedPool + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0)
        }))
    }
    if (!fy) return [] as { id: string; name: string; comp: number }[]
    const partners = fy.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
    const employees = fy.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')
    const totalEmployeeCosts = employees.reduce((sum, e) => {
      const employeePortion = getEmployeePortionOfYear(e)
      if (employeePortion <= 0) return sum
      
      // Calculate full employee cost including benefits and payroll taxes
      if (e.type === 'newEmployee') {
        // For new employees, calculate prorated total cost
        const proratedEmployee = { ...e, salary: (e.salary ?? 0) * employeePortion }
        return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
      } else if (e.type === 'employeeToTerminate') {
        // For terminating employees, calculate prorated total cost
        const proratedEmployee = { ...e, salary: (e.salary ?? 0) * employeePortion }
        return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
      } else if (e.type === 'employeeToPartner') {
        // For mixed types, only count the employee portion of their total cost
        const employeePortionSalary = (e.salary ?? 0) * employeePortion
        const employeePortionPhysician = { ...e, salary: employeePortionSalary }
        return sum + calculateEmployeeTotalCost(employeePortionPhysician, year, sc.projection.benefitCostsGrowthPct)
      } else {
        // For regular employees, calculate full cost
        return sum + calculateEmployeeTotalCost(e, year, sc.projection.benefitCostsGrowthPct)
      }
    }, 0)
    const totalBuyoutCosts = fy.physicians.reduce((sum, p) => {
      if (p.type === 'partnerToRetire') {
        const weight = getPartnerFTEWeight(p)
        // Only subtract buyout if the partner worked part of the year
        return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
      }
      return sum
    }, 0)
    // Calculate delayed W2 payments for employeeToPartner physicians
    const totalDelayedW2Costs = fy.physicians.reduce((sum, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, year)
        return sum + delayed.amount + delayed.taxes
      }
      return sum
    }, 0)
    const totalCosts = fy.nonEmploymentCosts + fy.nonMdEmploymentCosts + fy.miscEmploymentCosts + fy.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs
    const pool = Math.max(0, fy.totalIncome - totalCosts)
    if (partners.length === 0) return []
    const partnerFTEs = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
    const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
    return partnerFTEs
      .filter(({ p, weight }) => {
        // Exclude partners who retired in prior year and only got buyout (no working portion)
        if (p.type === 'partnerToRetire' && weight === 0) {
          return false
        }
        return true
      })
      .map(({ p, weight }) => ({
        id: p.id,
        name: p.name,
        comp: (weight / totalWeight) * pool + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0),
      }))
  }, [fy, sc, dataMode])
}

// Helper function to check if physicians have been changed from defaults
function arePhysiciansChanged(
  scenario: ScenarioKey,
  year: number,
  currentPhysicians: Physician[],
  _store: any
): boolean {
  // Get default physicians for this year and scenario
  const defaultPhysicians = scenario === 'A' 
    ? scenarioADefaultsByYear(year) 
    : scenarioBDefaultsByYear(year)
  
  // If different number of physicians, it's changed
  if (currentPhysicians.length !== defaultPhysicians.length) {
    return true
  }
  
  // Compare each physician's properties
  for (let i = 0; i < currentPhysicians.length; i++) {
    const current = currentPhysicians[i]
    const defaultPhysician = defaultPhysicians[i]
    
    // Compare all relevant properties
    if (
      current.name !== defaultPhysician.name ||
      current.type !== defaultPhysician.type ||
      current.salary !== defaultPhysician.salary ||
      current.weeksVacation !== defaultPhysician.weeksVacation ||
      current.employeePortionOfYear !== defaultPhysician.employeePortionOfYear ||
      current.partnerPortionOfYear !== defaultPhysician.partnerPortionOfYear ||
      current.startPortionOfYear !== defaultPhysician.startPortionOfYear ||
      current.terminatePortionOfYear !== defaultPhysician.terminatePortionOfYear ||
      current.receivesBenefits !== defaultPhysician.receivesBenefits ||
      current.receivesBonuses !== defaultPhysician.receivesBonuses ||
      current.bonusAmount !== defaultPhysician.bonusAmount ||
      current.buyoutCost !== defaultPhysician.buyoutCost
    ) {
      return true
    }
  }
  
  return false
}

// Helper function to calculate projected value for a specific year and field
function calculateProjectedValue(
  scenario: ScenarioKey,
  year: number,
  field: 'totalIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'miscEmploymentCosts',
  store: any
): number {
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!sc || year === 2025) return 0 // No projections for baseline year

  // Get baseline data based on data mode
  let baselineData
  if (sc.dataMode === 'Custom') {
    const customBaseline = sc.baseline?.find((b: any) => b.year === 2025)
    if (customBaseline) {
      baselineData = {
        totalIncome: customBaseline.totalIncome,
        nonEmploymentCosts: customBaseline.nonEmploymentCosts,
        miscEmploymentCosts: customBaseline.miscEmploymentCosts,
        nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
      }
    } else {
      const last2025 = store.historic.find((h: any) => h.year === 2025)
      baselineData = {
        totalIncome: last2025?.totalIncome || 3344068.19,
        nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }
  } else if (sc.dataMode === '2024 Data') {
    const last2024 = store.historic.find((h: any) => h.year === 2024)!
    baselineData = {
      totalIncome: last2024.totalIncome,
      nonEmploymentCosts: last2024.nonEmploymentCosts,
      miscEmploymentCosts: 24623.49,
      nonMdEmploymentCosts: 164677.44,
    }
  } else if (sc.dataMode === '2025 Data') {
    const last2025 = store.historic.find((h: any) => h.year === 2025)!
    baselineData = {
      totalIncome: last2025.totalIncome,
      nonEmploymentCosts: last2025.nonEmploymentCosts,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  } else {
    baselineData = {
      totalIncome: 3344068.19,
      nonEmploymentCosts: 229713.57,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  }

  // Convert percentage growth rates to decimal multipliers
  const incomeGpct = sc.projection.incomeGrowthPct / 100
  const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
  const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
  const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100

  // Calculate projected value for the specific year
  let value = baselineData[field]
  const yearsSinceBaseline = year - 2025
  
  if (field === 'totalIncome') {
    value = value * Math.pow(1 + incomeGpct, yearsSinceBaseline)
  } else if (field === 'nonEmploymentCosts') {
    value = value * Math.pow(1 + nonEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'nonMdEmploymentCosts') {
    value = value * Math.pow(1 + nonMdEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'miscEmploymentCosts') {
    value = value * Math.pow(1 + miscEmploymentGpct, yearsSinceBaseline)
  }

  return value
}

function YearPanel({ year, scenario }: { year: number; scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
  const isReadOnly = year === 2025 && dataMode !== 'Custom'
  const last2024 = store.historic.find((h) => h.year === 2024)
  const last2025 = store.historic.find((h) => h.year === 2025)
  
  const fy = isReadOnly && (last2024 || last2025)
    ? (() => {
        // For Custom mode, use the editable data from future years array
        if ((dataMode as string) === 'Custom') {
          const customData = sc.future.find((f) => f.year === 2025)
          if (customData) return customData
          // Fallback if no custom data exists yet
          return {
            year: 2025,
            totalIncome: last2025?.totalIncome || 3344068.19,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          } as FutureYear
        }
        // Determine baseline data based on selected data mode
        else if (dataMode === '2024 Data' && last2024) {
          return {
            year: 2025,
            totalIncome: last2024.totalIncome,
            nonEmploymentCosts: last2024.nonEmploymentCosts,
            nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
            locumCosts: 113400, // 2024 actual locums costs
            miscEmploymentCosts: 18182.56, // 2024 actual misc employment from image
            physicians: scenario2024Defaults(),
          } as FutureYear
        } else if (dataMode === '2025 Data' && last2025) {
          return {
            year: 2025,
            totalIncome: last2025.totalIncome,
            nonEmploymentCosts: last2025.nonEmploymentCosts,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          } as FutureYear
        } else {
          // Fallback 
          return {
            year: 2025,
            totalIncome: last2025?.totalIncome || 3344068.19,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          } as FutureYear
        }
      })()
    : (sc.future.find((f) => f.year === year) as FutureYear)
  const partnerComp = usePartnerComp(year, scenario)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {year === 2025 ? (
        <div style={{ position: 'relative' }}>
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            alignItems: 'center', 
            marginBottom: 4,
            animation: 'fadeInSlideDown 0.3s ease-out',
            transformOrigin: 'top'
          }}>
            <span style={{ marginLeft: 13, fontWeight: 700, fontSize: 16, color: '#374151' }}>Data Source:</span>
            {(['Custom', '2024 Data', '2025 Data'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                store.setDataMode(scenario, mode)
                // Only recalculate projections when switching between actual data modes (not to/from Custom)
                if (mode !== 'Custom') {
                  store.applyProjectionFromLastActual(scenario)
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: (scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode) === mode ? '#f0f4ff' : 'white',
                fontWeight: (scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode) === mode ? 600 : 400,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {mode}
            </button>
            ))}
          </div>
        </div>

        
      ) : (
        <div style={{ fontWeight: 700, fontSize: 18 }}>{year}</div>
      )}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f3f4f6', padding: 8 }}>

      <div className="panel-green" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Total Income</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'totalIncome', store)
          const currentValue = fy.totalIncome || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('income-reset-tooltip')
                store.setFutureValue(scenario, year, 'totalIncome', projectedValue)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('income-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('income-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={2000000}
          max={4000000}
          step={1000}
          value={fy.totalIncome || 3000000}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'totalIncome', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.totalIncome || 3000000) - 2000000) / (4000000 - 2000000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.totalIncome || 3000000))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'totalIncome', Number(e.target.value.replace(/[^0-9]/g, '')))
          }
          disabled={isReadOnly}
          style={{ 
            width: isMobile ? 100 : 100, 
            height: 20, 
            padding: '2px 8px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('income-tooltip', 'Gross (Therapy, Other Professional, Interest)', e)}
          onMouseLeave={() => removeTooltip('income-tooltip')}
          onTouchStart={(e) => createTooltip('income-tooltip', 'Gross (Therapy, Other Professional, Interest)', e)}
          onClick={(e) => createTooltip('income-tooltip', 'Gross (Therapy, Other Professional, Interest)', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Non-Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonEmploymentCosts', store)
          const currentValue = fy.nonEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('non-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'nonEmploymentCosts', projectedValue)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('non-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('non-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={100000}
          max={500000}
          step={1000}
          value={fy.nonEmploymentCosts || 200000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.nonEmploymentCosts || 200000) - 100000) / (500000 - 100000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonEmploymentCosts || 200000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: isMobile ? 100 : 100, 
            height: 20, 
            padding: '2px 8px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onMouseLeave={() => removeTooltip('nonemp-tooltip')}
          onTouchStart={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onClick={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Staff Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonMdEmploymentCosts', store)
          const currentValue = fy.nonMdEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('staff-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'nonMdEmploymentCosts', projectedValue)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('staff-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('staff-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={50000}
          max={300000}
          step={1000}
          value={fy.nonMdEmploymentCosts || 150000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonMdEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.nonMdEmploymentCosts || 150000) - 50000) / (300000 - 50000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonMdEmploymentCosts || 150000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonMdEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: isMobile ? 100 : 100, 
            height: 20, 
            padding: '2px 8px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('nonmd-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'nonmd-tooltip'
            tooltip.style.cssText = `
              position: absolute;
              background: #333;
              color: white;
              padding: 8px 12px;
              border-radius: 4px;
              font-size: 12px;
              white-space: pre-line;
              text-align: left;
              z-index: 1000;
              max-width: 360px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              pointer-events: none;
            `
            tooltip.textContent = `Includes: Practice Manager, Billing\n\nBaseline 2025:\nRG: Full-time, $31.25 per hour, Medical/Dental/Vision\nAL: Part-time: $27 per hour, 32 hours per week\nMW: Part-time: $23 per hour, 20 hours per week`
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => {
            const tooltip = document.getElementById('nonmd-tooltip')
            if (tooltip) tooltip.remove()
          }}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>


      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Misc Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'miscEmploymentCosts', store)
          const currentValue = fy.miscEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 100 // $100 threshold for smaller amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('misc-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'miscEmploymentCosts', projectedValue)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('misc-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('misc-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={100000}
          step={1000}
          value={fy.miscEmploymentCosts || 25000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'miscEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${((fy.miscEmploymentCosts || 25000) / 100000) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.miscEmploymentCosts || 25000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'miscEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: isMobile ? 100 : 100, 
            height: 20, 
            padding: '2px 8px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('misc-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'misc-tooltip'
            tooltip.style.cssText = `
              position: absolute;
              background: #333;
              color: white;
              padding: 8px 12px;
              border-radius: 4px;
              font-size: 12px;
              white-space: pre-line;
              text-align: left;
              z-index: 1000;
              max-width: 300px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              pointer-events: none;
            `
            const baseContent = 'Includes:\nGifts\nProfit Sharing\nRelocation\nRecruiting'
            tooltip.textContent = baseContent
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => {
            const tooltip = document.getElementById('misc-tooltip')
            if (tooltip) tooltip.remove()
          }}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>
      </div>
      </div>

      <PhysiciansEditor
        year={year}
        scenario={scenario}
        readOnly={isReadOnly}
        physiciansOverride={isReadOnly ? (() => {
          if (dataMode === '2024 Data') {
            return scenario2024Defaults()
          } else {
            return scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          }
        })() : undefined}
        locumCosts={fy.locumCosts}
        onLocumCostsChange={(value) => store.setFutureValue(scenario, year, 'locumCosts', value)}
      />

      {partnerComp.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f3f4f6' }}>
          <div style={{ fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>Partner Compensation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'center', columnGap: 16, rowGap: 2 }}>
            {partnerComp.map((p) => (
              <Fragment key={p.id}>
                <div>{p.name}</div>
                <div style={{ textAlign: 'right', position: 'relative', overflow: 'visible' }}>
                  {currency(p.comp)}
                  {(() => {
                    const md = fy?.physicians.find((x) => x.id === p.id)
                    if (md && md.type === 'employeeToPartner') {
                      // Show delayed W2 payments for employeeToPartner physicians
                      const delayedW2 = calculateDelayedW2Payment(md, year)
                      if (delayedW2.amount > 0) {
                        return (
                          <span style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 400 }}>
                            {`(+ ${currency(delayedW2.amount)} W2)`}
                          </span>
                        )
                      }
                      
                      // Fallback to regular W2 calculation if no delayed payments
                      const employeePortion = md.employeePortionOfYear ?? 0
                      const w2 = (md.salary ?? 0) * employeePortion
                      if (w2 > 0) {
                        return (
                          <span style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 400 }}>
                            {`(+ ${currency(w2)} W2)`}
                          </span>
                        )
                      }
                    }
                    return null
                  })()}
                </div>
              </Fragment>
            ))}
            <div style={{ gridColumn: '1 / -1', height: 1, background: '#e5e7eb', margin: '4px 0' }} />
            <div style={{ fontWeight: 700 }}>Net Income</div>
            <div style={{ textAlign: 'right', fontWeight: 700 }}>
              {currency(partnerComp.reduce((s, x) => s + x.comp, 0))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
function PhysiciansEditor({ year, scenario, readOnly = false, physiciansOverride, locumCosts, onLocumCostsChange }: { year: number; scenario: ScenarioKey; readOnly?: boolean; physiciansOverride?: Physician[]; locumCosts: number; onLocumCostsChange: (value: number) => void }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)!
  const physicians = physiciansOverride ?? fy.physicians

  const handleReorder = (fromIndex: number, toIndex: number) => {
    store.reorderPhysicians(scenario, year, fromIndex, toIndex)
  }

  const rows = physicians.map((p) => {
    const canDelete = !readOnly && physicians.length > 3
    return (
      <div
        key={p.id}
        style={{
          borderTop: '1px solid #d1d5db',
          paddingTop: 10,
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: '20px 120px 150px 1fr 20px 20px 20px',
          gap: 8,
          alignItems: 'center',
          cursor: 'default',
          background: 'transparent'
        }}
      >
        {/* Drag Handle */}
        <div
          {...(!readOnly && { 'data-drag-handle': true })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: readOnly ? '#ccc' : '#333',
            fontSize: '14px',
            cursor: readOnly ? 'default' : 'grab',
            userSelect: 'none',
            opacity: readOnly ? 0.3 : 1.0,
            touchAction: readOnly ? 'auto' : 'none',
          }}
          title={readOnly ? '' : 'Drag to reorder'}
        >
          ⋮⋮
        </div>
        <input
          value={p.name}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, { ...p, name: e.target.value })
          }
          disabled={readOnly}
          style={{ 
            width: '100%', 
            height: 20, 
            padding: '2px 8px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12
          }}
        />
        <select
          value={p.type}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, {
              ...p,
              type: e.target.value as PhysicianType,
              // Initialize sensible defaults when switching types
              employeePortionOfYear: e.target.value === 'employeeToPartner' ? (p.employeePortionOfYear ?? 0.5) : p.employeePortionOfYear,
              partnerPortionOfYear: e.target.value === 'partnerToRetire' ? (p.partnerPortionOfYear ?? 0.5) : p.partnerPortionOfYear,
              startPortionOfYear: e.target.value === 'newEmployee' ? (p.startPortionOfYear ?? 0) : p.startPortionOfYear,
              terminatePortionOfYear: e.target.value === 'employeeToTerminate' ? (p.terminatePortionOfYear ?? 1) : p.terminatePortionOfYear,
              salary: e.target.value !== 'partner' && e.target.value !== 'partnerToRetire' ? (p.salary ?? 500000) : undefined,
              weeksVacation: e.target.value !== 'employee' && e.target.value !== 'newEmployee' ? (p.weeksVacation ?? 8) : undefined,
              receivesBenefits: e.target.value !== 'partner' && e.target.value !== 'partnerToRetire' ? (p.receivesBenefits ?? true) : undefined,
              buyoutCost: e.target.value === 'partnerToRetire' ? (p.buyoutCost ?? 50000) : undefined,
            })
          }
          disabled={readOnly}
        >
          <option value="newEmployee">New Employee</option>
          <option value="employee">Employee</option>
          <option value="employeeToTerminate">Employee → Terminate</option>
          <option value="employeeToPartner">Employee → Partner</option>
          <option value="partner">Partner</option>
          <option value="partnerToRetire">Partner → Retire</option>
        </select>
        {p.type === 'newEmployee' ? (
          // newEmployee
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={startPortionToStartDay(p.startPortionOfYear ?? 0, year)}
                    onChange={(e) => {
                      const startDay = Number(e.target.value)
                      const startPortion = startDayToStartPortion(startDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        startPortionOfYear: startPortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((startPortionToStartDay(p.startPortionOfYear ?? 0, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                      const { month, day } = dayOfYearToDate(startDay, year)
                      return `→ ${dateToString(month, day)}`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const startPortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            startPortionOfYear: startPortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const startPortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            startPortionOfYear: startPortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <img
                src={p.receivesBonuses ? '/bonus_selected.png' : '/bonus_unselected.png'}
                alt={`Bonus ${p.receivesBonuses ? 'enabled' : 'disabled'}`}
                data-bonus-id={p.id}
                style={{
                  width: '20px',
                  height: 'auto',
                  maxHeight: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1,
                  objectFit: 'contain'
                }}
                onClick={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
                onMouseEnter={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    // Add a delay before hiding to allow mouse to move to tooltip
                    const tooltip = document.getElementById(`bonus-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`bonus-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
              />
              <img
                src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
                alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1
                }}
                onClick={() => {
                  if (!readOnly) {
                    const newBenefitsState = !p.receivesBenefits
                    store.upsertPhysician(scenario, year, {
                      ...p, 
                      receivesBenefits: newBenefitsState
                    })
                    // Update tooltip in real-time if it's currently visible
                    const tooltip = document.getElementById('benefits-tooltip-new')
                    if (tooltip) {
                      tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  createTooltip('benefits-tooltip-new', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  removeTooltip('benefits-tooltip-new')
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => createTooltip('benefits-tooltip-new', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '19px 19px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'new-employee-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                  const { month, day } = dayOfYearToDate(startDay, year)
                  const startDate = dateToString(month, day)
                  const workingPortion = 1 - (p.startPortionOfYear ?? 0)
                  const workingPct = Math.round(workingPortion * 100)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  let extra = ''
                  if (Math.abs(startDay - 183) <= 1) extra = `\n(Mid-year start)`
                  
                  tooltip.textContent = `New Employee:\nStart date: ${startDate}\nWorking portion: ${workingPct}%\nProrated salary: ${currency(proratedSalary)}${extra}`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('new-employee-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'new-employee-cost-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const workingPortion = 1 - (p.startPortionOfYear ?? 0)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  const tooltip_content = getEmployeeCostTooltip({ ...p, salary: proratedSalary }, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                  tooltip.textContent = tooltip_content.replace('Employee Total Cost', 'New Employee Total Cost (Prorated)')
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('new-employee-cost-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'employeeToTerminate' ? (
          // employeeToTerminate
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)}
                    onChange={(e) => {
                      const terminateDay = Number(e.target.value)
                      const terminatePortion = startDayToStartPortion(terminateDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        terminatePortionOfYear: terminatePortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((startPortionToStartDay(p.terminatePortionOfYear ?? 1, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                      const { month, day } = dayOfYearToDate(terminateDay, year)
                      return `${dateToString(month, day)} →`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const terminatePortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            terminatePortionOfYear: terminatePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const terminatePortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            terminatePortionOfYear: terminatePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <img
                src={p.receivesBonuses ? '/bonus_selected.png' : '/bonus_unselected.png'}
                alt={`Bonus ${p.receivesBonuses ? 'enabled' : 'disabled'}`}
                data-bonus-id={p.id}
                style={{
                  width: '20px',
                  height: 'auto',
                  maxHeight: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1,
                  objectFit: 'contain'
                }}
                onClick={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
                onMouseEnter={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    // Add a delay before hiding to allow mouse to move to tooltip
                    const tooltip = document.getElementById(`bonus-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`bonus-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
              />
              <img
                src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
                alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1
                }}
                onClick={() => {
                  if (!readOnly) {
                    const newBenefitsState = !p.receivesBenefits
                    store.upsertPhysician(scenario, year, {
                      ...p, 
                      receivesBenefits: newBenefitsState
                    })
                    // Update tooltip in real-time if it's currently visible
                    const tooltip = document.getElementById('benefits-tooltip-terminate')
                    if (tooltip) {
                      tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  createTooltip('benefits-tooltip-terminate', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  removeTooltip('benefits-tooltip-terminate')
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => createTooltip('benefits-tooltip-terminate', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '19px 19px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'terminate-employee-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                  const { month, day } = dayOfYearToDate(terminateDay, year)
                  const terminateDate = dateToString(month, day)
                  const workingPortion = p.terminatePortionOfYear ?? 1
                  const workingPct = Math.round(workingPortion * 100)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  let extra = ''
                  if (Math.abs(terminateDay - 183) <= 1) extra = `\n(Mid-year termination)`
                  
                  tooltip.textContent = `Terminating Employee:\nTermination date: ${terminateDate}\nWorking portion: ${workingPct}%\nProrated salary: ${currency(proratedSalary)}${extra}`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('terminate-employee-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'terminate-employee-cost-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const workingPortion = p.terminatePortionOfYear ?? 1
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  const tooltip_content = getEmployeeCostTooltip({ ...p, salary: proratedSalary }, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                  tooltip.textContent = tooltip_content.replace('Employee Total Cost', 'Terminating Employee Total Cost (Prorated)')
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('terminate-employee-cost-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'employee' ? (
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                type="range"
                min={350000}
                max={650000}
                step={1000}
                value={p.salary ?? 0}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    salary: Number(e.target.value),
                  })
                }
                disabled={readOnly}
                style={{ 
                  width: '100%',
                  ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                }}
              />
              <input
                type="text"
                value={currency(Math.round(p.salary ?? 0))}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                  })
                }
                style={{ 
                  width: 100, 
                  height: 20, 
                  padding: '2px 8px', 
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  fontSize: 12
                }}
                disabled={readOnly}
              />
            </div>
            <img
              src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
              alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
              style={{
                width: '20px',
                height: '20px',
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.6 : 1
              }}
              onClick={() => {
                if (!readOnly) {
                  const newBenefitsState = !p.receivesBenefits
                  store.upsertPhysician(scenario, year, {
                    ...p, 
                    receivesBenefits: newBenefitsState
                  })
                  // Update tooltip in real-time if it's currently visible
                  const tooltip = document.getElementById('benefits-tooltip')
                  if (tooltip) {
                    tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                  }
                }
              }}
              onMouseEnter={(e) => {
                createTooltip('benefits-tooltip', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                if (!readOnly) {
                  e.currentTarget.style.opacity = '0.8'
                }
              }}
              onMouseLeave={(e) => {
                removeTooltip('benefits-tooltip')
                if (!readOnly) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
              onTouchStart={(e) => createTooltip('benefits-tooltip', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
            />
            <div 
              style={{ 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
                width: '20px',
                height: '20px',
                border: '1px solid #ccc',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa'
              }}
              onMouseEnter={(e) => {
                const tooltip = document.createElement('div')
                tooltip.id = 'employee-tooltip'
                tooltip.style.cssText = `
                  position: absolute;
                  background: #333;
                  color: white;
                  padding: 8px 12px;
                  border-radius: 4px;
                  font-size: 12px;
                  white-space: pre-line;
                  text-align: left;
                  z-index: 1000;
                  max-width: 300px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                  pointer-events: none;
                `
                tooltip.textContent = getEmployeeCostTooltip(p, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                document.body.appendChild(tooltip)
                
                const rect = e.currentTarget.getBoundingClientRect()
                tooltip.style.left = `${rect.right + 10}px`
                tooltip.style.top = `${rect.top + window.scrollY}px`
              }}
              onMouseLeave={() => {
                const tooltip = document.getElementById('employee-tooltip')
                if (tooltip) tooltip.remove()
              }}
            >
              <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'partnerToRetire' ? (
          // partnerToRetire
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: (p.partnerPortionOfYear ?? 0.5) > 0 ? 'auto auto auto' : 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={0}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)}
                    onChange={(e) => {
                      const retirementDay = Number(e.target.value)
                      const partnerPortion = retirementDayToPartnerPortion(retirementDay, year)
                      const updatedPhysician = {
                        ...p,
                        partnerPortionOfYear: partnerPortion,
                      }
                      // If changing to Prior Year (partnerPortion === 0), remove weeksVacation
                      // If changing away from Prior Year, set default weeksVacation if not present
                      if (partnerPortion === 0) {
                        updatedPhysician.weeksVacation = undefined
                      } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                        // Changing from Prior Year to actual working days, set default weeks
                        updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                      }
                      store.upsertPhysician(scenario, year, updatedPhysician)
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${(partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year) / daysInYear(year)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = day / totalDays
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                      if (retirementDay === 0) {
                        return "Prior Year"
                      }
                      const { month, day } = dayOfYearToDate(retirementDay, year)
                      return `${dateToString(month, day)} →`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const partnerPortion = retirementDayToPartnerPortion(newDay, year)
                          const updatedPhysician = {
                            ...p,
                            partnerPortionOfYear: partnerPortion,
                          }
                          // If changing to Prior Year, remove weeksVacation
                          // If changing away from Prior Year, set default weeksVacation if not present
                          if (partnerPortion === 0) {
                            updatedPhysician.weeksVacation = undefined
                          } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                            updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                          }
                          store.upsertPhysician(scenario, year, updatedPhysician)
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                          const newDay = Math.max(0, currentDay - 1)
                          const partnerPortion = retirementDayToPartnerPortion(newDay, year)
                          const updatedPhysician = {
                            ...p,
                            partnerPortionOfYear: partnerPortion,
                          }
                          // If changing to Prior Year, remove weeksVacation
                          // If changing away from Prior Year, set default weeksVacation if not present
                          if (partnerPortion === 0) {
                            updatedPhysician.weeksVacation = undefined
                          } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                            updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                          }
                          store.upsertPhysician(scenario, year, updatedPhysician)
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Only show weeks vacation slider if partnerPortionOfYear > 0 (not Jan 1 retirement) */}
              {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    type="range"
                    min={2}
                    max={(() => {
                      const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                      return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                    })()}
                    step={1}
                    value={p.weeksVacation ?? 8}
                    onChange={(e) =>
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        weeksVacation: Number(e.target.value),
                      })
                    }
                    disabled={readOnly}
                    style={{ 
                      width: '100%',
                      ['--fill-percent' as any]: `${(() => {
                        const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                        const maxWeeks = (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                        return ((p.weeksVacation ?? 8) - 2) / (maxWeeks - 2) * 100
                      })()}%`
                    }}
                  />
                  <input
                    type="text"
                    value={`${p.weeksVacation ?? 8} weeks off`}
                    onChange={(e) =>
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        weeksVacation: Number(e.target.value.replace(/[^0-9]/g, '')),
                      })
                    }
                    style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                    disabled={readOnly}
                  />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={100000}
                  step={1000}
                  value={p.buyoutCost ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      buyoutCost: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.buyoutCost ?? 0) / 100000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.buyoutCost ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      buyoutCost: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div></div> {/* Empty benefits column for retiring partners */}
              <div style={{ display: 'grid', gridTemplateRows: (p.partnerPortionOfYear ?? 0.5) > 0 ? '19px 19px 19px' : '19px 19px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'partner-retire-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                    const { month, day } = dayOfYearToDate(retirementDay, year)
                    const retirementDate = dateToString(month, day)
                    const partnerPct = Math.round((p.partnerPortionOfYear ?? 0.5) * 100)
                    const retiredPct = 100 - partnerPct
                    let extra = ''
                    if (retirementDay === 0) {
                      extra = `\n(Retired in previous year, buyout cost in ${year})`
                    } else if (Math.abs(retirementDay - 183) <= 1) {
                      extra = `\n(Mid-year retirement)`
                    }
                    tooltip.textContent = `Partner → Retire transition:\nLast working day: ${retirementDay === 0 ? 'Prior Year' : retirementDate}\nWorking portion: ${partnerPct}%\nRetired portion: ${retiredPct}%${extra}`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('partner-retire-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                {/* Only show weeks off tooltip if weeks vacation is shown */}
                {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                  <div 
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                    onMouseEnter={(e) => {
                      const tooltip = document.createElement('div')
                      tooltip.id = 'weeks-off-tooltip'
                      tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                      tooltip.textContent = `Weeks Off During Working Period:\n\nThis represents the actual number of weeks off taken during the portion of the year the partner was actively working.\n\nNot prorated - these are full weeks of vacation/time off.`
                      document.body.appendChild(tooltip)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      tooltip.style.left = `${rect.right + 10}px`
                      tooltip.style.top = `${rect.top + window.scrollY}px`
                    }}
                    onMouseLeave={() => { const t = document.getElementById('weeks-off-tooltip'); if (t) t.remove() }}
                  >
                    <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
                  </div>
                )}
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'buyout-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    tooltip.textContent = `Buyout Cost Breakdown:\nBuyout Payment: ${currency(p.buyoutCost ?? 0)}\n\nThis is a one-time cost that reduces the partner compensation pool for the year.`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('buyout-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'partner' ? (
          // partner
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                type="range"
                min={2}
                max={(() => {
                  const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                  return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                })()}
                step={1}
                value={p.weeksVacation ?? 8}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    weeksVacation: Number(e.target.value),
                  })
                }
                disabled={readOnly}
                style={{ 
                  width: '100%',
                  ['--fill-percent' as any]: `${((p.weeksVacation ?? 8) - 2) / ((() => {
                    const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                    return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                  })() - 2) * 100}%`
                }}
              />
              <input
                type="text"
                value={`${p.weeksVacation ?? 8} weeks off`}
                onChange={(e) => {
                  const weeks = Number(e.target.value.replace(/[^0-9]/g, ''))
                  if (!isNaN(weeks)) {
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: weeks,
                    })
                  }
                }}
                style={{ 
                  width: 100, 
                  height: 20, 
                  padding: '2px 8px', 
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  fontSize: 12
                }}
                disabled={readOnly}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={p.receivesBonuses ? '/bonus_selected.png' : '/bonus_unselected.png'}
                alt={`Bonus ${p.receivesBonuses ? 'enabled' : 'disabled'}`}
                data-bonus-id={p.id}
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'contain',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.5 : 1
                }}
                onClick={(e) => {
                  if (readOnly) return
                  const newBonusState = !p.receivesBonuses
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    receivesBonuses: newBonusState,
                    bonusAmount: newBonusState ? (p.bonusAmount ?? 0) : 0,
                  })
                  // Update tooltip in real-time if it's currently visible
                  const tooltip = document.getElementById('benefits-tooltip-partner')
                  if (tooltip) {
                    tooltip.innerHTML = `Bonuses: ${newBonusState ? 'Enabled' : 'Disabled'}`
                  }
                }}
                onMouseEnter={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                      })
                    })
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    // Add a delay before hiding to allow mouse to move to tooltip
                    const tooltip = document.getElementById(`bonus-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`bonus-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                      })
                    })
                  }
                }}
              />
            </div>
            <div 
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
              onMouseEnter={(e) => {
                const tooltip = document.createElement('div')
                tooltip.id = 'partner-tooltip'
                tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                const weeks = p.weeksVacation ?? 8
                const fte = 1 - weeks / 52
                tooltip.textContent = `Partner:\nWeeks off: ${weeks}\nFTE: ${(fte * 100).toFixed(1)}%`
                document.body.appendChild(tooltip)
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                tooltip.style.left = `${rect.right + 10}px`
                tooltip.style.top = `${rect.top + window.scrollY}px`
              }}
              onMouseLeave={() => { const t = document.getElementById('partner-tooltip'); if (t) t.remove() }}
            ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : (
          // employeeToPartner
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)}
                    onChange={(e) => {
                      const transitionDay = Number(e.target.value)
                      const employeePortion = transitionDayToEmployeePortion(transitionDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        employeePortionOfYear: employeePortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                      const { month, day } = dayOfYearToDate(transitionDay, year)
                      return `→ ${dateToString(month, day)}`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const employeePortion = transitionDayToEmployeePortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            employeePortionOfYear: employeePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const employeePortion = transitionDayToEmployeePortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            employeePortionOfYear: employeePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={2}
                  max={(() => {
                    const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                    return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                  })()}
                  step={1}
                  value={p.weeksVacation ?? 8}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${(() => {
                      const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                      const maxWeeks = (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                      return ((p.weeksVacation ?? 8) - 2) / (maxWeeks - 2) * 100
                    })()}%`
                  }}
                />
                <input
                  type="text"
                  value={`${p.weeksVacation ?? 8} weeks off`}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <img 
              src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
              alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
              style={{ 
                width: '20px',
                height: '20px',
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.6 : 1,
                justifySelf: 'center'
              }}
              onClick={() => {
                if (!readOnly) {
                  const newBenefitsState = !p.receivesBenefits
                  store.upsertPhysician(scenario, year, { 
                    ...p, 
                    receivesBenefits: newBenefitsState
                  })
                  // Update tooltip in real-time if it's currently visible
                  const tooltip = document.getElementById('benefits-tooltip-split')
                  if (tooltip) {
                    tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                  }
                }
              }}
              onMouseEnter={(e) => {
                createTooltip('benefits-tooltip-split', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                if (!readOnly) {
                  e.currentTarget.style.opacity = '0.8'
                }
              }}
              onMouseLeave={(e) => {
                removeTooltip('benefits-tooltip-split')
                if (!readOnly) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
              onTouchStart={(e) => createTooltip('benefits-tooltip-split', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
            />
              <div style={{ display: 'grid', gridTemplateRows: '19px 19px 19px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'employee-partner-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                    const { month, day } = dayOfYearToDate(transitionDay, year)
                    const transitionDate = dateToString(month, day)
                    const empPct = Math.round((p.employeePortionOfYear ?? 0.5) * 100)
                    const partnerPct = 100 - empPct
                    let extra = ''
                    if (Math.abs(transitionDay - 183) <= 1) extra = `\n(Mid-year transition)`
                    
                    // Calculate delayed W2 payments
                    const delayedW2 = calculateDelayedW2Payment(p, year)
                    let delayedW2Info = ''
                    if (delayedW2.amount > 0) {
                      delayedW2Info = `\n\nDelayed W2 Payments (prior year work):\nW2 Amount: ${currency(delayedW2.amount)}\nPayroll Taxes: ${currency(delayedW2.taxes)}\nTotal Cost: ${currency(delayedW2.amount + delayedW2.taxes)}\nPeriods: ${delayedW2.periodDetails}`
                    }
                    
                    tooltip.textContent = `Employee → Partner transition:\nTransition date: ${transitionDate}\nEmployee portion: ${empPct}%\nPartner portion: ${partnerPct}%${extra}${delayedW2Info}`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('employee-partner-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'employee-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const employeePortion = getEmployeePortionOfYear(p)
                    const employeePortionSalary = (p.salary ?? 0) * employeePortion
                    const delayedW2 = calculateDelayedW2Payment(p, year)
                    let tooltip_content = getEmployeeCostTooltip(
                      { ...p, salary: employeePortionSalary }, 
                      year, 
                      sc.projection.benefitCostsGrowthPct,
                      delayedW2.amount,
                      delayedW2.taxes,
                      delayedW2.periodDetails
                    )
                    tooltip_content = tooltip_content.replace('Employee Total Cost', `Employee Total Cost (${Math.round(employeePortion * 100)}% of year)`)
                    
                    tooltip.textContent = tooltip_content
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('employee-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                <div></div> {/* Empty space for vacation row */}
              </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        )}
      </div>
    )
  })

  return (
    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f3f4f6' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Physicians</div>
        {(() => {
          const isChanged = arePhysiciansChanged(scenario, year, physicians, store)
          return isChanged && !readOnly ? (
            <button
              onClick={() => {
                removeTooltip('physicians-reset-tooltip')
                // Reset physicians to defaults
                const defaultPhysicians = scenario === 'A' 
                  ? scenarioADefaultsByYear(year) 
                  : scenarioBDefaultsByYear(year)
                
                // Remove all current physicians first
                const currentPhysicians = [...physicians]
                currentPhysicians.forEach(p => {
                  store.removePhysician(scenario, year, p.id)
                })
                
                // Add all default physicians
                defaultPhysicians.forEach(defaultPhysician => {
                  store.upsertPhysician(scenario, year, defaultPhysician)
                })
              }}
              style={{
                position: 'absolute',
                left: 'calc(50% + 43px)', // 50% (center) + half the width of "Physicians" text + small gap
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('physicians-reset-tooltip', 'Reset to Default', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('physicians-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="panel-purple" style={{
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid rgba(126, 34, 206, 0.4)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(126, 34, 206, 0.05), 0 0 10px rgba(126, 34, 206, 0.08), 0 0 6px rgba(126, 34, 206, 0.4)',
        padding: 8
      }}>
        {readOnly ? (
          rows
        ) : (
          <DragDropPhysicians
            physicians={physicians}
            onReorder={handleReorder}
          >
            {rows}
          </DragDropPhysicians>
        )}
        
        {/* Locums costs row - always last row in purple panel */}
        <div
          style={{
            borderTop: '1px solid #d1d5db',
            paddingTop: 10,
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: '20px 120px 150px 1fr 20px 20px 20px',
            gap: 8,
            alignItems: 'center',
            cursor: 'default',
            background: 'transparent'
          }}
        >
          <div></div> {/* Empty space for drag handle column alignment */}
          <div style={{ fontWeight: 500, color: '#6b7280' }}></div>
          <div style={{ 
            fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            color: '#213547',
            textAlign: 'left',
            paddingLeft: 6,
            fontSize: '14px'
          }}>Locums Costs</div>
          <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={240000}
              step={1000}
              value={locumCosts}
              onChange={(e) => onLocumCostsChange(Number(e.target.value))}
              disabled={readOnly}
              style={{ 
                width: '100%',
                ['--fill-percent' as any]: `${(locumCosts / 240000) * 100}%`
              }}
            />
            <input
              type="text"
              value={currency(Math.round(locumCosts))}
              readOnly
              style={{ 
                width: 100, 
                height: 20, 
                padding: '2px 8px', 
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 12
              }}
            />
          </div>
          <div></div> {/* Empty benefits column */}
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
            onMouseEnter={(e) => {
              const existing = document.getElementById('locums-tooltip')
              if (existing) existing.remove()
              const tooltip = document.createElement('div')
              tooltip.id = 'locums-tooltip'
              tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
              tooltip.textContent = '~$2,000 per day'
              document.body.appendChild(tooltip)
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              tooltip.style.left = `${rect.right + 10}px`
              tooltip.style.top = `${rect.top + window.scrollY}px`
            }}
            onMouseLeave={() => { const t = document.getElementById('locums-tooltip'); if (t) t.remove() }}
          >
            <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
          </div>
          <div></div> {/* Empty delete column */}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={() => {
            const nextIndex = fy.physicians.length
            const type: PhysicianType = 'newEmployee'
            store.upsertPhysician(scenario, year, {
              id: `${year}-${nextIndex}`,
              name: `Physician ${nextIndex + 1}`,
              type,
              salary: 500000,
              startPortionOfYear: 0, // Default to starting Jan 1
              weeksVacation: undefined,
              receivesBenefits: true,  // Default new employees to receive benefits
              receivesBonuses: false,  // Default new employees to not receive bonuses
              bonusAmount: 0, // Default bonus amount
            })
          }}
          style={{
            marginTop: 8,
            border: '1px solid #cfd2d6',
            borderRadius: 6,
            padding: '8px 12px',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            cursor: 'pointer',
          }}
        >
          Add physician
        </button>
      )}
    </div>
  )
}
function computeAllCompensationsForYear(year: number, scenario: ScenarioKey) {
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  // Try to find the future year; if not found and year is 2025, build a synthetic year from historic actuals
  let fy = sc.future.find((f) => f.year === year) as FutureYear | undefined
  if (!fy && year === 2025) {
    const last2025 = state.historic.find((h) => h.year === 2025)
    
    // For the multi-year compensation summary, 2025 should always show 2025 actual values
    // regardless of the baseline data mode selection
    if (last2025) {
      fy = {
        year: 2025,
        totalIncome: last2025.totalIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
      }
    }
  }
  // If a 2025 entry exists but the baseline mode is not Custom, override it with the proper baseline
  if (year === 2025) {
    const dataMode = scenario === 'A' ? state.scenarioA.dataMode : state.scenarioB?.dataMode
    if (dataMode !== 'Custom') {
      const last2024 = state.historic.find((h) => h.year === 2024)
      const last2025 = state.historic.find((h) => h.year === 2025)
      fy = dataMode === '2024 Data' && last2024
        ? {
            year: 2025,
            totalIncome: last2024.totalIncome,
            nonEmploymentCosts: last2024.nonEmploymentCosts,
            nonMdEmploymentCosts: 164677.44,
            locumCosts: 113400,
            miscEmploymentCosts: 18182.56,
            physicians: scenario2024Defaults(),
          }
        : last2025
        ? {
            year: 2025,
            totalIncome: last2025.totalIncome,
            nonEmploymentCosts: last2025.nonEmploymentCosts,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          }
        : fy
    }
  }
  if (!fy) return [] as { id: string; name: string; type: PhysicianType; comp: number }[]
  const partners = fy!.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
  const employees = fy!.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')

  const totalEmployeeCosts = employees.reduce((sum, e) => {
    const portion = e.type === 'employeeToPartner' ? getEmployeePortionOfYear(e) : 
                   (e.type === 'employee' ? 1 : 
                   (e.type === 'newEmployee' ? getEmployeePortionOfYear(e) :
                   (e.type === 'employeeToTerminate' ? getEmployeePortionOfYear(e) : 0)))
    if (portion <= 0) return sum
    
    // Calculate full employee cost including benefits and payroll taxes
    if (e.type === 'newEmployee') {
      // For new employees, calculate prorated total cost
      const proratedEmployee = { ...e, salary: (e.salary ?? 0) * portion }
      return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
    } else if (e.type === 'employeeToTerminate') {
      // For terminating employees, calculate prorated total cost
      const proratedEmployee = { ...e, salary: (e.salary ?? 0) * portion }
      return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
    } else if (e.type === 'employeeToPartner') {
      // For mixed types, only count the employee portion of their total cost
      const employeePortionSalary = (e.salary ?? 0) * portion
      const employeePortionPhysician = { ...e, salary: employeePortionSalary }
      return sum + calculateEmployeeTotalCost(employeePortionPhysician, year, sc.projection.benefitCostsGrowthPct)
    } else {
      // For regular employees, calculate full cost
      return sum + calculateEmployeeTotalCost(e, year, sc.projection.benefitCostsGrowthPct)
    }
  }, 0)

  const totalBuyoutCosts = fy!.physicians.reduce((sum, p) => {
    if (p.type === 'partnerToRetire') {
      const weight = getPartnerFTEWeight(p)
      // Only subtract buyout if the partner worked part of the year
      return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
    }
    return sum
  }, 0)

  // Calculate delayed W2 payments for employeeToPartner physicians
  const totalDelayedW2Costs = fy!.physicians.reduce((sum, p) => {
    if (p.type === 'employeeToPartner') {
      const delayed = calculateDelayedW2Payment(p, year)
      return sum + delayed.amount + delayed.taxes
    }
    return sum
  }, 0)

  const pool = year === 2025
    ? (() => {
        // For baseline year, use different partner pools based on data mode
        const dataMode = scenario === 'A' ? state.scenarioA.dataMode : state.scenarioB?.dataMode
        if (dataMode === '2024 Data') {
          // Calculate 2024-based partner pool: Net Income from 2024 was $2,032,099.02 (from image)
          return 2032099.02 - totalBuyoutCosts - totalDelayedW2Costs
        } else {
          // Use 2025 baseline or custom (default behavior)
          // NET_PARTNER_POOL_2025 is already net of all costs, so only subtract buyouts
          return NET_PARTNER_POOL_2025 - totalBuyoutCosts
        }
      })()
    : Math.max(0, fy!.totalIncome - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + fy!.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs))

  const parts = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
  const workingPartners = parts.filter(({ weight }) => weight > 0)
  const totalWeight = workingPartners.reduce((s, x) => s + x.weight, 0) || 1
  const partnerShares = parts.map(({ p, weight }) => ({ 
    id: p.id, 
    name: p.name, 
    type: 'partner' as const, 
    baseShare: weight > 0 ? (weight / totalWeight) * pool : 0, 
    physician: p 
  }))

  // Compose final list per physician (ensure each physician appears once with combined comp if mixed)
  const results: { id: string; name: string; type: PhysicianType; comp: number }[] = []
  // Add partner and mixed (exclude retired partners with no working portion)
  for (const s of partnerShares) {
    // Skip partners who retired in prior year and only got buyout (no working portion)
    if (s.physician.type === 'partnerToRetire' && s.baseShare === 0) {
      continue
    }
    
    let comp = s.baseShare
    if (s.physician.type === 'employeeToPartner') {
      const salaryPortion = (s.physician.salary ?? 0) * getEmployeePortionOfYear(s.physician)
      // Add delayed W2 payments for employeeToPartner physicians
      const delayedW2 = calculateDelayedW2Payment(s.physician, year)
      comp += salaryPortion + delayedW2.amount
    }
    if (s.physician.type === 'partnerToRetire') {
      // Add buyout cost back to retiring partner's total compensation
      comp += s.physician.buyoutCost ?? 0
    }
    results.push({ id: s.id, name: s.name, type: 'partner', comp })
  }
  // Add pure employees (exclude mixed already included)
  for (const e of fy!.physicians.filter((p) => p.type === 'employee' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')) {
    const comp = e.type === 'newEmployee' ? (e.salary ?? 0) * getEmployeePortionOfYear(e) :
                 e.type === 'employeeToTerminate' ? (e.salary ?? 0) * getEmployeePortionOfYear(e) :
                 (e.salary ?? 0)
    results.push({ id: e.id, name: e.name, type: 'employee', comp })
  }
  return results
}

function ProjectionSettingsControls({ scenario }: { scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  const isMobile = useIsMobile()
  
  if (!sc) return null

  // Default values for reset functionality
  const defaultValues = {
    incomeGrowthPct: 3.7,
    nonEmploymentCostsPct: 7.8,
    nonMdEmploymentCostsPct: 6.0,
    locumsCosts: 120000,
    miscEmploymentCostsPct: 6.7,
    benefitCostsGrowthPct: 5.0
  }

  // Helper function to create a slider with number input and reset button
  const createSlider = (
    label: string,
    field: keyof Projection,
    value: number,
    min: number,
    max: number,
    step: number,
    suffix: string = '%',
    isDollar: boolean = false,
    glowType: 'income' | 'cost' = 'cost',
    resetTooltip: string = 'Reset to 2016-2024 Trend'
  ) => {
    const defaultValue = defaultValues[field]
    const isChanged = Math.abs(value - defaultValue) > 0.001 // Account for floating point precision
    
    return (
    <div className={glowType === 'income' ? 'panel-green' : 'panel-red'} style={{ 
      padding: 8,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      border: glowType === 'income' 
        ? '1px solid rgba(16, 185, 129, 0.4)' 
        : '1px solid rgba(239, 68, 68, 0.4)',
      boxShadow: glowType === 'income'
        ? '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)'
        : '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>
        {isChanged && (
          <button
            onClick={() => {
              store.setProjectionField(scenario, field, defaultValues[field])
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#6b7280',
              padding: '2px 4px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.opacity = '1'
              createTooltip('reset-tooltip', resetTooltip, e)
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.opacity = '0.7'
              removeTooltip('reset-tooltip')
            }}
          >
            ↺
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 32 }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              store.setProjectionField(scenario, field, Number(e.target.value))
            }}
            style={{ 
              width: '100%', margin: 0,
              ['--fill-start' as any]: value >= 0 ? `${((0 - min) / (max - min)) * 100}%` : `${((value - min) / (max - min)) * 100}%`,
              ['--fill-end' as any]: value >= 0 ? `${((value - min) / (max - min)) * 100}%` : `${((0 - min) / (max - min)) * 100}%`,
            }}
            className="growth-slider"
          />
          {suffix === '%' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${((0 - min) / (max - min)) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '8px',
              backgroundColor: '#374151',
              pointerEvents: 'none'
            }} />
          )}
        </div>
        {isDollar ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 100 : 120, height: 23 }}>
            <input
              type="text"
              value={currency(value)}
              onChange={(e) => {
                // Parse currency input - remove $ and commas
                const numericValue = e.target.value.replace(/[$,]/g, '')
                const parsed = Number(numericValue)
                if (!isNaN(parsed) && parsed >= min && parsed <= max) {
                  store.setProjectionField(scenario, field, parsed)
                }
              }}
              onBlur={(e) => {
                // Ensure valid value on blur
                const numericValue = e.target.value.replace(/[$,]/g, '')
                const parsed = Number(numericValue)
                if (isNaN(parsed) || parsed < min || parsed > max) {
                  store.setProjectionField(scenario, field, Math.max(min, Math.min(max, parsed || 0)))
                }
              }}
              style={{ 
                width: '100%', 
                height: 23, 
                padding: '2px 18px 2px 4px', 
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 14 
              }}
              readOnly={true}
            />
            <div style={{ 
              position: 'absolute', 
              right: 1, 
              top: 1, 
              display: 'flex', 
              flexDirection: 'column',
              height: 21
            }}>
              <button
                onClick={() => {
                  const increment = step >= 1 ? step : 1000
                  const newValue = Math.min(max, value + increment)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderBottom: 'none',
                  borderRadius: '2px 2px 0 0',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Increase value"
              >
                ▲
              </button>
              <button
                onClick={() => {
                  const decrement = step >= 1 ? step : 1000
                  const newValue = Math.max(min, value - decrement)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderRadius: '0 0 2px 2px',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Decrease value"
              >
                ▼
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 60 : 70, height: 23 }}>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => {
                store.setProjectionField(scenario, field, Number(e.target.value))
              }}
              style={{ 
                width: '100%', 
                height: 23, 
                padding: '2px 18px 2px 4px', 
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 14 
              }}
              readOnly={true}
            />
            <div style={{ 
              position: 'absolute', 
              right: 1, 
              top: 1, 
              display: 'flex', 
              flexDirection: 'column',
              height: 21
            }}>
              <button
                onClick={() => {
                  const newValue = Math.min(max, value + step)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderBottom: 'none',
                  borderRadius: '2px 2px 0 0',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Increase value"
              >
                ▲
              </button>
              <button
                onClick={() => {
                  const newValue = Math.max(min, value - step)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderRadius: '0 0 2px 2px',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Decrease value"
              >
                ▼
              </button>
            </div>
          </div>
        )}
        <span style={{ fontSize: 14, color: '#666', minWidth: isDollar ? 0 : 12 }}>
          {isDollar ? '' : suffix}
        </span>
      </div>
    </div>
    )
  }
  
  return (
    <div style={{ marginBottom: 12, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Projection Settings</div>
        <button
          onClick={() => {
            Object.keys(defaultValues).forEach((field) => {
              store.setProjectionField(scenario, field as keyof Projection, defaultValues[field as keyof typeof defaultValues])
            })
          }}
          style={{
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            color: '#6b7280',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            opacity: 0.8,
            transition: 'opacity 0.2s, background-color 0.2s'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.backgroundColor = '#f3f4f6'
            createTooltip('reset-all-tooltip', 'Reset All to 2016-2024 Trend', e)
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.opacity = '0.8'
            e.currentTarget.style.backgroundColor = '#ffffff'
            removeTooltip('reset-all-tooltip')
          }}
        >
          ↺ Reset All
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
        {createSlider('Total Income Growth', 'incomeGrowthPct', sc.projection.incomeGrowthPct ?? 3.7, -10, 20, 0.1, '%', false, 'income')}
        {createSlider('Non-Employment Costs Growth', 'nonEmploymentCostsPct', sc.projection.nonEmploymentCostsPct ?? 7.8, -10, 20, 0.1, '%', false, 'cost')}
        {createSlider('Staff Employment Costs Growth', 'nonMdEmploymentCostsPct', sc.projection.nonMdEmploymentCostsPct ?? 6.0, -10, 20, 0.1, '%', false, 'cost', 'Reset to Default')}
        {createSlider('Benefit Costs Growth', 'benefitCostsGrowthPct', sc.projection.benefitCostsGrowthPct ?? 5.0, -10, 20, 0.1, '%', false, 'cost', 'Reset to Default')}
        {createSlider('Misc Employment Costs Growth', 'miscEmploymentCostsPct', sc.projection.miscEmploymentCostsPct ?? 6.7, -10, 20, 0.1, '%', false, 'cost')}
        {createSlider('Locums Costs (Annual Override)', 'locumsCosts', sc.projection.locumsCosts ?? 120000, 0, 500000, 1000, '', true, 'cost', 'Reset to Default')}
      </div>
    </div>
  )
}

function HistoricAndProjectionChart() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const historicYears = store.historic.map((h) => h.year)
  const incomeHistoric = store.historic.map((h) => h.totalIncome)
  const costHistoric = store.historic.map((h) => h.nonEmploymentCosts)
  const netHistoric = store.historic.map((h) => h.totalIncome - h.nonEmploymentCosts - (h.employeePayroll ?? 0))
  const employmentHistoric = store.historic.map((h) => h.employeePayroll ?? 0)

  // Helper function to get 2025 baseline values for each scenario based on their dataMode
  const getScenarioBaseline = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const dataMode = sc.dataMode
    const last2024 = store.historic.find((h) => h.year === 2024)
    const last2025 = store.historic.find((h) => h.year === 2025)
    
    if (dataMode === 'Custom') {
      // For Custom mode, use the existing baseline data from year 2025 in future array
      const customBaseline = sc.future.find(f => f.year === 2025)
      if (customBaseline) {
        return {
          totalIncome: customBaseline.totalIncome,
          nonEmploymentCosts: customBaseline.nonEmploymentCosts,
          employeePayroll: customBaseline.nonMdEmploymentCosts + customBaseline.miscEmploymentCosts
        }
      }
    } else if (dataMode === '2024 Data' && last2024) {
      return {
        totalIncome: last2024.totalIncome,
        nonEmploymentCosts: last2024.nonEmploymentCosts,
        employeePayroll: last2024.employeePayroll ?? (164677.44 + 24623.49) // 2024 actual values
      }
    } else if (dataMode === '2025 Data' && last2025) {
      return {
        totalIncome: last2025.totalIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        employeePayroll: last2025.employeePayroll ?? (computeDefaultNonMdEmploymentCosts(2025) + DEFAULT_MISC_EMPLOYMENT_COSTS)
      }
    }
    
    // Fallback to 2025 defaults - use actual 2025 historic data if available
    return {
      totalIncome: last2025?.totalIncome || 2700000,
      nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
      employeePayroll: last2025?.employeePayroll ?? (computeDefaultNonMdEmploymentCosts(2025) + DEFAULT_MISC_EMPLOYMENT_COSTS)
    }
  }

  const baselineA = getScenarioBaseline('A')
  const baselineB = store.scenarioBEnabled && store.scenarioB ? getScenarioBaseline('B') : null

  // Marker fill: make 2025 points solid white to match plot background
  const plotBackgroundColor = '#ffffff'
  const markerColorsFor2025 = (seriesColor: string) =>
    historicYears.map(y => (y === 2025 ? plotBackgroundColor : seriesColor))

  // Helper function to create intermediate color between white and trace color
  const getIntermediateColor = (traceColor: string, opacity: number = 0.3) => {
    // Convert hex color to RGB, then blend with white
    const hex = traceColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Blend with white background
    const blendedR = Math.round(r * opacity + 255 * (1 - opacity))
    const blendedG = Math.round(g * opacity + 255 * (1 - opacity))
    const blendedB = Math.round(b * opacity + 255 * (1 - opacity))
    
    return `rgb(${blendedR}, ${blendedG}, ${blendedB})`
  }

  // For Scenario B: use intermediate color for all markers, we'll overlay white for 2025 later
  const getScenarioBMarkerColor = (traceColor: string) => getIntermediateColor(traceColor)

  // Calculate max Y value from all data
  const scAIncome = store.scenarioA.future.map(f => f.totalIncome)
  const scACosts = store.scenarioA.future.map(f => f.nonEmploymentCosts)
  const scAEmployment = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    // Add delayed W2 payments for employeeToPartner physicians
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  })
  const scBIncome = store.scenarioB?.future.map(f => f.totalIncome) || []
  const scBCosts = store.scenarioB?.future.map(f => f.nonEmploymentCosts) || []
  const scBEmployment = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    // Add delayed W2 payments for employeeToPartner physicians
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  }) || []
  const scANet = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    const buyouts = f.physicians.reduce((s, p) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return f.totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
  })
  const scBNet = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    const buyouts = f.physicians.reduce((s, p) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return f.totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
  }) || []
  
  const yMax = Math.max(
    ...incomeHistoric,
    ...costHistoric,
    ...netHistoric,
    ...employmentHistoric,
    ...scAIncome,
    ...scACosts,
    ...scAEmployment,
    ...scANet,
    ...scBIncome,
    ...scBCosts,
    ...scBEmployment,
    ...scBNet
  )

  return (
    <div
      style={{
        flex: 1,
        minWidth: isMobile ? undefined : 600,
        maxWidth: 1100,
        margin: '0 auto',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#f9fafb',
        padding: 12,
      }}
    >
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: 4 }}>
      <Plot
        data={(() => {
          const traces: any[] = []
          // Group: Income
          traces.push({ x: historicYears, y: incomeHistoric, type: 'scatter', mode: 'lines+markers', name: 'Total Income', line: { color: '#1976d2', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#1976d2'), line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'income', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineA.totalIncome, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.totalIncome)], type: 'scatter', mode: 'lines+markers', name: 'Income projection A', line: { dash: 'dot', color: '#1976d2', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineB.totalIncome, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.totalIncome)], type: 'scatter', mode: 'lines+markers', name: 'Income projection B', line: { dash: 'dash', color: '#1976d2', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#1976d2'), line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 3 })

          // Group: Non-employment costs
          traces.push({ x: historicYears, y: costHistoric, type: 'scatter', mode: 'lines+markers', name: 'Non-Employment Costs', line: { color: '#e65100', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#e65100'), line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'cost', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineA.nonEmploymentCosts, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines+markers', name: 'Cost projection A', line: { dash: 'dot', color: '#e65100', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineB.nonEmploymentCosts, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines+markers', name: 'Cost projection B', line: { dash: 'dash', color: '#e65100', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#e65100'), line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 3 })

          // Group: Net income
          traces.push({ x: historicYears, y: netHistoric, type: 'scatter', mode: 'lines+markers', name: 'Net Income (Historic)', line: { color: '#2e7d32', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#2e7d32'), line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'net', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scANet[idx])], type: 'scatter', mode: 'lines+markers', name: 'Net projection A', line: { dash: 'dot', color: '#2e7d32', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBNet[idx])], type: 'scatter', mode: 'lines+markers', name: 'Net projection B', line: { dash: 'dash', color: '#2e7d32', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#2e7d32'), line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 3 })

          // Group: Employment
          traces.push({ x: historicYears, y: employmentHistoric, type: 'scatter', mode: 'lines+markers', name: 'Employment Costs (Historic)', line: { color: '#6b7280', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#6b7280'), line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'employment', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineA.employeePayroll, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scAEmployment[idx])], type: 'scatter', mode: 'lines+markers', name: 'Employment projection A', line: { dash: 'dot', color: '#6b7280', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [baselineB.employeePayroll, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBEmployment[idx])], type: 'scatter', mode: 'lines+markers', name: 'Employment projection B', line: { dash: 'dash', color: '#6b7280', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#6b7280'), line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 3 })

          // Overlay 2025 markers on top of dotted projection lines with proper tooltips
          // These are linked to their respective legend groups so they toggle together
          // Now use the same 2025 baseline values for consistency across scenarios
          const historic2025 = store.historic.find(h => h.year === 2025)
          if (historic2025) {
            traces.push({ x: [2025], y: [historic2025.totalIncome], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}<extra></extra>', legendgroup: 'income' })
            traces.push({ x: [2025], y: [historic2025.nonEmploymentCosts], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}<extra></extra>', legendgroup: 'cost' })
            traces.push({ x: [2025], y: [netHistoric[netHistoric.length - 1]], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}<extra></extra>', legendgroup: 'net' })
            traces.push({ x: [2025], y: [historic2025.employeePayroll ?? 0], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}<extra></extra>', legendgroup: 'employment' })
          }

          // Add white overlay markers for Scenario B's 2025 points to make them appear hollow
          if (store.scenarioBEnabled && store.scenarioB && baselineB) {
            traces.push({ x: [2025], y: [baselineB.totalIncome], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'income' })
            traces.push({ x: [2025], y: [baselineB.nonEmploymentCosts], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'cost' })
            traces.push({ x: [2025], y: [NET_PARTNER_POOL_2025], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'net' })
            traces.push({ x: [2025], y: [baselineB.employeePayroll], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'employment' })
          }

          return traces
        })() as any}
        layout={{
          title: { text: 'Historic and Projected Totals', font: { weight: 'bold' } },
          dragmode: false as any,
          legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1, yanchor: 'top', traceorder: 'grouped' },
          margin: { l: 60, r: 20, t: 40, b: 64 },
          yaxis: {
            tickprefix: '$',
            separatethousands: true,
            tickformat: ',.0f',
            rangemode: 'tozero',
            range: [0, Math.ceil((yMax * 1.1) / 10000) * 10000],
            automargin: true,
          },
          xaxis: { dtick: 1 },

        }}
        config={{
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
          scrollZoom: false,
          doubleClick: false as any,
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: isMobile ? 320 : 480 }}
      />
      </div>
    </div>
  )
}

export function Dashboard() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  useEffect(() => {}, [])
  useEffect(() => {
    // Nudge Plotly to recompute sizes when layout width changes
    window.dispatchEvent(new Event('resize'))
  }, [store.scenarioBEnabled])

  // Load from shareable URL hash if present
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.startsWith('#s=')) {
      try {
        const encoded = hash.slice(3)
        const json = decodeURIComponent(atob(encoded))
        const snap = JSON.parse(json)
        useDashboardStore.getState().loadSnapshot(snap)
      } catch {
        // ignore malformed
      }
    }
  }, [])

  const copyShareLink = async () => {
    const snap = {
      scenarioA: store.scenarioA,
      scenarioBEnabled: store.scenarioBEnabled,
      scenarioB: store.scenarioBEnabled ? store.scenarioB : undefined,
    }
    const json = JSON.stringify(snap)
    const encoded = btoa(encodeURIComponent(json))
    const url = `${window.location.origin}${window.location.pathname}#s=${encoded}`
    try {
      await navigator.clipboard.writeText(url)
      alert('Shareable link copied to clipboard')
    } catch {
      // fallback: set location hash
      window.location.hash = `s=${encoded}`
    }
  }

  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16, maxWidth: store.scenarioBEnabled ? 1610 : 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: isMobile ? '8px 0' : '0 0 4px', justifyContent: 'center' }}>
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
        <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', marginBottom: 8, gap: 8 }}>
        <button onClick={() => { store.resetToDefaults(); window.location.hash = '' }} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Reset to defaults</button>
        <button onClick={copyShareLink} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Copy shareable link</button>
      </div>
      <HistoricAndProjectionChart key={store.scenarioBEnabled ? 'withB' : 'withoutB'} />

      {/* Scenario compare */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={store.scenarioBEnabled}
                onChange={(e) => store.setScenarioEnabled(e.target.checked)}
              />
              <span>Enable Scenario B</span>
            </label>
          </div>
        </div>

        <div className="scenario-grid" style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: isMobile ? 8 : 12,
          marginTop: 0,
          display: 'grid',
          gridTemplateColumns: store.scenarioBEnabled && !isMobile ? '1fr 1fr' : '1fr',
          alignItems: 'start',
          gap: 12,
          background: '#f9fafb',
        }}>
          {/* Scenario A column */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario A</div>
            <ProjectionSettingsControls scenario={'A'} />
            <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {[2025, ...store.scenarioA.future.filter((f) => f.year !== 2025).map((f) => f.year)].map((yr) => (
                <button
                  key={`A-${yr}`}
                  onClick={() => store.setSelectedYear('A', yr)}
                  style={{
                    padding: isMobile ? '6px 10px' : '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                    background: store.scenarioA.selectedYear === yr ? '#f0f4ff' : 'white',
                    fontWeight: store.scenarioA.selectedYear === yr ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {yr === 2025 ? 'Baseline' : yr}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <YearPanel year={store.scenarioA.selectedYear} scenario={'A'} />
            </div>
          </div>

          {/* Scenario B column */}
          {store.scenarioBEnabled && store.scenarioB && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario B</div>
              <ProjectionSettingsControls scenario={'B'} />
              <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
                {[2025, ...store.scenarioB.future.filter((f) => f.year !== 2025).map((f) => f.year)].map((yr) => (
                <button
                    key={`B-${yr}`}
                    onClick={() => store.setSelectedYear('B', yr)}
                    style={{
                    padding: isMobile ? '6px 10px' : '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: store.scenarioB?.selectedYear === yr ? '#f0f4ff' : 'white',
                      fontWeight: store.scenarioB?.selectedYear === yr ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {yr === 2025 ? 'Baseline' : yr}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <YearPanel year={store.scenarioB.selectedYear} scenario={'B'} />
              </div>
            </div>
          )}
        </div>
      </div>
      <OverallCompensationSummary />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <ParametersSummary />
      </div>
    </div>
  )
}
function OverallCompensationSummary() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const years = Array.from(new Set([2025, ...store.scenarioA.future.map((f) => f.year)]))
  const perYearA = years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') }))
  const perYearB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'B') }))
    : undefined
  // const totalPerYear = perYear.map(({ year, comps }) => ({ year, total: comps.reduce((s, c) => s + c.comp, 0) }))

  // For the "Per Physician By Year" table, we want to include retired partners
  // Create a modified version that includes all partners
  const computeAllCompensationsForYearWithRetired = (year: number, scenario: ScenarioKey) => {
    const regularComps = computeAllCompensationsForYear(year, scenario)
    const state = useDashboardStore.getState()
    const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
    let fy = sc.future.find((f) => f.year === year) as FutureYear | undefined
    if (!fy && year === 2025) {
      const last2025 = state.historic.find((h) => h.year === 2025)
      
      // For the multi-year compensation summary, 2025 should always show 2025 actual values
      // regardless of the baseline data mode selection
      if (last2025) {
        fy = {
          year: 2025,
          totalIncome: last2025.totalIncome,
          nonEmploymentCosts: last2025.nonEmploymentCosts,
          nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
          locumCosts: 54600,
          miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
          physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
        }
      }
    }
    if (!fy) return regularComps
    
    // Add any retired partners that were excluded
    const retiredPartners = fy.physicians.filter(p => p.type === 'partnerToRetire' && getPartnerFTEWeight(p) === 0)
    const retiredComps = retiredPartners.map(p => ({
      id: p.id,
      name: p.name,
      type: 'partner' as const,
      comp: p.buyoutCost ?? 0 // Show buyout amount as their compensation
    }))
    
    return [...regularComps, ...retiredComps]
  }
  
  const perYearAWithRetired = years.map((y) => ({ year: y, comps: computeAllCompensationsForYearWithRetired(y, 'A') }))
  const perYearBWithRetired = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ year: y, comps: computeAllCompensationsForYearWithRetired(y, 'B') }))
    : undefined

  // Collect all physician names from both scenarios (including retired)
  const allNamesFromA = perYearAWithRetired.flatMap((y) => y.comps.map((c) => c.name))
  const allNamesFromB = perYearBWithRetired ? perYearBWithRetired.flatMap((y) => y.comps.map((c) => c.name)) : []
  const allNames = Array.from(new Set([...allNamesFromA, ...allNamesFromB]))
  // Assign a consistent color per person for both scenarios
  const colorPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  const colorByName: Record<string, string> = {}
  allNames.forEach((n, i) => { colorByName[n] = colorPalette[i % colorPalette.length] })
  const seriesA = allNames.map((name) => ({
    name,
    values: years.map((y) => {
      const found = perYearAWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
      return found ? found.comp : 0
    }),
  }))
  const seriesB = perYearBWithRetired
    ? allNames.map((name) => ({
        name,
        values: years.map((y) => {
          const found = perYearBWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
          return found ? found.comp : 0
        }),
      }))
    : []

  // Calculate locums data for both scenarios
  const locumsSeriesA = years.map((y) => {
    const fy = y === 2025 
      ? { locumCosts: 54600 } // 2025 default
      : store.scenarioA.future.find(f => f.year === y)
    return fy?.locumCosts ?? 0
  })
  const locumsSeriesB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        const fy = y === 2025 
          ? { locumCosts: 54600 } // 2025 default
          : store.scenarioB!.future.find(f => f.year === y)
        return fy?.locumCosts ?? 0
      })
    : []

  const [highlight, setHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const [isolated, setIsolated] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  
  // Separate state for scenario table highlighting/isolation
  const [scenarioHighlight, setScenarioHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const [scenarioIsolated, setScenarioIsolated] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  
  const isHighlighted = (scenario: 'A' | 'B', name: string) => {
    // Check isolation from either table (physician table or scenario table)
    if (isolated || scenarioIsolated) {
      const activeIsolated = isolated || scenarioIsolated
      // For physician table isolation: when both scenarios are enabled, highlight both A and B for the same physician
      if (isolated && store.scenarioBEnabled) {
        return isolated.name === name
      }
      // For scenario table isolation or single scenario: exact match only
      return activeIsolated!.scenario === scenario && activeIsolated!.name === name
    }
    
    // Check highlighting from either table (physician table or scenario table)
    if (highlight || scenarioHighlight) {
      const activeHighlight = highlight || scenarioHighlight
      // For physician table highlighting: when both scenarios are enabled, highlight both A and B for the same physician  
      if (highlight && store.scenarioBEnabled) {
        return highlight.name === name
      }
      // For scenario table highlighting or single scenario: exact match only
      return activeHighlight!.scenario === scenario && activeHighlight!.name === name
    }
    return true
  }

  const isIsolated = (scenario: 'A' | 'B', name: string) => {
    const activeIsolated = isolated || scenarioIsolated
    if (!activeIsolated) return false
    
    // For physician table isolation: when both scenarios are enabled, isolate both A and B for the same physician
    if (isolated && store.scenarioBEnabled) {
      return isolated.name === name
    }
    // For scenario table isolation or single scenario: exact match only
    return activeIsolated.scenario === scenario && activeIsolated.name === name
  }

  const isRowHighlighted = (scenario: 'A' | 'B', name: string) => {
    // If something is isolated (from either table), show blue background for the isolated rows
    if (isolated || scenarioIsolated) {
      return isIsolated(scenario, name)
    }
    // If hovering (and nothing isolated), show blue background for the highlighted rows
    if (highlight || scenarioHighlight) {
      return isHighlighted(scenario, name)
    }
    return false
  }

  const handleRowClick = (scenario: 'A' | 'B', name: string) => {
    // When both scenarios are enabled, check if the physician name is already isolated
    const isPhysicianIsolated = isolated?.name === name
    
    if (isPhysicianIsolated) {
      // Clicking any row for the already isolated physician - clear all isolation
      clearAllIsolation()
    } else {
      // Clear any scenario table isolation first, then isolate this physician
      clearAllIsolation()
      setIsolated({ scenario, name })
    }
  }

  const handleScenarioRowClick = (scenario: 'A' | 'B', name: string) => {
    // Check if this row is already isolated in scenario table
    const isRowIsolated = scenarioIsolated?.scenario === scenario && scenarioIsolated?.name === name
    
    if (isRowIsolated) {
      // Clicking the already isolated row - clear all isolation
      clearAllIsolation()
    } else {
      // Isolate this specific scenario row (only one at a time)
      clearAllIsolation() // Clear any existing isolation first
      setScenarioIsolated({ scenario, name })
    }
  }

  const clearAllIsolation = () => {
    setIsolated(null)
    setScenarioIsolated(null)
    setHighlight(null)
    setScenarioHighlight(null)
  }
  
  const clearIsolation = () => {
    setIsolated(null)
    setHighlight(null) // Also clear any hover highlight to ensure clean state
  }

  // Cross-table highlighting functions
  const handleScenarioRowHover = (scenario: 'A' | 'B', name: string) => {
    if (!isolated && !scenarioIsolated) {
      setScenarioHighlight({ scenario, name })
    }
  }
  
  const handleScenarioRowLeave = () => {
    if (!isolated && !scenarioIsolated) {
      setScenarioHighlight(null)
    }
  }



  // const totalsByPhysician = allNames.map((name) => ({
  //   name,
  //   total: years.reduce((s, _y, idx) => s + series.find((s2) => s2.name === name)!.values[idx], 0),
  // }))

  return (
    <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
      <h3 style={{ margin: '12px 0' }}>Multi-Year Compensation Summary (2025–2030)</h3>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: 4, position: 'relative' }}>
        <Plot
          key={`plot-${isolated?.scenario}-${isolated?.name}-${highlight?.scenario}-${highlight?.name}-${scenarioIsolated?.scenario}-${scenarioIsolated?.name}-${scenarioHighlight?.scenario}-${scenarioHighlight?.name}`}
          data={(() => {
            const rows: any[] = []
            for (const name of allNames) {
              const a = seriesA.find((s) => s.name === name)!
              rows.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: store.scenarioBEnabled ? `${name} (A)` : name,
                x: years,
                y: a.values,
                line: { color: colorByName[name], width: isHighlighted('A', name) ? 3 : 1.2 },
                opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('A', name) ? 1 : 0.2) : 1,
                legendgroup: name, // Group by physician name
                legendrank: 1, // A scenario appears first in each group
              })
              if (store.scenarioBEnabled) {
                const b = seriesB.find((s) => s.name === name)!
                rows.push({
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: `${name} (B)`,
                  x: years,
                  y: b.values,
                  line: { color: colorByName[name], dash: 'dot', width: isHighlighted('B', name) ? 3 : 1.2 },
                  opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('B', name) ? 1 : 0.2) : 1,
                  legendgroup: name, // Same group as the A scenario
                  legendrank: 2, // B scenario appears second in each group
                })
              }
            }
            
            // Add Locums traces
            rows.push({
              type: 'scatter',
              mode: 'lines+markers',
              name: store.scenarioBEnabled ? 'Locums (A)' : 'Locums',
              x: years,
              y: locumsSeriesA,
              line: { color: '#888888', width: isHighlighted('A', 'Locums') ? 3 : 1.2 },
              opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('A', 'Locums') ? 1 : 0.2) : 1,
              legendgroup: 'Locums', // Group by itself
              legendrank: 999, // Put at end
              hovertemplate: store.scenarioBEnabled ? 'A: %{y:$,.0f}<extra></extra>' : '%{y:$,.0f}',
              hoverlabel: { bgcolor: '#888888', font: { color: 'white' } },
            })
            if (store.scenarioBEnabled) {
              rows.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Locums (B)',
                x: years,
                y: locumsSeriesB,
                line: { color: '#888888', dash: 'dot', width: isHighlighted('B', 'Locums') ? 3 : 1.2 },
                opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('B', 'Locums') ? 1 : 0.2) : 1,
                legendgroup: 'Locums', // Same group as A scenario
                legendrank: 1000, // Put at end after A
                hovertemplate: 'B: %{y:$,.0f}<extra></extra>',
                hoverlabel: { bgcolor: '#888888', font: { color: 'white' } },
              })
            }
            
            return rows
          })() as any}
          layout={{
            title: { text: 'Compensation per Physician (By Year)', font: { size: 14 } },
            margin: { l: 80, r: 8, t: 28, b: 60 },
            yaxis: { tickprefix: '$', separatethousands: true, tickformat: ',.0f' },
            xaxis: { dtick: 1 },
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.05, yanchor: 'top', traceorder: 'grouped' },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler={true}
          style={{ width: '100%', height: isMobile ? 360 : 420 }}
        />
        {/* Reset button for clearing isolation */}
        {(isolated || scenarioIsolated) && (
          <button
            onClick={clearAllIsolation}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 1000,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.9)'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.7)'}
            title="Clear isolation"
          >
            ↻ Reset
          </button>
        )}
        </div>
      </div>


      <div style={{ marginTop: 8, overflowX: isMobile ? 'auto' : 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Per Physician By Year</div>
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 2, fontWeight: 600 }}>
          <div>Name</div>
          {years.map((y) => (
            <div key={y} style={{ textAlign: 'right' }}>{y}</div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>
        {allNames.map((name, idx) => (
          <div key={name} style={{ display: 'contents' }}>
            <div
              className="table-row-hover"
              style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('A', name) ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? '#f9fafb' : 'transparent') }}
              onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'A', name })}
              onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
              onClick={() => handleRowClick('A', name)}
            >
              <div>{store.scenarioBEnabled ? `${name} (Scenario A)` : name}</div>
              {years.map((y, idx) => (
                <div key={`A-${name}-${y}`} style={{ textAlign: 'right' }}>
                  {currency(seriesA.find((s) => s.name === name)!.values[idx])}
                </div>
              ))}
              <div style={{ textAlign: 'right' }}>
                {currency(
                  seriesA
                    .find((s) => s.name === name)!
                    .values.reduce((a, b) => a + b, 0)
                )}
              </div>
            </div>
            {store.scenarioBEnabled && (
              <div
                className="table-row-hover"
                style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('B', name) ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? '#f9fafb' : 'transparent') }}
                onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'B', name })}
                onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
                onClick={() => handleRowClick('B', name)}
              >
                <div>{`${name} (Scenario B)`}</div>
                {years.map((y, idx) => (
                  <div key={`B-${name}-${y}`} style={{ textAlign: 'right' }}>
                    {currency((seriesB.find((s) => s.name === name)?.values[idx]) ?? 0)}
                  </div>
                ))}
                <div style={{ textAlign: 'right' }}>
                  {currency(
                    (seriesB.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0)) ?? 0
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Locums rows */}
        <div className="table-row-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '2px solid #e5e7eb', background: isRowHighlighted('A', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f8f9fa', fontSize: '14px', color: '#6b7280' }}
        onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'A', name: 'Locums' })}
        onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
        onClick={() => handleRowClick('A', 'Locums')}>
          <div style={{ paddingLeft: '8px' }}>{store.scenarioBEnabled ? 'Locums (Scenario A)' : 'Locums'}</div>
          {years.map((y, i) => {
            const fy = y === 2025 
              ? { locumCosts: 54600 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = fy?.locumCosts ?? 0
            return <div key={`LA-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = y === 2025 
                ? { locumCosts: 54600 } // 2025 default
                : store.scenarioA.future.find(f => f.year === y)
              return total + (fy?.locumCosts ?? 0)
            }, 0))}
          </div>
        </div>
        {store.scenarioBEnabled && store.scenarioB && (
          <div className="table-row-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #e5e7eb', background: isRowHighlighted('B', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f8f9fa', fontSize: '14px', color: '#6b7280' }}
          onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'B', name: 'Locums' })}
          onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
          onClick={() => handleRowClick('B', 'Locums')}>
            <div style={{ paddingLeft: '8px' }}>Locums (Scenario B)</div>
            {years.map((y, i) => {
              const fy = y === 2025 
                ? { locumCosts: 54600 } // 2025 default
                : store.scenarioB!.future.find(f => f.year === y)
              const locumCost = fy?.locumCosts ?? 0
              return <div key={`LB-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumCosts: 54600 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                return total + (fy?.locumCosts ?? 0)
              }, 0))}
            </div>
          </div>
        )}

        {/* Scenario A Total row */}
        <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '2px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>{store.scenarioBEnabled ? 'Scenario A (Net Income for MDs)' : 'Net Income for MDs'}</div>
          {years.map((y) => {
            const totalComp = perYearAWithRetired.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = y === 2025 
              ? { locumCosts: 54600 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = fy?.locumCosts ?? 0
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearAWithRetired.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumCosts: 54600 } // 2025 default
                  : store.scenarioA.future.find(f => f.year === y)
                return total + (fy?.locumCosts ?? 0)
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B Total row */}
        {store.scenarioBEnabled && store.scenarioB && perYearBWithRetired && (
          <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
            <div>Scenario B (Total)</div>
            {years.map((y) => {
              const totalComp = perYearBWithRetired.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
              const fy = y === 2025 
                ? { locumCosts: 54600 } // 2025 default
                : store.scenarioB!.future.find(f => f.year === y)
              const locumCost = fy?.locumCosts ?? 0
              return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(
                perYearBWithRetired.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                years.reduce((total, y) => {
                  const fy = y === 2025 
                    ? { locumCosts: 54600 } // 2025 default
                    : store.scenarioB!.future.find(f => f.year === y)
                  return total + (fy?.locumCosts ?? 0)
                }, 0)
              )}
            </div>
          </div>
        )}
      </div>

      {/* Per Scenario by Year table - only show when Scenario B is enabled */}
      {store.scenarioBEnabled && (
        <div style={{ marginTop: 16, overflowX: isMobile ? 'auto' : 'visible' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Per Scenario by Year</div>
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 2, fontWeight: 600 }}>
          <div>Scenario</div>
          {years.map((y) => (
            <div key={y} style={{ textAlign: 'right' }}>{y}</div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>

        {/* Scenario A - Individual physicians */}
        {allNames.map((name, idx) => (
          <div key={`SA-${name}`} className="table-row-hover" 
            style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '1px solid #f0f0f0' : '1px solid #f8f8f8', background: isRowHighlighted('A', name) ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb' }}
            onMouseEnter={() => handleScenarioRowHover('A', name)}
            onMouseLeave={handleScenarioRowLeave}
            onClick={() => handleScenarioRowClick('A', name)}>
            <div style={{ paddingLeft: '8px' }}>{name} (A)</div>
            {years.map((y) => {
              const found = perYearAWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
              return <div key={`SA-${name}-${y}`} style={{ textAlign: 'right' }}>{currency(found ? found.comp : 0)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(
                seriesA.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0) ?? 0
              )}
            </div>
          </div>
        ))}

        {/* Scenario A - Locums */}
        <div className="table-row-hover" 
          style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('A', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb', fontSize: '14px', color: '#6b7280' }}
          onMouseEnter={() => handleScenarioRowHover('A', 'Locums')}
          onMouseLeave={handleScenarioRowLeave}
          onClick={() => handleScenarioRowClick('A', 'Locums')}>
          <div style={{ paddingLeft: '16px' }}>Locums (A)</div>
          {years.map((y, i) => {
            const fy = y === 2025 
              ? { locumCosts: 54600 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = fy?.locumCosts ?? 0
            return <div key={`SAL-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = y === 2025 
                ? { locumCosts: 54600 } // 2025 default
                : store.scenarioA.future.find(f => f.year === y)
              return total + (fy?.locumCosts ?? 0)
            }, 0))}
          </div>
        </div>

        {/* Scenario A - Total including locums */}
        <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>Scenario A (Total)</div>
          {years.map((y) => {
            const totalComp = perYearA.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = y === 2025 
              ? { locumCosts: 54600 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = fy?.locumCosts ?? 0
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearA.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumCosts: 54600 } // 2025 default
                  : store.scenarioA.future.find(f => f.year === y)
                return total + (fy?.locumCosts ?? 0)
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B rows - only if enabled */}
        {store.scenarioBEnabled && store.scenarioB && perYearB && (
          <>
            {/* Scenario B - Individual physicians */}
            {allNames.map((name, idx) => (
              <div key={`SB-${name}`} className="table-row-hover" 
                style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '2px solid #e5e7eb' : '1px solid #f8f8f8', background: isRowHighlighted('B', name) ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7' }}
                onMouseEnter={() => handleScenarioRowHover('B', name)}
                onMouseLeave={handleScenarioRowLeave}
                onClick={() => handleScenarioRowClick('B', name)}>
                <div style={{ paddingLeft: '8px' }}>{name} (B)</div>
                {years.map((y) => {
                  const found = perYearBWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
                  return <div key={`SB-${name}-${y}`} style={{ textAlign: 'right' }}>{currency(found ? found.comp : 0)}</div>
                })}
                <div style={{ textAlign: 'right' }}>
                  {currency(
                    seriesB.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0) ?? 0
                  )}
                </div>
              </div>
            ))}

            {/* Scenario B - Locums */}
            <div className="table-row-hover" 
              style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('B', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7', fontSize: '14px', color: '#6b7280' }}
              onMouseEnter={() => handleScenarioRowHover('B', 'Locums')}
              onMouseLeave={handleScenarioRowLeave}
              onClick={() => handleScenarioRowClick('B', 'Locums')}>
              <div style={{ paddingLeft: '16px' }}>Locums (B)</div>
              {years.map((y, i) => {
                const fy = y === 2025 
                  ? { locumCosts: 54600 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                const locumCost = fy?.locumCosts ?? 0
                return <div key={`SBL-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(years.reduce((total, y) => {
                  const fy = y === 2025 
                    ? { locumCosts: 54600 } // 2025 default
                    : store.scenarioB!.future.find(f => f.year === y)
                  return total + (fy?.locumCosts ?? 0)
                }, 0))}
              </div>
            </div>

            {/* Scenario B - Total including locums */}
            <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
              <div>Scenario B (Net Income for MDs)</div>
              {years.map((y) => {
                const totalComp = perYearB.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
                const fy = y === 2025 
                  ? { locumCosts: 54600 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                const locumCost = fy?.locumCosts ?? 0
                return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(
                  perYearB.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                  years.reduce((total, y) => {
                    const fy = y === 2025 
                      ? { locumCosts: 54600 } // 2025 default
                      : store.scenarioB!.future.find(f => f.year === y)
                    return total + (fy?.locumCosts ?? 0)
                  }, 0)
                )}
              </div>
            </div>
          </>
        )}
        </div>
      )}
    </div>
  )
}



function ParametersSummary() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()

  // Helper function to detect if values have been manually overridden
  const detectCustomOverrides = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
    
    // Get baseline data (same logic as applyProjectionFromLastActual)
    let baselineData
    const last2024 = store.historic.find((h) => h.year === 2024)
    const last2025 = store.historic.find((h) => h.year === 2025)
    
    if (dataMode === '2024 Data' && last2024) {
      baselineData = {
        totalIncome: last2024.totalIncome,
        nonEmploymentCosts: last2024.nonEmploymentCosts,
        miscEmploymentCosts: 24623.49,
        nonMdEmploymentCosts: 164677.44,
      }
    } else if (last2025) {
      baselineData = {
        totalIncome: last2025.totalIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    } else {
      baselineData = {
        totalIncome: 3344068.19,
        nonEmploymentCosts: 229713.57,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }

    const overrides = {
      incomeGrowthPct: false,
      nonEmploymentCostsPct: false,
      nonMdEmploymentCostsPct: false,
      miscEmploymentCostsPct: false,
    }

    // Convert percentage growth rates to decimal multipliers
    const incomeGpct = sc.projection.incomeGrowthPct / 100
    const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
    const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
    const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100

    // Starting values from the selected baseline
    let expectedIncome = baselineData.totalIncome
    let expectedNonEmploymentCosts = baselineData.nonEmploymentCosts
    let expectedNonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
    let expectedMiscEmploymentCosts = baselineData.miscEmploymentCosts

    // Check each future year for deviations from expected values
    for (const fy of sc.future) {
      if (fy.year === 2025) continue // Skip baseline year
      
      // Calculate expected values for this year
      expectedIncome = expectedIncome * (1 + incomeGpct)
      expectedNonEmploymentCosts = expectedNonEmploymentCosts * (1 + nonEmploymentGpct)
      expectedNonMdEmploymentCosts = expectedNonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
      expectedMiscEmploymentCosts = expectedMiscEmploymentCosts * (1 + miscEmploymentGpct)

      // Compare with actual values (with 1% tolerance for floating point differences)
      const tolerance = 0.01
      if (Math.abs(fy.totalIncome - expectedIncome) / expectedIncome > tolerance) {
        overrides.incomeGrowthPct = true
      }
      if (Math.abs(fy.nonEmploymentCosts - expectedNonEmploymentCosts) / expectedNonEmploymentCosts > tolerance) {
        overrides.nonEmploymentCostsPct = true
      }
      if (Math.abs(fy.nonMdEmploymentCosts - expectedNonMdEmploymentCosts) / expectedNonMdEmploymentCosts > tolerance) {
        overrides.nonMdEmploymentCostsPct = true
      }
      if (Math.abs(fy.miscEmploymentCosts - expectedMiscEmploymentCosts) / expectedMiscEmploymentCosts > tolerance) {
        overrides.miscEmploymentCostsPct = true
      }
    }

    return overrides
  }

  const buildYearData = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const historic2025 = store.historic.find((h) => h.year === 2025)!
    const years = Array.from(new Set([2025, ...sc.future.map((f) => f.year)]))
    return years.map((year) => {
      if (year === 2025) {
        return {
          year,
        totalIncome: historic2025.totalIncome,
        nonEmploymentCosts: historic2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
        } as FutureYear
      }
      return sc.future.find((f) => f.year === year) as FutureYear
    })
  }

    const renderScenario = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const data = buildYearData(scenario)
    const overrides = detectCustomOverrides(scenario)
    const maxPhysicians = Math.max(...data.map((d) => d.physicians.length))
    const baselineMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
    const baselineLabel = baselineMode === '2025 Data' ? null : `Baseline (${baselineMode === 'Custom' ? 'Custom' : (baselineMode?.match(/\d{4}/)?.[0] || baselineMode || 'Unknown')})`
    const hasExtraBaselineCol = Boolean(baselineLabel)
    // Narrow columns slightly when we include the extra Baseline column so everything fits without overflow
    const labelColWidth = hasExtraBaselineCol ? 120 : 150
    const yearColWidth = hasExtraBaselineCol ? 120 : 135
    const columnGap = hasExtraBaselineCol ? 3 : 4
    const baselineDataObj = (() => {
      if (!baselineLabel) return null
      if (baselineMode === 'Custom') {
        const custom = sc.future.find((f) => f.year === 2025)
        return custom ? { ...custom, year: 2025 } : null
      }
      if (baselineMode === '2024 Data') {
        const h2024 = store.historic.find((h) => h.year === 2024)
        if (!h2024) return null
        return {
          year: 2024,
          totalIncome: h2024.totalIncome,
          nonEmploymentCosts: h2024.nonEmploymentCosts,
          nonMdEmploymentCosts: 164677.44,
          locumCosts: 113400,
          miscEmploymentCosts: 18182.56,
          physicians: scenario2024Defaults(),
        } as FutureYear
      }
      return null
    })()
    return (
      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb', maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Scenario {scenario} Parameters</div>
          <div style={{ fontSize: 13, color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, padding: 5, background: '#ffffff' }}>
            Growth — Income: {overrides.incomeGrowthPct ? 'Custom' : `${sc.projection.incomeGrowthPct}%`} · Non-Emp: {overrides.nonEmploymentCostsPct ? 'Custom' : `${sc.projection.nonEmploymentCostsPct}%`} · Staff: {overrides.nonMdEmploymentCostsPct ? 'Custom' : `${sc.projection.nonMdEmploymentCostsPct}%`} · Benefits: {sc.projection.benefitCostsGrowthPct}% · Misc: {overrides.miscEmploymentCostsPct ? 'Custom' : `${sc.projection.miscEmploymentCostsPct}%`}
          </div>
        </div>

        <div style={{ marginTop: 6, marginBottom: 12, overflowX: isMobile ? 'auto' : 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Per Year Core Values</div>
          <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' as any }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', fontWeight: 600 }}>
              <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Metric</div>
              {baselineLabel && <div style={{ textAlign: 'left' }}>{baselineLabel}</div>}
              {data.map((d) => (
                <div key={`hdr-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{d.year}</div>
              ))}
            </div>
            {/* Data rows with alternating backgrounds */}
            {[
              { label: 'Income', baseline: baselineDataObj?.totalIncome, values: data.map(d => d.totalIncome), key: 'inc' },
              { label: 'Non-Employment', baseline: baselineDataObj?.nonEmploymentCosts, values: data.map(d => d.nonEmploymentCosts), key: 'nec' },
              { label: 'Staff Employment', baseline: baselineDataObj?.nonMdEmploymentCosts, values: data.map(d => d.nonMdEmploymentCosts), key: 'nmd' },
              { label: 'Misc Employment', baseline: baselineDataObj?.miscEmploymentCosts, values: data.map(d => d.miscEmploymentCosts), key: 'msc' },
              { label: 'Locums', baseline: baselineDataObj?.locumCosts, values: data.map(d => d.locumCosts), key: 'loc' }
            ].map((row, idx) => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', background: idx % 2 === 0 ? '#f9fafb' : 'transparent', alignItems: 'center' }}>
                <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>{row.label}</div>
                {baselineLabel && <div style={{ textAlign: 'left' }}>{row.baseline ? currency(Math.round(row.baseline)) : ''}</div>}
                {row.values.map((value, valueIdx) => (
                  <div key={`${row.key}-${scenario}-${data[valueIdx].year}`} style={{ textAlign: 'left' }}>{currency(Math.round(value))}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8, overflowX: isMobile ? 'auto' : 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Physicians Per Year</div>
          <div style={{ fontSize: 13, alignItems: 'center', fontVariantNumeric: 'tabular-nums' as any }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', fontWeight: 600 }}>
              <div style={{ whiteSpace: 'nowrap' }}>Slot</div>
              {baselineLabel && <div style={{ textAlign: 'left' }}>{baselineLabel}</div>}
              {data.map((d) => (
                <div key={`ph-h-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{d.year}</div>
              ))}
            </div>
            {/* Physician rows with alternating backgrounds */}
            {Array.from({ length: maxPhysicians }).map((_, rowIdx) => (
              <div key={`row-${scenario}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', background: rowIdx % 2 === 0 ? '#f9fafb' : 'transparent', alignItems: 'center' }}>
                <div style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>#{rowIdx + 1}</div>
                {baselineLabel && (
                  <div style={{ textAlign: 'left' }}>
                    {(() => {
                      const p = baselineDataObj?.physicians[rowIdx]
                      if (!p) return ''
                      const role = p.type === 'partner' ? 'P' : p.type === 'employee' ? 'E' : p.type === 'newEmployee' ? 'N' : p.type === 'employeeToTerminate' ? 'T' : p.type === 'employeeToPartner' ? 'M' : 'R'
                      const tokens: string[] = [abbreviatePhysicianName(p.name), role]
                      if (p.type === 'employeeToPartner') {
                        const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(transitionDay, baselineDataObj!.year)
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `→${month}/${day}`
                        const payTime = sal && wk ? `${sal}/${wk}` : sal || wk
                        const detail = payTime ? `${dateLabel} ${payTime}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'partnerToRetire') {
                        const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, baselineDataObj!.year)
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        const buyout = typeof p.buyoutCost === 'number' ? currencyShort(p.buyoutCost).toUpperCase() : ''
                        if (retirementDay === 0) {
                          const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                          if (workTime) tokens.push(workTime)
                        } else {
                          const { month, day } = dayOfYearToDate(retirementDay, baselineDataObj!.year)
                          const dateLabel = `${month}/${day}`
                          const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                          const detail = workTime ? `${dateLabel} ${workTime}` : dateLabel
                          tokens.push(detail)
                        }
                      } else if (p.type === 'employee') {
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        if (sal) tokens.push(sal)
                      } else if (p.type === 'newEmployee') {
                        const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(startDay, baselineDataObj!.year)
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `${month}/${day}`
                        const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'employeeToTerminate') {
                        const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(terminateDay, baselineDataObj!.year)
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `${month}/${day}`
                        const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'partner') {
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        if (wk) tokens.push(wk)
                      }
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 12px 1fr', gap: 2, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>{tokens[0]}</span>
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>{tokens[1] || ''}</span>
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>{tokens[2] || ''}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {data.map((d) => {
                  const p = d.physicians[rowIdx]
                  if (!p) return <div key={`cell-${scenario}-${d.year}-${rowIdx}`} />
                  const role = p.type === 'partner' ? 'P' : p.type === 'employee' ? 'E' : p.type === 'newEmployee' ? 'N' : p.type === 'employeeToTerminate' ? 'T' : p.type === 'employeeToPartner' ? 'M' : 'R'
                  const tokens: string[] = [abbreviatePhysicianName(p.name), role]
                  
                  if (p.type === 'employeeToPartner') {
                    const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, d.year)
                    const { month, day } = dayOfYearToDate(transitionDay, d.year)
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `${month}/${day}`
                    const payTime = sal && wk ? `${sal}/${wk}` : sal || wk
                    const detail = payTime ? `${dateLabel} ${payTime}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'partnerToRetire') {
                    const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, d.year)
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    const buyout = typeof p.buyoutCost === 'number' ? currencyShort(p.buyoutCost).toUpperCase() : ''
                    
                    if (retirementDay === 0) {
                      // Retired in prior year - omit date, show only costs
                      const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                      if (workTime) tokens.push(workTime)
                    } else {
                      // Normal retirement in current year - show date and costs
                      const { month, day } = dayOfYearToDate(retirementDay, d.year)
                      const dateLabel = `${month}/${day}`
                      const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                      const detail = workTime ? `${dateLabel} ${workTime}` : dateLabel
                      tokens.push(detail)
                    }
                  } else if (p.type === 'employee') {
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    if (sal) tokens.push(sal)
                  } else if (p.type === 'newEmployee') {
                    const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, d.year)
                    const { month, day } = dayOfYearToDate(startDay, d.year)
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `${month}/${day}`
                    const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'employeeToTerminate') {
                    const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, d.year)
                    const { month, day } = dayOfYearToDate(terminateDay, d.year)
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `${month}/${day}`
                    const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'partner') {
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    if (wk) tokens.push(wk)
                  }
                  return (
                    <div key={`cell-${scenario}-${d.year}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: '24px 12px 1fr', gap: 2, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{tokens[0]}</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{tokens[1] || ''}</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{tokens[2] || ''}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend / key for role abbreviations */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ color: '#6b7280', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 6, padding: 5, background: '#ffffff' }}>
          <span>N: New Employee</span>
          <span>E: Employee</span>
          <span>T: Employee Termination</span>
          <span>M: Mixed (Employee to Partner)</span>
          <span>P: Partner</span>
          <span>R: Partner to Retire</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ margin: '8px 0', fontSize: 15 }}>Parameters Summary</h3>
      {renderScenario('A')}
      {store.scenarioBEnabled && store.scenarioB && renderScenario('B')}
    </div>
  )
}