import type { SavedScenario } from '../dashboard/shared/types'
import { 
  isYTDScenario, 
  isMultiYearScenario, 
  isCurrentYearSettingsScenario, 
  isProjectionScenario 
} from '../dashboard/shared/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPenToSquare, faClone, faFolderOpen, faRotate, faStar as faSolidStar } from '@fortawesome/free-solid-svg-icons'
import { faStar as faRegularStar } from '@fortawesome/free-regular-svg-icons'
import { createTooltip, removeTooltip } from '../dashboard/shared/tooltips'

interface ScenarioCardProps {
  scenario: SavedScenario
  onLoad: (id: string, target?: 'A' | 'B') => void
  onClone: (id: string) => void
  onEdit: (scenario: SavedScenario) => void
  onDelete: (id: string) => void
  onUpdateBaseline?: (id: string) => void
  onToggleFavorite?: (id: string, favoriteType: 'A' | 'B' | 'CURRENT') => void
  isOwner: boolean
  viewMode?: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'
}

export default function ScenarioCard({
  scenario,
  onLoad,
  onClone,
  onEdit,
  onDelete,
  onUpdateBaseline,
  onToggleFavorite,
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
    // Check for new modular types first
    if (isCurrentYearSettingsScenario(scenario)) {
      return { label: '⚙️ Current Year Settings', color: '#0369a1', bg: '#dbeafe' }
    }
    if (isProjectionScenario(scenario)) {
      return { label: '📊 Projection', color: '#7c3aed', bg: '#ede9fe' }
    }
    // Legacy types
    if (isYTDScenario(scenario)) {
      return { label: '📊 YTD View (Legacy)', color: '#6b7280', bg: '#f3f4f6' }
    } else {
      return { label: '📈 Multi-Year (Legacy)', color: '#6b7280', bg: '#f3f4f6' }
    }
  }

  const viewModeInfo = getViewModeInfo()
  
  // @ts-expect-error - Unused function kept for future use
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
        background: '#fafafa',
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
              padding: '3px 8px',
              borderRadius: '4px',
              background: scenario.is_public ? '#dbeafe' : '#f3f4f6',
              color: scenario.is_public ? '#0369a1' : '#6b7280',
              fontWeight: 500,
              border: scenario.is_public ? '1px solid #0369a1' : '1px solid #6b7280',
            }}
          >
            {scenario.is_public ? '🌐 Public' : '🔒 Private'}
          </span>

          {/* Favorite stars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Projection scenarios: Show A/B stars */}
            {isProjectionScenario(scenario) && onToggleFavorite && (
              <>
                {/* Star A */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTooltip(`fav-a-${scenario.id}`)
                    onToggleFavorite(scenario.id, 'A')
                  }}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    createTooltip(`fav-a-${scenario.id}`, scenario.is_favorite_a ? 'Remove from Favorite A' : 'Set as Favorite A', e, { placement: 'below-center' })
                  }}
                  onMouseLeave={() => {
                    removeTooltip(`fav-a-${scenario.id}`)
                  }}
                >
                  <FontAwesomeIcon
                    icon={scenario.is_favorite_a ? faSolidStar : faRegularStar}
                    style={{
                      color: '#fbbf24',
                      fontSize: '16px'
                    }}
                  />
                  <sup style={{
                    fontSize: '8px',
                    fontWeight: 'bold',
                    position: 'absolute',
                    top: '-7px',
                    right: '0px',
                    color: '#374151',
                    pointerEvents: 'none'
                  }}>A</sup>
                </div>

                {/* Star B */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTooltip(`fav-b-${scenario.id}`)
                    onToggleFavorite(scenario.id, 'B')
                  }}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    createTooltip(`fav-b-${scenario.id}`, scenario.is_favorite_b ? 'Remove from Favorite B' : 'Set as Favorite B', e, { placement: 'below-center' })
                  }}
                  onMouseLeave={() => {
                    removeTooltip(`fav-b-${scenario.id}`)
                  }}
                >
                  <FontAwesomeIcon
                    icon={scenario.is_favorite_b ? faSolidStar : faRegularStar}
                    style={{
                      color: '#fbbf24',
                      fontSize: '16px'
                    }}
                  />
                  <sup style={{
                    fontSize: '8px',
                    fontWeight: 'bold',
                    position: 'absolute',
                    top: '-7px',
                    right: '0px',
                    color: '#374151',
                    pointerEvents: 'none'
                  }}>B</sup>
                </div>
              </>
            )}

            {/* Current Year scenarios: Show single star */}
            {isCurrentYearSettingsScenario(scenario) && onToggleFavorite && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  removeTooltip(`fav-current-${scenario.id}`)
                  onToggleFavorite(scenario.id, 'CURRENT')
                }}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  createTooltip(`fav-current-${scenario.id}`, scenario.is_favorite_current ? 'Remove from Current Year Favorite' : 'Set as Current Year Favorite', e, { placement: 'below-center' })
                }}
                onMouseLeave={() => {
                  removeTooltip(`fav-current-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon
                  icon={scenario.is_favorite_current ? faSolidStar : faRegularStar}
                  style={{
                    color: '#fbbf24',
                    fontSize: '16px'
                  }}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Scenario type badges on right */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Baseline mode badge for Multi-Year scenarios */}
          {isMultiYearScenario(scenario) && (
            <span
              style={{
                fontSize: '10px',
                padding: '3px 6px',
                borderRadius: '4px',
                background: '#f0f9ff',
                color: '#0369a1',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                border: '1px solid #0369a1',
              }}
            >
              Baseline: {scenario.baseline_mode}
            </span>
          )}

          {/* Scenario type badge */}
          <span
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '4px',
              background: viewModeInfo.bg,
              color: viewModeInfo.color,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: '1px solid ' + viewModeInfo.color,
            }}
          >
            {viewModeInfo.label}
          </span>
        </div>
      </div>

      {/* Description */}
      {scenario.description && (
        <p style={{ textAlign: 'left', margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
          {scenario.description}
        </p>
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
                onClick={() => {
                  removeTooltip(`delete-${scenario.id}`)
                  onDelete(scenario.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: 20,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  padding: 2,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  createTooltip(`delete-${scenario.id}`, 'Delete scenario', e, { placement: 'below-center' })
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                  removeTooltip(`delete-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <button
                onClick={() => {
                  removeTooltip(`edit-${scenario.id}`)
                  onEdit(scenario)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: 20,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  padding: 2,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  createTooltip(`edit-${scenario.id}`, 'Edit scenario', e, { placement: 'below-center' })
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                  removeTooltip(`edit-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
              {/* Show Update Baseline button for stale Multi-Year scenarios with 2025 Data */}
              {onUpdateBaseline && isMultiYearScenario(scenario) && scenario.baseline_mode === '2025 Data' && daysSinceBaseline > 7 && (
                <button
                  onClick={() => {
                    removeTooltip(`update-${scenario.id}`)
                    onUpdateBaseline(scenario.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: 20,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    padding: 2,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.7'
                    createTooltip(`update-${scenario.id}`, 'Update this scenario with the latest 2025 data', e, { placement: 'below-center' })
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                    removeTooltip(`update-${scenario.id}`)
                  }}
                >
                  <FontAwesomeIcon icon={faRotate} />
                </button>
              )}
            </>
          )}
          
          {/* Clone button */}
          <button
            onClick={() => {
              removeTooltip(`clone-${scenario.id}`)
              onClone(scenario.id)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0ea5e9',
              fontSize: 20,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              padding: 2,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7'
              createTooltip(`clone-${scenario.id}`, 'Duplicate scenario', e, { placement: 'below-center' })
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              removeTooltip(`clone-${scenario.id}`)
            }}
          >
            <FontAwesomeIcon icon={faClone} />
          </button>

          {/* Load buttons */}
          {viewMode === 'Multi-Year' && isMultiYearScenario(scenario) ? (
            <>
              <button
                onClick={() => {
                  removeTooltip(`load-b-${scenario.id}`)
                  onLoad(scenario.id, 'B')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  fontSize: 20,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  createTooltip(`load-b-${scenario.id}`, 'Load scenario into B', e, { placement: 'below-center' })
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                  removeTooltip(`load-b-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon icon={faFolderOpen} style={{ transform: 'translateY(3px)' }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>B</span>
              </button>
              <button
                onClick={() => {
                  removeTooltip(`load-a-${scenario.id}`)
                  onLoad(scenario.id, 'A')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  fontSize: 20,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                  createTooltip(`load-a-${scenario.id}`, 'Load scenario into A', e, { placement: 'below-center' })
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                  removeTooltip(`load-a-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon icon={faFolderOpen} style={{ transform: 'translateY(3px)' }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>A</span>
              </button>
            </>
          ) : (() => {
            // In YTD Detailed view, only allow loading Current Year Settings scenarios
            const isLoadable = viewMode !== 'YTD Detailed' || isCurrentYearSettingsScenario(scenario)
            return (
              <button
                onClick={() => {
                  removeTooltip(`load-${scenario.id}`)
                  if (isLoadable) {
                    onLoad(scenario.id)
                  }
                }}
                disabled={!isLoadable}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLoadable ? '#0ea5e9' : '#d1d5db',
                  fontSize: 20,
                  cursor: isLoadable ? 'pointer' : 'not-allowed',
                  transition: isLoadable ? 'opacity 0.2s' : 'none',
                  padding: 2,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (isLoadable) {
                    e.currentTarget.style.opacity = '0.7'
                  }
                  createTooltip(`load-${scenario.id}`, isLoadable ? "Load scenario" : "Load from Multi-Year View", e, { placement: 'below-center' })
                }}
                onMouseLeave={(e) => {
                  if (isLoadable) {
                    e.currentTarget.style.opacity = '1'
                  }
                  removeTooltip(`load-${scenario.id}`)
                }}
              >
                <FontAwesomeIcon icon={faFolderOpen} style={{ transform: 'translateY(3px)' }} />
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

