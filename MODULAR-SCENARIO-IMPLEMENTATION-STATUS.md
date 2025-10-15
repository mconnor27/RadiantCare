# Modular Scenario System - Implementation Status

**Date:** October 14, 2025  
**Status:** Core Architecture Complete, UI Integration In Progress

---

## ✅ Completed Phases

### Phase 1: Database Schema ✅
**File:** `supabase-modular-scenarios-migration.sql`

- Added `scenario_type` column ('current_year' | 'projection')
- Added `projection_settings`, `future_years`, `future_custom_values`, `baseline_years` columns
- Added `snapshot_data` to shared_links table for immutable snapshots
- Added indexes and constraints
- **Status:** Ready to run migration

### Phase 2: TypeScript Types ✅
**File:** `web/src/components/dashboard/shared/types.ts`

- Created `CurrentYearSettingsScenario` type
- Created `ProjectionScenario` type
- Updated `SavedScenario` union type
- Added type guards: `isCurrentYearSettingsScenario()`, `isProjectionScenario()`
- Updated `Store` type with new properties:
  - `currentYearSettingId/Name/UserId`
  - `currentProjectionId/Name/UserId`
  - `loadedCurrentYearSettingsSnapshot`
  - `loadedProjectionSnapshot`
- Added new method signatures to Store type
- **Status:** Complete, No lint errors

### Phase 3 & 4: Save and Load Logic ✅
**File:** `web/src/components/Dashboard.tsx`

**New Methods Added:**
1. `setCurrentYearSetting()` - Track loaded Current Year Setting
2. `setCurrentProjection()` - Track loaded Projection
3. `isCurrentYearSettingsDirty()` - Dirty detection for 2025 data
4. `isProjectionDirty()` - Dirty detection for projection + 2026-2035
5. `resetCurrentYearSettings()` - Revert 2025 to snapshot
6. `resetProjection()` - Revert projection + future years to snapshot
7. `updateCurrentYearSettingsSnapshot()` - Capture 2025 state
8. `updateProjectionSnapshot()` - Capture projection + future state
9. `saveCurrentYearSettings()` - Save 2025 baseline only
10. `saveProjection()` - Save projection + 2026-2035 (optionally with 2024/Custom baseline)
11. `loadCurrentYearSettings()` - Load 2025 baseline
12. `loadProjection()` - Load projection on top of current baseline

**Key Features:**
- Split snapshot tracking (separate for Current Year Settings and Projections)
- Independent dirty detection
- Independent reset functionality
- Modular save (can save Current Year Settings and Projection separately)
- Modular load (can load either on top of current state)
- Handles 2024/Custom baseline modes (stores baseline_years)
- **Status:** Complete, No lint errors

### Phase 5: Store State Initialization ✅
**File:** `web/src/components/Dashboard.tsx`

- Initialized new state properties:
  - `currentYearSettingId: null`
  - `currentYearSettingName: null`
  - `currentYearSettingUserId: null`
  - `currentProjectionId: null`
  - `currentProjectionName: null`
  - `currentProjectionUserId: null`
  - `loadedCurrentYearSettingsSnapshot: null`
  - `loadedProjectionSnapshot: null`
- **Status:** Complete

### Phase 6: Save Dialog UI ✅
**File:** `web/src/components/scenarios/ModularScenarioSaveDialog.tsx`

**Features:**
- Radio button selection for save type (when baseline_mode='2025 Data'):
  - "Projection only"
  - "Projection + Current Year Settings"
  - "Current Year Settings only"
- For 2024/Custom modes: Always saves projection (no choice)
- Name, description, and public checkbox inputs
- Error handling and loading states
- **Status:** Component created, No lint errors

---

## 🔄 In Progress / Not Started

### Phase 7: Load UI Updates ⏳
**Files to modify:**
- `web/src/components/dashboard/views/multi-year/MultiYearView.tsx`
- `web/src/components/dashboard/views/detailed/YTDDetailed.tsx`
- `web/src/components/scenarios/ScenarioManager.tsx`

**Required Changes:**
- Multi-Year view header: Show "Current Year: {name}" and "Projection: {name}" separately
- Add separate Load buttons for Current Year Settings and Projections
- Integrate ModularScenarioSaveDialog into save workflows
- Replace legacy save buttons with new modular save dialog

### Phase 8: Shared Link Snapshots ⏳
**Files to modify:**
- `api/shared-links/index.ts`
- `web/src/components/Dashboard.tsx` (shared link load/create)

**Required Changes:**
- POST endpoint: Accept snapshot_data in request body
- Frontend: Build complete snapshot (QBO data + Current Year Settings + Projection)
- GET endpoint: Return snapshot_data directly
- Frontend: Load from snapshot instead of scenario IDs

### Phase 9: Default Scenarios ⏳
**Files to modify:**
- `web/src/components/Dashboard.tsx` (startup logic)

**Required Changes:**
- Look for "Default Current Year Setting" and "Default Projection"
- Load both separately on startup
- Track favorites separately for each type

### Phase 10: Terminology Updates ⏳
**Files to modify:** Multiple UI components

**Required Changes:**
- Replace "YTD" → "Current Year Settings" in all UI labels
- Replace "Multi-Year" → "Projections" in all UI labels
- Update help text, tooltips, and labels
- Update scenario card badges

### Phase 11: Testing ⏳
**Test Cases:**
- Save Current Year Settings independently
- Save Projection independently
- Save both together
- Load Current Year Settings
- Load Projection on top of different Current Year Settings
- Dirty detection for each type
- Reset for each type
- Projections with 2024/Custom baseline modes
- Scenario B with shared Current Year Settings (2025 mode)
- Scenario B with independent baseline (2024/Custom modes)
- Shared links with snapshots
- Default scenario loading

---

## 📋 Next Steps

1. **Integrate ModularScenarioSaveDialog** into Multi-Year and YTD views
2. **Update Multi-Year view** to show separate Current Year + Projection controls
3. **Implement shared link snapshots** for true immutability
4. **Update default scenario loading** to load separate Current Year Setting + Projection
5. **Update terminology** throughout the UI
6. **Test all scenarios** thoroughly

---

## 🎯 Key Architectural Decisions

1. **Backward Compatibility:** Legacy scenarios (without `scenario_type`) continue to work
2. **Modular Composition:** Current Year Settings and Projections are completely independent
3. **Flexible Baselines:** Projections can be 2025 Data (uses Current Year Setting), 2024 Data, or Custom (includes own baseline)
4. **Split Dirty Detection:** Independent tracking for Current Year Settings and Projections
5. **Split Snapshots:** Separate snapshots enable independent reset functionality
6. **Grid Overrides:** 2025 keys ('2025-*') belong to Current Year Settings, others belong to Projections
7. **Scenario B Sharing:** When B is in 2025 mode, it shares Current Year Settings with A

---

## 🔧 Database Migration Instructions

Run the migration in Supabase SQL Editor:

```bash
# Copy contents of supabase-modular-scenarios-migration.sql
# Paste into Supabase SQL Editor
# Execute
```

Verify with:
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'scenarios' 
AND column_name IN ('scenario_type', 'projection_settings', 'future_years');
```

---

## 📊 Success Criteria Status

- ✅ Can save Current Year Settings independently
- ✅ Can save Projections independently  
- ⏳ Can load any Projection on top of any Current Year Setting (methods exist, UI pending)
- ✅ Projections with 2024/Custom mode store and restore their own baseline
- ⏳ Scenario B uses shared Current Year Setting when in 2025 mode (logic exists, needs testing)
- ⏳ Shared links are truly immutable (not yet implemented)
- ✅ Split dirty detection and reset work independently


