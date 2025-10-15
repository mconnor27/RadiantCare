# Backend Requirements Checklist

## Frontend Complete ✅ - Backend Tasks Remaining

The frontend is fully implemented and ready. Here's what you need to do on the backend to complete the modular scenario system.

---

## 1. Database Migration

**File:** `supabase-modular-scenarios-migration.sql` (already created)

### Run the Migration

```sql
-- Add new columns to scenarios table
ALTER TABLE public.scenarios
ADD COLUMN IF NOT EXISTS scenario_type TEXT CHECK (scenario_type IN ('current_year', 'projection')),
ADD COLUMN IF NOT EXISTS baseline_years JSONB,
ADD COLUMN IF NOT EXISTS projection_settings JSONB,
ADD COLUMN IF NOT EXISTS future_years JSONB,
ADD COLUMN IF NOT EXISTS future_custom_values JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenarios_scenario_type ON public.scenarios(scenario_type);
CREATE INDEX IF NOT EXISTS idx_scenarios_user_type ON public.scenarios(user_id, scenario_type);
```

### Steps:
1. Connect to Supabase SQL Editor
2. Copy contents of `supabase-modular-scenarios-migration.sql`
3. Execute the migration
4. Verify columns were added: `\d+ scenarios`

---

## 2. API Compatibility Check

### Verify Existing Endpoints Still Work

The modular scenarios are stored in the same `scenarios` table with new columns. Existing API endpoints should work without changes because:

- Legacy scenarios don't have `scenario_type` column set (NULL)
- Type guards check for presence of `scenario_type` field
- All existing columns remain unchanged

### Test These Endpoints:
- `GET /api/scenarios` - List scenarios
- `GET /api/scenarios/:id` - Get scenario
- `POST /api/scenarios` - Create scenario (should accept new columns)
- `PUT /api/scenarios/:id` - Update scenario
- `DELETE /api/scenarios/:id` - Delete scenario

### If Using Supabase RLS Policies:
Verify policies allow read/write for new columns:
```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'scenarios';

-- They should already cover new columns since they use wildcards
-- If not, update them to include new columns
```

---

## 3. Shared Links (Immutable Snapshots)

### Current Behavior:
Shared links store scenario IDs and load current data (mutable).

### Required Behavior:
Shared links should store complete snapshot data (immutable).

### Implementation:

**Update `shared_links` table structure (if needed):**
```sql
ALTER TABLE public.shared_links
ADD COLUMN IF NOT EXISTS snapshot_data JSONB; -- Complete frozen state

-- Optional: Add flag to indicate if it's a modular scenario link
ADD COLUMN IF NOT EXISTS is_modular BOOLEAN DEFAULT FALSE;
```

**When creating shared link, store:**
```typescript
{
  view_mode: 'Multi-Year',
  is_modular: true, // Flag for new system
  
  // Complete Current Year Settings data
  current_year_settings: {
    id: scenarioId,
    name: scenarioName,
    year_2025_data: { ...fullData },
    custom_projected_values: { ...gridOverrides },
    ytd_settings: { ...settings },
    baseline_date: '2025-01-15',
    qbo_sync_timestamp: '2025-10-14T...'
  },
  
  // Complete Projection data
  projection: {
    id: projectionId,
    name: projectionName,
    baseline_mode: '2025 Data',
    projection_settings: { ...fullSettings },
    future_years: [...years2026to2035],
    future_custom_values: { ...gridOverrides },
    baseline_date: '2025-01-15'
  },
  
  // Scenario B (if enabled)
  scenario_b_enabled: true,
  scenario_b: {
    // Same structure as projection
  },
  
  // UI settings snapshot
  ui_settings: {
    ytdDetailed: { ...ytdSettings },
    multiYear: { selectedYears: [2025, 2026, ...] }
  }
}
```

**API Endpoint Updates:**

`POST /api/shared-links`
- Accept full snapshot data
- Store in `snapshot_data` JSONB column
- Return shareable URL

`GET /api/shared-links/:id`
- Return complete snapshot data
- Frontend loads from snapshot (not from scenario IDs)

---

## 4. Default Scenarios

### Create Two Default Scenarios

You can either:
1. Create them manually via UI and mark as defaults
2. Insert via SQL

**Option 1: Via SQL**
```sql
-- Insert Default Current Year Settings
INSERT INTO public.scenarios (
  id,
  user_id,
  name,
  description,
  is_public,
  scenario_type,
  view_mode,
  year_2025_data,
  custom_projected_values,
  ytd_settings,
  baseline_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '[YOUR_ADMIN_USER_ID]',
  'Default (A)',
  'Default 2025 baseline settings with current QBO data',
  true,
  'current_year',
  'YTD Detailed',
  '[CURRENT_2025_DATA]'::jsonb,
  '{}'::jsonb,
  '[DEFAULT_YTD_SETTINGS]'::jsonb,
  CURRENT_DATE,
  NOW(),
  NOW()
);

-- Insert Default Projection
INSERT INTO public.scenarios (
  id,
  user_id,
  name,
  description,
  is_public,
  scenario_type,
  view_mode,
  baseline_mode,
  projection_settings,
  future_years,
  future_custom_values,
  baseline_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '[YOUR_ADMIN_USER_ID]',
  'Default Projection',
  'Standard projection with baseline growth rates',
  true,
  'projection',
  'Multi-Year',
  '2025 Data',
  '[DEFAULT_PROJECTION_SETTINGS]'::jsonb,
  '[DEFAULT_FUTURE_YEARS]'::jsonb,
  '{}'::jsonb,
  CURRENT_DATE,
  NOW(),
  NOW()
);
```

**Option 2: Via UI (Recommended)**
1. Load app with fresh QBO data
2. Set up desired 2025 baseline settings
3. Save as "Default (A)" → Current Year Settings
4. Set up desired projection settings
5. Save as "Default Projection" → Projection
6. Mark both as favorites (use existing favorite system)

### Auto-Load Logic

The frontend already tries to load scenarios named "Default (A)" and "Default (B)" on startup. You can either:
- Use that naming convention
- Update the favorite system to mark defaults
- Create a `default_scenarios` table with user preferences

**Simple Approach - Use Favorites:**
The frontend already has logic to load favorite_a and favorite_b. Just mark your defaults as favorites.

---

## 5. Validation & Business Logic (Optional)

### Add Server-Side Validation

Validate incoming scenario data:
```typescript
function validateCurrentYearSettings(data: any) {
  if (data.scenario_type !== 'current_year') {
    throw new Error('Invalid scenario type')
  }
  if (!data.year_2025_data) {
    throw new Error('Missing 2025 data')
  }
  // Validate structure...
}

function validateProjection(data: any) {
  if (data.scenario_type !== 'projection') {
    throw new Error('Invalid scenario type')
  }
  if (!data.projection_settings || !data.future_years) {
    throw new Error('Missing projection data')
  }
  if (data.baseline_mode === '2024 Data' && !data.baseline_years) {
    throw new Error('Missing baseline years for 2024 mode')
  }
  // Validate structure...
}
```

---

## 6. QBO Sync Updates (Optional Enhancement)

### When QBO Data Updates:

**For Current Year Settings Scenarios:**
- Auto-update scenarios that have `qbo_sync_timestamp` older than X days
- Keep user overrides (`custom_projected_values`)
- Update base physician/financial data

**For Projections:**
- Don't auto-update (they're always compositional)
- User can load updated Current Year Settings manually

**Implementation:**
```typescript
async function syncQBOData() {
  const scenarios = await getScenariosByType('current_year')
  
  for (const scenario of scenarios) {
    const daysSinceSync = getDaysSince(scenario.qbo_sync_timestamp)
    
    if (daysSinceSync > 7) { // Configurable threshold
      const freshQBOData = await fetchLatestQBOData()
      
      // Merge: Fresh base data + Existing user overrides
      const updated2025Data = mergeWithUserOverrides(
        freshQBOData,
        scenario.custom_projected_values
      )
      
      await updateScenario(scenario.id, {
        year_2025_data: updated2025Data,
        qbo_sync_timestamp: new Date().toISOString()
      })
    }
  }
}
```

---

## 7. Testing Checklist

### Database Tests
- [ ] Migration runs successfully
- [ ] Indexes created
- [ ] RLS policies allow CRUD on new columns
- [ ] Can insert modular scenarios
- [ ] Can query by scenario_type

### API Tests
- [ ] Can save Current Year Settings via API
- [ ] Can save Projection via API
- [ ] Can load modular scenarios
- [ ] Legacy endpoints still work
- [ ] Filtering by scenario_type works

### Shared Link Tests
- [ ] Can create shared link with snapshot data
- [ ] Shared link loads complete frozen state
- [ ] QBO updates don't affect shared link data
- [ ] Shared links work across users (public)

### Integration Tests
- [ ] Frontend + Backend save/load cycle works
- [ ] Dirty detection accurate after load
- [ ] Can switch between scenarios smoothly
- [ ] Default scenarios load on app startup

---

## 8. Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -h [host] -U [user] -d [database] > backup_before_migration.sql
   ```

2. **Run Migration in Staging**
   - Test thoroughly
   - Verify no data loss
   - Check performance

3. **Deploy to Production**
   - Schedule maintenance window (if needed)
   - Run migration
   - Monitor for errors
   - Test key flows

4. **Post-Deployment**
   - Create default scenarios
   - Test with real users
   - Monitor error logs
   - Gather feedback

---

## 9. Rollback Plan

If something goes wrong:

```sql
-- Remove new columns (data will be lost)
ALTER TABLE public.scenarios
DROP COLUMN IF EXISTS scenario_type,
DROP COLUMN IF EXISTS baseline_years,
DROP COLUMN IF EXISTS projection_settings,
DROP COLUMN IF EXISTS future_years,
DROP COLUMN IF EXISTS future_custom_values;

-- Or keep columns but revert to backup
-- psql -h [host] -U [user] -d [database] < backup_before_migration.sql
```

**Better approach:** Keep new columns, fix the bug, redeploy.

---

## 10. Documentation Updates

After backend is complete:
- [ ] Update API documentation
- [ ] Document new scenario types
- [ ] Create user guide for modular scenarios
- [ ] Update developer onboarding docs

---

## Summary Checklist

### Must-Do (Critical)
- [ ] Run database migration
- [ ] Verify API endpoints work with new columns
- [ ] Create default scenarios
- [ ] Test save/load cycle end-to-end

### Should-Do (Important)
- [ ] Implement immutable shared links
- [ ] Add server-side validation
- [ ] Test thoroughly (use MODULAR-SCENARIO-TESTING-GUIDE.md)

### Nice-to-Have (Optional)
- [ ] Auto-sync QBO data for Current Year Settings
- [ ] Add more sophisticated default loading logic
- [ ] Create admin UI for managing defaults

---

## Getting Help

If you encounter issues:
1. Check browser console for frontend errors
2. Check server logs for backend errors
3. Verify database columns exist and have correct types
4. Test with simple scenarios first
5. Use provided testing guide for systematic verification

---

**Estimated Time:** 2-4 hours for core backend work (migration + API + defaults)

**The frontend is ready and waiting! 🚀**


