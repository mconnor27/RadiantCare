import { useMemo, useEffect, useState } from 'react'
import { useDashboardStore } from '../../../Dashboard'
import { useIsMobile } from '../../shared/hooks'
import YearPanel from '../../shared/components/YearPanel'
import ProjectionSettingsControls from '../../shared/components/ProjectionSettingsControls'
import HistoricAndProjectionChart from './HistoricAndProjectionChart'
import OverallCompensationSummary from '../../shared/components/OverallCompensationSummary'
import ParametersSummary from './components/ParametersSummary'
import CollapsibleSection from '../../shared/components/CollapsibleSection'

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
  const isMobile = useIsMobile()
  const [projectionOpen, setProjectionOpen] = useState(true)
  const [yearPanelOpen, setYearPanelOpen] = useState(true)
  const [overallOpen, setOverallOpen] = useState(true)
  const [parametersOpen, setParametersOpen] = useState(true)

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

  return (
    <>
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
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario A</div>
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
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario B</div>
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
