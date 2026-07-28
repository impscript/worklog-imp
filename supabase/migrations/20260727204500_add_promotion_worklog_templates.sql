-- Migration: Add PM Promotion Master Worklog Templates
BEGIN;

INSERT INTO public.tb_master_worklog_templates (template_name, template_content, icon, is_active, workspace_id) VALUES
(
  'PM-Daily',
  '[PLAN] แผนงานล่วงหน้า:
- 

[DONE] งานที่ทำสำเร็จ & ผลลัพธ์:
- 

[GAIN] ความรู้/บทเรียนที่ได้ (เขียนด้วยตัวเอง):
- 

[DIM] มิติ PM:
- 1. งานในตำแหน่ง (ปิด GAP งาน): 
- 2. การกำกับลูกน้อง (Coaching / Follow-up): 
- 3. การทำงานกับหัวหน้า (Proactive Report / Alignment): ',
  '🎯',
  TRUE,
  NULL
),
(
  'PM-Case',
  '[PROB] ปัญหาที่พบ & ผลกระทบ:
- 

[ROOT] สาเหตุแท้จริง (วิเคราะห์กระบวนการ/Flow):
- 

[SOL] การแก้ไขเฉพาะหน้า:
- 

[PREV] แนวทางป้องกันเกิดซ้ำ (Process / WI / Checklist):
- ',
  '🛡️',
  TRUE,
  NULL
),
(
  'PM-WI',
  '[DOC] รหัส/ชื่อ WI & วันที่ Review:
- 

[AI] AI แนะนำให้ปรับ/เพิ่มอะไร:
- 

[DEC] การตัดสินใจของเรา:
- ปรับตาม AI เพราะ: 
- ไม่ปรับตาม AI เพราะ: ',
  '📄',
  TRUE,
  NULL
)
ON CONFLICT DO NOTHING;

COMMIT;
