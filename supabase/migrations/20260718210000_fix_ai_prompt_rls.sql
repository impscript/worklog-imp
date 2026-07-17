-- AI prompt templates are tenant-scoped. They must be readable by mapped
-- workspace members and manageable by workspace admins/global admins.
DROP POLICY IF EXISTS "Allow all access to tb_ai_prompt_templates for dev" ON public.tb_ai_prompt_templates;
DROP POLICY IF EXISTS "Read prompt templates for workspace members" ON public.tb_ai_prompt_templates;
DROP POLICY IF EXISTS "Write prompt templates for workspace admins" ON public.tb_ai_prompt_templates;

CREATE POLICY "Read prompt templates for workspace members"
  ON public.tb_ai_prompt_templates FOR SELECT
  USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());

CREATE POLICY "Write prompt templates for workspace admins"
  ON public.tb_ai_prompt_templates FOR ALL
  USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin())
  WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
