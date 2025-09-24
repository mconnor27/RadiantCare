import { type Row } from '@silevis/reactgrid'
import { findAccountConfig } from '../config/projectedDefaults'
import getDefaultValue from '../config/projectedDefaults'
import { calculateMDAssociatesCosts, calculateGuaranteedPayments, calculateLocumsSalary } from '../../../shared/calculations'
import { type Physician } from '../../../shared/types'

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

// Types for the 2025 JSON data
interface MonthlyData {
  Header: any
  Columns: {
    Column: Array<{
      ColTitle: string
      ColType: string
    }>
  }
  Rows: {
    Row: Array<any>
  }
}

// Mapping from historical account names to 2025 account names and columns
const mapping2025: Record<string, { name: string, col: string }> = {
  '8322 Staff - Salary': { name: '8322 Salary - Staff', col: 'TOTAL' },
  '8325 Staff - Benefits': { name: '8325 Employee Benefits-Insurance', col: 'Total 1-Location' },
  '8330 Staff - Payroll Taxes': { name: '8330 Payroll Taxes', col: 'Total 1-Location' },
  '8322 MD Associates - Salary': { name: '8321 Salary - MD Asso.', col: 'TOTAL' },
  '8325 MD Associates - Benefits': { name: '8325 Employee Benefits-Insurance', col: 'Total 2-Associates' },
  '8330 MD Associates - Payroll Taxes': { name: '8330 Payroll Taxes', col: 'Total 2-Associates' },
  '8322 Locums - Salary': { name: '8323 Salary - Locums', col: 'TOTAL' },
  '7902 Total Other Professional Income': { name: '7902 Other Professional Income', col: 'TOTAL' },
  'Consulting Agreement/Other': { name: '7902 Other Professional Income', col: 'Total 1-Location' }
}

// Special calculation function for Medical Director Hours
function calculateMedicalDirectorHours(data: MonthlyData): { shared: number, prcs: number } {
  const columnIndexes: Record<string, number> = {}
  
  // Get column indexes
  data.Columns.Column.forEach((col, index) => {
    columnIndexes[col.ColTitle] = index
  })
  
  // Find the "7902 Other Professional Income" row
  const findMedDirRow = (rows: any[]): any => {
    for (const row of rows) {
      if (row.ColData?.[0]?.value?.trim() === '7902 Other Professional Income') {
        return row
      }
      if (row.Rows?.Row) {
        const found = findMedDirRow(row.Rows.Row)
        if (found) return found
      }
    }
    return null
  }
  
  const medDirRow = findMedDirRow(data.Rows.Row)
  if (!medDirRow) {
    return { shared: 0, prcs: 0 }
  }
  
  // Get values for Allen, Connor, Suszko, Werner
  const allenIndex = columnIndexes['Allen']
  const connorIndex = columnIndexes['Connor']
  const suszkoIndex = columnIndexes['Suszko']
  const wernerIndex = columnIndexes['Werner']
  
  const allen = allenIndex !== undefined ? parseFloat(medDirRow.ColData[allenIndex].value.replace(/,/g, '')) || 0 : 0
  const connor = connorIndex !== undefined ? parseFloat(medDirRow.ColData[connorIndex].value.replace(/,/g, '')) || 0 : 0
  const suszko = suszkoIndex !== undefined ? parseFloat(medDirRow.ColData[suszkoIndex].value.replace(/,/g, '')) || 0 : 0
  const werner = wernerIndex !== undefined ? parseFloat(medDirRow.ColData[wernerIndex].value.replace(/,/g, '')) || 0 : 0
  
  // Calculate PRCS: Suszko - ((Connor x 3) + Werner)
  // This represents the PRCS-specific Medical Director income
  const prcs = suszko - connor - werner
  
  // Calculate Shared: (Allen + Connor + Suszko + Werner) - PRCS  
  // This represents the shared Medical Director income across all physicians
  const shared = (allen + connor + suszko + werner) - prcs
  
  return { shared, prcs }
}

// Function to parse 2025 data and create a lookup map
function parse2025Data(data: MonthlyData): Record<string, number> {
  const accountMap: Record<string, number> = {}
  const columnIndexes: Record<string, number> = {}

  // Get column indexes
  data.Columns.Column.forEach((col, index) => {
    columnIndexes[col.ColTitle] = index
  })

  // Recursive function to traverse rows
  function traverseRows(rows: any[]) {
    for (const row of rows) {
      if (row.ColData?.[0]?.value) {
        const accountName = row.ColData[0].value.trim()
        
        // Skip the "7902 Other Professional Income" section as requested
        if (accountName.includes('7902 Other Professional Income')) {
          continue
        }

        const totalIndex = columnIndexes['TOTAL']
        if (totalIndex !== undefined && row.ColData[totalIndex]) {
          const value = parseFloat(row.ColData[totalIndex].value.replace(/,/g, '')) || 0
          accountMap[accountName] = value
        }
      }
      if (row.Summary?.ColData?.[0]?.value) {
        const accountName = row.Summary.ColData[0].value.trim()
        const totalIndex = columnIndexes['TOTAL']
        if (totalIndex !== undefined && row.Summary.ColData[totalIndex]) {
          const value = parseFloat(row.Summary.ColData[totalIndex].value.replace(/,/g, '')) || 0
          accountMap[accountName] = value
        }
      }
      if (row.Rows?.Row) {
        traverseRows(row.Rows.Row)
      }
    }
  }

  traverseRows(data.Rows.Row)
  
  // Handle special mappings
  for (const key in mapping2025) {
    const { name, col } = mapping2025[key]
    const colIndex = columnIndexes[col]
    if (colIndex !== undefined) {
      // Need to re-traverse to find these specific rows and columns
      const findValue = (rows: any[]): number | undefined => {
        for (const row of rows) {
          if (row.ColData?.[0]?.value.trim() === name) {
            return parseFloat(row.ColData[colIndex].value.replace(/,/g, '')) || 0
          }
          if (row.Rows?.Row) {
            const found = findValue(row.Rows.Row)
            if (found !== undefined) return found
          }
        }
        return undefined
      }
      const value = findValue(data.Rows.Row)
      if (value !== undefined) {
        accountMap[key] = value
      }
    }
  }

  // Add Medical Director Hours calculations
  const medDirHours = calculateMedicalDirectorHours(data)
  accountMap['Medical Director Hours (Shared)'] = medDirHours.shared
  accountMap['Medical Director Hours (PRCS)'] = medDirHours.prcs
  
  return accountMap
}

// Function to calculate projection ratio based on actual data period
function calculateProjectionRatio(data2025: MonthlyData): number {
  const startPeriod = data2025.Header.StartPeriod
  const endPeriod = data2025.Header.EndPeriod
  
  if (!startPeriod || !endPeriod) {
    throw new Error('Cannot calculate projection ratio: Missing date information in 2025 data. StartPeriod and EndPeriod are required for accurate projections.')
  }
  
  const startDate = new Date(startPeriod)
  const endDate = new Date(endPeriod)
  
  // Validate that the dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error(`Cannot calculate projection ratio: Invalid date format in 2025 data. StartPeriod: "${startPeriod}", EndPeriod: "${endPeriod}"`)
  }
  
  // Validate that end date is after start date
  if (endDate <= startDate) {
    throw new Error(`Cannot calculate projection ratio: End date (${endPeriod}) must be after start date (${startPeriod})`)
  }
  
  // Calculate the number of days in the data period
  const dataPeriodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Calculate days in a full year (365 for simplicity, could be made more precise)
  const fullYearDays = 365
  
  // Calculate the projection ratio
  const projectionRatio = fullYearDays / dataPeriodDays
  
  console.log(`Data period: ${startPeriod} to ${endPeriod} (${dataPeriodDays} days)`)
  console.log(`Projection ratio: ${projectionRatio.toFixed(3)} (${fullYearDays}/${dataPeriodDays})`)
  
  return projectionRatio
}

// Function to merge 2025 data into the historical data structure
function merge2025Data(historicalData: YearlyData, data2025: Record<string, number>, projectionRatio: number, physicianData?: { physicians: Physician[], benefitGrowthPct: number, locumCosts: number }): YearlyData {
  // Add 2025 YTD column
  historicalData.Columns.Column.push({
    ColTitle: '2025 (YTD)',
    ColType: 'Money'
  })
  
  // Add 2025 Projected column (extrapolate 8 months to 12 months)
  historicalData.Columns.Column.push({
    ColTitle: '2025 (Projected)',
    ColType: 'Money'
  })
  


  function traverseAndMerge(rows: any[]): any[] {
    return rows.map(row => {
      if (row.ColData?.[0]?.value) {
        const accountName = row.ColData[0].value.trim()
        const value2025YTD = data2025[accountName] || data2025[accountName.replace(/Total\s+/, '')] || 0
        // Annualized: Project YTD data to full year using dynamic ratio
        const value2025Annualized = value2025YTD * projectionRatio
        
        // Use calculated values if available and account matches
        let value2025Default = value2025Annualized
        let isCalculated = false
        
        if (physicianData) {
          const calculatedInfo = isCalculatedRow(accountName)
          if (calculatedInfo.isCalculated) {
            const mdCosts = calculateMDAssociatesCosts(physicianData.physicians, 2025, physicianData.benefitGrowthPct)
            const guaranteedPayments = calculateGuaranteedPayments(physicianData.physicians)
            const locumsSalary = calculateLocumsSalary(physicianData.locumCosts)
            
            switch (calculatedInfo.type) {
              case 'mdSalary':
                value2025Default = mdCosts.totalSalary
                break
              case 'mdBenefits':
                value2025Default = mdCosts.totalBenefits
                break
              case 'mdPayrollTax':
                value2025Default = mdCosts.totalPayrollTaxes
                break
              case 'guaranteedPayments':
                value2025Default = guaranteedPayments
                break
              case 'locumsSalary':
                value2025Default = locumsSalary
                break
            }
            isCalculated = true
          } else {
            // Use config default or fallback to annualized for other accounts
            value2025Default = getDefaultValue(accountName, value2025Annualized)
          }
        } else {
          // Use config default or fallback to annualized
          value2025Default = getDefaultValue(accountName, value2025Annualized)
        }
        
        row.ColData.push({ value: value2025YTD.toString() })
        row.ColData.push({ 
          value: value2025Default.toString(),
          // Add metadata for calculated rows
          ...(isCalculated && {
            mdCalculated: true,
            tooltip: getTooltipForCalculatedRow(isCalculatedRow(accountName).type!)
          })
        })
      }
      if (row.Summary?.ColData?.[0]?.value) {
        const accountName = row.Summary.ColData[0].value.trim()
        const value2025YTD = data2025[accountName] || data2025[accountName.replace(/Total\s+/, '')] || 0
        // Annualized: Project YTD data to full year using dynamic ratio
        const value2025Annualized = value2025YTD * projectionRatio
        
        // Use calculated values if available and account matches
        let value2025Default = value2025Annualized
        let isCalculated = false
        
        if (physicianData) {
          const calculatedInfo = isCalculatedRow(accountName)
          if (calculatedInfo.isCalculated) {
            const mdCosts = calculateMDAssociatesCosts(physicianData.physicians, 2025, physicianData.benefitGrowthPct)
            const guaranteedPayments = calculateGuaranteedPayments(physicianData.physicians)
            const locumsSalary = calculateLocumsSalary(physicianData.locumCosts)
            
            switch (calculatedInfo.type) {
              case 'mdSalary':
                value2025Default = mdCosts.totalSalary
                break
              case 'mdBenefits':
                value2025Default = mdCosts.totalBenefits
                break
              case 'mdPayrollTax':
                value2025Default = mdCosts.totalPayrollTaxes
                break
              case 'guaranteedPayments':
                value2025Default = guaranteedPayments
                break
              case 'locumsSalary':
                value2025Default = locumsSalary
                break
            }
            isCalculated = true
          } else {
            // Use config default or fallback to annualized for other accounts
            value2025Default = getDefaultValue(accountName, value2025Annualized)
          }
        } else {
          // Use config default or fallback to annualized
          value2025Default = getDefaultValue(accountName, value2025Annualized)
        }
        
        row.Summary.ColData.push({ value: value2025YTD.toString() })
        row.Summary.ColData.push({ 
          value: value2025Default.toString(),
          // Add metadata for calculated rows
          ...(isCalculated && {
            mdCalculated: true,
            tooltip: getTooltipForCalculatedRow(isCalculatedRow(accountName).type!)
          })
        })
      }
      if (row.Header?.ColData) {
        row.Header.ColData.push({ value: '' })
        row.Header.ColData.push({ value: '' })
      }

      if (row.Rows?.Row) {
        row.Rows.Row = traverseAndMerge(row.Rows.Row)
      }
      return row
    })
  }

  historicalData.Rows.Row = traverseAndMerge(historicalData.Rows.Row)
  return historicalData
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
        group: row.group || parentGroup,
        tooltip: row.tooltip,
        // propagate computed marker from source rows (used to block editing via slider)
        computed: row.computed === true
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
        group: row.group || parentGroup,
        computed: row.computed === true
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

// Helper function to check if account is a calculated row (MD Associates, Guaranteed Payments, or Locums)
const isCalculatedRow = (accountName: string): { isCalculated: boolean; type: 'mdSalary' | 'mdBenefits' | 'mdPayrollTax' | 'guaranteedPayments' | 'locumsSalary' | null } => {
  const normalized = accountName.replace(/\s+/g, ' ').trim()
  
  if (normalized.match(/8322.*MD.*Associates.*Salary/i)) {
    return { isCalculated: true, type: 'mdSalary' }
  } else if (normalized.match(/8325.*MD.*Associates.*Benefits/i)) {
    return { isCalculated: true, type: 'mdBenefits' }
  } else if (normalized.match(/8330.*MD.*Associates.*Payroll.*Tax/i)) {
    return { isCalculated: true, type: 'mdPayrollTax' }
  } else if (normalized.match(/8343.*Guaranteed.*Payments/i)) {
    return { isCalculated: true, type: 'guaranteedPayments' }
  } else if (normalized.match(/8322.*Locums.*Salary/i)) {
    return { isCalculated: true, type: 'locumsSalary' }
  }
  
  const isMatch = false
  console.log('isCalculatedRow check:', { original: accountName, normalized, isMatch })
  return { isCalculated: false, type: null }
}

// Helper function to get tooltip text for calculated rows
const getTooltipForCalculatedRow = (type: 'mdSalary' | 'mdBenefits' | 'mdPayrollTax' | 'guaranteedPayments' | 'locumsSalary'): string => {
  switch (type) {
    case 'mdSalary':
      return 'This value is automatically calculated from the sum of employee and part-employee physician salaries in the physician panel. This row is not editable.'
    case 'mdBenefits':
      return 'This value is automatically calculated from the sum of employee and part-employee physician benefits in the physician panel. This row is not editable.'
    case 'mdPayrollTax':
      return 'This value is automatically calculated from the sum of employee and part-employee physician payroll taxes in the physician panel. This row is not editable.'
    case 'guaranteedPayments':
      return 'This value is automatically calculated from the sum of retiring partner buyout costs in the physician panel. This row is not editable.'
    case 'locumsSalary':
      return 'This value is automatically calculated from the locums costs setting in the physician panel. This row is not editable.'
  }
}

export function transformYearlyDataToGrid(data: YearlyData, collapsedSections: CollapsibleState = {}, customProjectedValues: Record<string, number> = {}): { rows: Row[], columns: any[] } {
  // Helper to get the absolute 2016 Asset Disposal amount from raw data
  const getAssetDisposal2016Amount = (source: YearlyData): number => {
    const search = (rows: any[]): number => {
      for (const row of rows) {
        if (row.ColData?.[0]?.value && typeof row.ColData[0].value === 'string') {
          const name: string = row.ColData[0].value
          if (name.includes('8530') && name.includes('Asset Disposal')) {
            const raw = row.ColData[1]?.value || '0'
            const n = parseFloat(raw.toString().replace(/[$,\s]/g, '')) || 0
            return Math.abs(n)
          }
        }
        if (row.Rows?.Row) {
          const found = search(row.Rows.Row)
          if (found !== 0) return found
        }
      }
      return 0
    }
    return search(source.Rows?.Row || [])
  }

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
        padding: '6px',
        textAlign: index === 0 ? 'left' : 'center',
        justifyContent: index === 0 ? 'flex-start' : 'center',
        display: 'flex',
        alignItems: 'center'
      }
    }))
  }
  
  // Flatten and transform data rows
  const flattenedRows = flattenRows(data.Rows.Row)
  
  // Filter out collapsed sections
  const visibleRows = filterCollapsedRows(flattenedRows, collapsedSections)
  
  // Compute 2016 asset disposal absolute, rounded for display-aligned math
  const asset2016Abs = Math.round(getAssetDisposal2016Amount(data))
  // Compute Interest Income amounts for display-time adjustments
  const interestAmounts = findAccountValues(data, /(7900).*Interest/i)
  // Labels that should be adjusted at display-time for asset disposal and interest income
  const adjustSubtractNames = new Set<string>(['Total 8500 Capital Expense', 'Total Cost of Goods Sold'])
  const adjustAddNames = new Set<string>(['Gross Profit', 'Net Operating Income', 'Net Income'])
  // Labels that should be adjusted to exclude Interest Income
  const interestSubtractNames = new Set<string>(['Total Other Income', 'Net Other Income', 'Net Income'])
  
  // Currency formatting function
  const formatCurrency = (value: string, accountName?: string): string => {
    if (!value || value === '') return ''
    
    // Remove existing currency symbols and commas
    const cleanValue = value.replace(/[$,\s]/g, '')
    const numValue = parseFloat(cleanValue)
    
    if (isNaN(numValue)) return value
    
    // If the value is zero, return empty string
    if (numValue === 0) return ''
    
    // Special handling for 2016 Asset Disposal - display original value but mark as excluded
    if (accountName && accountName.includes('8530') && accountName.includes('Asset Disposal') && Math.abs(numValue) > 5000000) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(Math.round(numValue))
      return `${formatted} ⓘ`
    }
    
    // Special handling for 7900 Interest Income - display original value but mark as excluded (2016 only)
    if (accountName && accountName.includes('7900') && accountName.includes('Interest Income') && Math.abs(numValue) > 400000) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(Math.round(numValue))
      return `${formatted} ⓘ`
    }
    
    // Format as currency with no decimals
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(numValue))
  }

  // Helper: get numeric value for a row's Projected column (last numeric col)
  const getProjectedNumericForRow = (r: any): number => {
    const name = r.colData?.[0]?.value || ''
    const lastIdx = columnTitles.length - 1
    // Prefer custom override
    if (customProjectedValues[name] !== undefined) {
      return Number(customProjectedValues[name]) || 0
    }
    const raw = r.colData?.[lastIdx]?.value
    const num = parseFloat((raw ?? '0').toString().replace(/[,$\s]/g, '')) || 0
    return num
  }

  // Proportional scaling for Therapy section when Total is overridden via slider
  const applyTherapyProportionalScaling = (rowsAll: any[]) => {
    // Identify the Therapy section boundaries
    let therapySectionStart = -1
    let therapyTotalIndex = -1
    for (let i = 0; i < rowsAll.length; i++) {
      const r = rowsAll[i]
      const name = r.colData?.[0]?.value || ''
      if (r.type === 'Section' && /7100\s+Therapy\s+Income/i.test(name)) {
        therapySectionStart = i
      }
      if (r.type === 'Summary' && /^Total\s+7100\s+Therapy\s+Income$/i.test(name)) {
        therapyTotalIndex = i
        break
      }
    }
    if (therapySectionStart < 0 || therapyTotalIndex < 0) return
    const totalName = 'Total 7100 Therapy Income'
    if (customProjectedValues[totalName] === undefined) return

    // Compute current sum of projected values for the component rows
    const dataRowNames = new Set<string>([
      '7105 Therapy - Lacey',
      '7108 Therapy - Aberdeen',
      '7110 Therapy - Centralia',
      '7149 Refunds - Therapy'
    ])
    const lastIdx = columnTitles.length - 1
    let currentSum = 0
    const parts: { idx: number, name: string, value: number }[] = []
    for (let i = therapySectionStart + 1; i < therapyTotalIndex; i++) {
      const r = rowsAll[i]
      if (r.type === 'Data') {
        const nm = r.colData?.[0]?.value || ''
        if (dataRowNames.has(nm)) {
          const v = getProjectedNumericForRow(r)
          parts.push({ idx: i, name: nm, value: v })
          currentSum += v
        }
      }
    }
    if (currentSum === 0) return
    const targetTotal = Number(customProjectedValues[totalName]) || 0
    const scale = targetTotal / currentSum
    for (const p of parts) {
      const rowRef = rowsAll[p.idx]
      const newVal = p.value * scale
      rowRef.colData[lastIdx] = { value: newVal.toString() }
    }
  }

  // Apply proportional scaling based on any custom override
  applyTherapyProportionalScaling(flattenedRows)

  const dataRows: Row[] = visibleRows.map((row, index) => {
    const accountName = row.colData[0]?.value || ''
    const cells = row.colData.map((cellData: any, cellIndex: number) => {
      let value = cellData.value || ''
      
      // Add visual indicators for collapsible sections in the first column
      if (cellIndex === 0 && row.type === 'Section' && row.isCollapsible) {
        const isCollapsed = collapsedSections[row.sectionId] === true
        const indicator = isCollapsed ? '▶ ' : '▼ '
        value = indicator + value
      }
      
      // Check if this is the projected column (last column)
      const isProjectedColumn = cellIndex === columnTitles.length - 1
      
      const isNumeric = cellIndex > 0 && value && !isNaN(parseFloat(value.replace(/[,$▶▼\s]/g, '')))
      
      // Check if there's a custom value
      const hasCustomValue = isProjectedColumn && customProjectedValues[accountName] !== undefined
      
      // Apply custom projected value if available
      if (hasCustomValue) {
        value = customProjectedValues[accountName].toString()
      }
      
      // Special calculated summaries (projected column only)
      if (isProjectedColumn && row.type === 'Summary') {
        const computeSummaryByName = (pattern: RegExp): number => {
          // Find the summary row in flattenedRows and sum its section data
          const target = flattenedRows.find(r => {
            const n = r.colData?.[0]?.value || ''
            return r.type === 'Summary' && pattern.test(n)
          })
          if (!target) return 0
          const originalIndex = flattenedRows.indexOf(target)
          if (originalIndex < 0) return 0
          // find nearest Section above at the same level
          let startIdx = 0
          for (let i = originalIndex - 1; i >= 0; i--) {
            const r = flattenedRows[i]
            if (r.type === 'Section' && r.level === target.level) {
              startIdx = i
              break
            }
          }
          let sum = 0
          for (let i = startIdx + 1; i < originalIndex; i++) {
            const r = flattenedRows[i]
            if (r.type === 'Data') {
              sum += getProjectedNumericForRow(r)
            }
          }
          return sum
        }

        if (/^net\s+operating\s+income$/i.test(accountName)) {
          const totalGrossIncome = computeSummaryByName(/^total\s+gross\s+income$/i)
          const totalCOGS = computeSummaryByName(/^total\s+cost\s+of\s+goods\s+sold$/i)
          const grossProfit = totalGrossIncome - totalCOGS
          const totalExpenses = computeSummaryByName(/^total\s+expenses$/i)
          value = (grossProfit - totalExpenses).toString()
        } else if (/^net\s+other\s+income$/i.test(accountName)) {
          const totalOtherIncome = computeSummaryByName(/^total\s+other\s+income$/i)
          const totalOtherExpenses = computeSummaryByName(/^total\s+other\s+expenses$/i)
          value = (totalOtherIncome - totalOtherExpenses).toString()
        } else if (/^net\s+income$/i.test(accountName)) {
          // compute from NOI and Net Other Income
          // Compute NOI
          const totalGrossIncome = computeSummaryByName(/^total\s+gross\s+income$/i)
          const totalCOGS = computeSummaryByName(/^total\s+cost\s+of\s+goods\s+sold$/i)
          const grossProfit = totalGrossIncome - totalCOGS
          const totalExpenses = computeSummaryByName(/^total\s+expenses$/i)
          const noi = grossProfit - totalExpenses
          // Compute Net Other Income
          const totalOtherIncome = computeSummaryByName(/^total\s+other\s+income$/i)
          const totalOtherExpenses = computeSummaryByName(/^total\s+other\s+expenses$/i)
          const noiOther = totalOtherIncome - totalOtherExpenses
          value = (noi + noiOther).toString()
        }
      }
      // For Summary rows in Projected column, dynamically sum all Data rows in the same section
      else if (isProjectedColumn && row.type === 'Summary') {
        // Find this summary row in the full flattenedRows array
        const originalIndex = flattenedRows.indexOf(row)
        let startIdx = 0
        if (originalIndex > -1) {
          for (let i = originalIndex - 1; i >= 0; i--) {
            const r = flattenedRows[i]
            if (r.type === 'Section' && r.level === row.level) {
              startIdx = i
              break
            }
          }
          // Sum Data rows between startIdx and originalIndex (exclusive)
          let sum = 0
          for (let i = startIdx + 1; i < originalIndex; i++) {
            const r = flattenedRows[i]
            if (r.type === 'Data') {
              sum += getProjectedNumericForRow(r)
            }
          }
          value = sum.toString()
        }
      }
      // Apply display adjustments for specific labels (but not for custom projected values)
      else if (isNumeric) {
        const numericValue = parseFloat(value.toString().replace(/[,$\s]/g, '')) || 0
        let adjustedValue = numericValue
        
        // Apply 2016-only asset disposal adjustments
        if (cellIndex === 1 && asset2016Abs > 0) {
          if (adjustSubtractNames.has(accountName)) {
            adjustedValue += asset2016Abs
          } else if (adjustAddNames.has(accountName)) {
            adjustedValue -= asset2016Abs
          }
        }
        
        // Apply Interest Income exclusions for 2016 only (like Asset Disposal)
        if (cellIndex === 1 && interestSubtractNames.has(accountName)) {
          const interestAmount2016 = interestAmounts[0] || 0 // 2016 is index 0
          adjustedValue -= interestAmount2016
        }
        
        if (adjustedValue !== numericValue) {
          value = adjustedValue.toString()
        }
      }
      let formattedValue = (isNumeric || hasCustomValue) ? formatCurrency(value, accountName) : value
      
      // Add info icon for calculated rows AFTER formatting
      const calculatedInfo = isCalculatedRow(accountName)
      if (isProjectedColumn && calculatedInfo.isCalculated) {
        console.log('Attempting to add info icon for calculated row:', accountName, 'type:', calculatedInfo.type, 'formatted value:', formattedValue)
        formattedValue = formattedValue + ' ⓘ'
        console.log('Added info icon to calculated projected cell:', accountName, '→', formattedValue)
      } else if (isProjectedColumn) {
        console.log('Projected column but not calculated row:', accountName)
      }
      
      // Right-align all columns except the first column (account names)
      const shouldRightAlign = cellIndex > 0
      
      // Style based on row type and level
      let backgroundColor = '#ffffff'
      let fontWeight = 'normal'
      let fontSize = '12px'
      let paddingLeft = row.level * 12
      let cursor = 'default'
      let border = 'none'
      
      if (row.type === 'Header' || row.type === 'Section' || row.type === 'Spacer') {
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
      
      
      // Style projected column cells to indicate they're clickable, with rules:
      const therapyComponentNames = new Set<string>([
        '7105 Therapy - Lacey',
        '7108 Therapy - Aberdeen',
        '7110 Therapy - Centralia',
        '7149 Refunds - Therapy'
      ])
      const isComputedCustomRow = (row.group && (row.group.startsWith('Summary') || row.group === 'SummaryIncome' || row.group === 'SummaryCosts' || row.group === 'SummaryNetIncome')) && row.type === 'Data'
      const isTherapyComponent = therapyComponentNames.has(accountName)
      
      if (isProjectedColumn && row.type === 'Data' && cellIndex > 0 && !isComputedCustomRow && !isTherapyComponent) {
        // Special styling for calculated rows (MD Associates and Guaranteed Payments)
        if (calculatedInfo.isCalculated) {
          // Calculated values → blue/gray background, not clickable
          cursor = 'default'
          backgroundColor = '#e0f2fe' // Light blue for calculated
          border = '1px solid #7dd3fc'
        } else {
          cursor = 'pointer'
          const config = findAccountConfig(accountName)
          const hasManualDefault = typeof config?.defaultValue === 'number'
          if (hasCustomValue) {
            // User has manually changed the projected value → red
            backgroundColor = '#fef2f2'
            border = '1px solid #fecaca'
          } else if (hasManualDefault) {
            // Row has a manual default in config (not falling back to annualized) → green
            backgroundColor = '#f0fdf4'
            border = '1px solid #bbf7d0'
          } else {
            // Falling back to computed annualized baseline → yellow
            backgroundColor = '#fefce8'
            border = '1px solid #fed7aa'
          }
        }
      }
      // Make Therapy Total summary look clickable in Projected column
      if (isProjectedColumn && row.type === 'Summary' && accountName === 'Total 7100 Therapy Income') {
        cursor = 'pointer'
        const config = findAccountConfig(accountName)
        const hasManualDefault = typeof config?.defaultValue === 'number'
        if (hasCustomValue) {
          backgroundColor = '#fef2f2'
          border = '1px solid #fecaca'
        } else if (hasManualDefault) {
          backgroundColor = '#f0fdf4'
          border = '1px solid #bbf7d0'
        } else {
          backgroundColor = '#fefce8'
          border = '1px solid #fed7aa'
        }
      }
      
      // Add tooltip info for first column if row carries tooltip metadata or has info icon
      // Also check for special cases in numeric columns (Asset Disposal and Interest Income)
      const isAssetDisposalCell = accountName.includes('8530') && accountName.includes('Asset Disposal') && formattedValue.includes('ⓘ')
      const isInterestIncomeCell = accountName.includes('7900') && accountName.includes('Interest') && formattedValue.includes('ⓘ')
      const isCalculatedInfoIcon = isProjectedColumn && formattedValue.includes('ⓘ') && calculatedInfo.isCalculated
      const hasTooltip = (cellIndex === 0 && (!!row.tooltip || formattedValue.includes('ⓘ'))) || isAssetDisposalCell || isInterestIncomeCell || isCalculatedInfoIcon
      
      // Determine tooltip text
      let tooltipText = undefined
      if (hasTooltip) {
        if (isAssetDisposalCell) {
          tooltipText = 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.'
        } else if (isInterestIncomeCell) {
          tooltipText = 'Interest income is displayed but excluded from all calculations and summaries to maintain operational focus.'
        } else if (isCalculatedInfoIcon) {
          // Get the appropriate tooltip for the calculated row type
          console.log('Setting calculated tooltip for:', accountName, 'type:', calculatedInfo.type, 'formattedValue:', formattedValue)
          tooltipText = getTooltipForCalculatedRow(calculatedInfo.type!)
          console.log('Calculated tooltip set to:', tooltipText)
        } else {
          tooltipText = row.tooltip
        }
      }
      
      return {
        type: 'text',
        text: formattedValue,
        nonEditable: true,
        // Store tooltip data in a custom property
        tooltip: tooltipText,
        // Row type metadata for UI logic (e.g., disable slider on non-Data rows)
        rowType: row.type,
        computedRow: row.computed === true,
        style: {
          background: backgroundColor,
          fontWeight,
          paddingLeft: cellIndex === 0 ? `${paddingLeft + 6}px` : '6px',
          paddingRight: '6px',
          paddingTop: '4px',
          paddingBottom: '4px',
          textAlign: shouldRightAlign ? 'right' : 'left',
          fontSize: fontSize,
          cursor: hasTooltip ? 'help' : cursor,
          border: border,
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
    width: index === 0 ? 350 : (index === columnTitles.length - 1 ? 140 : 100) // Make last column wider to fit title
  }))
  
  return {
    rows: [headerRow, ...dataRows],
    columns
  }
}

// Helper function to find account values by name pattern
function findAccountValues(data: YearlyData, accountPattern: string | RegExp): number[] {
  const findInRows = (rows: any[]): number[] => {
    for (const row of rows) {
      // Check Data row names
      if (row.ColData?.[0]?.value) {
        const accountName = row.ColData[0].value
        const matches = typeof accountPattern === 'string' 
          ? accountName.includes(accountPattern)
          : accountPattern.test(accountName)
        if (matches) {
          return row.ColData.slice(1).map((col: any, index: number) => {
            const value = col.value || '0'
            const numValue = parseFloat(value.toString().replace(/[,$\s]/g, '')) || 0
            
            // Special handling for 2016 Asset Disposal - treat as 0 for calculations
            if (accountName.includes('8530') && accountName.includes('Asset Disposal') && 
                index === 0 && Math.abs(numValue) > 5000000) {
              return 0
            }
            
            return numValue
          })
        }
      }
      // Check Summary row names
      if (row.Summary?.ColData?.[0]?.value) {
        const summaryName = row.Summary.ColData[0].value
        const matches = typeof accountPattern === 'string'
          ? summaryName.includes(accountPattern)
          : accountPattern.test(summaryName)
        if (matches) {
          return row.Summary.ColData.slice(1).map((col: any, index: number) => {
            const value = col.value || '0'
            const numValue = parseFloat(value.toString().replace(/[,$\s]/g, '')) || 0
            
            // Special handling for 2016 Asset Disposal - treat as 0 for calculations
            if (summaryName.includes('8530') && summaryName.includes('Asset Disposal') && 
                index === 0 && Math.abs(numValue) > 5000000) {
              return 0
            }
            
            return numValue
          })
        }
      }
      
      // Check nested rows
      if (row.Rows?.Row) {
        const found = findInRows(row.Rows.Row)
        if (found.length > 0) return found
      }
    }
    return []
  }
  
  return findInRows(data.Rows.Row)
}

// Helper function to sum multiple account patterns
function sumAccountPatterns(data: YearlyData, patterns: (string | RegExp)[]): number[] {
  const allValues = patterns.map(pattern => findAccountValues(data, pattern))
  const numYears = allValues[0]?.length || 10 // Assume 10 years if no data found
  
  const sums = new Array(numYears).fill(0)
  for (const values of allValues) {
    for (let i = 0; i < Math.min(values.length, numYears); i++) {
      sums[i] += values[i] || 0
    }
  }
  
  return sums
}

// Helper function to create calculation row data
function createCalculatedRow(
  accountName: string,
  values: number[],
  numYears: number,
  level: number = 1,
  type: string = 'Data',
  tooltip?: string
): any {
  // Ensure we have exactly numYears numeric columns
  const padded = Array.from({ length: numYears }, (_, i) => values[i] || 0)
  const colData = [
    { value: accountName },
    ...padded.map(val => ({ value: val.toString() }))
  ]
  return { colData, type, level, tooltip }
}

// Helper function to add summary rows
function addSummaryRows(data: YearlyData, projectionRatio: number): any[] {
  const summaryRows: any[] = []
  // We now have 2016-2024 (9 years) + 2025 YTD + 2025 Projected = 11 columns total minus 1 for account name = 10 numeric columns
  const numYears = Math.max(0, (data.Columns?.Column?.length || 1) - 1)

  const normalize = (vals: number[]): number[] => Array.from({ length: numYears }, (_, i) => vals[i] || 0)

  // Two blank rows between native Net Income and our summary sections (non-interactive spacers)
  summaryRows.push({ ColData: [ { value: '' }, ...Array.from({ length: numYears }, () => ({ value: '' })) ], type: 'Spacer', computed: true })
  summaryRows.push({ ColData: [ { value: '' }, ...Array.from({ length: numYears }, () => ({ value: '' })) ], type: 'Spacer', computed: true })

  // INCOME SECTION
  const therapyValues = normalize(findAccountValues(data, /Total\s+7100\s+Therapy\s+Income/i))
  const medDirSharedValues = normalize(findAccountValues(data, /Medical\s*Director.*Shared/i))
  const medDirPRCSValues = normalize(findAccountValues(data, /Medical\s*Director.*PRCS/i))
  const consultingValues = normalize(findAccountValues(data, /Consulting\s*Agreement/i))
  const interestValues = normalize(findAccountValues(data, /(7900).*Interest/i))
  
  // For 2025 Projected (last column), extrapolate from 2025 YTD (second-to-last column)
  if (numYears >= 2) {
    const ytdIndex = numYears - 2  // 2025 YTD column index
    const projectedIndex = numYears - 1  // 2025 Projected column index
    therapyValues[projectedIndex] = therapyValues[ytdIndex] * projectionRatio
    medDirSharedValues[projectedIndex] = medDirSharedValues[ytdIndex] * projectionRatio
    medDirPRCSValues[projectedIndex] = medDirPRCSValues[ytdIndex] * projectionRatio
    consultingValues[projectedIndex] = consultingValues[ytdIndex] * projectionRatio
    interestValues[projectedIndex] = interestValues[ytdIndex] * projectionRatio
  }
  
  const medDirTotal = medDirSharedValues.map((v, i) => v + medDirPRCSValues[i])
  // Calculate Total Gross Income excluding Interest Income for 2016 only
  const totalGrossIncome = therapyValues.map((v, i) => {
    const interestForCalculation = i === 0 ? 0 : interestValues[i] // Exclude 2016 Interest (index 0)
    return v + medDirTotal[i] + consultingValues[i] + interestForCalculation
  })

  summaryRows.push({
    Header: { ColData: [ { value: 'Income' }, ...Array.from({ length: numYears }, () => ({ value: '' })) ] },
    Rows: {
      Row: [
        { ColData: createCalculatedRow('    Therapy', therapyValues, numYears).colData, computed: true },
        { ColData: createCalculatedRow('    Medical Director Hours', medDirTotal, numYears).colData, computed: true },
        { ColData: createCalculatedRow('    Consulting Agreement/Other', consultingValues, numYears).colData, computed: true },
        { ColData: createCalculatedRow('    Interest', interestValues.map((v, i) => i === 0 ? 0 : v), numYears).colData, computed: true }
      ]
    },
    Summary: { ColData: createCalculatedRow('Total Gross Income', totalGrossIncome, numYears, 0, 'Summary').colData },
    type: 'Section',
    group: 'SummaryIncome'
  })

  // COSTS SECTION
  const costOfGoodsValues = normalize(findAccountValues(data, /^Cost of Goods Sold$/i).length ? findAccountValues(data, /^Cost of Goods Sold$/i) : findAccountValues(data, /Total.*Cost.*Goods/i))
  const otherExpensesValues = normalize(findAccountValues(data, /^Other Expenses$/i).length ? findAccountValues(data, /^Other Expenses$/i) : findAccountValues(data, /Total.*Other.*Expenses/i))
  const employeePayrollValues = normalize(findAccountValues(data, /Total\s*8320.*Employee.*Payroll.*Expense/i))
  
  // Project 2025 cost values
  if (numYears >= 2) {
    const ytdIndex = numYears - 2
    const projectedIndex = numYears - 1
    costOfGoodsValues[projectedIndex] = costOfGoodsValues[ytdIndex] * projectionRatio
    otherExpensesValues[projectedIndex] = otherExpensesValues[ytdIndex] * projectionRatio
    employeePayrollValues[projectedIndex] = employeePayrollValues[ytdIndex] * projectionRatio
  }
  
  // Get raw Asset Disposal values to exclude from calculations (but not from display)
  const assetDisposalForCalculations = new Array(numYears).fill(0)
  const findRawAssetDisposalForCalc = (rows: any[]): number => {
    for (const row of rows) {
      if (row.ColData?.[0]?.value?.includes('8530') && row.ColData[0].value.includes('Asset Disposal')) {
        const value = row.ColData[1]?.value || '0'
        return parseFloat(value.toString().replace(/[,$\s]/g, '')) || 0
      }
      if (row.Rows?.Row) {
        const found = findRawAssetDisposalForCalc(row.Rows.Row)
        if (found !== 0) return found
      }
    }
    return 0
  }
  const rawAssetDisposal2016ForCalc = findRawAssetDisposalForCalc(data.Rows.Row)
  assetDisposalForCalculations[0] = rawAssetDisposal2016ForCalc // 2016 is index 0

  // Get raw Interest Income values to exclude from calculations (2016 only, like Asset Disposal)
  const interestIncomeForCalculations = new Array(numYears).fill(0)
  const findRawInterestIncomeForCalc = (rows: any[]): number => {
    for (const row of rows) {
      if (row.ColData?.[0]?.value?.includes('7900') && row.ColData[0].value.includes('Interest Income')) {
        const value = row.ColData[1]?.value || '0' // 2016 is column 1
        return parseFloat(value.toString().replace(/[,$\s]/g, '')) || 0
      }
      if (row.Rows?.Row) {
        const found = findRawInterestIncomeForCalc(row.Rows.Row)
        if (found !== 0) return found
      }
    }
    return 0
  }
  const rawInterestIncome2016ForCalc = findRawInterestIncomeForCalc(data.Rows.Row)
  interestIncomeForCalculations[0] = rawInterestIncome2016ForCalc // 2016 is index 0
  
  // Adjust Other Expenses by removing Asset Disposal for calculations
  const adjustedOtherExpensesValues = otherExpensesValues.map((v, i) => v - assetDisposalForCalculations[i])
  const nonEmploymentCosts = costOfGoodsValues.map((v, i) => v + adjustedOtherExpensesValues[i] - employeePayrollValues[i])

  const mdSalaryValues = normalize(findAccountValues(data, /8322.*MD.*Associates.*Salary/i))
  const mdBenefitsValues = normalize(findAccountValues(data, /8325.*MD.*Associates.*Benefits/i))
  const mdPayrollTaxValues = normalize(findAccountValues(data, /8330.*MD.*Associates.*Payroll.*Tax/i))
  const locumsSalaryValues = normalize(findAccountValues(data, /8322.*Locums.*Salary/i))

  const staffSalaryValues = normalize(findAccountValues(data, /8322.*Staff.*Salary/i))
  const staffBenefitsValues = normalize(findAccountValues(data, /8325.*Staff.*Benefits/i))
  const staffPayrollTaxValues = normalize(findAccountValues(data, /8330.*Staff.*Payroll.*Tax/i))

  const miscEmployment = normalize(
    sumAccountPatterns(data, [
      /8334.*Employee.*gift/i,
      /8335.*Mileage.*reimbursement/i,
      /8338.*Profit.*Sharing.*Contribution/i,
      /8339.*Profit.*Sharing.*Plan.*Cost/i,
      /8340.*Recruiting.*Costs/i,
      /8342.*Relocation.*Cost/i
    ])
  )
  
  // Project 2025 payroll values
  if (numYears >= 2) {
    const ytdIndex = numYears - 2
    const projectedIndex = numYears - 1
    mdSalaryValues[projectedIndex] = mdSalaryValues[ytdIndex] * projectionRatio
    mdBenefitsValues[projectedIndex] = mdBenefitsValues[ytdIndex] * projectionRatio
    mdPayrollTaxValues[projectedIndex] = mdPayrollTaxValues[ytdIndex] * projectionRatio
    locumsSalaryValues[projectedIndex] = locumsSalaryValues[ytdIndex] * projectionRatio
    staffSalaryValues[projectedIndex] = staffSalaryValues[ytdIndex] * projectionRatio
    staffBenefitsValues[projectedIndex] = staffBenefitsValues[ytdIndex] * projectionRatio
    staffPayrollTaxValues[projectedIndex] = staffPayrollTaxValues[ytdIndex] * projectionRatio
    miscEmployment[projectedIndex] = miscEmployment[ytdIndex] * projectionRatio
  }

  const mdPayroll = mdSalaryValues.map((v, i) => v + mdBenefitsValues[i] + mdPayrollTaxValues[i] + locumsSalaryValues[i])
  const staffEmployment = staffSalaryValues.map((v, i) => v + staffBenefitsValues[i] + staffPayrollTaxValues[i])

  const totalCosts = nonEmploymentCosts.map((v, i) => v + mdPayroll[i] + staffEmployment[i] + miscEmployment[i])

  summaryRows.push({
    Header: { ColData: [ { value: 'Costs' }, ...Array.from({ length: numYears }, () => ({ value: '' })) ] },
    Rows: {
      Row: [
        { ColData: createCalculatedRow('    Non-Employment Costs ⓘ', nonEmploymentCosts, numYears, 1, 'Data', 'Insurance, Taxes, Communications, Licensure, Promotional, Billing, Office Overhead, Capital Expense').colData, tooltip: 'Insurance, Taxes, Communications, Licensure, Promotional, Billing, Office Overhead, Capital Expense', computed: true },
        { ColData: createCalculatedRow('    MD Payroll ⓘ', mdPayroll, numYears, 1, 'Data', 'Employed MDs, Locums, Staff').colData, tooltip: 'Employed MDs, Locums, Staff', computed: true },
        { ColData: createCalculatedRow('    Staff Employment', staffEmployment, numYears).colData, computed: true },
        { ColData: createCalculatedRow('    Misc Employment ⓘ', miscEmployment, numYears, 1, 'Data', 'Gifts, Profit Sharing, Relocation, Recruiting').colData, tooltip: 'Gifts, Profit Sharing, Relocation, Recruiting', computed: true }
      ]
    },
    Summary: { ColData: createCalculatedRow('Total Costs', totalCosts, numYears, 0, 'Summary').colData },
    type: 'Section',
    group: 'SummaryCosts'
  })

  // FINAL SUMMARY ROW
  const netIncomeValues = normalize(findAccountValues(data, /^Net Income$/i))
  const guaranteedPaymentsValues = normalize(findAccountValues(data, /8343.*Guaranteed.*Payments/i))
  
  // Project 2025 final summary values
  if (numYears >= 2) {
    const ytdIndex = numYears - 2
    const projectedIndex = numYears - 1
    netIncomeValues[projectedIndex] = netIncomeValues[ytdIndex] * projectionRatio
    guaranteedPaymentsValues[projectedIndex] = guaranteedPaymentsValues[ytdIndex] * projectionRatio
  }
  
  // Adjust Net Income by removing the Asset Disposal gain and Interest Income
  const adjustedNetIncomeValues = netIncomeValues.map((v, i) => v + assetDisposalForCalculations[i] - interestIncomeForCalculations[i])
  const netIncomeForMDs = adjustedNetIncomeValues.map((v, i) => v + mdSalaryValues[i] + mdBenefitsValues[i] + locumsSalaryValues[i] + guaranteedPaymentsValues[i])
  summaryRows.push({
    Summary: { ColData: createCalculatedRow('Net Income for MDs', netIncomeForMDs, numYears, 0, 'Summary').colData },
    type: 'Section',
    group: 'SummaryNetIncome'
  })

  return summaryRows
}

// Load and transform the yearly data
export async function loadYearlyGridData(collapsedSections: CollapsibleState = {}, customProjectedValues: Record<string, number> = {}, physicianData?: { physicians: Physician[], benefitGrowthPct: number, locumCosts: number }): Promise<{ rows: Row[], columns: any[] }> {
  try {
    // Import the JSON data
    const yearlyDataPromise = import('../../../../../historical_data/2016-2024_yearly.json')
    const data2025Promise = import('../../../../../historical_data/2025_summary.json')
    
    const [yearlyDataModule, data2025Module] = await Promise.all([yearlyDataPromise, data2025Promise])
    
    // Deep copy to prevent mutation of cached module data on re-renders
    const historicalData = JSON.parse(JSON.stringify(yearlyDataModule.default || yearlyDataModule))
    const data2025Raw = data2025Module.default || data2025Module

    // Calculate projection ratio from 2025 data
    const projectionRatio = calculateProjectionRatio(data2025Raw)
    
    // Parse 2025 data
    const data2025Map = parse2025Data(data2025Raw)
    
    // Merge 2025 data into historical data
    const data = merge2025Data(historicalData, data2025Map, projectionRatio, physicianData)
    
    // Add summary rows to the data before transformation
    const summaryRows = addSummaryRows(data, projectionRatio)
    
    // Create new data structure with summary rows added
    const extendedData = {
      ...data,
      Rows: {
        Row: [
          ...data.Rows.Row,
          ...summaryRows
        ]
      }
    }
    
    return transformYearlyDataToGrid(extendedData, collapsedSections, customProjectedValues)
  } catch (error) {
    console.error('Failed to load yearly data:', error)
    
    // If it's a projection ratio error, provide more specific feedback
    if (error instanceof Error && error.message.includes('projection ratio')) {
      console.error('Projection calculation failed. This likely means the 2025 data is missing required date information.')
      // You could also trigger a user-facing error dialog here if your app has that capability
    }
    
    return { rows: [], columns: [] }
  }
}
