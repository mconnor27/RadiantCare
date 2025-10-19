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
import MobileWarningModal from './shared/MobileWarningModal'
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
import { getDefaultTrailingSharedMdAmount } from './dashboard/shared/tooltips'
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
        // NEW: Dedicated YTD state (separate from Scenario A/B)
        ytdData: INITIAL_FUTURE_YEARS_A.find(f => f.year === 2025) || {
          year: 2025,
          therapyIncome: 0,
          nonEmploymentCosts: 0,
          nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
          locumCosts: DEFAULT_LOCUM_COSTS_2025,
          miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
          medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
          prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
          consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025,
          prcsDirectorPhysicianId: scenarioADefaultsByYear(2025).find(p => p.name === 'Suszko')?.id,
          physicians: scenarioADefaultsByYear(2025),
        },
        ytdCustomProjectedValues: {},
        currentScenarioId: null,
        currentScenarioName: null,
        currentScenarioUserId: null,
        currentScenarioBId: null,
        currentScenarioBName: null,
        currentScenarioBUserId: null,
        // NEW: Split scenario tracking
        currentYearSettingId: null,
        currentYearSettingName: null,
        currentYearSettingUserId: null,
        currentProjectionId: null,
        currentProjectionName: null,
        currentProjectionUserId: null,
        // Legacy snapshots
        loadedScenarioSnapshot: null,
        loadedScenarioBSnapshot: null,
        // NEW: Split snapshots
        loadedCurrentYearSettingsSnapshot: null,
        loadedProjectionSnapshot: null,
        // NEW: Expected projection snapshots (for dirty detection)
        expectedProjectionSnapshotA: null,
        expectedProjectionSnapshotB: null,
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
              } else {
                // Map by name to each year's physician id, if present
                const match = f.physicians.find((p) => p.name === selectedName && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
                f.prcsDirectorPhysicianId = match ? match.id : null
              }

              // NEW: Mark as overridden for future years (2026+)
              if (f.year >= 2026) {
                if (!f._overrides) f._overrides = {}
                f._overrides.prcsDirectorPhysicianId = true
                console.log(`🏷️ [Override] Marked prcsDirectorPhysicianId as overridden for year ${f.year}`)
              }
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

              // NEW: Mark this field as user-overridden (for sparse saving)
              // Only mark as override for future years (2026+), not baseline year (2025)
              if (year >= 2026) {
                if (!fy._overrides) fy._overrides = {}
                fy._overrides[field] = true
                console.log(`🏷️ [Override] Marked ${field} as overridden for year ${year}`)
              }

              // If we're updating a 2025 baseline value, trigger projection recalculation
              // for future years without switching to Custom mode
              if (year === 2025) {
                setTimeout(() => {
                  get().applyProjectionFromLastActual(scenario)
                }, 0)
              }
            }
          }),
        setYtdValue: (field, value) =>
          set((state) => {
            // Guard: Only update if value actually changed to prevent infinite loops
            const currentValue = state.ytdData[field]
            const valueChanged = typeof currentValue === 'number' && typeof value === 'number'
              ? Math.abs(currentValue - value) > 0.01  // Use small epsilon for floating point comparison
              : currentValue !== value

            if (!valueChanged) {
              return  // Skip update if value hasn't changed
            }

            state.ytdData[field] = value

            // NEW: Trigger recomputation of projections if baseline changed
            // Use setTimeout to avoid infinite loops and batch updates
            setTimeout(() => {
              get().recomputeProjectionsFromBaseline()
            }, 0)
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
            // Only consider it a partner mix change if the portion changed AND the type changed,
            // or if it's a new physician. Small portion changes (just slider adjustments) shouldn't trigger redistribution.
            const partnerMixChanged = isNewInYear
              ? newPartnerPortion > 0
              : (typeChanged && prevPartnerPortion !== newPartnerPortion)

            if (mdPctChanged) {
              // DELTA TRACKING: Redistribute based on change, not recalculation
              // This is mathematically invertible and avoids floating point drift
              const targetId = physician.id
              const eligibles = fy.physicians.filter(p => getPartnerPortionOfYear(p) > 0)
              const target = eligibles.find(p => p.id === targetId)
              if (target) {
                const others = eligibles.filter(p => p.id !== targetId)
                
                // Calculate percentage taken by prior year retirees (fixed dollar amounts)
                const totalMdBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 97200
                const priorYearRetirees = fy.physicians.filter(p => p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0)
                const retireeFixedDollars = priorYearRetirees.reduce((sum, p) => 
                  sum + (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)), 0)
                const retireePct = totalMdBudget > 0 ? (retireeFixedDollars / totalMdBudget) * 100 : 0
                
                // Active partners must share the remaining percentage (100% - retiree%)
                const maxActivePartnersPct = 100 - retireePct
                const oldTargetPct = prev?.medicalDirectorHoursPercentage ?? 0
                const desiredTargetPct = Math.max(0, Math.min(maxActivePartnersPct, physician.medicalDirectorHoursPercentage ?? 0))
                
                // Calculate the DELTA
                const delta = desiredTargetPct - oldTargetPct
                
                console.log(`[Store Redistribution - DELTA] Total MD Budget: $${totalMdBudget}, Retiree Fixed: $${retireeFixedDollars} (${retireePct.toFixed(6)}%)`)
                console.log(`[Store Redistribution - DELTA] Target ${target.name}: ${oldTargetPct.toFixed(6)}% → ${desiredTargetPct.toFixed(6)}% (Δ = ${delta.toFixed(6)}%)`)
                console.log(`[Store Redistribution - DELTA] BEFORE - Others:`, others.map(p => `${p.name}: ${p.medicalDirectorHoursPercentage?.toFixed(6)}%`))
                
                if (others.length === 0) {
                  // Only one active partner - they get all available percentage
                  target.medicalDirectorHoursPercentage = Math.round(maxActivePartnersPct * 1e6) / 1e6
                  target.hasMedicalDirectorHours = target.medicalDirectorHoursPercentage > 0
                } else {
                  // Distribute the NEGATIVE delta PROPORTIONALLY among all others based on partner portion of year
                  // Handle case where some physicians might go negative and need iterative redistribution
                  let remainingDelta = delta
                  let availableOthers = [...others]

                  while (Math.abs(remainingDelta) > 0.000001 && availableOthers.length > 0) {
                    // Calculate total partner portions for available others
                    const totalPartnerPortions = availableOthers.reduce((sum, p) => sum + getPartnerPortionOfYear(p), 0)

                    let actuallyAbsorbed = 0
                    const nowZeroed: typeof availableOthers = []

                    for (const p of availableOthers) {
                      const partnerPortion = getPartnerPortionOfYear(p)
                      // Distribute proportionally based on partner portion of year
                      const proportionalWeight = totalPartnerPortions > 0 ? partnerPortion / totalPartnerPortions : 1 / availableOthers.length
                      const proportionalAdjustment = -remainingDelta * proportionalWeight

                      const currentPct = p.medicalDirectorHoursPercentage ?? 0
                      const newPct = currentPct + proportionalAdjustment

                      if (newPct < 0) {
                        // This physician can't absorb the full adjustment - take what we can
                        actuallyAbsorbed += currentPct // Track what was actually absorbed
                        p.medicalDirectorHoursPercentage = 0
                        p.hasMedicalDirectorHours = false
                        nowZeroed.push(p)
                      } else {
                        // This physician can absorb the full adjustment
                        actuallyAbsorbed += -proportionalAdjustment // Track what was actually absorbed
                        p.medicalDirectorHoursPercentage = Math.round(newPct * 1e6) / 1e6
                        p.hasMedicalDirectorHours = p.medicalDirectorHoursPercentage > 0
                      }
                    }

                    // Update remaining delta based on what was actually absorbed
                    remainingDelta -= actuallyAbsorbed

                    // Remove zeroed physicians from available list for next iteration
                    availableOthers = availableOthers.filter(p => !nowZeroed.includes(p))

                    // If we zeroed anyone, we have remaining delta to redistribute
                    if (nowZeroed.length === 0 || availableOthers.length === 0) {
                      // Either everyone absorbed their share, or everyone is zeroed
                      break
                    }
                  }

                  // Set target to the new value
                  target.medicalDirectorHoursPercentage = Math.round(desiredTargetPct * 1e6) / 1e6
                  target.hasMedicalDirectorHours = target.medicalDirectorHoursPercentage > 0
                }

                // Log final state after redistribution
                console.log(`[Store Redistribution] AFTER - Target ${target.name}: ${target.medicalDirectorHoursPercentage?.toFixed(6)}%`)
                console.log(`[Store Redistribution] AFTER - Others:`, others.map(p => `${p.name}: ${p.medicalDirectorHoursPercentage?.toFixed(6)}%`))
                const totalActivePct = target.medicalDirectorHoursPercentage! + others.reduce((s, p) => s + (p.medicalDirectorHoursPercentage ?? 0), 0)
                console.log(`[Store Redistribution] Total Active %: ${totalActivePct.toFixed(6)}%, Max Allowed: ${maxActivePartnersPct.toFixed(6)}%`)
                console.log(`[Store Redistribution] Grand Total %: ${(totalActivePct + retireePct).toFixed(6)}% (should be 100%)`)
                
                // Log dollar amounts
                const targetDollars = (target.medicalDirectorHoursPercentage! / 100) * totalMdBudget
                console.log(`[Store Redistribution] Target ${target.name} dollars: $${targetDollars.toFixed(2)}`)
                others.forEach(p => {
                  const dollars = ((p.medicalDirectorHoursPercentage ?? 0) / 100) * totalMdBudget
                  console.log(`[Store Redistribution] Other ${p.name} dollars: $${dollars.toFixed(2)}`)
                })
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

            // NEW: Mark physicians as overridden for the edited year (2026+)
            if (year >= 2026) {
              if (!fy._overrides) fy._overrides = {}
              fy._overrides.physicians = true
              console.log(`🏷️ [Override] Marked physicians as overridden for year ${year}`)
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
        
        // YTD-specific physician methods
        upsertYtdPhysician: (physician) =>
          set((state) => {
            console.log(`[Upsert YTD Physician] Updating ${physician.name}`)
            
            const idx = state.ytdData.physicians.findIndex((p) => p.id === physician.id)
            const previousInYear = idx >= 0 ? state.ytdData.physicians[idx] : undefined
            const prev = previousInYear

            if (prev) {
              // Log what changed
              const changes: string[] = []
              for (const key of Object.keys(physician) as Array<keyof typeof physician>) {
                if (JSON.stringify(physician[key]) !== JSON.stringify(prev[key])) {
                  changes.push(`${String(key)}: ${JSON.stringify(prev[key])} -> ${JSON.stringify(physician[key])}`)
                }
              }
              if (changes.length > 0) {
                console.log(`[Upsert YTD Physician] Changes:`, changes)
              }
            }

            if (idx >= 0) state.ytdData.physicians[idx] = physician
            else state.ytdData.physicians.push(physician)

            // Determine if this edit was a manual MD percentage adjustment
            const mdPctChanged = !!prev && prev.medicalDirectorHoursPercentage !== physician.medicalDirectorHoursPercentage

            // Check if partner portion changed (which affects MD redistribution)
            const prevPartnerPortion = prev ? getPartnerPortionOfYear(prev) : 0
            const newPartnerPortion = getPartnerPortionOfYear(physician)
            const partnerPortionChanged = prevPartnerPortion !== newPartnerPortion

            console.log(`[Upsert YTD Physician] MD percentage changed: ${mdPctChanged}`)
            console.log(`[Upsert YTD Physician] Partner portion changed: ${partnerPortionChanged} (${prevPartnerPortion} -> ${newPartnerPortion})`)

            if (mdPctChanged) {
              // DELTA TRACKING: Redistribute based on change, not recalculation
              // This is mathematically invertible and avoids floating point drift
              const targetId = physician.id
              const eligibles = state.ytdData.physicians.filter(p => getPartnerPortionOfYear(p) > 0)
              const target = eligibles.find(p => p.id === targetId)
              if (target) {
                const others = eligibles.filter(p => p.id !== targetId)

                // Calculate percentage taken by prior year retirees (fixed dollar amounts)
                const totalMdBudget = state.ytdData.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS
                const priorYearRetirees = state.ytdData.physicians.filter(p => p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0)
                const retireeFixedDollars = priorYearRetirees.reduce((sum, p) =>
                  sum + (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)), 0)
                const retireePct = totalMdBudget > 0 ? (retireeFixedDollars / totalMdBudget) * 100 : 0

                // Active partners must share the remaining percentage (100% - retiree%)
                const maxActivePartnersPct = 100 - retireePct
                const oldTargetPct = prev?.medicalDirectorHoursPercentage ?? 0
                const desiredTargetPct = Math.max(0, Math.min(maxActivePartnersPct, physician.medicalDirectorHoursPercentage ?? 0))

                // Calculate the DELTA
                const delta = desiredTargetPct - oldTargetPct

                console.log(`[YTD Store Redistribution - DELTA] Total MD Budget: $${totalMdBudget}, Retiree Fixed: $${retireeFixedDollars} (${retireePct.toFixed(6)}%)`)
                console.log(`[YTD Store Redistribution - DELTA] Target ${target.name}: ${oldTargetPct.toFixed(6)}% → ${desiredTargetPct.toFixed(6)}% (Δ = ${delta.toFixed(6)}%)`)
                console.log(`[YTD Store Redistribution - DELTA] BEFORE - Others:`, others.map(p => `${p.name}: ${p.medicalDirectorHoursPercentage?.toFixed(6)}%`))

                if (others.length === 0) {
                  // Only one active partner - they get all available percentage
                  target.medicalDirectorHoursPercentage = Math.round(maxActivePartnersPct * 1e6) / 1e6
                  target.hasMedicalDirectorHours = target.medicalDirectorHoursPercentage > 0
                } else {
                  // Distribute the NEGATIVE delta PROPORTIONALLY among all others based on partner portion of year
                  // Handle case where some physicians might go negative and need iterative redistribution
                  let remainingDelta = delta
                  let availableOthers = [...others]

                  while (Math.abs(remainingDelta) > 0.000001 && availableOthers.length > 0) {
                    // Calculate total partner portions for available others
                    const totalPartnerPortions = availableOthers.reduce((sum, p) => sum + getPartnerPortionOfYear(p), 0)

                    let actuallyAbsorbed = 0
                    const nowZeroed: typeof availableOthers = []

                    for (const p of availableOthers) {
                      const partnerPortion = getPartnerPortionOfYear(p)
                      // Distribute proportionally based on partner portion of year
                      const proportionalWeight = totalPartnerPortions > 0 ? partnerPortion / totalPartnerPortions : 1 / availableOthers.length
                      const proportionalAdjustment = -remainingDelta * proportionalWeight

                      const currentPct = p.medicalDirectorHoursPercentage ?? 0
                      const newPct = currentPct + proportionalAdjustment

                      if (newPct < 0) {
                        // This physician can't absorb the full adjustment - take what we can
                        actuallyAbsorbed += currentPct // Track what was actually absorbed
                        p.medicalDirectorHoursPercentage = 0
                        p.hasMedicalDirectorHours = false
                        nowZeroed.push(p)
                      } else {
                        // This physician can absorb the full adjustment
                        actuallyAbsorbed += -proportionalAdjustment // Track what was actually absorbed
                        p.medicalDirectorHoursPercentage = Math.round(newPct * 1e6) / 1e6
                        p.hasMedicalDirectorHours = p.medicalDirectorHoursPercentage > 0
                      }
                    }

                    // Update remaining delta based on what was actually absorbed
                    remainingDelta -= actuallyAbsorbed

                    // Remove zeroed physicians from available list for next iteration
                    availableOthers = availableOthers.filter(p => !nowZeroed.includes(p))

                    // If we zeroed anyone, we have remaining delta to redistribute
                    if (nowZeroed.length === 0 || availableOthers.length === 0) {
                      // Either everyone absorbed their share, or everyone is zeroed
                      break
                    }
                  }

                  // Set target to the new value
                  target.medicalDirectorHoursPercentage = Math.round(desiredTargetPct * 1e6) / 1e6
                  target.hasMedicalDirectorHours = target.medicalDirectorHoursPercentage > 0
                }

                // Log final state after redistribution
                console.log(`[YTD Store Redistribution] AFTER - Target ${target.name}: ${target.medicalDirectorHoursPercentage?.toFixed(6)}%`)
                console.log(`[YTD Store Redistribution] AFTER - Others:`, others.map(p => `${p.name}: ${p.medicalDirectorHoursPercentage?.toFixed(6)}%`))
                const totalActivePct = target.medicalDirectorHoursPercentage! + others.reduce((s, p) => s + (p.medicalDirectorHoursPercentage ?? 0), 0)
                console.log(`[YTD Store Redistribution] Total Active %: ${totalActivePct.toFixed(6)}%, Max Allowed: ${maxActivePartnersPct.toFixed(6)}%`)
                console.log(`[YTD Store Redistribution] Grand Total %: ${(totalActivePct + retireePct).toFixed(6)}% (should be 100%)`)

                // Log dollar amounts
                const targetDollars = (target.medicalDirectorHoursPercentage! / 100) * totalMdBudget
                console.log(`[YTD Store Redistribution] Target ${target.name} dollars: $${targetDollars.toFixed(2)}`)
                others.forEach(p => {
                  const dollars = ((p.medicalDirectorHoursPercentage ?? 0) / 100) * totalMdBudget
                  console.log(`[YTD Store Redistribution] Other ${p.name} dollars: $${dollars.toFixed(2)}`)
                })
              }
            } else if (partnerPortionChanged) {
              // Only auto-redistribute when partner portion changes
              console.log(`[Upsert YTD Physician] Calling calculateMedicalDirectorHourPercentages (partner portion changed)`)
              const before = state.ytdData.physicians.map(p => ({ name: p.name, pct: p.medicalDirectorHoursPercentage }))
              state.ytdData.physicians = calculateMedicalDirectorHourPercentages(state.ytdData.physicians)
              const after = state.ytdData.physicians.map(p => ({ name: p.name, pct: p.medicalDirectorHoursPercentage }))
              console.log(`[Upsert YTD Physician] MD percentages before:`, before)
              console.log(`[Upsert YTD Physician] MD percentages after:`, after)
            } else {
              console.log(`[Upsert YTD Physician] Skipping MD redistribution (mdPctChanged=${mdPctChanged}, partnerPortionChanged=${partnerPortionChanged})`)
            }

            // NEW: Trigger recomputation of projections if baseline changed
            setTimeout(() => {
              get().recomputeProjectionsFromBaseline()
            }, 0)
          }),
        
        removeYtdPhysician: (physicianId) =>
          set((state) => {
            state.ytdData.physicians = state.ytdData.physicians.filter((p) => p.id !== physicianId)
            // Re-distribute medical director hours after removal
            state.ytdData.physicians = calculateMedicalDirectorHourPercentages(state.ytdData.physicians)

            // NEW: Trigger recomputation of projections if baseline changed
            setTimeout(() => {
              get().recomputeProjectionsFromBaseline()
            }, 0)
          }),
        
        reorderYtdPhysicians: (fromIndex, toIndex) =>
          set((state) => {
            const physicians = [...state.ytdData.physicians]
            const [movedPhysician] = physicians.splice(fromIndex, 1)
            physicians.splice(toIndex, 0, movedPhysician)
            state.ytdData.physicians = physicians
          }),
        
        setYtdPrcsDirector: (physicianId) =>
          set((state) => {
            state.ytdData.prcsDirectorPhysicianId = physicianId
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
            // Use the actual baseline value from the scenario, not the hardcoded default
            const baseStaff2025 = baselineData.nonMdEmploymentCosts
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
            // Use the actual baseline value from the scenario, not the hardcoded default
            const baseStaff2025 = baselineData.nonMdEmploymentCosts
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

            // NEW: Clear all override flags - everything will be recomputed from formulas
            console.log('🧹 [resetProjectionSettings] Clearing all override flags')
            scenarioState.future.forEach(fy => {
              if (fy.year >= 2026) {
                delete fy._overrides
              }
            })
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
        
        setYtdCustomProjectedValue: (accountName: string, value: number) =>
          set((state) => {
            state.ytdCustomProjectedValues[accountName] = value
          }),
        
        removeYtdCustomProjectedValue: (accountName: string) =>
          set((state) => {
            delete state.ytdCustomProjectedValues[accountName]
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

        // Update/refresh the scenario snapshot (call this after cache sync or other updates)
        updateScenarioSnapshot: (scenario: 'A' | 'B' = 'A') => {
          set((state) => {
            if (scenario === 'A') {
              // Exclude selectedYear from snapshot (it's just UI state)
              const { selectedYear: _selectedYear, ...scenarioAWithoutUI } = state.scenarioA
              void _selectedYear // Mark as intentionally unused
              state.loadedScenarioSnapshot = {
                scenarioA: JSON.parse(JSON.stringify(scenarioAWithoutUI)),
                customProjectedValues: JSON.parse(JSON.stringify(state.customProjectedValues))
              }
              console.log('📸 [Snapshot] Updated Scenario A after cache sync')
            } else {
              if (!state.scenarioB) {
                console.warn('Cannot update snapshot: Scenario B does not exist')
                return
              }
              const { selectedYear: _selectedYear, ...scenarioBWithoutUI } = state.scenarioB
              void _selectedYear // Mark as intentionally unused
              state.loadedScenarioBSnapshot = {
                scenarioB: JSON.parse(JSON.stringify(scenarioBWithoutUI))
              }
              console.log('📸 [Snapshot] Updated Scenario B after cache sync')
            }
          })
        },

        // Reset scenario from loaded snapshot (simple, fast reset without database reload)
        resetScenarioFromSnapshot: (scenario: 'A' | 'B' = 'A') => {
          set((state) => {
            const snapshot = scenario === 'A' ? state.loadedScenarioSnapshot : state.loadedScenarioBSnapshot
            
            // If no snapshot exists, can't reset
            if (!snapshot) {
              console.warn(`No snapshot available for scenario ${scenario}`)
              return
            }

            if (scenario === 'A') {
              // Preserve UI state (selectedYear)
              const preservedSelectedYear = state.scenarioA.selectedYear
              
              // Get snapshot data
              const snapshotScenarioA = 'scenarioA' in snapshot ? snapshot.scenarioA : null
              
              if (snapshotScenarioA) {
                // Deep clone the snapshot scenario to avoid reference issues
                state.scenarioA = JSON.parse(JSON.stringify(snapshotScenarioA))
                
                // Restore preserved UI state
                state.scenarioA.selectedYear = preservedSelectedYear
                
                // Restore custom projected values (grid overrides)
                if ('customProjectedValues' in snapshot) {
                  state.customProjectedValues = JSON.parse(JSON.stringify(snapshot.customProjectedValues))
                }
              }
            } else {
              // Scenario B
              if (!state.scenarioB) {
                console.warn('Scenario B does not exist in current state')
                return
              }
              
              const preservedSelectedYear = state.scenarioB.selectedYear
              
              const snapshotScenarioB = 'scenarioB' in snapshot ? snapshot.scenarioB : null
              
              if (snapshotScenarioB) {
                const restoredScenario: ScenarioState = JSON.parse(JSON.stringify(snapshotScenarioB))
                restoredScenario.selectedYear = preservedSelectedYear
                state.scenarioB = restoredScenario
                
                // Note: Scenario B doesn't have separate customProjectedValues
              }
            }
          })
        },

        saveScenarioToDatabase: async (
          name: string,
          description: string,
          isPublic: boolean,
          viewMode: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile',
          ytdSettings?: YTDSettings
        ) => {
          const state = get()
          // Use the already-imported supabase client (line 4) instead of dynamic import

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
            scenario_type: 'current_year' | 'projection'
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
              scenario_type: 'current_year',
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
              scenario_type: 'projection',
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
          // Use the already-imported supabase client (line 4)

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
          // Use the already-imported supabase client (line 4)
          
          const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (!data) throw new Error('Scenario not found')

          // Handle based on scenario type
          // NEW: Route modular PROJECTION scenarios to loadProjection()
          if ('scenario_type' in data && data.scenario_type === 'projection') {
            console.log('🔄 [loadScenarioFromDatabase] Detected PROJECTION scenario, routing to loadProjection()')
            return await get().loadProjection(id, target)
          }

          // NEW: Route modular CURRENT_YEAR scenarios to loadCurrentYearSettings()
          if ('scenario_type' in data && data.scenario_type === 'current_year') {
            console.log('🔄 [loadScenarioFromDatabase] Detected CURRENT_YEAR scenario, routing to loadCurrentYearSettings()')
            return await get().loadCurrentYearSettings(id)
          }

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
                console.log('📸 [Snapshot] Created Scenario A snapshot')
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
                console.log('📸 [Snapshot] Created Scenario B snapshot')
              }
              // Don't automatically clear B when loading A - they can coexist
              // B should only be cleared when explicitly replaced or reset
            })
            
            return data
          }
        },

        // NEW MODULAR SCENARIO METHODS

        setCurrentYearSetting: (id: string | null, name: string | null, userId?: string | null) => {
          set((state) => {
            state.currentYearSettingId = id
            state.currentYearSettingName = name
            state.currentYearSettingUserId = userId || null
          })
        },

        setCurrentProjection: (id: string | null, name: string | null, userId?: string | null) => {
          set((state) => {
            state.currentProjectionId = id
            state.currentProjectionName = name
            state.currentProjectionUserId = userId || null
          })
        },

        isCurrentYearSettingsDirty: () => {
          const state = get()
          if (!state.loadedCurrentYearSettingsSnapshot) return false

          // Deep compare YTD data
          const currentYtdStr = JSON.stringify(state.ytdData)
          const snapshotYtdStr = JSON.stringify(state.loadedCurrentYearSettingsSnapshot.ytdData)
          
          if (currentYtdStr !== snapshotYtdStr) {
            console.log('[Dirty Check] YTD data changed')
            
            // Find the specific differences
            const current = state.ytdData
            const snapshot = state.loadedCurrentYearSettingsSnapshot.ytdData
            
            // Check simple fields
            const simpleFields = ['year', 'therapyIncome', 'nonEmploymentCosts', 'nonMdEmploymentCosts', 'locumCosts', 'miscEmploymentCosts', 'medicalDirectorHours', 'prcsMedicalDirectorHours', 'prcsDirectorPhysicianId', 'consultingServicesAgreement']
            for (const field of simpleFields) {
              if (current[field as keyof typeof current] !== snapshot[field as keyof typeof snapshot]) {
                console.log(`[Dirty Check]   Field changed: ${field}`)
                console.log(`[Dirty Check]     Current:  ${JSON.stringify(current[field as keyof typeof current])}`)
                console.log(`[Dirty Check]     Snapshot: ${JSON.stringify(snapshot[field as keyof typeof snapshot])}`)
              }
            }
            
            // Check physicians array
            if (JSON.stringify(current.physicians) !== JSON.stringify(snapshot.physicians)) {
              console.log('[Dirty Check]   Physicians changed')
              console.log(`[Dirty Check]     Current count:  ${current.physicians.length}`)
              console.log(`[Dirty Check]     Snapshot count: ${snapshot.physicians.length}`)
              
              // Compare each physician
              for (let i = 0; i < Math.max(current.physicians.length, snapshot.physicians.length); i++) {
                const currPhys = current.physicians[i]
                const snapPhys = snapshot.physicians[i]
                
                if (JSON.stringify(currPhys) !== JSON.stringify(snapPhys)) {
                  console.log(`[Dirty Check]     Physician ${i} (${currPhys?.name || snapPhys?.name}) differs:`)
                  if (currPhys && snapPhys) {
                    // Find specific field differences
                    const allKeys = new Set([...Object.keys(currPhys), ...Object.keys(snapPhys)])
                    for (const key of allKeys) {
                      if (JSON.stringify(currPhys[key as keyof typeof currPhys]) !== JSON.stringify(snapPhys[key as keyof typeof snapPhys])) {
                        console.log(`[Dirty Check]       ${key}: ${JSON.stringify(currPhys[key as keyof typeof currPhys])} -> ${JSON.stringify(snapPhys[key as keyof typeof snapPhys])}`)
                      }
                    }
                  } else {
                    console.log(`[Dirty Check]       One is missing: current=${!!currPhys}, snapshot=${!!snapPhys}`)
                  }
                }
              }
            }
            
            return true
          }

          // Compare YTD grid overrides
          const currentCustomStr = JSON.stringify(state.ytdCustomProjectedValues)
          const snapshotCustomStr = JSON.stringify(state.loadedCurrentYearSettingsSnapshot.ytdCustomProjectedValues)
          
          if (currentCustomStr !== snapshotCustomStr) {
            console.log('[Dirty Check] YTD custom projected values changed')
            console.log('[Dirty Check]   Current keys:', Object.keys(state.ytdCustomProjectedValues).length)
            console.log('[Dirty Check]   Snapshot keys:', Object.keys(state.loadedCurrentYearSettingsSnapshot.ytdCustomProjectedValues).length)
            
            // Show differences
            const allKeys = new Set([
              ...Object.keys(state.ytdCustomProjectedValues),
              ...Object.keys(state.loadedCurrentYearSettingsSnapshot.ytdCustomProjectedValues)
            ])
            
            for (const key of allKeys) {
              const curr = state.ytdCustomProjectedValues[key]
              const snap = state.loadedCurrentYearSettingsSnapshot.ytdCustomProjectedValues[key]
              if (curr !== snap) {
                console.log(`[Dirty Check]   ${key}: ${curr} vs ${snap}`)
              }
            }
            
            return true
          }

          console.log('[Dirty Check] No changes detected - clean state')
          return false
        },

        isProjectionDirty: () => {
          const state = get()
          if (!state.loadedProjectionSnapshot) return false

          // NEW: If we're in 2025 Data mode with expected snapshot, use baseline-aware dirty detection
          if (state.scenarioA.dataMode === '2025 Data' && state.expectedProjectionSnapshotA) {
            console.log('🔍 [isProjectionDirty] Using baseline-aware dirty detection with snapshot')

            // Step 1: Compare projection INPUTS (not outputs) to detect user changes
            // Compare projection settings
            const projectionDirty = Object.keys(state.scenarioA.projection).some(key => {
              const k = key as keyof typeof state.scenarioA.projection
              return Math.abs(state.scenarioA.projection[k] - state.loadedProjectionSnapshot!.projection[k]) > 0.001
            })

            if (projectionDirty) {
              console.log('✏️ [isProjectionDirty] Projection settings changed')
              return true
            }

            // Step 2: Compare 2026-2030 years against EXPECTED SNAPSHOT (what was loaded/last recomputed)
            // Only mark dirty if user made explicit changes beyond what the snapshot contains
            const current2026Plus = state.scenarioA.future.filter(f => f.year >= 2026 && f.year <= 2030)

            // Compare against expected snapshot (not fresh recomputation!)
            for (let i = 0; i < current2026Plus.length; i++) {
              const currentYear = current2026Plus[i]
              const expectedYear = state.expectedProjectionSnapshotA.future_2026_2030.find(e => e.year === currentYear.year)

              if (!expectedYear) continue

              // Check for meaningful differences in projection-controlled fields
              const fields: (keyof FutureYear)[] = [
                'therapyIncome', 'nonEmploymentCosts', 'nonMdEmploymentCosts',
                'miscEmploymentCosts', 'locumCosts', 'medicalDirectorHours',
                'prcsMedicalDirectorHours', 'consultingServicesAgreement'
              ]

              for (const field of fields) {
                const currentVal = currentYear[field as keyof typeof currentYear] as number
                const expectedVal = expectedYear[field as keyof typeof expectedYear] as number

                if (typeof currentVal === 'number' && typeof expectedVal === 'number') {
                  if (Math.abs(currentVal - expectedVal) > 0.01) {
                    console.log(`✏️ [isProjectionDirty] Year ${currentYear.year} ${field} differs from expected:`, {
                      current: currentVal,
                      expected: expectedVal
                    })
                    return true
                  }
                }
              }

              // Check physicians array
              if (JSON.stringify(currentYear.physicians) !== JSON.stringify(expectedYear.physicians)) {
                console.log(`✏️ [isProjectionDirty] Year ${currentYear.year} physicians changed`)
                return true
              }
            }

            // Step 4: Compare future grid overrides (non-2025 keys)
            const currentFutureKeys = Object.keys(state.customProjectedValues).filter(k => !k.startsWith('2025-'))
            const snapshotFutureKeys = Object.keys(state.loadedProjectionSnapshot.custom_projected_values_future)

            if (currentFutureKeys.length !== snapshotFutureKeys.length) {
              console.log('✏️ [isProjectionDirty] Grid override count changed')
              return true
            }

            for (const key of currentFutureKeys) {
              if (Math.abs(state.customProjectedValues[key] - (state.loadedProjectionSnapshot.custom_projected_values_future[key] || 0)) > 0.01) {
                console.log('✏️ [isProjectionDirty] Grid override changed:', key)
                return true
              }
            }

            console.log('✅ [isProjectionDirty] No projection-specific changes detected (clean)')
            return false
          }

          // LEGACY: Non-2025 baseline modes - use old logic
          // Compare projection settings
          const projectionDirty = Object.keys(state.scenarioA.projection).some(key => {
            const k = key as keyof typeof state.scenarioA.projection
            return Math.abs(state.scenarioA.projection[k] - state.loadedProjectionSnapshot!.projection[k]) > 0.001
          })

          if (projectionDirty) return true

          // Compare 2026-2030 years
          const current2026Plus = state.scenarioA.future.filter(f => f.year >= 2026 && f.year <= 2030)
          const snapshot2026Plus = state.loadedProjectionSnapshot.future_2026_2030

          if (JSON.stringify(current2026Plus) !== JSON.stringify(snapshot2026Plus)) {
            return true
          }

          // Compare future grid overrides (non-2025 keys)
          const currentFutureKeys = Object.keys(state.customProjectedValues).filter(k => !k.startsWith('2025-'))
          const snapshotFutureKeys = Object.keys(state.loadedProjectionSnapshot.custom_projected_values_future)

          if (currentFutureKeys.length !== snapshotFutureKeys.length) return true

          for (const key of currentFutureKeys) {
            if (Math.abs(state.customProjectedValues[key] - (state.loadedProjectionSnapshot.custom_projected_values_future[key] || 0)) > 0.01) {
              return true
            }
          }

          // Compare baseline years (for 2024/Custom modes)
          if (state.loadedProjectionSnapshot.baseline_years) {
            const currentBaselineYears = state.scenarioA.future.filter(f =>
              state.loadedProjectionSnapshot!.baseline_years!.some(by => by.year === f.year)
            )
            if (JSON.stringify(currentBaselineYears) !== JSON.stringify(state.loadedProjectionSnapshot.baseline_years)) {
              return true
            }
          }

          return false
        },

        resetCurrentYearSettings: () => {
          set((state) => {
            if (!state.loadedCurrentYearSettingsSnapshot) return

            // Revert YTD data and grid overrides
            state.ytdData = JSON.parse(JSON.stringify(state.loadedCurrentYearSettingsSnapshot.ytdData))
            state.ytdCustomProjectedValues = JSON.parse(JSON.stringify(state.loadedCurrentYearSettingsSnapshot.ytdCustomProjectedValues))
          })
        },

        resetProjection: () => {
          set((state) => {
            if (!state.loadedProjectionSnapshot) return

            // Revert projection settings
            state.scenarioA.projection = JSON.parse(JSON.stringify(state.loadedProjectionSnapshot.projection))

            // Revert 2026-2030 years
            state.scenarioA.future = [
              ...state.scenarioA.future.filter(f => f.year < 2026),
              ...JSON.parse(JSON.stringify(state.loadedProjectionSnapshot.future_2026_2030))
            ].sort((a, b) => a.year - b.year)

            // Revert future grid overrides
            Object.keys(state.customProjectedValues).forEach(key => {
              if (!key.startsWith('2025-')) {
                delete state.customProjectedValues[key]
              }
            })
            Object.assign(state.customProjectedValues, state.loadedProjectionSnapshot.custom_projected_values_future)

            // Revert baseline years (for 2024/Custom modes)
            if (state.loadedProjectionSnapshot.baseline_years) {
              const baselineYears = JSON.parse(JSON.stringify(state.loadedProjectionSnapshot.baseline_years))
              baselineYears.forEach((baselineYear: FutureYear) => {
                const existingIndex = state.scenarioA.future.findIndex(f => f.year === baselineYear.year)
                if (existingIndex >= 0) {
                  state.scenarioA.future[existingIndex] = baselineYear
                } else {
                  state.scenarioA.future.push(baselineYear)
                }
              })
              state.scenarioA.future.sort((a, b) => a.year - b.year)
            }
          })
        },

        updateCurrentYearSettingsSnapshot: () => {
          set((state) => {
            state.loadedCurrentYearSettingsSnapshot = {
              ytdData: JSON.parse(JSON.stringify(state.ytdData)),
              ytdCustomProjectedValues: JSON.parse(JSON.stringify(state.ytdCustomProjectedValues))
            }
          })
        },

        updateProjectionSnapshot: () => {
          set((state) => {
            const future2026Plus = state.scenarioA.future.filter(f => f.year >= 2026 && f.year <= 2030)
            
            const customFutureValues: Record<string, number> = {}
            Object.keys(state.customProjectedValues).forEach(key => {
              if (!key.startsWith('2025-')) {
                customFutureValues[key] = state.customProjectedValues[key]
              }
            })

            // Get baseline years if in 2024/Custom mode
            let baselineYears: FutureYear[] | undefined
            if (state.scenarioA.dataMode === '2024 Data') {
              const year2024 = state.scenarioA.future.find(f => f.year === 2024)
              if (year2024) {
                baselineYears = [JSON.parse(JSON.stringify(year2024))]
              }
            } else if (state.scenarioA.dataMode === 'Custom') {
              baselineYears = state.scenarioA.future.filter(f => f.year < 2025).map(y => JSON.parse(JSON.stringify(y)))
            }

            state.loadedProjectionSnapshot = {
              baseline_mode: state.scenarioA.dataMode,
              baseline_years: baselineYears,
              projection: JSON.parse(JSON.stringify(state.scenarioA.projection)),
              future_2026_2030: JSON.parse(JSON.stringify(future2026Plus)),
              custom_projected_values_future: customFutureValues
            }
          })
        },

        saveCurrentYearSettings: async (
          name: string,
          description: string,
          isPublic: boolean,
          _ytdSettings?: YTDSettings | null,
          forceNew: boolean = false
        ) => {
          const state = get()
          // Use the already-imported supabase client (line 4)

          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error('Not authenticated')

          // Get QBO sync timestamp
          let qboSyncTimestamp: string | null = null
          try {
            const { data: cacheData } = await supabase
              .from('qbo_cache')
              .select('last_sync_timestamp')
              .eq('id', 1)
              .single()
            if (cacheData) {
              qboSyncTimestamp = cacheData.last_sync_timestamp
            }
          } catch (err) {
            console.warn('Could not fetch QBO sync timestamp:', err)
          }

          // Extract YTD data (current year 2025)
          const ytdData = state.ytdData
          if (!ytdData) throw new Error('No YTD data to save')

          // Filter year_2025_data to only include user modifications
          const filteredYear2025: Partial<FutureYear> & { year: number, physicians: Physician[] } = {
            year: 2025,
            physicians: ytdData.physicians,
          }

          // Only save PhysiciansEditor fields if different from defaults
          if (ytdData.locumCosts !== undefined && ytdData.locumCosts !== DEFAULT_LOCUM_COSTS_2025) {
            filteredYear2025.locumCosts = ytdData.locumCosts
          }

          if (ytdData.prcsMedicalDirectorHours !== undefined && 
              ytdData.prcsMedicalDirectorHours !== ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS) {
            filteredYear2025.prcsMedicalDirectorHours = ytdData.prcsMedicalDirectorHours
          }

          // Check if prcsDirectorPhysicianId differs from default (Suszko)
          const defaultPhysicians = scenarioADefaultsByYear(2025)
          const defaultSuszko = defaultPhysicians.find(p => p.name === 'Suszko' && 
            (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))

          if (ytdData.prcsDirectorPhysicianId !== defaultSuszko?.id) {
            filteredYear2025.prcsDirectorPhysicianId = ytdData.prcsDirectorPhysicianId
          }

          // Extract YTD grid overrides (already filtered by slider logic)
          const custom2025Values: Record<string, number> = { ...state.ytdCustomProjectedValues }

          const saveData = {
            name,
            description,
            is_public: isPublic,
            scenario_type: 'current_year' as const,
            view_mode: 'YTD Detailed' as const,
            year_2025_data: filteredYear2025,
            custom_projected_values: custom2025Values,
            ytd_settings: null, // Don't save chart settings
            baseline_date: new Date().toISOString().split('T')[0],
            qbo_sync_timestamp: qboSyncTimestamp,
          }

          // Check if updating existing Current Year Setting (unless forceNew is true)
          if (state.currentYearSettingId && !forceNew) {
            const { data, error } = await supabase
              .from('scenarios')
              .update(saveData)
              .eq('id', state.currentYearSettingId)
              .select()
              .single()

            if (error) throw error

            get().setCurrentYearSetting(data.id, name, session.user.id)
            get().updateCurrentYearSettingsSnapshot()

            return data
          } else {
            const { data, error } = await supabase
              .from('scenarios')
              .insert({
                user_id: session.user.id,
                ...saveData,
              })
              .select()
              .single()

            if (error) throw error

            get().setCurrentYearSetting(data.id, name, session.user.id)
            get().updateCurrentYearSettingsSnapshot()

            return data
          }
        },

        saveProjection: async (
          name: string,
          description: string,
          isPublic: boolean,
          target: 'A' | 'B' = 'A',
          forceNew: boolean = false
        ) => {
          const state = get()
          // Use the already-imported supabase client (line 4)

          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error('Not authenticated')

          const scenario = target === 'A' ? state.scenarioA : state.scenarioB
          if (!scenario) throw new Error(`No Scenario ${target} to save`)

          // Get QBO sync timestamp
          let qboSyncTimestamp: string | null = null
          try {
            const { data: cacheData } = await supabase
              .from('qbo_cache')
              .select('last_sync_timestamp')
              .eq('id', 1)
              .single()
            if (cacheData) {
              qboSyncTimestamp = cacheData.last_sync_timestamp
            }
          } catch (err) {
            console.warn('Could not fetch QBO sync timestamp:', err)
          }

          // Extract projection settings
          const projectionSettings = scenario.projection

          // NEW: For 2025 Data mode, use override flags to identify what to save
          let future2026Plus: FutureYear[] = []

          if (scenario.dataMode === '2025 Data') {
            console.log('💾 [saveProjection] 2025 Data mode - using override flags for sparse saving')

            const currentFuture = scenario.future.filter(f => f.year >= 2026 && f.year <= 2030)

            for (const currentYear of currentFuture) {
              // Check if this year has any overrides marked (but ALWAYS save physicians!)
              const hasOverrides = currentYear._overrides && Object.keys(currentYear._overrides).length > 0
              const hasPhysicians = currentYear.physicians && currentYear.physicians.length > 0

              if (!hasOverrides && !hasPhysicians) {
                console.log(`💾 [saveProjection] Year ${currentYear.year} has no overrides or physicians, skipping`)
                continue
              }

              // Build a sparse year object with only flagged overrides + physicians
              const sparse: Partial<FutureYear> & { year: number, physicians: Physician[], _overrides?: Record<string, boolean> } = {
                year: currentYear.year,
                physicians: currentYear.physicians,  // ALWAYS save physicians (unique per-year config)
                _overrides: currentYear._overrides  // Preserve override flags
              }

              // Include only fields that are marked as overridden
              if (hasOverrides) {
                for (const [field, isOverridden] of Object.entries(currentYear._overrides!)) {
                  if (isOverridden && field !== 'physicians') {  // Skip physicians - already included above
                    const key = field as keyof FutureYear;
                    (sparse as Record<string, unknown>)[field] = currentYear[key]
                    console.log(`💾 [saveProjection] Year ${currentYear.year} ${field} marked as override, saving`)
                  }
                }
              }

              console.log(`💾 [saveProjection] Year ${currentYear.year} saving ${currentYear.physicians.length} physicians`)
              future2026Plus.push(sparse as FutureYear)
            }

            console.log(`💾 [saveProjection] Saving ${future2026Plus.length} years with overrides (out of ${currentFuture.length} total)`)
          } else {
            // Legacy: For non-2025 modes, save all years as before
            future2026Plus = scenario.future.filter(f => f.year >= 2026 && f.year <= 2030)
          }

          // Extract future grid overrides (non-2025 keys)
          const customFutureValues: Record<string, number> = {}
          Object.keys(state.customProjectedValues).forEach(key => {
            if (!key.startsWith('2025-')) {
              customFutureValues[key] = state.customProjectedValues[key]
            }
          })

          // Extract baseline years if not in 2025 Data mode
          let baselineYears: FutureYear[] | null = null
          if (scenario.dataMode === '2024 Data') {
            const year2024 = scenario.future.find(f => f.year === 2024)
            if (year2024) {
              baselineYears = [year2024]
            }
          } else if (scenario.dataMode === 'Custom') {
            baselineYears = scenario.future.filter(f => f.year < 2025)
          }

          const baselineDate = scenario.dataMode === '2024 Data' 
            ? '2024-12-31' 
            : new Date().toISOString().split('T')[0]

          const saveData = {
            name,
            description,
            is_public: isPublic,
            scenario_type: 'projection' as const,
            view_mode: 'Multi-Year' as const,
            baseline_mode: scenario.dataMode,
            baseline_years: baselineYears,
            projection_settings: projectionSettings,
            future_years: future2026Plus,
            future_custom_values: customFutureValues,
            baseline_date: baselineDate,
            qbo_sync_timestamp: qboSyncTimestamp,
          }

          // Determine which projection ID to check based on target
          const currentId = target === 'A' ? state.currentScenarioId : state.currentScenarioBId

          // Check if updating existing Projection (unless forceNew is true for "Save As")
          if (currentId && !forceNew) {
            console.log(`💾 [saveProjection] Updating existing projection ${target}:`, currentId)
            const { data, error } = await supabase
              .from('scenarios')
              .update(saveData)
              .eq('id', currentId)
              .select()
              .single()

            if (error) throw error

            // Update the correct scenario ID/name based on target
            if (target === 'A') {
              get().setCurrentScenario(data.id, name, session.user.id)
              get().updateScenarioSnapshot('A')
            } else {
              get().setCurrentScenarioB(data.id, name, session.user.id)
              get().updateScenarioSnapshot('B')
            }

            return data
          } else {
            console.log(`💾 [saveProjection] Creating new projection scenario ${target}`)
            const { data, error } = await supabase
              .from('scenarios')
              .insert({
                user_id: session.user.id,
                ...saveData,
              })
              .select()
              .single()

            if (error) throw error

            // Update the correct scenario ID/name based on target
            if (target === 'A') {
              get().setCurrentScenario(data.id, name, session.user.id)
              get().updateScenarioSnapshot('A')
            } else {
              get().setCurrentScenarioB(data.id, name, session.user.id)
              get().updateScenarioSnapshot('B')
            }

            return data
          }
        },

        loadCurrentYearSettings: async (id: string) => {
          // Use the already-imported supabase client (line 4)

          const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (!data) throw new Error('Scenario not found')

          if (data.scenario_type !== 'current_year') {
            throw new Error('Not a Current Year Settings scenario')
          }

          set((state) => {
            // Build COMPLETE 2025 data by merging: defaults → loaded scenario
            // Do NOT use existing store values - this is a fresh load
            const defaultPhysicians = scenarioADefaultsByYear(2025)
            const defaultSuszko = defaultPhysicians.find(p => p.name === 'Suszko' && 
              (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
            
            // Start with defaults for all fields
            const complete2025: FutureYear = {
              year: 2025,
              
              // Defaults for configured fields (will be overridden by loaded scenario if customized)
              locumCosts: DEFAULT_LOCUM_COSTS_2025,
              medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
              prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
              consultingServicesAgreement: DEFAULT_CONSULTING_SERVICES_2025,
              miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
              prcsDirectorPhysicianId: defaultSuszko?.id,
              physicians: defaultPhysicians,
              
              // QBO/computed values - start at 0, grid will populate from QBO cache after load
              // Compensation will be frozen during this sync to prevent showing incorrect values
              therapyIncome: 0,
              nonEmploymentCosts: 0,
              nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              therapyLacey: undefined,
              therapyCentralia: undefined,
              therapyAberdeen: undefined,
            }
            
            // Merge loaded scenario data (physicians + modified fields override everything)
            if (data.year_2025_data) {
              Object.assign(complete2025, data.year_2025_data)
            }
            
            console.log('🔍 [Load] Fresh YTD scenario load from DB:', {
              scenarioName: data.name,
              scenarioId: data.id,
              loadedData: {
                locumCosts: data.year_2025_data?.locumCosts,
                prcsMedicalDirectorHours: data.year_2025_data?.prcsMedicalDirectorHours,
                physicians: data.year_2025_data?.physicians?.length,
                customProjectedValues: Object.keys(data.custom_projected_values || {}).length
              }
            })
            
            console.log('📦 [Load] Complete 2025 data after merging defaults:', {
              locumCosts: complete2025.locumCosts,
              prcsMedicalDirectorHours: complete2025.prcsMedicalDirectorHours,
              medicalDirectorHours: complete2025.medicalDirectorHours,
              therapyIncome: complete2025.therapyIncome,
              nonEmploymentCosts: complete2025.nonEmploymentCosts,
              physicians: complete2025.physicians?.length,
              note: 'therapyIncome/nonEmploymentCosts will be synced from QBO cache by grid'
            })
            
            // Load into dedicated YTD state (NOT Scenario A)
            state.ytdData = complete2025

            // Restore YTD grid overrides
            state.ytdCustomProjectedValues = data.custom_projected_values || {}
            
            console.log('✅ [Load] Loaded into YTD store state:', {
              ytdDataYear: state.ytdData?.year,
              ytdDataPhysicians: state.ytdData?.physicians?.length,
              ytdCustomValuesCount: Object.keys(state.ytdCustomProjectedValues).length
            })

            state.currentYearSettingId = data.id
            state.currentYearSettingName = data.name
            state.currentYearSettingUserId = data.user_id
          })

          // Update snapshot
          get().updateCurrentYearSettingsSnapshot()

          // NEW: Trigger recomputation of projections since baseline changed
          setTimeout(() => {
            get().recomputeProjectionsFromBaseline()
          }, 0)

          return data
        },

        loadProjection: async (id: string, target: 'A' | 'B' = 'A') => {
          // Use the already-imported supabase client (line 4)

          const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (!data) throw new Error('Scenario not found')

          if (data.scenario_type !== 'projection') {
            throw new Error('Not a Projection scenario')
          }

          const baselineMode = data.baseline_mode || '2025 Data'

          // NEW: Handle PROJECTION scenarios with 2025 baseline
          if (baselineMode === '2025 Data') {
            console.log('🔄 [loadProjection] Loading PROJECTION scenario with 2025 baseline:', data.name)

            // Step 1: Ensure YTD baseline is loaded
            await get().ensureYtdBaseline2025()

            // Step 2: Get baseline 2025 from YTD store
            const baseline2025 = get().getYtdBaselineFutureYear2025()

            // Step 3: Build scenario by overlaying projection on baseline
            const { future } = get().buildScenarioFromProjection({
              projection: data.projection_settings,
              futureYearsFromScenario: data.future_years || [],
              baseline2025,
              baselineMode
            })

            // Step 4: Apply to target scenario
            set((state) => {
              const targetScenario = target === 'A' ? state.scenarioA : state.scenarioB
              if (!targetScenario && target === 'B') {
                throw new Error('Scenario B not initialized')
              }

              if (target === 'A') {
                state.scenarioA.projection = data.projection_settings
                state.scenarioA.future = future
                state.scenarioA.dataMode = '2025 Data'
              } else if (state.scenarioB) {
                state.scenarioB.projection = data.projection_settings
                state.scenarioB.future = future
                state.scenarioB.dataMode = '2025 Data'
              }

              // Restore future grid overrides (replace existing non-2025 keys)
              Object.keys(state.customProjectedValues).forEach(key => {
                if (!key.startsWith('2025-')) {
                  delete state.customProjectedValues[key]
                }
              })
              if (data.future_custom_values) {
                Object.assign(state.customProjectedValues, data.future_custom_values)
              }

              // Update the correct scenario ID/name based on target
              if (target === 'A') {
                state.currentScenarioId = data.id
                state.currentScenarioName = data.name
                state.currentScenarioUserId = data.user_id
              } else {
                state.currentScenarioBId = data.id
                state.currentScenarioBName = data.name
                state.currentScenarioBUserId = data.user_id
              }
            })

            // Step 5: Snapshot the LOADED state as expected (don't recompute)
            // This captures what was actually loaded (computed + saved overrides merged)
            set((state) => {
              const scenario = target === 'A' ? state.scenarioA : state.scenarioB
              if (!scenario) return

              const baseline2025 = state.scenarioA.future.find(f => f.year === 2025)
              if (!baseline2025) return

              const future_2026_2030 = scenario.future.filter(f => f.year >= 2026 && f.year <= 2030)

              const snapshot = {
                baseline2025: JSON.parse(JSON.stringify(baseline2025)),
                future_2026_2030: JSON.parse(JSON.stringify(future_2026_2030))
              }

              if (target === 'A') {
                state.expectedProjectionSnapshotA = snapshot
              } else {
                state.expectedProjectionSnapshotB = snapshot
              }

              console.log(`📸 [loadProjection] Snapshotted LOADED state as expected for ${target}`)
            })

            // Step 6: Update loaded snapshot based on target
            if (target === 'A') {
              get().updateScenarioSnapshot('A')
            } else {
              get().updateScenarioSnapshot('B')
            }

            console.log(`✅ [loadProjection] Loaded PROJECTION ${target} with 2025 baseline successfully`)

            return data
          }

          // LEGACY: Handle non-2025 baselines (2024/Custom) - existing behavior
          set((state) => {
            const targetScenario = target === 'A' ? state.scenarioA : state.scenarioB
            if (!targetScenario && target === 'B') {
              throw new Error('Scenario B not initialized')
            }

            // Restore projection settings
            if (target === 'A') {
              state.scenarioA.projection = data.projection_settings
            } else if (state.scenarioB) {
              state.scenarioB.projection = data.projection_settings
            }

            // Restore 2026-2030 years
            const future2026Plus = data.future_years || []
            if (target === 'A') {
              state.scenarioA.future = [
                ...state.scenarioA.future.filter(f => f.year < 2026),
                ...future2026Plus
              ].sort((a, b) => a.year - b.year)
            } else if (state.scenarioB) {
              state.scenarioB.future = [
                ...state.scenarioB.future.filter(f => f.year < 2026),
                ...future2026Plus
              ].sort((a, b) => a.year - b.year)
            }

            // Restore future grid overrides (replace existing non-2025 keys)
            Object.keys(state.customProjectedValues).forEach(key => {
              if (!key.startsWith('2025-')) {
                delete state.customProjectedValues[key]
              }
            })
            if (data.future_custom_values) {
              Object.assign(state.customProjectedValues, data.future_custom_values)
            }

            // Restore baseline years if applicable (2024/Custom modes)
            if (data.baseline_years && data.baseline_years.length > 0) {
              const baselineYears = data.baseline_years as FutureYear[]
              baselineYears.forEach(baselineYear => {
                if (target === 'A') {
                  const existingIndex = state.scenarioA.future.findIndex(f => f.year === baselineYear.year)
                  if (existingIndex >= 0) {
                    state.scenarioA.future[existingIndex] = baselineYear
                  } else {
                    state.scenarioA.future.push(baselineYear)
                  }
                } else if (state.scenarioB) {
                  const existingIndex = state.scenarioB.future.findIndex(f => f.year === baselineYear.year)
                  if (existingIndex >= 0) {
                    state.scenarioB.future[existingIndex] = baselineYear
                  } else {
                    state.scenarioB.future.push(baselineYear)
                  }
                }
              })

              if (target === 'A') {
                state.scenarioA.future.sort((a, b) => a.year - b.year)
                state.scenarioA.dataMode = data.baseline_mode || '2025 Data'
              } else if (state.scenarioB) {
                state.scenarioB.future.sort((a, b) => a.year - b.year)
                state.scenarioB.dataMode = data.baseline_mode || '2025 Data'
              }
            }

            // Update the correct scenario ID/name based on target
            if (target === 'A') {
              state.currentScenarioId = data.id
              state.currentScenarioName = data.name
              state.currentScenarioUserId = data.user_id
            } else {
              state.currentScenarioBId = data.id
              state.currentScenarioBName = data.name
              state.currentScenarioBUserId = data.user_id
            }
          })

          // Update snapshot based on target
          if (target === 'A') {
            get().updateScenarioSnapshot('A')
          } else {
            get().updateScenarioSnapshot('B')
          }

          return data
        },

        loadDefaultYTDScenario: async (year?: number) => {
          try {
            const currentYear = year || new Date().getFullYear()
            const defaultName = `${currentYear} Default`

            // Try to find and load the current year's default scenario
            const { data, error } = await supabase
              .from('scenarios')
              .select('*')
              .eq('scenario_type', 'current_year')
              .eq('name', defaultName)
              .single()

            if (data && !error) {
              console.log(`📥 Loading "${defaultName}" scenario on initialization`)
              await get().loadCurrentYearSettings(data.id)
            } else {
              console.log(`📝 No "${defaultName}" scenario found, using defaults`)
            }
          } catch (err) {
            console.log('📝 Could not load default scenario, using defaults:', err)
          }
        },

        // NEW: Projection overlay methods for 2025 baseline

        ensureYtdBaseline2025: async () => {
          const state = get()

          // If we already have a current year setting loaded, we're done
          if (state.currentYearSettingId) {
            console.log('✅ [ensureYtdBaseline2025] YTD baseline already loaded:', state.currentYearSettingName)
            return
          }

          console.log('🔍 [ensureYtdBaseline2025] No YTD baseline loaded, attempting to load default...')

          try {
            // Try to find user's favorite CURRENT scenario
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              const { data: favorites } = await supabase
                .from('user_favorites')
                .select('scenario_id, favorite_type')
                .eq('user_id', session.user.id)
                .eq('favorite_type', 'CURRENT')
                .single()

              if (favorites?.scenario_id) {
                console.log('📥 [ensureYtdBaseline2025] Loading user favorite CURRENT:', favorites.scenario_id)
                await get().loadCurrentYearSettings(favorites.scenario_id)
                return
              }
            }

            // Fallback: try to load "2025 Default"
            await get().loadDefaultYTDScenario(2025)

            // If still no baseline, log warning but continue (will use store defaults)
            if (!get().currentYearSettingId) {
              console.warn('⚠️ [ensureYtdBaseline2025] No YTD baseline found, using store defaults')
            }
          } catch (err) {
            console.warn('⚠️ [ensureYtdBaseline2025] Error loading YTD baseline:', err)
          }
        },

        getYtdBaselineFutureYear2025: () => {
          const state = get()

          // Return a normalized 2025 FutureYear from YTD store
          const baseline2025: FutureYear = {
            year: 2025,
            therapyIncome: state.ytdData.therapyIncome,
            nonEmploymentCosts: state.ytdData.nonEmploymentCosts,
            nonMdEmploymentCosts: state.ytdData.nonMdEmploymentCosts,
            locumCosts: state.ytdData.locumCosts,
            miscEmploymentCosts: state.ytdData.miscEmploymentCosts,
            medicalDirectorHours: state.ytdData.medicalDirectorHours,
            prcsMedicalDirectorHours: state.ytdData.prcsMedicalDirectorHours,
            consultingServicesAgreement: state.ytdData.consultingServicesAgreement,
            prcsDirectorPhysicianId: state.ytdData.prcsDirectorPhysicianId,
            physicians: JSON.parse(JSON.stringify(state.ytdData.physicians)), // Deep copy
            therapyLacey: state.ytdData.therapyLacey,
            therapyCentralia: state.ytdData.therapyCentralia,
            therapyAberdeen: state.ytdData.therapyAberdeen,
          }

          console.log('📦 [getYtdBaselineFutureYear2025] Returning 2025 baseline:', {
            therapyIncome: baseline2025.therapyIncome,
            physicians: baseline2025.physicians?.length,
            locumCosts: baseline2025.locumCosts,
            medicalDirectorHours: baseline2025.medicalDirectorHours,
          })

          return baseline2025
        },

        computeExpectedFromBaseline: ({ baseline2025, projection }) => {
          // Compute what the projected years (2026-2030) should look like
          // given the current baseline and projection settings

          console.log('🧮 [computeExpectedFromBaseline] Computing expected projections from baseline')

          const expectedFuture: FutureYear[] = []

          // Convert percentage growth rates to decimal multipliers
          const incomeGpct = projection.incomeGrowthPct / 100
          const nonEmploymentGpct = projection.nonEmploymentCostsPct / 100
          const nonMdEmploymentGpct = projection.nonMdEmploymentCostsPct / 100
          const miscEmploymentGpct = projection.miscEmploymentCostsPct / 100
          const benefitGrowthPct = projection.benefitCostsGrowthPct

          // Starting values from baseline
          let income = baseline2025.therapyIncome
          let nonEmploymentCosts = baseline2025.nonEmploymentCosts
          let miscEmploymentCosts = baseline2025.miscEmploymentCosts

          // For staff costs, decompose base (2025) into wages+taxes vs benefits
          const baseStaff2025 = baseline2025.nonMdEmploymentCosts
          const baseWagesTaxes2025 = Math.max(0, baseStaff2025 - ANNUAL_BENEFITS_FULLTIME)

          // Project years 2026-2030
          for (let year = 2026; year <= 2030; year++) {
            income = income * (1 + incomeGpct)
            nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
            miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)

            // Compute staff employment costs using split growth
            const yearsSince2025 = year - 2025
            const wagesAndTaxes = baseWagesTaxes2025 * Math.pow(1 + nonMdEmploymentGpct, yearsSince2025)
            const benefits = getBenefitCostsForYear(year, benefitGrowthPct)
            const staffEmploymentCosts = wagesAndTaxes + benefits

            // Get physicians for this year by rolling forward from baseline
            // Use scenarioADefaultsByYear as the template
            const physicians = scenarioADefaultsByYear(year)

            const futureYear: FutureYear = {
              year,
              therapyIncome: income,
              nonEmploymentCosts: nonEmploymentCosts,
              nonMdEmploymentCosts: staffEmploymentCosts,
              miscEmploymentCosts: miscEmploymentCosts,
              locumCosts: year === 2026 ? DEFAULT_LOCUM_COSTS_2026 : projection.locumsCosts,
              medicalDirectorHours: projection.medicalDirectorHours,
              prcsMedicalDirectorHours: projection.prcsMedicalDirectorHours,
              consultingServicesAgreement: projection.consultingServicesAgreement,
              physicians: JSON.parse(JSON.stringify(physicians)), // Deep copy
              prcsDirectorPhysicianId: undefined, // Use default per year
            }

            expectedFuture.push(futureYear)
          }

          console.log('✅ [computeExpectedFromBaseline] Computed', expectedFuture.length, 'expected years')

          return expectedFuture
        },

        buildScenarioFromProjection: ({ projection, futureYearsFromScenario, baseline2025, baselineMode }) => {
          console.log('🏗️ [buildScenarioFromProjection] Building scenario from projection overlay')

          // Compute expected derived years from baseline
          const expectedDerived = get().computeExpectedFromBaseline({
            baseline2025,
            projection,
            baselineMode
          })

          // Start with baseline 2025 as year 0
          const future: FutureYear[] = [JSON.parse(JSON.stringify(baseline2025))]

          // For 2026-2030, merge sparse user overrides with expected computed values
          for (let year = 2026; year <= 2030; year++) {
            const sparseOverrides = futureYearsFromScenario.find(f => f.year === year)
            const expectedYear = expectedDerived.find(f => f.year === year)

            if (!expectedYear) continue

            // Start with expected (computed) values
            const mergedYear = JSON.parse(JSON.stringify(expectedYear)) as FutureYear

            // Apply sparse overrides if present
            if (sparseOverrides) {
              console.log(`🏗️ [buildScenarioFromProjection] Year ${year}: Merging user overrides into computed values`)

              // Merge each field from sparse overrides
              const overrideKeys = Object.keys(sparseOverrides) as (keyof FutureYear)[]
              for (const key of overrideKeys) {
                if (key !== 'year' && sparseOverrides[key] !== undefined) {
                  (mergedYear as Record<string, unknown>)[key] = sparseOverrides[key]
                  console.log(`  - ${String(key)}: using override value`)
                }
              }
            }

            future.push(mergedYear)
          }

          console.log('✅ [buildScenarioFromProjection] Built scenario with', future.length, 'years')

          return { future }
        },

        snapshotExpectedProjection: (which: 'A' | 'B') => {
          set((state) => {
            const scenario = which === 'A' ? state.scenarioA : state.scenarioB
            if (!scenario) return

            // Only snapshot if we're in 2025 Data mode (baseline-driven)
            if (scenario.dataMode !== '2025 Data') {
              console.log(`⏭️ [snapshotExpectedProjection] Skipping snapshot for ${which} (not in 2025 Data mode)`)
              return
            }

            // Get baseline from YTD store
            const baseline2025 = get().getYtdBaselineFutureYear2025()

            // Compute expected future years from baseline
            const expectedFuture = get().computeExpectedFromBaseline({
              baseline2025,
              projection: scenario.projection,
              baselineMode: scenario.dataMode
            })

            // Store snapshot
            const snapshot = {
              baseline2025: JSON.parse(JSON.stringify(baseline2025)),
              future_2026_2030: JSON.parse(JSON.stringify(expectedFuture))
            }

            if (which === 'A') {
              state.expectedProjectionSnapshotA = snapshot
            } else {
              state.expectedProjectionSnapshotB = snapshot
            }

            console.log(`📸 [snapshotExpectedProjection] Snapshotted expected projection for ${which}`)
          })
        },

        // Helper: Recompute projection years from current baseline (baseline change observer)
        recomputeProjectionsFromBaseline: () => {
          set((state) => {
            console.log('🔄 [recomputeProjectionsFromBaseline] Baseline changed, recomputing projections...')

            // Get current baseline from YTD store
            const baseline2025 = get().getYtdBaselineFutureYear2025()

            // Recompute Scenario A if in 2025 Data mode
            if (state.scenarioA.dataMode === '2025 Data') {
              console.log('🔄 [recomputeProjectionsFromBaseline] Recomputing Scenario A')

              // Update year 2025 from baseline
              const year2025Index = state.scenarioA.future.findIndex(f => f.year === 2025)
              if (year2025Index >= 0) {
                state.scenarioA.future[year2025Index] = JSON.parse(JSON.stringify(baseline2025))
              }

              // Recompute 2026-2030 from new baseline
              const expectedFuture = get().computeExpectedFromBaseline({
                baseline2025,
                projection: state.scenarioA.projection,
                baselineMode: state.scenarioA.dataMode
              })

              // Update each year 2026-2030 with recomputed values, PRESERVING user overrides
              expectedFuture.forEach(expectedYear => {
                const yearIndex = state.scenarioA.future.findIndex(f => f.year === expectedYear.year)
                if (yearIndex >= 0) {
                  const currentYear = state.scenarioA.future[yearIndex]
                  const overrides = currentYear._overrides

                  // Start with fresh computed values
                  const updated = JSON.parse(JSON.stringify(expectedYear)) as FutureYear

                  // Restore user-overridden fields
                  if (overrides) {
                    for (const [field, isOverridden] of Object.entries(overrides)) {
                      if (isOverridden && field in currentYear) {
                        (updated as Record<string, unknown>)[field] = (currentYear as Record<string, unknown>)[field]
                        console.log(`🔒 [recompute] Preserving override for year ${updated.year} field ${field}`)
                      }
                    }
                    // Preserve the override flags
                    updated._overrides = JSON.parse(JSON.stringify(overrides))
                  }

                  state.scenarioA.future[yearIndex] = updated
                }
              })

              // Re-snapshot expected (DON'T mark dirty - this is baseline-driven)
              get().snapshotExpectedProjection('A')
            }

            // Recompute Scenario B if enabled and in 2025 Data mode
            if (state.scenarioBEnabled && state.scenarioB && state.scenarioB.dataMode === '2025 Data') {
              console.log('🔄 [recomputeProjectionsFromBaseline] Recomputing Scenario B')

              const scenarioB = state.scenarioB

              // Update year 2025 from baseline
              const year2025Index = scenarioB.future.findIndex(f => f.year === 2025)
              if (year2025Index >= 0) {
                scenarioB.future[year2025Index] = JSON.parse(JSON.stringify(baseline2025))
              }

              // Recompute 2026-2030 from new baseline
              const expectedFuture = get().computeExpectedFromBaseline({
                baseline2025,
                projection: scenarioB.projection,
                baselineMode: scenarioB.dataMode
              })

              // Update each year 2026-2030 with recomputed values, PRESERVING user overrides
              expectedFuture.forEach(expectedYear => {
                const yearIndex = scenarioB.future.findIndex(f => f.year === expectedYear.year)
                if (yearIndex >= 0) {
                  const currentYear = scenarioB.future[yearIndex]
                  const overrides = currentYear._overrides

                  // Start with fresh computed values
                  const updated = JSON.parse(JSON.stringify(expectedYear)) as FutureYear

                  // Restore user-overridden fields
                  if (overrides) {
                    for (const [field, isOverridden] of Object.entries(overrides)) {
                      if (isOverridden && field in currentYear) {
                        (updated as Record<string, unknown>)[field] = (currentYear as Record<string, unknown>)[field]
                        console.log(`🔒 [recompute] Preserving override for year ${updated.year} field ${field} in Scenario B`)
                      }
                    }
                    // Preserve the override flags
                    updated._overrides = JSON.parse(JSON.stringify(overrides))
                  }

                  scenarioB.future[yearIndex] = updated
                }
              })

              // Re-snapshot expected
              get().snapshotExpectedProjection('B')
            }

            console.log('✅ [recomputeProjectionsFromBaseline] Recomputation complete')
          })
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

    // Only compare employeeWeeksVacation if physician has employee time
    const hasEmployeeTime = current.type === 'employeeToPartner' && (current.employeePortionOfYear ?? 0) > 0
    const employeeWeeksChanged = hasEmployeeTime && (current.employeeWeeksVacation !== defaultPhysician.employeeWeeksVacation)

    // Only compare partnerWeeksVacation (via weeksVacation) if physician has partner time
    // For employeeToPartner: only compare weeksVacation if employeePortionOfYear < 1
    const hasPartnerTime =
      current.type === 'partner' ||
      (current.type === 'employeeToPartner' && (current.employeePortionOfYear ?? 0) < 1) ||
      (current.type === 'partnerToRetire' && (current.partnerPortionOfYear ?? 0) > 0)
    const partnerWeeksChanged = hasPartnerTime && (current.weeksVacation !== defaultPhysician.weeksVacation)

    // Only compare additionalDaysWorked if physician actually worked (has partner time)
    const additionalDaysChanged = hasPartnerTime && (current.additionalDaysWorked !== defaultPhysician.additionalDaysWorked)

    // Compare all relevant properties
    if (
      current.name !== defaultPhysician.name ||
      current.type !== defaultPhysician.type ||
      current.salary !== defaultPhysician.salary ||
      partnerWeeksChanged ||
      employeeWeeksChanged ||
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
      additionalDaysChanged
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

  // Normalize physician data to consistent defaults for comparison
  // Uses semantic resolution for portion fields based on type (same logic as calculation engine)
  const normalizePhysician = (p: Physician) => {
    // Resolve employee portion based on type (mirrors getEmployeePortionOfYear)
    let employeePortionOfYear: number
    if (p.type === 'employee') employeePortionOfYear = 1
    else if (p.type === 'partner' || p.type === 'partnerToRetire') employeePortionOfYear = 0
    else if (p.type === 'newEmployee') employeePortionOfYear = 1 - (p.startPortionOfYear ?? 0)
    else if (p.type === 'employeeToTerminate') employeePortionOfYear = p.terminatePortionOfYear ?? 1
    else employeePortionOfYear = p.employeePortionOfYear ?? 0.5
    
    // Resolve partner portion based on type (mirrors getPartnerPortionOfYear)
    let partnerPortionOfYear: number
    if (p.type === 'employee' || p.type === 'newEmployee' || p.type === 'employeeToTerminate') partnerPortionOfYear = 0
    else if (p.type === 'partner') partnerPortionOfYear = 1
    else if (p.type === 'partnerToRetire') partnerPortionOfYear = p.partnerPortionOfYear ?? 0.5
    else partnerPortionOfYear = 1 - employeePortionOfYear
    
    return {
      ...p,
      // Boolean fields: undefined -> false
      hasMedicalDirectorHours: p.hasMedicalDirectorHours ?? false,
      receivesBenefits: p.receivesBenefits ?? false,
      receivesBonuses: p.receivesBonuses ?? false,
      // Numeric fields: undefined -> 0
      medicalDirectorHoursPercentage: p.medicalDirectorHoursPercentage ?? 0,
      trailingSharedMdAmount: p.trailingSharedMdAmount ?? 0,
      bonusAmount: p.bonusAmount ?? 0,
      additionalDaysWorked: p.additionalDaysWorked ?? 0,
      buyoutCost: p.buyoutCost ?? 0,
      // Portion fields: resolved based on type for semantic equality
      employeePortionOfYear,
      partnerPortionOfYear,
      startPortionOfYear: p.startPortionOfYear ?? 0,
      terminatePortionOfYear: p.terminatePortionOfYear ?? 0,
    }
  }

  for (let i = 0; i < currentFy.physicians.length; i++) {
    const current = normalizePhysician(currentFy.physicians[i])
    const snapshot = normalizePhysician(snapshotFy.physicians[i])

    // Use tolerance for floating point comparisons to avoid false positives from rounding
    const FLOAT_TOLERANCE = 1e-6 // 0.000001
    const portionsEqual = (a: number, b: number) => {
      return Math.abs(a - b) < FLOAT_TOLERANCE
    }

    const checks = {
      id: current.id !== snapshot.id,
      name: current.name !== snapshot.name,
      type: current.type !== snapshot.type,
      salary: current.salary !== snapshot.salary,
      weeksVacation: current.weeksVacation !== snapshot.weeksVacation,
      employeeWeeksVacation: current.employeeWeeksVacation !== snapshot.employeeWeeksVacation,
      employeePortionOfYear: !portionsEqual(current.employeePortionOfYear, snapshot.employeePortionOfYear),
      partnerPortionOfYear: !portionsEqual(current.partnerPortionOfYear, snapshot.partnerPortionOfYear),
      startPortionOfYear: !portionsEqual(current.startPortionOfYear, snapshot.startPortionOfYear),
      terminatePortionOfYear: !portionsEqual(current.terminatePortionOfYear, snapshot.terminatePortionOfYear),
      receivesBenefits: current.receivesBenefits !== snapshot.receivesBenefits,
      receivesBonuses: current.receivesBonuses !== snapshot.receivesBonuses,
      bonusAmount: !portionsEqual(current.bonusAmount, snapshot.bonusAmount),
      hasMedicalDirectorHours: current.hasMedicalDirectorHours !== snapshot.hasMedicalDirectorHours,
      medicalDirectorHoursPercentage: !portionsEqual(current.medicalDirectorHoursPercentage, snapshot.medicalDirectorHoursPercentage),
      buyoutCost: !portionsEqual(current.buyoutCost, snapshot.buyoutCost),
      trailingSharedMdAmount: !portionsEqual(current.trailingSharedMdAmount, snapshot.trailingSharedMdAmount),
      additionalDaysWorked: !portionsEqual(current.additionalDaysWorked, snapshot.additionalDaysWorked)
    }
    
    const isDifferent = Object.values(checks).some(v => v)
    
    if (isDifferent) {
      const failedChecks = Object.entries(checks).filter(([, v]) => v).map(([k]) => k)
      console.log(`[DIRTY CHECK A] Physician ${current.name} differs on:`, failedChecks)
      console.log('  Current:', { 
        ...failedChecks.reduce((acc, k) => ({ ...acc, [k]: current[k as keyof typeof current] }), {})
      })
      console.log('  Snapshot:', { 
        ...failedChecks.reduce((acc, k) => ({ ...acc, [k]: snapshot[k as keyof typeof snapshot] }), {})
      })
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
    // Use the actual baseline value from the scenario, not the hardcoded default
    const baseStaff2025 = baselineData.nonMdEmploymentCosts
    const baseWagesTaxes2025 = Math.max(0, baseStaff2025 - ANNUAL_BENEFITS_FULLTIME)
    const wagesAndTaxes = baseWagesTaxes2025 * Math.pow(1 + nonMdEmploymentGpct, yearsSinceBaseline)
    const benefits = getBenefitCostsForYear(year, benefitGrowthPct)
    const projectedValue = wagesAndTaxes + benefits

    console.log(`🔍 [calculateProjectedValue] nonMdEmploymentCosts for year ${year}:`, {
      baselineDataValue: baselineData.nonMdEmploymentCosts,
      usingBaselineValue: baseStaff2025,
      baseWagesTaxes2025,
      wagesAndTaxes,
      benefits,
      projectedValue,
      dataMode: sc.dataMode,
      yearsSinceBaseline
    })

    return projectedValue
  }
  return 0
}

export function Dashboard() {
  const store = useDashboardStore()
  const { profile, loading, signOut } = useAuth()
  const [viewMode, setViewMode] = useState<'Multi-Year' | 'YTD Detailed' | 'YTD Mobile'>('YTD Detailed')
  const [urlLoaded, setUrlLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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
  // Track if default scenarios have been loaded to prevent duplicate loads
  const defaultScenariosLoadedRef = useRef(false)
  const [isInitialScenarioLoadComplete, setIsInitialScenarioLoadComplete] = useState(false)
  // Shared link warning modal
  const [showSharedLinkWarning, setShowSharedLinkWarning] = useState(false)
  const [pendingSharedLinkId, setPendingSharedLinkId] = useState<string | null>(null)
  // Mobile warning modal
  const [showMobileWarning, setShowMobileWarning] = useState(false)

  // Wrap setYtdSettings in useCallback to prevent unnecessary re-renders in YTDDetailed
  const handleYtdSettingsChange = useCallback((settings: YTDSettings) => {
    setYtdSettings(settings)
  }, [])

  // Callback to register YTD refresh function
  const handleYtdRefreshRequest = useCallback((callback: () => void) => {
    ytdRefreshCallbackRef.current = callback
  }, [])

  // Detect mobile and show warning on initial load
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768
      setIsMobile(mobile)
      return mobile
    }

    const mobile = checkMobile()
    const hasSeenWarning = sessionStorage.getItem('mobileWarningShown')

    if (mobile && !hasSeenWarning && profile) {
      setShowMobileWarning(true)
      sessionStorage.setItem('mobileWarningShown', 'true')
    }

    // Listen for window resize to detect orientation changes
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [profile])

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
    const handleUnloadScenario = async () => {
      if (!store.currentScenarioName && !store.currentYearSettingName) return

      // For YTD view, check currentYearSettingName
      const currentName = viewMode === 'YTD Detailed' ? store.currentYearSettingName : store.currentScenarioName

      // Cannot unload Default (Optimistic) in Multi-Year view
      if (viewMode === 'Multi-Year' && currentName === 'Default (Optimistic)') {
        alert('Cannot unload Default (Optimistic) scenario. It serves as the baseline for Scenario A.')
        return
      }

      // Cannot unload Default (A) - legacy support
      if (currentName === 'Default (A)') {
        alert('Cannot unload Default (A) scenario. It serves as the baseline for all projections.')
        return
      }

      // Cannot unload 2025 Default
      if (currentName === '2025 Default') {
        alert('Cannot unload 2025 Default scenario. It serves as the baseline for all projections.')
        return
      }

      // Load fallback scenario using proper methods
      if (viewMode === 'YTD Detailed') {
        // Use NEW modular method to load "2025 Default" Current Year Settings scenario
        // This follows the same flow as initial load: defaults → scenario → QBO cache sync
        await store.loadDefaultYTDScenario()
        // Note: Grid will automatically reload and sync because currentYearSettingId changed
      } else {
        // Multi-Year view: Load favorite A or Default (Optimistic)
        try {
          const { data: scenarios, error } = await supabase
            .from('scenarios')
            .select('*')
            .or(`user_id.eq.${profile?.id},is_public.eq.true`)

          if (error) throw error

          // Fetch user's favorite A
          const { data: favoritesData } = await supabase
            .from('user_favorites')
            .select('scenario_id, favorite_type')
            .eq('user_id', profile?.id)
            .eq('favorite_type', 'A')

          const favoriteAId = favoritesData?.[0]?.scenario_id
          const favoriteA = scenarios?.find(s => s.id === favoriteAId && s.id !== store.currentScenarioId)
          const defaultOptimistic = scenarios?.find(s => s.name === 'Default (Optimistic)')
          const fallbackScenario = favoriteA || defaultOptimistic

          if (fallbackScenario) {
            console.log(`[Unload A] Loading fallback: ${fallbackScenario.name}`)
            await store.loadScenarioFromDatabase(fallbackScenario.id, 'A', true)
          } else {
            // Ultimate fallback: just clear the name
            store.setCurrentScenario(null, 'Default (A)')
          }
        } catch (err) {
          console.error('[Unload A] Error loading fallback scenario:', err)
          store.setCurrentScenario(null, 'Default (A)')
        }
      }
    }

    window.addEventListener('unloadScenario', handleUnloadScenario)
    return () => {
      window.removeEventListener('unloadScenario', handleUnloadScenario)
    }
  }, [store, viewMode, profile?.id])

  // Listen for unloadScenarioB event
  useEffect(() => {
    const handleUnloadScenarioB = async () => {
      if (!store.currentScenarioBName) return

      // Cannot unload Default (Pessimistic)
      if (store.currentScenarioBName === 'Default (Pessimistic)') {
        alert('Cannot unload Default (Pessimistic) scenario. It serves as the baseline for Scenario B.')
        return
      }

      // Cannot unload Default (B) - legacy support
      if (store.currentScenarioBName === 'Default (B)') {
        alert('Cannot unload Default (B) scenario. It serves as the baseline for Scenario B.')
        return
      }

      const shouldUnload = confirm(
        `Unload "${store.currentScenarioBName}" from Scenario B?\n\nAny unsaved changes will be lost.`
      )

      if (shouldUnload) {
        // Load favorite B or Default (Pessimistic)
        try {
          const { data: scenarios, error } = await supabase
            .from('scenarios')
            .select('*')
            .or(`user_id.eq.${profile?.id},is_public.eq.true`)

          if (error) throw error

          // Fetch user's favorite B
          const { data: favoritesData } = await supabase
            .from('user_favorites')
            .select('scenario_id, favorite_type')
            .eq('user_id', profile?.id)
            .eq('favorite_type', 'B')

          const favoriteBId = favoritesData?.[0]?.scenario_id
          const favoriteB = scenarios?.find(s => s.id === favoriteBId && s.id !== store.currentScenarioBId)
          const defaultPessimistic = scenarios?.find(s => s.name === 'Default (Pessimistic)')
          const fallbackScenario = favoriteB || defaultPessimistic

          if (fallbackScenario) {
            console.log(`[Unload B] Loading fallback: ${fallbackScenario.name}`)
            await store.loadScenarioFromDatabase(fallbackScenario.id, 'B', false)
          } else {
            // Ultimate fallback: just clear the name
            store.setCurrentScenarioB(null, 'Default (B)')
          }
        } catch (err) {
          console.error('[Unload B] Error loading fallback scenario:', err)
          store.setCurrentScenarioB(null, 'Default (B)')
        }
      }
    }

    window.addEventListener('unloadScenarioB', handleUnloadScenarioB)
    return () => {
      window.removeEventListener('unloadScenarioB', handleUnloadScenarioB)
    }
  }, [store, profile?.id])

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

  // Detect password reset URLs and invite URLs and handle auth state changes
  useEffect(() => {
    const handleAuthStateChange = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')

      // Handle both password recovery and new user invites
      if ((type === 'recovery' || type === 'invite') && accessToken) {
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
  // DISABLED: YTD is now the default view, Multi-Year scenarios are loaded on-demand
  useEffect(() => {
    if (!profile || !urlLoaded) return

    // YTD is default view - Multi-Year scenarios only load when user switches to that view
    console.log('[INIT] Skipping Multi-Year scenario auto-load (YTD is default view)')
    setIsInitialScenarioLoadComplete(true)
    return

    // Prevent duplicate loads using ref
    if (defaultScenariosLoadedRef.current) {
      console.log('[INIT] Skipping default load - already loaded once')
      return
    }

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
      defaultScenariosLoadedRef.current = true
      setIsInitialScenarioLoadComplete(true)
      return
    }

    // Mark as loading to prevent duplicate runs
    defaultScenariosLoadedRef.current = true

    async function loadDefaultScenarios() {
      try {
        // Load favorite or Default scenarios for A and B
        // Include user's scenarios AND public scenarios (for Default (A) and Default (B))
        const { data: scenarios, error } = await supabase
          .from('scenarios')
          .select('*')
          .or(`user_id.eq.${profile?.id},is_public.eq.true`)

        if (error) throw error

        // Fetch user's favorites
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('scenario_id, favorite_type')
          .eq('user_id', profile?.id)

        // Create a map of favorites
        const favoriteAId = favoritesData?.find(f => f.favorite_type === 'A')?.scenario_id
        const favoriteBId = favoritesData?.find(f => f.favorite_type === 'B')?.scenario_id

        // Don't filter by view mode - scenarios should work across both views
        // Find favorite A or fallback to Default (A)
        const favoriteA = scenarios?.find(s => s.id === favoriteAId)
        const defaultA = scenarios?.find(s => s.name === 'Default (A)')
        const scenarioA = favoriteA || defaultA

        // Find favorite B or fallback to Default (B)
        const favoriteB = scenarios?.find(s => s.id === favoriteBId)
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
      } catch (err) {
        console.error('Error loading default scenarios:', err)
      } finally {
        // Mark as complete after scenarios are loaded (or failed)
        setIsInitialScenarioLoadComplete(true)
      }
    }

    loadDefaultScenarios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, urlLoaded])

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
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 'auto', width: 'auto', maxHeight: '90vh', maxWidth: '90vw' }} className="splash-logo" />
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
      }} className="login-page-container">
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 48,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }} className="login-page-content">
          <div style={{ textAlign: 'center', marginBottom: 32 }} className="login-page-header">
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

        <style>{`
          @media (max-width: 640px) {
            .login-page-container {
              padding: 20px !important;
            }
            .login-page-content {
              border-radius: 12px !important;
              padding: 28px 24px !important;
              max-height: 90vh;
              overflow-y: auto;
            }
            .login-page-header img {
              height: 50px !important;
              margin-bottom: 12px !important;
            }
            .login-page-header h1 {
              font-size: 22px !important;
              margin-bottom: 6px !important;
            }
            .login-page-header p {
              font-size: 14px !important;
            }
            .login-page-header {
              margin-bottom: 24px !important;
            }
          }
        `}</style>
      </div>
    )
  }

  // User is authenticated - show the full dashboard
  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 0 : 16, position: 'relative' }}>
      {/* Top Bar with Auth and Help - hide in mobile mode */}
      {!isMobile && (
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
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
          <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
        </div>
      )}

      <div style={{
        marginTop: isMobile ? 0 : 20,
        maxWidth: isMobile ? '100%' : 1600,
        margin: isMobile ? 0 : '20px auto 0 auto'
      }}>
        {/* View Mode Buttons - hide on mobile */}
        {!isMobile && (
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
            </div>
          </div>
        )}
        
        {!urlLoaded ? (
          <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            {/* Show YTD Mobile view on mobile devices */}
            {isMobile ? (
              <YTDDetailedMobile
                onRefreshRequest={handleYtdRefreshRequest}
                onPasswordChange={() => setShowPasswordReset(true)}
                isInitialScenarioLoadComplete={isInitialScenarioLoadComplete}
              />
            ) : (
              <>
                <div style={{ display: viewMode === 'YTD Detailed' ? 'block' : 'none' }}>
                  <YTDDetailed
                    initialSettings={ytdSettings}
                    onSettingsChange={handleYtdSettingsChange}
                    onRefreshRequest={handleYtdRefreshRequest}
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
                  <li>Side-by-side scenario comparison (Scenario A vs Scenario B)</li>
                  <li>Medical director hours and consulting services allocation</li>
                </ul>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Saved Scenarios</h3>
                <p>
                  Save and manage different planning scenarios to explore various financial outcomes:
                </p>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li><strong>Scenario Types:</strong> "YTD Detailed" scenarios save current year parameters. "Multi-Year" scenarios additionally save 5-year projections, physician rosters, and growth assumptions</li>
                  <li><strong>Save Scenarios:</strong> Save your current configuration with a custom name and description</li>
                  <li><strong>Load Scenarios:</strong> Access your saved scenarios or browse public scenarios shared by others</li>
                  <li><strong>Public vs Private:</strong> Mark scenarios as public to share with other users, or keep them private</li>
                  <li><strong>Favorites:</strong> Favorite your most-used scenarios for quick access</li>
                  <li><strong>Multi-Year Comparisons:</strong> Load two scenarios side-by-side to compare different planning approaches</li>
                </ul>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Sharing Links</h3>
                <p>
                  Generate shareable URLs that preserve your exact configuration:
                </p>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li><strong>Share Button:</strong> Click the link icon to create a shareable URL</li>
                  <li><strong>What's Included:</strong> Links preserve loaded scenarios, chart settings, and all view configurations</li>
                  <li><strong>Requirements:</strong> Scenarios must be saved and marked as public before sharing</li>
                  <li><strong>Recipient Access:</strong> Anyone with the link can view the configuration (login required)</li>
                </ul>

                <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Getting Started</h3>
                <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Choose between "YTD Detailed" and "Multi-Year" views using the tabs</li>
                  <li>Review the default projections and adjust parameters as needed</li>
                  <li>Modify physician details, growth rates, and other financial assumptions</li>
                  <li>Save your configuration as a scenario for future reference</li>
                  <li>Share your scenarios with colleagues using shareable links</li>
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
        mode="reset"
      />

      {/* Shared Link Warning Modal */}
      <SharedLinkWarningModal
        isOpen={showSharedLinkWarning}
        onConfirm={handleSharedLinkConfirm}
        onCancel={handleSharedLinkCancel}
      />

      <MobileWarningModal
        isOpen={showMobileWarning}
        onClose={() => setShowMobileWarning(false)}
      />
    </div>
  )
}