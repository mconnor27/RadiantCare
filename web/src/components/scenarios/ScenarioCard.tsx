import type { SavedScenario } from '../dashboard/shared/types'

interface ScenarioCardProps {
  scenario: SavedScenario
  onLoad: (id: string) => void
  onClone: (id: string) => void
  onEdit: (scenario: SavedScenario) => void
  onDelete: (id: string) => void
  onUpdateBaseline?: (id: string) => void
  isOwner: boolean
}

export default function ScenarioCard({
  scenario,
  onLoad,
  onClone,
  onEdit,
  onDelete,
  onUpdateBaseline,
  isOwner,
}: ScenarioCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getScenarioTypeLabel = () => {
    switch (scenario.scenario_type) {
      case 'historical-projection':
        return { label: '📅 Historical Analysis', color: '#9333ea', bg: '#f3e8ff' }
      case 'ytd-analysis':
        return { label: '📊 YTD Analysis', color: '#0369a1', bg: '#e0f2fe' }
      case 'forward-projection':
        return { label: '📈 Forward Projection', color: '#15803d', bg: '#dcfce7' }
      default:
        return { label: '📊 Scenario', color: '#6b7280', bg: '#f3f4f6' }
    }
  }

  const typeInfo = getScenarioTypeLabel()
  
  const formatBaselineDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Check if baseline data is potentially stale (for 2025 scenarios)
  const isStale = scenario.scenario_type !== 'historical-projection' && 
                  scenario.baseline_mode === '2025 Data' &&
                  scenario.baseline_date
  
  const daysSinceBaseline = isStale && scenario.baseline_date ? 
    Math.floor((Date.now() - new Date(scenario.baseline_date).getTime()) / 86400000) : 0

  return (
    <div
      style={{
        padding: '16px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        marginBottom: '12px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
        e.currentTarget.style.borderColor = '#0ea5e9'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#e5e7eb'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111' }}>
              {scenario.name}
            </h3>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: scenario.is_public ? '#dbeafe' : '#f3f4f6',
                color: scenario.is_public ? '#0369a1' : '#6b7280',
                fontWeight: 500,
              }}
            >
              {scenario.is_public ? '🌐 Public' : '🔒 Private'}
            </span>
          </div>
          
          {/* Scenario type and baseline metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 10px',
                borderRadius: '4px',
                background: typeInfo.bg,
                color: typeInfo.color,
                fontWeight: 500,
              }}
            >
              {typeInfo.label}
            </span>
            {scenario.baseline_mode && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                • {scenario.baseline_mode}
              </span>
            )}
            {scenario.baseline_date && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                ({formatBaselineDate(scenario.baseline_date)})
              </span>
            )}
          </div>
          
          {/* Staleness warning */}
          {isStale && daysSinceBaseline > 7 && (
            <div style={{ 
              fontSize: '12px', 
              color: '#d97706', 
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠️ Baseline is {daysSinceBaseline} days old • Consider updating
            </div>
          )}
          
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            Last edited: {formatDate(scenario.updated_at)}
            {scenario.creator_email && ` • by ${scenario.creator_email}`}
          </div>
        </div>
      </div>

      {scenario.description && (
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>
          {scenario.description}
        </p>
      )}

      {scenario.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {scenario.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#ede9fe',
                color: '#6d28d9',
              }}
            >
              🏷️ {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => onLoad(scenario.id)}
          style={{
            padding: '6px 12px',
            background: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Load
        </button>
        <button
          onClick={() => onClone(scenario.id)}
          style={{
            padding: '6px 12px',
            background: '#fff',
            color: '#0ea5e9',
            border: '1px solid #0ea5e9',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Clone
        </button>
        {isOwner && (
          <>
            {/* Show Update Baseline button for 2025 scenarios */}
            {onUpdateBaseline && scenario.baseline_mode === '2025 Data' && (
              <button
                onClick={() => onUpdateBaseline(scenario.id)}
                style={{
                  padding: '6px 12px',
                  background: '#fff',
                  color: '#059669',
                  border: '1px solid #059669',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                title="Update this scenario with the latest 2025 data"
              >
                🔄 Update Data
              </button>
            )}
            <button
              onClick={() => onEdit(scenario)}
              style={{
                padding: '6px 12px',
                background: '#fff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(scenario.id)}
              style={{
                padding: '6px 12px',
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #dc2626',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

