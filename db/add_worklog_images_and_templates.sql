-- 1. Add image support to col_worklog
ALTER TABLE public.col_worklog 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 2. Create Master Worklog Templates table
CREATE TABLE IF NOT EXISTS public.tb_master_worklog_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_content TEXT NOT NULL,
  icon TEXT DEFAULT '📝',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tb_master_worklog_templates ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow public read tb_master_worklog_templates" ON public.tb_master_worklog_templates;
CREATE POLICY "Allow public read tb_master_worklog_templates" 
  ON public.tb_master_worklog_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all tb_master_worklog_templates for dev/admin" ON public.tb_master_worklog_templates;
CREATE POLICY "Allow all tb_master_worklog_templates for dev/admin" 
  ON public.tb_master_worklog_templates FOR ALL USING (true);

-- 3. Seed initial templates
INSERT INTO public.tb_master_worklog_templates (template_name, template_content, icon) VALUES
('เทมเพลตประชุม', '[วัตถุประสงค์]: \n[บทบาทของคุณ]: \n[ข้อสรุป]: \n[Next Steps]: ', '📝'),
('เทมเพลตงานทั่วไป', '[งานที่ทำ]: \n[ผลลัพธ์ที่ได้]: \n[KPI/เป้าหมาย]: \n[Next Steps]: ', '⚙️'),
('เทมเพลต PARIL (ทดลอง)', '[Plan]: \n[Action]: \n[Result]: \n[Impact]: \n[Lesson Learned]: ', '🎯')
ON CONFLICT (template_name) DO NOTHING;
