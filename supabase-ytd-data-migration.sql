-- ============================================================================
-- YTD SCENARIO DATA MIGRATION
-- Purpose: Add year_2025_data and custom_projected_values columns to store
--          physician settings and grid overrides for YTD scenarios
-- ============================================================================

-- Step 1: Add new columns for YTD scenarios
ALTER TABLE public.scenarios 
  ADD COLUMN IF NOT EXISTS year_2025_data JSONB,
  ADD COLUMN IF NOT EXISTS custom_projected_values JSONB DEFAULT '{}'::jsonb;

-- Step 2: Add comments to document the columns
COMMENT ON COLUMN public.scenarios.year_2025_data IS 'FutureYear data for 2025 including physicians and their settings (YTD scenarios only)';
COMMENT ON COLUMN public.scenarios.custom_projected_values IS 'User''s custom grid overrides for projected values (YTD scenarios: 2025 only, Multi-Year: all years)';

-- Step 3: Migrate existing Multi-Year scenarios to have custom_projected_values
-- Extract from scenario_data.customProjectedValues if present
UPDATE public.scenarios
SET custom_projected_values = COALESCE(
  scenario_data->'customProjectedValues', 
  '{}'::jsonb
)
WHERE view_mode = 'Multi-Year'
  AND scenario_data IS NOT NULL
  AND custom_projected_values IS NULL;

-- Step 4: For existing YTD scenarios, initialize to empty defaults
UPDATE public.scenarios
SET 
  year_2025_data = NULL,
  custom_projected_values = '{}'::jsonb
WHERE view_mode = 'YTD Detailed'
  AND year_2025_data IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check column structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scenarios'
  AND column_name IN ('year_2025_data', 'custom_projected_values')
ORDER BY column_name;

-- Count scenarios by type and check new columns
SELECT
  view_mode,
  COUNT(*) as total,
  COUNT(year_2025_data) as with_year_data,
  COUNT(custom_projected_values) as with_custom_values
FROM public.scenarios
GROUP BY view_mode;

-- Show a sample YTD scenario structure
SELECT
  id,
  name,
  view_mode,
  CASE 
    WHEN year_2025_data IS NOT NULL THEN '✓ Has 2025 Data'
    ELSE '✗ No 2025 Data'
  END as year_data_status,
  jsonb_typeof(custom_projected_values) as custom_values_type,
  created_at
FROM public.scenarios
WHERE view_mode = 'YTD Detailed'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- If you need to rollback this migration, run:
-- 
-- ALTER TABLE public.scenarios 
--   DROP COLUMN IF EXISTS year_2025_data,
--   DROP COLUMN IF EXISTS custom_projected_values;
-- 
-- Note: You'll lose any YTD physician/override data that was saved.
-- ============================================================================

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE 'Successfully added year_2025_data and custom_projected_values columns to scenarios table';
  RAISE NOTICE 'YTD scenarios can now store physician settings and grid overrides';
END $$;
