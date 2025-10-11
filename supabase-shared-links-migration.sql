-- ============================================================================
-- MIGRATION: Create shared_links table for shareable URLs
-- Purpose: Enable users to create short shareable links for scenario views
-- ============================================================================

-- Step 1: Create shared_links table
CREATE TABLE IF NOT EXISTS public.shared_links (
  id TEXT PRIMARY KEY,  -- Short unique ID (10 chars via nanoid)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional expiration
  view_mode TEXT NOT NULL CHECK (view_mode IN ('YTD Detailed', 'Multi-Year')),

  -- Scenario references
  scenario_a_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  scenario_b_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
  scenario_b_enabled BOOLEAN NOT NULL DEFAULT false,

  -- UI Settings (JSON)
  ui_settings JSONB,

  -- Metadata
  view_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS shared_links_user_id_idx ON public.shared_links(user_id);
CREATE INDEX IF NOT EXISTS shared_links_created_at_idx ON public.shared_links(created_at);
CREATE INDEX IF NOT EXISTS shared_links_scenario_a_id_idx ON public.shared_links(scenario_a_id);
CREATE INDEX IF NOT EXISTS shared_links_scenario_b_id_idx ON public.shared_links(scenario_b_id);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies

-- Policy: Anyone can read shared links (they're meant to be shared!)
CREATE POLICY "Anyone can view shared links"
  ON public.shared_links
  FOR SELECT
  USING (true);

-- Policy: Users can create their own shared links
CREATE POLICY "Users can create their own shared links"
  ON public.shared_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own shared links
CREATE POLICY "Users can delete their own shared links"
  ON public.shared_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can update their own shared links (for view count, etc.)
CREATE POLICY "Users can update their own shared links"
  ON public.shared_links
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Allow system to update view counts (no auth required)
CREATE POLICY "System can update view counts"
  ON public.shared_links
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Step 5: Create function to increment view count
CREATE OR REPLACE FUNCTION public.increment_shared_link_view(link_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.shared_links
  SET
    view_count = view_count + 1,
    last_accessed_at = NOW()
  WHERE id = link_id;
END;
$$;

-- Step 6: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.increment_shared_link_view TO anon, authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify table creation
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shared_links'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'shared_links';

-- Verify RLS policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'shared_links';

-- ============================================================================
-- NOTES:
-- - Links are publicly readable (anyone with the link can view)
-- - Only owners can create/delete their own links
-- - View counts are tracked automatically
-- - Expired links can be filtered in application logic
-- - Deleting a scenario will cascade delete its shared links
-- ============================================================================
