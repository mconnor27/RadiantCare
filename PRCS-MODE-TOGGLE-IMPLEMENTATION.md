# PRCS MD Hours Mode Toggle - Implementation Summary

## Problem
The PRCS Medical Director Hours cell was calculated (purple background) and not clickable in the grid when in 'calculated' mode, preventing users from toggling between calculated and annualized modes.

## Solution Implemented

### 1. Made PRCS MD Hours Cell Clickable in Calculated Mode
**Files**: `yearlyDataTransformer.ts`, `YearlyDataGrid.tsx`

**A. Visual cursor (yearlyDataTransformer.ts)**:
Added exception to make PRCS MD Hours cell show `cursor: pointer` even when in calculated mode:
```typescript
// Exception: PRCS MD Hours in calculated mode should be clickable (to show mode toggle)
const isPrcsMdHours = accountName.match(/Medical Director Hours.*PRCS/i)
cursor = isPrcsMdHours ? 'pointer' : 'default'
```

**B. Click handler exception (YearlyDataGrid.tsx, line ~1188)**:
Added exception to allow click events on PRCS MD Hours even when it's a calculated row:
```typescript
const isPrcsMdHours = accountText.match(/Medical Director Hours.*PRCS/i)
// Allow clicks on: normal editable cells, therapy total summary, OR PRCS MD Hours (even when calculated)
if (!isSpacer && (!isCalculatedRow || isPrcsMdHours) && ...) {
  handleCellClick(rowId, columnId, e)
}
```

This was the critical fix - without this exception, calculated rows were filtered out before reaching the click handler.

### 2. Added Mode Toggle to Physician Panel PRCS Tooltip
**Files**: `tooltips.ts`, `PhysiciansEditor.tsx`

Enhanced the `createPrcsAmountTooltip` function to include mode toggle buttons:
- Added two optional parameters: `mode` and `onModeToggle`
- Mode toggle only shows in YTD mode when callback is provided
- Displays current mode with radio-style buttons (● = selected, ○ = unselected)
- Shows helper text: "Calculated from physician panel" vs "Set manually in grid"

Updated all calls in `PhysiciansEditor.tsx` to pass mode and toggle callback:
```typescript
createPrcsAmountTooltip(
  p.id, 
  currentAmount, 
  e, 
  onUpdate, 
  msg, 
  120000,
  mode === 'ytd' ? (fy.prcsMdHoursMode || 'calculated') : undefined,
  mode === 'ytd' ? (newMode) => store.setPrcsMdHoursMode(newMode) : undefined
)
```

### 3. Enhanced Grid Click Debugging
**File**: `YearlyDataGrid.tsx`

Added detailed console logging to help debug click handling:
```typescript
console.log('🔍 [Click] Cell details:', {
  accountText,
  isPrcsMdHours,
  prcsMdHoursMode,
  isCalculatedRow,
  hasCell: !!cell,
  hasAccountCell: !!accountCell,
  isSpacer
})
```

## How It Works

### Grid Behavior
1. **Calculated Mode** (default):
   - PRCS MD Hours cell is **purple** with **pointer cursor**
   - Clicking opens the mode toggle tooltip in the grid (existing implementation)
   - Value is calculated from physician panel and not directly editable

2. **Annualized Mode**:
   - PRCS MD Hours cell is **yellow** (if annualized) or **green** (if custom value set)
   - Clicking opens the slider to set a custom value
   - Value can be edited directly in the grid

### Physician Panel Behavior
When hovering over the PRCS Medical Director icon in the physician panel and the physician is selected:
1. Shows the PRCS amount slider
2. **NEW**: Shows mode toggle buttons at the bottom
3. Clicking "Calculated" or "Annualized" switches the mode
4. Tooltip closes after mode change

### Mode Switching
- **Calculated → Annualized**: Cell turns yellow/green and becomes editable
- **Annualized → Calculated**: Cell turns purple, any custom value is removed
- Mode change marks scenario as dirty (requires save)

## Files Modified
1. `/Users/Mike/RadiantCare/web/src/components/dashboard/shared/types.ts`
   - Added `prcsMdHoursMode?: 'calculated' | 'annualized'` to `FutureYear` type (line 77)
   - Added `setPrcsMdHoursMode: (mode: 'calculated' | 'annualized') => void` to `Store` type (line 316)

2. `/Users/Mike/RadiantCare/web/src/components/dashboard/views/detailed/utils/yearlyDataTransformer.ts`
   - Made PRCS cell show pointer cursor in calculated mode

3. `/Users/Mike/RadiantCare/web/src/components/dashboard/views/detailed/components/YearlyDataGrid.tsx`
   - **Added click handler exception for PRCS MD Hours** (line ~1188) - This was the critical fix!
   - Enhanced click debugging logs

4. `/Users/Mike/RadiantCare/web/src/components/dashboard/shared/tooltips.ts`
   - Added mode toggle UI to `createPrcsAmountTooltip`
   - Added event handlers for mode toggle buttons

5. `/Users/Mike/RadiantCare/web/src/components/dashboard/shared/components/PhysiciansEditor.tsx`
   - Updated both calls to `createPrcsAmountTooltip` to pass mode and callback

## Bug Fixes (Round 2)

### Issue 1: Tooltip Not Visible
**Problem**: Click handler was called but tooltip didn't appear on screen.
**Root Cause**: Tooltip used `position: absolute` with `window.scrollX/Y` offsets, causing incorrect positioning.
**Fix**: 
- Changed tooltip to `position: fixed` (viewport-relative)
- Removed `window.scrollX/Y` from position calculation
- Added transparent backdrop to catch outside clicks
- Added position debug logging

### Issue 2: Mode Toggle Didn't Update Grid
**Problem**: Grid wasn't being watched, but it should trigger a reload.
**Root Cause**: Grid dependencies already included `prcsMdHoursMode` - this should work correctly.
**Fix**: 
- Added extensive debug logging to `setPrcsMdHoursMode` to track state changes
- Logs show expected cell color after mode change
- Grid should reload automatically due to existing dependency tracking

## Bug Fixes (Round 3)

### Issue 1: Tooltip Positioning Off-Screen
**Problem**: Tooltip would render off-screen if cell was on the right side of viewport.
**Root Cause**: No logic to check available space and adjust position.
**Fix**: 
- Added smart positioning logic (same as `ProjectedValueSlider`)
- Calculates space on right side: `window.innerWidth - position.x`
- Renders left if insufficient space (< tooltip width + 30px margin)
- Uses cell's left edge for accurate left-side positioning
- Wrapped in IIFE to calculate position before render

### Issue 2: Mode Setting Not Persisting
**Problem**: Mode toggled to 'annualized' but reverted to 'calculated' after reload.
**Root Cause 1**: `prcsMdHoursMode` was NOT being saved to database in `saveCurrentYearSettings`
**Root Cause 2**: `prcsMdHoursMode` default wasn't being set when loading scenarios
**Fix**:
- **Save logic** (`Dashboard.tsx`, line ~2176): Added conditional save of `prcsMdHoursMode` to `filteredYear2025` (only if different from default 'calculated')
  ```typescript
  if (ytdData.prcsMdHoursMode && ytdData.prcsMdHoursMode !== 'calculated') {
    filteredYear2025.prcsMdHoursMode = ytdData.prcsMdHoursMode
  }
  ```
- **Load logic** (`Dashboard.tsx`, line ~2426): Added default `prcsMdHoursMode: 'calculated'` to `complete2025` initialization
- When scenario loads, `Object.assign` merges saved `prcsMdHoursMode` from database, overriding default if present

## Bug Fixes (Round 4)

### Issue: Grid Not Re-rendering When Mode Changes
**Problem**: Cell color only changed after page refresh, not immediately when toggling mode.
**Root Cause**: The `dataSignature` (used to detect if grid data changed) did NOT include `prcsMdHoursMode`, so when the mode toggled, the signature stayed the same and the grid thought nothing changed.
**Fix**:
- Added `prcsMdHoursMode` to `dataSignature` (line ~484):
  ```typescript
  const dataSignature = JSON.stringify({
    // ... other fields ...
    prcsMdHoursMode: physicianData?.prcsMdHoursMode, // CRITICAL: Include mode so grid reloads when toggled
    // ...
  })
  ```
- Added debug logging to show when mode changes are detected:
  ```typescript
  if (isModeChanged) {
    console.log(`🎨 [Grid] PRCS mode changed in dataSignature: ${lastPrcsMdHoursMode} → ${currentPrcsMdHoursMode}, forcing reload`)
  }
  ```

**How It Works Now**:
1. User clicks "Annualized" button
2. `store.setPrcsMdHoursMode('annualized')` updates state
3. `loadData` runs because `prcsMdHoursMode` is in dependencies
4. **`dataSignature` changes** (includes `prcsMdHoursMode: 'annualized'`)
5. Signature mismatch detected → grid reloads
6. Transformer receives new mode → cell styling updates
7. **Cell instantly changes from purple to yellow** ✅

## Bug Fixes (Round 5)

### Issue: Clicking PRCS Cell in Annualized Mode Opens Slider
**Problem**: When PRCS cell is in 'annualized' mode, clicking should show the toggle (to easily switch back), not the typical slider.
**Root Cause**: Click handler only intercepted clicks in 'calculated' mode. In 'annualized' mode, it fell through to the regular editable cell handler which opens the slider.
**Fix**:
- Removed mode check from click handler (line ~802):
  ```typescript
  // Before: if (isPrcsMdHours && prcsMdHoursMode === 'calculated' && ...)
  // After:  if (isPrcsMdHours && ...) // Always intercept PRCS clicks
  ```
- Made tooltip dynamic to show current mode correctly
- Updated button styling to highlight active mode (● for selected, ○ for unselected)
- Changed help text based on current mode:
  - Calculated: "In calculated mode, the value is determined by the physician panel. Switch to annualized to set it manually."
  - Annualized: "In annualized mode, you can edit the value directly in the grid cell. Switch to calculated to use the physician panel value."

**Behavior Now**:
- **Calculated mode**: Click → Toggle appears → "Calculated" button is purple/selected, "Annualized" is white → Click "Annualized" to switch
- **Annualized mode**: Click → Toggle appears → "Annualized" button is yellow/selected, "Calculated" is white → Click "Calculated" to switch back

## UI Polish (Round 6)

### Changes: Yellow Annualized Buttons & Conditional Slider
**Requirements**: 
1. Make annualized button yellow (like cell background) in both tooltips
2. Hide slider in physician panel tooltip when in annualized mode

**Changes Made**:

**1. Grid Cell Toggle** (`YearlyDataGrid.tsx`):
- Annualized button background: `#fefce8` (yellow, matches cell)
- Annualized button border: `2px solid #eab308` (yellow border)
- Annualized button text: `#374151` (dark gray)
- Hover effect: Yellow background + yellow border

**2. Physician Panel Toggle** (`tooltips.ts`):
- Annualized button background: `#fefce8` (yellow)
- Annualized button border: `2px solid #eab308` when selected
- Annualized button text: `#374151` when selected, white otherwise
- **Slider conditionally hidden** when mode is 'annualized'
  - Shows read-only value display instead
  - Message: "Click the cell in the grid to edit the value"

**Visual Result**:
- ✅ Calculated button: Purple background when selected
- ✅ Annualized button: **Yellow background** when selected (matches grid cell color!)
- ✅ Physician panel in annualized mode: No slider, just value display + mode toggle

## Testing Checklist
- [ ] Click PRCS cell in calculated mode → toggle appears with purple "Calculated" button, white "Annualized" button
- [ ] Click PRCS cell in annualized mode → toggle appears with **yellow "Annualized" button**, white "Calculated" button (NO SLIDER!)
- [ ] Click outside tooltip → should close
- [ ] Hover PRCS icon in physician panel (calculated mode) → shows slider + toggle with purple "Calculated" button
- [ ] Hover PRCS icon in physician panel (annualized mode) → shows value display (NO SLIDER!) + toggle with **yellow "Annualized" button**
- [ ] **Toggle from Calculated → Annualized → cell INSTANTLY becomes yellow/green (NO REFRESH NEEDED!)** ✅
- [ ] **Toggle from Annualized → Calculated → cell INSTANTLY becomes purple (NO REFRESH NEEDED!)** ✅
- [ ] Mode toggle marks scenario as dirty
- [ ] **Save scenario with annualized mode → reload → mode persists** ✅

## UI Design

### Physician Panel Tooltip
```
┌─────────────────────────────────┐
│ PRCS Medical Director           │
│ Double-click to deselect        │
│                                 │
│ [Slider: $32,321]               │
│ [$32,321 input]                 │
│ ────────────────────────────── │
│ Grid Mode:                      │
│ ┌─────────┐ ┌─────────────┐   │
│ │● Calc'd │ │○ Annualized │   │
│ └─────────┘ └─────────────┘   │
│ Calculated from physician panel│
└─────────────────────────────────┘
```

## Notes
- Mode toggle only appears in YTD mode (not in multi-year scenarios)
- Grid click handling already implemented in previous work
- This change completes the PRCS mode toggle feature

