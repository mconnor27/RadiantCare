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
export function buildProportionData(): MonthlyProportionData[] {
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
  const allYears = [...Object.keys(historicalParsers).map(Number), 2025]
  
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

// Build Plotly traces for stacked area proportions
export function buildProportionTraces(data: MonthlyProportionData[]) {
  if (data.length === 0) return []

  const xLabels = data.map(d => `${d.year}-${String(d.month).padStart(2, '0')}`)
  const laceyPercentages = data.map(d => d.laceyPercent)
  const centraliaPercentages = data.map(d => d.centraliaPercent)
  const aberdeenPercentages = data.map(d => d.aberdeenPercent)

  return [
    {
      x: xLabels,
      y: laceyPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: 'rgba(59, 130, 246, 0.6)',
      line: { 
        color: 'rgb(59, 130, 246)', 
        width: 2,
        shape: 'spline'
      },
      name: 'Lacey',
      stackgroup: 'one',
      hovertemplate: 'Lacey: %{y:.1f}%<br>%{x}<extra></extra>'
    },
    {
      x: xLabels,
      y: centraliaPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: 'rgba(16, 185, 129, 0.6)',
      line: { 
        color: 'rgb(16, 185, 129)', 
        width: 2,
        shape: 'spline',
        smoothing: 1.3
      },
      name: 'Centralia',
      stackgroup: 'one',
      hovertemplate: 'Centralia: %{y:.1f}%<br>%{x}<extra></extra>'
    },
    {
      x: xLabels,
      y: aberdeenPercentages,
      type: 'scatter',
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: 'rgba(251, 191, 36, 0.6)',
      line: { 
        color: 'rgb(251, 191, 36)', 
        width: 2,
        shape: 'spline',
        smoothing: 1.3
      },
      name: 'Aberdeen',
      stackgroup: 'one',
      hovertemplate: 'Aberdeen: %{y:.1f}%<br>%{x}<extra></extra>'
    }
  ]
}

// Layout for stacked area proportions
export function buildProportionLayout(isMobile: boolean = false) {
  // Tick labels for January of each year shown
  const tickYears: number[] = []
  for (let y = 2016; y <= 2025; y++) tickYears.push(y)

  return {
    title: {
      text: 'Monthly Income Proportions by Site (2016–Present)',
      x: 0.5,
      font: { size: isMobile ? 14 : 16 }
    },
    xaxis: {
      title: { text: 'Month' },
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
      tickangle: -45,
      tickmode: 'array' as const,
      tickvals: tickYears.map(y => `${y}-01`),
      ticktext: tickYears.map(y => `${y}`)
    },
    yaxis: {
      title: { text: 'Relative proportion (%)' },
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
      range: [0, 100],
      tickformat: '.0f'
    },
    legend: {
      orientation: isMobile ? 'h' : 'v',
      x: isMobile ? 0.5 : 1.02,
      y: isMobile ? -0.1 : 0.5,
      xanchor: isMobile ? 'center' : 'left',
      yanchor: isMobile ? 'top' : 'middle'
    },
    hovermode: 'x unified' as const,
    margin: { l: 60, r: isMobile ? 20 : 120, t: 60, b: isMobile ? 80 : 60 },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: true
  }
}