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
    tooltip.style.left = `${rect.right + 10}px`
    tooltip.style.top = `${rect.top + window.scrollY}px`
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

// Note: Other complex tooltip functions (createBonusTooltip, createHoursTooltip, etc.) 
// remain in Dashboard.tsx for now due to their complexity and interdependencies
