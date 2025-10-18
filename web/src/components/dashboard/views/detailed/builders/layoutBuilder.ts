import type { YTDPoint } from '../../../../../historical_data/therapyIncomeParser'
import type { IncomeMode } from '../../../shared/types'
import { BAR_CONFIG, CHART_CONFIG } from '../config/chartConfig'
import { getTickConfiguration } from '../config/tickConfig'

interface LayoutBuilderProps {
  chartMode: 'line' | 'bar'
  timeframe: 'year' | 'quarter' | 'month'
  showCombined: boolean
  isNormalized: boolean
  processedCurrentData: YTDPoint[]
  is2025Visible: boolean
  staticLineTraces: any[]
  currentX: string[]
  currentY: number[]
  currentPeriod?: { year: number, quarter?: number, month?: number }
  incomeMode?: IncomeMode
  selectedYears?: number[]
  combineStatistic?: 'mean' | 'median' | null
  combineError?: 'std' | 'ci' | null
  visibleSites?: { lacey: boolean, centralia: boolean, aberdeen: boolean }
  unfilteredCurrentData?: YTDPoint[]
  showAllMonths?: boolean
  isMobile?: boolean
}

// Helper function to calculate required right margin based on radar position
// Returns the margin in pixels needed to accommodate the radar animation
const calculateRadarMargin = (
  processedCurrentData: YTDPoint[],
  staticLineTraces: any[],
  currentX: string[],
  unfilteredCurrentData?: YTDPoint[]
): number => {
  if (processedCurrentData.length === 0) return CHART_CONFIG.margins.rightDefault

  // Check if radar would actually be shown - radar only shows when the last actual point is in view
  // This matches the logic in buildPulsingTraces
  const actualCurrentData = unfilteredCurrentData || processedCurrentData
  const lastActualPoint = actualCurrentData[actualCurrentData.length - 1]
  const isLastPointInView = processedCurrentData.some(p => p.monthDay === lastActualPoint.monthDay)
  
  // If radar wouldn't be shown, use default margin
  if (!isLastPointInView) return CHART_CONFIG.margins.rightDefault

  // Get all x-values from the chart
  const allXValues = [
    ...staticLineTraces.flatMap(trace => trace.x || []),
    ...currentX
  ].filter(x => x !== undefined)

  if (allXValues.length === 0) return CHART_CONFIG.margins.rightDefault

  // Get unique sorted x-values
  const uniqueXValues = [...new Set(allXValues)].sort()
  const lastCurrentPoint = processedCurrentData[processedCurrentData.length - 1]

  // Find the index of the current point
  const currentPointIndex = uniqueXValues.indexOf(lastCurrentPoint.monthDay)
  if (currentPointIndex === -1) return CHART_CONFIG.margins.rightDefault

  const maxIndex = uniqueXValues.length - 1

  // Distance from current point to the right edge (in category units)
  // All modes now use standard 0.5 padding on each side
  // So if current point is at maxIndex, there's 0.5 units to the right edge
  const pointsFromEdge = maxIndex - currentPointIndex + 0.5

  // If radar is far from edge, use default margin
  if (pointsFromEdge > 3) return CHART_CONFIG.margins.rightDefault

  // Maximum radar radius is 30px
  const maxRadarRadius = 30

  // Estimate pixels per data point based on the visible range
  // Range is [minIndex - 0.5, maxIndex + 0.5], so total range is maxIndex + 1
  const estimatedChartWidth = 650
  const visibleRange = maxIndex + 1
  const pixelsPerPoint = visibleRange > 0 ? estimatedChartWidth / visibleRange : 0

  // Calculate distance from radar center to right edge in pixels
  // Add the 0.5 category unit padding that exists to the right
  const distanceToEdge = pointsFromEdge * pixelsPerPoint

  // Calculate how much margin we need beyond the default
  const neededMargin = Math.max(0, maxRadarRadius - distanceToEdge)

  // Return default margin plus any extra needed for radar
  return CHART_CONFIG.margins.rightDefault + Math.ceil(neededMargin)
}

export const buildChartLayout = ({
  chartMode,
  timeframe,
  showCombined,
  isNormalized,
  processedCurrentData,
  is2025Visible,
  staticLineTraces,
  currentX,
  currentY,
  currentPeriod,
  incomeMode = 'total',
  selectedYears = [],
  combineStatistic = null,
  combineError = null,
  visibleSites,
  unfilteredCurrentData,
  showAllMonths = false,
  isMobile = false
}: LayoutBuilderProps) => {
  const getYAxisConfig = () => {
    // In mobile LINE mode, display dollar values in millions (e.g., "$1.5M")
    // For bar charts, use compact notation instead
    const useMillionsFormat = isMobile && chartMode === 'line' && !isNormalized
    
    const baseConfig = {
      tickprefix: isNormalized ? '' : (useMillionsFormat ? '$' : '$'),
      ticksuffix: isNormalized ? '%' : (useMillionsFormat ? 'M' : ''),
      separatethousands: !isNormalized && !isMobile,
      tickformat: isNormalized ? '.1f' : (useMillionsFormat ? '.1f' : (isMobile ? '~s' : ',.0f')),
      rangemode: 'tozero' as const,
      automargin: true,
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
    }

    // Helper function to generate custom tick values and labels for mobile LINE mode
    const generateMobileTicks = (minVal: number, maxVal: number) => {
      if (!isMobile || isNormalized || chartMode !== 'line') return {}

      // Convert to millions
      const minM = minVal / 1000000
      const maxM = maxVal / 1000000
      const rangeM = maxM - minM

      // Determine appropriate tick interval - smaller intervals for month mode
      let tickInterval: number
      if (timeframe === 'month') {
        // For month mode, use finer granularity to show more grid lines
        if (rangeM <= 0.3) tickInterval = 0.05
        else if (rangeM <= 0.6) tickInterval = 0.1
        else if (rangeM <= 1.5) tickInterval = 0.2
        else if (rangeM <= 3) tickInterval = 0.5
        else tickInterval = 1
      } else {
        // For year/quarter mode, use standard intervals
        if (rangeM <= 2) tickInterval = 0.2
        else if (rangeM <= 5) tickInterval = 0.5
        else if (rangeM <= 10) tickInterval = 1
        else if (rangeM <= 20) tickInterval = 2
        else tickInterval = 5
      }

      // Generate tick positions in millions
      const firstTick = Math.floor(minM / tickInterval) * tickInterval
      const ticks: number[] = []
      for (let tick = firstTick; tick <= maxM + tickInterval; tick += tickInterval) {
        ticks.push(tick * 1000000) // Convert back to actual values
      }

      // Generate tick labels in millions format with $ prefix and M suffix
      // Skip labeling 0 to avoid crowding
      // Use 2 decimals for month mode with fine intervals, 1 decimal otherwise
      const decimals = (timeframe === 'month' && tickInterval <= 0.1) ? 2 : 1
      const tickLabels = ticks.map(val => val === 0 ? '' : `$${(val / 1000000).toFixed(decimals)}M`)

      return {
        tickmode: 'array' as const,
        tickvals: ticks,
        ticktext: tickLabels
      }
    }

    if (chartMode === 'line') {
      const needsRadarBuffer = processedCurrentData.length > 0 && is2025Visible

      // In per-site mode, filter traces by visibility for range calculation
      const tracesToUse = (incomeMode === 'per-site' && visibleSites)
        ? staticLineTraces.filter(trace => {
            // Trace is visible if visible property is true or 'legendonly' (not false or undefined)
            // But we also need to check opacity since invisible sites have opacity: 0.2
            const isVisible = trace.visible === true || trace.visible === 'legendonly'
            const hasFullOpacity = trace.opacity === 1 || trace.opacity === undefined
            return isVisible && hasFullOpacity
          })
        : staticLineTraces

      // Collect all y values from visible traces
      const traceYValues = tracesToUse.flatMap(trace => trace.y || [])
        .filter(y => typeof y === 'number') as number[]

      // Add current year data if 2025 is visible (but only for total income mode)
      // In per-site mode, current year site data is already in the traces
      const allYValues = (needsRadarBuffer && incomeMode !== 'per-site')
        ? [...traceYValues, ...currentY].filter(y => typeof y === 'number') as number[]
        : traceYValues

      if (allYValues.length > 0) {
        const maxY = Math.max(...allYValues)
        const minY = Math.min(...allYValues)
        const dataRange = maxY - minY

        // Add buffer only when radar is active
        const buffer = needsRadarBuffer ? dataRange * 0.05 : dataRange * 0.05

        const rangeMin = Math.max(0, minY - buffer * 0.1)
        const rangeMax = maxY + buffer

        return {
          ...baseConfig,
          ...generateMobileTicks(rangeMin, rangeMax),
          autorange: false,
          range: [rangeMin, rangeMax]
        }
      }
    }

    // For bar charts, use autorange with base config
    // The baseConfig already has the mobile formatting ($XM) applied
    return {
      ...baseConfig,
      autorange: true
    }
  }

  const getMonthAbbreviation = () => {
    if (currentPeriod?.month) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return monthNames[currentPeriod.month - 1]
    }
    return ''
  }

  const getQuarterRange = () => {
    if (currentPeriod?.quarter) {
      const quarter = currentPeriod.quarter
      const quarterMap = {
        1: 'Jan - Mar',
        2: 'Apr - Jun',
        3: 'Jul - Sep',
        4: 'Oct - Dec'
      }
      return `${quarterMap[quarter as keyof typeof quarterMap]}`
    }
    return ''
  }

  const getXAxisConfig = () => {
    // Special handling for SINGLE month bar mode - no title, horizontal labels, larger/bold font
    // Only apply these changes when viewing a single month (showAllMonths = false OR mobile combined mode)
    const isSingleMonthBarMode = chartMode === 'bar' && timeframe === 'month' && (!showAllMonths || (isMobile && showCombined))
    
    // Map abbreviated month names to full month names for single month bar mode display
    const monthMapping: Record<string, string> = {
      'Jan': 'January',
      'Feb': 'February',
      'Mar': 'March',
      'Apr': 'April',
      'May': 'May',
      'Jun': 'June',
      'Jul': 'July',
      'Aug': 'August',
      'Sep': 'September',
      'Oct': 'October',
      'Nov': 'November',
      'Dec': 'December'
    }
    
    const baseConfig = {
      title: {
        text: '' // No x-axis label in any mode - using annotation instead for mobile monthly
      },
      type: 'category' as const,
      tickangle: (chartMode === 'bar' && (timeframe === 'year' && showCombined || (timeframe === 'month' && !showAllMonths))) ? 0 : -45,
      tickmode: isSingleMonthBarMode ? 'array' as const : (chartMode === 'line' ? 'array' as const : 'auto' as const),
      tickfont: isSingleMonthBarMode ? { size: 16, weight: 700, family: 'Inter, system-ui, Arial' } : undefined,
      // For single month bar mode, show full month names
      tickvals: isSingleMonthBarMode ? Object.keys(monthMapping) : undefined,
      ticktext: isSingleMonthBarMode ? Object.values(monthMapping) : undefined,
      ...(chartMode === 'line' ? getTickConfiguration(timeframe, currentPeriod, isMobile) : {})
    }

    // Set x-axis range based on timeframe and mode
    if (chartMode === 'line') {
      // For quarter and month modes, add right padding for radar animation
      if (timeframe === 'quarter' && currentPeriod?.quarter && processedCurrentData.length > 0 && is2025Visible) {
        // Find the data range for this quarter
        const quarterData = processedCurrentData
        if (quarterData.length > 0) {
          const allXValues = [
            ...staticLineTraces.flatMap(trace => trace.x || []),
            ...quarterData.map(p => p.monthDay)
          ].filter(x => x !== undefined)

          const uniqueXValues = [...new Set(allXValues)].sort()
          const minIndex = 0
          const maxIndex = uniqueXValues.length - 1

          // Standard padding (0.5 on each side) - margin handles radar
          return {
            ...baseConfig,
            automargin: true,
            autorange: false,
            range: [minIndex - 0.5, maxIndex + 0.5]
          }
        }

        return {
          ...baseConfig,
          automargin: true,
          autorange: true
        }
      } else if (timeframe === 'month' && currentPeriod?.month && processedCurrentData.length > 0 && is2025Visible) {
        // Find the data range for this month
        const monthData = processedCurrentData
        if (monthData.length > 0) {
          const allXValues = [
            ...staticLineTraces.flatMap(trace => trace.x || []),
            ...monthData.map(p => p.monthDay)
          ].filter(x => x !== undefined)

          const uniqueXValues = [...new Set(allXValues)].sort()
          const minIndex = 0
          const maxIndex = uniqueXValues.length - 1

          // Standard padding (0.5 on each side) - margin handles radar
          return {
            ...baseConfig,
            automargin: true,
            autorange: false,
            range: [minIndex - 0.5, maxIndex + 0.5]
          }
        }

        return {
          ...baseConfig,
          automargin: true,
          autorange: true
        }
      } else if (timeframe === 'quarter' && currentPeriod?.quarter) {
        // Quarter mode without radar - just autorange
        return {
          ...baseConfig,
          automargin: true,
          autorange: true
        }
      } else if (timeframe === 'month' && currentPeriod?.month) {
        // Month mode without radar - just autorange
        return {
          ...baseConfig,
          automargin: true,
          autorange: true
        }
      } else if (timeframe === 'year' && processedCurrentData.length > 0 && is2025Visible) {
        // For year mode, fix x-axis range to prevent shrinking during radar animation
        const allXValues = [
          ...staticLineTraces.flatMap(trace => trace.x || []),
          ...currentX
        ].filter(x => x !== undefined)
        
        if (allXValues.length > 0) {
          // For categorical axis, we need to set the range as indices
          // Find the min and max indices, then add some padding
          const uniqueXValues = [...new Set(allXValues)].sort()
          const minIndex = 0
          const maxIndex = uniqueXValues.length - 1
          
          return {
            ...baseConfig,
            automargin: true,
            autorange: false,
            // Set fixed range with some padding on the right for radar animation
            range: [minIndex - 0.5, maxIndex + 0.5] // Add 0.5 padding on each side
          }
        }
      }
    }

    // For year combined bar mode, manually set range to bring categories closer
    if (chartMode === 'bar' && timeframe === 'year' && showCombined) {
      return {
        ...baseConfig,
        automargin: true,
        autorange: false,
        range: [-1.9, 2.9] // Tighten range around the two categories (0 and 1)
      }
    }

    // For single month bar mode, constrain to show only one month category
    if (isSingleMonthBarMode) {
      return {
        ...baseConfig,
        automargin: true,
        autorange: false,
        range: [-0.5, 0.5] // Show only the single month at index 0
      }
    }

    // For single quarter bar mode in mobile, constrain to show only one quarter category
    if (chartMode === 'bar' && timeframe === 'quarter' && isMobile) {
      return {
        ...baseConfig,
        automargin: true,
        autorange: false,
        range: [-0.5, 0.5] // Show only the single quarter at index 0
      }
    }

    return {
      ...baseConfig,
      automargin: true
    }
  }

  // Determine if we should show the parenthetical in line mode
  const hasHistoricalYears = selectedYears.length > 0
  const showLineParenthetical = chartMode !== 'line' || (incomeMode === 'per-site') || hasHistoricalYears

  // Build the historical statistic description for bar chart titles
  const getHistoricalDescription = () => {
    if (!showCombined || !combineStatistic) return ''

    const statLabel = combineStatistic === 'mean' ? 'Mean' : 'Median'
    const errorLabel = combineError === 'ci' ? '95% CI' : (combineError === 'std' ? 'σ' : '')

    if (errorLabel) {
      return `: Historical ${statLabel} ± ${errorLabel}`
    }
    return `: Historical ${statLabel}`
  }

  // Get specific timeframe label for line chart titles
  const getTimeframeLabel = () => {
    if (timeframe === 'quarter' && currentPeriod?.quarter) {
      return `Q${currentPeriod.quarter} Comparison`
    } else if (timeframe === 'month' && currentPeriod?.month) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[currentPeriod.month - 1]} Comparison`
    } else if (timeframe === 'year') {
      return 'YTD'
    }
    // Fallback to capitalized timeframe name
    return `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Comparison`
  }

  // Format title for mobile: wrap at colon if needed, or split intelligently
  const formatMobileTitleText = (titleText: string): string => {
    if (!isMobile) return titleText

    // Estimate character width at 13px font size (roughly 7.5px per character for bold Inter)
    const baseCharWidth = 7.5
    //const baseFontSize = 13
    const estimatedWidth = titleText.length * baseCharWidth

    // Assume available width is roughly 280px (minimum mobile width) minus some padding
    const availableWidth = 260

    // If it fits on one line, keep it as-is
    if (estimatedWidth <= availableWidth) {
      return titleText
    }

    // Check if there's a colon - prefer to break after it
    const colonIndex = titleText.indexOf(':')
    if (colonIndex !== -1 && colonIndex > 0) {
      // Replace colon with line break (Plotly uses <br> for line breaks)
      return titleText.substring(0, colonIndex) + ':<br>' + titleText.substring(colonIndex + 1).trim()
    }

    // If no colon, check for opening parenthesis - break before it
    const parenIndex = titleText.indexOf('(')
    if (parenIndex !== -1 && parenIndex > 0) {
      return titleText.substring(0, parenIndex).trim() + '<br>' + titleText.substring(parenIndex)
    }

    // Otherwise, just return as-is and let it wrap naturally (though it may overflow)
    return titleText
  }

  const titleText = chartMode === 'line'
    ? (showLineParenthetical
      ? (isNormalized
        ? `Daily Accumulated Income (${getTimeframeLabel()} - Normalized)`
        : `Daily Accumulated Income (${getTimeframeLabel()})`)
      : 'Daily Accumulated Income (YTD)')
    : (incomeMode === 'per-site'
      ? (isNormalized
        ? `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income by Site${getHistoricalDescription()} (Normalized)`
        : `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income by Site${getHistoricalDescription()}`)
      : (isNormalized
        ? `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts${getHistoricalDescription()} (Normalized)`
        : `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts${getHistoricalDescription()}`))

  // Create period label annotations for mobile line modes
  const periodAnnotations = []

  if (chartMode === 'line' && isMobile) {
    if (timeframe === 'month' && currentPeriod?.month) {
      periodAnnotations.push({
        x: 0.4, // Position at left side of chart
        y: -0.05, // Position at top of chart
        xref: 'paper',
        yref: 'paper',
        text: getMonthAbbreviation(),
        showarrow: false,
        font: {
          size: 16,
          weight: 500,
          family: 'Inter, system-ui, Arial',
          color: '#333333'
        },
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        borderpad: 4
      })
    } else if (timeframe === 'quarter' && currentPeriod?.quarter) {
      periodAnnotations.push({
        x: 0.33, // Position at left side of chart
        y: -0.05, // Position at top of chart
        xref: 'paper',
        yref: 'paper',
        text: getQuarterRange(),
        showarrow: false,
        font: {
          size: 16,
          weight: 500,
          family: 'Inter, system-ui, Arial',
          color: '#333333'
        },
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        borderpad: 4
      })
    }
  }

  return {
    title: {
      text: formatMobileTitleText(titleText),
      font: { size: isMobile ? 13 : 24, weight: 700, family: 'Inter, system-ui, Arial' }
    },
    dragmode: false as any,
    margin: {
      l: isMobile ? 50 : CHART_CONFIG.margins.left,
      r: chartMode === 'bar'
        ? CHART_CONFIG.margins.rightBarMode
        : (chartMode === 'line' && is2025Visible
          ? calculateRadarMargin(processedCurrentData, staticLineTraces, currentX, unfilteredCurrentData)
          : CHART_CONFIG.margins.rightDefault),
      t: isMobile ? 50 : CHART_CONFIG.margins.top,
      b: isMobile && timeframe === 'year' ? 40 : (isMobile && ((timeframe === 'quarter' && chartMode === 'bar' && showCombined) || (timeframe === 'quarter' && chartMode === 'bar')) ? 60 : CHART_CONFIG.margins.bottom),
      autoexpand: false
    },
    annotations: periodAnnotations,
    // Make bars wider and eliminate gaps in bar mode
    bargap: chartMode === 'bar' ? BAR_CONFIG[timeframe][showCombined ? 'combined' : 'individual'].bargap : undefined,
    bargroupgap: chartMode === 'bar' ? BAR_CONFIG[timeframe][showCombined ? 'combined' : 'individual'].bargroupgap : undefined,
    barmode: chartMode === 'bar'
      ? (incomeMode === 'per-site' ? 'stack' as const
        : (timeframe === 'year' && showCombined ? 'stack' as const : 'group' as const))
      : undefined,
    yaxis: getYAxisConfig(),
    xaxis: getXAxisConfig(),
    showlegend: false
  }
}
