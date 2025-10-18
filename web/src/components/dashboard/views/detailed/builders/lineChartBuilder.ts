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
  isMobile?: boolean
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
  colorScheme = 'gray',
  isMobile = false
}: LineChartBuilderProps) => {
  const colors = getColorScheme(colorScheme)
  const HISTORICAL_COLORS = colors.historical
  const CURRENT_YEAR_COLOR = colors.current
  const traces = []
  const annotations: any[] = []
  
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

    // Create custom text for hover to preserve Mon-D format
    const hoverText = smoothedMean.map((p: YTDPoint) => {
      const [month, day] = p.monthDay.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[parseInt(month) - 1]
      return `${monthName}-${parseInt(day)}`
    })

    const labelSuffix = combineStatistic === 'median' ? 'Median' : 'Mean'
    const errorLabel = combineError === 'ci' ? '95% CI' : combineError === 'std' ? 'Std Dev' : ''

    // Calculate error margins for customdata if needed
    const errorMargins = combineError
      ? combinedMeanY.map((mean, i) => Math.abs(combinedUpperY[i] - mean))
      : []

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
    const errorSymbol = combineError === 'std' ? '(\u03C3)' : '' // σ symbol in parentheses
    const errorLabelForHover = combineError === 'ci' ? '(95% CI)' : errorSymbol

    traces.push({
      x: combinedMeanX,
      y: combinedMeanY,
      text: hoverText,
      customdata: combineError ? errorMargins : undefined,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: `Historical ${labelSuffix} (2016-2024)`,
      line: { color: HISTORICAL_COLORS[Math.floor(HISTORICAL_COLORS.length / 2)], width: 3 },
      hovertemplate: combineError
        ? (isNormalized
            ? `Historical ${labelSuffix} %{text}<br>%{y:.1f}% ± %{customdata:.1f}% ${errorLabelForHover}<extra></extra>`
            : `Historical ${labelSuffix} %{text}<br>$%{y:,.0f} ± $%{customdata:,.0f} ${errorLabelForHover}<extra></extra>`)
        : (isNormalized
            ? `Historical ${labelSuffix} %{text}<br>%{y:.1f}%<extra></extra>`
            : `Historical ${labelSuffix} %{text}<br>$%{y:,.0f}<extra></extra>`)
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
        // Create custom text for hover to preserve Mon-D format
        const hoverText = smoothedData.map((p: YTDPoint) => {
          const [month, day] = p.monthDay.split('-')
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthName = monthNames[parseInt(month) - 1]
          return `${monthName}-${parseInt(day)}`
        })

        // Reverse index so 2024 (last in array) gets darkest color
        const colorIndex = (HISTORICAL_COLORS.length - 1 - index) % HISTORICAL_COLORS.length
        traces.push({
          x: xData,
          y: yData,
          text: hoverText,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `${year} Therapy Income`,
          line: { color: HISTORICAL_COLORS[colorIndex], width: lineWidth },
          hovertemplate: isNormalized
            ? `${year} %{text}: %{y:.1f}%<extra></extra>`
            : `${year} %{text}: $%{y:,.0f}<extra></extra>`
        })
      }
    })
  }
  
  // Current Year Data (2025) - always show
  if (processedCurrentData.length > 0) {
    const smoothedCurrentData = applySmoothingToYTDData(processedCurrentData, smoothing)
    const currentX = smoothedCurrentData.map(p => p.monthDay)
    const currentY = smoothedCurrentData.map(p => p.cumulativeIncome)
    // Create custom text for hover to preserve Mon-D format
    const currentHoverText = smoothedCurrentData.map((p: YTDPoint) => {
      const [month, day] = p.monthDay.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[parseInt(month) - 1]
      return `${monthName}-${parseInt(day)}`
    })

    traces.push({
      x: currentX,
      y: currentY,
      text: currentHoverText,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Therapy Income',
      line: { color: CURRENT_YEAR_COLOR, width: 4 },
      visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
      hovertemplate: isNormalized
        ? '2025 %{text}: %{y:.1f}%<extra></extra>'
        : '2025 %{text}: $%{y:,.0f}<extra></extra>'
    })

    // Add annotation for current YTD value (last point)
    if (is2025Visible && smoothedCurrentData.length > 0) {
      const lastPoint = smoothedCurrentData[smoothedCurrentData.length - 1]

      // Calculate position of last point in data space to prevent y-axis overlap
      // If the point is close to the left edge, snap annotation to y-axis instead
      const allXValues = traces.flatMap(t => t.x || []).filter(x => x !== undefined)
      const uniqueXValues = [...new Set(allXValues)].sort()
      const lastPointIndex = uniqueXValues.indexOf(lastPoint.monthDay)
      // In mobile mode, be more conservative (30% threshold), otherwise use 15%
      const threshold = isMobile ? 0.30 : 0.15
      const isNearLeftEdge = lastPointIndex < uniqueXValues.length * threshold

      // Format text - always use 2 decimal places for dollar amounts
      const formattedText = isNormalized
        ? `${lastPoint.cumulativeIncome.toFixed(1)}%`
        : `$${(lastPoint.cumulativeIncome / 1000000).toFixed(2)}M`

      annotations.push({
        x: isNearLeftEdge ? 0 : lastPoint.monthDay,
        y: lastPoint.cumulativeIncome,
        xref: isNearLeftEdge ? 'paper' : 'x',
        yref: 'y',
        text: formattedText,
        showarrow: false,
        xanchor: isNearLeftEdge ? 'left' : 'right',
        xshift: isNearLeftEdge ? 2 : -8,
        yshift: isNearLeftEdge ? 24 : 14,
        font: {
          size: 14,
          color: CURRENT_YEAR_COLOR,
          family: 'Arial, sans-serif'
        },
        bgcolor: 'rgba(255, 255, 255, 0)',
        borderpad: 3
      })
    }
  }

  // Projected Total Income (2025) - dotted green line from last actual data to Dec 31
  if (projectedIncomeData.length > 0) {
    // Do NOT smooth projection curves - they should remain as straight lines
    const projectedX = projectedIncomeData.map(p => p.monthDay)
    const projectedY = projectedIncomeData.map(p => p.cumulativeIncome)
    // Create custom text for hover to preserve Mon-D format
    const projectedHoverText = projectedIncomeData.map((p: YTDPoint) => {
      const [month, day] = p.monthDay.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[parseInt(month) - 1]
      return `${monthName}-${parseInt(day)}`
    })

    traces.push({
      x: projectedX,
      y: projectedY,
      text: projectedHoverText,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: '2025 Total Income Projection',
      line: {
        color: CURRENT_YEAR_COLOR, // Red color (ggplot2 default)
        width: 3,
        dash: 'dot' // Dotted line
      },
      visible: (is2025Visible ? true : 'legendonly') as boolean | 'legendonly',
      hovertemplate: isNormalized
        ? '2025 Projected %{text}: %{y:.1f}%<extra></extra>'
        : '2025 Projected %{text}: $%{y:,.0f}<extra></extra>'
    })

    // Add annotation for projected 12-31 value (last point of projection)
    if (is2025Visible && projectedIncomeData.length > 0) {
      const lastPoint = projectedIncomeData[projectedIncomeData.length - 1]

      // Format text - always use 2 decimal places for dollar amounts
      const formattedText = isNormalized
        ? `${lastPoint.cumulativeIncome.toFixed(1)}%`
        : `$${(lastPoint.cumulativeIncome / 1000000).toFixed(2)}M`

      annotations.push({
        x: lastPoint.monthDay,
        y: lastPoint.cumulativeIncome,
        xref: 'x',
        yref: 'y',
        text: formattedText,
        showarrow: false,
        xanchor: 'right',
        xshift: 0,
        yshift: 14,
        font: {
          size: 14,
          color: CURRENT_YEAR_COLOR,
          family: 'Arial, sans-serif'
        },
        bgcolor: 'rgba(255, 255, 255, 0)',
        borderpad: 3
      })
    }
  }

  return { traces, annotations }
}

export const buildPulsingTraces = (
  processedCurrentData: YTDPoint[],
  is2025Visible: boolean,
  pulsePhase: number,
  isNormalized: boolean,
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare' = 'gray',
  unfilteredCurrentData?: YTDPoint[]
) => {
  const colors = getColorScheme(colorScheme)
  const CURRENT_YEAR_COLOR = colors.current
  if (processedCurrentData.length === 0 || !is2025Visible) return []

  // Use unfiltered data to find the true last point, or fall back to processed data
  const actualCurrentData = unfilteredCurrentData || processedCurrentData
  const lastActualPoint = actualCurrentData[actualCurrentData.length - 1]

  // Check if the last actual data point is in the processed (filtered) data
  const isLastPointInView = processedCurrentData.some(p => p.monthDay === lastActualPoint.monthDay)
  if (!isLastPointInView) return [] // Don't show radar if latest data is outside current timeframe

  // Find the corresponding processed point (for proper normalization/period values)
  const lastPoint = processedCurrentData.find(p => p.monthDay === lastActualPoint.monthDay) || processedCurrentData[processedCurrentData.length - 1]

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
        x: [lastActualPoint.monthDay],
        y: [lastPoint.cumulativeIncome],
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
    x: [lastActualPoint.monthDay],
    y: [lastPoint.cumulativeIncome],
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: 'Current Position',
    marker: {
      color: CURRENT_YEAR_COLOR,
      size: RADAR_CONFIG.rings.baseSize,
      line: { color: '#ffffff', width: 1 }
    },
    showlegend: false,
    hovertemplate: isNormalized ? 'Latest: %{x}<br>%{y:.1f}%<extra></extra>' : 'Latest: %{x}<br>$%{y:,.0f}<extra></extra>'
  })
  
  return rings
}
