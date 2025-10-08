-- ============================================================================
-- MIGRATION: Bifurcate Scenarios (YTD vs Multi-Year)
-- Purpose: Add view_mode and update existing scenarios for backward compatibility
-- Run this in Supabase SQL Editor after deploying the new code
-- ============================================================================

-- Step 1: Add view_mode column if it doesn't exist (it should already exist from supabase-setup.sql)
-- This is safe to run even if column exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='scenarios' AND column_name='view_mode') THEN
    ALTER TABLE public.scenarios ADD COLUMN view_mode TEXT DEFAULT 'Multi-Year';
  END IF;
END $$;

-- Step 2: Set view_mode for existing scenarios based on legacy scenario_type (if it exists)
-- This provides backward compatibility
UPDATE public.scenarios
SET view_mode = CASE
  WHEN scenario_type = 'ytd-analysis' THEN 'YTD Detailed'
  ELSE 'Multi-Year'
END
WHERE view_mode IS NULL OR view_mode = '';

-- Step 3: For scenarios without view_mode, default to 'Multi-Year' (safest assumption)
UPDATE public.scenarios
SET view_mode = 'Multi-Year'
WHERE view_mode IS NULL OR view_mode = '';

-- Step 4: Add NOT NULL constraint to view_mode (after setting defaults)
ALTER TABLE public.scenarios
  ALTER COLUMN view_mode SET NOT NULL;

-- Step 5: Add CHECK constraint to ensure only valid view modes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scenarios_view_mode_check') THEN
    ALTER TABLE public.scenarios
      ADD CONSTRAINT scenarios_view_mode_check 
      CHECK (view_mode IN ('YTD Detailed', 'Multi-Year'));
  END IF;
END $$;

-- Step 6: Create index on view_mode for faster filtering
CREATE INDEX IF NOT EXISTS scenarios_view_mode_idx ON public.scenarios(view_mode);

-- Step 7: OPTIONAL - Clean up legacy scenario_type column (ONLY if you're sure)
-- UNCOMMENT these lines if you want to remove the old column:
-- ALTER TABLE public.scenarios DROP COLUMN IF EXISTS scenario_type CASCADE;

-- Step 8: Verify the migration
-- This query shows the distribution of scenarios by view_mode
SELECT 
  view_mode,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE scenario_data IS NOT NULL) as multi_year_count,
  COUNT(*) FILTER (WHERE ytd_settings IS NOT NULL) as ytd_count
FROM public.scenarios
GROUP BY view_mode
ORDER BY view_mode;

-- Step 9: Show any scenarios that might need manual review
-- (e.g., YTD scenarios with scenario_data, or Multi-Year without it)
SELECT 
  id,
  name,
  view_mode,
  CASE 
    WHEN scenario_data IS NOT NULL THEN 'Has scenario_data'
    ELSE 'No scenario_data'
  END as data_status,
  CASE 
    WHEN ytd_settings IS NOT NULL THEN 'Has ytd_settings'
    ELSE 'No ytd_settings'
  END as settings_status
FROM public.scenarios
WHERE 
  (view_mode = 'YTD Detailed' AND scenario_data IS NOT NULL) OR
  (view_mode = 'Multi-Year' AND scenario_data IS NULL)
ORDER BY view_mode, name;

-- ============================================================================
-- NOTES:
-- - This migration is backward compatible - existing scenarios will work
-- - New scenarios will use the proper view_mode structure
-- - YTD scenarios will be lightweight (ytd_settings only)
-- - Multi-Year scenarios will have full data (scenario_data + baseline)
-- - The frontend code handles both old and new formats gracefully
-- ============================================================================

