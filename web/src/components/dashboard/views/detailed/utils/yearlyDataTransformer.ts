import { type Row } from '@silevis/reactgrid'

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

// Flatten nested row structure
function flattenRows(rows: any[], level = 0, parentGroup?: string): any[] {
  const flattened: any[] = []
  
  for (const row of rows) {
    // Add header row if it exists
    if (row.Header?.ColData) {
      flattened.push({
        colData: row.Header.ColData,
        type: row.type || 'Header',
        level,
        group: row.group || parentGroup
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
      flattened.push(...flattenRows(row.Rows.Row, level + 1, row.group || parentGroup))
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

export function transformYearlyDataToGrid(data: YearlyData): { rows: Row[], columns: any[] } {
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

  const dataRows: Row[] = flattenedRows.map((row, index) => {
    const cells = row.colData.map((cellData: any, cellIndex: number) => {
      const value = cellData.value || ''
      const isNumeric = cellIndex > 0 && value && !isNaN(parseFloat(value.replace(/[,$]/g, '')))
      const formattedValue = isNumeric ? formatCurrency(value) : value
      
      // Right-align all columns except the first column (account names)
      const shouldRightAlign = cellIndex > 0
      
      // Style based on row type and level
      let backgroundColor = '#ffffff'
      let fontWeight = 'normal'
      let fontSize = '12px'
      let paddingLeft = row.level * 12
      
      if (row.type === 'Header' || row.type === 'Section') {
        backgroundColor = '#f9fafb'
        fontWeight = 'bold'
        fontSize = '14px' // Smaller font for section headers like "Total Income"
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
          // Force text alignment with additional properties
          justifyContent: shouldRightAlign ? 'flex-end' : 'flex-start',
          display: 'flex',
          alignItems: 'center'
        }
      }
    })
    
    return {
      rowId: `row-${index}`,
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
export async function loadYearlyGridData(): Promise<{ rows: Row[], columns: any[] }> {
  try {
    // Import the JSON data
    const yearlyData = await import('../../../../../historical_data/2016-2024_yearly.json')
    return transformYearlyDataToGrid(yearlyData.default || yearlyData)
  } catch (error) {
    console.error('Failed to load yearly data:', error)
    return { rows: [], columns: [] }
  }
}
