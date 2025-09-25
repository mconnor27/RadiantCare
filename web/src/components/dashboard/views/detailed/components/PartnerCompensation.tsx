import { useMemo, useState } from 'react'
import equityData from '../../../../../historical_data/2025_equity.json'
import { PARTNER_COMPENSATION_CONFIG } from '../../../shared/defaults'

interface PartnerData {
  [rowName: string]: {
    [partnerName: string]: number
  }
}

interface PartnerTotals {
  [partnerName: string]: number
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

// Parse equity data to extract partner compensation
function parsePartnerData(): { data: PartnerData; totals: PartnerTotals } {
  const data: PartnerData = {}
  const totals: PartnerTotals = {}
  
  // Find the Members Equity section
  const equitySection = equityData.Rows.Row
    .find(row => row.Header?.ColData?.[0]?.value === "LIABILITIES AND EQUITY")?.Rows?.Row
    ?.find(row => row.Header?.ColData?.[0]?.value === "Equity")?.Rows?.Row
    ?.find(row => row.Header?.ColData?.[0]?.value === "3001 Member's Equity")
  
  if (!equitySection?.Rows?.Row) {
    return { data, totals }
  }
  
  // Process each partner section
  Object.entries(PARTNER_COMPENSATION_CONFIG).forEach(([partnerName, sectionName]) => {
    const partnerSection = equitySection.Rows.Row.find(
      row => row.Header?.ColData?.[0]?.value === sectionName
    )
    
    if (!partnerSection?.Rows?.Row) return
    
    // Initialize partner total
    totals[partnerName] = 0
    
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
          data[cleanName][partnerName] = value
          totals[partnerName] += value
        }
      }
    })
  })
  
  return { data, totals }
}

export default function PartnerCompensation() {
  const { data, totals } = useMemo(parsePartnerData, [])
  const partnerNames = Object.keys(PARTNER_COMPENSATION_CONFIG)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Filter out rows where all partner values are 0
  const nonZeroRowNames = Object.keys(data)
    .filter(rowName => 
      partnerNames.some(partner => getValue(rowName, partner, data) !== 0)
    )
    .sort()
  
  // Helper function to get value (moved up for filtering)
  function getValue(rowName: string, partnerName: string, dataSource = data): number {
    return dataSource[rowName]?.[partnerName] ?? 0
  }
  
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
      maxWidth: 600,
      margin: '16px auto 0 auto',
      overflowX: 'auto', 
      border: '1px solid #e5e7eb', 
      borderRadius: 6, 
      padding: 8, 
      background: '#ffffff' 
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Partner Compensation</div>
      
      <div style={{ display: 'grid', gridTemplateColumns: `2.2fr repeat(${partnerNames.length}, 1fr)`, gap: 2, fontWeight: 600 }}>
        <div style={{ textAlign: 'right' }}>Account</div>
        {partnerNames.map(partner => (
          <div key={partner} style={{ textAlign: 'right' }}>{partner}</div>
        ))}
      </div>
      
      {/* Paid To Date row - clickable to expand/collapse */}
      <div 
        className="table-row-total-hover" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `2.2fr repeat(${partnerNames.length}, 1fr)`, 
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
        {partnerNames.map(partner => (
          <div key={partner} style={{ 
            textAlign: 'right',
            color: totals[partner] < 0 ? '#dc3545' : totals[partner] > 0 ? '#28a745' : '#6c757d',
            fontWeight: 700
          }}>
            {formatCurrency(totals[partner])}
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
              gridTemplateColumns: `2.2fr repeat(${partnerNames.length}, 1fr)`, 
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
            {partnerNames.map(partner => {
              const value = getValue(rowName, partner)
              return (
                <div key={partner} style={{ 
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
      
    </div>
  )
}
