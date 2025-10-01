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
  combineError = null
}: LayoutBuilderProps) => {
  const getYAxisConfig = () => {
    const baseConfig = {
      tickprefix: isNormalized ? '' : '$',
      ticksuffix: isNormalized ? '%' : '',
      separatethousands: !isNormalized,
      tickformat: isNormalized ? '.1f' : ',.0f',
      rangemode: 'tozero' as const,
      automargin: true,
    }

    // Add buffer for radar animation when in line mode with 2025 data visible
    if (chartMode === 'line' && processedCurrentData.length > 0 && is2025Visible) {
      // Calculate the data range to add appropriate buffer
      const allYValues = [
        ...staticLineTraces.flatMap(trace => trace.y || []),
        ...currentY
      ].filter(y => typeof y === 'number') as number[]
      
      if (allYValues.length > 0) {
        const maxY = Math.max(...allYValues)
        const minY = Math.min(...allYValues)
        const dataRange = maxY - minY
        
        // Add 5% buffer on top to account for radar animation
        const buffer = dataRange * 0.05
        
        return {
          ...baseConfig,
          autorange: false,
          range: [Math.max(0, minY - buffer * 0.1), maxY + buffer]
        }
      }
    }

    return {
      ...baseConfig,
      autorange: true
    }
  }

  const getXAxisConfig = () => {
    const baseConfig = {
      title: { text: chartMode === 'line' ? 'Date' : (timeframe.charAt(0).toUpperCase() + timeframe.slice(1)) },
      type: 'category' as const,
      tickangle: -45,
      tickmode: chartMode === 'line' ? 'array' as const : 'auto' as const,
      ...(chartMode === 'line' ? getTickConfiguration(timeframe, currentPeriod) : {})
    }

    // Set x-axis range based on timeframe and mode
    if (chartMode === 'line') {
      // For quarter and month modes, add right padding for radar animation
      if (timeframe === 'quarter' && currentPeriod?.quarter && processedCurrentData.length > 0 && is2025Visible) {
        // Find the data range for this quarter to add appropriate padding
        const quarterData = processedCurrentData
        if (quarterData.length > 0) {
          const allXValues = [
            ...staticLineTraces.flatMap(trace => trace.x || []),
            ...quarterData.map(p => p.monthDay)
          ].filter(x => x !== undefined)
          
          const uniqueXValues = [...new Set(allXValues)].sort()
          const minIndex = 0
          const maxIndex = uniqueXValues.length - 1
          
          // Add padding on the right for radar animation
          return {
            ...baseConfig,
            automargin: true,
            autorange: false,
            range: [minIndex - 0.5, maxIndex + 1.5] // Extra padding on right for radar
          }
        }
        
        return {
          ...baseConfig,
          automargin: true,
          autorange: true
        }
      } else if (timeframe === 'month' && currentPeriod?.month && processedCurrentData.length > 0 && is2025Visible) {
        // Find the data range for this month to add appropriate padding
        const monthData = processedCurrentData
        if (monthData.length > 0) {
          const allXValues = [
            ...staticLineTraces.flatMap(trace => trace.x || []),
            ...monthData.map(p => p.monthDay)
          ].filter(x => x !== undefined)
          
          const uniqueXValues = [...new Set(allXValues)].sort()
          const minIndex = 0
          const maxIndex = uniqueXValues.length - 1
          
          // Add padding on the right for radar animation
          return {
            ...baseConfig,
            automargin: true,
            autorange: false,
            range: [minIndex - 0.5, maxIndex + 1.5] // Extra padding on right for radar
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

  return {
    title: {
      text: chartMode === 'line'
        ? (showLineParenthetical
          ? (isNormalized
            ? `Daily Accumulated Income (${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Comparison - Normalized)`
            : `Daily Accumulated Income (${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Comparison)`)
          : 'Daily Accumulated Income (YTD)')
        : (incomeMode === 'per-site'
          ? (isNormalized
            ? `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income by Site${getHistoricalDescription()} (Normalized)`
            : `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income by Site${getHistoricalDescription()}`)
          : (isNormalized
            ? `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts${getHistoricalDescription()} (Normalized)`
            : `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}ly Income Amounts${getHistoricalDescription()}`)),
      font: { weight: 700 }
    },
    dragmode: false as any,
    margin: { 
      l: CHART_CONFIG.margins.left, 
      r: chartMode === 'bar' ? CHART_CONFIG.margins.rightBarMode : (chartMode === 'line' && processedCurrentData.length > 0 && is2025Visible ? CHART_CONFIG.margins.rightLineWithRadar : CHART_CONFIG.margins.rightDefault),
      t: CHART_CONFIG.margins.top, 
      b: CHART_CONFIG.margins.bottom 
    },
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
