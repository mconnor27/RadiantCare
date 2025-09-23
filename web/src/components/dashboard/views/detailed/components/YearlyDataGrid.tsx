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
            <div onClick={(e) => {
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
            }}>
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
      </div>
    </CollapsibleSection>
  )
}

