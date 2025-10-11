import { useMemo, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faFloppyDisk, faCopy, faCircleXmark, faGear, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { useDashboardStore } from '../../../Dashboard'
import { useIsMobile } from '../../shared/hooks'
import YearPanel from '../../shared/components/YearPanel'
import ProjectionSettingsControls from '../../shared/components/ProjectionSettingsControls'
import HistoricAndProjectionChart from './HistoricAndProjectionChart'
import OverallCompensationSummary from '../../shared/components/OverallCompensationSummary'
import ParametersSummary from './components/ParametersSummary'
import CollapsibleSection from '../../shared/components/CollapsibleSection'
import ScenarioLoadModal from '../../../scenarios/ScenarioLoadModal'
import { useAuth } from '../../../auth/AuthProvider'

// Helper function to get baseline year from data mode
function getBaselineYear(dataMode: string): number {
  if (dataMode === '2024 Data') return 2024
  return 2025 // Default for '2025 Data' and 'Custom'
}

// Helper function to create projection settings summary
function createProjectionSummary(scenario: 'A' | 'B', store: any): string {
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
  const isMobile = useIsMobile()
  const [projectionOpen, setProjectionOpen] = useState(true)
  const [yearPanelOpen, setYearPanelOpen] = useState(true)
  const [overallOpen, setOverallOpen] = useState(true)
  const [parametersOpen, setParametersOpen] = useState(true)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showLoadModalB, setShowLoadModalB] = useState(false)
  const [isScenarioDirty, setIsScenarioDirty] = useState(false)
  const [isScenarioBDirty, setIsScenarioBDirty] = useState(false)

  // Log only on mount (not on every render)
  useEffect(() => {
    console.log('🚀 Multi-Year: View initializing')
  }, [])

  // Memoized summaries that update when projection settings change
  const projectionSummaryA = useMemo(() => 
    createProjectionSummary('A', store), 
    [store.scenarioA.projection]
  )
  
  const projectionSummaryB = useMemo(() => 
    store.scenarioB ? createProjectionSummary('B', store) : '', 
    [store.scenarioB?.projection]
  )

  const expandAll = () => {
    setProjectionOpen(true)
    setYearPanelOpen(true)
    setOverallOpen(true)
    setParametersOpen(true)
  }
  
  const collapseAll = () => {
    setProjectionOpen(false)
    setYearPanelOpen(false)
    setOverallOpen(false)
    setParametersOpen(false)
  }

  useEffect(() => {
    // Nudge Plotly to recompute sizes when layout width changes
    window.dispatchEvent(new Event('resize'))
  }, [store.scenarioBEnabled])

  // Mark scenario A as dirty when settings change
  useEffect(() => {
    if (!store.currentScenarioId) return
    setIsScenarioDirty(true)
  }, [
    store.scenarioA.projection,
    store.scenarioA.selectedYear,
    store.currentScenarioId
  ])

  // Mark scenario B as dirty when settings change
  useEffect(() => {
    if (!store.currentScenarioBId) return
    setIsScenarioBDirty(true)
  }, [
    store.scenarioB?.projection,
    store.scenarioB?.selectedYear,
    store.currentScenarioBId
  ])

  // Reset dirty flags when scenarios change
  useEffect(() => {
    setIsScenarioDirty(false)
  }, [store.currentScenarioId])

  useEffect(() => {
    setIsScenarioBDirty(false)
  }, [store.currentScenarioBId])

  // Auto-load Default scenario on first load if no scenario is loaded
  useEffect(() => {
    if (!store.currentScenarioId) {
      console.log('🔄 No scenario loaded, attempting to load Default scenario...')

      const loadDefaultScenario = async () => {
        try {
          const { supabase } = await import('../../../../lib/supabase')

          const { data: defaultScenario, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('name', 'Default')
            .eq('view_mode', 'Multi-Year')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching Default scenario:', error)
            return
          }

          if (defaultScenario) {
            console.log('✅ Found Default scenario, loading...', defaultScenario.id)
            await store.loadScenarioFromDatabase(defaultScenario.id, 'A', true)
          } else {
            console.log('ℹ️ No Default scenario found in database')
          }
        } catch (error) {
          console.error('Failed to auto-load Default scenario:', error)
        }
      }

      loadDefaultScenario()
    }
  }, [store.currentScenarioId, store])

  // Reset scenario to original state
  const handleResetScenario = async () => {
    if (!store.currentScenarioId) return

    if (confirm('Reset scenario to original state? All unsaved changes will be lost.')) {
      try {
        await store.loadScenarioFromDatabase(store.currentScenarioId, 'A', true)
        setIsScenarioDirty(false)
      } catch (err) {
        console.error('Error resetting scenario:', err)
        alert('Failed to reset scenario')
      }
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
  const handleResetScenarioB = async () => {
    if (!store.currentScenarioBId) return

    if (confirm('Reset Scenario B to original state? All unsaved changes will be lost.')) {
      try {
        await store.loadScenarioFromDatabase(store.currentScenarioBId, 'B', false)
        setIsScenarioBDirty(false)
      } catch (err) {
        console.error('Error resetting Scenario B:', err)
        alert('Failed to reset Scenario B')
      }
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
          if (confirm('Loading a scenario into B will use Scenario A\'s baseline data. The loaded scenario\'s baseline will be discarded. Continue?')) {
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                <YearPanel year={store.scenarioA.selectedYear} scenario={'A'} />
              </CollapsibleSection>
            </div>

            {/* Scenario B column */}
            {store.scenarioBEnabled && store.scenarioB && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
                      (Uses Scenario A baseline)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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

                    {/* Unload Button - only show if scenario B is loaded */}
                    {currentScenarioBName && (
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
                  <YearPanel year={store.scenarioB.selectedYear} scenario={'B'} />
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
        <CollapsibleSection title="Parameters Summary" open={parametersOpen} onOpenChange={setParametersOpen} tone="neutral">
          <ParametersSummary />
        </CollapsibleSection>
      </div>
    </>
  )
}
