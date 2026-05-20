-- ========================================================
-- Worklog NewGen: AI-Driven Analytics & Key Management Schema
-- ========================================================

-- 1. System Config Table (สำหรับจัดเก็บ API Keys และ Model Configurations)
CREATE TABLE IF NOT EXISTS public.tb_system_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- แทรกข้อมูลเริ่มต้นสำหรับการกำหนดค่า AI Engine
INSERT INTO public.tb_system_config (config_key, config_value, description)
VALUES 
  ('ai_provider', 'openrouter', 'Active AI Provider (openai, gemini, openrouter)'),
  ('ai_model', 'google/gemini-2.0-flash-exp:free', 'Active LLM Model ID'),
  ('openai_api_key', '', 'OpenAI API Key (sk-...)'),
  ('gemini_api_key', '', 'Google Gemini API Key (AIzaSy...)'),
  ('openrouter_api_key', '', 'OpenRouter API Key (sk-or-...)'),
  ('ai_enhancement_prompt', '', 'Custom prompt guidelines for AI Worklog Description Enhancement')
ON CONFLICT (config_key) DO NOTHING;


-- 2. Team Strategic Allocation Budget (เป้าหมายสัดส่วนเวลาเชิงกลยุทธ์ของแต่ละทีม)
CREATE TABLE IF NOT EXISTS public.tb_team_allocation_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,                   -- ชื่อทีม (เช่น 'IMP', 'IT' อิงจาก department_operator ใน col_worklog)
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('bu', 'action')), -- แบ่งตาม BU หรือตามลักษณะงาน (Action)
  category_name TEXT NOT NULL,               -- ชื่อหมวดหมู่ (เช่น 'Double A', 'NPS', 'Meeting', 'Development')
  target_percentage DECIMAL(5,2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_name, allocation_type, category_name)
);

-- แทรกสัดส่วนเป้าหมายเริ่มต้นสำหรับทีม IMP เพื่อการทดสอบ
INSERT INTO public.tb_team_allocation_budget (team_name, allocation_type, category_name, target_percentage)
VALUES
  ('IMP', 'action', 'Meeting & Admin', 15.00),
  ('IMP', 'action', 'Core Building', 60.00),
  ('IMP', 'action', 'Ad-hoc Support', 15.00),
  ('IMP', 'action', 'Bug Fixing', 10.00),
  ('IMP', 'bu', 'Double A', 50.00),
  ('IMP', 'bu', 'NPS', 20.00),
  ('IMP', 'bu', 'Other BUs', 30.00)
ON CONFLICT DO NOTHING;


-- 3. AI Team Insights Table (ตารางเก็บประวัติคำแนะนำเชิงบริหารระดับทีม)
CREATE TABLE IF NOT EXISTS public.tb_ai_team_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,                   -- ชื่อทีม (เช่น 'IMP', 'IT')
  analysis_date DATE NOT NULL,               -- วันที่บันทึกบทวิเคราะห์
  start_date DATE NOT NULL,                  -- ขอบเขตวันเริ่มต้นของข้อมูลดิบ
  end_date DATE NOT NULL,                    -- ขอบเขตวันสิ้นสุดของข้อมูลดิบ
  
  -- ผลคะแนนเชิงสถิติจาก AI
  team_focus_score INT NOT NULL,             -- คะแนนความโฟกัสงานของทีม (0-100)
  team_friction_score INT NOT NULL,          -- คะแนนความเหนื่อยสลับงาน (0-100)
  
  -- ผลวิเคราะห์แบบเจาะจง
  warnings JSONB NOT NULL,                   -- การแจ้งเตือนปัญหาด่วน (Burnout, Bottleneck, Friction)
  bu_drift_analysis JSONB NOT NULL,          -- สถิติชั่วโมงเปรียบเทียบเป้าหมายและค่าเบี่ยงเบน
  bottlenecks JSONB NOT NULL,                -- คอขวดของทีมที่ตรวจเจอรายบุคคล
  actionable_plans JSONB NOT NULL,           -- แผนแนะนำแนวทางแก้ปัญหาและปรับปรุงการบริหารงาน
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ดัชนีสืบค้นรวดเร็วในการแสดงรายการย้อนหลัง
CREATE INDEX IF NOT EXISTS idx_ai_team_insights_lookup 
ON public.tb_ai_team_insights (team_name, analysis_date DESC);


-- ========================================================
-- Security Policies (RLS)
-- ========================================================
ALTER TABLE public.tb_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_team_allocation_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ai_team_insights ENABLE ROW LEVEL SECURITY;

-- 1. สำหรับตาราง System Config (คีย์ลับต้องห้ามพนักงานทั่วไปอ่านเด็ดขาด!)
-- ในระดับ Development: อนุญาตให้ดึงข้อมูลได้เพื่อความสะดวก แต่ใน Production ควรกรองสิทธิ์เข้มข้น
DROP POLICY IF EXISTS "Allow all access to system_config for dev" ON public.tb_system_config;
CREATE POLICY "Allow all access to system_config for dev" ON public.tb_system_config FOR ALL USING (true);

-- นโยบายแนะนำสำหรับ Production (เปิดใช้เมื่อต้องการปิดความปลอดภัยสูงสุด)
-- CREATE POLICY "Admins full control" ON public.tb_system_config 
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM public.users 
--       WHERE users.id = auth.uid() AND users.role = 'admin'
--     )
--   );

-- 2. สำหรับตารางงบเป้าหมายของทีม (Team Budget)
DROP POLICY IF EXISTS "Allow public read access to team_allocation_budget" ON public.tb_team_allocation_budget;
CREATE POLICY "Allow public read access to team_allocation_budget" ON public.tb_team_allocation_budget FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full control to team_allocation_budget for dev" ON public.tb_team_allocation_budget;
CREATE POLICY "Allow full control to team_allocation_budget for dev" ON public.tb_team_allocation_budget FOR ALL USING (true);

-- 3. สำหรับตารางแคชบทวิเคราะห์ทีม (Team Insights Cache)
DROP POLICY IF EXISTS "Allow public read access to ai_team_insights" ON public.tb_ai_team_insights;
CREATE POLICY "Allow public read access to ai_team_insights" ON public.tb_ai_team_insights FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full control to ai_team_insights for dev" ON public.tb_ai_team_insights;
CREATE POLICY "Allow full control to ai_team_insights for dev" ON public.tb_ai_team_insights FOR ALL USING (true);

-- ========================================================
-- 4. Job Description & Individual Analysis Schema
-- ========================================================
CREATE TABLE IF NOT EXISTS public.tb_user_jd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position_name TEXT,             -- ชื่อตำแหน่งงาน (สำหรับ Manual Override / Sync กับ JD)
  jd_source TEXT NOT NULL CHECK (jd_source IN ('uploaded', 'ai_recommended', 'manual_entry')),
  jd_text TEXT NOT NULL,          
  key_responsibilities JSONB,     
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.tb_ai_individual_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,              
  start_date DATE NOT NULL,                 
  end_date DATE NOT NULL,                   
  jd_alignment_score INT NOT NULL,          
  burnout_risk_score INT NOT NULL,          
  actual_vs_target JSONB NOT NULL,          
  strengths TEXT[] NOT NULL,                
  improvements TEXT[] NOT NULL,             
  development_plan JSONB NOT NULL,          
  raw_ai_report TEXT NOT NULL,              
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_user_date ON public.tb_ai_individual_analysis (user_id, analysis_date DESC);

ALTER TABLE public.tb_user_jd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ai_individual_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to tb_user_jd" ON public.tb_user_jd;
CREATE POLICY "Allow public read access to tb_user_jd" ON public.tb_user_jd FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full control to tb_user_jd for dev" ON public.tb_user_jd;
CREATE POLICY "Allow full control to tb_user_jd for dev" ON public.tb_user_jd FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to tb_ai_individual_analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Allow public read access to tb_ai_individual_analysis" ON public.tb_ai_individual_analysis FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full control to tb_ai_individual_analysis for dev" ON public.tb_ai_individual_analysis;
CREATE POLICY "Allow full control to tb_ai_individual_analysis for dev" ON public.tb_ai_individual_analysis FOR ALL USING (true);
