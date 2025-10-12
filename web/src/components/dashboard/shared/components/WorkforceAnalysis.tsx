import { useState } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
const Plot = createPlotlyComponent(Plotly)
import { useDashboardStore } from '../../../Dashboard'
import { getEmployeePortionOfYear, getPartnerPortionOfYear } from '../calculations'
import { scenario2024Defaults } from '../defaults'
import type { FutureYear, Physician } from '../types'

// Helper function to calculate weeks worked for a physician in a given year
// Accounts for mid-year retirement, termination, and vacation
function calculateWeeksWorked(physician: Physician): number {
  let workingWeeks = 0

  // Get the portion of year the physician is working
  const employeePortion = getEmployeePortionOfYear(physician)
  const partnerPortion = getPartnerPortionOfYear(physician)

  // Calculate employee working weeks (for employees and employee portion of mixed types)
  if (employeePortion > 0) {
    const employeeAvailableWeeks = 52 * employeePortion
    const employeeVacation = physician.employeeWeeksVacation ?? 0
    // Vacation can only be taken during available weeks
    const effectiveVacation = Math.min(employeeVacation, employeeAvailableWeeks)
    workingWeeks += Math.max(0, employeeAvailableWeeks - effectiveVacation)
  }

  // Calculate partner working weeks (for partners and partner portion of mixed types)
  if (partnerPortion > 0) {
    const partnerAvailableWeeks = 52 * partnerPortion
    const partnerVacation = physician.weeksVacation ?? 0
    // Vacation can only be taken during available weeks
    const effectiveVacation = Math.min(partnerVacation, partnerAvailableWeeks)
    workingWeeks += Math.max(0, partnerAvailableWeeks - effectiveVacation)
  }

  return workingWeeks
}

// Helper function to calculate weeks of vacation for a physician in a given year
// This matches the calculation in PhysiciansEditor.tsx lines 2912-2926
function calculateWeeksVacation(physician: Physician): number {
  let vacation = 0

  // Add employee vacation weeks if defined
  if (physician.employeeWeeksVacation !== undefined) {
    vacation += physician.employeeWeeksVacation
  }

  // Add partner vacation weeks if defined
  if (physician.weeksVacation !== undefined) {
    vacation += physician.weeksVacation
  }

  return vacation
}

// Calculate total weeks worked for all physicians in a given year
// This matches PhysiciansEditor.tsx lines 2876-2903 including locums
function calculateTotalWeeksWorked(futureYear: FutureYear): number {
  const totalWorkingWeeks = futureYear.physicians.reduce((total, physician) => {
    return total + calculateWeeksWorked(physician)
  }, 0)

  // Add locums weeks: locumCosts / 2000 / 5
  const locumCosts = futureYear.locumCosts ?? 0
  const locumsWeeks = locumCosts / 2000 / 5

  return totalWorkingWeeks + locumsWeeks
}

// Calculate total weeks of vacation for all physicians in a given year
function calculateTotalWeeksVacation(futureYear: FutureYear): number {
  return futureYear.physicians.reduce((total, physician) => {
    return total + calculateWeeksVacation(physician)
  }, 0)
}

export default function WorkforceAnalysis() {
  const store = useDashboardStore()

  // Include 2024 + future years (2025-2030)
  const years = [2024, ...store.scenarioA.future.map((f) => f.year)]

  // Get 2024 physician data
  const physicians2024 = scenario2024Defaults()
  const year2024Data: FutureYear = {
    year: 2024,
    therapyIncome: 0,
    nonEmploymentCosts: 0,
    nonMdEmploymentCosts: 0,
    locumCosts: 0, // No locums in 2024
    miscEmploymentCosts: 0,
    physicians: physicians2024
  }

  // Calculate weeks worked for Scenario A
  const weeksWorkedA = years.map((y) => {
    if (y === 2024) {
      return calculateTotalWeeksWorked(year2024Data)
    }
    const fy = store.scenarioA.future.find(f => f.year === y)
    return fy ? calculateTotalWeeksWorked(fy) : 0
  })

  // Calculate weeks of vacation for Scenario A
  const weeksVacationA = years.map((y) => {
    if (y === 2024) {
      return calculateTotalWeeksVacation(year2024Data)
    }
    const fy = store.scenarioA.future.find(f => f.year === y)
    return fy ? calculateTotalWeeksVacation(fy) : 0
  })

  // Calculate weeks worked for Scenario B
  const weeksWorkedB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        if (y === 2024) {
          return calculateTotalWeeksWorked(year2024Data)
        }
        const fy = store.scenarioB!.future.find(f => f.year === y)
        return fy ? calculateTotalWeeksWorked(fy) : 0
      })
    : []

  // Calculate weeks of vacation for Scenario B
  const weeksVacationB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        if (y === 2024) {
          return calculateTotalWeeksVacation(year2024Data)
        }
        const fy = store.scenarioB!.future.find(f => f.year === y)
        return fy ? calculateTotalWeeksVacation(fy) : 0
      })
    : []

  const [highlight, setHighlight] = useState<null | { scenario: 'A' | 'B'; metric: 'worked' | 'vacation' }>(null)
  const [isolated, setIsolated] = useState<null | { scenario: 'A' | 'B'; metric: 'worked' | 'vacation' }>(null)

  const isHighlighted = (scenario: 'A' | 'B', metric: 'worked' | 'vacation') => {
    if (isolated) {
      // When both scenarios are enabled, highlight both A and B for the same metric
      if (store.scenarioBEnabled) {
        return isolated.metric === metric
      }
      // Single scenario: exact match only
      return isolated.scenario === scenario && isolated.metric === metric
    }

    if (highlight) {
      // When both scenarios are enabled, highlight both A and B for the same metric
      if (store.scenarioBEnabled) {
        return highlight.metric === metric
      }
      // Single scenario: exact match only
      return highlight.scenario === scenario && highlight.metric === metric
    }
    return true
  }

  const isRowHighlighted = (scenario: 'A' | 'B', metric: 'worked' | 'vacation') => {
    if (isolated) {
      if (store.scenarioBEnabled) {
        return isolated.metric === metric
      }
      return isolated.scenario === scenario && isolated.metric === metric
    }
    if (highlight) {
      if (store.scenarioBEnabled) {
        return highlight.metric === metric
      }
      return highlight.scenario === scenario && highlight.metric === metric
    }
    return false
  }

  const handleRowClick = (scenario: 'A' | 'B', metric: 'worked' | 'vacation') => {
    if (isolated?.metric === metric) {
      // Clicking the already isolated metric - clear isolation
      setIsolated(null)
      setHighlight(null)
    } else {
      // Isolate this metric
      setIsolated({ scenario, metric })
      setHighlight(null)
    }
  }

  const clearAllIsolation = () => {
    setIsolated(null)
    setHighlight(null)
  }

  return (
    <div style={{ marginTop: 0, maxWidth: store.scenarioBEnabled ? 1200 : 1000, margin: '16px auto 0 auto' }}>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: 4, position: 'relative', maxWidth: 1000, margin: '0 auto' }}>
        <Plot
          key={`plot-${isolated?.scenario}-${isolated?.metric}-${highlight?.scenario}-${highlight?.metric}`}
          data={(() => {
            const traces: any[] = []

            // Weeks Worked traces
            traces.push({
              type: 'scatter',
              mode: 'lines+markers',
              name: store.scenarioBEnabled ? 'Weeks Worked (A)' : 'Weeks Worked',
              x: years,
              y: weeksWorkedA,
              line: { color: '#3b82f6', width: isHighlighted('A', 'worked') ? 3 : 1.2 },
              opacity: (highlight || isolated) ? (isHighlighted('A', 'worked') ? 1 : 0.2) : 1,
              legendgroup: 'worked',
              legendrank: 1,
            })

            if (store.scenarioBEnabled) {
              traces.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Weeks Worked (B)',
                x: years,
                y: weeksWorkedB,
                line: { color: '#3b82f6', dash: 'dot', width: isHighlighted('B', 'worked') ? 3 : 1.2 },
                opacity: (highlight || isolated) ? (isHighlighted('B', 'worked') ? 1 : 0.2) : 1,
                legendgroup: 'worked',
                legendrank: 2,
              })
            }

            // Weeks Vacation traces
            traces.push({
              type: 'scatter',
              mode: 'lines+markers',
              name: store.scenarioBEnabled ? 'Weeks Vacation (A)' : 'Weeks Vacation',
              x: years,
              y: weeksVacationA,
              line: { color: '#f59e0b', width: isHighlighted('A', 'vacation') ? 3 : 1.2 },
              opacity: (highlight || isolated) ? (isHighlighted('A', 'vacation') ? 1 : 0.2) : 1,
              legendgroup: 'vacation',
              legendrank: 3,
            })

            if (store.scenarioBEnabled) {
              traces.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Weeks Vacation (B)',
                x: years,
                y: weeksVacationB,
                line: { color: '#f59e0b', dash: 'dot', width: isHighlighted('B', 'vacation') ? 3 : 1.2 },
                opacity: (highlight || isolated) ? (isHighlighted('B', 'vacation') ? 1 : 0.2) : 1,
                legendgroup: 'vacation',
                legendrank: 4,
              })
            }

            return traces
          })() as any}
          layout={{
            title: { text: 'Workforce Analysis (2024-2030)', font: { size: 18, weight: 600 } },
            margin: { l: 60, r: 8, t: 45, b: 60 },
            yaxis: { title: 'Weeks', separatethousands: true, rangemode: 'tozero' },
            xaxis: { dtick: 1 },
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.05, yanchor: 'top', traceorder: 'grouped' },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler={true}
          style={{ width: '100%', height: 420 }}
        />
        {/* Reset button for clearing isolation */}
        {isolated && (
          <button
            onClick={clearAllIsolation}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 1000,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.9)'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(0, 0, 0, 0.7)'}
            title="Clear isolation"
          >
            ↻ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ marginTop: 8, overflowX: 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Workforce Metrics By Year</div>
        <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 2, fontWeight: 600 }}>
          <div>Metric</div>
          {years.map((y) => (
            <div key={y} style={{ textAlign: 'right' }}>{y}</div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>

        {/* Weeks Worked - Scenario A */}
        <div
          className="table-row-hover"
          style={{
            display: 'grid',
            gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`,
            gap: 4,
            padding: '2px 0',
            borderTop: '1px solid #f0f0f0',
            background: isRowHighlighted('A', 'worked') ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb',
            cursor: 'pointer'
          }}
          onMouseEnter={() => !isolated && setHighlight({ scenario: 'A', metric: 'worked' })}
          onMouseLeave={() => !isolated && setHighlight(null)}
          onClick={() => handleRowClick('A', 'worked')}
        >
          <div>{store.scenarioBEnabled ? 'Weeks Worked (Scenario A)' : 'Weeks Worked'}</div>
          {years.map((y, idx) => (
            <div key={`WA-${y}`} style={{ textAlign: 'right' }}>
              {weeksWorkedA[idx].toFixed(1)}
            </div>
          ))}
          <div style={{ textAlign: 'right' }}>
            {weeksWorkedA.reduce((a, b) => a + b, 0).toFixed(1)}
          </div>
        </div>

        {/* Weeks Worked - Scenario B */}
        {store.scenarioBEnabled && (
          <div
            className="table-row-hover"
            style={{
              display: 'grid',
              gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`,
              gap: 4,
              padding: '2px 0',
              borderTop: '1px solid #f0f0f0',
              background: isRowHighlighted('B', 'worked') ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb',
              cursor: 'pointer'
            }}
            onMouseEnter={() => !isolated && setHighlight({ scenario: 'B', metric: 'worked' })}
            onMouseLeave={() => !isolated && setHighlight(null)}
            onClick={() => handleRowClick('B', 'worked')}
          >
            <div>Weeks Worked (Scenario B)</div>
            {years.map((y, idx) => (
              <div key={`WB-${y}`} style={{ textAlign: 'right' }}>
                {weeksWorkedB[idx].toFixed(1)}
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>
              {weeksWorkedB.reduce((a, b) => a + b, 0).toFixed(1)}
            </div>
          </div>
        )}

        {/* Weeks Vacation - Scenario A */}
        <div
          className="table-row-hover"
          style={{
            display: 'grid',
            gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`,
            gap: 4,
            padding: '2px 0',
            borderTop: '1px solid #f0f0f0',
            background: isRowHighlighted('A', 'vacation') ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7',
            cursor: 'pointer'
          }}
          onMouseEnter={() => !isolated && setHighlight({ scenario: 'A', metric: 'vacation' })}
          onMouseLeave={() => !isolated && setHighlight(null)}
          onClick={() => handleRowClick('A', 'vacation')}
        >
          <div>{store.scenarioBEnabled ? 'Weeks Vacation (Scenario A)' : 'Weeks Vacation'}</div>
          {years.map((y, idx) => (
            <div key={`VA-${y}`} style={{ textAlign: 'right' }}>
              {weeksVacationA[idx].toFixed(1)}
            </div>
          ))}
          <div style={{ textAlign: 'right' }}>
            {weeksVacationA.reduce((a, b) => a + b, 0).toFixed(1)}
          </div>
        </div>

        {/* Weeks Vacation - Scenario B */}
        {store.scenarioBEnabled && (
          <div
            className="table-row-hover"
            style={{
              display: 'grid',
              gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`,
              gap: 4,
              padding: '2px 0',
              borderTop: '1px solid #f0f0f0',
              background: isRowHighlighted('B', 'vacation') ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7',
              cursor: 'pointer'
            }}
            onMouseEnter={() => !isolated && setHighlight({ scenario: 'B', metric: 'vacation' })}
            onMouseLeave={() => !isolated && setHighlight(null)}
            onClick={() => handleRowClick('B', 'vacation')}
          >
            <div>Weeks Vacation (Scenario B)</div>
            {years.map((y, idx) => (
              <div key={`VB-${y}`} style={{ textAlign: 'right' }}>
                {weeksVacationB[idx].toFixed(1)}
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>
              {weeksVacationB.reduce((a, b) => a + b, 0).toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
