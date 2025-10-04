import { Fragment } from 'react'
import { useDashboardStore, usePartnerComp, calculateProjectedValue } from '../../../Dashboard'
import { useIsMobile } from '../hooks'
import { calculateDelayedW2Payment, computeDefaultNonMdEmploymentCosts, getTotalIncome, getEmployeePortionOfYear } from '../calculations'
import { createTooltip, removeTooltip } from '../tooltips'
import { currency } from '../utils'
import {
  scenario2024Defaults,
  scenarioADefaultsByYear,
  scenarioBDefaultsByYear,
  DEFAULT_MISC_EMPLOYMENT_COSTS,
  DEFAULT_LOCUM_COSTS_2025,
  ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
  ACTUAL_2024_LOCUM_COSTS,
  ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
  ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_CONSULTING_SERVICES,
  ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_CONSULTING_SERVICES,
  DEFAULT_CONSULTING_SERVICES_PROJECTION,
  UI_DEFAULTS,
  SLIDER_CONFIGS,
  SHARED_MD_TOOLTIP,
  PRCS_MD_TOOLTIP,
  THERAPY_INCOME_GROWTH_TOOLTIP,
  NON_EMPLOYMENT_COSTS_GROWTH_TOOLTIP,
  STAFF_W2_TOOLTIP,
  MISC_EMPLOYMENT_COSTS_TOOLTIP,
  CONSULTING_SERVICES_TOOLTIP
} from '../defaults'
import type { ScenarioKey, FutureYear } from '../types'
import PhysiciansEditor from './PhysiciansEditor'

export default function YearPanel({ year, scenario }: { year: number; scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const isMobile = useIsMobile()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB!
  const dataMode = scenario === 'A' ? store.scenarioA.dataMode : store.scenarioB?.dataMode || '2025 Data'
  const isReadOnly = year === 2025 && dataMode !== 'Custom'
  
  // Get all available years for the year buttons
  const availableYears = [2025, ...sc.future.filter((f) => f.year !== 2025).map((f) => f.year)]
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
            therapyIncome: last2025?.therapyIncome || 0,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: DEFAULT_LOCUM_COSTS_2025,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            physicians: scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025),
          } as FutureYear
        }
        // Determine baseline data based on selected data mode
        else if (dataMode === '2024 Data' && last2024) {
          const storeFy2025 = sc.future.find((f) => f.year === 2025)
          const physicians = scenario2024Defaults()
          const suszko = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          // Merge store overrides (from grid sync) into 2024 baseline for display
          return {
            year: 2025,
            therapyIncome: storeFy2025?.therapyIncome ?? last2024.therapyIncome,
            nonEmploymentCosts: storeFy2025?.nonEmploymentCosts ?? last2024.nonEmploymentCosts,
            nonMdEmploymentCosts: storeFy2025?.nonMdEmploymentCosts ?? ACTUAL_2024_NON_MD_EMPLOYMENT_COSTS,
            locumCosts: storeFy2025?.locumCosts ?? ACTUAL_2024_LOCUM_COSTS,
            miscEmploymentCosts: storeFy2025?.miscEmploymentCosts ?? ACTUAL_2024_MISC_EMPLOYMENT_COSTS,
            medicalDirectorHours: storeFy2025?.medicalDirectorHours ?? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
            prcsMedicalDirectorHours: storeFy2025?.prcsMedicalDirectorHours ?? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
            consultingServicesAgreement: storeFy2025?.consultingServicesAgreement ?? ACTUAL_2024_CONSULTING_SERVICES,
            prcsDirectorPhysicianId: storeFy2025?.prcsDirectorPhysicianId ?? suszko?.id,
            physicians,
          } as FutureYear
        } else if (dataMode === '2025 Data' && last2025) {
          // Merge store baseline edits from future[2025] for display while remaining read-only
          const storeFy2025 = sc.future.find((f) => f.year === 2025)
          const defaultPhysicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const physicians = storeFy2025?.physicians ?? defaultPhysicians
          const suszko = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            year: 2025,
            therapyIncome: storeFy2025?.therapyIncome ?? last2025.therapyIncome,
            nonEmploymentCosts: storeFy2025?.nonEmploymentCosts ?? last2025.nonEmploymentCosts,
            nonMdEmploymentCosts: storeFy2025?.nonMdEmploymentCosts ?? computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: storeFy2025?.locumCosts ?? DEFAULT_LOCUM_COSTS_2025,
            miscEmploymentCosts: storeFy2025?.miscEmploymentCosts ?? DEFAULT_MISC_EMPLOYMENT_COSTS,
            medicalDirectorHours: storeFy2025?.medicalDirectorHours ?? ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
            prcsMedicalDirectorHours: storeFy2025?.prcsMedicalDirectorHours ?? ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
            consultingServicesAgreement: storeFy2025?.consultingServicesAgreement ?? ACTUAL_2025_CONSULTING_SERVICES,
            prcsDirectorPhysicianId: storeFy2025?.prcsDirectorPhysicianId ?? suszko?.id,
            physicians,
          } as FutureYear
        } else {
          // Fallback
          const physicians = scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          const suszko = physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))
          return {
            year: 2025,
            therapyIncome: last2025?.therapyIncome || 0,
            nonEmploymentCosts: last2025?.nonEmploymentCosts || 0,
            nonMdEmploymentCosts: computeDefaultNonMdEmploymentCosts(2025),
            locumCosts: DEFAULT_LOCUM_COSTS_2025,
            miscEmploymentCosts: DEFAULT_MISC_EMPLOYMENT_COSTS,
            medicalDirectorHours: ACTUAL_2025_MEDICAL_DIRECTOR_HOURS, // 2025 shared medical director amount
            prcsMedicalDirectorHours: ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS, // 2025 PRCS medical director amount (Suszko)
            consultingServicesAgreement: ACTUAL_2025_CONSULTING_SERVICES, // 2025 consulting services amount
            prcsDirectorPhysicianId: suszko?.id, // Assign PRCS to Suszko
            physicians,
          } as FutureYear
        }
      })()
    : (sc.future.find((f) => f.year === year) as FutureYear)
  const partnerComp = usePartnerComp(year, scenario)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Year Navigation Buttons */}
      <div className="year-buttons" style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal', marginBottom: 8, paddingLeft: 8 }}>
        {availableYears.map((yr) => (
          <button
            key={`${scenario}-${yr}`}
            onClick={() => store.setSelectedYear(scenario, yr)}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: sc.selectedYear === yr ? '#f0f4ff' : 'white',
              fontWeight: sc.selectedYear === yr ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {yr === 2025 ? 'Baseline' : yr}
          </button>
        ))}
      </div>
      
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, rowGap: 16, alignItems: 'start', padding: '0 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel-green" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 0, border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Therapy Income</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'therapyIncome', store)
          const currentValue = fy.therapyIncome || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > UI_DEFAULTS.changeThreshold
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
          min={UI_DEFAULTS.therapyIncomeMin}
          max={UI_DEFAULTS.therapyIncomeMax}
          step={UI_DEFAULTS.therapyIncomeStep}
          value={fy.therapyIncome || UI_DEFAULTS.therapyIncomeFallback}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'therapyIncome', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${(((fy.therapyIncome || UI_DEFAULTS.therapyIncomeFallback) - UI_DEFAULTS.therapyIncomeMin) / (UI_DEFAULTS.therapyIncomeMax - UI_DEFAULTS.therapyIncomeMin)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.therapyIncome || UI_DEFAULTS.therapyIncomeFallback))}
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
          onMouseEnter={(e) => createTooltip('income-tooltip', THERAPY_INCOME_GROWTH_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('income-tooltip')}
          onTouchStart={(e) => createTooltip('income-tooltip', THERAPY_INCOME_GROWTH_TOOLTIP, e)}
          onClick={(e) => createTooltip('income-tooltip', THERAPY_INCOME_GROWTH_TOOLTIP, e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>

      {/* Medical Director Hours Section */}
      <div style={{ marginTop: 8, paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Medical Director Hours</div>
      </div>
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '60px 1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1, marginBottom: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          Shared
          <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => {
              const projectionValue = sc.projection.medicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback
              const currentValue = fy.medicalDirectorHours ?? projectionValue
              const isChanged = Math.abs(currentValue - projectionValue) > UI_DEFAULTS.changeThreshold
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
                    fontSize: 10,
                    color: '#6b7280',
                    padding: '1px 2px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                    width: 14,
                    height: 14
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
        <input
          type="range"
          min={0}
          max={UI_DEFAULTS.medicalDirectorHoursMax}
          step={UI_DEFAULTS.medicalDirectorHoursStep}
          value={fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'medicalDirectorHours', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback) / UI_DEFAULTS.medicalDirectorHoursMax) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback))}
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
          onMouseEnter={(e) => createTooltip('medical-director-tooltip', SHARED_MD_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('medical-director-tooltip')}
          onTouchStart={(e) => createTooltip('medical-director-tooltip', SHARED_MD_TOOLTIP, e)}
          onClick={(e) => createTooltip('medical-director-tooltip', SHARED_MD_TOOLTIP, e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>

      {/* PRCS Row */}
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '60px 1fr auto auto', gap: 8, alignItems: 'center', opacity: isReadOnly ? 0.7 : 1, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          PRCS
          <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => {
              const projectionValue = sc.projection.prcsMedicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback
              const currentValue = fy.prcsMedicalDirectorHours ?? projectionValue
              const isChanged = Math.abs(currentValue - projectionValue) > UI_DEFAULTS.changeThreshold
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
                    fontSize: 10,
                    color: '#6b7280',
                    padding: '1px 2px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                    width: 14,
                    height: 14
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
        <input
          type="range"
          min={0}
          max={UI_DEFAULTS.medicalDirectorHoursMax}
          step={UI_DEFAULTS.medicalDirectorHoursStep}
          value={fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'prcsMedicalDirectorHours', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback) / UI_DEFAULTS.medicalDirectorHoursMax) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback))}
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
          onMouseEnter={(e) => createTooltip('prcs-medical-director-tooltip', PRCS_MD_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('prcs-medical-director-tooltip')}
          onTouchStart={(e) => createTooltip('prcs-medical-director-tooltip', PRCS_MD_TOOLTIP, e)}
          onClick={(e) => createTooltip('prcs-medical-director-tooltip', PRCS_MD_TOOLTIP, e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      </div>

      {/* Consulting Services Agreement Section */}
      <div style={{ marginTop: 8, paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Consulting Services Agreement</div>
        {(() => {
          const projectionValue = sc.projection.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION
          const currentValue = fy.consultingServicesAgreement ?? projectionValue
          const isChanged = Math.abs(currentValue - projectionValue) > UI_DEFAULTS.changeThreshold
          return isChanged && !isReadOnly ? (
            <button
              onClick={() => {
                removeTooltip('consulting-services-reset-tooltip')
                store.setFutureValue(scenario, year, 'consultingServicesAgreement', projectionValue)
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
                createTooltip('consulting-services-reset-tooltip', 'Reset to Annual Override Value', e)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
                removeTooltip('consulting-services-reset-tooltip')
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
          max={SLIDER_CONFIGS.consultingServicesAgreement.max}
          step={SLIDER_CONFIGS.consultingServicesAgreement.step}
          value={fy.consultingServicesAgreement ?? sc.projection.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'consultingServicesAgreement', Number(e.target.value))
          }
          disabled={isReadOnly}
          style={{
            width: '100%',
            ['--fill-percent' as any]: `${((fy.consultingServicesAgreement ?? sc.projection.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION) / SLIDER_CONFIGS.consultingServicesAgreement.max) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.consultingServicesAgreement ?? sc.projection.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION))}
          onChange={(e) =>
            store.setFutureValue(scenario, year, 'consultingServicesAgreement', Number(e.target.value.replace(/[^0-9]/g, '')))
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
          onMouseEnter={(e) => createTooltip('consulting-services-tooltip', CONSULTING_SERVICES_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('consulting-services-tooltip')}
          onTouchStart={(e) => createTooltip('consulting-services-tooltip', CONSULTING_SERVICES_TOOLTIP, e)}
          onClick={(e) => createTooltip('consulting-services-tooltip', CONSULTING_SERVICES_TOOLTIP, e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      </div>

      {/* Total Combined Income */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: 13, color: '#374151', paddingRight: 48 }}>
          <span style={{ fontWeight: 500 }}>Total Income:</span>
          <span style={{ fontWeight: 600 }}>
            {currency(((fy.therapyIncome || 0)
              + (fy.medicalDirectorHours ?? sc.projection.medicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback)
              + (((fy.prcsDirectorPhysicianId ?? (year >= 2024 ? (fy.physicians.find(p => p.name === 'Suszko' && (p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'))?.id) : undefined))
                  ? (fy.prcsMedicalDirectorHours ?? sc.projection.prcsMedicalDirectorHours ?? UI_DEFAULTS.medicalDirectorHoursFallback)
                  : 0))
              + (fy.consultingServicesAgreement ?? sc.projection.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION)))}
          </span>
        </div>
      </div>
      </div>

      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 0, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Non-Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonEmploymentCosts', store)
          const currentValue = fy.nonEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > UI_DEFAULTS.changeThreshold
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
          min={UI_DEFAULTS.nonEmploymentCostsMin}
          max={UI_DEFAULTS.nonEmploymentCostsMax}
          step={UI_DEFAULTS.nonEmploymentCostsStep}
          value={fy.nonEmploymentCosts || UI_DEFAULTS.nonEmploymentCostsFallback}
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
            ['--fill-percent' as any]: `${(((fy.nonEmploymentCosts || UI_DEFAULTS.nonEmploymentCostsFallback) - UI_DEFAULTS.nonEmploymentCostsMin) / (UI_DEFAULTS.nonEmploymentCostsMax - UI_DEFAULTS.nonEmploymentCostsMin)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonEmploymentCosts || UI_DEFAULTS.nonEmploymentCostsFallback))}
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
          onMouseEnter={(e) => createTooltip('nonemp-tooltip', NON_EMPLOYMENT_COSTS_GROWTH_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('nonemp-tooltip')}
          onTouchStart={(e) => createTooltip('nonemp-tooltip', NON_EMPLOYMENT_COSTS_GROWTH_TOOLTIP, e)}
          onClick={(e) => createTooltip('nonemp-tooltip', NON_EMPLOYMENT_COSTS_GROWTH_TOOLTIP, e)}
        ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
      </div>
      <div style={{ height: 3 }}></div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 0, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Staff Employment Costs</div>
        {(() => {
          const projectedValue = calculateProjectedValue(scenario, year, 'nonMdEmploymentCosts', store)
          const currentValue = fy.nonMdEmploymentCosts || 0
          const isChanged = projectedValue > 0 && Math.abs(currentValue - projectedValue) > UI_DEFAULTS.changeThreshold
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
          min={UI_DEFAULTS.nonMdEmploymentCostsMin}
          max={UI_DEFAULTS.nonMdEmploymentCostsMax}
          step={UI_DEFAULTS.nonMdEmploymentCostsStep}
          value={fy.nonMdEmploymentCosts || UI_DEFAULTS.nonMdEmploymentCostsFallback}
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
            ['--fill-percent' as any]: `${(((fy.nonMdEmploymentCosts || UI_DEFAULTS.nonMdEmploymentCostsFallback) - UI_DEFAULTS.nonMdEmploymentCostsMin) / (UI_DEFAULTS.nonMdEmploymentCostsMax - UI_DEFAULTS.nonMdEmploymentCostsMin)) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.nonMdEmploymentCosts || UI_DEFAULTS.nonMdEmploymentCostsFallback))}
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
          onMouseEnter={(e) => createTooltip('nonmd-tooltip', STAFF_W2_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('nonmd-tooltip')}
          onTouchStart={(e) => createTooltip('nonmd-tooltip', STAFF_W2_TOOLTIP, e)}
          onClick={(e) => createTooltip('nonmd-tooltip', STAFF_W2_TOOLTIP, e)}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>
      <div style={{ height: 3 }}></div>
      </div>

      <div className="panel-red" style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 0, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
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
          max={UI_DEFAULTS.miscEmploymentCostsMax}
          step={UI_DEFAULTS.miscEmploymentCostsStep}
          value={fy.miscEmploymentCosts || UI_DEFAULTS.miscEmploymentCostsFallback}
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
            ['--fill-percent' as any]: `${((fy.miscEmploymentCosts || UI_DEFAULTS.miscEmploymentCostsFallback) / UI_DEFAULTS.miscEmploymentCostsMax) * 100}%`
          }}
        />
        <input
          type="text"
          value={currency(Math.round(fy.miscEmploymentCosts || UI_DEFAULTS.miscEmploymentCostsFallback))}
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
          onMouseEnter={(e) => createTooltip('misc-tooltip', MISC_EMPLOYMENT_COSTS_TOOLTIP, e)}
          onMouseLeave={() => removeTooltip('misc-tooltip')}
          onTouchStart={(e) => createTooltip('misc-tooltip', MISC_EMPLOYMENT_COSTS_TOOLTIP, e)}
          onClick={(e) => createTooltip('misc-tooltip', MISC_EMPLOYMENT_COSTS_TOOLTIP, e)}
        >
          <span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span>
        </div>
      </div>
      <div style={{ height: 3 }}></div>
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
          } else if (dataMode === '2025 Data') {
            // Reflect baseline edits from store if present
            return fy.physicians
          } else {
            return scenario === 'A' ? scenarioADefaultsByYear(2025) : scenarioBDefaultsByYear(2025)
          }
        })() : undefined}
        locumCosts={fy.locumCosts}
        onLocumCostsChange={(value) => store.setFutureValue(scenario, year, 'locumCosts', value)}
      />

      {partnerComp.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#f3f4f6' }}>
          <div style={{ fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>Partner Compensation</div>
          <div className="panel-purple" style={{ 
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid rgba(126, 34, 206, 0.4)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(126, 34, 206, 0.05), 0 0 10px rgba(126, 34, 206, 0.08), 0 0 6px rgba(126, 34, 206, 0.4)',
            padding: 12, 
            width: 'fit-content', 
            margin: '0 auto' 
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 16, rowGap: 2, paddingRight: (() => {
              // Calculate the maximum width needed for W2 income text
              let maxW2TextWidth = 0
              partnerComp.forEach((p) => {
                const md = fy?.physicians.find((x) => x.id === p.id)
                if (md && md.type === 'employeeToPartner') {
                  const employeePortion = md.employeePortionOfYear ?? 0
                  const w2 = (md.salary ?? 0) * employeePortion
                  const delayedW2 = calculateDelayedW2Payment(md, year)
                  const totalW2 = w2 + delayedW2.amount

                  if (totalW2 > 0) {
                    const w2Text = `(+ ${currency(totalW2)} W2)`
                    // Approximate width: 8px per character (rough estimate for typical fonts)
                    const textWidth = w2Text.length * 8 + 10 // +10px for padding/spacing
                    maxW2TextWidth = Math.max(maxW2TextWidth, textWidth)
                  }
                }
              })
              return maxW2TextWidth
            })() }}>
            {partnerComp.map((p) => (
              <Fragment key={p.id}>
                <div>{p.name}</div>
                <div style={{ textAlign: 'right', position: 'relative', overflow: 'visible' }}>
                  {currency(p.comp)}
                  {(() => {
                    const md = fy?.physicians.find((x) => x.id === p.id)
                    if (md && md.type === 'employeeToPartner') {
                      // Show W2 component as additional for employeeToPartner physicians
                      const employeePortion = md.employeePortionOfYear ?? 0
                      const w2 = (md.salary ?? 0) * employeePortion
                      const delayedW2 = calculateDelayedW2Payment(md, year)
                      const totalW2 = w2 + delayedW2.amount

                      if (totalW2 > 0) {
                        return (
                          <span style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 400 }}>
                            {`(+ ${currency(totalW2)} W2)`}
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
                {currency((() => {
                 // Always use fy data for consistent calculation across all years
                 // fy already includes the merged grid overrides for 2025 read-only mode
                 return getTotalIncome(fy!) - (fy!.nonEmploymentCosts + fy!.nonMdEmploymentCosts + fy!.miscEmploymentCosts + fy!.locumCosts + 
                   fy!.physicians.reduce((s, p) => {
                     if (p.type === 'employee') return s + (p.salary ?? 0)
                     if (p.type === 'newEmployee') return s + (p.salary ?? 0) * getEmployeePortionOfYear(p)
                     if (p.type === 'employeeToPartner') return s + (p.salary ?? 0) * getEmployeePortionOfYear(p)
                     return s
                   }, 0) + 
                   fy!.physicians.reduce((s, p) => s + (p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0), 0) +
                   fy!.physicians.reduce((s, p) => {
                     if (p.type === 'employeeToPartner') {
                       const delayed = calculateDelayedW2Payment(p, year)
                       return s + delayed.amount + delayed.taxes
                     }
                     return s
                   }, 0))
                })())}
              </div>
          </div>
          </div>
        </div>
      )}

    </div>
  )
}