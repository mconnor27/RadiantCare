import Plot from 'react-plotly.js'
import { useDashboardStore, getTotalIncome, NET_PARTNER_POOL_2025 } from '../Dashboard'
import { useIsMobile } from './hooks'
import { getEmployeePortionOfYear, calculateDelayedW2Payment, computeDefaultNonMdEmploymentCosts } from './calculations'
import { DEFAULT_MISC_EMPLOYMENT_COSTS } from './calculations'

export default function HistoricAndProjectionChart() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const historicYears = store.historic.map((h) => h.year)
  const incomeHistoric = store.historic.map((h) => getTotalIncome(h))
  const costHistoric = store.historic.map((h) => h.nonEmploymentCosts)
  const netHistoric = store.historic.map((h) => getTotalIncome(h) - h.nonEmploymentCosts - (h.employeePayroll ?? 0))
  const employmentHistoric = store.historic.map((h) => h.employeePayroll ?? 0)

  // Helper function to get 2025 baseline values for each scenario based on their dataMode
  const getScenarioBaseline = (scenario: 'A' | 'B') => {
    const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
    const dataMode = sc.dataMode
    const last2024 = store.historic.find((h) => h.year === 2024)
    const last2025 = store.historic.find((h) => h.year === 2025)

    if (dataMode === 'Custom') {
      // For Custom mode, use the existing baseline data from year 2025 in future array
      const customBaseline = sc.future.find(f => f.year === 2025)
      if (customBaseline) {
        return {
          therapyIncome: getTotalIncome(customBaseline),
          nonEmploymentCosts: customBaseline.nonEmploymentCosts,
          employeePayroll: customBaseline.nonMdEmploymentCosts + customBaseline.miscEmploymentCosts
        }
      }
    } else if (dataMode === '2024 Data' && last2024) {
      return {
        therapyIncome: getTotalIncome(last2024),
        nonEmploymentCosts: last2024.nonEmploymentCosts,
        employeePayroll: last2024.employeePayroll ?? (164677.44 + 24623.49) // 2024 actual values
      }
    } else if (dataMode === '2025 Data' && last2025) {
      return {
        therapyIncome: getTotalIncome(last2025),
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        employeePayroll: last2025.employeePayroll ?? (computeDefaultNonMdEmploymentCosts(2025) + DEFAULT_MISC_EMPLOYMENT_COSTS)
      }
    }

    // Fallback to 2025 defaults - use actual 2025 historic data if available
    return {
      therapyIncome: last2025 ? getTotalIncome(last2025) : 2700000,
      nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
      employeePayroll: last2025?.employeePayroll ?? (computeDefaultNonMdEmploymentCosts(2025) + DEFAULT_MISC_EMPLOYMENT_COSTS)
    }
  }

  const baselineA = getScenarioBaseline('A')
  const baselineB = store.scenarioBEnabled && store.scenarioB ? getScenarioBaseline('B') : null

  // Marker fill: make 2025 points solid white to match plot background
  const plotBackgroundColor = '#ffffff'
  const markerColorsFor2025 = (seriesColor: string) =>
    historicYears.map(y => (y === 2025 ? plotBackgroundColor : seriesColor))

  // Helper function to create intermediate color between white and trace color
  const getIntermediateColor = (traceColor: string, opacity: number = 0.3) => {
    // Convert hex color to RGB, then blend with white
    const hex = traceColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // Blend with white background
    const blendedR = Math.round(r * opacity + 255 * (1 - opacity))
    const blendedG = Math.round(g * opacity + 255 * (1 - opacity))
    const blendedB = Math.round(b * opacity + 255 * (1 - opacity))

    return `rgb(${blendedR}, ${blendedG}, ${blendedB})`
  }

  // For Scenario B: use intermediate color for all markers, we'll overlay white for 2025 later
  const getScenarioBMarkerColor = (traceColor: string) => getIntermediateColor(traceColor)

  // Calculate max Y value from all data
  const scAIncome = store.scenarioA.future.map(f => getTotalIncome(f))
  const scACosts = store.scenarioA.future.map(f => f.nonEmploymentCosts)
  const scAEmployment = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    // Add delayed W2 payments for employeeToPartner physicians
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  })
  const scBIncome = store.scenarioB?.future.map(f => getTotalIncome(f)) || []
  const scBCosts = store.scenarioB?.future.map(f => f.nonEmploymentCosts) || []
  const scBEmployment = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    // Add delayed W2 payments for employeeToPartner physicians
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  }) || []
  const scANet = store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    const buyouts = f.physicians.reduce((s, p) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return getTotalIncome(f) - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
  })
  const scBNet = store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    const buyouts = f.physicians.reduce((s, p) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return getTotalIncome(f) - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
  }) || []

  const yMax = Math.max(
    ...incomeHistoric,
    ...costHistoric,
    ...netHistoric,
    ...employmentHistoric,
    ...scAIncome,
    ...scACosts,
    ...scAEmployment,
    ...scANet,
    ...scBIncome,
    ...scBCosts,
    ...scBEmployment,
    ...scBNet
  )

  return (
    <div
      style={{
        flex: 1,
        minWidth: isMobile ? undefined : 600,
        maxWidth: 1100,
        margin: '0 auto',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#f9fafb',
        padding: 12,
      }}
    >
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: 4 }}>
      <Plot
        data={(() => {
          const traces: any[] = []
          const historic2025 = store.historic.find(h => h.year === 2025)
          // Group: Income
          traces.push({ x: historicYears, y: incomeHistoric, type: 'scatter', mode: 'lines+markers', name: 'Total Income', line: { color: '#1976d2', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#1976d2'), line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'income', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025 ? getTotalIncome(historic2025) : baselineA.therapyIncome, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))], type: 'scatter', mode: 'lines+markers', name: 'Income projection A', line: { dash: 'dot', color: '#1976d2', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025 ? getTotalIncome(historic2025) : baselineB.therapyIncome, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))], type: 'scatter', mode: 'lines+markers', name: 'Income projection B', line: { dash: 'dash', color: '#1976d2', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#1976d2'), line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'income', legendrank: 3 })

          // Group: Non-employment costs
          traces.push({ x: historicYears, y: costHistoric, type: 'scatter', mode: 'lines+markers', name: 'Non-Employment Costs', line: { color: '#e65100', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#e65100'), line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'cost', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025?.nonEmploymentCosts ?? baselineA.nonEmploymentCosts, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines+markers', name: 'Cost projection A', line: { dash: 'dot', color: '#e65100', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025?.nonEmploymentCosts ?? baselineB.nonEmploymentCosts, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)], type: 'scatter', mode: 'lines+markers', name: 'Cost projection B', line: { dash: 'dash', color: '#e65100', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#e65100'), line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'cost', legendrank: 3 })

          // Group: Net income
          traces.push({ x: historicYears, y: netHistoric, type: 'scatter', mode: 'lines+markers', name: 'Net Income (Historic)', line: { color: '#2e7d32', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#2e7d32'), line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'net', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scANet[idx])], type: 'scatter', mode: 'lines+markers', name: 'Net projection A', line: { dash: 'dot', color: '#2e7d32', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [NET_PARTNER_POOL_2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBNet[idx])], type: 'scatter', mode: 'lines+markers', name: 'Net projection B', line: { dash: 'dash', color: '#2e7d32', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#2e7d32'), line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'net', legendrank: 3 })

          // Group: Employment
          traces.push({ x: historicYears, y: employmentHistoric, type: 'scatter', mode: 'lines+markers', name: 'Employment Costs (Historic)', line: { color: '#6b7280', width: 3 }, marker: { symbol: 'circle', color: markerColorsFor2025('#6b7280'), line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: '%{y:$,.0f}', legendgroup: 'employment', legendrank: 1 })
          traces.push({ x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025?.employeePayroll ?? baselineA.employeePayroll, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scAEmployment[idx])], type: 'scatter', mode: 'lines+markers', name: 'Employment projection A', line: { dash: 'dot', color: '#6b7280', width: 2 }, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'A: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 2 })
          if (store.scenarioBEnabled && store.scenarioB && baselineB) traces.push({ x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], y: [historic2025?.employeePayroll ?? baselineB.employeePayroll, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBEmployment[idx])], type: 'scatter', mode: 'lines+markers', name: 'Employment projection B', line: { dash: 'dash', color: '#6b7280', width: 2 }, marker: { symbol: 'circle', color: getScenarioBMarkerColor('#6b7280'), line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'employment', legendrank: 3 })

          // Add white overlay markers for Scenario B's 2025 points to make them appear hollow
          // All scenarios should use 2025 historic data for the 2025 points
          if (store.scenarioBEnabled && store.scenarioB && historic2025) {
            traces.push({ x: [2025], y: [getTotalIncome(historic2025)], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#1976d2', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'income' })
            traces.push({ x: [2025], y: [historic2025.nonEmploymentCosts], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#e65100', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'cost' })
            traces.push({ x: [2025], y: [NET_PARTNER_POOL_2025], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#2e7d32', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'net' })
            traces.push({ x: [2025], y: [historic2025.employeePayroll ?? 0], type: 'scatter', mode: 'markers', showlegend: false, marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: '#6b7280', width: 2 }, size: 8 }, hovertemplate: 'B: %{y:$,.0f}<extra></extra>', legendgroup: 'employment' })
          }

          return traces
        })() as any}
        layout={{
          title: { text: 'Historic and Projected Totals', font: { weight: 700 } },
          dragmode: false as any,
          legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1, yanchor: 'top', traceorder: 'grouped' },
          margin: { l: 60, r: 20, t: 40, b: 64 },
          yaxis: {
            tickprefix: '$',
            separatethousands: true,
            tickformat: ',.0f',
            rangemode: 'tozero',
            range: [0, Math.ceil((yMax * 1.1) / 10000) * 10000],
            automargin: true,
          },
          xaxis: { dtick: 1 },

        }}
        config={{
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
          scrollZoom: false,
          doubleClick: false as any,
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: isMobile ? 320 : 480 }}
      />
      </div>
    </div>
  )
}