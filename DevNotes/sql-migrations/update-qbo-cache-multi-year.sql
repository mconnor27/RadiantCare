-- Update qbo_cache table to support multi-year caching
-- Part of Phase 2.2: Year-Agnostic Refactoring

-- Safe migration: Create new table with correct schema
CREATE TABLE IF NOT EXISTS public.qbo_cache_new (
  year INTEGER PRIMARY KEY,
  last_sync_timestamp TIMESTAMPTZ NOT NULL,
  daily JSONB,
  summary JSONB,
  equity JSONB,
  retirement_accounts JSONB,
  retirement_gl_data JSONB,
  synced_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing data (assumes current cache is for 2025)
-- Only migrate if there's data with id = 1
-- Note: Old table may not have created_at/updated_at columns, so we set them to NOW()
INSERT INTO public.qbo_cache_new (
  year,
  last_sync_timestamp,
  daily,
  summary,
  equity,
  retirement_accounts,
  retirement_gl_data,
  synced_by,
  created_at,
  updated_at
)
SELECT
  2025 as year,
  last_sync_timestamp,
  daily,
  summary,
  equity,
  retirement_accounts,
  retirement_gl_data,
  synced_by,
  NOW() as created_at,  -- Set to current time since old table doesn't have this
  NOW() as updated_at   -- Set to current time since old table doesn't have this
FROM public.qbo_cache
WHERE id = 1
ON CONFLICT (year) DO NOTHING;

-- Drop old table
DROP TABLE IF EXISTS public.qbo_cache;

-- Rename new table
ALTER TABLE public.qbo_cache_new RENAME TO qbo_cache;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_qbo_cache_year ON public.qbo_cache(year);
CREATE INDEX IF NOT EXISTS idx_qbo_cache_timestamp ON public.qbo_cache(last_sync_timestamp);

-- Enable RLS (if it was enabled on old table)
ALTER TABLE public.qbo_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read cache
CREATE POLICY "Authenticated users can read qbo cache"
  ON public.qbo_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins and system can write
CREATE POLICY "Only admins and system can write qbo cache"
  ON public.qbo_cache
  FOR ALL
  USING (
    -- Allow if admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
    OR
    -- Allow if synced_by is NULL (system/cron job)
    synced_by IS NULL
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_qbo_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_qbo_cache_updated_at
  BEFORE UPDATE ON public.qbo_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_qbo_cache_updated_at();

-- Verify migration
SELECT year, last_sync_timestamp, synced_by
FROM public.qbo_cache
ORDER BY year;
