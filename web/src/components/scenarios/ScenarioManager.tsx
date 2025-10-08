import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { SavedScenario } from '../dashboard/shared/types'
import { useAuth } from '../auth/AuthProvider'
import { useDashboardStore } from '../Dashboard'
import ScenarioList from './ScenarioList'
import ScenarioForm from './ScenarioForm'

interface ScenarioManagerProps {
  isOpen: boolean
  onClose: () => void
  viewMode: 'YTD Detailed' | 'Multi-Year'
  ytdSettings?: any
  onYtdSettingsChange?: (settings: any) => void
}

type Tab = 'my-scenarios' | 'public-scenarios'
type View = 'list' | 'form' | 'edit'

export default function ScenarioManager({ 
  isOpen, 
  onClose, 
  viewMode, 
  ytdSettings,
  onYtdSettingsChange 
}: ScenarioManagerProps) {
  const { profile } = useAuth()
  const store = useDashboardStore()
  
  const [activeTab, setActiveTab] = useState<Tab>('my-scenarios')
  const [view, setView] = useState<View>('list')
  const [myScenarios, setMyScenarios] = useState<SavedScenario[]>([])
  const [publicScenarios, setPublicScenarios] = useState<SavedScenario[]>([])
  const [editingScenario, setEditingScenario] = useState<SavedScenario | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && profile) {
      loadScenarios()
    }
  }, [isOpen, profile, viewMode]) // Add viewMode as dependency

  async function loadScenarios() {
    setLoading(true)
    setError(null)

    try {
      // Load user's scenarios - FILTERED by view_mode
      const { data: myData, error: myError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', profile?.id)
        .eq('view_mode', viewMode) // Filter by current view
        .order('updated_at', { ascending: false })

      if (myError) throw myError
      setMyScenarios(myData || [])

      // Load public scenarios - FILTERED by view_mode
      const { data: publicData, error: publicError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('is_public', true)
        .eq('view_mode', viewMode) // Filter by current view
        .neq('user_id', profile?.id)
        .order('updated_at', { ascending: false })

      if (publicError) throw publicError
      
      // Fetch creator emails separately if we have public scenarios
      if (publicData && publicData.length > 0) {
        const userIds = [...new Set(publicData.map((s: any) => s.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
        
        // Map emails to scenarios
        const emailMap = new Map(profilesData?.map((p: any) => [p.id, p.email]) || [])
        const publicWithEmail = publicData.map((s: any) => ({
          ...s,
          creator_email: emailMap.get(s.user_id),
        }))
        
        setPublicScenarios(publicWithEmail)
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

  async function handleSaveScenario(name: string, description: string, tags: string[], isPublic: boolean) {
    try {
      await store.saveScenarioToDatabase(name, description, tags, isPublic, viewMode, ytdSettings)
      await loadScenarios()
      setView('list')
      setEditingScenario(undefined)
    } catch (err) {
      throw err
    }
  }

  async function handleLoadScenario(id: string) {
    try {
      const loadedData = await store.loadScenarioFromDatabase(id)
      
      // If YTD scenario, update ytdSettings
      if (loadedData && loadedData.view_mode === 'YTD Detailed' && onYtdSettingsChange) {
        onYtdSettingsChange(loadedData.ytd_settings)
      }
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario')
    }
  }


  async function handleCloneScenario(id: string) {
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('Scenario not found')

      // Create a new scenario with cloned data
      const { error: insertError } = await supabase
        .from('scenarios')
        .insert({
          user_id: profile?.id,
          name: `${data.name} (Copy)`,
          description: data.description,
          tags: data.tags,
          is_public: false,
          scenario_data: data.scenario_data,
        })

      if (insertError) throw insertError

      await loadScenarios()
      setActiveTab('my-scenarios')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone scenario')
    }
  }

  async function handleUpdateBaseline(id: string) {
    if (!confirm('Update this scenario with latest 2025 QuickBooks data? This will preserve your projection settings and future years.')) {
      return
    }

    try {
      // Get fresh QBO sync timestamp (optional)
      let qboSyncTimestamp: string | undefined
      try {
        const { data: cacheData, error: cacheError } = await supabase
          .from('qbo_cache')
          .select('last_sync_timestamp')
          .eq('id', 1)
          .single()

        if (!cacheError && cacheData) {
          qboSyncTimestamp = cacheData.last_sync_timestamp
        }
      } catch (err) {
        console.warn('Could not fetch QBO sync timestamp:', err)
        // Continue with update even if timestamp fetch fails
      }

      // Update the scenario with new metadata
      const { error: updateError } = await supabase
        .from('scenarios')
        .update({
          baseline_date: new Date().toISOString().split('T')[0],
          qbo_sync_timestamp: qboSyncTimestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) throw updateError

      await loadScenarios()
      
      alert('✅ Scenario updated with latest 2025 data!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update baseline')
    }
  }

  async function handleDeleteScenario(id: string) {
    if (!confirm('Are you sure you want to delete this scenario? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase.from('scenarios').delete().eq('id', id)

      if (error) throw error

      // If we deleted the current scenario, clear the reference
      if (store.currentScenarioId === id) {
        store.setCurrentScenario(null, null)
      }

      await loadScenarios()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario')
    }
  }

  function handleEditScenario(scenario: SavedScenario) {
    // Load the scenario into the store first
    store.loadScenarioFromDatabase(scenario.id)
    setEditingScenario(scenario)
    setView('edit')
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
              {view === 'form' ? 'Save Scenario' : view === 'edit' ? 'Edit Scenario' : 'Scenario Manager'}
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

        {view === 'list' && (
          <>
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

              {activeTab === 'my-scenarios' ? (
                <>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {myScenarios.length} {viewMode === 'YTD Detailed' ? 'YTD' : 'Multi-Year'} scenario{myScenarios.length !== 1 ? 's' : ''}
                    </div>
                    <button
                      onClick={() => setView('form')}
                      style={{
                        padding: '8px 16px',
                        background: '#0ea5e9',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      + Save Current as New
                    </button>
                  </div>
                  <ScenarioList
                    scenarios={myScenarios}
                    currentUserId={profile?.id}
                    onLoad={handleLoadScenario}
                    onClone={handleCloneScenario}
                    onEdit={handleEditScenario}
                    onDelete={handleDeleteScenario}
                    onUpdateBaseline={handleUpdateBaseline}
                    loading={loading}
                  />
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {publicScenarios.length} public {viewMode === 'YTD Detailed' ? 'YTD' : 'Multi-Year'} scenario{publicScenarios.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ScenarioList
                    scenarios={publicScenarios}
                    currentUserId={profile?.id}
                    onLoad={handleLoadScenario}
                    onClone={handleCloneScenario}
                    onEdit={handleEditScenario}
                    onDelete={handleDeleteScenario}
                    onUpdateBaseline={handleUpdateBaseline}
                    loading={loading}
                  />
                </>
              )}
            </div>
          </>
        )}

        {(view === 'form' || view === 'edit') && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ScenarioForm
              existingScenario={editingScenario}
              onSave={handleSaveScenario}
              onCancel={() => {
                setView('list')
                setEditingScenario(undefined)
              }}
            />
          </div>
        )}

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
    </div>
  )
}

