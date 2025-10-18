-- Create cron_logs table for persistent logging
CREATE TABLE IF NOT EXISTS cron_logs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'error')),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on created_at for efficient querying by date
CREATE INDEX IF NOT EXISTS idx_cron_logs_created_at ON cron_logs(created_at DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_logs(status);

-- Enable Row Level Security
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cron logs
CREATE POLICY "Allow authenticated users to read cron logs"
  ON cron_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert cron logs
CREATE POLICY "Allow service role to insert cron logs"
  ON cron_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Optional: Create a function to clean up old logs (keep 90 days)
CREATE OR REPLACE FUNCTION delete_old_cron_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM cron_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to clean up old logs weekly (if pg_cron is enabled)
-- Uncomment the line below if you have pg_cron enabled in Supabase
-- SELECT cron.schedule('delete-old-cron-logs', '0 0 * * 0', 'SELECT delete_old_cron_logs()');

-- Create a helpful view to see recent cron executions with formatted timestamps
CREATE OR REPLACE VIEW cron_logs_recent AS
SELECT 
  id,
  status,
  details,
  created_at,
  created_at AT TIME ZONE 'America/Los_Angeles' as created_at_pacific,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM cron_logs
ORDER BY created_at DESC
LIMIT 100;

-- Grant select on view to authenticated users
GRANT SELECT ON cron_logs_recent TO authenticated;

