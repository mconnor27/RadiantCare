import { useMemo, useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import YTDDetailed from './dashboard/views/detailed/YTDDetailed'
import MultiYearView from './dashboard/views/multi-year/MultiYearView'
// Import types from types.ts to avoid duplication and binding conflicts
import type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey, Store } from './dashboard/shared/types'

// Re-export types for backward compatibility with extracted components
export type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey }
import {
  clamp
} from './dashboard/shared/utils'
import { useIsMobile } from './dashboard/shared/hooks'
import {
  computeDefaultNonMdEmploymentCosts,
  calculateEmployeeTotalCost,
  calculateDelayedW2Payment,
  calculateMedicalDirectorHourPercentages,
  getEmployeePortionOfYear,
  getPartnerPortionOfYear,
  getPartnerFTEWeight,
  getTotalIncome,
  getBenefitCostsForYear
} from './dashboard/shared/calculations'
import { getDefaultTrailingSharedMdAmount } from './dashboard/shared/tooltips'
import {
  HISTORIC_DATA,
  scenario2024Defaults,
  scenarioADefaultsByYear,
  scenarioBDefaultsByYear,
  DEFAULT_MISC_EMPLOYMENT_COSTS,
  DEFAULT_CONSULTING_SERVICES_2024,
  DEFAULT_CONSULTING_SERVICES_2025,
  ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
  ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
  ACTUAL_2024_PARTNER_POOL,
  ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
  DEFAULT_MD_SHARED_PROJECTION,
  DEFAULT_MD_PRCS_PROJECTION,
  DEFAULT_LOCUM_COSTS_2025,
  DEFAULT_LOCUM_COSTS_2026,
  ACTUAL_2024_LOCUM_COSTS,
  DEFAULT_THERAPY_INCOME_2025,
  DEFAULT_NON_EMPLOYMENT_COSTS_2025,
  PROJECTION_DEFAULTS,
  ANNUAL_BENEFITS_FULLTIME,
  // Removed NET_PARTNER_POOL_2025 import - now calculating dynamically
  INITIAL_FUTURE_YEARS_A,
  INITIAL_FUTURE_YEARS_B
} from './dashboard/shared/defaults'



export const useDashboardStore = create<Store>()(
  persist(
    immer<Store>((set, get) => {
      void get
      return {
        historic: HISTORIC_DATA,
        scenarioA: {
          future: INITIAL_FUTURE_YEARS_A,
          projection: {
            incomeGrowthPct: PROJECTION_DEFAULTS.A.incomeGrowthPct,
            medicalDirectorHours: PROJECTION_DEFAULTS.A.medicalDirectorHours,
            prcsMedicalDirectorHours: PROJECTION_DEFAULTS.A.prcsMedicalDirectorHours,
            consultingServicesAgreement: PROJECTION_DEFAULTS.A.consultingServicesAgreement,
            nonEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonEmploymentCostsPct, 
            nonMdEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonMdEmploymentCostsPct, 
            locumsCosts: PROJECTION_DEFAULTS.A.locumsCosts, 
            miscEmploymentCostsPct: PROJECTION_DEFAULTS.A.miscEmploymentCostsPct, 
            benefitCostsGrowthPct: PROJECTION_DEFAULTS.A.benefitCostsGrowthPct 
          },
          selectedYear: 2025, // Default to Baseline tab
          dataMode: '2025 Data',
        },
        scenarioB: undefined,
        scenarioBEnabled: false,
        customProjectedValues: {},
        setScenarioEnabled: (enabled) => {
          set((state) => {
            state.scenarioBEnabled = enabled
            if (enabled) {
              // Initialize scenario B with its own defaults instead of cloning A
              state.scenarioB = {
                future: INITIAL_FUTURE_YEARS_B.map((f) => ({ ...f, physicians: [...f.physicians] })),
                projection: {
                  incomeGrowthPct: PROJECTION_DEFAULTS.B.incomeGrowthPct,
                  medicalDirectorHours: PROJECTION_DEFAULTS.B.medicalDirectorHours,
                  prcsMedicalDirectorHours: PROJECTION_DEFAULTS.B.prcsMedicalDirectorHours,
                  consultingServicesAgreement: PROJECTION_DEFAULTS.B.consultingServicesAgreement,
                  nonEmploymentCostsPct: PROJECTION_DEFAULTS.B.nonEmploymentCostsPct, 
                  nonMdEmploymentCostsPct: PROJECTION_DEFAULTS.B.nonMdEmploymentCostsPct, 
                  locumsCosts: PROJECTION_DEFAULTS.B.locumsCosts, 
                  miscEmploymentCostsPct: PROJECTION_DEFAULTS.B.miscEmploymentCostsPct,
                  benefitCostsGrowthPct: PROJECTION_DEFAULTS.B.benefitCostsGrowthPct
                },
                selectedYear: state.scenarioA.selectedYear,
                dataMode: '2024 Data',
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
        
        setPrcsDirector: (scenario, year, physicianId) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return
            // Determine selected physician's name in the source year (for cross-year mapping)
            const selectedName = physicianId
              ? fy.physicians.find((p) => p.id === physicianId)?.name
              : undefined

            // Propagate the selection (or deselection) to this and all future years in the scenario
            for (const f of sc.future) {
              if (f.year < year) continue
              if (!physicianId) {
                // Deselect in future years
                f.prcsDirectorPhysicianId = undefined
                continue
              }
              // Map by name to each year's physician id, if present
              const match = f.physicians.find((p) => p.name === selectedName && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
              f.prcsDirectorPhysicianId = match ? match.id : undefined
            }
          }),
        setFutureValue: (scenario, year, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (fy) {
              ;(fy as any)[field] = value
              
              // If we're updating a 2025 baseline value, trigger projection recalculation 
              // for future years without switching to Custom mode
              if (year === 2025) {
                setTimeout(() => {
                  get().applyProjectionFromLastActual(scenario)
                }, 0)
              }
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
            // Track previous for change detection
            const prev = previousInYear

            if (idx >= 0) fy.physicians[idx] = physician
            else fy.physicians.push(physician)

            // Determine if this edit was a manual MD percentage adjustment
            const mdPctChanged = !!prev && prev.medicalDirectorHoursPercentage !== physician.medicalDirectorHoursPercentage
            // Determine if partner mix/portion changed requiring auto redistribution
            const prevPartnerPortion = prev ? getPartnerPortionOfYear(prev) : 0
            const newPartnerPortion = getPartnerPortionOfYear(physician)
            const typeChanged = !!prev && prev.type !== physician.type
            const partnerMixChanged = isNewInYear
              ? newPartnerPortion > 0
              : (typeChanged || prevPartnerPortion !== newPartnerPortion)

            if (mdPctChanged) {
              // Proportionally scale other eligible partners to keep total at 100
              const targetId = physician.id
              const eligibles = fy.physicians.filter(p => getPartnerPortionOfYear(p) > 0)
              const target = eligibles.find(p => p.id === targetId)
              if (target) {
                const others = eligibles.filter(p => p.id !== targetId)
                const desiredTargetPct = Math.max(0, Math.min(100, physician.medicalDirectorHoursPercentage ?? 0))
                if (others.length === 0) {
                  target.medicalDirectorHoursPercentage = 100
                  target.hasMedicalDirectorHours = true
                } else {
                  const remaining = Math.max(0, 100 - desiredTargetPct)
                  const sumOtherCurrent = others.reduce((s, p) => s + (p.medicalDirectorHoursPercentage ?? 0), 0)
                  if (sumOtherCurrent > 0) {
                    // Scale by current proportions
                    for (let i = 0; i < others.length; i++) {
                      const p = others[i]
                      const scaled = (p.medicalDirectorHoursPercentage ?? 0) / sumOtherCurrent * remaining
                      p.medicalDirectorHoursPercentage = scaled
                      p.hasMedicalDirectorHours = scaled > 0
                    }
                  } else {
                    // Distribute by partner portion weights; fallback to equal
                    const weights = others.map(p => ({ p, w: getPartnerPortionOfYear(p) }))
                    const sumW = weights.reduce((s, x) => s + x.w, 0)
                    if (sumW > 0) {
                      for (const { p, w } of weights) {
                        const scaled = w / sumW * remaining
                        p.medicalDirectorHoursPercentage = scaled
                        p.hasMedicalDirectorHours = scaled > 0
                      }
                    } else {
                      const even = remaining / others.length
                      for (const p of others) {
                        p.medicalDirectorHoursPercentage = even
                        p.hasMedicalDirectorHours = even > 0
                      }
                    }
                  }
                  // Set target last to the requested value
                  target.medicalDirectorHoursPercentage = desiredTargetPct
                  target.hasMedicalDirectorHours = desiredTargetPct > 0
                }
              }
            } else if (partnerMixChanged) {
              // Only auto-redistribute when partner mix/portion changes
              fy.physicians = calculateMedicalDirectorHourPercentages(fy.physicians)
            }

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
              // Re-apply distribution in future years only when partner mix/portion changed in base year
              if (partnerMixChanged) {
                fut.physicians = calculateMedicalDirectorHourPercentages(fut.physicians)
              }
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
              // Re-distribute medical director hours after removal
              fut.physicians = calculateMedicalDirectorHourPercentages(fut.physicians)
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
            if (field === 'locumsCosts' || field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours' || field === 'consultingServicesAgreement') {
              // Dollar amount fields should use reasonable range
              const maxValue = field === 'medicalDirectorHours' ? 120000 : 
                               field === 'prcsMedicalDirectorHours' ? 120000 :
                               field === 'consultingServicesAgreement' ? 20000 : 1000000
              sc.projection[field] = Math.max(0, Math.min(maxValue, value))
            } else {
              // Percentage fields should be limited to reasonable range (-10% to +20%)
              // Also round to 1 decimal place to avoid floating point artifacts (e.g., 5.700001)
              const clamped = Math.max(-10, Math.min(20, value))
              sc.projection[field] = Math.round(clamped * 10) / 10
            }
            
            // When changing override sliders, force-sync the per-year values so
            // the yearly sliders necessarily move with the projection override.
            if (field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours' || field === 'consultingServicesAgreement') {
              for (const fy of sc.future) {
                ;(fy as any)[field] = sc.projection[field]
              }
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
                  therapyIncome: customBaseline.therapyIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  therapyIncome: last2025?.therapyIncome || DEFAULT_THERAPY_INCOME_2025,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || DEFAULT_NON_EMPLOYMENT_COSTS_2025,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                therapyIncome: last2024.therapyIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
              }
            } else if (last2025) {
              baselineData = {
                therapyIncome: last2025.therapyIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                therapyIncome: DEFAULT_THERAPY_INCOME_2025,
                nonEmploymentCosts: DEFAULT_NON_EMPLOYMENT_COSTS_2025,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            const benefitGrowthPct = sc.projection.benefitCostsGrowthPct
            
            // Starting values from the selected baseline
            let income = baselineData.therapyIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts

            // For staff costs, decompose base (2025) into wages+taxes vs benefits.
            // Always anchor benefits to 2025 base and grow by benefit slider separately from wages+taxes.
            const baseStaff2025 = computeDefaultNonMdEmploymentCosts(2025)
            const baseWagesTaxes2025 = Math.max(0, baseStaff2025 - ANNUAL_BENEFITS_FULLTIME)
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)

              // Compute staff employment costs using split growth: wages+taxes vs benefits
              const yearsSince2025 = fy.year - 2025
              const wagesAndTaxes = baseWagesTaxes2025 * Math.pow(1 + nonMdEmploymentGpct, yearsSince2025)
              const benefits = getBenefitCostsForYear(fy.year, benefitGrowthPct)
              const staffEmploymentCosts = wagesAndTaxes + benefits
              
              fy.therapyIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = staffEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              fy.locumCosts = fy.year === 2026 ? DEFAULT_LOCUM_COSTS_2026 : sc.projection.locumsCosts
              
              // Set consulting services agreement from the global override
              fy.consultingServicesAgreement = sc.projection.consultingServicesAgreement
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
                  therapyIncome: customBaseline.therapyIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  therapyIncome: last2025?.therapyIncome || DEFAULT_THERAPY_INCOME_2025,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || DEFAULT_NON_EMPLOYMENT_COSTS_2025,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                therapyIncome: last2024.therapyIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
              }
            } else if (last2025) {
              baselineData = {
                therapyIncome: last2025.therapyIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                therapyIncome: DEFAULT_THERAPY_INCOME_2025,
                nonEmploymentCosts: DEFAULT_NON_EMPLOYMENT_COSTS_2025,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            const benefitGrowthPct = sc.projection.benefitCostsGrowthPct
            
            // Starting values from the selected baseline
            let income = baselineData.therapyIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts

            // For staff costs, decompose base (2025) into wages+taxes vs benefits.
            const baseStaff2025 = computeDefaultNonMdEmploymentCosts(2025)
            const baseWagesTaxes2025 = Math.max(0, baseStaff2025 - ANNUAL_BENEFITS_FULLTIME)
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)

              // Compute staff employment costs using split growth.
              const yearsSince2025 = fy.year - 2025
              const wagesAndTaxes = baseWagesTaxes2025 * Math.pow(1 + nonMdEmploymentGpct, yearsSince2025)
              const benefits = getBenefitCostsForYear(fy.year, benefitGrowthPct)
              const staffEmploymentCosts = wagesAndTaxes + benefits
              
              fy.therapyIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = staffEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              
              // Set locums costs from the global override (except 2026 which defaults to 60K)
              fy.locumCosts = fy.year === 2026 ? DEFAULT_LOCUM_COSTS_2026 : sc.projection.locumsCosts
              
              // Set consulting services agreement from the global override
              fy.consultingServicesAgreement = sc.projection.consultingServicesAgreement
            }

            // Do not modify PRCS Director assignment during projection recalculation
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
                  therapyIncome: last2024.therapyIncome,
                  nonEmploymentCosts: last2024.nonEmploymentCosts,
                  nonMdEmploymentCosts: ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
                  locumCosts: ACTUAL_2024_LOCUM_COSTS,
                  miscEmploymentCosts: ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
                  physicians: scenario2024Defaults(),
                }
              } else if (sc.dataMode === '2025 Data' && last2025) {
                baselineData = {
                  year: 2025,
                  therapyIncome: last2025.therapyIncome,
                  nonEmploymentCosts: last2025.nonEmploymentCosts,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: DEFAULT_LOCUM_COSTS_2025,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
                }
              } else {
                // Fallback to 2025 defaults
                const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
                const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
                baselineData = {
                  year: 2025,
                  therapyIncome: last2025?.therapyIncome || DEFAULT_THERAPY_INCOME_2025,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || DEFAULT_NON_EMPLOYMENT_COSTS_2025,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: DEFAULT_LOCUM_COSTS_2025,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS, // 2025 shared medical director amount
                  prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS, // 2025 PRCS medical director amount (JS)
                  consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025, // 2025 consulting services amount
                  prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
                  physicians,
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
            
            // If switching AWAY FROM Custom mode, remove the custom baseline data to prevent persistence
            if (mode !== 'Custom' && sc.dataMode === 'Custom') {
              // Remove the custom baseline year (2025) from future years array
              sc.future = sc.future.filter(f => f.year !== 2025)
            }
            
            sc.dataMode = mode
          }),
        loadSnapshot: (snapshot) =>
          set((state) => {
            state.scenarioA = snapshot.scenarioA
            state.scenarioBEnabled = !!snapshot.scenarioBEnabled
            state.scenarioB = snapshot.scenarioBEnabled && snapshot.scenarioB ? snapshot.scenarioB : undefined
          }),
        // Reset physicians for a specific scenario and year to defaults
        resetPhysicians: (scenario: ScenarioKey, year: number) => {
          const defaultPhysicians = scenario === 'A' 
            ? scenarioADefaultsByYear(year) 
            : scenarioBDefaultsByYear(year)
          
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            const futureYear = scenarioState.future.find(f => f.year === year)
            if (!futureYear) return
            
            // Reset to default physicians
            futureYear.physicians = defaultPhysicians.map(p => ({ ...p }))
          })
        },

        // Reset all physicians across all years for a scenario
        resetAllPhysicians: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.future.forEach(fy => {
              const defaultPhysicians = scenario === 'A' 
                ? scenarioADefaultsByYear(fy.year) 
                : scenarioBDefaultsByYear(fy.year)
              fy.physicians = defaultPhysicians.map(p => ({ ...p }))
            })
          })
        },

        // Reset projection settings for a scenario to defaults
        resetProjectionSettings: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.projection = {
              incomeGrowthPct: PROJECTION_DEFAULTS.A.incomeGrowthPct, 
              medicalDirectorHours: PROJECTION_DEFAULTS.A.medicalDirectorHours,
              prcsMedicalDirectorHours: PROJECTION_DEFAULTS.A.prcsMedicalDirectorHours,
              consultingServicesAgreement: PROJECTION_DEFAULTS.A.consultingServicesAgreement,
              nonEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonEmploymentCostsPct, 
              nonMdEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonMdEmploymentCostsPct, 
              locumsCosts: PROJECTION_DEFAULTS.A.locumsCosts, 
              miscEmploymentCostsPct: PROJECTION_DEFAULTS.A.miscEmploymentCostsPct, 
              benefitCostsGrowthPct: PROJECTION_DEFAULTS.A.benefitCostsGrowthPct 
            }
          })
          
          // Recalculate projections after resetting settings
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset year-by-year income/cost values to projected values for a scenario
        resetYearByYearValues: (scenario: ScenarioKey) => {
          // This will reset all custom future values back to projected values
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset app-level view settings (which year selected, data mode, etc.)
        resetViewSettings: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.selectedYear = 2025 // Reset to Baseline tab
            scenarioState.dataMode = '2025 Data'
          })
        },

        resetToDefaults: () => {
          set((state) => {
            // Initialize scenario A with basic structure
            state.scenarioA = {
              future: INITIAL_FUTURE_YEARS_A.map((f) => ({ 
                ...f, 
                physicians: [...f.physicians.map(p => ({ ...p }))] 
              })),
              projection: { 
                incomeGrowthPct: PROJECTION_DEFAULTS.A.incomeGrowthPct, 
                medicalDirectorHours: PROJECTION_DEFAULTS.A.medicalDirectorHours,
                prcsMedicalDirectorHours: PROJECTION_DEFAULTS.A.prcsMedicalDirectorHours,
                consultingServicesAgreement: PROJECTION_DEFAULTS.A.consultingServicesAgreement,
                nonEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonEmploymentCostsPct, 
                nonMdEmploymentCostsPct: PROJECTION_DEFAULTS.A.nonMdEmploymentCostsPct, 
                locumsCosts: PROJECTION_DEFAULTS.A.locumsCosts, 
                miscEmploymentCostsPct: PROJECTION_DEFAULTS.A.miscEmploymentCostsPct, 
                benefitCostsGrowthPct: PROJECTION_DEFAULTS.A.benefitCostsGrowthPct 
              },
              selectedYear: 2025, // Reset to Baseline tab
              dataMode: '2025 Data',
            }
            
            // Reset app-level state (not handled by section resets)
            state.scenarioBEnabled = false
            state.scenarioB = undefined
            state.customProjectedValues = {}
          }, false)

          // Use the dedicated reset functions to ensure consistency
          const state = get()
          state.resetAllPhysicians('A')
          state.resetProjectionSettings('A')
          state.resetYearByYearValues('A')
          state.resetViewSettings('A')
        },

        // Ensure baseline year exists in future years array for PhysiciansEditor
        ensureBaselineYear: (scenario: ScenarioKey, year: number) => {
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // Check if year already exists
            const existing = sc.future.find((f) => f.year === year)
            if (existing) return
            
            // Create baseline entry with defaults - deep copy to avoid reference issues
            const defaultPhysicians = scenario === 'A' 
              ? (sc.dataMode === '2024 Data' ? scenario2024Defaults() : scenarioADefaultsByYear(year))
              : (sc.dataMode === '2024 Data' ? scenario2024Defaults() : scenarioBDefaultsByYear(year))
            const jsPhysician = defaultPhysicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
            
            const baseline: FutureYear = {
              year,
              therapyIncome: state.historic.find(h => h.year === year)?.therapyIncome ?? DEFAULT_THERAPY_INCOME_2025,
              nonEmploymentCosts: state.historic.find(h => h.year === year)?.nonEmploymentCosts ?? DEFAULT_NON_EMPLOYMENT_COSTS_2025,
              nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
              locumCosts: DEFAULT_LOCUM_COSTS_2025,
              miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
              medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
              prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
              consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025,
              prcsDirectorPhysicianId: jsPhysician?.id,
              // Deep copy physicians to avoid reference issues
              physicians: defaultPhysicians.map(p => ({ ...p })),
            }
            
            // Add to the beginning of future years array (since 2025 comes before 2026+)
            sc.future.unshift(baseline)
          })
        },
        
        // Custom projected values management
        setCustomProjectedValue: (accountName: string, value: number) =>
          set((state) => {
            state.customProjectedValues[accountName] = value
          }),
        
        removeCustomProjectedValue: (accountName: string) =>
          set((state) => {
            delete state.customProjectedValues[accountName]
          }),
        
        resetCustomProjectedValues: () =>
          set((state) => {
            state.customProjectedValues = {}
          }),
      }
    }),
    {
      name: 'radiantcare-state-v1',
      storage: createJSONStorage((): Storage => localStorage),
      partialize: (state: Store) => ({
        scenarioA: state.scenarioA,
        scenarioBEnabled: state.scenarioBEnabled,
        scenarioB: state.scenarioB,
        customProjectedValues: state.customProjectedValues,
      }),
    }
  )
)

// Initialize projections on store creation
setTimeout(() => {
  const store = useDashboardStore.getState()
  store.applyProjectionFromLastActual('A')
  if (store.scenarioB) store.applyProjectionFromLastActual('B')
}, 0)


export function usePartnerComp(year: number, scenario: ScenarioKey) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode
  return useMemo(() => {
    // For baseline year (2025): always derive from the selected data mode unless in Custom.
    // This avoids stale Custom state (e.g., a persisted 2025 entry in future years) from skewing baseline.
    if (year === 2025 && dataMode !== 'Custom') {
      // Get the baseline scenario data which includes PRCS director assignment
      const baselineData = (() => {
        const last2024 = store.historic.find(h => h.year === 2024)
        const last2025 = store.historic.find(h => h.year === 2025)
        
        if (dataMode === '2024 Data' && last2024) {
          const physicians = scenario2024Defaults()
          const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
            prcsMedicalDirectorHours: ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
            consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2024, // 2024 consulting services amount
            prcsDirectorPhysicianId: js?.id,
            physicians,
          }
        } else if (dataMode === '2025 Data' && last2025) {
          // Prefer baseline edits from store future[2025] so YTD edits reflect here
          const storeFy2025 = sc.future.find((f) => f.year === 2025)
          const defaultPhysicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const physicians = storeFy2025?.physicians ?? defaultPhysicians
          const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
            prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
            consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025, // 2025 consulting services amount
            prcsDirectorPhysicianId: storeFy2025?.prcsDirectorPhysicianId ?? js?.id,
            physicians,
          }
        } else {
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
            prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
            consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025, // 2025 consulting services amount (fallback)
            prcsDirectorPhysicianId: js?.id,
            physicians,
          }
        }
      })()
      
      const partners = baselineData.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
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
      
      // Calculate Medical Director income allocations first for 2025 baseline
      const medicalDirectorIncome = baselineData.medicalDirectorHours
      const prcsMedicalDirectorIncome = baselineData.prcsMedicalDirectorHours
      
      // Calculate direct Medical Director allocations to partners
      const partnerMedicalDirectorAllocations = new Map<string, number>()
      
      // Allocate shared Medical Director income based on percentages
      for (const partner of partners) {
        if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
          const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
          partnerMedicalDirectorAllocations.set(partner.id, allocation)
        }
      }
      
      // Allocate PRCS Medical Director income directly to the assigned physician
      if (baselineData.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
        const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(baselineData.prcsDirectorPhysicianId) ?? 0
        partnerMedicalDirectorAllocations.set(baselineData.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
      }
      
      // Calculate total Medical Director allocations to subtract from pool
      const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
      
      // Calculate partner pool dynamically based on data mode
      const historic2025 = store.historic.find(h => h.year === 2025)!
      const dynamicNetIncome2025 = getTotalIncome(historic2025) - historic2025.nonEmploymentCosts - (historic2025.employeePayroll ?? 0)
      const basePool = dataMode === '2024 Data' ? ACTUAL_2024_PARTNER_POOL : dynamicNetIncome2025
      // Dynamic net income is already net of all costs, so only subtract buyouts and MD allocations
      // delayedW2Costs are already accounted for in the net pool
      const adjustedPool = Math.max(0, basePool - buyoutCosts - totalMedicalDirectorAllocations)
      
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
          comp: (weight / totalWeight) * adjustedPool + (partnerMedicalDirectorAllocations.get(p.id) ?? 0) + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0) + 
                // Add trailing shared MD amount for prior-year retirees
                (p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0 ? (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)) : 0)
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
    // Calculate Medical Director income allocations first
            const medicalDirectorIncome = fy.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION
            const prcsMedicalDirectorIncome = fy.prcsDirectorPhysicianId ? (fy.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION) : 0
    
    // Calculate direct Medical Director allocations to partners
    const partnerMedicalDirectorAllocations = new Map<string, number>()
    
    // Allocate shared Medical Director income based on percentages
    for (const partner of partners) {
      if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
        const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
        partnerMedicalDirectorAllocations.set(partner.id, allocation)
      }
    }
    
    // Allocate PRCS Medical Director income directly to the assigned physician
    if (fy.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
      const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(fy.prcsDirectorPhysicianId) ?? 0
      partnerMedicalDirectorAllocations.set(fy.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
    }
    
    // Calculate total Medical Director allocations to subtract from pool
    const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
    
    const totalCosts = fy.nonEmploymentCosts + fy.nonMdEmploymentCosts + fy.miscEmploymentCosts + fy.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs
    const basePool = Math.max(0, fy.therapyIncome - totalCosts)
    
    // Subtract Medical Director allocations from the pool to get the FTE-distributable pool
    const pool = Math.max(0, basePool - totalMedicalDirectorAllocations)
    
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
        comp: (weight / totalWeight) * pool + (partnerMedicalDirectorAllocations.get(p.id) ?? 0) + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0) +
              // Add trailing shared MD amount for prior-year retirees
              (p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0 ? (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)) : 0),
      }))
  }, [fy, sc, dataMode, store])
}

// Helper function to check if physicians have been changed from defaults
export function arePhysiciansChanged(
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
      current.hasMedicalDirectorHours !== (defaultPhysician as any).hasMedicalDirectorHours ||
      current.medicalDirectorHoursPercentage !== (defaultPhysician as any).medicalDirectorHoursPercentage ||
      current.buyoutCost !== defaultPhysician.buyoutCost ||
      current.trailingSharedMdAmount !== defaultPhysician.trailingSharedMdAmount
    ) {
      return true
    }
  }
  
  // Include PRCS director selection and PRCS amount override in change detection
  try {
    const sc = scenario === 'A' ? _store.scenarioA : _store.scenarioB
    const fy = sc?.future.find((f: any) => f.year === year)
    
    // For baseline years (2025), compare against actual values, not projection defaults
    const defaultPrcsMedicalDirectorHours = year === 2025 
      ? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS
      : (sc?.projection?.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION)
    
    const currentPrcs = fy?.prcsMedicalDirectorHours ?? defaultPrcsMedicalDirectorHours
    const amountChanged = Math.abs(currentPrcs - defaultPrcsMedicalDirectorHours) > 100 // small threshold for $ changes

    // Determine default PRCS director for this year (JS from 2024+ if present in defaults)
    const jsDefault = year >= 2024
      ? defaultPhysicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
      : undefined
    const defaultDirectorId = jsDefault?.id
    const selectionChanged = (fy?.prcsDirectorPhysicianId ?? undefined) !== (defaultDirectorId ?? undefined)

    if (amountChanged || selectionChanged) return true
  } catch {}

  return false
}

export function computeAllCompensationsForYear(year: number, scenario: ScenarioKey) {
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  // Try to find the future year; if not found and year is 2025, build a synthetic year from historic actuals
  let fy = sc.future.find((f) => f.year === year) as FutureYear | undefined
  // For the multi-year summary tables, ALWAYS use true 2025 actuals for the 2025 column
  if (year === 2025) {
    const last2025 = state.historic.find((h) => h.year === 2025)
    if (last2025) {
      const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
      const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
      fy = {
        year: 2025,
        therapyIncome: last2025.therapyIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS, // 2025 shared medical director amount
        prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS, // 2025 PRCS medical director amount (JS)
        consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025, // 2025 consulting services amount
        prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
        physicians,
      }
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

  // Calculate Medical Director income allocations first
  const medicalDirectorIncome = fy!.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION
  const prcsMedicalDirectorIncome = fy!.prcsDirectorPhysicianId ? (fy!.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION) : 0
  
  // Calculate direct Medical Director allocations to partners
  const partnerMedicalDirectorAllocations = new Map<string, number>()
  
  // Allocate shared Medical Director income based on percentages
  for (const partner of partners) {
    if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
      const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
      partnerMedicalDirectorAllocations.set(partner.id, allocation)
    }
  }
  
  // Allocate PRCS Medical Director income directly to the assigned physician
  if (fy!.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
    const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(fy!.prcsDirectorPhysicianId) ?? 0
    partnerMedicalDirectorAllocations.set(fy!.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
  }
  
  // Calculate total Medical Director allocations to subtract from pool
  const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
  
  // Calculate partner pool excluding Medical Director income that's directly allocated
  const basePool = year === 2025
    ? (() => {
        const historic2025 = state.historic.find(h => h.year === 2025)!
        const dynamicNetIncome2025 = getTotalIncome(historic2025) - historic2025.nonEmploymentCosts - (historic2025.employeePayroll ?? 0)
        return dynamicNetIncome2025 - totalBuyoutCosts
      })()
    : Math.max(0, fy!.therapyIncome - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + fy!.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs))
    
  // Subtract Medical Director allocations from the pool to get the FTE-distributable pool
  const pool = Math.max(0, basePool - totalMedicalDirectorAllocations)

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
    
    // Add Medical Director income allocation directly to the partner
    const medicalDirectorAllocation = partnerMedicalDirectorAllocations.get(s.id) ?? 0
    comp += medicalDirectorAllocation
    
    if (s.physician.type === 'employeeToPartner') {
      const salaryPortion = (s.physician.salary ?? 0) * getEmployeePortionOfYear(s.physician)
      // Add delayed W2 payments for employeeToPartner physicians
      const delayedW2 = calculateDelayedW2Payment(s.physician, year)
      comp += salaryPortion + delayedW2.amount
    }
    if (s.physician.type === 'partnerToRetire') {
      // Add buyout cost back to retiring partner's total compensation
      comp += s.physician.buyoutCost ?? 0
      // Add trailing shared MD amount for prior-year retirees
      if ((s.physician.partnerPortionOfYear ?? 0) === 0) {
        comp += s.physician.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(s.physician)
      }
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

export function computeAllCompensationsForYearWithRetired(year: number, scenario: ScenarioKey) {
  const regularComps = computeAllCompensationsForYear(year, scenario)
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  let fy = sc.future.find((f) => f.year === year) as FutureYear | undefined
  
  if (!fy && year === 2025) {
    const last2025 = state.historic.find((h) => h.year === 2025)
    // For the multi-year compensation summary, 2025 should always show 2025 actual values
    // regardless of the baseline data mode selection
    if (last2025) {
      const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
      const js = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
      fy = {
        year: 2025,
        therapyIncome: last2025.therapyIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS, // 2025 shared medical director amount
        prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS, // 2025 PRCS medical director amount (JS)
        consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025, // 2025 consulting services amount
        prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
        physicians,
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
    comp: (p.buyoutCost ?? 0) + (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)) // Show buyout amount plus trailing MD amount as their compensation
  }))

  return [...regularComps, ...retiredComps]
}

// Helper function to calculate Net Income for MDs (total partner compensation + locums costs)
export function calculateNetIncomeForMDs(year: number, scenario: ScenarioKey): number {
  // Get all compensations including retired partners
  const allComps = computeAllCompensationsForYearWithRetired(year, scenario)
  const totalComp = allComps.reduce((sum, c) => sum + c.comp, 0)
  
  // Get locums costs for the year (matching the table logic exactly)
  const store = useDashboardStore.getState()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find(f => f.year === year)
  const locumCost = year === 2025 
    ? DEFAULT_LOCUM_COSTS_2025 // 2025 default
    : (fy?.locumCosts ?? 0)
  
  return totalComp + locumCost
}

// Calculate projected values based on scenario settings
export function calculateProjectedValue(
  scenario: ScenarioKey,
  year: number,
  field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'miscEmploymentCosts',
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
        therapyIncome: customBaseline.therapyIncome,
        nonEmploymentCosts: customBaseline.nonEmploymentCosts,
        miscEmploymentCosts: customBaseline.miscEmploymentCosts,
        nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
      }
    } else {
      const last2025 = store.historic.find((h: any) => h.year === 2025)
      baselineData = {
        therapyIncome: last2025?.therapyIncome || DEFAULT_THERAPY_INCOME_2025,
        nonEmploymentCosts: last2025?.nonEmploymentCosts || DEFAULT_NON_EMPLOYMENT_COSTS_2025,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }
  } else if (sc.dataMode === '2024 Data') {
    const last2024 = store.historic.find((h: any) => h.year === 2024)!
    baselineData = {
      therapyIncome: last2024.therapyIncome,
      nonEmploymentCosts: last2024.nonEmploymentCosts,
      miscEmploymentCosts: ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
    }
  } else if (sc.dataMode === '2025 Data') {
    const last2025 = store.historic.find((h: any) => h.year === 2025)!
    baselineData = {
      therapyIncome: last2025.therapyIncome,
      nonEmploymentCosts: last2025.nonEmploymentCosts,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  } else {
    baselineData = {
      therapyIncome: DEFAULT_THERAPY_INCOME_2025,
      nonEmploymentCosts: DEFAULT_NON_EMPLOYMENT_COSTS_2025,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  }

  // Convert percentage growth rates to decimal multipliers
  const incomeGpct = sc.projection.incomeGrowthPct / 100
  const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
  const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
  const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
  const benefitGrowthPct = sc.projection.benefitCostsGrowthPct

  // Calculate projected value for the specific year
  const yearsSinceBaseline = year - 2025
  if (field === 'therapyIncome') {
    return baselineData.therapyIncome * Math.pow(1 + incomeGpct, yearsSinceBaseline)
  } else if (field === 'nonEmploymentCosts') {
    return baselineData.nonEmploymentCosts * Math.pow(1 + nonEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'miscEmploymentCosts') {
    return baselineData.miscEmploymentCosts * Math.pow(1 + miscEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'nonMdEmploymentCosts') {
    // Split staff costs: wages+taxes grow by salary slider; benefits by benefits slider (anchored to 2025)
    const baseStaff2025 = computeDefaultNonMdEmploymentCosts(2025)
    const baseWagesTaxes2025 = Math.max(0, baseStaff2025 - ANNUAL_BENEFITS_FULLTIME)
    const wagesAndTaxes = baseWagesTaxes2025 * Math.pow(1 + nonMdEmploymentGpct, yearsSinceBaseline)
    const benefits = getBenefitCostsForYear(year, benefitGrowthPct)
    return wagesAndTaxes + benefits
  }
  return 0
}

export function Dashboard() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<'Multi-Year' | 'YTD Detailed'>('Multi-Year')

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
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: isMobile ? '8px 0' : '0 0 4px', justifyContent: 'center' }}>
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
        <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
      </div>
      
      <div style={{ 
        marginTop: 20, 
        maxWidth: 1200, 
        margin: '20px auto 0 auto' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setViewMode('Multi-Year')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'Multi-Year' ? '#e5e7eb' : '#fff', cursor: 'pointer' }}
            >Multi-Year</button>
            <button
              onClick={() => setViewMode('YTD Detailed')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'YTD Detailed' ? '#e5e7eb' : '#fff', cursor: 'pointer' }}
            >YTD Detailed</button>
          </div>
          <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => { 
              store.resetToDefaults(); 
              window.location.hash = '';
            }} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Reset to defaults</button>
            <button onClick={copyShareLink} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Copy shareable link</button>
          </div>
        </div>
        
        {viewMode === 'YTD Detailed' ? (
          <YTDDetailed />
        ) : (
          <MultiYearView />
        )}
      </div>
    </div>
  )
}