-- Replace remaining legacy auth.uid-to-internal-users policies.
DROP POLICY IF EXISTS "Users can insert individual analysis" ON public.tb_ai_individual_analysis;
DROP POLICY IF EXISTS "Users can update individual analysis" ON public.tb_ai_individual_analysis;
DROP POLICY IF EXISTS "Users can view their own individual analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Mapped users insert individual analysis" ON public.tb_ai_individual_analysis FOR INSERT WITH CHECK (user_id = app_security.current_internal_user_id() OR app_security.current_user_is_admin());
CREATE POLICY "Mapped users update individual analysis" ON public.tb_ai_individual_analysis FOR UPDATE USING (user_id = app_security.current_internal_user_id() OR app_security.current_user_is_admin()) WITH CHECK (user_id = app_security.current_internal_user_id() OR app_security.current_user_is_admin());
CREATE POLICY "Mapped users view individual analysis" ON public.tb_ai_individual_analysis FOR SELECT USING (user_id = app_security.current_internal_user_id() OR app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Super admins full access audit log" ON public.tb_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.tb_audit_log;
CREATE POLICY "Mapped super admins full access audit log" ON public.tb_audit_log FOR ALL USING (app_security.current_user_is_admin()) WITH CHECK (app_security.current_user_is_admin());
CREATE POLICY "Mapped actors insert audit log" ON public.tb_audit_log FOR INSERT WITH CHECK (actor_id = app_security.current_internal_user_id() OR app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Allow write rules for super admins" ON public.tb_hrms_mapping_rule;
CREATE POLICY "Mapped super admins write rules" ON public.tb_hrms_mapping_rule FOR ALL USING (app_security.current_user_is_admin()) WITH CHECK (app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Allow read templates in same workspace" ON public.tb_master_worklog_templates;
DROP POLICY IF EXISTS "Allow write templates in same workspace for admins" ON public.tb_master_worklog_templates;
CREATE POLICY "Mapped members read templates" ON public.tb_master_worklog_templates FOR SELECT USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Mapped admins write templates" ON public.tb_master_worklog_templates FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Allow read/write exceptions for super admins" ON public.tb_onboarding_exceptions;
CREATE POLICY "Mapped super admins manage exceptions" ON public.tb_onboarding_exceptions FOR ALL USING (app_security.current_user_is_admin()) WITH CHECK (app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Allow public read access to tb_ai_individual_analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Public read shared individual analysis" ON public.tb_ai_individual_analysis FOR SELECT USING (is_public = true AND expires_at > now());
