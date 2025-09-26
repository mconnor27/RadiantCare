import { useMemo, useState } from 'react'
import equityData from '../../../../../historical_data/2025_equity.json'
import summaryData from '../../../../../historical_data/2025_summary.json'
import { PARTNER_COMPENSATION_CONFIG, DEFAULT_MD_SHARED_PROJECTION, DEFAULT_MD_PRCS_PROJECTION } from '../../../shared/defaults'
import { useDashboardStore } from '../../../../Dashboard'
import { calculateDelayedW2Payment, calculateEmployeeTotalCost, getPartnerFTEWeight, getEmployeePortionOfYear } from '../../../shared/calculations'
import type { Physician } from '../../../shared/types'

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
function parseYTDData(): YTDData {
  const wages: { [physicianName: string]: number } = {}
  const benefits: { [physicianName: string]: number } = {}
  
  // Get column headers to map column indices to physician names
  const columns = summaryData.Columns.Column
  const physicianColumns: { [name: string]: number } = {}
  
  // Find physician columns (starting after "2-Associates")
  let foundAssociates = false
  columns.forEach((col, index) => {
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

  // Separate partners and employees
  const partners = physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
  const employees = physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')

  // Employee total costs (wages + benefits + employer taxes) respecting portions and benefit growth
  const totalEmployeeCosts = employees.reduce((sum, e) => {
    const employeePortion = getEmployeePortionOfYear(e)
    if (employeePortion <= 0) return sum

    if (e.type === 'newEmployee') {
      const prorated = { ...e, salary: (e.salary ?? 0) * employeePortion }
      return sum + calculateEmployeeTotalCost(prorated, 2025, fy2025?.benefitCostsGrowthPct ?? 5)
    } else if (e.type === 'employeeToTerminate') {
      const prorated = { ...e, salary: (e.salary ?? 0) * employeePortion }
      return sum + calculateEmployeeTotalCost(prorated, 2025, fy2025?.benefitCostsGrowthPct ?? 5)
    } else if (e.type === 'employeeToPartner') {
      const employeePortionSalary = (e.salary ?? 0) * employeePortion
      const employeePortionPhysician = { ...e, salary: employeePortionSalary }
      return sum + calculateEmployeeTotalCost(employeePortionPhysician, 2025, fy2025?.benefitCostsGrowthPct ?? 5)
    } else {
      return sum + calculateEmployeeTotalCost(e, 2025, fy2025?.benefitCostsGrowthPct ?? 5)
    }
  }, 0)

  // Buyouts only for partners who worked part of the year
  const totalBuyoutCosts = partners.reduce((sum, p) => {
    const weight = getPartnerFTEWeight(p)
    return sum + (p.type === 'partnerToRetire' && weight > 0 ? (p.buyoutCost ?? 0) : 0)
  }, 0)

  // Delayed W2 costs for employeeToPartner
  const totalDelayedW2Costs = physicians.reduce((sum, p) => {
    if (p.type === 'employeeToPartner') {
      const delayed = calculateDelayedW2Payment(p, 2025)
      return sum + delayed.amount + delayed.taxes
    }
    return sum
  }, 0)

  // Medical Director allocations
  const medicalDirectorIncome = fy2025.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION
  const prcsMedicalDirectorIncome = fy2025.prcsDirectorPhysicianId ? (fy2025.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION) : 0
  const partnerMedicalDirectorAllocations = new Map<string, number>()
  for (const partner of partners) {
    if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
      const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
      partnerMedicalDirectorAllocations.set(partner.id, allocation)
    }
  }
  if (fy2025.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
    const current = partnerMedicalDirectorAllocations.get(fy2025.prcsDirectorPhysicianId) ?? 0
    partnerMedicalDirectorAllocations.set(fy2025.prcsDirectorPhysicianId, current + prcsMedicalDirectorIncome)
  }
  const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((s, a) => s + a, 0)

  // Pool from future values - include ALL income sources
  const totalIncome = (fy2025.therapyIncome ?? 0) + medicalDirectorIncome + prcsMedicalDirectorIncome + (fy2025.consultingServicesAgreement ?? 0)
  const totalCosts = (fy2025.nonEmploymentCosts ?? 0) + (fy2025.nonMdEmploymentCosts ?? 0) + (fy2025.miscEmploymentCosts ?? 0) + (fy2025.locumCosts ?? 0) + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs
  const basePool = Math.max(0, totalIncome - totalCosts)
  const pool = Math.max(0, basePool - totalMedicalDirectorAllocations)

  // Distribute to partners by FTE weight and add MD allocations and buyouts
  const partnerFTEs = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
  const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
  for (const { p, weight } of partnerFTEs) {
    // Exclude prior-year retirees with no working portion
    if (p.type === 'partnerToRetire' && weight === 0) {
      totals[p.name] = (p.buyoutCost ?? 0) + (p.trailingSharedMdAmount ?? 0)
      continue
    }
    const fteShare = (weight / totalWeight) * pool
    const mdAllocation = partnerMedicalDirectorAllocations.get(p.id) ?? 0
    const trailing = (p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0) ? (p.trailingSharedMdAmount ?? 0) : 0
    totals[p.name] = fteShare + mdAllocation + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0) + trailing
  }

  // Employees: show their W2 comp as projected salary (mirroring summary behavior)
  const employeeOnly = physicians.filter((p) => p.type === 'employee' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')
  for (const e of employeeOnly) {
    // Salary portion for the year (respect portions for new/terminate)
    const portion = getEmployeePortionOfYear(e)
    const salary = (e.salary ?? 0) * (e.type === 'employee' ? 1 : portion)
    totals[e.name] = salary
  }

  return { data, totals }
}

// Parse YTD actual data from equity and summary files (for "Paid to Date" row)
function parseYTDPhysicianData(physicians: Physician[]): { data: PhysicianData; totals: PhysicianTotals } {
  const data: PhysicianData = {}
  const totals: PhysicianTotals = {}
  
  // Initialize totals for all physicians
  physicians.forEach(physician => {
    totals[physician.name] = 0
  })

  // Find the Members Equity section for partner compensation data
  const equitySection = equityData.Rows.Row
    .find(row => row.Header?.ColData?.[0]?.value === "LIABILITIES AND EQUITY")?.Rows?.Row
    ?.find(row => row.Header?.ColData?.[0]?.value === "Equity")?.Rows?.Row
    ?.find(row => row.Header?.ColData?.[0]?.value === "3001 Member's Equity")
  
  // Process partner equity data if available
  if (equitySection?.Rows?.Row) {
    Object.entries(PARTNER_COMPENSATION_CONFIG).forEach(([partnerName, sectionName]) => {
      const partnerSection = equitySection.Rows.Row.find(
        row => row.Header?.ColData?.[0]?.value === sectionName
      )
      
      if (!partnerSection?.Rows?.Row) return
      
      // Process each line item for this partner
      partnerSection.Rows.Row.forEach(row => {
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
  const ytdData = parseYTDData()

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

export default function PartnerCompensation() {
  const store = useDashboardStore()
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Get physician data from store (using 2025 and scenario A for now)
  const year = 2025
  const fy2025 = store.scenarioA.future.find((f) => f.year === year)
  const physicians = fy2025?.physicians || []
  
  // Parse both projected and YTD data
  const projectedData = useMemo(() => parseProjectedData(physicians, fy2025), [
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
  const ytdData = useMemo(() => parseYTDPhysicianData(physicians), [physicians])
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
  
  
  return (
    <div style={{ 
      marginTop: 16, 
      maxWidth: 900,
      margin: '16px auto 0 auto',
      overflowX: 'auto', 
      border: '1px solid #e5e7eb', 
      borderRadius: 6, 
      padding: 8, 
      background: '#ffffff' 
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Physician Compensation</div>
      
      <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${physicianNames.length}, 1fr)`, gap: 2, fontWeight: 600 }}>
        <div style={{ textAlign: 'right' }}>Account</div>
        {physicianNames.map(physician => (
          <div key={physician} style={{ textAlign: 'right' }}>{physician}</div>
        ))}
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
      
      {/* Debug section for fy2025 values */}
      <details style={{ 
        marginTop: '16px', 
        padding: '8px', 
        border: '1px solid #e5e7eb', 
        borderRadius: '4px',
        background: '#f9fafb',
        fontSize: '12px'
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
          Debug: FY2025 Values (for projected calculations)
        </summary>
        <div style={{ marginTop: '8px', fontSize: '11px' }}>
          <strong>Custom Projected Values:</strong>
          <pre style={{ 
            marginTop: '4px', 
            padding: '6px', 
            background: '#fff', 
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '10px'
          }}>
            {JSON.stringify(store.customProjectedValues, null, 2)}
          </pre>
        </div>
        <pre style={{ 
          marginTop: '8px', 
          padding: '8px', 
          background: '#fff', 
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px',
          fontSize: '11px',
          lineHeight: '1.4'
        }}>
          {JSON.stringify(fy2025, null, 2)}
        </pre>
      </details>
      
    </div>
  )
}



