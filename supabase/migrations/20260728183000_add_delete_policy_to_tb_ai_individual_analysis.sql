-- Migration: Add missing DELETE policy to tb_ai_individual_analysis for mapped users & admins

DROP POLICY IF EXISTS "Mapped users delete individual analysis" ON public.tb_ai_individual_analysis;

CREATE POLICY "Mapped users delete individual analysis"
  ON public.tb_ai_individual_analysis
  FOR DELETE
  USING (
    user_id = app_security.current_internal_user_id() 
    OR app_security.current_user_is_admin()
  );
