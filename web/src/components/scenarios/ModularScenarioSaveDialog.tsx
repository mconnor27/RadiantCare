import { useState } from 'react'

interface ModularScenarioSaveDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (saveType: 'current_year' | 'projection' | 'both', name: string, description: string, isPublic: boolean) => Promise<void>
  baselineMode: '2024 Data' | '2025 Data' | 'Custom'
  forceCurrentYearOnly?: boolean // Force saving as Current Year Settings only (YTD view)
}

export default function ModularScenarioSaveDialog({
  isOpen,
  onClose,
  onSave,
  baselineMode,
  forceCurrentYearOnly = false
}: ModularScenarioSaveDialogProps) {
  const [saveType, setSaveType] = useState<'current_year' | 'projection' | 'both'>(
    forceCurrentYearOnly ? 'current_year' : (baselineMode === '2025 Data' ? 'both' : 'projection')
  )
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      await onSave(saveType, name.trim(), description.trim(), isPublic)
      // Reset form
      setName('')
      setDescription('')
      setIsPublic(false)
      setSaveType(forceCurrentYearOnly ? 'current_year' : (baselineMode === '2025 Data' ? 'both' : 'projection'))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, textAlign: 'left' }}>
          Save Scenario
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Save Type Selection - only show if baseline mode is 2025 AND not forced to current year only */}
          {baselineMode === '2025 Data' && !forceCurrentYearOnly && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, textAlign: 'left' }}>
                What do you want to save?
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    border: saveType === 'projection' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: saveType === 'projection' ? '#eff6ff' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    value="projection"
                    checked={saveType === 'projection'}
                    onChange={(e) => setSaveType(e.target.value as any)}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>Projection only</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      Saves growth rates and 2026-2035 settings. Can be loaded on top of any Current Year Setting.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    border: saveType === 'both' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: saveType === 'both' ? '#eff6ff' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    value="both"
                    checked={saveType === 'both'}
                    onChange={(e) => setSaveType(e.target.value as any)}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>Projection + Current Year Settings</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      Saves two separate scenarios:
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                        <li>Current Year Setting (2025 baseline)</li>
                        <li>Projection (2026-2035)</li>
                      </ul>
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    border: saveType === 'current_year' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: saveType === 'current_year' ? '#eff6ff' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    value="current_year"
                    checked={saveType === 'current_year'}
                    onChange={(e) => setSaveType(e.target.value as any)}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>Current Year Settings only</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      Saves only the 2025 baseline (physicians, grid overrides).
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* For 2024/Custom modes, no choice - always save projection */}
          {baselineMode !== '2025 Data' && (
            <div style={{ marginBottom: 20, padding: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6 }}>
              <div style={{ fontWeight: 500, color: '#92400e' }}>Saving Projection</div>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
                This will save the projection with its {baselineMode} baseline.
              </div>
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, textAlign: 'left' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Conservative Growth"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
              }}
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, textAlign: 'left' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                resize: 'vertical',
              }}
              disabled={isSaving}
            />
          </div>

          {/* Public checkbox */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isSaving}
              />
              <span style={{ fontSize: 14 }}>Make public (visible to all users)</span>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div style={{ marginBottom: 16, padding: 12, background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 6, color: '#991b1b', fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: 'white',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: isSaving || !name.trim() ? '#d1d5db' : '#3b82f6',
                color: 'white',
                cursor: isSaving || !name.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


