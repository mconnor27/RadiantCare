import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { SavedScenario } from '../dashboard/shared/types'
import { isYTDScenario, isMultiYearScenario } from '../dashboard/shared/types'
import { useAuth } from '../auth/AuthProvider'

interface ScenarioLoadModalProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (id: string) => void
  viewMode: 'YTD Detailed' | 'Multi-Year'
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
      
      // Sort scenarios: "Default" always at the top, then by updated_at
      const sortedMyData = (myData || []).sort((a, b) => {
        const aIsDefault = a.name.toLowerCase() === 'default'
        const bIsDefault = b.name.toLowerCase() === 'default'
        if (aIsDefault && !bIsDefault) return -1
        if (!aIsDefault && bIsDefault) return 1
        return 0 // Keep original order for non-Default scenarios
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
        const publicWithEmail = publicData.map((s: any) => ({
          ...s,
          creator_email: emailMap.get(s.user_id),
        }))

        // Sort scenarios: "Default" always at the top, then by updated_at
        const sortedPublicData = publicWithEmail.sort((a, b) => {
          const aIsDefault = a.name.toLowerCase() === 'default'
          const bIsDefault = b.name.toLowerCase() === 'default'
          if (aIsDefault && !bIsDefault) return -1
          if (!aIsDefault && bIsDefault) return 1
          return 0 // Keep original order for non-Default scenarios
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
    if (isYTDScenario(scenario)) {
      return { label: '📊 YTD View', color: '#0369a1', bg: '#e0f2fe' }
    } else {
      return { label: '📈 Multi-Year', color: '#15803d', bg: '#dcfce7' }
    }
  }

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
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('my-scenarios')}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'my-scenarios' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'my-scenarios' ? '#0ea5e9' : '#6b7280',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            My Scenarios
          </button>
          <button
            onClick={() => setActiveTab('public-scenarios')}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'public-scenarios' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'public-scenarios' ? '#0ea5e9' : '#6b7280',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
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
