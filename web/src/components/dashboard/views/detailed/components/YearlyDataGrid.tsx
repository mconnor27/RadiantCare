import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '../../../../../lib/logger'
import { ReactGrid, type Row } from '@silevis/reactgrid'
import '@silevis/reactgrid/styles.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import CollapsibleSection from '../../../shared/components/CollapsibleSection'
import { loadYearlyGridData, type CollapsibleState } from '../utils/yearlyDataTransformer'
import getDefaultValue from '../config/projectedDefaults'
import ProjectedValueSlider from './ProjectedValueSlider'
import { useDashboardStore } from '../../../../Dashboard'
import { createTooltip, removeTooltip } from '../../../shared/tooltips'

// Mapping from grid account names to multiyear field names
// Using normalized names to be robust against whitespace, info icons, etc.
const GRID_TO_MULTIYEAR_MAPPING: Record<string, string> = {
  'Misc Employment': 'miscEmploymentCosts',
  'Medical Director Hours (Shared)': 'medicalDirectorHours',
  // NOTE: 'Medical Director Hours (PRCS)' is NOT included here - it's set ONLY from PhysiciansEditor
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
      logger.warn('GRID', 'Missing date information in 2025 data,  falling back to 1.5 multiplier')
      return 1.5
    }
    
    const startDate = new Date(startPeriod)
    const endDate = new Date(endPeriod)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      logger.warn('GRID', 'Invalid date format in 2025 data,  falling back to 1.5 multiplier')
      return 1.5
    }
    
    if (endDate <= startDate) {
      logger.warn('GRID', 'Invalid date range in 2025 data,  falling back to 1.5 multiplier')
      return 1.5
    }
    
    const dataPeriodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const fullYearDays = 365
    const projectionRatio = fullYearDays / dataPeriodDays
    
    logger.debug('GRID', `📅 Data period: ${startPeriod} to ${endPeriod} (${dataPeriodDays} days,  ratio: ${projectionRatio.toFixed(3)})`)
    
    return projectionRatio
  } catch (error) {
    logger.warn('GRID', 'Failed to calculate projection ratio,  falling back to 1.5 multiplier:', error)
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

// Function to sync grid projected values to multiyear store OR ytd store
function syncGridValuesToMultiyear(
  store: any,
  customProjectedValues: Record<string, number>,
  gridData: { rows: any[], allRows: any[], columns: any[] },
  mode: 'scenario' | 'ytd' = 'scenario'
) {
  logger.debug('GRID', `🔄 Syncing grid → ${mode === 'ytd' ? 'YTD' : 'Scenario A/B'}`)
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
      // Use allRows to include collapsed rows in the search
      const row = gridData.allRows.find((row: any) => {
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
        // logger.debug('GRID', `📋 Found "${accountName}" -> "${normalizeAccountName(accountName)}" = ${value}`)
        return value
      } else {
        // logger.debug('GRID', `❌ No match found for "${accountName}" -> "${normalizeAccountName(accountName)}"`)
      }
      
      return 0
    }

    // Handle individual field mappings with robust normalization
    Object.entries(GRID_TO_MULTIYEAR_MAPPING).forEach(([gridAccountName, multiyearField]) => {
      const value = getProjectedValue(gridAccountName)
      
      // Update YTD or Scenario state depending on mode
      try {
        if (mode === 'ytd') {
          store.setYtdValue(multiyearField, value, { skipRecompute: true })
        } else {
          store.setFutureValue('A', 2025, multiyearField, value)
          if (store.scenarioBEnabled) {
            store.setFutureValue('B', 2025, multiyearField, value)
          }
        }
      } catch (error) {
        logger.error('GRID', `Failed to sync ${multiyearField}:`,  error)
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
    
    // Sync therapy income total
    try {
      if (mode === 'ytd') {
        store.setYtdValue('therapyIncome', therapyIncomeTotal, { skipRecompute: true })
      } else {
        store.setFutureValue('A', 2025, 'therapyIncome', therapyIncomeTotal)
        if (store.scenarioBEnabled) {
          store.setFutureValue('B', 2025, 'therapyIncome', therapyIncomeTotal)
        }
      }
    } catch (error) {
      logger.error('GRID', `Failed to sync therapyIncome:`,  error)
    }

    // Additionally sync per-site therapy projected totals to store for per-site projections
    try {
      const lacey = getProjectedValue('7105 Therapy - Lacey')
      const centralia = getProjectedValue('7110 Therapy - Centralia')
      const aberdeen = getProjectedValue('7108 Therapy - Aberdeen')
      
      if (mode === 'ytd') {
        store.setYtdValue('therapyLacey', lacey, { skipRecompute: true })
        store.setYtdValue('therapyCentralia', centralia, { skipRecompute: true })
        store.setYtdValue('therapyAberdeen', aberdeen, { skipRecompute: true })
      } else {
        store.setFutureValue('A', 2025, 'therapyLacey', lacey)
        store.setFutureValue('A', 2025, 'therapyCentralia', centralia)
        store.setFutureValue('A', 2025, 'therapyAberdeen', aberdeen)
        if (store.scenarioBEnabled) {
          store.setFutureValue('B', 2025, 'therapyLacey', lacey)
          store.setFutureValue('B', 2025, 'therapyCentralia', centralia)
          store.setFutureValue('B', 2025, 'therapyAberdeen', aberdeen)
        }
      }
    } catch (error) {
      logger.error('GRID', 'Failed to sync per-site therapy values:',  error)
    }
    
    // Log what was synced
    if (mode === 'ytd') {
      logger.debug('CHART', '✅ [Sync] Grid → YTD store complete:', {
        therapyIncome: therapyIncomeTotal,
        nonEmploymentCosts: getProjectedValue('Non-Employment Costs'),
        nonMdEmploymentCosts: getProjectedValue('8320 Non-MD Payroll'),
        therapyLacey: getProjectedValue('7105 Therapy - Lacey'),
        therapyCentralia: getProjectedValue('7110 Therapy - Centralia'),
        therapyAberdeen: getProjectedValue('7108 Therapy - Aberdeen')
      })
      
      // Now that all YTD values are synced, trigger ONE recomputation of projections
      store.recomputeProjectionsFromBaseline()
    } else {
      logger.debug('CHART', '✅ [Sync] Grid → Scenario A/B complete:', {
        therapyIncome: therapyIncomeTotal,
        nonEmploymentCosts: getProjectedValue('Non-Employment Costs'),
        nonMdEmploymentCosts: getProjectedValue('8320 Non-MD Payroll')
      })
    }
    
  } catch (error) {
    logger.error('GRID', 'Error syncing grid values to multiyear store:',  error)
  }
}

interface YearlyDataGridProps {
  environment?: 'production' | 'sandbox'
  cachedSummary?: any
  isLoadingCache?: boolean  // Add flag to indicate if cached data is still loading
  onSyncComplete?: () => void  // Callback when cache sync to store completes
  mode?: 'scenario' | 'ytd'  // Which state to sync to (default: 'scenario')
  shouldUpdateSnapshotOnFirstSync?: boolean  // Whether to update snapshot after first cache sync
  isGridDirty?: boolean  // Whether grid values have been modified
  onResetGrid?: () => void  // Callback to reset grid to loaded scenario
  onAnnualizeAll?: () => void  // Callback to annualize all grid values
  reloadTrigger?: number  // Increment this to force a grid reload (for explicit scenario loads)
}

// Click detection coordinates for expand/collapse all icons in header
const HEADER_ICON_DETECTION = {
  expandStart: 72,
  expandEnd: 91,
  collapseStart: 91,
  collapseEnd: 110,
  height: 25
}

export default function YearlyDataGrid({
  environment = 'sandbox',
  cachedSummary,
  isLoadingCache = false,
  onSyncComplete,
  mode = 'scenario',
  shouldUpdateSnapshotOnFirstSync = false,
  isGridDirty = false,
  onResetGrid,
  onAnnualizeAll,
  reloadTrigger = 0
}: YearlyDataGridProps = {}) {
  const store = useDashboardStore()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridData, setGridData] = useState<{ rows: Row[], allRows: Row[], columns: any[] }>({ rows: [], allRows: [], columns: [] })
  const hasCompletedFirstSync = useRef(false)

  // Add global style to prevent autofill
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .rg-cell input:-webkit-autofill,
      .rg-cell input:-webkit-autofill:hover,
      .rg-cell input:-webkit-autofill:focus,
      .rg-cell input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px white inset !important;
        transition: background-color 5000s ease-in-out 0s;
      }
      .rg-cell input {
        autocomplete: off !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Force autocomplete attributes on ReactGrid inputs
  useEffect(() => {
    const inputs = document.querySelectorAll('.rg-cell input')
    inputs.forEach(input => {
      input.setAttribute('autocomplete', 'off')
      input.setAttribute('data-form-type', 'other')
      input.setAttribute('data-lpignore', 'true')
      input.setAttribute('readonly', 'readonly')

      // Remove readonly on focus
      input.addEventListener('focus', () => {
        input.removeAttribute('readonly')
      })

      // Add back readonly on blur
      input.addEventListener('blur', () => {
        input.setAttribute('readonly', 'readonly')
      })
    })
  }, [gridData])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<CollapsibleState>({})
  const [projectionRatio, setProjectionRatio] = useState<number>(1.5)
  
  // Helper function to calculate annualized PRCS MD Hours from YTD actual
  const calculateAnnualizedPrcsMdHours = useCallback((): number | null => {
    try {
      // Find PRCS MD Hours row in grid data
      const prcsRow = gridData.allRows.find((row: any) => {
        const accountCell = row.cells?.[0] as any
        const accountName = accountCell?.text?.trim() || ''
        return accountName.match(/Medical Director Hours.*PRCS/i)
      })
      
      if (!prcsRow) {
        logger.warn('GRID', '⚠️ Could not find PRCS MD Hours row in grid')
        return null
      }
      
      // Get YTD actual value (second-to-last column before projected)
      const ytdColIndex = gridData.columns.length - 2
      const ytdCell = prcsRow.cells?.[ytdColIndex] as any
      const ytdText = ytdCell?.text || '0'
      const ytdValue = parseFloat(ytdText.replace(/[$,\s]/g, '')) || 0
      
      // Calculate annualized value
      const annualized = ytdValue * projectionRatio
      
      logger.debug('GRID', `📊 [calculateAnnualizedPrcsMdHours] YTD: $${ytdValue.toLocaleString()}, Ratio: ${projectionRatio.toFixed(3)}, Annualized: $${Math.round(annualized).toLocaleString()}`)
      
      return annualized
    } catch (error) {
      logger.error('GRID', '❌ Error calculating annualized PRCS MD Hours:',  error)
      return null
    }
  }, [gridData, projectionRatio]) // Default fallback
  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; x: number; y: number }>({
    show: false,
    text: '',
    x: 0,
    y: 0
  })

  // Debug tooltip state changes
  // useEffect(() => {
  //   logger.debug('GRID', '[tooltip state]',  tooltip)
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
    ytdActualValue: number
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    originPosition: { x: 0, y: 0 },
    originRect: undefined,
    currentValue: 0,
    accountName: '',
    rowIndex: -1,
    columnIndex: -1,
    annualizedBaseline: 0,
    ytdActualValue: 0
  })
  
  // PRCS MD Hours mode toggle tooltip state
  const [prcsModeTooltip, setPrcsModeTooltip] = useState<{
    isVisible: boolean
    position: { x: number; y: number }
    currentValue: number
    cellRect?: { top: number; right: number; bottom: number; left: number; width: number; height: number }
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    currentValue: 0,
    cellRect: undefined
  })
  
  // Get custom projected values from store (now persisted across navigation)
  // Grid is only used in YTD mode, so always use ytdCustomProjectedValues
  const customProjectedValues = store.ytdCustomProjectedValues

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
    'Medical Director Hours (Shared)': 'Click to adjust the total shared medical director hours pool. Individual physician allocations are set in the physician panel and will be redistributed proportionally when the total changes.',
    'Medical Director Hours (PRCS)': 'This value is set in the physician panel. This row is not editable.',
    'Consulting Agreement/Other': '$26.20 per hour for work actually performed subject to a limit of $17,030 per year (25 hours per two-week pay period). Click to adjust this amount.',
    '-$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$5,760,796': 'This 2016 asset disposal gain is displayed but excluded from all calculations and summaries to maintain operational focus.',
    '$462,355': 'This 2016 interest income is displayed but excluded from all calculations and summaries to maintain operational focus.'
  }

  // Helper function to check if account is a calculated row (MD Associates, Guaranteed Payments, Locums, PRCS MD Hours)
  // NOTE: "Medical Director Hours (Shared)" is NOT included - it's editable in the grid
  // NOTE: "Consulting Agreement/Other" is NOT included - it has a configured default and is editable
  const isCalculatedAccount = (accountName: string): boolean => {
    const normalized = normalizeAccountName(accountName)
    return normalized.match(/8322.*MD.*Associates.*Salary/i) ||
           normalized.match(/8325.*MD.*Associates.*Benefits/i) ||
           normalized.match(/8330.*MD.*Associates.*Payroll.*Tax/i) ||
           normalized.match(/8343.*Guaranteed.*Payments/i) ||
           normalized.match(/8322.*Locums.*Salary/i) ||
           normalized.match(/Medical Director Hours.*PRCS/i) ? true : false
  }
  

  // Track last loaded data signature to prevent redundant loads
  const lastLoadRef = useRef<string>('')

  // Reset first sync flag when component mounts, mode changes, or scenario loads (including explicit reloads)
  useEffect(() => {
    hasCompletedFirstSync.current = false
    logger.debug('GRID', '🔄 [Grid] Reset first sync flag (mode,  scenario, or reload trigger changed)')
  }, [mode, store.currentYearSettingId, store.currentScenarioId, reloadTrigger])
  
  // Extract key physician values for dependency tracking
  // Grid is only used in YTD mode
  const fy2025 = store.ytdData
  const prcsDirectorId = fy2025?.prcsDirectorPhysicianId
  const prcsMdHours = fy2025?.prcsMedicalDirectorHours
  const prcsMdHoursMode = fy2025?.prcsMdHoursMode || 'calculated'
  const mdSharedHours = fy2025?.medicalDirectorHours
  const consultingAgreement = fy2025?.consultingServicesAgreement
  const locumCosts = fy2025?.locumCosts
  
  // Track count of custom projected values for dependency tracking
  // This ensures the grid reloads with correct coloring when custom values change
  const customProjectedValuesCount = Object.keys(customProjectedValues || {}).length
  
  // Create a signature of physician data that affects calculated grid rows
  // (MD Associates Salary/Benefits/Payroll Tax, Guaranteed Payments, Shared MD Hours, PRCS MD Hours, Consulting, Locums)
  const physicianDataSignature = JSON.stringify(
    fy2025?.physicians.map((p: any) => ({
      type: p.type,
      salary: p.salary,
      receivesBenefits: p.receivesBenefits,
      employeePortionOfYear: p.employeePortionOfYear,
      partnerPortionOfYear: p.partnerPortionOfYear,
      startPortionOfYear: p.startPortionOfYear,
      terminatePortionOfYear: p.terminatePortionOfYear,
      buyoutCost: p.buyoutCost,
      trailingSharedMdAmount: p.trailingSharedMdAmount,
      medicalDirectorHoursPercentage: p.medicalDirectorHoursPercentage
    }))
  )
  
  // Check if all editable values are already annualized (all cells yellow)
  // This checks by iterating through grid rows and comparing their effective values against annualized baseline
  const areAllValuesAnnualized = useCallback((): boolean => {
    if (!gridData.allRows || gridData.allRows.length === 0 || !gridData.columns) {
      return false
    }
    
    const isPrcsCalculated = store.ytdData.prcsMdHoursMode === 'calculated'
    const ytdColIndex = gridData.columns.length - 2
    const projectedColIndex = gridData.columns.length - 1
    
    // Helper to check approximate equality (within rounding tolerance)
    const approximatelyEqual = (a: number, b: number) => Math.abs(Math.round(a) - Math.round(b)) <= 1
    
    let allAnnualized = true
    const nonAnnualizedRows: string[] = []
    
    // Helper to get the effective projected value (from custom values or grid)
    const getEffectiveValue = (accountName: string, annualizedValue: number): number => {
      const normalizedAccountName = normalizeAccountName(accountName)
      
      // Check if there's a custom value set
      if (customProjectedValues[accountName] !== undefined) {
        return customProjectedValues[accountName]
      }
      if (customProjectedValues[normalizedAccountName] !== undefined) {
        return customProjectedValues[normalizedAccountName]
      }
      
      // Otherwise, use the default value logic
      const defaultValue = getDefaultValue(normalizedAccountName, annualizedValue)
      return defaultValue
    }
    
    for (const row of gridData.allRows) {
      const accountCell = row.cells?.[0] as any
      const accountName = accountCell?.text?.trim() || ''
      const cell = row.cells?.[projectedColIndex] as any
      
      // Skip section rows, spacer rows
      const isSpacer = cell?.rowType === 'Spacer'
      const isSection = cell?.rowType === 'Section'
      
      if (isSpacer || isSection || !accountName) {
        continue
      }
      
      // Skip calculated rows (not user-editable, don't affect annualization status)
      const isCalculatedRow = isCalculatedAccount(accountName)
      if (isCalculatedRow) {
        continue
      }
      
      // Skip summary group rows (except therapy total which is editable)
      const isSummaryGroup = cell?.rowType === 'Summary' && !accountName.startsWith('Total 7100')
      if (isSummaryGroup) {
        continue
      }
      
      // Skip therapy components (they're summed into Total 7100 Therapy Income)
      const isTherapyComponent = accountName === '7105 Therapy - Lacey' || 
                                 accountName === '7108 Therapy - Aberdeen' || 
                                 accountName === '7110 Therapy - Centralia' || 
                                 accountName === '7149 Refunds - Therapy'
      if (isTherapyComponent) {
        continue
      }
      
      // Skip non-data rows (computed rows) - use same logic as Annualize All
      const isRowTypeData = cell?.rowType === 'Data'
      const isComputed = cell?.computedRow === true
      const isTherapyTotalSummary = (cell?.rowType === 'Summary' && accountName === 'Total 7100 Therapy Income')
      const isEditableRow = (isRowTypeData && !isComputed) || isTherapyTotalSummary
      
      if (!isEditableRow) {
        continue
      }
      
      // Calculate annualized baseline from YTD
      const ytdCell = row.cells?.[ytdColIndex] as any
      const ytdText = (ytdCell?.text || '0').toString()
      const ytdValue = parseFloat(ytdText.replace(/[$,\s]/g, '')) || 0
      const annualizedValue = ytdValue * projectionRatio
      
      // Get the effective value (what it should be after defaults/customs are applied)
      const effectiveValue = getEffectiveValue(accountName, annualizedValue)
      
      // Check if the effective value matches the annualized baseline
      if (!approximatelyEqual(effectiveValue, annualizedValue)) {
        allAnnualized = false
        nonAnnualizedRows.push(`${normalizeAccountName(accountName)}: effective=${Math.round(effectiveValue)}, annualized=${Math.round(annualizedValue)}`)
      }
    }
    
    // Special check for PRCS MD Hours - if it's in calculated mode, it's not "annualized"
    if (isPrcsCalculated) {
      allAnnualized = false
      nonAnnualizedRows.push('PRCS MD Hours is in calculated mode')
    }
    
    if (!allAnnualized && nonAnnualizedRows.length > 0) {
      logger.debug('GRID', '🔍 [Annualize Check] Not all values annualized:',  nonAnnualizedRows)
    } else if (allAnnualized) {
      logger.debug('GRID', '✅ [Annualize Check] All values are annualized!')
    }
    
    return allAnnualized
  }, [gridData, projectionRatio, store.ytdData.prcsMdHoursMode, customProjectedValues])
  
  const allValuesAreAnnualized = areAllValuesAnnualized()
  
  const loadData = useCallback(async () => {
    logger.debug('GRID', '🔄 [Grid loadData] Called!')
    try {
      // In production, wait for cached data to arrive before loading stale historical data
      if (environment === 'production' && !cachedSummary && isLoadingCache) {
        logger.debug('GRID', '⏳ Waiting for fresh cached data...')
        setLoading(true)
        return
      }
      
      // Get 2025 physician data and benefit growth rate from store based on mode
      const fy2025 = store.ytdData
      logger.debug('CHART', '🔍 [Grid loadData] Physician data from store:', {
        physiciansCount: fy2025?.physicians?.length,
        prcsMedicalDirectorHours: fy2025?.prcsMedicalDirectorHours,
        medicalDirectorHours: fy2025?.medicalDirectorHours,
        consultingServicesAgreement: fy2025?.consultingServicesAgreement,
        locumCosts: fy2025?.locumCosts
      })
      const benefitGrowthPct = store.scenarioA.projection.benefitCostsGrowthPct
      const physicianData = fy2025 ? {
        physicians: fy2025.physicians,
        benefitGrowthPct,
        locumCosts: fy2025.locumCosts,
        prcsDirectorPhysicianId: fy2025.prcsDirectorPhysicianId,
        prcsMedicalDirectorHours: fy2025.prcsMedicalDirectorHours,
        medicalDirectorHours: fy2025.medicalDirectorHours,
        consultingServicesAgreement: fy2025.consultingServicesAgreement,
        prcsMdHoursMode: fy2025.prcsMdHoursMode || 'calculated'
      } : undefined

      // Create a signature of the data that would affect the load
      const cachedSummaryData = (environment === 'production' && cachedSummary) ? cachedSummary : undefined
      const customValues = store.ytdCustomProjectedValues
      const currentScenarioId = store.currentYearSettingId
      const dataSignature = JSON.stringify({
        scenarioId: currentScenarioId, // Include scenario ID to force reload on scenario change
        reloadTrigger, // Include reload trigger to force reload on explicit user action
        collapsed: collapsedSections,
        customs: customValues,
        physicians: physicianData?.physicians.length,
        prcsDirector: physicianData?.prcsDirectorPhysicianId,
        prcsMdHours: physicianData?.prcsMedicalDirectorHours,
        prcsMdHoursMode: physicianData?.prcsMdHoursMode, // CRITICAL: Include mode so grid reloads when toggled
        mdSharedHours: physicianData?.medicalDirectorHours, // Add this so changes trigger reload
        consultingAgreement: physicianData?.consultingServicesAgreement, // Add this so changes trigger reload
        locumCosts: physicianData?.locumCosts,
        hasCached: !!cachedSummaryData
      })
      
      // ALWAYS reload if scenario ID changed OR reload trigger changed (don't use cached signature)
      // This ensures grid sync happens on every explicit scenario load
      const lastSignature = lastLoadRef.current
      const lastSignatureObj = lastSignature ? JSON.parse(lastSignature) : null
      const lastScenarioId = lastSignatureObj?.scenarioId
      const lastReloadTrigger = lastSignatureObj?.reloadTrigger ?? 0
      
      const currentSignatureObj = JSON.parse(dataSignature)
      const lastPrcsMdHoursMode = lastSignatureObj?.prcsMdHoursMode
      const currentPrcsMdHoursMode = currentSignatureObj?.prcsMdHoursMode
      
      const isScenarioChanged = lastScenarioId !== currentScenarioId && currentScenarioId !== null && currentScenarioId !== undefined
      const isExplicitReload = reloadTrigger !== lastReloadTrigger
      const isModeChanged = lastPrcsMdHoursMode !== currentPrcsMdHoursMode
      
      // Skip if we just loaded the exact same configuration AND scenario/trigger hasn't changed
      if (!isScenarioChanged && !isExplicitReload && lastLoadRef.current === dataSignature) {
        logger.debug('GRID', '⏭️  Skipping redundant load (same data)')
        return
      }
      
      if (isModeChanged) {
        logger.debug('GRID', `🎨 [Grid] PRCS mode changed in dataSignature: ${lastPrcsMdHoursMode} → ${currentPrcsMdHoursMode},  forcing reload`)
      }
      
      if (isScenarioChanged) {
        logger.debug('GRID', `📋 [Grid] Scenario changed: ${lastScenarioId} → ${currentScenarioId},  forcing grid reload`)
      }
      if (isExplicitReload) {
        logger.debug('GRID', `🔄 [Grid] Explicit reload requested (trigger: ${lastReloadTrigger} → ${reloadTrigger})`)
      }
      
      logger.debug('GRID', '📊 YearlyDataGrid: Loading data...')
      setLoading(true)
      setError(null)

      // Load both the grid data and the projection ratio
      // customValues already defined above for signature
      const [data, ratio] = await Promise.all([
        loadYearlyGridData(collapsedSections, customValues, physicianData, cachedSummaryData, store.loadedCurrentYearSettingsSnapshot?.ytdCustomProjectedValues || null),
        calculateProjectionRatio(cachedSummaryData)
      ])

      // Expose snapshot for outlines from the full snapshot's custom values
      try {
        const fullSnap = store.loadedCurrentYearSettingsSnapshot?.ytdCustomProjectedValues
        ;(window as any).__ytdGridSnapshot = fullSnap || undefined
      } catch {}
      setGridData(data)
      setProjectionRatio(ratio)
      lastLoadRef.current = dataSignature
      logger.debug('GRID', `📊 YearlyDataGrid: Loaded ${data.rows.length} rows,  projection ratio: ${ratio.toFixed(3)}`)
      
      // Check if suppression flag is set AND consume it before sync
      const shouldSuppress = store.consumeSuppressNextGridSync()
      if (shouldSuppress) {
        logger.debug('GRID', '⏭️  Skipping initial sync (suppressed)')
        return  // Skip sync entirely during reset operations
      }

      // Always sync grid values to store on initial load for compensation calculations
      // Use a longer delay to reduce redundant syncs during rapid state changes
      setTimeout(() => {
        const customValues = store.ytdCustomProjectedValues
        syncGridValuesToMultiyear(store, customValues, data, 'ytd')

        // Update snapshot ONLY on first sync if requested (to capture QBO cache data)
        // After that, never update it again until save/load
        if (shouldUpdateSnapshotOnFirstSync && !hasCompletedFirstSync.current) {
          hasCompletedFirstSync.current = true

          if (mode === 'ytd') {
            logger.debug('GRID', '📸 [YTD] Updating YTD snapshot after first QBO cache sync')
            // Note: Store state is updated asynchronously, so immediate debug logs may show stale values
            store.updateCurrentYearSettingsSnapshot()
          } else {
            // Multi-Year mode: update scenario snapshots
            if (store.loadedScenarioSnapshot && store.currentScenarioId) {
              logger.debug('GRID', '📸 [Multi-Year] Updating Scenario A snapshot after first QBO cache sync')
              store.updateScenarioSnapshot('A')
            }
            if (store.scenarioBEnabled && store.loadedScenarioBSnapshot && store.currentScenarioBId) {
              logger.debug('GRID', '📸 [Multi-Year] Updating Scenario B snapshot after first QBO cache sync')
              store.updateScenarioSnapshot('B')
            }
          }
        }

        // Notify parent that sync is complete
        onSyncComplete?.()
        
        // Capture the grid snapshot for dirty detection
        // Only capture if we don't already have a snapshot (null check)
        logger.debug('CHART', '🔍 [Grid] Snapshot check:', {
          hasCompletedFirstSync: hasCompletedFirstSync.current,
          hasFullSnapshot: !!store.loadedCurrentYearSettingsSnapshot,
          currentCustomValuesCount: Object.keys(store.ytdCustomProjectedValues).length
        })
        
        // Snapshot now comes solely from loadedCurrentYearSettingsSnapshot; no grid snapshot capture
      }, 200)
    } catch (err) {
      logger.error('GRID', 'Error loading yearly data:',  err)
      setError('Failed to load yearly financial data')
    } finally {
      setLoading(false)
    }
  // CRITICAL: Do NOT include store objects in dependencies - causes infinite loops
  // We read store values fresh inside the function, but track key primitive values
  // that affect calculated grid rows (MD Associates, Guaranteed Payments, Locums, PRCS MD Hours, Shared MD Hours, Consulting)
  // Also track custom projected values count so grid reloads with correct coloring when user changes values
  // IMPORTANT: Include currentYearSettingId to force grid reload when scenario changes (even if data is identical)
  // IMPORTANT: Include reloadTrigger to force reload when user explicitly loads a scenario (even if same ID)
  // IMPORTANT: Include prcsMdHoursMode so grid reloads when PRCS mode toggled (calculated vs annualized)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedSections, environment, cachedSummary, isLoadingCache, mode, store.currentYearSettingId, prcsDirectorId, prcsMdHours, prcsMdHoursMode, mdSharedHours, consultingAgreement, locumCosts, physicianDataSignature, customProjectedValuesCount, reloadTrigger])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Listen for annualize all event
  useEffect(() => {
    const handleAnnualizeAll = () => {
      logger.debug('GRID', '🔢 Annualizing all grid values...')
      
      // Special handling: Switch PRCS to annualized mode if currently in calculated mode
      const isPrcsCalculated = store.ytdData.prcsMdHoursMode === 'calculated'
      if (isPrcsCalculated) {
        logger.debug('GRID', '🔀 [Annualize All] Switching PRCS from calculated to annualized mode')
        const annualizedPrcsValue = calculateAnnualizedPrcsMdHours()
        if (annualizedPrcsValue !== null) {
          store.setPrcsMdHoursMode('annualized', annualizedPrcsValue)
          logger.debug('GRID', `  ✓ PRCS switched to annualized: $${Math.round(annualizedPrcsValue).toLocaleString()}`)
        }
      } else {
        logger.debug('GRID', '  ℹ️  PRCS already in annualized mode,  value will be preserved')
      }
      
      // Iterate through all rows and set projected values to annualized amounts
      gridData.allRows.forEach((row: any) => {
        const accountCell = row.cells?.[0] as any
        const accountName = accountCell?.text?.trim() || ''
        
        // Skip if this is a calculated row (but PRCS is now handled above)
        if (isCalculatedAccount(accountName)) {
          return
        }
        
        // Skip section rows, spacer rows, and summary group rows
        const cell = row.cells?.[gridData.columns.length - 1] as any
        const isSpacer = cell?.rowType === 'Spacer'
        const isSection = cell?.rowType === 'Section'
        const isSummaryGroup = cell?.rowType === 'Summary' && !accountName.startsWith('Total 7100')
        
        if (isSpacer || isSection || isSummaryGroup) {
          return
        }
        
        // Skip therapy components (they're summed into Total 7100 Therapy Income)
        const isTherapyComponent = accountName === '7105 Therapy - Lacey' || 
                                   accountName === '7108 Therapy - Aberdeen' || 
                                   accountName === '7110 Therapy - Centralia' || 
                                   accountName === '7149 Refunds - Therapy'
        if (isTherapyComponent) {
          return
        }
        
        // Calculate annualized value from YTD
        const ytdColIndex = gridData.columns.length - 2
        const ytdCell = row.cells?.[ytdColIndex] as any
        const ytdText = (ytdCell?.text || '0').toString()
        const ytdValue = parseFloat(ytdText.replace(/[$,\s]/g, '')) || 0
        const annualizedValue = ytdValue * projectionRatio
        
        // Get the default value for this account (what would be used without override)
        const normalizedAccountName = normalizeAccountName(accountName)
        const defaultValue = getDefaultValue(normalizedAccountName, annualizedValue)
        
        // Helper to check approximate equality (within rounding tolerance)
        const approximatelyEqual = (a: number, b: number) => Math.abs(Math.round(a) - Math.round(b)) <= 0
        
        // Only set custom override if annualized value differs from default
        // This prevents yellow cells (already annualized) from turning red
        if (approximatelyEqual(annualizedValue, defaultValue)) {
          // Value matches default - remove any existing custom override
          if (store.ytdCustomProjectedValues[normalizedAccountName] !== undefined) {
            store.removeYtdCustomProjectedValue(normalizedAccountName)
            logger.debug('GRID', `  ✓ ${normalizedAccountName}: Removed override (matches default)`)
          }
        } else {
          // Value differs from default - set custom override
          store.setYtdCustomProjectedValue(normalizedAccountName, annualizedValue)
          logger.debug('GRID', `  ✓ ${normalizedAccountName}: ${annualizedValue.toFixed(0)} (custom override)`)
        }
      })
      
      logger.debug('GRID', '✅ Annualization complete')
    }
    
    window.addEventListener('annualizeAllGridValues', handleAnnualizeAll)
    return () => window.removeEventListener('annualizeAllGridValues', handleAnnualizeAll)
  }, [gridData, projectionRatio, store, calculateAnnualizedPrcsMdHours])

  // After data is loaded, scroll the horizontal container all the way to the right by default
  useEffect(() => {
    if (!loading && !error && gridData.columns.length > 0) {
      // Defer until after layout so widths are known, with multiple attempts for sticky columns
      const scrollToRight = () => {
        const el = scrollContainerRef.current
        if (el) {
          el.scrollLeft = el.scrollWidth - el.clientWidth
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
    logger.debug('GRID', 'handleCellClick called with:',  { rowId, columnId })

    // Handle section collapse/expand for first column
    if (columnId === 'col-0' && rowId.startsWith('section-')) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }

      logger.debug('GRID', 'Toggling section:',  rowId)
      logger.debug('GRID', 'Current collapsed state before toggle:',  collapsedSections)
      setCollapsedSections(prev => {
        const newState = {
          ...prev,
          [rowId]: !prev[rowId] // Toggle: undefined/false -> true, true -> false
        }
        logger.debug('GRID', 'New collapsed state after toggle:',  newState)
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
      const isPrcsMdHours = accountText.match(/Medical Director Hours.*PRCS/i)
      const prcsMdHoursMode = store.ytdData.prcsMdHoursMode || 'calculated'
      
      logger.debug('CHART', '🔍 [Click] Cell details:', {
        accountText,
        isPrcsMdHours,
        prcsMdHoursMode,
        isCalculatedRow,
        hasCell: !!cell,
        hasAccountCell: !!accountCell,
        isSpacer
      })
      
      // Special handling for PRCS MD Hours - ALWAYS show toggle tooltip (in both calculated and annualized modes)
      if (isPrcsMdHours && cell && accountCell && !isSpacer) {
        logger.debug('GRID', `✅ PRCS MD Hours (${prcsMdHoursMode} mode) clicked - showing mode toggle`)
        
        // Get cell position for tooltip placement (use viewport coordinates for fixed positioning)
        let cellPosition = { x: 0, y: 0 }
        let cellRect: { top: number; right: number; bottom: number; left: number; width: number; height: number } | undefined
        
        if (event) {
          const target = event.target as HTMLElement
          const cellElement = target.closest('[data-cell-rowidx]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
          if (cellElement) {
            const rect = cellElement.getBoundingClientRect()
            cellRect = {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
            cellPosition = { 
              x: rect.right, 
              y: rect.top + rect.height / 2 
            }
          } else {
            cellPosition = { 
              x: event.clientX, 
              y: event.clientY 
            }
          }
        }
        
        logger.debug('GRID', 'Tooltip position', { cellPosition, cellRect })
        
        // Show PRCS mode toggle tooltip
        const cellText = cell.text || '0'
        const currentValue = parseFloat(cellText.replace(/[$,\s]/g, '')) || 0
        
        setPrcsModeTooltip({
          isVisible: true,
          position: cellPosition,
          currentValue,
          cellRect
        })
        return
      }
      
      // Allow PRCS MD Hours clicks if in annualized mode (treat as editable)
      const isEditableCell = !isCalculatedRow || (isPrcsMdHours && prcsMdHoursMode === 'annualized')
      
      if (cell && accountCell && !isSpacer && isEditableCell && (((isRowTypeData && !isComputed) && !isTherapyComponent) || isTherapyTotalSummary)) {
        logger.debug('GRID', 'Projected cell clicked:',  { rowIndex, colIndex, accountName: accountCell.text })
        
        // Parse the displayed projected value (may be custom) and compute baseline
        const cellText = cell.text || '0'
        const currentValue = parseFloat(cellText.replace(/[$,\s]/g, '')) || 0
        
        // ALWAYS compute annualized baseline from YTD data (never changes based on overrides/defaults)
        const numCols = gridData.columns?.length || 0
        const ytdColIndex = numCols - 2
        let annualizedBaseline = 0
        let ytdActualValue = 0
        try {
          const ytdCell = row.cells?.[ytdColIndex] as any
          const ytdText = (ytdCell?.text || '0').toString()
          ytdActualValue = parseFloat(ytdText.replace(/[$,\s]/g, '')) || 0
          annualizedBaseline = ytdActualValue * projectionRatio
        } catch {
          annualizedBaseline = 0
          ytdActualValue = 0
        }
        
        // Get cell position and rect for slider placement (use viewport coordinates for fixed positioning)
        let cellPosition = { x: 0, y: 0 }
        let cellRect = undefined
        if (event) {
          const target = event.target as HTMLElement
          const cellElement = target.closest('[data-cell-rowidx]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
          if (cellElement) {
            const rect = cellElement.getBoundingClientRect()
            // Use viewport-relative coordinates directly for fixed positioning
            cellPosition = {
              x: rect.right,
              y: rect.top + rect.height / 2
            }
            cellRect = {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          } else {
            // Use mouse position for fallback
            cellPosition = {
              x: event.clientX,
              y: event.clientY
            }
          }
        }

        // Hide any visible tooltip when opening slider
        setTooltip({ show: false, text: '', x: 0, y: 0 })

        setSlider({
          isVisible: true,
          position: cellPosition,
          originPosition: cellPosition, // Use same position for origin
          originRect: cellRect,
          currentValue,
          accountName: accountCell.text || '',
          rowIndex,
          columnIndex: colIndex,
          annualizedBaseline,
          ytdActualValue
        })
      }
    }
  }, [gridData])
  
  const handleSliderClose = useCallback(() => {
    setSlider(prev => ({ ...prev, isVisible: false }))
  }, [])
  
  const handleProjectedValueChange = useCallback((newValue: number) => {
    // Normalize account name by removing info icons and extra whitespace
    const accountName = normalizeAccountName(slider.accountName)
    const annualizedBaseline = slider.annualizedBaseline
    const defaultValue = getDefaultValue(accountName, annualizedBaseline)

    const approximatelyEqual = (a: number, b: number) => Math.abs(Math.round(a) - Math.round(b)) <= 0

    // If user applied without changing, do nothing
    if (approximatelyEqual(newValue, slider.currentValue)) {
      return
    }

    // Special handling for "Medical Director Hours (Shared)" and "Consulting Agreement/Other"
    const normalizedAccountName = normalizeAccountName(accountName)
    if (normalizedAccountName === 'Medical Director Hours (Shared)' || normalizedAccountName === 'Consulting Agreement/Other') {
      const fieldName = normalizedAccountName === 'Medical Director Hours (Shared)'
        ? 'medicalDirectorHours'
        : 'consultingServicesAgreement'
      const oldTotal = slider.currentValue
      const newTotal = newValue

      logger.debug('GRID', `📊 [${normalizedAccountName}] ==== STARTING UPDATE ====`)
      logger.debug('GRID', `📊 [${normalizedAccountName}] Value changing from ${oldTotal} to ${newTotal}`)

      // Get current physician data (grid is only used in YTD mode)
      const fy = store.ytdData

      logger.debug('GRID', `📊 [${normalizedAccountName}] Current fy.${fieldName} BEFORE update: ${fy?.[fieldName]}`)

      if (fy && fy.physicians) {
        // Calculate current trailing total (for retired partners)
        const trailingTotal = fy.physicians.reduce((sum: number, p: any) => {
          const isPriorYearRetiree = (p.type === 'partnerToRetire') && ((p.partnerPortionOfYear ?? 0) === 0)
          if (isPriorYearRetiree) {
            // Get trailing amount (default function available in PhysiciansEditor context)
            const trailingAmount = p.trailingSharedMdAmount ?? 0
            return sum + trailingAmount
          }
          return sum
        }, 0)

        // The remainder after trailing is what gets distributed by percentage
        const oldRemainder = Math.max(0, oldTotal - trailingTotal)
        const newRemainder = Math.max(0, newTotal - trailingTotal)

        logger.debug('GRID', `📊 [Shared MD Hours] Trailing: ${trailingTotal},  Old remainder: ${oldRemainder}, New remainder: ${newRemainder}`)

        // Redistribute: keep the same percentage allocations, but scale to new total
        // The percentage-based allocations will automatically scale to the new remainder
        // No need to modify individual physician percentages - they stay the same!

        logger.debug('GRID', `✅ [Shared MD Hours] Percentages remain unchanged,  will scale to new total automatically`)
      }

      // Update the value in the store (grid is only used in YTD mode)
      logger.debug('GRID', `📊 [${normalizedAccountName}] Calling store.setYtdValue('${fieldName}',  ${newValue})`)
      store.setYtdValue(fieldName as any, newValue)

      // Verify the update (read from store again to get latest value)
      const fyAfter = useDashboardStore.getState().ytdData
      logger.debug('GRID', `📊 [${normalizedAccountName}] Current fy.${fieldName} AFTER update: ${fyAfter?.[fieldName]}`)

      // Also update custom projected value for grid persistence (grid is only used in YTD mode)
      logger.debug('GRID', `📊 [${normalizedAccountName}] Default value: ${defaultValue},  approximatelyEqual: ${approximatelyEqual(newValue, defaultValue)}`)
      if (approximatelyEqual(newValue, defaultValue)) {
        logger.debug('GRID', `📊 [${normalizedAccountName}] Removing custom projected value (matches default)`)
        store.removeYtdCustomProjectedValue(accountName)
      } else {
        logger.debug('GRID', `📊 [${normalizedAccountName}] Setting custom projected value: ${accountName} = ${newValue}`)
        store.setYtdCustomProjectedValue(accountName, newValue)
      }

      // Read custom projected values from store again
      const currentCustomValues = useDashboardStore.getState().ytdCustomProjectedValues
      logger.debug('GRID', `📊 [${normalizedAccountName}] Custom projected values:`,  currentCustomValues)
      logger.debug('GRID', `📊 [${normalizedAccountName}] Specifically for "${accountName}":`,  currentCustomValues[accountName])
      logger.debug('GRID', `📊 [${normalizedAccountName}] ==== UPDATE COMPLETE ====`)
    } else {
      // Standard handling for other accounts (grid is only used in YTD mode)
      if (approximatelyEqual(newValue, defaultValue)) {
        // Remove override if matching default value
        if (customProjectedValues[accountName] !== undefined) {
          store.removeYtdCustomProjectedValue(accountName)
        }
      } else {
        // Set/replace override (including when set to annualized but different from default)
        store.setYtdCustomProjectedValue(accountName, newValue)
      }
    }

      // Trigger immediate sync to multiyear store after value change
      // Use setTimeout to allow any dynamic recalculations to complete first
      setTimeout(() => {
        if (gridData.rows.length > 0) {
          // logger.debug('GRID', '🎯 Syncing after projected value change...')
          const customValues = store.ytdCustomProjectedValues
          syncGridValuesToMultiyear(store, customValues, gridData, 'ytd')
        }
      }, 50) // Short delay to allow dynamic calculations to complete
  }, [slider.accountName, slider.currentValue, slider.annualizedBaseline, customProjectedValues, gridData, store])

  return (
    <CollapsibleSection 
      title="Yearly Financial Data (2016-2025)"
      defaultOpen={false}
      tone="neutral"
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Annualize All Button (only visible when not all values are annualized) */}
          {!allValuesAreAnnualized && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeTooltip('grid-annualize-tooltip')
                onAnnualizeAll?.()
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7'
                createTooltip('grid-annualize-tooltip', 'Annualize all grid values', e, { placement: 'below-center' })
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
                removeTooltip('grid-annualize-tooltip')
              }}
            >
              <img 
                src="/recalc2.png" 
                alt="Annualize" 
                style={{ width: 34, height: 34 }}
              />
            </button>
          )}

          {/* Reset Grid Button (only visible when dirty) */}
          {isGridDirty && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeTooltip('grid-reset-tooltip')
                onResetGrid?.()
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#f59e0b',
                fontSize: 28,
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7'
                createTooltip('grid-reset-tooltip', 'Reset grid to loaded scenario', e, { placement: 'below-center' })
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
                removeTooltip('grid-reset-tooltip')
              }}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
            </button>
          )}
        </div>
      }
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
            maxHeight: '1200px', 
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '4px'
          }}>
            <div
              style={{
                paddingRight: '8px',
                paddingBottom: '12px',
                minWidth: 'fit-content',
                position: 'relative'
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

                    // Handle header expand/collapse all clicks (first column, header row)
                    if (rowIndex === 0 && colIndex === 0 && rowId === 'header') {
                      const clickX = e.clientX
                      const cellRect = cellElement.getBoundingClientRect()
                      const clickRelativeToCell = clickX - cellRect.left

                      // Determine if click was on expand (▼) or collapse (▶) icon using configured detection zones
                      const isExpandClick = clickRelativeToCell > HEADER_ICON_DETECTION.expandStart && clickRelativeToCell < HEADER_ICON_DETECTION.expandEnd
                      const isCollapseClick = clickRelativeToCell > HEADER_ICON_DETECTION.collapseStart && clickRelativeToCell < HEADER_ICON_DETECTION.collapseEnd

                      if (isExpandClick) {
                        // Expand all sections in main table (not bottom summary)
                        setCollapsedSections(prev => {
                          const newState = { ...prev }
                          // Find all section IDs in main table and set to false (expanded)
                          gridData.rows.forEach((r: any) => {
                            const cell = r.cells?.[0] as any
                            const text = cell?.text || ''
                            const rowType = cell?.rowType
                            // Only expand sections in main table (exclude bottom summary sections)
                            if (rowType === 'Section' && r.rowId?.startsWith('section-') && !text.match(/^(Income|Costs|Net Income for MDs)$/i)) {
                              newState[r.rowId] = false
                            }
                          })
                          return newState
                        })
                        return
                      } else if (isCollapseClick) {
                        // Collapse all sections in main table (not bottom summary)
                        setCollapsedSections(prev => {
                          const newState = { ...prev }
                          // Find all section IDs in main table and set to true (collapsed)
                          gridData.rows.forEach((r: any) => {
                            const cell = r.cells?.[0] as any
                            const text = cell?.text || ''
                            const rowType = cell?.rowType
                            // Only collapse sections in main table (exclude bottom summary sections)
                            if (rowType === 'Section' && r.rowId?.startsWith('section-') && !text.match(/^(Income|Costs|Net Income for MDs)$/i)) {
                              newState[r.rowId] = true
                            }
                          })
                          return newState
                        })
                        return
                      }
                    }

                    // Handle section clicks (first column)
                    if (colIndex === 0 && rowId.startsWith('section-')) {
                      handleCellClick(rowId, columnId, e)
                    }
                    // Handle projected cell clicks (last column)
                    else if (gridData.columns && colIndex === gridData.columns.length - 1) {
                      // Check row type from the cell to prevent non-Data rows and custom computed summary group rows
                      const row = gridData.rows[rowIndex]
                      const cell = row?.cells?.[colIndex] as any
                      const accountCell = row?.cells?.[0] as any
                      const accountText = (accountCell?.text || '').trim()
                      const isSpacer = cell?.rowType === 'Spacer'
                      const isTherapyTotalSummary = (cell?.rowType === 'Summary' && accountText === 'Total 7100 Therapy Income')
                      const isTherapyComponent = accountText === '7105 Therapy - Lacey' || accountText === '7108 Therapy - Aberdeen' || accountText === '7110 Therapy - Centralia' || accountText === '7149 Refunds - Therapy'
                      const isCalculatedRow = isCalculatedAccount(accountText)
                      const isPrcsMdHours = accountText.match(/Medical Director Hours.*PRCS/i)
                      // Allow clicks on: normal editable cells, therapy total summary, OR PRCS MD Hours (even when calculated)
                      if (!isSpacer && (!isCalculatedRow || isPrcsMdHours) && (((cell?.rowType === 'Data' && cell?.computedRow !== true) && !isTherapyComponent) || isTherapyTotalSummary)) {
                        handleCellClick(rowId, columnId, e)
                      }
                    }
                  }
                }
              }}
              onMouseOver={(e) => {
                const target = e.target as HTMLElement
                const cellElement = target.closest('[data-cell-rowidx]') || target.closest('[role="gridcell"]') || target.closest('.rg-cell')
                
                if (cellElement) {
                  const rowIdx = cellElement.getAttribute('data-cell-rowidx')
                  const colIdx = cellElement.getAttribute('data-cell-colidx')
                  
                  // Check if this cell has tooltip data
                  if (rowIdx !== null && colIdx !== null) {
                    const rowIndex = parseInt(rowIdx, 10)
                    const colIndex = parseInt(colIdx, 10)
                    const cell = gridData.rows[rowIndex]?.cells?.[colIndex] as any
                    
                    if (cell?.tooltip) {
                      const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                      const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                      setTooltip({
                        show: true,
                        text: cell.tooltip,
                        x: pos.x,
                        y: pos.y
                      })
                    } else {
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
                      
                      if (fallback) {
                        const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                        const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
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
                    
                    if (fallback) {
                      const mouseEvent = (e as unknown as { clientX: number; clientY: number })
                      const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
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
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              <div
                onFocus={(e) => {
                  const target = e.target as HTMLInputElement
                  if (target.tagName === 'INPUT') {
                    target.setAttribute('autocomplete', 'nope')
                    target.setAttribute('autocorrect', 'off')
                    target.setAttribute('autocapitalize', 'off')
                    target.setAttribute('spellcheck', 'false')
                  }
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
                  stickyRightColumns={1}
                  enableFillHandle={false}
                  enableColumnSelection={false}
                  // Handle cell clicks
                  onFocusLocationChanged={() => {
                  // Don't trigger section collapse on focus - let the actual click handler do it
                  // This prevents double-triggering which causes sections to toggle twice
                }}
              />
              {/* Clickable overlays for cursor and click handling */}
              <div
                style={{
                  position: 'absolute',
                  top: '0px',
                  left: `${HEADER_ICON_DETECTION.expandStart}px`,
                  width: `${HEADER_ICON_DETECTION.expandEnd - HEADER_ICON_DETECTION.expandStart}px`,
                  height: `${HEADER_ICON_DETECTION.height}px`,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: 9998,
                  background: 'transparent'
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    show: true,
                    text: 'Expand (Per Level)',
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 8
                  })
                }}
                onMouseLeave={() => {
                  setTooltip({ show: false, text: '', x: 0, y: 0 })
                }}
                onClick={() => {
                  setCollapsedSections(prev => {
                    const newState = { ...prev }
                    // Find all section IDs in main table and set to false (expanded)
                    gridData.rows.forEach((r: any) => {
                      const cell = r.cells?.[0] as any
                      const rowType = cell?.rowType
                      const rowGroup = cell?.rowGroup
                      // Only expand sections in main table (exclude bottom summary sections by checking rowGroup)
                      const isBottomSummary = rowGroup && (rowGroup === 'SummaryIncome' || rowGroup === 'SummaryCosts' || rowGroup === 'SummaryNetIncome')
                      if (rowType === 'Section' && r.rowId?.startsWith('section-') && !isBottomSummary) {
                        newState[r.rowId] = false
                      }
                    })
                    return newState
                  })
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '0px',
                  left: `${HEADER_ICON_DETECTION.collapseStart}px`,
                  width: `${HEADER_ICON_DETECTION.collapseEnd - HEADER_ICON_DETECTION.collapseStart}px`,
                  height: `${HEADER_ICON_DETECTION.height}px`,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: 9998,
                  background: 'transparent'
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    show: true,
                    text: 'Collapse All',
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 8
                  })
                }}
                onMouseLeave={() => {
                  setTooltip({ show: false, text: '', x: 0, y: 0 })
                }}
                onClick={() => {
                  setCollapsedSections(prev => {
                    const newState = { ...prev }
                    // Find all section IDs in main table and set to true (collapsed)
                    gridData.rows.forEach((r: any) => {
                      const cell = r.cells?.[0] as any
                      const rowType = cell?.rowType
                      const rowGroup = cell?.rowGroup
                      // Only collapse sections in main table (exclude bottom summary sections by checking rowGroup)
                      const isBottomSummary = rowGroup && (rowGroup === 'SummaryIncome' || rowGroup === 'SummaryCosts' || rowGroup === 'SummaryNetIncome')
                      if (rowType === 'Section' && r.rowId?.startsWith('section-') && !isBottomSummary) {
                        newState[r.rowId] = true
                      }
                    })
                    return newState
                  })
                }}
              />
              {/* Debug overlays for click detection - automatically synced with HEADER_ICON_DETECTION
              <div style={{
                position: 'absolute',
                top: '0px',
                left: `${HEADER_ICON_DETECTION.expandStart}px`,
                width: `${HEADER_ICON_DETECTION.expandEnd - HEADER_ICON_DETECTION.expandStart}px`,
                height: `${HEADER_ICON_DETECTION.height}px`,
                border: '2px solid red',
                pointerEvents: 'none',
                zIndex: 9999,
                opacity: 0.5
              }} title={`Expand all (▼) click area: ${HEADER_ICON_DETECTION.expandStart}-${HEADER_ICON_DETECTION.expandEnd}px`} />
              <div style={{
                position: 'absolute',
                top: '0px',
                left: `${HEADER_ICON_DETECTION.collapseStart}px`,
                width: `${HEADER_ICON_DETECTION.collapseEnd - HEADER_ICON_DETECTION.collapseStart}px`,
                height: `${HEADER_ICON_DETECTION.height}px`,
                border: '2px solid blue',
                pointerEvents: 'none',
                zIndex: 9999,
                opacity: 0.5
              }} title={`Collapse all (▶) click area: ${HEADER_ICON_DETECTION.collapseStart}-${HEADER_ICON_DETECTION.collapseEnd}px`} />*/}
              </div>
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
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            fontSize: '12px',
            color: '#374151',
            padding: '8px 12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '10px',
                backgroundColor: '#fefce8',
                border: '1px solid #d4d4d8',
                borderRadius: '2px'
              }} />
              <span>Annualized Projection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '10px',
                backgroundColor: '#dcfce7',
                border: '1px solid #d4d4d8',
                borderRadius: '2px'
              }} />
              <span>Custom Value</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '10px',
                backgroundColor: '#f3e8ff',
                border: '1px solid #d8b4fe',
                borderRadius: '2px'
              }} />
              <span>Calculated</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '10px',
                backgroundColor: '#fefce8',
                border: '2px solid #ef4444',
                borderRadius: '2px'
              }} />
              <span>Changed (not saved)</span>
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
                backgroundColor: '#f8f9fa',
                marginTop: '4px'
              }}
              onMouseEnter={(e) => {
                const mouseEvent = e as unknown as { clientX: number; clientY: number }
                const pos = calculateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY)
                setTooltip({
                  show: true,
                  text: 'Click any projected value (rightmost column) to adjust it. Background color shows value type (annualized vs custom). Red border indicates unsaved changes.',
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
            onMouseEnter={() => logger.debug('GRID', '[tooltip] tooltip rendered with text:',  tooltip.text)}
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
          ytdActualValue={slider.ytdActualValue}
        />
        
        {/* PRCS MD Hours Mode Toggle Tooltip */}
        {prcsModeTooltip.isVisible && (() => {
          // Smart positioning logic (same as ProjectedValueSlider)
          const tooltipWidth = 340
          const padding = 20
          const spaceOnRight = window.innerWidth - (prcsModeTooltip.position.x + padding)
          const shouldRenderLeft = spaceOnRight < tooltipWidth + 30 // 30px safety margin
          
          const tooltipPosition = {
            top: prcsModeTooltip.position.y - 100,
            left: shouldRenderLeft 
              ? Math.max(10, (prcsModeTooltip.cellRect?.left || prcsModeTooltip.position.x) - tooltipWidth - padding)
              : prcsModeTooltip.position.x + padding
          }
          
          logger.debug('GRID', '🎯 Tooltip rendering:',  { shouldRenderLeft, spaceOnRight, tooltipPosition })
          
          return (
            <>
              {/* Backdrop to catch outside clicks */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 9999,
                  backgroundColor: 'transparent'
                }}
                onClick={() => {
                  logger.debug('GRID', '🚪 Closing PRCS tooltip (clicked outside)')
                  setPrcsModeTooltip({ isVisible: false, position: { x: 0, y: 0 }, currentValue: 0, cellRect: undefined })
                }}
              />
              <div
                style={{
                  position: 'fixed',
                  top: tooltipPosition.top,
                  left: tooltipPosition.left,
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  zIndex: 10000,
                  minWidth: '320px',
                  maxWidth: '380px',
                  pointerEvents: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
            {(() => {
              const currentMode = store.ytdData.prcsMdHoursMode || 'calculated'
              const isCalculated = currentMode === 'calculated'
              
              return (
                <>
                  <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                    Medical Director Hours (PRCS)
                  </div>
                  
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                    {isCalculated 
                      ? <>Currently calculated from physician panel: <strong style={{ color: '#111827' }}>${prcsModeTooltip.currentValue.toLocaleString()}</strong></>
                      : <>Current value: <strong style={{ color: '#111827' }}>${prcsModeTooltip.currentValue.toLocaleString()}</strong> (can be edited in grid)</>
                    }
                  </div>
                  
                  <div style={{ marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                      Mode:
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          if (isCalculated) {
                            logger.debug('GRID', '🔀 Already in calculated mode,  closing')
                          } else {
                            logger.debug('GRID', '🔀 Switching to calculated mode')
                            store.setPrcsMdHoursMode('calculated')
                          }
                          setPrcsModeTooltip({ isVisible: false, position: { x: 0, y: 0 }, currentValue: 0, cellRect: undefined })
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: isCalculated ? '#7c2a83' : '#ffffff',
                          color: isCalculated ? '#ffffff' : '#374151',
                          border: isCalculated ? 'none' : '2px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isCalculated ? 'default' : 'pointer',
                          opacity: isCalculated ? 0.7 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCalculated) {
                            e.currentTarget.style.borderColor = '#7c2a83'
                            e.currentTarget.style.color = '#7c2a83'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCalculated) {
                            e.currentTarget.style.borderColor = '#d1d5db'
                            e.currentTarget.style.color = '#374151'
                          }
                        }}
                      >
                        {isCalculated ? '●' : '○'} Calculated
                      </button>
                      <button
                        onClick={() => {
                          if (!isCalculated) {
                            logger.debug('GRID', '🔀 Already in annualized mode,  closing')
                          } else {
                            logger.debug('GRID', '🔀 Switching to annualized mode')
                            const annualizedValue = calculateAnnualizedPrcsMdHours()
                            if (annualizedValue !== null) {
                              store.setPrcsMdHoursMode('annualized', annualizedValue)
                            } else {
                              logger.error('GRID', '❌ Could not calculate annualized value')
                            }
                          }
                          setPrcsModeTooltip({ isVisible: false, position: { x: 0, y: 0 }, currentValue: 0, cellRect: undefined })
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: !isCalculated ? '#fefce8' : '#ffffff',
                          color: '#374151',
                          border: !isCalculated ? '2px solid #eab308' : '2px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: !isCalculated ? 'default' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (isCalculated) {
                            e.currentTarget.style.borderColor = '#eab308'
                            e.currentTarget.style.backgroundColor = '#fefce8'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isCalculated) {
                            e.currentTarget.style.borderColor = '#d1d5db'
                            e.currentTarget.style.backgroundColor = '#ffffff'
                          }
                        }}
                      >
                        {!isCalculated ? '●' : '○'} Annualized
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
            
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', fontStyle: 'italic' }}>
              {(() => {
                const currentMode = store.ytdData.prcsMdHoursMode || 'calculated'
                return currentMode === 'calculated'
                  ? 'In calculated mode, the value is determined by the physician panel. Switch to annualized to set it manually.'
                  : 'In annualized mode, you can edit the value directly in the grid cell. Switch to calculated to use the physician panel value.'
              })()}
            </div>
            
            <button
              onClick={() => setPrcsModeTooltip({ isVisible: false, position: { x: 0, y: 0 }, currentValue: 0, cellRect: undefined })}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
            >
              Close
            </button>
          </div>
          </>
          )
        })()}
      </div>
    </CollapsibleSection>
  )
}

