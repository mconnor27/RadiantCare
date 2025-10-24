-- Fix security_definer_view linter warnings
-- Changes views from SECURITY DEFINER to SECURITY INVOKER

-- Fix admin_user_overview
CREATE OR REPLACE VIEW public.admin_user_overview
WITH (security_invoker = true)
AS
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

-- Fix pending_invitations
CREATE OR REPLACE VIEW public.pending_invitations
WITH (security_invoker = true)
AS
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

-- Fix cron_logs_recent
CREATE OR REPLACE VIEW public.cron_logs_recent
WITH (security_invoker = true)
AS
SELECT
  id,
  status,
  details,
  created_at,
  created_at AT TIME ZONE 'America/Los_Angeles' as created_at_pacific,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM public.cron_logs
ORDER BY created_at DESC
LIMIT 100;

-- Re-grant permissions
GRANT SELECT ON public.cron_logs_recent TO authenticated;
