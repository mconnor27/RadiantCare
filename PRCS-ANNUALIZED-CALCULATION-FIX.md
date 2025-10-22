# PRCS MD Hours Annualized Mode - Calculation Fix

## Problem
When toggling PRCS MD Hours to "annualized" mode, the value wasn't changing. The annualized value needs to be calculated from the Year-To-Date (YTD) actual value, projected out to a full year.

## Solution

### Mode Definitions
1. **Calculated Mode** (Purple Cell):
   - Value comes from physician panel slider
   - Set via `prcsMedicalDirectorHours` field
   - User controls via physician panel
   - Cell background: Purple (`#f3e8ff`)

2. **Annualized Mode** (Yellow Cell):
   - Value **calculated** from YTD actual × projection ratio
   - Automatically set as a custom projected value
   - **NOT user-editable** (it's a projection, not a manual override)
   - Cell background: Yellow (`#fefce8`) to indicate annualized projection
   - Formula: `Annualized = YTD Actual × Projection Ratio`

## Implementation

### 1. Store Action Update (`Dashboard.tsx`)

Updated `setPrcsMdHoursMode` to accept and store the annualized value:

```typescript
setPrcsMdHoursMode: (mode: 'calculated' | 'annualized', annualizedValue?: number) =>
  set((state) => {
    const customKey = 'Medical Director Hours (PRCS)'
    
    if (mode === 'calculated') {
      // Remove custom value, revert to physician panel
      delete state.ytdCustomProjectedValues[customKey]
    } else if (mode === 'annualized') {
      // Store the calculated annualized projection
      if (annualizedValue !== undefined) {
        state.ytdCustomProjectedValues[customKey] = annualizedValue
      }
    }
  })
```

### 2. Grid Cell Toggle (`YearlyDataGrid.tsx`)

Added `calculateAnnualizedPrcsMdHours()` helper function:

```typescript
const calculateAnnualizedPrcsMdHours = useCallback((): number | null => {
  // Find PRCS MD Hours row in grid data
  const prcsRow = gridData.allRows.find(/* ... */)
  
  // Get YTD actual value (second-to-last column)
  const ytdColIndex = gridData.columns.length - 2
  const ytdValue = parseFloat(ytdCell.text.replace(/[$,\s]/g, '')) || 0
  
  // Calculate annualized projection
  const annualized = ytdValue * projectionRatio
  
  return annualized
}, [gridData, projectionRatio])
```

Updated click handler to calculate and pass the value:

```typescript
onClick={() => {
  const annualizedValue = calculateAnnualizedPrcsMdHours()
  if (annualizedValue !== null) {
    store.setPrcsMdHoursMode('annualized', annualizedValue)
  }
}}
```

### 3. Physician Panel Tooltip (`tooltips.ts`)

Updated function signature to accept YTD and ratio:

```typescript
export function createPrcsAmountTooltip(
  // ... existing params ...
  mode?: 'calculated' | 'annualized',
  onModeToggle?: (newMode: 'calculated' | 'annualized', annualizedValue?: number) => void,
  ytdActualValue?: number,      // NEW
  projectionRatio?: number       // NEW
)
```

Updated button click handler to calculate annualized value:

```typescript
if (annualButton) {
  annualButton.addEventListener('click', () => {
    let annualizedValue: number | undefined
    if (ytdActualValue !== undefined && projectionRatio !== undefined) {
      annualizedValue = ytdActualValue * projectionRatio
    }
    onModeToggle('annualized', annualizedValue)
  })
}
```

## Data Flow

### Switching to Annualized Mode:

```
1. User clicks "Annualized" button
   ↓
2. Calculate: annualizedValue = YTD actual × projection ratio
   Example: $25,000 YTD × 1.259 = $31,475 annualized
   ↓
3. Call: store.setPrcsMdHoursMode('annualized', 31475)
   ↓
4. Store action:
   - Sets ytdData.prcsMdHoursMode = 'annualized'
   - Sets ytdCustomProjectedValues['Medical Director Hours (PRCS)'] = 31475
   ↓
5. Grid reloads (dataSignature changed)
   ↓
6. Cell renders:
   - Background: YELLOW (annualized projection)
   - Value: $31,475 (the calculated annualized amount)
   - NOT EDITABLE (it's a projection, not an override)
```

### Switching back to Calculated Mode:

```
1. User clicks "Calculated" button
   ↓
2. Call: store.setPrcsMdHoursMode('calculated')
   ↓
3. Store action:
   - Sets ytdData.prcsMdHoursMode = 'calculated'
   - Removes ytdCustomProjectedValues['Medical Director Hours (PRCS)']
   ↓
4. Grid reloads
   ↓
5. Cell renders:
   - Background: PURPLE (calculated row)
   - Value: from physician panel (e.g., $32,321)
   - Controlled via physician panel slider
```

## Key Points

1. **Annualized is a Calculation, Not an Override**
   - User cannot directly edit the annualized value
   - It's always calculated from YTD actual × projection ratio
   - This ensures consistency with other annualized projections

2. **Immutable in Annualized Mode**
   - Clicking the cell shows toggle (to switch modes)
   - Does NOT show slider for editing
   - Value updates automatically if YTD or ratio changes

3. **Persistence**
   - Mode (`prcsMdHoursMode`) is saved to database
   - Annualized value is saved as custom projected value
   - On reload: mode is restored, and if annualized, uses saved value

4. **Visual Feedback**
   - Calculated: Purple cell
   - Annualized: Yellow cell (annualized projection based on YTD)
   - Button colors: Purple for calculated, Yellow for annualized

## Console Output Example

```
📊 [calculateAnnualizedPrcsMdHours] YTD: $25,000, Ratio: 1.259, Annualized: $31,475
🔀 [setPrcsMdHoursMode] Changed PRCS MD Hours mode: calculated → annualized
📊 [setPrcsMdHoursMode] Set annualized value for Medical Director Hours (PRCS): $31,475
🎨 [setPrcsMdHoursMode] Cell will be YELLOW (annualized projection)
🎨 [Grid] PRCS mode changed in dataSignature: calculated → annualized, forcing reload
```

## Testing Checklist

- [ ] Calculated mode → Click "Annualized" → Cell turns yellow with YTD-based annualized value
- [ ] Value shown equals YTD × projection ratio
- [ ] Annualized mode → Click cell → Shows toggle (NO slider)
- [ ] Annualized mode → Click "Calculated" → Cell turns purple, shows physician panel value
- [ ] Save scenario in annualized mode → Reload → Still annualized with same value (yellow cell)
- [ ] Change YTD data → Annualized value updates on next calculation
- [ ] **NEW**: Calculated mode → Click "Annualize All Grid Values" → PRCS switches to annualized (yellow cell)
- [ ] **NEW**: Annualized mode → Click "Annualize All Grid Values" → PRCS stays annualized, value preserved

