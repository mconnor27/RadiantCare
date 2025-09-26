// Configuration constants
export const HISTORICAL_YEAR_LINE_WIDTH = 1.5

// Bar chart styling configuration
// NOTE: width property on individual bars overrides bargap/bargroupgap, so we don't use width
export const BAR_CONFIG = {
  // Year mode
  year: {
    individual: { bargap: 0.3, bargroupgap: 0.05 },
    // Make historical vs 2025 bars sit tightly together but narrower
    combined: { bargap: 0.1, bargroupgap: 0.1 }
  },
  // Quarter mode
  quarter: {
    individual: { bargap: 0.1, bargroupgap: 0.05 },
    combined: { bargap: 0.1, bargroupgap: 0.01 }
  },
  // Month mode
  month: {
    individual: { bargap: 0.2, bargroupgap: 0.05 },
    combined: { bargap: 0.3, bargroupgap: 0.01 }
  }
}

// Color schemes for historical data
export const HISTORICAL_COLORS = [
  '#e0f2fe', '#b3e5fc', '#81d4fa', '#4fc3f7', 
  '#29b6f6', '#0288d1', '#003366', '#001122', '#000000'
]

export const CURRENT_YEAR_COLOR = '#2e7d32'
export const HISTORICAL_MEAN_COLOR = '#1e40af'

// Projected data styling configuration
export const PROJECTED_BAR_STYLE = {
  color: 'rgba(34, 197, 94, 0.6)', // Lighter green with transparency
  pattern: {
    shape: '/',
    size: 6, // Thicker lines (reduced from 8 for denser pattern)
    solidity: 0.5 // Increased from 0.3 for thicker lines
  }
}

// Chart dimensions and margins
export const CHART_CONFIG = {
  mobile: {
    height: 360
  },
  desktop: {
    height: 500
  },
  margins: {
    left: 60,
    top: 60,
    bottom: 40,
    rightDefault: 20,
    rightBarMode: 200,
    rightLineWithRadar: 80
  }
}

// Animation configuration for radar/pulse effect
export const RADAR_CONFIG = {
  frameCount: 60, // Total frames in animation cycle
  updateInterval: 50, // ms between updates
  rings: {
    count: 2,
    stagger: 30, // frames between ring starts
    baseSize: 8, // px
    maxGrowth: 25, // px
    baseOpacity: 0.5
  }
}
