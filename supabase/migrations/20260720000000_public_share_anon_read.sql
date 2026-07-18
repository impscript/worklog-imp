-- Migration: Restore public (no-login) access to shared AI evaluation reports.
--
-- Root cause: the workspace-layering RLS rework revoked EXECUTE on the
-- app_security.* helper functions from the `anon` role
-- (see 20260718160000_remove_tokenless_user_writes.sql). When RLS evaluates
-- the SELECT policies with OR semantics, it must evaluate EVERY policy's
-- USING expression. The sibling "Mapped users view individual analysis" policy
-- references app_security.current_internal_user_id(); for an unauthenticated
-- viewer that function call is forbidden, so the whole expression errors and
-- the public row is denied -> the share link silently fails / redirects to login
-- even though we added a dedicated anon policy.
--
-- Fix (two parts):
--  1) A self-contained SELECT policy granted directly to `anon` that does NOT
--     reference any app_security function.
--  2) Re-grant EXECUTE on the read-side helper functions to `anon` so the other
--     policies can be evaluated without erroring. current_internal_user_id()
--     returns NULL for anon and current_user_is_admin() returns false, so this
--     does NOT leak owner/admin data — only the is_public policy admits the row.

BEGIN;

-- Part 1: dedicated anon policy (no app_security dependency)
DROP POLICY IF EXISTS "Anon read public shared individual analysis"
  ON public.tb_ai_individual_analysis;

CREATE POLICY "Anon read public shared individual analysis"
  ON public.tb_ai_individual_analysis FOR SELECT TO anon
  USING (is_public = true AND expires_at > now());

-- Part 2: re-grant read-side helpers to anon so sibling policies evaluate cleanly
GRANT EXECUTE ON FUNCTION app_security.current_internal_user_id() TO anon;
GRANT EXECUTE ON FUNCTION app_security.current_user_is_admin() TO anon;

COMMIT;
