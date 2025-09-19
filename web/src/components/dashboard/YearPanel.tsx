import { Fragment } from 'react'
import { useDashboardStore, usePartnerComp } from '../Dashboard'
import { useIsMobile } from './hooks'
import { calculateDelayedW2Payment, calculateProjectedValue, computeDefaultNonMdEmploymentCosts } from './calculations'
import { createTooltip, removeTooltip } from './tooltips'
import { currency } from './utils'
import {
  scenario2024Defaults,
  scenarioADefaultsByYear,
  scenarioBDefaultsByYear
} from './defaults'
import { DEFAULT_MISC_EMPLOYMENT_COSTS } from './calculations'
import type { ScenarioKey, FutureYear } from './types'
import PhysiciansEditor from './PhysiciansEditor'

export default function YearPanel({ year, scenario }: { year: number; scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
  const isReadOnly = year === 2025 && dataMode !== 'Custom'
  const last2024 = store.historic.find((h) => h.year === 2024)
  const last2025 = store.historic.find((h) => h.year === 2025)

  const fy = isReadOnly && (last2024 || last2025)
    ? (() => {
        // For Custom mode, use the editable data from future years array
        if ((dataMode as string) === 'Custom') {
          const customData = sc.future.find((f) => f.year === 2025)
          if (customData) return customData
          // Fallback if no custom data exists yet
          return {
            year: 2025,
            therapyIncome: last2025?.therapyIncome || 3344068.19,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          } as FutureYear
        }
        // Determine baseline data based on selected data mode
        else if (dataMode === '2024 Data' && last2024) {
          const physicians = scenario2024Defaults()
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            year: 2025,
            therapyIncome: last2024.therapyIncome,
            nonEmploymentCosts: last2024.nonEmploymentCosts,
            nonMdEmploymentCosts: 164677.44, // 2024 actual staff employment costs
            locumCosts: 113400, // 2024 actual locums costs
            miscEmploymentCosts: 18182.56, // 2024 actual misc employment from image
            medicalDirectorHours: 102870, // 2024 shared medical director amount
            prcsMedicalDirectorHours: 25805, // 2024 PRCS medical director amount (JS)
            prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
            physicians,
          } as FutureYear
        } else if (dataMode === '2025 Data' && last2025) {
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
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
          } as FutureYear
        } else {
          // Fallback
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const js = physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            year: 2025,
            therapyIncome: last2025?.therapyIncome || 3344068.19,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 229713.57,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: 54600,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            prcsDirectorPhysicianId: js?.id, // Assign PRCS to JS
            physicians,
          } as FutureYear
        }
      })()
    : (sc.future.find((f) => f.year === year) as FutureYear)
  const partnerComp = usePartnerComp(year, scenario)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {year === 2025 ? (
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 4,
            animation: 'fadeInSlideDown 0.3s ease-out',
            transformOrigin: 'top'
          }}>
            <span style={{ marginLeft: 13, fontWeight: 700, fontSize: 16, color: '#374151' }}>Data Source:</span>
            {(['Custom', '2024 Data', '2025 Data'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                store.setDataMode(scenario, mode)
                // Only recalculate projections when switching between actual data modes (not to/from Custom)
                if (mode !== 'Custom') {
                  store.applyProjectionFromLastActual(scenario)
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: (scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode) === mode ? '#f0f4ff' : 'white',
                fontWeight: (scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode) === mode ? 600 : 400,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {mode}
            </button>
            ))}
          </div>
        </div>


      ) : (
        <div style={{ fontWeight: 700, fontSize: 18 }}>{year}</div>
      )}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f3f4f6', padding: 8 }}>

      <div className="panel-green" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Therapy Income</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'therapyIncome', store)
          const currentValue = fy.therapyIncome || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('income-reset-tooltip')
                store.setFutureValue(scenario, year, 'therapyIncome', projectedValue)
              }}
              style={{
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
                createTooltip('income-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('income-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={2000000}
          max={4000000}
          step={1000}
          value={fy.therapyIncome || 3000000}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'therapyIncome', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.therapyIncome || 3000000) - 2000000) / (4000000 - 2000000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.therapyIncome || 3000000))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'therapyIncome', Number(e.target.value.replace(/[^0-9]/g, '')))
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('income-tooltip', 'Includes Interest Income', e)}
          onMouseLeave={() => removeTooltip('income-tooltip')}
          onTouchStart={(e) => createTooltip('income-tooltip', 'Includes Interest Income', e)}
          onClick={(e) => createTooltip('income-tooltip', 'Includes Interest Income', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>

      {/* Medical Director Hours Section */}
      <div style={{ marginTop: 8, paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Medical Director Hours</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: '19px', height: 19, display: 'inline-flex', alignItems: 'center' }}>Shared</div>
        <div style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>
          {(() => {
            const projectionValue = sc.projection.medicalDirectorHours ?? 80000
            const currentValue = fy.medicalDirectorHours ?? projectionValue
            const isChanged = Math.abs(currentValue - projectionValue) > 1000 // $1000 threshold
            return isChanged && !isReadOnly ? (
              <button
                onClick={() => {
                  removeTooltip('shared-medical-director-reset-tooltip')
                  store.setFutureValue(scenario, year, 'medicalDirectorHours', projectionValue)
                }}
                style={{
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
                  createTooltip('shared-medical-director-reset-tooltip', 'Reset to Annual Override Value', e)
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  removeTooltip('shared-medical-director-reset-tooltip')
                }}
              >
                ↺
              </button>
            ) : null
          })()}
        </div>
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={120000}
          step={1000}
          value={fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'medicalDirectorHours', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000) / 120000) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'medicalDirectorHours', Number(e.target.value.replace(/[^0-9]/g, '')))
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('medical-director-tooltip', 'Shared contract terms: $270/hr up to $97,200 maximum annual. Distributed evenly to partners.', e)}
          onMouseLeave={() => removeTooltip('medical-director-tooltip')}
          onTouchStart={(e) => createTooltip('medical-director-tooltip', 'Shared contract terms: $270/hr up to $97,200 maximum annual. Distributed evenly to partners.', e)}
          onClick={(e) => createTooltip('medical-director-tooltip', 'Shared contract terms: $270/hr up to $97,200 maximum annual. Distributed evenly to partners.', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>

      {/* PRCS Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: '19px', height: 19, display: 'inline-flex', alignItems: 'center' }}>PRCS</div>
        <div style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>
          {(() => {
            const projectionValue = sc.projection.prcsMedicalDirectorHours ?? 80000
            const currentValue = fy.prcsMedicalDirectorHours ?? projectionValue
            const isChanged = Math.abs(currentValue - projectionValue) > 1000
            return isChanged && !isReadOnly ? (
              <button
                onClick={() => {
                  removeTooltip('prcs-medical-director-reset-tooltip')
                  store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', projectionValue)
                }}
                style={{
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
                  createTooltip('prcs-medical-director-reset-tooltip', 'Reset to Annual Override Value', e)
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  removeTooltip('prcs-medical-director-reset-tooltip')
                }}
              >
                ↺
              </button>
            ) : null
          })()}
        </div>
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={120000}
          step={1000}
          value={fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000) / 120000) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Number(e.target.value.replace(/[^0-9]/g, '')))
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('prcs-medical-director-tooltip', 'PRCS contract terms: $250/hr up to $90,000 maximum annual. Applies if a PRCS Medical Director is specified in the Physicians section.', e)}
          onMouseLeave={() => removeTooltip('prcs-medical-director-tooltip')}
          onTouchStart={(e) => createTooltip('prcs-medical-director-tooltip', 'PRCS contract terms: $250/hr up to $90,000 maximum annual. Applies if a PRCS Medical Director is specified in the Physicians section.', e)}
          onClick={(e) => createTooltip('prcs-medical-director-tooltip', 'PRCS contract terms: $250/hr up to $90,000 maximum annual. Applies if a PRCS Medical Director is specified in the Physicians section.', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>

      {/* Total Combined Income */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: 13, color: '#374151', paddingRight: 48 }}>
          <span style={{ fontWeight: 500 }}>Total Income:</span>
          <span style={{ fontWeight: 600 }}>
            {currency(((fy.therapyIncome || 0)
              + (fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? 80000)
              + (((fy.prcsDirectorPhysicianId ?? (year >= 2024 ? (fy.physicians.find(p => p.name === 'JS' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))?.id) : undefined))
                  ? (fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? 80000)
                  : 0))))}
          </span>
        </div>
      </div>
      </div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Non-Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonEmploymentCosts', store)
          const currentValue = fy.nonEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('non-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'nonEmploymentCosts', projectedValue)
              }}
              style={{
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
                createTooltip('non-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('non-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={100000}
          max={500000}
          step={1000}
          value={fy.nonEmploymentCosts || 200000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.nonEmploymentCosts || 200000) - 100000) / (500000 - 100000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonEmploymentCosts || 200000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onMouseLeave={() => removeTooltip('nonemp-tooltip')}
          onTouchStart={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
          onClick={(e) => createTooltip('nonemp-tooltip', 'Includes these non-employment categories:\n\nInsurance Cost\nState/Local Taxes\nCommunications Cost\nLicensure Costs\nPromotional Costs\nBilling Costs\nOffice Overhead\nCapital Expense', e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Staff Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonMdEmploymentCosts', store)
          const currentValue = fy.nonMdEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 1000 // $1000 threshold for dollar amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('staff-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'nonMdEmploymentCosts', projectedValue)
              }}
              style={{
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
                createTooltip('staff-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('staff-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={50000}
          max={300000}
          step={1000}
          value={fy.nonMdEmploymentCosts || 150000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonMdEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.nonMdEmploymentCosts || 150000) - 50000) / (300000 - 50000)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonMdEmploymentCosts || 150000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'nonMdEmploymentCosts',
              Number(e.target.value.replace(/[^0-9]/g, ''))
            )
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('nonmd-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'nonmd-tooltip'
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
              max-width: 360px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              pointer-events: none;
            `
            tooltip.textContent = `Includes: Practice Manager, Billing\n\nBaseline 2025:\nRG: Full-time, $31.25 per hour, Medical/Dental/Vision\nAL: Part-time: $27 per hour, 32 hours per week\nMW: Part-time: $23 per hour, 20 hours per week`
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => {
            const tooltip = document.getElementById('nonmd-tooltip')
            if (tooltip) tooltip.remove()
          }}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>


      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Misc Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'miscEmploymentCosts', store)
          const currentValue = fy.miscEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > 100 // $100 threshold for smaller amounts
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('misc-employment-reset-tooltip')
                store.setFutureValue(scenario, year, 'miscEmploymentCosts', projectedValue)
              }}
              style={{
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
                createTooltip('misc-employment-reset-tooltip', 'Reset to Projected Value', e)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('misc-employment-reset-tooltip')
              }}
            >
              ↺
            </button>
          ) : null
        })()}
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1 }}>
        <input
          type="range"
          min={0}
          max={100000}
          step={1000}
          value={fy.miscEmploymentCosts || 25000}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'miscEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.miscEmploymentCosts || 25000) / 100000) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.miscEmploymentCosts || 25000))}
          onChange={(e) =>
            store.setFutureValue(
              scenario,
              year,
              'miscEmploymentCosts',
              Number(e.target.value)
            )
          }
          disabled={isReadOnly}
          style={{
            width: isMobile ? 100 : 100,
            height: 20,
            padding: '2px 8px',
            border: '1px solid #ccc',
            borderRadius: 3,
            fontSize: 12,
            justifySelf: isMobile ? 'end' : undefined
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666', width: 20, height: 20, border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
          onMouseEnter={(e) => {
            const existing = document.getElementById('misc-tooltip')
            if (existing) existing.remove()
            const tooltip = document.createElement('div')
            tooltip.id = 'misc-tooltip'
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
            const baseContent = 'Includes:\nGifts\nProfit Sharing\nRelocation\nRecruiting'
            tooltip.textContent = baseContent
            document.body.appendChild(tooltip)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            tooltip.style.left = `${rect.right + 10}px`
            tooltip.style.top = `${rect.top + window.scrollY}px`
          }}
          onMouseLeave={() => {
            const tooltip = document.getElementById('misc-tooltip')
            if (tooltip) tooltip.remove()
          }}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>
      </div>
      </div>

      <PhysiciansEditor
        year={year}
        scenario={scenario}
        readOnly={isReadOnly}
        physiciansOverride={isReadOnly ? (() => {
          if (dataMode === '2024 Data') {
            return scenario2024Defaults()
          } else {
            return scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          }
        })() : undefined}
        locumCosts={fy.locumCosts}
        onLocumCostsChange={(value) => store.setFutureValue(scenario, year, 'locumCosts', value)}
      />

      {partnerComp.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f3f4f6' }}>
          <div style={{ fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>Partner Compensation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'center', columnGap: 16, rowGap: 2 }}>
            {partnerComp.map((p) => (
              <Fragment key={p.id}>
                <div>{p.name}</div>
                <div style={{ textAlign: 'right', position: 'relative', overflow: 'visible' }}>
                  {currency(p.comp)}
                  {(() => {
                    const md = fy?.physicians.find((x) => x.id === p.id)
                    if (md && md.type === 'employeeToPartner') {
                      // Show delayed W2 payments for employeeToPartner physicians
                      const delayedW2 = calculateDelayedW2Payment(md, year)
                      if (delayedW2.amount > 0) {
                        return (
                          <span style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 400 }}>
                            {`(+ ${currency(delayedW2.amount)} W2)`}
                          </span>
                        )
                      }

                      // Fallback to regular W2 calculation if no delayed payments
                      const employeePortion = md.employeePortionOfYear ?? 0
                      const w2 = (md.salary ?? 0) * employeePortion
                      if (w2 > 0) {
                        return (
                          <span style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 400 }}>
                            {`(+ ${currency(w2)} W2)`}
                          </span>
                        )
                      }
                    }
                    return null
                  })()}
                </div>
              </Fragment>
            ))}
            <div style={{ gridColumn: '1 / -1', height: 1, background: '#e5e7eb', margin: '4px 0' }} />
            <div style={{ fontWeight: 700 }}>Net Income</div>
            <div style={{ textAlign: 'right', fontWeight: 700 }}>
              {currency(partnerComp.reduce((s, x) => s + x.comp, 0))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}