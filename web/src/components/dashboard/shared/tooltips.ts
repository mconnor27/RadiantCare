import type { Physician } from './types'
import { logger } from '../../../lib/logger'
import React from 'react'
import { PRCS_MD_ANNUAL_MAX } from './defaults'

// Helper function to calculate smart tooltip position that avoids going off-screen
function calculateTooltipPosition(
  rect: DOMRect, 
  tooltipWidth: number = 300, 
  tooltipHeight: number = 100,
  offsetX: number = 10,
  offsetY: number = 0,
  placement?: 'right' | 'below-center' | 'below-left' | 'below-right'
) {
  const padding = 10
  let x: number
  let y: number

  if (placement === 'below-center' || placement === 'below-left' || placement === 'below-right') {
    // Position below the element
    y = rect.bottom + window.scrollY + Math.abs(offsetY || 8)
    
    if (placement === 'below-left') {
      // Align tooltip's right edge with element's right edge
      x = rect.right - tooltipWidth
    } else if (placement === 'below-right') {
      // Align tooltip's left edge with element's left edge
      x = rect.left
    } else {
      // Center horizontally under the element
      x = rect.left + (rect.width / 2) - (tooltipWidth / 2)
    }
    
    // Ensure tooltip stays within viewport horizontally
    if (x < padding) {
      x = padding
    } else if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - tooltipWidth - padding
    }
  } else {
    // Default: Position to the right of the element
    x = rect.right + offsetX
    y = rect.top + window.scrollY + offsetY

    // Check right edge - only reposition if truly necessary
    if (x + tooltipWidth > window.innerWidth - padding) {
      // Try positioning to the left of the element
      const leftX = rect.left - tooltipWidth - Math.abs(offsetX)
      if (leftX >= padding) {
        x = leftX
      } else {
        // If can't fit on left either, just constrain to right edge
        x = Math.max(padding, window.innerWidth - tooltipWidth - padding)
      }
    }

    // Check bottom edge
    if (y + tooltipHeight > window.innerHeight + window.scrollY - padding) {
      y = Math.max(window.scrollY + padding, rect.bottom + window.scrollY - tooltipHeight)
    }

    // Check top edge
    if (y < window.scrollY + padding) {
      y = window.scrollY + padding
    }
  }

  return { x, y }
}

// Helper function for creating tooltips
export function createTooltip(
  id: string, 
  content: string, 
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  offsetX: number | { placement?: 'right' | 'below-center' | 'below-left' | 'below-right', offsetY?: number } = 10,
  offsetY: number = 0
) {
  // Handle new options-based API
  let placement: 'right' | 'below-center' | 'below-left' | 'below-right' | undefined
  let actualOffsetX = 10
  let actualOffsetY = offsetY
  
  if (typeof offsetX === 'object') {
    placement = offsetX.placement
    actualOffsetY = offsetX.offsetY !== undefined ? offsetX.offsetY : 0
    actualOffsetX = 10 // Default for right placement
  } else {
    actualOffsetX = offsetX
  }

  const existing = document.getElementById(id)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = id
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 10002; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`

  tooltip.textContent = content
  document.body.appendChild(tooltip)

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const tooltipWidth = tooltip.offsetWidth
  const tooltipHeight = tooltip.offsetHeight
  const pos = calculateTooltipPosition(rect, tooltipWidth, tooltipHeight, actualOffsetX, actualOffsetY, placement)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`
}

export function removeTooltip(id: string) {
  const tooltip = document.getElementById(id)
  if (tooltip) tooltip.remove()
}

// Helper function for creating interactive bonus slider tooltip
export function createBonusTooltip(
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
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 10002; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`
  
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

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = calculateTooltipPosition(rect, 200, 150)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`
  
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
}

// Helper function for creating interactive Medical Director Hours tooltip (0–100%)
export function createHoursTooltip(
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
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 10002; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`

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

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = calculateTooltipPosition(rect, 200, 150)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`

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
}

// Helper function for creating interactive PRCS Medical Director $ override tooltip
export function createPrcsAmountTooltip(
  physicianId: string,
  currentAmount: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  message: string,
  maxValue: number = PRCS_MD_ANNUAL_MAX,
  mode?: 'calculated' | 'annualized',
  onModeToggle?: (newMode: 'calculated' | 'annualized', annualizedValue?: number) => void,
  ytdActualValue?: number,
  projectionRatio?: number
) {
  const tooltipId = `prcs-amount-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 10002; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto; min-width: 240px;`

  const minValue = 0
  const displayAmount = `$${Math.round(currentAmount || 0).toLocaleString()}`
  const title = 'PRCS Medical Director'
  const currentMode = mode || 'calculated'

  // Mode toggle HTML (only show in YTD mode when callback is provided)
  const modeToggleHTML = onModeToggle ? `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #555;">
      <div style="font-size: 11px; opacity: 0.8; margin-bottom: 6px;">Grid Mode:</div>
      <div style="display: flex; gap: 6px;">
        <button id="${tooltipId}-mode-calc" style="flex: 1; padding: 6px; background: ${currentMode === 'calculated' ? '#7c2a83' : '#555'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: ${currentMode === 'calculated' ? '600' : 'normal'}; opacity: ${currentMode === 'calculated' ? '1' : '0.7'};">
          ${currentMode === 'calculated' ? '●' : '○'} Calculated
        </button>
        <button id="${tooltipId}-mode-annual" style="flex: 1; padding: 6px; background: ${currentMode === 'annualized' ? '#fef08a' : '#555'}; color: ${currentMode === 'annualized' ? '#374151' : 'white'}; border: ${currentMode === 'annualized' ? '2px solid #eab308' : 'none'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: ${currentMode === 'annualized' ? '600' : 'normal'};">
          ${currentMode === 'annualized' ? '●' : '○'} Annualized
        </button>
      </div>
      <div style="font-size: 10px; opacity: 0.6; margin-top: 6px; font-style: italic;">
        ${currentMode === 'calculated' ? 'Calculated from physician panel' : 'Set manually in grid'}
      </div>
    </div>
  ` : ''

  // Conditionally show slider only in calculated mode
  const sliderHTML = currentMode === 'calculated' ? `
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxValue}" step="1000" value="${currentAmount}"
        style="width: 200px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayAmount}"
          style="width: 110px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;"
          id="${tooltipId}-amount" />
      </div>
    </div>
  ` : `
    <div style="padding: 10px; margin: 8px 0; background: rgba(254, 252, 232, 0.1); border: 1px solid #555; border-radius: 4px;">
      <div style="font-size: 11px; opacity: 0.8; text-align: center;">
        Current value: <strong>${displayAmount}</strong>
      </div>
      <div style="font-size: 10px; opacity: 0.6; margin-top: 4px; text-align: center; font-style: italic;">
        Click the cell in the grid to edit the value
      </div>
    </div>
  `

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="margin-bottom: 6px; font-size: 12px; opacity: 0.9;">${message}</div>
    ${sliderHTML}
    ${modeToggleHTML}
  `

  document.body.appendChild(tooltip)

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = calculateTooltipPosition(rect, 200, 150)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`

  // Only set up slider event handlers if in calculated mode
  if (currentMode === 'calculated') {
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
  }

  // Mode toggle button handlers
  if (onModeToggle) {
    const calcButton = document.getElementById(`${tooltipId}-mode-calc`)
    const annualButton = document.getElementById(`${tooltipId}-mode-annual`)
    
    if (calcButton) {
      calcButton.addEventListener('click', () => {
        onModeToggle('calculated')
        removeTooltip(tooltipId)
      })
    }
    
    if (annualButton) {
      annualButton.addEventListener('click', () => {
        // Calculate annualized value from YTD if available
        let annualizedValue: number | undefined
        if (ytdActualValue !== undefined && projectionRatio !== undefined) {
          annualizedValue = ytdActualValue * projectionRatio
          logger.debug('UI', `📊 [PRCS Toggle] Calculated annualized value: YTD $${ytdActualValue.toLocaleString()} * ${projectionRatio.toFixed(3)} = $${Math.round(annualizedValue).toLocaleString()}`)
        }
        onModeToggle('annualized', annualizedValue)
        removeTooltip(tooltipId)
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
        !document.querySelector(`[data-prcs-id="${physicianId}"]`)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)
}

// Default trailing shared MD amount for prior-year retirees
export function getDefaultTrailingSharedMdAmount(physician: Physician): number {
  return physician.name === 'HW' ? 8302.5 : 2500
}

// Helper function for creating interactive Prior-Year Retiree Shared MD % tooltip
// Shows percentage of total budget (not remainder budget)
export function createTrailingSharedMdAmountTooltip(
  physicianId: string,
  currentAmount: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  message: string = 'Deducted before allocation to active partners.',
  totalBudget: number = 97200 // Total grid budget, NOT remainder
) {
  const tooltipId = `trailing-md-amount-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 10002; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`

  // Calculate percentage of total budget
  const currentPercentage = totalBudget > 0 ? (currentAmount / totalBudget) * 100 : 0
  const displayPercentage = currentPercentage.toFixed(2)
  const displayAmount = `$${Math.round(currentAmount || 0).toLocaleString()}`
  const title = 'Medical Director Hours (Prior Year Retiree)'

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="margin-bottom: 6px; font-size: 12px; opacity: 0.9;">${message}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="0" max="100" step="0.01" value="${currentPercentage}"
        style="width: 100%; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayPercentage}%"
          style="width: 70px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;"
          id="${tooltipId}-percentage" />
        <input type="text" value="${displayAmount}"
          style="width: 90px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;"
          id="${tooltipId}-amount" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = calculateTooltipPosition(rect, 220, 150)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`

  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const percentageInput = document.getElementById(`${tooltipId}-percentage`) as HTMLInputElement
  const amountInput = document.getElementById(`${tooltipId}-amount`) as HTMLInputElement

  if (slider && percentageInput && amountInput) {
    // Update from slider
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const newPercentage = Number(target.value)
      const newAmount = Math.round((newPercentage / 100) * totalBudget)
      percentageInput.value = `${newPercentage.toFixed(2)}%`
      amountInput.value = `$${newAmount.toLocaleString()}`
      onUpdate(physicianId, newAmount)
    })

    // Update from percentage input
    percentageInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9.]/g, ''))
      const clamped = Math.max(0, Math.min(100, numericValue))
      const newAmount = Math.round((clamped / 100) * totalBudget)
      slider.value = String(clamped)
      target.value = `${clamped.toFixed(2)}%`
      amountInput.value = `$${newAmount.toLocaleString()}`
      onUpdate(physicianId, newAmount)
    })

    // Update from dollar amount input
    amountInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
      const clamped = Math.max(0, Math.min(totalBudget, numericValue))
      const newPercentage = totalBudget > 0 ? (clamped / totalBudget) * 100 : 0
      slider.value = String(newPercentage)
      percentageInput.value = `${newPercentage.toFixed(2)}%`
      target.value = `$${Math.round(clamped).toLocaleString()}`
      onUpdate(physicianId, Math.round(clamped))
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
}

// Helper function for creating interactive vacation weeks slider tooltip
export function createVacationWeeksTooltip(
  physicianId: string,
  currentWeeks: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, weeks: number) => void,
  maxWeeks: number = 16
) {
  const tooltipId = `vacation-weeks-slider-${physicianId}`
  const existing = document.getElementById(tooltipId)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = tooltipId
  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap; text-align: left; z-index: 10002; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: auto;`

  const minValue = 0
  const displayWeeks = `${currentWeeks || 8} weeks off`
  const title = 'Employee Vacation Weeks'

  tooltip.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: 600; white-space: nowrap;">${title}</div>
    <div style="padding: 2px 0;">
      <input type="range" min="${minValue}" max="${maxWeeks}" step="1" value="${currentWeeks}"
        style="width: 180px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayWeeks}"
          style="width: 110px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;"
          id="${tooltipId}-weeks" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = calculateTooltipPosition(rect, 220, 120)
  tooltip.style.left = `${pos.x}px`
  tooltip.style.top = `${pos.y}px`

  const slider = document.getElementById(`${tooltipId}-slider`) as HTMLInputElement
  const weeksInput = document.getElementById(`${tooltipId}-weeks`) as HTMLInputElement

  if (slider && weeksInput) {
    slider.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value)
      const clamped = Math.max(minValue, Math.min(maxWeeks, numericValue))
      weeksInput.value = `${clamped} weeks off`
      onUpdate(physicianId, clamped)
    })

    weeksInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      const numericValue = Number(target.value.replace(/[^0-9]/g, ''))
      const clamped = Math.max(minValue, Math.min(maxWeeks, numericValue))
      slider.value = String(clamped)
      target.value = `${clamped} weeks off`
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
        !(document.querySelector(`[data-vacation-id="${physicianId}"]`) as HTMLElement)?.contains(event.target as Node)) {
      removeTooltip(tooltipId)
      document.removeEventListener('click', clickOutsideHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', clickOutsideHandler), 100)
}