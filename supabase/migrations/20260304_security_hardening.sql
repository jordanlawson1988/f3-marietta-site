-- Security Hardening Migration
-- Resolves all Supabase Security Advisor errors and warnings
-- Run this in Supabase SQL Editor
--
-- Fixes:
--   10 ERRORS: RLS disabled on 9 tables + Security Definer View
--    3 WARNINGS: Mutable search path on 2 functions + pg_trgm in public schema
--
-- NOTE: The app uses SUPABASE_SERVICE_ROLE_KEY exclusively (server-side only),
-- which bypasses RLS. Enabling RLS with no anon/authenticated policies gives
-- default-deny security without breaking existing functionality.

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL PUBLIC TABLES (9 tables)
-- ============================================================================
-- With RLS enabled and no policies for anon/authenticated roles, these tables
-- are inaccessible via PostgREST anonymous access. The service_role key
-- bypasses RLS, so the application continues to work unchanged.

ALTER TABLE public.f3_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backblasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f3_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f3_event_qs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_message_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_block_elements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. FIX SECURITY DEFINER VIEW: backblasts_v2
-- ============================================================================
-- PostgreSQL views execute with the view owner's permissions by default
-- (effectively SECURITY DEFINER). Setting security_invoker = on makes the
-- view respect the calling user's permissions and RLS policies instead.

ALTER VIEW public.backblasts_v2 SET (security_invoker = on);

-- ============================================================================
-- 3. FIX MUTABLE SEARCH PATH ON TRIGGER FUNCTIONS
-- ============================================================================
-- Without an explicit search_path, these functions use the session's
-- search_path, which an attacker could manipulate to hijack function calls.
-- Setting search_path = '' forces fully-qualified references.

CREATE OR REPLACE FUNCTION public.update_f3_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 4. MOVE pg_trgm EXTENSION OUT OF PUBLIC SCHEMA
-- ============================================================================
-- Extensions in the public schema can shadow user-defined objects.
-- Supabase recommends installing extensions in the 'extensions' schema,
-- which is already in the default search_path.

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
