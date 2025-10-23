# Browser Resize Performance Fix

## Issue Summary

When resizing the browser in Multi-Year View, the console showed multiple "Compensation Engine calculations" logs, indicating expensive calculations were running unnecessarily on every render.

## Root Cause

### Problem Location: `OverallCompensationSummary.tsx`

The component was calling expensive compensation calculation functions **directly in the component body** without memoization:

```typescript
// ❌ BAD: Runs on every render (including browser resize)
const perYearA = years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') }))
const perYearAWithRetired = years.map((y) => ({ year: y, comps: computeAllCompensationsForYearWithRetired(y, 'A') }))
```

### Why This Was Bad

1. **Browser resize triggers re-renders**: 
   - `HistoricAndProjectionChart.tsx` uses a `ResizeObserver` to respond to container size changes
   - This causes parent components to re-render
   
2. **Expensive calculations run on every render**:
   - Each call to `computeAllCompensationsForYear()` runs the full compensation engine
   - With 6 years (2025-2030) × 2 scenarios × 2 calculation types = **24+ calculations**
   - Each calculation iterates through all physicians, costs, and allocations
   
3. **Unnecessary performance cost**:
   - Calculations only need to run when **data changes**, not when the UI resizes
   - The throttled console.log (100ms) in `compensationEngine.ts` was firing multiple times during resize

## The Fix

### Solution: Wrap calculations in `useMemo` with proper dependencies

```typescript
// ✅ GOOD: Only recalculates when data actually changes
const perYearA = useMemo(
  () => years.map((y) => ({ year: y, comps: computeAllCompensationsForYear(y, 'A') })),
  [years.join(','), JSON.stringify(store.scenarioA.future), store.scenarioA.projection.benefitCostsGrowthPct]
)
```

### What Was Memoized

1. **`perYearA`** - Scenario A compensations (active partners only)
2. **`perYearB`** - Scenario B compensations (active partners only)
3. **`perYearAWithRetired`** - Scenario A compensations (including retired partners)
4. **`perYearBWithRetired`** - Scenario B compensations (including retired partners)
5. **`allNames`** - Unique physician names across scenarios
6. **`colorByName`** - Color palette mapping for chart
7. **`seriesA` / `seriesB`** - Data series for Plotly chart
8. **`locumsSeriesA` / `locumsSeriesB`** - Locums cost series

### Dependencies

Each memoized calculation depends only on the specific data that affects it:

- **Years list**: `years.join(',')` - detects when projection years change
- **Scenario data**: `JSON.stringify(store.scenarioA.future)` - detects changes to physician data, costs, etc.
- **Projection settings**: `store.scenarioA.projection.benefitCostsGrowthPct` - detects changes to growth rates
- **Scenario B state**: `store.scenarioBEnabled`, `store.scenarioB` - detects when scenario B is toggled

## Performance Impact

### Before
- **On resize**: 24+ compensation engine calculations per resize event
- **Console logs**: Multiple "Compensation Engine calculations" messages
- **User experience**: Potential lag/jank during browser resize

### After
- **On resize**: 0 compensation engine calculations (unless data actually changed)
- **Console logs**: Silent during resize (only logs when data changes)
- **User experience**: Smooth resize with no calculation overhead

## Why This Matters

1. **Better Performance**: Expensive calculations only run when necessary
2. **Cleaner Console**: No spam during normal UI interactions
3. **Scalable Pattern**: As the app grows, memoization prevents performance degradation
4. **Battery Life**: Mobile users benefit from reduced CPU usage during UI animations

## Related Files Modified

- ✅ `web/src/components/dashboard/shared/components/OverallCompensationSummary.tsx`

## Related Files (Already Optimized)

These files already had proper memoization:
- ✅ `web/src/components/Dashboard.tsx` - `usePartnerComp()` uses `useMemo`
- ✅ `web/src/components/dashboard/shared/components/YearPanel.tsx` - Uses `usePartnerComp()` which is memoized

## Testing

To verify the fix:

1. Open Multi-Year View
2. Open browser console
3. Resize the browser window multiple times
4. **Expected**: No "Compensation Engine calculations" logs during resize
5. Change a projection setting (e.g., Income Growth %)
6. **Expected**: One set of calculation logs when data actually changes

## Technical Notes

### Why JSON.stringify for dependencies?

```typescript
[JSON.stringify(store.scenarioA.future), ...]
```

We use `JSON.stringify()` for deep comparison of complex objects. React's default dependency comparison uses `Object.is()`, which only compares references. For nested objects/arrays, we need deep comparison to detect actual data changes.

### Alternative Approaches Considered

1. **Zustand selectors**: Could use fine-grained selectors, but would require significant store refactoring
2. **Separate calculation service**: Could move calculations outside React, but adds complexity
3. **Debouncing**: Could debounce calculations, but doesn't solve the root cause

The `useMemo` approach is the most React-idiomatic and requires minimal changes.

## Conclusion

This fix prevents unnecessary recalculations during UI updates like browser resize, improving performance and user experience. The pattern can be applied to other expensive calculations in the codebase as needed.

