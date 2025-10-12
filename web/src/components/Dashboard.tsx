import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { immer } from 'zustand/middleware/immer'
import * as LZString from 'lz-string'
import { useAuth } from './auth/AuthProvider'
import LoginModal from './auth/LoginModal'
import SignupModal from './auth/SignupModal'
import PasswordResetModal from './auth/PasswordResetModal'
import ScenarioManager from './scenarios/ScenarioManager'
import YTDDetailed from './dashboard/views/detailed/YTDDetailed'
import YTDDetailedMobile from './dashboard/views/detailed/YTDDetailedMobile'
import MultiYearView from './dashboard/views/multi-year/MultiYearView'
import SyncButton from './dashboard/views/detailed/components/SyncButton'
import SharedLinkWarningModal from './shared/SharedLinkWarningModal'
import { DEFAULT_YTD_SETTINGS } from './dashboard/views/detailed/config/chartConfig'
import { authenticatedFetch } from '../lib/api'
// Import types from types.ts to avoid duplication and binding conflicts
import type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey, Store, YTDSettings, SavedScenario, ScenarioState, BaselineMode } from './dashboard/shared/types'

// Re-export types for backward compatibility with extracted components
export type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey }
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
        currentScenarioUserId: null,
        currentScenarioBId: null,
        currentScenarioBName: null,
        currentScenarioBUserId: null,
        loadedScenarioSnapshot: null,
        loadedScenarioBSnapshot: null,
        setScenarioEnabled: (enabled) => {
          set((state) => {
            state.scenarioBEnabled = enabled
            // Don't clear snapshot when just toggling visibility - keep it for dirty detection
            if (enabled && !state.scenarioB) {
              // Only initialize with defaults if scenario B doesn't exist yet
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
            }
            // Don't clear scenarioB when disabling - just hide it
            // This preserves loaded scenario data and snapshot for dirty detection
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
            state.suppressNextGridSync = !!suppress
          })
        },
        consumeSuppressNextGridSync: () => {
          const suppressed = !!get().suppressNextGridSync
          if (suppressed) {
            set((state) => {
              state.suppressNextGridSync = false
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
              const currentValue = fy[field]
              const valueChanged = typeof currentValue === 'number' && typeof value === 'number'
                ? Math.abs(currentValue - value) > 0.01  // Use small epsilon for floating point comparison
                : currentValue !== value

              if (!valueChanged) {
                return  // Skip update if value hasn't changed
              }

              fy[field] = value

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
                fy[field] = sc.projection[field]
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
        // Reset physicians for a specific scenario and year to defaults or loaded snapshot
        resetPhysicians: (scenario: ScenarioKey, year: number) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            const futureYear = scenarioState.future.find(f => f.year === year)
            if (!futureYear) return

            // Use the correct snapshot based on scenario
            const snapshot = scenario === 'A' ? state.loadedScenarioSnapshot : state.loadedScenarioBSnapshot

            // If we have a loaded scenario snapshot, reset to that instead of defaults
            if (snapshot) {
              const snapshotScenario = scenario === 'A' ? ('scenarioA' in snapshot ? snapshot.scenarioA : null) : ('scenarioB' in snapshot ? snapshot.scenarioB : null)
              const snapshotFy = snapshotScenario?.future.find((f: FutureYear) => f.year === year)
              if (snapshotFy) {
                // Deep copy from snapshot
                futureYear.physicians = JSON.parse(JSON.stringify(snapshotFy.physicians))
                futureYear.locumCosts = snapshotFy.locumCosts
                futureYear.medicalDirectorHours = snapshotFy.medicalDirectorHours
                futureYear.prcsMedicalDirectorHours = snapshotFy.prcsMedicalDirectorHours
                futureYear.prcsDirectorPhysicianId = snapshotFy.prcsDirectorPhysicianId

                // Also reset grid overrides to snapshot (only for A, B doesn't have separate grid overrides)
                if (scenario === 'A' && state.loadedScenarioSnapshot) {
                  state.customProjectedValues = JSON.parse(JSON.stringify(state.loadedScenarioSnapshot.customProjectedValues))
                }
                return
              }
            }

            // Fall back to defaults if no snapshot
            const defaults = getDefaultValuesForYear(scenario, year, state)
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

            // Use the correct snapshot based on scenario
            const snapshot = scenario === 'A' ? state.loadedScenarioSnapshot : state.loadedScenarioBSnapshot

            // If we have a loaded scenario snapshot, reset all years from that
            if (snapshot) {
              const snapshotScenario = scenario === 'A' ? ('scenarioA' in snapshot ? snapshot.scenarioA : null) : ('scenarioB' in snapshot ? snapshot.scenarioB : null)
              scenarioState.future.forEach(fy => {
                if (skip2025 && fy.year === 2025) return
                const snapshotFy = snapshotScenario?.future.find((f: FutureYear) => f.year === fy.year)
                if (snapshotFy) {
                  // Deep copy physicians from snapshot
                  fy.physicians = JSON.parse(JSON.stringify(snapshotFy.physicians))
                  // Also restore other year-specific settings
                  fy.locumCosts = snapshotFy.locumCosts
                  fy.medicalDirectorHours = snapshotFy.medicalDirectorHours
                  fy.prcsMedicalDirectorHours = snapshotFy.prcsMedicalDirectorHours
                  fy.prcsDirectorPhysicianId = snapshotFy.prcsDirectorPhysicianId
                }
              })
            } else {
              // Fall back to hardcoded defaults if no snapshot
              scenarioState.future.forEach(fy => {
                if (skip2025 && fy.year === 2025) return
                const defaultPhysicians = scenario === 'A'
                  ? scenarioADefaultsByYear(fy.year)
                  : scenarioBDefaultsByYear(fy.year)
                fy.physicians = defaultPhysicians.map(p => ({ ...p }))
              })
            }
          })
        },

        // Reset projection settings for a scenario to defaults
        resetProjectionSettings: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            // Use the correct snapshot based on scenario
            const snapshot = scenario === 'A' ? state.loadedScenarioSnapshot : state.loadedScenarioBSnapshot
            const loadedProjection = scenario === 'A'
              ? (snapshot && 'scenarioA' in snapshot ? snapshot.scenarioA.projection : undefined)
              : (snapshot && 'scenarioB' in snapshot ? snapshot.scenarioB.projection : undefined)
            const defaultProjection = loadedProjection || (scenario === 'A' ? PROJECTION_DEFAULTS.A : PROJECTION_DEFAULTS.B)

            scenarioState.projection = {
              incomeGrowthPct: defaultProjection.incomeGrowthPct,
              medicalDirectorHours: defaultProjection.medicalDirectorHours,
              prcsMedicalDirectorHours: defaultProjection.prcsMedicalDirectorHours,
              consultingServicesAgreement: defaultProjection.consultingServicesAgreement,
              nonEmploymentCostsPct: defaultProjection.nonEmploymentCostsPct,
              nonMdEmploymentCostsPct: defaultProjection.nonMdEmploymentCostsPct,
              locumsCosts: defaultProjection.locumsCosts,
              miscEmploymentCostsPct: defaultProjection.miscEmploymentCostsPct,
              benefitCostsGrowthPct: defaultProjection.benefitCostsGrowthPct
            }
          })

          // Recalculate projections after resetting settings (applyProjectionFromLastActual already skips 2025)
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset year-by-year income/cost values to projected values for a scenario
        resetYearByYearValues: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return

            // Use the correct snapshot based on scenario
            const snapshot = scenario === 'A' ? state.loadedScenarioSnapshot : state.loadedScenarioBSnapshot

            // If we have a loaded scenario snapshot, restore custom per-year overrides from snapshot
            if (snapshot) {
              const snapshotScenario = scenario === 'A' ? ('scenarioA' in snapshot ? snapshot.scenarioA : null) : ('scenarioB' in snapshot ? snapshot.scenarioB : null)
              scenarioState.future.forEach(fy => {
                const snapshotFy = snapshotScenario?.future.find((f: FutureYear) => f.year === fy.year)
                if (snapshotFy) {
                  // Restore income/cost values that might have been customized per year
                  fy.therapyIncome = snapshotFy.therapyIncome
                  fy.nonEmploymentCosts = snapshotFy.nonEmploymentCosts
                  fy.nonMdEmploymentCosts = snapshotFy.nonMdEmploymentCosts
                  fy.locumCosts = snapshotFy.locumCosts
                  fy.miscEmploymentCosts = snapshotFy.miscEmploymentCosts
                  fy.medicalDirectorHours = snapshotFy.medicalDirectorHours
                  fy.prcsMedicalDirectorHours = snapshotFy.prcsMedicalDirectorHours
                  fy.consultingServicesAgreement = snapshotFy.consultingServicesAgreement
                  // Restore per-site values if they exist
                  if (snapshotFy.therapyLacey !== undefined) fy.therapyLacey = snapshotFy.therapyLacey
                  if (snapshotFy.therapyCentralia !== undefined) fy.therapyCentralia = snapshotFy.therapyCentralia
                  if (snapshotFy.therapyAberdeen !== undefined) fy.therapyAberdeen = snapshotFy.therapyAberdeen
                }
              })
              // Also restore custom projected values (grid overrides) - only for A
              if (scenario === 'A' && state.loadedScenarioSnapshot) {
                state.customProjectedValues = JSON.parse(JSON.stringify(state.loadedScenarioSnapshot.customProjectedValues))
              }
            } else {
              // Fall back to recalculating from projection formulas if no snapshot
              get().applyProjectionFromLastActual(scenario)
            }
          })
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

            // Use loaded scenario snapshot if available, otherwise use hardcoded defaults
            const loadedProjection = state.loadedScenarioSnapshot?.scenarioA?.projection
            const defaultProjection = loadedProjection || PROJECTION_DEFAULTS.A

            // Initialize scenario A with basic structure
            state.scenarioA = {
              future: INITIAL_FUTURE_YEARS_A.map((f) => ({
                ...f,
                physicians: [...f.physicians.map(p => ({ ...p }))]
              })),
              projection: {
                incomeGrowthPct: defaultProjection.incomeGrowthPct,
                medicalDirectorHours: defaultProjection.medicalDirectorHours,
                prcsMedicalDirectorHours: defaultProjection.prcsMedicalDirectorHours,
                consultingServicesAgreement: defaultProjection.consultingServicesAgreement,
                nonEmploymentCostsPct: defaultProjection.nonEmploymentCostsPct,
                nonMdEmploymentCostsPct: defaultProjection.nonMdEmploymentCostsPct,
                locumsCosts: defaultProjection.locumsCosts,
                miscEmploymentCostsPct: defaultProjection.miscEmploymentCostsPct,
                benefitCostsGrowthPct: defaultProjection.benefitCostsGrowthPct
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
            console.log('[SNAPSHOT B] Clearing B snapshot (resetToDefaults)')
            state.scenarioBEnabled = false
            state.scenarioB = undefined
            state.customProjectedValues = {}
            state.loadedScenarioBSnapshot = null
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
            state.suppressNextGridSync = true
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
        setCurrentScenario: (id: string | null, name: string | null, userId?: string | null) =>
          set((state) => {
            state.currentScenarioId = id
            state.currentScenarioName = name
            state.currentScenarioUserId = userId ?? null
            // Clear snapshot when unloading a scenario (id is null)
            if (id === null) {
              state.loadedScenarioSnapshot = null
            }
          }),

        setCurrentScenarioB: (id: string | null, name: string | null, userId?: string | null) =>
          set((state) => {
            state.currentScenarioBId = id
            state.currentScenarioBName = name
            state.currentScenarioBUserId = userId ?? null
          }),

        saveScenarioToDatabase: async (
          name: string,
          description: string,
          isPublic: boolean,
          viewMode: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile',
          ytdSettings?: YTDSettings
        ) => {
          const state = get()
          const { supabase } = await import('../lib/supabase')

          // Get current session
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error('Not authenticated')

          // Fetch QBO sync timestamp (optional - don't fail save if unavailable)
          let qboSyncTimestamp: string | null = null
          try {
            const { data: cacheData, error: cacheError } = await supabase
              .from('qbo_cache')
              .select('last_sync_timestamp')
              .eq('id', 1)
              .single()

            if (!cacheError && cacheData) {
              qboSyncTimestamp = cacheData.last_sync_timestamp
            }
          } catch (err) {
            console.warn('Could not fetch QBO sync timestamp:', err)
            // Continue with save even if timestamp fetch fails
          }

          // Prepare data based on view mode
          type SaveData = {
            name: string
            description: string
            is_public: boolean
            view_mode: 'YTD Detailed' | 'Multi-Year'
            baseline_date: string
            qbo_sync_timestamp: string | null
            ytd_settings?: YTDSettings | null
            year_2025_data?: FutureYear
            custom_projected_values?: Record<string, number>
            scenario_data?: { scenarioA: Omit<ScenarioState, 'selectedYear'>; customProjectedValues: Record<string, number> } | null
            baseline_mode?: BaselineMode | null
          }
          let saveData: SaveData
          
          if (viewMode === 'YTD Detailed') {
            // YTD Save - 2025 baseline customizations + chart settings
            // Get the 2025 year data (includes physicians and their settings)
            const year2025 = state.scenarioA.future.find(f => f.year === 2025) || {
              year: 2025,
              therapyIncome: 0,
              nonEmploymentCosts: 0,
              nonMdEmploymentCosts: 0,
              locumCosts: 0,
              miscEmploymentCosts: 0,
              physicians: []
            }
            
            saveData = {
              name,
              description,
              is_public: isPublic,
              view_mode: 'YTD Detailed',
              ytd_settings: ytdSettings,
              baseline_date: new Date().toISOString().split('T')[0],
              qbo_sync_timestamp: qboSyncTimestamp,
              // Store 2025 physician settings and grid overrides
              year_2025_data: year2025,
              custom_projected_values: state.customProjectedValues,
              // Explicitly set scenario_data to null for YTD saves
              scenario_data: null,
              baseline_mode: null,
            }
          } else {
            // Multi-Year Save - only save Scenario A (not B)
            const dataMode = state.scenarioA.dataMode
            // Exclude selectedYear from saved data (it's just UI state)
            const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
            void _selectedYear // Mark as intentionally unused
            const scenarioData = {
              scenarioA: scenarioAWithoutUI,
              customProjectedValues: state.customProjectedValues,
            }
            
            // Determine baseline date
            const baselineDate = dataMode === '2024 Data' 
              ? '2024-12-31' 
              : new Date().toISOString().split('T')[0]
            
            saveData = {
              name,
              description,
              is_public: isPublic,
              view_mode: 'Multi-Year',
              baseline_mode: dataMode,
              baseline_date: baselineDate,
              qbo_sync_timestamp: qboSyncTimestamp,
              scenario_data: scenarioData,
              // Explicitly set ytd_settings to null for Multi-Year saves
              ytd_settings: null,
            }
          }

          // If updating existing scenario
          if (state.currentScenarioId) {
            const { data, error } = await supabase
              .from('scenarios')
              .update(saveData)
              .eq('id', state.currentScenarioId)
              .select()
              .single()

            if (error) throw error

            set((state) => {
              state.currentScenarioName = name
              // Update snapshot to match saved state (clears dirty flag)
              // Exclude selectedYear from snapshot (it's just UI state)
              const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
              void _selectedYear // Mark as intentionally unused
              state.loadedScenarioSnapshot = {
                scenarioA: JSON.parse(JSON.stringify(scenarioAWithoutUI)),
                customProjectedValues: JSON.parse(JSON.stringify(state.customProjectedValues))
              }
            })

            return data
          } else {
            // Creating new scenario
            const { data, error } = await supabase
              .from('scenarios')
              .insert({
                user_id: session.user.id,
                ...saveData,
              })
              .select()
              .single()

            if (error) throw error

            set((state) => {
              state.currentScenarioId = data.id
              state.currentScenarioName = name
              // Update snapshot to match saved state (clears dirty flag)
              // Exclude selectedYear from snapshot (it's just UI state)
              const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
              void _selectedYear // Mark as intentionally unused
              state.loadedScenarioSnapshot = {
                scenarioA: JSON.parse(JSON.stringify(scenarioAWithoutUI)),
                customProjectedValues: JSON.parse(JSON.stringify(state.customProjectedValues))
              }
            })

            return data
          }
        },

        saveScenarioBToDatabase: async (
          name: string,
          description: string,
          isPublic: boolean
        ) => {
          const state = get()
          const { supabase } = await import('../lib/supabase')

          // Get current session
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error('Not authenticated')

          if (!state.scenarioB) {
            throw new Error('No Scenario B to save')
          }

          // Fetch QBO sync timestamp (optional)
          let qboSyncTimestamp: string | null = null
          try {
            const { data: cacheData, error: cacheError } = await supabase
              .from('qbo_cache')
              .select('last_sync_timestamp')
              .eq('id', 1)
              .single()

            if (!cacheError && cacheData) {
              qboSyncTimestamp = cacheData.last_sync_timestamp
            }
          } catch (err) {
            console.warn('Could not fetch QBO sync timestamp:', err)
          }

          // Save Scenario B's complete data (all future years, physicians, projection settings)
          // The database stores it as "scenarioA" but it's actually B's data
          const dataMode = state.scenarioB?.dataMode || '2025 Data'

          // Exclude selectedYear from saved data (it's just UI state)
          const { selectedYear: _selectedYear, ...scenarioBWithoutUI } = state.scenarioB
          void _selectedYear // Mark as intentionally unused
          const scenarioData = {
            scenarioA: scenarioBWithoutUI, // Save B's complete data, not A's!
            customProjectedValues: state.customProjectedValues,
          }

          // Determine baseline date based on the data mode we're saving
          const baselineDate = dataMode === '2024 Data'
            ? '2024-12-31'
            : new Date().toISOString().split('T')[0]

          const saveData = {
            name,
            description,
            is_public: isPublic,
            view_mode: 'Multi-Year' as const,
            baseline_mode: dataMode,
            baseline_date: baselineDate,
            qbo_sync_timestamp: qboSyncTimestamp,
            scenario_data: scenarioData,
            ytd_settings: null,
          }

          // If updating existing Scenario B
          if (state.currentScenarioBId) {
            const { data, error } = await supabase
              .from('scenarios')
              .update(saveData)
              .eq('id', state.currentScenarioBId)
              .select()
              .single()

            if (error) throw error

            set((state) => {
              state.currentScenarioBName = name
              // Update snapshot to match saved state (clears dirty flag)
              if (state.scenarioB) {
                // Exclude selectedYear from snapshot (it's just UI state)
                const { selectedYear: _selectedYear, ...scenarioBWithoutUI } = state.scenarioB
                void _selectedYear // Mark as intentionally unused
                state.loadedScenarioBSnapshot = {
                  scenarioB: JSON.parse(JSON.stringify(scenarioBWithoutUI))
                }
              }
            })

            return data
          } else {
            // Creating new scenario from B
            const { data, error } = await supabase
              .from('scenarios')
              .insert({
                user_id: session.user.id,
                ...saveData,
              })
              .select()
              .single()

            if (error) throw error

            set((state) => {
              state.currentScenarioBId = data.id
              state.currentScenarioBName = name
              // Update snapshot to match saved state (clears dirty flag)
              if (state.scenarioB) {
                // Exclude selectedYear from snapshot (it's just UI state)
                const { selectedYear: _selectedYear, ...scenarioBWithoutUI } = state.scenarioB
                void _selectedYear // Mark as intentionally unused
                state.loadedScenarioBSnapshot = {
                  scenarioB: JSON.parse(JSON.stringify(scenarioBWithoutUI))
                }
              }
            })

            return data
          }
        },

        loadScenarioFromDatabase: async (
          id: string, 
          target: 'A' | 'B' = 'A', 
          loadBaseline: boolean = true
        ) => {
          const { supabase } = await import('../lib/supabase')
          
          const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (!data) throw new Error('Scenario not found')

          // Handle based on scenario type
          if (data.view_mode === 'YTD Detailed') {
            // YTD Scenario - restore 2025 baseline customizations
            set((state) => {
              // Restore 2025 year data (physicians, settings)
              if (data.year_2025_data) {
                const existingFutureIndex = state.scenarioA.future.findIndex(f => f.year === 2025)
                if (existingFutureIndex >= 0) {
                  state.scenarioA.future[existingFutureIndex] = data.year_2025_data
                } else {
                  state.scenarioA.future.push(data.year_2025_data)
                }
              }

              // Restore custom projected values (grid overrides)
              if (data.custom_projected_values) {
                state.customProjectedValues = data.custom_projected_values
              }

              state.currentScenarioId = data.id
              state.currentScenarioName = data.name
              state.currentScenarioUserId = data.user_id

              // Create deep copy snapshot for change detection
              // Exclude selectedYear from snapshot (it's just UI state)
              const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
              void _selectedYear // Mark as intentionally unused
              state.loadedScenarioSnapshot = {
                scenarioA: JSON.parse(JSON.stringify(scenarioAWithoutUI)),
                customProjectedValues: JSON.parse(JSON.stringify(state.customProjectedValues))
              }
            })

            // Return the data so caller can access ytd_settings
            return data
          } else {
            // Multi-Year Scenario
            const scenarioData = data.scenario_data
            
            if (!scenarioData) {
              throw new Error('Invalid Multi-Year scenario: missing scenario_data')
            }

            set((state) => {
              if (target === 'A' || loadBaseline) {
                // Loading into A, or loading baseline (affects both A and B)
                state.scenarioA = scenarioData.scenarioA
                // Set the dataMode based on the scenario's stored baseline_mode
                state.scenarioA.dataMode = data.baseline_mode || '2025 Data'
                state.customProjectedValues = scenarioData.customProjectedValues || {}
                state.currentScenarioId = data.id
                state.currentScenarioName = data.name
                state.currentScenarioUserId = data.user_id

                // Create deep copy snapshot for change detection
                // Exclude selectedYear from snapshot (it's just UI state)
                const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
                void _selectedYear // Mark as intentionally unused
                state.loadedScenarioSnapshot = {
                  scenarioA: JSON.parse(JSON.stringify(scenarioAWithoutUI)),
                  customProjectedValues: JSON.parse(JSON.stringify(state.customProjectedValues))
                }
                console.log('[SNAPSHOT A] ========== COMPLETE SCENARIO A DATA ==========')
                console.log('[SNAPSHOT A] Scenario A Object:', JSON.parse(JSON.stringify(state.scenarioA)))
                console.log('[SNAPSHOT A] Snapshot Object:', JSON.parse(JSON.stringify(state.loadedScenarioSnapshot)))
                console.log('[SNAPSHOT A] Future Years Count:', state.scenarioA?.future?.length)
                console.log('[SNAPSHOT A] Future Years Data:', state.scenarioA?.future?.map(f => ({
                  year: f.year,
                  therapyIncome: f.therapyIncome,
                  physicianCount: f.physicians?.length,
                  physicians: f.physicians,
                  locumCosts: f.locumCosts,
                  medicalDirectorHours: f.medicalDirectorHours,
                  prcsMedicalDirectorHours: f.prcsMedicalDirectorHours
                })))
                console.log('[SNAPSHOT A] Projection Settings:', state.scenarioA?.projection)
                console.log('[SNAPSHOT A] Custom Projected Values:', state.customProjectedValues)
                console.log('[SNAPSHOT A] UI State:', {
                  selectedYear: state.scenarioA?.selectedYear,
                  dataMode: state.scenarioA?.dataMode
                })
                console.log('[SNAPSHOT A] ===============================================')
              }

              if (target === 'B') {
                console.log('[LOAD B] Loading scenario into B slot:', { id, name: data.name, baseline_mode: data.baseline_mode })
                // Loading into B for comparison
                // Determine whether to use loaded scenario's baseline or A's baseline
                // Use loaded scenario's baseline if it doesn't use 2025 data, otherwise use A's baseline
                const loadedScenarioBaselineMode = data.baseline_mode || '2025 Data'
                const useLoadedBaseline = loadedScenarioBaselineMode !== '2025 Data'

                if (useLoadedBaseline) {
                  // Use the loaded scenario's baseline when it doesn't use 2025 data
                  state.scenarioB = scenarioData.scenarioA
                  // Set the dataMode to match the loaded scenario's original baseline mode
                  if (state.scenarioB) {
                    state.scenarioB.dataMode = loadedScenarioBaselineMode
                  }
                } else {
                  // Use A's baseline, but load the scenario's projection settings into B
                  state.scenarioB = {
                    ...scenarioData.scenarioA,
                    // Keep A's baseline data but use loaded scenario's projection settings
                    future: scenarioData.scenarioA.future.map((yearData: FutureYear) => {
                      if (yearData.year === 2025) {
                        // For 2025, use A's data (the shared baseline)
                        const a2025 = state.scenarioA.future.find((f: FutureYear) => f.year === 2025)
                        return a2025 || yearData
                      }
                      // For other years, use the loaded scenario's data
                      return yearData
                    })
                  }
                  // Set dataMode to 2025 Data since we're using A's baseline
                  if (state.scenarioB) {
                    state.scenarioB.dataMode = '2025 Data'
                  }
                }

                state.scenarioBEnabled = true
                state.currentScenarioBId = data.id
                state.currentScenarioBName = data.name
                state.currentScenarioBUserId = data.user_id

                // Create deep copy snapshot for B
                // Exclude selectedYear from snapshot (it's just UI state)
                if (state.scenarioB) {
                  const { selectedYear: _selectedYear, ...scenarioBWithoutUI } = state.scenarioB
                  void _selectedYear // Mark as intentionally unused
                  state.loadedScenarioBSnapshot = {
                    scenarioB: JSON.parse(JSON.stringify(scenarioBWithoutUI))
                  }
                }
                console.log('[SNAPSHOT B] ========== COMPLETE SCENARIO B DATA ==========')
                console.log('[SNAPSHOT B] Scenario B Object:', JSON.parse(JSON.stringify(state.scenarioB)))
                console.log('[SNAPSHOT B] Snapshot Object:', JSON.parse(JSON.stringify(state.loadedScenarioBSnapshot)))
                console.log('[SNAPSHOT B] Future Years Count:', state.scenarioB?.future?.length)
                console.log('[SNAPSHOT B] Future Years Data:', state.scenarioB?.future?.map(f => ({
                  year: f.year,
                  therapyIncome: f.therapyIncome,
                  physicianCount: f.physicians?.length,
                  physicians: f.physicians,
                  locumCosts: f.locumCosts,
                  medicalDirectorHours: f.medicalDirectorHours,
                  prcsMedicalDirectorHours: f.prcsMedicalDirectorHours
                })))
                console.log('[SNAPSHOT B] Projection Settings:', state.scenarioB?.projection)
                console.log('[SNAPSHOT B] UI State:', {
                  selectedYear: state.scenarioB?.selectedYear,
                  dataMode: state.scenarioB?.dataMode
                })
                console.log('[SNAPSHOT B] ===============================================')
              }
              // Don't automatically clear B when loading A - they can coexist
              // B should only be cleared when explicitly replaced or reset
            })
            
            return data
          }
        },
      }
    }),
    {
      name: 'radiantcare-state-v1',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null

          try {
            const data = JSON.parse(str)
            // Check if data has expired (7 days = 604800000ms)
            const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
            if (data.state?._timestamp && Date.now() - data.state._timestamp > EXPIRY_MS) {
              console.log('[STORAGE] State expired, clearing...')
              localStorage.removeItem(name)
              return null
            }
            return str
          } catch {
            return str
          }
        },
        setItem: (name, value) => {
          try {
            const data = JSON.parse(value)
            // Add timestamp to track when state was saved
            data.state._timestamp = Date.now()
            localStorage.setItem(name, JSON.stringify(data))
          } catch {
            localStorage.setItem(name, value)
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state: Store) => ({
        scenarioA: state.scenarioA,
        scenarioBEnabled: state.scenarioBEnabled,
        scenarioB: state.scenarioB,
        customProjectedValues: state.customProjectedValues,
        currentScenarioId: state.currentScenarioId,
        currentScenarioName: state.currentScenarioName,
        currentScenarioUserId: state.currentScenarioUserId,
        currentScenarioBId: state.currentScenarioBId,
        currentScenarioBName: state.currentScenarioBName,
        currentScenarioBUserId: state.currentScenarioBUserId,
        loadedScenarioSnapshot: state.loadedScenarioSnapshot,
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


export function usePartnerComp(year: number, scenario: ScenarioKey, fyOverride?: FutureYear) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fyFromStore = sc.future.find((f) => f.year === year)
  const fy = fyOverride ?? fyFromStore

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
function getDefaultValuesForYear(scenario: ScenarioKey, year: number, store: Store) {
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
  _store: Store
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
      current.employeeWeeksVacation !== defaultPhysician.employeeWeeksVacation ||
      current.employeePortionOfYear !== defaultPhysician.employeePortionOfYear ||
      current.partnerPortionOfYear !== defaultPhysician.partnerPortionOfYear ||
      current.startPortionOfYear !== defaultPhysician.startPortionOfYear ||
      current.terminatePortionOfYear !== defaultPhysician.terminatePortionOfYear ||
      current.receivesBenefits !== defaultPhysician.receivesBenefits ||
      current.receivesBonuses !== defaultPhysician.receivesBonuses ||
      current.bonusAmount !== defaultPhysician.bonusAmount ||
      current.hasMedicalDirectorHours !== defaultPhysician.hasMedicalDirectorHours ||
      current.medicalDirectorHoursPercentage !== defaultPhysician.medicalDirectorHoursPercentage ||
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
    const fy = sc?.future.find((f: FutureYear) => f.year === year)

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

/**
 * Compare current scenario state against the loaded scenario snapshot
 * Returns true if any changes detected compared to the loaded state
 */
export function hasChangesFromLoadedScenario(
  year: number,
  _store: Store,
  scenario: 'A' | 'B' = 'A'
): boolean {
  const snapshot = scenario === 'A' ? _store.loadedScenarioSnapshot : _store.loadedScenarioBSnapshot

  // If no snapshot exists, no comparison possible
  if (!snapshot) {
    return false
  }

  const currentScenario = scenario === 'A' ? _store.scenarioA : _store.scenarioB
  const snapshotScenario = scenario === 'A' ? ('scenarioA' in snapshot ? snapshot.scenarioA : null) : ('scenarioB' in snapshot ? snapshot.scenarioB : null)

  if (!currentScenario || !snapshotScenario) return false

  const currentFy = currentScenario.future.find((f: FutureYear) => f.year === year)
  const snapshotFy = snapshotScenario.future.find((f: FutureYear) => f.year === year)

  // If year doesn't exist in snapshot, consider unchanged
  if (!snapshotFy) {
    return false
  }

  // If year doesn't exist in current but exists in snapshot, it's changed
  if (!currentFy) {
    return true
  }

  // Compare physicians
  if (currentFy.physicians.length !== snapshotFy.physicians.length) {
    return true
  }

  for (let i = 0; i < currentFy.physicians.length; i++) {
    const current = currentFy.physicians[i]
    const snapshot = snapshotFy.physicians[i]

    if (
      current.id !== snapshot.id ||
      current.name !== snapshot.name ||
      current.type !== snapshot.type ||
      current.salary !== snapshot.salary ||
      current.weeksVacation !== snapshot.weeksVacation ||
      current.employeeWeeksVacation !== snapshot.employeeWeeksVacation ||
      current.employeePortionOfYear !== snapshot.employeePortionOfYear ||
      current.partnerPortionOfYear !== snapshot.partnerPortionOfYear ||
      current.startPortionOfYear !== snapshot.startPortionOfYear ||
      current.terminatePortionOfYear !== snapshot.terminatePortionOfYear ||
      current.receivesBenefits !== snapshot.receivesBenefits ||
      current.receivesBonuses !== snapshot.receivesBonuses ||
      current.bonusAmount !== snapshot.bonusAmount ||
      current.hasMedicalDirectorHours !== snapshot.hasMedicalDirectorHours ||
      current.medicalDirectorHoursPercentage !== snapshot.medicalDirectorHoursPercentage ||
      current.buyoutCost !== snapshot.buyoutCost ||
      current.trailingSharedMdAmount !== snapshot.trailingSharedMdAmount ||
      current.additionalDaysWorked !== snapshot.additionalDaysWorked
    ) {
      return true
    }
  }

  // Compare FutureYear fields
  if (
    Math.abs((currentFy.locumCosts ?? 0) - (snapshotFy.locumCosts ?? 0)) > 100 ||
    Math.abs((currentFy.medicalDirectorHours ?? 0) - (snapshotFy.medicalDirectorHours ?? 0)) > 100 ||
    Math.abs((currentFy.prcsMedicalDirectorHours ?? 0) - (snapshotFy.prcsMedicalDirectorHours ?? 0)) > 100 ||
    (currentFy.prcsDirectorPhysicianId ?? undefined) !== (snapshotFy.prcsDirectorPhysicianId ?? undefined)
  ) {
    return true
  }

  // Compare customProjectedValues (grid overrides) - only for scenario A
  const currentCustomValues = _store.customProjectedValues || {}
  const snapshotCustomValues = ('customProjectedValues' in snapshot ? snapshot.customProjectedValues : {}) || {}

  const allKeys = new Set([
    ...Object.keys(currentCustomValues),
    ...Object.keys(snapshotCustomValues)
  ])

  for (const key of allKeys) {
    if (currentCustomValues[key] !== snapshotCustomValues[key]) {
      return true
    }
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
  store: Store
): number {
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!sc || year === 2025) return 0 // No projections for baseline year

  // Get baseline data based on data mode
  // IMPORTANT: Must match the logic in applyProjectionFromLastActual to ensure reset button works correctly
  let baselineData
  if (sc.dataMode === 'Custom') {
    // For Custom mode, use the existing baseline data from year 2025 in future array
    const customBaseline = sc.future.find((f: FutureYear) => f.year === 2025)
    if (customBaseline) {
      baselineData = {
        therapyIncome: customBaseline.therapyIncome,
        nonEmploymentCosts: customBaseline.nonEmploymentCosts,
        miscEmploymentCosts: customBaseline.miscEmploymentCosts,
        nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
      }
    } else {
      // Fallback if Custom baseline missing (shouldn't happen)
      const last2025 = store.historic.find((h: YearRow) => h.year === 2025)
      baselineData = {
        therapyIncome: last2025?.therapyIncome || 0,
        nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }
  } else if (sc.dataMode === '2024 Data') {
    const last2024 = store.historic.find((h: YearRow) => h.year === 2024)!
    baselineData = {
      therapyIncome: last2024.therapyIncome,
      nonEmploymentCosts: last2024.nonEmploymentCosts,
      miscEmploymentCosts: ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
    }
  } else if (sc.dataMode === '2025 Data') {
    // Use updated 2025 values from future array if available (grid-synced values)
    const updated2025 = sc.future.find((f: FutureYear) => f.year === 2025)
    const last2025 = store.historic.find((h: YearRow) => h.year === 2025)
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
  const { profile, loading, signOut } = useAuth()
  const [viewMode, setViewMode] = useState<'Multi-Year' | 'YTD Detailed' | 'YTD Mobile'>('YTD Detailed')
  const [urlLoaded, setUrlLoaded] = useState(false)
  // Initialize ytdSettings with defaults from chartConfig
  const [ytdSettings, setYtdSettings] = useState<YTDSettings>(DEFAULT_YTD_SETTINGS)
  // Track whether MultiYearView has been visited (for lazy initialization)
  const [multiYearInitialized, setMultiYearInitialized] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showScenarioManager, setShowScenarioManager] = useState(false)
  const [scenarioManagerView, setScenarioManagerView] = useState<'list' | 'form' | 'edit' | 'formB' | 'editB'>('list')
  const [scenarioManagerInitialScenario, setScenarioManagerInitialScenario] = useState<SavedScenario | undefined>(undefined)
  // Store refresh callback for YTD data after sync
  const ytdRefreshCallbackRef = useRef<(() => void) | null>(null)
  // Shared link warning modal
  const [showSharedLinkWarning, setShowSharedLinkWarning] = useState(false)
  const [pendingSharedLinkId, setPendingSharedLinkId] = useState<string | null>(null)

  // Wrap setYtdSettings in useCallback to prevent unnecessary re-renders in YTDDetailed
  const handleYtdSettingsChange = useCallback((settings: YTDSettings) => {
    setYtdSettings(settings)
  }, [])

  // Callback to register YTD refresh function
  const handleYtdRefreshRequest = useCallback((callback: () => void) => {
    ytdRefreshCallbackRef.current = callback
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

  // Listen for openScenarioManager event from YTDDetailed
  useEffect(() => {
    const handleOpenScenarioManager = () => {
      setScenarioManagerView('list')
      setScenarioManagerInitialScenario(undefined)
      setShowScenarioManager(true)
    }
    window.addEventListener('openScenarioManager', handleOpenScenarioManager)
    return () => {
      window.removeEventListener('openScenarioManager', handleOpenScenarioManager)
    }
  }, [])

  // Listen for editCurrentScenario event (Save button)
  useEffect(() => {
    const handleEditCurrentScenario = async () => {
      if (!store.currentScenarioId) return

      // Fetch the current scenario to pass to the form
      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .eq('id', store.currentScenarioId)
          .single()

        if (error || !data) {
          alert('Failed to load scenario for editing')
          return
        }

        // Open scenario manager in edit mode with scenario data
        setScenarioManagerView('edit')
        setScenarioManagerInitialScenario(data)
        setShowScenarioManager(true)
      } catch (err) {
        console.error('Error loading scenario:', err)
        alert('Failed to load scenario for editing')
      }
    }

    window.addEventListener('editCurrentScenario', handleEditCurrentScenario)
    return () => {
      window.removeEventListener('editCurrentScenario', handleEditCurrentScenario)
    }
  }, [store.currentScenarioId])

  // Listen for saveScenarioAs event
  useEffect(() => {
    const handleSaveScenarioAs = () => {
      setScenarioManagerView('form')
      setScenarioManagerInitialScenario(undefined)
      setShowScenarioManager(true)
    }

    window.addEventListener('saveScenarioAs', handleSaveScenarioAs)
    return () => {
      window.removeEventListener('saveScenarioAs', handleSaveScenarioAs)
    }
  }, [])

  // Listen for editCurrentScenarioB event (Save Scenario B button)
  useEffect(() => {
    const handleEditCurrentScenarioB = async () => {
      if (!store.currentScenarioBId) return

      // Fetch the current scenario B to pass to the form
      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .eq('id', store.currentScenarioBId)
          .single()

        if (error || !data) {
          alert('Failed to load Scenario B for editing')
          return
        }

        // Open scenario manager in editB mode with scenario data
        setScenarioManagerView('editB')
        setScenarioManagerInitialScenario(data)
        setShowScenarioManager(true)
      } catch (err) {
        console.error('Error loading Scenario B:', err)
        alert('Failed to load Scenario B for editing')
      }
    }

    window.addEventListener('editCurrentScenarioB', handleEditCurrentScenarioB)
    return () => {
      window.removeEventListener('editCurrentScenarioB', handleEditCurrentScenarioB)
    }
  }, [store.currentScenarioBId])

  // Listen for saveScenarioBAs event
  useEffect(() => {
    const handleSaveScenarioBAs = () => {
      setScenarioManagerView('formB')
      setScenarioManagerInitialScenario(undefined)
      setShowScenarioManager(true)
    }

    window.addEventListener('saveScenarioBAs', handleSaveScenarioBAs)
    return () => {
      window.removeEventListener('saveScenarioBAs', handleSaveScenarioBAs)
    }
  }, [])

  // Listen for unloadScenario event
  useEffect(() => {
    const handleUnloadScenario = () => {
      if (!store.currentScenarioName) return

      // Cannot unload Default (A)
      if (store.currentScenarioName === 'Default (A)') {
        alert('Cannot unload Default (A) scenario. It serves as the baseline for all projections.')
        return
      }

      const shouldUnload = confirm(
        `Unload "${store.currentScenarioName}"?\n\nAny unsaved changes will be lost. Default (A) will be loaded.`
      )

      if (shouldUnload) {
        // Load Default (A) scenario
        store.setCurrentScenario(null, 'Default (A)')

        // Reset to defaults - for YTD view, reset to baseline 2025 data
        if (viewMode === 'YTD Detailed') {
          // Reset YTD settings to defaults
          setYtdSettings(DEFAULT_YTD_SETTINGS)
        }
      }
    }

    window.addEventListener('unloadScenario', handleUnloadScenario)
    return () => {
      window.removeEventListener('unloadScenario', handleUnloadScenario)
    }
  }, [store, viewMode, setYtdSettings])

  // Listen for unloadScenarioB event
  useEffect(() => {
    const handleUnloadScenarioB = () => {
      if (!store.currentScenarioBName) return

      // Cannot unload Default (B)
      if (store.currentScenarioBName === 'Default (B)') {
        alert('Cannot unload Default (B) scenario. It serves as the baseline for Scenario B.')
        return
      }

      const shouldUnload = confirm(
        `Unload "${store.currentScenarioBName}" from Scenario B?\n\nAny unsaved changes will be lost. Default (B) will be loaded.`
      )

      if (shouldUnload) {
        // Load Default (B) scenario
        store.setCurrentScenarioB(null, 'Default (B)')
      }
    }

    window.addEventListener('unloadScenarioB', handleUnloadScenarioB)
    return () => {
      window.removeEventListener('unloadScenarioB', handleUnloadScenarioB)
    }
  }, [store])

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

  // Detect and handle shared links (/share/{id})
  useEffect(() => {
    const path = window.location.pathname
    const sharedLinkMatch = path.match(/^\/share\/([a-zA-Z0-9]+)$/)

    if (sharedLinkMatch && !pendingSharedLinkId) {
      const linkId = sharedLinkMatch[1]
      setPendingSharedLinkId(linkId)
      setShowSharedLinkWarning(true)
    }
  }, [pendingSharedLinkId])

  // Detect password reset URLs and handle auth state changes
  useEffect(() => {
    const handleAuthStateChange = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')

      if (type === 'recovery' && accessToken) {
        setShowPasswordReset(true)
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    handleAuthStateChange()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setShowPasswordReset(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load shared link after user confirmation
  const loadSharedLink = useCallback(async (linkId: string) => {
    try {
      const response = await authenticatedFetch(`/api/shared-links?id=${linkId}`)

      if (!response.ok) {
        const error = await response.json()
        alert(`Failed to load shared link: ${error.message || 'Unknown error'}`)
        // Clear the URL
        window.history.pushState({}, '', '/')
        return
      }

      const data = await response.json()

      // Load Scenario A
      await store.loadScenarioFromDatabase(data.scenario_a.id, 'A', true)

      // Load Scenario B if enabled
      if (data.scenario_b_enabled && data.scenario_b) {
        store.setScenarioEnabled(true)
        await store.loadScenarioFromDatabase(data.scenario_b.id, 'B', false)
      }

      // Apply view mode
      setViewMode(data.view_mode)
      if (data.view_mode === 'Multi-Year') {
        setMultiYearInitialized(true)
      }

      // Apply UI settings
      if (data.ui_settings) {
        if (data.view_mode === 'YTD Detailed' && data.ui_settings.ytdDetailed) {
          setYtdSettings(data.ui_settings.ytdDetailed)
        }
        // Multi-Year UI settings (selected years) are already loaded with scenarios
      }

      // Clear the URL after successful load
      window.history.pushState({}, '', '/')
    } catch (error) {
      console.error('Error loading shared link:', error)
      alert('Failed to load shared link')
      // Clear the URL
      window.history.pushState({}, '', '/')
    }
  }, [store, setViewMode, setMultiYearInitialized, setYtdSettings])

  // Handle shared link warning confirmation
  const handleSharedLinkConfirm = useCallback(() => {
    if (pendingSharedLinkId) {
      loadSharedLink(pendingSharedLinkId)
      setPendingSharedLinkId(null)
      setShowSharedLinkWarning(false)
    }
  }, [pendingSharedLinkId, loadSharedLink])

  // Handle shared link warning cancel
  const handleSharedLinkCancel = useCallback(() => {
    setPendingSharedLinkId(null)
    setShowSharedLinkWarning(false)
    // Clear the URL
    window.history.pushState({}, '', '/')
  }, [])

  // Load Default (A) and Default (B) scenarios on app load
  useEffect(() => {
    if (!profile || !urlLoaded) return

    // Only load if scenarios aren't already set (avoid overwriting URL-loaded state)
    const hash = window.location.hash
    if (hash && hash.startsWith('#s=')) return

    // Don't load if we're waiting for shared link confirmation
    if (pendingSharedLinkId) return

    // Skip if both scenarios are already loaded with the correct defaults AND snapshots exist
    // Snapshots are needed for dirty detection but aren't persisted, so may need recreation
    // Also check that we have actual scenario data loaded, not just null names
    if (store.currentScenarioName === 'Default (A)' &&
        store.currentScenarioBName === 'Default (B)' &&
        store.loadedScenarioSnapshot &&
        store.loadedScenarioBSnapshot &&
        store.scenarioA &&
        store.scenarioB) {
      console.log('[INIT] Skipping default load - scenarios and snapshots already present')
      return
    }

    console.log('[INIT] Loading default scenarios', {
      hasA: !!store.currentScenarioName,
      hasB: !!store.currentScenarioBName,
      hasSnapshotA: !!store.loadedScenarioSnapshot,
      hasSnapshotB: !!store.loadedScenarioBSnapshot
    })

    // Full state report
    console.log('[STATE REPORT] Current state:', {
      scenarioA: {
        exists: !!store.scenarioA,
        dataMode: store.scenarioA?.dataMode,
        selectedYear: store.scenarioA?.selectedYear,
        projection: store.scenarioA?.projection,
        currentScenarioId: store.currentScenarioId,
        currentScenarioName: store.currentScenarioName
      },
      scenarioB: {
        exists: !!store.scenarioB,
        dataMode: store.scenarioB?.dataMode,
        selectedYear: store.scenarioB?.selectedYear,
        projection: store.scenarioB?.projection,
        currentScenarioBId: store.currentScenarioBId,
        currentScenarioBName: store.currentScenarioBName,
        enabled: store.scenarioBEnabled
      },
      snapshotA: {
        exists: !!store.loadedScenarioSnapshot,
        dataMode: store.loadedScenarioSnapshot?.scenarioA?.dataMode,
        projection: store.loadedScenarioSnapshot?.scenarioA?.projection
      },
      snapshotB: {
        exists: !!store.loadedScenarioBSnapshot,
        dataMode: store.loadedScenarioBSnapshot?.scenarioB?.dataMode,
        projection: store.loadedScenarioBSnapshot?.scenarioB?.projection
      }
    })

    async function loadDefaultScenarios() {
      try {
        // Load favorite or Default scenarios for A and B
        // Include user's scenarios AND public scenarios (for Default (A) and Default (B))
        const { data: scenarios, error } = await supabase
          .from('scenarios')
          .select('*')
          .or(`user_id.eq.${profile?.id},is_public.eq.true`)

        if (error) throw error

        // Don't filter by view mode - scenarios should work across both views
        // Find favorite A or fallback to Default (A)
        const favoriteA = scenarios?.find(s => s.is_favorite_a)
        const defaultA = scenarios?.find(s => s.name === 'Default (A)')
        const scenarioA = favoriteA || defaultA

        // Find favorite B or fallback to Default (B)
        const favoriteB = scenarios?.find(s => s.is_favorite_b)
        const defaultB = scenarios?.find(s => s.name === 'Default (B)')
        const scenarioB = favoriteB || defaultB

        // Load scenario A
        if (scenarioA) {
          console.log(`[INIT] Loading ${favoriteA ? 'favorite' : 'Default'} (A)...`, scenarioA.name)
          await store.loadScenarioFromDatabase(scenarioA.id, 'A', true)
        }

        // Load scenario B and enable checkbox if favorite B exists
        if (scenarioB) {
          console.log(`[INIT] Loading ${favoriteB ? 'favorite' : 'Default'} (B)...`, scenarioB.name)
          await store.loadScenarioFromDatabase(scenarioB.id, 'B', false)
          // Enable scenario B if it's a favorite, otherwise keep it disabled
          if (favoriteB) {
            store.setScenarioEnabled(true)
            console.log('[INIT] Enabled scenario B visibility (favorite)')
          } else {
            store.setScenarioEnabled(false)
            console.log('[INIT] Disabled scenario B visibility')
          }
        }

        // Final state report after loading
        console.log('[STATE REPORT] After loading defaults:', {
          scenarioA: {
            exists: !!store.scenarioA,
            id: store.currentScenarioId,
            name: store.currentScenarioName,
            dataMode: store.scenarioA?.dataMode
          },
          scenarioB: {
            exists: !!store.scenarioB,
            id: store.currentScenarioBId,
            name: store.currentScenarioBName,
            dataMode: store.scenarioB?.dataMode,
            enabled: store.scenarioBEnabled
          },
          snapshotA: {
            exists: !!store.loadedScenarioSnapshot,
            dataMode: store.loadedScenarioSnapshot?.scenarioA?.dataMode
          },
          snapshotB: {
            exists: !!store.loadedScenarioBSnapshot,
            dataMode: store.loadedScenarioBSnapshot?.scenarioB?.dataMode
          }
        })
      } catch (err) {
        console.error('Error loading default scenarios:', err)
      }
    }

    loadDefaultScenarios()
  }, [profile, urlLoaded, store, viewMode])

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
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 20
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 48,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 80, width: 'auto', marginBottom: 16 }} />
            <h1 style={{
              margin: '0 0 8px 0',
              fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
              color: '#7c2a83',
              fontWeight: 900,
              fontSize: 32,
              textAlign: 'center'
            }}>
              Compensation Dashboard
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
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

        {/* Shared Link Warning Modal */}
        <SharedLinkWarningModal
          isOpen={showSharedLinkWarning}
          onConfirm={handleSharedLinkConfirm}
          onCancel={handleSharedLinkCancel}
        />
      </div>
    )
  }

  // User is authenticated - show the full dashboard
  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: viewMode === 'YTD Mobile' ? 0 : 16, position: 'relative' }}>
      {/* Top Bar with Auth and Help - hide in mobile mode */}
      {viewMode !== 'YTD Mobile' && (
        <div className="full-bleed" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12, paddingTop: 0, paddingLeft: 16, paddingRight: 16 }}>
          {/* Sync Button - only show in YTD Detailed view */}
          {viewMode === 'YTD Detailed' && (
            <SyncButton
              environment="production"
              isLoadingDashboard={false}
              onSyncComplete={() => {
                // Trigger data refresh in YTDDetailed component
                ytdRefreshCallbackRef.current?.()
              }}
            />
          )}
          {/* Spacer to push right elements to the right when SyncButton is hidden */}
          {viewMode !== 'YTD Detailed' && <div style={{ flex: 1 }}></div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            {profile.email}
          </span>
        <button
          onClick={() => setShowPasswordReset(true)}
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
          Change Password
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
        </div>
      )}

      {/* Centered Header - hide in mobile mode */}
      {viewMode !== 'YTD Mobile' && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
          <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
        </div>
      )}

      <div style={{
        marginTop: viewMode === 'YTD Mobile' ? 0 : 20,
        maxWidth: viewMode === 'YTD Mobile' ? '100%' : 1600,
        margin: viewMode === 'YTD Mobile' ? 0 : '20px auto 0 auto'
      }}>
        {/* View Mode Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setViewMode('YTD Detailed')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'YTD Detailed' ? '#e5e7eb' : '#fff', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >YTD Detailed</button>
            <button
              onClick={() => setViewMode('Multi-Year')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'Multi-Year' ? '#e5e7eb' : '#fff', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >Multi-Year</button>
            <button
              onClick={() => setViewMode('YTD Mobile')}
              style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: viewMode === 'YTD Mobile' ? '#e5e7eb' : '#fff', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >YTD Mobile</button>
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
                onRefreshRequest={handleYtdRefreshRequest}
              />

            </div>
            <div style={{ display: viewMode === 'YTD Mobile' ? 'block' : 'none' }}>
              <YTDDetailedMobile
                onRefreshRequest={handleYtdRefreshRequest}
                onPasswordChange={() => setShowPasswordReset(true)}
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
                padding: 40,
                maxWidth: 800,
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
        viewMode={viewMode}
        ytdSettings={ytdSettings}
        onYtdSettingsChange={handleYtdSettingsChange}
        initialView={scenarioManagerView}
        initialScenario={scenarioManagerInitialScenario}
      />

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={showPasswordReset}
        onClose={() => setShowPasswordReset(false)}
        mode="change"
      />

      {/* Shared Link Warning Modal */}
      <SharedLinkWarningModal
        isOpen={showSharedLinkWarning}
        onConfirm={handleSharedLinkConfirm}
        onCancel={handleSharedLinkCancel}
      />
    </div>
  )
}