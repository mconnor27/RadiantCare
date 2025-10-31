-- Add year configuration settings to existing app_settings table
-- Part of Phase 1.2: Year-Agnostic Refactoring

-- Add current fiscal year setting
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'current_fiscal_year',
  '2025'::jsonb,
  'Current baseline year for financial planning'
)
ON CONFLICT (key) DO NOTHING;

-- Add projection years setting
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'projection_years',
  '5'::jsonb,
  'Number of years to project forward from baseline year'
)
ON CONFLICT (key) DO NOTHING;

-- Add prior year marked complete flag
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'prior_year_marked_complete',
  'false'::jsonb,
  'Whether prior year data has been marked final by admin (overrides April 15th cutoff)'
)
ON CONFLICT (key) DO NOTHING;

-- Add prior year cutoff date setting
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'prior_year_cutoff_date',
  '"2025-04-15"'::jsonb,
  'Date after which prior year uses snapshot instead of live QBO data'
)
ON CONFLICT (key) DO NOTHING;

-- Verify settings were added
SELECT key, value, description
FROM public.app_settings
WHERE key IN (
  'current_fiscal_year',
  'projection_years',
  'prior_year_marked_complete',
  'prior_year_cutoff_date'
)
ORDER BY key;
