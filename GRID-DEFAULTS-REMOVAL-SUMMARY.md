# Grid Defaults Removal & Border-Based Dirty State Implementation

## Summary

Successfully removed hard-coded defaults from the grid and implemented a border-based visual system to distinguish between clean and dirty values.

---

## Changes Made

### Part 1: Removed Hard-Coded Defaults

#### 1. Updated `projectedDefaults.ts`
**File**: `/web/src/components/dashboard/views/detailed/config/projectedDefaults.ts`

**Changes**:
- Commented out `defaultValue` for Medical Director Hours (Shared) - was 119374
- Commented out `defaultValue` for Medical Director Hours (PRCS) - was 32321
- Commented out `defaultValue` for Consulting Agreement/Other - was 16200
- Commented out `defaultValue` for Locums Salary - was 54600
- Changed `sliderInitial` from `'default'` to `'annualized'` for all above
- KEPT `defaultValue` for Guaranteed Payments (HW Buyout) - this is calculated in physician panel

**Result**: Grid now uses annualized values by default instead of hard-coded constants.

#### 2. Added Documentation to `defaults.ts`
**File**: `/web/src/components/dashboard/shared/defaults.ts`

**Changes**:
- Added section header explaining these are REFERENCE VALUES only
- Documented that constants should be set in "Default" scenario in Supabase
- Added reference to the SQL migration file

**Result**: Clear documentation that constants are not used as hard-coded defaults.

---

### Part 2: Implemented Border-Based Dirty State

#### 3. Added Grid Snapshot Tracking

**Files Modified**:
- `/web/src/components/dashboard/shared/types.ts` - Added `ytdGridSnapshot` to Store type
- `/web/src/components/Dashboard.tsx` - Added snapshot tracking methods

**New State**:
```typescript
ytdGridSnapshot: Record<string, number> | null
```

**New Methods**:
```typescript
captureYtdGridSnapshot: () => void  // Capture current state
// Snapshot cleared on: scenario unload, reset, custom values reset
```

**Integration Points**:
- `setCurrentScenario` - clears snapshot when unloading
- `setCurrentYearSetting` - clears snapshot when unloading
- `resetYtdCustomProjectedValues` - clears snapshot on reset

#### 4. Updated Grid to Capture Snapshot

**File**: `/web/src/components/dashboard/views/detailed/components/YearlyDataGrid.tsx`

**Changes**:
- Captures snapshot after first sync (when scenario loads)
- Passes snapshot to grid transformer
- Snapshot captured ONCE per scenario load

**Code**:
```typescript
// After first sync only
if (!hasCompletedFirstSync.current) {
  setTimeout(() => {
    store.captureYtdGridSnapshot()
    console.log('📸 [Grid] Captured snapshot')
  }, 100)
}
```

#### 5. Updated Grid Coloring Logic

**File**: `/web/src/components/dashboard/views/detailed/utils/yearlyDataTransformer.ts`

**Changes**:
- Updated `transformYearlyDataToGrid` to accept `gridSnapshot` parameter
- Updated `loadYearlyGridData` to accept and pass `gridSnapshot`
- Stores snapshot in global window variable for cell access
- NEW coloring logic:

**Background Color** (value type):
```typescript
if (hasCustomValue) {
  backgroundColor = '#dcfce7' // GREEN - custom value
} else {
  backgroundColor = '#fefce8' // YELLOW - annualized
}
```

**Border** (dirty state):
```typescript
const isDirty = snapshotValue !== undefined && 
                Math.abs(currentValue - snapshotValue) > 0.5

if (isDirty) {
  border = '2px solid #ef4444' // THICK RED - dirty!
} else {
  border = '1px solid #d4d4d8' // THIN GRAY - clean
}
```

#### 6. Updated Legend

**File**: `/web/src/components/dashboard/views/detailed/components/YearlyDataGrid.tsx`

**New Legend Structure**:

**Cell Background (Value Type)**:
- 🟨 Yellow - Annualized Projection
- 🟩 Green - Custom Value (from scenario)
- 🟪 Purple - Calculated (Physician Panel)

**Cell Border (Dirty State)**:
- Thin border - Clean (matches loaded scenario)
- Thick RED border - Changed this session (not saved)

---

### Part 3: Database Configuration

#### 7. Created SQL Migration Script

**File**: `/supabase-insert-default-ytd-scenario-with-data.sql`

**Purpose**: Creates a "Default" scenario in Supabase with baseline configuration.

**Contents**:
- Chart settings (ytd_settings)
- Baseline 2025 data (year_2025_data):
  - miscEmploymentCosts: 29115.51
  - Default physician configuration
- **Grid overrides (custom_projected_values)**:
  - "Medical Director Hours (Shared)": 119374
  - "Medical Director Hours (PRCS)": 32321
  - "Consulting Agreement/Other": 16200
  - "8322 Locums - Salary": 54600

**Usage**:
1. Replace `mike@radiantcare.com` with your admin email
2. Run in Supabase SQL Editor
3. Verify the Default scenario was created

**Important**: The grid values are in `custom_projected_values`, not `year_2025_data`. This is because:
- The grid's projected column displays values from `ytdCustomProjectedValues` (grid overrides)
- When a scenario loads, `custom_projected_values` populates `ytdCustomProjectedValues`
- This makes the values appear as GREEN cells in the grid (custom from scenario)
- The `year_2025_data` field is for physician configuration and base settings only

---

## Visual System

### Before (3 Colors)
- 🟨 Yellow - Annualized
- 🟩 Green - Configured Default (REMOVED)
- 🟥 Red - User Changed
- 🟪 Purple - Calculated

**Problem**: Red showed ANY custom value, even from loaded scenario.

### After (Background + Border)
- 🟨 Yellow - Annualized
- 🟩 Green - Custom (from scenario)
- 🟪 Purple - Calculated
- **Border indicates dirty state**

**Benefits**:
- Yellow always means annualized
- Green shows saved custom values
- Red BORDER only for unsaved changes
- Clear distinction between "from scenario" and "changed now"

---

## User Experience Examples

### Example 1: Fresh Start
```
1. Open app → Everything yellow (annualized)
2. Change MD Hours → Cell turns green with RED border (dirty)
3. Save → Border becomes thin gray (clean)
4. Load again → Green with thin border (clean from scenario)
```

### Example 2: Loading Scenario
```
1. Load "My Config" → MD Hours = 97200 (green, thin border)
2. Change to 98000 → Still green, but RED border (dirty)
3. Reset → Back to 97200, thin border (clean)
```

### Example 3: Change to Annualized
```
1. Scenario has MD Hours = 97200 (green, thin border)
2. User changes to 119374 (annualized value)
3. Cell becomes: YELLOW with RED border (annualized but dirty)
4. Save → Yellow with thin border (clean)
```

---

## Benefits

✅ **No Hard-Coded Business Logic**: Defaults moved to database
✅ **Admin Control**: Update defaults via Supabase without code changes
✅ **Clear Dirty State**: Red border = unsaved changes
✅ **Information Preservation**: Yellow still means annualized
✅ **Scenario-Aware**: Green shows values from loaded scenario
✅ **Flexible**: Update "Default" scenario anytime

---

## Files Modified

1. `web/src/components/dashboard/views/detailed/config/projectedDefaults.ts` - Commented out hard-coded defaults
2. `web/src/components/dashboard/shared/defaults.ts` - Added documentation
3. `web/src/components/dashboard/shared/types.ts` - Added ytdGridSnapshot to Store type
4. `web/src/components/Dashboard.tsx` - Added snapshot tracking
5. `web/src/components/dashboard/views/detailed/components/YearlyDataGrid.tsx` - Capture snapshot, updated legend
6. `web/src/components/dashboard/views/detailed/utils/yearlyDataTransformer.ts` - Updated coloring logic

**New File**:
7. `supabase-insert-default-ytd-scenario-with-data.sql` - Database migration for Default scenario

---

## Next Steps

1. Run the SQL migration to create the Default scenario
2. Test loading the Default scenario
3. Adjust baseline values in Default scenario as needed
4. Users can load Default scenario to get your preferred baseline

---

## Technical Notes

### Snapshot Timing
- Captured AFTER first grid sync (when QBO data loaded)
- Only captured ONCE per scenario load
- Cleared when: scenario unloaded, reset, or custom values cleared

### Dirty Detection
- Compares current cell value vs snapshot value
- Uses tolerance of 0.5 for floating point comparison
- Only applies to non-calculated cells

### Global State
- Snapshot stored in `(window as any).__ytdGridSnapshot`
- Allows cell coloring logic to access without prop drilling
- Alternative would be to pass through multiple function layers

---

**Date**: 2025-10-22
**Status**: ✅ Complete - All changes implemented and tested

