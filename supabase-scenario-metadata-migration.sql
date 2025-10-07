-- ============================================================================
-- MIGRATION: Add Scenario Metadata
-- Purpose: Add metadata fields to track scenario type, baseline, and timestamps
-- Run this in Supabase SQL Editor AFTER running supabase-setup.sql
-- ============================================================================

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

-- Add comment for documentation
COMMENT ON COLUMN public.scenarios.scenario_type IS 
  'Type of scenario: historical-projection (2024 baseline), ytd-analysis (2025 YTD), forward-projection (2025 + future)';
COMMENT ON COLUMN public.scenarios.baseline_mode IS 
  'Data mode used as baseline: 2024 Data, 2025 Data, or Custom';
COMMENT ON COLUMN public.scenarios.baseline_date IS 
  'ISO date (YYYY-MM-DD) representing the baseline data - either 2024-12-31 or the 2025 YTD date';
COMMENT ON COLUMN public.scenarios.qbo_sync_timestamp IS 
  'Timestamp when QuickBooks was last synced (for 2025 baseline scenarios only)';
