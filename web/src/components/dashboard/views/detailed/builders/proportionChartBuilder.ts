import {
  parseTherapyIncome2016,
  parseTherapyIncome2017,
  parseTherapyIncome2018,
  parseTherapyIncome2019,
  parseTherapyIncome2020,
  parseTherapyIncome2021,
  parseTherapyIncome2022,
  parseTherapyIncome2023,
  parseTherapyIncome2024
} from '../../../../../historical_data/therapyIncomeParser'
import {
  getSiteMonthTotals,
  estimateSiteBreakdownForYear
} from '../../../../../historical_data/siteIncomeParser'
import { getSiteColors } from '../config/chartConfig'

// Monthly proportion data structure
export interface MonthlyProportionData {
  year: number
  month: number // 1-12
  monthName: string
  laceyPercent: number
  centraliaPercent: number
  aberdeenPercent: number
  totalIncome: number
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const monthNameToIndex: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
}

// Generate monthly proportion data from 2016 to present (uses real monthly site data when available)
export function buildProportionData(selectedYears: number[] = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]): MonthlyProportionData[] {
  const results: MonthlyProportionData[] = []

  // Historical totals by year (for fallback when no site data available)
  const historicalParsers: Record<number, () => { date: string; cumulativeIncome: number }[]> = {
    2016: parseTherapyIncome2016,
    2017: parseTherapyIncome2017,
    2018: parseTherapyIncome2018,
    2019: parseTherapyIncome2019,
    2020: parseTherapyIncome2020,
    2021: parseTherapyIncome2021,
    2022: parseTherapyIncome2022,
    2023: parseTherapyIncome2023,
    2024: parseTherapyIncome2024
  }

  // Process all years (2016-2025) using getSiteMonthTotals first, fall back to estimates
  // Filter historical years by selectedYears, but always include 2025
  const allYears = [...Object.keys(historicalParsers).map(Number).filter(year => selectedYears.includes(year)), 2025]
  
  for (const year of allYears) {
    try {
      // First try to get actual site monthly data
      const siteMonthsData = getSiteMonthTotals(String(year))
      
      if (siteMonthsData.length > 0 && siteMonthsData.some(entry => 
        (entry.sites.lacey || 0) + (entry.sites.centralia || 0) + (entry.sites.aberdeen || 0) > 0
      )) {
        // We have real site data for this year
        for (const entry of siteMonthsData) {
          const monthIdx = monthNameToIndex[entry.month]
          if (!monthIdx) continue
          const totalSiteIncome = (entry.sites.lacey || 0) + (entry.sites.centralia || 0) + (entry.sites.aberdeen || 0)
          if (totalSiteIncome <= 0) continue
          
          results.push({
            year,
            month: monthIdx,
            monthName: monthNames[monthIdx - 1],
            laceyPercent: (entry.sites.lacey / totalSiteIncome) * 100,
            centraliaPercent: (entry.sites.centralia / totalSiteIncome) * 100,
            aberdeenPercent: (entry.sites.aberdeen / totalSiteIncome) * 100,
            totalIncome: totalSiteIncome
          })
        }
      } else if (year <= 2024) {
        // Fall back to estimated proportions for historical years without site data
        const yearly = historicalParsers[year]()
        const yearTotalPoint = yearly.find(p => p.date === 'Total')
        if (!yearTotalPoint) continue
        
        const est = estimateSiteBreakdownForYear(yearTotalPoint.cumulativeIncome, String(year))
        const total = est.lacey + est.centralia + est.aberdeen
        if (total <= 0) continue

        const laceyPercent = (est.lacey / total) * 100
        const centraliaPercent = (est.centralia / total) * 100
        const aberdeenPercent = (est.aberdeen / total) * 100

        // Distribute total income evenly across months (only used for tooltip total)
        const monthlyIncome = yearTotalPoint.cumulativeIncome / 12
        for (let m = 1; m <= 12; m++) {
          results.push({
            year,
            month: m,
            monthName: monthNames[m - 1],
            laceyPercent,
            centraliaPercent,
            aberdeenPercent,
            totalIncome: monthlyIncome
          })
        }
      }
    } catch (err) {
      console.error(`buildProportionData year ${year} error`, err)
    }
  }

  // Sort by year then month
  results.sort((a, b) => (a.year - b.year) || (a.month - b.month))
  return results
}

// Helper function to apply moving average smoothing
function applyMovingAverage(values: number[], windowSize: number = 3): number[] {
  if (values.length < windowSize) return values
  
  const smoothed: number[] = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow)
    const end = Math.min(values.length - 1, i + halfWindow)
    
    let sum = 0
    let count = 0
    for (let j = start; j <= end; j++) {
      sum += values[j]
      count++
    }
    
    smoothed.push(sum / count)
  }
  
  return smoothed
}

// Build Plotly traces for stacked area proportions
export function buildProportionTraces(
  data: MonthlyProportionData[],
  smoothingFactor: number = 5,
  visibleSites?: { lacey: boolean, centralia: boolean, aberdeen: boolean },
  colorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare' = 'gray'
) {
  if (data.length === 0) return []
  const SITE_COLORS = getSiteColors(colorScheme)

  // Helper to check if a site is visible
  const isSiteVisible = (siteKey: 'lacey' | 'centralia' | 'aberdeen') => {
    return visibleSites ? visibleSites[siteKey] : true
  }

  // Format dates as "Mon YYYY" (e.g., "Jan 2024")
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const xLabels = data.map(d => `${monthNames[d.month - 1]} ${d.year}`)

  // Apply moving average smoothing to the percentage data
  const rawLaceyPercentages = data.map(d => d.laceyPercent)
  const rawCentraliaPercentages = data.map(d => d.centraliaPercent)
  const rawAberdeenPercentages = data.map(d => d.aberdeenPercent)

  const laceyPercentages = smoothingFactor > 0 ? applyMovingAverage(rawLaceyPercentages, smoothingFactor) : rawLaceyPercentages
  const centraliaPercentages = smoothingFactor > 0 ? applyMovingAverage(rawCentraliaPercentages, smoothingFactor) : rawCentraliaPercentages
  const aberdeenPercentages = smoothingFactor > 0 ? applyMovingAverage(rawAberdeenPercentages, smoothingFactor) : rawAberdeenPercentages

  return [
    {
      x: xLabels,
      y: laceyPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: SITE_COLORS.lacey.historical,
      line: {
        color: SITE_COLORS.lacey.current,
        width: 2,
        shape: 'spline',
        smoothing: 0.5
      },
      name: 'Lacey',
      stackgroup: 'one',
      visible: isSiteVisible('lacey'),
      opacity: isSiteVisible('lacey') ? 1 : 0.2,
      hovertemplate: 'Lacey: %{y:.1f}%<extra></extra>'
    },
    {
      x: xLabels,
      y: centraliaPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: SITE_COLORS.centralia.historical,
      line: {
        color: SITE_COLORS.centralia.current,
        width: 2,
        shape: 'spline'
      },
      name: 'Centralia',
      stackgroup: 'one',
      visible: isSiteVisible('centralia'),
      opacity: isSiteVisible('centralia') ? 1 : 0.2,
      hovertemplate: 'Centralia: %{y:.1f}%<extra></extra>'
    },
    {
      x: xLabels,
      y: aberdeenPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: SITE_COLORS.aberdeen.historical,
      line: {
        color: SITE_COLORS.aberdeen.current,
        width: 2,
        shape: 'spline'
      },
      name: 'Aberdeen',
      stackgroup: 'one',
      visible: isSiteVisible('aberdeen'),
      opacity: isSiteVisible('aberdeen') ? 1 : 0.2,
      hovertemplate: 'Aberdeen: %{y:.1f}%<extra></extra>'
    },
    // Invisible trace to activate the secondary y-axis
    {
      x: xLabels,
      y: laceyPercentages,
      type: 'scatter',
      mode: 'lines',
      line: { color: 'rgba(0,0,0,0)', width: 0 },
      showlegend: false,
      hoverinfo: 'skip',
      yaxis: 'y2'
    }
  ]
}

// Layout for stacked area proportions
export function buildProportionLayout(
  isMobile: boolean = false,
  selectedYears: number[] = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  data: MonthlyProportionData[] = [],
  visibleSites?: { lacey: boolean, centralia: boolean, aberdeen: boolean },
  smoothingFactor: number = 5
) {
  // Determine if we have historical years selected (any year before 2025)
  const hasHistoricalYears = selectedYears.some(year => year < 2025)

  // Determine start and end years from selected years
  const startYear = hasHistoricalYears ? Math.min(...selectedYears.filter(y => y < 2025)) : 2025
  const endYear = 2025 // Always ends at present (2025)

  // Tick labels for January of each year shown
  const tickYears: number[] = []
  for (let y = startYear; y <= endYear; y++) tickYears.push(y)

  // Title changes based on whether historical years are selected
  const titleText = hasHistoricalYears
    ? `Monthly Income Proportions by Site (${startYear}–Present)`
    : 'Monthly Income Proportions by Site (YTD)'

  // Calculate overall percentages and ranges for each site across the whole period
  const annotations: any[] = []

  if (data.length > 0) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Find center x position (middle of the data range)
    const centerIndex = Math.floor(data.length / 2)
    const centerX = `${monthNames[data[centerIndex].month - 1]} ${data[centerIndex].year}`

    // Get raw percentages for positioning
    const rawLaceyPercents = data.map(d => d.laceyPercent)
    const rawCentraliaPercents = data.map(d => d.centraliaPercent)
    const rawAberdeenPercents = data.map(d => d.aberdeenPercent)

    // Calculate TRUE percentage from actual dollar totals (not average of percentages!)
    // Sum up actual $ income for each site, then compute % of total
    const totalLaceyDollars = data.reduce((sum, d) => sum + (d.totalIncome * d.laceyPercent / 100), 0)
    const totalCentraliaDollars = data.reduce((sum, d) => sum + (d.totalIncome * d.centraliaPercent / 100), 0)
    const totalAberdeenDollars = data.reduce((sum, d) => sum + (d.totalIncome * d.aberdeenPercent / 100), 0)
    const grandTotal = totalLaceyDollars + totalCentraliaDollars + totalAberdeenDollars

    const laceyAvg = (totalLaceyDollars / grandTotal) * 100
    const centraliaAvg = (totalCentraliaDollars / grandTotal) * 100
    const aberdeenAvg = (totalAberdeenDollars / grandTotal) * 100

    // Apply smoothing for positioning (matching displayed chart)
    const smoothedLaceyPercents = smoothingFactor > 0 ? applyMovingAverage(rawLaceyPercents, smoothingFactor) : rawLaceyPercents
    const smoothedCentraliaPercents = smoothingFactor > 0 ? applyMovingAverage(rawCentraliaPercents, smoothingFactor) : rawCentraliaPercents
    const smoothedAberdeenPercents = smoothingFactor > 0 ? applyMovingAverage(rawAberdeenPercents, smoothingFactor) : rawAberdeenPercents

    // Helper to check if a site is visible
    const isSiteVisible = (site: 'lacey' | 'centralia' | 'aberdeen') => {
      return visibleSites ? visibleSites[site] : true
    }

    // Get smoothed percentage values at the center point for positioning (matching displayed chart)
    const aberdeenAtCenter = smoothedAberdeenPercents[centerIndex]
    const centraliaAtCenter = smoothedCentraliaPercents[centerIndex]
    const laceyAtCenter = smoothedLaceyPercents[centerIndex]

    // In stacked area charts, y-values are cumulative from bottom (0) to top (100)
    // Stack order from bottom to top: Lacey → Centralia → Aberdeen
    // So at the center x-position:
    // - Lacey occupies: 0 to laceyAtCenter
    // - Centralia occupies: laceyAtCenter to (laceyAtCenter + centraliaAtCenter)
    // - Aberdeen occupies: (laceyAtCenter + centraliaAtCenter) to 100

    // Track cumulative position (starting from bottom at y=0)
    let cumulativeY = 0

    // Lacey annotation (bottom layer, 0 to laceyPercent)
    if (isSiteVisible('lacey')) {
      const laceyY = cumulativeY + (laceyAtCenter / 2)
      annotations.push({
        x: centerX,
        y: laceyY,
        text: `Lacey: ${laceyAvg.toFixed(1)}%`,
        showarrow: false,
        font: { size: 12, color: 'white', weight: 'bold' },
        xanchor: 'center',
        yanchor: 'middle'
      })
      cumulativeY += laceyAtCenter
    }

    // Centralia annotation (middle layer)
    if (isSiteVisible('centralia')) {
      const centraliaY = cumulativeY + (centraliaAtCenter / 2)
      annotations.push({
        x: centerX,
        y: centraliaY,
        text: `Centralia: ${centraliaAvg.toFixed(1)}%`,
        showarrow: false,
        font: { size: 12, color: 'white', weight: 'bold' },
        xanchor: 'center',
        yanchor: 'middle'
      })
      cumulativeY += centraliaAtCenter
    }

    // Aberdeen annotation (top layer)
    if (isSiteVisible('aberdeen')) {
      const aberdeenY = cumulativeY + (aberdeenAtCenter / 2)
      annotations.push({
        x: centerX,
        y: aberdeenY,
        text: `Aberdeen: ${aberdeenAvg.toFixed(1)}%`,
        showarrow: false,
        font: { size: 12, color: 'white', weight: 'bold' },
        xanchor: 'center',
        yanchor: 'middle'
      })
    }
  }

  return {
    title: {
      text: titleText,
      x: 0.5,
      font: { size: isMobile ? 14 : 16, weight: 700 }
    },
    xaxis: {
      title: { text: 'Month' },
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
      tickangle: -45,
      tickmode: 'array' as const,
      tickvals: tickYears.map(y => `Jan ${y}`),
      ticktext: tickYears.map(y => `${y}`)
    },
    yaxis: {
      title: { text: 'Relative proportion (%)' },
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
      range: [0, 100],
      tickformat: '.0f',
      dtick: 10,
      side: 'left' as const
    },
    yaxis2: {
      title: { text: '' },
      showgrid: false,
      range: [0, 100],
      tickformat: '.0f',
      dtick: 10,
      side: 'right' as const,
      overlaying: 'y'
    },
    hovermode: 'x unified' as const,
    hoverlabel: {
      bgcolor: 'white',
      bordercolor: '#ccc',
      font: { color: 'black' }
    },
    margin: { l: 60, r: 30, t: 60, b: isMobile ? 80 : 60 },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    annotations: annotations
  }
}