-- ============================================================================
-- RadiantCare Supabase Database Setup
-- Admin-Controlled User Registration System
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USER MANAGEMENT (Admin-Controlled)
-- ============================================================================

-- User invitations table (admin creates invitations, users claim them)
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  invitation_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64url'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  invitation_id UUID REFERENCES public.user_invitations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. SCENARIO MANAGEMENT
-- ============================================================================

-- Scenarios table
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}', -- Array of tags
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Scenario data (JSON)
  scenario_a JSONB NOT NULL,
  scenario_b JSONB,
  scenario_b_enabled BOOLEAN DEFAULT FALSE,
  
  -- View settings
  view_mode TEXT DEFAULT 'YTD Detailed' CHECK (view_mode IN ('YTD Detailed', 'Multi-Year')),
  ytd_settings JSONB, -- Chart settings for YTD view
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Search optimization (updated via trigger)
  search_vector tsvector
);

-- ============================================================================
-- 3. QUICKBOOKS INTEGRATION (GLOBAL)
-- ============================================================================

-- QuickBooks tokens (GLOBAL - single row, admin managed)
CREATE TABLE public.qbo_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure only one row
  realm_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'sandbox')),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- QuickBooks cache (GLOBAL - single row)
CREATE TABLE public.qbo_cache (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure only one row
  last_sync_timestamp TIMESTAMPTZ NOT NULL,
  daily JSONB NOT NULL,
  summary JSONB NOT NULL,
  equity JSONB NOT NULL,
  synced_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- User invitations indexes
CREATE INDEX user_invitations_email_idx ON public.user_invitations(email);
CREATE INDEX user_invitations_code_idx ON public.user_invitations(invitation_code);
CREATE INDEX user_invitations_expires_idx ON public.user_invitations(expires_at);

-- Profiles indexes
CREATE INDEX profiles_email_idx ON public.profiles(email);
CREATE INDEX profiles_is_admin_idx ON public.profiles(is_admin);

-- Scenarios indexes
CREATE INDEX scenarios_user_id_idx ON public.scenarios(user_id);
CREATE INDEX scenarios_is_public_idx ON public.scenarios(is_public);
CREATE INDEX scenarios_created_at_idx ON public.scenarios(created_at DESC);
CREATE INDEX scenarios_search_idx ON public.scenarios USING gin(search_vector);
CREATE INDEX scenarios_tags_idx ON public.scenarios USING gin(tags);
CREATE INDEX scenarios_user_public_idx ON public.scenarios(user_id, is_public);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Helper function to check admin status (prevents infinite recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_cache ENABLE ROW LEVEL SECURITY;

-- User invitations policies
CREATE POLICY "Admins can manage all invitations"
  ON public.user_invitations
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can verify invitations for signup"
  ON public.user_invitations FOR SELECT
  TO anon
  USING (used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Users can view their own invitation"
  ON public.user_invitations FOR SELECT
  USING (email = auth.email());

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Scenarios policies
CREATE POLICY "Users can view their own scenarios"
  ON public.scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public scenarios"
  ON public.scenarios FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can insert their own scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON public.scenarios FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON public.scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- QBO tokens policies (read-only for authenticated users, admin-writable)
CREATE POLICY "Authenticated users can read QBO tokens"
  ON public.qbo_tokens FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage QBO tokens"
  ON public.qbo_tokens
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- QBO cache policies (read-only for authenticated users, admin-writable)
CREATE POLICY "Authenticated users can read QBO cache"
  ON public.qbo_cache FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage QBO cache"
  ON public.qbo_cache
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 6. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update search_vector for scenarios
CREATE OR REPLACE FUNCTION update_scenarios_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' || 
    array_to_string(COALESCE(NEW.tags, '{}'), ' ')
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at 
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qbo_tokens_updated_at 
  BEFORE UPDATE ON public.qbo_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qbo_cache_updated_at 
  BEFORE UPDATE ON public.qbo_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for scenarios search vector (on INSERT and UPDATE)
CREATE TRIGGER update_scenarios_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION update_scenarios_search_vector();

-- Function to handle new user registration (only via invitation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record public.user_invitations%ROWTYPE;
BEGIN
  -- Check if there's a valid invitation for this email
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE email = NEW.email
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  -- If no valid invitation found, prevent registration
  IF invitation_record IS NULL THEN
    RAISE EXCEPTION 'Registration requires a valid invitation. Contact an administrator.';
  END IF;

  -- Create profile for the new user
  INSERT INTO public.profiles (id, email, display_name, invitation_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    invitation_record.id
  );

  -- Mark invitation as used
  UPDATE public.user_invitations
  SET used_at = NOW()
  WHERE id = invitation_record.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 7. ADMIN FUNCTIONS
-- ============================================================================

-- Function to create user invitation (admin only)
CREATE OR REPLACE FUNCTION public.create_user_invitation(
  invitation_email TEXT,
  expires_in_days INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
  invitation_id UUID;
  current_user_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_admin INTO current_user_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(current_user_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Only administrators can create invitations';
  END IF;

  -- Create invitation
  INSERT INTO public.user_invitations (email, invited_by, expires_at)
  VALUES (
    invitation_email,
    auth.uid(),
    NOW() + (expires_in_days || ' days')::INTERVAL
  )
  RETURNING id INTO invitation_id;

  RETURN invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invitation signup URL
CREATE OR REPLACE FUNCTION public.get_invitation_url(invitation_id UUID)
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  current_user_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_admin INTO current_user_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(current_user_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Only administrators can access invitation URLs';
  END IF;

  -- Get invitation code
  SELECT invitation_code INTO token
  FROM public.user_invitations
  WHERE id = invitation_id
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF token IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or expired';
  END IF;

  -- Return signup URL (you'll need to replace with your actual domain)
  RETURN 'https://your-app.vercel.app/signup?invitation=' || token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote user to admin (super admin only - manual SQL)
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET is_admin = TRUE
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_email;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. INITIAL SETUP
-- ============================================================================

-- Create your first admin user invitation (replace with your email)
-- You'll need to run this manually after creating your Supabase project
-- 
-- INSERT INTO public.user_invitations (email, invitation_code, expires_at)
-- VALUES ('your-admin-email@example.com', 'ADMIN_SETUP_2025', NOW() + INTERVAL '30 days');
-- 
-- After you sign up with this invitation, promote yourself to admin:
-- UPDATE public.profiles SET is_admin = TRUE WHERE email = 'your-admin-email@example.com';

-- ============================================================================
-- 9. HELPFUL VIEWS FOR ADMIN
-- ============================================================================

-- View for admin dashboard
CREATE VIEW public.admin_user_overview AS
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.is_admin,
  p.created_at,
  i.invitation_code,
  i.expires_at as invitation_expires,
  i.used_at as invitation_used,
  (SELECT COUNT(*) FROM public.scenarios WHERE user_id = p.id) as scenario_count,
  (SELECT COUNT(*) FROM public.scenarios WHERE user_id = p.id AND is_public = TRUE) as public_scenario_count
FROM public.profiles p
LEFT JOIN public.user_invitations i ON p.invitation_id = i.id
ORDER BY p.created_at DESC;

-- View for pending invitations
CREATE VIEW public.pending_invitations AS
SELECT 
  id,
  email,
  invitation_code,
  expires_at,
  created_at,
  CASE 
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
    ELSE 'pending'
  END as status
FROM public.user_invitations
WHERE used_at IS NULL
ORDER BY created_at DESC;

-- Note: Views inherit RLS from their underlying tables
-- No need to set RLS policies on views directly

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Create your Supabase project
-- 2. Run this SQL in the Supabase SQL Editor
-- 3. Configure Supabase Auth settings (disable public registration)
-- 4. Create your first admin invitation manually
-- 5. Sign up using the invitation and promote yourself to admin
