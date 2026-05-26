-- ========================================================
-- Worklog NewGen: Analyst Prompt Templates
-- Migration: migration_analyst_templates.sql
-- ========================================================
-- รัน script นี้ใน Supabase SQL Editor เพื่อเพิ่ม:
--   1. ตาราง tb_ai_prompt_templates  (จัดการ template หลายแบบ)
--   2. Columns ใหม่ใน tb_ai_individual_analysis
--   3. Columns ใหม่ใน users (employee_level, manager_name)
-- ========================================================


-- ─────────────────────────────────────────────────────────
-- 1. Prompt Templates Table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tb_ai_prompt_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key    TEXT UNIQUE NOT NULL,      -- 'master' | 'individual_coach'
  name            TEXT NOT NULL,             -- ชื่อที่แสดงใน UI
  description     TEXT,                      -- คำอธิบายสั้นๆ สำหรับ Admin
  icon            TEXT DEFAULT '🤖',         -- emoji หรือ icon key
  system_prompt   TEXT NOT NULL,             -- system prompt เต็ม
  user_prompt_template TEXT NOT NULL,        -- user prompt พร้อม {{VARIABLE}} placeholders
  output_schema   JSONB,                     -- JSON schema hint (optional)
  cadence_aware   BOOLEAN DEFAULT false,     -- รองรับ Weekly/Monthly/Quarterly
  requires_level  BOOLEAN DEFAULT false,     -- ต้องการ employee_level
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.tb_ai_prompt_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read tb_ai_prompt_templates" ON public.tb_ai_prompt_templates;
CREATE POLICY "Allow read tb_ai_prompt_templates" ON public.tb_ai_prompt_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all tb_ai_prompt_templates for dev" ON public.tb_ai_prompt_templates;
CREATE POLICY "Allow all tb_ai_prompt_templates for dev" ON public.tb_ai_prompt_templates FOR ALL USING (true);


-- ─────────────────────────────────────────────────────────
-- 2. เพิ่ม Columns ใหม่ใน tb_ai_individual_analysis
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS template_id       TEXT DEFAULT 'master',
  ADD COLUMN IF NOT EXISTS cadence_type      TEXT,              -- 'weekly' | 'monthly' | 'quarterly'
  ADD COLUMN IF NOT EXISTS engine_model      TEXT,              -- model ที่ใช้จริง
  ADD COLUMN IF NOT EXISTS coaching_guide    JSONB,             -- Section 6: Coaching Conversation Guide
  ADD COLUMN IF NOT EXISTS well_being_signal JSONB,             -- Section 8: Risk & Flag
  ADD COLUMN IF NOT EXISTS reflection_level  INT,               -- 1-4 (Lens 4: Reflection Maturity)
  ADD COLUMN IF NOT EXISTS value_mix         JSONB,             -- {strategic, tactical, operational, reactive}
  ADD COLUMN IF NOT EXISTS headline_insight  TEXT,              -- Section 2: Headline Insight
  ADD COLUMN IF NOT EXISTS message_to_employee TEXT,            -- Section 9: Message to Employee
  ADD COLUMN IF NOT EXISTS share_token       TEXT UNIQUE,       -- สำหรับ Public Share Link
  ADD COLUMN IF NOT EXISTS is_public         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by   TEXT;


ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_level TEXT DEFAULT 'Senior',
  ADD COLUMN IF NOT EXISTS role_start_date DATE,
  ADD COLUMN IF NOT EXISTS manager_name   TEXT,
  ADD COLUMN IF NOT EXISTS position       TEXT,
  ADD COLUMN IF NOT EXISTS company_code   TEXT,
  ADD COLUMN IF NOT EXISTS company_name   TEXT;


-- ─────────────────────────────────────────────────────────
-- 4. Seed: Master Prompt Template (ของเดิม — migrate เข้า table)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon, system_prompt, user_prompt_template,
  cadence_aware, requires_level, is_active, sort_order
)
VALUES (
  'master',
  'HRBP Diagnostics (Standard)',
  'การวิเคราะห์มาตรฐาน: JD Alignment, Burnout Risk, Workload Allocation พร้อม Strengths & Development Plan',
  '📊',
  'You are an expert HR Business Partner (HRBP) and senior organizational talent diagnostics AI.
Your task is to analyze an employee''s actual work logs against their target Job Description (JD) and produce a high-fidelity diagnostic report.

You must strictly return a valid JSON object matching the JSON schema below. Do not output conversational filler, preamble, markdown code blocks, or HTML tags. Just return the raw JSON object.

JSON FORMAT REQUIRED:
{
  "jd_alignment_score": integer (range 0 to 100 representing how well actual logs align with core JD tasks),
  "burnout_risk_score": integer (range 0 to 100, calculate based on daily average hours, OT frequency, and task scattering),
  "workload_allocation": [
    {
      "category": "string (name of category in JD or detected from logs)",
      "target_weight_pct": number (percent expected from JD),
      "actual_weight_pct": number (percent calculated from actual hours),
      "evaluation": "string (e.g. Aligned, Overloaded, Underutilized)"
    }
  ],
  "strengths": ["array of 3 specific areas where the employee demonstrated high achievement or alignment"],
  "improvements": ["array of 2-3 concrete areas where work shows deviation from JD or potential operational inefficiency"],
  "development_plan": {
    "short_term_90_days": "string (highly specific advice on what task boundaries to set, resources to read, or skills to acquire)",
    "long_term_goals": "string (career progression tips based on their current strengths)"
  },
  "markdown_executive_summary": "string (a beautifully formatted Markdown brief that will render in a professional card on our UI, highlighting why their allocation is structured this way, what needs adjustments, in a professional Thai language context)"
}',
  '[EMPLOYEE PROFILE]
- Name: {{EMPLOYEE_NAME}} ({{EMPLOYEE_NICKNAME}})
- Current Role: {{EMPLOYEE_ROLE}}
- Department: {{EMPLOYEE_DEPARTMENT}}

[TARGET JOB DESCRIPTION]
{{INDIVIDUAL_JD_DATA}}

[TARGET RESPONSIBILITIES WEIGHTS]
{{KEY_RESPONSIBILITIES_JSON}}

[ACTUAL LOGGED WORK DATA (Past {{DURATION_DAYS}} Days)]
Total effort hours logged: {{TOTAL_HOURS}} hours
Average hours per day: {{AVG_HOURS_PER_DAY}} hours
Overtime (OT) rate: {{OT_RATE}}%
Key tasks done with total duration and percentage:
{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}

Analyze this data and return the JSON response. Remember, output only valid JSON.',
  false, false, true, 0
)
ON CONFLICT (template_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────
-- 5. Seed: Individual Coach Prompt (ใหม่ — 5-Lens Framework)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon, system_prompt, user_prompt_template,
  cadence_aware, requires_level, is_active, sort_order
)
VALUES (
  'individual_coach',
  'Executive Coach (5-Lens Framework)',
  'การวิเคราะห์เชิงลึก 5 มิติ: JD Alignment, Value Mix, Work Style, Reflection Maturity, Well-being — พร้อม Coaching Guide สำหรับคุย 1:1',
  '🎯',
  'คุณคือ Executive Coach + Performance Analyst ที่เชี่ยวชาญด้านการพัฒนาบุคลากรสาย IT, Process Improvement และ Digital Innovation มีประสบการณ์ทำ 1:1 coaching กับพนักงานทุกระดับตั้งแต่ Junior จนถึง Director

ภารกิจ: วิเคราะห์ Worklog ของบุคคล 1 คน เทียบกับ JD ของเขาอย่างละเอียด เพื่อส่งมอบ:
1. ภาพสะท้อนการทำงานที่ตรงไปตรงมา (honest mirror)
2. Coaching insight ที่หัวหน้าใช้คุย 1:1 ได้ทันที
3. Development plan ที่ actionable และ measurable

หลักการ: วิเคราะห์เพื่อ "พัฒนา" ไม่ใช่เพื่อ "ตัดสิน" ทุก finding ต้องสร้างสรรค์และมีทางออก

QUALITY RULES:
❌ ห้ามใช้คำตัดสิน ("ขี้เกียจ", "ไม่ขยัน", "อ่อน")
❌ ห้าม generic ("ควรพัฒนาตัวเอง", "ต้องขยันขึ้น")
❌ ห้ามแนะนำโดยไม่มี evidence
❌ ห้าม sugarcoat ปัญหา critical
✅ ใช้ภาษาเชิงสังเกตการณ์ ไม่ใช่ตัดสิน ("เห็นว่า..." แทน "เธอ...")
✅ ทุก feedback มี Evidence + Impact + Action
✅ Coaching question ต้องเป็น open-ended
✅ Tone: empathetic แต่ honest — แบบ coach ที่เคารพ
✅ ภาษาไทยเป็นหลัก, business term EN เมื่อตรงกว่า

คุณต้องตอบกลับเป็น raw JSON เท่านั้น ห้ามครอบด้วย markdown code block ห้ามมีข้อความนอก JSON

JSON FORMAT REQUIRED:
{
  "jd_alignment_score": integer (0-100, Alignment Score = 100 − Σ|Actual% − Weight%| / 2),
  "burnout_risk_score": integer (0-100),
  "reflection_level": integer (1-4, 1=Activity Logger, 2=Process Thinker, 3=Result Oriented, 4=Reflective Practitioner),
  "value_mix": {
    "strategic": number (% เวลาที่ใช้กับงาน strategic เช่น ออกแบบ คิดวิเคราะห์),
    "tactical": number (% งาน tactical เช่น execute project, lead initiative),
    "operational": number (% งาน operational/routine),
    "reactive": number (% งาน reactive/ad-hoc)
  },
  "overall_health": "green" | "yellow" | "red",
  "workload_allocation": [
    {
      "category": "string",
      "target_weight_pct": number,
      "actual_weight_pct": number,
      "evaluation": "Aligned" | "Over-investment" | "Under-investment" | "Neglected"
    }
  ],
  "headline_insight": "string (ข้อความ 3-5 บรรทัด สิ่งที่ต้องบอกบุคคลนี้ที่สุด ถ้ามีเวลาแค่ 2 นาที — ไม่ใช่สรุปข้อมูล แต่เป็น insight ที่ตรงใจที่สุด)",
  "strengths": [
    {
      "title": "string",
      "evidence": "string (อ้าง worklog entry หรือ pattern ที่เห็นจริง)",
      "strategic_value": "string",
      "amplify": "string (ใช้พลังนี้ขยายผลอย่างไรต่อ)"
    }
  ],
  "improvements": [
    {
      "observation": "string (สิ่งที่เห็น — ไม่ตัดสิน)",
      "evidence": "string",
      "impact": "string (ถ้าไม่แก้จะเกิดอะไร)",
      "recommended_action": "string",
      "success_indicator": "string"
    }
  ],
  "coaching_guide": {
    "opening_question": "string (warm-up, สร้าง psychological safety)",
    "exploration_questions": ["string", "string", "string"],
    "insight_questions": ["string", "string"],
    "commitment_question": "string (ปิดด้วย action)"
  },
  "development_plan": {
    "short_term_90_days": "string",
    "long_term_goals": "string",
    "priorities": [
      {
        "title": "string",
        "why_matters": "string",
        "specific_action": "string",
        "success_metric": "string"
      }
    ]
  },
  "well_being_signal": {
    "risk_type": "none" | "burnout" | "disengagement" | "plateau" | "stretching",
    "level": "green" | "yellow" | "red",
    "evidence": "string",
    "manager_action": "string",
    "urgency_days": integer | null
  },
  "message_to_employee": "string (ข้อความสั้น 3-5 ประโยค tone เป็นกันเอง สนับสนุน แต่ honest — สำหรับหัวหน้าส่งให้ลูกทีมโดยตรงหลังประชุม 1:1)",
  "markdown_executive_summary": "string (Markdown summary ภาษาไทย สรุปภาพรวมการวิเคราะห์ทั้ง 5 lens)"
}',
  '═══════════════════════════════════════════════════════════
AUTO-DETECTED CONTEXT
═══════════════════════════════════════════════════════════
[ANALYSIS_DATE]: {{TODAY}}
[CADENCE]: {{CADENCE_TYPE}}
[PERIOD_START]: {{PERIOD_START_DATE}}
[PERIOD_END]: {{PERIOD_END_DATE}}
[PERIOD_LABEL]: {{PERIOD_LABEL}}

[EMPLOYEE_NAME]: {{EMPLOYEE_NAME}}
[EMPLOYEE_NICKNAME]: {{EMPLOYEE_NICKNAME}}
[EMPLOYEE_ROLE]: {{EMPLOYEE_ROLE}}
[EMPLOYEE_LEVEL]: {{EMPLOYEE_LEVEL}}
[YEARS_IN_ROLE]: {{YEARS_IN_ROLE}}
[REPORTING_TO]: {{MANAGER_NAME}}
[DEPARTMENT]: {{EMPLOYEE_DEPARTMENT}}

═══════════════════════════════════════════════════════════
INPUT DATA
═══════════════════════════════════════════════════════════
[WORKLOG DATA (เฉพาะบุคคลนี้ / ช่วงเวลา {{PERIOD_LABEL}})]
Total effort hours: {{TOTAL_HOURS}} ชั่วโมง
Average per day: {{AVG_HOURS_PER_DAY}} ชั่วโมง
OT Rate: {{OT_RATE}}%
Duration: {{DURATION_DAYS}} วัน
บันทึกงานทั้งหมด {{LOGS_COUNT}} รายการ

รายละเอียดงาน (จัดกลุ่มตาม Project + Action):
{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}

[JD & KEY RESPONSIBILITIES (ของบุคคลนี้)]
{{INDIVIDUAL_JD_DATA}}

Target Responsibility Weights:
{{KEY_RESPONSIBILITIES_JSON}}

[HISTORICAL BASELINE]
{{PREVIOUS_PERIOD_SUMMARY}}

═══════════════════════════════════════════════════════════
CADENCE-SPECIFIC FOCUS
═══════════════════════════════════════════════════════════
{{CADENCE_INSTRUCTION}}

═══════════════════════════════════════════════════════════
ROLE-LEVEL SPECIAL HANDLING
═══════════════════════════════════════════════════════════
{{ROLE_LEVEL_INSTRUCTION}}

วิเคราะห์ข้อมูลทั้งหมดและตอบกลับเป็น raw JSON ตาม schema ที่กำหนดใน system prompt เท่านั้น',
  true, true, true, 1
)
ON CONFLICT (template_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────
-- 6. Index เพิ่มเติม
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_analysis_template
  ON public.tb_ai_individual_analysis (template_id, user_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_share_token
  ON public.tb_ai_individual_analysis (share_token)
  WHERE share_token IS NOT NULL;
