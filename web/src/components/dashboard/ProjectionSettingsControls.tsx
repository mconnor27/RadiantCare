import { useDashboardStore } from '../Dashboard'
import { useIsMobile } from './hooks'
import { createTooltip, removeTooltip } from './tooltips'
import { currency } from './utils'
import type { ScenarioKey, Projection } from './types'
import { PROJECTION_DEFAULTS, SLIDER_CONFIGS, UI_DEFAULTS, SHARED_MD_TOOLTIP, PRCS_MD_TOOLTIP_SHORT } from './defaults'

export default function ProjectionSettingsControls({ scenario }: { scenario: ScenarioKey }) {
  const store = useDashboardStore()
  const sc = scenario === 'A' ? store.scenarioA : store.scenarioB
  const isMobile = useIsMobile()

  if (!sc) return null

  // Default values for reset functionality
  const defaultValues = PROJECTION_DEFAULTS[scenario]

  // Helper function to create a slider with number input and reset button
  const createSlider = (
    label: string,
    field: keyof Projection,
    value: number,
    min: number,
    max: number,
    step: number,
    suffix: string = '%',
    isDollar: boolean = false,
    glowType: 'income' | 'cost' = 'cost',
    resetTooltip: string = 'Reset to 2016-2024 Trend',
    bare: boolean = false
  ) => {
    const defaultValue = defaultValues[field]
    const isChanged = Math.abs(value - defaultValue) > UI_DEFAULTS.floatingPointTolerance

    const wrapperStyle = bare
      ? { 
          padding: (field === 'nonMdEmploymentCostsPct' || field === 'benefitCostsGrowthPct') ? '0 0 0 4px' : 0, 
          backgroundColor: 'transparent', 
          borderRadius: 0, 
          border: 'none', 
          boxShadow: 'none' as any 
        }
      : {
      padding: 8,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      border: glowType === 'income'
        ? '1px solid rgba(16, 185, 129, 0.4)'
        : '1px solid rgba(239, 68, 68, 0.4)',
      boxShadow: glowType === 'income'
        ? '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)'
        : '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)'
        }

    if (bare) {
      return (
        <div style={wrapperStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: `${isMobile ? '96px' : '50px'} 19px 1fr auto ${(field === 'nonMdEmploymentCostsPct' || field === 'benefitCostsGrowthPct') ? '12px' : '24px'}`, alignItems: 'center', gap: (field === 'nonMdEmploymentCostsPct' || field === 'benefitCostsGrowthPct') ? 0 : 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', justifyContent: 'flex-end' }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              {isChanged && (
                <button
                  onClick={() => {
                    removeTooltip('reset-tooltip')
                    store.setProjectionField(scenario, field, defaultValues[field])
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
                    createTooltip('reset-tooltip', 'Reset to Default', e)
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.7'
                    removeTooltip('reset-tooltip')
                  }}
                >
                  ↺
                </button>
              )}
            </div>

            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 28 }}>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => {
                  store.setProjectionField(scenario, field, Number(e.target.value))
                }}
                style={{
                  width: '100%', margin: 0,
                  ['--fill-start' as any]: value >= 0 ? `${((0 - min) / (max - min)) * 100}%` : `${((value - min) / (max - min)) * 100}%`,
                  ['--fill-end' as any]: value >= 0 ? `${((value - min) / (max - min)) * 100}%` : `${((0 - min) / (max - min)) * 100}%`,
                }}
                className="growth-slider"
              />
              {suffix === '%' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${((0 - min) / (max - min)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '2px',
                  height: '8px',
                  backgroundColor: '#374151',
                  pointerEvents: 'none'
                }} />
              )}
            </div>

            {isDollar ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 88 : 100, height: 21 }}>
                <input
                  type="text"
                  value={currency(value)}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/[$,]/g, '')
                    const parsed = Number(numericValue)
                    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
                      store.setProjectionField(scenario, field, parsed)
                    }
                  }}
                  onBlur={(e) => {
                    const numericValue = e.target.value.replace(/[$,]/g, '')
                    const parsed = Number(numericValue)
                    if (isNaN(parsed) || parsed < min || parsed > max) {
                      store.setProjectionField(scenario, field, Math.max(min, Math.min(max, parsed || 0)))
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 21,
                    padding: '2px 18px 2px 4px',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    fontSize: 14
                  }}
                  readOnly={true}
                />
                <div style={{
                  position: 'absolute',
                  right: 1,
                  top: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 19
                }}>
                  <button
                    onClick={() => {
                      const newValue = Math.min(max, value + step)
                      store.setProjectionField(scenario, field, newValue)
                    }}
                    style={{
                      width: 16,
                      height: 9.5,
                      border: '1px solid #ccc',
                      borderBottom: 'none',
                      borderRadius: '2px 2px 0 0',
                      background: '#f8f9fa',
                      cursor: 'pointer',
                      fontSize: 8,
                      lineHeight: '8px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    title="Increase value"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => {
                      const newValue = Math.max(min, value - step)
                      store.setProjectionField(scenario, field, newValue)
                    }}
                    style={{
                      width: 16,
                      height: 9.5,
                      border: '1px solid #ccc',
                      borderRadius: '0 0 2px 2px',
                      background: '#f8f9fa',
                      cursor: 'pointer',
                      fontSize: 8,
                      lineHeight: '8px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    title="Decrease value"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ) : (
              // For bare sliders without info icons (like Staff Employment), show text input
              // For bare sliders with info icons (like Medical Director), show just the suffix
              (field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') ? (
                <span style={{ fontSize: 14, color: '#666' }}>{suffix}</span>
              ) : (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 60 : 70, height: 21 }}>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => {
                      store.setProjectionField(scenario, field, Number(e.target.value))
                    }}
                    style={{
                      width: '100%',
                      height: 21,
                      padding: '2px 18px 2px 4px',
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      fontSize: 14
                    }}
                    readOnly={true}
                  />
                  <div style={{
                    position: 'absolute',
                    right: 1,
                    top: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: 19
                  }}>
                    <button
                      onClick={() => {
                        const newValue = Math.min(max, value + step)
                        store.setProjectionField(scenario, field, newValue)
                      }}
                      style={{
                        width: 16,
                        height: 9.5,
                        border: '1px solid #ccc',
                        borderBottom: 'none',
                        borderRadius: '2px 2px 0 0',
                        background: '#f8f9fa',
                        cursor: 'pointer',
                        fontSize: 8,
                        lineHeight: '8px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Increase value"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => {
                        const newValue = Math.max(min, value - step)
                        store.setProjectionField(scenario, field, newValue)
                      }}
                      style={{
                        width: 16,
                        height: 9.5,
                        border: '1px solid #ccc',
                        borderRadius: '0 0 2px 2px',
                        background: '#f8f9fa',
                        cursor: 'pointer',
                        fontSize: 8,
                        lineHeight: '8px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Decrease value"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Only show suffix for non-dollar, non-medical-director fields */}
            {!isDollar && !(field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') && (
              <span style={{ fontSize: 14, color: '#666', minWidth: 12 }}>
                {suffix}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
                  onMouseEnter={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
                  onMouseLeave={() => removeTooltip('md-projection-tooltip')}
                  onTouchStart={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
                  onClick={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
                ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
    <div className={bare ? undefined : (glowType === 'income' ? 'panel-green' : 'panel-red')} style={wrapperStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: bare ? 2 : 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>
        {(field === 'medicalDirectorHours' || field === 'prcsMedicalDirectorHours') && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#666', width: '20px', height: '20px', border: '1px solid #ccc', borderRadius: '50%', backgroundColor: '#f8f9fa' }}
            onMouseEnter={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
            onMouseLeave={() => removeTooltip('md-projection-tooltip')}
            onTouchStart={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
            onClick={(e) => createTooltip('md-projection-tooltip', field === 'medicalDirectorHours' ? SHARED_MD_TOOLTIP : PRCS_MD_TOOLTIP_SHORT, e)}
          ><span style={{ transform: 'translateY(-0.5px)', display: 'inline-block' }}>ℹ</span></div>
        )}
        {isChanged && (
          <button
            onClick={() => {
              removeTooltip('reset-tooltip')
              store.setProjectionField(scenario, field, defaultValues[field])
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
              createTooltip('reset-tooltip', resetTooltip, e)
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              removeTooltip('reset-tooltip')
            }}
          >
            ↺
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: bare ? 28 : 32 }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              store.setProjectionField(scenario, field, Number(e.target.value))
            }}
            style={{
              width: '100%', margin: 0,
              ['--fill-start' as any]: value >= 0 ? `${((0 - min) / (max - min)) * 100}%` : `${((value - min) / (max - min)) * 100}%`,
              ['--fill-end' as any]: value >= 0 ? `${((value - min) / (max - min)) * 100}%` : `${((0 - min) / (max - min)) * 100}%`,
            }}
            className="growth-slider"
          />
          {suffix === '%' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${((0 - min) / (max - min)) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '8px',
              backgroundColor: '#374151',
              pointerEvents: 'none'
            }} />
          )}
        </div>
        {isDollar ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 100 : 120, height: bare ? 21 : 23 }}>
            <input
              type="text"
              value={currency(value)}
              onChange={(e) => {
                // Parse currency input - remove $ and commas
                const numericValue = e.target.value.replace(/[$,]/g, '')
                const parsed = Number(numericValue)
                if (!isNaN(parsed) && parsed >= min && parsed <= max) {
                  store.setProjectionField(scenario, field, parsed)
                }
              }}
              onBlur={(e) => {
                // Ensure valid value on blur
                const numericValue = e.target.value.replace(/[$,]/g, '')
                const parsed = Number(numericValue)
                if (isNaN(parsed) || parsed < min || parsed > max) {
                  store.setProjectionField(scenario, field, Math.max(min, Math.min(max, parsed || 0)))
                }
              }}
              style={{
                width: '100%',
                height: 23,
                padding: '2px 18px 2px 4px',
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 14
              }}
              readOnly={true}
            />
            <div style={{
              position: 'absolute',
              right: 1,
              top: 1,
              display: 'flex',
              flexDirection: 'column',
              height: 21
            }}>
              <button
                onClick={() => {
                  const increment = step >= 1 ? step : UI_DEFAULTS.therapyIncomeStep
                  const newValue = Math.min(max, value + increment)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderBottom: 'none',
                  borderRadius: '2px 2px 0 0',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Increase value"
              >
                ▲
              </button>
              <button
                onClick={() => {
                  const decrement = step >= 1 ? step : UI_DEFAULTS.therapyIncomeStep
                  const newValue = Math.max(min, value - decrement)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderRadius: '0 0 2px 2px',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Decrease value"
              >
                ▼
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? 60 : 70, height: 23 }}>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => {
                store.setProjectionField(scenario, field, Number(e.target.value))
              }}
              style={{
                width: '100%',
                height: 23,
                padding: '2px 18px 2px 4px',
                border: '1px solid #ccc',
                borderRadius: 3,
                fontSize: 14
              }}
              readOnly={true}
            />
            <div style={{
              position: 'absolute',
              right: 1,
              top: 1,
              display: 'flex',
              flexDirection: 'column',
              height: 21
            }}>
              <button
                onClick={() => {
                  const newValue = Math.min(max, value + step)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderBottom: 'none',
                  borderRadius: '2px 2px 0 0',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Increase value"
              >
                ▲
              </button>
              <button
                onClick={() => {
                  const newValue = Math.max(min, value - step)
                  store.setProjectionField(scenario, field, newValue)
                }}
                style={{
                  width: 16,
                  height: 10.5,
                  border: '1px solid #ccc',
                  borderRadius: '0 0 2px 2px',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: 8,
                  lineHeight: '8px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title="Decrease value"
              >
                ▼
              </button>
            </div>
          </div>
        )}
        <span style={{ fontSize: 14, color: '#666', minWidth: isDollar ? 0 : 12 }}>
          {isDollar ? '' : suffix}
        </span>
      </div>
    </div>
    )
  }

  return (
    <div style={{ marginBottom: 12, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Projection Settings</div>
        <button
          onClick={() => {
            removeTooltip('reset-all-tooltip')
            Object.keys(defaultValues).forEach((field) => {
              store.setProjectionField(scenario, field as keyof Projection, defaultValues[field as keyof typeof defaultValues])
            })
          }}
          style={{
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            color: '#6b7280',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            opacity: 0.8,
            transition: 'opacity 0.2s, background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.backgroundColor = '#f3f4f6'
            createTooltip('reset-all-tooltip', 'Reset All to 2016-2024 Trend', e)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.8'
            e.currentTarget.style.backgroundColor = '#ffffff'
            removeTooltip('reset-all-tooltip')
          }}
        >
          ↺ Reset All
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
        {/* First Column - Income Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {createSlider('Therapy Income Growth', 'incomeGrowthPct', sc.projection.incomeGrowthPct ?? 3.7, -10, 20, 0.1, '%', false, 'income')}

          <div className={'panel-green'} style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(16, 185, 129, 0.05), 0 0 10px rgba(16, 185, 129, 0.08), 0 0 6px rgba(16, 185, 129, 0.4)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textAlign: 'left' }}>Medical Director Hours (Annual Overrides)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
              {createSlider('Shared', 'medicalDirectorHours', sc.projection.medicalDirectorHours ?? PROJECTION_DEFAULTS[scenario].medicalDirectorHours, SLIDER_CONFIGS.medicalDirectorHours.min, SLIDER_CONFIGS.medicalDirectorHours.max, SLIDER_CONFIGS.medicalDirectorHours.step, '', true, 'income', 'Reset to Default', true)}
              {createSlider('PRCS', 'prcsMedicalDirectorHours', sc.projection.prcsMedicalDirectorHours ?? PROJECTION_DEFAULTS[scenario].prcsMedicalDirectorHours, SLIDER_CONFIGS.prcsMedicalDirectorHours.min, SLIDER_CONFIGS.prcsMedicalDirectorHours.max, SLIDER_CONFIGS.prcsMedicalDirectorHours.step, '', true, 'income', 'Reset to Default', true)}
            </div>
          </div>

          {createSlider('Consulting Services Agreement (Annual Override)', 'consultingServicesAgreement', sc.projection.consultingServicesAgreement ?? PROJECTION_DEFAULTS[scenario].consultingServicesAgreement, SLIDER_CONFIGS.consultingServicesAgreement.min, SLIDER_CONFIGS.consultingServicesAgreement.max, SLIDER_CONFIGS.consultingServicesAgreement.step, '', true, 'income', 'Reset to Default')}
        </div>

        {/* Second Column - Cost Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {createSlider('Non-Employment Costs Growth', 'nonEmploymentCostsPct', sc.projection.nonEmploymentCostsPct ?? 7.8, -10, 20, 0.1, '%', false, 'cost')}

          <div className={'panel-red'} style={{ padding: 8, backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(239, 68, 68, 0.05), 0 0 10px rgba(239, 68, 68, 0.08), 0 0 6px rgba(239, 68, 68, 0.4)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textAlign: 'left' }}>Staff Employment Costs Growth</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
              {createSlider('Salary', 'nonMdEmploymentCostsPct', sc.projection.nonMdEmploymentCostsPct ?? 6.0, -10, 20, 0.1, '%', false, 'cost', 'Reset to Default', true)}
              {createSlider('Benefits', 'benefitCostsGrowthPct', sc.projection.benefitCostsGrowthPct ?? 5.0, -10, 20, 0.1, '%', false, 'cost', 'Reset to Default', true)}
            </div>
          </div>

          {createSlider('Misc Employment Costs Growth', 'miscEmploymentCostsPct', sc.projection.miscEmploymentCostsPct ?? 6.7, -10, 20, 0.1, '%', false, 'cost')}
        </div>
      </div>

      {/* Locums Panel - Full Width */}
      <div style={{ marginTop: 16 }}>
        {createSlider('Locums Costs (Annual Override)', 'locumsCosts', sc.projection.locumsCosts ?? PROJECTION_DEFAULTS[scenario].locumsCosts, SLIDER_CONFIGS.locumsCosts.min, SLIDER_CONFIGS.locumsCosts.max, SLIDER_CONFIGS.locumsCosts.step, '', true, 'cost', 'Reset to Default')}
      </div>
    </div>
  )
}