-- ============================================================================
-- Create Default YTD Scenario with Baseline Data
-- This scenario provides the baseline configuration for all users
-- ============================================================================

DO $$ 
DECLARE
  admin_user_id UUID;
  qbo_timestamp TIMESTAMPTZ;
BEGIN
  -- Get admin user ID (replace with your admin email)
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'mike@radiantcare.com'; -- ⭐ REPLACE WITH YOUR EMAIL
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Please update the email address.';
  END IF;
  
  -- Set QBO timestamp to now (or use a specific timestamp if you have it)
  qbo_timestamp := NOW();
  
  -- Insert or update the Default scenario
  INSERT INTO public.scenarios (
    user_id,
    name,
    description,
    is_public,
    view_mode,
    tags,
    ytd_settings,
    baseline_date,
    qbo_sync_timestamp,
    year_2025_data,
    custom_projected_values,
    scenario_data,
    baseline_mode
  ) VALUES (
    admin_user_id,
    'Default',
    'Administrator-configured baseline for YTD analysis. Load this to restore standard settings.',
    true,  -- Public so all users can see it
    'YTD Detailed',
    ARRAY['default', 'template', 'admin', 'baseline'],
    
    -- Chart configuration (ytd_settings)
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
    
    -- Baseline 2025 data (year_2025_data)
    -- This contains the physician configuration only
    jsonb_build_object(
      'miscEmploymentCosts', 29115.51,
      'prcsDirectorPhysicianId', null,  -- Will be set when loaded
      'physicians', jsonb_build_array(
        -- Default 2025 physician configuration
        jsonb_build_object(
          'id', '2025-MC', 'name', 'Connor', 'type', 'employeeToPartner',
          'employeePortionOfYear', 0, 'salary', 328840, 'employeeWeeksVacation', 5,
          'weeksVacation', 9, 'receivesBenefits', false, 'receivesBonuses', false,
          'bonusAmount', 0, 'hasMedicalDirectorHours', true,
          'medicalDirectorHoursPercentage', 26.39, 'additionalDaysWorked', 0
        ),
        jsonb_build_object(
          'id', '2025-JS', 'name', 'Suszko', 'type', 'partner',
          'weeksVacation', 11, 'receivesBonuses', false, 'bonusAmount', 0,
          'hasMedicalDirectorHours', true, 'medicalDirectorHoursPercentage', 33.33,
          'additionalDaysWorked', 0
        ),
        jsonb_build_object(
          'id', '2025-GA', 'name', 'Allen', 'type', 'partner',
          'weeksVacation', 16, 'receivesBonuses', false, 'bonusAmount', 0,
          'hasMedicalDirectorHours', true, 'medicalDirectorHoursPercentage', 33.33,
          'additionalDaysWorked', 1000
        ),
        jsonb_build_object(
          'id', '2025-HW', 'name', 'Werner', 'type', 'partnerToRetire',
          'partnerPortionOfYear', 0, 'buyoutCost', 51666.58,
          'receivesBonuses', false, 'bonusAmount', 0,
          'trailingSharedMdAmount', 8302.50, 'additionalDaysWorked', 0
        ),
        jsonb_build_object(
          'id', '2025-BT', 'name', 'Tinnel', 'type', 'employee',
          'salary', 430760, 'receivesBenefits', false,
          'receivesBonuses', false, 'bonusAmount', 0
        )
      )
    ),
    
    -- Grid overrides (custom_projected_values)
    -- These are the values you want to show in the grid's projected column
    -- Keys MUST match the exact account names from the grid
    jsonb_build_object(
      'Medical Director Hours (Shared)', 119374,
      'Medical Director Hours (PRCS)', 32321,
      'Consulting Agreement/Other', 16200,
      '8322 Locums - Salary', 54600
    ),
    null,         -- No scenario_data for YTD scenarios
    null          -- No baseline_mode for YTD scenarios
  )
  ON CONFLICT (user_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    ytd_settings = EXCLUDED.ytd_settings,
    year_2025_data = EXCLUDED.year_2025_data,
    updated_at = NOW();
  
  RAISE NOTICE 'Default YTD scenario created/updated successfully!';
  
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
  s.created_at,
  s.custom_projected_values->>'Medical Director Hours (Shared)' as md_hours_shared,
  s.custom_projected_values->>'Medical Director Hours (PRCS)' as md_hours_prcs,
  s.custom_projected_values->>'Consulting Agreement/Other' as consulting,
  s.custom_projected_values->>'8322 Locums - Salary' as locums
FROM public.scenarios s
JOIN auth.users u ON s.user_id = u.id
WHERE s.name = 'Default'
AND s.view_mode = 'YTD Detailed'
ORDER BY s.created_at DESC
LIMIT 1;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Replace 'mike@radiantcare.com' with your actual admin email (line 13)
-- 2. Run this script in Supabase SQL Editor
-- 3. Verify the output shows the Default scenario was created
-- 4. You can update the year_2025_data values to match your preferences
-- ============================================================================

