import React, { useState, useEffect } from 'react'
import getDefaultValue, { getSliderBounds, getInitialSliderValue, getSliderStep } from '../config/projectedDefaults'

// ========== ANIMATION CONFIGURATION ==========
type AnimationStyle = 'two-stage' | 'scale-all'

const ANIMATION_CONFIG = {
  style: 'two-stage' as AnimationStyle, // Change this to switch animation styles
  
  // Two-stage animation (expand width first, then height)
  twoStage: {
    widthDuration: 200,
    heightDuration: 150,
    contentDelay: 50,
    easing: 'ease-out',
    // Funnel height animation scaling
    funnelHeightScale: 1.0 // Adjust this to speed up (>1) or slow down (<1) funnel height animation
  },
  
  // Scale-all animation (all dimensions at once with spring)
  scaleAll: {
    duration: 250,
    contentDelay: 50,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Spring easing
    noOvershoot: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' // Smooth easing without overshoot
  }
}
// ============================================

interface ProjectedValueSliderProps {
  isVisible: boolean
  onClose: () => void
  currentValue: number
  onValueChange: (newValue: number) => void
  accountName: string
  position: { x: number; y: number }
  /**
   * Immutable baseline annualized value computed from YTD data in the grid. Never changes with user edits.
   */
  annualizedBaseline: number
  /**
   * Origin position of the clicked cell for animation
   */
  originPosition?: { x: number; y: number }
  /**
   * Optional rect of the origin cell to draw a funnel connector
   */
  originRect?: { top: number; right: number; bottom: number; left: number; width: number; height: number }
}

export default function ProjectedValueSlider({ 
  isVisible, 
  onClose, 
  currentValue, 
  onValueChange, 
  accountName,
  position,
  annualizedBaseline,
  originPosition,
  originRect
}: ProjectedValueSliderProps) {
  const [sliderValue, setSliderValue] = useState(currentValue)
  const [inputValue, setInputValue] = useState(currentValue.toString())
  const [animationStage, setAnimationStage] = useState<'initial' | 'width' | 'height' | 'complete'>('initial')
  const [isAnimating, setIsAnimating] = useState(true) // For scale-all animation
  
  // Funnel animation progress (0 -> 1) for smooth transitions
  const [funnelProgress, setFunnelProgress] = useState({ width: 0, height: 0 })

  useEffect(() => {
    setSliderValue(currentValue)
    setInputValue(formatCurrency(currentValue))
  }, [currentValue])

  // Resolve immutable baselines
  const annualizedValue = annualizedBaseline
  const defaultValue = getDefaultValue(accountName, annualizedValue)

  // Calculate slider range based on config (falls back to standard strategy)
  const { minValue, maxValue } = getSliderBounds(accountName, annualizedValue)
  const step = getSliderStep(accountName, minValue, maxValue)
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    // Snap to integer dollars to match grid rounding
    const rounded = Math.round(newValue)
    setSliderValue(rounded)
    setInputValue(formatCurrency(rounded))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Strip everything except digits and minus sign
    const numeric = raw.replace(/[^0-9-]/g, '')
    const numValue = parseFloat(numeric)
    if (!isNaN(numValue)) {
      const clamped = Math.max(minValue, Math.min(maxValue, numValue))
      const rounded = Math.round(clamped)
      setSliderValue(rounded)
      setInputValue(formatCurrency(rounded))
    } else {
      // Allow clearing; don't update slider until valid
      setInputValue(raw)
    }
  }

  const handleApply = () => {
    onValueChange(sliderValue)
    onClose()
  }

  const handleCancel = () => {
    setSliderValue(currentValue)
    setInputValue(formatCurrency(currentValue))
    onClose()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value))
  }

  useEffect(() => {
    // Initialize slider from configurable source
    const initial = Math.round(getInitialSliderValue(accountName, defaultValue, annualizedValue))
    setSliderValue(initial)
    setInputValue(formatCurrency(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountName])

  // Handle animation when slider becomes visible
  useEffect(() => {
    console.log('Animation effect triggered:', { isVisible, currentStage: animationStage })
    if (isVisible) {
      if (ANIMATION_CONFIG.style === 'two-stage') {
        // Two-stage animation: width first, then height
        const widthTimer = setTimeout(() => {
          console.log('Setting stage to width')
          setAnimationStage('width')
        }, 10)
        const heightTimer = setTimeout(() => {
          console.log('Setting stage to height')
          setAnimationStage('height')
        }, 10 + ANIMATION_CONFIG.twoStage.widthDuration)
        const completeTimer = setTimeout(() => {
          console.log('Setting stage to complete')
          setAnimationStage('complete')
        }, 10 + ANIMATION_CONFIG.twoStage.widthDuration + ANIMATION_CONFIG.twoStage.heightDuration + ANIMATION_CONFIG.twoStage.contentDelay)
        
        return () => {
          clearTimeout(widthTimer)
          clearTimeout(heightTimer)
          clearTimeout(completeTimer)
        }
      } else {
        // Scale-all animation: all dimensions at once
        const timer = setTimeout(() => setIsAnimating(false), ANIMATION_CONFIG.scaleAll.contentDelay)
        return () => clearTimeout(timer)
      }
    } else {
      console.log('Resetting animation stage to initial')
      setAnimationStage('initial')
      setIsAnimating(true)
      setFunnelProgress({ width: 0, height: 0 })
    }
  }, [isVisible])

  // Animate funnel progress smoothly using requestAnimationFrame
  useEffect(() => {
    if (!isVisible || ANIMATION_CONFIG.style !== 'two-stage') {
      setFunnelProgress({ width: 0, height: 0 })
      return
    }

    let rafId: number
    const startTime = performance.now()
    const widthDuration = ANIMATION_CONFIG.twoStage.widthDuration
    const sliderHeightDuration = ANIMATION_CONFIG.twoStage.heightDuration
    
    // Calculate funnel height duration based on absolute unfurling rate
    const sliderHeightPixels = 424 - 20 // slider grows from 20px to 424px = 404px
    const funnelHeightPixels = 40 - 12 // funnel grows from ~12px to ~40px = 28px
    const pixelsPerMs = sliderHeightPixels / sliderHeightDuration // slider rate: ~2.69 px/ms
    const calculatedFunnelDuration = funnelHeightPixels / pixelsPerMs // funnel should take ~10.4ms
    const funnelHeightDuration = calculatedFunnelDuration * ANIMATION_CONFIG.twoStage.funnelHeightScale
    
    console.log('Animation rates:', { 
      sliderHeightPixels, funnelHeightPixels, pixelsPerMs, 
      calculatedFunnelDuration, funnelHeightDuration, 
      scale: ANIMATION_CONFIG.twoStage.funnelHeightScale 
    })
    
    // Easing function to match CSS ease-out
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime - 10 // Account for initial 10ms delay
      
      if (elapsed <= 0) {
        setFunnelProgress({ width: 0, height: 0 })
      } else if (elapsed <= widthDuration) {
        // Width animation phase
        const t = Math.min(1, elapsed / widthDuration)
        setFunnelProgress({ width: easeOut(t), height: 0 })
      } else if (elapsed <= widthDuration + funnelHeightDuration) {
        // Height animation phase (using funnel-specific duration)
        const t = Math.min(1, (elapsed - widthDuration) / funnelHeightDuration)
        const heightProgress = easeOut(t)
        console.log('Height phase:', { elapsed, widthDuration, funnelHeightDuration, t, heightProgress })
        setFunnelProgress({ width: 1, height: heightProgress })
      } else {
        // Animation complete
        setFunnelProgress({ width: 1, height: 1 })
        return
      }
      
      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [isVisible])

  if (!isVisible) return null

  // Calculate animation positions
  const finalPosition = {
    top: position.y - 50,
    left: Math.min(position.x + 20, window.innerWidth - 350)
  }
  
  // Calculate the actual height of the slider content for smooth animation
  const sliderHeight = 52 + 20 + 320 + 20 + 24 + 8 // header + padding + content + padding + buttons + margin
  const targetHeight = `${sliderHeight}px`
  
  const startPosition = originPosition ? {
    top: originPosition.y - 10,
    left: originPosition.x - 10
  } : finalPosition

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          zIndex: 1500,
          opacity: 1
        }}
        onClick={handleCancel}
      />
      
      {/* Funnel connector (optional) */}
      {originRect && ANIMATION_CONFIG.style === 'two-stage' && funnelProgress.width > 0 && (
        <svg
          width={Math.max(20, finalPosition.left - originRect.right + 10)}
          height={Math.max(
            originRect.height + 20,
            Math.abs(originRect.bottom - (finalPosition.top - 10)) + 60
          )}
          style={{
            position: 'fixed',
            top: Math.min(originRect.top, finalPosition.top - 10),
            left: originRect.right - 5,
            pointerEvents: 'none',
            zIndex: 1599,
            opacity: 0.9
          }}
        >
          <defs>
            <linearGradient id="funnelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          {(() => {
            // Animate funnel dimensions based on progress
            const fullWidth = Math.max(20, finalPosition.left - originRect.right + 10)
            const animatedWidth = Math.max(10, fullWidth * (0.1 + 0.9 * funnelProgress.width))
            
            // Calculate positions relative to our SVG container
            const svgTop = Math.min(originRect.top, finalPosition.top - 10)
            const sliderJoinYAbs = (finalPosition.top - 10) + 20 // 20px down from slider top
            
            // Left edge spans the full cell right border height
            const startY1 = originRect.top - svgTop
            const startY2 = originRect.bottom - svgTop - 2
            const cellHeight = startY2 - startY1
            
            // Right edge animates smoothly from cell level to slider level during width phase
            const cellCenterY = (startY1 + startY2) / 2
            const finalSliderY = sliderJoinYAbs - svgTop
            
            // During width phase: interpolate from cell center to slider position
            const endY1 = cellCenterY + (finalSliderY - cellCenterY) * funnelProgress.width
            
            // During height phase: grow downward from current position
            const endHeightMax = 40
            const endHeight = Math.min(endHeightMax, 12 + 28 * funnelProgress.height)
            const endY2 = endY1 + endHeight
            
            console.log('Funnel connector (full height):', { 
              fullWidth, animatedWidth, cellHeight, startY1, startY2, endY1, endY2,
              widthProgress: funnelProgress.width, heightProgress: funnelProgress.height 
            })
            
            // Control points for smooth curves - adjust based on width progress
            const cp1x = animatedWidth * 0.3
            const cp2x = animatedWidth * 0.7
            
            // Adjust control point Y positions to create smooth curves
            // Top curve should curve downward toward slider
            const cp1y_top = startY1 + Math.abs(endY1 - startY1) * 0.3 // Below start point for downward curve
            const cp2y_top = endY1 - 5 // Slightly above target
            // Bottom curve should be more controlled to avoid artifacts
            const cp1y_bottom = startY2 - Math.abs(startY2 - endY2) * 0.2 // Slightly above start point
            const cp2y_bottom = endY2 + 3 // Slightly below target for gentler curve
            
            const path = `
              M 5,${startY1}
              C ${cp1x},${cp1y_top} ${cp2x},${cp2y_top} ${animatedWidth - 5},${endY1}
              L ${animatedWidth - 5},${endY2}
              C ${cp2x},${cp2y_bottom} ${cp1x},${cp1y_bottom} 5,${startY2}
              Z
            `
            
            return (
              <path 
                d={path} 
                fill="url(#funnelGradient)" 
                stroke="#e5e7eb" 
                strokeWidth="1"
                opacity="0.9"
              />
            )
          })()}
        </svg>
      )}
      
      {/* Slider Panel */}
      <div
        style={{
          position: 'fixed',
          ...(ANIMATION_CONFIG.style === 'two-stage' ? {
            // Two-stage animation styles
            top: animationStage === 'initial' ? startPosition.top : finalPosition.top,
            left: animationStage === 'initial' ? startPosition.left : finalPosition.left,
            width: animationStage === 'initial' ? '20px' : '320px',
            height: animationStage === 'initial' || animationStage === 'width' ? '20px' : targetHeight,
            transition: animationStage === 'width' 
              ? `width ${ANIMATION_CONFIG.twoStage.widthDuration}ms ${ANIMATION_CONFIG.twoStage.easing}, top ${ANIMATION_CONFIG.twoStage.widthDuration}ms ${ANIMATION_CONFIG.twoStage.easing}, left ${ANIMATION_CONFIG.twoStage.widthDuration}ms ${ANIMATION_CONFIG.twoStage.easing}, box-shadow ${ANIMATION_CONFIG.twoStage.widthDuration}ms ${ANIMATION_CONFIG.twoStage.easing}`
              : animationStage === 'height'
              ? `height ${ANIMATION_CONFIG.twoStage.heightDuration}ms ${ANIMATION_CONFIG.twoStage.easing}`
              : 'none',
            overflow: animationStage === 'complete' ? 'visible' : 'hidden'
          } : {
            // Scale-all animation styles
            top: isAnimating ? startPosition.top : finalPosition.top,
            left: isAnimating ? startPosition.left : finalPosition.left,
            width: isAnimating ? '20px' : '320px',
            height: isAnimating ? '20px' : 'auto',
            transform: isAnimating ? 'scale(0.1)' : 'scale(1)',
            transition: `all ${ANIMATION_CONFIG.scaleAll.duration}ms ${ANIMATION_CONFIG.scaleAll.noOvershoot}`,
            transformOrigin: originPosition ? 'top left' : 'center',
            overflow: isAnimating ? 'hidden' : 'visible'
          }),
          backgroundColor: '#ffffff',
          // Enforce rounded corners during the entire animation
          borderRadius: '12px',
          // Ensure child content doesn't bleed past rounded corners while animating
          overflow: (ANIMATION_CONFIG.style === 'two-stage' ? animationStage !== 'complete' : isAnimating) ? 'hidden' : 'visible',
          // Extra rounding via clip-path to help some browsers respect corners while scaling
          clipPath: 'inset(0 round 12px)',
          // Hint GPU compositing to reduce aliasing on edges during transform
          willChange: 'transform, width, height, top, left, box-shadow',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          transformStyle: 'preserve-3d',
          boxShadow: (ANIMATION_CONFIG.style === 'two-stage' ? animationStage === 'initial' : isAnimating)
            ? '0 2px 4px rgba(0, 0, 0, 0.1)' 
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          zIndex: 1600,
          opacity: 1,
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#f8fafc',
          opacity: ANIMATION_CONFIG.style === 'two-stage' 
            ? (animationStage === 'initial' ? 0 : 1)
            : (isAnimating ? 0 : 1),
          transition: 'opacity 0.1s ease-in-out',
          // Prevent layout reflow during animation
          minHeight: '52px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                textAlign: 'left'
              }}>
                Adjust Projected Value
              </h3>
              <p style={{
                margin: '4px 10px 0',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: 'normal'
              }}>
                {accountName}
              </p>
            </div>
            <button
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                color: '#6b7280',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '20px',
          opacity: ANIMATION_CONFIG.style === 'two-stage' 
            ? (animationStage === 'initial' ? 0 : 1)
            : (isAnimating ? 0 : 1),
          transition: 'opacity 0.1s ease-in-out',
          // Pre-size content to prevent layout shifts
          minHeight: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Current vs New Value Display */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 20px 12px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div
              onClick={() => {
                setSliderValue(defaultValue)
                setInputValue(formatCurrency(defaultValue))
              }}
              style={{
                cursor: 'pointer',
                padding: '8px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.03s ease',
                boxShadow: '0 0 0 0 rgba(0,0,0,0)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
                e.currentTarget.style.borderColor = '#d1d5db'
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)'
                e.currentTarget.style.transform = 'none'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(1px)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'none'
              }}
              title="Click to reset to Default"
            >
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Default
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                {formatCurrency(defaultValue)}
              </div>
            </div>
            <div
              onClick={() => {
                setSliderValue(annualizedValue)
                setInputValue(formatCurrency(annualizedValue))
              }}
              style={{
                cursor: 'pointer',
                padding: '8px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.03s ease',
                boxShadow: '0 0 0 0 rgba(0,0,0,0)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
                e.currentTarget.style.borderColor = '#d1d5db'
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)'
                e.currentTarget.style.transform = 'none'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(1px)'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'none'
              }}
              title="Click to set to Annualized"
            >
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Annualized
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                {formatCurrency(annualizedValue)}
              </div>
            </div>
          </div>

          {/* Manual Adjustment Title */}
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#374151',
            textAlign: 'center',
            margin: '4px 0 8px 0'
          }}>
            Current Value
          </div>

          {/* Input and Slider Row */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <input
                  aria-label="Adjust with slider"
                  type="range"
                  min={minValue}
                  max={maxValue}
                  step={step}
                  value={sliderValue}
                  onChange={handleSliderChange}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    background: '#e5e7eb',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: '#9ca3af',
                  marginTop: '4px'
                }}>
                  <span>{formatCurrency(minValue)}</span>
                  <span>{formatCurrency(maxValue)}</span>
                </div>
              </div>

              {(() => {
                const maxFormatted = formatCurrency(maxValue)
                const inputWidthCh = Math.max(8, maxFormatted.length + 3)
                return (
                  <input
                    aria-label="Projected value"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    style={{
                      width: `${inputWidthCh}ch`,
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      textAlign: 'center'
                    }}
                    placeholder="$0"
                  />
                )
              })()}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#059669',
                color: '#ffffff',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#047857'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#059669'
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
