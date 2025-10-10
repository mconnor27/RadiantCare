import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { SavedScenario } from '../dashboard/shared/types'
import { isMultiYearScenario } from '../dashboard/shared/types'
import { useAuth } from '../auth/AuthProvider'
import { useDashboardStore } from '../Dashboard'
import ScenarioList from './ScenarioList'
import ScenarioForm from './ScenarioForm'
import BaselineWarningModal from './BaselineWarningModal'

interface ScenarioManagerProps {
  isOpen: boolean
  onClose: () => void
  viewMode: 'YTD Detailed' | 'Multi-Year'
  ytdSettings?: any
  onYtdSettingsChange?: (settings: any) => void
  initialView?: 'list' | 'form' | 'edit'
  initialScenario?: SavedScenario
}

type Tab = 'my-scenarios' | 'public-scenarios'
type View = 'list' | 'form' | 'edit'

export default function ScenarioManager({
  isOpen,
  onClose,
  viewMode,
  ytdSettings,
  onYtdSettingsChange,
  initialView = 'list',
  initialScenario
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
  
  // Baseline warning modal state
  const [showBaselineWarning, setShowBaselineWarning] = useState(false)
  const [pendingScenario, setPendingScenario] = useState<SavedScenario | null>(null)
  const [pendingTarget, setPendingTarget] = useState<'A' | 'B'>('A')

  useEffect(() => {
    if (isOpen && profile) {
      loadScenarios()
      // Set initial view and scenario when opening
      setView(initialView)
      setEditingScenario(initialScenario)
    }
  }, [isOpen, profile, viewMode, initialView, initialScenario])

  async function loadScenarios() {
    setLoading(true)
    setError(null)

    try {
      // In YTD Detailed mode, show ALL scenarios (no filtering)
      // In Multi-Year mode, only show Multi-Year scenarios
      let myQuery = supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', profile?.id)
      
      if (viewMode === 'Multi-Year') {
        myQuery = myQuery.eq('view_mode', 'Multi-Year')
      }
      
      const { data: myData, error: myError } = await myQuery.order('updated_at', { ascending: false })

      if (myError) throw myError
      setMyScenarios(myData || [])

      // Load public scenarios with same filtering logic
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

  async function handleSaveScenario(name: string, description: string, isPublic: boolean) {
    try {
      // Check if name is "Default" - only allowed when editing the existing Default scenario
      if (name.trim().toLowerCase() === 'default' && editingScenario?.name.toLowerCase() !== 'default') {
        throw new Error('Cannot use "Default" as a scenario name. This name is reserved.')
      }

      // Check for duplicate names for YTD scenarios
      if (viewMode === 'YTD Detailed') {
        const existingScenario = myScenarios.find(s =>
          s.name.toLowerCase() === name.trim().toLowerCase() &&
          s.id !== editingScenario?.id // Allow same name when editing the same scenario
        )
        if (existingScenario) {
          throw new Error(`A YTD scenario named "${name}" already exists. Please choose a different name.`)
        }
      }

      // If we're in 'form' view (not 'edit'), clear the current scenario ID to force a new save
      if (view === 'form') {
        store.setCurrentScenario(null, null) // Temporarily clear to force new scenario creation
        await store.saveScenarioToDatabase(name, description, isPublic, viewMode, ytdSettings)
        // Don't restore the old ID - we want the new scenario to be the current one
      } else {
        // In edit mode, keep the current scenario ID to update existing
        await store.saveScenarioToDatabase(name, description, isPublic, viewMode, ytdSettings)
      }
      await loadScenarios()
      setView('list')
      setEditingScenario(undefined)
      onClose() // Close the modal after saving
    } catch (err) {
      throw err
    }
  }

  async function handleLoadScenario(id: string, target: 'A' | 'B' = 'A') {
    try {
      // Fetch the scenario to check if we need to show warning
      const { data: scenario, error: fetchError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      if (!scenario) throw new Error('Scenario not found')
      
      // In YTD mode: Always load into A only (ignore target parameter)
      const loadTarget = viewMode === 'YTD Detailed' ? 'A' : target
      
      // In Multi-Year mode: Show warning modal if loading Multi-Year scenario into B
      if (viewMode === 'Multi-Year' && loadTarget === 'B' && isMultiYearScenario(scenario)) {
        setPendingScenario(scenario)
        setPendingTarget('B')
        setShowBaselineWarning(true)
        return // Wait for user decision
      }
      
      // Load the scenario
      const loadedData = await store.loadScenarioFromDatabase(id, loadTarget, true)
      
      // If YTD scenario or loading into YTD mode, update ytdSettings
      if (loadedData && onYtdSettingsChange) {
        if (loadedData.view_mode === 'YTD Detailed' && loadedData.ytd_settings) {
          // YTD scenario - use its ytd_settings
          onYtdSettingsChange(loadedData.ytd_settings)
        } else if (viewMode === 'YTD Detailed' && !loadedData.ytd_settings) {
          // Multi-Year scenario loaded into YTD mode - no ytd_settings to apply
          // The 2025 data is already loaded by loadScenarioFromDatabase
        }
      }
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario')
    }
  }
  
  async function handleConfirmLoad(loadBaseline: boolean) {
    if (!pendingScenario) return
    
    try {
      const loadedData = await store.loadScenarioFromDatabase(
        pendingScenario.id, 
        pendingTarget, 
        loadBaseline
      )
      
      // If YTD scenario, update ytdSettings
      if (loadedData && loadedData.view_mode === 'YTD Detailed' && onYtdSettingsChange) {
        onYtdSettingsChange(loadedData.ytd_settings)
      }
      
      setShowBaselineWarning(false)
      setPendingScenario(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario')
      setShowBaselineWarning(false)
      setPendingScenario(null)
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

      // Create a new scenario with cloned data - preserve all metadata
      const { error: insertError } = await supabase
        .from('scenarios')
        .insert({
          user_id: profile?.id,
          name: `${data.name} (Copy)`,
          description: data.description,
          is_public: false, // Clones are always private
          view_mode: data.view_mode,
          scenario_data: data.scenario_data,
          ytd_settings: data.ytd_settings,
          year_2025_data: data.year_2025_data,
          custom_projected_values: data.custom_projected_values,
          baseline_mode: data.baseline_mode,
          baseline_date: data.baseline_date,
          qbo_sync_timestamp: data.qbo_sync_timestamp,
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
    // Just set the editing scenario - no need to reload data
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
      onMouseDown={(e) => {
        // Only close if clicking directly on backdrop, not if mouse was down on a child element
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
                    viewMode={viewMode}
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
                    viewMode={viewMode}
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

      {/* Baseline Warning Modal */}
      {pendingScenario && isMultiYearScenario(pendingScenario) && (
        <BaselineWarningModal
          isOpen={showBaselineWarning}
          scenarioName={pendingScenario.name}
          baselineMode={pendingScenario.baseline_mode}
          baselineDate={pendingScenario.baseline_date}
          onConfirm={handleConfirmLoad}
          onCancel={() => {
            setShowBaselineWarning(false)
            setPendingScenario(null)
          }}
        />
      )}
    </div>
  )
}

