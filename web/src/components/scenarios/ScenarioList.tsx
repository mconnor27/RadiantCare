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
  onUpdateBaseline?: (id: string) => void
  onToggleFavorite?: (id: string, favoriteType: 'A' | 'B') => void
  loading?: boolean
  viewMode?: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'
}

export default function ScenarioList({
  scenarios,
  currentUserId,
  onLoad,
  onClone,
  onEdit,
  onDelete,
  onUpdateBaseline,
  onToggleFavorite,
  loading = false,
  viewMode = 'Multi-Year',
}: ScenarioListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter scenarios based on search
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      const matchesSearch =
        !searchQuery ||
        scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scenario.description?.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [scenarios, searchQuery])

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        Loading scenarios...
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
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
              onUpdateBaseline={onUpdateBaseline}
              onToggleFavorite={onToggleFavorite}
              isOwner={scenario.user_id === currentUserId}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

