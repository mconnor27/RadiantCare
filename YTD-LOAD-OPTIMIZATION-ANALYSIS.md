# YTD Detailed Load Flow - Problems & Solutions

## Executive Summary

The YTD Detailed view has **2 critical issues** causing excessive re-renders (10+ cascading cycles) after initial data load:

1. **Multiple redundant baseline recomputations**: Grid sync calls `setYtdValue` 10+ times, each triggering a separate `recomputeProjectionsFromBaseline` → **10+ render cycles**
2. **ViewMode effect with wrong dependencies**: Runs on every store change instead of only when viewMode changes → **Cluttered logs, minor perf hit**

The root cause is that `setYtdValue` doesn't batch or debounce the expensive recomputation operations, and React effects have overly broad dependencies that trigger on QBO sync data rather than only on user edits.

---

## 🔴 Critical Issue #1: ViewMode Effect Re-triggers on Every Store Change

### Problem
**Location**: `Dashboard.tsx:3729-3732`
```typescript
useEffect(() => {
  store.setLastViewMode(viewMode)
  console.log(`[ViewMode] Changed to: ${viewMode}`)
}, [viewMode, store])  // ❌ 'store' dependency causes re-runs
```

**Log Evidence**:
```
[Log] [ViewMode] Changed to: YTD Detailed  (repeats 8+ times)
```

### Root Cause
In Zustand, calling `const store = useDashboardStore()` subscribes to ALL state changes. This means the component re-renders whenever ANY store property changes. Including `store` in the effect dependencies makes the effect run on every one of those re-renders, even though `viewMode` hasn't changed.

### Impact
- Unnecessary re-execution every render (8+ times during load)
- Cluttered logs making debugging harder
- Minor performance degradation

### Solution
**Remove `store` from dependencies** - you still have access to `store` object, but the effect only runs when `viewMode` changes:
```typescript
useEffect(() => {
  store.setLastViewMode(viewMode)
  console.log(`[ViewMode] Changed to: ${viewMode}`)
}, [viewMode])  // ✅ Only re-run when viewMode actually changes
// ✅ store is still accessible (closure), we just don't track it as a dependency
```

**Note**: This only removes the dependency for this effect. The `store` object is still used everywhere else in the component normally.

---

## 🔴 Critical Issue #2: Multiple Redundant Baseline Recomputations

### Problem
**Location**: Multiple places in the sync chain

**Log Evidence**:
After grid sync changes `therapyIncome` from 0 → 3145969, this pattern repeats **7+ times**:
```
[ViewMode] Changed to: YTD Detailed
📦 [getYtdBaselineFutureYear2025] (called TWICE per cycle!)
📸 [snapshotExpectedProjection]
[Connor] Render
[Dirty Check] No changes detected
```

### Root Cause - THE REAL PROBLEM

**Step 1**: Grid sync calls `store.setYtdValue()` 10+ times (once per field)
```typescript
// YearlyDataGrid.tsx lines 136-173
store.setYtdValue('therapyIncome', therapyIncomeTotal)       // Call 1
store.setYtdValue('nonEmploymentCosts', nonEmpCosts)         // Call 2
store.setYtdValue('therapyLacey', laceyValue)                // Call 3
store.setYtdValue('therapyCentralia', centraliaValue)        // Call 4
// ... 6+ more calls
```

**Step 2**: EACH `setYtdValue` schedules a `recomputeProjectionsFromBaseline`
```typescript
// Dashboard.tsx line 255-260
setYtdValue: (field, value) => {
  set((state) => {
    // ... update value
    
    setTimeout(() => {
      get().recomputeProjectionsFromBaseline()  // ❌ Scheduled 10+ times!
    }, 0)
  })
}
```

**Step 3**: All 10+ setTimeout callbacks fire, each causing:
1. `getYtdBaselineFutureYear2025()` called twice
2. `snapshotExpectedProjection()` called
3. Store state updated
4. ALL subscribers (including YTDDetailed) re-render
5. Dirty check effects run (because `JSON.stringify(fy2025)` dependency changes)
6. Repeat for next setTimeout callback...

### The Cascade Chain
```
Grid Sync
  └─> setYtdValue × 10+
       └─> setTimeout(recomputeProjectionsFromBaseline) × 10+
            └─> Store Update × 10+
                 └─> YTDDetailed Re-render × 10+
                      └─> ViewMode Effect × 10+ (Issue #1)
                      └─> Dirty Check Effects × 10+
```

### Impact
- **Performance**: 10+ unnecessary baseline recomputations
- **UX**: Visible delay/flicker during load (compensation table freezes for 1+ seconds)
- **Debugging**: Impossible to tell what's actually changing

### Solution

The fix requires changes at **two levels**:

#### Fix A: Debounce Baseline Recomputation (Critical - Stops the 10+ calls)
```typescript
// Dashboard.tsx - In the store definition
let recomputeTimeout: NodeJS.Timeout | null = null

setYtdValue: (field, value) => {
  set((state) => {
    // ... update value
    
    // Clear any pending recomputation
    if (recomputeTimeout) {
      clearTimeout(recomputeTimeout)
    }
    
    // Schedule a SINGLE recomputation after all updates settle
    recomputeTimeout = setTimeout(() => {
      get().recomputeProjectionsFromBaseline()
      recomputeTimeout = null
    }, 50)  // 50ms debounce - batches all grid sync calls into one
  })
}
```

This ensures that even if `setYtdValue` is called 10 times in quick succession, `recomputeProjectionsFromBaseline` only runs ONCE after they all complete.

#### Fix B: Skip Recomputation During Grid Sync (Better - Avoids unnecessary work)
```typescript
// Dashboard.tsx - Add a flag to track grid sync
setYtdValue: (field, value, options?: { skipRecompute?: boolean }) => {
  set((state) => {
    // ... update value
  })
  
  // Only trigger recomputation if not explicitly skipped
  if (!options?.skipRecompute) {
    setTimeout(() => {
      get().recomputeProjectionsFromBaseline()
    }, 0)
  }
}

// YearlyDataGrid.tsx - Pass skipRecompute flag during sync
store.setYtdValue('therapyIncome', value, { skipRecompute: true })
store.setYtdValue('nonEmploymentCosts', value, { skipRecompute: true })
// ... all other sync calls

// Then manually trigger ONE recomputation after all syncs complete
store.recomputeProjectionsFromBaseline()
```

#### Fix C: Optimize Dirty Check Dependencies (Reduces re-render sensitivity)
Even with fixes A or B, the dirty checks still trigger too often. Optimize them:

```typescript
// In YTDDetailed.tsx, create a memoized "signature" of USER-EDITABLE fields only
const ytdDataSignature = useMemo(() => {
  if (!fy2025) return null
  return {
    locumCosts: fy2025.locumCosts,
    medicalDirectorHours: fy2025.medicalDirectorHours,
    prcsMedicalDirectorHours: fy2025.prcsMedicalDirectorHours,
    prcsMdHoursMode: fy2025.prcsMdHoursMode,
    prcsDirectorPhysicianId: fy2025.prcsDirectorPhysicianId,
    consultingServicesAgreement: fy2025.consultingServicesAgreement,
    physiciansCount: fy2025.physicians?.length,
    // ❌ DON'T include: therapyIncome, nonEmploymentCosts (calculated from QBO cache)
  }
}, [
  fy2025?.locumCosts,
  fy2025?.medicalDirectorHours,
  fy2025?.prcsMedicalDirectorHours,
  fy2025?.prcsMdHoursMode,
  fy2025?.prcsDirectorPhysicianId,
  fy2025?.consultingServicesAgreement,
  fy2025?.physicians?.length
])

// Then use it in dirty checks:
useEffect(() => {
  // ... dirty check logic
}, [
  store.currentYearSettingId,
  store.loadedCurrentYearSettingsSnapshot,
  ytdDataSignature,  // ✅ Only changes when USER actually edits something
  JSON.stringify(store.ytdCustomProjectedValues)
])
```

**Recommended Approach**: Implement **Fix B** (cleanest) + **Fix C** (prevents false positives)


---

## 🟡 Redundancy Issue #3: Grid Loads Twice

### Problem
**Log Evidence**:
```
[Log] 🔄 [Grid loadData] Called!
[Log] ⏳ Waiting for fresh cached data...
... (scenario loads) ...
[Log] 🔄 [Grid loadData] Called!  // Second time
[Log] 🔍 [Grid loadData] Physician data from store: ...
```

### Root Cause
Grid initializes before scenario data is ready, attempts to load (waits for cache), then loads again after scenario loads.

### Impact
- Minor performance hit
- Confusing logs

### Solution
**Defer grid rendering** until scenario is loaded:
```typescript
// In YTDDetailed.tsx
{currentScenarioName && (
  <YearlyDataGrid
    // ... props
  />
)}
```

---

## 🟡 Redundancy Issue #4: Snapshot Timing Mismatch

### Problem
**Log Evidence**:
```
[Log] 📸 [YTD] Updating YTD snapshot after first QBO cache sync
[Log] 📊 [YTD] Store state after sync: {therapyIncome: 0, ...}  // Still 0!?
```

Yet the sync log right before shows `therapyIncome: 3145969`.

### Root Cause
The debug log at `YearlyDataGrid.tsx:444` is reading from the store BEFORE React has actually committed the state update.

### Solution
**Remove or move the debug log** after state updates complete:
```typescript
// Use requestAnimationFrame to wait for React commit
requestAnimationFrame(() => {
  console.log('📊 [YTD] Store state after sync:', {
    therapyIncome: store.ytdData?.therapyIncome,
    // ...
  })
})
```

Or just remove the log entirely since it's misleading.

---

## 🟡 Redundancy Issue #5: PhysiciansEditor Renders Multiple Times

### Problem
**Log Evidence**:
```
[Log] [Connor] Render - employeePortionOfYear: 0  (repeats 15+ times)
```

### Impact
- Minor performance hit
- Cluttered logs

### Solution
**Memoize PhysiciansEditor** or optimize its dependencies to prevent unnecessary re-renders.

---

## Recommended Implementation Order

### Phase 1: Quick Wins (15 minutes)
1. ✅ Fix ViewMode effect dependencies (Issue #1)
2. ✅ Remove misleading snapshot timing log (Issue #5)

### Phase 2: Core Optimization (1-2 hours)
3. ✅ Add skipRecompute flag to setYtdValue (Issue #2, Fix B)
4. ✅ Update grid sync to use skipRecompute flag (Issue #2, Fix B)
5. ✅ Implement shallow comparison for dirty checks (Issue #2, Fix C)

### Phase 3: Polish (30 minutes)
6. ✅ Defer grid rendering until scenario loaded (Issue #3)
7. ✅ Remove misleading snapshot timing log (Issue #4)
8. ✅ Memoize PhysiciansEditor (Issue #5)

---

## Expected Results After Fixes

### Before (Current)
```
Initial load → Scenario load → Grid sync → 7+ re-render cycles → Stabilize
```

### After (Optimized)
```
Initial load → Scenario load → Grid sync → Stabilize (no cascade)
```

### Log Reduction
- **ViewMode logs**: 8+ → 1
- **Baseline/Snapshot logs**: 7+ cycles → 1
- **PhysiciansEditor renders**: 15+ → 3-4
- **Overall render count**: ~40+ → ~10

---

## Testing Checklist

After implementing fixes, verify:
- [ ] Initial load completes in <2 seconds
- [ ] Only 1 "ViewMode Changed" log on load
- [ ] Only 1 snapshot taken after grid sync (not 7+)
- [ ] Dirty detection still works correctly when user edits values
- [ ] Grid values display correctly
- [ ] Compensation table displays correctly
- [ ] No visual flicker/delay after load

