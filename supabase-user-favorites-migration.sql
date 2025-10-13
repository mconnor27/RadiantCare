-- ============================================================================
-- MIGRATION: User Favorites Table (Per-User Favorites)
-- Purpose: Move favorites from scenario columns to per-user table
-- ============================================================================

-- Step 1: Create the user_favorites table
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE NOT NULL,
  favorite_type TEXT NOT NULL CHECK (favorite_type IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, favorite_type),
  UNIQUE (user_id, scenario_id, favorite_type)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS user_favorites_user_id_idx ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS user_favorites_scenario_id_idx ON public.user_favorites(scenario_id);

-- Step 3: Migrate existing favorite data (if any exists in scenarios table)
-- This attempts to preserve existing favorites by assigning them to the scenario owner
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'is_favorite_a'
  ) THEN
    -- Migrate favorite A
    INSERT INTO public.user_favorites (user_id, scenario_id, favorite_type, created_at)
    SELECT user_id, id, 'A', NOW()
    FROM public.scenarios
    WHERE is_favorite_a = true
    ON CONFLICT (user_id, favorite_type) DO NOTHING;

    -- Migrate favorite B
    INSERT INTO public.user_favorites (user_id, scenario_id, favorite_type, created_at)
    SELECT user_id, id, 'B', NOW()
    FROM public.scenarios
    WHERE is_favorite_b = true
    ON CONFLICT (user_id, favorite_type) DO NOTHING;
  END IF;
END $$;

-- Step 4: Remove old favorite columns from scenarios table
ALTER TABLE public.scenarios
  DROP COLUMN IF EXISTS is_favorite_a,
  DROP COLUMN IF EXISTS is_favorite_b;

-- Step 5: Enable RLS on user_favorites table
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
  ON public.user_favorites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Step 7: Add helpful comment
COMMENT ON TABLE public.user_favorites IS
  'Per-user favorite scenarios. Each user can have one favorite A and one favorite B.';

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================

-- Check user_favorites structure
-- SELECT * FROM public.user_favorites ORDER BY user_id, favorite_type;

-- Count favorites per user
-- SELECT user_id, COUNT(*) as favorite_count
-- FROM public.user_favorites
-- GROUP BY user_id;

-- Verify RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'user_favorites';
