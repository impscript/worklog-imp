-- ========================================================
-- Worklog NewGen: AI Individual Performance & JD Diagnostics
-- ========================================================

-- 1. Job Description Table (สำหรับเก็บรายละเอียดตำแหน่งงานพนักงาน)
CREATE TABLE IF NOT EXISTS public.tb_user_jd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jd_source TEXT NOT NULL CHECK (jd_source IN ('uploaded', 'ai_recommended', 'manual_entry')),
  jd_text TEXT NOT NULL,                          -- ข้อความ JD เต็มรูปแบบ
  key_responsibilities JSONB,                     -- โครงสร้างเป้าหมายสัดส่วนน้ำหนัก เช่น [{"category": "Coding", "weight": 60}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. AI Individual Performance Analysis Table (สำหรับเก็บประวัติและแคชการประเมินวิเคราะห์ผลงานพนักงาน)
CREATE TABLE IF NOT EXISTS public.tb_ai_individual_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,                    -- วันที่ทำรายการวิเคราะห์
  start_date DATE NOT NULL,                       -- เริ่มต้นขอบเขตวันที่วิเคราะห์
  end_date DATE NOT NULL,                         -- สิ้นสุดขอบเขตวันที่วิเคราะห์
  jd_alignment_score INT NOT NULL,                -- คะแนนความตรงตามบทบาทงาน (0-100)
  burnout_risk_score INT NOT NULL,                -- อัตราความเหนื่อยล้าเบิร์นเอาท์ (0-100)
  
  -- ผลลัพธ์ข้อมูลวิเคราะห์รูปแบบโครงสร้าง
  actual_vs_target JSONB NOT NULL,                -- สัดส่วนเนื้องานจริงเทียบเป้าหมายใน JD
  strengths TEXT[] NOT NULL,                      -- อาร์เรย์จุดเด่น / จุดแข็ง
  improvements TEXT[] NOT NULL,                   -- อาร์เรย์จุดปรับปรุง / ช่องว่างทักษะ
  development_plan JSONB NOT NULL,                -- แผนพัฒนางานระยะสั้น (90 วัน) และแผนระยะยาว
  raw_ai_report TEXT NOT NULL,                    -- เนื้อหารายงานเชิงลึก Markdown
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- เพิ่มดัชนี (Indices) เพื่อการค้นหารวดเร็ว
CREATE INDEX IF NOT EXISTS idx_ai_analysis_user_date 
ON public.tb_ai_individual_analysis (user_id, analysis_date DESC);

-- ========================================================
-- Security Policies (RLS)
-- ========================================================
ALTER TABLE public.tb_user_jd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ai_individual_analysis ENABLE ROW LEVEL SECURITY;

-- นโยบาย RLS สำหรับ Job Description (มีสิทธิ์เข้าถึงทั้งหมดสำหรับ Dev / Admin)
CREATE POLICY "Allow public read access to tb_user_jd" ON public.tb_user_jd FOR SELECT USING (true);
CREATE POLICY "Allow full control to tb_user_jd for dev" ON public.tb_user_jd FOR ALL USING (true);

-- นโยบาย RLS สำหรับ AI Analysis Cache (มีสิทธิ์เข้าถึงทั้งหมดสำหรับ Dev / Admin)
CREATE POLICY "Allow public read access to tb_ai_individual_analysis" ON public.tb_ai_individual_analysis FOR SELECT USING (true);
CREATE POLICY "Allow full control to tb_ai_individual_analysis for dev" ON public.tb_ai_individual_analysis FOR ALL USING (true);
