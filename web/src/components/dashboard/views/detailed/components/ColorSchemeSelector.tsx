import { useState, useRef, useEffect } from 'react'
import { COLOR_SCHEMES, SITE_COLOR_SCHEMES } from '../config/chartConfig'

interface ColorSchemeSelectorProps {
  totalColorScheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare'
  setTotalColorScheme: (scheme: 'ggplot2' | 'gray' | 'blueGreen' | 'radiantCare') => void
  siteColorScheme: 'rgb' | 'radiantCare' | 'jama'
  setSiteColorScheme: (scheme: 'rgb' | 'radiantCare' | 'jama') => void
}

export default function ColorSchemeSelector({
  totalColorScheme,
  setTotalColorScheme,
  siteColorScheme,
  setSiteColorScheme
}: ColorSchemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Helper to render a color swatch for total schemes
  const renderTotalSwatch = (scheme: keyof typeof COLOR_SCHEMES) => {
    const colors = COLOR_SCHEMES[scheme]
    const historical = colors.historical
    const current = colors.current

    // Check if historical is a single color (Array.fill) or a spectrum
    const isSingleColor = historical.length > 1 && historical.every(c => c === historical[0])

    return (
      <div style={{ display: 'flex', gap: 2 }}>
        {/* Current color swatch */}
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: current,
            border: '1px solid #ccc',
            borderRadius: 2
          }}
        />
        {/* Historical color swatch */}
        {isSingleColor ? (
          // Single color - render as square
          <div
            style={{
              width: 16,
              height: 16,
              backgroundColor: historical[0],
              border: '1px solid #ccc',
              borderRadius: 2
            }}
          />
        ) : (
          // Spectrum - render as rectangle with gradient
          <div
            style={{
              width: 32,
              height: 16,
              background: `linear-gradient(to right, ${historical[0]}, ${historical[historical.length - 1]})`,
              border: '1px solid #ccc',
              borderRadius: 2
            }}
          />
        )}
      </div>
    )
  }

  // Helper to render color swatches for site schemes
  const renderSiteSwatch = (scheme: keyof typeof SITE_COLOR_SCHEMES) => {
    const colors = SITE_COLOR_SCHEMES[scheme]
    return (
      <div style={{ display: 'flex', gap: 2 }}>
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: colors.lacey.current,
            border: '1px solid #ccc',
            borderRadius: 2
          }}
        />
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: colors.centralia.current,
            border: '1px solid #ccc',
            borderRadius: 2
          }}
        />
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: colors.aberdeen.current,
            border: '1px solid #ccc',
            borderRadius: 2
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {/*<label style={{ fontSize: 14, fontWeight: 500 }}>Color Scheme:</label>*/}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '4px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: '#fff',
          color: '#333',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        {renderTotalSwatch(totalColorScheme)}
        <span>|</span>
        {renderSiteSwatch(siteColorScheme)}
        <span style={{ marginLeft: 4 }}>▾</span>
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 110,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            padding: 12,
            zIndex: 1000,
            minWidth: 200
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Total column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                Total
              </div>
              {(Object.keys(COLOR_SCHEMES) as Array<keyof typeof COLOR_SCHEMES>).map(scheme => (
                <button
                  key={scheme}
                  onClick={() => setTotalColorScheme(scheme)}
                  style={{
                    padding: 6,
                    border: totalColorScheme === scheme ? '2px solid #1e40af' : '1px solid #e5e7eb',
                    borderRadius: 4,
                    background: totalColorScheme === scheme ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  {renderTotalSwatch(scheme)}
                </button>
              ))}
            </div>

            {/* Per Site column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                Per Site
              </div>
              {(Object.keys(SITE_COLOR_SCHEMES) as Array<keyof typeof SITE_COLOR_SCHEMES>).map(scheme => (
                <button
                  key={scheme}
                  onClick={() => setSiteColorScheme(scheme)}
                  style={{
                    padding: 6,
                    border: siteColorScheme === scheme ? '2px solid #1e40af' : '1px solid #e5e7eb',
                    borderRadius: 4,
                    background: siteColorScheme === scheme ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  {renderSiteSwatch(scheme)}
                </button>
              ))}
            </div>
          </div>

          {/* Apply button */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: '100%',
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#1e40af',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 500
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
