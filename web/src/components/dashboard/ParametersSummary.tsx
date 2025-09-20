import type { FutureYear } from './types'
import { useDashboardStore } from '../Dashboard'
import { useIsMobile } from './hooks'
import {
  computeDefaultNonMdEmploymentCosts
} from './calculations'
import { scenarioADefaultsByYear, scenarioBDefaultsByYear, scenario2024Defaults, DEFAULT_MISC_EMPLOYMENT_COSTS } from './defaults'
import {
  currency,
  currencyShort,
  abbreviatePhysicianName,
  employeePortionToTransitionDay,
  partnerPortionToRetirementDay,
  startPortionToStartDay,
  dayOfYearToDate
} from './utils'

export default function ParametersSummary() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()

  // Helper function to detect if values have been manually overridden
  const detectCustomOverrides = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'

    // Get baseline data (same logic as applyProjectionFromLastActual)
    let baselineData
    const last2024 = store.historic.find((h) => h.year === 2024)
    const last2025 = store.historic.find((h) => h.year === 2025)

    if (dataMode === '2024 Data' && last2024) {
      baselineData = {
        therapyIncome: last2024.therapyIncome,
        nonEmploymentCosts: last2024.nonEmploymentCosts,
        miscEmploymentCosts: 24623.49,
        nonMdEmploymentCosts: 164677.44,
      }
    } else if (last2025) {
      baselineData = {
        therapyIncome: last2025.therapyIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    } else {
      baselineData = {
        therapyIncome: 3344068.19,
        nonEmploymentCosts: 229713.57,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }

    const overrides = {
      incomeGrowthPct: false,
      nonEmploymentCostsPct: false,
      nonMdEmploymentCostsPct: false,
      miscEmploymentCostsPct: false,
    }

    // Convert percentage growth rates to decimal multipliers
    const incomeGpct = sc.projection.incomeGrowthPct / 100
    const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
    const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
    const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100

    // Starting values from the selected baseline
    let expectedIncome = baselineData.therapyIncome
    let expectedNonEmploymentCosts = baselineData.nonEmploymentCosts
    let expectedNonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
    let expectedMiscEmploymentCosts = baselineData.miscEmploymentCosts

    // Check each future year for deviations from expected values
    for (const fy of sc.future) {
      if (fy.year === 2025) continue // Skip baseline year

      // Calculate expected values for this year
      expectedIncome = expectedIncome * (1 + incomeGpct)
      expectedNonEmploymentCosts = expectedNonEmploymentCosts * (1 + nonEmploymentGpct)
      expectedNonMdEmploymentCosts = expectedNonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
      expectedMiscEmploymentCosts = expectedMiscEmploymentCosts * (1 + miscEmploymentGpct)

      // Compare with actual values (with 1% tolerance for floating point differences)
      const tolerance = 0.01
      if (Math.abs(fy.therapyIncome - expectedIncome) / expectedIncome > tolerance) {
        overrides.incomeGrowthPct = true
      }
      if (Math.abs(fy.nonEmploymentCosts - expectedNonEmploymentCosts) / expectedNonEmploymentCosts > tolerance) {
        overrides.nonEmploymentCostsPct = true
      }
      if (Math.abs(fy.nonMdEmploymentCosts - expectedNonMdEmploymentCosts) / expectedNonMdEmploymentCosts > tolerance) {
        overrides.nonMdEmploymentCostsPct = true
      }
      if (Math.abs(fy.miscEmploymentCosts - expectedMiscEmploymentCosts) / expectedMiscEmploymentCosts > tolerance) {
        overrides.miscEmploymentCostsPct = true
      }
    }

    return overrides
  }

  const buildYearData = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const historic2025 = store.historic.find((h) => h.year === 2025)!
    const years = Array.from(new Set([2025, ...sc.future.map((f) => f.year)]))
    return years.map((year) => {
      if (year === 2025) {
        const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
        const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
        return {
          year,
        therapyIncome: historic2025.therapyIncome,
        nonEmploymentCosts: historic2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        medicalDirectorHours: 119373.75, // 2025 shared medical director amount
        prcsMedicalDirectorHours: 37792.5, // 2025 PRCS medical director amount (JS)
        consultingServicesAgreement: 16200.00, // 2025 consulting services amount
        prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
        physicians,
        } as FutureYear
      }
      return sc.future.find((f) => f.year === year) as FutureYear
    })
  }

    const renderScenario = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const data = buildYearData(scenario)
    const overrides = detectCustomOverrides(scenario)
    const maxPhysicians = Math.max(...data.map((d) => d.physicians.length))
    const baselineMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
    const baselineLabel = baselineMode === '2025 Data' ? null : `Baseline (${baselineMode === 'Custom' ? 'Custom' : (baselineMode?.match(/\d{4}/)?.[0] || baselineMode || 'Unknown')})`
    const hasExtraBaselineCol = Boolean(baselineLabel)
    // Narrow columns slightly when we include the extra Baseline column so everything fits without overflow
    const labelColWidth = hasExtraBaselineCol ? 120 : 150
    const yearColWidth = hasExtraBaselineCol ? 120 : 135
    const columnGap = hasExtraBaselineCol ? 3 : 4
    const baselineDataObj = (() => {
      if (!baselineLabel) return null
      if (baselineMode === 'Custom') {
        const custom = sc.future.find((f) => f.year === 2025)
        return custom ? { ...custom, year: 2025 } : null
      }
      if (baselineMode === '2024 Data') {
        const h2024 = store.historic.find((h) => h.year === 2024)
        if (!h2024) return null
        return {
          year: 2024,
          therapyIncome: h2024.therapyIncome,
          nonEmploymentCosts: h2024.nonEmploymentCosts,
          nonMdEmploymentCosts: 164677.44,
          locumCosts: 113400,
          miscEmploymentCosts: 18182.56,
          physicians: scenario2024Defaults(),
        } as FutureYear
      }
      return null
    })()
    return (
      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb', maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Scenario {scenario} Parameters</div>
          <div style={{ fontSize: 13, color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, padding: 5, background: '#ffffff' }}>
            Growth — Income: {overrides.incomeGrowthPct ? 'Custom' : `${sc.projection.incomeGrowthPct}%`} · Non-Emp: {overrides.nonEmploymentCostsPct ? 'Custom' : `${sc.projection.nonEmploymentCostsPct}%`} · Staff: {overrides.nonMdEmploymentCostsPct ? 'Custom' : `${sc.projection.nonMdEmploymentCostsPct}%`} · Benefits: {sc.projection.benefitCostsGrowthPct}% · Misc: {overrides.miscEmploymentCostsPct ? 'Custom' : `${sc.projection.miscEmploymentCostsPct}%`}
          </div>
        </div>

        <div style={{ marginTop: 6, marginBottom: 12, overflowX: isMobile ? 'auto' : 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Per Year Core Values</div>
          <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' as any }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', fontWeight: 600 }}>
              <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>Metric</div>
              {baselineLabel && <div style={{ textAlign: 'left' }}>{baselineLabel}</div>}
              {data.map((d) => (
                <div key={`hdr-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{d.year}</div>
              ))}
            </div>
            {/* Data rows with alternating backgrounds */}
            {[
              { label: 'Income', baseline: baselineDataObj?.therapyIncome, values: data.map(d => d.therapyIncome), key: 'inc' },
              { label: 'Non-Employment', baseline: baselineDataObj?.nonEmploymentCosts, values: data.map(d => d.nonEmploymentCosts), key: 'nec' },
              { label: 'Staff Employment', baseline: baselineDataObj?.nonMdEmploymentCosts, values: data.map(d => d.nonMdEmploymentCosts), key: 'nmd' },
              { label: 'Misc Employment', baseline: baselineDataObj?.miscEmploymentCosts, values: data.map(d => d.miscEmploymentCosts), key: 'msc' },
              { label: 'Locums', baseline: baselineDataObj?.locumCosts, values: data.map(d => d.locumCosts), key: 'loc' }
            ].map((row, idx) => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', background: idx % 2 === 0 ? '#f9fafb' : 'transparent', alignItems: 'center' }}>
                <div style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>{row.label}</div>
                {baselineLabel && <div style={{ textAlign: 'left' }}>{row.baseline ? currency(Math.round(row.baseline)) : ''}</div>}
                {row.values.map((value, valueIdx) => (
                  <div key={`${row.key}-${scenario}-${data[valueIdx].year}`} style={{ textAlign: 'left' }}>{currency(Math.round(value))}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8, overflowX: isMobile ? 'auto' : 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Physicians Per Year</div>
          <div style={{ fontSize: 13, alignItems: 'center', fontVariantNumeric: 'tabular-nums' as any }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', fontWeight: 600 }}>
              <div style={{ whiteSpace: 'nowrap' }}>Slot</div>
              {baselineLabel && <div style={{ textAlign: 'left' }}>{baselineLabel}</div>}
              {data.map((d) => (
                <div key={`ph-h-${scenario}-${d.year}`} style={{ textAlign: 'left' }}>{d.year}</div>
              ))}
            </div>
            {/* Physician rows with alternating backgrounds */}
            {Array.from({ length: maxPhysicians }).map((_, rowIdx) => (
              <div key={`row-${scenario}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px ${baselineLabel ? `${yearColWidth}px ` : ''}repeat(${data.length}, ${yearColWidth}px)`, columnGap: columnGap, padding: '4px 0', background: rowIdx % 2 === 0 ? '#f9fafb' : 'transparent', alignItems: 'center' }}>
                <div style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>#{rowIdx + 1}</div>
                {baselineLabel && (
                  <div style={{ textAlign: 'left' }}>
                    {(() => {
                      const p = baselineDataObj?.physicians[rowIdx]
                      if (!p) return ''
                      const role = p.type === 'partner' ? 'P' : p.type === 'employee' ? 'E' : p.type === 'newEmployee' ? 'N' : p.type === 'employeeToTerminate' ? 'T' : p.type === 'employeeToPartner' ? 'M' : 'R'
                      const tokens: string[] = [abbreviatePhysicianName(p.name), role]
                      if (p.type === 'employeeToPartner') {
                        const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(transitionDay, baselineDataObj!.year)
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `→${month}/${day}`
                        const payTime = sal && wk ? `${sal}/${wk}` : sal || wk
                        const detail = payTime ? `${dateLabel} ${payTime}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'partnerToRetire') {
                        const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, baselineDataObj!.year)
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        const buyout = typeof p.buyoutCost === 'number' ? currencyShort(p.buyoutCost).toUpperCase() : ''
                        if (retirementDay === 0) {
                          const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                          if (workTime) tokens.push(workTime)
                        } else {
                          const { month, day } = dayOfYearToDate(retirementDay, baselineDataObj!.year)
                          const dateLabel = `${month}/${day}`
                          const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                          const detail = workTime ? `${dateLabel} ${workTime}` : dateLabel
                          tokens.push(detail)
                        }
                      } else if (p.type === 'employee') {
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        if (sal) tokens.push(sal)
                      } else if (p.type === 'newEmployee') {
                        const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(startDay, baselineDataObj!.year)
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `${month}/${day}`
                        const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'employeeToTerminate') {
                        const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, baselineDataObj!.year)
                        const { month, day } = dayOfYearToDate(terminateDay, baselineDataObj!.year)
                        const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                        const dateLabel = `${month}/${day}`
                        const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                        tokens.push(detail)
                      } else if (p.type === 'partner') {
                        const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                        if (wk) tokens.push(wk)
                      }
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 12px 1fr', gap: 2, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>{tokens[0]}</span>
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>{tokens[1] || ''}</span>
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>{tokens[2] || ''}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {data.map((d) => {
                  const p = d.physicians[rowIdx]
                  if (!p) return <div key={`cell-${scenario}-${d.year}-${rowIdx}`} />
                  const role = p.type === 'partner' ? 'P' : p.type === 'employee' ? 'E' : p.type === 'newEmployee' ? 'N' : p.type === 'employeeToTerminate' ? 'T' : p.type === 'employeeToPartner' ? 'M' : 'R'
                  const tokens: string[] = [abbreviatePhysicianName(p.name), role]

                  if (p.type === 'employeeToPartner') {
                    const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, d.year)
                    const { month, day } = dayOfYearToDate(transitionDay, d.year)
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `→${month}/${day}`
                    const payTime = sal && wk ? `${sal}/${wk}` : sal || wk
                    const detail = payTime ? `${dateLabel} ${payTime}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'partnerToRetire') {
                    const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, d.year)
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    const buyout = typeof p.buyoutCost === 'number' ? currencyShort(p.buyoutCost).toUpperCase() : ''

                    if (retirementDay === 0) {
                      // Retired in prior year - omit date, show only costs
                      const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                      if (workTime) tokens.push(workTime)
                    } else {
                      // Normal retirement in current year - show date and costs
                      const { month, day } = dayOfYearToDate(retirementDay, d.year)
                      const dateLabel = `${month}/${day}`
                      const workTime = wk && buyout ? `${wk}/${buyout}` : wk || buyout
                      const detail = workTime ? `${dateLabel} ${workTime}` : dateLabel
                      tokens.push(detail)
                    }
                  } else if (p.type === 'employee') {
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    if (sal) tokens.push(sal)
                  } else if (p.type === 'newEmployee') {
                    const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, d.year)
                    const { month, day } = dayOfYearToDate(startDay, d.year)
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `${month}/${day}`
                    const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'employeeToTerminate') {
                    const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, d.year)
                    const { month, day } = dayOfYearToDate(terminateDay, d.year)
                    const sal = typeof p.salary === 'number' ? currencyShort(p.salary).toUpperCase() : ''
                    const dateLabel = `${month}/${day}`
                    const detail = sal ? `${dateLabel} ${sal}` : dateLabel
                    tokens.push(detail)
                  } else if (p.type === 'partner') {
                    const wk = typeof p.weeksVacation === 'number' ? `${p.weeksVacation}w` : ''
                    if (wk) tokens.push(wk)
                  }
                  return (
                    <div key={`cell-${scenario}-${d.year}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: '24px 12px 1fr', gap: 2, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{tokens[0]}</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{tokens[1] || ''}</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{tokens[2] || ''}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend / key for role abbreviations */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ color: '#6b7280', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 6, padding: 5, background: '#ffffff' }}>
          <span>N: New Employee</span>
          <span>E: Employee</span>
          <span>T: Employee Termination</span>
          <span>M: Mixed (Employee to Partner)</span>
          <span>P: Partner</span>
          <span>R: Partner to Retire</span>
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