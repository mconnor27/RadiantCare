import { DragDropPhysicians } from './DragDropPhysicians'
import type { PhysicianType, Physician, FutureYear, ScenarioKey } from '../types'
import {
  currency,
  daysInYear,
  dayOfYearToDate,
  dateToString,
  employeePortionToTransitionDay,
  transitionDayToEmployeePortion,
  retirementDayToPartnerPortion,
  partnerPortionToRetirementDay,
  startPortionToStartDay,
  startDayToStartPortion,
  getQuarterStartDays
} from '../utils'
import {
  getEmployeePortionOfYear,
  getPartnerPortionOfYear,
  getPartnerFTEWeightProper,
  calculateDelayedW2Payment,
  getEmployeeCostTooltip
} from '../calculations'
import {
  scenarioADefaultsByYear,
  scenarioBDefaultsByYear,
  ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
} from '../defaults'
import {
  createTooltip,
  removeTooltip,
  createBonusTooltip,
  createHoursTooltip,
  createPrcsAmountTooltip,
  getDefaultTrailingSharedMdAmount,
  createTrailingSharedMdAmountTooltip
} from '../tooltips'
import { useDashboardStore, arePhysiciansChanged } from '../../../Dashboard'

export default function PhysiciansEditor({ year, scenario, readOnly = false, physiciansOverride, locumCosts, onLocumCostsChange }: { year: number; scenario: ScenarioKey; readOnly?: boolean; physiciansOverride?: Physician[]; locumCosts: number; onLocumCostsChange: (value: number) => void }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const fyExisting = sc.future.find((f) => f.year === year)
  const defaultPhysiciansIfNeeded = physiciansOverride ?? (scenario === 'A' ? scenarioADefaultsByYear(year) : scenarioBDefaultsByYear(year))
  const suszkoDefault = year >= 2024 ? defaultPhysiciansIfNeeded.find((p) => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire')) : undefined
  const fy: FutureYear = fyExisting ?? {
    year,
    therapyIncome: 0,
    nonEmploymentCosts: 0,
    nonMdEmploymentCosts: 0,
    locumCosts,
    miscEmploymentCosts: 0,
    medicalDirectorHours: undefined,
    prcsMedicalDirectorHours: undefined,
    prcsDirectorPhysicianId: suszkoDefault?.id,
    physicians: defaultPhysiciansIfNeeded,
  }
  const physicians = physiciansOverride ?? fy.physicians
  const defaultPrcsDirectorId = suszkoDefault?.id
  const prcsSelectedId = (fy.prcsDirectorPhysicianId ?? defaultPrcsDirectorId)

  const handleReorder = (fromIndex: number, toIndex: number) => {
    store.reorderPhysicians(scenario, year, fromIndex, toIndex)
  }

  const rows = physicians.map((p) => {
    const canDelete = !readOnly && physicians.length > 3
    return (
      <div
        key={p.id}
        style={{
          borderTop: '1px solid #d1d5db',
          paddingTop: 10,
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: '20px 120px 150px 1fr 20px 20px 20px',
          gap: 8,
          alignItems: 'center',
          cursor: 'default',
          background: 'transparent'
        }}
      >
        {/* Drag Handle */}
        <div
          {...(!readOnly && { 'data-drag-handle': true })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: readOnly ? '#ccc' : '#333',
            fontSize: '14px',
            cursor: readOnly ? 'default' : 'grab',
            userSelect: 'none',
            opacity: readOnly ? 0.3 : 1.0,
            touchAction: readOnly ? 'auto' : 'none',
          }}
          title={readOnly ? '' : 'Drag to reorder'}
        >
          ⋮⋮
        </div>
        <div style={{ position: 'relative', width: '100%' }}>
          {getPartnerPortionOfYear(p) > 0 && (
            <img
              src={(prcsSelectedId === p.id) ? '/meddir_selected.png' : '/meddir_unselected.png'}
              alt={(prcsSelectedId === p.id) ? 'PRCS Medical Director (selected)' : 'PRCS Medical Director (not selected)'}
              data-prcs-id={p.id}
              style={{
                position: 'absolute',
                left: '4px',
                top: '58%',
                transform: 'translateY(-50%)',
                width: '15px',
                height: '15px',
                zIndex: 2,
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                const isSelected = prcsSelectedId === p.id
                if (readOnly) {
                  // Read-only: show a non-interactive summary tooltip reflecting current selection state
                  if (isSelected) {
                    // Use specific 2024-25 values when in those data modes for baseline year
                    let amount = fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 0
                    if (year === 2025 && sc.dataMode === '2024 Data') {
                      amount = fy.prcsMedicalDirectorHours ?? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS // 2024 PRCS medical director amount
                    } else if (year === 2025 && sc.dataMode === '2025 Data') {
                      amount = fy.prcsMedicalDirectorHours ?? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS // 2025 PRCS medical director amount
                    }
                    createTooltip(`prcs-readonly-${p.id}`, `PRCS Medical Director: ${currency(Math.round(amount))}`, e)
                  } else {
                    createTooltip(`prcs-readonly-${p.id}`, 'PRCS Medical Director: Not designated', e)
                  }
                } else {
                  const msg = isSelected
                    ? 'Double-click to deselect'
                    : 'Double-click to select as PRCS Medical Director'
                  createTooltip(`prcs-md-hover-${p.id}`, msg, e)
                  // Only show the slider on hover if this physician is already selected
                  if (isSelected) {
                    // Use specific 2024-25 values when in those data modes for baseline year
                    let currentAmount = fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000
                    if (year === 2025 && sc.dataMode === '2024 Data') {
                      currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS // 2024 PRCS medical director amount
                    } else if (year === 2025 && sc.dataMode === '2025 Data') {
                      currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS // 2025 PRCS medical director amount
                    }
                    createPrcsAmountTooltip(p.id, currentAmount, e, (_pid, amount) => {
                      store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Math.max(0, Math.min(120000, amount)))
                    }, msg, 120000)
                  }
                }
              }}
              onMouseLeave={() => {
                // Always remove hover tooltips immediately (both read-only and interactive text)
                removeTooltip(`prcs-md-hover-${p.id}`)
                removeTooltip(`prcs-readonly-${p.id}`)
                // For the slider tooltip, delay removal so users can move into it
                const tooltip = document.getElementById(`prcs-amount-slider-${p.id}`)
                if (tooltip) {
                  ;(tooltip as any).hideTimeout = setTimeout(() => {
                    const t = document.getElementById(`prcs-amount-slider-${p.id}`)
                    if (t && !t.matches(':hover')) {
                      removeTooltip(`prcs-amount-slider-${p.id}`)
                    }
                  }, 150)
                }
              }}
              onDoubleClick={(e) => {
                if (readOnly) return
                const wasSelected = prcsSelectedId === p.id
                const prevSelectedId = prcsSelectedId
                // Toggle selection
                store.setPrcsDirector(scenario, year, wasSelected ? undefined : p.id)
                // If selecting (none previously or selecting a new one), open the slider immediately
                if (!wasSelected) {
                  // Remove any tooltips from the previously selected physician
                  if (prevSelectedId) {
                    removeTooltip(`prcs-amount-slider-${prevSelectedId}`)
                    removeTooltip(`prcs-md-hover-${prevSelectedId}`)
                  }
                  // Remove hover text on this new selection before showing the slider
                  removeTooltip(`prcs-md-hover-${p.id}`)
                  const msg = 'Double-click to deselect'
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let currentAmount = fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS // 2024 PRCS medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS // 2025 PRCS medical director amount
                  }
                  createPrcsAmountTooltip(p.id, currentAmount, e as any, (_pid, amount) => {
                    store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Math.max(0, Math.min(120000, amount)))
                  }, msg, 120000)
                } else {
                  // If deselecting, close any slider and show the basic unselected hover immediately
                  removeTooltip(`prcs-amount-slider-${p.id}`)
                  removeTooltip(`prcs-md-hover-${p.id}`)
                  const msg = 'Double-click to select as PRCS Medical Director'
                  createTooltip(`prcs-md-hover-${p.id}`, msg, e as any)
                }
              }}
              onTouchStart={(e) => {
                if (readOnly) return
                const isSelected = prcsSelectedId === p.id
                const msg = isSelected ? 'Double-click to deselect' : 'Double-click to select as PRCS Medical Director'
                // Use specific 2024-25 values when in those data modes for baseline year
                let currentAmount = fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000
                if (year === 2025 && sc.dataMode === '2024 Data') {
                  currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS // 2024 PRCS medical director amount
                } else if (year === 2025 && sc.dataMode === '2025 Data') {
                  currentAmount = fy.prcsMedicalDirectorHours ?? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS // 2025 PRCS medical director amount
                }
                createPrcsAmountTooltip(p.id, currentAmount, e, (_pid, amount) => {
                  store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Math.max(0, Math.min(120000, amount)))
                }, msg, 120000)
              }}
            />
          )}
        <input
          value={p.name}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, { ...p, name: e.target.value })
          }
          disabled={readOnly}
          style={{ 
            width: '100%', 
            height: 20, 
              padding: '2px 8px 2px 24px', 
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12
          }}
        />
        </div>
        <select
          value={p.type}
          onChange={(e) =>
            store.upsertPhysician(scenario, year, {
              ...p,
              type: e.target.value as PhysicianType,
              // Initialize sensible defaults when switching types
              employeePortionOfYear: e.target.value === 'employeeToPartner' ? (p.employeePortionOfYear ?? 0.5) : p.employeePortionOfYear,
              partnerPortionOfYear: e.target.value === 'partnerToRetire' ? (p.partnerPortionOfYear ?? 0.5) : p.partnerPortionOfYear,
              startPortionOfYear: e.target.value === 'newEmployee' ? (p.startPortionOfYear ?? 0) : p.startPortionOfYear,
              terminatePortionOfYear: e.target.value === 'employeeToTerminate' ? (p.terminatePortionOfYear ?? 1) : p.terminatePortionOfYear,
              salary: e.target.value !== 'partner' && e.target.value !== 'partnerToRetire' ? (p.salary ?? 500000) : undefined,
              weeksVacation: e.target.value !== 'employee' && e.target.value !== 'newEmployee' ? (p.weeksVacation ?? 8) : undefined,
              receivesBenefits: e.target.value !== 'partner' && e.target.value !== 'partnerToRetire' ? (p.receivesBenefits ?? true) : undefined,
              buyoutCost: e.target.value === 'partnerToRetire' ? (p.buyoutCost ?? 50000) : undefined,
            })
          }
          disabled={readOnly}
        >
          <option value="newEmployee">New Employee</option>
          <option value="employee">Employee</option>
          <option value="employeeToTerminate">Employee → Terminate</option>
          <option value="employeeToPartner">Employee → Partner</option>
          <option value="partner">Partner</option>
          <option value="partnerToRetire">Partner → Retire</option>
        </select>
        {p.type === 'newEmployee' ? (
          // newEmployee
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={startPortionToStartDay(p.startPortionOfYear ?? 0, year)}
                    onChange={(e) => {
                      const startDay = Number(e.target.value)
                      const startPortion = startDayToStartPortion(startDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        startPortionOfYear: startPortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((startPortionToStartDay(p.startPortionOfYear ?? 0, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                      const { month, day } = dayOfYearToDate(startDay, year)
                      return `→ ${dateToString(month, day)}`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const startPortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            startPortionOfYear: startPortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const startPortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            startPortionOfYear: startPortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <img
                src={p.receivesBonuses ? '/bonus_selected.png' : '/bonus_unselected.png'}
                alt={`Bonus ${p.receivesBonuses ? 'enabled' : 'disabled'}`}
                data-bonus-id={p.id}
                style={{
                  width: '20px',
                  height: 'auto',
                  maxHeight: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1,
                  objectFit: 'contain'
                }}
                onClick={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
                onMouseEnter={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    // Add a delay before hiding to allow mouse to move to tooltip
                    const tooltip = document.getElementById(`bonus-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`bonus-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => {
                  if (!readOnly) {
                    createBonusTooltip(p.id, p.bonusAmount ?? 0, e, (_, amount) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        bonusAmount: amount,
                        receivesBonuses: amount !== 0
                      })
                    }, p.type === 'employeeToTerminate')
                  }
                }}
              />
              <img
                src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
                alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1
                }}
                onClick={() => {
                  if (!readOnly) {
                    const newBenefitsState = !p.receivesBenefits
                    store.upsertPhysician(scenario, year, {
                      ...p, 
                      receivesBenefits: newBenefitsState
                    })
                    // Update tooltip in real-time if it's currently visible
                    const tooltip = document.getElementById('benefits-tooltip-new')
                    if (tooltip) {
                      tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  createTooltip('benefits-tooltip-new', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  removeTooltip('benefits-tooltip-new')
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => createTooltip('benefits-tooltip-new', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'new-employee-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const startDay = startPortionToStartDay(p.startPortionOfYear ?? 0, year)
                  const { month, day } = dayOfYearToDate(startDay, year)
                  const startDate = dateToString(month, day)
                  const workingPortion = 1 - (p.startPortionOfYear ?? 0)
                  const workingPct = Math.round(workingPortion * 100)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  let extra = ''
                  if (Math.abs(startDay - 183) <= 1) extra = `\n(Mid-year start)`
                  
                  tooltip.textContent = `New Employee:\nStart date: ${startDate}\nWorking portion: ${workingPct}%\nProrated salary: ${currency(proratedSalary)}${extra}`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('new-employee-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'new-employee-cost-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const workingPortion = 1 - (p.startPortionOfYear ?? 0)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  const tooltip_content = getEmployeeCostTooltip({ ...p, salary: proratedSalary }, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                  tooltip.textContent = tooltip_content.replace('Employee Total Cost', 'New Employee Total Cost (Prorated)')
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('new-employee-cost-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'employeeToTerminate' ? (
          // employeeToTerminate
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)}
                    onChange={(e) => {
                      const terminateDay = Number(e.target.value)
                      const terminatePortion = startDayToStartPortion(terminateDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        terminatePortionOfYear: terminatePortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((startPortionToStartDay(p.terminatePortionOfYear ?? 1, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                      const { month, day } = dayOfYearToDate(terminateDay, year)
                      return `${dateToString(month, day)} →`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const terminatePortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            terminatePortionOfYear: terminatePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const terminatePortion = startDayToStartPortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            terminatePortionOfYear: terminatePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  maxHeight: '20px'
                }}
              />
              <img
                src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
                alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1
                }}
                onClick={() => {
                  if (!readOnly) {
                    const newBenefitsState = !p.receivesBenefits
                    store.upsertPhysician(scenario, year, {
                      ...p, 
                      receivesBenefits: newBenefitsState
                    })
                    // Update tooltip in real-time if it's currently visible
                    const tooltip = document.getElementById('benefits-tooltip-terminate')
                    if (tooltip) {
                      tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  createTooltip('benefits-tooltip-terminate', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  removeTooltip('benefits-tooltip-terminate')
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => createTooltip('benefits-tooltip-terminate', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'terminate-employee-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const terminateDay = startPortionToStartDay(p.terminatePortionOfYear ?? 1, year)
                  const { month, day } = dayOfYearToDate(terminateDay, year)
                  const terminateDate = dateToString(month, day)
                  const workingPortion = p.terminatePortionOfYear ?? 1
                  const workingPct = Math.round(workingPortion * 100)
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  let extra = ''
                  if (Math.abs(terminateDay - 183) <= 1) extra = `\n(Mid-year termination)`
                  
                  tooltip.textContent = `Terminating Employee:\nTermination date: ${terminateDate}\nWorking portion: ${workingPct}%\nProrated salary: ${currency(proratedSalary)}${extra}`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('terminate-employee-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'terminate-employee-cost-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  const workingPortion = p.terminatePortionOfYear ?? 1
                  const proratedSalary = (p.salary ?? 0) * workingPortion
                  const tooltip_content = getEmployeeCostTooltip({ ...p, salary: proratedSalary }, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                  tooltip.textContent = tooltip_content.replace('Employee Total Cost', 'Terminating Employee Total Cost (Prorated)')
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('terminate-employee-cost-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'employee' ? (
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                type="range"
                min={350000}
                max={650000}
                step={1000}
                value={p.salary ?? 0}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    salary: Number(e.target.value),
                  })
                }
                disabled={readOnly}
                style={{ 
                  width: '100%',
                  ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                }}
              />
              <input
                type="text"
                value={currency(Math.round(p.salary ?? 0))}
                onChange={(e) =>
                  store.upsertPhysician(scenario, year, {
                    ...p,
                    salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                  })
                }
                style={{ 
                  width: 100, 
                  height: 20, 
                  padding: '2px 8px', 
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  fontSize: 12
                }}
                disabled={readOnly}
              />
            </div>
            <img
              src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
              alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
              style={{
                width: '20px',
                height: '20px',
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.6 : 1
              }}
              onClick={() => {
                if (!readOnly) {
                  const newBenefitsState = !p.receivesBenefits
                  store.upsertPhysician(scenario, year, {
                    ...p, 
                    receivesBenefits: newBenefitsState
                  })
                  // Update tooltip in real-time if it's currently visible
                  const tooltip = document.getElementById('benefits-tooltip')
                  if (tooltip) {
                    tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                  }
                }
              }}
              onMouseEnter={(e) => {
                createTooltip('benefits-tooltip', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                if (!readOnly) {
                  e.currentTarget.style.opacity = '0.8'
                }
              }}
              onMouseLeave={(e) => {
                removeTooltip('benefits-tooltip')
                if (!readOnly) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
              onTouchStart={(e) => createTooltip('benefits-tooltip', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
            />
            <div 
              style={{ 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
                width: '20px',
                height: '20px',
                border: '1px solid #ccc',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa'
              }}
              onMouseEnter={(e) => {
                const tooltip = document.createElement('div')
                tooltip.id = 'employee-tooltip'
                tooltip.style.cssText = `
                  position: absolute;
                  background: #333;
                  color: white;
                  padding: 8px 12px;
                  border-radius: 4px;
                  font-size: 12px;
                  white-space: pre-line;
                  text-align: left;
                  z-index: 1000;
                  max-width: 300px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                  pointer-events: none;
                `
                tooltip.textContent = getEmployeeCostTooltip(p, year, sc.projection.benefitCostsGrowthPct, 0, 0, '')
                document.body.appendChild(tooltip)
                
                const rect = e.currentTarget.getBoundingClientRect()
                tooltip.style.left = `${rect.right + 10}px`
                tooltip.style.top = `${rect.top + window.scrollY}px`
              }}
              onMouseLeave={() => {
                const tooltip = document.getElementById('employee-tooltip')
                if (tooltip) tooltip.remove()
              }}
            >
              <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'partnerToRetire' ? (
          // partnerToRetire
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: (p.partnerPortionOfYear ?? 0.5) > 0 ? 'auto auto auto' : 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={0}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)}
                    onChange={(e) => {
                      const retirementDay = Number(e.target.value)
                      const partnerPortion = retirementDayToPartnerPortion(retirementDay, year)
                      const updatedPhysician = {
                        ...p,
                        partnerPortionOfYear: partnerPortion,
                      }
                      // If changing to Prior Year (partnerPortion === 0), remove weeksVacation and zero-out hours
                      // If changing away from Prior Year, set default weeksVacation if not present
                      if (partnerPortion === 0) {
                        updatedPhysician.weeksVacation = undefined
                        updatedPhysician.medicalDirectorHoursPercentage = 0
                        updatedPhysician.hasMedicalDirectorHours = false
                      } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                        // Changing from Prior Year to actual working days, set default weeks
                        updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                      }
                      store.upsertPhysician(scenario, year, updatedPhysician)
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${(partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year) / daysInYear(year)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = day / totalDays
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                      if (retirementDay === 0) {
                        return "Prior Year"
                      }
                      const { month, day } = dayOfYearToDate(retirementDay, year)
                      return `${dateToString(month, day)} →`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const partnerPortion = retirementDayToPartnerPortion(newDay, year)
                          const updatedPhysician = {
                            ...p,
                            partnerPortionOfYear: partnerPortion,
                          }
                          // If changing to Prior Year, remove weeksVacation and zero-out hours
                          // If changing away from Prior Year, set default weeksVacation if not present
                          if (partnerPortion === 0) {
                            updatedPhysician.weeksVacation = undefined
                            updatedPhysician.medicalDirectorHoursPercentage = 0
                            updatedPhysician.hasMedicalDirectorHours = false
                          } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                            updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                          }
                          store.upsertPhysician(scenario, year, updatedPhysician)
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                          const newDay = Math.max(0, currentDay - 1)
                          const partnerPortion = retirementDayToPartnerPortion(newDay, year)
                          const updatedPhysician = {
                            ...p,
                            partnerPortionOfYear: partnerPortion,
                          }
                          // If changing to Prior Year, remove weeksVacation and zero-out hours
                          // If changing away from Prior Year, set default weeksVacation if not present
                          if (partnerPortion === 0) {
                            updatedPhysician.weeksVacation = undefined
                            updatedPhysician.medicalDirectorHoursPercentage = 0
                            updatedPhysician.hasMedicalDirectorHours = false
                          } else if (p.partnerPortionOfYear === 0 && partnerPortion > 0) {
                            updatedPhysician.weeksVacation = updatedPhysician.weeksVacation ?? 8
                          }
                          store.upsertPhysician(scenario, year, updatedPhysician)
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Only show weeks vacation slider if partnerPortionOfYear > 0 (not Jan 1 retirement) */}
              {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    type="range"
                    min={2}
                    max={(() => {
                      const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                      return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                    })()}
                    step={1}
                    value={p.weeksVacation ?? 8}
                    onChange={(e) =>
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        weeksVacation: Number(e.target.value),
                      })
                    }
                    disabled={readOnly}
                    style={{ 
                      width: '100%',
                      ['--fill-percent' as any]: `${(() => {
                        const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                        const maxWeeks = (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                        return ((p.weeksVacation ?? 8) - 2) / (maxWeeks - 2) * 100
                      })()}%`
                    }}
                  />
                  <input
                    type="text"
                    value={`${p.weeksVacation ?? 8} weeks off`}
                    onChange={(e) =>
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        weeksVacation: Number(e.target.value.replace(/[^0-9]/g, '')),
                      })
                    }
                    style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                    disabled={readOnly}
                  />
                </div>
              )}
              {/* Only show additional days worked slider if partnerPortionOfYear > 0 (not Prior Year) */}
              {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={1000}
                    value={p.additionalDaysWorked ?? 0}
                    onChange={(e) =>
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        additionalDaysWorked: Number(e.target.value),
                      })
                    }
                    disabled={readOnly}
                    style={{
                      width: '100%',
                      ['--fill-percent' as any]: `${((p.additionalDaysWorked ?? 0) / 20000) * 100}%`
                    }}
                  />
                  <input
                    type="text"
                    value={currency(p.additionalDaysWorked ?? 0)}
                    onChange={(e) => {
                      const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                      if (!isNaN(value)) {
                        store.upsertPhysician(scenario, year, {
                          ...p,
                          additionalDaysWorked: value,
                        })
                      }
                    }}
                    style={{
                      width: 100,
                      height: 20,
                      padding: '2px 8px',
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                  />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={100000}
                  step={1000}
                  value={p.buyoutCost ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      buyoutCost: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.buyoutCost ?? 0) / 100000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.buyoutCost ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      buyoutCost: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            {/* Medical Director Hours icon aligned with the slider/info column (hide if Prior Year) */}
            {(((p.partnerPortionOfYear ?? 0.5) > 0) || ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0)) ? (
              <div style={{ display: 'grid', gridTemplateRows: ((p.partnerPortionOfYear ?? 0.5) > 0) ? '20px 20px 20px 20px' : '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
                {/* Placeholder top row to align with adjacent column (weeks/retire info) */}
                <div style={{ height: 20 }} />
                {/* Placeholder for weeks vacation row when partnerPortionOfYear > 0 */}
                {((p.partnerPortionOfYear ?? 0.5) > 0) && <div style={{ height: 20 }} />}
                <img
                  src={(() => {
                    if ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0) {
                      const amount = p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)
                      return amount > 0 ? '/hours_selected.png' : '/hours_unselected.png'
                    }
                    return (p.medicalDirectorHoursPercentage ?? 0) > 0 ? '/hours_selected.png' : '/hours_unselected.png'
                  })()}
                  alt={`Medical Director Hours ${((p.medicalDirectorHoursPercentage ?? 0) > 0) ? 'enabled' : 'disabled'}`}
                  data-hours-id={p.id}
                  style={{
                    width: '20px',
                    height: 'auto',
                    maxHeight: '20px',
                    cursor: readOnly ? 'default' : 'pointer',
                    opacity: readOnly ? 0.6 : 1,
                    objectFit: 'contain'
                  }}
                  onClick={(e) => {
                    if (!readOnly) {
                      if ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0) {
                        const initial = p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)
                        createTrailingSharedMdAmountTooltip(p.id, initial, e, (_, amount) => {
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            trailingSharedMdAmount: amount
                          })
                        })
                      } else {
                        // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                        const trailingTotal = fy.physicians.reduce((s, ph) => {
                          const isPriorYearRetiree = (ph.type === 'partnerToRetire') && ((ph.partnerPortionOfYear ?? 0) === 0)
                          return s + (isPriorYearRetiree ? (ph.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(ph)) : 0)
                        }, 0)
                        const remainderBudget = Math.max(0, totalBudget - trailingTotal)
                        createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            medicalDirectorHoursPercentage: percentage,
                            hasMedicalDirectorHours: percentage !== 0
                          })
                        }, remainderBudget)
                      }
                    }
                  }}
                onMouseEnter={(e) => {
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                  if (!readOnly) {
                    if ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0) {
                      const initial = p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)
                      createTrailingSharedMdAmountTooltip(p.id, initial, e, (_, amount) => {
                        store.upsertPhysician(scenario, year, {
                          ...p,
                          trailingSharedMdAmount: amount
                        })
                      })
                    } else {
                      const trailingTotal = fy.physicians.reduce((s, ph) => {
                        const isPriorYearRetiree = (ph.type === 'partnerToRetire') && ((ph.partnerPortionOfYear ?? 0) === 0)
                        return s + (isPriorYearRetiree ? (ph.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(ph)) : 0)
                      }, 0)
                      const remainderBudget = Math.max(0, totalBudget - trailingTotal)
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                        store.upsertPhysician(scenario, year, {
                          ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                        })
                      }, remainderBudget)
                    }
                    e.currentTarget.style.opacity = '0.8'
                  } else {
                    // Read-only: show dollar amount only (no percentage)
                    if ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0) {
                      const amount = p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)
                      createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(Math.round(amount))}`, e)
                    } else {
                      const trailingTotal = fy.physicians.reduce((s, ph) => {
                        const isPriorYearRetiree = (ph.type === 'partnerToRetire') && ((ph.partnerPortionOfYear ?? 0) === 0)
                        return s + (isPriorYearRetiree ? (ph.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(ph)) : 0)
                      }, 0)
                      const remainderBudget = Math.max(0, totalBudget - trailingTotal)
                      const amount = Math.round((p.medicalDirectorHoursPercentage ?? 0) * remainderBudget / 100)
                      createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(Math.round(amount))}`, e)
                    }
                  }
                }}
                  onMouseLeave={(e) => {
                    if (!readOnly) {
                      const tooltipHours = document.getElementById(`hours-slider-${p.id}`)
                      const tooltipTrailing = document.getElementById(`trailing-md-amount-${p.id}`)
                      const maybeHide = (tooltip: HTMLElement | null, id: string) => {
                        if (!tooltip) return
                        ;(tooltip as any).hideTimeout = setTimeout(() => {
                          if (tooltip && !tooltip.matches(':hover')) {
                            removeTooltip(id)
                          }
                        }, 150)
                      }
                      maybeHide(tooltipHours as any, `hours-slider-${p.id}`)
                      maybeHide(tooltipTrailing as any, `trailing-md-amount-${p.id}`)
                      e.currentTarget.style.opacity = '1'
                    } else {
                      removeTooltip(`hours-readonly-${p.id}`)
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!readOnly) {
                      if ((p.type === 'partnerToRetire') && (p.partnerPortionOfYear ?? 0) === 0) {
                        const initial = p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p)
                        createTrailingSharedMdAmountTooltip(p.id, initial, e, (_, amount) => {
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            trailingSharedMdAmount: amount
                          })
                        })
                      } else {
                        // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                        const trailingTotal = fy.physicians.reduce((s, ph) => {
                          const isPriorYearRetiree = (ph.type === 'partnerToRetire') && ((ph.partnerPortionOfYear ?? 0) === 0)
                          return s + (isPriorYearRetiree ? (ph.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(ph)) : 0)
                        }, 0)
                        const remainderBudget = Math.max(0, totalBudget - trailingTotal)
                        createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            medicalDirectorHoursPercentage: percentage,
                            hasMedicalDirectorHours: percentage !== 0
                          })
                        }, remainderBudget)
                      }
                    }
                  }}
                />
                {/* Placeholder bottom row to keep consistent height when 3-row layout */}
                {((p.partnerPortionOfYear ?? 0.5) > 0) && <div style={{ height: 20 }} />}
              </div>
            ) : (
              <div></div>
            )}
              <div style={{ display: 'grid', gridTemplateRows: (p.partnerPortionOfYear ?? 0.5) > 0 ? '20px 20px 20px 20px' : '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'partner-retire-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const retirementDay = partnerPortionToRetirementDay(p.partnerPortionOfYear ?? 0.5, year)
                    const { month, day } = dayOfYearToDate(retirementDay, year)
                    const retirementDate = dateToString(month, day)
                    const partnerPct = Math.round((p.partnerPortionOfYear ?? 0.5) * 100)
                    const retiredPct = 100 - partnerPct
                    let extra = ''
                    if (retirementDay === 0) {
                      extra = `\n(Retired in previous year, buyout cost in ${year})`
                    } else if (Math.abs(retirementDay - 183) <= 1) {
                      extra = `\n(Mid-year retirement)`
                    }
                    tooltip.textContent = `Partner → Retire transition:\nLast working day: ${retirementDay === 0 ? 'Prior Year' : retirementDate}\nWorking portion: ${partnerPct}%\nRetired portion: ${retiredPct}%${extra}`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('partner-retire-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                {/* Only show weeks off tooltip if weeks vacation is shown */}
                {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                  <div 
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                    onMouseEnter={(e) => {
                      const tooltip = document.createElement('div')
                      tooltip.id = 'weeks-off-tooltip'
                      tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                      
                      // Calculate relative FTE based on maximum FTE partner (accounting for vacation during partner period)
                      const allPartners = fy!.physicians.filter((ph) => ph.type === 'partner' || ph.type === 'employeeToPartner' || ph.type === 'partnerToRetire')
                      const partnerWeights = allPartners.map(ph => getPartnerFTEWeightProper(ph))
                      const maxWeight = Math.max(...partnerWeights, 0.01) // Avoid division by zero
                      const currentWeight = getPartnerFTEWeightProper(p)
                      const relativeFTE = currentWeight / maxWeight
                      
                      const weeks = p.weeksVacation ?? 8
                      const partnerPortion = getPartnerPortionOfYear(p)
                      const partnerWeeksInYear = partnerPortion * 52
                      const effectivePartnerWeeks = Math.max(0, partnerWeeksInYear - weeks)
                      tooltip.textContent = `Weeks Off During Working Period:\n\nWeeks off: ${weeks}\nPartner weeks available: ${partnerWeeksInYear.toFixed(1)}\nEffective working weeks: ${effectivePartnerWeeks.toFixed(1)}\nRelative FTE: ${(relativeFTE * 100).toFixed(1)}%\nPartner portion of year: ${(partnerPortion * 100).toFixed(1)}%\n\nThis represents the actual number of weeks off taken during the portion of the year the partner was actively working.\n\nVacation is subtracted from available partner working weeks.`
                      document.body.appendChild(tooltip)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      tooltip.style.left = `${rect.right + 10}px`
                      tooltip.style.top = `${rect.top + window.scrollY}px`
                    }}
                    onMouseLeave={() => { const t = document.getElementById('weeks-off-tooltip'); if (t) t.remove() }}
                  >
                    <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
                  </div>
                )}
                {/* Only show additional days worked tooltip if weeks vacation is shown */}
                {(p.partnerPortionOfYear ?? 0.5) > 0 && (
                  <div
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                    onMouseEnter={(e) => {
                      const tooltip = document.createElement('div')
                      tooltip.id = 'additional-days-tooltip-ptr'
                      tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                      tooltip.textContent = `Additional Days Worked (Internal Locums) - $500 per consult`
                      document.body.appendChild(tooltip)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      tooltip.style.left = `${rect.right + 10}px`
                      tooltip.style.top = `${rect.top + window.scrollY}px`
                    }}
                    onMouseLeave={() => { const t = document.getElementById('additional-days-tooltip-ptr'); if (t) t.remove() }}
                  ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                )}
                <div
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'buyout-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    tooltip.textContent = `Buyout Payment: ${currency(p.buyoutCost ?? 0)}\n\nThis is a one-time cost that reduces the partner compensation pool for the year.`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('buyout-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : p.type === 'partner' ? (
          // partner
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={2}
                  max={(() => {
                    const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                    return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                  })()}
                  step={1}
                  value={p.weeksVacation ?? 8}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.weeksVacation ?? 8) - 2) / ((() => {
                      const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                      return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                    })() - 2) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={`${p.weeksVacation ?? 8} weeks off`}
                  onChange={(e) => {
                    const weeks = Number(e.target.value.replace(/[^0-9]/g, ''))
                    if (!isNaN(weeks)) {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        weeksVacation: weeks,
                      })
                    }
                  }}
                  style={{
                    width: 100,
                    height: 20,
                    padding: '2px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={20000}
                  step={500}
                  value={p.additionalDaysWorked ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      additionalDaysWorked: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.additionalDaysWorked ?? 0) / 20000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(p.additionalDaysWorked ?? 0)}
                  onChange={(e) => {
                    const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                    if (!isNaN(value)) {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        additionalDaysWorked: value,
                      })
                    }
                  }}
                  style={{
                    width: 100,
                    height: 20,
                    padding: '2px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div style={{ height: 20 }} />
              <img
                src={(p.medicalDirectorHoursPercentage ?? 0) > 0 ? '/hours_selected.png' : '/hours_unselected.png'}
                alt={`Medical Director Hours ${((p.medicalDirectorHoursPercentage ?? 0) > 0) ? 'enabled' : 'disabled'}`}
                data-hours-id={p.id}
                style={{
                  width: '20px',
                  height: 'auto',
                  maxHeight: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1,
                  objectFit: 'contain'
                }}
                onClick={(e) => {
                  if (!readOnly) {
                      // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                  }
                }}
                onMouseEnter={(e) => {
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                  if (!readOnly) {
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                    e.currentTarget.style.opacity = '0.8'
                  } else {
                    // Show read-only tooltip with dollar amount only
                    const percentage = p.medicalDirectorHoursPercentage ?? 0
                    const dollarAmount = Math.round(percentage * totalBudget / 100)
                    createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(dollarAmount)}`, e)
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    const tooltip = document.getElementById(`hours-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`hours-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  } else {
                    removeTooltip(`hours-readonly-${p.id}`)
                  }
                }}
                onTouchStart={(e) => {
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                  if (!readOnly) {
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                  } else {
                    // Show read-only tooltip with dollar amount only
                    const percentage = p.medicalDirectorHoursPercentage ?? 0
                    const dollarAmount = Math.round(percentage * totalBudget / 100)
                    createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(dollarAmount)}`, e)
                  }
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'partner-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`

                  // Calculate relative FTE based on maximum FTE partner (accounting for vacation during partner period)
                  const allPartners = physicians.filter((ph) => ph.type === 'partner' || ph.type === 'employeeToPartner' || ph.type === 'partnerToRetire')
                  const partnerWeights = allPartners.map(ph => getPartnerFTEWeightProper(ph))
                  const maxWeight = Math.max(...partnerWeights, 0.01) // Avoid division by zero
                  const currentWeight = getPartnerFTEWeightProper(p)
                  const relativeFTE = currentWeight / maxWeight

                  const weeks = p.weeksVacation ?? 8
                  const effectiveWeeks = 52 - weeks
                  tooltip.textContent = `Partner:\nWeeks off: ${weeks}\nWorking weeks: ${effectiveWeeks}\nRelative FTE: ${(relativeFTE * 100).toFixed(1)}%`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('partner-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                onMouseEnter={(e) => {
                  const tooltip = document.createElement('div')
                  tooltip.id = 'additional-days-tooltip'
                  tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                  tooltip.textContent = `Additional Days Worked (Internal Locums) - $500 per consult`
                  document.body.appendChild(tooltip)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  tooltip.style.left = `${rect.right + 10}px`
                  tooltip.style.top = `${rect.top + window.scrollY}px`
                }}
                onMouseLeave={() => { const t = document.getElementById('additional-days-tooltip'); if (t) t.remove() }}
              ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
            </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        ) : (
          // employeeToPartner
          <>
            <div className="control-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto auto', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 20 }}>
                  <input
                    type="range"
                    min={1}
                    max={daysInYear(year)}
                    step={1}
                    className="growth-slider"
                    value={employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)}
                    onChange={(e) => {
                      const transitionDay = Number(e.target.value)
                      const employeePortion = transitionDayToEmployeePortion(transitionDay, year)
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        employeePortionOfYear: employeePortion,
                      })
                    }}
                    disabled={readOnly}
                    style={{ 
                      width: '100%', margin: 0,
                      ['--fill-percent' as any]: `${((employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year) - 1) / (daysInYear(year) - 1)) * 100}%`
                    }}
                  />
                  {/* Exact quarter tickmarks at Apr 1, Jul 1, Oct 1 (leap-year aware) */}
                  {(() => {
                    const { q2, q3, q4 } = getQuarterStartDays(year)
                    const totalDays = daysInYear(year)
                    return [
                      { day: q2, key: 'Q2' },
                      { day: q3, key: 'Q3' },
                      { day: q4, key: 'Q4' },
                    ].map(({ day, key }) => {
                      const f = (day - 1) / (totalDays - 1)
                      const left = `calc(${(f * 100).toFixed(6)}% + ${((0.5 - f) * 18).toFixed(2)}px)`
                      return (
                        <div
                          key={key}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left,
                            transform: 'translate(-50%, -50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: '#374151',
                            pointerEvents: 'none',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 100, height: 20 }}>
                  <input
                    type="text"
                    value={(() => {
                      const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                      const { month, day } = dayOfYearToDate(transitionDay, year)
                      return `→ ${dateToString(month, day)}`
                    })()}
                    onChange={() => {
                      // Read-only display
                    }}
                    style={{ 
                      width: '100%', 
                      height: 20, 
                      padding: readOnly ? '2px 8px' : '2px 18px 2px 8px', // Left padding matches other inputs
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 12
                    }}
                    disabled={readOnly}
                    readOnly={true}
                  />
                  {!readOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      right: 1, 
                      top: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      height: 18
                    }}>
                      <button
                        onClick={() => {
                          const currentDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                          const newDay = Math.min(daysInYear(year), currentDay + 1)
                          const employeePortion = transitionDayToEmployeePortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            employeePortionOfYear: employeePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderBottom: 'none',
                          borderRadius: '2px 2px 0 0',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Next day"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          const currentDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                          const newDay = Math.max(1, currentDay - 1)
                          const employeePortion = transitionDayToEmployeePortion(newDay, year)
                          store.upsertPhysician(scenario, year, {
                            ...p,
                            employeePortionOfYear: employeePortion,
                          })
                        }}
                        style={{
                          width: 16,
                          height: 9,
                          border: '1px solid #ccc',
                          borderRadius: '0 0 2px 2px',
                          background: '#f8f9fa',
                          cursor: 'pointer',
                          fontSize: 8,
                          lineHeight: '7px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Previous day"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={350000}
                  max={650000}
                  step={1000}
                  value={p.salary ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.salary ?? 0) - 350000) / (650000 - 350000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(Math.round(p.salary ?? 0))}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      salary: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={2}
                  max={(() => {
                    const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                    return (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                  })()}
                  step={1}
                  value={p.weeksVacation ?? 8}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{ 
                    width: '100%',
                    ['--fill-percent' as any]: `${(() => {
                      const currentDataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
                      const maxWeeks = (currentDataMode === '2024 Data' || year <= 2024) ? 24 : 16
                      return ((p.weeksVacation ?? 8) - 2) / (maxWeeks - 2) * 100
                    })()}%`
                  }}
                />
                <input
                  type="text"
                  value={`${p.weeksVacation ?? 8} weeks off`}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      weeksVacation: Number(e.target.value.replace(/[^0-9]/g, '')),
                    })
                  }
                  style={{ 
                    width: 100, 
                    height: 20, 
                    padding: '2px 8px', 
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={20000}
                  step={500}
                  value={p.additionalDaysWorked ?? 0}
                  onChange={(e) =>
                    store.upsertPhysician(scenario, year, {
                      ...p,
                      additionalDaysWorked: Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    ['--fill-percent' as any]: `${((p.additionalDaysWorked ?? 0) / 20000) * 100}%`
                  }}
                />
                <input
                  type="text"
                  value={currency(p.additionalDaysWorked ?? 0)}
                  onChange={(e) => {
                    const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                    if (!isNaN(value)) {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                        additionalDaysWorked: value,
                      })
                    }
                  }}
                  style={{
                    width: 100,
                    height: 20,
                    padding: '2px 8px',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 12
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
            {/* First icon column: blank (aligns with date), then Benefits (salary), then Hours (vacation), then blank (additional days) */}
            <div style={{ display: 'grid', gridTemplateRows: '20px 20px 20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
              <div style={{ width: '20px', height: '20px' }} />
              <img 
                src={p.receivesBenefits ? '/benefit_selected.png?v=2' : '/benefit_unselected.png'}
                alt={`Benefits ${p.receivesBenefits ? 'enabled' : 'disabled'}`}
                style={{ 
                  width: '20px',
                  height: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1
                }}
                onClick={() => {
                  if (!readOnly) {
                    const newBenefitsState = !p.receivesBenefits
                    store.upsertPhysician(scenario, year, { 
                      ...p, 
                      receivesBenefits: newBenefitsState
                    })
                    const tooltip = document.getElementById('benefits-tooltip-split')
                    if (tooltip) {
                      tooltip.innerHTML = `Benefits: ${newBenefitsState ? 'Enabled' : 'Disabled'}`
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  createTooltip('benefits-tooltip-split', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  removeTooltip('benefits-tooltip-split')
                  if (!readOnly) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onTouchStart={(e) => createTooltip('benefits-tooltip-split', `Benefits: ${p.receivesBenefits ? 'Enabled' : 'Disabled'}`, e)}
              />
              <img
                src={(p.medicalDirectorHoursPercentage ?? 0) > 0 ? '/hours_selected.png' : '/hours_unselected.png'}
                alt={`Medical Director Hours ${((p.medicalDirectorHoursPercentage ?? 0) > 0) ? 'enabled' : 'disabled'}`}
                data-hours-id={p.id}
                style={{
                  width: '20px',
                  height: 'auto',
                  maxHeight: '20px',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly ? 0.6 : 1,
                  objectFit: 'contain'
                }}
                onClick={(e) => {
                  if (!readOnly) {
                      // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                  }
                }}
                onMouseEnter={(e) => {
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                  if (!readOnly) {
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                    e.currentTarget.style.opacity = '0.8'
                  } else {
                    // Show read-only tooltip with dollar amount only
                    const percentage = p.medicalDirectorHoursPercentage ?? 0
                    const dollarAmount = Math.round(percentage * totalBudget / 100)
                    createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(dollarAmount)}`, e)
                  }
                }}
                onMouseLeave={(e) => {
                  if (!readOnly) {
                    const tooltip = document.getElementById(`hours-slider-${p.id}`)
                    if (tooltip) {
                      (tooltip as any).hideTimeout = setTimeout(() => {
                        if (tooltip && !tooltip.matches(':hover')) {
                          removeTooltip(`hours-slider-${p.id}`)
                        }
                      }, 150)
                    }
                    e.currentTarget.style.opacity = '1'
                  } else {
                    removeTooltip(`hours-readonly-${p.id}`)
                  }
                }}
                onTouchStart={(e) => {
                  // Use specific 2024-25 values when in those data modes for baseline year
                  let totalBudget = fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000
                  if (year === 2025 && sc.dataMode === '2024 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS // 2024 shared medical director amount
                  } else if (year === 2025 && sc.dataMode === '2025 Data') {
                    totalBudget = fy.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2025 shared medical director amount
                  }
                  if (!readOnly) {
                      createHoursTooltip(p.id, p.medicalDirectorHoursPercentage ?? 0, e, (_, percentage) => {
                      store.upsertPhysician(scenario, year, {
                        ...p,
                          medicalDirectorHoursPercentage: percentage,
                          hasMedicalDirectorHours: percentage !== 0
                      })
                    }, totalBudget)
                  } else {
                    // Show read-only tooltip with dollar amount only
                    const percentage = p.medicalDirectorHoursPercentage ?? 0
                    const dollarAmount = Math.round(percentage * totalBudget / 100)
                    createTooltip(`hours-readonly-${p.id}`, `Medical Director Hours: ${currency(dollarAmount)}`, e)
                  }
                }}
              />
              <div style={{ width: '20px', height: '20px' }} />
            </div>
              <div style={{ display: 'grid', gridTemplateRows: '20px 20px 20px 20px', gap: 8, alignItems: 'center', justifyItems: 'center' }}>
                {/* 1) Transition info */}
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'employee-partner-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 380px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const transitionDay = employeePortionToTransitionDay(p.employeePortionOfYear ?? 0.5, year)
                    const { month, day } = dayOfYearToDate(transitionDay, year)
                    const transitionDate = dateToString(month, day)
                    const empPct = Math.round((p.employeePortionOfYear ?? 0.5) * 100)
                    const partnerPct = 100 - empPct
                    let extra = ''
                    if (Math.abs(transitionDay - 183) <= 1) extra = `\n(Mid-year transition)`
                    
                    const delayedW2 = calculateDelayedW2Payment(p, year)
                    let delayedW2Info = ''
                    if (delayedW2.amount > 0) {
                      delayedW2Info = `\n\nDelayed W2 Payments (prior year work):\nW2 Amount: ${currency(delayedW2.amount)}\nPayroll Taxes: ${currency(delayedW2.taxes)}\nTotal Cost: ${currency(delayedW2.amount + delayedW2.taxes)}\nPeriods: ${delayedW2.periodDetails}`
                    }
                    
                    tooltip.textContent = `Employee → Partner transition:\nTransition date: ${transitionDate}\nEmployee portion: ${empPct}%\nPartner portion: ${partnerPct}%${extra}${delayedW2Info}`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('employee-partner-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                {/* 2) Employee cost info (middle slot - aligns with salary controls) */}
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'employee-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    const employeePortion = getEmployeePortionOfYear(p)
                    const employeePortionSalary = (p.salary ?? 0) * employeePortion
                    const delayedW2 = calculateDelayedW2Payment(p, year)
                    let tooltip_content = getEmployeeCostTooltip(
                      { ...p, salary: employeePortionSalary }, 
                      year, 
                      sc.projection.benefitCostsGrowthPct,
                      delayedW2.amount,
                      delayedW2.taxes,
                      delayedW2.periodDetails
                    )
                    tooltip_content = tooltip_content.replace('Employee Total Cost', `Employee Total Cost (${Math.round(employeePortion * 100)}% of year)`)
                    
                    tooltip.textContent = tooltip_content
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('employee-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                {/* 3) Partner weeks info (last slot - aligns with vacation controls) */}
                <div 
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'partner-weeks-tooltip'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    
                    const weeks = p.weeksVacation ?? 8
                    const partnerPortion = getPartnerPortionOfYear(p)
                    const partnerWeeksInYear = partnerPortion * 52
                    const effectivePartnerWeeks = Math.max(0, partnerWeeksInYear - weeks)
                    
                    const allPartners = physicians.filter((ph) => ph.type === 'partner' || ph.type === 'employeeToPartner' || ph.type === 'partnerToRetire')
                    const partnerWeights = allPartners.map(ph => getPartnerFTEWeightProper(ph))
                    const maxWeight = Math.max(...partnerWeights, 0.01)
                    const currentWeight = getPartnerFTEWeightProper(p)
                    const relativeFTE = currentWeight / maxWeight
                    
                    tooltip.textContent = `Partner (during partner period):\nWeeks off: ${weeks}\nPartner weeks available: ${partnerWeeksInYear.toFixed(1)}\nEffective working weeks: ${effectivePartnerWeeks.toFixed(1)}\nRelative FTE: ${(relativeFTE * 100).toFixed(1)}%\nPartner portion of year: ${(partnerPortion * 100).toFixed(1)}%`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('partner-weeks-tooltip'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
                {/* 4) Additional Days Worked info */}
                <div
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => {
                    const tooltip = document.createElement('div')
                    tooltip.id = 'additional-days-tooltip-etp'
                    tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
                    tooltip.textContent = `Additional Days Worked (Internal Locums) - $500 per consult`
                    document.body.appendChild(tooltip)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    tooltip.style.left = `${rect.right + 10}px`
                    tooltip.style.top = `${rect.top + window.scrollY}px`
                  }}
                  onMouseLeave={() => { const t = document.getElementById('additional-days-tooltip-etp'); if (t) t.remove() }}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              </div>
            <button
              onClick={() => store.removePhysician(scenario, year, p.id)}
              disabled={!canDelete}
              title={canDelete ? 'Remove' : 'Minimum 3 physicians'}
              style={{
                width: 20,
                height: 20,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: canDelete ? '#fff' : '#f3f3f3',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0,
              }}
            >
              <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>×</span>
            </button>
          </>
        )}
      </div>
    )
  })

  return (
    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f3f4f6' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Physicians</div>
        {(() => {
          const isChanged = arePhysiciansChanged(scenario, year, physicians, store)
          return isChanged && !readOnly ? (
            <button
              onClick={() => {
                removeTooltip('physicians-reset-tooltip')
                store.resetPhysicians(scenario, year)
              }}
              style={{
                position: 'absolute',
                left: 'calc(50% + 43px)', // 50% (center) + half the width of "Physicians" text + small gap
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#6b7280',
                padding: '2px 4px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.opacity = '1'
                createTooltip('physicians-reset-tooltip', 'Reset to Default', e)
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('physicians-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="panel-purple" style={{
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid rgba(126, 34, 206, 0.4)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(126, 34, 206, 0.05), 0 0 10px rgba(126, 34, 206, 0.08), 0 0 6px rgba(126, 34, 206, 0.4)',
        padding: 8
      }}>
        {readOnly ? (
          rows
        ) : (
          <DragDropPhysicians
            physicians={physicians}
            onReorder={handleReorder}
          >
            {rows}
          </DragDropPhysicians>
        )}
        
        {/* Locums costs row - always last row in purple panel */}
        <div
          style={{
            borderTop: '1px solid #d1d5db',
            paddingTop: 10,
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: '20px 120px 150px 1fr 20px 20px 20px',
            gap: 8,
            alignItems: 'center',
            cursor: 'default',
            background: 'transparent'
          }}
        >
          <div></div> {/* Empty space for drag handle column alignment */}
          <div style={{ fontWeight: 500, color: '#6b7280' }}></div>
          <div style={{ 
            fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            color: '#213547',
            textAlign: 'left',
            paddingLeft: 6,
            fontSize: '14px'
          }}>Locums Costs</div>
          <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={240000}
              step={1000}
              value={locumCosts}
              onChange={(e) => onLocumCostsChange(Number(e.target.value))}
              disabled={readOnly}
              style={{ 
                width: '100%',
                ['--fill-percent' as any]: `${(locumCosts / 240000) * 100}%`
              }}
            />
            <input
              type="text"
              value={currency(Math.round(locumCosts))}
              readOnly
              style={{ 
                width: 100, 
                height: 20, 
                padding: '2px 8px', 
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 12
              }}
            />
          </div>
          <div></div> {/* Empty benefits column */}
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
            onMouseEnter={(e) => {
              const dailyRate = 2000
              const days = Math.round(locumCosts / dailyRate)
              const weeks4Day = Math.round(days / 4 * 10) / 10
              const weeks5Day = Math.round(days / 5 * 10) / 10
              const minWeeks = Math.min(weeks4Day, weeks5Day)
              const maxWeeks = Math.max(weeks4Day, weeks5Day)
              const tooltipText = `~$${dailyRate.toLocaleString()} per day, ${days} days, ${minWeeks}-${maxWeeks} weeks`
              
              const existing = document.getElementById('locums-tooltip')
              if (existing) existing.remove()
              const tooltip = document.createElement('div')
              tooltip.id = 'locums-tooltip'
              tooltip.style.cssText = `position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; white-space: pre-line; text-align: left; z-index: 1000; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none;`
              tooltip.textContent = tooltipText
              document.body.appendChild(tooltip)
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              tooltip.style.left = `${rect.right + 10}px`
              tooltip.style.top = `${rect.top + window.scrollY}px`
            }}
            onMouseLeave={() => { const t = document.getElementById('locums-tooltip'); if (t) t.remove() }}
          >
            <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
          </div>
          <div></div> {/* Empty delete column */}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={() => {
            const nextIndex = fy.physicians.length
            const type: PhysicianType = 'newEmployee'
            store.upsertPhysician(scenario, year, {
              id: `${year}-${nextIndex}`,
              name: `Physician ${nextIndex + 1}`,
              type,
              salary: 500000,
              startPortionOfYear: 0, // Default to starting Jan 1
              weeksVacation: undefined,
              receivesBenefits: true,  // Default new employees to receive benefits
              receivesBonuses: false,  // Default new employees to not receive bonuses
              bonusAmount: 0, // Default bonus amount
            })
          }}
          style={{
            marginTop: 8,
            border: '1px solid #cfd2d6',
            borderRadius: 6,
            padding: '8px 12px',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            cursor: 'pointer',
          }}
        >
          Add physician
        </button>
      )}
    </div>
  )
}
