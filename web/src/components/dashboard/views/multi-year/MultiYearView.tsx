import { useMemo, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faFloppyDisk, faCopy, faCircleXmark, faGear, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { useDashboardStore } from '../../../Dashboard'
import type { Store, Physician } from '../../shared/types'
import YearPanel from '../../shared/components/YearPanel'
import ProjectionSettingsControls from '../../shared/components/ProjectionSettingsControls'
import HistoricAndProjectionChart from './HistoricAndProjectionChart'
import OverallCompensationSummary from '../../shared/components/OverallCompensationSummary'
import WorkforceAnalysis from '../../shared/components/WorkforceAnalysis'
import ParametersSummary from './components/ParametersSummary'
import CollapsibleSection from '../../shared/components/CollapsibleSection'
import ScenarioLoadModal from '../../../scenarios/ScenarioLoadModal'
import ShareLinkButton from '../../../shared/ShareLinkButton'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../../lib/supabase'

// Helper function to get baseline year from data mode
function getBaselineYear(dataMode: string): number {
  if (dataMode === '2024 Data') return 2024
  return 2025 // Default for '2025 Data' and 'Custom'
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

export default function MultiYearView() {
  const store = useDashboardStore()
  const { profile } = useAuth()
  const [projectionOpen, setProjectionOpen] = useState(true)
  const [yearPanelOpen, setYearPanelOpen] = useState(true)
  const [overallOpen, setOverallOpen] = useState(true)
  const [workforceOpen, setWorkforceOpen] = useState(true)
  const [parametersOpen, setParametersOpen] = useState(true)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showLoadModalB, setShowLoadModalB] = useState(false)
  const [isScenarioDirty, setIsScenarioDirty] = useState(false)
  const [isScenarioBDirty, setIsScenarioBDirty] = useState(false)
  const [scenarioAIsPublic, setScenarioAIsPublic] = useState(false)
  const [scenarioBIsPublic, setScenarioBIsPublic] = useState(false)

  // Log only on mount (not on every render)
  useEffect(() => {
    console.log('🚀 Multi-Year: View initializing')
  }, [])

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
    console.log('[DIRTY CHECK A] Running dirty check', {
      hasScenarioId: !!store.currentScenarioId,
      hasSnapshot: !!store.loadedScenarioSnapshot,
      currentDataMode: store.scenarioA.dataMode,
      snapshotDataMode: store.loadedScenarioSnapshot?.scenarioA?.dataMode,
      futureYearsCount: store.scenarioA.future.length
    })

    if (!store.currentScenarioId || !store.loadedScenarioSnapshot) {
      setIsScenarioDirty(false)
      return
    }

    // Compare current state to snapshot
    const snapshot = store.loadedScenarioSnapshot.scenarioA
    const current = store.scenarioA

    console.log('[DIRTY CHECK A] Snapshot data:', {
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
        console.log(`[DIRTY CHECK A] Projection diff for ${key}:`, { current: current.projection[k], snapshot: snapshot.projection[k], diff })
      }
      return diff > 0.001
    })

    // Check if other settings differ (excluding selectedYear - it's just UI state)
    const otherDirty = current.dataMode !== snapshot.dataMode

    // Check if per-year data differs in any future year
    console.log('[DIRTY CHECK A] Starting per-year comparison, future count:', current.future.length)
    const perYearDirty = current.future.some((currentFy, idx) => {
      console.log(`[DIRTY CHECK A] Checking year ${currentFy.year} (index ${idx})`)
      const snapshotFy = snapshot.future[idx]
      if (!snapshotFy) {
        console.log(`[DIRTY CHECK A] No snapshot for index ${idx}`)
        return true
      }

      console.log(`[DIRTY CHECK A] Year ${currentFy.year} physician counts:`, {
        current: currentFy.physicians?.length,
        snapshot: snapshotFy.physicians?.length
      })

      // Compare all per-year override fields
      const threshold = 0.01
      if (Math.abs(currentFy.therapyIncome - snapshotFy.therapyIncome) > threshold) {
        console.log(`[DIRTY CHECK A] therapyIncome differs`)
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
        console.log(`[DIRTY CHECK A] Physician count differs`)
        return true
      }

      const physiciansDiffer = currentFy.physicians.some((currentPhys, physIdx) => {
        const snapshotPhys = snapshotFy.physicians[physIdx]
        if (!snapshotPhys) return true

        console.log(`[DIRTY CHECK A] Comparing physician ${currentPhys.name}:`, {
          currentSalary: currentPhys.salary,
          snapshotSalary: snapshotPhys.salary,
          areSame: currentPhys.salary === snapshotPhys.salary,
          currentRef: currentPhys,
          snapshotRef: snapshotPhys,
          areReferencesSame: currentPhys === snapshotPhys
        })

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
          console.log(`[DIRTY CHECK A] Physician ${currentPhys.name} differs!`)
        }
        return differs
      })

      return physiciansDiffer
    })

    console.log('[DIRTY CHECK A] Results:', {
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
    // Serialize snapshot to detect changes
    store.loadedScenarioSnapshot ? JSON.stringify(store.loadedScenarioSnapshot) : null
  ])

  // Mark scenario B as dirty when settings change from loaded snapshot
  useEffect(() => {
    console.log('[DIRTY CHECK B] Running dirty check', {
      hasScenarioBId: !!store.currentScenarioBId,
      hasSnapshot: !!store.loadedScenarioBSnapshot,
      hasScenarioB: !!store.scenarioB,
      currentDataMode: store.scenarioB?.dataMode,
      snapshotDataMode: store.loadedScenarioBSnapshot?.scenarioB?.dataMode,
      currentScenarioBId: store.currentScenarioBId
    })

    if (!store.currentScenarioBId || !store.loadedScenarioBSnapshot || !store.scenarioB) {
      console.log('[DIRTY CHECK B] Early return - missing required data')
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

    console.log('[DIRTY CHECK B] Results:', {
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

  // Reset dirty flags when scenarios change
  useEffect(() => {
    setIsScenarioDirty(false)
  }, [store.currentScenarioId])

  useEffect(() => {
    setIsScenarioBDirty(false)
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
        console.error('Failed to fetch scenario A public status:', err)
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
        console.error('Failed to fetch scenario B public status:', err)
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

  // Get current scenario info from store
  const currentScenarioName = store.currentScenarioName
  const currentScenarioUserId = store.currentScenarioUserId
  const isScenarioOwner = currentScenarioUserId && profile?.id === currentScenarioUserId

  const currentScenarioBName = store.currentScenarioBName
  const currentScenarioBUserId = store.currentScenarioBUserId
  const isScenarioBOwner = currentScenarioBUserId && profile?.id === currentScenarioBUserId

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

      <div style={{
        maxWidth: 1200,
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

        <div style={{ 
          maxWidth: store.scenarioBEnabled ? 1660 : 1000, 
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
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    title="Load scenario"
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
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      title="Save scenario"
                    >
                      <FontAwesomeIcon icon={faFloppyDisk} />
                    </button>
                  )}

                  {/* Save As Button */}
                  <button
                    onClick={() => {
                      const event = new CustomEvent('saveScenarioAs')
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
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    title="Save as new scenario"
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>

                  {/* Unload Button - only show if scenario is loaded and not Default (A) */}
                  {currentScenarioName && currentScenarioName !== 'Default (A)' && (
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
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      title="Unload scenario"
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
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    title="Scenario Manager"
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </button>

                  {/* Reset Button - only show if scenario is loaded and has been modified */}
                  {currentScenarioName && isScenarioDirty && (
                    <button
                      onClick={handleResetScenario}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f59e0b',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        padding: 2
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      title="Reset to original"
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
              <CollapsibleSection title={`Per Year Settings (Baseline: ${getBaselineYear(store.scenarioA.dataMode)})`} open={yearPanelOpen} onOpenChange={setYearPanelOpen} tone="neutral">
                <YearPanel year={store.scenarioA.selectedYear ?? store.scenarioA.future[0]?.year ?? 2025} scenario={'A'} />
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
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      title="Load scenario into B"
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
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                        title="Save Scenario B"
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
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      title="Save Scenario B as new scenario"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>

                    {/* Unload Button - only show if scenario B is loaded and not Default (B) */}
                    {currentScenarioBName && currentScenarioBName !== 'Default (B)' && (
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
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                        title="Unload Scenario B"
                      >
                        <FontAwesomeIcon icon={faCircleXmark} />
                      </button>
                    )}

                    {/* Reset Button - only show if scenario is loaded and has been modified */}
                    {currentScenarioBName && isScenarioBDirty && (
                      <button
                        onClick={handleResetScenarioB}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f59e0b',
                          fontSize: 18,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          padding: 2
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                        title="Reset to original"
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
                <CollapsibleSection title={`Per Year Settings (Baseline: ${getBaselineYear(store.scenarioB?.dataMode || '2025 Data')})`} open={yearPanelOpen} onOpenChange={setYearPanelOpen} tone="neutral">
                  <YearPanel year={store.scenarioB.selectedYear ?? store.scenarioB.future[0]?.year ?? 2025} scenario={'B'} />
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div style={{ maxWidth: store.scenarioBEnabled ? 1200 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title="Overall Compensation Summary (2025-2030)" open={overallOpen} onOpenChange={setOverallOpen} tone="neutral">
          <OverallCompensationSummary />
        </CollapsibleSection>
      </div>

      <div style={{ maxWidth: store.scenarioBEnabled ? 1200 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title="Workforce Analysis" open={workforceOpen} onOpenChange={setWorkforceOpen} tone="neutral">
          <WorkforceAnalysis />
        </CollapsibleSection>
      </div>

      <div style={{ maxWidth: store.scenarioBEnabled ? 1200 : 1000, margin: '0 auto' }}>
        <CollapsibleSection title="Parameters Summary" open={parametersOpen} onOpenChange={setParametersOpen} tone="neutral">
          <ParametersSummary />
        </CollapsibleSection>
      </div>
    </>
  )
}
