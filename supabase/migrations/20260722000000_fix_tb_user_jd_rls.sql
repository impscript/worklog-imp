-- Migration: Fix RLS on tb_user_jd so owners and admins can save JD rows.
--
-- Root cause: the workspace-layering RLS rework (20260718140000 /
-- 20260718150000) dropped the legacy "FOR ALL USING (true)" dev policy on
-- tb_user_jd but never re-created a replacement. With RLS enabled and no
-- permissive policy, every INSERT/UPDATE is denied -> "new row violates
-- row-level security policy for table tb_user_jd" when saving a JD.
--
-- Fix: allow the row OWNER (the user whose user_id matches their profile) and
-- global admins to manage their JD, and keep public read. This is stricter
-- than the old dev policy but actually lets real users save their JD.

BEGIN;

DROP POLICY IF EXISTS "Allow public read access to tb_user_jd" ON public.tb_user_jd;
DROP POLICY IF EXISTS "Allow full control to tb_user_jd for dev" ON public.tb_user_jd;
DROP POLICY IF EXISTS "Owners and admins manage tb_user_jd" ON public.tb_user_jd;

-- Read: anyone authenticated may read JD (same visibility as before).
CREATE POLICY "Read tb_user_jd" ON public.tb_user_jd FOR SELECT
  TO authenticated
  USING (true);

-- Write: the owner (matching users row) or a global admin.
CREATE POLICY "Owners and admins manage tb_user_jd" ON public.tb_user_jd
  FOR ALL
  TO authenticated
  USING (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
  )
  WITH CHECK (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
  );

COMMIT;
