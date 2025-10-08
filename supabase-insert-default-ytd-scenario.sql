-- ============================================================================
-- INSERT DEFAULT YTD SCENARIO
-- Purpose: Save the configured YTD defaults as a public scenario
-- Run this in Supabase SQL Editor after the admin user is created
-- ============================================================================

-- Get the admin user ID (replace with your actual admin user email)
DO $$ 
DECLARE
  admin_user_id UUID;
  qbo_timestamp TIMESTAMPTZ;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'YOUR_ADMIN_EMAIL_HERE'  -- REPLACE THIS
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Please update the email in this script.';
  END IF;
  
  -- Get latest QBO sync timestamp (optional)
  SELECT last_sync_timestamp INTO qbo_timestamp
  FROM public.qbo_cache
  WHERE id = 1;
  
  -- Insert the Default YTD scenario
  INSERT INTO public.scenarios (
    user_id,
    name,
    description,
    is_public,
    view_mode,
    ytd_settings,
    baseline_date,
    qbo_sync_timestamp,
    scenario_data,
    baseline_mode
  ) VALUES (
    admin_user_id,
    'Default',
    'Configured by Administrator',
    true,  -- Public so all users can see it
    'YTD Detailed',
    jsonb_build_object(
      'isNormalized', false,
      'showCombined', false,
      'combineStatistic', null,
      'combineError', null,
      'chartMode', 'line',
      'timeframe', 'year',
      'currentPeriod', jsonb_build_object('year', EXTRACT(YEAR FROM CURRENT_DATE)),
      'is2025Visible', true,
      'showAllMonths', true,
      'incomeMode', 'total',
      'smoothingByMode', jsonb_build_object('line', 10, 'bar', 0, 'proportion', 12),
      'selectedYears', jsonb_build_array(2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024),
      'visibleSites', jsonb_build_object('lacey', true, 'centralia', true, 'aberdeen', true),
      'colorScheme', 'radiantCare',
      'siteColorScheme', 'rgb'
    ),
    CURRENT_DATE,
    qbo_timestamp,
    null,  -- No scenario_data for YTD scenarios
    null   -- No baseline_mode for YTD scenarios
  )
  ON CONFLICT DO NOTHING;  -- Don't insert if a scenario with this name already exists for this user
  
  RAISE NOTICE 'Default YTD scenario created successfully!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating default scenario: %', SQLERRM;
END $$;

-- Verify the scenario was created
SELECT 
  s.id,
  s.name,
  s.description,
  s.view_mode,
  s.is_public,
  s.tags,
  u.email as creator_email,
  s.created_at
FROM public.scenarios s
JOIN auth.users u ON s.user_id = u.id
WHERE s.name = 'Default'
AND s.view_mode = 'YTD Detailed'
ORDER BY s.created_at DESC
LIMIT 1;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Replace 'YOUR_ADMIN_EMAIL_HERE' with your actual admin email
-- 2. Run this script in Supabase SQL Editor
-- 3. Verify the output shows the Default scenario was created
-- 4. Users can now load this scenario to restore default settings
-- ============================================================================

