import { type Row } from '@silevis/reactgrid'

// Type for tracking collapsed sections
export type CollapsibleState = Record<string, boolean>

// Types for the yearly JSON data
interface YearlyData {
  Header: {
    ReportName: string
    ReportBasis: string
    StartPeriod: string
    EndPeriod: string
    SummarizeColumnsBy: string
    Currency: string
  }
  Columns: {
    Column: Array<{
      ColTitle: string
      ColType: string
    }>
  }
  Rows: {
    Row: Array<{
      Header?: { ColData: Array<{ value: string }> }
      Rows?: { Row: Array<any> }
      Summary?: { ColData: Array<{ value: string }> }
      ColData?: Array<{ value: string }>
      type?: string
      group?: string
    }>
  }
}

// Flatten nested row structure with section identification
function flattenRows(rows: any[], level = 0, parentGroup?: string, sectionCounter = { count: 0 }): any[] {
  const flattened: any[] = []
  
  for (const row of rows) {
    // Add header row if it exists (these are typically section headers)
    if (row.Header?.ColData) {
      const headerText = row.Header.ColData[0]?.value || ''
      // Consider any non-empty header text as a potential section
      const isSection = headerText && !headerText.match(/^\s*$/) && headerText.trim().length > 0
      const sectionId = isSection ? `section-${sectionCounter.count++}` : undefined
      
      if (isSection) {
        console.log('Creating section:', headerText, 'with ID:', sectionId, 'at level:', level)
      }
      
      flattened.push({
        colData: row.Header.ColData,
        type: isSection ? 'Section' : 'Header',
        level,
        group: row.group || parentGroup,
        sectionId,
        isCollapsible: isSection
      })
    }
    
    // Add data rows if they exist
    if (row.ColData) {
      flattened.push({
        colData: row.ColData,
        type: row.type || 'Data',
        level,
        group: row.group || parentGroup
      })
    }
    
    // Recursively process nested rows
    if (row.Rows?.Row) {
      flattened.push(...flattenRows(row.Rows.Row, level + 1, row.group || parentGroup, sectionCounter))
    }
    
    // Add summary row if it exists
    if (row.Summary?.ColData) {
      flattened.push({
        colData: row.Summary.ColData,
        type: 'Summary',
        level,
        group: row.group || parentGroup
      })
    }
  }
  
  return flattened
}

// Filter rows based on collapsed sections
function filterCollapsedRows(rows: any[], collapsedSections: CollapsibleState): any[] {
  console.log('Filtering rows with collapsed sections:', collapsedSections)
  const filteredRows: any[] = []
  let skipUntilLevel: number | null = null
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    // If we're skipping, check if we should stop skipping
    if (skipUntilLevel !== null) {
      console.log(`Skipping row ${i}: ${row.colData[0]?.value} (level ${row.level}) - waiting for Summary at level ${skipUntilLevel} or higher`)
      // Stop skipping when we reach a Summary row at the same level or higher
      if (row.type === 'Summary' && row.level <= skipUntilLevel) {
        console.log(`Found Summary at level ${row.level}, stopping skip`)
        skipUntilLevel = null
        filteredRows.push(row)
        continue
      }
      // Skip this row
      continue
    }
    
    // Check if this is a collapsed section
    if (row.type === 'Section' && row.sectionId && collapsedSections[row.sectionId] === true) {
      console.log(`Section ${row.sectionId} (${row.colData[0]?.value}) is collapsed, starting skip at level ${row.level}`)
      // This section is collapsed, skip everything until the next Summary at the same level
      skipUntilLevel = row.level
    }
    
    filteredRows.push(row)
  }
  
  console.log(`Filtered from ${rows.length} to ${filteredRows.length} rows`)
  return filteredRows
}

export function transformYearlyDataToGrid(data: YearlyData, collapsedSections: CollapsibleState = {}): { rows: Row[], columns: any[] } {
  // Extract column titles and format them
  const columnTitles = data.Columns.Column.map(col => {
    const title = col.ColTitle || 'Account'
    // Clean up year titles for better display
    if (title.includes('Jan - Dec')) {
      const year = title.replace('Jan - Dec ', '')
      return `${year}`
    }
    return title
  })
  
  // Create header row with better styling
  const headerRow: Row = {
    rowId: 'header',
    cells: columnTitles.map((title, index) => ({
      type: 'header',
      text: title,
      style: {
        fontWeight: 'bold',
        background: index === 0 ? '#f3f4f6' : '#e5e7eb',
        fontSize: '16px',
        padding: '6px'
      }
    }))
  }
  
  // Flatten and transform data rows
  const flattenedRows = flattenRows(data.Rows.Row)
  
  // Filter out collapsed sections
  const visibleRows = filterCollapsedRows(flattenedRows, collapsedSections)
  
  // Currency formatting function
  const formatCurrency = (value: string): string => {
    if (!value || value === '') return ''
    
    // Remove existing currency symbols and commas
    const cleanValue = value.replace(/[$,\s]/g, '')
    const numValue = parseFloat(cleanValue)
    
    if (isNaN(numValue)) return value
    
    // If the value is zero, return empty string
    if (numValue === 0) return ''
    
    // Format as currency with no decimals
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(numValue))
  }

  const dataRows: Row[] = visibleRows.map((row, index) => {
    const cells = row.colData.map((cellData: any, cellIndex: number) => {
      let value = cellData.value || ''
      
      // Add visual indicators for collapsible sections in the first column
      if (cellIndex === 0 && row.type === 'Section' && row.isCollapsible) {
        const isCollapsed = collapsedSections[row.sectionId] === true
        const indicator = isCollapsed ? '▶ ' : '▼ '
        value = indicator + value
      }
      
      const isNumeric = cellIndex > 0 && value && !isNaN(parseFloat(value.replace(/[,$▶▼\s]/g, '')))
      const formattedValue = isNumeric ? formatCurrency(value) : value
      
      // Right-align all columns except the first column (account names)
      const shouldRightAlign = cellIndex > 0
      
      // Style based on row type and level
      let backgroundColor = '#ffffff'
      let fontWeight = 'normal'
      let fontSize = '12px'
      let paddingLeft = row.level * 12
      let cursor = 'default'
      
      if (row.type === 'Header' || row.type === 'Section') {
        backgroundColor = '#f9fafb'
        fontWeight = 'bold'
        fontSize = '14px' // Smaller font for section headers like "Total Income"
        
        // Make section rows clickable in the first column
        if (row.type === 'Section' && cellIndex === 0) {
          cursor = 'pointer'
          backgroundColor = '#e0f2fe'
        }
      } else if (row.type === 'Summary') {
        backgroundColor = '#f3f4f6'
        fontWeight = 'bold'
        fontSize = '14px' // Smaller font for summary rows
      }
      
      return {
        type: 'text',
        text: formattedValue,
        nonEditable: true,
        style: {
          background: backgroundColor,
          fontWeight,
          paddingLeft: cellIndex === 0 ? `${paddingLeft + 6}px` : '6px',
          paddingRight: '6px',
          paddingTop: '4px',
          paddingBottom: '4px',
          textAlign: shouldRightAlign ? 'right' : 'left',
          fontSize: fontSize,
          cursor: cursor,
          // Force text alignment with additional properties
          justifyContent: shouldRightAlign ? 'flex-end' : 'flex-start',
          display: 'flex',
          alignItems: 'center'
        }
      }
    })
    
    const rowId = row.sectionId || `row-${index}`
    if (row.type === 'Section') {
      console.log('Generated section row with ID:', rowId, 'for text:', row.colData[0]?.value)
    }
    
    return {
      rowId,
      cells
    }
  })
  
  const columns = columnTitles.map((_, index) => ({
    columnId: `col-${index}`,
    width: index === 0 ? 350 : index === columnTitles.length - 1 ? 140 : 100 // Account column wider, Total column slightly wider
  }))
  
  return {
    rows: [headerRow, ...dataRows],
    columns
  }
}

// Load and transform the yearly data
export async function loadYearlyGridData(collapsedSections: CollapsibleState = {}): Promise<{ rows: Row[], columns: any[] }> {
  try {
    // Import the JSON data
    const yearlyData = await import('../../../../../historical_data/2016-2024_yearly.json')
    return transformYearlyDataToGrid(yearlyData.default || yearlyData, collapsedSections)
  } catch (error) {
    console.error('Failed to load yearly data:', error)
    return { rows: [], columns: [] }
  }
}
