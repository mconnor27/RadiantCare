# Cron Job Fix Summary

## Issues Fixed

### 1. ✅ Saturday Morning Execution Now Works

**Problem**: The cron ran on Saturday at 1:00 AM Pacific to sync Friday's data, but the business day check saw "Saturday" and blocked the sync.

**Fix**: Changed the logic to check if the **TARGET date** (prior business day being synced) is valid, not the current execution time.

```typescript
// BEFORE: Checked if NOW is a business day (blocked Saturday runs)
if (!isBusinessDay(now)) {
  // Skip
}

// AFTER: Checks if TARGET date is a business day (allows Saturday to sync Friday)
const targetDate = getPriorBusinessDay(now)
if (!isBusinessDay(targetDate)) {
  // Skip
}
```

**Result**: Saturday morning at 1:00 AM Pacific can now successfully sync Friday's business data.

### 2. ✅ Persistent Logging Added

**Problem**: Vercel free tier only keeps 30 minutes of logs. Late-night cron executions (1:00 AM Pacific) were impossible to troubleshoot.

**Solution**: All cron executions are now logged to Supabase `cron_logs` table with:
- Status: `success`, `skipped`, or `error`
- Execution details (timing, target dates, reasons)
- Full error stack traces
- Pacific timezone timestamps

## Setup Required

### 1. Run Database Migration

Execute the SQL in Supabase SQL Editor:

```bash
# File location
supabase-cron-logs-migration.sql
```

This creates:
- `cron_logs` table for permanent logs
- `cron_logs_recent` view for easy querying
- Indexes for performance
- Auto-cleanup function (keeps 90 days)

### 2. Deploy Updated Code

```bash
git add api/qbo/sync-2025.ts
git add supabase-cron-logs-migration.sql
git add CRON_SETUP.md
git add CRON-FIX-SUMMARY.md
git commit -m "Fix Saturday cron execution and add persistent logging"
git push
```

## How to View Cron Logs

### Quick Queries

**View last 20 executions:**
```sql
SELECT * FROM cron_logs_recent LIMIT 20;
```

**Check for errors:**
```sql
SELECT 
  created_at AT TIME ZONE 'America/Los_Angeles' as pacific_time,
  details->>'error' as error_message,
  details->>'stack' as stack_trace
FROM cron_logs 
WHERE status = 'error'
ORDER BY created_at DESC;
```

**See why syncs were skipped:**
```sql
SELECT 
  created_at AT TIME ZONE 'America/Los_Angeles' as pacific_time,
  details->>'reason' as skip_reason,
  details->>'targetDate' as target_date,
  details->>'dayOfWeek' as day_of_week
FROM cron_logs 
WHERE status = 'skipped'
ORDER BY created_at DESC;
```

**Verify Saturday morning runs:**
```sql
SELECT 
  created_at AT TIME ZONE 'America/Los_Angeles' as pacific_time,
  status,
  details->>'executionTimeSec' as execution_seconds,
  details->>'targetDateRange' as date_range
FROM cron_logs 
WHERE details->>'dayOfWeek' = '6'  -- Saturday
ORDER BY created_at DESC;
```

**Performance metrics:**
```sql
SELECT 
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
  AVG((details->>'executionTimeMs')::float / 1000) as avg_seconds,
  MAX((details->>'executionTimeMs')::float / 1000) as max_seconds
FROM cron_logs 
WHERE created_at > NOW() - INTERVAL '30 days';
```

## Log Format

### Success Log
```json
{
  "status": "success",
  "details": {
    "lastSyncTimestamp": "2025-10-18T08:00:00.000Z",
    "executionTime": 1234,
    "executionTimeMs": 1234,
    "executionTimeSec": "1.23",
    "targetDateRange": {
      "start": "2025-01-01",
      "end": "2025-10-17"
    },
    "timezone": "Pacific",
    "dataFetched": {
      "dailyPL": true,
      "classPL": true,
      "balanceSheet": true
    }
  }
}
```

### Skipped Log
```json
{
  "status": "skipped",
  "details": {
    "reason": "target_not_business_day",
    "executionTime": "2025-10-19T08:00:00.000Z",
    "targetDate": "2025-10-18T00:00:00.000Z",
    "dayOfWeek": 0,
    "timezone": "Pacific"
  }
}
```

### Error Log
```json
{
  "status": "error",
  "details": {
    "error": "Failed to fetch daily P&L report",
    "stack": "Error: Failed to fetch...",
    "timestamp": "2025-10-18T08:00:00.000Z"
  }
}
```

## Cron Schedule (UTC to Pacific)

| Period | UTC Schedule | Pacific Time | Notes |
|--------|-------------|--------------|-------|
| Jan-Feb, Nov-Dec | `0 9 * 1-2,11-12 2-6` | 1:00 AM PST | Winter (PST = UTC-8) |
| Mar-Oct | `0 8 * 3-10 2-6` | 1:00 AM PDT | Summer (PDT = UTC-7) |

**Days**: Runs Tuesday-Saturday (2-6) to cover Monday-Friday business days

## Testing the Fix

### Manual Test
```bash
curl -X POST https://your-domain.vercel.app/api/qbo/sync-2025 \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Verify Saturday Logic
Run on a Saturday (day 6) and check that:
1. It doesn't get blocked
2. It syncs Friday's data
3. A log entry appears in `cron_logs` with status='success'

### Check Logs
After any execution (manual or automatic):
```sql
SELECT * FROM cron_logs_recent LIMIT 1;
```

## Additional Notes

- **Timezone Handling**: The code receives UTC timestamps from Vercel but correctly handles Pacific timezone for business day calculations
- **Holiday List**: Update `FEDERAL_HOLIDAYS_2025` array in `api/qbo/sync-2025.ts` for 2026
- **Log Retention**: Logs kept for 90 days by default (configurable in migration file)
- **Performance**: Average execution time should be 1-3 seconds for typical QBO API calls

## Files Modified

1. `api/qbo/sync-2025.ts` - Fixed business day check, added logging
2. `CRON_SETUP.md` - Updated documentation
3. `supabase-cron-logs-migration.sql` - New table for logs
4. `CRON-FIX-SUMMARY.md` - This file

