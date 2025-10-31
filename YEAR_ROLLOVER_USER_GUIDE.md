# Year Rollover User Guide

## What Changed After the Refactoring?

Your RadiantCare application is now **year-agnostic**! This means:

✅ **No more hardcoded years** - The app dynamically uses the baseline year from settings
✅ **Easy year rollover** - Change years via admin panel (no code changes needed)
✅ **Dynamic projections** - Projection years automatically adjust based on baseline year
✅ **Flexible configuration** - Adjust projection window from 3-10 years

---

## Current State (October 2025)

### What You See Now:
- **Baseline Year**: 2025
- **Projection Years**: 2026, 2027, 2028, 2029, 2030 (5 years forward)
- **Prior Year**: 2024

Everything looks the same as before because we're still in 2025. The refactoring happened "under the hood."

---

## How to Access Year Settings (Admin Only)

As an admin, you now have a **Year Settings** button in the top navigation bar:

1. **Look for the calendar icon** 📅 in the top-right corner (next to gear/bug icons)
2. **Click the calendar icon** to open the Year Settings Panel
3. **You'll see**:
   - Current Baseline Year: 2025
   - Projection Years: 5
   - Prior Year Cutoff Date: 2025-04-15
   - Prior Year Marked Complete: No
   - Sync buttons for current and prior year QBO data
   - **"Roll to Next Year" button** (currently shows "Roll to 2026")

---

## When January 1, 2026 Arrives: The Rollover Process

### Option 1: Automatic Rollover (Recommended for Jan 1)

On or after January 1, 2026:

1. **Admin logs in and clicks the Year Settings (📅) button**
2. **Clicks "Roll to 2026" button**
3. **Confirms in the modal**
4. **System automatically**:
   - Updates baseline year to 2026
   - Updates prior year cutoff to 2026-04-15
   - Resets "prior year marked complete" to false
   - Reloads the application

5. **After reload, you'll see**:
   - Baseline Year: 2026
   - Projection Years: 2027-2031
   - Prior Year: 2025 (pulls from QBO until April 15, 2026)
   - Historic Data: 2016-2025

### Option 2: Manual Rollover (Advanced)

If you prefer to manually test before the new year:

1. Open Year Settings Panel (📅 icon)
2. Change "Current Fiscal Year" from 2025 to 2026
3. Click "Save Settings"
4. Refresh the page

---

## What Changes After Rollover?

### Immediately After Rolling to 2026:

| Feature | Before (2025) | After (2026) |
|---------|---------------|--------------|
| **Baseline Year** | 2025 | 2026 |
| **Projection Years** | 2026-2030 | 2027-2031 |
| **Prior Year** | 2024 | 2025 |
| **YTD View** | Shows 2025 data | Shows 2026 data |
| **Multi-Year Chart** | 2016-2030 | 2016-2031 |
| **Compensation Summary** | 2025-2030 | 2026-2031 |

### QuickBooks Sync Behavior:

- **Current Year (2026)**: Syncs daily QBO data for 2026
- **Prior Year (2025)**:
  - **Before April 15, 2026**: Pulls live QBO data for 2025 (still updating)
  - **After April 15, 2026**: Uses snapshot from April 15 (tax deadline passed)
  - **Manual Override**: Admin can mark prior year complete anytime via toggle

---

## ✨ NO Manual Steps Required!

The app is **fully automatic** - no code changes needed for year rollover!

### What Happens Automatically:

1. **Historic Data Auto-Population** ✅
   - When you roll to 2026, the app automatically loads 2025 data from QBO cache
   - HISTORIC_DATA array dynamically extends with new years
   - No need to edit `defaults.ts` manually

2. **Social Security Wage Base Extrapolation** ✅
   - System automatically calculates future wage bases using 4% growth rate
   - Even if IRS announces a new wage base for 2031, the app works fine
   - (Optional) You can add the official value if you want precision, but not required

3. **Projection Years Auto-Adjust** ✅
   - When baseline year = 2026, projections automatically become 2027-2031
   - No hardcoded year ranges anywhere

### Optional Manual Updates (For Precision Only):

These are **completely optional** - only if you want exact values vs extrapolations:

- **Social Security Wage Base**: Add official IRS value for future years (app extrapolates if missing)
- **Default Physician Rosters**: Update scenarioADefaultsByYear() if roster changes (app uses last values if missing)

The scenarioADefaultsByYear()

---

## Testing Year Rollover (Before Jan 1)

You can test the rollover **right now** without waiting for 2026:

### Using Time-Travel Testing:

1. **Open browser console** (F12 → Console tab)
2. **Run these commands**:
   ```javascript
   // Test rollover to 2026
   YEAR_CONFIG.setTestYear(2026)
   await setSetting('current_fiscal_year', 2026)
   location.reload()
   ```

3. **Verify**:
   - Baseline year shows 2026
   - Projection years show 2027-2031
   - YTD view shows 2026 data

4. **Revert to 2025**:
   ```javascript
   YEAR_CONFIG.clearTestYear()
   await setSetting('current_fiscal_year', 2025)
   location.reload()
   ```

### Using Admin Panel:

1. Click Year Settings (📅)
2. Change "Current Fiscal Year" to 2026
3. Save and refresh
4. Change back to 2025 when done testing

---

## Troubleshooting

### "Nothing changed after rollover"
- **Check**: Did you refresh the page? Year config loads on app startup.
- **Fix**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### "Projection years still show 2026-2030"
- **Check**: Database setting for `current_fiscal_year`
- **Fix**: Run in console:
  ```javascript
  await setSetting('current_fiscal_year', 2026)
  location.reload()
  ```

### "Historic data missing for 2025"
- **Check**: Did you add 2025 to HISTORIC_DATA array?
- **Fix**: Update `defaults.ts` and redeploy

### "Social Security tax calculations seem wrong"
- **Check**: Wage base for projection years (2027-2031)
- **Fix**: Add to SOCIAL_SECURITY_WAGE_BASES or let it extrapolate

---

## What Happens to Old Scenarios?

**Don't worry!** Old scenarios are **backward compatible**:

- Scenarios saved with "2025 Data" mode automatically convert to "Current Year Data"
- Scenarios saved with "2024 Data" mode still work (treated as prior year)
- All year-specific data is preserved

When you load an old scenario after rollover:
- The system detects it was saved for 2025
- Converts baseline mode to the new format
- Projects forward from 2026 using saved projection settings

---

## Key Benefits of Year-Agnostic Design

✅ **No code changes for year rollover** - Just click a button
✅ **Automatic projection year updates** - Always shows correct future years
✅ **Flexible projection windows** - Adjust from 3-10 years forward
✅ **Prior year tracking** - Handles tax deadline cutoff automatically
✅ **Future-proof** - Works for 2027, 2028, and beyond
✅ **Time-travel testing** - Test future years before they arrive

---

## Questions?

- **When should I roll to 2026?**: January 1, 2026 (or during your first planning session of the new year)
- **Can I roll back?**: Yes, just change the year setting back to 2025
- **Do I need to deploy code?**: No, unless adding historic data or wage bases
- **What about cron jobs?**: Generic `/api/qbo/sync?year=YYYY` works for any year
- **Will users see warnings?**: Future feature - Phase 3.3 (not yet implemented)

---

**Last Updated**: October 30, 2025
**Refactoring Completed**: Phases 1-5 ✅
**Status**: Production Ready 🚀
