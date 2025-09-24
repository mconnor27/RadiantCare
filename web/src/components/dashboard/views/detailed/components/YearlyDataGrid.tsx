import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactGrid, type Row } from '@silevis/reactgrid'
import '@silevis/reactgrid/styles.css'
import CollapsibleSection from '../../../shared/components/CollapsibleSection'
import { loadYearlyGridData, type CollapsibleState } from '../utils/yearlyDataTransformer'
import getDefaultValue from '../config/projectedDefaults'
import ProjectedValueSlider from './ProjectedValueSlider'

export default function YearlyDataGrid() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridData, setGridData] = useState<{ rows: Row[], columns: any[] }>({ rows: [], columns: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<CollapsibleState>({})
  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; x: number; y: number }>({
    show: false,
    text: '',
    x: 0,
    y: 0
  })
  
  // Slider state for projected value editing
  const [slider, setSlider] = useState<{
    isVisible: boolean
    position: { x: number; y: number }
    originPosition: { x: number; y: number }
    originRect?: { top: number; right: number; bottom: number; left: number; width: number; height: number }
    currentValue: number
    accountName: string
    rowIndex: number
    columnIndex: number
    annualizedBaseline: number
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    originPosition: { x: 0, y: 0 },
    originRect: undefined,
    currentValue: 0,
    accountName: '',
    rowIndex: -1,
    columnIndex: -1,
    annualizedBaseline: 0
  })
  
  // Store custom projected values that override the default calculations
  const [customProjectedValues, setCustomProjectedValues] = useState<Record<string, number>>({})

  // Fallback tooltip mapping by visible label text (without trailing asterisks and info icons)
  const tooltipByLabel: Record<string, string> = {
    'Non-Employment Costs': 'Insurance, Taxes, Communications, Licensure, Promotional, Billing, Office Overhead, Capital Expense',
    'MD Payroll': 'Employed MDs, Locums, Staff',
    'Misc Employment': 'Gifts, Profit Sharing, Relocation, Recruiting',
    '-$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$462,355': 'This 2016 interest income is displayed but excluded from all calculations and summaries to maintain operational focus.'
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await loadYearlyGridData(collapsedSections, customProjectedValues)
      setGridData(data)
    } catch (err) {
      console.error('Error loading yearly data:', err)
      setError('Failed to load yearly financial data')
    } finally {
      setLoading(false)
    }
  }, [collapsedSections, customProjectedValues])

  useEffect(() => {
    loadData()
  }, [loadData])

  // After data is loaded, scroll the horizontal container all the way to the right by default
  useEffect(() => {
    if (!loading && !error && gridData.columns.length > 0) {
      // Defer until after layout so widths are known
      const id = window.setTimeout(() => {
        const el = scrollContainerRef.current
        if (el) {
          el.scrollLeft = el.scrollWidth
        }
      }, 0)
      return () => window.clearTimeout(id)
    }
  }, [loading, error, gridData.columns])

  const handleCellClick = useCallback((rowId: string, columnId: string, event?: React.MouseEvent) => {
    console.log('handleCellClick called with:', { rowId, columnId })
    
    // Handle section collapse/expand for first column
    if (columnId === 'col-0' && rowId.startsWith('section-')) {
      console.log('Toggling section:', rowId)
      setCollapsedSections(prev => {
        const newState = {
          ...prev,
          [rowId]: !prev[rowId] // Toggle: undefined/false -> true, true -> false
        }
        console.log('New collapsed state:', newState)
        return newState
      })
      return
    }
    
    // Handle projected cell clicks (last column)
    const colIndex = parseInt(columnId.replace('col-', ''), 10)
    const parsed = parseInt(rowId.replace(/\D/g, ''), 10)
    const rowIndex = rowId === 'header' ? 0 : (rowId.startsWith('row-') ? parsed + 1 : parsed)
    const isProjectedColumn = gridData.columns && colIndex === gridData.columns.length - 1
    const isDataRow = rowIndex > 0 && !rowId.startsWith('section-') // Skip header and section rows
    
    if (isProjectedColumn && isDataRow && gridData.rows[rowIndex]) {
      const row = gridData.rows[rowIndex]
      const cell = row.cells[colIndex] as any
      const accountCell = row.cells[0] as any
      
      // Allow slider for Data rows (not computed, not therapy components) OR for Therapy Total summary
      const isRowTypeData = (cell?.rowType === 'Data')
      const isComputed = cell?.computedRow === true
      const accountText = (accountCell?.text || '').trim()
      const isSpacer = cell?.rowType === 'Spacer'
      const isTherapyTotalSummary = (cell?.rowType === 'Summary' && accountText === 'Total 7100 Therapy Income')
      const isTherapyComponent = accountText === '7105 Therapy - Lacey' || accountText === '7108 Therapy - Aberdeen' || accountText === '7110 Therapy - Centralia' || accountText === '7149 Refunds - Therapy'
      if (cell && accountCell && !isSpacer && (((isRowTypeData && !isComputed) && !isTherapyComponent) || isTherapyTotalSummary)) {
        console.log('Projected cell clicked:', { rowIndex, colIndex, accountName: accountCell.text })
        
        // Parse the displayed projected value (may be custom) and compute baseline
        const cellText = cell.text || '0'
        const currentValue = parseFloat(cellText.replace(/[$,\s]/g, '')) || 0
        
        // ALWAYS compute annualized baseline from YTD data (never changes based on overrides/defaults)
        const numCols = gridData.columns?.length || 0
        const ytdColIndex = numCols - 2
        let annualizedBaseline = 0
        try {
          const ytdCell = row.cells?.[ytdColIndex] as any
          const ytdText = (ytdCell?.text || '0').toString()
          const ytdNumeric = parseFloat(ytdText.replace(/[$,\s]/g, '')) || 0
          annualizedBaseline = ytdNumeric * 1.5
        } catch {
          annualizedBaseline = 0
        }
        
        // Get cell position and rect for slider placement
        let cellPosition = { x: 0, y: 0 }
        let cellRect = undefined
        if (event) {
          const target = event.target as HTMLElement
          const cellElement = target.closest('[data-cell-rowidx]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
          if (cellElement) {
            const rect = cellElement.getBoundingClientRect()
            // Convert viewport-relative coordinates to document-relative coordinates
            // by adding the current scroll position
            cellPosition = { 
              x: rect.right + window.scrollX, 
              y: rect.top + rect.height / 2 + window.scrollY 
            }
            cellRect = {
              top: rect.top + window.scrollY,
              right: rect.right + window.scrollX,
              bottom: rect.bottom + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
              height: rect.height
            }
          } else {
            // Also add scroll offset for fallback mouse position
            cellPosition = { 
              x: event.clientX + window.scrollX, 
              y: event.clientY + window.scrollY 
            }
          }
        }
        
        setSlider({
          isVisible: true,
          position: cellPosition,
          originPosition: cellPosition, // Use same position for origin
          originRect: cellRect,
          currentValue,
          accountName: accountCell.text || '',
          rowIndex,
          columnIndex: colIndex,
          annualizedBaseline
        })
      }
    }
  }, [gridData])
  
  const handleSliderClose = useCallback(() => {
    setSlider(prev => ({ ...prev, isVisible: false }))
  }, [])
  
  const handleProjectedValueChange = useCallback((newValue: number) => {
    const accountName = slider.accountName
    const annualizedBaseline = slider.annualizedBaseline
    const defaultValue = getDefaultValue(accountName, annualizedBaseline)

    const approximatelyEqual = (a: number, b: number) => Math.abs(Math.round(a) - Math.round(b)) <= 0

    // If user applied without changing, do nothing
    if (approximatelyEqual(newValue, slider.currentValue)) {
      return
    }

    setCustomProjectedValues(prev => {
      // Remove override only if matching default value
      if (approximatelyEqual(newValue, defaultValue)) {
        if (!prev[accountName]) return prev
        const { [accountName]: _removed, ...rest } = prev
        return rest
      }
      // Otherwise, set/replace override (including when set to annualized but different from default)
      return { ...prev, [accountName]: newValue }
    })
  }, [slider.accountName, slider.currentValue, slider.annualizedBaseline])

  return (
    <CollapsibleSection 
      title="Yearly Financial Data (2016-2025)"
      defaultOpen={false}
      tone="neutral"
    >
      <div style={{ 
        padding: '12px',
        background: '#fff',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        {loading ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6b7280' 
          }}>
            Loading yearly financial data...
          </div>
        ) : error ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#dc2626' 
          }}>
            {error}
          </div>
        ) : gridData.rows.length > 0 ? (
          <div ref={scrollContainerRef} style={{ 
            height: '800px', 
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '4px'
          }}>
            <div 
              style={{
                paddingRight: '8px',
                paddingBottom: '12px',
                minWidth: 'fit-content'
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                const cellElement = target.closest('[data-cell-rowidx]')
                if (cellElement) {
                  const rowIdx = cellElement.getAttribute('data-cell-rowidx')
                  const colIdx = cellElement.getAttribute('data-cell-colidx')
                  
                  if (rowIdx !== null && colIdx !== null) {
                    const rowIndex = parseInt(rowIdx, 10)
                    const colIndex = parseInt(colIdx, 10)
                    const row = gridData.rows[rowIndex]
                    const rowId = (row as any)?.rowId || `row-${rowIndex}`
                    const columnId = `col-${colIndex}`
                    
                    // Handle section clicks (first column)
                    if (colIndex === 0 && rowId.startsWith('section-')) {
                      console.log('Manual click detected for section:', rowId)
                      handleCellClick(rowId, columnId, e)
                    }
                    // Handle projected cell clicks (last column) 
                    else if (gridData.columns && colIndex === gridData.columns.length - 1) {
                      console.log('Manual click detected for projected cell:', { rowIndex, colIndex, rowId })
                      // Check row type from the cell to prevent non-Data rows and custom computed summary group rows
                      const row = gridData.rows[rowIndex]
                      const cell = row?.cells?.[colIndex] as any
                      const accountCell = row?.cells?.[0] as any
                      const accountText = (accountCell?.text || '').trim()
                      const isSpacer = cell?.rowType === 'Spacer'
                      const isTherapyTotalSummary = (cell?.rowType === 'Summary' && accountText === 'Total 7100 Therapy Income')
                      const isTherapyComponent = accountText === '7105 Therapy - Lacey' || accountText === '7108 Therapy - Aberdeen' || accountText === '7110 Therapy - Centralia' || accountText === '7149 Refunds - Therapy'
                      if (!isSpacer && (((cell?.rowType === 'Data' && cell?.computedRow !== true) && !isTherapyComponent) || isTherapyTotalSummary)) {
                        handleCellClick(rowId, columnId, e)
                      }
                    }
                  }
                }
              }}
              onMouseOver={(e) => {
                console.log('[mouseover] container')
                const target = e.target as HTMLElement
                const cellElement = target.closest('[data-cell-rowidx]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
                if (!cellElement) {
                  console.log('[mouseover] no cellElement found; target=', target.tagName, target.className)
                }
                if (cellElement) {
                  console.log('[mouseover] cellElement tag:', (cellElement as HTMLElement).tagName, 'class:', (cellElement as HTMLElement).className)
                  const rowIdx = cellElement.getAttribute('data-cell-rowidx')
                  const colIdx = cellElement.getAttribute('data-cell-colidx')
                  
                  // Check if this cell has tooltip data
                  if (rowIdx !== null && colIdx !== null) {
                    const rowIndex = parseInt(rowIdx, 10)
                    const colIndex = parseInt(colIdx, 10)
                    const cell = gridData.rows[rowIndex]?.cells?.[colIndex] as any
                    console.log('[mouseover] rowIdx:', rowIdx, 'colIdx:', colIdx, 'rowIndex:', rowIndex, 'colIndex:', colIndex)
                    
                    if (cell?.tooltip) {
                      console.log('[mouseover] tooltip found:', cell.tooltip)
                      const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                      setTooltip({
                        show: true,
                        text: cell.tooltip,
                        x: mouseEvent.clientX + 14,
                        y: mouseEvent.clientY + 8
                      })
                    } else {
                      console.log('[mouseover] no tooltip on cell')
                      // Fallback by visible text when tooltip metadata isn't present
                      const rawText = (cellElement as HTMLElement).textContent || ''
                      const normalized = rawText
                        .replace(/[▶▼]/g, '')      // remove expand/collapse glyphs
                        .replace(/^\s*\d+\s+/, '') // strip leading row numbers like '11 '
                        .replace(/\*+$/, '')        // strip trailing asterisks
                        .replace(/\s*ⓘ\s*$/, '')   // strip trailing info icons
                        .trim()
                      const fallback = tooltipByLabel[normalized]
                      console.log('[mouseover] fallback after no tooltip:', { rawText, normalized, hasFallback: !!fallback })
                      if (fallback) {
                        const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                        setTooltip({
                          show: true,
                          text: fallback,
                          x: mouseEvent.clientX + 14,
                          y: mouseEvent.clientY + 8
                        })
                      }
                    }
                  } else {
                    // No data attributes: always attempt fallback by visible label
                    const rawText = (cellElement as HTMLElement).textContent || ''
                    const normalized = rawText
                      .replace(/[▶▼]/g, '')
                      .replace(/^\s*\d+\s+/, '')
                      .replace(/\*+$/, '')
                      .replace(/\s*ⓘ\s*$/, '')
                      .trim()
                    const fallback = tooltipByLabel[normalized]
                    console.log('[mouseover] fallback no data attrs:', { rawText, normalized, hasFallback: !!fallback })
                    if (fallback) {
                      const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                      setTooltip({
                        show: true,
                        text: fallback,
                        x: mouseEvent.clientX + 14,
                        y: mouseEvent.clientY + 8
                      })
                    }
                  }
                }
              }}
              onMouseMove={(e) => {
                if (tooltip.show) {
                  const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                  setTooltip(prev => prev.show ? { ...prev, x: mouseEvent.clientX + 14, y: mouseEvent.clientY + 8 } : prev)
                }
              }}
              onMouseOut={() => {
                console.log('[mouseout] hide tooltip')
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              <ReactGrid
                rows={gridData.rows}
                columns={gridData.columns}
                enableRowSelection
                enableRangeSelection
                // Make all cells non-editable by default
                canReorderRows={() => false}
                canReorderColumns={() => false}
                // Freeze first column and first row like Excel
                stickyTopRows={1}
                stickyLeftColumns={1}
                // Freeze two right-most columns
                stickyRightColumns={2}
                // Handle cell clicks
                onFocusLocationChanged={(location) => {
                  console.log('Focus changed to:', location)
                  if (location?.rowId && location?.columnId === 'col-0' && typeof location.rowId === 'string' && location.rowId.startsWith('section-')) {
                    console.log('Section clicked via focus:', location.rowId)
                    handleCellClick(location.rowId, location.columnId)
                  }
                  // Debug tooltip retrieval on focus as well
                  try {
                    const rowId = location?.rowId as string
                    const colId = location?.columnId as string
                    if (rowId && colId) {
                      // For focus events, we still need to map from ReactGrid's internal IDs
                      // to our grid data structure indices
                      const parsed = parseInt(rowId.replace(/\D/g, ''), 10)
                      const rowIndex = rowId === 'header' ? 0 : (rowId.startsWith('row-') ? parsed + 1 : parsed)
                      const colIndex = parseInt(colId.replace(/\D/g, ''), 10)
                      const cell = (gridData.rows[rowIndex]?.cells?.[colIndex] as any)
                      console.log('[focus] rowId:', rowId, 'colId:', colId, 'rowIndex:', rowIndex, 'colIndex:', colIndex, 'tooltip:', cell?.tooltip)
                    }
                  } catch (e) {
                    console.log('[focus] tooltip debug error', e)
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6b7280' 
          }}>
            No yearly financial data available
          </div>
        )}
        
        {!loading && !error && gridData.rows.length > 0 && (
          <div style={{ 
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '24px',
            fontSize: '12px',
            color: '#374151'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '2px'
              }} />
              <span>Annualized Projection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '12px',
                backgroundColor: '#dcfce7',
                border: '1px solid #22c55e',
                borderRadius: '2px'
              }} />
              <span>Configured Default</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '12px',
                backgroundColor: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '2px'
              }} />
              <span>User Changed</span>
            </div>
          </div>
        )}
        
        {/* Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'absolute',
              top: tooltip.y,
              left: tooltip.x,
              transform: 'none',
              backgroundColor: '#1f2937',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              maxWidth: '250px',
              textAlign: 'left',
              zIndex: 1000,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'none'
            }}
          >
            {tooltip.text}
          </div>
        )}
        
        {/* Projected Value Slider */}
        <ProjectedValueSlider
          key={`slider-${slider.accountName}-${slider.annualizedBaseline}`}
          isVisible={slider.isVisible}
          onClose={handleSliderClose}
          currentValue={slider.currentValue}
          onValueChange={handleProjectedValueChange}
          accountName={slider.accountName}
          position={slider.position}
          originPosition={slider.originPosition}
          originRect={slider.originRect}
          annualizedBaseline={slider.annualizedBaseline}
        />
      </div>
    </CollapsibleSection>
  )
}

