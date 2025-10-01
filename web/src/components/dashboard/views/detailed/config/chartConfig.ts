// Configuration constants
export const HISTORICAL_YEAR_LINE_WIDTH = 1.5

// Color scheme options for easy swapping
export const COLOR_SCHEMES = {
  // Current red-based scheme (ggplot2 2-trace default)
  ggplot2: {
    historical: [
      '#006064', '#00838f', '#0097a7', '#00acc1',
      '#26c6da', '#4dd0e1', '#80deea', '#b2ebf2', '#e0f7fa'
    ],
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)'
  },
  // All gray scheme
  gray: {
    historical: Array(9).fill('#9e9e9e'),
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)'
  },
  // Standard ggplot2 blue/green scheme
  blueGreen: {
    historical: Array(9).fill('#00BFC4'),
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)'
  },
  // RadiantCare brand colors
  radiantCare: {
    historical: Array(9).fill('#9e9e9e'),
    current: '#7c2a83',
    projectedBar: 'rgba(124, 42, 131, 0.6)'
  }
}

// Site colors - original red/green/blue scheme (not tied to active scheme)
export const SITE_COLORS = {
  lacey: {
    historical: 'rgba(97, 156, 255, 0.7)',     // Faded blue
    current: '#619CFF',                         // Bright blue
    projected: 'rgba(97, 156, 255, 0.6)'       // For textured pattern
  },
  centralia: {
    historical: 'rgba(0, 186, 56, 0.7)',       // Faded green
    current: '#00BA38',                         // Bright green
    projected: 'rgba(0, 186, 56, 0.6)'         // For textured pattern
  },
  aberdeen: {
    historical: 'rgba(248, 118, 109, 0.7)',    // Faded red
    current: '#F8766D',                         // Bright red
    projected: 'rgba(248, 118, 109, 0.6)'      // For textured pattern
  }
}

// RadiantCare purple site colors (three shades of purple)
export const SITE_COLORS_RADIANTCARE = {
  lacey: {
    historical: 'rgba(156, 89, 209, 0.7)',     // Faded light purple
    current: '#9c59d1',                         // Light purple
    projected: 'rgba(156, 89, 209, 0.6)'       // For textured pattern
  },
  centralia: {
    historical: 'rgba(124, 42, 131, 0.7)',     // Faded medium purple (brand color)
    current: '#7c2a83',                         // Medium purple (brand color)
    projected: 'rgba(124, 42, 131, 0.6)'       // For textured pattern
  },
  aberdeen: {
    historical: 'rgba(93, 20, 99, 0.7)',       // Faded dark purple
    current: '#5d1463',                         // Dark purple
    projected: 'rgba(93, 20, 99, 0.6)'         // For textured pattern
  }
}

// Site projected patterns (same pattern for all sites)
export const SITE_PROJECTED_PATTERNS = {
  lacey: {
    shape: '/',
    size: 6,
    solidity: 0.5
  },
  centralia: {
    shape: '/',
    size: 6,
    solidity: 0.5
  },
  aberdeen: {
    shape: '/',
    size: 6,
    solidity: 0.5
  }
}

// Current active scheme (change this to switch color schemes)
export const ACTIVE_COLOR_SCHEME = COLOR_SCHEMES.gray

// Helper function to get colors based on color scheme
export const getColorScheme = (scheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare') => {
  return COLOR_SCHEMES[scheme]
}

// Helper function to get site colors based on color scheme
export const getSiteColors = (scheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare') => {
  return scheme === 'radiantCare' ? SITE_COLORS_RADIANTCARE : SITE_COLORS
}

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

// Color schemes for historical data - uses active color scheme
export const HISTORICAL_COLORS = ACTIVE_COLOR_SCHEME.historical

export const CURRENT_YEAR_COLOR = ACTIVE_COLOR_SCHEME.current
export const HISTORICAL_MEAN_COLOR = HISTORICAL_COLORS[Math.floor(HISTORICAL_COLORS.length / 2)]

// Projected data styling configuration - uses active color scheme
export const PROJECTED_BAR_STYLE = {
  color: ACTIVE_COLOR_SCHEME.projectedBar,
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
    rightBarMode: 20,
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
