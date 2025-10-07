import { useMemo, useEffect, useState, useCallback } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import * as LZString from 'lz-string'
import { useAuth } from './auth/AuthProvider'
import LoginModal from './auth/LoginModal'
import SignupModal from './auth/SignupModal'
import ScenarioManager from './scenarios/ScenarioManager'
import YTDDetailed from './dashboard/views/detailed/YTDDetailed'
import MultiYearView from './dashboard/views/multi-year/MultiYearView'
import { DEFAULT_YTD_SETTINGS } from './dashboard/views/detailed/config/chartConfig'
// Import types from types.ts to avoid duplication and binding conflicts
import type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey, Store } from './dashboard/shared/types'

// Re-export types for backward compatibility with extracted components
export type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey }
import { useIsMobile } from './dashboard/shared/hooks'
import {
  computeDefaultNonMdEmploymentCosts,
  calculateMedicalDirectorHourPercentages,
  getPartnerPortionOfYear,
  getBenefitCostsForYear
} from './dashboard/shared/calculations'
import {
  calculateAllCompensations,
  calculateAllCompensationsWithRetired
} from './dashboard/shared/compensationEngine'
import {
  HISTORIC_DATA,
  scenario2024Defaults,
  scenarioADefaultsByYear,
  scenarioBDefaultsByYear,
  DEFAULT_MISC_EMPLOYMENT_COSTS,
  DEFAULT_CONSULTING_SERVICES_2025,
  ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
  ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
  ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
  DEFAULT_MD_SHARED_PROJECTION,
  DEFAULT_MD_PRCS_PROJECTION,
  DEFAULT_LOCUM_COSTS_2025,
  DEFAULT_LOCUM_COSTS_2026,
  ACTUAL_2024_LOCUM_COSTS,
  PROJECTION_DEFAULTS,
  ANNUAL_BENEFITS_FULLTIME,
  INITIAL_FUTURE_YEARS_A,
  INITIAL_FUTURE_YEARS_B
} from './dashboard/shared/defaults'



export const useDashboardStore = create<Store>()(
  persist(
    immer<Store>((set, get) => {
      void get
      return {
        historic: HISTORIC_DATA,
        suppressNextGridSync: false,
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
        currentScenarioId: null,
        currentScenarioName: null,
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
        // One-time suppression control for grid->store synchronization
        setSuppressNextGridSync: (suppress: boolean) => {
          set((state) => {
            ;(state as any).suppressNextGridSync = !!suppress
          })
        },
        consumeSuppressNextGridSync: () => {
          const suppressed = !!(get() as any).suppressNextGridSync
          if (suppressed) {
            set((state) => {
              ;(state as any).suppressNextGridSync = false
            })
          }
          return suppressed
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
                // Deselect in future years - use null to explicitly mark as deselected
                f.prcsDirectorPhysicianId = null
                continue
              }
              // Map by name to each year's physician id, if present
              const match = f.physicians.find((p) => p.name === selectedName && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
              f.prcsDirectorPhysicianId = match ? match.id : null
            }
          }),
        setFutureValue: (scenario, year, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (fy) {
              // Guard: Only update if value actually changed to prevent infinite loops
              const currentValue = (fy as any)[field]
              const valueChanged = typeof currentValue === 'number' && typeof value === 'number'
                ? Math.abs(currentValue - value) > 0.01  // Use small epsilon for floating point comparison
                : currentValue !== value
              
              if (!valueChanged) {
                return  // Skip update if value hasn't changed
              }

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
                  therapyIncome: last2025?.therapyIncome || 0,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
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
                therapyIncome: 0,
                nonEmploymentCosts: 0,
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
                  therapyIncome: last2025?.therapyIncome || 0,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
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
              // Use updated 2025 values from future array if available (user may have edited them)
              const updated2025 = sc.future.find(f => f.year === 2025)
              baselineData = {
                therapyIncome: updated2025?.therapyIncome ?? last2025.therapyIncome,
                nonEmploymentCosts: updated2025?.nonEmploymentCosts ?? last2025.nonEmploymentCosts,
                miscEmploymentCosts: updated2025?.miscEmploymentCosts ?? DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: updated2025?.nonMdEmploymentCosts ?? computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                therapyIncome: 0,
                nonEmploymentCosts: 0,
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
                  therapyIncome: last2025?.therapyIncome || 0,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
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
          set((state) => {
            const defaults = getDefaultValuesForYear(scenario, year, state)
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            const futureYear = scenarioState.future.find(f => f.year === year)
            if (!futureYear) return

            // Reset to default values
            futureYear.physicians = defaults.physicians.map(p => ({ ...p }))
            futureYear.locumCosts = defaults.locumCosts
            futureYear.medicalDirectorHours = defaults.medicalDirectorHours
            futureYear.prcsMedicalDirectorHours = defaults.prcsMedicalDirectorHours
            futureYear.prcsDirectorPhysicianId = defaults.prcsDirectorPhysicianId
          })
        },

        // Reset all physicians across all years for a scenario
        resetAllPhysicians: (scenario: ScenarioKey, skip2025?: boolean) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            scenarioState.future.forEach(fy => {
              if (skip2025 && fy.year === 2025) return
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

          // Recalculate projections after resetting settings (applyProjectionFromLastActual already skips 2025)
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset year-by-year income/cost values to projected values for a scenario
        resetYearByYearValues: (scenario: ScenarioKey) => {
          // This will reset all custom future values back to projected values (applyProjectionFromLastActual already skips 2025)
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset app-level view settings (which year selected, data mode, etc.)
        resetViewSettings: (scenario: ScenarioKey, skip2025?: boolean) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            if (!skip2025) {
              scenarioState.selectedYear = 2025 // Reset to Baseline tab
              scenarioState.dataMode = '2025 Data'
            }
            // When skip2025 is true, preserve current selectedYear and dataMode
          })
        },

        resetToDefaults: (skip2025?: boolean) => {
          set((state) => {
            // When skip2025 is true, preserve the 2025 year data
            const existing2025 = skip2025 ? state.scenarioA.future.find(f => f.year === 2025) : null
            const existingSelectedYear = skip2025 ? state.scenarioA.selectedYear : 2025
            const existingDataMode = skip2025 ? state.scenarioA.dataMode : '2025 Data'

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
              selectedYear: existingSelectedYear,
              dataMode: existingDataMode,
            }

            // If preserving 2025, restore the existing 2025 data
            if (existing2025) {
              // INITIAL_FUTURE_YEARS_A starts at 2026, so we need to add 2025 back
              state.scenarioA.future.unshift({ ...existing2025 })
            }

            // Reset app-level state (not handled by section resets)
            state.scenarioBEnabled = false
            state.scenarioB = undefined
            state.customProjectedValues = {}
          }, false)

          // Use the dedicated reset functions to ensure consistency
          const state = get()
          state.resetAllPhysicians('A', skip2025)
          state.resetProjectionSettings('A', skip2025)
          state.resetYearByYearValues('A', skip2025)
          state.resetViewSettings('A', skip2025)
        },

        // Reset only 2025 data (for YTD Detailed view)
        resetOnly2025: async (scenario: ScenarioKey) => {
          console.log('[RESET DEBUG] ========== resetOnly2025 START ==========')
          // Import the load function dynamically to avoid circular dependencies
          const { load2025ValuesForReset } = await import('./dashboard/views/detailed/utils/load2025Data')

          const state = get()
          const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
          if (!sc) return

          let year2025 = sc.future.find(f => f.year === 2025)
          if (!year2025) {
            // If 2025 baseline doesn't exist yet (e.g., user clicked quickly), create it first
            await useDashboardStore.getState().ensureBaselineYear(scenario, 2025)
            year2025 = useDashboardStore.getState()[scenario === 'A' ? 'scenarioA' : 'scenarioB']?.future.find(f => f.year === 2025)
            if (!year2025) return
          }

          console.log('[RESET DEBUG] Current store values before reset:', {
            therapyIncome: year2025.therapyIncome,
            nonEmploymentCosts: year2025.nonEmploymentCosts,
            nonMdEmploymentCosts: year2025.nonMdEmploymentCosts
          })

          // Suppress the next grid->store sync to avoid transient flashes while resetting
          set((state) => {
            ;(state as any).suppressNextGridSync = true
          })

          // Reset 2025 physicians to defaults first
          const defaultPhysicians = scenario === 'A'
            ? scenarioADefaultsByYear(2025)
            : scenarioBDefaultsByYear(2025)

          // Load 2025 values dynamically based on environment (tries production, falls back to sandbox)
          console.log('[RESET DEBUG] Loading 2025 values from grid...')
          const values = await load2025ValuesForReset(
            defaultPhysicians,
            sc.projection.benefitCostsGrowthPct,
            year2025.locumCosts ?? DEFAULT_LOCUM_COSTS_2025
          )
          console.log('[RESET DEBUG] Loaded values:', {
            therapyIncome: values.therapyIncome,
            nonEmploymentCosts: values.nonEmploymentCosts,
            nonMdEmploymentCosts: values.nonMdEmploymentCosts
          })

          // Batch all updates in a single set call to avoid intermediate renders
          console.log('[RESET DEBUG] Batching state updates...')
          set((state) => {
            state.customProjectedValues = {}

            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return

            const year2025 = sc.future.find(f => f.year === 2025)
            if (!year2025) return

            // Reset physicians
            year2025.physicians = defaultPhysicians.map(p => ({ ...p }))

            // Reset 2025 grid values using dynamically loaded values
            year2025.therapyIncome = values.therapyIncome
            year2025.therapyLacey = values.therapyLacey
            year2025.therapyCentralia = values.therapyCentralia
            year2025.therapyAberdeen = values.therapyAberdeen
            year2025.nonEmploymentCosts = values.nonEmploymentCosts
            year2025.nonMdEmploymentCosts = values.nonMdEmploymentCosts
            year2025.miscEmploymentCosts = values.miscEmploymentCosts
            year2025.locumCosts = values.locumCosts
            year2025.medicalDirectorHours = values.medicalDirectorHours
            year2025.prcsMedicalDirectorHours = values.prcsMedicalDirectorHours
            year2025.consultingServicesAgreement = values.consultingServicesAgreement

            // Reset PRCS Director to default
            const jsPhysician = year2025.physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
            year2025.prcsDirectorPhysicianId = jsPhysician?.id
            
            console.log('[RESET DEBUG] Batched update complete. New values:', {
              therapyIncome: year2025.therapyIncome,
              nonEmploymentCosts: year2025.nonEmploymentCosts,
              nonMdEmploymentCosts: year2025.nonMdEmploymentCosts
            })
          })

          // Recompute projections to keep future years aligned with the reset 2025 baseline
          try {
            const api = get()
            api.applyProjectionFromLastActual(scenario)
          } catch (e) {
            console.warn('Post-reset projection update encountered an issue:', e)
          }

          // Nudge listeners that key projection inputs changed (forces grid reload even if values are same)
          set((state) => {
            state.customProjectedValues = { ...state.customProjectedValues }
          })
          
          console.log('[RESET DEBUG] ========== resetOnly2025 END ==========')
        },

        // Ensure baseline year exists in future years array for PhysiciansEditor
        ensureBaselineYear: async (scenario: ScenarioKey, year: number) => {
          const state = get()
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

          let baseline: FutureYear

          // For 2025 specifically, load values dynamically
          if (year === 2025) {
            const { load2025ValuesForReset } = await import('./dashboard/views/detailed/utils/load2025Data')

            const values = await load2025ValuesForReset(
              defaultPhysicians,
              sc.projection.benefitCostsGrowthPct,
              DEFAULT_LOCUM_COSTS_2025
            )

            baseline = {
              year,
              therapyIncome: values.therapyIncome,
              nonEmploymentCosts: values.nonEmploymentCosts,
              nonMdEmploymentCosts: values.nonMdEmploymentCosts,
              locumCosts: values.locumCosts,
              miscEmploymentCosts: values.miscEmploymentCosts,
              medicalDirectorHours: values.medicalDirectorHours,
              prcsMedicalDirectorHours: values.prcsMedicalDirectorHours,
              consultingServicesAgreement: values.consultingServicesAgreement,
              prcsDirectorPhysicianId: jsPhysician?.id,
              physicians: defaultPhysicians.map(p => ({ ...p })),
            }
          } else {
            // For other years, use historic data with fallbacks (this is fine for 2026+)
            const historic = state.historic.find(h => h.year === year)
            baseline = {
              year,
              therapyIncome: historic?.therapyIncome ?? 0,
              nonEmploymentCosts: historic?.nonEmploymentCosts ?? 0,
              nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
              locumCosts: year === 2026 ? DEFAULT_LOCUM_COSTS_2026 : 0,
              miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
              medicalDirectorHours: DEFAULT_MD_SHARED_PROJECTION,
              prcsMedicalDirectorHours: DEFAULT_MD_PRCS_PROJECTION,
              consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025,
              prcsDirectorPhysicianId: jsPhysician?.id,
              physicians: defaultPhysicians.map(p => ({ ...p })),
            }
          }

          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return

            // Double-check it doesn't exist (async race condition)
            const existing = sc.future.find((f) => f.year === year)
            if (existing) return

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
        
        // Scenario management
        setCurrentScenario: (id: string | null, name: string | null) =>
          set((state) => {
            state.currentScenarioId = id
            state.currentScenarioName = name
          }),

        saveScenarioToDatabase: async (name: string, description: string, tags: string[], isPublic: boolean) => {
          const state = get()
          const { supabase } = await import('../lib/supabase')
          
          const scenarioData = {
            scenarioA: state.scenarioA,
            scenarioBEnabled: state.scenarioBEnabled,
            scenarioB: state.scenarioB,
            customProjectedValues: state.customProjectedValues,
          }

          // If updating existing scenario
          if (state.currentScenarioId) {
            const { data, error } = await supabase
              .from('scenarios')
              .update({
                name,
                description,
                tags,
                is_public: isPublic,
                scenario_data: scenarioData,
              })
              .eq('id', state.currentScenarioId)
              .select()
              .single()

            if (error) throw error
            
            set((state) => {
              state.currentScenarioName = name
            })
            
            return data
          } else {
            // Creating new scenario
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not authenticated')

            const { data, error } = await supabase
              .from('scenarios')
              .insert({
                user_id: session.user.id,
                name,
                description,
                tags,
                is_public: isPublic,
                scenario_data: scenarioData,
              })
              .select()
              .single()

            if (error) throw error
            
            set((state) => {
              state.currentScenarioId = data.id
              state.currentScenarioName = name
            })
            
            return data
          }
        },

        loadScenarioFromDatabase: async (id: string) => {
          const { supabase } = await import('../lib/supabase')
          
          const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (!data) throw new Error('Scenario not found')

          const scenarioData = data.scenario_data

          set((state) => {
            state.scenarioA = scenarioData.scenarioA
            state.scenarioBEnabled = scenarioData.scenarioBEnabled
            state.scenarioB = scenarioData.scenarioB
            state.customProjectedValues = scenarioData.customProjectedValues || {}
            state.currentScenarioId = data.id
            state.currentScenarioName = data.name
          })
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
        customProjectedValues: state.customProjectedValues,
        currentScenarioId: state.currentScenarioId,
        currentScenarioName: state.currentScenarioName,
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

  return useMemo(() => {
    if (!fy) return [] as { id: string; name: string; comp: number }[]

    // Use the canonical compensation engine
    // For YearPanel (Partner Compensation section): exclude W2 from comp (shown separately with annotation)
    const allComps = calculateAllCompensations({
      physicians: fy.physicians,
      year,
      fy,
      benefitCostsGrowthPct: sc.projection.benefitCostsGrowthPct,
      includeRetired: false,
      excludeW2FromComp: true
    })

    // Return only partners (filter out employees)
    return allComps
      .filter(c => c.type === 'partner')
      .map(c => ({ id: c.id, name: c.name, comp: c.comp }))
  }, [fy, sc, year])
}

// Helper function to get default values for a specific year
function getDefaultValuesForYear(scenario: ScenarioKey, year: number, store: any) {
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  const defaultPhysicians = scenario === 'A' ? scenarioADefaultsByYear(year) : scenarioBDefaultsByYear(year)

  const jsDefault = year >= 2024
    ? defaultPhysicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
    : undefined

  // Determine default locumCosts
  let defaultLocumCosts: number
  if (year === 2025) {
    defaultLocumCosts = DEFAULT_LOCUM_COSTS_2025
  } else if (year === 2026) {
    defaultLocumCosts = DEFAULT_LOCUM_COSTS_2026
  } else {
    defaultLocumCosts = scenario === 'A' ? PROJECTION_DEFAULTS.A.locumsCosts : PROJECTION_DEFAULTS.B.locumsCosts
  }

  // Determine default medicalDirectorHours
  const defaultMedicalDirectorHours = year === 2025
    ? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS
    : (sc?.projection?.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION)

  // Determine default prcsMedicalDirectorHours
  const defaultPrcsMedicalDirectorHours = year === 2025
    ? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS
    : (sc?.projection?.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION)

  return {
    physicians: defaultPhysicians,
    locumCosts: defaultLocumCosts,
    medicalDirectorHours: defaultMedicalDirectorHours,
    prcsMedicalDirectorHours: defaultPrcsMedicalDirectorHours,
    prcsDirectorPhysicianId: jsDefault?.id
  }
}

// Helper function to check if physicians have been changed from defaults
export function arePhysiciansChanged(
  scenario: ScenarioKey,
  year: number,
  currentPhysicians: Physician[],
  _store: any
): boolean {
  const defaults = getDefaultValuesForYear(scenario, year, _store)
  const defaultPhysicians = defaults.physicians

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
      current.trailingSharedMdAmount !== defaultPhysician.trailingSharedMdAmount ||
      current.additionalDaysWorked !== defaultPhysician.additionalDaysWorked
    ) {
      return true
    }
  }

  // Include locumCosts, medical director hours, PRCS director selection and PRCS amount override in change detection
  try {
    const sc = scenario === 'A' ? _store.scenarioA : _store.scenarioB
    const fy = sc?.future.find((f: any) => f.year === year)

    // Check locumCosts
    const fyLocumCosts = fy?.locumCosts ?? defaults.locumCosts
    if (Math.abs(fyLocumCosts - defaults.locumCosts) > 100) return true

    // Check medicalDirectorHours
    const currentMdHours = fy?.medicalDirectorHours ?? defaults.medicalDirectorHours
    if (Math.abs(currentMdHours - defaults.medicalDirectorHours) > 100) return true

    // Check prcsMedicalDirectorHours
    const currentPrcs = fy?.prcsMedicalDirectorHours ?? defaults.prcsMedicalDirectorHours
    if (Math.abs(currentPrcs - defaults.prcsMedicalDirectorHours) > 100) return true

    // Check PRCS director selection
    const selectionChanged = (fy?.prcsDirectorPhysicianId ?? undefined) !== (defaults.prcsDirectorPhysicianId ?? undefined)
    if (selectionChanged) return true
  } catch {
    // Silently handle errors when accessing data
  }

  return false
}

export function computeAllCompensationsForYear(year: number, scenario: ScenarioKey) {
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  const fy = sc.future.find((f) => f.year === year)

  if (!fy) return [] as { id: string; name: string; type: PhysicianType; comp: number }[]

  // Use the canonical compensation engine
  return calculateAllCompensations({
    physicians: fy.physicians,
    year,
    fy,
    benefitCostsGrowthPct: sc.projection.benefitCostsGrowthPct,
    includeRetired: false
  })
}

export function computeAllCompensationsForYearWithRetired(year: number, scenario: ScenarioKey) {
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  const fy = sc.future.find((f) => f.year === year)

  if (!fy) return [] as { id: string; name: string; type: PhysicianType; comp: number }[]

  // Use the canonical compensation engine with retired partners included
  return calculateAllCompensationsWithRetired({
    physicians: fy.physicians,
    year,
    fy,
    benefitCostsGrowthPct: sc.projection.benefitCostsGrowthPct
  })
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
  // IMPORTANT: Must match the logic in applyProjectionFromLastActual to ensure reset button works correctly
  let baselineData
  if (sc.dataMode === 'Custom') {
    // For Custom mode, use the existing baseline data from year 2025 in future array
    const customBaseline = sc.future.find((f: any) => f.year === 2025)
    if (customBaseline) {
      baselineData = {
        therapyIncome: customBaseline.therapyIncome,
        nonEmploymentCosts: customBaseline.nonEmploymentCosts,
        miscEmploymentCosts: customBaseline.miscEmploymentCosts,
        nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
      }
    } else {
      // Fallback if Custom baseline missing (shouldn't happen)
      const last2025 = store.historic.find((h: any) => h.year === 2025)
      baselineData = {
        therapyIncome: last2025?.therapyIncome || 0,
        nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
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
    // Use updated 2025 values from future array if available (grid-synced values)
    const updated2025 = sc.future.find((f: any) => f.year === 2025)
    const last2025 = store.historic.find((h: any) => h.year === 2025)
    baselineData = {
      therapyIncome: updated2025?.therapyIncome ?? last2025?.therapyIncome ?? 0,
      nonEmploymentCosts: updated2025?.nonEmploymentCosts ?? last2025?.nonEmploymentCosts ?? 0,
      miscEmploymentCosts: updated2025?.miscEmploymentCosts ?? DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: updated2025?.nonMdEmploymentCosts ?? computeDefaultNonMdEmploymentCosts(2025),
    }
  } else {
    // Fallback to 2025 hardcoded values
    baselineData = {
      therapyIncome: 0,
      nonEmploymentCosts: 0,
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
  const { profile, loading, signOut } = useAuth()
  const [viewMode, setViewMode] = useState<'Multi-Year' | 'YTD Detailed'>('YTD Detailed')
  const [urlLoaded, setUrlLoaded] = useState(false)
  // Initialize ytdSettings with defaults from chartConfig
  const [ytdSettings, setYtdSettings] = useState<any>(DEFAULT_YTD_SETTINGS)
  // Track whether MultiYearView has been visited (for lazy initialization)
  const [multiYearInitialized, setMultiYearInitialized] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showScenarioManager, setShowScenarioManager] = useState(false)
  
  // Wrap setYtdSettings in useCallback to prevent unnecessary re-renders in YTDDetailed
  const handleYtdSettingsChange = useCallback((settings: any) => {
    setYtdSettings(settings)
  }, [])

  // Initialize MultiYearView when first visited
  useEffect(() => {
    if (viewMode === 'Multi-Year' && !multiYearInitialized) {
      setMultiYearInitialized(true)
    }
  }, [viewMode, multiYearInitialized])

  // Trigger resize event when switching to Multi-Year view to fix Plotly chart dimensions
  useEffect(() => {
    if (viewMode === 'Multi-Year' && urlLoaded && multiYearInitialized) {
      // Use requestAnimationFrame to ensure DOM has updated before triggering resize
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }
  }, [viewMode, urlLoaded, multiYearInitialized])

  // Load from shareable URL hash if present
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.startsWith('#s=')) {
      try {
        const encoded = hash.slice(3)

        // Try decompressing first (new format)
        let json: string
        try {
          json = LZString.decompressFromEncodedURIComponent(encoded) || ''
          if (!json) {
            // Fallback to old base64 format for backward compatibility
            json = decodeURIComponent(atob(encoded))
          }
        } catch {
          // Fallback to old base64 format for backward compatibility
          json = decodeURIComponent(atob(encoded))
        }

        const snap = JSON.parse(json)

        // Load store data
        useDashboardStore.getState().loadSnapshot(snap)

        // Load view mode if present (backward compatible)
        if (snap.viewMode) {
          setViewMode(snap.viewMode)
          // If loading Multi-Year from URL, initialize it immediately
          if (snap.viewMode === 'Multi-Year') {
            setMultiYearInitialized(true)
          }
        }

        // Load YTD settings if present (backward compatible)
        if (snap.ytdSettings) {
          setYtdSettings(snap.ytdSettings)
        }
      } catch (err) {
        console.error('Failed to load shareable link:', err)
        // ignore malformed
      }
    }
    setUrlLoaded(true)
  }, [])

  const copyShareLink = async () => {
    const snap: any = {
      scenarioA: store.scenarioA,
      scenarioBEnabled: store.scenarioBEnabled,
      scenarioB: store.scenarioBEnabled ? store.scenarioB : undefined,
      viewMode: viewMode,
    }

    // Always include YTD settings (chart configuration) for YTD Detailed view
    if (viewMode === 'YTD Detailed') {
      snap.ytdSettings = ytdSettings
    }

    const json = JSON.stringify(snap)

    // Compress using LZ-String for shorter URLs
    const compressed = LZString.compressToEncodedURIComponent(json)
    const url = `${window.location.origin}${window.location.pathname}#s=${compressed}`

    try {
      await navigator.clipboard.writeText(url)
      alert('Shareable link copied to clipboard!')
    } catch {
      // fallback: set location hash
      window.location.hash = `s=${compressed}`
      alert('Shareable link updated in URL')
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{ 
        fontFamily: 'Inter, system-ui, Arial', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 16
      }}>
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 80, width: 'auto' }} />
        <div style={{ fontSize: 18, color: '#6b7280' }}>Loading...</div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!profile) {
    return (
      <div style={{ 
        fontFamily: 'Inter, system-ui, Arial', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 20
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: isMobile ? 32 : 48,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: 440,
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 80, width: 'auto', marginBottom: 16 }} />
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', 
              color: '#7c2a83', 
              fontWeight: 900, 
              fontSize: 32 
            }}>
              Compensation Dashboard
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: '#6b7280' }}>
              Sign in to access the dashboard
            </p>
          </div>
          
          <LoginModal
            isOpen={true}
            onClose={() => {}}
            onSwitchToSignup={() => setShowSignupModal(true)}
            embedded={true}
          />
        </div>

        {/* Signup Modal */}
        <SignupModal
          isOpen={showSignupModal}
          onClose={() => setShowSignupModal(false)}
          onSwitchToLogin={() => setShowSignupModal(false)}
        />
      </div>
    )
  }

  // User is authenticated - show the full dashboard
  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16, position: 'relative' }}>
      {/* Top Bar with Auth and Help */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>
          {profile.email}
        </span>
        <button
          onClick={() => setShowScenarioManager(true)}
          style={{
            padding: '8px 16px',
            background: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          📊 Scenarios
        </button>
        <button
          onClick={() => {
            signOut()
            store.setCurrentScenario(null, null)
          }}
          style={{
            padding: '8px 16px',
            background: '#fff',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
        
        {/* Help Icon */}
        <div 
          onClick={() => setShowHelpModal(true)}
          title="Click for help"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid #7c2a83',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 'bold',
            color: '#7c2a83',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7c2a83'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff'
            e.currentTarget.style.color = '#7c2a83'
          }}
        >
          ?
        </div>
      </div>

      {/* Centered Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
        <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
      </div>
      
      <div style={{ 
        marginTop: 20, 
        maxWidth: 1600, 
        margin: '20px auto 0 auto' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setViewMode('YTD Detailed')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'YTD Detailed' ? '#e5e7eb' : '#fff', cursor: 'pointer' }}
            >YTD Detailed</button>
            <button
              onClick={() => setViewMode('Multi-Year')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'Multi-Year' ? '#e5e7eb' : '#fff', cursor: 'pointer' }}
            >Multi-Year</button>
          </div>
          <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={async () => {
              if (viewMode === 'YTD Detailed') {
                await store.resetOnly2025('A');
              } else {
                store.resetToDefaults(true); // skip2025 = true for Multi-Year
              }
              window.location.hash = '';
            }} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Reset to defaults</button>
            <button onClick={copyShareLink} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Copy shareable link</button>
          </div>
        </div>
        
        {!urlLoaded ? (
          <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: viewMode === 'YTD Detailed' ? 'block' : 'none' }}>
              <YTDDetailed
                initialSettings={ytdSettings}
                onSettingsChange={handleYtdSettingsChange}
              />
            </div>
            {/* Only render MultiYearView after it's been visited once (lazy initialization) */}
            {multiYearInitialized && (
              <div style={{ display: viewMode === 'Multi-Year' ? 'block' : 'none' }}>
                <MultiYearView />
              </div>
            )}
          </>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <>
          {/* Dimmed Background Overlay */}
          <div 
            onClick={() => setShowHelpModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Modal Content */}
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: isMobile ? 20 : 40,
                maxWidth: isMobile ? '90%' : 800,
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.2)',
              }}
            >
              <h2 style={{ 
                margin: '0 0 20px 0', 
                color: '#7c2a83', 
                fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
                fontSize: 28,
                fontWeight: 900
              }}>
                Compensation Dashboard Help
              </h2>

              <div style={{ lineHeight: 1.6, color: '#333', textAlign: 'left' }}>
                <h3 style={{ color: '#7c2a83', marginTop: 0 }}>Overview</h3>
                <p>
                  The RadiantCare Compensation Dashboard is a financial planning tool designed to project 
                  and analyze physician compensation across multiple years. It allows you to model different 
                  scenarios, adjust key financial parameters, and visualize the impact on compensation.
                </p>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Two Main Views</h3>
                
                <h4 style={{ marginTop: 16, marginBottom: 8 }}>YTD Detailed View</h4>
                <p>
                  This view focuses on the current year with detailed day-to-day tracking. It includes:
                </p>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Real-time data synchronization with QuickBooks Online</li>
                  <li>Actual year-to-date as well as projected physician compensation</li>
                  <li>Interactive and customizable charts showing income trends with historical comparison</li>
                  <li>Site-specific breakdowns (Lacey, Centralia, Aberdeen)</li>
                  <li>Ability to adjust physician details, salaries, and benefits</li>
                  <li>Interactive P&L sheet showing historical data as well as projected data</li>
                </ul>

                <h4 style={{ marginTop: 16, marginBottom: 8 }}>Multi-Year View</h4>
                <p>
                  This view provides long-term projections (current year plus 5 years). It features:
                </p>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Year-by-year financial projections</li>
                  <li>Adjustable growth rates for income, costs, and employment expenses</li>
                  <li>Physician roster planning (hires, retirements, promotions)</li>
                  <li>Scenario comparison (Scenario A vs Scenario B)</li>
                  <li>Medical director hours and consulting services allocation</li>
                </ul>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Key Features</h3>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li><strong>Reset to Defaults:</strong> Return all settings on the view to their original values</li>
                  <li><strong>Copy Shareable Link:</strong> Generate a URL preserving the current configuration for easy sharing</li>
                  <li><strong>Interactive Charts:</strong> Hover over data points for detailed information</li>
                  <li><strong>Real-time Calculations:</strong> All compensation values update automatically as you make changes</li>
                </ul>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Getting Started</h3>
                <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Choose between "YTD Detailed" and "Multi-Year" views using the tabs</li>
                  <li>Review the default projections and adjust parameters as needed</li>
                  <li>Modify physician details, growth rates, and other financial assumptions</li>
                  <li>Use the charts and tables to analyze the impact of your changes</li>
                  <li>Share your scenarios with colleagues using the "Copy shareable link" button</li>
                </ol>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: 12, 
                marginTop: 32,
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => {
                    window.location.href = 'mailto:connor@radiantcare.com?subject=Compensation Dashboard Support'
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #7c2a83',
                    borderRadius: 6,
                    backgroundColor: '#fff',
                    color: '#7c2a83',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff'
                  }}
                >
                  Contact Support
                </button>
                <button
                  onClick={() => setShowHelpModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: 6,
                    backgroundColor: '#7c2a83',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#651f6b'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#7c2a83'
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Scenario Manager Modal */}
      <ScenarioManager
        isOpen={showScenarioManager}
        onClose={() => setShowScenarioManager(false)}
      />
    </div>
  )
}