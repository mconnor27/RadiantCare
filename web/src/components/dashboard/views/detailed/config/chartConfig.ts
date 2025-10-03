// Configuration constants
export const HISTORICAL_YEAR_LINE_WIDTH = 1.5

// Desaturation amounts for historical data (0 = no desaturation, 1 = fully desaturated/grayscale)
export const TOTAL_INCOME_DESATURATION = 0 // For total income bars/lines
export const SITE_DESATURATION = 0.6 // For per-site bars/lines

// Helper function to desaturate a color
export const desaturateColor = (color: string, amount: number = 0.4): string => {
  // Parse rgba or rgb or hex
  let r: number, g: number, b: number, a: number = 1

  if (color.startsWith('rgba')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/)
    if (match) {
      r = parseInt(match[1])
      g = parseInt(match[2])
      b = parseInt(match[3])
      a = match[4] ? parseFloat(match[4]) : 1
    } else {
      return color
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      r = parseInt(match[1])
      g = parseInt(match[2])
      b = parseInt(match[3])
    } else {
      return color
    }
  } else if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else {
    return color
  }

  // Convert to HSL
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  // Desaturate by reducing saturation
  s = Math.max(0, s * (1 - amount))

  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let r2: number, g2: number, b2: number

  if (s === 0) {
    r2 = g2 = b2 = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r2 = hue2rgb(p, q, h + 1/3)
    g2 = hue2rgb(p, q, h)
    b2 = hue2rgb(p, q, h - 1/3)
  }

  const r3 = Math.round(r2 * 255)
  const g3 = Math.round(g2 * 255)
  const b3 = Math.round(b2 * 255)

  return `rgba(${r3}, ${g3}, ${b3}, ${a})`
}

// Bar styling configuration for current/projected bars
// Dark border around the entire 2025 stack
export const CURRENT_BAR_BORDER = {
  color: 'rgba(0, 0, 0, 0.8)', // Dark/black border
  width: 1.5
}

// Color scheme options for easy swapping
export const COLOR_SCHEMES = {
  // Current red-based scheme (ggplot2 2-trace default)
  // RadiantCare brand colors
  radiantCare: {
    historical: Array(9).fill('#9e9e9e'),
    current: '#7c2a83',
    projectedBar: 'rgba(124, 42, 131, 0.6)',
    historicalCombined: '#9e9e9e' // Same gray for combined
  },
  // All gray scheme
  gray: {
    historical: Array(9).fill('#9e9e9e'),
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)',
    historicalCombined: '#9e9e9e' // Same gray for combined
  },
  // Standard ggplot2 blue/green scheme
  blueGreen: {
    historical: Array(9).fill('#00BFC4'),
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)',
    historicalCombined: '#00BFC4' // Same blue/green for combined
  },
  ggplot2: {
    historical: [
      '#006064', '#00838f', '#0097a7', '#00acc1',
      '#26c6da', '#4dd0e1', '#80deea', '#b2ebf2', '#e0f7fa'
    ],
    current: '#F8766D',
    projectedBar: 'rgba(248, 118, 109, 0.6)',
    historicalCombined: '#00BFC4' // Middle cyan color for mean/median bar
  }
  
}

// Site color schemes organized similar to COLOR_SCHEMES
export const SITE_COLOR_SCHEMES = {
  // Original red/green/blue scheme
  rgb: {
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
  },
  // RadiantCare purple site colors (spread across purple-pink spectrum)
  radiantCare: {
    lacey: {
      historical: 'rgba(206, 147, 216, 0.7)',    // Faded light lavender-pink
      current: '#ce93d8',                         // Light lavender-pink
      projected: 'rgba(206, 147, 216, 0.6)'      // For textured pattern
    },
    centralia: {
      historical: 'rgba(156, 89, 209, 0.7)',     // Faded medium-light purple
      current: '#9c59d1',                         // Medium-light purple
      projected: 'rgba(156, 89, 209, 0.6)'       // For textured pattern
    },
    aberdeen: {
      historical: 'rgba(93, 20, 99, 0.7)',       // Faded dark purple
      current: '#5d1463',                         // Dark purple
      projected: 'rgba(93, 20, 99, 0.6)'         // For textured pattern
    }
  },
  // JAMA color scheme (teal/blue-gray spectrum)
  jama: {
    lacey: {
      historical: 'rgba(224, 224, 224, 0.7)',    // Faded light gray
      current: '#e0e0e0',                         // Light gray
      projected: 'rgba(224, 224, 224, 0.6)'      // For textured pattern
    },
    centralia: {
      historical: 'rgba(144, 164, 174, 0.7)',    // Faded medium blue-gray
      current: '#90a4ae',                         // Medium blue-gray
      projected: 'rgba(144, 164, 174, 0.6)'      // For textured pattern
    },
    aberdeen: {
      historical: 'rgba(55, 71, 79, 0.7)',       // Faded dark teal-gray
      current: '#37474f',                         // Dark teal-gray
      projected: 'rgba(55, 71, 79, 0.6)'         // For textured pattern
    }
  }
}

// Legacy exports for backward compatibility
export const SITE_COLORS_RGB = SITE_COLOR_SCHEMES.rgb
export const SITE_COLORS_RADIANTCARE = SITE_COLOR_SCHEMES.radiantCare

// Site projected patterns (same pattern for all sites)
export const SITE_PROJECTED_PATTERNS = {
  lacey: {
    shape: '/',
    size: 4,
    solidity: 0.8
  },
  centralia: {
    shape: '/',
    size: 4,
    solidity: 0.8
  },
  aberdeen: {
    shape: '/',
    size: 4,
    solidity: 0.8
  }
}

// Current active scheme (change this to switch color schemes)
export const ACTIVE_COLOR_SCHEME = COLOR_SCHEMES.radiantCare

// Helper function to get colors based on color scheme
export const getColorScheme = (scheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare') => {
  return COLOR_SCHEMES[scheme]
}

// Helper function to get site colors based on site color scheme
export const getSiteColors = (scheme: 'rgb' | 'radiantCare' | 'jama') => {
  return SITE_COLOR_SCHEMES[scheme]
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
    size: 4, // Thicker lines (reduced from 8 for denser pattern)
    solidity: 0.8 // Increased from 0.3 for thicker lines
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
    rightDefault: 10,
    rightBarMode: 10,
    rightLineWithRadar: 30
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
