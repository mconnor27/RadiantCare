import { useMemo, useEffect, useState, Fragment } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import Plot from 'react-plotly.js'

export type YearRow = {
  year: number
  totalIncome: number
  nonEmploymentCosts: number
  employeePayroll?: number
}

export type PhysicianType = 'partner' | 'employee' | 'employeeToPartner'

export type Physician = {
  id: string
  name: string
  type: PhysicianType
  salary?: number
  weeksVacation?: number
  // For mixed type: portion of the year as an employee (0..1). Remainder is partner.
  employeePortionOfYear?: number
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

// Extend FutureYear with nonMdEmploymentCosts
export type FutureYear = {
  year: number
  totalIncome: number
  nonEmploymentCosts: number
  nonMdEmploymentCosts: number
  locumDays: number
  miscEmploymentCosts: number
  physicians: Physician[]
}

type Projection = {
  incomeGrowthPct: number // -10%..+10% YOY for income
  costGrowthPct: number // -10%..+10% YOY for costs
}

type ScenarioState = {
  future: FutureYear[]
  projection: Projection
  selectedYear: number
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
    field: 'totalIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'locumDays' | 'miscEmploymentCosts',
    value: number
  ) => void
  upsertPhysician: (scenario: ScenarioKey, year: number, physician: Physician) => void
  removePhysician: (scenario: ScenarioKey, year: number, physicianId: string) => void
  setProjectionGrowthPct: (scenario: ScenarioKey, field: 'income' | 'cost', value: number) => void
  applyProjectionFromLastActual: (scenario: ScenarioKey) => void
  setSelectedYear: (scenario: ScenarioKey, year: number) => void
  loadSnapshot: (snapshot: { scenarioA: ScenarioState; scenarioBEnabled: boolean; scenarioB?: ScenarioState }) => void
  resetToDefaults: () => void
}

const HISTORIC_DATA: YearRow[] = [
  { year: 2018, totalIncome: 2385672.70, nonEmploymentCosts: 164316.85, employeePayroll: 357360.09 },
  { year: 2019, totalIncome: 2502863.99, nonEmploymentCosts: 169489.41, employeePayroll: 533175.95 },
  { year: 2020, totalIncome: 2535470.73, nonEmploymentCosts: 171135.92, employeePayroll: 573277.22 },
  { year: 2021, totalIncome: 2686548.27, nonEmploymentCosts: 176804.30, employeePayroll: 652879.00 },
  { year: 2022, totalIncome: 2582389.65, nonEmploymentCosts: 268128.56, employeePayroll: 503812.98 },
  { year: 2023, totalIncome: 2961520.28, nonEmploymentCosts: 199599.12, employeePayroll: 790092.00 },
  { year: 2024, totalIncome: 3076628.83, nonEmploymentCosts: 258605.27, employeePayroll: 785924.54 },
  // 2025 actuals per provided figures
  { year: 2025, totalIncome: 3385975.78, nonEmploymentCosts: 224191.46, employeePayroll: 777845.26 },
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

function scenarioADefaultsByYear(year: number): Physician[] {
  if (year === 2025) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 9 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 400000 },
    ]
  }
  if (year === 2026) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', salary: 600000, weeksVacation: 8, employeePortionOfYear: 0.75 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000 },
    ]
  }
  if (year === 2027) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000 },
    ]
  }
  // 2028-2029
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
    { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8 },
    { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 8 },
  ]
}

// Helper: employer payroll taxes for W2 annual wages
function calculateEmployerPayrollTaxes(annualWages: number): number {
  const socialSecurityTax = Math.min(annualWages, 176100) * 0.062
  const medicareTax = annualWages * 0.0145
  const additionalMedicareTax = annualWages > 200000 ? (annualWages - 200000) * 0.009 : 0
  const unemploymentTax = Math.min(annualWages, 72800) * 0.01
  return socialSecurityTax + medicareTax + additionalMedicareTax + unemploymentTax
}

const MONTHLY_BENEFITS_MED = 796.37
const MONTHLY_BENEFITS_DENTAL = 57.12
const MONTHLY_BENEFITS_VISION = 6.44
const ANNUAL_BENEFITS_FULLTIME = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
const LOCUM_DAY_RATE = 2000
const NET_PARTNER_POOL_2025 = 2383939.06
const DEFAULT_MISC_EMPLOYMENT_COSTS = 20000

// Default Non-MD staff costs (wages + employer taxes + benefits for FT 1)
function computeDefaultNonMdEmploymentCosts(): number {
  // Employee 1: $31.25/hr, 40 hrs/week, full-time + benefits
  const emp1Wages = 31.25 * 40 * 52
  const emp1Taxes = calculateEmployerPayrollTaxes(emp1Wages)
  const emp1Total = emp1Wages + emp1Taxes + ANNUAL_BENEFITS_FULLTIME
  // Employee 2: $27/hr, 32 hrs/week, part-time (no benefits specified)
  const emp2Wages = 27 * 32 * 52
  const emp2Taxes = calculateEmployerPayrollTaxes(emp2Wages)
  const emp2Total = emp2Wages + emp2Taxes
  // Employee 3: $23/hr, 20 hrs/week, part-time
  const emp3Wages = 23 * 20 * 52
  const emp3Taxes = calculateEmployerPayrollTaxes(emp3Wages)
  const emp3Total = emp3Wages + emp3Taxes
  return Math.round(emp1Total + emp2Total + emp3Total)
}

const DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE = computeDefaultNonMdEmploymentCosts()

const FUTURE_YEARS_BASE: Omit<FutureYear, 'physicians'>[] = Array.from({ length: 5 }).map((_, idx) => {
  const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2026)
  const year = startYear + idx
  return {
    year,
    totalIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].totalIncome,
    nonEmploymentCosts:
      HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
    nonMdEmploymentCosts: DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE,
    locumDays: 90,
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
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 9 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 400000 },
      { id: `${year}-P5`, name: 'Physician 5', type: 'employee', salary: 600000 }, // 5th physician
    ]
  }
  if (year === 2026) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', salary: 600000, weeksVacation: 8, employeePortionOfYear: 0.75 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000 },
      { id: `${year}-P5`, name: 'Physician 5', type: 'employee', salary: 600000 },
    ]
  }
  if (year === 2027) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000 },
      { id: `${year}-P5`, name: 'Physician 5', type: 'employee', salary: 600000 },
    ]
  }
  // 2028-2029
  return [
    { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
    { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
    { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8 },
    { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 8 },
    { id: `${year}-P5`, name: 'Physician 5', type: 'partner', weeksVacation: 8 },
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
          projection: { incomeGrowthPct: 3, costGrowthPct: 3 },
          selectedYear: FUTURE_YEARS_BASE[0].year,
        },
        scenarioB: {
          future: INITIAL_FUTURE_YEARS_B,
          projection: { incomeGrowthPct: 0, costGrowthPct: 3 },
          selectedYear: FUTURE_YEARS_BASE[0].year,
        },
        scenarioBEnabled: true,
        setScenarioEnabled: (enabled) => {
          set((state) => {
            state.scenarioBEnabled = enabled
            if (enabled) {
              // Initialize scenario B with its own defaults instead of cloning A
              state.scenarioB = {
                future: INITIAL_FUTURE_YEARS_B.map((f) => ({ ...f, physicians: [...f.physicians] })),
                projection: { incomeGrowthPct: 0, costGrowthPct: 3 },
                selectedYear: state.scenarioA.selectedYear,
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

            for (const fut of sc.future) {
              if (fut.year <= year) continue

              // Find same MD by name (preferred) or id
              let j = fut.physicians.findIndex((p) => p.name === targetName)
              if (j < 0) j = fut.physicians.findIndex((p) => p.id === physician.id)

              if (j < 0) {
                // If adding in this year (or if not present later), add them for all subsequent years
                if (isNewInYear) {
                  // Determine type for this future year based on rules:
                  // - Mixed in the edited year -> partner thereafter
                  // - Employee in the edited year -> employee for next year, then partner starting year+2
                  let computedType: PhysicianType = physician.type
                  if (becomesPartnerNextYears) {
                    computedType = 'partner'
                  } else if (physician.type === 'employee') {
                    computedType = fut.year >= year + 2 ? 'partner' : 'employee'
                  }

                  const cloned: Physician = {
                    id: toIdForYear(fut.year, physician),
                    name: physician.name,
                    type: computedType,
                    salary:
                      computedType === 'partner'
                        ? undefined
                        : (physician.type === 'employee' || physician.type === 'employeeToPartner')
                          ? (physician.salary ?? 500000)
                          : undefined,
                    weeksVacation:
                      computedType === 'partner' || computedType === 'employeeToPartner'
                        ? (physician.weeksVacation ?? 8)
                        : undefined,
                    employeePortionOfYear: computedType === 'partner' ? undefined : physician.employeePortionOfYear,
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
                if (updated.type === 'employee' || updated.type === 'employeeToPartner') {
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
        setProjectionGrowthPct: (scenario, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const clamped = Math.max(-10, Math.min(10, value))
            if (field === 'income') sc.projection.incomeGrowthPct = clamped
            else sc.projection.costGrowthPct = clamped
            const last = state.historic[state.historic.length - 1]
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const costGpct = sc.projection.costGrowthPct / 100
            let income = last.totalIncome
            let costs = last.nonEmploymentCosts
            let nonMd = DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE
            for (const fy of sc.future) {
              income = income * (1 + incomeGpct)
              costs = costs * (1 + costGpct)
              nonMd = nonMd * (1 + costGpct)
              fy.totalIncome = income
              fy.nonEmploymentCosts = costs
              fy.nonMdEmploymentCosts = nonMd
            }
          }),
        applyProjectionFromLastActual: (scenario) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const last = state.historic[state.historic.length - 1]
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const costGpct = sc.projection.costGrowthPct / 100
            let income = last.totalIncome
            let costs = last.nonEmploymentCosts
            let nonMd = DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE
            for (const fy of sc.future) {
              income = income * (1 + incomeGpct)
              costs = costs * (1 + costGpct)
              nonMd = nonMd * (1 + costGpct)
              fy.totalIncome = income
              fy.nonEmploymentCosts = costs
              fy.nonMdEmploymentCosts = nonMd
            }
          }),
        setSelectedYear: (scenario, year) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            sc.selectedYear = year
          }),
        loadSnapshot: (snapshot) =>
          set((state) => {
            state.scenarioA = snapshot.scenarioA
            state.scenarioBEnabled = !!snapshot.scenarioBEnabled
            state.scenarioB = snapshot.scenarioBEnabled && snapshot.scenarioB ? snapshot.scenarioB : undefined
          }),
        resetToDefaults: () => {
          set((state) => {
            state.scenarioA = {
              future: INITIAL_FUTURE_YEARS_A.map((f) => ({ ...f, physicians: [...f.physicians] })),
              projection: { incomeGrowthPct: 3, costGrowthPct: 3 },
              selectedYear: FUTURE_YEARS_BASE[0].year,
            }
            state.scenarioBEnabled = true
            state.scenarioB = {
              future: INITIAL_FUTURE_YEARS_B.map((f) => ({ ...f, physicians: [...f.physicians] })),
              projection: { incomeGrowthPct: 0, costGrowthPct: 3 },
              selectedYear: FUTURE_YEARS_BASE[0].year,
            }
          }, false)
          // Apply the 3% growth projections to the future year values
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

// Calculate total cost for an employee including benefits and payroll taxes
function calculateEmployeeTotalCost(employee: Physician): number {
  const baseSalary = employee.salary || 0
  
  // Monthly benefits (convert to annual)
  const annualBenefits = (796.37 + 57.12 + 6.44) * 12 // $10,314.36 annually
  
  // WA State and Federal payroll taxes (employer portion)
  const socialSecurityTax = Math.min(baseSalary, 176100) * 0.062 // 6.2% up to $176,100
  const medicareTax = baseSalary * 0.0145 // 1.45% on all wages
  const additionalMedicareTax = baseSalary > 200000 ? (baseSalary - 200000) * 0.009 : 0 // 0.9% on wages over $200K
  
  // WA UI tax (using average rate of 1.0% on first $72,800)
  const unemploymentTax = Math.min(baseSalary, 72800) * 0.01
  
  const totalPayrollTaxes = socialSecurityTax + medicareTax + additionalMedicareTax + unemploymentTax
  
  return baseSalary + annualBenefits + totalPayrollTaxes
}

// Mixed type helpers
function getEmployeePortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 1
  if (physician.type === 'partner') return 0
  const val = physician.employeePortionOfYear ?? 0.5
  return clamp(val, 0, 1)
}

function getPartnerPortionOfYear(physician: Physician): number {
  return 1 - getEmployeePortionOfYear(physician)
}

function getPartnerFTEWeight(physician: Physician): number {
  const weeks = clamp(physician.weeksVacation ?? 0, 0, 16)
  const baseFte = 1 - weeks / 52
  return baseFte * getPartnerPortionOfYear(physician)
}

function snapPercentToFifthsAndThirds(rawPercent: number): number {
  // Round to nearest 5%
  let p = Math.round(rawPercent / 5) * 5
  // Snap near 33% and 67%
  if (Math.abs(p - 33) <= 2) p = 33
  if (Math.abs(p - 67) <= 2) p = 67
  // Clamp 0..100
  return Math.max(0, Math.min(100, p))
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

// Generate tooltip content for employee cost breakdown
function getEmployeeCostTooltip(employee: Physician): string {
  const baseSalary = employee.salary || 0
  const benefits = (796.37 + 57.12 + 6.44) * 12
  const socialSecurity = Math.min(baseSalary, 176100) * 0.062
  const medicare = baseSalary * 0.0145
  const additionalMedicare = baseSalary > 200000 ? (baseSalary - 200000) * 0.009 : 0
  const unemployment = Math.min(baseSalary, 72800) * 0.01
  const totalCost = calculateEmployeeTotalCost(employee)
  
  return `Employee Total Cost Breakdown:
Base Salary: ${currency(baseSalary)}
Benefits (Medical/Dental/Vision): ${currency(benefits)}
Social Security Tax (6.2%): ${currency(socialSecurity)}
Medicare Tax (1.45%): ${currency(medicare)}${additionalMedicare > 0 ? `
Additional Medicare (0.9%): ${currency(additionalMedicare)}` : ''}
WA Unemployment Tax (1.0%): ${currency(unemployment)}
Total Cost: ${currency(totalCost)}

This total cost is deducted from the partner compensation pool.`
}

function usePartnerComp(year: number, scenario: ScenarioKey) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)
  return useMemo(() => {
    // Special handling for 2025: fixed partner pool and scenario A defaults
    if (!fy && year === 2025) {
      const partners = scenarioADefaultsByYear(2025).filter((p) => p.type === 'partner')
      const partnerFTEs = partners.map((p) => {
        const weeks = clamp(p.weeksVacation ?? 0, 0, 16)
        const fte = 1 - weeks / 52
        return { p, weight: fte }
      })
      const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
      return partnerFTEs.map(({ p, weight }) => ({ id: p.id, name: p.name, comp: (weight / totalWeight) * NET_PARTNER_POOL_2025 }))
    }
    if (!fy) return [] as { id: string; name: string; comp: number }[]
    const partners = fy.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner')
    const employees = fy.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner')
    const totalEmployeeSalary = employees.reduce((sum, e) => {
      const employeePortion = getEmployeePortionOfYear(e)
      return sum + (e.salary ?? 0) * employeePortion
    }, 0)
    const totalCosts = fy.nonEmploymentCosts + fy.nonMdEmploymentCosts + fy.miscEmploymentCosts + (fy.locumDays * LOCUM_DAY_RATE) + totalEmployeeSalary
    const pool = Math.max(0, fy.totalIncome - totalCosts)
    if (partners.length === 0) return []
    const partnerFTEs = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
    const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
    return partnerFTEs.map(({ p, weight }) => ({
      id: p.id,
      name: p.name,
      comp: (weight / totalWeight) * pool,
    }))
  }, [fy, sc])
}

function YearPanel({ year, scenario }: { year: number; scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const isReadOnly = year === 2025
  const last2025 = store.historic.find((h) => h.year === 2025)
  const fy = isReadOnly && last2025
    ? {
        year: 2025,
        totalIncome: last2025.totalIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        nonMdEmploymentCosts: DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE,
        locumDays: 30,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        physicians: scenarioADefaultsByYear(2025),
      } as FutureYear
    : (sc.future.find((f) => f.year === year) as FutureYear)
  const partnerComp = usePartnerComp(year, scenario)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{year}</div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', padding: 8 }}>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Total Income</div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={2000000}
          max={4000000}
          step={1000}
          value={fy.totalIncome}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'totalIncome', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${((fy.totalIncome - 2000000) / (4000000 - 2000000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.totalIncome))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'totalIncome', Number(e.target.value.replace(/[^0-9]/g, '')))
          }
          disabled={isReadOnly}
          style={{ width: isMobile ? 100 : 100, justifySelf: isMobile ? 'end' : undefined }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: '14px', color: '#666', width: '16px', height: '16px', textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('income-tooltip', 'Gross (Therapy and Other)', e)}
          onMouseLeave={() => removeTooltip('income-tooltip')}
          onTouchStart={(e) => createTooltip('income-tooltip', 'Gross (Therapy and Other)', e)}
          onClick={(e) => createTooltip('income-tooltip', 'Gross (Therapy and Other)', e)}
        >ℹ</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Non-Employment Costs</div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={100000}
          max={500000}
          step={1000}
          value={fy.nonEmploymentCosts}
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
            ['--fill-percent' as any]: `${((fy.nonEmploymentCosts - 100000) / (500000 - 100000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonEmploymentCosts))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{ width: isMobile ? 100 : 100, justifySelf: isMobile ? 'end' : undefined }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onMouseLeave={() => removeTooltip('nonemp-tooltip')}
          onTouchStart={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onClick={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
        >ℹ</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Non‑MD Employment Costs</div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={50000}
          max={300000}
          step={1000}
          value={fy.nonMdEmploymentCosts}
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
            ['--fill-percent' as any]: `${((fy.nonMdEmploymentCosts - 50000) / (300000 - 50000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonMdEmploymentCosts))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonMdEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{ width: isMobile ? 100 : 100, justifySelf: isMobile ? 'end' : undefined }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
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
            tooltip.textContent = `Includes:\nRG: Full-time, $31.25 per hour, Medical/Dental/Vision\nAL: Part-time: $27 per hour, 32 hours per week\nMW: Part-time: $23 per hour, 20 hours per week`
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
          ℹ
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Locums Costs</div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={fy.locumDays}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'locumDays',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ 
            width: '100%',
            ['--fill-percent' as any]: `${(fy.locumDays / 120) * 100}%`
          }}
        />
        <input
          type="text"
          value={`${currency(Math.round(fy.locumDays * LOCUM_DAY_RATE))} (${fy.locumDays} d)`}
          readOnly
          style={{ width: isMobile ? 100 : 100, justifySelf: isMobile ? 'end' : undefined }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('locums-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'locums-tooltip'
            tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
            tooltip.textContent = 'Assumes $2,000 per day'
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => { const t = document.getElementById('locums-tooltip'); if (t) t.remove() }}
        >ℹ</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Misc Employment Costs</div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={100000}
          step={1000}
          value={fy.miscEmploymentCosts}
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
            ['--fill-percent' as any]: `${(fy.miscEmploymentCosts / 100000) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.miscEmploymentCosts))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'miscEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{ width: isMobile ? 100 : 100, justifySelf: isMobile ? 'end' : undefined }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
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
            tooltip.textContent = 'Includes Profit Sharing, Gifts, Recruiting, etc.'
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
          ℹ
        </div>
      </div>
      </div>

      <PhysiciansEditor
        year={year}
        scenario={scenario}
        readOnly={isReadOnly}
        physiciansOverride={isReadOnly ? scenarioADefaultsByYear(2025) : undefined}
      />

      {partnerComp.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f9fafb' }}>
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

function PhysiciansEditor({ year, scenario, readOnly = false, physiciansOverride }: { year: number; scenario: ScenarioKey; readOnly?: boolean; physiciansOverride?: Physician[] }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)!
  const physicians = physiciansOverride ?? fy.physicians

  const rows = physicians.map((p) => {
    const canDelete = !readOnly && physicians.length > 3
    return (
      <div
        key={p.id}
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 8,
          display: 'grid',
          gridTemplateColumns: '120px 150px 1fr 20px 20px',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={p.name}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, { ...p, name: e.target.value })
          }
          disabled={readOnly}
        />
        <select
          value={p.type}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, {
              ...p,
              type: e.target.value as PhysicianType,
              // Initialize sensible defaults when switching types
              employeePortionOfYear: e.target.value === 'employeeToPartner' ? (p.employeePortionOfYear ?? 0.5) : p.employeePortionOfYear,
              salary: e.target.value !== 'partner' ? (p.salary ?? 500000) : undefined,
              weeksVacation: e.target.value !== 'employee' ? (p.weeksVacation ?? 8) : undefined,
            })
          }
          disabled={readOnly}
        >
          <option value="partner">Partner</option>
          <option value="employee">Employee</option>
          <option value="employeeToPartner">Employee → Partner</option>
        </select>
        {p.type === 'employee' ? (
          <>
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
                style={{ width: 100 }}
                disabled={readOnly}
              />
            </div>
            <div 
              style={{ 
                position: 'relative',
                display: 'inline-block',
                cursor: 'help',
                fontSize: '14px',
                color: '#666',
                width: '16px',
                height: '16px',
                textAlign: 'center',
                lineHeight: '16px',
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
                tooltip.textContent = getEmployeeCostTooltip(p)
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
              ℹ
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
              ×
            </button>
          </>
        ) : p.type === 'partner' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                type="range"
                min={2}
                max={16}
                step={1}
                value={p.weeksVacation ?? 0}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    weeksVacation: Number(e.target.value),
                  })
                }
                disabled={readOnly}
                style={{ 
                  width: '100%',
                  ['--fill-percent' as any]: `${((p.weeksVacation ?? 0) - 2) / (16 - 2) * 100}%`
                }}
              />
              <input
                type="text"
                value={`${p.weeksVacation ?? 0} weeks off`}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    weeksVacation: Number(e.target.value.replace(/[^0-9]/g, '')),
                  })
                }
                style={{ width: 100 }}
                disabled={readOnly}
              />
            </div>
            <div style={{ width: '16px' }}></div>
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
              ×
            </button>
          </>
        ) : (
          // employeeToPartner
          <>
            <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    className="growth-slider"
                    value={Math.round((p.employeePortionOfYear ?? 0.5) * 100)}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const snapped = snapPercentToFifthsAndThirds(raw)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        employeePortionOfYear: snapped / 100,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-start' as any]: (snapPercentToFifthsAndThirds(Math.round((p.employeePortionOfYear ?? 0.5) * 100)) >= 50)
                        ? '50%'
                        : `${snapPercentToFifthsAndThirds(Math.round((p.employeePortionOfYear ?? 0.5) * 100))}%`,
                      ['--fill-end' as any]: (snapPercentToFifthsAndThirds(Math.round((p.employeePortionOfYear ?? 0.5) * 100)) >= 50)
                        ? `${snapPercentToFifthsAndThirds(Math.round((p.employeePortionOfYear ?? 0.5) * 100))}%`
                        : '50%'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '2px', height: '8px', backgroundColor: '#374151', pointerEvents: 'none'
                  }} />
                </div>
                <input
                  type="text"
                  value={`${snapPercentToFifthsAndThirds(Math.round((p.employeePortionOfYear ?? 0.5) * 100))}% employee`}
                  onChange={(e) => {
                    const digits = Number((e.target.value.match(/\d+/)?.[0]) ?? '0')
                    const snapped = snapPercentToFifthsAndThirds(digits)
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      employeePortionOfYear: snapped / 100,
                    })
                  }}
                  style={{ width: 100, height: 20, padding: '2px 2px' }}
                  disabled={readOnly}
                />
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
                  style={{ width: 100 }}
                  disabled={readOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={2}
                  max={16}
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
                    ['--fill-percent' as any]: `${((p.weeksVacation ?? 8) - 2) / (16 - 2) * 100}%`
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
                  style={{ width: 100 }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px 20px', rowGap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div 
                style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: '14px', color: '#666', width: '16px', height: '16px', textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'employee-partner-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const empPct = Math.round((p.employeePortionOfYear ?? 0.5) * 100)
                  const partnerPct = 100 - empPct
                  let extra = ''
                  if (empPct === 75 && partnerPct === 25) extra = `\n(For example: Employee for Q1–Q3, Partner for Q4)`
                  tooltip.textContent = `Mixed role in year:\nEmployee portion: ${empPct}%\nPartner portion: ${partnerPct}%${extra}`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('employee-partner-tooltip'); if (t) t.remove() }}
              >ℹ</div>
              <div 
                style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: '14px', color: '#666', width: '16px', height: '16px', textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'employee-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  tooltip.textContent = getEmployeeCostTooltip(p)
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('employee-tooltip'); if (t) t.remove() }}
              >ℹ</div>
              <div style={{ height: 28 }} />
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
              ×
            </button>
          </>
        )}
      </div>
    )
  })

  return (
    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f9fafb' }}>
      <div style={{ fontWeight: 600 }}>Physicians (up to 6)</div>
      {rows}
      {!readOnly && physicians.length < 6 && (
        <button
          onClick={() => {
            const nextIndex = fy.physicians.length
            const type: PhysicianType = 'employee'
            store.upsertPhysician(scenario, year, {
              id: `${year}-${nextIndex}`,
              name: `Physician ${nextIndex + 1}`,
              type,
              salary: 500000,
              weeksVacation: undefined,
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
    const last2025 = state.historic.find((h) => h.year === 2025)!
    fy = {
      year: 2025,
      totalIncome: last2025.totalIncome,
      nonEmploymentCosts: last2025.nonEmploymentCosts,
      nonMdEmploymentCosts: DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE,
      locumDays: 30,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      physicians: scenarioADefaultsByYear(2025),
    }
  }
  if (!fy) return [] as { id: string; name: string; type: PhysicianType; comp: number }[]
  const partners = fy!.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner')
  const employees = fy!.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner')

  const totalEmployeeCosts = employees.reduce((sum, e) => {
    const portion = e.type === 'employeeToPartner' ? getEmployeePortionOfYear(e) : (e.type === 'employee' ? 1 : 0)
    if (portion <= 0) return sum
    // For pool calculation, only reduce by W2 salary portion (benefits/taxes handled elsewhere/visualized)
    const salaryPortion = (e.salary ?? 0) * portion
    return sum + salaryPortion
  }, 0)

  const pool = year === 2025
    ? NET_PARTNER_POOL_2025
    : Math.max(0, fy!.totalIncome - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + (fy!.locumDays * LOCUM_DAY_RATE) + totalEmployeeCosts))

  const parts = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
  const totalWeight = parts.reduce((s, x) => s + x.weight, 0) || 1
  const partnerShares = parts.map(({ p, weight }) => ({ id: p.id, name: p.name, type: 'partner' as const, baseShare: (weight / totalWeight) * pool, physician: p }))

  // Compose final list per physician (ensure each physician appears once with combined comp if mixed)
  const results: { id: string; name: string; type: PhysicianType; comp: number }[] = []
  // Add partner and mixed
  for (const s of partnerShares) {
    let comp = s.baseShare
    if (s.physician.type === 'employeeToPartner') {
      const salaryPortion = (s.physician.salary ?? 0) * getEmployeePortionOfYear(s.physician)
      comp += salaryPortion
    }
    results.push({ id: s.id, name: s.name, type: 'partner', comp })
  }
  // Add pure employees (exclude mixed already included)
  for (const e of fy!.physicians.filter((p) => p.type === 'employee')) {
    results.push({ id: e.id, name: e.name, type: 'employee', comp: e.salary ?? 0 })
  }
  return results
}

function YearOnYearControls({ scenario }: { scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  const isMobile = useIsMobile()
  
  if (!sc) return null
  
  return (
    <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f8f9fa', borderRadius: 4, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Year-over-Year Growth</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Income Growth %</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 32 }}>
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={sc.projection.incomeGrowthPct}
                onChange={(e) => {
                  store.setProjectionGrowthPct(scenario, 'income', Number(e.target.value))
                }}
                style={{ 
                  width: '100%', margin: 0,
                  ['--fill-start' as any]: sc.projection.incomeGrowthPct >= 0 ? '50%' : `${((sc.projection.incomeGrowthPct + 10) / 20) * 100}%`,
                  ['--fill-end' as any]: sc.projection.incomeGrowthPct >= 0 ? `${((sc.projection.incomeGrowthPct + 10) / 20) * 100}%` : '50%',
                }}
                className="growth-slider"
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '2px',
                height: '8px',
                backgroundColor: '#374151',
                pointerEvents: 'none'
              }} />
            </div>
            <input
              type="number"
              min={-10}
              max={10}
              value={sc.projection.incomeGrowthPct}
              onChange={(e) => {
                store.setProjectionGrowthPct(scenario, 'income', Number(e.target.value))
              }}
              style={{ width: isMobile ? 48 : 56, fontSize: 14 }}
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Cost Growth %</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 32 }}>
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={sc.projection.costGrowthPct}
                onChange={(e) => {
                  store.setProjectionGrowthPct(scenario, 'cost', Number(e.target.value))
                }}
                style={{ 
                  width: '100%', margin: 0,
                  ['--fill-start' as any]: sc.projection.costGrowthPct >= 0 ? '50%' : `${((sc.projection.costGrowthPct + 10) / 20) * 100}%`,
                  ['--fill-end' as any]: sc.projection.costGrowthPct >= 0 ? `${((sc.projection.costGrowthPct + 10) / 20) * 100}%` : '50%',
                }}
                className="growth-slider"
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '2px',
                height: '8px',
                backgroundColor: '#374151',
                pointerEvents: 'none'
              }} />
            </div>
            <input
              type="number"
              min={-10}
              max={10}
              value={sc.projection.costGrowthPct}
              onChange={(e) => {
                store.setProjectionGrowthPct(scenario, 'cost', Number(e.target.value))
              }}
              style={{ width: isMobile ? 48 : 56, fontSize: 14 }}
            />
          </div>
        </div>
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
  const lastActual = store.historic[store.historic.length - 1]

  // Calculate max Y value from all data
  const scAIncome = store.scenarioA.future.map(f => f.totalIncome)
  const scACosts = store.scenarioA.future.map(f => f.nonEmploymentCosts)
  const scAEmployment = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts
  })
  const scBIncome = store.scenarioB?.future.map(f => f.totalIncome) || []
  const scBCosts = store.scenarioB?.future.map(f => f.nonEmploymentCosts) || []
  const scBEmployment = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts
  }) || []
  const scANet = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    return f.totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - (f.locumDays * LOCUM_DAY_RATE) - md
  })
  const scBNet = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    return f.totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - (f.locumDays * LOCUM_DAY_RATE) - md
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
      <Plot
        data={(() => {
          const traces: any[] = []
          // Group: Income
          traces.push({ x: historicYears, y: incomeHistoric, type: 'scatter', mode: 'lines+markers', name: 'Total Income', line: { color: '#1976d2', width: 3 }, legendgroup: 'income', legendrank: 1 })
          traces.push({ x: [lastActual.year, ...store.scenarioA.future.map(f => f.year)], y: [lastActual.totalIncome, ...store.scenarioA.future.map(f => f.totalIncome)], type: 'scatter', mode: 'lines', name: 'Income projection A', line: { dash: 'dot', color: '#1976d2', width: 2 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [lastActual.year, ...store.scenarioB.future.map(f => f.year)], y: [lastActual.totalIncome, ...store.scenarioB.future.map(f => f.totalIncome)], type: 'scatter', mode: 'lines', name: 'Income projection B', line: { dash: 'dash', color: '#1976d2', width: 2 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 3 })

          // Group: Non-employment costs
          traces.push({ x: historicYears, y: costHistoric, type: 'scatter', mode: 'lines+markers', name: 'Non-Employment Costs', line: { color: '#e65100', width: 3 }, legendgroup: 'cost', legendrank: 1 })
          traces.push({ x: [lastActual.year, ...store.scenarioA.future.map(f => f.year)], y: [lastActual.nonEmploymentCosts, ...store.scenarioA.future.map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines', name: 'Cost projection A', line: { dash: 'dot', color: '#e65100', width: 2 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [lastActual.year, ...store.scenarioB.future.map(f => f.year)], y: [lastActual.nonEmploymentCosts, ...store.scenarioB.future.map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines', name: 'Cost projection B', line: { dash: 'dash', color: '#e65100', width: 2 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 3 })

          // Group: Net income
          traces.push({ x: historicYears, y: netHistoric, type: 'scatter', mode: 'lines+markers', name: 'Net Income (Historic)', line: { color: '#2e7d32', width: 3 }, legendgroup: 'net', legendrank: 1 })
          traces.push({ x: [lastActual.year, ...store.scenarioA.future.map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...scANet], type: 'scatter', mode: 'lines', name: 'Net projection A', line: { dash: 'dot', color: '#2e7d32', width: 2 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [lastActual.year, ...store.scenarioB.future.map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...scBNet], type: 'scatter', mode: 'lines', name: 'Net projection B', line: { dash: 'dash', color: '#2e7d32', width: 2 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 3 })

          // Group: Employment
          traces.push({ x: historicYears, y: employmentHistoric, type: 'scatter', mode: 'lines+markers', name: 'Employment Costs (Historic)', line: { color: '#6b7280', width: 3 }, legendgroup: 'employment', legendrank: 1 })
          traces.push({ x: [lastActual.year, ...store.scenarioA.future.map(f => f.year)], y: [lastActual.employeePayroll ?? 0, ...scAEmployment], type: 'scatter', mode: 'lines', name: 'Employment projection A', line: { dash: 'dot', color: '#6b7280', width: 2 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [lastActual.year, ...store.scenarioB.future.map(f => f.year)], y: [lastActual.employeePayroll ?? 0, ...scBEmployment], type: 'scatter', mode: 'lines', name: 'Employment projection B', line: { dash: 'dash', color: '#6b7280', width: 2 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 3 })

          return traces
        })() as any}
        layout={{
          title: { text: 'RadiantCare: Historic and Projected Totals' },
          dragmode: false as any,
          legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1, yanchor: 'top', traceorder: 'grouped' },
          margin: { l: 60, r: 20, t: 40, b: 64 },
          yaxis: {
            tickprefix: '$',
            separatethousands: true,
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
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16, maxWidth: store.scenarioBEnabled ? 1400 : 1000, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>RadiantCare Physician Compensation</h2>
      <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', marginBottom: 8, gap: 8 }}>
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
            <YearOnYearControls scenario={'A'} />
            <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {[2025, ...store.scenarioA.future.map((f) => f.year)].map((yr) => (
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
                  {yr}
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
              <YearOnYearControls scenario={'B'} />
              <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
                {[2025, ...store.scenarioB.future.map((f) => f.year)].map((yr) => (
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
                    {yr}
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
  const years = [2025, ...store.scenarioA.future.map((f) => f.year)]
  const perYearA = years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') }))
  const perYearB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'B') }))
    : undefined
  // const totalPerYear = perYear.map(({ year, comps }) => ({ year, total: comps.reduce((s, c) => s + c.comp, 0) }))

  // Collect all physician names from both scenarios
  const allNamesFromA = perYearA.flatMap((y) => y.comps.map((c) => c.name))
  const allNamesFromB = perYearB ? perYearB.flatMap((y) => y.comps.map((c) => c.name)) : []
  const allNames = Array.from(new Set([...allNamesFromA, ...allNamesFromB]))
  // Assign a consistent color per person for both scenarios
  const colorPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  const colorByName: Record<string, string> = {}
  allNames.forEach((n, i) => { colorByName[n] = colorPalette[i % colorPalette.length] })
  const seriesA = allNames.map((name) => ({
    name,
    values: years.map((y) => {
      const found = perYearA.find((py) => py.year === y)?.comps.find((c) => c.name === name)
      return found ? found.comp : 0
    }),
  }))
  const seriesB = perYearB
    ? allNames.map((name) => ({
        name,
        values: years.map((y) => {
          const found = perYearB!.find((py) => py.year === y)?.comps.find((c) => c.name === name)
          return found ? found.comp : 0
        }),
      }))
    : []

  // Calculate locums data for both scenarios
  const locumsSeriesA = years.map((y) => {
    const fy = y === 2025 
      ? { locumDays: 30 } // 2025 default
      : store.scenarioA.future.find(f => f.year === y)
    return (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
  })
  const locumsSeriesB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        const fy = y === 2025 
          ? { locumDays: 30 } // 2025 default
          : store.scenarioB!.future.find(f => f.year === y)
        return (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
      })
    : []

  const [highlight, setHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const isHighlighted = (scenario: 'A' | 'B', name: string) =>
    highlight ? highlight.scenario === scenario && highlight.name === name : true



  // const totalsByPhysician = allNames.map((name) => ({
  //   name,
  //   total: years.reduce((s, _y, idx) => s + series.find((s2) => s2.name === name)!.values[idx], 0),
  // }))

  return (
    <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
      <h3 style={{ margin: '12px 0' }}>Multi-Year Compensation Summary (2025–2030)</h3>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Plot
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
                opacity: highlight ? (isHighlighted('A', name) ? 1 : 0.2) : 1,
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
                  opacity: highlight ? (isHighlighted('B', name) ? 1 : 0.2) : 1,
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
              opacity: highlight ? (isHighlighted('A', 'Locums') ? 1 : 0.2) : 1,
              legendgroup: 'Locums', // Group by itself
              legendrank: 999, // Put at end
            })
            if (store.scenarioBEnabled) {
              rows.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Locums (B)',
                x: years,
                y: locumsSeriesB,
                line: { color: '#888888', dash: 'dot', width: isHighlighted('B', 'Locums') ? 3 : 1.2 },
                opacity: highlight ? (isHighlighted('B', 'Locums') ? 1 : 0.2) : 1,
                legendgroup: 'Locums', // Same group as A scenario
                legendrank: 1000, // Put at end after A
              })
            }
            
            return rows
          })() as any}
          layout={{
            title: { text: 'Compensation per Physician (by year)', font: { size: 14 } },
            margin: { l: 48, r: 8, t: 28, b: 72 },
            yaxis: { tickprefix: '$', separatethousands: true },
            xaxis: { dtick: 1 },
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.08, yanchor: 'top', traceorder: 'grouped' },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler={true}
          style={{ width: '100%', height: isMobile ? 360 : 420 }}
        />
      </div>

      {/* Locums Override Controls */}
      <div style={{ marginTop: 8, marginBottom: 12, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fffbeb' }}>
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Locums Cost Override (All Years)</div>
        <div style={{ fontSize: 12, color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⚠️</span>
          <span>These sliders override individual per-year locum day settings</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: store.scenarioBEnabled && !isMobile ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Scenario A Locums Slider */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Scenario A</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center' }}>
              {(() => {
                const firstFuture = store.scenarioA.future[0]
                const currentDays = firstFuture?.locumDays ?? 90
                const currentCost = currentDays * LOCUM_DAY_RATE
                const fillPercent = (currentCost / 400000) * 100
                
                return (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={400000}
                      step={2000}
                      value={currentCost}
                      onChange={(e) => {
                        const cost = Number(e.target.value)
                        const days = Math.round(cost / LOCUM_DAY_RATE)
                        // Update all years in scenario A
                        store.scenarioA.future.forEach(fy => {
                          store.setFutureValue('A', fy.year, 'locumDays', days)
                        })
                      }}
                      style={{ 
                        width: '100%',
                        ['--fill-percent' as any]: `${fillPercent}%`
                      }}
                    />
                    <input
                      type="text"
                      value={`${currency(currentCost)} (${currentDays} d)`}
                      readOnly
                      style={{ width: isMobile ? 120 : 140, fontSize: 12, justifySelf: isMobile ? 'end' : undefined }}
                    />
                    <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 12, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                      onMouseEnter={(e) => createTooltip('locums-a-tooltip', 'Sets locum cost for all years in Scenario A\nCost is converted to days at $2,000 per day', e)}
                      onMouseLeave={() => removeTooltip('locums-a-tooltip')}
                      onTouchStart={(e) => createTooltip('locums-a-tooltip', 'Sets locum cost for all years in Scenario A\nCost is converted to days at $2,000 per day', e)}
                      onClick={(e) => createTooltip('locums-a-tooltip', 'Sets locum cost for all years in Scenario A\nCost is converted to days at $2,000 per day', e)}
                    >ℹ</div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Scenario B Locums Slider */}
          {store.scenarioBEnabled && store.scenarioB && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Scenario B</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center' }}>
                {(() => {
                  const firstFuture = store.scenarioB!.future[0]
                  const currentDays = firstFuture?.locumDays ?? 90
                  const currentCost = currentDays * LOCUM_DAY_RATE
                  const fillPercent = (currentCost / 400000) * 100
                  
                  return (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={400000}
                        step={2000}
                        value={currentCost}
                        onChange={(e) => {
                          const cost = Number(e.target.value)
                          const days = Math.round(cost / LOCUM_DAY_RATE)
                          // Update all years in scenario B
                          store.scenarioB!.future.forEach(fy => {
                            store.setFutureValue('B', fy.year, 'locumDays', days)
                          })
                        }}
                        style={{ 
                          width: '100%',
                          ['--fill-percent' as any]: `${fillPercent}%`
                        }}
                      />
                      <input
                        type="text"
                        value={`${currency(currentCost)} (${currentDays} d)`}
                        readOnly
                        style={{ width: isMobile ? 120 : 140, fontSize: 12, justifySelf: isMobile ? 'end' : undefined }}
                      />
                      <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 12, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                        onMouseEnter={(e) => createTooltip('locums-b-tooltip', 'Sets locum cost for all years in Scenario B\nCost is converted to days at $2,000 per day', e)}
                        onMouseLeave={() => removeTooltip('locums-b-tooltip')}
                        onTouchStart={(e) => createTooltip('locums-b-tooltip', 'Sets locum cost for all years in Scenario B\nCost is converted to days at $2,000 per day', e)}
                        onClick={(e) => createTooltip('locums-b-tooltip', 'Sets locum cost for all years in Scenario B\nCost is converted to days at $2,000 per day', e)}
                      >ℹ</div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8, overflowX: isMobile ? 'auto' : 'visible' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Per Physician by year</div>
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
              style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#f3f4f6' : 'transparent' }}
              onMouseEnter={() => setHighlight({ scenario: 'A', name })}
              onMouseLeave={() => setHighlight(null)}
            >
              <div>{`${name} (Scenario A)`}</div>
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
                style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#f3f4f6' : 'transparent' }}
                onMouseEnter={() => setHighlight({ scenario: 'B', name })}
                onMouseLeave={() => setHighlight(null)}
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
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '2px solid #e5e7eb', background: '#f8f9fa', fontSize: '14px', color: '#6b7280' }}>
          <div style={{ paddingLeft: '8px' }}>+ Locums (Scenario A)</div>
          {years.map((y, i) => {
            const fy = y === 2025 
              ? { locumDays: 30 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
            return <div key={`LA-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = y === 2025 
                ? { locumDays: 30 } // 2025 default
                : store.scenarioA.future.find(f => f.year === y)
              return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
            }, 0))}
          </div>
        </div>
        {store.scenarioBEnabled && store.scenarioB && (
          <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #e5e7eb', background: '#f8f9fa', fontSize: '14px', color: '#6b7280' }}>
            <div style={{ paddingLeft: '8px' }}>+ Locums (Scenario B)</div>
            {years.map((y, i) => {
              const fy = y === 2025 
                ? { locumDays: 30 } // 2025 default
                : store.scenarioB!.future.find(f => f.year === y)
              const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
              return <div key={`LB-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumDays: 30 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
              }, 0))}
            </div>
          </div>
        )}

        {/* Scenario A Total row */}
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '2px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>Scenario A (Total)</div>
          {years.map((y) => {
            const totalComp = perYearA.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = y === 2025 
              ? { locumDays: 30 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearA.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumDays: 30 } // 2025 default
                  : store.scenarioA.future.find(f => f.year === y)
                return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B Total row */}
        {store.scenarioBEnabled && store.scenarioB && perYearB && (
          <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
            <div>Scenario B (Total)</div>
            {years.map((y) => {
              const totalComp = perYearB.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
              const fy = y === 2025 
                ? { locumDays: 30 } // 2025 default
                : store.scenarioB!.future.find(f => f.year === y)
              const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
              return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(
                perYearB.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                years.reduce((total, y) => {
                  const fy = y === 2025 
                    ? { locumDays: 30 } // 2025 default
                    : store.scenarioB!.future.find(f => f.year === y)
                  return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
                }, 0)
              )}
            </div>
          </div>
        )}
      </div>

      {/* Per Scenario by Year table */}
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
          <div key={`SA-${name}`} style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '1px solid #f0f0f0' : '1px solid #f8f8f8', background: '#f9fafb' }}>
            <div style={{ paddingLeft: '8px' }}>{name} (A)</div>
            {years.map((y) => {
              const found = perYearA.find((py) => py.year === y)?.comps.find((c) => c.name === name)
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
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: '#f9fafb', fontSize: '14px', color: '#6b7280' }}>
          <div style={{ paddingLeft: '16px' }}>+ Locums (A)</div>
          {years.map((y, i) => {
            const fy = y === 2025 
              ? { locumDays: 30 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
            return <div key={`SAL-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = y === 2025 
                ? { locumDays: 30 } // 2025 default
                : store.scenarioA.future.find(f => f.year === y)
              return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
            }, 0))}
          </div>
        </div>

        {/* Scenario A - Total including locums */}
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>Scenario A (Total)</div>
          {years.map((y) => {
            const totalComp = perYearA.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = y === 2025 
              ? { locumDays: 30 } // 2025 default
              : store.scenarioA.future.find(f => f.year === y)
            const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearA.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = y === 2025 
                  ? { locumDays: 30 } // 2025 default
                  : store.scenarioA.future.find(f => f.year === y)
                return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B rows - only if enabled */}
        {store.scenarioBEnabled && store.scenarioB && perYearB && (
          <>
            {/* Scenario B - Individual physicians */}
            {allNames.map((name, idx) => (
              <div key={`SB-${name}`} style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '2px solid #e5e7eb' : '1px solid #f8f8f8', background: '#faf9f7' }}>
                <div style={{ paddingLeft: '8px' }}>{name} (B)</div>
                {years.map((y) => {
                  const found = perYearB.find((py) => py.year === y)?.comps.find((c) => c.name === name)
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
            <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: '#faf9f7', fontSize: '14px', color: '#6b7280' }}>
              <div style={{ paddingLeft: '16px' }}>+ Locums (B)</div>
              {years.map((y, i) => {
                const fy = y === 2025 
                  ? { locumDays: 30 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
                return <div key={`SBL-${i}`} style={{ textAlign: 'right' }}>{currency(locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(years.reduce((total, y) => {
                  const fy = y === 2025 
                    ? { locumDays: 30 } // 2025 default
                    : store.scenarioB!.future.find(f => f.year === y)
                  return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
                }, 0))}
              </div>
            </div>

            {/* Scenario B - Total including locums */}
            <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
              <div>Scenario B (Total)</div>
              {years.map((y) => {
                const totalComp = perYearB.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
                const fy = y === 2025 
                  ? { locumDays: 30 } // 2025 default
                  : store.scenarioB!.future.find(f => f.year === y)
                const locumCost = (fy?.locumDays ?? 0) * LOCUM_DAY_RATE
                return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(
                  perYearB.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                  years.reduce((total, y) => {
                    const fy = y === 2025 
                      ? { locumDays: 30 } // 2025 default
                      : store.scenarioB!.future.find(f => f.year === y)
                    return total + ((fy?.locumDays ?? 0) * LOCUM_DAY_RATE)
                  }, 0)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}



function ParametersSummary() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()

  const buildYearData = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const historic2025 = store.historic.find((h) => h.year === 2025)!
    const years = [2025, ...sc.future.map((f) => f.year)]
    return years.map((year) => {
      if (year === 2025) {
        return {
          year,
          totalIncome: historic2025.totalIncome,
          nonEmploymentCosts: historic2025.nonEmploymentCosts,
          nonMdEmploymentCosts: DEFAULT_NON_MD_EMPLOYMENT_COSTS_BASE,
          locumDays: 30,
          miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
          physicians: scenarioADefaultsByYear(2025),
        } as FutureYear
      }
      return sc.future.find((f) => f.year === year) as FutureYear
    })
  }

    const renderScenario = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const data = buildYearData(scenario)
    const maxPhysicians = Math.max(...data.map((d) => d.physicians.length))
    const labelColWidth = 150
    const yearColWidth = 135
    const columnGap = 4
    return (
      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb', maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Scenario {scenario} Parameters</div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            Growth — Income: {sc.projection.incomeGrowthPct}% · Cost: {sc.projection.costGrowthPct}%
          </div>
        </div>

        <div style={{ marginTop: 6, overflowX: isMobile ? 'auto' : 'visible' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Per-year core values</div>
          <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, rowGap: 2, alignItems: 'start', fontSize: 13, fontVariantNumeric: 'tabular-nums' as any }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' }}>Metric</div>
            {data.map((d) => (
              <div key={`hdr-${scenario}-${d.year}`} style={{ fontWeight: 600, textAlign: 'left' }}>{d.year}</div>
            ))}
            <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Income</div>
            {data.map((d) => (
              <div key={`inc-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{currency(Math.round(d.totalIncome))}</div>
            ))}
            <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Non-Employment</div>
            {data.map((d) => (
              <div key={`nec-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{currency(Math.round(d.nonEmploymentCosts))}</div>
            ))}
            <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Non‑MD Employment</div>
            {data.map((d) => (
              <div key={`nmd-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{currency(Math.round(d.nonMdEmploymentCosts))}</div>
            ))}
            <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Locums</div>
            {data.map((d) => (
              <div key={`loc-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{`${d.locumDays} d (${currencyShort(d.locumDays * LOCUM_DAY_RATE)})`}</div>
            ))}
            <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Misc Employment</div>
            {data.map((d) => (
              <div key={`msc-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{currency(Math.round(d.miscEmploymentCosts))}</div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8, overflowX: isMobile ? 'auto' : 'visible' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Physicians per year</div>
          <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, rowGap: 3, fontSize: 13, alignItems: 'center', fontVariantNumeric: 'tabular-nums' as any }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Slot</div>
            {data.map((d) => (
              <div key={`ph-h-${scenario}-${d.year}`} style={{ textAlign: 'left', fontWeight: 600 }}>{d.year}</div>
            ))}
            {Array.from({ length: maxPhysicians }).map((_, rowIdx) => (
              <Fragment key={`row-${scenario}-${rowIdx}`}>
                <div style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>#{rowIdx + 1}</div>
                {data.map((d) => {
                  const p = d.physicians[rowIdx]
                  if (!p) return <div key={`cell-${scenario}-${d.year}-${rowIdx}`} />
                  const role = p.type === 'partner' ? 'P' : p.type === 'employee' ? 'E' : 'M'
                  const tokens: string[] = [abbreviatePhysicianName(p.name), role]
                  
                  if (p.type === 'employeeToPartner') {
                    const empPct = Math.round((p.employeePortionOfYear ?? 0.5) * 100)
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const pctLabel = empPct === 50 ? '50/50' : `${empPct}%E`
                    const payTime = sal && wk ? `${sal}/${wk}` : sal || wk
                    const detail = payTime ? `${pctLabel} ${payTime}` : pctLabel
                    tokens.push(detail)
                  } else if (p.type === 'employee') {
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    if (sal) tokens.push(sal)
                  } else if (p.type === 'partner') {
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    if (wk) tokens.push(wk)
                  }
                  return (
                    <div key={`cell-${scenario}-${d.year}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: '24px 12px 1fr', gap: 2, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{tokens[0]}</span>
                      <span style={{ color: '#6b7280' }}>{tokens[1] || ''}</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{tokens[2] || ''}</span>
                    </div>
                  )
                })}
              </Fragment>
            ))}
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
