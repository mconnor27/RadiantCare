import React, { useState, useEffect } from 'react'
import getDefaultValue, { getSliderBounds, getInitialSliderValue, getSliderStep } from '../config/projectedDefaults'

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
}

export default function ProjectedValueSlider({ 
  isVisible, 
  onClose, 
  currentValue, 
  onValueChange, 
  accountName,
  position,
  annualizedBaseline
}: ProjectedValueSliderProps) {
  const [sliderValue, setSliderValue] = useState(currentValue)
  const [inputValue, setInputValue] = useState(currentValue.toString())

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

  if (!isVisible) return null

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
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        onClick={handleCancel}
      />
      
      {/* Slider Panel */}
      <div
        style={{
          position: 'fixed',
          top: position.y - 50,
          left: Math.min(position.x + 20, window.innerWidth - 350),
          width: '320px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          zIndex: 1600,
          transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.95)',
          opacity: isVisible ? 1 : 0,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#f8fafc'
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
        <div style={{ padding: '20px' }}>
          {/* Current vs New Value Display */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '20px',
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
          <div style={{ marginBottom: '24px' }}>
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
