-- Move the IT salary rate reference (used by the Direct Savings "new
-- capability" market-rate calculator) out of a hardcoded frontend file and
-- into an admin-editable master data table, so rates can be updated from the
-- Master Data Manager UI whenever a newer salary report is published.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_master_it_salary_rate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  role TEXT NOT NULL,
  experience_bracket TEXT NOT NULL,
  salary_min NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_max NUMERIC(12,2) NOT NULL DEFAULT 0,
  source_label TEXT,
  source_url TEXT,
  source_year INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_it_salary_rate_workspace
ON public.tb_master_it_salary_rate (workspace_id);

ALTER TABLE public.tb_master_it_salary_rate
ADD CONSTRAINT tb_master_it_salary_rate_nonnegative_check
CHECK (salary_min >= 0 AND salary_max >= salary_min) NOT VALID;

ALTER TABLE public.tb_master_it_salary_rate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth members read salary rates" ON public.tb_master_it_salary_rate;
DROP POLICY IF EXISTS "Auth admins write salary rates" ON public.tb_master_it_salary_rate;

CREATE POLICY "Auth members read salary rates"
ON public.tb_master_it_salary_rate FOR SELECT TO authenticated
USING (
  workspace_id IS NULL
  OR app_security.is_workspace_member(workspace_id)
  OR app_security.current_user_is_admin()
);
CREATE POLICY "Auth admins write salary rates"
ON public.tb_master_it_salary_rate FOR ALL TO authenticated
USING (
  app_security.is_workspace_admin(workspace_id)
  OR app_security.current_user_is_admin()
)
WITH CHECK (
  app_security.is_workspace_admin(workspace_id)
  OR app_security.current_user_is_admin()
);

-- Seed reference data: ISM Technology 2024 Thailand IT Salary Report
-- (https://www.ismtech.net/it-salary-report), global (workspace_id = NULL).
INSERT INTO public.tb_master_it_salary_rate
  (category, role, experience_bracket, salary_min, salary_max, source_label, source_url, source_year)
VALUES
  ('Application Development', 'Software Developer / Engineer (Java)', '1 - 3', 30000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Developer / Engineer (Java)', '3 - 5', 60000, 75000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Developer / Engineer (Java)', '5 - 8+', 75000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Developer / Engineer (.NET)', '1 - 3', 30000, 55000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Developer / Engineer (.NET)', '3 - 5', 55000, 70000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Developer / Engineer (.NET)', '5 - 8+', 70000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Front-End Developer', '1 - 3', 30000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Front-End Developer', '3 - 5', 60000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Front-End Developer', '5 - 8+', 80000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Full Stack Developer', '3 - 5', 60000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Full Stack Developer', '5 - 8+', 80000, 120000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Mobile Developer', '1 - 3', 30000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Mobile Developer', '3 - 5', 60000, 75000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Mobile Developer', '5 - 8+', 75000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'System Analyst', '3 - 5', 65000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'System Analyst', '5 - 8+', 80000, 95000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Tester / QA Engineer / UAT Specialist', '1 - 3', 25000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Tester / QA Engineer / UAT Specialist', '3 - 5', 60000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Tester / QA Engineer / UAT Specialist', '5 - 8+', 80000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'DevOps Engineer', '3 - 5+', 60000, 120000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Cloud Technology Engineer', '5 - 10+', 80000, 150000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Application Development', 'Software Development Manager', '10 - 15+', 120000, 200000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Business Analysis', 'Business Analyst', '3 - 5', 60000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Business Analysis', 'Business Analyst', '5 - 8+', 80000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Digital Marketing', 'Web Designer / Graphic Designer (UI/UX)', '3 - 5', 40000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Digital Marketing', 'Web Designer / Graphic Designer (UI/UX)', '5 - 8+', 60000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'BI Developer / Data Modeler', '1 - 3', 30000, 50000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'BI Developer / Data Modeler', '3 - 5', 50000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'BI Developer / Data Modeler', '5 - 8+', 80000, 150000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'Data Engineer / Data Analyst', '1 - 3', 30000, 60000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'Data Engineer / Data Analyst', '3 - 5+', 60000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'Data Scientist', '8 - 12+', 120000, 200000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'Software Solution Architect / System Architect', '5 - 10', 80000, 150000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Data Science', 'Software Solution Architect / System Architect', '10 - 15+', 150000, 200000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'System Engineer / System Administrator', '1 - 3', 30000, 55000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'System Engineer / System Administrator', '3 - 5', 55000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'System Engineer / System Administrator', '5 - 8+', 80000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'Database Administrator (DBA)', '3 - 5', 50000, 80000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'Database Administrator (DBA)', '5 - 8+', 80000, 120000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'Cybersecurity Specialist', '3 - 5', 60000, 100000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('Infrastructure & System Administration', 'Cybersecurity Specialist', '5 - 12+', 100000, 150000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('IT Management', 'Project Manager / Service Delivery Manager', '10 - 12+', 150000, 200000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024),
  ('IT Management', 'IT Manager', '8 - 12+', 80000, 150000, 'ISM Technology Thailand IT Salary Report', 'https://www.ismtech.net/it-salary-report', 2024);

NOTIFY pgrst, 'reload schema';

COMMIT;
