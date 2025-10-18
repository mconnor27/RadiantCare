import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { SavedScenario } from '../dashboard/shared/types'
import { 
  isYTDScenario, 
  isMultiYearScenario, 
  isCurrentYearSettingsScenario, 
  isProjectionScenario 
} from '../dashboard/shared/types'
import { useAuth } from '../auth/AuthProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faStar as faSolidStar } from '@fortawesome/free-solid-svg-icons'

interface ScenarioLoadModalProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (id: string) => void
  viewMode: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'
}

type Tab = 'my-scenarios' | 'public-scenarios'

export default function ScenarioLoadModal({
  isOpen,
  onClose,
  onLoad,
  viewMode
}: ScenarioLoadModalProps) {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('my-scenarios')
  const [myScenarios, setMyScenarios] = useState<SavedScenario[]>([])
  const [publicScenarios, setPublicScenarios] = useState<SavedScenario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen && profile) {
      loadScenarios()
    }
  }, [isOpen, profile, viewMode])

  async function loadScenarios() {
    setLoading(true)
    setError(null)

    try {
      // Load user's scenarios
      let myQuery = supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', profile?.id)

      if (viewMode === 'Multi-Year') {
        myQuery = myQuery.eq('view_mode', 'Multi-Year')
      }

      const { data: myData, error: myError } = await myQuery.order('updated_at', { ascending: false })

      if (myError) throw myError

      // Fetch favorites for current user
      const { data: favoritesData } = await supabase
        .from('user_favorites')
        .select('scenario_id, favorite_type')
        .eq('user_id', profile?.id)

      // Create a map of scenario_id -> favorite types
      const favoritesMap = new Map<string, { is_favorite_a: boolean, is_favorite_b: boolean, is_favorite_current: boolean }>()
      favoritesData?.forEach((fav: any) => {
        if (!favoritesMap.has(fav.scenario_id)) {
          favoritesMap.set(fav.scenario_id, { is_favorite_a: false, is_favorite_b: false, is_favorite_current: false })
        }
        const current = favoritesMap.get(fav.scenario_id)!
        if (fav.favorite_type === 'A') current.is_favorite_a = true
        if (fav.favorite_type === 'B') current.is_favorite_b = true
        if (fav.favorite_type === 'CURRENT') current.is_favorite_current = true
      })

      // Merge favorites into scenario data
      let myDataWithFavorites = (myData || []).map((s: any) => ({
        ...s,
        is_favorite_a: favoritesMap.get(s.id)?.is_favorite_a || false,
        is_favorite_b: favoritesMap.get(s.id)?.is_favorite_b || false,
        is_favorite_current: favoritesMap.get(s.id)?.is_favorite_current || false,
      }))

      // Filter to only Current Year Settings scenarios for YTD views
      if (viewMode === 'YTD Detailed' || viewMode === 'YTD Mobile') {
        myDataWithFavorites = myDataWithFavorites.filter((s: any) => isCurrentYearSettingsScenario(s))
      }

      // Sort scenarios: Default (A) > Default (B) > Favorite A > Favorite B > others
      const sortedMyData = myDataWithFavorites.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()

        // Define priority order: Default (A) > Default (B) > Favorite A > Favorite B > others
        const getPriority = (item: any, name: string) => {
          if (name === 'default (a)') return 0
          if (name === 'default (b)') return 1
          if (item.is_favorite_a) return 2
          if (isMultiYearScenario(item) && item.is_favorite_b) return 3
          return 4 // All others
        }

        const aPriority = getPriority(a, aName)
        const bPriority = getPriority(b, bName)

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // If same priority, sort by updated_at (newest first)
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
      
      setMyScenarios(sortedMyData)

      // Load public scenarios
      let publicQuery = supabase
        .from('scenarios')
        .select('*')
        .eq('is_public', true)
        .neq('user_id', profile?.id)

      if (viewMode === 'Multi-Year') {
        publicQuery = publicQuery.eq('view_mode', 'Multi-Year')
      }

      const { data: publicData, error: publicError } = await publicQuery.order('updated_at', { ascending: false })

      if (publicError) throw publicError

      // Fetch creator emails
      if (publicData && publicData.length > 0) {
        const userIds = [...new Set(publicData.map((s: any) => s.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)

        const emailMap = new Map(profilesData?.map((p: any) => [p.id, p.email]) || [])
        let publicWithEmail = publicData.map((s: any) => ({
          ...s,
          creator_email: emailMap.get(s.user_id),
          is_favorite_a: favoritesMap.get(s.id)?.is_favorite_a || false,
          is_favorite_b: favoritesMap.get(s.id)?.is_favorite_b || false,
          is_favorite_current: favoritesMap.get(s.id)?.is_favorite_current || false,
        }))

        // Filter to only Current Year Settings scenarios for YTD views
        if (viewMode === 'YTD Detailed' || viewMode === 'YTD Mobile') {
          publicWithEmail = publicWithEmail.filter((s: any) => isCurrentYearSettingsScenario(s))
        }

        // Sort scenarios: Default (A) > Default (B) > Favorite A > Favorite B > others
        const sortedPublicData = publicWithEmail.sort((a, b) => {
          const aName = a.name.toLowerCase()
          const bName = b.name.toLowerCase()

          // Define priority order: Default (A) > Default (B) > Favorite A > Favorite B > others
          const getPriority = (item: any, name: string) => {
            if (name === 'default (a)') return 0
            if (name === 'default (b)') return 1
            if (item.is_favorite_a) return 2
            if (isMultiYearScenario(item) && item.is_favorite_b) return 3
            return 4 // All others
          }

          const aPriority = getPriority(a, aName)
          const bPriority = getPriority(b, bName)

          if (aPriority !== bPriority) {
            return aPriority - bPriority
          }

          // If same priority, sort by updated_at (newest first)
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        })

        setPublicScenarios(sortedPublicData)
      } else {
        setPublicScenarios([])
      }
    } catch (err) {
      console.error('Error loading scenarios:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }

  const scenarios = activeTab === 'my-scenarios' ? myScenarios : publicScenarios

  const filteredScenarios = scenarios.filter((scenario) => {
    return (
      !searchQuery ||
      scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

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

  const getViewModeInfo = (scenario: SavedScenario) => {
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

  // @ts-expect-error - Unused function kept for future use
  const formatBaselineDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-in',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
              Load Scenario
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: 0,
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f8f9fa' }}>
          <button
            onClick={() => setActiveTab('my-scenarios')}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: activeTab === 'my-scenarios' ? '#e3f2fd' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'my-scenarios' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'my-scenarios' ? '#0ea5e9' : '#6b7280',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            My Scenarios
          </button>
          <button
            onClick={() => setActiveTab('public-scenarios')}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: activeTab === 'public-scenarios' ? '#e3f2fd' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'public-scenarios' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'public-scenarios' ? '#0ea5e9' : '#6b7280',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            Public Scenarios
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
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

          {/* Search */}
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

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
              Loading scenarios...
            </div>
          ) : filteredScenarios.length === 0 ? (
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
              {filteredScenarios.map((scenario) => {
                const viewModeInfo = getViewModeInfo(scenario)
                const daysSinceBaseline = isMultiYearScenario(scenario) && scenario.baseline_mode === '2025 Data' && scenario.baseline_date
                  ? Math.floor((Date.now() - new Date(scenario.baseline_date).getTime()) / 86400000)
                  : 0

                return (
                  <div
                    key={scenario.id}
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
                            padding: '2px 8px',
                            borderRadius: '3px',
                            background: scenario.is_public ? '#dbeafe' : '#f3f4f6',
                            color: scenario.is_public ? '#0369a1' : '#6b7280',
                            fontWeight: 500,
                          }}
                        >
                          {scenario.is_public ? '🌐 Public' : '🔒 Private'}
                        </span>

                        {/* Favorite stars (read-only) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {/* Projection scenarios: Show A/B stars */}
                          {isProjectionScenario(scenario) && (
                            <>
                              {/* Star A */}
                              {scenario.is_favorite_a && (
                                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                  <FontAwesomeIcon
                                    icon={faSolidStar}
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
                                    color: '#374151'
                                  }}>A</sup>
                                </div>
                              )}

                              {/* Star B */}
                              {scenario.is_favorite_b && (
                                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                  <FontAwesomeIcon
                                    icon={faSolidStar}
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
                                    color: '#374151'
                                  }}>B</sup>
                                </div>
                              )}
                            </>
                          )}

                          {/* Current Year scenarios: Show single star */}
                          {isCurrentYearSettingsScenario(scenario) && scenario.is_favorite_current && (
                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                              <FontAwesomeIcon
                                icon={faSolidStar}
                                style={{
                                  color: '#fbbf24',
                                  fontSize: '16px'
                                }}
                              />
                            </div>
                          )}
                        </div>
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
                      <p style={{ textAlign: 'left', margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                        {scenario.description}
                      </p>
                    )}

                    {/* Staleness warning */}
                    {isMultiYearScenario(scenario) && scenario.baseline_mode === '2025 Data' && daysSinceBaseline > 7 && (
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

                    {/* Footer: Timestamps (left) | Load Button (right) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px' }}>
                      {/* Left: Timestamps */}
                      <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                        <div>Created: {formatDate(scenario.created_at)}</div>
                      </div>

                      {/* Right: Load Button */}
                      <button
                        onClick={() => {
                          onLoad(scenario.id)
                          onClose()
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
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        title="Load scenario"
                      >
                        <FontAwesomeIcon icon={faFolderOpen} style={{ transform: 'translateY(3px)' }} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
