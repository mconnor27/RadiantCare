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

export type PhysicianType = 'partner' | 'employee'

export type Physician = {
  id: string
  name: string
  type: PhysicianType
  salary?: number
  weeksVacation?: number
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

function defaultPhysiciansGeneric(year: number): Physician[] {
  return [
    { id: `${year}-P1`, name: 'Physician 1', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P2`, name: 'Physician 2', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P3`, name: 'Physician 3', type: 'partner', weeksVacation: 4 },
    { id: `${year}-E1`, name: 'Physician 4', type: 'employee', salary: 250000 },
  ]
}

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
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 550000 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 550000 },
    ]
  }
  if (year === 2027) {
    return [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8 },
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 575000 },
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
    locumDays: 30,
    miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
  }
})

const INITIAL_FUTURE_YEARS_A: FutureYear[] = FUTURE_YEARS_BASE.map((b) => ({
  ...b,
  physicians: scenarioADefaultsByYear(b.year),
}))

/* Generic template for alternative scenarios if needed */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore: kept for future use
const INITIAL_FUTURE_YEARS_GENERIC: FutureYear[] = FUTURE_YEARS_BASE.map((b) => ({
  ...b,
  physicians: defaultPhysiciansGeneric(b.year),
}))
/* eslint-enable @typescript-eslint/no-unused-vars */

export const useDashboardStore = create<Store>()(
  persist(
    immer<Store>((set, get) => {
      void get
      return {
        historic: HISTORIC_DATA,
        scenarioA: {
          future: INITIAL_FUTURE_YEARS_A,
          projection: { incomeGrowthPct: 0, costGrowthPct: 0 },
          selectedYear: FUTURE_YEARS_BASE[0].year,
        },
        scenarioB: undefined,
        scenarioBEnabled: false,
        setScenarioEnabled: (enabled) =>
          set((state) => {
            state.scenarioBEnabled = enabled
            if (enabled) {
              const cloned = JSON.parse(
                JSON.stringify(state.scenarioA)
              ) as ScenarioState
              state.scenarioB = {
                future: cloned.future,
                projection: { ...cloned.projection },
                selectedYear: state.scenarioA.selectedYear,
              }
            } else {
              state.scenarioB = undefined
            }
          }),
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
            const idx = fy.physicians.findIndex((p) => p.id === physician.id)
            if (idx >= 0) fy.physicians[idx] = physician
            else fy.physicians.push(physician)
          }),
        removePhysician: (scenario, year, physicianId) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return
            fy.physicians = fy.physicians.filter((p) => p.id !== physicianId)
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
        resetToDefaults: () =>
          set((state) => {
            state.scenarioA = {
              future: INITIAL_FUTURE_YEARS_A.map((f) => ({ ...f, physicians: [...f.physicians] })),
              projection: { incomeGrowthPct: 0, costGrowthPct: 0 },
              selectedYear: FUTURE_YEARS_BASE[0].year,
            }
            state.scenarioBEnabled = false
            state.scenarioB = undefined
          }, false),
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
}, 0)

function currency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
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
    const partners = fy.physicians.filter((p) => p.type === 'partner')
    const employees = fy.physicians.filter((p) => p.type === 'employee')
    const totalEmployeeSalary = employees.reduce(
      (sum, e) => sum + (e.salary ?? 0),
      0
    )
    const totalCosts = fy.nonEmploymentCosts + fy.nonMdEmploymentCosts + fy.miscEmploymentCosts + (fy.locumDays * LOCUM_DAY_RATE) + totalEmployeeSalary
    const pool = Math.max(0, fy.totalIncome - totalCosts)
    if (partners.length === 0) return []
    const partnerFTEs = partners.map((p) => {
      const weeks = clamp(p.weeksVacation ?? 0, 0, 16)
      const fte = 1 - weeks / 52
      return { p, weight: fte }
    })
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
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
          style={{ width: 140 }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: '14px', color: '#666', width: '16px', height: '16px', textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('income-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'income-tooltip'
            tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
            tooltip.textContent = 'Gross (Therapy and Other)'
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => { const t = document.getElementById('income-tooltip'); if (t) t.remove() }}
        >ℹ</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Non-Employment Costs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
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
          style={{ width: 140 }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('nonemp-tooltip'); if (existing) existing.remove();
            const tooltip = document.createElement('div'); tooltip.id = 'nonemp-tooltip';
            tooltip.style.cssText = 'position:absolute;background:#333;color:#fff;padding:8px 12px;border-radius:4px;font-size:12px;white-space:pre-line;z-index:1000;max-width:360px;box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none;';
            tooltip.textContent = 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense';
            document.body.appendChild(tooltip);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            tooltip.style.left = `${rect.right + 10}px`; tooltip.style.top = `${rect.top + window.scrollY}px`;
          }}
          onMouseLeave={() => { const t = document.getElementById('nonemp-tooltip'); if (t) t.remove(); }}
        >ℹ</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Non‑MD Employment Costs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
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
          style={{ width: 140 }}
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

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Locum's Costs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
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
          value={`${currency(Math.round(fy.locumDays * LOCUM_DAY_RATE))} — ${fy.locumDays} days`}
          readOnly
          style={{ width: 200 }}
        />
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'help', fontSize: 14, color: '#666', width: 16, height: 16, textAlign: 'center', lineHeight: '16px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('locums-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'locums-tooltip'
            tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
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
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{ width: 140 }}
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
                <div style={{ textAlign: 'right' }}>{currency(p.comp)}</div>
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
          gridTemplateColumns: '1fr 110px 1fr 20px 20px',
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
            })
          }
          disabled={readOnly}
        >
          <option value="partner">Partner</option>
          <option value="employee">Employee</option>
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
                style={{ width: 120 }}
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
        ) : (
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
                style={{ width: 120 }}
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
            const numPartners = fy.physicians.filter((x) => x.type === 'partner').length
            const type: PhysicianType = numPartners < 3 ? 'partner' : 'employee'
            store.upsertPhysician(scenario, year, {
              id: `${year}-${nextIndex}`,
              name: `Physician ${nextIndex + 1}`,
              type,
              salary: type === 'employee' ? 250000 : undefined,
              weeksVacation: type === 'partner' ? 4 : undefined,
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
  const partnerComp = (() => {
    const partners = fy!.physicians.filter((p) => p.type === 'partner')
    const employees = fy!.physicians.filter((p) => p.type === 'employee')
    const totalEmployeeCosts = employees.reduce(
      (sum, e) => sum + calculateEmployeeTotalCost(e),
      0
    )
    const pool = year === 2025
      ? NET_PARTNER_POOL_2025
      : Math.max(0, fy!.totalIncome - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + (fy!.locumDays * LOCUM_DAY_RATE) + totalEmployeeCosts))
    const parts = partners.map((p) => ({
      p,
      weight: 1 - clamp(p.weeksVacation ?? 0, 0, 16) / 52,
    }))
    const totalWeight = parts.reduce((s, x) => s + x.weight, 0) || 1
    return parts.map(({ p, weight }) => ({ id: p.id, name: p.name, type: 'partner' as const, comp: (weight / totalWeight) * pool }))
  })()
  const employees = fy!.physicians
    .filter((p) => p.type === 'employee')
    .map((e) => ({ id: e.id, name: e.name, type: 'employee' as const, comp: e.salary ?? 0 }))
  return [...partnerComp, ...employees]
}

function YearOnYearControls({ scenario }: { scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  
  if (!sc) return null
  
  return (
    <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f8f9fa', borderRadius: 4, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Year-over-Year Growth</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              style={{ width: 56, fontSize: 14 }}
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
              style={{ width: 56, fontSize: 14 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoricAndProjectionChart() {
  const store = useDashboardStore()
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
    const md = f.physicians.filter(p => p.type === 'employee').reduce((s,e) => s + (e.salary ?? 0), 0)
    return md + f.nonMdEmploymentCosts
  })
  const scBIncome = store.scenarioB?.future.map(f => f.totalIncome) || []
  const scBCosts = store.scenarioB?.future.map(f => f.nonEmploymentCosts) || []
  const scBEmployment = store.scenarioB?.future.map(f => {
    const md = f.physicians.filter(p => p.type === 'employee').reduce((s,e) => s + (e.salary ?? 0), 0)
    return md + f.nonMdEmploymentCosts
  }) || []
  const scANet = store.scenarioA.future.map(f => {
    const md = f.physicians.filter(p => p.type === 'employee').reduce((s,e) => s + (e.salary ?? 0), 0)
    return f.totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - (f.locumDays * LOCUM_DAY_RATE) - md
  })
  const scBNet = store.scenarioB?.future.map(f => {
    const md = f.physicians.filter(p => p.type === 'employee').reduce((s,e) => s + (e.salary ?? 0), 0)
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
        minWidth: 600,
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
        style={{ width: '100%', height: 420 }}
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
    <div style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16, maxWidth: store.scenarioBEnabled ? 'none' : 1000, margin: store.scenarioBEnabled ? '0' : '0 auto' }}>
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

        <div style={{
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
    </div>
  )
}

function OverallCompensationSummary() {
  const store = useDashboardStore()
  const years = [2025, ...store.scenarioA.future.map((f) => f.year)]
  const perYearA = years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') }))
  const perYearB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'B') }))
    : undefined
  // const totalPerYear = perYear.map(({ year, comps }) => ({ year, total: comps.reduce((s, c) => s + c.comp, 0) }))

  const allNames = Array.from(new Set(perYearA.flatMap((y) => y.comps.map((c) => c.name))))
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

  const [highlight, setHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const isHighlighted = (scenario: 'A' | 'B', name: string) =>
    highlight ? highlight.scenario === scenario && highlight.name === name : true

  // Compute net income (partner pool) per year for each scenario
  const netIncomeA = years.map((y) => {
    if (y === 2025) return NET_PARTNER_POOL_2025
    const fy = store.scenarioA.future.find((f) => f.year === y)!
    const md = fy.physicians.filter((p) => p.type === 'employee').reduce((s, e) => s + (e.salary ?? 0), 0)
    return (
      fy.totalIncome - fy.nonEmploymentCosts - fy.nonMdEmploymentCosts - fy.miscEmploymentCosts - fy.locumDays * LOCUM_DAY_RATE - md
    )
  })
  const netIncomeB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        if (y === 2025) return NET_PARTNER_POOL_2025
        const fy = store.scenarioB!.future.find((f) => f.year === y)!
        const md = fy.physicians.filter((p) => p.type === 'employee').reduce((s, e) => s + (e.salary ?? 0), 0)
        return (
          fy.totalIncome - fy.nonEmploymentCosts - fy.nonMdEmploymentCosts - fy.miscEmploymentCosts - fy.locumDays * LOCUM_DAY_RATE - md
        )
      })
    : []

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
                })
              }
            }
            return rows
          })() as any}
          layout={{
            title: { text: 'Compensation per Physician (by year)', font: { size: 14 } },
            margin: { l: 48, r: 8, t: 28, b: 72 },
            yaxis: { tickprefix: '$', separatethousands: true },
            xaxis: { dtick: 1 },
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.08, yanchor: 'top' },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler={true}
          style={{ width: '100%', height: 420 }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
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

        {/* Net Income total row(s) */}
        <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '2px solid #e5e7eb', background: '#eef7ee', fontWeight: 700 }}>
          <div>Net Income (Scenario A)</div>
          {netIncomeA.map((v, i) => (
            <div key={`NA-${i}`} style={{ textAlign: 'right' }}>{currency(v)}</div>
          ))}
          <div style={{ textAlign: 'right' }}>{currency(netIncomeA.reduce((a, b) => a + b, 0))}</div>
        </div>
        {store.scenarioBEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ee', fontWeight: 700 }}>
            <div>Net Income (Scenario B)</div>
            {netIncomeB.map((v, i) => (
              <div key={`NB-${i}`} style={{ textAlign: 'right' }}>{currency(v)}</div>
            ))}
            <div style={{ textAlign: 'right' }}>{currency(netIncomeB.reduce((a, b) => a + b, 0))}</div>
          </div>
        )}
      </div>
    </div>
  )
}


