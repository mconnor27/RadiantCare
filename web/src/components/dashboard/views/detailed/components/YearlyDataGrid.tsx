import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactGrid, type Row } from '@silevis/reactgrid'
import '@silevis/reactgrid/styles.css'
import CollapsibleSection from '../../../shared/components/CollapsibleSection'
import { loadYearlyGridData, debugSummaryCalculations, type CollapsibleState } from '../utils/yearlyDataTransformer'
import getDefaultValue from '../config/projectedDefaults'
import ProjectedValueSlider from './ProjectedValueSlider'
import { useDashboardStore } from '../../../../Dashboard'

// Mapping from grid account names to multiyear field names
// Using normalized names to be robust against whitespace, info icons, etc.
const GRID_TO_MULTIYEAR_MAPPING: Record<string, string> = {
  'Misc Employment': 'miscEmploymentCosts',
  'Medical Director Hours (Shared)': 'medicalDirectorHours', 
  'Medical Director Hours (PRCS)': 'prcsMedicalDirectorHours',
  'Consulting Agreement/Other': 'consultingServicesAgreement',
  'Non-Employment Costs': 'nonEmploymentCosts',
  'Staff Employment': 'nonMdEmploymentCosts'
}

// Special handling for Therapy Income (sum of two rows)
const THERAPY_INCOME_COMPONENTS = ['Total 7100 Therapy Income', 'Total Other Income']

// Calculate projection ratio from 2025 data - same logic as yearlyDataTransformer
async function calculateProjectionRatio(cached2025?: any): Promise<number> {
  try {
    let data2025: any
    if (cached2025) {
      data2025 = cached2025
    } else {
      const data2025Module = await import('../../../../../historical_data/2025_summary.json')
      data2025 = data2025Module.default || data2025Module
    }
    
    const startPeriod = data2025.Header.StartPeriod
    const endPeriod = data2025.Header.EndPeriod
    
    if (!startPeriod || !endPeriod) {
      console.warn('Missing date information in 2025 data, falling back to 1.5 multiplier')
      return 1.5
    }
    
    const startDate = new Date(startPeriod)
    const endDate = new Date(endPeriod)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('Invalid date format in 2025 data, falling back to 1.5 multiplier')
      return 1.5
    }
    
    if (endDate <= startDate) {
      console.warn('Invalid date range in 2025 data, falling back to 1.5 multiplier')
      return 1.5
    }
    
    const dataPeriodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const fullYearDays = 365
    const projectionRatio = fullYearDays / dataPeriodDays
    
    console.log(`YearlyDataGrid - Data period: ${startPeriod} to ${endPeriod} (${dataPeriodDays} days)`)
    console.log(`YearlyDataGrid - Projection ratio: ${projectionRatio.toFixed(3)} (${fullYearDays}/${dataPeriodDays})`)
    
    return projectionRatio
  } catch (error) {
    console.warn('Failed to calculate projection ratio, falling back to 1.5 multiplier:', error)
    return 1.5
  }
}

// Robust normalization function matching the one used in yearlyDataTransformer
const normalizeAccountName = (label: string): string => {
  return (label || '')
    .replace(/\s*[ⓘℹ]\s*$/, '') // Remove info icons
    .replace(/^\s+/, '') // Remove leading whitespace
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim() // Remove trailing whitespace
}

// Function to sync grid projected values to multiyear store
function syncGridValuesToMultiyear(
  store: any,
  customProjectedValues: Record<string, number>,
  gridData: { rows: any[], columns: any[] }
) {
  console.log('[RESET DEBUG] 🔄 syncGridValuesToMultiyear called')
  // console.log('📊 Grid data rows count:', gridData.rows?.length || 0)
  // console.log('🎛️ Custom projected values:', customProjectedValues)
  
  try {
    // Helper to get current projected value for an account
    const getProjectedValue = (accountName: string): number => {
      // First check if there's a custom value (use normalized name as key)
      const normalizedAccountName = normalizeAccountName(accountName)
      
      // Check both normalized and original name in custom values
      if (customProjectedValues[accountName] !== undefined) {
        return customProjectedValues[accountName]
      }
      if (customProjectedValues[normalizedAccountName] !== undefined) {
        return customProjectedValues[normalizedAccountName]
      }
      
      // Otherwise, get the value from the grid data (last column - projected)
      const projectedColIndex = gridData.columns.length - 1
      
      // Find FIRST matching row (prioritizes main table over summary rows)
      // This handles the duplicate names issue
      const row = gridData.rows.find((row: any) => {
        const accountCell = row.cells?.[0] as any
        const cellText = accountCell?.text?.trim() || ''
        
        // Try exact match first
        if (cellText === accountName) return true
        
        // Then try normalized match
        const normalizedCellText = normalizeAccountName(cellText)
        const normalizedSearchName = normalizeAccountName(accountName)
        return normalizedCellText === normalizedSearchName
      })
      
      if (row) {
        const projectedCell = row.cells?.[projectedColIndex] as any
        const cellText = projectedCell?.text || '0'
        const value = parseFloat(cellText.replace(/[$,\s]/g, '')) || 0
        // console.log(`📋 Found "${accountName}" -> "${normalizeAccountName(accountName)}" = ${value}`)
        return value
      } else {
        // console.log(`❌ No match found for "${accountName}" -> "${normalizeAccountName(accountName)}"`)
      }
      
      return 0
    }

    // Handle individual field mappings with robust normalization
    Object.entries(GRID_TO_MULTIYEAR_MAPPING).forEach(([gridAccountName, multiyearField]) => {
      const value = getProjectedValue(gridAccountName)
      
      // ALWAYS sync grid values to store for compensation calculations
      console.log(`[RESET DEBUG] ✅ Syncing ${multiyearField} = ${value}`)
      
      // Update both scenarios A and B for 2025
      try {
        store.setFutureValue('A', 2025, multiyearField, value)
        if (store.scenarioBEnabled) {
          store.setFutureValue('B', 2025, multiyearField, value)
        }
        // console.log(`   ✅ Successfully updated ${multiyearField} = ${value}`)
      } catch (error) {
        console.error(`[RESET DEBUG]    ❌ Failed to update ${multiyearField}:`, error)
      }
    })

    // Handle special case: Therapy Income (sum of two components) with robust normalization
    let therapyIncomeTotal = 0
    const therapyComponents: { name: string, normalized: string, value: number }[] = []
    
    THERAPY_INCOME_COMPONENTS.forEach(componentName => {
      const componentValue = getProjectedValue(componentName)
      const normalizedComponentName = normalizeAccountName(componentName)
      therapyComponents.push({ 
        name: componentName, 
        normalized: normalizedComponentName, 
        value: componentValue 
      })
      
      therapyIncomeTotal += componentValue
    })
    
    console.log(`[RESET DEBUG] ✅ Syncing therapyIncome = ${therapyIncomeTotal}`)
    
    // ALWAYS sync therapy income total
    try {
      store.setFutureValue('A', 2025, 'therapyIncome', therapyIncomeTotal)
      if (store.scenarioBEnabled) {
        store.setFutureValue('B', 2025, 'therapyIncome', therapyIncomeTotal)
      }
    } catch (error) {
      console.error(`[RESET DEBUG]    ❌ Failed to update therapyIncome:`, error)
    }

    // Additionally sync per-site therapy projected totals to store for per-site projections
    try {
      const lacey = getProjectedValue('7105 Therapy - Lacey')
      const centralia = getProjectedValue('7110 Therapy - Centralia')
      const aberdeen = getProjectedValue('7108 Therapy - Aberdeen')
      // console.log(`🏥 Per-site projected therapy from grid → Lacey=${lacey}, Centralia=${centralia}, Aberdeen=${aberdeen}`)
      store.setFutureValue('A', 2025, 'therapyLacey', lacey)
      store.setFutureValue('A', 2025, 'therapyCentralia', centralia)
      store.setFutureValue('A', 2025, 'therapyAberdeen', aberdeen)
      if (store.scenarioBEnabled) {
        store.setFutureValue('B', 2025, 'therapyLacey', lacey)
        store.setFutureValue('B', 2025, 'therapyCentralia', centralia)
        store.setFutureValue('B', 2025, 'therapyAberdeen', aberdeen)
      }
    } catch (error) {
      console.error('[RESET DEBUG]    ❌ Failed to sync per-site therapy values to store:', error)
    }
    
  } catch (error) {
    console.error('Error syncing grid values to multiyear store:', error)
  }
}

interface YearlyDataGridProps {
  environment?: 'production' | 'sandbox'
  cachedSummary?: any
}

export default function YearlyDataGrid({
  environment = 'sandbox',
  cachedSummary
}: YearlyDataGridProps = {}) {
  const store = useDashboardStore()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridData, setGridData] = useState<{ rows: Row[], columns: any[] }>({ rows: [], columns: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<CollapsibleState>({})
  const [projectionRatio, setProjectionRatio] = useState<number>(1.5) // Default fallback
  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; x: number; y: number }>({
    show: false,
    text: '',
    x: 0,
    y: 0
  })

  // Debug tooltip state changes
  // useEffect(() => {
  //   console.log('[tooltip state]', tooltip)
  // }, [tooltip])
  
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
  
  // Get custom projected values from store (now persisted across navigation)
  const customProjectedValues = store.customProjectedValues

  // Fallback tooltip mapping by visible label text (without trailing asterisks and info icons)
  const tooltipByLabel: Record<string, string> = {
    'Non-Employment Costs': 'Insurance, Taxes, Communications, Licensure, Promotional, Billing, Office Overhead, Capital Expense',
    'MD Payroll': 'Employed MDs, Locums, Staff',
    'Misc Employment': 'Gifts, Profit Sharing, Relocation, Recruiting',
    '8322 MD Associates - Salary': 'This value is automatically calculated from the sum of employee and part-employee physician salaries in the physician panel. This row is not editable.',
    '8325 MD Associates - Benefits': 'This value is automatically calculated from the sum of employee and part-employee physician benefits in the physician panel. This row is not editable.',
    '8330 MD Associates - Payroll Taxes': 'This value is automatically calculated from the sum of employee and part-employee physician payroll taxes in the physician panel. This row is not editable.',
    '8343 Guaranteed Payments': 'This value is automatically calculated from the sum of retiring partner buyout costs in the physician panel. This row is not editable.',
    '8322 Locums - Salary': 'This value is automatically calculated from the locums costs setting in the physician panel. This row is not editable.',
    '-$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$462,355': 'This 2016 interest income is displayed but excluded from all calculations and summaries to maintain operational focus.'
  }

  // Helper function to check if account is a calculated row (MD Associates, Guaranteed Payments, or Locums)
  const isCalculatedAccount = (accountName: string): boolean => {
    const normalized = normalizeAccountName(accountName)
    return normalized.match(/8322.*MD.*Associates.*Salary/i) ||
           normalized.match(/8325.*MD.*Associates.*Benefits/i) ||
           normalized.match(/8330.*MD.*Associates.*Payroll.*Tax/i) ||
           normalized.match(/8343.*Guaranteed.*Payments/i) ||
           normalized.match(/8322.*Locums.*Salary/i) ? true : false
  }
  

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get 2025 physician data and benefit growth rate from store
      const fy2025 = store.scenarioA.future.find((f: any) => f.year === 2025)
      const physicianData = fy2025 ? {
        physicians: fy2025.physicians,
        benefitGrowthPct: store.scenarioA.projection.benefitCostsGrowthPct,
        locumCosts: fy2025.locumCosts
      } : undefined
      
      // Load both the grid data and the projection ratio
      const cachedSummaryData = (environment === 'production' && cachedSummary) ? cachedSummary : undefined
      const [data, ratio] = await Promise.all([
        loadYearlyGridData(collapsedSections, store.customProjectedValues, physicianData, cachedSummaryData),
        calculateProjectionRatio(cachedSummaryData)
      ])
      
      setGridData(data)
      setProjectionRatio(ratio)
      
      // Debug summary calculations
      // console.log('🔍 Running summary calculation debugging...')
      debugSummaryCalculations(data, store.customProjectedValues)
      
      // Always sync grid values to store on initial load for compensation calculations
      setTimeout(() => {
        // Skip sync if suppression flag is set (e.g., during reset operations)
        if ((store as any).suppressNextGridSync) {
          console.log('⏰ [RESET DEBUG] Initial grid sync SKIPPED (suppressed)')
          ;(store as any).suppressNextGridSync = false
          return
        }

        console.log('⏰ [RESET DEBUG] Initial grid sync started')
        syncGridValuesToMultiyear(store, store.customProjectedValues, data)
        console.log('⏰ [RESET DEBUG] Initial grid sync completed')
      }, 100)
    } catch (err) {
      console.error('Error loading yearly data:', err)
      setError('Failed to load yearly financial data')
    } finally {
      setLoading(false)
    }
  }, [collapsedSections, store.customProjectedValues, store.scenarioA.future, store.scenarioA.projection.benefitCostsGrowthPct, store, environment, cachedSummary])

  useEffect(() => {
    loadData()
  }, [loadData])

  // After data is loaded, scroll the horizontal container all the way to the right by default
  useEffect(() => {
    if (!loading && !error && gridData.columns.length > 0) {
      // Defer until after layout so widths are known, with multiple attempts for sticky columns
      const scrollToRight = () => {
        const el = scrollContainerRef.current
        if (el) {
          console.log('Auto-scroll attempt:', { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, currentScrollLeft: el.scrollLeft })
          el.scrollLeft = el.scrollWidth - el.clientWidth
          console.log('Auto-scroll result:', { newScrollLeft: el.scrollLeft })
        }
      }
      
      // Try immediately, then again after a short delay for sticky column rendering
      const id1 = window.setTimeout(scrollToRight, 0)
      const id2 = window.setTimeout(scrollToRight, 100)
      
      return () => {
        window.clearTimeout(id1)
        window.clearTimeout(id2)
      }
    }
  }, [loading, error, gridData.columns])

  // Helper function to calculate smart tooltip position that avoids going off-screen
  const calculateTooltipPosition = useCallback((mouseX: number, mouseY: number, tooltipWidth: number = 300, tooltipHeight: number = 100) => {
    const offset = 14
    const padding = 10 // Distance from screen edge

    let x = mouseX + offset
    let y = mouseY + 8

    // Check right edge
    if (x + tooltipWidth > window.innerWidth - padding) {
      x = mouseX - tooltipWidth - offset // Position to left of cursor
    }

    // Check bottom edge
    if (y + tooltipHeight > window.innerHeight - padding) {
      y = mouseY - tooltipHeight - 8 // Position above cursor
    }

    // Check left edge
    if (x < padding) {
      x = padding
    }

    // Check top edge
    if (y < padding) {
      y = padding
    }

    return { x, y }
  }, [])

  const handleCellClick = useCallback((rowId: string, columnId: string, event?: React.MouseEvent) => {
    // console.log('handleCellClick called with:', { rowId, columnId })
    
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
      const isCalculatedRow = isCalculatedAccount(accountText)
      if (cell && accountCell && !isSpacer && !isCalculatedRow && (((isRowTypeData && !isComputed) && !isTherapyComponent) || isTherapyTotalSummary)) {
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
          annualizedBaseline = ytdNumeric * projectionRatio
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

    // Update custom projected values using store methods
    if (approximatelyEqual(newValue, defaultValue)) {
      // Remove override if matching default value
      if (customProjectedValues[accountName] !== undefined) {
        store.removeCustomProjectedValue(accountName)
      }
    } else {
      // Set/replace override (including when set to annualized but different from default)
      store.setCustomProjectedValue(accountName, newValue)
    }
    
      // Trigger immediate sync to multiyear store after value change
      // Use setTimeout to allow any dynamic recalculations to complete first
      setTimeout(() => {
        if (gridData.rows.length > 0) {
          // console.log('🎯 Syncing after projected value change...')
          syncGridValuesToMultiyear(store, store.customProjectedValues, gridData)
        }
      }, 50) // Short delay to allow dynamic calculations to complete
  }, [slider.accountName, slider.currentValue, slider.annualizedBaseline, store.customProjectedValues, gridData, store])

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
            height: '1200px', 
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
              data-form="false"
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
                      const isCalculatedRow = isCalculatedAccount(accountText)
                      if (!isSpacer && !isCalculatedRow && (((cell?.rowType === 'Data' && cell?.computedRow !== true) && !isTherapyComponent) || isTherapyTotalSummary)) {
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
                      console.log('[mouseover] tooltip positioning:', { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY })
                      const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                      setTooltip({
                        show: true,
                        text: cell.tooltip,
                        x: pos.x,
                        y: pos.y
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
                      
                      let fallback = tooltipByLabel[normalized]
                      
                      // Special handling for calculated rows with info icons
                      if (!fallback && isCalculatedAccount(rawText)) {
                        console.log('[mouseover] Calculated row detected:', rawText)
                        if (rawText.match(/8322.*MD.*Associates.*Salary/i)) {
                          fallback = 'This value is automatically calculated from the sum of employee and part-employee physician salaries in the physician panel. This row is not editable.'
                        } else if (rawText.match(/8325.*MD.*Associates.*Benefits/i)) {
                          fallback = 'This value is automatically calculated from the sum of employee and part-employee physician benefits in the physician panel. This row is not editable.'
                        } else if (rawText.match(/8330.*MD.*Associates.*Payroll.*Tax/i)) {
                          fallback = 'This value is automatically calculated from the sum of employee and part-employee physician payroll taxes in the physician panel. This row is not editable.'
                        } else if (rawText.match(/8343.*Guaranteed.*Payments/i)) {
                          fallback = 'This value is automatically calculated from the sum of retiring partner buyout costs in the physician panel. This row is not editable.'
                        } else if (rawText.match(/8322.*Locums.*Salary/i)) {
                          fallback = 'This value is automatically calculated from the locums costs setting in the physician panel. This row is not editable.'
                        }
                      }
                      
                      console.log('[mouseover] fallback after no tooltip:', { rawText, normalized, hasFallback: !!fallback })
                      if (fallback) {
                        const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                        const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                        console.log('[mouseover] setting fallback tooltip:', { text: fallback, x: pos.x, y: pos.y })
                        setTooltip({
                          show: true,
                          text: fallback,
                          x: pos.x,
                          y: pos.y
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
                    
                    let fallback = tooltipByLabel[normalized]
                    
                    // Special handling for calculated rows with info icons
                    if (!fallback && isCalculatedAccount(rawText)) {
                      console.log('[mouseover] Calculated row detected (no data attrs):', rawText)
                      if (rawText.match(/8322.*MD.*Associates.*Salary/i)) {
                        fallback = 'This value is automatically calculated from the sum of employee and part-employee physician salaries in the physician panel. This row is not editable.'
                      } else if (rawText.match(/8325.*MD.*Associates.*Benefits/i)) {
                        fallback = 'This value is automatically calculated from the sum of employee and part-employee physician benefits in the physician panel. This row is not editable.'
                      } else if (rawText.match(/8330.*MD.*Associates.*Payroll.*Tax/i)) {
                        fallback = 'This value is automatically calculated from the sum of employee and part-employee physician payroll taxes in the physician panel. This row is not editable.'
                      } else if (rawText.match(/8343.*Guaranteed.*Payments/i)) {
                        fallback = 'This value is automatically calculated from the sum of retiring partner buyout costs in the physician panel. This row is not editable.'
                      } else if (rawText.match(/8322.*Locums.*Salary/i)) {
                        fallback = 'This value is automatically calculated from the locums costs setting in the physician panel. This row is not editable.'
                      }
                    }
                    
                    console.log('[mouseover] fallback no data attrs:', { rawText, normalized, hasFallback: !!fallback })
                    if (fallback) {
                      const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                      const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                      console.log('[mouseover] setting fallback tooltip (no data attrs):', { text: fallback, x: pos.x, y: pos.y })
                      setTooltip({
                        show: true,
                        text: fallback,
                        x: pos.x,
                        y: pos.y
                      })
                    }
                  }
                }
              }}
              onMouseMove={(e) => {
                if (tooltip.show) {
                  const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                  const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                  setTooltip(prev => prev.show ? { ...prev, x: pos.x, y: pos.y } : prev)
                }
              }}
              onMouseOut={() => {
                console.log('[mouseout] hide tooltip')
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
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
                  stickyRightColumns={1}
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
              </form>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '12px',
                backgroundColor: '#f3e8ff',
                border: '1px solid #d8b4fe',
                borderRadius: '2px'
              }} />
              <span>Set In Physician Panel</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
                width: '20px',
                height: '20px',
                border: '1px solid #ccc',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa'
              }}
              onMouseEnter={(e) => {
                const mouseEvent = e as unknown as { clientX: number; clientY: number }
                const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                setTooltip({
                  show: true,
                  text: 'Click any projected value (rightmost column) to adjust it. The cell background color indicates how the value was determined.',
                  x: pos.x,
                  y: pos.y
                })
              }}
              onMouseMove={(e) => {
                const mouseEvent = e as unknown as { clientX: number; clientY: number }
                const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                setTooltip(prev => prev.show ? { ...prev, x: pos.x, y: pos.y } : prev)
              }}
              onMouseLeave={() => {
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
            </div>
          </div>
        )}
        
        {/* Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'fixed', // Changed from absolute to fixed for proper positioning
              top: tooltip.y,
              left: tooltip.x,
              transform: 'none',
              backgroundColor: '#1f2937',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              maxWidth: '300px',
              textAlign: 'left',
              zIndex: 9999, // Increased z-index to ensure it's on top
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'none',
              wordWrap: 'break-word',
              whiteSpace: 'pre-line'
            }}
            onMouseEnter={() => console.log('[tooltip] tooltip rendered with text:', tooltip.text)}
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

