import { useEffect, useMemo, useState, useRef } from 'react'
import { logger } from '../../../../lib/logger'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
const Plot = createPlotlyComponent(Plotly)
import { useDashboardStore } from '../../../Dashboard'
import { getTotalIncome } from '../../shared/calculations'
import { getEmployeePortionOfYear, calculateDelayedW2Payment, computeDefaultNonMdEmploymentCosts } from '../../shared/calculations'
import { calculateNetIncomeForMDs } from '../../../Dashboard'

export default function HistoricAndProjectionChart() {
  const store = useDashboardStore()
  const historicYears = store.historic.map((h) => h.year)
  const [isDataReady, setIsDataReady] = useState(false)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Track container width for aspect ratio using ResizeObserver
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth
        logger.debug('CHART', '📐 [HistoricChart] Container width update:', {
          newWidth,
          currentWidth: containerWidth,
          hasPositiveWidth: newWidth > 0,
          willUpdate: newWidth > 0
        })
        
        // Only update if we have a valid positive width
        // This prevents the chart from collapsing when container is temporarily hidden
        if (newWidth > 0) {
          setContainerWidth(newWidth)
        } else {
          logger.warn('CHART', '📐 [HistoricChart] Ignoring zero/negative width')
        }
      }
    }

    // Immediate synchronous measurement to prevent layout shift
    updateWidth()
    
    // Use ResizeObserver to detect container size changes
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        // Use ResizeObserver entries for more accurate measurements
        for (const entry of entries) {
          const newWidth = entry.contentRect.width
          logger.debug('CHART', '📐 [HistoricChart] ResizeObserver triggered:', {
            newWidth,
            currentWidth: containerWidth,
            hasPositiveWidth: newWidth > 0
          })
          
          // Only update if we have a valid positive width
          if (newWidth > 0) {
            setContainerWidth(newWidth)
          } else {
            logger.warn('CHART', '📐 [HistoricChart] ResizeObserver: Ignoring zero/negative width')
          }
        }
      })
      resizeObserver.observe(containerRef.current)
      
      // Keep window resize listener as fallback
      window.addEventListener('resize', updateWidth)
      
      return () => {
        resizeObserver.disconnect()
        window.removeEventListener('resize', updateWidth)
      }
    }
  }, [])

  // Check if data is ready - we need 2025 baseline data and projected years
  useEffect(() => {
    const has2025Data = store.scenarioA.future.some(f => f.year === 2025)
    const hasProjectedYears = store.scenarioA.future.length >= 6 // Should have 2025-2030
    
    // If Scenario B is enabled, also wait for it to be ready
    const scenarioBReady = !store.scenarioBEnabled || 
      (store.scenarioB?.future && store.scenarioB.future.length >= 5)
    
    const dataReady = has2025Data && hasProjectedYears && scenarioBReady
    
    if (dataReady && !isDataReady) {
      logger.debug('CHART', '📊 Multi-Year Chart: Data ready,  loaded projections for', store.scenarioA.future.map(f => f.year).join(', '))
      if (store.scenarioBEnabled && store.scenarioB) {
        logger.debug('CHART', '📊 Multi-Year Chart: Scenario B also ready with',  store.scenarioB.future.map(f => f.year).join(', '))
      }
      setIsDataReady(true)
    } else if (!dataReady && isDataReady) {
      // Data became invalid (e.g., scenario loading)
      logger.debug('CHART', '📊 Multi-Year Chart: Data not ready,  waiting...', { has2025Data, hasProjectedYears, scenarioBReady })
      setIsDataReady(false)
    }
  }, [store.scenarioA.future, store.scenarioBEnabled, store.scenarioB?.future, isDataReady])

  // Helper: Calculate metrics from a FutureYear entry (used for 2025 baseline from store)
  const calculateMetricsFromFutureYear = (fy: any) => {
    const totalIncome = getTotalIncome(fy)
    const staffEmployment = (fy.nonMdEmploymentCosts ?? 0) + (fy.miscEmploymentCosts ?? 0)
    const mdEmployment = fy.physicians.reduce((s: number, e: any) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      return s
    }, 0)
    const delayedW2 = fy.physicians.reduce((s: number, p: any) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, fy.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    const buyouts = fy.physicians.reduce((s: number, p: any) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0)
    const employmentCosts = mdEmployment + staffEmployment + delayedW2 + (fy.locumCosts ?? 0)
    const netIncome = totalIncome - (fy.nonEmploymentCosts ?? 0) - staffEmployment - (fy.locumCosts ?? 0) - mdEmployment - buyouts - delayedW2

    return {
      totalIncome,
      nonEmploymentCosts: fy.nonEmploymentCosts ?? 0,
      employmentCosts,
      staffEmployment,
      netIncome,
    }
  }

  // Memoize baseline calculations - use stored 2025 data directly to avoid discontinuity
  // IMPORTANT: 2025 is the ground truth baseline shared by both scenarios
  // It comes from YTDDetailed sync and is stored in scenarioA.future
  const baselineA = useMemo(() => {
    const fy2025 = store.scenarioA.future.find(f => f.year === 2025)
    if (!fy2025) {
      // Fallback if 2025 not in store (shouldn't happen)
      return { totalIncome: 0, nonEmploymentCosts: 0, employmentCosts: 0, staffEmployment: 0, netIncome: 0 }
    }
    return calculateMetricsFromFutureYear(fy2025)
  }, [store.scenarioA.future])
  
  // Scenario B uses the SAME 2025 baseline as Scenario A (there's only one ground truth)
  const baselineB = useMemo(() => {
    if (!store.scenarioBEnabled || !store.scenarioB) return null
    // Use Scenario A's 2025 data as the shared baseline
    return baselineA
  }, [store.scenarioBEnabled, store.scenarioB, baselineA])

  // Memoize historic arrays - only recalculate when baseline changes
  const incomeHistoric = useMemo(() => 
    store.historic.map((h) => h.year === 2025 ? baselineA.totalIncome : getTotalIncome(h)),
    [store.historic, baselineA.totalIncome]
  )
  
  const costHistoric = useMemo(() =>
    store.historic.map((h) => h.year === 2025 ? baselineA.nonEmploymentCosts : h.nonEmploymentCosts),
    [store.historic, baselineA.nonEmploymentCosts]
  )
  
  const netHistoric = useMemo(() =>
    store.historic.map((h) => h.year === 2025 ? baselineA.netIncome : getTotalIncome(h) - h.nonEmploymentCosts - (h.employeePayroll ?? 0)),
    [store.historic, baselineA.netIncome]
  )
  
  const employmentHistoric = useMemo(() =>
    store.historic.map((h) => h.year === 2025 ? baselineA.employmentCosts : h.employeePayroll ?? 0),
    [store.historic, baselineA.employmentCosts]
  )
  
  // Memoize historic Net Income for MDs values (2016-2025)
  const netIncomeForMDsHistoric = useMemo(() => historicYears.map((year, index) => {
    if (year === 2025) {
      // Use scenario-derived 2025 value to avoid discontinuity
      return calculateNetIncomeForMDs(2025, 'A')
    }
    // Historic values from the yearly data grid
    const historicValues = [
      1969715, // 2016
      2022908, // 2017  
      2036882, // 2018
      2107215, // 2019
      2136804, // 2020
      2250440, // 2021
      2118718, // 2022
      2549332, // 2023
      2583878, // 2024
    ]
    return historicValues[index] || 0
  }), [historicYears, store.scenarioA.future])

  // Memoize historic Staff Employment Costs values (2016-2025)
  const staffEmploymentHistoric = useMemo(() => historicYears.map((year, index) => {
    if (year === 2025) {
      // Use scenario-derived 2025 staff employment cost to avoid discontinuity
      return baselineA.staffEmployment
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
  }), [historicYears, baselineA.staffEmployment])

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

  // Memoize employment costs calculations for scenarios
  const scAEmployment = useMemo(() => store.scenarioA.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  }), [store.scenarioA.future])
  
  const scBEmployment = useMemo(() => store.scenarioB?.future.map(f => {
    const md = f.physicians.reduce((s, e) => {
      if (e.type === 'employee') return s + (e.salary ?? 0)
      if (e.type === 'newEmployee') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'employeeToPartner') return s + (e.salary ?? 0) * getEmployeePortionOfYear(e)
      if (e.type === 'partnerToRetire') return s + (e.buyoutCost ?? 0)
      return s
    }, 0)
    const delayedW2 = f.physicians.reduce((s, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, f.year)
        return s + delayed.amount + delayed.taxes
      }
      return s
    }, 0)
    return md + f.nonMdEmploymentCosts + delayedW2
  }) || [], [store.scenarioB?.future])
  
  const scANet = useMemo(() => store.scenarioA.future.map(f => {
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
  }), [store.scenarioA.future])
  
  const scBNet = useMemo(() => {
    if (!store.scenarioB?.future) return []
    
    // Check if Scenario B has 2025 in its future array
    const has2025 = store.scenarioB.future.some(f => f.year === 2025)
    
    let result: number[]
    if (has2025) {
      // Scenario B has 2025-2030 (modular projection scenario)
      result = store.scenarioB.future.map(f => {
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
        const totalIncome = getTotalIncome(f)
        const netIncome = totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
        return netIncome
      })
    } else {
      // Scenario B only has 2026-2030 (legacy scenario) - add 2025 baseline
      const baseline2025 = baselineA.netIncome
      const projectedYears = store.scenarioB.future.map(f => {
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
        const totalIncome = getTotalIncome(f)
        const netIncome = totalIncome - f.nonEmploymentCosts - f.nonMdEmploymentCosts - f.miscEmploymentCosts - f.locumCosts - md - buyouts - delayedW2
        
        // Debug specific year calculations
        if (f.year === 2030) {
          logger.debug('CHART', '📊 2030 Net Income Calculation (Legacy B):', {
            year: f.year,
            totalIncome,
            nonEmploymentCosts: f.nonEmploymentCosts,
            nonMdEmploymentCosts: f.nonMdEmploymentCosts,
            miscEmploymentCosts: f.miscEmploymentCosts,
            locumCosts: f.locumCosts,
            mdCosts: md,
            buyouts,
            delayedW2,
            netIncome,
            isNaN: isNaN(netIncome),
            isFinite: isFinite(netIncome)
          })
        }
        
        return netIncome
      })
      result = [baseline2025, ...projectedYears]
    }
    
    logger.debug('CHART', 'Scenario B Net Income', {
      years: store.scenarioB.future.map(f => f.year),
      values: result,
      has2025
    })
    return result
  }, [store.scenarioB?.future, baselineA.netIncome])
  
  // Memoize Net Income for MDs calculations
  const scANetIncomeForMDs = useMemo(() => 
    [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
      return calculateNetIncomeForMDs(year, 'A')
    }),
    [store.scenarioA.future]
  )
  
  const scBNetIncomeForMDs = useMemo(() => {
    if (!store.scenarioBEnabled || !store.scenarioB) return []
    // For 2025, use Scenario A's value (shared baseline)
    const value2025 = scANetIncomeForMDs[0]
    // For 2026+, use Scenario B's calculations
    const values2026Plus = store.scenarioB.future.filter(f => f.year !== 2025).map(f => calculateNetIncomeForMDs(f.year, 'B'))
    return [value2025, ...values2026Plus]
  }, [store.scenarioBEnabled, store.scenarioB?.future, scANetIncomeForMDs])

  // Memoize Staff Employment Costs calculations
  const scAStaffEmployment = useMemo(() => 
    [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)].map(year => {
      if (year === 2025) {
        const fy2025 = store.scenarioA.future.find(f => f.year === 2025)
        return fy2025 ? ((fy2025.nonMdEmploymentCosts ?? 0) + (fy2025.miscEmploymentCosts ?? 0)) : computeDefaultNonMdEmploymentCosts(2025)
      }
      const fy = store.scenarioA.future.find(f => f.year === year)
      return (fy?.nonMdEmploymentCosts ?? 0) + (fy?.miscEmploymentCosts ?? 0)
    }),
    [store.scenarioA.future]
  )
  
  const scBStaffEmployment = useMemo(() => {
    if (!store.scenarioBEnabled || !store.scenarioB) return []
    // For 2025, use Scenario A's value (shared baseline)
    const value2025 = scAStaffEmployment[0]
    // For 2026+, use Scenario B's calculations
    const values2026Plus = store.scenarioB.future.filter(f => f.year !== 2025).map(f => {
      return (f.nonMdEmploymentCosts ?? 0) + (f.miscEmploymentCosts ?? 0)
    })
    return [value2025, ...values2026Plus]
  }, [store.scenarioBEnabled, store.scenarioB?.future, scAStaffEmployment])

  // Calculate chart height based on container width and aspect ratio
  const ASPECT_RATIO = 0.5 // Height = 50% of width (same as DetailedChart default)
  const MIN_HEIGHT = 400 // Minimum height to prevent collapse
  const DEFAULT_HEIGHT = 700 // Default height when width is unknown
  
  const chartHeight = containerWidth !== null 
    ? Math.max(MIN_HEIGHT, Math.round(containerWidth * ASPECT_RATIO))
    : DEFAULT_HEIGHT
  
  logger.debug('CHART', '📏 [HistoricChart] Height calculation:', {
    containerWidth,
    aspectRatio: ASPECT_RATIO,
    calculatedHeight: containerWidth !== null ? Math.round(containerWidth * ASPECT_RATIO) : null,
    chartHeight,
    minHeight: MIN_HEIGHT,
    usingDefault: containerWidth === null
  })

  // Track chartHeight changes
  useEffect(() => {
    logger.debug('CHART', '⚡ [HistoricChart] chartHeight changed:',  chartHeight)
  }, [chartHeight])

  // Memoize layout to ensure it updates when chartHeight changes
  const chartLayout = useMemo(() => {
    logger.debug('CHART', '📋 [HistoricChart] Creating new layout with height:',  chartHeight)
    return {
      title: { text: 'Historic and Projected Totals', font: { weight: 700 } },
      dragmode: false as any,
      legend: { 
        orientation: 'v', 
        x: 1.02, 
        xanchor: 'left', 
        y: 0.5, 
        yanchor: 'middle', 
        bordercolor: '#e5e7eb', 
        borderwidth: 1, 
        tracegroupgap: 0 
      },
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
      autosize: true,
      height: chartHeight,
    }
  }, [chartHeight])

  // Loading indicator component
  if (!isDataReady) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minWidth: 600,
          maxWidth: 1400,
          margin: '0 auto',
          borderRadius: 8,
          background: '#f9fafb',
          padding: 12,
        }}
      >
        <div style={{ 
          border: '1px solid #d1d5db', 
          borderRadius: 6, 
          background: '#ffffff', 
          padding: 4, 
          boxShadow: '0 6px 10px rgba(0, 0, 0, 0.15)',
          height: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #1976d2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ 
            fontSize: 16, 
            color: '#6b7280',
            fontWeight: 500
          }}>
            Loading chart data and projections...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // Don't render chart until we have the container width to prevent layout shift
  if (containerWidth === null) {
    const aspectRatioPercent = (ASPECT_RATIO * 100).toFixed(2)
    
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minWidth: 600,
          maxWidth: 1400,
          margin: '0 auto',
          borderRadius: 8,
          background: '#f9fafb',
          padding: 12,
        }}
      >
        <div style={{ 
          border: '1px solid #d1d5db', 
          borderRadius: 6, 
          background: '#ffffff', 
          padding: 4, 
          boxShadow: '0 6px 10px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Aspect ratio spacer - maintains height based on width */}
          <div style={{ paddingBottom: `${aspectRatioPercent}%` }} />
          {/* Content overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ color: '#666', fontSize: 14 }}>Loading chart...</div>
          </div>
        </div>
      </div>
    )
  }

  logger.debug('CHART', '🎨 [HistoricChart] Rendering chart with:', {
    containerWidth,
    chartHeight,
    isDataReady,
    hasLayoutMemoized: !!chartLayout,
    layoutHeight: chartLayout.height,
    styleHeight: chartHeight
  })

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minWidth: 600,
        maxWidth: 1400,
        margin: '0 auto',
        //border: '2px solid #d1d5db',
        borderRadius: 8,
        background: '#f9fafb',
        padding: 12,
      }}
    >
      <div style={{ border: '1px solid #d1d5db', borderRadius: 6, background: '#ffffff', padding: 4, boxShadow: '0 6px 10px rgba(0, 0, 0, 0.15)' }}>
      <Plot
        data={(() => {
          const traces: any[] = []
          
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
            [baselineA.totalIncome, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))],
            store.scenarioBEnabled && store.scenarioB ? [baselineB!.totalIncome, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => getTotalIncome(f))] : null,
            baselineA.totalIncome,
            baselineB ? baselineB.totalIncome : null,
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
            [
              baselineA.netIncome,
              ...scANet.slice(1)
            ],
            store.scenarioBEnabled && store.scenarioB ? [
              baselineB!.netIncome,
              ...scBNet.slice(1)
            ] : null,
            baselineA.netIncome,
            baselineB ? baselineB.netIncome : null,
            'net'
          )
          
          // Debug logging for Net Income traces
          if (store.scenarioBEnabled && store.scenarioB) {
            const scenarioAYears = [2025, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.year)]
            const scenarioAValues = [baselineA.netIncome, ...scANet.slice(1)]
            const scenarioBYears = [2025, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.year)]
            const scenarioBValues = [baselineB!.netIncome, ...scBNet.slice(1)]
            
            logger.debug('CHART', '📊 Net Income Trace Debug:', {
              scenarioAYears,
              scenarioAValues,
              scenarioBYears,
              scenarioBValues,
              scBNetLength: scBNet.length,
              scBNetSlice1: scBNet.slice(1),
              has2030InScenarioB: scenarioBYears.includes(2030),
              scenarioB2030Value: scenarioBValues[scenarioBYears.indexOf(2030)]
            })
          }

          createTraceGroup(
            'Employment Costs',
            '#6b7280',
            employmentHistoric,
            [baselineA.employmentCosts, ...scAEmployment.slice(1)],
            store.scenarioBEnabled && store.scenarioB ? [baselineB!.employmentCosts, ...scBEmployment.slice(1)] : null,
            baselineA.employmentCosts,
            baselineB ? baselineB.employmentCosts : null,
            'employment'
          )

          createTraceGroup(
            'Staff Employment Costs',
            '#f57c00',
            staffEmploymentHistoric,
            scAStaffEmployment,
            store.scenarioBEnabled && store.scenarioB ? scBStaffEmployment : null,
            baselineA.staffEmployment,
            store.scenarioBEnabled && store.scenarioB ? baselineB!.staffEmployment : null,
            'staffemp'
          )

          createTraceGroup(
            'Non-Employment Costs',
            '#e65100',
            costHistoric,
            [baselineA.nonEmploymentCosts, ...store.scenarioA.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)],
            store.scenarioBEnabled && store.scenarioB ? [baselineB!.nonEmploymentCosts, ...store.scenarioB.future.filter(f => f.year !== 2025).map(f => f.nonEmploymentCosts)] : null,
            baselineA.nonEmploymentCosts,
            baselineB ? baselineB.nonEmploymentCosts : null,
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
        layout={chartLayout as any}
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
        style={{ width: '100%', height: chartHeight }}
      />
      </div>
    </div>
  )
}