# Prior Year Sync - How It Works

## Question: How does `/api/qbo/sync-prior-year` work?

**Short Answer**: We use the generic `/api/qbo/sync?year=YYYY` endpoint with the prior year parameter.

---

## The Architecture

### 1. Generic Sync Endpoint ✅
**File**: `api/qbo/sync.ts`

This is the main sync endpoint that can sync **any year**:

```bash
# Sync current year (2025)
GET /api/qbo/sync?year=2025

# Sync prior year (2024)
GET /api/qbo/sync?year=2024

# Sync any year
GET /api/qbo/sync?year=2023
```

**How it works**:
1. Reads `year` query parameter (defaults to current calendar year)
2. Fetches QBO data for that specific year
3. Stores in `qbo_cache` table with `year` as primary key
4. Returns success with synced year

### 2. Convenience Endpoint (NEW) ✅
**File**: `api/qbo/sync-prior-year.ts`

A convenience wrapper that automatically syncs the prior year:

```bash
# Just call this - it figures out prior year automatically
GET /api/qbo/sync-prior-year
```

**How it works**:
1. Calculates `priorYear = currentYear - 1`
2. Redirects to generic sync endpoint with `?year={priorYear}`
3. Returns same response as generic endpoint

**Why create this?**
- Simpler API for callers (no need to calculate prior year)
- Can be added to cron jobs easily
- Makes intent explicit

### 3. Admin UI Integration ✅
**File**: `web/src/components/admin/YearSettingsPanel.tsx`

The admin panel now has **two sync buttons**:

```tsx
<button onClick={() => handleManualSync()}>
  Sync 2025 (Current Year)
</button>

<button onClick={() => handleManualSync(priorYear)}>
  Sync 2024 (Prior Year)
</button>
```

**Updated `handleManualSync` function**:
```typescript
const handleManualSync = async (year?: number) => {
  const targetYear = year || baselineYear
  const response = await authenticatedFetch(`/api/qbo/sync?year=${targetYear}`)
  // ... handle response
}
```

---

## The Prior Year Data Flow

### Scenario: It's January 2026, baseline year = 2026

1. **Historic Column (Prior Year 2025)**:
   - If **before April 15, 2026**: Show live QBO data from 2025
   - If **after April 15, 2026**: Show snapshot (cached data)
   - If **admin marks complete**: Switch to snapshot immediately

2. **QBO Sync Buttons**:
   - **"Sync 2026"**: Fetches current year QBO data (runs automatically via cron)
   - **"Sync 2025"**: Fetches prior year QBO data (manual only)

3. **Cache Storage**:
```sql
-- qbo_cache table structure
SELECT year, last_sync_timestamp FROM qbo_cache;

-- Results:
| year | last_sync_timestamp       |
|------|---------------------------|
| 2025 | 2026-01-15 10:30:00      |  -- Prior year
| 2026 | 2026-01-15 10:35:00      |  -- Current year
```

4. **Frontend Logic**:
```typescript
// YearlyDataGrid.tsx (or wherever historic column is rendered)
const priorYear = YEAR_CONFIG.baselineYear - 1
const cutoffDate = new Date(YEAR_CONFIG.priorYearCutoffDate(YEAR_CONFIG.baselineYear))
const today = new Date()
const priorYearMarkedComplete = await getSetting('prior_year_marked_complete')

const useQBOForPriorYear =
  today < cutoffDate &&
  !priorYearMarkedComplete &&
  YEAR_CONFIG.usePriorYearQBOUntilCutoff

if (useQBOForPriorYear) {
  // Fetch from /api/qbo/cached?year={priorYear}
  const priorYearData = await fetch(`/api/qbo/cached?year=${priorYear}`)
} else {
  // Use snapshot from HISTORIC_DATA array or database
  const snapshot = HISTORIC_DATA.find(d => d.year === priorYear)
}
```

---

## Why Prior Year Sync Matters

### Use Case 1: Tax Filing (January - April 15)
During tax season, accountants may make adjustments to prior year books in QuickBooks:
- Correcting categorizations
- Adding missing transactions
- Finalizing year-end entries

**Solution**: Admin can click "Sync {Prior Year}" to pull latest QBO data into the historic column.

### Use Case 2: Year-End Reconciliation
When transitioning from December 2025 → January 2026:
- Current year (2025) becomes prior year
- Need to ensure final 2025 numbers are accurate
- May require multiple syncs as accountant finalizes books

**Solution**: Prior year sync keeps pulling updated data until admin marks it complete.

### Use Case 3: Historical Corrections
Occasionally, corrections need to be made to closed years:
- IRS audit adjustments
- Retroactive reclassifications
- Error corrections discovered later

**Solution**: Can manually sync any year via: `/api/qbo/sync?year={year}`

---

## Cron Job Configuration

### Current Year Sync (Automatic)
```bash
# Runs every 30 minutes, Monday-Friday
*/30 * * * 1-5 curl -H "Authorization: Bearer $CRON_SECRET" \
  https://api.radiantcare.com/api/qbo/sync?year=2025
```

**Or use convenience endpoint**:
```bash
*/30 * * * 1-5 curl -H "Authorization: Bearer $CRON_SECRET" \
  https://api.radiantcare.com/api/qbo/sync-2025
```

### Prior Year Sync (Optional - Manual Only by Default)
**Option 1**: Don't schedule it - admin syncs manually via UI when needed

**Option 2**: Schedule during tax season only (Jan 1 - Apr 15):
```bash
# Runs daily at 2am during tax season
0 2 * 1-4 * curl -H "Authorization: Bearer $CRON_SECRET" \
  https://api.radiantcare.com/api/qbo/sync-prior-year

# Or explicit year
0 2 * 1-4 * curl -H "Authorization: Bearer $CRON_SECRET" \
  https://api.radiantcare.com/api/qbo/sync?year=2024
```

---

## API Endpoints Summary

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `/api/qbo/sync?year=YYYY` | Sync any specific year | Manual syncs, testing, corrections |
| `/api/qbo/sync-2025` | Legacy endpoint for 2025 | Backward compat, existing cron jobs |
| `/api/qbo/sync-prior-year` | Sync prior year | Convenience, explicit intent |
| `/api/qbo/cached?year=YYYY` | Get cached data for year | Frontend data loading |
| `/api/qbo/cached-2025` | Legacy cached endpoint | Backward compat |

---

## Testing Prior Year Sync

### Manual Test via Admin UI:
1. Log in as admin
2. Go to Year Settings panel
3. Click **"Sync {Prior Year}"** button
4. Verify success message
5. Check `qbo_cache` table for new row with prior year

### Manual Test via API:
```bash
# Get auth token first
TOKEN="your-auth-token"

# Sync prior year
curl -H "Authorization: Bearer $TOKEN" \
  https://api.radiantcare.com/api/qbo/sync-prior-year

# Or explicit year
curl -H "Authorization: Bearer $TOKEN" \
  https://api.radiantcare.com/api/qbo/sync?year=2024

# Verify cache updated
curl -H "Authorization: Bearer $TOKEN" \
  https://api.radiantcare.com/api/qbo/cached?year=2024
```

### Test April 15th Cutoff Logic:
```typescript
// In browser console (with time-travel testing):
YEAR_CONFIG.setTestYear(2026) // Pretend it's 2026

// Before April 15, 2026
const jan15 = new Date('2026-01-15')
const useQBO = shouldUsePriorYearQBO(false) // Should be true

// After April 15, 2026
const may1 = new Date('2026-05-01')
const useQBO2 = shouldUsePriorYearQBO(false) // Should be false

YEAR_CONFIG.clearTestYear()
```

---

## Summary

**Prior year sync works by**:
1. Using the generic `/api/qbo/sync?year={priorYear}` endpoint
2. Storing data in year-keyed cache (PK = year)
3. Admin can manually trigger via UI
4. Optionally scheduled during tax season
5. Frontend intelligently switches between live QBO and snapshot based on April 15th cutoff

**No special `/api/qbo/sync-prior-year` logic needed** - it's just a convenience wrapper that calculates prior year and delegates to the generic endpoint!

---

**Related Files**:
- `api/qbo/sync.ts` - Generic sync endpoint
- `api/qbo/sync-prior-year.ts` - Convenience wrapper (NEW)
- `api/qbo/cached.ts` - Generic cached data endpoint
- `web/src/config/yearConfig.ts` - Year configuration and helpers
- `web/src/components/admin/YearSettingsPanel.tsx` - Admin UI with sync buttons
