import { useMemo, useEffect } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import YearPanel from './dashboard/YearPanel'
import ProjectionSettingsControls from './dashboard/ProjectionSettingsControls'
import HistoricAndProjectionChart from './dashboard/HistoricAndProjectionChart'
import OverallCompensationSummary from './dashboard/OverallCompensationSummary'
import ParametersSummary from './dashboard/ParametersSummary'
// Import types from types.ts to avoid duplication and binding conflicts
import type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey, Store } from './dashboard/types'

// Re-export types for backward compatibility with extracted components
export type { YearRow, PhysicianType, Physician, FutureYear, ScenarioKey }
import {
  currency,
  clamp,
  isLeapYear,
  daysInYear,
  dayOfYearToDate,
  calendarDateToPortion,
  dateToString,
  employeePortionToTransitionDay,
  startPortionToStartDay,
  getPayPeriodsForYear
} from './dashboard/utils'
import { useIsMobile } from './dashboard/hooks'
import { createTooltip, removeTooltip } from './dashboard/tooltips'




// Helper function for creating interactive bonus slider tooltip
function createBonusTooltip(
  physicianId: string, 
  currentAmount: number, 
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  isTerminatedEmployee: boolean = false
) {
  const tooltipId = `bonus-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()
  
  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  const isMobileTooltip = window.innerWidth <= 768
  
  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  }
  
  // Set ranges and labels based on employee type
  const minValue = isTerminatedEmployee ? -30000 : 0
  const maxValue = 30000
  const title = isTerminatedEmployee ? 'Bonus Repayment/Return' : 'Relocation/Signing Bonus'
  const displayAmount = isTerminatedEmployee && currentAmount < 0 
    ? `-$${Math.abs(currentAmount || 0).toLocaleString()}`
    : `$${(currentAmount || 0).toLocaleString()}`
  
  // Create tooltip content
  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="500" value="${currentAmount}" 
        style="width: 180px; margin-bottom: 4px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="text-align: center; font-weight: 600; user-select: none;" id="${tooltipId}-amount">${displayAmount}</div>
    </div>
  `
  
  document.body.appendChild(tooltip)
  
  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }
  
  // Add event listener for real-time updates
  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const amountDisplay = document.getElementById(`${tooltipId}-amount`)
  
  if (slider && amountDisplay) {
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newAmount = Number(target.value)
      const displayText = isTerminatedEmployee && newAmount < 0 
        ? `-$${Math.abs(newAmount || 0).toLocaleString()}`
        : `$${(newAmount || 0).toLocaleString()}`
      amountDisplay.textContent = displayText
      onUpdate(physicianId, newAmount)
    })
  }
  
  // Add hover events to tooltip to keep it visible when interacting
  tooltip.addEventListener('mouseenter', () => {
    // Cancel any pending hide timeouts when entering tooltip
    clearTimeout((tooltip as any).hideTimeout)
  })
  
  tooltip.addEventListener('mouseleave', () => {
    // Hide tooltip when leaving tooltip area
    removeTooltip(tooltipId)
  })
  
  // Click outside to close
  const clickOutsideHandler = (event: MouseEvent) => {
    if (!tooltip.contains(event.target as Node) && 
        !document.querySelector(`[data-bonus-id="${physicianId}"]`)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  
  // Add click outside handler after a brief delay to avoid immediate closure
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)
  
  // Auto-hide tooltip on mobile after 8 seconds (longer since it's interactive)
  if (isMobileTooltip) {
    setTimeout(() => removeTooltip(tooltipId), 8000)
  }
}

// Helper function for creating interactive Medical Director Hours tooltip (0–100%)
function createHoursTooltip(
  physicianId: string,
  currentPercentage: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, percentage: number) => void,
  totalBudget: number = 0
) {
  const tooltipId = `hours-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  const isMobileTooltip = window.innerWidth <= 768

  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  }

  const minValue = 0
  const maxValue = 100
  const title = 'Medical Director Hours (Shared)'
  const displayPercentage = `${(currentPercentage || 0).toFixed(1)}%`
  const displayAmount = totalBudget > 0 ? `$${Math.round((currentPercentage || 0) * totalBudget / 100).toLocaleString()}` : '$0'

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="0.5" value="${currentPercentage}" 
        style="width: 180px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayPercentage}" 
          style="width: 60px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;" 
          id="${tooltipId}-input" />
        <input type="text" value="${displayAmount}"
          ${totalBudget > 0 ? '' : 'disabled'}
          style="width: 90px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;" 
          id="${tooltipId}-amount" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }

  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const textInput = document.getElementById(`${tooltipId}-input`) as HTMLInputElement
  const amountInput = document.getElementById(`${tooltipId}-amount`) as HTMLInputElement
  
  if (slider && textInput) {
    // Update from slider
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newPercentage = Number(target.value)
      const displayText = `${newPercentage.toFixed(1)}%`
      const amountText = totalBudget > 0 ? `$${Math.round(newPercentage * totalBudget / 100).toLocaleString()}` : '$0'
      textInput.value = displayText
      if (amountInput) amountInput.value = amountText
      onUpdate(physicianId, newPercentage)
    })
    
    // Update from text input
    textInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9.]/g, ''))
      const clampedValue = Math.min(Math.max(numericValue, minValue), maxValue)
      slider.value = clampedValue.toString()
      const amountText = totalBudget > 0 ? `$${Math.round(clampedValue * totalBudget / 100).toLocaleString()}` : '$0'
      if (amountInput) amountInput.value = amountText
      onUpdate(physicianId, clampedValue)
    })
    
    // Format text input on blur
    textInput.addEventListener('blur', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9.]/g, ''))
      const clampedValue = Math.min(Math.max(numericValue, minValue), maxValue)
      target.value = `${clampedValue.toFixed(1)}%`
    })

    // Update from dollar amount input
    if (amountInput) {
      amountInput.addEventListener('input', (event) => {
        if (totalBudget <= 0) return
        const target = event.target as HTMLInputElement
        const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
        const clampedAmount = Math.max(0, Math.min(totalBudget, numericValue))
        const newPercentage = totalBudget > 0 ? (clampedAmount / totalBudget) * 100 : 0
        slider.value = newPercentage.toFixed(1)
        textInput.value = `${Number(slider.value).toFixed(1)}%`
        target.value = `$${Math.round(clampedAmount).toLocaleString()}`
        onUpdate(physicianId, Number(slider.value))
      })

      amountInput.addEventListener('blur', (event) => {
        if (totalBudget <= 0) return
        const target = event.target as HTMLInputElement
        const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
        const clampedAmount = Math.max(0, Math.min(totalBudget, numericValue))
        target.value = `$${Math.round(clampedAmount).toLocaleString()}`
      })
    }
  }

  tooltip.addEventListener('mouseenter', () => {
    clearTimeout((tooltip as any).hideTimeout)
  })
  tooltip.addEventListener('mouseleave', () => {
    removeTooltip(tooltipId)
  })

  const clickOutsideHandler = (event: MouseEvent) => {
    if (!tooltip.contains(event.target as Node) &&
        !document.querySelector(`[data-hours-id="${physicianId}"]`)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)

  if (isMobileTooltip) {
    setTimeout(() => removeTooltip(tooltipId), 8000)
  }
}

// Helper function for creating interactive PRCS Medical Director $ override tooltip
function createPrcsAmountTooltip(
  physicianId: string,
  currentAmount: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  message: string,
  maxValue: number = 90000
) {
  const tooltipId = `prcs-amount-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  const isMobileTooltip = window.innerWidth <= 768

  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  }

  const minValue = 0
  const displayAmount = `$${Math.round(currentAmount || 0).toLocaleString()}`
  const title = 'PRCS Medical Director'

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="margin-bottom: 6px; font-size: 12px; opacity: 0.9;">${message}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="1000" value="${currentAmount}" 
        style="width: 200px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayAmount}" 
          style="width: 110px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;" 
          id="${tooltipId}-amount" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }

  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const amountInput = document.getElementById(`${tooltipId}-amount`) as HTMLInputElement

  if (slider && amountInput) {
    // Update from slider
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newAmount = Number(target.value)
      amountInput.value = `$${Math.round(newAmount).toLocaleString()}`
      onUpdate(physicianId, newAmount)
    })

    // Update from text input
    amountInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
      const clamped = Math.max(minValue, Math.min(maxValue, numericValue))
      slider.value = String(clamped)
      target.value = `$${Math.round(clamped).toLocaleString()}`
      onUpdate(physicianId, clamped)
    })
  }

  tooltip.addEventListener('mouseenter', () => {
    clearTimeout((tooltip as any).hideTimeout)
  })
  tooltip.addEventListener('mouseleave', () => {
    removeTooltip(tooltipId)
  })

  const clickOutsideHandler = (event: MouseEvent) => {
    if (!tooltip.contains(event.target as Node) &&
        !document.querySelector(`[data-prcs-id="${physicianId}"]`)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)

  if (isMobileTooltip) {
    setTimeout(() => removeTooltip(tooltipId), 8000)
  }
}

// Default trailing shared MD amount for prior-year retirees
function getDefaultTrailingSharedMdAmount(physician: Physician): number {
  return physician.name === 'HW' ? 8302.5 : 2500
}

// Helper function for creating interactive Prior-Year Retiree Shared MD $ tooltip
function createTrailingSharedMdAmountTooltip(
  physicianId: string,
  currentAmount: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  message: string = 'Deducted before allocation to current partners.',
  maxValue: number = 120000
) {
  const tooltipId = `trailing-md-amount-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  const isMobileTooltip = window.innerWidth <= 768

  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  }

  const minValue = 0
  const displayAmount = `$${Math.round(currentAmount || 0).toLocaleString()}`
  const title = 'Medical Director Hours (Prior Year Retiree)'

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="margin-bottom: 6px; font-size: 12px; opacity: 0.9;">${message}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="100" value="${currentAmount}" 
        style="width: 200px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayAmount}" 
          style="width: 110px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;" 
          id="${tooltipId}-amount" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
  }

  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const amountInput = document.getElementById(`${tooltipId}-amount`) as HTMLInputElement

  if (slider && amountInput) {
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newAmount = Number(target.value)
      amountInput.value = `$${Math.round(newAmount).toLocaleString()}`
      onUpdate(physicianId, newAmount)
    })

    amountInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
      const clamped = Math.max(minValue, Math.min(maxValue, numericValue))
      slider.value = String(clamped)
      target.value = `$${Math.round(clamped).toLocaleString()}`
      onUpdate(physicianId, clamped)
    })
  }

  tooltip.addEventListener('mouseenter', () => {
    clearTimeout((tooltip as any).hideTimeout)
  })
  tooltip.addEventListener('mouseleave', () => {
    removeTooltip(tooltipId)
  })

  const clickOutsideHandler = (event: MouseEvent) => {
    if (!tooltip.contains(event.target as Node) &&
        !(document.querySelector(`[data-hours-id="${physicianId}"]`) as HTMLElement)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)

  if (isMobileTooltip) {
    setTimeout(() => removeTooltip(tooltipId), 8000)
  }
}

// Extend FutureYear with nonMdEmploymentCosts

const HISTORIC_DATA: YearRow[] = [
  // 2016-2023: therapyIncome represents total income (no separate medical director data available)
  { year: 2016, therapyIncome: 2325241.84, nonEmploymentCosts: 167375.03, employeePayroll: 188151.97 },
  { year: 2017, therapyIncome: 2376068.79, nonEmploymentCosts: 170366.16, employeePayroll: 180060.96 },
  { year: 2018, therapyIncome: 2386310.08, nonEmploymentCosts: 162454.23, employeePayroll: 357360.09 },
  { year: 2019, therapyIncome: 2503463.49, nonEmploymentCosts: 170088.91, employeePayroll: 533175.95 },
  { year: 2020, therapyIncome: 2535944.52, nonEmploymentCosts: 171824.41, employeePayroll: 573277.22 },
  { year: 2021, therapyIncome: 2686843.84, nonEmploymentCosts: 176887.39, employeePayroll: 655524.05 },
  { year: 2022, therapyIncome: 2582916.38, nonEmploymentCosts: 269191.26, employeePayroll: 503812.98 },
  { year: 2023, therapyIncome: 2963164.73, nonEmploymentCosts: 201243.57, employeePayroll: 790092.00 },
  // 2024+: therapyIncome is now truly therapy income only (medical director income is separate)
  { year: 2024, therapyIncome: 2934770.14, nonEmploymentCosts: 261114.98, employeePayroll: 785924.54 },
  // 2025 actuals per provided figures
  { year: 2025, therapyIncome: 3164006.93, nonEmploymentCosts: 229713.57, employeePayroll:  752155.73  },
]

// Helper function to calculate true total income for any year
export function getTotalIncome(yearData: YearRow | FutureYear): number {
  // For historic years 2016-2023, therapyIncome represents total income (no separate MD data)
  if ('year' in yearData && yearData.year <= 2023) {
    return yearData.therapyIncome
  }
  
  // For 2024+ (including historic 2024-2025), calculate therapy + medical director income
  const therapyIncome = yearData.therapyIncome || 0
  
  // For historic years (2024-2025), we need to estimate medical director income
  if ('employeePayroll' in yearData) {
    // Historic year - estimate medical director income based on defaults
    const defaultMedicalDirectorIncome = 119373.75 // Default shared MD income
    const defaultPrcsMedicalDirectorIncome = 60000 // Default PRCS MD income
    return therapyIncome + defaultMedicalDirectorIncome + defaultPrcsMedicalDirectorIncome
  }
  
  // For future years, calculate from stored values
  const futureYear = yearData as FutureYear
  const medicalDirectorIncome = futureYear.medicalDirectorHours ?? 110000
  const prcsMedicalDirectorIncome = futureYear.prcsDirectorPhysicianId ? (futureYear.prcsMedicalDirectorHours ?? 60000) : 0
  
  return therapyIncome + medicalDirectorIncome + prcsMedicalDirectorIncome
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore: kept for future use
function defaultPhysiciansGeneric(year: number): Physician[] {
  return [
    { id: `${year}-P1`, name: 'Physician 1', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P2`, name: 'Physician 2', type: 'partner', weeksVacation: 4 },
    { id: `${year}-P3`, name: 'Physician 3', type: 'partner', weeksVacation: 4 },
    { id: `${year}-E1`, name: 'Physician 4', type: 'employee', salary: 500000 },
  ]
}
/* eslint-enable @typescript-eslint/no-unused-vars */

// Helper function to calculate even medical director hour percentages among partners
function calculateMedicalDirectorHourPercentages(physicians: Physician[]): Physician[] {
  // Calculate total partner work time (sum of partner portions, ignoring vacation as requested)
  const totalPartnerPortions = physicians.reduce((sum, physician) => {
    return sum + getPartnerPortionOfYear(physician)
  }, 0)
  
  // If no partners, return physicians as-is
  if (totalPartnerPortions === 0) {
    return physicians.map(p => ({
      ...p,
      medicalDirectorHoursPercentage: 0,
      hasMedicalDirectorHours: false
    }))
  }
  
  // Distribute percentages evenly among partners based on their portion of year
  return physicians.map(physician => {
    const partnerPortion = getPartnerPortionOfYear(physician)
    const percentage = partnerPortion > 0 ? (partnerPortion / totalPartnerPortions) * 100 : 0
    
    return {
      ...physician,
      medicalDirectorHoursPercentage: percentage,
      hasMedicalDirectorHours: percentage > 0
    }
  })
}

function scenario2024Defaults(): Physician[] {
  const physicians: Physician[] = [
    { id: `2024-JS`, name: 'JS', type: 'partner' as PhysicianType, weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-GA`, name: 'GA', type: 'partner' as PhysicianType, weeksVacation: 16, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-HW`, name: 'HW', type: 'partner' as PhysicianType, weeksVacation: 19, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-MC`, name: 'MC', type: 'employee' as PhysicianType, salary: 341323.02, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    { id: `2024-CD`, name: 'CD', type: 'employeeToTerminate' as PhysicianType, terminatePortionOfYear: 30/365, salary: 318640, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Jan 31 termination
    { id: `2024-BT`, name: 'BT', type: 'newEmployee' as PhysicianType, startPortionOfYear: 279/365, salary: 407196, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Oct 7 start
  ]
  return calculateMedicalDirectorHourPercentages(physicians)
}

function scenarioADefaultsByYear(year: number): Physician[] {
  let physicians: Physician[] = []
  
  if (year === 2025) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 6.96, trailingSharedMdAmount: 8302.50 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
    ]
  }
  
  // For 2025, medical director percentages are manually set, so return directly
  if (year === 2025) {
    return physicians
  }
  
  return calculateMedicalDirectorHourPercentages(physicians)
}

// Helper: Get Social Security wage base limit for a given year
function getSocialSecurityWageBase(year: number): number {
  const wageBases: Record<number, number> = {
    2025: 176100,
    2026: 183600,
    2027: 190800,
    2028: 198900,
    2029: 207000,
    2030: 215400,
  }
  return wageBases[year] || wageBases[2030] // Use 2030 as fallback for later years
}

// Helper: employer payroll taxes for W2 annual wages (WA State medical practice <50 employees)
function calculateEmployerPayrollTaxes(annualWages: number, year: number = 2025): number {
  const ssWageBase = getSocialSecurityWageBase(year)
  
  // Federal taxes
  const federalUnemploymentTax = Math.min(annualWages, 7000) * 0.006 // FUTA: 0.6% on first $7,000
  const socialSecurityTax = Math.min(annualWages, ssWageBase) * 0.062 // FICA: 6.2%
  const medicareTax = annualWages * 0.0145 // Medicare: 1.45% on all wages
  // Note: Additional Medicare tax (0.9% over $200K) is employee-paid, not employer-paid
  
  // Washington State taxes
  const waUnemploymentTax = Math.min(annualWages, 72800) * 0.009 // WA SUTA: 0.9% on first $72,800
  const waFamilyLeaveTax = Math.min(annualWages, ssWageBase) * 0.00658 // WA FLI: 0.658% on first SS wage base
  const waStateDisabilityTax = annualWages * 0.00255 // WA SDI: 0.255% on all wages
  const washingtonRateTax = annualWages * 0.0003 // Washington Rate: 0.030% on all wages
  
  return federalUnemploymentTax + socialSecurityTax + medicareTax + 
         waUnemploymentTax + waFamilyLeaveTax + waStateDisabilityTax + washingtonRateTax
}

const MONTHLY_BENEFITS_MED = 796.37
const MONTHLY_BENEFITS_DENTAL = 57.12
const MONTHLY_BENEFITS_VISION = 6.44
const ANNUAL_BENEFITS_FULLTIME = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
export const NET_PARTNER_POOL_2025 =  2362198.89 
const DEFAULT_MISC_EMPLOYMENT_COSTS = 29115.51

// Helper: Calculate benefit costs for a given year with growth applied
function getBenefitCostsForYear(year: number, benefitGrowthPct: number): number {
  const baseYear = 2025
  const baseCost = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
  if (year <= baseYear) {
    return baseCost
  }
  const yearsOfGrowth = year - baseYear
  const growthMultiplier = Math.pow(1 + benefitGrowthPct / 100, yearsOfGrowth)
  return baseCost * growthMultiplier
}

// Default Staff employment costs (wages + employer taxes + benefits for FT 1)
function computeDefaultNonMdEmploymentCosts(year: number = 2025): number {
  // Return the correct 2025 baseline value
  if (year === 2025) {
    return 164273.25
  }
  
  // For other years, use the original calculation
  // Employee 1: $31.25/hr, 40 hrs/week, full-time + benefits
  const emp1Wages = 31.25 * 40 * 52
  const emp1Taxes = calculateEmployerPayrollTaxes(emp1Wages, year)
  const emp1Total = emp1Wages + emp1Taxes + ANNUAL_BENEFITS_FULLTIME
  // Employee 2: $27/hr, 32 hrs/week, part-time (no benefits specified)
  const emp2Wages = 27 * 32 * 52
  const emp2Taxes = calculateEmployerPayrollTaxes(emp2Wages, year)
  const emp2Total = emp2Wages + emp2Taxes
  // Employee 3: $23/hr, 20 hrs/week, part-time
  const emp3Wages = 23 * 20 * 52
  const emp3Taxes = calculateEmployerPayrollTaxes(emp3Wages, year)
  const emp3Total = emp3Wages + emp3Taxes
  return Math.round(emp1Total + emp2Total + emp3Total)
}


const FUTURE_YEARS_BASE: Omit<FutureYear, 'physicians'>[] = Array.from({ length: 5 }).map((_, idx) => {
  const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1 // start after last actual (2025)
  const year = startYear + idx
  return {
    year,
    therapyIncome: HISTORIC_DATA[HISTORIC_DATA.length - 1].therapyIncome,
    nonEmploymentCosts:
      HISTORIC_DATA[HISTORIC_DATA.length - 1].nonEmploymentCosts,
    nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(year),
    locumCosts: year === 2026 ? 60000 : 120000,
    miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
  }
})

const INITIAL_FUTURE_YEARS_A: FutureYear[] = FUTURE_YEARS_BASE.map((b) => {
  const physicians = scenarioADefaultsByYear(b.year)
  const js = physicians.find((p) => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && js ? js.id : undefined,
  }
})

function scenarioBDefaultsByYear(year: number): Physician[] {
  let physicians: Physician[] = []
  
  if (year === 2025) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 328840, weeksVacation: 9, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 26.39 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-GA`, name: 'GA', type: 'partner', weeksVacation: 16, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 33.33 },
      { id: `${year}-HW`, name: 'HW', type: 'partnerToRetire', partnerPortionOfYear: 0, buyoutCost: 51666.58, receivesBonuses: false, bonusAmount: 0, hasMedicalDirectorHours: true, medicalDirectorHoursPercentage: 6.96, trailingSharedMdAmount: 8302.50 },
      { id: `${year}-BT`, name: 'BT', type: 'employee', salary: 430760, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
    ]
  }
  else if (year === 2026) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 11, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-GA`, name: 'GA', type: 'partnerToRetire', partnerPortionOfYear: 182/365, weeksVacation: 8, buyoutCost: 50000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'employeeToPartner', employeePortionOfYear: 181/365, salary: 507240, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-LK`, name: 'LK', type: 'newEmployee', startPortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2027) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 8, receivesBonuses: false, bonusAmount: 0 }, // First year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employee', salary: 600000, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-P5`, name: 'Potential Hire', type: 'newEmployee', startPortionOfYear: 0, salary: 500000, receivesBenefits: true, receivesBonuses: true, bonusAmount: 20000 },
    ]
  }
  else if (year === 2028) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-LK`, name: 'LK', type: 'employeeToPartner', employeePortionOfYear: calendarDateToPortion(6, 1, year), salary: 600000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Becomes partner exactly 2 years after hire
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employee', salary: 500000, receivesBenefits: true, receivesBonuses: false, bonusAmount: 0 }, // Second year as employee
    ]
  }
  else if (year === 2029) {
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 }, // Third year as partner
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: 9, receivesBonuses: false, bonusAmount: 0 }, // Second year as partner
      { id: `${year}-P5`, name: 'Potential Hire', type: 'employeeToPartner', employeePortionOfYear: 0, salary: 500000, weeksVacation: 8, receivesBenefits: false, receivesBonuses: false, bonusAmount: 0 }, // Transition year - becomes partner
    ]
  }
  else {
    // 2030+
    physicians = [
      { id: `${year}-MC`, name: 'MC', type: 'partner', weeksVacation: 10, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-JS`, name: 'JS', type: 'partner', weeksVacation: 12, receivesBonuses: false, bonusAmount: 0 },
      { id: `${year}-BT`, name: 'BT', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2027)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-LK`, name: 'LK', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2028)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly, max 12
      { id: `${year}-P5`, name: 'Potential Hire', type: 'partner', weeksVacation: Math.min(12, 8 + (year - 2029)), receivesBonuses: false, bonusAmount: 0 }, // Increases yearly from 2030, max 12
    ]
  }
  
  // For 2025, medical director percentages are manually set, so return directly
  if (year === 2025) {
    return physicians
  }
  
  return calculateMedicalDirectorHourPercentages(physicians)
}

const INITIAL_FUTURE_YEARS_B: FutureYear[] = FUTURE_YEARS_BASE.map((b) => {
  const physicians = scenarioBDefaultsByYear(b.year)
  const js = physicians.find((p) => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
  return {
    ...b,
    // Scenario B default: $0 locums except $60k in 2026
    locumCosts: b.year === 2026 ? 60000 : 0,
    physicians,
    prcsDirectorPhysicianId: b.year >= 2024 && js ? js.id : undefined,
  }
})
export const useDashboardStore = create<Store>()(
  persist(
    immer<Store>((set, get) => {
      void get
      return {
        historic: HISTORIC_DATA,
        scenarioA: {
          future: INITIAL_FUTURE_YEARS_A,
          projection: { 
            incomeGrowthPct: 3.7, 
            medicalDirectorHours: 110000,
            prcsMedicalDirectorHours: 60000,
            nonEmploymentCostsPct: 7.8, 
            nonMdEmploymentCostsPct: 6.0, 
            locumsCosts: 120000, 
            miscEmploymentCostsPct: 6.7, 
            benefitCostsGrowthPct: 5.0 
          },
          selectedYear: 2025, // Default to Baseline tab
          dataMode: '2025 Data',
        },
        scenarioB: undefined,
        scenarioBEnabled: false,
        setScenarioEnabled: (enabled) => {
          set((state) => {
            state.scenarioBEnabled = enabled
            if (enabled) {
              // Initialize scenario B with its own defaults instead of cloning A
              state.scenarioB = {
                future: INITIAL_FUTURE_YEARS_B.map((f) => ({ ...f, physicians: [...f.physicians] })),
                projection: { 
                  incomeGrowthPct: 3.7, 
                  medicalDirectorHours: 110000,
                  prcsMedicalDirectorHours: 60000,
                  nonEmploymentCostsPct: 7.8, 
                  nonMdEmploymentCostsPct: 6.0, 
                  locumsCosts: 0, 
                  miscEmploymentCostsPct: 6.7,
                  benefitCostsGrowthPct: 5.0
                },
                selectedYear: state.scenarioA.selectedYear,
                dataMode: '2024 Data',
              }
            } else {
              state.scenarioB = undefined
            }
          })
          // Apply projections to scenario B if it was just enabled
          if (enabled) {
            const store = useDashboardStore.getState()
            if (store.scenarioB) store.applyProjectionFromLastActual('B')
          }
        },
        
        setPrcsDirector: (scenario, year, physicianId) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return
            // Determine selected physician's name in the source year (for cross-year mapping)
            const selectedName = physicianId
              ? fy.physicians.find((p) => p.id === physicianId)?.name
              : undefined

            // Propagate the selection (or deselection) to this and all future years in the scenario
            for (const f of sc.future) {
              if (f.year < year) continue
              if (!physicianId) {
                // Deselect in future years
                f.prcsDirectorPhysicianId = undefined
                continue
              }
              // Map by name to each year's physician id, if present
              const match = f.physicians.find((p) => p.name === selectedName && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
              f.prcsDirectorPhysicianId = match ? match.id : undefined
            }
          }),
        setFutureValue: (scenario, year, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (fy) {
              ;(fy as any)[field] = value
            }
          }),
        upsertPhysician: (scenario, year, physician) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return

            // Update or add in the chosen year
            const idx = fy.physicians.findIndex((p) => p.id === physician.id)
            const isNewInYear = idx < 0
            const previousInYear = idx >= 0 ? fy.physicians[idx] : undefined
            const oldName = previousInYear?.name
            // Track previous for change detection
            const prev = previousInYear

            if (idx >= 0) fy.physicians[idx] = physician
            else fy.physicians.push(physician)

            // Determine if this edit was a manual MD percentage adjustment
            const mdPctChanged = !!prev && prev.medicalDirectorHoursPercentage !== physician.medicalDirectorHoursPercentage
            // Determine if partner mix/portion changed requiring auto redistribution
            const prevPartnerPortion = prev ? getPartnerPortionOfYear(prev) : 0
            const newPartnerPortion = getPartnerPortionOfYear(physician)
            const typeChanged = !!prev && prev.type !== physician.type
            const partnerMixChanged = isNewInYear
              ? newPartnerPortion > 0
              : (typeChanged || prevPartnerPortion !== newPartnerPortion)

            if (mdPctChanged) {
              // Proportionally scale other eligible partners to keep total at 100
              const targetId = physician.id
              const eligibles = fy.physicians.filter(p => getPartnerPortionOfYear(p) > 0)
              const target = eligibles.find(p => p.id === targetId)
              if (target) {
                const others = eligibles.filter(p => p.id !== targetId)
                const desiredTargetPct = Math.max(0, Math.min(100, physician.medicalDirectorHoursPercentage ?? 0))
                if (others.length === 0) {
                  target.medicalDirectorHoursPercentage = 100
                  target.hasMedicalDirectorHours = true
                } else {
                  const remaining = Math.max(0, 100 - desiredTargetPct)
                  const sumOtherCurrent = others.reduce((s, p) => s + (p.medicalDirectorHoursPercentage ?? 0), 0)
                  if (sumOtherCurrent > 0) {
                    // Scale by current proportions
                    for (let i = 0; i < others.length; i++) {
                      const p = others[i]
                      const scaled = (p.medicalDirectorHoursPercentage ?? 0) / sumOtherCurrent * remaining
                      p.medicalDirectorHoursPercentage = scaled
                      p.hasMedicalDirectorHours = scaled > 0
                    }
                  } else {
                    // Distribute by partner portion weights; fallback to equal
                    const weights = others.map(p => ({ p, w: getPartnerPortionOfYear(p) }))
                    const sumW = weights.reduce((s, x) => s + x.w, 0)
                    if (sumW > 0) {
                      for (const { p, w } of weights) {
                        const scaled = w / sumW * remaining
                        p.medicalDirectorHoursPercentage = scaled
                        p.hasMedicalDirectorHours = scaled > 0
                      }
                    } else {
                      const even = remaining / others.length
                      for (const p of others) {
                        p.medicalDirectorHoursPercentage = even
                        p.hasMedicalDirectorHours = even > 0
                      }
                    }
                  }
                  // Set target last to the requested value
                  target.medicalDirectorHoursPercentage = desiredTargetPct
                  target.hasMedicalDirectorHours = desiredTargetPct > 0
                }
              }
            } else if (partnerMixChanged) {
              // Only auto-redistribute when partner mix/portion changes
              fy.physicians = calculateMedicalDirectorHourPercentages(fy.physicians)
            }

            // If the physician's name changed, propagate the new name across ALL years
            if (oldName && oldName !== physician.name) {
              for (const fut of sc.future) {
                for (let k = 0; k < fut.physicians.length; k++) {
                  if (fut.physicians[k].name === oldName) {
                    fut.physicians[k] = { ...fut.physicians[k], name: physician.name }
                  }
                }
              }
            }

            // Helper to build a reasonable id for a given future year
            const toIdForYear = (targetYear: number, base: Physician) => {
              const nameSlug = (base.name || 'physician')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
              return `${targetYear}-${nameSlug || 'md'}`
            }

            // Propagation rules across subsequent years
            const targetName = physician.name
            const salarySource = typeof physician.salary === 'number' ? physician.salary : undefined
            const weeksSource = typeof physician.weeksVacation === 'number' ? physician.weeksVacation : undefined
            const becomesPartnerNextYears = physician.type === 'employeeToPartner'
            const retiresThisYear = physician.type === 'partnerToRetire'
            const terminatesThisYear = physician.type === 'employeeToTerminate'

            for (const fut of sc.future) {
              if (fut.year <= year) continue

              // If this physician retires this year, remove them from future years
              if (retiresThisYear) {
                fut.physicians = fut.physicians.filter((p) => p.name !== targetName && p.id !== physician.id)
                continue
              }

              // If this physician terminates employment this year, remove them from future years
              if (terminatesThisYear) {
                fut.physicians = fut.physicians.filter((p) => p.name !== targetName && p.id !== physician.id)
                continue
              }

              // Find same MD by name (preferred) or id
              let j = fut.physicians.findIndex((p) => p.name === targetName)
              if (j < 0) j = fut.physicians.findIndex((p) => p.id === physician.id)

              if (j < 0) {
                // If adding in this year (or if not present later), add them for all subsequent years
                if (isNewInYear) {
                  // Determine type for this future year based on rules:
                  // - Mixed (employeeToPartner) in the edited year -> partner thereafter
                  // - Employee in the edited year -> employee for next year, then employeeToPartner transition year, then partner
                  // - New Employee in the edited year -> employee for next year, then employeeToPartner transition year, then partner
                  // - Employee->Terminate should not propagate (they leave employment)
                  // - partnerToRetire should not propagate (handled above with continue)
                  let computedType: PhysicianType = physician.type
                  if (becomesPartnerNextYears) {
                    computedType = 'partner'
                  } else if (physician.type === 'employee' || physician.type === 'newEmployee') {
                    // Calculate transition year based on start date for newEmployee
                    let transitionYear = year + 2; // Default for regular employees
                    
                    if (physician.type === 'newEmployee' && physician.startPortionOfYear) {
                      // For new employees, calculate how long they've been working to determine partner eligibility
                      // If they start mid-year, they need a full year + transition year
                      const startMonth = Math.floor((physician.startPortionOfYear * 365) / 30.44) + 1; // Approximate month
                      if (startMonth > 6) { // If starting after mid-year (July+), need extra year
                        transitionYear = year + 3;
                      }
                    }
                    
                    if (fut.year < transitionYear) {
                      computedType = 'employee'
                    } else if (fut.year === transitionYear) {
                      // Use employeeToPartner for the transition year to handle delayed W2 payments
                      // This ensures all partner transitions properly account for W2 payments
                      computedType = 'employeeToPartner'
                    } else {
                      computedType = 'partner'
                    }
                  } else if (physician.type === 'partnerToRetire') {
                    // This should not happen since we continue above, but just in case
                    continue
                  }

                  const cloned: Physician = {
                    id: toIdForYear(fut.year, physician),
                    name: physician.name,
                    type: computedType,
                    salary:
                      computedType === 'partner'
                        ? undefined
                        : (physician.type === 'employee' || physician.type === 'employeeToPartner' || physician.type === 'newEmployee' || physician.type === 'employeeToTerminate')
                          ? (physician.salary ?? 500000)
                          : undefined,
                    weeksVacation:
                      computedType === 'partner' || computedType === 'employeeToPartner'
                        ? (physician.weeksVacation ?? 8)
                        : undefined,
                    employeePortionOfYear: 
                      computedType === 'partner' 
                        ? undefined 
                        : computedType === 'employeeToPartner' 
                          ? 0 // Always use Partner->Employee type (employeePortionOfYear = 0) in transition year
                              // This ensures delayed W2 payments are calculated even for Jan 1 start dates
                          : physician.employeePortionOfYear,
                  }
                  fut.physicians.push(cloned)
                  continue
                } else {
                  // If not new but missing later, skip unless we explicitly want to re-create
                  // The requested behavior does not require re-creating on edit
                  continue
                }
              }

              const existing = fut.physicians[j]
              const updated: Physician = { ...existing }

              // Mixed one year -> partner thereafter
              if (becomesPartnerNextYears) {
                updated.type = 'partner'
                updated.salary = undefined
                updated.employeePortionOfYear = undefined
              }

              // Salary minimum propagation for employees
              if (salarySource !== undefined) {
                if (updated.type === 'employee' || updated.type === 'employeeToPartner' || updated.type === 'newEmployee' || updated.type === 'employeeToTerminate') {
                  const currentSalary = typeof updated.salary === 'number' ? updated.salary : 0
                  updated.salary = Math.max(currentSalary, salarySource)
                }
              }

              // Weeks off minimum propagation for partners
              if (weeksSource !== undefined) {
                if (updated.type === 'partner' || updated.type === 'employeeToPartner') {
                  const currentWeeks = typeof updated.weeksVacation === 'number' ? updated.weeksVacation : 0
                  updated.weeksVacation = Math.max(currentWeeks, weeksSource)
                }
              }

              fut.physicians[j] = updated
              // Re-apply distribution in future years only when partner mix/portion changed in base year
              if (partnerMixChanged) {
                fut.physicians = calculateMedicalDirectorHourPercentages(fut.physicians)
              }
            }
          }),
        removePhysician: (scenario, year, physicianId) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            // Identify by id and, if possible, by name to remove across years
            const thisYear = sc.future.find((f) => f.year === year)
            if (!thisYear) return
            const toRemove = thisYear.physicians.find((p) => p.id === physicianId)
            const nameKey = toRemove?.name

            for (const fut of sc.future) {
              if (fut.year < year) continue
              fut.physicians = fut.physicians.filter((p) => {
                if (p.id === physicianId) return false
                if (nameKey && p.name === nameKey) return false
                return true
              })
              // Re-distribute medical director hours after removal
              fut.physicians = calculateMedicalDirectorHourPercentages(fut.physicians)
            }
          }),
        reorderPhysicians: (scenario, year, fromIndex, toIndex) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            const fy = sc.future.find((f) => f.year === year)
            if (!fy) return
            
            // Create a copy of the physicians array and reorder it
            const physicians = [...fy.physicians]
            const [movedPhysician] = physicians.splice(fromIndex, 1)
            physicians.splice(toIndex, 0, movedPhysician)
            
            // Update the physicians array
            fy.physicians = physicians
          }),
        setProjectionField: (scenario, field, value) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // Apply appropriate limits based on field type
            if (field === 'locumsCosts' || field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') {
              // Dollar amount fields should use reasonable range (0 to 1M for locums, 0 to 120K for medical director amounts)
              const maxValue = field === 'medicalDirectorHours' ? 120000 : (field === 'prcsMedicalDirectorHours' ? 120000 : 1000000)
              sc.projection[field] = Math.max(0, Math.min(maxValue, value))
            } else {
              // Percentage fields should be limited to reasonable range (-10% to +20%)
              // Also round to 1 decimal place to avoid floating point artifacts (e.g., 5.700001)
              const clamped = Math.max(-10, Math.min(20, value))
              sc.projection[field] = Math.round(clamped * 10) / 10
            }
            
            // When changing Medical Director override sliders, force-sync the per-year values so
            // the yearly sliders necessarily move with the projection override.
            if (field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') {
              for (const fy of sc.future) {
                ;(fy as any)[field] = sc.projection[field]
              }
            }
            
            // Apply the updated projections to all future years immediately within the same state update
            // Use baseline data based on selected dataMode
            const dataMode = sc.dataMode
            const last2024 = state.historic.find((h) => h.year === 2024)
            const last2025 = state.historic.find((h) => h.year === 2025)
            
            // Determine starting values based on data mode
            let baselineData
            if (dataMode === 'Custom') {
              // For Custom mode, use the existing baseline data from year 2025 in future array
              const customBaseline = sc.future.find(f => f.year === 2025)
              if (customBaseline) {
                baselineData = {
                  therapyIncome: customBaseline.therapyIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  therapyIncome: last2025?.therapyIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                therapyIncome: last2024.therapyIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: 24623.49, // 2024 actual misc employment from image
                nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
              }
            } else if (last2025) {
              baselineData = {
                therapyIncome: last2025.therapyIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                therapyIncome: 3344068.19,
                nonEmploymentCosts: 229713.57,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            
            // Starting values from the selected baseline
            let income = baselineData.therapyIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let nonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              nonMdEmploymentCosts = nonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)
              
              fy.therapyIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = nonMdEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              fy.locumCosts = fy.year === 2026 ? 60000 : sc.projection.locumsCosts
            }
          }),
        applyProjectionFromLastActual: (scenario) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // Use baseline data based on selected dataMode
            const dataMode = sc.dataMode
            const last2024 = state.historic.find((h) => h.year === 2024)
            const last2025 = state.historic.find((h) => h.year === 2025)
            
            // Determine starting values based on data mode
            let baselineData
            if (dataMode === 'Custom') {
              // For Custom mode, use the existing baseline data from year 2025 in future array
              const customBaseline = sc.future.find(f => f.year === 2025)
              if (customBaseline) {
                baselineData = {
                  therapyIncome: customBaseline.therapyIncome,
                  nonEmploymentCosts: customBaseline.nonEmploymentCosts,
                  miscEmploymentCosts: customBaseline.miscEmploymentCosts,
                  nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
                }
              } else {
                // Fallback if Custom baseline missing (shouldn't happen)
                baselineData = {
                  therapyIncome: last2025?.therapyIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                }
              }
            } else if (dataMode === '2024 Data' && last2024) {
              baselineData = {
                therapyIncome: last2024.therapyIncome,
                nonEmploymentCosts: last2024.nonEmploymentCosts,
                miscEmploymentCosts: 24623.49, // 2024 actual misc employment from image
                nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
              }
            } else if (last2025) {
              baselineData = {
                therapyIncome: last2025.therapyIncome,
                nonEmploymentCosts: last2025.nonEmploymentCosts,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            } else {
              // Fallback to 2025 hardcoded values
              baselineData = {
                therapyIncome: 3344068.19,
                nonEmploymentCosts: 229713.57,
                miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
              }
            }
            
            // Convert percentage growth rates to decimal multipliers
            const incomeGpct = sc.projection.incomeGrowthPct / 100
            const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
            const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
            const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100
            
            // Starting values from the selected baseline
            let income = baselineData.therapyIncome
            let nonEmploymentCosts = baselineData.nonEmploymentCosts
            let nonMdEmploymentCosts = baselineData.nonMdEmploymentCosts
            let miscEmploymentCosts = baselineData.miscEmploymentCosts
            
            // Apply projections to each future year (SKIP baseline year 2025)
            for (const fy of sc.future) {
              if (fy.year === 2025) continue  // Never overwrite baseline data
              
              income = income * (1 + incomeGpct)
              nonEmploymentCosts = nonEmploymentCosts * (1 + nonEmploymentGpct)
              nonMdEmploymentCosts = nonMdEmploymentCosts * (1 + nonMdEmploymentGpct)
              miscEmploymentCosts = miscEmploymentCosts * (1 + miscEmploymentGpct)
              
              fy.therapyIncome = income
              fy.nonEmploymentCosts = nonEmploymentCosts
              fy.nonMdEmploymentCosts = nonMdEmploymentCosts
              fy.miscEmploymentCosts = miscEmploymentCosts
              
              // Set locums costs from the global override (except 2026 which defaults to 60K)
              fy.locumCosts = fy.year === 2026 ? 60000 : sc.projection.locumsCosts
            }

            // Do not modify PRCS Director assignment during projection recalculation
          }),
        setSelectedYear: (scenario, year) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            sc.selectedYear = year
          }),
        setDataMode: (scenario, mode) =>
          set((state) => {
            const sc = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!sc) return
            
            // If switching TO Custom mode, capture current baseline data and make it editable
            if (mode === 'Custom' && sc.dataMode !== 'Custom') {
              const last2024 = state.historic.find((h) => h.year === 2024)
              const last2025 = state.historic.find((h) => h.year === 2025)
              
              let baselineData: FutureYear
              
              if (sc.dataMode === '2024 Data' && last2024) {
                baselineData = {
                  year: 2025,
                  therapyIncome: last2024.therapyIncome,
                  nonEmploymentCosts: last2024.nonEmploymentCosts,
                  nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
                  locumCosts: 113400, // 2024 actual locums costs
                  miscEmploymentCosts: 24623.49, // 2024 actual misc employment
                  physicians: scenario2024Defaults(),
                }
              } else if (sc.dataMode === '2025 Data' && last2025) {
                baselineData = {
                  year: 2025,
                  therapyIncome: last2025.therapyIncome,
                  nonEmploymentCosts: last2025.nonEmploymentCosts,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: 54600,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
                }
              } else {
                // Fallback to 2025 defaults
                const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
                const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
                baselineData = {
                  year: 2025,
                  therapyIncome: last2025?.therapyIncome || 3344068.19,
                  nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
                  nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
                  locumCosts: 54600,
                  miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
                  medicalDirectorHours: 119373.75, // 2025 shared medical director amount
                  prcsMedicalDirectorHours: 37792.5, // 2025 PRCS medical director amount (JS)
                  prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
                  physicians,
                }
              }
              
              // Set the baseline data as the first entry in future years (replacing or adding 2025)
              const existingIndex = sc.future.findIndex(f => f.year === 2025)
              if (existingIndex >= 0) {
                sc.future[existingIndex] = baselineData
              } else {
                sc.future.unshift(baselineData)
              }
            }
            
            sc.dataMode = mode
          }),
        loadSnapshot: (snapshot) =>
          set((state) => {
            state.scenarioA = snapshot.scenarioA
            state.scenarioBEnabled = !!snapshot.scenarioBEnabled
            state.scenarioB = snapshot.scenarioBEnabled && snapshot.scenarioB ? snapshot.scenarioB : undefined
          }),
        // Reset physicians for a specific scenario and year to defaults
        resetPhysicians: (scenario: ScenarioKey, year: number) => {
          const defaultPhysicians = scenario === 'A' 
            ? scenarioADefaultsByYear(year) 
            : scenarioBDefaultsByYear(year)
          
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            const futureYear = scenarioState.future.find(f => f.year === year)
            if (!futureYear) return
            
            // Reset to default physicians
            futureYear.physicians = defaultPhysicians.map(p => ({ ...p }))
          })
        },

        // Reset all physicians across all years for a scenario
        resetAllPhysicians: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.future.forEach(fy => {
              const defaultPhysicians = scenario === 'A' 
                ? scenarioADefaultsByYear(fy.year) 
                : scenarioBDefaultsByYear(fy.year)
              fy.physicians = defaultPhysicians.map(p => ({ ...p }))
            })
          })
        },

        // Reset projection settings for a scenario to defaults
        resetProjectionSettings: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.projection = {
              incomeGrowthPct: 3.7, 
              medicalDirectorHours: 110000,
              prcsMedicalDirectorHours: 60000,
              nonEmploymentCostsPct: 7.8, 
              nonMdEmploymentCostsPct: 6.0, 
              locumsCosts: 120000, 
              miscEmploymentCostsPct: 6.7, 
              benefitCostsGrowthPct: 5.0 
            }
          })
          
          // Recalculate projections after resetting settings
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset year-by-year income/cost values to projected values for a scenario
        resetYearByYearValues: (scenario: ScenarioKey) => {
          // This will reset all custom future values back to projected values
          get().applyProjectionFromLastActual(scenario)
        },

        // Reset app-level view settings (which year selected, data mode, etc.)
        resetViewSettings: (scenario: ScenarioKey) => {
          set((state) => {
            const scenarioState = scenario === 'A' ? state.scenarioA : state.scenarioB
            if (!scenarioState) return
            
            scenarioState.selectedYear = 2025 // Reset to Baseline tab
            scenarioState.dataMode = '2025 Data'
          })
        },

        resetToDefaults: () => {
          set((state) => {
            // Initialize scenario A with basic structure
            state.scenarioA = {
              future: INITIAL_FUTURE_YEARS_A.map((f) => ({ 
                ...f, 
                physicians: [...f.physicians.map(p => ({ ...p }))] 
              })),
              projection: { 
                incomeGrowthPct: 3.7, 
                medicalDirectorHours: 110000,
                prcsMedicalDirectorHours: 60000,
                nonEmploymentCostsPct: 7.8, 
                nonMdEmploymentCostsPct: 6.0, 
                locumsCosts: 120000, 
                miscEmploymentCostsPct: 6.7, 
                benefitCostsGrowthPct: 5.0 
              },
              selectedYear: 2025, // Reset to Baseline tab
              dataMode: '2025 Data',
            }
            
            // Reset app-level state (not handled by section resets)
            state.scenarioBEnabled = false
            state.scenarioB = undefined
          }, false)

          // Use the dedicated reset functions to ensure consistency
          const state = get()
          state.resetAllPhysicians('A')
          state.resetProjectionSettings('A')
          state.resetYearByYearValues('A')
          state.resetViewSettings('A')
        },
      }
    }),
    {
      name: 'radiantcare-state-v1',
      storage: createJSONStorage((): Storage => localStorage),
      partialize: (state: Store) => ({
        scenarioA: state.scenarioA,
        scenarioBEnabled: state.scenarioBEnabled,
        scenarioB: state.scenarioB,
      }),
    }
  )
)

// Initialize projections on store creation
setTimeout(() => {
  const store = useDashboardStore.getState()
  store.applyProjectionFromLastActual('A')
  if (store.scenarioB) store.applyProjectionFromLastActual('B')
}, 0)


// Calculate when benefits start for a new employee based on the new waiting period rules
function calculateBenefitStartDay(startDay: number, year: number): number {
  const { month: startMonth, day: startDayOfMonth } = dayOfYearToDate(startDay, year)
  
  // Rule: If start date is the first of any month (except February), benefits start next month
  if (startDayOfMonth === 1 && startMonth !== 2) {
    // Benefits start on the first of the next month
    const nextMonth = startMonth === 12 ? 1 : startMonth + 1
    const nextYear = startMonth === 12 ? year + 1 : year
    
    if (nextYear > year) {
      // If it rolls to next year, benefits start after this year ends
      return daysInYear(year) + 1
    }
    
    // Calculate day of year for first of next month
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let dayOfYear = 0
    for (let i = 0; i < nextMonth - 1; i++) {
      dayOfYear += daysInMonth[i]
    }
    return dayOfYear + 1
  }
  
  // Rule: If start is mid-month (or Feb 1st), benefits start one month PLUS rounding up to next month start
  // This means: 30 days + beginning of first full month after that
  const thirtyDaysAfterStart = startDay + 30
  
  if (thirtyDaysAfterStart > daysInYear(year)) {
    // If 30 days after start goes into next year, benefits start after this year
    return daysInYear(year) + 1
  }
  
  // Find what month the 30-day mark falls in
  const { month: month30Days } = dayOfYearToDate(thirtyDaysAfterStart, year)
  
  // Benefits start on the first of the month AFTER the 30-day mark
  const benefitMonth = month30Days === 12 ? 1 : month30Days + 1
  const benefitYear = month30Days === 12 ? year + 1 : year
  
  if (benefitYear > year) {
    // If benefits start next year, return beyond this year
    return daysInYear(year) + 1
  }
  
  // Calculate day of year for first of benefit month
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let dayOfYear = 0
  for (let i = 0; i < benefitMonth - 1; i++) {
    dayOfYear += daysInMonth[i]
  }
  return dayOfYear + 1
}

// Calculate total cost for an employee including benefits and payroll taxes (WA State medical practice <50 employees)
function calculateEmployeeTotalCost(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0): number {
  
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Monthly benefits (convert to annual) - only if employee receives benefits
  let annualBenefits = 0
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      // For new employees, use the new benefit waiting period calculation
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      // Only count benefits if they start within this year
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        annualBenefits = yearlyBenefitCost * benefitPortion
      }
    } else {
      // For regular employees and mixed types, full benefits if they receive them
      annualBenefits = yearlyBenefitCost
    }
  }
  
  // Calculate all employer payroll taxes using the comprehensive function
  const totalPayrollTaxes = calculateEmployerPayrollTaxes(baseSalary, year)
  
  return baseSalary + annualBenefits + totalPayrollTaxes + bonusAmount
}

// Mixed type helpers
function getEmployeePortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 1
  if (physician.type === 'partner') return 0
  if (physician.type === 'newEmployee') {
    // New employees work from their start date to end of year
    const startPortion = physician.startPortionOfYear ?? 0
    return 1 - startPortion
  }
  if (physician.type === 'employeeToTerminate') {
    // Terminating employees work from beginning of year to termination date
    const terminatePortion = physician.terminatePortionOfYear ?? 1
    return terminatePortion
  }
  const val = physician.employeePortionOfYear ?? 0.5
  return clamp(val, 0, 1)
}

function getPartnerPortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 0
  if (physician.type === 'newEmployee') return 0
  if (physician.type === 'employeeToTerminate') return 0
  if (physician.type === 'partner') return 1
  if (physician.type === 'employeeToPartner') return 1 - getEmployeePortionOfYear(physician)
  if (physician.type === 'partnerToRetire') return physician.partnerPortionOfYear ?? 0.5
  return 0
}

function getPartnerFTEWeight(physician: Physician): number {
  // Allow up to 24 weeks for historical data compatibility
  const weeks = clamp(physician.weeksVacation ?? 0, 0, 24)
  const baseFte = 1 - weeks / 52
  return baseFte * getPartnerPortionOfYear(physician)
}

// Calculate FTE weight properly accounting for vacation during partner working period
function getPartnerFTEWeightProper(physician: Physician): number {
  const partnerPortion = getPartnerPortionOfYear(physician)
  if (partnerPortion === 0) return 0
  
  const weeksVacation = clamp(physician.weeksVacation ?? 0, 0, 24)
  const partnerWeeksInYear = partnerPortion * 52
  
  // Vacation is taken during the partner working period
  const effectivePartnerWeeks = Math.max(0, partnerWeeksInYear - weeksVacation)
  
  // Return as fraction of full year for comparison
  return effectivePartnerWeeks / 52
}





function calculateDelayedW2Payment(physician: Physician, year: number): { amount: number; taxes: number; periodDetails: string } {
  if (physician.type !== 'employeeToPartner') {
    return { amount: 0, taxes: 0, periodDetails: '' }
  }
  
  // Manual override for MC in 2025
  if (physician.name === 'MC' && year === 2025) {
    return {
      amount: 15289.23,
      taxes: 1493.36,
      periodDetails: '12/14/24-12/27/24, 12/28/24-12/31/24 (manual override)'
    }
  }
  
  const transitionDay = employeePortionToTransitionDay(physician.employeePortionOfYear ?? 0.5, year)
  const transitionDate = new Date(year, 0, transitionDay) // Convert to actual date
  
  const periods = getPayPeriodsForYear(year)
  const salary = physician.salary ?? 0
  
  // Calculate hourly rate: salary ÷ (52 weeks × 5 days × 8 hours)
  const annualWorkHours = 52 * 5 * 8  // 2,080 hours per year
  const hourlyRate = salary / annualWorkHours
  
  let totalWorkDays = 0
  let periodDetails: string[] = []
  
  // Helper function to count business days (Mon-Fri) in a date range
  function countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      // 1 = Monday through 5 = Friday
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }
  
  // Find periods where work was done in prior year but paid in current year
  for (const period of periods) {
    // Skip periods where pay date is before transition date
    if (period.payDate < transitionDate) continue
    
    // Check if work period was in prior year
    if (period.periodStart.getFullYear() < year || period.periodEnd.getFullYear() < year) {
      // Calculate business days in prior year
      const priorYearEnd = new Date(year - 1, 11, 31)
      const periodStartInPriorYear = period.periodStart.getFullYear() < year ? period.periodStart : new Date(year, 0, 1)
      const periodEndInPriorYear = period.periodEnd.getFullYear() < year ? period.periodEnd : priorYearEnd
      
      if (periodStartInPriorYear <= priorYearEnd) {
        const businessDaysInPriorYear = countBusinessDays(periodStartInPriorYear, periodEndInPriorYear)
        totalWorkDays += businessDaysInPriorYear
        
        const periodStartStr = `${periodStartInPriorYear.getMonth() + 1}/${periodStartInPriorYear.getDate()}`
        const periodEndStr = `${periodEndInPriorYear.getMonth() + 1}/${periodEndInPriorYear.getDate()}`
        const payDateStr = `${period.payDate.getMonth() + 1}/${period.payDate.getDate()}`
        periodDetails.push(`${periodStartStr}-${periodEndStr} (paid ${payDateStr}, ${businessDaysInPriorYear} work days)`)
      }
    }
  }
  
  // Calculate total amount: business days × 8 hours/day × hourly rate
  const amount = totalWorkDays * 8 * hourlyRate
  const taxes = calculateEmployerPayrollTaxes(amount, year)
  
  return {
    amount: Math.round(amount),
    taxes: Math.round(taxes),
    periodDetails: periodDetails.join(', ')
  }
}

// Generate tooltip content for employee cost breakdown (WA State medical practice <50 employees)
function getEmployeeCostTooltip(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0, delayedW2Amount: number = 0, delayedW2Taxes: number = 0, delayedW2Details: string = ''): string {
  
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Calculate benefits with new waiting period for new employees
  let benefits = 0
  let benefitsNote = ''
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        benefits = yearlyBenefitCost * benefitPortion
        
        const { month: benefitMonth, day: benefitDay } = dayOfYearToDate(benefitStartDay, year)
        const benefitStartDate = dateToString(benefitMonth, benefitDay)
        benefitsNote = ` (benefits start ${benefitStartDate})`
      } else {
        benefitsNote = ` (benefits start next year)`
      }
    } else {
      benefits = yearlyBenefitCost
    }
  }
  
  const ssWageBase = getSocialSecurityWageBase(year)
  
  // Federal taxes
  const federalUnemployment = Math.min(baseSalary, 7000) * 0.006
  const socialSecurity = Math.min(baseSalary, ssWageBase) * 0.062
  const medicare = baseSalary * 0.0145
  // Note: Additional Medicare tax is employee-paid, not employer-paid
  
  // Washington State taxes
  const waUnemployment = Math.min(baseSalary, 72800) * 0.009
  const waFamilyLeave = Math.min(baseSalary, ssWageBase) * 0.00658
  const waStateDisability = baseSalary * 0.00255
  const washingtonRate = baseSalary * 0.0003
  
  const totalCost = calculateEmployeeTotalCost(employee, year, benefitGrowthPct)
  const totalCostWithDelayed = totalCost + delayedW2Amount + delayedW2Taxes
  
  return `Employee Total Cost Breakdown (${year}):
Base Salary: ${currency(baseSalary)}${bonusAmount > 0 ? `
Relocation/Signing Bonus: ${currency(bonusAmount)}` : ''}${employee.receivesBenefits ? `
Benefits (Medical/Dental/Vision): ${currency(benefits)}${benefitsNote}` : `
Benefits: None`}

Federal Taxes:
FUTA (0.6% on first $7K): ${currency(federalUnemployment)}
Social Security (6.2% on first ${currency(ssWageBase)}): ${currency(socialSecurity)}
Medicare (1.45%): ${currency(medicare)}

Washington State Taxes:
SUTA (0.9% on first $72.8K): ${currency(waUnemployment)}
Family Leave (0.658% on first ${currency(ssWageBase)}): ${currency(waFamilyLeave)}
State Disability (0.255%): ${currency(waStateDisability)}
Washington Rate (0.030%): ${currency(washingtonRate)}${delayedW2Amount > 0 ? `

Delayed W2 Payments (Prior Year Work):
W2 Amount: ${currency(delayedW2Amount)}
Payroll Taxes: ${currency(delayedW2Taxes)}
Pay Periods: ${delayedW2Details}` : ''}

Total Cost: ${currency(totalCostWithDelayed)}

This total cost is deducted from the partner compensation pool.`
}

export function usePartnerComp(year: number, scenario: ScenarioKey) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fy = sc.future.find((f) => f.year === year)
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode
  return useMemo(() => {
    // For baseline year (2025): always derive from the selected data mode unless in Custom.
    // This avoids stale Custom state (e.g., a persisted 2025 entry in future years) from skewing baseline.
    if (year === 2025 && dataMode !== 'Custom') {
      // Get the baseline scenario data which includes PRCS director assignment
      const baselineData = (() => {
        const last2024 = store.historic.find(h => h.year === 2024)
        const last2025 = store.historic.find(h => h.year === 2025)
        
        if (dataMode === '2024 Data' && last2024) {
          const physicians = scenario2024Defaults()
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: 102870,
            prcsMedicalDirectorHours: 25805,
            prcsDirectorPhysicianId: js?.id,
            physicians,
          }
        } else if (dataMode === '2025 Data' && last2025) {
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: 119373.75,
            prcsMedicalDirectorHours: 37792.5,
            prcsDirectorPhysicianId: js?.id,
            physicians,
          }
        } else {
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            medicalDirectorHours: 119373.75,
            prcsMedicalDirectorHours: 37792.5,
            prcsDirectorPhysicianId: js?.id,
            physicians,
          }
        }
      })()
      
      const partners = baselineData.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
      const partnerFTEs = partners.map((p) => {
        // Allow up to 24 weeks for historical data compatibility
        const weeks = clamp(p.weeksVacation ?? 0, 0, 24)
        const fte = 1 - weeks / 52
        const weight = fte * getPartnerPortionOfYear(p)
        return { p, weight }
      })
      const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
      // For 2025, only account for buyout costs of partners who worked part of the year
      // Partners who retired in prior year (weight = 0) shouldn't reduce the active partner pool
      const buyoutCosts = partners.reduce((sum, p) => {
        if (p.type === 'partnerToRetire') {
          const weight = (1 - (p.weeksVacation ?? 0) / 52) * (p.partnerPortionOfYear ?? 0.5)
          // Only subtract buyout if the partner worked part of the year
          return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
        }
        return sum
      }, 0)
      
      // Calculate Medical Director income allocations first for 2025 baseline
      const medicalDirectorIncome = baselineData.medicalDirectorHours
      const prcsMedicalDirectorIncome = baselineData.prcsMedicalDirectorHours
      
      // Calculate direct Medical Director allocations to partners
      const partnerMedicalDirectorAllocations = new Map<string, number>()
      
      // Allocate shared Medical Director income based on percentages
      for (const partner of partners) {
        if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
          const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
          partnerMedicalDirectorAllocations.set(partner.id, allocation)
        }
      }
      
      // Allocate PRCS Medical Director income directly to the assigned physician
      if (baselineData.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
        const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(baselineData.prcsDirectorPhysicianId) ?? 0
        partnerMedicalDirectorAllocations.set(baselineData.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
      }
      
      // Calculate total Medical Director allocations to subtract from pool
      const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
      
      // Use different partner pools based on data mode
      const basePool = dataMode === '2024 Data' ? 2032099.02 : NET_PARTNER_POOL_2025
      // NET_PARTNER_POOL_2025 is already net of all costs, so only subtract buyouts and MD allocations
      // delayedW2Costs are already accounted for in the net pool
      const adjustedPool = Math.max(0, basePool - buyoutCosts - totalMedicalDirectorAllocations)
      
      return partnerFTEs
        .filter(({ p, weight }) => {
          // Exclude partners who retired in prior year and only got buyout (no working portion)
          if (p.type === 'partnerToRetire' && weight === 0) {
            return false
          }
          return true
        })
        .map(({ p, weight }) => ({ 
          id: p.id, 
          name: p.name, 
          comp: (weight / totalWeight) * adjustedPool + (partnerMedicalDirectorAllocations.get(p.id) ?? 0) + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0)
        }))
    }
    if (!fy) return [] as { id: string; name: string; comp: number }[]
    const partners = fy.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
    const employees = fy.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')
    const totalEmployeeCosts = employees.reduce((sum, e) => {
      const employeePortion = getEmployeePortionOfYear(e)
      if (employeePortion <= 0) return sum
      
      // Calculate full employee cost including benefits and payroll taxes
      if (e.type === 'newEmployee') {
        // For new employees, calculate prorated total cost
        const proratedEmployee = { ...e, salary: (e.salary ?? 0) * employeePortion }
        return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
      } else if (e.type === 'employeeToTerminate') {
        // For terminating employees, calculate prorated total cost
        const proratedEmployee = { ...e, salary: (e.salary ?? 0) * employeePortion }
        return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
      } else if (e.type === 'employeeToPartner') {
        // For mixed types, only count the employee portion of their total cost
        const employeePortionSalary = (e.salary ?? 0) * employeePortion
        const employeePortionPhysician = { ...e, salary: employeePortionSalary }
        return sum + calculateEmployeeTotalCost(employeePortionPhysician, year, sc.projection.benefitCostsGrowthPct)
      } else {
        // For regular employees, calculate full cost
        return sum + calculateEmployeeTotalCost(e, year, sc.projection.benefitCostsGrowthPct)
      }
    }, 0)
    const totalBuyoutCosts = fy.physicians.reduce((sum, p) => {
      if (p.type === 'partnerToRetire') {
        const weight = getPartnerFTEWeight(p)
        // Only subtract buyout if the partner worked part of the year
        return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
      }
      return sum
    }, 0)
    // Calculate delayed W2 payments for employeeToPartner physicians
    const totalDelayedW2Costs = fy.physicians.reduce((sum, p) => {
      if (p.type === 'employeeToPartner') {
        const delayed = calculateDelayedW2Payment(p, year)
        return sum + delayed.amount + delayed.taxes
      }
      return sum
    }, 0)
    // Calculate Medical Director income allocations first
    const medicalDirectorIncome = fy.medicalDirectorHours ?? 110000
    const prcsMedicalDirectorIncome = fy.prcsDirectorPhysicianId ? (fy.prcsMedicalDirectorHours ?? 60000) : 0
    
    // Calculate direct Medical Director allocations to partners
    const partnerMedicalDirectorAllocations = new Map<string, number>()
    
    // Allocate shared Medical Director income based on percentages
    for (const partner of partners) {
      if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
        const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
        partnerMedicalDirectorAllocations.set(partner.id, allocation)
      }
    }
    
    // Allocate PRCS Medical Director income directly to the assigned physician
    if (fy.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
      const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(fy.prcsDirectorPhysicianId) ?? 0
      partnerMedicalDirectorAllocations.set(fy.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
    }
    
    // Calculate total Medical Director allocations to subtract from pool
    const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
    
    const totalCosts = fy.nonEmploymentCosts + fy.nonMdEmploymentCosts + fy.miscEmploymentCosts + fy.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs
    const basePool = Math.max(0, fy.therapyIncome - totalCosts)
    
    // Subtract Medical Director allocations from the pool to get the FTE-distributable pool
    const pool = Math.max(0, basePool - totalMedicalDirectorAllocations)
    
    if (partners.length === 0) return []
    const partnerFTEs = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
    const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1
    return partnerFTEs
      .filter(({ p, weight }) => {
        // Exclude partners who retired in prior year and only got buyout (no working portion)
        if (p.type === 'partnerToRetire' && weight === 0) {
          return false
        }
        return true
      })
      .map(({ p, weight }) => ({
        id: p.id,
        name: p.name,
        comp: (weight / totalWeight) * pool + (partnerMedicalDirectorAllocations.get(p.id) ?? 0) + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0),
      }))
  }, [fy, sc, dataMode])
}

// Helper function to check if physicians have been changed from defaults
export function arePhysiciansChanged(
  scenario: ScenarioKey,
  year: number,
  currentPhysicians: Physician[],
  _store: any
): boolean {
  // Get default physicians for this year and scenario
  const defaultPhysicians = scenario === 'A' 
    ? scenarioADefaultsByYear(year) 
    : scenarioBDefaultsByYear(year)
  
  // If different number of physicians, it's changed
  if (currentPhysicians.length !== defaultPhysicians.length) {
    return true
  }
  
  // Compare each physician's properties
  for (let i = 0; i < currentPhysicians.length; i++) {
    const current = currentPhysicians[i]
    const defaultPhysician = defaultPhysicians[i]
    
    // Compare all relevant properties
    if (
      current.name !== defaultPhysician.name ||
      current.type !== defaultPhysician.type ||
      current.salary !== defaultPhysician.salary ||
      current.weeksVacation !== defaultPhysician.weeksVacation ||
      current.employeePortionOfYear !== defaultPhysician.employeePortionOfYear ||
      current.partnerPortionOfYear !== defaultPhysician.partnerPortionOfYear ||
      current.startPortionOfYear !== defaultPhysician.startPortionOfYear ||
      current.terminatePortionOfYear !== defaultPhysician.terminatePortionOfYear ||
      current.receivesBenefits !== defaultPhysician.receivesBenefits ||
      current.receivesBonuses !== defaultPhysician.receivesBonuses ||
      current.bonusAmount !== defaultPhysician.bonusAmount ||
      current.hasMedicalDirectorHours !== (defaultPhysician as any).hasMedicalDirectorHours ||
      current.medicalDirectorHoursPercentage !== (defaultPhysician as any).medicalDirectorHoursPercentage ||
      current.buyoutCost !== defaultPhysician.buyoutCost
    ) {
      return true
    }
  }
  
  // Include PRCS director selection and PRCS amount override in change detection
  try {
    const sc = scenario === 'A' ? _store.scenarioA : _store.scenarioB
    const fy = sc?.future.find((f: any) => f.year === year)
    const projectionPrcs = sc?.projection?.prcsMedicalDirectorHours ?? 80000
    const currentPrcs = fy?.prcsMedicalDirectorHours ?? projectionPrcs
    const amountChanged = Math.abs(currentPrcs - projectionPrcs) > 100 // small threshold for $ changes

    // Determine default PRCS director for this year (JS from 2024+ if present in defaults)
    const jsDefault = year >= 2024
      ? defaultPhysicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
      : undefined
    const defaultDirectorId = jsDefault?.id
    const selectionChanged = (fy?.prcsDirectorPhysicianId ?? undefined) !== (defaultDirectorId ?? undefined)

    if (amountChanged || selectionChanged) return true
  } catch {}

  return false
}

// Helper function to calculate projected value for a specific year and field
function calculateProjectedValue(
  scenario: ScenarioKey,
  year: number,
  field: 'therapyIncome' | 'nonEmploymentCosts' | 'nonMdEmploymentCosts' | 'miscEmploymentCosts',
  store: any
): number {
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  if (!sc || year === 2025) return 0 // No projections for baseline year

  // Get baseline data based on data mode
  let baselineData
  if (sc.dataMode === 'Custom') {
    const customBaseline = sc.baseline?.find((b: any) => b.year === 2025)
    if (customBaseline) {
      baselineData = {
        therapyIncome: customBaseline.therapyIncome,
        nonEmploymentCosts: customBaseline.nonEmploymentCosts,
        miscEmploymentCosts: customBaseline.miscEmploymentCosts,
        nonMdEmploymentCosts: customBaseline.nonMdEmploymentCosts,
      }
    } else {
      const last2025 = store.historic.find((h: any) => h.year === 2025)
      baselineData = {
        therapyIncome: last2025?.therapyIncome || 3344068.19,
        nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
      }
    }
  } else if (sc.dataMode === '2024 Data') {
    const last2024 = store.historic.find((h: any) => h.year === 2024)!
    baselineData = {
      therapyIncome: last2024.therapyIncome,
      nonEmploymentCosts: last2024.nonEmploymentCosts,
      miscEmploymentCosts: 24623.49,
      nonMdEmploymentCosts: 164677.44,
    }
  } else if (sc.dataMode === '2025 Data') {
    const last2025 = store.historic.find((h: any) => h.year === 2025)!
    baselineData = {
      therapyIncome: last2025.therapyIncome,
      nonEmploymentCosts: last2025.nonEmploymentCosts,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  } else {
    baselineData = {
      therapyIncome: 3344068.19,
      nonEmploymentCosts: 229713.57,
      miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
      nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
    }
  }

  // Convert percentage growth rates to decimal multipliers
  const incomeGpct = sc.projection.incomeGrowthPct / 100
  const nonEmploymentGpct = sc.projection.nonEmploymentCostsPct / 100
  const nonMdEmploymentGpct = sc.projection.nonMdEmploymentCostsPct / 100
  const miscEmploymentGpct = sc.projection.miscEmploymentCostsPct / 100

  // Calculate projected value for the specific year
  let value = baselineData[field]
  const yearsSinceBaseline = year - 2025
  
  if (field === 'therapyIncome') {
    value = value * Math.pow(1 + incomeGpct, yearsSinceBaseline)
  } else if (field === 'nonEmploymentCosts') {
    value = value * Math.pow(1 + nonEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'nonMdEmploymentCosts') {
    value = value * Math.pow(1 + nonMdEmploymentGpct, yearsSinceBaseline)
  } else if (field === 'miscEmploymentCosts') {
    value = value * Math.pow(1 + miscEmploymentGpct, yearsSinceBaseline)
  }

  return value
}

export function computeAllCompensationsForYear(year: number, scenario: ScenarioKey) {
  const state = useDashboardStore.getState()
  const sc = scenario === 'A' ? state.scenarioA : state.scenarioB!
  // Try to find the future year; if not found and year is 2025, build a synthetic year from historic actuals
  let fy = sc.future.find((f) => f.year === year) as FutureYear | undefined
  // For the multi-year summary tables, ALWAYS use true 2025 actuals for the 2025 column
  if (year === 2025) {
    const last2025 = state.historic.find((h) => h.year === 2025)
    if (last2025) {
      const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
      const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
      fy = {
        year: 2025,
        therapyIncome: last2025.therapyIncome,
        nonEmploymentCosts: last2025.nonEmploymentCosts,
        nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
        locumCosts: 54600,
        miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
        medicalDirectorHours: 119373.75, // 2025 shared medical director amount
        prcsMedicalDirectorHours: 37792.5, // 2025 PRCS medical director amount (JS)
        prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
        physicians,
      }
    }
  }
  if (!fy) return [] as { id: string; name: string; type: PhysicianType; comp: number }[]
  const partners = fy!.physicians.filter((p) => p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')
  const employees = fy!.physicians.filter((p) => p.type === 'employee' || p.type === 'employeeToPartner' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')

  const totalEmployeeCosts = employees.reduce((sum, e) => {
    const portion = e.type === 'employeeToPartner' ? getEmployeePortionOfYear(e) : 
                   (e.type === 'employee' ? 1 : 
                   (e.type === 'newEmployee' ? getEmployeePortionOfYear(e) :
                   (e.type === 'employeeToTerminate' ? getEmployeePortionOfYear(e) : 0)))
    if (portion <= 0) return sum
    
    // Calculate full employee cost including benefits and payroll taxes
    if (e.type === 'newEmployee') {
      // For new employees, calculate prorated total cost
      const proratedEmployee = { ...e, salary: (e.salary ?? 0) * portion }
      return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
    } else if (e.type === 'employeeToTerminate') {
      // For terminating employees, calculate prorated total cost
      const proratedEmployee = { ...e, salary: (e.salary ?? 0) * portion }
      return sum + calculateEmployeeTotalCost(proratedEmployee, year, sc.projection.benefitCostsGrowthPct)
    } else if (e.type === 'employeeToPartner') {
      // For mixed types, only count the employee portion of their total cost
      const employeePortionSalary = (e.salary ?? 0) * portion
      const employeePortionPhysician = { ...e, salary: employeePortionSalary }
      return sum + calculateEmployeeTotalCost(employeePortionPhysician, year, sc.projection.benefitCostsGrowthPct)
    } else {
      // For regular employees, calculate full cost
      return sum + calculateEmployeeTotalCost(e, year, sc.projection.benefitCostsGrowthPct)
    }
  }, 0)

  const totalBuyoutCosts = fy!.physicians.reduce((sum, p) => {
    if (p.type === 'partnerToRetire') {
      const weight = getPartnerFTEWeight(p)
      // Only subtract buyout if the partner worked part of the year
      return sum + (weight > 0 ? (p.buyoutCost ?? 0) : 0)
    }
    return sum
  }, 0)

  // Calculate delayed W2 payments for employeeToPartner physicians
  const totalDelayedW2Costs = fy!.physicians.reduce((sum, p) => {
    if (p.type === 'employeeToPartner') {
      const delayed = calculateDelayedW2Payment(p, year)
      return sum + delayed.amount + delayed.taxes
    }
    return sum
  }, 0)

  // Calculate Medical Director income allocations first
  const medicalDirectorIncome = fy!.medicalDirectorHours ?? 110000
  const prcsMedicalDirectorIncome = fy!.prcsDirectorPhysicianId ? (fy!.prcsMedicalDirectorHours ?? 60000) : 0
  
  // Calculate direct Medical Director allocations to partners
  const partnerMedicalDirectorAllocations = new Map<string, number>()
  
  // Allocate shared Medical Director income based on percentages
  for (const partner of partners) {
    if (partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
      const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
      partnerMedicalDirectorAllocations.set(partner.id, allocation)
    }
  }
  
  // Allocate PRCS Medical Director income directly to the assigned physician
  if (fy!.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
    const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(fy!.prcsDirectorPhysicianId) ?? 0
    partnerMedicalDirectorAllocations.set(fy!.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
  }
  
  // Calculate total Medical Director allocations to subtract from pool
  const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values()).reduce((sum, allocation) => sum + allocation, 0)
  
  // Calculate partner pool excluding Medical Director income that's directly allocated
  const basePool = year === 2025
    ? (NET_PARTNER_POOL_2025 - totalBuyoutCosts)
    : Math.max(0, fy!.therapyIncome - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + fy!.locumCosts + totalEmployeeCosts + totalBuyoutCosts + totalDelayedW2Costs))
    
  // Subtract Medical Director allocations from the pool to get the FTE-distributable pool
  const pool = Math.max(0, basePool - totalMedicalDirectorAllocations)

  const parts = partners.map((p) => ({ p, weight: getPartnerFTEWeight(p) }))
  const workingPartners = parts.filter(({ weight }) => weight > 0)
  const totalWeight = workingPartners.reduce((s, x) => s + x.weight, 0) || 1
  const partnerShares = parts.map(({ p, weight }) => ({ 
    id: p.id, 
    name: p.name, 
    type: 'partner' as const, 
    baseShare: weight > 0 ? (weight / totalWeight) * pool : 0, 
    physician: p 
  }))

  // Compose final list per physician (ensure each physician appears once with combined comp if mixed)
  const results: { id: string; name: string; type: PhysicianType; comp: number }[] = []
  // Add partner and mixed (exclude retired partners with no working portion)
  for (const s of partnerShares) {
    // Skip partners who retired in prior year and only got buyout (no working portion)
    if (s.physician.type === 'partnerToRetire' && s.baseShare === 0) {
      continue
    }
    
    let comp = s.baseShare
    
    // Add Medical Director income allocation directly to the partner
    const medicalDirectorAllocation = partnerMedicalDirectorAllocations.get(s.id) ?? 0
    comp += medicalDirectorAllocation
    
    if (s.physician.type === 'employeeToPartner') {
      const salaryPortion = (s.physician.salary ?? 0) * getEmployeePortionOfYear(s.physician)
      // Add delayed W2 payments for employeeToPartner physicians
      const delayedW2 = calculateDelayedW2Payment(s.physician, year)
      comp += salaryPortion + delayedW2.amount
    }
    if (s.physician.type === 'partnerToRetire') {
      // Add buyout cost back to retiring partner's total compensation
      comp += s.physician.buyoutCost ?? 0
    }
    results.push({ id: s.id, name: s.name, type: 'partner', comp })
  }
  // Add pure employees (exclude mixed already included)
  for (const e of fy!.physicians.filter((p) => p.type === 'employee' || p.type === 'newEmployee' || p.type === 'employeeToTerminate')) {
    const comp = e.type === 'newEmployee' ? (e.salary ?? 0) * getEmployeePortionOfYear(e) :
                 e.type === 'employeeToTerminate' ? (e.salary ?? 0) * getEmployeePortionOfYear(e) :
                 (e.salary ?? 0)
    results.push({ id: e.id, name: e.name, type: 'employee', comp })
  }
  return results
}



export function Dashboard() {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  useEffect(() => {}, [])
  useEffect(() => {
    // Nudge Plotly to recompute sizes when layout width changes
    window.dispatchEvent(new Event('resize'))
  }, [store.scenarioBEnabled])

  // Load from shareable URL hash if present
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.startsWith('#s=')) {
      try {
        const encoded = hash.slice(3)
        const json = decodeURIComponent(atob(encoded))
        const snap = JSON.parse(json)
        useDashboardStore.getState().loadSnapshot(snap)
      } catch {
        // ignore malformed
      }
    }
  }, [])

  const copyShareLink = async () => {
    const snap = {
      scenarioA: store.scenarioA,
      scenarioBEnabled: store.scenarioBEnabled,
      scenarioB: store.scenarioBEnabled ? store.scenarioB : undefined,
    }
    const json = JSON.stringify(snap)
    const encoded = btoa(encodeURIComponent(json))
    const url = `${window.location.origin}${window.location.pathname}#s=${encoded}`
    try {
      await navigator.clipboard.writeText(url)
      alert('Shareable link copied to clipboard')
    } catch {
      // fallback: set location hash
      window.location.hash = `s=${encoded}`
    }
  }

  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, system-ui, Arial', padding: isMobile ? 8 : 16, maxWidth: store.scenarioBEnabled ? 1610 : 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: isMobile ? '8px 0' : '0 0 4px', justifyContent: 'center' }}>
        <img src="/radiantcare.png" alt="RadiantCare" style={{ height: 60, width: 'auto', display: 'block' }} />
        <h2 style={{ margin: 0, fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif', color: '#7c2a83', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>Compensation Dashboard</h2>
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap', marginBottom: 8, gap: 8 }}>
        <button onClick={() => { store.resetToDefaults(); window.location.hash = '' }} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Reset to defaults</button>
        <button onClick={copyShareLink} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>Copy shareable link</button>
      </div>
      <HistoricAndProjectionChart key={store.scenarioBEnabled ? 'withB' : 'withoutB'} />

      {/* Scenario compare */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={store.scenarioBEnabled}
                onChange={(e) => store.setScenarioEnabled(e.target.checked)}
              />
              <span>Enable Scenario B</span>
            </label>
          </div>
        </div>

        <div className="scenario-grid" style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: isMobile ? 8 : 12,
          marginTop: 0,
          display: 'grid',
          gridTemplateColumns: store.scenarioBEnabled && !isMobile ? '1fr 1fr' : '1fr',
          alignItems: 'start',
          gap: 12,
          background: '#f9fafb',
        }}>
          {/* Scenario A column */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario A</div>
            <ProjectionSettingsControls scenario={'A'} />
            <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {[2025, ...store.scenarioA.future.filter((f) => f.year !== 2025).map((f) => f.year)].map((yr) => (
                <button
                  key={`A-${yr}`}
                  onClick={() => store.setSelectedYear('A', yr)}
                  style={{
                    padding: isMobile ? '6px 10px' : '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                    background: store.scenarioA.selectedYear === yr ? '#f0f4ff' : 'white',
                    fontWeight: store.scenarioA.selectedYear === yr ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {yr === 2025 ? 'Baseline' : yr}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <YearPanel year={store.scenarioA.selectedYear} scenario={'A'} />
            </div>
          </div>

          {/* Scenario B column */}
          {store.scenarioBEnabled && store.scenarioB && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Scenario B</div>
              <ProjectionSettingsControls scenario={'B'} />
              <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
                {[2025, ...store.scenarioB.future.filter((f) => f.year !== 2025).map((f) => f.year)].map((yr) => (
                <button
                    key={`B-${yr}`}
                    onClick={() => store.setSelectedYear('B', yr)}
                    style={{
                    padding: isMobile ? '6px 10px' : '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: store.scenarioB?.selectedYear === yr ? '#f0f4ff' : 'white',
                      fontWeight: store.scenarioB?.selectedYear === yr ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {yr === 2025 ? 'Baseline' : yr}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <YearPanel year={store.scenarioB.selectedYear} scenario={'B'} />
              </div>
            </div>
          )}
        </div>
      </div>
      <OverallCompensationSummary />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <ParametersSummary />
      </div>
    </div>
  )
}
