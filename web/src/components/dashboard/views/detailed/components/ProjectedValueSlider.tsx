import React, { useState, useEffect } from 'react'

interface ProjectedValueSliderProps {
  isVisible: boolean
  onClose: () => void
  currentValue: number
  onValueChange: (newValue: number) => void
  accountName: string
  position: { x: number; y: number }
}

export default function ProjectedValueSlider({ 
  isVisible, 
  onClose, 
  currentValue, 
  onValueChange, 
  accountName,
  position 
}: ProjectedValueSliderProps) {
  const [sliderValue, setSliderValue] = useState(currentValue)
  const [inputValue, setInputValue] = useState(currentValue.toString())

  useEffect(() => {
    setSliderValue(currentValue)
    setInputValue(Math.round(currentValue).toString())
  }, [currentValue])

  // Calculate slider range based on current value
  const minValue = Math.max(0, currentValue * 0.1) // 10% of current value or 0
  const maxValue = currentValue * 3 // 300% of current value
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setSliderValue(newValue)
    setInputValue(Math.round(newValue).toString())
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    const numValue = parseFloat(value.replace(/,/g, ''))
    if (!isNaN(numValue)) {
      setSliderValue(Math.max(minValue, Math.min(maxValue, numValue)))
    }
  }

  const handleApply = () => {
    onValueChange(sliderValue)
    onClose()
  }

  const handleCancel = () => {
    setSliderValue(currentValue)
    setInputValue(Math.round(currentValue).toString())
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
          padding: '16px',
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
                color: '#1f2937'
              }}>
                Adjust Projected Value
              </h3>
              <p style={{
                margin: '4px 0 0 0',
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
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Original
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                {formatCurrency(currentValue)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                New Value
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                {formatCurrency(sliderValue)}
              </div>
            </div>
          </div>

          {/* Input Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Enter Value
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter amount"
            />
          </div>

          {/* Slider */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Adjust with Slider
            </label>
            <input
              type="range"
              min={minValue}
              max={maxValue}
              step={Math.max(1, (maxValue - minValue) / 1000)}
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
