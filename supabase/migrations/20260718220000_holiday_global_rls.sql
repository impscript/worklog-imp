-- Company holidays are shared across all workspaces (workspace_id IS NULL).
-- Any authenticated user can read them; only global admins can manage them.
DROP POLICY IF EXISTS "Public read access for master holiday" ON public.tb_master_holiday;
DROP POLICY IF EXISTS "Allow full access to tb_master_holiday for dev" ON public.tb_master_holiday;
DROP POLICY IF EXISTS "Members read holidays" ON public.tb_master_holiday;
DROP POLICY IF EXISTS "Admins manage holidays" ON public.tb_master_holiday;

CREATE POLICY "Authenticated read shared holidays"
  ON public.tb_master_holiday FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Global admins manage shared holidays"
  ON public.tb_master_holiday FOR ALL
  TO authenticated
  USING (app_security.current_user_is_admin())
  WITH CHECK (app_security.current_user_is_admin());
