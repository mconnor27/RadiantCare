import { useState } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
const Plot = createPlotlyComponent(Plotly)
import { useDashboardStore } from '../../../Dashboard'
import { computeAllCompensationsForYear, computeAllCompensationsForYearWithRetired } from '../../../Dashboard'
import { currency, currencyOrDash } from '../utils'
import { DEFAULT_LOCUM_COSTS_2025 } from '../defaults'

export default function OverallCompensationSummary() {
  const store = useDashboardStore()
  const years = Array.from(new Set([2025, ...store.scenarioA.future.map((f) => f.year)]))
  const perYearA = years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') }))
  
  // Scenario B: Use Scenario A's 2025 values (shared baseline), then B's own values for 2026+
  const perYearB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ 
        year: y, 
        comps: y === 2025 
          ? computeAllCompensationsForYear(y, 'A') // Use shared baseline for 2025
          : computeAllCompensationsForYear(y, 'B') 
      }))
    : undefined

  // For the "Per Physician By Year" table, we want to include retired partners
  // Using the shared function from calculations.ts

  const perYearAWithRetired = years.map((y) => ({ year: y, comps: computeAllCompensationsForYearWithRetired(y, 'A') }))
  
  // Scenario B: Use Scenario A's 2025 values (shared baseline), then B's own values for 2026+
  const perYearBWithRetired = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => ({ 
        year: y, 
        comps: y === 2025 
          ? computeAllCompensationsForYearWithRetired(y, 'A') // Use shared baseline for 2025
          : computeAllCompensationsForYearWithRetired(y, 'B') 
      }))
    : undefined

  // Collect all physician names from both scenarios (including retired)
  const allNamesFromA = perYearAWithRetired.flatMap((y) => y.comps.map((c) => c.name))
  const allNamesFromB = perYearBWithRetired ? perYearBWithRetired.flatMap((y) => y.comps.map((c) => c.name)) : []
  const allNames = Array.from(new Set([...allNamesFromA, ...allNamesFromB]))
  // Assign a consistent color per person for both scenarios
  const colorPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  const colorByName: Record<string, string> = {}
  allNames.forEach((n, i) => { colorByName[n] = colorPalette[i % colorPalette.length] })
  const seriesA = allNames.map((name) => ({
    name,
    values: years.map((y) => {
      const found = perYearAWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
      return found ? found.comp : 0
    }),
  }))
  const seriesB = perYearBWithRetired
    ? allNames.map((name) => ({
        name,
        values: years.map((y) => {
          const found = perYearBWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
          return found ? found.comp : 0
        }),
      }))
    : []

  // Calculate locums data for both scenarios (including grid overrides for 2025)
  const locumsSeriesA = years.map((y) => {
    const fy = store.scenarioA.future.find(f => f.year === y)
    // Use merged future[2025] data (includes grid overrides) or fallback to default
    return fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
  })
  
  // Scenario B: Use Scenario A's 2025 locums value (shared baseline), then B's own values for 2026+
  const locumsSeriesB = store.scenarioBEnabled && store.scenarioB
    ? years.map((y) => {
        if (y === 2025) {
          // Use shared baseline from Scenario A for 2025
          const fy2025 = store.scenarioA.future.find(f => f.year === 2025)
          return fy2025?.locumCosts ?? DEFAULT_LOCUM_COSTS_2025
        }
        // For 2026+, use Scenario B's own data
        const fy = store.scenarioB!.future.find(f => f.year === y)
        return fy?.locumCosts ?? 0
      })
    : []

  const [highlight, setHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const [isolated, setIsolated] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)

  // Separate state for scenario table highlighting/isolation
  const [scenarioHighlight, setScenarioHighlight] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)
  const [scenarioIsolated, setScenarioIsolated] = useState<null | { scenario: 'A' | 'B'; name: string }>(null)

  const isHighlighted = (scenario: 'A' | 'B', name: string) => {
    // Check isolation from either table (physician table or scenario table)
    if (isolated || scenarioIsolated) {
      const activeIsolated = isolated || scenarioIsolated
      // For physician table isolation: when both scenarios are enabled, highlight both A and B for the same physician
      if (isolated && store.scenarioBEnabled) {
        return isolated.name === name
      }
      // For scenario table isolation or single scenario: exact match only
      return activeIsolated!.scenario === scenario && activeIsolated!.name === name
    }

    // Check highlighting from either table (physician table or scenario table)
    if (highlight || scenarioHighlight) {
      const activeHighlight = highlight || scenarioHighlight
      // For physician table highlighting: when both scenarios are enabled, highlight both A and B for the same physician
      if (highlight && store.scenarioBEnabled) {
        return highlight.name === name
      }
      // For scenario table highlighting or single scenario: exact match only
      return activeHighlight!.scenario === scenario && activeHighlight!.name === name
    }
    return true
  }

  const isIsolated = (scenario: 'A' | 'B', name: string) => {
    const activeIsolated = isolated || scenarioIsolated
    if (!activeIsolated) return false

    // For physician table isolation: when both scenarios are enabled, isolate both A and B for the same physician
    if (isolated && store.scenarioBEnabled) {
      return isolated.name === name
    }
    // For scenario table isolation or single scenario: exact match only
    return activeIsolated.scenario === scenario && activeIsolated.name === name
  }

  const isRowHighlighted = (scenario: 'A' | 'B', name: string) => {
    // If something is isolated (from either table), show blue background for the isolated rows
    if (isolated || scenarioIsolated) {
      return isIsolated(scenario, name)
    }
    // If hovering (and nothing isolated), show blue background for the highlighted rows
    if (highlight || scenarioHighlight) {
      return isHighlighted(scenario, name)
    }
    return false
  }

  const handleRowClick = (scenario: 'A' | 'B', name: string) => {
    // When both scenarios are enabled, check if the physician name is already isolated
    const isPhysicianIsolated = isolated?.name === name

    if (isPhysicianIsolated) {
      // Clicking any row for the already isolated physician - clear all isolation
      clearAllIsolation()
    } else {
      // Clear any scenario table isolation first, then isolate this physician
      clearAllIsolation()
      setIsolated({ scenario, name })
    }
  }

  const handleScenarioRowClick = (scenario: 'A' | 'B', name: string) => {
    // Check if this row is already isolated in scenario table
    const isRowIsolated = scenarioIsolated?.scenario === scenario && scenarioIsolated?.name === name

    if (isRowIsolated) {
      // Clicking the already isolated row - clear all isolation
      clearAllIsolation()
    } else {
      // Isolate this specific scenario row (only one at a time)
      clearAllIsolation() // Clear any existing isolation first
      setScenarioIsolated({ scenario, name })
    }
  }

  const clearAllIsolation = () => {
    setIsolated(null)
    setScenarioIsolated(null)
    setHighlight(null)
    setScenarioHighlight(null)
  }


  // Cross-table highlighting functions
  const handleScenarioRowHover = (scenario: 'A' | 'B', name: string) => {
    if (!isolated && !scenarioIsolated) {
      setScenarioHighlight({ scenario, name })
    }
  }

  const handleScenarioRowLeave = () => {
    if (!isolated && !scenarioIsolated) {
      setScenarioHighlight(null)
    }
  }


  return (
    <div style={{ marginTop: 0, maxWidth: store.scenarioBEnabled ? 1200 : 1000, margin: '16px auto 0 auto' }}>
      
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: 4, position: 'relative', maxWidth: 1000, margin: '0 auto' }}>
        <Plot
          key={`plot-${isolated?.scenario}-${isolated?.name}-${highlight?.scenario}-${highlight?.name}-${scenarioIsolated?.scenario}-${scenarioIsolated?.name}-${scenarioHighlight?.scenario}-${scenarioHighlight?.name}`}
          data={(() => {
            const rows: any[] = []
            for (const name of allNames) {
              const a = seriesA.find((s) => s.name === name)!
              rows.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: store.scenarioBEnabled ? `${name} (A)` : name,
                x: years,
                y: a.values,
                line: { color: colorByName[name], width: isHighlighted('A', name) ? 3 : 1.2 },
                opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('A', name) ? 1 : 0.2) : 1,
                legendgroup: name, // Group by physician name
                legendrank: 1, // A scenario appears first in each group
              })
              if (store.scenarioBEnabled) {
                const b = seriesB.find((s) => s.name === name)!
                rows.push({
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: `${name} (B)`,
                  x: years,
                  y: b.values,
                  line: { color: colorByName[name], dash: 'dot', width: isHighlighted('B', name) ? 3 : 1.2 },
                  opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('B', name) ? 1 : 0.2) : 1,
                  legendgroup: name, // Same group as the A scenario
                  legendrank: 2, // B scenario appears second in each group
                })
              }
            }

            // Add Locums traces
            rows.push({
              type: 'scatter',
              mode: 'lines+markers',
              name: store.scenarioBEnabled ? 'Locums (A)' : 'Locums',
              x: years,
              y: locumsSeriesA,
              line: { color: '#888888', width: isHighlighted('A', 'Locums') ? 3 : 1.2 },
              opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('A', 'Locums') ? 1 : 0.2) : 1,
              legendgroup: 'Locums', // Group by itself
              legendrank: 999, // Put at end
              hovertemplate: store.scenarioBEnabled ? 'A: %{y:$,.0f}<extra></extra>' : '%{y:$,.0f}',
              hoverlabel: { bgcolor: '#888888', font: { color: 'white' } },
            })
            if (store.scenarioBEnabled) {
              rows.push({
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Locums (B)',
                x: years,
                y: locumsSeriesB,
                line: { color: '#888888', dash: 'dot', width: isHighlighted('B', 'Locums') ? 3 : 1.2 },
                opacity: (highlight || isolated || scenarioHighlight || scenarioIsolated) ? (isHighlighted('B', 'Locums') ? 1 : 0.2) : 1,
                legendgroup: 'Locums', // Same group as A scenario
                legendrank: 1000, // Put at end after A
                hovertemplate: 'B: %{y:$,.0f}<extra></extra>',
                hoverlabel: { bgcolor: '#888888', font: { color: 'white' } },
              })
            }

            return rows
          })() as any}
          layout={{
            title: { text: 'Compensation per Physician (2025-2030)', font: { size: 18, weight: 600 } },
            margin: { l: 80, r: 8, t: 45, b: 60 },
            yaxis: { tickprefix: '$', separatethousands: true, tickformat: ',.0f' },
            xaxis: { dtick: 1 },
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.05, yanchor: 'top', traceorder: 'grouped' },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler={true}
          style={{ width: '100%', height: 420 }}
        />
        {/* Reset button for clearing isolation */}
        {(isolated || scenarioIsolated) && (
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

      <div style={{ marginTop: 8, overflowX: 'visible', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#ffffff' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Per Physician By Year</div>
        <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 2, fontWeight: 600 }}>
          <div>Name</div>
          {years.map((y) => (
            <div key={y} style={{ textAlign: 'right' }}>{y}</div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>
        {allNames.map((name, idx) => (
          <div key={name} style={{ display: 'contents' }}>
            <div
              className="table-row-hover"
              style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('A', name) ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? '#f9fafb' : 'transparent') }}
              onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'A', name })}
              onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
              onClick={() => handleRowClick('A', name)}
            >
              <div>{store.scenarioBEnabled ? `${name} (Scenario A)` : name}</div>
              {years.map((y, idx) => (
                <div key={`A-${name}-${y}`} style={{ textAlign: 'right' }}>
                  {currencyOrDash(seriesA.find((s) => s.name === name)!.values[idx])}
                </div>
              ))}
              <div style={{ textAlign: 'right' }}>
                {currency(
                  seriesA
                    .find((s) => s.name === name)!
                    .values.reduce((a, b) => a + b, 0)
                )}
              </div>
            </div>
            {store.scenarioBEnabled && (
              <div
                className="table-row-hover"
                style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '1px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('B', name) ? 'rgba(59, 130, 246, 0.08)' : (idx % 2 === 0 ? '#f9fafb' : 'transparent') }}
                onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'B', name })}
                onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
                onClick={() => handleRowClick('B', name)}
              >
                <div>{`${name} (Scenario B)`}</div>
                {years.map((y, idx) => (
                  <div key={`B-${name}-${y}`} style={{ textAlign: 'right' }}>
                    {currencyOrDash((seriesB.find((s) => s.name === name)?.values[idx]) ?? 0)}
                  </div>
                ))}
                <div style={{ textAlign: 'right' }}>
                  {currency(
                    (seriesB.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0)) ?? 0
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Locums rows */}
        <div className="table-row-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '2px solid #e5e7eb', background: isRowHighlighted('A', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f8f9fa', fontSize: '14px', color: '#6b7280' }}
        onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'A', name: 'Locums' })}
        onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
        onClick={() => handleRowClick('A', 'Locums')}>
          <div style={{ paddingLeft: '8px' }}>{store.scenarioBEnabled ? 'Locums (Scenario A)' : 'Locums'}</div>
          {years.map((y, i) => {
            const fy = store.scenarioA.future.find(f => f.year === y)
            // Use merged future[2025] data (includes grid overrides) or fallback to default
            const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
            return <div key={`LA-${i}`} style={{ textAlign: 'right' }}>{currencyOrDash(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = store.scenarioA.future.find(f => f.year === y)
              // Use merged future[2025] data (includes grid overrides) or fallback to default
              const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
              return total + locumCost
            }, 0))}
          </div>
        </div>
        {store.scenarioBEnabled && store.scenarioB && (
          <div className="table-row-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #e5e7eb', background: isRowHighlighted('B', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f8f9fa', fontSize: '14px', color: '#6b7280' }}
          onMouseEnter={() => !isolated && !scenarioIsolated && setHighlight({ scenario: 'B', name: 'Locums' })}
          onMouseLeave={() => !isolated && !scenarioIsolated && setHighlight(null)}
          onClick={() => handleRowClick('B', 'Locums')}>
            <div style={{ paddingLeft: '8px' }}>Locums (Scenario B)</div>
            {years.map((y, i) => {
              const fy = store.scenarioB!.future.find(f => f.year === y)
              // Use merged future[2025] data (includes grid overrides) or fallback to default
              const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
              return <div key={`LB-${i}`} style={{ textAlign: 'right' }}>{currencyOrDash(locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(years.reduce((total, y) => {
                const fy = store.scenarioB!.future.find(f => f.year === y)
                // Use merged future[2025] data (includes grid overrides) or fallback to default
                const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                return total + locumCost
              }, 0))}
            </div>
          </div>
        )}

        {/* Scenario A Total row */}
        <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '2px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>{store.scenarioBEnabled ? 'Net Income for MDs (Scenario A)' : 'Net Income for MDs'}</div>
          {years.map((y) => {
            const totalComp = perYearAWithRetired.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = store.scenarioA.future.find(f => f.year === y)
            // Use merged future[2025] data (includes grid overrides) or fallback to default
            const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearAWithRetired.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = store.scenarioA.future.find(f => f.year === y)
                // Use merged future[2025] data (includes grid overrides) or fallback to default
                const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                return total + locumCost
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B Total row */}
        {store.scenarioBEnabled && store.scenarioB && perYearBWithRetired && (
          <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
            <div>Net Income for MDs (Scenario B)</div>
            {years.map((y) => {
              const totalComp = perYearBWithRetired.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
              const fy = store.scenarioB!.future.find(f => f.year === y)
              // Use merged future[2025] data (includes grid overrides) or fallback to default
              const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
              return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(
                perYearBWithRetired.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                years.reduce((total, y) => {
                  const fy = store.scenarioB!.future.find(f => f.year === y)
                  // Use merged future[2025] data (includes grid overrides) or fallback to default
                  const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                  return total + locumCost
                }, 0)
              )}
            </div>
          </div>
        )}
        </div>

      {/* Per Scenario by Year table - only show when Scenario B is enabled */}
      {store.scenarioBEnabled && (
        <div style={{ marginTop: 16, overflowX: 'visible' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Per Scenario by Year</div>
        <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 2, fontWeight: 600 }}>
          <div>Scenario</div>
          {years.map((y) => (
            <div key={y} style={{ textAlign: 'right' }}>{y}</div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
        </div>

        {/* Scenario A - Individual physicians */}
        {allNames.map((name, idx) => (
          <div key={`SA-${name}`} className="table-row-hover"
            style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '1px solid #f0f0f0' : '1px solid #f8f8f8', background: isRowHighlighted('A', name) ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb' }}
            onMouseEnter={() => handleScenarioRowHover('A', name)}
            onMouseLeave={handleScenarioRowLeave}
            onClick={() => handleScenarioRowClick('A', name)}>
            <div style={{ paddingLeft: '8px' }}>{name} (Scenario A)</div>
            {years.map((y) => {
              const found = perYearAWithRetired.find((py) => py.year === y)?.comps.find((c) => c.name === name)
              return <div key={`SA-${name}-${y}`} style={{ textAlign: 'right' }}>{currencyOrDash(found ? found.comp : 0)}</div>
            })}
            <div style={{ textAlign: 'right' }}>
              {currency(
                seriesA.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0) ?? 0
              )}
            </div>
          </div>
        ))}

        {/* Scenario A - Locums */}
        <div className="table-row-hover"
          style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('A', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb', fontSize: '14px', color: '#6b7280' }}
          onMouseEnter={() => handleScenarioRowHover('A', 'Locums')}
          onMouseLeave={handleScenarioRowLeave}
          onClick={() => handleScenarioRowClick('A', 'Locums')}>
          <div style={{ paddingLeft: '16px' }}>Locums (Scenario A)</div>
          {years.map((y, i) => {
            const fy = store.scenarioA.future.find(f => f.year === y)
            // Use merged future[2025] data (includes grid overrides) or fallback to default
            const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
            return <div key={`SAL-${i}`} style={{ textAlign: 'right' }}>{currencyOrDash(locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(years.reduce((total, y) => {
              const fy = store.scenarioA.future.find(f => f.year === y)
              // Use merged future[2025] data (includes grid overrides) or fallback to default
              const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
              return total + locumCost
            }, 0))}
          </div>
        </div>

        {/* Scenario A - Total including locums */}
        <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
          <div>Net Income for MDs (Scenario A)</div>
          {years.map((y) => {
            const totalComp = perYearA.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
            const fy = store.scenarioA.future.find(f => f.year === y)
            // Use merged future[2025] data (includes grid overrides) or fallback to default
            const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
            return <div key={`SAT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
          })}
          <div style={{ textAlign: 'right' }}>
            {currency(
              perYearA.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
              years.reduce((total, y) => {
                const fy = store.scenarioA.future.find(f => f.year === y)
                // Use merged future[2025] data (includes grid overrides) or fallback to default
                const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                return total + locumCost
              }, 0)
            )}
          </div>
        </div>

        {/* Scenario B rows - only if enabled */}
        {store.scenarioBEnabled && store.scenarioB && perYearB && (
          <>
            {/* Scenario B - Individual physicians */}
            {allNames.map((name, idx) => (
              <div key={`SB-${name}`} className="table-row-hover"
                style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: idx === 0 ? '2px solid #e5e7eb' : '1px solid #f8f8f8', background: isRowHighlighted('B', name) ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7' }}
                onMouseEnter={() => handleScenarioRowHover('B', name)}
                onMouseLeave={handleScenarioRowLeave}
                onClick={() => handleScenarioRowClick('B', name)}>
                <div style={{ paddingLeft: '8px' }}>{name} (Scenario B)</div>
                {years.map((y) => {
                  const found = perYearBWithRetired?.find((py) => py.year === y)?.comps.find((c) => c.name === name)
                  return <div key={`SB-${name}-${y}`} style={{ textAlign: 'right' }}>{currencyOrDash(found ? found.comp : 0)}</div>
                })}
                <div style={{ textAlign: 'right' }}>
                  {currency(
                    seriesB.find((s) => s.name === name)?.values.reduce((a, b) => a + b, 0) ?? 0
                  )}
                </div>
              </div>
            ))}

            {/* Scenario B - Locums */}
            <div className="table-row-hover"
              style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '2px 0', borderTop: '1px solid #f0f0f0', background: isRowHighlighted('B', 'Locums') ? 'rgba(59, 130, 246, 0.08)' : '#faf9f7', fontSize: '14px', color: '#6b7280' }}
              onMouseEnter={() => handleScenarioRowHover('B', 'Locums')}
              onMouseLeave={handleScenarioRowLeave}
              onClick={() => handleScenarioRowClick('B', 'Locums')}>
              <div style={{ paddingLeft: '16px' }}>Locums (Scenario B)</div>
              {years.map((y, i) => {
                const fy = store.scenarioB!.future.find(f => f.year === y)
                // Use merged future[2025] data (includes grid overrides) or fallback to default
                const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                return <div key={`SBL-${i}`} style={{ textAlign: 'right' }}>{currencyOrDash(locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(years.reduce((total, y) => {
                  const fy = store.scenarioB!.future.find(f => f.year === y)
                  // Use merged future[2025] data (includes grid overrides) or fallback to default
                  const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                  return total + locumCost
                }, 0))}
              </div>
            </div>

            {/* Scenario B - Total including locums */}
            <div className="table-row-total-hover" style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${years.length}, 1fr) 1fr`, gap: 4, padding: '4px 0', borderTop: '1px solid #e5e7eb', background: '#eef7ff', fontWeight: 700 }}>
              <div>Net Income for MDs (Scenario B)</div>
              {years.map((y) => {
                const totalComp = perYearB.find(py => py.year === y)?.comps.reduce((sum, c) => sum + c.comp, 0) ?? 0
                const fy = store.scenarioB!.future.find(f => f.year === y)
                // Use merged future[2025] data (includes grid overrides) or fallback to default
                const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                return <div key={`SBT-${y}`} style={{ textAlign: 'right' }}>{currency(totalComp + locumCost)}</div>
              })}
              <div style={{ textAlign: 'right' }}>
                {currency(
                  perYearB.reduce((total, py) => total + py.comps.reduce((sum, c) => sum + c.comp, 0), 0) +
                  years.reduce((total, y) => {
                    const fy = store.scenarioB!.future.find(f => f.year === y)
                    // Use merged future[2025] data (includes grid overrides) or fallback to default
                    const locumCost = fy?.locumCosts ?? (y === 2025 ? DEFAULT_LOCUM_COSTS_2025 : 0)
                    return total + locumCost
                  }, 0)
                )}
              </div>
            </div>
          </>
        )}
        </div>
      )}
    </div>
  )
}