-- ============================================================================
-- FIX FUNCTION SEARCH PATH SECURITY WARNINGS
-- Purpose: Add SET search_path to all functions to prevent search path attacks
-- Run this in Supabase SQL Editor to fix the security warnings
-- ============================================================================

-- Fix delete_old_cron_logs function
CREATE OR REPLACE FUNCTION public.delete_old_cron_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cron_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix increment_shared_link_view function
CREATE OR REPLACE FUNCTION public.increment_shared_link_view(link_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.shared_links
  SET
    view_count = view_count + 1,
    last_accessed_at = NOW()
  WHERE id = link_id;
END;
$$;

-- Fix create_user_invitation function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix update_scenarios_search_vector function
CREATE OR REPLACE FUNCTION public.update_scenarios_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '')
  );
  RETURN NEW;
END;
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record public.user_invitations%ROWTYPE;
BEGIN
  -- If auth.uid() is NULL, this is a service role action (admin dashboard)
  -- Allow it to proceed without invitation requirement
  IF auth.uid() IS NULL THEN
    -- Create profile for service-role invited user
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
  END IF;

  -- For regular signups, check if there's a valid invitation
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = '';

-- Fix get_invitation_url function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix promote_to_admin function
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
$$ LANGUAGE plpgsql SET search_path = '';

-- Fix is_admin function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all functions now have search_path set
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'delete_old_cron_logs',
    'increment_shared_link_view', 
    'create_user_invitation',
    'update_scenarios_search_vector',
    'handle_new_user',
    'update_updated_at_column',
    'get_invitation_url',
    'promote_to_admin',
    'is_admin'
  )
ORDER BY p.proname;

-- ============================================================================
-- NOTES
-- ============================================================================
-- SET search_path = '' means the function will only look in the current schema
-- This prevents search path attacks where malicious users could create objects
-- with the same names as system functions to hijack your functions.
--
-- All functions now have explicit search_path settings for security.
-- ============================================================================
