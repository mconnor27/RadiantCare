# QuickBooks Cron Sync Setup

## Overview
Automated daily QuickBooks syncing runs Tuesday-Saturday at 1am Pacific Time, syncing data from Monday-Friday business days. The cron automatically:
- Skips weekends and federal holidays
- Warns active users before syncing
- Only syncs on valid business days

## Setup Steps

### 1. Create Supabase Table for Notifications

Run this SQL in your Supabase SQL Editor:

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
   - `0 9 * 1-2,11-12 2-6` (Winter: PST)
   - `0 8 * 3-10 2-6` (Summer: PDT)
3. Check logs after 1am Pacific on a business day to verify execution

## Schedule Details

- **Runs**: Tuesday through Saturday at approximately 1:00 AM Pacific Time
- **Syncs Data For**: Monday through Friday (previous business day)
- **Skips**: Weekends and US Federal Holidays

### DST Schedule (Approximate)

Two cron expressions handle seasonal time changes:

| Period | Schedule | Time (UTC) | Pacific Time | Notes |
|--------|----------|------------|--------------|-------|
| Jan-Feb, Nov-Dec | `0 9 * 1-2,11-12 2-6` | 9:00 AM | 1:00 AM PST | Winter months |
| Mar-Oct | `0 8 * 3-10 2-6` | 8:00 AM | ~1:00 AM PDT | Summer months |

**Note**: This uses a simplified 2-cron approach due to Vercel free tier limits. The sync will run:
- **Exactly 1:00 AM** during most of the year
- **Off by 1 hour** for 1-2 weeks during DST transitions in early March and early November
  - Early March (before Mar 9): Runs at 12:00 AM (midnight) instead of 1:00 AM
  - Early November (Nov 1): Runs at 12:00 AM (midnight) instead of 1:00 AM

**DST Transitions for 2025:**
- **Spring Forward**: Sunday, March 9, 2025 at 2:00 AM → 3:00 AM PDT
- **Fall Back**: Sunday, November 2, 2025 at 2:00 AM → 1:00 AM PST

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
3. **Business Day Check**: Skips if not a business day (weekend/holiday)
4. **User Warning**: Inserts notification into Supabase (active users see toast)
5. **Sync**: Fetches QuickBooks data and updates cache
6. **Frontend Refresh**: Active users' dashboards refresh automatically

## User Experience

Active users at 1am Pacific will see:
1. A blue toast notification: "QuickBooks sync starting - your view may refresh shortly"
2. Toast appears for 5 seconds
3. Dashboard refreshes with new data after sync completes

## Manual Sync

Users can still manually trigger sync via the "Sync QuickBooks" button in the dashboard. Manual syncs follow the same business day restrictions (admins can override).

## Troubleshooting

### Cron not running
- Check Vercel Dashboard → Crons tab for status
- Verify `CRON_SECRET` environment variable is set
- Check Vercel Function Logs for errors

### Users not seeing notifications
- Verify `sync_notifications` table exists in Supabase
- Check that realtime is enabled for the table
- Ensure RLS policies are correct

### Sync skipping business days
- Check Vercel Function Logs for skip reason
- Verify holiday list is up to date
- Check timezone (cron runs in UTC)

## Testing

To test the cron manually:

```bash
curl -X POST https://your-domain.vercel.app/api/qbo/sync-2025 \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Replace `YOUR_CRON_SECRET` with your actual secret from Vercel env vars.
