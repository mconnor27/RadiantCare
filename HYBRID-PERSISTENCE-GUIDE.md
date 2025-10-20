# Session Persistence Strategy

## Overview

RadiantCare uses **sessionStorage** to persist working state within a browser tab/window. This ensures users can refresh without losing work, while preventing stale state across sessions.

### Modular Architecture (Current System)

The app uses a **modular scenario system** with two separate types:

1. **Current Year Settings** (`scenario_type: 'current_year'`)
   - Stores 2025 baseline data with sparse saving
   - Has grid UI for editing (YTD Detailed view)
   - Grid overrides persisted in localStorage as `ytdCustomProjectedValues`

2. **Projection Scenarios** (`scenario_type: 'projection'`)
   - Stores 2026-2030 projection settings with sparse saving
   - Layers on top of Current Year Settings (or 2024/Custom baseline)
   - NO grid UI (Multi-Year view)
   - Grid overrides come from database, not localStorage

**Key Point:** YTD view has a grid UI for detailed edits. Multi-Year view uses sliders with `_overrides` flags to track user adjustments.

## What Gets Persisted (Until Tab Close)

### ✅ Stored in sessionStorage

**Full Scenario State** (including unsaved work)
- `scenarioA` - Multi-Year scenario A (with `_overrides` flags)
- `scenarioB` - Multi-Year scenario B (with `_overrides` flags)
- `ytdData` - Current year (2025) data
- `ytdCustomProjectedValues` - Grid overrides in YTD view

**Scenario Metadata**
- `currentScenarioId` / `currentScenarioName` / `currentScenarioUserId`
- `currentScenarioBId` / `currentScenarioBName` / `currentScenarioBUserId`
- `currentYearSettingId` / `currentYearSettingName` / `currentYearSettingUserId`
- `currentProjectionId` / `currentProjectionName` / `currentProjectionUserId`

**UI Preferences**
- `scenarioBEnabled` - Whether scenario B is visible

**Unsaved Work Protection:**
- Multi-Year slider adjustments preserved via `_overrides` flags in scenario state
- YTD grid edits preserved via `ytdCustomProjectedValues`
- Browser warns user before closing tab if dirty

**Snapshots for Dirty Detection** (Persisted to support refresh)
- `loadedScenarioSnapshot` - Legacy snapshot for Scenario A
- `loadedScenarioBSnapshot` - Legacy snapshot for Scenario B
- `loadedCurrentYearSettingsSnapshot` - YTD baseline snapshot
- `loadedProjectionSnapshot` - Projection snapshot for modular scenarios
- `expectedProjectionSnapshotA` - Expected state after baseline changes (Scenario A)
- `expectedProjectionSnapshotB` - Expected state after baseline changes (Scenario B)

### ❌ NOT Persisted (Cleared on Tab Close)

**None** - All working state and snapshots are persisted to preserve dirty detection across refresh

## How It Works

### On Page Load / Refresh

1. **Check sessionStorage** for persisted state
2. **If state exists** → Restore full working state (scenarios, edits, UI)
3. **If no state** → Load favorites or defaults from database
4. **Snapshots recreated** when scenarios are loaded/saved

### During Session

1. **User makes changes** → Automatically persisted to sessionStorage
2. **Slider adjustments** → Tracked via `_overrides` flags in scenario state
3. **Grid edits** → Stored in `ytdCustomProjectedValues`
4. **Page refresh** → All work preserved

### On Tab/Window Close

1. **Check for dirty state** → `isProjectionDirty()` / `isCurrentYearSettingsDirty()`
2. **If dirty** → Browser shows warning: "Leave site? Changes you made may not be saved"
3. **On close** → sessionStorage automatically cleared by browser
4. **Next session** → Fresh start, no stale state

### Staleness Protection

#### Tab Lifetime
- sessionStorage cleared when tab/window closes
- No 7-day expiry needed (ephemeral by design)
- Versioned key (`radiantcare-state-v2`) for schema migrations

#### Fresh Start Per Session
Since state is cleared on tab close:
- ✅ **No cross-session stale state** - Each session starts fresh
- ✅ **Multi-tab isolation** - Each tab = independent workspace
- ✅ **No old scenario references** - User consciously chooses what to load
- ✅ **QBO sync friendly** - New session = fresh data from DB

#### Within-Session Persistence
```typescript
// User workflow:
1. Load "Optimistic Projection" from database
2. Adjust 2027 Therapy Income slider → $3.5M
   → scenarioA.future[2027]._overrides.therapyIncome = true
   → Persisted to sessionStorage
3. Page refresh
   → scenarioA restored with _overrides intact
   → User sees their $3.5M adjustment
4. Save to database
   → Snapshot updated, no longer dirty
5. Close tab
   → sessionStorage cleared, fresh start next time
```

## Benefits

### User Experience
- 🎯 **Work preserved during session** - Refresh doesn't lose edits
- 💾 **Unsaved work protected** - Warning before closing tab
- 🔄 **Fresh start each session** - No confusion from old state
- 🪟 **Multi-tab friendly** - Each tab = independent workspace

### Data Integrity
- 🔒 **No stale state** - Tab close = automatic cleanup
- 👥 **Multi-user friendly** - New session = fresh DB load
- 🔄 **QBO sync aware** - Changes picked up on next session
- 📊 **No outdated references** - Deleted scenarios can't persist

### Performance
- ⚡ **Fast refresh** - Full state restored from sessionStorage
- 💾 **Reasonable storage** - Full state only lives during session
- 🚀 **Efficient** - No expiry checks needed

## Modular System & Sparse Saving

RadiantCare uses a **modular scenario architecture** that separates concerns:

### Current Year Settings (`scenario_type: 'current_year'`)
- Stores: 2025 baseline data (physicians, costs, MD hours, etc.)
- Grid overrides: `custom_projected_values` (DB) → `ytdCustomProjectedValues` (Store)
- **Sparse saving**: Only fields that differ from defaults are saved
- Used in: **YTD Detailed view** (has grid UI for editing)

Example sparse save:
```typescript
{
  year_2025_data: {
    year: 2025,
    physicians: [...],  // Always saved
    locumCosts: 95000,  // Only if != default (120000)
    // Other fields omitted if they match defaults
  },
  custom_projected_values: {
    "Total 7100 Therapy Income": 3500000,  // Grid override
    "Non-Employment Costs": 1250000        // Grid override
  }
}
```

### Projection Scenarios (`scenario_type: 'projection'`)
- Stores: 2026-2030 projection settings and per-year slider overrides
- Layers on top of: Current Year Settings OR 2024/Custom baseline
- Editing UI: **Sliders** (YearPanel) for Therapy Income, Costs, etc.
- **Sparse saving**: Only years with `_overrides` flags are saved
- Used in: **Multi-Year view** (slider-based editing, NO grid UI)

When user slides a value:
```typescript
// User adjusts 2027 Therapy Income slider to $3.5M
store.setFutureValue('A', 2027, 'therapyIncome', 3500000)
// → Sets: future[2027].therapyIncome = 3500000
// → Flags: future[2027]._overrides.therapyIncome = true
```

Example sparse save (only edited years):
```typescript
{
  baseline_mode: '2025 Data',
  projection_settings: { incomeGrowthPct: 4.2, ... },
  future_years: [
    { 
      year: 2026, 
      physicians: [...], 
      therapyIncome: 3200000,  // User slid this
      _overrides: { therapyIncome: true }
    },
    { 
      year: 2028, 
      physicians: [...],
      nonEmploymentCosts: 1300000,  // User slid this
      _overrides: { nonEmploymentCosts: true }
    }
    // Years 2027, 2029, 2030 omitted - calculated from projection_settings
  ],
  future_custom_values: {}  // Legacy field - always empty (no grid in Multi-Year)
}
```

### Key Distinction

**YTD View (Current Year Settings)**
- ✅ Has **grid UI** (YearlyDataGrid) for detailed account editing
- ✅ Grid edits stored in `ytdCustomProjectedValues`
- ✅ Needs localStorage persistence (unsaved work)
- Used for: Detailed 2025 baseline editing with QuickBooks integration

**Multi-Year View (Projections)**
- ✅ Has **slider UI** (YearPanel) for high-level value editing
- ✅ Slider edits tracked via `_overrides` flags on each year
- ❌ No grid UI (no detailed account-by-account editing)
- ❌ No need to persist grid overrides (doesn't have a grid!)
- Used for: 2026-2030 projection editing with sparse saving

## Standard Practices Comparison

| Approach | Duration | Use Case | RadiantCare |
|----------|----------|----------|-------------|
| **sessionStorage** | Until tab closes | Working state | ✅ **Full scenario state + edits** |
| **localStorage (short)** | 1-7 days | UI state, metadata | ❌ Replaced by sessionStorage |
| **localStorage (long)** | 30-90 days | User preferences | Could add for settings |
| **IndexedDB** | Indefinite | Large datasets | ❌ Not needed (DB-first) |
| **Always fetch** | Never cached | Critical data | ✅ **On new session** |

## Migration Notes

### Before (localStorage v1 - Hybrid Approach)
```typescript
// Old approach: Persist IDs only, load data fresh
partialize: (state) => ({
  // Multi-Year metadata (IDs only)
  currentScenarioId: state.currentScenarioId,
  currentProjectionId: state.currentProjectionId,

  // Current Year metadata (IDs only)
  currentYearSettingId: state.currentYearSettingId,

  // UI preferences
  scenarioBEnabled: state.scenarioBEnabled,

  // Unsaved work (YTD grid only)
  ytdCustomProjectedValues: state.ytdCustomProjectedValues,

  // NOTE: scenarioA, scenarioB, ytdData NOT persisted
})
```

Problems:
- Multi-Year slider edits (`_overrides`) lost on refresh
- User confusion: "Why did my changes disappear?"
- 7-day expiry could show stale scenario references
- Public scenarios could be updated/deleted, causing confusion

### After (sessionStorage v2 - Session Approach)
```typescript
// New approach: Persist full state within session
partialize: (state) => ({
  // Full scenario state (including _overrides)
  scenarioA: state.scenarioA,
  scenarioB: state.scenarioB,

  // YTD state (including unsaved grid edits)
  ytdData: state.ytdData,
  ytdCustomProjectedValues: state.ytdCustomProjectedValues,

  // Metadata (which scenarios are loaded)
  currentScenarioId: state.currentScenarioId,
  currentProjectionId: state.currentProjectionId,
  currentYearSettingId: state.currentYearSettingId,

  // UI preferences
  scenarioBEnabled: state.scenarioBEnabled,

  // Snapshots for dirty detection (persisted to support refresh)
  loadedScenarioSnapshot: state.loadedScenarioSnapshot,
  loadedScenarioBSnapshot: state.loadedScenarioBSnapshot,
  loadedCurrentYearSettingsSnapshot: state.loadedCurrentYearSettingsSnapshot,
  loadedProjectionSnapshot: state.loadedProjectionSnapshot,
  expectedProjectionSnapshotA: state.expectedProjectionSnapshotA,
  expectedProjectionSnapshotB: state.expectedProjectionSnapshotB,
})
```

Benefits:
- Slider edits (`_overrides`) preserved across refresh
- **Dirty detection works across refresh** (snapshots persisted)
- No stale state across sessions (tab close = cleanup)
- No 7-day expiry complexity
- beforeunload warning protects unsaved work
- Multi-tab isolation (each tab = separate workspace)
- Simpler mental model: "This tab is my workspace"

## Testing Scenarios

### ✅ Test 1: Fresh Session
1. Open new tab/window
2. Navigate to app
3. **Expected**: Loads favorite or default scenarios from database

### ✅ Test 2: Slider Edit + Refresh
1. Load "Optimistic Projection"
2. Adjust 2027 Therapy Income slider to $3.5M
3. Refresh page (without saving)
4. **Expected**: Slider still shows $3.5M, `_overrides.therapyIncome = true` preserved
5. **Expected**: Dirty indicator shows (snapshots persisted, dirty detection works)

### ✅ Test 3: Grid Edit + Refresh
1. In YTD view, edit grid cell
2. Refresh page (without saving)
3. **Expected**: Grid edit preserved via `ytdCustomProjectedValues`
4. **Expected**: Dirty indicator shows (snapshots persisted, dirty detection works)

### ✅ Test 4: Close Tab Warning
1. Make slider adjustments (unsaved)
2. Attempt to close tab
3. **Expected**: Browser shows "Leave site? Changes you made may not be saved"
4. Cancel close
5. **Expected**: Changes still present

### ✅ Test 5: Save + Close (No Warning)
1. Make slider adjustments
2. Save to database
3. Attempt to close tab
4. **Expected**: No warning (clean state after save)

### ✅ Test 6: Multi-Tab Isolation
1. Open app in Tab 1, load "Scenario A"
2. Open app in Tab 2, load "Scenario B"
3. Make edits in Tab 1
4. Switch to Tab 2
5. **Expected**: Tab 2 shows "Scenario B", unaffected by Tab 1

### ✅ Test 7: Fresh Start After Close
1. Load scenario, make edits
2. Close tab (with or without saving)
3. Open new tab, navigate to app
4. **Expected**: Fresh start, loads favorites/defaults (no persisted edits from closed session)

## Future Enhancements

### Possible Additions
1. **Auto-save draft** - Periodically save drafts to DB (separate from published scenarios)
2. **Conflict detection** - Warn if scenario was updated by another user since load
3. **Recovery on crash** - Optional localStorage backup for catastrophic failures
4. **Version tracking** - Store scenario version for comparison
5. **localStorage for preferences** - Long-lived UI settings (separate from working state)

### Not Recommended
- ❌ **Return to localStorage** - Would lose multi-tab isolation and stale state protection
- ❌ **IndexedDB** - Unnecessary complexity for current needs

## Debugging

### View Persisted State
```javascript
// In browser console
const state = JSON.parse(sessionStorage.getItem('radiantcare-state-v2'))
console.log('Persisted state:', {
  scenarioA: state.state.scenarioA?.dataMode,
  scenarioB: state.state.scenarioB?.dataMode,
  hasYtdData: !!state.state.ytdData,
  ytdCustomValues: Object.keys(state.state.ytdCustomProjectedValues || {}).length,
  scenarioBEnabled: state.state.scenarioBEnabled,
  ageMinutes: (Date.now() - state.state._timestamp) / 1000 / 60,
  
  // Check for snapshots (should be present for dirty detection)
  hasLoadedScenarioSnapshot: !!state.state.loadedScenarioSnapshot,
  hasLoadedScenarioBSnapshot: !!state.state.loadedScenarioBSnapshot,
  hasLoadedCurrentYearSettingsSnapshot: !!state.state.loadedCurrentYearSettingsSnapshot,
  hasLoadedProjectionSnapshot: !!state.state.loadedProjectionSnapshot,
  hasExpectedProjectionSnapshotA: !!state.state.expectedProjectionSnapshotA,
  hasExpectedProjectionSnapshotB: !!state.state.expectedProjectionSnapshotB,
})

// Check for _overrides
console.log('Scenario A overrides:',
  state.state.scenarioA?.future
    .filter(f => f._overrides)
    .map(f => ({ year: f.year, overrides: Object.keys(f._overrides || {}) }))
)
```

### Clear Persisted State
```javascript
sessionStorage.removeItem('radiantcare-state-v2')
// Then refresh page for fresh start
```

### Check Storage Logs
```javascript
// Watch console for:
[STORAGE] Loading persisted state from session (age: 15m)
🔍 [isProjectionDirty A] Using baseline-aware dirty detection with snapshot
✏️ [isProjectionDirty A] Year 2027 therapyIncome differs from expected
```

## Summary

The session persistence strategy provides the **best balance** for RadiantCare:
- 🎯 **Work preserved during session** - Refresh doesn't lose edits (includes `_overrides`)
- ✅ **Dirty detection across refresh** - Snapshots persisted for accurate change tracking
- 🔒 **No stale state** - Tab close = automatic cleanup
- 👥 **Multi-user friendly** - New session = fresh DB load
- 💾 **Unsaved work protection** - Browser warning before close
- 🪟 **Multi-tab isolation** - Each tab = independent workspace

This approach is particularly well-suited for RadiantCare's needs:
- Financial projections = valuable work that needs protection
- Public scenarios can be updated/deleted by admins
- External data source (QBO) that updates independently
- Users expect "this tab is my workspace" behavior
- Multi-tab usage for comparing scenarios side-by-side

