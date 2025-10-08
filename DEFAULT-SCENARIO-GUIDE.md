# Default YTD Scenario Guide

## Purpose
The "Default" YTD scenario provides a consistent baseline configuration that all users can load to restore the standard chart settings configured by the administrator.

---

## Current Default Settings

### Chart Configuration:
- **Chart Mode**: Line chart
- **Timeframe**: Yearly
- **Income Mode**: Total (aggregated)
- **Normalization**: Off
- **Current Period**: Current year
- **2025 Visibility**: Visible
- **Show All Months**: Yes

### Historical Data:
- **Selected Years**: 2016-2024 (9 years)
- **Color Scheme**: RadiantCare purple
- **Site Colors**: RGB (blue/green/red)

### Smoothing:
- **Line Mode**: 10
- **Bar Mode**: 0 (no smoothing)
- **Proportion Mode**: 12

### Site Visibility:
- **Lacey**: Visible
- **Centralia**: Visible
- **Aberdeen**: Visible

---

## How to Create/Update

### Initial Setup:

1. **Update the SQL script** with your admin email:
   ```sql
   -- In supabase-insert-default-ytd-scenario.sql
   WHERE email = 'your-admin@example.com'  -- Replace this
   ```

2. **Run in Supabase SQL Editor**:
   - Copy contents of `supabase-insert-default-ytd-scenario.sql`
   - Paste into Supabase SQL Editor
   - Execute

3. **Verify**:
   - Check output shows "Default YTD scenario created successfully!"
   - Query results show the scenario details

---

## How Users Load It

### In the Dashboard:

1. Open **YTD Detailed** view
2. Click **📊 Scenarios** button
3. Go to **Public Scenarios** tab
4. Find **"Default"** scenario (tagged as `default`, `template`, `admin`)
5. Click **Load**

All chart settings will be restored to the administrator-configured defaults.

---

## Updating the Default

### If you change the default settings in code:

**Option A: Update via SQL** (Recommended)

1. Delete the old default:
   ```sql
   DELETE FROM public.scenarios 
   WHERE name = 'Default' 
   AND view_mode = 'YTD Detailed';
   ```

2. Re-run `supabase-insert-default-ytd-scenario.sql`

**Option B: Update the ytd_settings directly**

1. Get the scenario ID:
   ```sql
   SELECT id FROM public.scenarios 
   WHERE name = 'Default' 
   AND view_mode = 'YTD Detailed';
   ```

2. Update the settings:
   ```sql
   UPDATE public.scenarios
   SET ytd_settings = jsonb_build_object(
     'isNormalized', false,
     'chartMode', 'line',
     -- ... updated settings here ...
   ),
   updated_at = NOW()
   WHERE id = '<scenario-id>';
   ```

---

## Settings Reference

The YTD settings object matches `DEFAULT_YTD_SETTINGS` from:
- **File**: `web/src/components/dashboard/views/detailed/config/chartConfig.ts`
- **Lines**: 296-313

```typescript
export const DEFAULT_YTD_SETTINGS = {
  isNormalized: false,
  showCombined: false,
  combineStatistic: null,
  combineError: null,
  chartMode: 'line',
  timeframe: 'year',
  currentPeriod: { year: new Date().getFullYear() },
  is2025Visible: true,
  showAllMonths: true,
  incomeMode: 'total',
  smoothingByMode: { line: 10, bar: 0, proportion: 12 },
  selectedYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  visibleSites: { lacey: true, centralia: true, aberdeen: true },
  colorScheme: 'radiantCare',
  siteColorScheme: 'rgb'
}
```

---

## Benefits

### For Users:
- ✅ Quick reset to standard configuration
- ✅ Consistent experience across team
- ✅ No need to remember default settings
- ✅ Easy to experiment knowing they can return to baseline

### For Administrators:
- ✅ Centralized control of default configuration
- ✅ Can update defaults without code changes
- ✅ Public scenario = all users can access
- ✅ Versioned via updated_at timestamp

---

## Best Practices

### Naming Convention:
- Use "Default" for the main baseline
- Consider "Default - [Variant]" for alternative baselines
- Examples:
  - "Default"
  - "Default - Monthly View"
  - "Default - Per-Site Analysis"

### Tags:
- Always include: `default`, `template`, `admin`
- Add descriptive tags: `baseline`, `standard`, `recommended`

### Public vs Private:
- **Public**: Anyone can load it (recommended for "Default")
- **Private**: Only admin can load it (for testing new defaults)

### Update Frequency:
- Review quarterly or when business logic changes
- Update after major QBO sync changes
- Document changes in scenario description

---

## Troubleshooting

### "Default scenario not showing"
- Check view mode: YTD scenarios only show in YTD Detailed view
- Check is_public: Should be `true`
- Check RLS policies: User should have read access to public scenarios

### "Settings not applying correctly"
- Verify ytd_settings JSON structure matches code expectations
- Check browser console for errors
- Ensure all required fields are present

### "Can't update default scenario"
- Admin user must own the scenario to edit it
- Or: Delete and recreate with new settings
- Or: Have admin load, modify, and re-save with same name

---

## Example: Creating Multiple Defaults

```sql
-- Default - Line View
INSERT INTO public.scenarios (...)
VALUES (..., 'Default - Line View', 'Standard line chart view', ...);

-- Default - Bar View
INSERT INTO public.scenarios (...)
VALUES (..., 'Default - Bar View', 'Standard bar chart view', ...);

-- Default - Per-Site Analysis
INSERT INTO public.scenarios (...)
VALUES (..., 'Default - Per-Site', 'Compare sites side-by-side', ...);
```

---

## See Also
- `SCENARIO-BIFURCATION-SUMMARY.md` - Overall scenario system design
- `SCENARIO-MIGRATION-PLAN.md` - Implementation details
- `web/src/components/dashboard/views/detailed/config/chartConfig.ts` - Source of truth for defaults

