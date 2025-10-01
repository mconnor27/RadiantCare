import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import { HISTORICAL_YEAR_LINE_WIDTH, RADAR_CONFIG, getColorScheme } from '../config/chartConfig'
import { sortDataChronologically } from '../utils/dataProcessing'
import { applySmoothingToYTDData } from '../../../shared/splineSmoothing'

// Helper function to convert hex color to RGB values
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

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
  smoothing: number
  combineStatistic?: 'mean' | 'median' | null
  combineError?: 'std' | 'ci' | null
  selectedYears?: number[]
  colorScheme?: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'
}

export const buildStaticLineTraces = ({
  showCombined,
  combinedStats,
  processedHistoricalData,
  processedCurrentData,
  projectedIncomeData,
  isNormalized,
  is2025Visible,
  timeframe,
  smoothing,
  combineStatistic = null,
  combineError = null,
  selectedYears = [],
  colorScheme = 'gray'
}: LineChartBuilderProps) => {
  const colors = getColorScheme(colorScheme)
  const HISTORICAL_COLORS = colors.historical
  const CURRENT_YEAR_COLOR = colors.current
  const traces = []
  
  // Combined statistics (when enabled)
  if (showCombined && combinedStats.mean.length > 0) {
    // Apply smoothing to combined statistics
    const smoothedMean = applySmoothingToYTDData(combinedStats.mean, smoothing)
    const smoothedUpper = applySmoothingToYTDData(combinedStats.upperBound, smoothing)
    const smoothedLower = applySmoothingToYTDData(combinedStats.lowerBound, smoothing)
    
    const combinedMeanX = smoothedMean.map(p => p.monthDay)
    const combinedMeanY = smoothedMean.map(p => p.cumulativeIncome)
    const combinedUpperY = smoothedUpper.map(p => p.cumulativeIncome)
    const combinedLowerY = smoothedLower.map(p => p.cumulativeIncome)
    
    const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
    const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'Std Dev' : ''
    
    // Only add error bands if combineError is not null
    if (combineError) {
      traces.push(
        // Error band (upper)
        {
          x: combinedMeanX,
          y: combinedUpperY,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${labelSuffix} + ${errorLabel}`,
          line: { color: 'rgba(0,0,0,0)' },
          showlegend: false,
          hoverinfo: 'skip' as const
        },
        // Error band (lower)
        {
          x: combinedMeanX,
          y: combinedLowerY,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${labelSuffix} - ${errorLabel}`,
          line: { color: 'rgba(0,0,0,0)' },
          fill: 'tonexty' as const,
          fillcolor: `rgba(${hexToRgb(HISTORICAL_COLORS[Math.floor(HISTORICAL_COLORS.length / 2)])}, 0.2)`,
          showlegend: false,
          hoverinfo: 'skip' as const
        }
      )
    }
    
    // Mean/Median line (always shown when showCombined is true)
    traces.push({
      x: combinedMeanX,
      y: combinedMeanY,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: `Historical ${labelSuffix} (2016-2024)`,
      line: { color: HISTORICAL_COLORS[Math.floor(HISTORICAL_COLORS.length / 2)], width: 3 },
      hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
    })
  }
  
  // Individual years (when not showing combined)
  if (!showCombined) {
    // Use thicker line if only one year is selected
    const lineWidth = selectedYears.length === 1 ? 3 : HISTORICAL_YEAR_LINE_WIDTH

    processedHistoricalData.forEach(({ year, data }, index) => {
      if (data.length > 0) {
        const sortedData = timeframe === 'year' ? sortDataChronologically(data) : data
        const smoothedData = applySmoothingToYTDData(sortedData, smoothing)
        const xData = smoothedData.map((p: YTDPoint) => p.monthDay)
        const yData = smoothedData.map((p: YTDPoint) => p.cumulativeIncome)

        // Reverse index so 2024 (last in array) gets darkest color
        const colorIndex = (HISTORICAL_COLORS.length - 1 - index) % HISTORICAL_COLORS.length
        traces.push({
          x: xData,
          y: yData,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${year} Therapy Income`,
          line: { color: HISTORICAL_COLORS[colorIndex], width: lineWidth },
          hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
        })
      }
    })
  }
  
  // Current Year Data (2025) - always show
  if (processedCurrentData.length > 0) {
    const smoothedCurrentData = applySmoothingToYTDData(processedCurrentData, smoothing)
    const currentX = smoothedCurrentData.map(p => p.monthDay)
    const currentY = smoothedCurrentData.map(p => p.cumulativeIncome)
    
    traces.push({
      x: currentX,
      y: currentY,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Therapy Income',
      line: { color: CURRENT_YEAR_COLOR, width: 4 },
      visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
      hovertemplate: isNormalized ? '%{x}<br>%{y:.1f}%<extra></extra>' : '%{x}<br>$%{y:,}<extra></extra>'
    })
  }

  // Projected Total Income (2025) - dotted green line from last actual data to Dec 31
  if (projectedIncomeData.length > 0) {
    // Do NOT smooth projection curves - they should remain as straight lines
    const projectedX = projectedIncomeData.map(p => p.monthDay)
    const projectedY = projectedIncomeData.map(p => p.cumulativeIncome)
    
    traces.push({
      x: projectedX,
      y: projectedY,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Total Income Projection',
      line: { 
        color: CURRENT_YEAR_COLOR, // Red color (ggplot2 default)
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
  isNormalized: boolean,
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare' = 'gray'
) => {
  const colors = getColorScheme(colorScheme)
  const CURRENT_YEAR_COLOR = colors.current
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
          color: `rgba(${hexToRgb(CURRENT_YEAR_COLOR)}, ${opacity})`,
          size: size,
          line: { color: `rgba(${hexToRgb(CURRENT_YEAR_COLOR)}, ${Math.min(opacity + 0.15, 0.6)})`, width: 1 }
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
