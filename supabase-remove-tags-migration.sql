-- ============================================================================
-- CLEANUP MIGRATION: Remove Tags System
-- Purpose: Drop the tags column and index that are no longer used
-- Run this in Supabase SQL Editor AFTER deploying the code without tags
-- ============================================================================

-- Step 1: Drop the tags GIN index (if it exists)
DROP INDEX IF EXISTS public.scenarios_tags_idx;

-- Step 2: Drop the tags column from scenarios table
ALTER TABLE public.scenarios 
  DROP COLUMN IF EXISTS tags;

-- Step 3: Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scenarios'
ORDER BY ordinal_position;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show all indexes on scenarios table (tags index should be gone)
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'scenarios'
  AND schemaname = 'public'
ORDER BY indexname;

-- Count scenarios (should all still be there)
SELECT COUNT(*) as scenario_count FROM public.scenarios;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- If you need to rollback this migration, run:
-- 
-- ALTER TABLE public.scenarios ADD COLUMN tags TEXT[] DEFAULT '{}';
-- CREATE INDEX scenarios_tags_idx ON public.scenarios USING gin(tags);
-- 
-- Note: You'll lose any tags data that existed before this migration.
-- ============================================================================

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE 'Tags column and index successfully removed from scenarios table';
END $$;

