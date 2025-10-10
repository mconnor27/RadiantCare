import type { SavedScenario } from '../dashboard/shared/types'
import { isYTDScenario, isMultiYearScenario } from '../dashboard/shared/types'

interface ScenarioCardProps {
  scenario: SavedScenario
  onLoad: (id: string, target?: 'A' | 'B') => void
  onClone: (id: string) => void
  onEdit: (scenario: SavedScenario) => void
  onDelete: (id: string) => void
  onUpdateBaseline?: (id: string) => void
  isOwner: boolean
  viewMode?: 'YTD Detailed' | 'Multi-Year'
}

export default function ScenarioCard({
  scenario,
  onLoad,
  onClone,
  onEdit,
  onDelete,
  onUpdateBaseline,
  isOwner,
  viewMode = 'Multi-Year',
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

  // Get view mode badge info
  const getViewModeInfo = () => {
    if (isYTDScenario(scenario)) {
      return { label: '📊 YTD View', color: '#0369a1', bg: '#e0f2fe' }
    } else {
      return { label: '📈 Multi-Year', color: '#15803d', bg: '#dcfce7' }
    }
  }

  const viewModeInfo = getViewModeInfo()
  
  const formatBaselineDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Check if baseline data is potentially stale (only for Multi-Year scenarios with 2025 Data)
  const isStale = isMultiYearScenario(scenario) && 
                  scenario.baseline_mode === '2025 Data' &&
                  scenario.baseline_date
  
  const daysSinceBaseline = isStale && scenario.baseline_date ? 
    Math.floor((Date.now() - new Date(scenario.baseline_date).getTime()) / 86400000) : 0

  return (
    <div
      style={{
        padding: '12px',
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
      {/* Header: Title + Public/Private (left) | Scenario Type (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111' }}>
            {scenario.name}
          </h3>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '3px',
              background: scenario.is_public ? '#dbeafe' : '#f3f4f6',
              color: scenario.is_public ? '#0369a1' : '#6b7280',
              fontWeight: 500,
            }}
          >
            {scenario.is_public ? '🌐 Public' : '🔒 Private'}
          </span>
        </div>
        
        {/* Scenario type badge on right */}
        <span
          style={{
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: '4px',
            background: viewModeInfo.bg,
            color: viewModeInfo.color,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {viewModeInfo.label}
        </span>
      </div>

      {/* Description */}
      {scenario.description && (
        <p style={{ textAlign: 'left', margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280', lineHeight: 1.4 }}>
          {scenario.description}
        </p>
      )}

      {/* Baseline metadata (for Multi-Year) */}
      {isMultiYearScenario(scenario) && scenario.baseline_mode && (
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
          {scenario.baseline_mode}
          {scenario.baseline_date && ` • ${formatBaselineDate(scenario.baseline_date)}`}
        </div>
      )}

      {/* Staleness warning */}
      {isStale && daysSinceBaseline > 7 && (
        <div style={{ 
          fontSize: '11px', 
          color: '#d97706', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ⚠️ Baseline is {daysSinceBaseline} days old
        </div>
      )}

      {/* Footer: Timestamps (left) | Buttons (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px' }}>
        {/* Left: Timestamps */}
        <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
          <div>Created: {formatDate(scenario.created_at)}</div>
          {/*<div>
            Last edited: {formatDate(scenario.updated_at)}
          </div>*/}
        </div>

        {/* Right: Buttons (reversed order) */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Owner buttons (Delete, Edit, Update Data) */}
          {isOwner && (
            <>
              <button
                onClick={() => onDelete(scenario.id)}
                style={{
                  padding: '5px 10px',
                  background: '#fff',
                  color: '#dc2626',
                  border: '1px solid #dc2626',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => onEdit(scenario)}
                style={{
                  padding: '5px 10px',
                  background: '#fff',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              {/* Show Update Baseline button for Multi-Year scenarios with 2025 Data */}
              {onUpdateBaseline && isMultiYearScenario(scenario) && scenario.baseline_mode === '2025 Data' && (
                <button
                  onClick={() => onUpdateBaseline(scenario.id)}
                  style={{
                    padding: '5px 10px',
                    background: '#fff',
                    color: '#059669',
                    border: '1px solid #059669',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  title="Update this scenario with the latest 2025 data"
                >
                  🔄 Update
                </button>
              )}
            </>
          )}
          
          {/* Clone button */}
          <button
            onClick={() => onClone(scenario.id)}
            style={{
              padding: '5px 10px',
              background: '#fff',
              color: '#0ea5e9',
              border: '1px solid #0ea5e9',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Clone
          </button>

          {/* Load buttons */}
          {viewMode === 'Multi-Year' && isMultiYearScenario(scenario) ? (
            <>
              <button
                onClick={() => onLoad(scenario.id, 'B')}
                style={{
                  padding: '5px 10px',
                  background: '#fff',
                  color: '#0ea5e9',
                  border: '1px solid #0ea5e9',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Load into B
              </button>
              <button
                onClick={() => onLoad(scenario.id, 'A')}
                style={{
                  padding: '5px 10px',
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Load into A
              </button>
            </>
          ) : (
            <button
              onClick={() => onLoad(scenario.id)}
              style={{
                padding: '5px 10px',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Load
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

