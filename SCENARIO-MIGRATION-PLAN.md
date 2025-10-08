# Scenario System Migration Plan
## From: Monolithic Saves → To: Bifurcated YTD/Multi-Year Views

---

## 🎯 Goal
Separate YTD saves (lightweight, view-specific) from Multi-Year saves (complete with baseline + projections), with contextual loading and baseline conflict warnings.

---

## 📊 CURRENT STATE ANALYSIS

### What's Currently Saved:
```typescript
// All scenarios save this (regardless of view):
{
  scenario_data: {
    scenarioA: ScenarioState,        // Multi-Year projection state
    scenarioBEnabled: boolean,
    scenarioB?: ScenarioState,
    customProjectedValues: {}
  },
  view_mode: 'YTD Detailed' | 'Multi-Year',  // Stored but not used
  ytd_settings: null,                         // Column exists, never used
  scenario_type: string,                      // Computed, organizational only
  baseline_mode: string,
  baseline_date: string,
  qbo_sync_timestamp: string
}
```

### Current Problems:
1. ❌ YTD saves include unnecessary Multi-Year data
2. ❌ YTD settings are never saved
3. ❌ No filtering when loading (can load YTD save into Multi-Year view)
4. ❌ No warning when loading into B (baseline conflicts)
5. ❌ scenario_type is just organizational metadata, not functional

---

## 🎯 TARGET STATE

### YTD Save Structure:
```typescript
{
  view_mode: 'YTD Detailed',
  ytd_settings: {
    isNormalized: boolean,
    smoothing: number,
    chartType: string,
    // ... all YTD chart settings
  },
  // NO scenarioA/B
  // NO customProjectedValues
  // NO baseline_mode (always using current sync)
  baseline_date: string,              // For reference only
  qbo_sync_timestamp: string          // Which QBO sync this was created with
}
```

### Multi-Year Save Structure:
```typescript
{
  view_mode: 'Multi-Year',
  baseline_mode: '2024 Data' | '2025 Data' | 'Custom',
  baseline_date: string,
  qbo_sync_timestamp: string,
  scenario_data: {
    scenarioA: ScenarioState,         // Full projection state
    scenarioBEnabled: boolean,
    scenarioB?: ScenarioState,
    customProjectedValues: {}
  },
  // NO ytd_settings (not relevant)
}
```

---

## 🗺️ MIGRATION PHASES

---

### **PHASE 1: Foundation & Types** ✅ (Current phase)

#### 1.1 Audit Current Code
- [x] Identify all save points (`saveScenarioToDatabase`)
- [x] Identify all load points (`loadScenarioFromDatabase`)
- [ ] Document what data flows where

**Files to audit:**
- `web/src/components/Dashboard.tsx` - Main save/load logic
- `web/src/components/scenarios/ScenarioManager.tsx` - UI for managing scenarios
- `web/src/components/dashboard/shared/types.ts` - Type definitions

#### 1.2 Create New TypeScript Types
```typescript
// Add to types.ts:

export type YTDScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  tags: string[]
  is_public: boolean
  view_mode: 'YTD Detailed'
  ytd_settings: YTDSettings
  baseline_date: string
  qbo_sync_timestamp: string | null
  created_at: string
  updated_at: string
}

export type MultiYearScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  tags: string[]
  is_public: boolean
  view_mode: 'Multi-Year'
  baseline_mode: BaselineMode
  baseline_date: string
  qbo_sync_timestamp: string | null
  scenario_data: {
    scenarioA: ScenarioState
    scenarioBEnabled: boolean
    scenarioB?: ScenarioState
    customProjectedValues: Record<string, number>
  }
  created_at: string
  updated_at: string
}

export type SavedScenario = YTDScenario | MultiYearScenario

export type YTDSettings = {
  isNormalized: boolean
  smoothing: number
  chartType: string
  // ... other YTD-specific settings
}
```

#### 1.3 Update Database Schema (if needed)
- Database already has `view_mode` and `ytd_settings` columns ✅
- No migration needed for schema
- Will need data migration for existing scenarios (Phase 4)

---

### **PHASE 2: Update Save Logic**

#### 2.1 Modify `saveScenarioToDatabase` in Dashboard.tsx

**Before:** Always saves `scenarioData` regardless of view
**After:** Conditional save based on current view

```typescript
saveScenarioToDatabase: async (name, description, tags, isPublic, viewMode) => {
  const state = get()
  const { supabase } = await import('../lib/supabase')
  
  const currentView = viewMode || 'Multi-Year' // Get from props
  
  if (currentView === 'YTD Detailed') {
    // YTD Save - lightweight
    const ytdData = {
      view_mode: 'YTD Detailed',
      ytd_settings: ytdSettings, // Pass this from Dashboard state
      baseline_date: new Date().toISOString().split('T')[0],
      qbo_sync_timestamp: await fetchQBOTimestamp(),
      // NO scenario_data
      // NO baseline_mode
    }
    
    // Save to database
    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        user_id: session.user.id,
        name, description, tags, is_public: isPublic,
        view_mode: 'YTD Detailed',
        ytd_settings: ytdData.ytd_settings,
        baseline_date: ytdData.baseline_date,
        qbo_sync_timestamp: ytdData.qbo_sync_timestamp,
        scenario_data: null, // Explicitly null for YTD
      })
      
  } else {
    // Multi-Year Save - complete
    const multiYearData = {
      view_mode: 'Multi-Year',
      baseline_mode: state.scenarioA.dataMode,
      baseline_date: determineBaselineDate(),
      qbo_sync_timestamp: await fetchQBOTimestamp(),
      scenario_data: {
        scenarioA: state.scenarioA,
        scenarioBEnabled: state.scenarioBEnabled,
        scenarioB: state.scenarioB,
        customProjectedValues: state.customProjectedValues,
      },
      // NO ytd_settings
    }
    
    // Save to database (existing logic)
  }
}
```

#### 2.2 Pass `ytdSettings` to Save Function
- Update `ScenarioManager` to accept and pass `ytdSettings`
- Dashboard needs to provide current `ytdSettings` state

**Files to modify:**
- `web/src/components/Dashboard.tsx`
- `web/src/components/scenarios/ScenarioManager.tsx`
- `web/src/components/scenarios/ScenarioForm.tsx`

---

### **PHASE 3: Update Load Logic**

#### 3.1 Filter Scenarios by View Mode

**In ScenarioManager:**
```typescript
async function loadScenarios() {
  // Determine current view (passed from Dashboard)
  const currentView = viewMode || 'Multi-Year'
  
  // Load user's scenarios - FILTERED by view_mode
  const { data: myData } = await supabase
    .from('scenarios')
    .select('*')
    .eq('user_id', profile?.id)
    .eq('view_mode', currentView) // NEW: Filter by view
    .order('updated_at', { ascending: false })
  
  // Load public scenarios - FILTERED by view_mode
  const { data: publicData } = await supabase
    .from('scenarios')
    .select('*')
    .eq('is_public', true)
    .neq('user_id', profile?.id)
    .eq('view_mode', currentView) // NEW: Filter by view
    .order('updated_at', { ascending: false })
}
```

#### 3.2 Update Load Function

```typescript
loadScenarioFromDatabase: async (id: string) => {
  const { data } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .single()
  
  if (data.view_mode === 'YTD Detailed') {
    // Load YTD settings only
    setYtdSettings(data.ytd_settings)
    // Don't touch scenarioA/B state
    
  } else {
    // Load Multi-Year scenario (existing logic)
    const scenarioData = data.scenario_data
    set((state) => {
      state.scenarioA = scenarioData.scenarioA
      state.scenarioBEnabled = scenarioData.scenarioBEnabled
      state.scenarioB = scenarioData.scenarioB
      state.customProjectedValues = scenarioData.customProjectedValues
    })
  }
}
```

#### 3.3 Create Baseline Warning Modal

**New component:** `web/src/components/scenarios/BaselineWarningModal.tsx`

```typescript
interface BaselineWarningModalProps {
  isOpen: boolean
  scenarioName: string
  baselineMode: string
  baselineDate: string
  onConfirm: (loadBaseline: boolean) => void
  onCancel: () => void
}

export default function BaselineWarningModal(props: BaselineWarningModalProps) {
  const [loadBaseline, setLoadBaseline] = useState(false)
  
  return (
    <Modal>
      <h3>⚠️ Loading Scenario into B</h3>
      <p>
        The scenario "{scenarioName}" includes a {baselineMode} baseline 
        from {baselineDate}.
      </p>
      <p>
        Loading the baseline will affect both Scenario A and B.
      </p>
      
      <label>
        <input
          type="checkbox"
          checked={loadBaseline}
          onChange={(e) => setLoadBaseline(e.target.checked)}
        />
        Load 2025 baseline (affects both A and B)
      </label>
      
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        {loadBaseline 
          ? "✓ Will load baseline + projections"
          : "○ Will load projections only (A keeps its baseline)"}
      </p>
      
      <button onClick={() => props.onConfirm(loadBaseline)}>Load</button>
      <button onClick={props.onCancel}>Cancel</button>
    </Modal>
  )
}
```

#### 3.4 Integrate Warning Modal

**In ScenarioManager or Dashboard:**
```typescript
async function handleLoadScenario(id: string, target: 'A' | 'B' = 'A') {
  const scenario = await fetchScenario(id)
  
  if (target === 'B' && scenario.view_mode === 'Multi-Year') {
    // Show warning modal
    setShowBaselineWarning(true)
    setPendingScenario(scenario)
  } else {
    // Direct load
    await store.loadScenarioFromDatabase(id)
  }
}

function handleConfirmLoad(loadBaseline: boolean) {
  if (loadBaseline) {
    // Load everything into B (affects A's baseline)
    store.loadScenarioFromDatabase(pendingScenario.id, 'B', true)
  } else {
    // Load only projection settings into B
    store.loadScenarioFromDatabase(pendingScenario.id, 'B', false)
  }
  setShowBaselineWarning(false)
}
```

---

### **PHASE 4: Data Migration & Backward Compatibility**

#### 4.1 Handle Existing Scenarios

**Option A: One-time migration script**
```sql
-- Set view_mode for existing scenarios based on scenario_type
UPDATE scenarios
SET view_mode = CASE
  WHEN scenario_type = 'ytd-analysis' THEN 'YTD Detailed'
  ELSE 'Multi-Year'
END
WHERE view_mode IS NULL;

-- For YTD scenarios, clear scenario_data to save space
UPDATE scenarios
SET scenario_data = NULL
WHERE view_mode = 'YTD Detailed';
```

**Option B: Lazy migration (safer)**
- Leave existing scenarios as-is
- New saves use new format
- Load logic handles both formats
- UI shows "(Legacy)" badge for old format

#### 4.2 Backward-Compatible Load

```typescript
loadScenarioFromDatabase: async (id: string) => {
  const { data } = await supabase...
  
  // Detect legacy format
  const isLegacy = !data.view_mode || (data.view_mode === 'YTD Detailed' && data.scenario_data)
  
  if (isLegacy) {
    // Load as Multi-Year (safest fallback)
    // Show notification: "This is a legacy scenario. Re-save to update format."
  } else {
    // Load using new format logic
  }
}
```

---

### **PHASE 5: UI Updates**

#### 5.1 Update Scenario Manager UI
- Show view mode badge: `📊 YTD` or `📈 Multi-Year`
- Filter toggle: "Show YTD Only" | "Show Multi-Year Only" | "All"
- Sort by view_mode

#### 5.2 Update Save Dialog
- Show current view mode prominently
- Explain what will be saved:
  - "💡 Saving YTD view: Chart settings and 2025 outlook only"
  - "💡 Saving Multi-Year: Complete projection state including baseline"

#### 5.3 Context-Aware Loading
- When in YTD view, Load button shows "Load YTD Settings"
- When in Multi-Year view, Load button shows "Load into A" or "Load into B"

---

## 🧪 TESTING PLAN

### Test Cases:

#### Save Tests:
1. ✅ Save from YTD view → Check ytd_settings is saved, scenario_data is null
2. ✅ Save from Multi-Year view → Check scenario_data is saved, ytd_settings is null
3. ✅ Save YTD as public → Verify others can see and load
4. ✅ Save Multi-Year with Custom baseline → Metadata is correct

#### Load Tests:
5. ✅ Load YTD save in YTD view → Settings restored correctly
6. ✅ Load Multi-Year save into A → Full state restored
7. ✅ Load Multi-Year save into B → Warning modal appears
8. ✅ Load into B without baseline → A's baseline unchanged
9. ✅ Load into B with baseline → Both A and B use new baseline
10. ✅ Try to load YTD save in Multi-Year view → Error or filtered out

#### Migration Tests:
11. ✅ Load legacy scenario → Handles gracefully
12. ✅ Re-save legacy scenario → Converts to new format
13. ✅ Mix of old and new scenarios → Both work

---

## 📁 FILES TO MODIFY

### Core Logic:
- `web/src/components/Dashboard.tsx` - Save/load logic, state management
- `web/src/components/dashboard/shared/types.ts` - Type definitions

### Scenario Management:
- `web/src/components/scenarios/ScenarioManager.tsx` - Filter by view_mode
- `web/src/components/scenarios/ScenarioForm.tsx` - Show context
- `web/src/components/scenarios/ScenarioCard.tsx` - Show view badge
- `web/src/components/scenarios/ScenarioList.tsx` - Filtering

### New Components:
- `web/src/components/scenarios/BaselineWarningModal.tsx` - New modal

### Database:
- `supabase-scenario-view-migration.sql` - Data migration (optional)

---

## 🚀 ROLLOUT STRATEGY

### Step 1: Deploy with Backward Compatibility (Safe)
- New code handles both formats
- Users can continue using existing scenarios
- New saves use new format

### Step 2: Communication
- Update help modal to explain view-specific saves
- Add tooltips to save/load buttons

### Step 3: Optional Cleanup
- After 30 days, run data migration to clean up legacy scenarios
- Or keep lazy migration forever (safer)

---

## ⚠️ RISKS & MITIGATIONS

### Risk 1: Breaking existing scenarios
**Mitigation:** Backward-compatible load logic handles both formats

### Risk 2: Users confused by filtering
**Mitigation:** Clear UI indicators, help text, badges

### Risk 3: Data loss during migration
**Mitigation:** Don't delete anything, just set scenario_data to null for YTD (can recover)

### Risk 4: Complex baseline warning logic
**Mitigation:** Default to safest option (don't load baseline), make checkbox opt-in

---

## 📝 IMPLEMENTATION ORDER

1. ✅ Phase 1.2 - Update TypeScript types
2. ✅ Phase 2.1 - Update save logic (with backward compat)
3. ✅ Phase 3.1 - Filter scenarios by view
4. ✅ Phase 3.3 - Create baseline warning modal
5. ✅ Phase 3.4 - Integrate warning into load flow
6. ✅ Phase 3.2 - Update load logic
7. ✅ Phase 5 - UI polish
8. ✅ Phase 4 - Data migration (last, optional)

---

## ✅ SUCCESS CRITERIA

- [ ] YTD saves are < 5KB (vs current ~50KB)
- [ ] Can save/load YTD settings independently
- [ ] Can compare two Multi-Year scenarios with same baseline
- [ ] Warning prevents accidental baseline overwrite
- [ ] No breaking changes for existing users
- [ ] All existing scenarios still loadable

---

## 📚 DOCUMENTATION TO UPDATE

- `SCENARIO-METADATA-GUIDE.md` - Update with new architecture
- Help modal in Dashboard - Explain view-specific saves
- README - Update features list

---

**Next Step:** Begin Phase 1.2 - Update TypeScript types

