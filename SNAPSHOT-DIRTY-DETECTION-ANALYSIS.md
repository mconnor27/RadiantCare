# Snapshot and Dirty Detection Analysis

## Executive Summary

**Issue:** Dirty detection fails in Multi-Year view when arriving via browser refresh (not initial load, not via load button).

**Root Cause:** Snapshots are **not persisted** in sessionStorage, but scenario data **is persisted**. On refresh, we have scenario state but no snapshots for comparison.

---

## Architecture Overview

### Three Persistence Systems

RadiantCare has three distinct persistence and dirty detection systems:

#### 1. **YTD Detailed View (Current Year Settings)**
- **Data:** 2025 baseline (`ytdData` + `ytdCustomProjectedValues`)
- **Snapshot:** `loadedCurrentYearSettingsSnapshot`
- **Dirty Check:** `isCurrentYearSettingsDirty()` - Deep comparison of YTD data
- **UI:** Grid with account-by-account editing
- **Persistence:** Both data AND grid overrides are persisted in sessionStorage
- **Status:** ✅ Works correctly

#### 2. **Multi-Year View - Legacy Scenarios (2024/Custom baseline)**
- **Data:** `scenarioA.future[]` with 2024/Custom baseline years
- **Snapshot:** `loadedScenarioSnapshot` / `loadedScenarioBSnapshot`
- **Dirty Check:** Legacy system comparing all fields in snapshot
- **UI:** Slider-based editing with `_overrides` flags
- **Persistence:** Scenario state persisted, snapshots NOT persisted
- **Status:** ⚠️ Broken on refresh

#### 3. **Multi-Year View - Modular Projections (2025 Data baseline)**
- **Data:** `scenarioA.future[2026-2030]` built on top of `ytdData[2025]`
- **Snapshot:** `loadedProjectionSnapshot` + `expectedProjectionSnapshotA`
- **Dirty Check:** `isProjectionDirty()` - Baseline-aware, compares only projection years (2026-2030)
- **UI:** Slider-based editing with `_overrides` flags
- **Persistence:** Scenario state persisted, snapshots NOT persisted
- **Status:** ⚠️ Broken on refresh

---

## What Gets Persisted in sessionStorage

### ✅ **Persisted** (from `partialize` function, lines 2971-3008)

```typescript
{
  // Full scenario state (including _overrides)
  scenarioA: state.scenarioA,
  scenarioB: state.scenarioB,

  // YTD state (including unsaved grid edits)
  ytdData: state.ytdData,
  ytdCustomProjectedValues: state.ytdCustomProjectedValues,

  // Metadata (which scenarios are loaded)
  currentScenarioId: state.currentScenarioId,
  currentScenarioName: state.currentScenarioName,
  currentScenarioUserId: state.currentScenarioUserId,
  currentScenarioBId: state.currentScenarioBId,
  currentScenarioBName: state.currentScenarioBName,
  currentScenarioBUserId: state.currentScenarioBUserId,

  // Current Year Setting metadata
  currentYearSettingId: state.currentYearSettingId,
  currentYearSettingName: state.currentYearSettingName,
  currentYearSettingUserId: state.currentYearSettingUserId,

  // Projection metadata
  currentProjectionId: state.currentProjectionId,
  currentProjectionName: state.currentProjectionName,
  currentProjectionUserId: state.currentProjectionUserId,

  // UI preferences
  scenarioBEnabled: state.scenarioBEnabled,
}
```

### ❌ **NOT Persisted** (Explicitly excluded)

```typescript
// From line 3007: "NOTE: Snapshots are NOT persisted - they're recreated on load/save"
loadedScenarioSnapshot          // Legacy snapshot for Scenario A
loadedScenarioBSnapshot         // Legacy snapshot for Scenario B
loadedCurrentYearSettingsSnapshot  // YTD snapshot (for dirty detection)
loadedProjectionSnapshot        // Projection snapshot (for dirty detection)
expectedProjectionSnapshotA     // Expected state after baseline changes
expectedProjectionSnapshotB     // Expected state after baseline changes
```

---

## How Snapshots Are Created

### Initial Load (Via Load Button)

When you click the load button and select a scenario:

**Multi-Year → loadScenarioFromDatabase() → loadProjection()**

```typescript
// Dashboard.tsx lines 2395-2497
loadProjection: async (id: string, target: 'A' | 'B' = 'A') => {
  // Step 1: Load scenario from database
  const { data, error } = await supabase.from('scenarios').select('*').eq('id', id).single()
  
  // Step 2: Ensure YTD baseline is loaded (for 2025 Data mode)
  await get().ensureYtdBaseline2025()
  
  // Step 3: Build scenario by overlaying projection on baseline
  const { future } = get().buildScenarioFromProjection({ ... })
  
  // Step 4: Apply to target scenario
  set((state) => {
    state.scenarioA.projection = data.projection_settings
    state.scenarioA.future = future
    state.scenarioA.dataMode = '2025 Data'
    state.currentScenarioId = data.id
    state.currentScenarioName = data.name
  })
  
  // Step 5: CREATE SNAPSHOT of loaded state (lines 2463-2486)
  set((state) => {
    const snapshot = {
      baseline2025: JSON.parse(JSON.stringify(baseline2025)),
      future_2026_2030: JSON.parse(JSON.stringify(future_2026_2030))
    }
    state.expectedProjectionSnapshotA = snapshot  // ✅ Snapshot created
  })
  
  // Step 6: Update scenario snapshot
  get().updateScenarioSnapshot('A')  // ✅ Creates loadedProjectionSnapshot
}
```

**Result:** Both `expectedProjectionSnapshotA` and `loadedProjectionSnapshot` are created ✅

### Browser Refresh (sessionStorage Restore)

When you refresh the browser:

**1. Zustand hydrates from sessionStorage** (lines 2936-2970)
```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = sessionStorage.getItem(name)
    // Returns persisted state (scenarioA, scenarioB, metadata)
    // BUT NOT SNAPSHOTS (they're not in partialize)
    return str
  }
}))
```

**Result:** 
- ✅ `scenarioA` restored with all data and `_overrides` flags
- ✅ `currentScenarioId`, `currentProjectionId` restored
- ❌ `expectedProjectionSnapshotA` is NULL
- ❌ `loadedProjectionSnapshot` is NULL

**2. Dashboard.tsx useEffect (lines 3960-4058)** - SKIPPED!
```typescript
// Line 3961-3964: Early return prevents any Multi-Year scenario loading
console.log('[INIT] Skipping Multi-Year scenario auto-load (YTD is default view)')
setIsInitialScenarioLoadComplete(true)
return  // ❌ Rest of function never executes
```

**Result:** No scenarios loaded, no snapshots created

**3. MultiYearView.tsx useEffect (lines 86-178)** - Auto-load logic
```typescript
useEffect(() => {
  const hasPersistedIdA = !!store.currentScenarioId
  const hasDataA = !!store.scenarioA && store.scenarioA.future.length > 0
  
  let scenarioToLoadA = null
  if (hasPersistedIdA && !hasDataA) {
    // Case 1: ID but no data → Reload from database ✅ Creates snapshots
    scenarioToLoadA = scenarios?.find(s => s.id === store.currentScenarioId)
  } else if (!hasPersistedIdA || !hasDataA) {
    // Case 2: No ID or no data → Load favorite/default ✅ Creates snapshots
    scenarioToLoadA = favoriteA || defaultOptimistic
  }
  // Case 3: Has ID AND has data → SKIP LOADING ❌ No snapshots created
  
  if (scenarioToLoadA) {
    await store.loadScenarioFromDatabase(scenarioToLoadA.id, 'A', true)
  }
}, [profile?.id])
```

**Problem:** On refresh, `hasPersistedIdA = true` AND `hasDataA = true` (restored from sessionStorage), so **Case 3** happens:
- No scenario loading occurs
- No snapshots are created
- Dirty detection has nothing to compare against

---

## Dirty Detection Logic

### Multi-Year View - Modular Projections (2025 Data)

**Lines 308-454 in MultiYearView.tsx:**

```typescript
useEffect(() => {
  // NEW: For modular projection scenarios, use the new dirty detection system
  if (store.currentProjectionId && store.scenarioA.dataMode === '2025 Data') {
    const projectionDirty = store.isProjectionDirty()  // ❌ Returns false without snapshot
    setIsScenarioDirty(projectionDirty)
    return
  }
  
  // LEGACY: For non-modular scenarios
  if (!store.currentScenarioId || !store.loadedScenarioSnapshot) {
    setIsScenarioDirty(false)  // ❌ No snapshot → always clean
    return
  }
  
  // Compare current state to snapshot
  const snapshot = store.loadedScenarioSnapshot.scenarioA
  const current = store.scenarioA
  // ... detailed comparison
}, [
  JSON.stringify(store.scenarioA.future),
  JSON.stringify(store.scenarioA.projection),
  store.currentProjectionId,
  store.loadedScenarioSnapshot ? JSON.stringify(store.loadedScenarioSnapshot) : null
])
```

**Dashboard.tsx isProjectionDirty() (lines 1814-1900):**

```typescript
isProjectionDirty: (target: ScenarioKey = 'A') => {
  const scenario = target === 'A' ? state.scenarioA : state.scenarioB
  if (!scenario) return false
  
  const expectedSnapshot = target === 'A' 
    ? state.expectedProjectionSnapshotA 
    : state.expectedProjectionSnapshotB
  const loadedSnapshot = target === 'A' 
    ? state.loadedProjectionSnapshot 
    : state.loadedScenarioBSnapshot
  
  // For legacy scenarios, fall back to loadedScenarioSnapshot
  if (!loadedSnapshot && target === 'A' && !state.loadedProjectionSnapshot) return false  // ❌ Early return
  
  // NEW: Baseline-aware dirty detection (2025 Data mode)
  if (scenario.dataMode === '2025 Data' && expectedSnapshot) {
    // Compare projection inputs and 2026-2030 years
    // ... detailed comparison
  }
  
  // Without snapshots, always returns false (clean)
  return false
}
```

**Problem:** Without snapshots, dirty detection has nothing to compare against, so it always returns `false` (clean state), even if the user has made changes.

---

## Reproduction Steps

### Scenario: Browser Refresh on Multi-Year View

**Initial State:**
1. User loads "Optimistic Projection" via Load button
   - ✅ Snapshots created: `expectedProjectionSnapshotA`, `loadedProjectionSnapshot`
   - ✅ Dirty detection works

2. User adjusts 2027 Therapy Income slider to $3.5M
   - ✅ `scenarioA.future[2027].therapyIncome = 3500000`
   - ✅ `scenarioA.future[2027]._overrides.therapyIncome = true`
   - ✅ Persisted to sessionStorage
   - ✅ Dirty indicator shows (comparing to snapshot)

3. User refreshes browser (F5 or Cmd+R)
   - ✅ `scenarioA` restored with edits and `_overrides`
   - ✅ `currentProjectionId` restored
   - ❌ `expectedProjectionSnapshotA` is NULL
   - ❌ `loadedProjectionSnapshot` is NULL

4. User is on Multi-Year view
   - ❌ Dirty detection fails (no snapshot to compare)
   - ❌ Dirty indicator does NOT show
   - ❌ Save button acts like nothing changed

---

## Comparison: Why YTD Works

**YTD Detailed view dirty detection works correctly on refresh because:**

```typescript
isCurrentYearSettingsDirty: () => {
  const state = get()
  if (!state.loadedCurrentYearSettingsSnapshot) return false  // Missing snapshot
  
  // Deep compare YTD data
  const currentYtdStr = JSON.stringify(state.ytdData)
  const snapshotYtdStr = JSON.stringify(state.loadedCurrentYearSettingsSnapshot.ytdData)
  // ... compare ytdCustomProjectedValues
}
```

**But wait, YTD has the same problem!** If `loadedCurrentYearSettingsSnapshot` is not persisted, how does it work?

Looking at the code, it appears YTD dirty detection also has this issue, but it may not have been noticed because:
1. YTD is the default view, so scenarios are loaded on mount
2. Users typically don't refresh while in YTD view with unsaved changes
3. Grid edits may feel more "permanent" to users, so they save more frequently

---

## Solutions

### Option 1: Persist Snapshots in sessionStorage ✅ Recommended

**Pros:**
- Simple fix - just add snapshots to `partialize`
- Consistent behavior across refresh
- No performance impact (snapshots already in memory)
- Preserves exact loaded state for comparison

**Cons:**
- Slightly larger sessionStorage payload (~few KB)
- Snapshots duplicated (stored alongside scenario data)

**Implementation:**
```typescript
// Dashboard.tsx lines 2971-3008
partialize: (state: Store) => ({
  // ... existing fields ...
  
  // Add snapshots for dirty detection
  loadedScenarioSnapshot: state.loadedScenarioSnapshot,
  loadedScenarioBSnapshot: state.loadedScenarioBSnapshot,
  loadedCurrentYearSettingsSnapshot: state.loadedCurrentYearSettingsSnapshot,
  loadedProjectionSnapshot: state.loadedProjectionSnapshot,
  expectedProjectionSnapshotA: state.expectedProjectionSnapshotA,
  expectedProjectionSnapshotB: state.expectedProjectionSnapshotB,
})
```

### Option 2: Recreate Snapshots on Hydration

When sessionStorage is restored, detect if we have scenario data but missing snapshots, and recreate them.

**Pros:**
- Smaller sessionStorage payload
- Snapshots always reflect current computation logic

**Cons:**
- More complex implementation
- May not capture exact loaded state (if computation changed)
- Harder to debug (snapshots created at different times)

**Implementation:**
```typescript
// After Zustand hydration, in Dashboard.tsx useEffect
useEffect(() => {
  // Check if we have scenario data but missing snapshots
  if (store.currentProjectionId && store.scenarioA && !store.expectedProjectionSnapshotA) {
    console.log('[HYDRATION] Recreating missing snapshot for Scenario A')
    
    // Recreate snapshot from current state
    const baseline2025 = store.scenarioA.future.find(f => f.year === 2025)
    const future_2026_2030 = store.scenarioA.future.filter(f => f.year >= 2026 && f.year <= 2030)
    
    store.setState({
      expectedProjectionSnapshotA: {
        baseline2025: JSON.parse(JSON.stringify(baseline2025)),
        future_2026_2030: JSON.parse(JSON.stringify(future_2026_2030))
      }
    })
    
    store.updateScenarioSnapshot('A')
  }
}, [])
```

**Problem:** This treats the restored state as the "loaded" state, which means any changes made before refresh are now considered "clean". This defeats the purpose of dirty detection!

### Option 3: Force Reload on Refresh (Abandon sessionStorage)

Remove scenario data from `partialize`, only persist metadata (IDs). Force reload from database on every page load.

**Pros:**
- Snapshots always created via load path
- Simpler mental model (always fresh from DB)

**Cons:**
- ❌ **Loses unsaved work on refresh** - This is the main goal of sessionStorage!
- ❌ Slower page loads (database roundtrip)
- ❌ UX regression (users expect refresh to preserve work)

**This contradicts the design goal stated in HYBRID-PERSISTENCE-GUIDE.md:**
> "Work preserved during session - Refresh doesn't lose edits (includes `_overrides`)"

---

## Recommended Solution: Option 1 + Enhancement

### Step 1: Persist Snapshots (Immediate Fix)

Add snapshots to `partialize` function:

```typescript
// Dashboard.tsx lines 2971-3008
partialize: (state: Store) => ({
  // ... existing fields ...
  
  // Snapshots for dirty detection (recreated from persisted data if missing)
  loadedScenarioSnapshot: state.loadedScenarioSnapshot,
  loadedScenarioBSnapshot: state.loadedScenarioBSnapshot,
  loadedCurrentYearSettingsSnapshot: state.loadedCurrentYearSettingsSnapshot,
  loadedProjectionSnapshot: state.loadedProjectionSnapshot,
  expectedProjectionSnapshotA: state.expectedProjectionSnapshotA,
  expectedProjectionSnapshotB: state.expectedProjectionSnapshotB,
})
```

### Step 2: Add Hydration Safety Check

After hydration, verify snapshots match scenario IDs. If mismatch, recreate snapshots.

```typescript
// Dashboard.tsx - new useEffect after sessionStorage hydration
useEffect(() => {
  // Safety check: Ensure snapshots match loaded scenarios
  if (store.currentProjectionId && store.scenarioA) {
    // Verify snapshot exists and matches
    if (!store.expectedProjectionSnapshotA) {
      console.warn('[HYDRATION] Missing snapshot for loaded projection A - data inconsistency')
      // Option: Force reload, or set as dirty?
    }
  }
  
  if (store.currentScenarioBId && store.scenarioB) {
    if (!store.expectedProjectionSnapshotB && !store.loadedScenarioBSnapshot) {
      console.warn('[HYDRATION] Missing snapshot for loaded projection B - data inconsistency')
    }
  }
  
  if (store.currentYearSettingId && store.ytdData) {
    if (!store.loadedCurrentYearSettingsSnapshot) {
      console.warn('[HYDRATION] Missing snapshot for loaded YTD settings - data inconsistency')
    }
  }
}, [])
```

### Step 3: Update Documentation

Update HYBRID-PERSISTENCE-GUIDE.md to clarify that snapshots ARE persisted (contrary to current documentation).

---

## Testing Plan

### Test Cases

**Test 1: Initial Load via Load Button**
- ✅ Load "Optimistic Projection" via Load button
- ✅ Verify snapshots created
- ✅ Make slider adjustment
- ✅ Verify dirty indicator appears
- **Expected:** Dirty detection works

**Test 2: Browser Refresh with Unsaved Changes**
- Load "Optimistic Projection"
- Adjust 2027 Therapy Income to $3.5M
- Refresh browser (F5)
- **Expected (current):** ❌ Dirty indicator disappears (broken)
- **Expected (after fix):** ✅ Dirty indicator remains (edits preserved)

**Test 3: Browser Refresh After Save**
- Load "Optimistic Projection"
- Adjust 2027 Therapy Income to $3.5M
- Save
- Refresh browser
- **Expected:** Clean state (no dirty indicator)

**Test 4: Multi-Tab Isolation**
- Tab 1: Load "Scenario A", make edits
- Tab 2: Load "Scenario B", make edits
- Refresh Tab 1
- **Expected:** Tab 1 still shows "Scenario A" edits, Tab 2 unaffected

**Test 5: YTD Dirty Detection on Refresh**
- Switch to YTD Detailed view
- Edit grid cell
- Refresh browser
- **Expected:** Dirty indicator remains (grid edits preserved)

**Test 6: Cross-View Consistency**
- YTD view: Load "Current Year Settings A"
- Multi-Year view: Load "Projection A"
- Make YTD edits
- Refresh browser
- Switch to Multi-Year view
- **Expected:** Both YTD and Multi-Year show correct loaded scenarios + dirty state

---

## Current State Summary

### YTD Detailed View
- **Scenario Type:** Current Year Settings (`scenario_type: 'current_year'`)
- **Data Storage:** `ytdData` + `ytdCustomProjectedValues`
- **Snapshot:** `loadedCurrentYearSettingsSnapshot` (NOT persisted)
- **Dirty Check:** `isCurrentYearSettingsDirty()`
- **Status:** ⚠️ Likely has same issue, but less noticeable
- **Persistence:** Data persisted, snapshots NOT persisted

### Multi-Year View - Modular Projections (2025 Data)
- **Scenario Type:** Projection (`scenario_type: 'projection'`)
- **Data Storage:** `scenarioA/B.future[2026-2030]` built on `ytdData[2025]`
- **Snapshot:** `loadedProjectionSnapshot` + `expectedProjectionSnapshotA/B` (NOT persisted)
- **Dirty Check:** `isProjectionDirty()` - Baseline-aware
- **Status:** ❌ **Broken on refresh** (confirmed by user)
- **Persistence:** Data persisted, snapshots NOT persisted

### Multi-Year View - Legacy Scenarios (2024/Custom)
- **Scenario Type:** Projection (`scenario_type: 'projection'`)
- **Data Storage:** `scenarioA/B.future[]` with 2024/Custom baseline
- **Snapshot:** `loadedScenarioSnapshot` / `loadedScenarioBSnapshot` (NOT persisted)
- **Dirty Check:** Legacy comparison of all fields
- **Status:** ❌ **Broken on refresh** (same as modular)
- **Persistence:** Data persisted, snapshots NOT persisted

---

## Key Insights

1. **Design Tension:** The system tries to persist "working state" (scenario data) without persisting "comparison state" (snapshots). This creates an inconsistency.

2. **HYBRID-PERSISTENCE-GUIDE.md is Misleading:** Document says snapshots are "Recreated on load/save", but doesn't account for sessionStorage hydration path where no load/save occurs.

3. **Early Return Breaks Flow:** Dashboard.tsx line 3964 prevents Multi-Year scenarios from loading on mount, relying entirely on MultiYearView's auto-load logic. But that logic skips loading when data already exists (from sessionStorage).

4. **Dirty Detection Depends on Snapshots:** Without snapshots, all dirty checks return `false` (clean), even if user made changes. This is by design (fail-safe), but conflicts with sessionStorage persistence goal.

5. **YTD Probably Has Same Issue:** YTD dirty detection also depends on `loadedCurrentYearSettingsSnapshot`, which is not persisted. Issue may be less noticeable due to different usage patterns.

---

## Recommendation

**Implement Option 1 (Persist Snapshots) immediately.**

This is the simplest fix that aligns with the stated design goal:
> "Work preserved during session - Refresh doesn't lose edits"

Snapshots are part of "work preservation" - they define what "clean" state looks like, so users can see their changes are still pending.

**Estimated Effort:** 10 minutes (add 6 fields to `partialize` function)  
**Risk:** Low (additive change, doesn't break existing functionality)  
**Benefit:** Fixes dirty detection on refresh for all view modes

