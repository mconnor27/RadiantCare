import type { Physician } from './types'
import React from 'react'
import { PRCS_MD_ANNUAL_MAX } from './defaults'

// Helper function to calculate smart tooltip position that avoids going off-screen
function calculateTooltipPosition(rect: DOMRect, tooltipWidth: number = 300, tooltipHeight: number = 100) {
  const offset = 10
  const padding = 10

  let x = rect.right + offset
  let y = rect.top + window.scrollY

  // Check right edge
  if (x + tooltipWidth > window.innerWidth - padding) {
    x = rect.left - tooltipWidth - offset // Position to left of element
  }

  // Check bottom edge
  if (y + tooltipHeight > window.innerHeight + window.scrollY - padding) {
    y = rect.bottom + window.scrollY - tooltipHeight // Position above element
  }

  // Check left edge
  if (x < padding) {
    x = padding
  }

  // Check top edge
  if (y < window.scrollY + padding) {
    y = window.scrollY + padding
  }

  return { x, y }
}

// Helper function for creating mobile-friendly tooltips
export function createTooltip(id: string, content: string, e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) {
  const existing = document.getElementById(id)
  if (existing) existing.remove()

  const tooltip = document.createElement('div')
  tooltip.id = id
  const isMobileTooltip = window.innerWidth <= 768

  if (isMobileTooltip) {
    tooltip.className = 'tooltip-mobile'
    tooltip.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 9999; max-width: calc(100vw - 40px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
  } else {
    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
  }

  tooltip.textContent = content
  document.body.appendChild(tooltip)

  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = calculateTooltipPosition(rect)
    tooltip.style.left = `${pos.x}px`
    tooltip.style.top = `${pos.y}px`
  }

  // Auto-hide tooltip on mobile after 3 seconds
  if (isMobileTooltip) {
    setTimeout(() => {
      const t = document.getElementById(id)
      if (t) t.remove()
    }, 3000)
  }
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
    const pos = calculateTooltipPosition(rect, 200, 150)
    tooltip.style.left = `${pos.x}px`
    tooltip.style.top = `${pos.y}px`
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
    const pos = calculateTooltipPosition(rect, 200, 150)
    tooltip.style.left = `${pos.x}px`
    tooltip.style.top = `${pos.y}px`
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
export function createPrcsAmountTooltip(
  physicianId: string,
  currentAmount: number,
  e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  onUpdate: (physicianId: string, amount: number) => void,
  message: string,
  maxValue: number = PRCS_MD_ANNUAL_MAX
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
    const pos = calculateTooltipPosition(rect, 200, 150)
    tooltip.style.left = `${pos.x}px`
    tooltip.style.top = `${pos.y}px`
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
  message: string = 'Fixed amount deducted before allocation to active partners.',
  totalBudget: number = 97200 // Total grid budget, NOT remainder
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
        style="width: 200px; margin-bottom: 8px; cursor: pointer;" class="growth-slider" id="${tooltipId}-slider" />
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <input type="text" value="${displayPercentage}%" 
          style="width: 70px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #444; color: white; font-size: 12px; text-align: center;" 
          id="${tooltipId}-percentage" />
        <input type="text" value="${displayAmount}" readonly
          style="width: 90px; padding: 2px 6px; border: 1px solid #555; border-radius: 3px; background: #333; color: #999; font-size: 12px; text-align: center;" 
          id="${tooltipId}-amount" />
      </div>
    </div>
  `

  document.body.appendChild(tooltip)

  if (!isMobileTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = calculateTooltipPosition(rect, 220, 150)
    tooltip.style.left = `${pos.x}px`
    tooltip.style.top = `${pos.y}px`
  }

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