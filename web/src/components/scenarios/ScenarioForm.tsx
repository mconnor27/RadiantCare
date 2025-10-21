import { useState } from 'react'
import type { SavedScenario } from '../dashboard/shared/types'

interface ScenarioFormProps {
  existingScenario?: SavedScenario
  onSave: (name: string, description: string, isPublic: boolean) => Promise<void>
  onCancel: () => void
  isClone?: boolean
}

export default function ScenarioForm({ existingScenario, onSave, onCancel, isClone = false }: ScenarioFormProps) {
  const [name, setName] = useState(existingScenario?.name || '')
  const [description, setDescription] = useState(existingScenario?.description || '')
  const [isPublic, setIsPublic] = useState(existingScenario?.is_public || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      await onSave(name, description, isPublic)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scenario')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 600 }}>
        {existingScenario ? 'Edit Scenario' : 'Save Current Scenario'}
      </h2>

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="scenario-name"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#333',
          }}
        >
          Scenario Name *
        </label>
        <input
          id="scenario-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., Conservative Growth 2025-2030"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="scenario-description"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#333',
          }}
        >
          Description
        </label>
        <textarea
          id="scenario-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this scenario..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
            Make this scenario public (visible to all users)
          </span>
        </label>
      </div>

      {error && (
        <div
          style={{
            padding: '12px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '8px 16px',
            background: '#fff',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{
            padding: '8px 16px',
            background: saving || !name.trim() ? '#94a3b8' : '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : (existingScenario && !isClone) ? 'Update Scenario' : 'Save Scenario'}
        </button>
      </div>
    </form>
  )
}

