-- ============================================================================
-- MIGRATION: Modular Scenario System
-- Purpose: Separate Current Year Settings from Projections for true modularity
-- Date: 2025-10-14
-- ============================================================================

-- Step 1: Add new columns to scenarios table
ALTER TABLE public.scenarios
ADD COLUMN IF NOT EXISTS scenario_type TEXT CHECK (scenario_type IN ('current_year', 'projection')),
ADD COLUMN IF NOT EXISTS projection_settings JSONB,
ADD COLUMN IF NOT EXISTS future_years JSONB,
ADD COLUMN IF NOT EXISTS future_custom_values JSONB,
ADD COLUMN IF NOT EXISTS baseline_years JSONB;

-- Step 2: Create indexes for new columns
CREATE INDEX IF NOT EXISTS scenarios_scenario_type_idx ON public.scenarios(scenario_type);

-- Step 3: Add snapshot_data column to shared_links table for immutable snapshots
ALTER TABLE public.shared_links
ADD COLUMN IF NOT EXISTS snapshot_data JSONB;

-- Step 4: Add original scenario references to shared_links (for attribution)
ALTER TABLE public.shared_links
ADD COLUMN IF NOT EXISTS original_current_year_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_projection_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL;

-- Step 5: Make old scenario references nullable (for backward compatibility)
ALTER TABLE public.shared_links
ALTER COLUMN scenario_a_id DROP NOT NULL,
ALTER COLUMN scenario_b_id DROP NOT NULL;

-- Step 6: Add comment to explain new structure
COMMENT ON COLUMN scenarios.scenario_type IS 'Type of scenario: current_year (2025 baseline) or projection (2026-2030 settings)';
COMMENT ON COLUMN scenarios.projection_settings IS 'Projection settings (growth rates, global params) for projection scenarios';
COMMENT ON COLUMN scenarios.future_years IS 'Future years data (2026-2030) for projection scenarios';
COMMENT ON COLUMN scenarios.future_custom_values IS 'Grid overrides for future years (2026-2030) for projection scenarios';
COMMENT ON COLUMN scenarios.baseline_years IS 'Baseline years data (e.g., 2024) for projections with 2024/Custom baseline modes';
COMMENT ON COLUMN shared_links.snapshot_data IS 'Complete immutable snapshot of scenario state (QBO data, current year settings, projection)';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'scenarios' AND column_name IN ('scenario_type', 'projection_settings', 'future_years', 'future_custom_values', 'baseline_years')
ORDER BY ordinal_position;

-- Verify shared_links columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shared_links' AND column_name IN ('snapshot_data', 'original_current_year_id', 'original_projection_id')
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'scenarios' AND indexname LIKE '%scenario_type%';

-- ============================================================================
-- NOTES:
-- - scenario_type is nullable to support existing scenarios (backward compat)
-- - Current scenarios will have scenario_type=NULL initially
-- - New saves will populate scenario_type='current_year' or 'projection'
-- - shared_links.snapshot_data will be populated for new shared links
-- - Old shared links continue to work via scenario_a_id/scenario_b_id references
-- ============================================================================


