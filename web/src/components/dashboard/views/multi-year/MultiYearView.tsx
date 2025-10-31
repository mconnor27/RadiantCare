import { useMemo, useEffect, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faFloppyDisk, faCopy, faCircleXmark, faGear, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { logger } from '../../../../lib/logger'
import { useDashboardStore } from '../../../Dashboard'
import type { Store, Physician } from '../../shared/types'
import YearPanel from '../detailed/components/YearPanel'
import ProjectionSettingsControls from '../detailed/components/ProjectionSettingsControls'
import HistoricAndProjectionChart from './HistoricAndProjectionChart'
import OverallCompensationSummary from '../detailed/components/OverallCompensationSummary'
import WorkforceAnalysis from '../detailed/components/WorkforceAnalysis'
import ParametersSummary from './components/ParametersSummary'
import CollapsibleSection from '../../shared/components/CollapsibleSection'
import ScenarioLoadModal from '../../../scenarios/ScenarioLoadModal'
import ModularScenarioSaveDialog from '../../../scenarios/ModularScenarioSaveDialog'
import ShareLinkButton from '../../../shared/ShareLinkButton'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../../lib/supabase'
import { createTooltip, removeTooltip } from '../../shared/tooltips'
import { YEAR_CONFIG, getProjectionYearRange } from '../../../../config/yearConfig'

// Helper function to get baseline year from data mode
function getBaselineYear(dataMode: string): number {
  if (dataMode === '2024 Data') return 2024
  if (dataMode === 'Current Year Data') return YEAR_CONFIG.baselineYear
  if (dataMode === 'Prior Year Data') return YEAR_CONFIG.baselineYear - 1
  // Legacy values
  const yearMatch = dataMode.match(/(\d{4})/)
  if (yearMatch) return parseInt(yearMatch[1], 10)
  return YEAR_CONFIG.baselineYear // Default for 'Custom'
}

// Helper function to create projection settings summary
function createProjectionSummary(scenario: 'A' | 'B', store: Store): string {
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!sc) return ''
  
  const p = sc.projection
  const summaryParts: string[] = []
  
  // Income Growth
  summaryParts.push(`Income: ${p.incomeGrowthPct?.toFixed(1) ?? '4.0'}%`)
  
  // Medical Director amounts (in thousands)
  const mdShared = Math.round((p.medicalDirectorHours ?? 110000) / 1000)
  const mdPrcs = Math.round((p.prcsMedicalDirectorHours ?? 50000) / 1000)
  summaryParts.push(`MD: $${mdShared}k/$${mdPrcs}k`)
  summaryParts.push(`CSA: $${p.consultingServicesAgreement?.toFixed(0) ?? '26.20'}`)
  // Major cost growth rates
  summaryParts.push(`Non-Emp: ${p.nonEmploymentCostsPct?.toFixed(1) ?? '5.7'}%`)
  summaryParts.push(`Staff: ${p.nonMdEmploymentCostsPct?.toFixed(1) ?? '2.4'}%`)
  summaryParts.push(`Benefits: ${p.benefitCostsGrowthPct?.toFixed(1) ?? '7.2'}%`)
  summaryParts.push(`Misc: ${p.miscEmploymentCostsPct?.toFixed(1) ?? '3.2'}%`)
  
  // Locums (in thousands)
  const locums = Math.round((p.locumsCosts ?? 120000) / 1000)
  summaryParts.push(`Locums: $${locums}k`)
  
  return summaryParts.join(' • ')
}

// Helper function to check if any future years (projection years) have overrides or modified physicians
function hasFutureYearOverrides(scenario: 'A' | 'B', store: Store): boolean {
  const scenarioData = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!scenarioData) return false
  
  const snapshot = scenario === 'A' ? store.loadedScenarioSnapshot : store.loadedScenarioBSnapshot
  if (!snapshot) return false
  
  const snapshotScenario = scenario === 'A' 
    ? ('scenarioA' in snapshot ? snapshot.scenarioA : null)
    : ('scenarioB' in snapshot ? snapshot.scenarioB : null)
  if (!snapshotScenario) return false
  
  // Check each future year (projection years)
  const projectionYears = getProjectionYearRange()
  const minYear = projectionYears[0]
  const maxYear = projectionYears[projectionYears.length - 1]

  for (const fy of scenarioData.future) {
    if (fy.year < minYear || fy.year > maxYear) continue
    
    // Check if year has any override flags
    if (fy._overrides && Object.keys(fy._overrides).length > 0) {
      return true
    }
    
    // Check if physicians have been modified from snapshot
    const snapshotFy = snapshotScenario.future.find((f: any) => f.year === fy.year)
    if (snapshotFy) {
      // Compare physician count
      if (fy.physicians.length !== snapshotFy.physicians.length) {
        return true
      }
      
      // Compare each physician (basic check - different from detailed hasChangesFromLoadedScenario)
      for (let i = 0; i < fy.physicians.length; i++) {
        const current = fy.physicians[i]
        const snapshotPhysician = snapshotFy.physicians[i]
        
        // Quick dirty check - compare key fields
        if (
          current.name !== snapshotPhysician.name ||
          current.type !== snapshotPhysician.type ||
          Math.abs((current.salary ?? 0) - (snapshotPhysician.salary ?? 0)) > 100 ||
          current.receivesBenefits !== snapshotPhysician.receivesBenefits ||
          Math.abs((current.employeePortionOfYear ?? 0) - (snapshotPhysician.employeePortionOfYear ?? 0)) > 0.01
        ) {
          return true
        }
      }
    }
  }
  
  return false
}

// Helper function to reset all future years (projection years) to be calculated from current projection settings
function resetFutureYearsToProjection(scenario: 'A' | 'B', store: Store) {
  logger.debug('CHART', `🔄 Resetting all future years for Scenario ${scenario} to current projection settings...`)
  
  const scenarioData = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!scenarioData) {
    logger.warn('CHART', `⚠️ No data for Scenario ${scenario}`)
    return
  }
  
  // Clear all overrides for projection years
  const projectionYears = getProjectionYearRange()
  scenarioData.future.forEach((fy) => {
    if (projectionYears.includes(fy.year)) {
      fy._overrides = {}
      logger.debug('CHART', `  ✓ Cleared overrides for year ${fy.year}`)
    }
  })

  // Reset physicians for projection years to loaded snapshot
  for (const year of projectionYears) {
    store.resetPhysicians(scenario, year)
    logger.debug('CHART', `  ✓ Reset physicians for year ${year}`)
  }
  
  // Recompute all future years from baseline using current projection settings
  store.applyProjectionFromLastActual(scenario)
  logger.debug('CHART', `✅ Reset complete - all future years recalculated from current projection settings`)
}

interface MultiYearViewProps {
  hasPendingSharedLink?: boolean
}

export default function MultiYearView({ hasPendingSharedLink }: MultiYearViewProps) {
  const store = useDashboardStore()
  const { profile } = useAuth()
  const [projectionOpen, setProjectionOpen] = useState(true)
  const [yearPanelOpen, setYearPanelOpen] = useState(true)
  const [overallOpen, setOverallOpen] = useState(true)
  const [workforceOpen, setWorkforceOpen] = useState(true)
  const [parametersOpen, setParametersOpen] = useState(true)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showLoadModalB, setShowLoadModalB] = useState(false)
  const [showModularSaveDialog, setShowModularSaveDialog] = useState(false)

  // Dynamic year range for titles
  const yearRangeTitle = useMemo(() => {
    const projectionYears = getProjectionYearRange()
    const firstYear = projectionYears[0]
    const lastYear = projectionYears[projectionYears.length - 1]
    return `${YEAR_CONFIG.baselineYear}-${lastYear}`
  }, [])
  const [isScenarioDirty, setIsScenarioDirty] = useState(false)
  const [isScenarioBDirty, setIsScenarioBDirty] = useState(false)
  const [scenarioAIsPublic, setScenarioAIsPublic] = useState(false)
  const [scenarioBIsPublic, setScenarioBIsPublic] = useState(false)

  // Log only on mount (not on every render)
  useEffect(() => {
    logger.debug('CHART', '🚀 Multi-Year: View initializing')
  }, [])

  // Get current scenario info from store using selectors for reactivity
  // For modular (2025 Data), show projection name; for legacy, show scenario name
  const currentScenarioName = useDashboardStore(state => state.currentScenarioName)
  const currentScenarioUserId = useDashboardStore(state => state.currentScenarioUserId)
  const isScenarioOwner = currentScenarioUserId && profile?.id === currentScenarioUserId

  const currentScenarioBName = useDashboardStore(state => state.currentScenarioBName)
  const currentScenarioBUserId = useDashboardStore(state => state.currentScenarioBUserId)
  const isScenarioBOwner = currentScenarioBUserId && profile?.id === currentScenarioBUserId

  // Auto-load favorite or default scenarios on mount
  useEffect(() => {
    if (!profile?.id) return

    // Skip loading if there's a pending shared link
    if (hasPendingSharedLink) {
      logger.debug('CHART', '[Multi-Year Init] Skipping default scenario load - shared link pending')
      return
    }

    const loadInitialScenarios = async () => {
      try {
        // Query all user's scenarios and public scenarios
        const { data: scenarios, error } = await supabase
          .from('scenarios')
          .select('*')
          .or(`user_id.eq.${profile.id},is_public.eq.true`)

        if (error) throw error

        // Fetch user's favorites
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('scenario_id, favorite_type')
          .eq('user_id', profile.id)

        // Create a map of favorites
        const favoriteAId = favoritesData?.find(f => f.favorite_type === 'A')?.scenario_id
        const favoriteBId = favoritesData?.find(f => f.favorite_type === 'B')?.scenario_id

        // Check if we have persisted IDs from localStorage but no data (hybrid persistence)
        const hasPersistedIdA = !!store.currentScenarioId
        const hasDataA = !!store.scenarioA && store.scenarioA.future.length > 0
        const hasPersistedIdB = !!store.currentScenarioBId
        const hasDataB = !!store.scenarioB && store.scenarioB.future.length > 0

        // Determine which scenario to load for A
        let scenarioToLoadA = null
        if (hasPersistedIdA && !hasDataA) {
          // We have a persisted ID but no data - reload that scenario
          scenarioToLoadA = scenarios?.find(s => s.id === store.currentScenarioId)
          logger.debug('CHART', '[Multi-Year Init] Reloading scenario A from persisted ID:',  store.currentScenarioId)
        } else if (!hasPersistedIdA || !hasDataA) {
          // No persisted state or incomplete - load favorite or default
          const favoriteA = scenarios?.find(s => s.id === favoriteAId)
          const defaultOptimistic = scenarios?.find(s => s.name === 'Default (Optimistic)')
          scenarioToLoadA = favoriteA || defaultOptimistic
        }

        // Determine which scenario to load for B
        // ONLY load Scenario B on mount if:
        // 1. User has a persisted ID (they had it loaded before), OR
        // 2. User has a favorite B
        // Do NOT auto-load "Default (Pessimistic)" on fresh visits
        let scenarioToLoadB = null
        let isFavoriteB = false
        
        if (hasPersistedIdB && !hasDataB) {
          // We have a persisted ID but no data - reload that scenario
          scenarioToLoadB = scenarios?.find(s => s.id === store.currentScenarioBId)
          logger.debug('CHART', '[Multi-Year Init] Reloading scenario B from persisted ID:',  store.currentScenarioBId)
        } else if (!hasPersistedIdB || !hasDataB) {
          // No persisted state - ONLY load if user has a favorite
          const favoriteB = scenarios?.find(s => s.id === favoriteBId)
          if (favoriteB) {
            scenarioToLoadB = favoriteB
            isFavoriteB = true
            logger.debug('CHART', '[Multi-Year Init] Found favorite B,  will load and enable')
          } else {
            logger.debug('CHART', '[Multi-Year Init] No favorite B,  scenario B will remain disabled')
          }
        }

        // Load scenario A if needed
        if (scenarioToLoadA) {
          const isFavorite = scenarioToLoadA.id === favoriteAId
          logger.debug('CHART', `[Multi-Year Init] Loading ${isFavorite ? 'favorite A' : 'Default (Optimistic)'}...`, scenarioToLoadA.name)
          await store.loadScenarioFromDatabase(scenarioToLoadA.id, 'A', true)
          // Ensure selectedYear is set to 2025 (Baseline) after load
          store.setSelectedYear('A', YEAR_CONFIG.baselineYear)
        }

        // Load scenario B if needed (only if persisted or favorite)
        if (scenarioToLoadB) {
          logger.debug('CHART', `[Multi-Year Init] Loading scenario B...`,  scenarioToLoadB.name)
          
          // Load the data into B
          await store.loadScenarioFromDatabase(scenarioToLoadB.id, 'B', false)
          
          // Set selectedYear to 2025
          store.setSelectedYear('B', YEAR_CONFIG.baselineYear)

          // Enable visibility if it's a favorite or if it was persisted as enabled
          if (isFavoriteB || store.scenarioBEnabled) {
            store.setScenarioEnabled(true)
            logger.debug('CHART', '[Multi-Year Init] Enabled scenario B visibility')
          } else {
            store.setScenarioEnabled(false)
            logger.debug('CHART', '[Multi-Year Init] Loaded scenario B but keeping it hidden')
          }
        }
      } catch (err) {
        logger.error('CHART', '[Multi-Year Init] Error loading default scenarios:',  err)
      }
    }

    loadInitialScenarios()
  }, [profile?.id, hasPendingSharedLink]) // Only run when profile changes (on mount/login)

  // Handle user manually enabling Scenario B checkbox
  // If scenarioB doesn't exist or has no data, load user's favorite B or "Default (Pessimistic)"
  useEffect(() => {
    if (!profile?.id) return
    if (!store.scenarioBEnabled) return // Only trigger when enabled
    
    // Check if scenarioB needs to be loaded
    const needsLoad = !store.scenarioB || !store.scenarioB.future || store.scenarioB.future.length === 0
    
    if (needsLoad) {
      const loadScenarioB = async () => {
        try {
          logger.debug('CHART', '[Scenario B] User enabled checkbox,  determining which scenario to load...')
          
          // Fetch user's favorite B
          const { data: favoritesData } = await supabase
            .from('user_favorites')
            .select('scenario_id, favorite_type')
            .eq('user_id', profile.id)
            .eq('favorite_type', 'B')
            .single()
          
          const favoriteBId = favoritesData?.scenario_id
          
          // Query for scenarios
          const { data: scenarios, error } = await supabase
            .from('scenarios')
            .select('*')
            .or(`user_id.eq.${profile.id},is_public.eq.true`)
          
          if (error) throw error
          if (!scenarios || scenarios.length === 0) {
            logger.error('CHART', '[Scenario B] No scenarios found in database')
            store.setScenarioEnabled(false)
            return
          }
          
          // Prioritize: Favorite B > Default (Pessimistic)
          let scenarioToLoad = null
          if (favoriteBId) {
            scenarioToLoad = scenarios.find(s => s.id === favoriteBId)
            if (scenarioToLoad) {
              logger.debug('CHART', '[Scenario B] Loading favorite:',  scenarioToLoad.name)
            }
          }
          
          if (!scenarioToLoad) {
            scenarioToLoad = scenarios.find(s => s.name === 'Default (Pessimistic)')
            if (scenarioToLoad) {
              logger.debug('CHART', '[Scenario B] No favorite found,  loading Default (Pessimistic)')
            }
          }
          
          if (!scenarioToLoad) {
            logger.error('CHART', '[Scenario B] No suitable scenario found (no favorite or Default (Pessimistic))')
            store.setScenarioEnabled(false)
            return
          }
          
          // Load the scenario
          await store.loadScenarioFromDatabase(scenarioToLoad.id, 'B', false)
          store.setSelectedYear('B', YEAR_CONFIG.baselineYear)
          logger.debug('CHART', '[Scenario B] Loaded successfully:',  scenarioToLoad.name)
        } catch (err) {
          logger.error('CHART', '[Scenario B] Error loading scenario:',  err)
          // Disable checkbox on error
          store.setScenarioEnabled(false)
        }
      }
      
      loadScenarioB()
    }
  }, [store.scenarioBEnabled, profile?.id])

  // Handle unload scenario A - reload favorite A or Default (Optimistic)
  useEffect(() => {
    if (!profile?.id) return

    const handleUnloadScenario = async () => {
      try {
        logger.debug('CHART', '[Unload A] Current scenario:',  currentScenarioName)

        // Cannot unload "Default (Optimistic)" - it's the fallback
        if (currentScenarioName === 'Default (Optimistic)') {
          logger.debug('CHART', '[Unload A] Cannot unload Default (Optimistic)')
          return
        }

        // Query all user's scenarios and public scenarios
        const { data: scenarios, error } = await supabase
          .from('scenarios')
          .select('*')
          .or(`user_id.eq.${profile.id},is_public.eq.true`)

        if (error) throw error

        // Fetch user's favorites
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('scenario_id, favorite_type')
          .eq('user_id', profile.id)

        const favoriteAId = favoritesData?.find(f => f.favorite_type === 'A')?.scenario_id

        // Find favorite A (but not if it's the one being unloaded)
        const favoriteA = scenarios?.find(s => s.id === favoriteAId && s.id !== store.currentScenarioId)
        const defaultOptimistic = scenarios?.find(s => s.name === 'Default (Optimistic)')
        const scenarioToLoad = favoriteA || defaultOptimistic

        if (scenarioToLoad) {
          logger.debug('CHART', `[Unload A] Loading ${favoriteA ? 'favorite A' : 'Default (Optimistic)'}...`, scenarioToLoad.name)
          await store.loadScenarioFromDatabase(scenarioToLoad.id, 'A', true)
        }
      } catch (err) {
        logger.error('CHART', '[Unload A] Error reloading scenario:',  err)
      }
    }

    window.addEventListener('unloadScenario', handleUnloadScenario)
    return () => window.removeEventListener('unloadScenario', handleUnloadScenario)
  }, [profile?.id, currentScenarioName, store])

  // Handle unload scenario B - reload favorite B or Default (Pessimistic)
  useEffect(() => {
    if (!profile?.id) return

    const handleUnloadScenarioB = async () => {
      try {
        logger.debug('CHART', '[Unload B] Current scenario:',  currentScenarioBName)

        // Cannot unload "Default (Pessimistic)" - it's the fallback
        if (currentScenarioBName === 'Default (Pessimistic)') {
          logger.debug('CHART', '[Unload B] Cannot unload Default (Pessimistic)')
          return
        }

        // Query all user's scenarios and public scenarios
        const { data: scenarios, error } = await supabase
          .from('scenarios')
          .select('*')
          .or(`user_id.eq.${profile.id},is_public.eq.true`)

        if (error) throw error

        // Fetch user's favorites
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('scenario_id, favorite_type')
          .eq('user_id', profile.id)

        const favoriteBId = favoritesData?.find(f => f.favorite_type === 'B')?.scenario_id

        // Find favorite B (but not if it's the one being unloaded)
        const favoriteB = scenarios?.find(s => s.id === favoriteBId && s.id !== store.currentScenarioBId)
        const defaultPessimistic = scenarios?.find(s => s.name === 'Default (Pessimistic)')
        const scenarioToLoad = favoriteB || defaultPessimistic

        if (scenarioToLoad) {
          logger.debug('CHART', `[Unload B] Loading ${favoriteB ? 'favorite B' : 'Default (Pessimistic)'}...`, scenarioToLoad.name)
          await store.loadScenarioFromDatabase(scenarioToLoad.id, 'B', false)
        }
      } catch (err) {
        logger.error('CHART', '[Unload B] Error reloading scenario:',  err)
      }
    }

    window.addEventListener('unloadScenarioB', handleUnloadScenarioB)
    return () => window.removeEventListener('unloadScenarioB', handleUnloadScenarioB)
  }, [profile?.id, currentScenarioBName, store])

  // Memoized summaries that update when projection settings change
  const projectionSummaryA = useMemo(() =>
    createProjectionSummary('A', store),
    [store]
  )
  
  const projectionSummaryB = useMemo(() =>
    store.scenarioB ? createProjectionSummary('B', store) : '',
    [store]
  )

  const expandAll = () => {
    setProjectionOpen(true)
    setYearPanelOpen(true)
    setOverallOpen(true)
    setWorkforceOpen(true)
    setParametersOpen(true)
  }

  const collapseAll = () => {
    setProjectionOpen(false)
    setYearPanelOpen(false)
    setOverallOpen(false)
    setWorkforceOpen(false)
    setParametersOpen(false)
  }

  useEffect(() => {
    // Nudge Plotly to recompute sizes when layout width changes
    window.dispatchEvent(new Event('resize'))
  }, [store.scenarioBEnabled])

  // Mark scenario A as dirty when settings change from loaded snapshot
  useEffect(() => {
    logger.debug('CHART', '[DIRTY CHECK A] Running dirty check', {
      hasScenarioId: !!store.currentScenarioId,
      hasProjectionId: !!store.currentProjectionId,
      hasSnapshot: !!store.loadedScenarioSnapshot,
      currentDataMode: store.scenarioA.dataMode,
      snapshotDataMode: store.loadedScenarioSnapshot?.scenarioA?.dataMode,
      futureYearsCount: store.scenarioA.future.length
    })

    // NEW: For modular projection scenarios, use the new dirty detection system
    if (store.currentProjectionId && store.scenarioA.dataMode === '2025 Data') {
      const projectionDirty = store.isProjectionDirty()
      logger.debug('CHART', '[DIRTY CHECK A] Using new projection dirty detection:',  projectionDirty)
      setIsScenarioDirty(projectionDirty)
      return
    }

    // LEGACY: For non-modular scenarios, use the old snapshot comparison
    if (!store.currentScenarioId || !store.loadedScenarioSnapshot) {
      setIsScenarioDirty(false)
      return
    }

    // Compare current state to snapshot
    const snapshot = store.loadedScenarioSnapshot.scenarioA
    const current = store.scenarioA

    logger.debug('CHART', '[DIRTY CHECK A] Snapshot data:', {
      snapshotFutureCount: snapshot.future?.length,
      currentFutureCount: current.future.length,
      snapshotHasFuture: !!snapshot.future,
      snapshotProjection: snapshot.projection,
      currentProjection: current.projection,
      snapshotKeys: Object.keys(snapshot),
      fullSnapshot: snapshot
    })

    // Check if projection settings differ
    const projectionDirty = Object.keys(current.projection).some(key => {
      const k = key as keyof typeof current.projection
      const diff = Math.abs(current.projection[k] - snapshot.projection[k])
      if (diff > 0.001) {
        logger.debug('CHART', `[DIRTY CHECK A] Projection diff for ${key}:`,  { current: current.projection[k], snapshot: snapshot.projection[k], diff })
      }
      return diff > 0.001
    })

    // Check if other settings differ (excluding selectedYear - it's just UI state)
    const otherDirty = current.dataMode !== snapshot.dataMode

    // Check if per-year data differs in any future year
    logger.debug('CHART', '[DIRTY CHECK A] Starting per-year comparison,  future count:', current.future.length)
    const perYearDirty = current.future.some((currentFy, idx) => {
      const snapshotFy = snapshot.future[idx]
      if (!snapshotFy) {
        logger.debug('CHART', `[DIRTY CHECK A] Year ${currentFy.year}: No snapshot found`)
        return true
      }

      // Compare all per-year override fields
      const threshold = 0.01
      if (Math.abs(currentFy.therapyIncome - snapshotFy.therapyIncome) > threshold) {
        logger.debug('CHART', `[DIRTY CHECK A] therapyIncome differs`)
        return true
      }
      if (Math.abs(currentFy.nonEmploymentCosts - snapshotFy.nonEmploymentCosts) > threshold) return true
      if (Math.abs(currentFy.nonMdEmploymentCosts - snapshotFy.nonMdEmploymentCosts) > threshold) return true
      if (Math.abs(currentFy.locumCosts - snapshotFy.locumCosts) > threshold) return true
      if (Math.abs(currentFy.miscEmploymentCosts - snapshotFy.miscEmploymentCosts) > threshold) return true
      if (Math.abs((currentFy.medicalDirectorHours ?? 0) - (snapshotFy.medicalDirectorHours ?? 0)) > threshold) return true
      if (Math.abs((currentFy.prcsMedicalDirectorHours ?? 0) - (snapshotFy.prcsMedicalDirectorHours ?? 0)) > threshold) return true
      if (Math.abs((currentFy.consultingServicesAgreement ?? 0) - (snapshotFy.consultingServicesAgreement ?? 0)) > threshold) return true
      if ((currentFy.prcsDirectorPhysicianId ?? undefined) !== (snapshotFy.prcsDirectorPhysicianId ?? undefined)) return true

      // Compare physician arrays
      if (currentFy.physicians.length !== snapshotFy.physicians.length) {
        logger.debug('CHART', `[DIRTY CHECK A] Year ${currentFy.year}: Physician count differs (${currentFy.physicians.length} vs ${snapshotFy.physicians.length})`)
        return true
      }

      const physiciansDiffer = currentFy.physicians.some((currentPhys, physIdx) => {
        const snapshotPhys = snapshotFy.physicians[physIdx]
        if (!snapshotPhys) return true

        const differs = currentPhys.id !== snapshotPhys.id ||
               currentPhys.name !== snapshotPhys.name ||
               currentPhys.type !== snapshotPhys.type ||
               currentPhys.salary !== snapshotPhys.salary ||
               currentPhys.weeksVacation !== snapshotPhys.weeksVacation ||
               currentPhys.employeePortionOfYear !== snapshotPhys.employeePortionOfYear ||
               currentPhys.partnerPortionOfYear !== snapshotPhys.partnerPortionOfYear ||
               currentPhys.startPortionOfYear !== snapshotPhys.startPortionOfYear ||
               currentPhys.terminatePortionOfYear !== snapshotPhys.terminatePortionOfYear ||
               currentPhys.receivesBenefits !== snapshotPhys.receivesBenefits ||
               currentPhys.receivesBonuses !== snapshotPhys.receivesBonuses ||
               currentPhys.bonusAmount !== snapshotPhys.bonusAmount ||
               currentPhys.hasMedicalDirectorHours !== snapshotPhys.hasMedicalDirectorHours ||
               currentPhys.medicalDirectorHoursPercentage !== snapshotPhys.medicalDirectorHoursPercentage ||
               currentPhys.buyoutCost !== snapshotPhys.buyoutCost ||
               currentPhys.trailingSharedMdAmount !== snapshotPhys.trailingSharedMdAmount ||
               currentPhys.additionalDaysWorked !== snapshotPhys.additionalDaysWorked

        if (differs) {
          logger.debug('CHART', `[DIRTY CHECK A] Year ${currentFy.year}: Physician ${currentPhys.name} has changes`)
        }
        return differs
      })

      if (!physiciansDiffer) {
        logger.debug('CHART', `[DIRTY CHECK A] Year ${currentFy.year}: All ${currentFy.physicians.length} physicians match`)
      }
      
      return physiciansDiffer
    })

    logger.debug('CHART', '[DIRTY CHECK A] Results:', {
      projectionDirty,
      otherDirty,
      perYearDirty,
      dataModeMatch: current.dataMode === snapshot.dataMode,
      isDirty: projectionDirty || otherDirty || perYearDirty
    })

    setIsScenarioDirty(projectionDirty || otherDirty || perYearDirty)
  }, [
    // JSON.stringify creates a new string when nested data changes, ensuring effect runs
    JSON.stringify(store.scenarioA.future),
    JSON.stringify(store.scenarioA.projection),
    store.scenarioA.dataMode,
    store.currentScenarioId,
    store.currentProjectionId, // NEW: Trigger when projection ID changes
    // Serialize snapshot to detect changes
    store.loadedScenarioSnapshot ? JSON.stringify(store.loadedScenarioSnapshot) : null
  ])

  // Mark scenario B as dirty when settings change from loaded snapshot
  useEffect(() => {
    logger.debug('CHART', '[DIRTY CHECK B] Running dirty check', {
      hasScenarioBId: !!store.currentScenarioBId,
      hasSnapshot: !!store.loadedScenarioBSnapshot,
      hasScenarioB: !!store.scenarioB,
      currentDataMode: store.scenarioB?.dataMode,
      snapshotDataMode: store.loadedScenarioBSnapshot?.scenarioB?.dataMode,
      currentScenarioBId: store.currentScenarioBId
    })

    if (!store.currentScenarioBId || !store.loadedScenarioBSnapshot || !store.scenarioB) {
      logger.debug('CHART', '[DIRTY CHECK B] Early return - missing required data')
      setIsScenarioBDirty(false)
      return
    }

    // Compare current state to snapshot
    const snapshot = store.loadedScenarioBSnapshot.scenarioB
    const current = store.scenarioB

    // Check if projection settings differ
    const projectionDirty = Object.keys(current.projection).some(key => {
      const k = key as keyof typeof current.projection
      return Math.abs(current.projection[k] - snapshot.projection[k]) > 0.001
    })

    // Check if other settings differ (excluding selectedYear - it's just UI state)
    const otherDirty = current.dataMode !== snapshot.dataMode

    // Check if per-year data differs in any future year
    const perYearDirty = current.future.some((currentFy, idx) => {
      const snapshotFy = snapshot.future[idx]
      if (!snapshotFy) return true

      // Compare all per-year override fields
      const threshold = 0.01 // Small threshold for floating point comparison
      if (Math.abs(currentFy.therapyIncome - snapshotFy.therapyIncome) > threshold) return true
      if (Math.abs(currentFy.nonEmploymentCosts - snapshotFy.nonEmploymentCosts) > threshold) return true
      if (Math.abs(currentFy.nonMdEmploymentCosts - snapshotFy.nonMdEmploymentCosts) > threshold) return true
      if (Math.abs(currentFy.locumCosts - snapshotFy.locumCosts) > threshold) return true
      if (Math.abs(currentFy.miscEmploymentCosts - snapshotFy.miscEmploymentCosts) > threshold) return true
      if (Math.abs((currentFy.medicalDirectorHours ?? 0) - (snapshotFy.medicalDirectorHours ?? 0)) > threshold) return true
      if (Math.abs((currentFy.prcsMedicalDirectorHours ?? 0) - (snapshotFy.prcsMedicalDirectorHours ?? 0)) > threshold) return true
      if (Math.abs((currentFy.consultingServicesAgreement ?? 0) - (snapshotFy.consultingServicesAgreement ?? 0)) > threshold) return true
      if ((currentFy.prcsDirectorPhysicianId ?? undefined) !== (snapshotFy.prcsDirectorPhysicianId ?? undefined)) return true

      // Compare physician arrays
      if (currentFy.physicians.length !== snapshotFy.physicians.length) return true

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

      return currentFy.physicians.some((currentPhys, physIdx) => {
        const snapshotPhys = snapshotFy.physicians[physIdx]
        if (!snapshotPhys) return true

        const current = normalizePhysician(currentPhys)
        const snapshot = normalizePhysician(snapshotPhys)

        // Use tolerance for floating point comparisons to avoid false positives from rounding
        const FLOAT_TOLERANCE = 1e-6 // 0.000001
        const portionsEqual = (a: number, b: number) => {
          return Math.abs(a - b) < FLOAT_TOLERANCE
        }

        // Compare all physician properties
        return current.id !== snapshot.id ||
               current.name !== snapshot.name ||
               current.type !== snapshot.type ||
               current.salary !== snapshot.salary ||
               current.weeksVacation !== snapshot.weeksVacation ||
               !portionsEqual(current.employeePortionOfYear, snapshot.employeePortionOfYear) ||
               !portionsEqual(current.partnerPortionOfYear, snapshot.partnerPortionOfYear) ||
               !portionsEqual(current.startPortionOfYear, snapshot.startPortionOfYear) ||
               !portionsEqual(current.terminatePortionOfYear, snapshot.terminatePortionOfYear) ||
               current.receivesBenefits !== snapshot.receivesBenefits ||
               current.receivesBonuses !== snapshot.receivesBonuses ||
               !portionsEqual(current.bonusAmount, snapshot.bonusAmount) ||
               current.hasMedicalDirectorHours !== snapshot.hasMedicalDirectorHours ||
               !portionsEqual(current.medicalDirectorHoursPercentage, snapshot.medicalDirectorHoursPercentage) ||
               !portionsEqual(current.buyoutCost, snapshot.buyoutCost) ||
               !portionsEqual(current.trailingSharedMdAmount, snapshot.trailingSharedMdAmount) ||
               !portionsEqual(current.additionalDaysWorked, snapshot.additionalDaysWorked)
      })
    })

    logger.debug('CHART', '[DIRTY CHECK B] Results:', {
      projectionDirty,
      otherDirty,
      perYearDirty,
      dataModeMatch: current.dataMode === snapshot.dataMode,
      currentDataMode: current.dataMode,
      snapshotDataMode: snapshot.dataMode,
      isDirty: projectionDirty || otherDirty || perYearDirty
    })

    setIsScenarioBDirty(projectionDirty || otherDirty || perYearDirty)
  }, [
    // JSON.stringify creates a new string when nested data changes, ensuring effect runs
    store.scenarioB ? JSON.stringify(store.scenarioB.future) : null,
    store.scenarioB ? JSON.stringify(store.scenarioB.projection) : null,
    store.scenarioB?.dataMode,
    store.currentScenarioBId,
    // Serialize snapshot to detect changes
    store.loadedScenarioBSnapshot ? JSON.stringify(store.loadedScenarioBSnapshot) : null
  ])

  // Reset dirty flags when scenarios change (using refs to track previous values)
  const prevScenarioIdRef = useRef(store.currentScenarioId)
  const prevScenarioBIdRef = useRef(store.currentScenarioBId)

  useEffect(() => {
    // Only reset if the ID actually changed to a different value
    if (prevScenarioIdRef.current !== store.currentScenarioId) {
      logger.debug('CHART', '[DIRTY RESET A] Scenario ID changed, resetting dirty flag', {
        prev: prevScenarioIdRef.current,
        current: store.currentScenarioId
      })
      setIsScenarioDirty(false)
      prevScenarioIdRef.current = store.currentScenarioId
    }
  }, [store.currentScenarioId])

  useEffect(() => {
    // Only reset if the ID actually changed to a different value
    if (prevScenarioBIdRef.current !== store.currentScenarioBId) {
      logger.debug('CHART', '[DIRTY RESET B] Scenario B ID changed, resetting dirty flag', {
        prev: prevScenarioBIdRef.current,
        current: store.currentScenarioBId
      })
      setIsScenarioBDirty(false)
      prevScenarioBIdRef.current = store.currentScenarioBId
    }
  }, [store.currentScenarioBId])

  // Fetch scenario A public status when loaded
  useEffect(() => {
    async function fetchScenarioAPublicStatus() {
      if (!store.currentScenarioId) {
        setScenarioAIsPublic(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('is_public')
          .eq('id', store.currentScenarioId)
          .single()

        if (!error && data) {
          setScenarioAIsPublic(data.is_public)
        }
      } catch (err) {
        logger.error('CHART', 'Failed to fetch scenario A public status:',  err)
      }
    }

    fetchScenarioAPublicStatus()
  }, [store.currentScenarioId])

  // Fetch scenario B public status when loaded
  useEffect(() => {
    async function fetchScenarioBPublicStatus() {
      if (!store.currentScenarioBId) {
        setScenarioBIsPublic(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('is_public')
          .eq('id', store.currentScenarioBId)
          .single()

        if (!error && data) {
          setScenarioBIsPublic(data.is_public)
        }
      } catch (err) {
        logger.error('CHART', 'Failed to fetch scenario B public status:',  err)
      }
    }

    fetchScenarioBPublicStatus()
  }, [store.currentScenarioBId])


  // Reset scenario to original state
  const handleResetScenario = () => {
    if (!store.loadedScenarioSnapshot) return

    if (confirm('Reset scenario to original state? All unsaved changes will be lost.')) {
      // Simple reset from snapshot - no database reload needed
      store.resetScenarioFromSnapshot('A')
      // The dirty state will automatically update via the effect that monitors changes
    }
  }

  // Reset Scenario B to original state
  const handleResetScenarioB = () => {
    if (!store.loadedScenarioBSnapshot) return

    if (confirm('Reset Scenario B to original state? All unsaved changes will be lost.')) {
      // Simple reset from snapshot - no database reload needed
      store.resetScenarioFromSnapshot('B')
      // The dirty state will automatically update via the effect that monitors changes
    }
  }

  return (
    <>
      {/* Modular Save Dialog */}
      <ModularScenarioSaveDialog
        isOpen={showModularSaveDialog}
        onClose={() => setShowModularSaveDialog(false)}
        onSave={async (saveType, name, description, isPublic) => {
          if (saveType === 'both') {
            // Save Current Year Settings first (forceNew: true to create new copy)
            await store.saveCurrentYearSettings(name + ' - Current Year', description, isPublic, null, true)
            // Then save Projection (forceNew: true to create new copy)
            await store.saveProjection(name + ' - Projection', description, isPublic, 'A', true)
          } else if (saveType === 'current_year') {
            await store.saveCurrentYearSettings(name, description, isPublic, null, true)
          } else {
            // Save projection only (forceNew: true to create new copy)
            await store.saveProjection(name, description, isPublic, 'A', true)
          }
        }}
        baselineMode={store.scenarioA.dataMode}
      />

      {/* Scenario A Load Modal */}
      <ScenarioLoadModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={async (id) => {
          await store.loadScenarioFromDatabase(id, 'A', true)
          setShowLoadModal(false)
        }}
        viewMode="Multi-Year"
      />

      {/* Scenario B Load Modal */}
      <ScenarioLoadModal
        isOpen={showLoadModalB}
        onClose={() => setShowLoadModalB(false)}
        onLoad={async (id) => {
          // Get the scenario's baseline mode before loading to determine if we need a warning
          const { supabase } = await import('../../../../lib/supabase')
          const { data: scenarioData } = await supabase
            .from('scenarios')
            .select('baseline_mode')
            .eq('id', id)
            .single()

          const scenarioBaselineMode = scenarioData?.baseline_mode || '2025 Data'

          // Show warning only if the loaded scenario uses 2025 data (meaning we'll use A's baseline)
          if (scenarioBaselineMode === '2025 Data' &&
              confirm('Loading a scenario into B will use Scenario A\'s baseline data. The loaded scenario\'s baseline will be discarded. Continue?')) {
            await store.loadScenarioFromDatabase(id, 'B', false)
            setShowLoadModalB(false)
          } else {
            // Load without warning - either scenario doesn't use 2025 data (so we'll use its baseline) or user cancelled
            await store.loadScenarioFromDatabase(id, 'B', false)
            setShowLoadModalB(false)
          }
        }}
        viewMode="Multi-Year"
      />

      <div className="multiyear-chart-container" style={{
        maxWidth: 1400,
        minWidth: 1000,
        margin: '0 auto',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <HistoricAndProjectionChart key={store.scenarioBEnabled ? 'withB' : 'withoutB'} />
      </div>

      {/* Scenario compare */}
      <div style={{ marginTop: 16 }}>
        <div style={{
          maxWidth: store.scenarioBEnabled ? 1660 : 1000,
          minWidth: store.scenarioBEnabled ? 1660 : 1000,
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={expandAll} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Expand all</button>
              <button onClick={collapseAll} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Collapse all</button>
            </div>
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

        </div>

        <div className="multiyear-scenario-container" style={{ 
          maxWidth: store.scenarioBEnabled ? 1660 : 1000,
          minWidth: store.scenarioBEnabled ? 1660 : 1000,
          margin: '0 auto' 
        }}>
          <div className="scenario-grid" style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            marginTop: 0,
            display: 'grid',
            gridTemplateColumns: store.scenarioBEnabled ? '1fr 1fr' : '1fr',
            alignItems: 'start',
            gap: 12,
            background: '#f9fafb',
          }}>
            {/* Scenario A column */}
            <div>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                {/* Centered label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>Scenario A</div>
                  {currentScenarioName && (
                    <div style={{
                      padding: '4px 10px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#0369a1'
                    }}>
                      {currentScenarioName}
                    </div>
                  )}
                </div>
                {/* Icons positioned absolutely on the right */}
                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                  {/* Load Button */}
                  <button
                    onClick={() => {
                      if (isScenarioDirty) {
                        if (!confirm('You have unsaved changes to the current scenario. Loading another scenario will discard these changes. Continue?')) {
                          return
                        }
                      }
                      setShowLoadModal(true)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0ea5e9',
                      fontSize: 18,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                      padding: 2
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.opacity = '0.7'
                      createTooltip('multi-load-tooltip', 'Load scenario', e, { placement: 'below-center' })
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.opacity = '1'
                      removeTooltip('multi-load-tooltip')
                    }}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                  </button>

                  {/* Save Button - only show if scenario is loaded and user owns it */}
                  {currentScenarioName && isScenarioOwner && (
                    <button
                      onClick={() => {
                        const event = new CustomEvent('editCurrentScenario')
                        window.dispatchEvent(event)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#059669',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('multi-save-tooltip', 'Save scenario', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('multi-save-tooltip')
                      }}
                    >
                      <FontAwesomeIcon icon={faFloppyDisk} />
                    </button>
                  )}

                  {/* Save As Button */}
                  <button
                    onClick={() => setShowModularSaveDialog(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: 18,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                      padding: 2
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.opacity = '0.7'
                      createTooltip('multi-save-as-tooltip', 'Save as new scenario', e, { placement: 'below-center' })
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.opacity = '1'
                      removeTooltip('multi-save-as-tooltip')
                    }}
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>

                  {/* Unload Button - only show if scenario is loaded and not a default scenario */}
                  {currentScenarioName &&
                   currentScenarioName !== 'Default (A)' &&
                   currentScenarioName !== 'Default (Optimistic)' && (
                    <button
                      onClick={() => {
                        const event = new CustomEvent('unloadScenario')
                        window.dispatchEvent(event)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('multi-unload-tooltip', 'Unload scenario', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('multi-unload-tooltip')
                      }}
                    >
                      <FontAwesomeIcon icon={faCircleXmark} />
                    </button>
                  )}

                  {/* Vertical Separator */}
                  <div style={{
                    width: 1,
                    height: 18,
                    background: '#d1d5db',
                    margin: '0 2px'
                  }} />

                  {/* Share Link Button */}
                  <ShareLinkButton
                    viewMode="Multi-Year"
                    scenarioAId={store.currentScenarioId}
                    scenarioAIsPublic={scenarioAIsPublic}
                    scenarioBId={store.currentScenarioBId}
                    scenarioBIsPublic={scenarioBIsPublic}
                    scenarioBEnabled={store.scenarioBEnabled}
                    isScenarioDirty={isScenarioDirty}
                    isScenarioBDirty={isScenarioBDirty}
                    uiSettings={{
                      multiYear: {
                        selectedYearA: store.scenarioA.selectedYear,
                        selectedYearB: store.scenarioB?.selectedYear
                      }
                    }}
                  />

                  {/* Gear Icon - Full Scenario Manager */}
                  <button
                    onClick={() => {
                      const event = new CustomEvent('openScenarioManager')
                      window.dispatchEvent(event)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: 18,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                      padding: 2
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.opacity = '0.7'
                      createTooltip('multi-manager-tooltip', 'Scenario Manager', e, { placement: 'below-center' })
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.opacity = '1'
                      removeTooltip('multi-manager-tooltip')
                    }}
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </button>

                  {/* Reset Button - only show if scenario is loaded and has been modified */}
                  {currentScenarioName && isScenarioDirty && (
                    <button
                      onClick={() => {
                        removeTooltip('multi-reset-tooltip')
                        handleResetScenario()
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f59e0b',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('multi-reset-tooltip', 'Reset to original', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('multi-reset-tooltip')
                      }}
                    >
                      <FontAwesomeIcon icon={faRotateLeft} />
                    </button>
                  )}
                </div>
              </div>
              <CollapsibleSection
                title={
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span>Projection Settings</span>
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                      {projectionSummaryA}
                    </span>
                  </div>
                }
                open={projectionOpen}
                onOpenChange={setProjectionOpen}
                tone="neutral"
              >
                <ProjectionSettingsControls scenario={'A'} />
              </CollapsibleSection>
              <CollapsibleSection 
                title={`Per Year Settings (Baseline: ${getBaselineYear(store.scenarioA.dataMode)})`} 
                open={yearPanelOpen} 
                onOpenChange={setYearPanelOpen} 
                tone="neutral"
                right={
                  hasFutureYearOverrides('A', store) ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTooltip('year-panel-reset-a-tooltip')
                        resetFutureYearsToProjection('A', store)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('year-panel-reset-a-tooltip', 'Reset to current projection settings', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('year-panel-reset-a-tooltip')
                      }}
                    >
                      <img 
                        src="/recalc2.png" 
                        alt="Reset" 
                        style={{ width: 34, height: 34 }}
                      />
                    </button>
                  ) : null
                }
              >
                <YearPanel year={store.scenarioA.selectedYear ?? store.scenarioA.future[0]?.year ?? YEAR_CONFIG.baselineYear} scenario={'A'} />
              </CollapsibleSection>
            </div>

            {/* Scenario B column */}
            {store.scenarioBEnabled && store.scenarioB && (
              <div>
                <div style={{ position: 'relative', marginBottom: 4 }}>
                  {/* Centered label */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>Scenario B</div>
                    {currentScenarioBName && (
                      <div style={{
                        padding: '4px 10px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#15803d'
                      }}>
                        {currentScenarioBName}
                      </div>
                    )}
                  </div>
                  {/* Icons positioned absolutely on the right */}
                  <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Load Button */}
                    <button
                      onClick={() => {
                        if (isScenarioBDirty) {
                          if (!confirm('You have unsaved changes to Scenario B. Loading another scenario will discard these changes. Continue?')) {
                            return
                          }
                        }
                        setShowLoadModalB(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0ea5e9',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('multi-b-load-tooltip', 'Load scenario into B', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('multi-b-load-tooltip')
                      }}
                    >
                      <FontAwesomeIcon icon={faFolderOpen} />
                    </button>

                    {/* Save Button - only show if scenario is loaded and user owns it */}
                    {currentScenarioBName && isScenarioBOwner && (
                      <button
                        onClick={() => {
                          const event = new CustomEvent('editCurrentScenarioB')
                          window.dispatchEvent(event)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#059669',
                          fontSize: 18,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          padding: 2
                        }}
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.opacity = '0.7'
                          createTooltip('multi-b-save-tooltip', 'Save Scenario B', e, { placement: 'below-center' })
                        }}
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.opacity = '1'
                          removeTooltip('multi-b-save-tooltip')
                        }}
                      >
                        <FontAwesomeIcon icon={faFloppyDisk} />
                      </button>
                    )}

                    {/* Save As Button */}
                    <button
                      onClick={() => {
                        const event = new CustomEvent('saveScenarioBAs')
                        window.dispatchEvent(event)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.opacity = '0.7'
                        createTooltip('multi-b-save-as-tooltip', 'Save Scenario B as new scenario', e, { placement: 'below-center' })
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.opacity = '1'
                        removeTooltip('multi-b-save-as-tooltip')
                      }}
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>

                    {/* Unload Button - only show if scenario B is loaded and not a default scenario */}
                    {currentScenarioBName &&
                     currentScenarioBName !== 'Default (B)' &&
                     currentScenarioBName !== 'Default (Pessimistic)' && (
                      <button
                        onClick={() => {
                          const event = new CustomEvent('unloadScenarioB')
                          window.dispatchEvent(event)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: 18,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          padding: 2
                        }}
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.opacity = '0.7'
                          createTooltip('multi-b-unload-tooltip', 'Unload Scenario B', e, { placement: 'below-center' })
                        }}
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.opacity = '1'
                          removeTooltip('multi-b-unload-tooltip')
                        }}
                      >
                        <FontAwesomeIcon icon={faCircleXmark} />
                      </button>
                    )}

                    {/* Reset Button - only show if scenario is loaded and has been modified */}
                    {currentScenarioBName && isScenarioBDirty && (
                      <button
                        onClick={() => {
                          removeTooltip('multi-b-reset-tooltip')
                          handleResetScenarioB()
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f59e0b',
                          fontSize: 18,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          padding: 2
                        }}
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.opacity = '0.7'
                          createTooltip('multi-b-reset-tooltip', 'Reset to original', e, { placement: 'below-center' })
                        }}
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.opacity = '1'
                          removeTooltip('multi-b-reset-tooltip')
                        }}
                      >
                        <FontAwesomeIcon icon={faRotateLeft} />
                      </button>
                    )}
                  </div>
                </div>
                <CollapsibleSection
                  title={
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span>Projection Settings</span>
                      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                        {projectionSummaryB}
                      </span>
                    </div>
                  }
                  open={projectionOpen}
                  onOpenChange={setProjectionOpen}
                  tone="neutral"
                >
                  <ProjectionSettingsControls scenario={'B'} />
                </CollapsibleSection>
                <CollapsibleSection 
                  title={`Per Year Settings (Baseline: ${getBaselineYear(store.scenarioB?.dataMode || '2025 Data')})`} 
                  open={yearPanelOpen} 
                  onOpenChange={setYearPanelOpen} 
                  tone="neutral"
                  right={
                    hasFutureYearOverrides('B', store) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTooltip('year-panel-reset-b-tooltip')
                          resetFutureYearsToProjection('B', store)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.7'
                          createTooltip('year-panel-reset-b-tooltip', 'Reset to current projection settings', e, { placement: 'below-center' })
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1'
                          removeTooltip('year-panel-reset-b-tooltip')
                        }}
                      >
                        <img 
                          src="/recalc2.png" 
                          alt="Reset" 
                          style={{ width: 34, height: 34 }}
                        />
                      </button>
                    ) : null
                  }
                >
                  <YearPanel year={store.scenarioB.selectedYear ?? store.scenarioB.future[0]?.year ?? YEAR_CONFIG.baselineYear} scenario={'B'} />
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="overall-compensation-container" style={{ maxWidth: store.scenarioBEnabled ? 1100 : 1000, minWidth: store.scenarioBEnabled ? 1100 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title={`Overall Compensation Summary (${yearRangeTitle})`} open={overallOpen} onOpenChange={setOverallOpen} tone="neutral">
          <OverallCompensationSummary />
        </CollapsibleSection>
      </div>

      <div className="workforce-analysis-container" style={{ maxWidth: store.scenarioBEnabled ? 1000 : 1000, minWidth: store.scenarioBEnabled ? 1000 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title="Workforce Analysis" open={workforceOpen} onOpenChange={setWorkforceOpen} tone="neutral">
          <WorkforceAnalysis />
        </CollapsibleSection>
      </div>

      <div className="parameters-summary-container" style={{ maxWidth: store.scenarioBEnabled ? 1000 : 1000, minWidth: store.scenarioBEnabled ? 1000 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title="Parameters Summary" open={parametersOpen} onOpenChange={setParametersOpen} tone="neutral">
          <ParametersSummary />
        </CollapsibleSection>
      </div>
    </>
  )
}
