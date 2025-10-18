-- ============================================================================
-- MIGRATION: User Favorites Table v2 (Add CURRENT favorite type)
-- Purpose: Add support for CURRENT favorite type for Current Year scenarios
-- ============================================================================

-- Step 1: Drop the existing check constraint
ALTER TABLE public.user_favorites 
DROP CONSTRAINT IF EXISTS user_favorites_favorite_type_check;

-- Step 2: Add new check constraint allowing A, B, and CURRENT
ALTER TABLE public.user_favorites 
ADD CONSTRAINT user_favorites_favorite_type_check 
CHECK (favorite_type IN ('A', 'B', 'CURRENT'));

-- Step 3: Update table comment to reflect new structure
COMMENT ON TABLE public.user_favorites IS
  'Per-user favorite scenarios. Each user can have one favorite A, one favorite B, and one CURRENT favorite.';

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================

-- Check user_favorites structure
-- SELECT * FROM public.user_favorites ORDER BY user_id, favorite_type;

-- Count favorites per user by type
-- SELECT user_id, favorite_type, COUNT(*) as count
-- FROM public.user_favorites
-- GROUP BY user_id, favorite_type
-- ORDER BY user_id, favorite_type;

-- Verify constraint exists
-- SELECT conname, consrc FROM pg_constraint WHERE conname = 'user_favorites_favorite_type_check';
