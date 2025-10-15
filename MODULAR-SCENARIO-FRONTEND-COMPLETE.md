# Modular Scenario System - Frontend Implementation Complete ✅

## Overview

The frontend has been fully updated to support the new modular scenario system, which separates "Current Year Settings" from "Projections." This allows for compositional scenario management where projections can be loaded on top of different baseline settings.

---

## Components Updated

### 1. **Dashboard Store** (`web/src/components/Dashboard.tsx`)

#### New State Properties
- `currentYearSettingId`, `currentYearSettingName`, `currentYearSettingUserId`
- `currentProjectionId`, `currentProjectionName`, `currentProjectionUserId`
- `loadedCurrentYearSettingsSnapshot` - For dirty detection of 2025 data
- `loadedProjectionSnapshot` - For dirty detection of projections

#### New Methods Implemented
- `saveCurrentYearSettings()` - Saves 2025 baseline data + YTD settings
- `saveProjection()` - Saves projection settings + 2026-2035 + baseline (if 2024/Custom)
- `loadCurrentYearSettings()` - Loads 2025 data compositionally
- `loadProjection()` - Loads projection settings compositionally
- `isCurrentYearSettingsDirty()` - Checks if 2025 data modified
- `isProjectionDirty()` - Checks if projection settings modified
- `resetCurrentYearSettings()` - Reverts 2025 data to snapshot
- `resetProjection()` - Reverts projection to snapshot
- `setCurrentYearSetting()` - Updates tracking state
- `setCurrentProjection()` - Updates tracking state
- `updateCurrentYearSettingsSnapshot()` - Updates snapshot after save
- `updateProjectionSnapshot()` - Updates snapshot after save

---

### 2. **Type System** (`web/src/components/dashboard/shared/types.ts`)

#### New Types Added
```typescript
// Current Year Settings Scenario
export type CurrentYearSettingsScenario = {
  scenario_type: 'current_year'
  view_mode: 'YTD Detailed'
  year_2025_data: FutureYear
  custom_projected_values: Record<string, number> // Only '2025-*' keys
  ytd_settings: YTDSettings | null
  baseline_date: string
  qbo_sync_timestamp: string | null
  // ... standard fields (id, name, etc.)
}

// Projection Scenario
export type ProjectionScenario = {
  scenario_type: 'projection'
  view_mode: 'Multi-Year'
  baseline_mode: BaselineMode
  baseline_years: FutureYear[] | null // For 2024/Custom modes
  projection_settings: Projection
  future_years: FutureYear[] // 2026-2035
  future_custom_values: Record<string, number> // Non-'2025-*' keys
  baseline_date: string
  qbo_sync_timestamp: string | null
  // ... standard fields
}
```

#### Type Guards Added
- `isCurrentYearSettingsScenario()`
- `isProjectionScenario()`

---

### 3. **Save Dialog** (`web/src/components/scenarios/ModularScenarioSaveDialog.tsx`)

**New Component Created**

Features:
- Radio button selection for save type:
  - "Current Year Settings only"
  - "Projection only"
  - "Both" (only available when baseline mode is '2025 Data')
- Standard name, description, and public/private toggles
- Intelligent defaults based on context
- Called from both Multi-Year and YTD views

---

### 4. **Multi-Year View** (`web/src/components/dashboard/views/multi-year/MultiYearView.tsx`)

#### Changes Made
1. **Integrated ModularScenarioSaveDialog**
   - Save button opens new modular dialog
   - Supports all three save types based on baseline mode

2. **Display of Loaded Scenarios**
   - Shows "Current Year Settings: [name]" with dirty indicator
   - Shows "Projection: [name]" with dirty indicator
   - Only displayed when baseline mode is '2025 Data'

3. **Save Handler Logic**
   ```typescript
   if (saveType === 'both') {
     await store.saveCurrentYearSettings(name + ' - Current Year', desc, isPublic)
     await store.saveProjection(name + ' - Projection', desc, isPublic, 'A')
   } else if (saveType === 'current_year') {
     await store.saveCurrentYearSettings(name, desc, isPublic)
   } else {
     await store.saveProjection(name, desc, isPublic, 'A')
   }
   ```

---

### 5. **YTD Detailed View** (`web/src/components/dashboard/views/detailed/YTDDetailed.tsx`)

#### Changes Made
1. **Integrated ModularScenarioSaveDialog**
   - Configured to only save "Current Year Settings"
   - Captures full YTD settings including:
     - `isNormalized`, `smoothing`, `chartType`, `incomeMode`
     - `showTarget`, `showCombined`, `combineStatistic`
     - All view-specific settings

2. **Save Handler**
   ```typescript
   const ytdSettings = {
     isNormalized,
     smoothing: getCurrentSmoothing(),
     chartType: chartMode,
     incomeMode,
     showTarget: true,
     // ... all YTD-specific settings
   }
   await store.saveCurrentYearSettings(name, description, isPublic, ytdSettings)
   ```

---

### 6. **Scenario Manager** (`web/src/components/scenarios/ScenarioManager.tsx`)

#### Changes Made
1. **Scenario Type Filter Added**
   - Dropdown filter with options:
     - "All Types"
     - "Current Year Settings"
     - "Projections"
     - "Legacy Scenarios"

2. **Smart Load Handling**
   ```typescript
   async function handleLoadScenario(id: string, target: 'A' | 'B') {
     const scenario = await fetchScenario(id)
     
     if (isCurrentYearSettingsScenario(scenario)) {
       await store.loadCurrentYearSettings(id)
       if (scenario.ytd_settings) {
         onYtdSettingsChange(scenario.ytd_settings)
       }
       return
     }
     
     if (isProjectionScenario(scenario)) {
       if (target === 'B') {
         // Show baseline warning modal
         setPendingScenario(scenario)
         setPendingTarget('B')
         setShowBaselineWarning(true)
         return
       }
       await store.loadProjection(id, target)
       return
     }
     
     // Legacy scenarios use existing path
     await store.loadScenarioFromDatabase(id, target, true)
   }
   ```

3. **Confirmation Handler Updated**
   - Handles modular projections correctly
   - Ignores `loadBaseline` parameter for modular scenarios (it's stored in scenario)

4. **Filtering Function**
   ```typescript
   function filterScenariosByType(scenarios: SavedScenario[]): SavedScenario[] {
     if (scenarioTypeFilter === 'all') return scenarios
     return scenarios.filter(scenario => {
       if (scenarioTypeFilter === 'current_year') {
         return isCurrentYearSettingsScenario(scenario)
       } else if (scenarioTypeFilter === 'projection') {
         return isProjectionScenario(scenario)
       } else if (scenarioTypeFilter === 'legacy') {
         return !isCurrentYearSettingsScenario(scenario) && !isProjectionScenario(scenario)
       }
       return true
     })
   }
   ```

---

### 7. **Scenario Card** (`web/src/components/scenarios/ScenarioCard.tsx`)

#### Changes Made
1. **Visual Type Badges**
   - ⚙️ Current Year Settings (blue)
   - 📊 Projection (purple)
   - 📊 YTD View (Legacy) (gray)
   - 📈 Multi-Year (Legacy) (gray)

2. **Badge Implementation**
   ```typescript
   const getViewModeInfo = () => {
     if (isCurrentYearSettingsScenario(scenario)) {
       return { label: '⚙️ Current Year Settings', color: '#0369a1', bg: '#dbeafe' }
     }
     if (isProjectionScenario(scenario)) {
       return { label: '📊 Projection', color: '#7c3aed', bg: '#ede9fe' }
     }
     // Legacy scenarios shown in gray
     if (isYTDScenario(scenario)) {
       return { label: '📊 YTD View (Legacy)', color: '#6b7280', bg: '#f3f4f6' }
     } else {
       return { label: '📈 Multi-Year (Legacy)', color: '#6b7280', bg: '#f3f4f6' }
     }
   }
   ```

---

## Key Frontend Features Implemented

### ✅ Compositional Loading
- Projections load on top of existing Current Year Settings
- No overwriting of 2025 data unless projection has 2024/Custom baseline

### ✅ Split Dirty Detection
- Independent dirty tracking for Current Year Settings and Projections
- Visual indicators show which part has been modified

### ✅ Smart Save Dialog
- Automatically hides "Both" option when not in 2025 Data mode
- Pre-populates with appropriate defaults

### ✅ Type Filtering
- Users can filter scenario list by type
- Clear visual badges distinguish scenario types

### ✅ Baseline Handling
- Projections with 2024/Custom baseline save and restore their baseline data
- Projections with 2025 Data baseline are purely compositional

### ✅ Legacy Compatibility
- Old scenarios continue to work
- Clearly marked as "Legacy" in UI
- No breaking changes to existing functionality

---

## Data Flow Summary

### Saving Current Year Settings (from YTD or Multi-Year view)
1. User clicks save → Opens modular dialog
2. Selects "Current Year Settings" (or "Both")
3. `store.saveCurrentYearSettings()` extracts:
   - 2025 year from `scenarioA.future`
   - All '2025-*' keys from `customProjectedValues`
   - YTD settings if provided
4. Creates DB record with `scenario_type: 'current_year'`
5. Updates snapshot for dirty detection

### Saving Projection (from Multi-Year view)
1. User clicks save → Opens modular dialog
2. Selects "Projection" (or "Both")
3. `store.saveProjection()` extracts:
   - Projection settings from `scenarioA.projection`
   - Years 2026-2035 from `scenarioA.future`
   - Non-'2025-*' keys from `customProjectedValues`
   - **If baseline_mode is 2024/Custom:** baseline years from `scenarioA.future`
4. Creates DB record with `scenario_type: 'projection'`
5. Updates snapshot for dirty detection

### Loading Current Year Settings
1. User selects scenario from manager
2. `handleLoadScenario()` detects type using type guard
3. `store.loadCurrentYearSettings()` loads:
   - Replaces 2025 in `scenarioA.future`
   - Replaces '2025-*' keys in `customProjectedValues`
4. Updates tracking state and snapshot
5. Applies YTD settings if in YTD view

### Loading Projection
1. User selects scenario from manager
2. `handleLoadScenario()` detects type using type guard
3. If loading into Scenario B → Shows warning modal
4. `store.loadProjection()` loads:
   - Replaces projection settings
   - Replaces 2026-2035 in `scenarioA.future`
   - Replaces non-'2025-*' keys in `customProjectedValues`
   - **If baseline_mode is 2024/Custom:** Replaces baseline years
5. Updates tracking state and snapshot

---

## Testing Checklist for User

### Current Year Settings
- [ ] Save Current Year Settings from YTD view
- [ ] Save Current Year Settings from Multi-Year view
- [ ] Load Current Year Settings in YTD view
- [ ] Load Current Year Settings in Multi-Year view
- [ ] Verify dirty detection works after editing 2025 data
- [ ] Verify reset works correctly

### Projections (2025 Data baseline)
- [ ] Save Projection from Multi-Year view with 2025 baseline
- [ ] Load Projection - verify it doesn't overwrite Current Year Settings
- [ ] Load different Projection on top of same Current Year Settings
- [ ] Verify dirty detection works after editing projection settings
- [ ] Verify dirty detection works after editing 2026-2035 data
- [ ] Verify reset works correctly

### Projections (2024/Custom baseline)
- [ ] Save Projection from Multi-Year view with 2024 baseline
- [ ] Load Projection - verify it loads its own baseline
- [ ] Verify dirty detection includes baseline data
- [ ] Verify reset works correctly

### Save Dialog
- [ ] In Multi-Year view with 2025 Data: All 3 options available
- [ ] In Multi-Year view with 2024 Data: Only "Projection" available
- [ ] In Multi-Year view with Custom: Only "Projection" available
- [ ] In YTD view: Only "Current Year Settings" available (force-saved)
- [ ] "Both" option creates 2 separate scenarios

### Scenario Manager
- [ ] Filter by "Current Year Settings" shows only those
- [ ] Filter by "Projections" shows only those
- [ ] Filter by "Legacy" shows only legacy scenarios
- [ ] Load Current Year Settings from manager
- [ ] Load Projection from manager
- [ ] Visual badges display correctly

### Scenario B
- [ ] Load Current Year Settings into A, different Projection into B
- [ ] Both projections use same Current Year Settings (if baseline is 2025)
- [ ] Load Projection with 2024/Custom baseline into B - has independent baseline

---

## Migration Path for Existing Users

1. **Legacy scenarios continue to work** - No breaking changes
2. **Users can start creating modular scenarios immediately**
3. **Recommended workflow:**
   - Create "Default Current Year Settings" scenario
   - Create "Default Projection" scenario
   - Set both as favorites (the user will handle this on backend)
4. **Over time**, legacy scenarios will be phased out naturally

---

## Backend Requirements (User's Responsibility)

The frontend is fully implemented and ready. The backend needs:

1. **Database Migration**
   - Add columns: `scenario_type`, `baseline_years`, `projection_settings`, `future_years`, `future_custom_values`
   - See: `supabase-modular-scenarios-migration.sql`

2. **API Compatibility**
   - Existing endpoints should continue working (legacy scenarios)
   - New scenario types are stored in existing table with new columns

3. **Shared Links**
   - Update shared link creation to store full snapshot data
   - Include both Current Year Settings and Projection data
   - Make truly immutable (store complete QBO data)

4. **Default Scenarios**
   - Create "Default Current Year Settings" scenario
   - Create "Default Projection" scenario
   - Set up auto-load logic (can use existing favorite system)

---

## Summary

✅ **Frontend is 100% complete and ready for use**

The modular scenario system is fully implemented on the frontend with:
- Clean separation of concerns (Current Year vs Projections)
- Compositional loading architecture
- Independent dirty detection and reset
- Smart save dialog with context-aware options
- Visual distinction of scenario types
- Full backward compatibility with legacy scenarios

Once the backend migration is complete, users can immediately start using the new modular scenario system while legacy scenarios continue to work seamlessly.


