import Plot from 'react-plotly.js'
import { useDashboardStore } from '../Dashboard'
import { NET_PARTNER_POOL_2025 } from './defaults'
import { getTotalIncome } from './calculations'
import { useIsMobile } from './hooks'
import { getEmployeePortionOfYear, calculateDelayedW2Payment, computeDefaultNonMdEmploymentCosts } from './calculations'
import { calculateNetIncomeForMDs } from '../Dashboard'
import { DEFAULT_MISC_EMPLOYMENT_COSTS } from './defaults'

export default function HistoricAndProjectionChart() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const historicYears = store.historic.map((h) => h.year)
  const incomeHistoric = store.historic.map((h) => getTotalIncome(h))
  const costHistoric = store.historic.map((h) => h.nonEmploymentCosts)
  const netHistoric = store.historic.map((h) => getTotalIncome(h) - h.nonEmploymentCosts - (h.employeePayroll ?? 0))
  const employmentHistoric = store.historic.map((h) => h.employeePayroll ?? 0)
  
  // Historic Net Income for MDs values (2016-2025)
  // Values from the provided historic data image
  const netIncomeForMDsHistoric = historicYears.map((year, index) => {
    if (year === 2025) {
      // Calculate 2025 value from actual compensation data
      return calculateNetIncomeForMDs(2025, 'A')
    }
    // Historic values from the provided image
    const historicValues = [
      1969714.84, // 2016
      2025641.67, // 2017  
      2036781.02, // 2018
      2099963.75, // 2019
      2136589.69, // 2020
      2257638.23, // 2021
      2110440.21, // 2022
      2553691.52, // 2023
      2607509.70, // 2024
    ]
    return historicValues[index] || 0
  })

  // Historic Staff Employment Costs values (2016-2025)
  // Values from the provided historic data image
  const staffEmploymentHistoric = historicYears.map((year, index) => {
    if (year === 2025) {
      // Use 2025 actual staff employment cost from the defined function
      return computeDefaultNonMdEmploymentCosts(2025)
    }
    // Historic values from the provided image
    const historicValues = [
      169006.67, // 2016
      159769.32, // 2017
      151596.76, // 2018
      176431.09, // 2019
      167103.87, // 2020
      202876.23, // 2021
      150713.37, // 2022
      153509.77, // 2023
      157986.94, // 2024
    ]
    return historicValues[index] || 0
  })

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

  // Calculate employment costs for scenarios
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
  
  // Calculate Net Income for MDs for future years
  const scANetIncomeForMDs = [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
    const value = calculateNetIncomeForMDs(year, 'A')
    // Debug logging to compare with expected values
    if (year >= 2025 && year <= 2030) {
      console.log(`Net Income for MDs Scenario A ${year}: $${value.toLocaleString()}`)
    }
    return value
  })
  const scBNetIncomeForMDs = store.scenarioBEnabled && store.scenarioB 
    ? [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
        const value = calculateNetIncomeForMDs(year, 'B')
        // Debug logging to compare with expected values
        if (year >= 2025 && year <= 2030) {
          console.log(`Net Income for MDs Scenario B ${year}: $${value.toLocaleString()}`)
        }
        return value
      })
    : []

  // Calculate Staff Employment Costs for future years (nonMdEmploymentCosts + miscEmploymentCosts)
  const scAStaffEmployment = [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
    if (year === 2025) {
      // Use 2025 actual staff employment cost from the defined function
      return computeDefaultNonMdEmploymentCosts(2025)
    }
    const fy = store.scenarioA.future.find(f => f.year === year)
    return (fy?.nonMdEmploymentCosts ?? 0) + (fy?.miscEmploymentCosts ?? 0)
  })
  const scBStaffEmployment = store.scenarioBEnabled && store.scenarioB 
    ? [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
        if (year === 2025) {
          // Use 2025 actual staff employment cost from the defined function
          return computeDefaultNonMdEmploymentCosts(2025)
        }
        const fy = store.scenarioB?.future.find(f => f.year === year)
        return (fy?.nonMdEmploymentCosts ?? 0) + (fy?.miscEmploymentCosts ?? 0)
      })
    : []


  return (
    <div
      style={{
        flex: 1,
        minWidth: isMobile ? undefined : 600,
        maxWidth: 1200,
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
          
          // Helper function to create combined historic+projected traces
          const createTraceGroup = (
            name: string, 
            color: string, 
            historicData: number[], 
            scAData: number[], 
            scBData: number[] | null,
            baselineA: number,
            baselineB: number | null,
            legendgroup: string
          ) => {
            // Legend-only trace for color swatch
            traces.push({ 
              x: [null], 
              y: [null], 
              type: 'scatter', 
              mode: 'lines', 
              name: name, 
              line: { color: color, width: 8 }, 
              showlegend: true,
              hoverinfo: 'skip',
              legendgroup: legendgroup
            })

            // Historic trace (solid line) - hidden from legend
            traces.push({ 
              x: historicYears, 
              y: historicData, 
              type: 'scatter', 
              mode: 'lines+markers', 
              name: name + ' (Historic)', 
              line: { color: color, width: 3 }, 
              marker: { symbol: 'circle', color: markerColorsFor2025(color), line: { color: color, width: 2 }, size: 8 }, 
              hovertemplate: '%{y:$,.0f}: ' + name + ' (Historic)<extra></extra>', 
              hoverlabel: { bgcolor: color, font: { color: 'white' } },
              showlegend: false,
              legendgroup: legendgroup
            })
            
            // Scenario A projection (dashed line)
            traces.push({ 
              x: [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)], 
              y: [baselineA, ...scAData.slice(1)], 
              type: 'scatter', 
              mode: 'lines+markers', 
              name: name + ' (Scenario A)', 
              line: { dash: 'dot', color: color, width: 2 }, 
              marker: { symbol: 'circle', color: plotBackgroundColor, line: { color: color, width: 2 }, size: 8 }, 
              hovertemplate: '%{y:$,.0f}: ' + name + ' (Scenario A)<extra></extra>',
              hoverlabel: { bgcolor: 'white', font: { color: color } },
              showlegend: false,
              legendgroup: legendgroup
            })
            
            // Scenario B projection (dashed line)
            if (store.scenarioBEnabled && store.scenarioB && scBData && baselineB !== null) {
              traces.push({ 
                x: [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)], 
                y: [baselineB, ...scBData.slice(1)], 
                type: 'scatter', 
                mode: 'lines+markers', 
                name: name + ' (Scenario B)', 
                line: { dash: 'dash', color: color, width: 2 }, 
                marker: { symbol: 'circle', color: getScenarioBMarkerColor(color), line: { color: color, width: 2 }, size: 8 }, 
              hovertemplate: '%{y:$,.0f}: ' + name + ' (Scenario B)<extra></extra>',
              hoverlabel: { bgcolor: getIntermediateColor(color), font: { color: color } },
                showlegend: false,
                legendgroup: legendgroup
              })
            }
          }

          // Create trace groups in specified order
          createTraceGroup(
            'Total Income',
            '#2e7d32',
            incomeHistoric,
            [historic2025 ? getTotalIncome(historic2025) : baselineA.therapyIncome, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))],
            store.scenarioBEnabled && store.scenarioB ? [historic2025 ? getTotalIncome(historic2025) : baselineB!.therapyIncome, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))] : null,
            historic2025 ? getTotalIncome(historic2025) : baselineA.therapyIncome,
            baselineB ? (historic2025 ? getTotalIncome(historic2025) : baselineB.therapyIncome) : null,
            'income'
          )

          createTraceGroup(
            'Net Income for MDs',
            '#7b1fa2',
            netIncomeForMDsHistoric,
            scANetIncomeForMDs,
            store.scenarioBEnabled && store.scenarioB ? scBNetIncomeForMDs : null,
            scANetIncomeForMDs[0],
            store.scenarioBEnabled && store.scenarioB ? scBNetIncomeForMDs[0] : null,
            'netmd'
          )

          createTraceGroup(
            'Net Income',
            '#1976d2',
            netHistoric,
            [NET_PARTNER_POOL_2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scANet[idx])],
            store.scenarioBEnabled && store.scenarioB ? [NET_PARTNER_POOL_2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBNet[idx])] : null,
            NET_PARTNER_POOL_2025,
            NET_PARTNER_POOL_2025,
            'net'
          )

          createTraceGroup(
            'Employment Costs',
            '#6b7280',
            employmentHistoric,
            [historic2025?.employeePayroll ?? baselineA.employeePayroll, ...store.scenarioA.future.filter(f => f.year !== 2025).map((_, idx) => scAEmployment[idx])],
            store.scenarioBEnabled && store.scenarioB ? [historic2025?.employeePayroll ?? baselineB!.employeePayroll, ...store.scenarioB.future.filter(f => f.year !== 2025).map((_, idx) => scBEmployment[idx])] : null,
            historic2025?.employeePayroll ?? baselineA.employeePayroll,
            baselineB ? (historic2025?.employeePayroll ?? baselineB.employeePayroll) : null,
            'employment'
          )

          createTraceGroup(
            'Staff Employment Costs',
            '#f57c00',
            staffEmploymentHistoric,
            scAStaffEmployment,
            store.scenarioBEnabled && store.scenarioB ? scBStaffEmployment : null,
            scAStaffEmployment[0],
            store.scenarioBEnabled && store.scenarioB ? scBStaffEmployment[0] : null,
            'staffemp'
          )

          createTraceGroup(
            'Non-Employment Costs',
            '#e65100',
            costHistoric,
            [historic2025?.nonEmploymentCosts ?? baselineA.nonEmploymentCosts, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)],
            store.scenarioBEnabled && store.scenarioB ? [historic2025?.nonEmploymentCosts ?? baselineB!.nonEmploymentCosts, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)] : null,
            historic2025?.nonEmploymentCosts ?? baselineA.nonEmploymentCosts,
            baselineB ? (historic2025?.nonEmploymentCosts ?? baselineB.nonEmploymentCosts) : null,
            'costs'
          )

          // Add a gap in the legend
          traces.push({ 
            x: [null], 
            y: [null], 
            type: 'scatter', 
            mode: 'lines', 
            name: '', 
            line: { color: 'rgba(0,0,0,0)', width: 0 }, 
            showlegend: true,
            hoverinfo: 'skip'
          })

          // Add legend explanation traces (invisible traces just for legend)
          traces.push({ 
            x: [null], 
            y: [null], 
            type: 'scatter', 
            mode: 'lines+markers', 
            name: 'Historic', 
            line: { color: '#000000', width: 2 },
            marker: { symbol: 'circle', color: '#000000', size: 8 }, 
            showlegend: true,
            hoverinfo: 'skip',
            legendgroup: 'linestyle'
          })
          traces.push({ 
            x: [null], 
            y: [null], 
            type: 'scatter', 
            mode: 'lines+markers', 
            name: 'Projected A', 
            line: { color: '#000000', width: 2, dash: 'dot' },
            marker: { symbol: 'circle', color: '#ffffff', line: { color: '#000000', width: 2 }, size: 8 }, 
            showlegend: true,
            hoverinfo: 'skip',
            legendgroup: 'linestyle'
          })
          if (store.scenarioBEnabled && store.scenarioB) {
            traces.push({ 
              x: [null], 
              y: [null], 
              type: 'scatter', 
              mode: 'lines+markers', 
              name: 'Projected B', 
              line: { color: '#000000', width: 2, dash: 'dash' },
              marker: { symbol: 'circle', color: 'rgba(0,0,0,0.3)', line: { color: '#000000', width: 1 }, size: 8 }, 
              showlegend: true,
              hoverinfo: 'skip',
              legendgroup: 'linestyle'
            })
          }

          return traces
        })() as any}
        layout={{
          title: { text: 'Historic and Projected Totals', font: { weight: 700 } },
          dragmode: false as any,
          //legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1, yanchor: 'top', traceorder: 'grouped' },
          legend: { orientation: 'v', x: 1.02, xanchor: 'left', y: 0.5, yanchor: 'middle', bordercolor: '#e5e7eb', borderwidth: 1, tracegroupgap: 0 },
          margin: { l: 60, r: 150, t: 40, b: 40 },
          yaxis: {
            tickprefix: '$',
            separatethousands: true,
            tickformat: ',.0f',
            rangemode: 'tozero',
            autorange: true,
            automargin: true,
          },
          xaxis: { dtick: 1, range: [2015.5, 2030.5] },

        }}
        config={{
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
          scrollZoom: false,
          doubleClick: false as any,
        }}
        onLegendClick={(data: any) => {
          // Prevent clicking on line style explanation traces and spacer
          if (data.curveNumber !== undefined) {
            const trace = data.data[data.curveNumber] as any
            if (trace.legendgroup === 'linestyle' || trace.name === '') {
              return false // Prevent default legend click behavior
            }
          }
          return true // Allow default behavior for other traces
        }}
        onLegendDoubleClick={(data: any) => {
          // Handle double-click to isolate trace groups
          if (data.curveNumber !== undefined) {
            const clickedTrace = data.data[data.curveNumber] as any
            if (clickedTrace.legendgroup && clickedTrace.legendgroup !== 'linestyle') {
              // Toggle visibility of all other data traces (not line style explanations)
              const updates: any = {}
              data.data.forEach((trace: any, index: number) => {
                if (trace.legendgroup !== clickedTrace.legendgroup && trace.legendgroup !== 'linestyle' && trace.name !== '') {
                  updates[`visible[${index}]`] = trace.visible === false ? true : false
                } else if (trace.legendgroup === clickedTrace.legendgroup) {
                  updates[`visible[${index}]`] = true
                }
              })
              
              // Apply the updates
              return updates
            }
          }
          return false // Prevent default behavior
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: isMobile ? 360 : 600 }}
      />
      </div>
    </div>
  )
}