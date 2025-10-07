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
  viewMode?: string
}

type Tab = 'my-scenarios' | 'public-scenarios'
type View = 'list' | 'form' | 'edit'

export default function ScenarioManager({ isOpen, onClose, viewMode }: ScenarioManagerProps) {
  const { profile } = useAuth()
  const store = useDashboardStore()
  
  const [activeTab, setActiveTab] = useState<Tab>('my-scenarios')
  const [view, setView] = useState<View>('list')
  const [myScenarios, setMyScenarios] = useState<SavedScenario[]>([])
  const [publicScenarios, setPublicScenarios] = useState<SavedScenario[]>([])
  const [editingScenario, setEditingScenario] = useState<SavedScenario | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    if (isOpen && profile) {
      loadScenarios()
    }
  }, [isOpen, profile])

  async function loadScenarios() {
    setLoading(true)
    setError(null)

    try {
      // Load user's scenarios
      const { data: myData, error: myError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', profile?.id)
        .order('updated_at', { ascending: false })

      if (myError) throw myError
      setMyScenarios(myData || [])

      // Load public scenarios
      const { data: publicData, error: publicError } = await supabase
        .from('scenarios')
        .select(`
          *,
          profiles!scenarios_user_id_fkey(email)
        `)
        .eq('is_public', true)
        .neq('user_id', profile?.id)
        .order('updated_at', { ascending: false })

      if (publicError) throw publicError
      
      // Map the joined profile email to creator_email
      const publicWithEmail = (publicData || []).map((s: any) => ({
        ...s,
        creator_email: s.profiles?.email,
        profiles: undefined,
      }))
      
      setPublicScenarios(publicWithEmail)
    } catch (err) {
      console.error('Error loading scenarios:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveScenario(name: string, description: string, tags: string[], isPublic: boolean) {
    try {
      await store.saveScenarioToDatabase(name, description, tags, isPublic, viewMode)
      await loadScenarios()
      setView('list')
      setEditingScenario(undefined)
    } catch (err) {
      throw err
    }
  }

  async function handleLoadScenario(id: string) {
    try {
      await store.loadScenarioFromDatabase(id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario')
    }
  }

  function filterScenarios(scenarios: SavedScenario[]) {
    if (typeFilter === 'all') return scenarios
    return scenarios.filter(s => s.scenario_type === typeFilter)
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        {filterScenarios(myScenarios).length} of {myScenarios.length} scenario{myScenarios.length !== 1 ? 's' : ''}
                      </div>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="all">All Types</option>
                        <option value="ytd-analysis">📊 YTD Analysis</option>
                        <option value="forward-projection">📈 Forward Projection</option>
                        <option value="historical-projection">📅 Historical Analysis</option>
                      </select>
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
                    scenarios={filterScenarios(myScenarios)}
                    currentUserId={profile?.id}
                    onLoad={handleLoadScenario}
                    onClone={handleCloneScenario}
                    onEdit={handleEditScenario}
                    onDelete={handleDeleteScenario}
                    loading={loading}
                  />
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        {filterScenarios(publicScenarios).length} of {publicScenarios.length} scenario{publicScenarios.length !== 1 ? 's' : ''}
                      </div>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="all">All Types</option>
                        <option value="ytd-analysis">📊 YTD Analysis</option>
                        <option value="forward-projection">📈 Forward Projection</option>
                        <option value="historical-projection">📅 Historical Analysis</option>
                      </select>
                    </div>
                  </div>
                  <ScenarioList
                    scenarios={filterScenarios(publicScenarios)}
                    currentUserId={profile?.id}
                    onLoad={handleLoadScenario}
                    onClone={handleCloneScenario}
                    onEdit={handleEditScenario}
                    onDelete={handleDeleteScenario}
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

