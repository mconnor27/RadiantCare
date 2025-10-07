-- ============================================================================
-- MIGRATION: Add Scenario Metadata & Consolidate Data Column
-- Purpose: Add metadata fields and consolidate scenario data into single column
-- Run this in Supabase SQL Editor AFTER running supabase-setup.sql
-- ============================================================================

-- Add scenario_data column (consolidated storage)
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS scenario_data JSONB;

-- Migrate existing data from scenario_a/b to scenario_data (if any rows exist)
UPDATE public.scenarios
SET scenario_data = jsonb_build_object(
  'scenarioA', scenario_a,
  'scenarioBEnabled', scenario_b_enabled,
  'scenarioB', scenario_b,
  'customProjectedValues', '{}'::jsonb
)
WHERE scenario_data IS NULL AND scenario_a IS NOT NULL;

-- Make old columns nullable since we're using scenario_data now
ALTER TABLE public.scenarios
  ALTER COLUMN scenario_a DROP NOT NULL,
  ALTER COLUMN scenario_b_enabled DROP NOT NULL;

-- Add new metadata columns to scenarios table
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS scenario_type TEXT 
    CHECK (scenario_type IN ('historical-projection', 'ytd-analysis', 'forward-projection')),
  ADD COLUMN IF NOT EXISTS baseline_mode TEXT
    CHECK (baseline_mode IN ('2024 Data', '2025 Data', 'Custom')),
  ADD COLUMN IF NOT EXISTS baseline_date TEXT, -- ISO date string (YYYY-MM-DD)
  ADD COLUMN IF NOT EXISTS qbo_sync_timestamp TIMESTAMPTZ; -- When QBO was synced for 2025 baseline

-- Create index for filtering by scenario type
CREATE INDEX IF NOT EXISTS scenarios_type_idx ON public.scenarios(scenario_type);

-- Note: To enable joining scenarios -> profiles for creator_email,
-- we rely on profiles.id matching auth.users.id via the handle_new_user trigger.
-- PostgREST can infer this relationship automatically.

-- Add comment for documentation
COMMENT ON COLUMN public.scenarios.scenario_type IS 
  'Type of scenario: historical-projection (2024 baseline), ytd-analysis (2025 YTD), forward-projection (2025 + future)';
COMMENT ON COLUMN public.scenarios.baseline_mode IS 
  'Data mode used as baseline: 2024 Data, 2025 Data, or Custom';
COMMENT ON COLUMN public.scenarios.baseline_date IS 
  'ISO date (YYYY-MM-DD) representing the baseline data - either 2024-12-31 or the 2025 YTD date';
COMMENT ON COLUMN public.scenarios.qbo_sync_timestamp IS 
  'Timestamp when QuickBooks was last synced (for 2025 baseline scenarios only)';
