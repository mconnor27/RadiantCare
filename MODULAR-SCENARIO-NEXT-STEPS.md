# Modular Scenario System - Next Steps Guide

## ✅ What's Complete

The **core architecture** of the modular scenario system is fully implemented and ready to use:

1. **Database Schema** - Migration file ready to run
2. **TypeScript Types** - All new types defined
3. **Save Logic** - `saveCurrentYearSettings()` and `saveProjection()` methods
4. **Load Logic** - `loadCurrentYearSettings()` and `loadProjection()` methods
5. **Dirty Detection** - Split detection for Current Year Settings and Projections
6. **Reset Logic** - Independent reset for each type
7. **Snapshot Tracking** - Separate snapshots for change detection
8. **Save Dialog Component** - New UI component for modular saves

## 🎯 Core Methods Available Now

### In Dashboard Store:

```typescript
// Save methods
store.saveCurrentYearSettings(name, description, isPublic, ytdSettings)
store.saveProjection(name, description, isPublic, target)

// Load methods
store.loadCurrentYearSettings(id)
store.loadProjection(id, target)

// Dirty detection
store.isCurrentYearSettingsDirty()
store.isProjectionDirty()

// Reset
store.resetCurrentYearSettings()
store.resetProjection()

// Snapshot management
store.updateCurrentYearSettingsSnapshot()
store.updateProjectionSnapshot()

// Tracking
store.setCurrentYearSetting(id, name, userId)
store.setCurrentProjection(id, name, userId)
```

## 📋 Remaining Work (Estimated: 3-4 hours)

### 1. Database Migration (5 minutes)
**Action:** Run the migration in Supabase

```sql
-- Copy contents of supabase-modular-scenarios-migration.sql into Supabase SQL Editor
-- Execute the script
-- Verify with the included verification queries
```

### 2. Integrate Save Dialog (30-45 minutes)

**Files to modify:**
- `web/src/components/dashboard/views/multi-year/MultiYearView.tsx`
- `web/src/components/dashboard/views/detailed/YTDDetailed.tsx`

**Changes needed:**

a) Import the new dialog:
```typescript
import ModularScenarioSaveDialog from '../../../scenarios/ModularScenarioSaveDialog'
```

b) Add state for dialog:
```typescript
const [showModularSaveDialog, setShowModularSaveDialog] = useState(false)
```

c) Replace "Save As" button onClick:
```typescript
onClick={() => setShowModularSaveDialog(true)}
```

d) Add dialog component:
```typescript
<ModularScenarioSaveDialog
  isOpen={showModularSaveDialog}
  onClose={() => setShowModularSaveDialog(false)}
  onSave={async (saveType, name, description, isPublic) => {
    if (saveType === 'both') {
      // Save Current Year Settings first
      await store.saveCurrentYearSettings(name + ' - Current Year', description, isPublic, ytdSettings)
      // Then save Projection
      await store.saveProjection(name + ' - Projection', description, isPublic, 'A')
    } else if (saveType === 'current_year') {
      await store.saveCurrentYearSettings(name, description, isPublic, ytdSettings)
    } else {
      await store.saveProjection(name, description, isPublic, 'A')
    }
  }}
  baselineMode={store.scenarioA.dataMode}
  ytdSettings={ytdSettings}
/>
```

### 3. Update Multi-Year View Header (1 hour)

**File:** `web/src/components/dashboard/views/multi-year/MultiYearView.tsx`

**Add to header (around line 570-600):**

```typescript
{/* NEW: Show loaded Current Year Setting and Projection */}
{store.scenarioA.dataMode === '2025 Data' && (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: 16, 
    padding: '8px 12px', 
    background: '#f9fafb', 
    borderRadius: 6,
    marginBottom: 8 
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Current Year:</div>
      <div style={{ fontWeight: 500 }}>
        {store.currentYearSettingName || 'Not saved'}
      </div>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Projection:</div>
      <div style={{ fontWeight: 500 }}>
        {store.currentProjectionName || 'Not saved'}
      </div>
    </div>
  </div>
)}
```

### 4. Update ScenarioManager for Modular Types (1 hour)

**File:** `web/src/components/scenarios/ScenarioManager.tsx`

**Changes needed:**

a) Add filter tabs for scenario types:
```typescript
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
  <button onClick={() => setFilterType('all')}>All</button>
  <button onClick={() => setFilterType('current_year')}>Current Year Settings</button>
  <button onClick={() => setFilterType('projection')}>Projections</button>
  <button onClick={() => setFilterType('legacy')}>Legacy</button>
</div>
```

b) Filter scenarios:
```typescript
const filteredScenarios = myScenarios.filter(s => {
  if (filterType === 'all') return true
  if (filterType === 'current_year') return isCurrentYearSettingsScenario(s)
  if (filterType === 'projection') return isProjectionScenario(s)
  if (filterType === 'legacy') return isYTDScenario(s) || isMultiYearScenario(s)
  return true
})
```

c) Update load handler to use new methods:
```typescript
async function handleLoadScenario(id: string, target: 'A' | 'B' = 'A') {
  const { data: scenario } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .single()
  
  if (isCurrentYearSettingsScenario(scenario)) {
    await store.loadCurrentYearSettings(id)
    // Update YTD settings if in YTD view
    if (onYtdSettingsChange && scenario.ytd_settings) {
      onYtdSettingsChange(scenario.ytd_settings)
    }
  } else if (isProjectionScenario(scenario)) {
    await store.loadProjection(id, target)
  } else {
    // Legacy scenario
    await store.loadScenarioFromDatabase(id, target, true)
  }
  
  onClose()
}
```

### 5. Implement Shared Link Snapshots (1 hour)

**File:** `api/shared-links/index.ts`

**Update POST handler to accept snapshot:**
```typescript
const { snapshot_data, original_current_year_id, original_projection_id } = req.body

const { data, error } = await supabase
  .from('shared_links')
  .insert({
    id: linkId,
    user_id: user.id,
    view_mode,
    snapshot_data,  // Full immutable snapshot
    original_current_year_id,
    original_projection_id,
    // Keep old fields for backward compat
    scenario_a_id: null,
    scenario_b_id: null,
    scenario_b_enabled: false,
  })
```

**Update GET handler to return snapshot:**
```typescript
if (sharedLink.snapshot_data) {
  // New snapshot-based link
  return res.status(200).json({
    link_id: sharedLink.id,
    snapshot: sharedLink.snapshot_data,
    created_at: sharedLink.created_at,
    view_count: sharedLink.view_count
  })
}
```

**Frontend build snapshot (in Dashboard.tsx or shared link component):**
```typescript
const snapshot_data = {
  historic: store.historic,
  current_year_settings: {
    year_2025_data: store.scenarioA.future.find(f => f.year === 2025),
    custom_projected_values: Object.keys(store.customProjectedValues)
      .filter(k => k.startsWith('2025-'))
      .reduce((acc, k) => ({ ...acc, [k]: store.customProjectedValues[k] }), {}),
    ytd_settings: ytdSettings
  },
  projection: {
    baseline_mode: store.scenarioA.dataMode,
    baseline_years: store.scenarioA.dataMode !== '2025 Data' 
      ? store.scenarioA.future.filter(f => f.year < 2025)
      : null,
    projection_settings: store.scenarioA.projection,
    future_years: store.scenarioA.future.filter(f => f.year >= 2026 && f.year <= 2035),
    future_custom_values: Object.keys(store.customProjectedValues)
      .filter(k => !k.startsWith('2025-'))
      .reduce((acc, k) => ({ ...acc, [k]: store.customProjectedValues[k] }), {})
  },
  scenario_b: store.scenarioBEnabled && store.scenarioB ? {
    // Similar structure for B
  } : null,
  view_mode,
  ui_settings: { /* view-specific settings */ }
}
```

### 6. Update Default Scenario Loading (30 minutes)

**File:** `web/src/components/Dashboard.tsx` (loadDefaultScenarios function)

**Changes:**
```typescript
async function loadDefaultScenarios() {
  // Load Default Current Year Setting (or user's favorite)
  const { data: currentYearScenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('scenario_type', 'current_year')
    .or(`name.eq.Default Current Year Setting,user_id.eq.${profile?.id}`)
  
  // Load Default Projection (or user's favorite)
  const { data: projectionScenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('scenario_type', 'projection')
    .or(`name.eq.Default Projection,user_id.eq.${profile?.id}`)
  
  // Find favorites or defaults
  const currentYearSetting = currentYearScenarios?.find(s => s.is_favorite_a) 
    || currentYearScenarios?.find(s => s.name === 'Default Current Year Setting')
  
  const projection = projectionScenarios?.find(s => s.is_favorite_a)
    || projectionScenarios?.find(s => s.name === 'Default Projection')
  
  // Load both
  if (currentYearSetting) {
    await store.loadCurrentYearSettings(currentYearSetting.id)
  }
  
  if (projection) {
    await store.loadProjection(projection.id, 'A')
  }
}
```

### 7. Terminology Updates (30 minutes)

**Search and replace in UI files:**
- "YTD Detailed" → "Current Year Settings" (in labels, not in data)
- "Multi-Year" → "Projections" (in labels, not in data)
- Update scenario card badges
- Update help text

**Files likely to need updates:**
- `web/src/components/scenarios/ScenarioCard.tsx`
- `web/src/components/scenarios/ScenarioManager.tsx`
- Help modals and tooltips throughout the app

### 8. Create Default Scenarios (10 minutes)

**In Supabase or via admin interface, create:**

1. "Default Current Year Setting"
   - scenario_type: 'current_year'
   - Populated with current 2025 baseline
   - is_public: true

2. "Default Projection"
   - scenario_type: 'projection'
   - baseline_mode: '2025 Data'
   - Standard growth rates
   - is_public: true

## 🧪 Testing Checklist

After completing the above:

- [ ] Run database migration successfully
- [ ] Save Current Year Settings - verify in database
- [ ] Save Projection - verify in database
- [ ] Save both together - verify two scenarios created
- [ ] Load Current Year Settings - verify 2025 data updates
- [ ] Load Projection - verify projection + 2026-2035 updates
- [ ] Load Projection with 2024 baseline - verify baseline loads
- [ ] Dirty detection works for Current Year Settings
- [ ] Dirty detection works for Projections
- [ ] Reset Current Year Settings works
- [ ] Reset Projection works
- [ ] Scenario B with 2025 mode shares Current Year Settings
- [ ] Scenario B with 2024 mode has independent baseline
- [ ] Create shared link with snapshot
- [ ] Load shared link from snapshot
- [ ] Default scenarios load on startup

## 🚀 Deployment Steps

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "feat: implement modular scenario system

   - Add separate Current Year Settings and Projection scenario types
   - Implement split save/load/dirty detection logic
   - Add ModularScenarioSaveDialog component
   - Prepare for immutable shared link snapshots
   - Support 2024/Custom baseline modes in projections"
   ```

2. **Run database migration in Supabase**

3. **Deploy to Vercel:**
   ```bash
   git push origin refactor
   ```

4. **Create default scenarios** via admin interface or SQL

5. **Test thoroughly** with real data

## 💡 Tips for Completion

- **Start with save dialog integration** - This gives immediate value
- **Test incrementally** - Test each piece as you implement it
- **Use console.log** - Add logging to verify data flow
- **Check legacy scenarios** - Ensure they still work
- **Database migration first** - Run it before testing new features
- **Keep legacy code** - Don't break existing scenarios

## 🎉 Benefits Once Complete

1. **True Modularity** - Mix and match Current Year Settings with any Projection
2. **Better Organization** - Clear separation of concerns
3. **Independent Dirty Tracking** - Know exactly what changed
4. **Immutable Shared Links** - Links never change
5. **Flexible Baselines** - Support 2024 and custom baselines
6. **Clearer UX** - Users understand what they're saving

---

**Estimated Total Time to Complete:** 3-4 hours

**Priority Order:**
1. Database migration (required for everything else)
2. Save dialog integration (gives immediate value)
3. Load UI updates (enables full modular workflow)
4. Shared link snapshots (immutability)
5. Default scenarios (better first-run experience)
6. Terminology updates (polish)


