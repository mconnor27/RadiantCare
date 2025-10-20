# Hybrid Persistence Strategy

## Overview

RadiantCare uses a **hybrid persistence approach** that combines localStorage for UI state with fresh database loads for scenario data. This ensures a smooth user experience while maintaining data integrity.

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

**Key Point:** Only YTD view has a grid UI where users can make unsaved edits. Multi-Year view has no grid, so there's nothing to persist for "unsaved work" there.

## What Gets Persisted (7 days)

### ✅ Stored in localStorage

**Scenario Metadata (IDs only)**
- `currentScenarioId` / `currentScenarioName` / `currentScenarioUserId`
- `currentScenarioBId` / `currentScenarioBName` / `currentScenarioBUserId`
- `currentYearSettingId` / `currentYearSettingName` / `currentYearSettingUserId`
- `currentProjectionId` / `currentProjectionName` / `currentProjectionUserId`

**UI Preferences**
- `scenarioBEnabled` - Whether scenario B is visible

**Unsaved User Work** (YTD only)
- `ytdCustomProjectedValues` - Grid overrides in YTD view

**NOTE:** Multi-Year view has **no grid UI** (uses sliders instead). Edits are tracked via `_overrides` flags for sparse saving. There are no unsaved grid overrides to persist - only unsaved slider edits, which are part of the scenario data itself.

### ❌ NOT Persisted (Loaded Fresh)

**Scenario Data** (Always loaded from database)
- `scenarioA` - Multi-Year scenario A data
- `scenarioB` - Multi-Year scenario B data
- `ytdData` - Current year setting data
- `loadedScenarioSnapshot` - Dirty detection snapshots
- `loadedScenarioBSnapshot` - Dirty detection snapshots

## How It Works

### On Mount

1. **Check localStorage** for persisted IDs and UI state
2. **If IDs exist but no data** → Load from database using those IDs
3. **If no IDs exist** → Load favorites or defaults
4. **If scenario doesn't exist** → Fallback to defaults

### On Save

1. **Store IDs, names, user IDs** to localStorage
2. **Store UI preferences** (scenarioBEnabled)
3. **Store unsaved grid edits** (customProjectedValues)
4. **Add timestamp** for expiry tracking
5. **Actual data remains in database** (source of truth)

### Staleness Protection

#### Time-Based Expiry
- localStorage expires after **7 days**
- Cleared on sign-out
- Versioned key (`radiantcare-state-v1`) for schema migrations

#### Database-First Approach
Since scenario data is NOT persisted:
- ✅ **Multi-user safe** - Database updates always reflected
- ✅ **QBO sync aware** - Fresh data includes latest sync
- ✅ **No stale data** - Database is source of truth
- ✅ **Smaller localStorage** - Only metadata stored

#### Auto-Load Logic
```typescript
// Multi-Year View
if (hasPersistedIdA && !hasDataA) {
  // Reload from persisted ID (data always fresh from DB)
  await store.loadScenarioFromDatabase(store.currentScenarioId, 'A', true)
} else if (!hasPersistedIdA) {
  // Load favorite or default
  const favoriteA = scenarios?.find(s => s.id === favoriteAId)
  const scenarioA = favoriteA || defaultOptimistic
  await store.loadScenarioFromDatabase(scenarioA.id, 'A', true)
}
```

## Benefits

### User Experience
- 🎯 **Seamless navigation** - Returns to last viewed scenario
- 💾 **Work preserved** - Unsaved grid edits survive refresh
- 🔄 **Consistent state** - UI preferences maintained

### Data Integrity
- 🔒 **Always fresh** - Database is source of truth
- 👥 **Multi-user safe** - No stale cached data
- 🔄 **QBO sync aware** - Latest data always loaded
- 📊 **External updates** - Admin changes reflected immediately

### Performance
- ⚡ **Fast initial load** - No need to check staleness
- 💾 **Smaller storage** - Only metadata persisted
- 🚀 **Efficient** - Single DB load on mount

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
| **Session Storage** | Until tab closes | Temporary work | ❌ Not used |
| **localStorage (short)** | 1-7 days | UI state, metadata | ✅ **7 days for IDs/preferences** |
| **localStorage (long)** | 30-90 days | User preferences | Could add for settings |
| **IndexedDB** | Indefinite | Large datasets | ❌ Not needed (DB-first) |
| **Always fetch** | Never cached | Critical data | ✅ **All scenario data** |

## Migration Notes

### Before (Legacy System)
```typescript
// Old approach: Persist full scenarios with all data
partialize: (state) => ({
  scenarioA: state.scenarioA,              // ❌ Could be stale, multi-user unsafe
  scenarioB: state.scenarioB,              // ❌ Could be stale
  customProjectedValues: state.customProjectedValues, // ❌ For legacy grid (now unused)
  loadedScenarioSnapshot: state.snapshot   // ❌ Could be stale
})
```

Problems:
- Full scenario data cached (could be updated by another user)
- QBO sync changes not reflected until localStorage expires
- Large localStorage footprint
- `customProjectedValues` was dead code (never written to)
  - Multi-Year view never had a grid UI in modular system
  - The field existed but was always empty
  - ~200 lines of code that did nothing

### After (Modular + Hybrid)
```typescript
// New approach: Persist IDs only, load data fresh
partialize: (state) => ({
  // Multi-Year metadata
  currentScenarioId: state.currentScenarioId,
  currentProjectionId: state.currentProjectionId,
  
  // Current Year metadata
  currentYearSettingId: state.currentYearSettingId,
  
  // UI preferences
  scenarioBEnabled: state.scenarioBEnabled,
  
  // Unsaved work (YTD grid only)
  ytdCustomProjectedValues: state.ytdCustomProjectedValues,
  
  // NOTE: scenarioA, scenarioB, ytdData NOT persisted (loaded fresh)
  // NOTE: customProjectedValues field REMOVED (was dead code)
})
```

Benefits:
- Always fresh data from database (multi-user safe)
- QBO sync changes reflected immediately
- Smaller localStorage (just IDs and preferences)
- Modular system with sparse saving
- Removed ~200 lines of dead `customProjectedValues` code
  - Multi-Year uses sliders with `_overrides` flags
  - YTD uses grid with `ytdCustomProjectedValues`
  - Clear separation, no confusion

## Testing Scenarios

### ✅ Test 1: Fresh Load
1. Clear localStorage
2. Refresh page
3. **Expected**: Loads favorite or default scenarios

### ✅ Test 2: Return User
1. Load scenario "My Custom Scenario"
2. Refresh page
3. **Expected**: Returns to "My Custom Scenario" (fresh from DB)

### ✅ Test 3: Multi-User Update
1. User A loads scenario "Shared Scenario"
2. User B updates "Shared Scenario" in database
3. User A refreshes page
4. **Expected**: User A sees User B's changes (fresh from DB)

### ✅ Test 4: QBO Sync
1. Load scenario based on 2025 data
2. QBO sync updates 2025 baseline
3. Refresh page
4. **Expected**: Scenario reflects new QBO data (fresh from DB)

### ✅ Test 5: Expiry
1. Don't use app for 8 days
2. Refresh page
3. **Expected**: localStorage cleared, loads defaults

### ✅ Test 6: Unsaved Work
1. Make grid edits
2. Don't save
3. Refresh page
4. **Expected**: Grid edits preserved (customProjectedValues persisted)

## Future Enhancements

### Possible Additions
1. **Connection awareness** - Detect offline/online status
2. **Optimistic UI** - Show cached data while loading fresh
3. **Background sync** - Periodically check for updates
4. **Version tracking** - Store scenario version for comparison
5. **Change notifications** - Alert user if DB was updated

### Not Recommended
- ❌ **Longer expiry** - 7 days is good balance
- ❌ **Persist full data** - Defeats staleness protection
- ❌ **No expiry** - Would allow indefinite staleness

## Debugging

### View Persisted State
```javascript
// In browser console
const state = JSON.parse(localStorage.getItem('radiantcare-state-v1'))
console.log('Persisted IDs:', {
  scenarioA: state.state.currentScenarioId,
  scenarioB: state.state.currentScenarioBId,
  currentYear: state.state.currentYearSettingId,
  age: (Date.now() - state.state._timestamp) / 1000 / 60 / 60 + 'h'
})
```

### Clear Persisted State
```javascript
localStorage.removeItem('radiantcare-state-v1')
// Then refresh page
```

### Check Auto-Load Logs
```javascript
// Watch console for:
[STORAGE] Loading persisted state (age: 2h, expires in: 166h)
[Multi-Year Init] Reloading scenario A from persisted ID: abc123
[YTD Init] Reloading from persisted ID: def456
```

## Summary

The hybrid persistence strategy provides the **best of both worlds**:
- 🎯 **Smooth UX** with persisted IDs and preferences
- 🔒 **Fresh data** always loaded from database
- 👥 **Multi-user safe** with no stale cache issues
- 💾 **Efficient** with smaller localStorage footprint

This approach is particularly well-suited for RadiantCare's needs:
- Multiple users editing scenarios
- External data source (QBO) that updates independently
- Need for instant reflection of database changes
- Desire for smooth user experience on return visits

