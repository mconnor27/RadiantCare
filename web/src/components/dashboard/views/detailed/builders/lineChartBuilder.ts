import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import { HISTORICAL_COLORS, CURRENT_YEAR_COLOR, HISTORICAL_MEAN_COLOR, HISTORICAL_YEAR_LINE_WIDTH, RADAR_CONFIG } from '../config/chartConfig'
import { sortDataChronologically } from '../utils/dataProcessing'

interface LineChartBuilderProps {
  showCombined: boolean
  combinedStats: {
    mean: YTDPoint[]
    upperBound: YTDPoint[]
    lowerBound: YTDPoint[]
  }
  processedHistoricalData: { year: string, data: YTDPoint[] }[]
  processedCurrentData: YTDPoint[]
  projectedIncomeData: YTDPoint[]
  isNormalized: boolean
  is2025Visible: boolean
  timeframe: 'year' | 'quarter' | 'month'
}

export const buildStaticLineTraces = ({
  showCombined,
  combinedStats,
  processedHistoricalData,
  processedCurrentData,
  projectedIncomeData,
  isNormalized,
  is2025Visible,
  timeframe
}: LineChartBuilderProps) => {
  const traces = []
  
  // Combined statistics (when enabled)
  if (showCombined && combinedStats.mean.length > 0) {
    const combinedMeanX = combinedStats.mean.map(p => p.monthDay)
    const combinedMeanY = combinedStats.mean.map(p => p.cumulativeIncome)
    const combinedUpperY = combinedStats.upperBound.map(p => p.cumulativeIncome)
    const combinedLowerY = combinedStats.lowerBound.map(p => p.cumulativeIncome)
    
    traces.push(
      // Standard deviation band (upper)
      {
        x: combinedMeanX,
        y: combinedUpperY,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Mean + 95% CI',
        line: { color: 'rgba(0,0,0,0)' },
        showlegend: false,
        hoverinfo: 'skip' as const
      },
      // Standard deviation band (lower)
      {
        x: combinedMeanX,
        y: combinedLowerY,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Mean - 95% CI',
        line: { color: 'rgba(0,0,0,0)' },
        fill: 'tonexty' as const,
        fillcolor: 'rgba(30,144,255,0.2)',
        showlegend: false,
        hoverinfo: 'skip' as const
      },
      // Mean line
      {
        x: combinedMeanX,
        y: combinedMeanY,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Historical Mean (2016-2024)',
        line: { color: HISTORICAL_MEAN_COLOR, width: 3 },
        hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
      }
    )
  }
  
  // Individual years (when not showing combined)
  if (!showCombined) {
    processedHistoricalData.forEach(({ year, data }, index) => {
      if (data.length > 0) {
        const sortedData = timeframe === 'year' ? sortDataChronologically(data) : data
        const xData = sortedData.map((p: YTDPoint) => p.monthDay)
        const yData = sortedData.map((p: YTDPoint) => p.cumulativeIncome)
        
        traces.push({
          x: xData,
          y: yData,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${year} Therapy Income (7-day avg)`,
          line: { color: HISTORICAL_COLORS[index % HISTORICAL_COLORS.length], width: HISTORICAL_YEAR_LINE_WIDTH },
          hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
        })
      }
    })
  }
  
  // Current Year Data (2025) - always show
  if (processedCurrentData.length > 0) {
    const currentX = processedCurrentData.map(p => p.monthDay)
    const currentY = processedCurrentData.map(p => p.cumulativeIncome)
    
    traces.push({
      x: currentX,
      y: currentY,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Therapy Income (7-day avg)',
      line: { color: CURRENT_YEAR_COLOR, width: 4 },
      visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
      hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
    })
  }

  // Projected Total Income (2025) - dotted green line from last actual data to Dec 31
  if (projectedIncomeData.length > 0) {
    const projectedX = projectedIncomeData.map(p => p.monthDay)
    const projectedY = projectedIncomeData.map(p => p.cumulativeIncome)
    
    traces.push({
      x: projectedX,
      y: projectedY,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Total Income Projection',
      line: { 
        color: '#4CAF50', // Green color
        width: 3,
        dash: 'dot' // Dotted line
      },
      visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
      hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
    })
  }
  
  return traces
}

export const buildPulsingTraces = (
  processedCurrentData: YTDPoint[],
  is2025Visible: boolean,
  pulsePhase: number,
  isNormalized: boolean
) => {
  if (processedCurrentData.length === 0 || !is2025Visible) return []
  
  const currentX = processedCurrentData.map(p => p.monthDay)
  const currentY = processedCurrentData.map(p => p.cumulativeIncome)
  const rings = []
  
  // Create expanding rings with different phases
  for (let i = 0; i < RADAR_CONFIG.rings.count; i++) {
    const phaseOffset = i * RADAR_CONFIG.rings.stagger // Stagger each ring
    const ringPhase = (pulsePhase + phaseOffset) % RADAR_CONFIG.frameCount
    const progress = ringPhase / RADAR_CONFIG.frameCount // 0 to 1
    
    // Each ring expands from small to large and fades out
    const size = RADAR_CONFIG.rings.baseSize + progress * RADAR_CONFIG.rings.maxGrowth
    const opacity = Math.max(0, RADAR_CONFIG.rings.baseOpacity * (1 - progress)) // Fade out as it expands
    
    // Only show ring if it has meaningful opacity
    if (opacity > 0.01) {
      rings.push({
        x: [currentX[currentX.length - 1]],
        y: [currentY[currentY.length - 1]],
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: `Radar Ring ${i}`,
        marker: {
          color: `rgba(46, 125, 50, ${opacity})`,
          size: size,
          line: { color: `rgba(46, 125, 50, ${Math.min(opacity + 0.15, 0.6)})`, width: 1 }
        },
        showlegend: false,
        hoverinfo: 'skip' as const
      })
    }
  }
  
  // Add the solid center marker
  rings.push({
    x: [currentX[currentX.length - 1]],
    y: [currentY[currentY.length - 1]],
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: 'Current Position',
    marker: {
      color: CURRENT_YEAR_COLOR,
      size: RADAR_CONFIG.rings.baseSize,
      line: { color: '#ffffff', width: 1 }
    },
    showlegend: false,
    hovertemplate: isNormalized ? 'Latest: %{x}<br>%{y:.1f}%<extra></extra>' : 'Latest: %{x}<br>$%{y:,}<extra></extra>'
  })
  
  return rings
}
