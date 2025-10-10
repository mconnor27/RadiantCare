import { useMemo, useState } from 'react'
import equityDataStatic from '../../../../../historical_data/2025_equity.json'
import summaryDataStatic from '../../../../../historical_data/2025_summary.json'
import { PARTNER_COMPENSATION_CONFIG } from '../../../shared/defaults'
import { useDashboardStore } from '../../../../Dashboard'
import { calculateDelayedW2Payment } from '../../../shared/calculations'
import { calculateAllCompensations } from '../../../shared/compensationEngine'
import type { Physician } from '../../../shared/types'
import CollapsibleSection from '../../../shared/components/CollapsibleSection'

interface PhysicianData {
  [rowName: string]: {
    [physicianName: string]: number
  }
}

interface PhysicianTotals {
  [physicianName: string]: number
}

interface YTDData {
  wages: { [physicianName: string]: number }
  benefits: { [physicianName: string]: number }
}

// Helper function to clean up row names
function cleanRowName(accountName: string): string {
  // Remove first 4 digits and space (e.g., "3207 " -> "")
  let cleaned = accountName.replace(/^\d{4}\s+/, '')
  
  // Remove partner name suffix (e.g., " - Connor", " - Allen", etc.)
  cleaned = cleaned.replace(/\s+-\s+\w+$/, '')
  
  // Remove parenthetical partner names (e.g., "(Allen)")
  cleaned = cleaned.replace(/\s*\([^)]+\)/g, '')
  
  // Convert common abbreviations
  cleaned = cleaned.replace(/\bIns\b/gi, 'Insurance')
  cleaned = cleaned.replace(/\bDir\b/gi, 'Director')
  cleaned = cleaned.replace(/\bMed\b/gi, 'Medical')
  cleaned = cleaned.replace(/\bHsa\b/gi, 'HSA')
  
  // Capitalize each word (title case)
  cleaned = cleaned.replace(/\b\w+/g, word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
  
  // Fix HSA to remain all caps after title case
  cleaned = cleaned.replace(/\bHsa\b/g, 'HSA')
  
  return cleaned.trim()
}

// Parse YTD data from summary JSON for employee wages and benefits
function parseYTDData(summaryData: any): YTDData {
  const wages: { [physicianName: string]: number } = {}
  const benefits: { [physicianName: string]: number } = {}
  
  // Get column headers to map column indices to physician names
  const columns = summaryData.Columns.Column
  const physicianColumns: { [name: string]: number } = {}
  
  // Find physician columns (starting after "2-Associates")
  let foundAssociates = false
  columns.forEach((col: any, index: number) => {
    if (col.ColTitle === "2-Associates") {
      foundAssociates = true
      return
    }
    if (foundAssociates && col.ColTitle && !col.ColTitle.includes("Total") && col.ColTitle !== "TOTAL") {
      physicianColumns[col.ColTitle] = index
    }
  })
  
  // Find rows in the summary data
  const findRowByValue = (targetValue: string): any => {
    const searchRows = (rows: any[]): any => {
      for (const row of rows) {
        if (row.ColData?.[0]?.value === targetValue) {
          return row
        }
        if (row.Rows?.Row) {
          const found = searchRows(row.Rows.Row)
          if (found) return found
        }
      }
      return null
    }
    return searchRows(summaryData.Rows.Row)
  }
  
  // Parse salary data from "8321 Salary - MD Asso."
  const salaryRow = findRowByValue("8321 Salary - MD Asso.")
  if (salaryRow?.ColData) {
    Object.entries(physicianColumns).forEach(([name, colIndex]) => {
      const value = parseFloat(salaryRow.ColData[colIndex]?.value || '0')
      wages[name] = value
    })
  }
  
  // Parse benefits data from "8325 Employee Benefits-Insurance"
  const benefitsRow = findRowByValue("8325 Employee Benefits-Insurance")
  if (benefitsRow?.ColData) {
    Object.entries(physicianColumns).forEach(([name, colIndex]) => {
      const value = parseFloat(benefitsRow.ColData[colIndex]?.value || '0')
      benefits[name] = value
    })
  }
  
  return { wages, benefits }
}

// Local 2025 projection using future[2025] values (mirrors non-2025 logic)
function parseProjectedData(physicians: Physician[], fy2025: any): { data: PhysicianData; totals: PhysicianTotals } {
  const data: PhysicianData = {}
  const totals: PhysicianTotals = {}

  if (!fy2025) {
    physicians.forEach(p => { totals[p.name] = 0 })
    return { data, totals }
  }

  // Use the canonical compensation engine
  // For Partner Compensation table: include W2 in total comp
  const compensations = calculateAllCompensations({
    physicians,
    year: 2025,
    fy: fy2025,
    benefitCostsGrowthPct: fy2025.benefitCostsGrowthPct ?? 5,
    includeRetired: true
    // excludeW2FromComp defaults to false - W2 included in comp
  })

  // Map to totals structure
  for (const comp of compensations) {
    totals[comp.name] = comp.comp
  }

  return { data, totals }
}

// Parse YTD actual data from equity and summary files (for "Paid to Date" row)
function parseYTDPhysicianData(physicians: Physician[], equityData: any, summaryData: any): { data: PhysicianData; totals: PhysicianTotals } {
  const data: PhysicianData = {}
  const totals: PhysicianTotals = {}
  
  // Initialize totals for all physicians
  physicians.forEach(physician => {
    totals[physician.name] = 0
  })

  // Find the Members Equity section for partner compensation data
  const equitySection = equityData.Rows.Row
    .find((row: any) => row.Header?.ColData?.[0]?.value === "LIABILITIES AND EQUITY")?.Rows?.Row
    ?.find((row: any) => row.Header?.ColData?.[0]?.value === "Equity")?.Rows?.Row
    ?.find((row: any) => row.Header?.ColData?.[0]?.value === "3001 Member's Equity")
  
  // Process partner equity data if available
  if (equitySection?.Rows?.Row) {
    Object.entries(PARTNER_COMPENSATION_CONFIG).forEach(([partnerName, sectionName]) => {
      const partnerSection = equitySection.Rows.Row.find(
        (row: any) => row.Header?.ColData?.[0]?.value === sectionName
      )
      
      if (!partnerSection?.Rows?.Row) return
      
      // Process each line item for this partner
      partnerSection.Rows.Row.forEach((row: any) => {
        if (row.type === "Data" && row.ColData) {
          const accountName = row.ColData[0]?.value || ''
          const value = parseFloat(row.ColData[1]?.value || '0')
          
          if (accountName) {
            const cleanName = cleanRowName(accountName)
            
            // Initialize row if it doesn't exist
            if (!data[cleanName]) {
              data[cleanName] = {}
            }
            
            // Store the value for this partner
            let adjustedValue = value
            
            // Manual override: reduce Connor's Member Draw by buy-in amount
            if (partnerName === 'Connor' && cleanName === 'Member Draw') {
              adjustedValue = value - 48304.76
            }
            
            data[cleanName][partnerName] = adjustedValue
            // Only add to totals if it's not Beginning Equity (since that's shown separately)
            if (cleanName !== 'Beginning Equity') {
              totals[partnerName] += adjustedValue
            }
          }
        }
      })
    })
  }

  // Get YTD data from summary file
  const ytdData = parseYTDData(summaryData)

  // Process YTD data for employees
  physicians.forEach(physician => {
    const isEmployee = ['employee', 'employeeToPartner', 'newEmployee', 'employeeToTerminate'].includes(physician.type)
    const isRetiredPartner = physician.type === 'partnerToRetire' && (physician.partnerPortionOfYear ?? 0) === 0
    
    // Add YTD W2 income for employees (including employeeToPartner) - negative since it's money paid OUT
    if (isEmployee) {
      let w2Income = 0
      
      // Get base W2 income from summary data
      if (ytdData.wages[physician.name]) {
        w2Income += ytdData.wages[physician.name]
      }
      
      // For employeeToPartner types, also add delayed W2 payments from prior year
      if (physician.type === 'employeeToPartner') {
        const delayedW2 = calculateDelayedW2Payment(physician, 2025)
        w2Income += delayedW2.amount
      }
      
      // Only add row if there's actual W2 income - make it negative since it's money paid OUT
      if (w2Income > 0) {
        if (!data['W2 Income']) {
          data['W2 Income'] = {}
        }
        data['W2 Income'][physician.name] = -w2Income
        totals[physician.name] -= w2Income
      }
    }
    
    // Add YTD W2 income for retired partners (if any - should be negative as money paid OUT)
    if (isRetiredPartner && ytdData.wages[physician.name]) {
      if (!data['W2 Income']) {
        data['W2 Income'] = {}
      }
      data['W2 Income'][physician.name] = -ytdData.wages[physician.name]
      totals[physician.name] -= ytdData.wages[physician.name]
    }
    
    // Add YTD health insurance benefits for employees
    if (isEmployee && ytdData.benefits[physician.name]) {
      if (!data['Health Insurance']) {
        data['Health Insurance'] = {}
      }
      data['Health Insurance'][physician.name] = ytdData.benefits[physician.name]
      totals[physician.name] += ytdData.benefits[physician.name]
    }
    
    // Add buyout costs for retired partners (negative - money paid OUT)
    if (isRetiredPartner && physician.buyoutCost) {
      if (!data['Buy In/Buy Out']) {
        data['Buy In/Buy Out'] = {}
      }
      data['Buy In/Buy Out'][physician.name] = -physician.buyoutCost
      totals[physician.name] -= physician.buyoutCost
    }
    
    // Manual override for Connor's buy-in (positive - money coming IN)
    if (physician.name === 'Connor') {
      if (!data['Buy In/Buy Out']) {
        data['Buy In/Buy Out'] = {}
      }
      data['Buy In/Buy Out'][physician.name] = 48304.76
      totals[physician.name] += 48304.76
    }
    
    // Add medical director amounts
    if (isRetiredPartner && physician.trailingSharedMdAmount) {
      // Trailing medical director amounts for retired partners (negative - money paid OUT)
      if (!data['Medical Director']) {
        data['Medical Director'] = {}
      }
      data['Medical Director'][physician.name] = -physician.trailingSharedMdAmount
      totals[physician.name] -= physician.trailingSharedMdAmount
    } else if (physician.hasMedicalDirectorHours && physician.medicalDirectorHoursPercentage) {
      // Current medical director amounts for active partners
      // This would need to be calculated from the total medical director budget
      // For now, we'll add this as a placeholder for future implementation
      // TODO: Calculate actual medical director amounts for current partners
    }
  })
  
  return { data, totals }
}

interface PartnerCompensationProps {
  environment?: 'production' | 'sandbox'
  cachedSummary?: any
  cachedEquity?: any
}

export default function PartnerCompensation({
  environment = 'sandbox',
  cachedSummary,
  cachedEquity
}: PartnerCompensationProps = {}) {
  // Use cached data in production mode, otherwise use static files
  const equityData = (environment === 'production' && cachedEquity) ? cachedEquity : equityDataStatic
  const summaryData = (environment === 'production' && cachedSummary) ? cachedSummary : summaryDataStatic
  const store = useDashboardStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredPhysician, setHoveredPhysician] = useState<string | null>(null)

  // Get physician data from store (using 2025 and scenario A for now)
  const year = 2025
  const fy2025 = store.scenarioA.future.find((f) => f.year === year)
  const physicians = fy2025?.physicians || []
  
  // Check if we're still waiting for fresh API data (showing stale localStorage data)
  const isRefreshing = environment === 'production' && !cachedSummary
  
  // Parse both projected and YTD data (must be called before any early returns)
  const projectedData = useMemo(() => {
    return parseProjectedData(physicians, fy2025)
  }, [
    physicians,
    fy2025?.therapyIncome,
    fy2025?.nonEmploymentCosts,
    fy2025?.nonMdEmploymentCosts,
    fy2025?.miscEmploymentCosts,
    fy2025?.medicalDirectorHours,
    fy2025?.prcsMedicalDirectorHours,
    fy2025?.consultingServicesAgreement,
    fy2025?.locumCosts,
    fy2025?.prcsDirectorPhysicianId,
    store.scenarioA.projection?.benefitCostsGrowthPct,
  ])
  const ytdData = useMemo(() => parseYTDPhysicianData(physicians, equityData, summaryData), [physicians, equityData, summaryData])
  
  // Don't calculate until 2025 data exists (prevents wrong calcs on first load without localStorage)
  if (!fy2025) {
    return (
      <CollapsibleSection title="Partner Compensation" defaultOpen={false} tone="purple">
        <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
          Loading compensation data...
        </div>
      </CollapsibleSection>
    )
  }
  const physicianNames = physicians.map(p => p.name)
  
  // Helper function to get value 
  function getValue(rowName: string, physicianName: string, dataSource: PhysicianData): number {
    return dataSource[rowName]?.[physicianName] ?? 0
  }
  
  // Define the desired row order (excluding Beginning Equity which will be separate)
  const rowOrder = [
    'Buy In/Buy Out',
    'W2 Income',
    'Member Draw',
    'Draws - Additional Days Worked',
    'Medical Director',
    'Retirement Contributions',
    'HSA Contribution',
    'Health Insurance'
  ]
  
  // Get all unique row names from both data sources and filter out rows where all physician values are 0
  const allRowNames = new Set([...Object.keys(projectedData.data), ...Object.keys(ytdData.data)])
  const nonZeroRowNames = rowOrder
    .filter(rowName => 
      allRowNames.has(rowName) && 
      physicianNames.some(physician => 
        getValue(rowName, physician, projectedData.data) !== 0 || 
        getValue(rowName, physician, ytdData.data) !== 0
      )
    )
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  // Calculate warnings for each physician
  const getPhysicianWarnings = (physicianName: string): string[] => {
    const warnings: string[] = []
    const physician = physicians.find(p => p.name === physicianName)

    if (!physician) return warnings

    // Warning 1: Paid to Date > Projected
    const paidToDate = Math.abs(ytdData.totals[physicianName] || 0)
    const projected = Math.abs(projectedData.totals[physicianName] || 0)
    if (paidToDate > projected) {
      warnings.push(`Paid to Date (${formatCurrency(paidToDate)}) exceeds Projected (${formatCurrency(projected)})`)
    }

    // Warning 2: Medical Director actually paid > amount from panel (shared + PRCS)
    const medicalDirectorPaid = Math.abs(getValue('Medical Director', physicianName, ytdData.data))
    if (medicalDirectorPaid > 0) {
      let projectedMedicalDirector = 0

      // Add shared medical director hours (percentage-based allocation)
      if (physician.hasMedicalDirectorHours && physician.medicalDirectorHoursPercentage && fy2025?.medicalDirectorHours) {
        projectedMedicalDirector += fy2025.medicalDirectorHours * (physician.medicalDirectorHoursPercentage / 100)
      }

      // Add PRCS medical director hours (if this physician is the PRCS director)
      if (fy2025?.prcsDirectorPhysicianId === physician.id && fy2025?.prcsMedicalDirectorHours) {
        projectedMedicalDirector += fy2025.prcsMedicalDirectorHours
      }

      if (projectedMedicalDirector > 0 && medicalDirectorPaid > projectedMedicalDirector) {
        warnings.push(`Medical Director paid (${formatCurrency(medicalDirectorPaid)}) exceeds projected (${formatCurrency(projectedMedicalDirector)})`)
      }
    }

    // Warning 3: Draws Additional Days Worked > internal locums for partners
    const additionalDaysPaid = Math.abs(getValue('Draws - Additional Days Worked', physicianName, ytdData.data))
    const isPartner = ['partner', 'newPartner', 'employeeToPartner', 'partnerToRetire'].includes(physician.type)
    if (additionalDaysPaid > 0 && isPartner) {
      const projectedAdditionalDays = physician.additionalDaysWorked ?? 0
      if (additionalDaysPaid > projectedAdditionalDays) {
        warnings.push(`Additional Days Worked paid (${formatCurrency(additionalDaysPaid)}) exceeds projected (${formatCurrency(projectedAdditionalDays)})`)
      }
    }

    return warnings
  }


  return (
    <div style={{
      marginTop: 16,
      maxWidth: 900,
      margin: '16px auto 16px auto',
      overflowX: 'auto',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      padding: 8,
      background: '#ffffff',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      position: 'relative'
    }}>
      {/* Subtle refreshing indicator */}
      {isRefreshing && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '4px 10px',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 4,
          fontSize: 11,
          color: '#856404',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Refreshing...
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Physician Compensation</div>

      <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, gap: 2, fontWeight: 600 }}>
        <div style={{ textAlign: 'right' }}>Account</div>
        {physicianNames.map(physician => {
          const warnings = getPhysicianWarnings(physician)
          const hasWarnings = warnings.length > 0

          return (
            <div
              key={physician}
              style={{
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                position: 'relative'
              }}
              onMouseEnter={() => hasWarnings && setHoveredPhysician(physician)}
              onMouseLeave={() => setHoveredPhysician(null)}
            >
              {hasWarnings && (
                <>
                  <span style={{
                    color: '#dc3545',
                    fontSize: '14px',
                    cursor: 'help'
                  }}>
                    ⚠️
                  </span>
                  {hoveredPhysician === physician && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 1000,
                      backgroundColor: '#fff',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      minWidth: '250px',
                      maxWidth: '350px',
                      marginTop: '4px',
                      fontSize: '12px',
                      textAlign: 'left',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '6px', color: '#dc3545' }}>
                        Warnings:
                      </div>
                      {warnings.map((warning, idx) => (
                        <div key={idx} style={{
                          marginBottom: idx < warnings.length - 1 ? '4px' : 0,
                          display: 'flex',
                          gap: '6px'
                        }}>
                          <span style={{ flexShrink: 0 }}>•</span>
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {physician}
            </div>
          )
        })}
      </div>
      
      {/* 2025 Projected row */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, 
          gap: 4, 
          padding: '4px 0', 
          borderTop: '1px solid #f0f0f0', 
          background: '#f8f9fa', 
          fontWeight: 600
        }}
      >
        <div style={{ textAlign: 'right' }}>2025 Projected</div>
        {physicianNames.map(physician => (
          <div key={physician} style={{ 
            textAlign: 'right',
            color: projectedData.totals[physician] < 0 ? '#dc3545' : projectedData.totals[physician] > 0 ? '#28a745' : '#6c757d'
          }}>
            {projectedData.totals[physician] !== 0 ? formatCurrency(projectedData.totals[physician]) : '-'}
          </div>
        ))}
      </div>
      
      {/* Paid To Date row - clickable to expand/collapse */}
      <div 
        className="table-row-total-hover" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, 
          gap: 4, 
          padding: '4px 0', 
          borderTop: '1px solid #f0f0f0', 
          background: '#eef7ff', 
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#dbeafe')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#eef7ff')}
      >
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <span style={{ 
            display: 'inline-block',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            ▶
          </span>
          Paid To Date
        </div>
        {physicianNames.map(physician => (
          <div key={physician} style={{ 
            textAlign: 'right',
            color: ytdData.totals[physician] < 0 ? '#dc3545' : ytdData.totals[physician] > 0 ? '#28a745' : '#6c757d',
            fontWeight: 700
          }}>
            {formatCurrency(ytdData.totals[physician])}
          </div>
        ))}
      </div>
      
      {/* Collapsible detail rows container */}
      <div 
        style={{
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out',
          maxHeight: isExpanded ? `${nonZeroRowNames.length * 32}px` : '0px',
          opacity: isExpanded ? 1 : 0
        }}
      >
        {nonZeroRowNames.map((rowName, idx) => (
          <div
            key={rowName}
            className="table-row-hover"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, 
              gap: 4, 
              padding: '1px 0', 
              borderTop: '1px solid #f0f0f0', 
              background: idx % 2 === 0 ? '#f9fafb' : 'transparent',
              transform: isExpanded ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'transform 0.2s ease-in-out, opacity 0.2s ease-in-out',
              transitionDelay: isExpanded ? `${idx * 0.03}s` : '0s',
              opacity: isExpanded ? 1 : 0
            }}
          >
            <div style={{ textAlign: 'right', paddingLeft: '16px' }}>{rowName}</div>
            {physicianNames.map(physician => {
              const value = getValue(rowName, physician, ytdData.data)
              return (
                <div key={physician} style={{ 
                  textAlign: 'right',
                  color: value < 0 ? '#dc3545' : value > 0 ? '#28a745' : '#6c757d'
                }}>
                  {value !== 0 ? formatCurrency(value) : '-'}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      
      {/* Beginning Equity row - separate from Paid to Date */}
      {allRowNames.has('Beginning Equity') && physicianNames.some(physician => getValue('Beginning Equity', physician, ytdData.data) !== 0) && (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, 
            gap: 4, 
            padding: '4px 0', 
            borderTop: '1px solid #f0f0f0', 
            background: '#f8f9fa', 
            fontWeight: 400
          }}
        >
          <div style={{ textAlign: 'right' }}>Beginning Equity</div>
          {physicianNames.map(physician => {
            const value = getValue('Beginning Equity', physician, ytdData.data)
            return (
              <div key={physician} style={{ 
                textAlign: 'right',
                color: value < 0 ? '#dc3545' : value > 0 ? '#28a745' : '#6c757d'
              }}>
                {value !== 0 ? formatCurrency(value) : '-'}
              </div>
            )
          })}
        </div>
      )}
      
      {/* Remaining row - sum of 2025 Projected + Paid to Date + Beginning Equity */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, 
          gap: 4, 
          padding: '4px 0', 
          borderTop: '1px solid #f0f0f0', 
          background: '#eef7ff', 
          fontWeight: 700,
          marginTop: '4px'
        }}
      >
        <div style={{ textAlign: 'right' }}>Remaining</div>
        {physicianNames.map(physician => {
          const projected = projectedData.totals[physician] || 0
          const paidToDate = ytdData.totals[physician] || 0
          const beginningEquity = getValue('Beginning Equity', physician, ytdData.data)
          const remaining = projected + paidToDate + beginningEquity
          
          return (
            <div key={physician} style={{ 
              textAlign: 'right',
              color: remaining < 0 ? '#dc3545' : remaining > 0 ? '#28a745' : '#6c757d',
              fontWeight: 700
            }}>
              {formatCurrency(remaining)}
            </div>
          )
        })}
      </div>
      
      
    </div>
  )
}



