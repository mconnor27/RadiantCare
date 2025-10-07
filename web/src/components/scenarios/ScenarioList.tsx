import { useState, useMemo } from 'react'
import type { SavedScenario } from '../dashboard/shared/types'
import ScenarioCard from './ScenarioCard'

interface ScenarioListProps {
  scenarios: SavedScenario[]
  currentUserId?: string
  onLoad: (id: string) => void
  onClone: (id: string) => void
  onEdit: (scenario: SavedScenario) => void
  onDelete: (id: string) => void
  loading?: boolean
}

export default function ScenarioList({
  scenarios,
  currentUserId,
  onLoad,
  onClone,
  onEdit,
  onDelete,
  loading = false,
}: ScenarioListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  // Get all unique tags from scenarios
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    scenarios.forEach((s) => s.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [scenarios])

  // Filter scenarios based on search and tag
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      const matchesSearch =
        !searchQuery ||
        scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scenario.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTag = !tagFilter || scenario.tags.includes(tagFilter)

      return matchesSearch && matchesTag
    })
  }, [scenarios, searchQuery, tagFilter])

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        Loading scenarios...
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ minWidth: '150px' }}>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                🏷️ {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredScenarios.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px',
          }}
        >
          {scenarios.length === 0 ? (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <div>No scenarios yet. Save your first scenario to get started!</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <div>No scenarios match your search.</div>
            </>
          )}
        </div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
          {filteredScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onLoad={onLoad}
              onClone={onClone}
              onEdit={onEdit}
              onDelete={onDelete}
              isOwner={scenario.user_id === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

