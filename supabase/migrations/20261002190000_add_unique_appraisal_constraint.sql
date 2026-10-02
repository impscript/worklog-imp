-- Migration: Add unique constraint on tb_ai_individual_analysis
-- Purpose: prevent duplicate appraisal records per user+template+period,
--          and enable upsert in OfficialAppraisalPage.tsx
--
-- RUN STEP 1 FIRST if duplicates already exist in the table:
--
-- DELETE FROM tb_ai_individual_analysis
-- WHERE id NOT IN (
--   SELECT DISTINCT ON (user_id, template_id, start_date, end_date) id
--   FROM tb_ai_individual_analysis
--   ORDER BY user_id, template_id, start_date, end_date, created_at DESC NULLS LAST
-- );
--
-- Then run Step 2:

ALTER TABLE tb_ai_individual_analysis
  ADD CONSTRAINT uq_ai_analysis_user_template_period
  UNIQUE (user_id, template_id, start_date, end_date);
