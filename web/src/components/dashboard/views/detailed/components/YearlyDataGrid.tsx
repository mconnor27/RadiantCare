import { useState, useEffect, useCallback } from 'react'
import { ReactGrid, type Row } from '@silevis/reactgrid'
import '@silevis/reactgrid/styles.css'
import CollapsibleSection from '../../../shared/components/CollapsibleSection'
import { loadYearlyGridData, type CollapsibleState } from '../utils/yearlyDataTransformer'

export default function YearlyDataGrid() {
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
      const data = await loadYearlyGridData(collapsedSections)
      setGridData(data)
    } catch (err) {
      console.error('Error loading yearly data:', err)
      setError('Failed to load yearly financial data')
    } finally {
      setLoading(false)
    }
  }, [collapsedSections])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    console.log('handleCellClick called with:', { rowId, columnId })
    // Only handle clicks on the first column (account names) for collapsible sections
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
    }
  }, [])

  return (
    <CollapsibleSection 
      title="Yearly Financial Data (2016-2024)"
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
          <div style={{ 
            height: '600px', 
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '4px'
          }}>
            <div 
              onClick={(e) => {
                // Backup click handler - try to detect section clicks manually
                const target = e.target as HTMLElement
                const cellElement = target.closest('[data-testid^="rg-cell-"]')
                if (cellElement) {
                  const testId = cellElement.getAttribute('data-testid')
                  const rowId = testId?.match(/rg-cell-(\S+)-/)?.[1]
                  const colId = testId?.match(/-(\S+)$/)?.[1]
                  if (rowId && colId === 'col-0' && rowId.startsWith('section-')) {
                    console.log('Manual click detected for section:', rowId)
                    handleCellClick(rowId, colId)
                  }
                }
              }}
              onMouseOver={(e) => {
                console.log('[mouseover] container')
                const target = e.target as HTMLElement
                const cellElement = target.closest('[data-testid^="rg-cell-"]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
                if (!cellElement) {
                  console.log('[mouseover] no cellElement found; target=', target.tagName, target.className)
                }
                if (cellElement) {
                  console.log('[mouseover] cellElement tag:', (cellElement as HTMLElement).tagName, 'class:', (cellElement as HTMLElement).className)
                  const testId = cellElement.getAttribute('data-testid')
                  const rowId = testId?.match(/rg-cell-(\S+)-/)?.[1]
                  const colId = testId?.match(/-(\S+)$/)?.[1]
                  
                  // Check if this cell has tooltip data
                  if (rowId && colId) {
                    // Our ReactGrid rows array includes the header at index 0.
                    // The generated rowIds for data rows are typically like 'row-<n>' or 'section-<n>'.
                    // We will try to map rowId to index; if parsing fails, fall back to searching by content.
                    const parsed = parseInt(rowId.replace(/\D/g, ''), 10)
                    const rowIndex = rowId === 'header' || Number.isNaN(parsed) ? 0 : parsed
                    const colIndex = parseInt(colId.replace(/\D/g, ''), 10)
                    const cell = gridData.rows[rowIndex]?.cells?.[colIndex] as any
                    console.log('[mouseover] testId:', testId, 'rowId:', rowId, 'colId:', colId, 'rowIndex:', rowIndex, 'colIndex:', colIndex)
                    
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
                    // No testId path: always attempt fallback by visible label
                    const rawText = (cellElement as HTMLElement).textContent || ''
                    const normalized = rawText
                      .replace(/[▶▼]/g, '')
                      .replace(/^\s*\d+\s+/, '')
                      .replace(/\*+$/, '')
                      .replace(/\s*ⓘ\s*$/, '')
                      .trim()
                    const fallback = tooltipByLabel[normalized]
                    console.log('[mouseover] fallback no testId:', { rawText, normalized, hasFallback: !!fallback })
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
                      const rowIndex = rowId === 'header' ? 0 : parseInt(rowId.replace(/\D/g, ''), 10)
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
            marginTop: '8px',
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Read-only view • {gridData.rows.length - 1} data rows • Click ▶/▼ to expand/collapse sections
          </div>
        )}
        
        {/* Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'fixed',
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
      </div>
    </CollapsibleSection>
  )
}

