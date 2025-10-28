# QuickBooks Cron Sync Setup

## Overview
Automated daily QuickBooks syncing runs Tuesday-Saturday at 1am Pacific Time, syncing data from Monday-Friday business days. The cron automatically:
- Runs Saturday morning to capture Friday's data (allows Friday night/Saturday morning execution)
- Skips when target date is a weekend or federal holiday
- Warns active users before syncing
- Logs all executions to Supabase for permanent records (bypassing Vercel's 30-minute log limit)

## Setup Steps

### 1. Create Supabase Tables

Run this SQL in your Supabase SQL Editor:

**A. Sync Notifications Table** (for real-time user warnings):

```sql
-- Create sync_notifications table
CREATE TABLE IF NOT EXISTS sync_notifications (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sync_notifications ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read notifications
CREATE POLICY "Allow authenticated users to read notifications"
  ON sync_notifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert notifications
CREATE POLICY "Allow service role to insert notifications"
  ON sync_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE sync_notifications;

-- Optional: Auto-delete old notifications after 1 hour
CREATE OR REPLACE FUNCTION delete_old_sync_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_notifications
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to clean up old notifications (if pg_cron is enabled)
-- SELECT cron.schedule('delete-old-sync-notifications', '0 * * * *', 'SELECT delete_old_sync_notifications()');
```

**B. Cron Logs Table** (for permanent execution logs):

```sql
-- Run the migration file
-- OR copy/paste from: supabase-cron-logs-migration.sql
```

See `supabase-cron-logs-migration.sql` for the complete cron logs table setup.

### 2. Set Environment Variable in Vercel

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Generate a secure random string (e.g., use `openssl rand -hex 32`)
   - **Environments**: Production, Preview, Development (all)
4. Save and redeploy

Example command to generate secret:
```bash
openssl rand -hex 32
```

### 3. Deploy

Push your changes to trigger a Vercel deployment:

```bash
git add .
git commit -m "Add automated QuickBooks sync cron"
git push
```

### 4. Verify Cron is Running

After deployment:
1. Go to Vercel Dashboard → Your Project → Crons
2. You should see TWO cron jobs for `/api/qbo/sync-2025`:
   - `0 9 * 1-2,11-12 2-6` (9:00 AM UTC = 1:00 AM PST - Winter months)
   - `0 8 * 3-10 2-6` (8:00 AM UTC = 1:00 AM PDT - Summer months)
3. Check logs after 1am Pacific on a business day to verify execution

## Schedule Details

- **Runs**: Tuesday through Saturday at exactly 1:00 AM Pacific Time
- **Syncs Data For**: Monday through Friday (previous business day)
- **Skips**: Weekends and US Federal Holidays

### DST Schedule (Pacific Time)

Two cron expressions handle seasonal time changes to ensure consistent 1:00 AM Pacific Time execution:

| Period | Schedule | Time (UTC) | Pacific Time | Notes |
|--------|----------|------------|--------------|-------|
| Jan-Feb, Nov-Dec | `0 9 * 1-2,11-12 2-6` | 9:00 AM | 1:00 AM PST | Winter months (PST) |
| Mar-Oct | `0 8 * 3-10 2-6` | 8:00 AM | 1:00 AM PDT | Summer months (PDT) |

**Note**: The sync runs at exactly 1:00 AM Pacific Time year-round. The different UTC times account for Daylight Saving Time changes.

### Federal Holidays (2025)
- January 1 - New Year's Day
- January 20 - Martin Luther King Jr. Day
- February 17 - Presidents' Day
- May 26 - Memorial Day
- June 19 - Juneteenth
- July 4 - Independence Day
- September 1 - Labor Day
- October 13 - Columbus Day
- November 11 - Veterans Day
- November 27 - Thanksgiving
- December 25 - Christmas

## How It Works

1. **Cron Trigger**: Vercel triggers the endpoint at 1am Pacific Time
2. **Authentication**: Endpoint checks for `Authorization: Bearer ${CRON_SECRET}` header
3. **Business Day Check**: Checks if TARGET date (prior business day) is valid
   - Allows Saturday morning execution to sync Friday's data
   - Skips if target date is a weekend or federal holiday
4. **User Warning**: Inserts notification into Supabase (active users see toast)
5. **Sync**: Fetches QuickBooks data and updates cache
6. **Logging**: Records execution to `cron_logs` table with status, timing, and details
7. **Frontend Refresh**: Active users' dashboards refresh automatically

## User Experience

Active users at 1am Pacific will see:
1. A blue toast notification: "QuickBooks sync starting - your view may refresh shortly"
2. Toast appears for 5 seconds
3. Dashboard refreshes with new data after sync completes

## Manual Sync

Users can still manually trigger sync via the "Sync QuickBooks" button in the dashboard. Manual syncs follow the same business day restrictions (admins can override).

## Viewing Cron Logs

Since Vercel free tier only keeps 30 minutes of logs, we persist all cron executions to Supabase.

### Query Recent Executions

```sql
-- View last 20 executions (uses the helpful view)
SELECT * FROM cron_logs_recent LIMIT 20;

-- Or query directly with Pacific timezone
SELECT 
  status,
  details,
  created_at AT TIME ZONE 'America/Los_Angeles' as pacific_time
FROM cron_logs
ORDER BY created_at DESC
LIMIT 50;

-- Check for errors
SELECT * FROM cron_logs WHERE status = 'error' ORDER BY created_at DESC;

-- See skip reasons
SELECT 
  created_at AT TIME ZONE 'America/Los_Angeles' as pacific_time,
  details->>'reason' as skip_reason,
  details->>'targetDate' as target_date
FROM cron_logs 
WHERE status = 'skipped'
ORDER BY created_at DESC;

-- Calculate average execution time
SELECT 
  AVG((details->>'executionTimeMs')::float) as avg_ms,
  MAX((details->>'executionTimeMs')::float) as max_ms,
  MIN((details->>'executionTimeMs')::float) as min_ms
FROM cron_logs 
WHERE status = 'success'
  AND details->>'executionTimeMs' IS NOT NULL;
```

## Troubleshooting

### Cron not running
- Check Vercel Dashboard → Crons tab for status
- Verify `CRON_SECRET` environment variable is set
- Query `cron_logs` table to see if executions are being logged
- Check Vercel Function Logs for errors (remember: only 30 min history)

### Users not seeing notifications
- Verify `sync_notifications` table exists in Supabase
- Check that realtime is enabled for the table
- Ensure RLS policies are correct

### Sync skipping business days
- Query `cron_logs` table: `SELECT * FROM cron_logs WHERE status = 'skipped'`
- Check the `details` column for skip reason and target date
- Verify holiday list is up to date in `api/qbo/sync-2025.ts`
- Remember: Cron runs in UTC but checks Pacific time target dates

### Saturday morning runs failing
- This should now work correctly - the cron checks if the TARGET date (Friday) is a business day
- Query: `SELECT * FROM cron_logs WHERE details->>'dayOfWeek' = '6'` to see Saturday executions

## Testing

To test the cron manually:

```bash
curl -X POST https://your-domain.vercel.app/api/qbo/sync-2025 \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Replace `YOUR_CRON_SECRET` with your actual secret from Vercel env vars.
