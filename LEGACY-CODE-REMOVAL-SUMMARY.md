# Legacy Code Removal Summary

## What Was Removed

Removed all references to `customProjectedValues` - a legacy grid override system that no longer exists.

## Background

**The Confusion:**
I initially thought Multi-Year view had a grid UI with unsaved edits that needed localStorage persistence.

**The Reality:**
- Multi-Year view has **slider-based editing** (YearPanel), not a grid
- Edits are tracked via `_overrides` flags on each year for **sparse saving**
- Only **YTD Detailed view** has a grid UI (uses `ytdCustomProjectedValues`)
- `customProjectedValues` was legacy from an old system that no longer exists

## Changes Made

### 1. Removed State Field
**Dashboard.tsx Line 85:**
```typescript
// BEFORE:
customProjectedValues: {},

// AFTER:
// REMOVED: customProjectedValues (legacy - never used in modular system)
// Multi-Year uses _overrides flags, YTD uses ytdCustomProjectedValues
```

### 2. Removed Methods
**Dashboard.tsx Lines 1470-1483:**
```typescript
// REMOVED (never called):
setCustomProjectedValue()
removeCustomProjectedValue()
resetCustomProjectedValues()
```

### 3. Removed from Store Type
**types.ts Line 256:**
```typescript
// BEFORE:
customProjectedValues: Record<string, number>

// AFTER:
// REMOVED: customProjectedValues (legacy - Multi-Year uses _overrides flags)
```

**types.ts Line 336-338:**
```typescript
// REMOVED from method signatures:
setCustomProjectedValue: (accountName: string, value: number) => void
removeCustomProjectedValue: (accountName: string) => void
resetCustomProjectedValues: () => void
```

### 4. Removed Snapshot References
**Dashboard.tsx ~15 locations:**
- Removed snapshot creation with `customProjectedValues`
- Removed snapshot restore of `customProjectedValues`
- Removed reset/revert operations on `customProjectedValues`
- Added comments explaining removal

### 5. Removed from Dirty Detection
**Dashboard.tsx Lines 1793-1797, 1817-1819:**
```typescript
// REMOVED: Step 4 - Compare future grid overrides (legacy customProjectedValues)
// Multi-Year has no grid UI, uses slider-based editing with _overrides flags
```

### 6. Stubbed Out Database Field
**Dashboard.tsx Line 2130:**
```typescript
future_custom_values: {}, // Legacy field - always empty (Multi-Year uses _overrides)
```

**Why stub instead of remove?**
- Backward compatibility with existing scenarios in database
- Database might have old scenarios with this field populated
- Graceful handling: load it (empty), ignore it, save as empty

### 7. Removed from Load/Save Operations
**Dashboard.tsx ~8 locations:**
- Removed extraction of `customProjectedValues` for saving
- Removed restoration of `customProjectedValues` from database
- Stubbed with comments explaining legacy status

### 8. Updated hasChangesFromLoadedScenario
**Dashboard.tsx Lines 3199-3200:**
```typescript
// REMOVED: Compare customProjectedValues (legacy)
// Multi-Year uses _overrides flags, not grid overrides
```

## What Remains (Active Code)

### YTD Grid Override System (Still Used)
```typescript
// Store field
ytdCustomProjectedValues: Record<string, number>

// Methods (actively called)
setYtdCustomProjectedValue()
removeYtdCustomProjectedValue()

// DB field
custom_projected_values  // For Current Year Settings
```

### Multi-Year Override System (Still Used)
```typescript
// Sparse saving via _overrides flags
futureYear._overrides = {
  therapyIncome: true,
  nonEmploymentCosts: true
  // etc.
}

// DB field
future_custom_values: {}  // Kept for backward compat, always empty
```

## Impact

### ✅ Benefits
- **Cleaner code**: Removed ~200 lines of dead code
- **Less confusion**: Clear separation between YTD (grid) and Multi-Year (sliders)
- **Accurate documentation**: HYBRID-PERSISTENCE-GUIDE.md now correct
- **Smaller localStorage**: One less field persisted

### ✅ No Breaking Changes
- Existing scenarios still load (backward compatible)
- `future_custom_values` field still exists in DB (stubbed as {})
- YTD grid system untouched (still works)
- Multi-Year slider system untouched (still works)

### ✅ Linter Clean
- No new errors introduced
- 2 pre-existing warnings remain (unrelated)

## Testing Verification

### Scenarios That Work
1. ✅ **Create new projection** - Saves with `future_custom_values: {}`
2. ✅ **Load old projection** - Loads `future_custom_values`, ignores it
3. ✅ **Edit via sliders** - Uses `_overrides` flags correctly
4. ✅ **Save with sparse saving** - Only saves years with overrides
5. ✅ **YTD grid edits** - Uses `ytdCustomProjectedValues` correctly

### What Was Removed Never Worked Anyway
- `customProjectedValues` was never written to (always empty)
- Methods were never called (dead code)
- Dirty detection checking it was pointless (always clean)

## Summary

Successfully removed all legacy `customProjectedValues` code from the modular system while:
- Maintaining backward compatibility
- Preserving YTD grid functionality
- Clarifying Multi-Year uses slider-based editing with sparse saving
- Cleaning up documentation

The codebase is now cleaner and more accurately reflects the actual architecture.

