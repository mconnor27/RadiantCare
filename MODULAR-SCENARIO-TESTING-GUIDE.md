# Modular Scenario System - Testing Guide

## Quick Reference

This guide provides step-by-step testing scenarios to verify the modular scenario system works correctly.

---

## Test 1: Save & Load Current Year Settings

### From YTD View
1. Open YTD Detailed view
2. Modify 2025 projections (edit a physician, change values in grid)
3. Click "Save As" button (💾 icon with document)
4. Enter scenario name: "Test Current Year A"
5. Verify dialog shows only Current Year Settings option (no radio buttons)
6. Click Save
7. Verify success message
8. Make more changes to 2025 data
9. Open Scenario Manager (📂 icon)
10. Load "Test Current Year A"
11. Verify changes were reverted to saved state
12. Verify dirty indicator disappears

### From Multi-Year View (2025 Data baseline)
1. Open Multi-Year view
2. Ensure baseline mode is "2025 Data"
3. Modify 2025 projections (edit physician, change grid values)
4. Click "Save As" button
5. Select "Current Year Settings only" radio button
6. Enter name: "Test Current Year B"
7. Click Save
8. Make more 2025 changes
9. Load "Test Current Year B" from Scenario Manager
10. Verify only 2025 data reverted (not projection settings)
11. Verify dirty indicator shows correctly

**Expected Results:**
- ✅ 2025 data saved and restored correctly
- ✅ YTD settings (if saved from YTD view) applied correctly
- ✅ Grid overrides for 2025 preserved
- ✅ Dirty detection accurate

---

## Test 2: Save & Load Projection (2025 Data Baseline)

### Setup
1. Start in Multi-Year view with "2025 Data" baseline
2. Modify projection settings:
   - Change therapy income growth rates
   - Modify physician bonus allocations
   - Edit 2026, 2027, etc. data
3. Do NOT modify 2025 data

### Save Projection Only
1. Click "Save As" button
2. Select "Projection only" radio button
3. Enter name: "Test Projection A"
4. Click Save
5. Verify save success

### Test Compositional Loading
1. Make changes to projection settings
2. Load "Test Projection A" from Scenario Manager
3. Verify:
   - Projection settings reverted
   - 2026-2035 data reverted
   - **2025 data unchanged** (compositional)
4. Verify only Projection dirty indicator affected

**Expected Results:**
- ✅ Projection settings saved and restored
- ✅ Future years (2026-2035) preserved
- ✅ 2025 data NOT overwritten on load
- ✅ Can load different projections on same 2025 baseline

---

## Test 3: Save Both (Current Year + Projection)

### When Available
Only available in Multi-Year view when baseline mode is "2025 Data"

### Steps
1. Multi-Year view, "2025 Data" baseline
2. Modify both:
   - 2025 data (physicians, grid values)
   - Projection settings and future years
3. Click "Save As" button
4. Select "Both" radio button
5. Enter name: "Test Complete Scenario"
6. Click Save
7. Verify TWO scenarios created:
   - "Test Complete Scenario - Current Year"
   - "Test Complete Scenario - Projection"
8. Clear all changes, start fresh
9. Load "Test Complete Scenario - Current Year"
10. Verify 2025 data restored
11. Load "Test Complete Scenario - Projection"
12. Verify projection settings and future years restored

**Expected Results:**
- ✅ Two separate scenarios created
- ✅ Both can be loaded independently
- ✅ Different projections can be loaded on top of the same Current Year Settings

---

## Test 4: Projection with 2024 Baseline

### Setup
1. Multi-Year view
2. Switch baseline mode to "2024 Data"
3. Modify projection settings
4. Modify future years (2026-2035)

### Save & Load
1. Click "Save As" button
2. Verify only "Projection" option available (no "Current Year Settings")
3. Enter name: "Test 2024 Projection"
4. Click Save
5. Switch baseline back to "2025 Data"
6. Load "Test 2024 Projection" from Scenario Manager
7. Verify:
   - Baseline switches to "2024 Data"
   - 2024 baseline data loaded
   - Projection settings applied
   - Future years restored

**Expected Results:**
- ✅ Baseline mode saved with scenario
- ✅ 2024 baseline data preserved
- ✅ Loading switches baseline mode automatically
- ✅ No 2025 data overwritten (independent baseline)

---

## Test 5: Projection with Custom Baseline

### Setup
1. Multi-Year view
2. Switch baseline mode to "Custom"
3. Set custom years (e.g., 2022-2024)
4. Modify projection settings

### Save & Load
1. Click "Save As" button
2. Verify only "Projection" option available
3. Enter name: "Test Custom Projection"
4. Click Save
5. Switch to "2025 Data" baseline
6. Load "Test Custom Projection"
7. Verify:
   - Baseline switches to "Custom"
   - Custom baseline years restored
   - Projection settings applied

**Expected Results:**
- ✅ Custom baseline years saved
- ✅ Baseline mode restored on load
- ✅ Independent from 2025 data

---

## Test 6: Dirty Detection

### Current Year Settings Dirty
1. Load any Current Year Settings scenario
2. Modify 2025 data (physician, grid value)
3. Verify "Current Year Settings: • Modified" shows in UI
4. Click reset button
5. Verify dirty indicator disappears

### Projection Dirty
1. Load any Projection scenario (2025 baseline)
2. Modify projection settings OR future year data
3. Verify "Projection: • Modified" shows in UI
4. Verify Current Year Settings NOT marked dirty
5. Click reset button
6. Verify projection dirty indicator disappears

### Both Dirty
1. Load Current Year Settings
2. Load Projection on top
3. Modify 2025 data
4. Modify projection settings
5. Verify BOTH show dirty indicators
6. Reset Current Year Settings
7. Verify only Current Year dirty cleared
8. Reset Projection
9. Verify projection dirty cleared

**Expected Results:**
- ✅ Independent dirty tracking
- ✅ Visual indicators accurate
- ✅ Reset works for each independently

---

## Test 7: Scenario B Loading

### Same Current Year Settings
1. Load "Current Year A" into Scenario A
2. Load "Projection A" into Scenario A
3. Enable Scenario B
4. Load "Projection B" into Scenario B
5. Verify:
   - Both A and B use the same 2025 baseline ("Current Year A")
   - Only projection settings differ

### Different Baseline in B
1. Load "Current Year A" into Scenario A
2. Load "Projection (2025)" into Scenario A
3. Enable Scenario B
4. Load "Projection (2024)" into Scenario B
5. Verify:
   - Scenario A uses 2025 baseline
   - Scenario B has its own 2024 baseline (independent)

**Expected Results:**
- ✅ Scenario B can share Current Year Settings with A
- ✅ Scenario B can have independent baseline (2024/Custom)
- ✅ Warning modal appears when loading into B

---

## Test 8: Scenario Manager Filtering

### Filter Types
1. Open Scenario Manager
2. Select "Type: Current Year Settings" from dropdown
3. Verify only Current Year Settings scenarios shown
4. Select "Type: Projections"
5. Verify only Projection scenarios shown
6. Select "Type: Legacy"
7. Verify only old scenarios shown (if any exist)
8. Select "Type: All Types"
9. Verify all scenarios shown

**Expected Results:**
- ✅ Filter works correctly
- ✅ Count updates correctly ("X of Y scenarios")
- ✅ Search still works with filter

---

## Test 9: Visual Badges

### Scenario Cards
1. Open Scenario Manager
2. Verify scenario cards show correct badges:
   - ⚙️ Current Year Settings (blue)
   - 📊 Projection (purple)
   - 📊 YTD View (Legacy) (gray) - if any exist
   - 📈 Multi-Year (Legacy) (gray) - if any exist

**Expected Results:**
- ✅ Badges display correctly
- ✅ Colors match scenario type
- ✅ Easy to distinguish types at a glance

---

## Test 10: Backward Compatibility (If Legacy Scenarios Exist)

### Loading Legacy YTD Scenario
1. Create/find a legacy YTD scenario
2. Load it in YTD view
3. Verify it works exactly as before
4. Verify no errors in console

### Loading Legacy Multi-Year Scenario
1. Create/find a legacy Multi-Year scenario
2. Load it in Multi-Year view
3. Verify baseline loads correctly
4. Verify no errors in console

**Expected Results:**
- ✅ Legacy scenarios continue working
- ✅ No breaking changes
- ✅ Smooth transition to new system

---

## Test 11: Edge Cases

### Empty Scenario Load
1. Try to load a scenario with no data
2. Verify appropriate error message

### Concurrent Modifications
1. Load Current Year Settings
2. Make changes
3. Load different Current Year Settings (don't save first)
4. Verify prompt/warning if dirty

### Invalid Scenario ID
1. Try to load scenario that doesn't exist
2. Verify error handling

**Expected Results:**
- ✅ Graceful error handling
- ✅ No crashes
- ✅ Clear error messages

---

## Test 12: UI/UX Flow

### Complete User Workflow
1. Start app (should auto-load defaults)
2. Make changes to 2025 data
3. Save as "My 2025 Baseline"
4. Make changes to projection
5. Save projection as "Conservative Growth"
6. Create new projection with different settings
7. Save as "Aggressive Growth"
8. Load "My 2025 Baseline" (should still be loaded)
9. Load "Aggressive Growth" projection
10. Compare with Scenario B:
    - Enable Scenario B
    - Load "Conservative Growth" into B
11. Verify both projections use same 2025 baseline
12. Create shareable link
13. Verify link works

**Expected Results:**
- ✅ Smooth, intuitive flow
- ✅ No confusion about what's saved/loaded
- ✅ Dirty indicators helpful
- ✅ Shareable links work

---

## Console Checks

While testing, monitor browser console for:
- ✅ No errors
- ✅ Clean snapshot logging
- ✅ Appropriate debug messages

---

## Performance Checks

- ✅ Scenario saves are fast (<1 second)
- ✅ Scenario loads are fast (<1 second)
- ✅ No lag when switching scenarios
- ✅ UI remains responsive

---

## Accessibility Checks

- ✅ All buttons have tooltips
- ✅ Modals can be closed with Escape key
- ✅ Keyboard navigation works
- ✅ Screen reader friendly

---

## Post-Testing Cleanup

After completing all tests:
1. Delete test scenarios
2. Restore default scenarios
3. Verify app returns to clean state

---

## Bug Reporting Template

If you find issues, report with:

```
**Test:** [Test number and name]
**Steps:** [Exact steps to reproduce]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Browser:** [Chrome/Firefox/Safari + version]
**Console Errors:** [Any errors in console]
**Screenshots:** [If applicable]
```

---

## Success Criteria

All tests should pass with:
- ✅ No crashes or errors
- ✅ Data integrity maintained
- ✅ Dirty detection accurate
- ✅ UI responsive and intuitive
- ✅ Legacy scenarios work
- ✅ New modular scenarios work as designed

---

## Next Steps After Testing

1. Report any bugs found
2. Suggest UI/UX improvements
3. Verify backend integration
4. Test shared links thoroughly
5. Set up default scenarios
6. Train users on new workflow

---

**Happy Testing! 🚀**


