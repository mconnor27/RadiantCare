-- ============================================================================
-- FIX: Update scenario_type check constraint to match current code
-- Purpose: Replace old constraint values with new ones
-- Date: 2025-10-15
-- ============================================================================

-- Step 1: Drop the old check constraint
ALTER TABLE public.scenarios
DROP CONSTRAINT IF EXISTS scenarios_scenario_type_check;

-- Step 2: Add the new check constraint with correct values
ALTER TABLE public.scenarios
ADD CONSTRAINT scenarios_scenario_type_check
CHECK (scenario_type IS NULL OR scenario_type IN ('current_year', 'projection'));

-- Step 3: Verify the constraint was updated
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.scenarios'::regclass
  AND conname LIKE '%scenario_type%';

-- ============================================================================
-- NOTES:
-- - scenario_type can be NULL for backward compatibility with existing scenarios
-- - New scenarios will use 'current_year' (for YTD/2025 baseline settings)
-- - Or 'projection' (for Multi-Year projection scenarios)
-- ============================================================================

