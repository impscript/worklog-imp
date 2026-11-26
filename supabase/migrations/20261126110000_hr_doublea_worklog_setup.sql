-- Migration: HR work-log entry structure for workspace HR-DoubleA.
-- Holding Double A / Role HR; Project Type (5) > Function = Project Name (16) > Action.
-- Idempotent: every insert skips rows that already exist.
-- Aborts if workspace HR-DoubleA is missing (matched by invite_code or workspace_name), or if a Function
-- name is already a project in another workspace (project_name is globally unique in tb_project_registry).
-- Type colours are left empty: workspace admins set them in Admin > Project Types.
-- Assigning employees to the workspace (workspace_users, tb_map_user_role, active workspace) is an
-- operational step and is intentionally not part of this file (it would publish employee IDs).
BEGIN;

DO $seed$
DECLARE
  v_ws UUID;
BEGIN
  SELECT id INTO v_ws
  FROM public.workspaces
  WHERE invite_code = 'HR-DoubleA' OR workspace_name = 'HR-DoubleA'
  LIMIT 1;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Workspace HR-DoubleA not found. Create it in Workspaces first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tb_project_registry r
    WHERE r.project_name IN ('AL - Attendance & Leave', 'BP - HR Business Partner', 'ER - Employee Relations', 'EXP - Expat Management', 'GA - General Administration', 'GOV - Government Relations', 'HA - HR Analytics', 'HRD - Learning & Development', 'OM - Organization Management', 'OTH - Others', 'PJ - HR Project', 'PMS - Performance Management System', 'PY - Payroll & Compensation', 'RC - Recruitment', 'TM - Talent Management', 'WE - Welfare & Engagement')
      AND r.workspace_id IS DISTINCT FROM v_ws
  ) THEN
    RAISE EXCEPTION 'A Function name already exists as a project in another workspace; aborting to avoid moving it.';
  END IF;

  -- 1. Holding and Role
  INSERT INTO public.tb_master_holding (holding_name, workspace_id)
  VALUES ('Double A', v_ws)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.tb_master_role (role_name, workspace_id)
  VALUES ('HR', v_ws)
  ON CONFLICT DO NOTHING;

  -- 2. Project Types (HR "Type")
  INSERT INTO public.tb_master_project_type (type_name, workspace_id)
  VALUES
    ('Operation', v_ws),
    ('Business Partnering / Analysis', v_ws),
    ('Meeting & Coordination', v_ws),
    ('Project & Improvement', v_ws),
    ('Issue & Urgent', v_ws)
  ON CONFLICT DO NOTHING;

  -- 3. Actions, filtered in the form by Project Type (action_category)
  INSERT INTO public.tb_master_action (action_category, action_name, workspace_id)
  SELECT v.cat, v.name, v_ws
  FROM (VALUES
    ('Operation', 'จัดทำโครงสร้างองค์กร / OC'),
    ('Operation', 'จัดทำ JD'),
    ('Operation', 'บริหารอัตรากำลัง / Manpower'),
    ('Operation', 'ปรับตำแหน่งและสายบังคับบัญชา'),
    ('Operation', 'เปิดรับสมัคร'),
    ('Operation', 'คัดเลือกผู้สมัคร'),
    ('Operation', 'นัดสัมภาษณ์'),
    ('Operation', 'ตรวจสอบเวลาทำงาน'),
    ('Operation', 'ดำเนินการเรื่องการลา'),
    ('Operation', 'ติดตามการมาสาย'),
    ('Operation', 'ติดตามการขาดงาน'),
    ('Operation', 'ประมวลผลเงินเดือน'),
    ('Operation', 'ดำเนินการสวัสดิการเชิงการเงิน'),
    ('Operation', 'ดำเนินการ PVD'),
    ('Operation', 'จัดทำเอกสารทำจ่าย'),
    ('Operation', 'ติดตาม KPI'),
    ('Operation', 'ดำเนินการประเมินผลงาน'),
    ('Operation', 'ดำเนินการ Promotion'),
    ('Operation', 'ดำเนินการ PIP'),
    ('Operation', 'ดำเนินการ 3P'),
    ('Operation', 'บริหารกลุ่ม Talent'),
    ('Operation', 'ดำเนินการ Leadership Assessment'),
    ('Operation', 'ดูแลโครงการ Mentor'),
    ('Operation', 'จัดทำแผนเติบโต'),
    ('Operation', 'จัดอบรม'),
    ('Operation', 'จัดปฐมนิเทศ'),
    ('Operation', 'ดำเนินการ Onboarding'),
    ('Operation', 'จัดการสอบ'),
    ('Operation', 'ดำเนินการพนักงานลาออก'),
    ('Operation', 'ดำเนินการทางวินัย'),
    ('Operation', 'รับเรื่องข้อร้องเรียน'),
    ('Operation', 'ดำเนินการสวัสดิการ'),
    ('Operation', 'จัดกิจกรรม Wellness'),
    ('Operation', 'จัดกิจกรรม Engagement'),
    ('Operation', 'จัดกิจกรรม Birthday'),
    ('Operation', 'จัดการฐานข้อมูล HR'),
    ('Operation', 'จัดทำ HR Report'),
    ('Operation', 'ดำเนินการ Visa'),
    ('Operation', 'ดำเนินการ Work Permit'),
    ('Operation', 'ประสานหน่วยงานราชการ'),
    ('Operation', 'ยื่นเอกสารราชการ'),
    ('Operation', 'ดำเนินการงานธุรการ'),
    ('Operation', 'จัดการทรัพยากรสำนักงาน'),
    ('Operation', 'จัดการอุปกรณ์'),
    ('Operation', 'ดำเนินการงานอื่น ๆ'),
    ('Business Partnering / Analysis', 'ให้คำปรึกษาหน่วยงาน'),
    ('Business Partnering / Analysis', 'วิเคราะห์ปัญหาด้านคน'),
    ('Business Partnering / Analysis', 'เสนอแนวทางเชิงธุรกิจ'),
    ('Business Partnering / Analysis', 'วิเคราะห์ข้อมูล HR'),
    ('Business Partnering / Analysis', 'วิเคราะห์อัตรากำลัง'),
    ('Business Partnering / Analysis', 'วิเคราะห์โครงสร้างองค์กร'),
    ('Business Partnering / Analysis', 'วิเคราะห์ผลประเมิน KPI'),
    ('Business Partnering / Analysis', 'วิเคราะห์หลักเกณฑ์ผลตอบแทนตามผลงาน'),
    ('Business Partnering / Analysis', 'วิเคราะห์กลุ่ม Talent'),
    ('Business Partnering / Analysis', 'วางแผนการเติบโต'),
    ('Business Partnering / Analysis', 'วิเคราะห์ค่าตอบแทน'),
    ('Business Partnering / Analysis', 'วิเคราะห์ประเด็นพนักงาน'),
    ('Meeting & Coordination', 'ประสาน Hiring Manager'),
    ('Meeting & Coordination', 'ประชุมกับหน่วยงาน'),
    ('Meeting & Coordination', 'ประสานงานเชิง HRBP'),
    ('Meeting & Coordination', 'ติดต่อหน่วยงานราชการ'),
    ('Meeting & Coordination', 'ประสานเรื่องพนักงานต่างชาติ'),
    ('Meeting & Coordination', 'ประสานการอบรม'),
    ('Meeting & Coordination', 'ประสานกิจกรรมพนักงาน'),
    ('Meeting & Coordination', 'ประชุมโครงการ HR'),
    ('Meeting & Coordination', 'ประสานประเด็นพนักงาน'),
    ('Meeting & Coordination', 'ประชุม / ประสานงานอื่น ๆ'),
    ('Project & Improvement', 'ดำเนินโครงการ HR'),
    ('Project & Improvement', 'พัฒนาระบบงาน HR'),
    ('Project & Improvement', 'ปรับปรุงโครงสร้าง / JD'),
    ('Project & Improvement', 'พัฒนาระบบฐานข้อมูล / รายงาน'),
    ('Project & Improvement', 'ออกแบบหลักสูตร / Onboarding'),
    ('Project & Improvement', 'ออกแบบหลักเกณฑ์ KPI / 3P'),
    ('Project & Improvement', 'ออกแบบกิจกรรม / สวัสดิการ'),
    ('Project & Improvement', 'ออกแบบแผน Talent / Mentor'),
    ('Issue & Urgent', 'จัดการข้อร้องเรียนเร่งด่วน'),
    ('Issue & Urgent', 'จัดการเรื่องวินัยเร่งด่วน'),
    ('Issue & Urgent', 'จัดการเรื่องลาออกเร่งด่วน'),
    ('Issue & Urgent', 'แก้ปัญหาลงเวลา / การลาเร่งด่วน'),
    ('Issue & Urgent', 'แก้ปัญหาเงินเดือน / เอกสารทำจ่ายเร่งด่วน'),
    ('Issue & Urgent', 'แก้ปัญหา Visa / Work Permit เร่งด่วน'),
    ('Issue & Urgent', 'จัดการประเด็นหน่วยงานราชการเร่งด่วน'),
    ('Issue & Urgent', 'เร่งสรรหาตำแหน่งด่วน'),
    ('Issue & Urgent', 'จัดการประเด็นเร่งด่วนอื่น ๆ')
  ) AS v(cat, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tb_master_action a
    WHERE a.workspace_id = v_ws AND a.action_category = v.cat AND a.action_name = v.name
  )
  ON CONFLICT DO NOTHING;

  -- 4. Project structure: Type x Function (Function = project_name, scope = project_description)
  INSERT INTO public.tb_map_project_structure
    (holding, department_operator, project_type, project_name, module, bu, department, project_description, workspace_id)
  SELECT 'Double A', 'HR', v.ptype, v.pname, NULL, 'HR', 'HR', v.descr, v_ws
  FROM (VALUES
    ('Operation', 'OM - Organization Management', 'โครงสร้างองค์กร, OC, JD, Manpower'),
    ('Operation', 'RC - Recruitment', 'สรรหาและคัดเลือกพนักงาน'),
    ('Operation', 'AL - Attendance & Leave', 'เวลาทำงาน, การลา, การขาดงาน'),
    ('Operation', 'PY - Payroll & Compensation', 'เงินเดือน, ค่าตอบแทน, PVD, การจ่ายเงิน'),
    ('Operation', 'PMS - Performance Management System', 'KPI, Performance, Promotion, PIP, 3P'),
    ('Operation', 'TM - Talent Management', 'Talent, Leadership, Mentor, Growing'),
    ('Operation', 'HRD - Learning & Development', 'Training, Orientation, Onboarding, การสอบ'),
    ('Operation', 'ER - Employee Relations', 'พนักงานลาออก, วินัย, ข้อร้องเรียน, Employee Relations'),
    ('Operation', 'WE - Welfare & Engagement', 'สวัสดิการ, Wellness, Engagement, Birthday'),
    ('Operation', 'HA - HR Analytics', 'ฐานข้อมูล, HR Report, วิเคราะห์ข้อมูล HR'),
    ('Operation', 'EXP - Expat Management', 'พนักงานต่างชาติ, Visa, Work Permit'),
    ('Operation', 'GOV - Government Relations', 'หน่วยงานราชการและการดำเนินการด้านภาครัฐ'),
    ('Operation', 'GA - General Administration', 'งานธุรการและงานสนับสนุนทั่วไป'),
    ('Operation', 'OTH - Others', 'งานอื่น ๆ ที่ไม่เข้ากับ Function ข้างต้น'),
    ('Business Partnering / Analysis', 'BP - HR Business Partner', 'ให้คำปรึกษา วิเคราะห์ และประสานงานเชิง HRBP'),
    ('Business Partnering / Analysis', 'HA - HR Analytics', 'ฐานข้อมูล, HR Report, วิเคราะห์ข้อมูล HR'),
    ('Business Partnering / Analysis', 'OM - Organization Management', 'โครงสร้างองค์กร, OC, JD, Manpower'),
    ('Business Partnering / Analysis', 'PMS - Performance Management System', 'KPI, Performance, Promotion, PIP, 3P'),
    ('Business Partnering / Analysis', 'TM - Talent Management', 'Talent, Leadership, Mentor, Growing'),
    ('Business Partnering / Analysis', 'PY - Payroll & Compensation', 'เงินเดือน, ค่าตอบแทน, PVD, การจ่ายเงิน'),
    ('Business Partnering / Analysis', 'ER - Employee Relations', 'พนักงานลาออก, วินัย, ข้อร้องเรียน, Employee Relations'),
    ('Meeting & Coordination', 'RC - Recruitment', 'สรรหาและคัดเลือกพนักงาน'),
    ('Meeting & Coordination', 'BP - HR Business Partner', 'ให้คำปรึกษา วิเคราะห์ และประสานงานเชิง HRBP'),
    ('Meeting & Coordination', 'GOV - Government Relations', 'หน่วยงานราชการและการดำเนินการด้านภาครัฐ'),
    ('Meeting & Coordination', 'EXP - Expat Management', 'พนักงานต่างชาติ, Visa, Work Permit'),
    ('Meeting & Coordination', 'HRD - Learning & Development', 'Training, Orientation, Onboarding, การสอบ'),
    ('Meeting & Coordination', 'WE - Welfare & Engagement', 'สวัสดิการ, Wellness, Engagement, Birthday'),
    ('Meeting & Coordination', 'PJ - HR Project', 'โครงการและการพัฒนาระบบงาน HR'),
    ('Meeting & Coordination', 'ER - Employee Relations', 'พนักงานลาออก, วินัย, ข้อร้องเรียน, Employee Relations'),
    ('Meeting & Coordination', 'OTH - Others', 'งานอื่น ๆ ที่ไม่เข้ากับ Function ข้างต้น'),
    ('Project & Improvement', 'PJ - HR Project', 'โครงการและการพัฒนาระบบงาน HR'),
    ('Project & Improvement', 'OM - Organization Management', 'โครงสร้างองค์กร, OC, JD, Manpower'),
    ('Project & Improvement', 'HA - HR Analytics', 'ฐานข้อมูล, HR Report, วิเคราะห์ข้อมูล HR'),
    ('Project & Improvement', 'HRD - Learning & Development', 'Training, Orientation, Onboarding, การสอบ'),
    ('Project & Improvement', 'PMS - Performance Management System', 'KPI, Performance, Promotion, PIP, 3P'),
    ('Project & Improvement', 'WE - Welfare & Engagement', 'สวัสดิการ, Wellness, Engagement, Birthday'),
    ('Project & Improvement', 'TM - Talent Management', 'Talent, Leadership, Mentor, Growing'),
    ('Issue & Urgent', 'ER - Employee Relations', 'พนักงานลาออก, วินัย, ข้อร้องเรียน, Employee Relations'),
    ('Issue & Urgent', 'AL - Attendance & Leave', 'เวลาทำงาน, การลา, การขาดงาน'),
    ('Issue & Urgent', 'PY - Payroll & Compensation', 'เงินเดือน, ค่าตอบแทน, PVD, การจ่ายเงิน'),
    ('Issue & Urgent', 'EXP - Expat Management', 'พนักงานต่างชาติ, Visa, Work Permit'),
    ('Issue & Urgent', 'GOV - Government Relations', 'หน่วยงานราชการและการดำเนินการด้านภาครัฐ'),
    ('Issue & Urgent', 'RC - Recruitment', 'สรรหาและคัดเลือกพนักงาน'),
    ('Issue & Urgent', 'OTH - Others', 'งานอื่น ๆ ที่ไม่เข้ากับ Function ข้างต้น')
  ) AS v(ptype, pname, descr)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tb_map_project_structure s
    WHERE s.workspace_id = v_ws AND s.holding = 'Double A' AND s.department_operator = 'HR'
      AND s.project_type = v.ptype AND s.project_name = v.pname
      AND s.bu = 'HR' AND s.department = 'HR'
  );

  -- 5. Function names are work categories, not delivery projects: keep them off the Gantt roadmap.
  UPDATE public.tb_project_registry
  SET is_hidden_from_gantt = TRUE
  WHERE workspace_id = v_ws
    AND parent_project_id IS NULL
    AND project_name IN ('AL - Attendance & Leave', 'BP - HR Business Partner', 'ER - Employee Relations', 'EXP - Expat Management', 'GA - General Administration', 'GOV - Government Relations', 'HA - HR Analytics', 'HRD - Learning & Development', 'OM - Organization Management', 'OTH - Others', 'PJ - HR Project', 'PMS - Performance Management System', 'PY - Payroll & Compensation', 'RC - Recruitment', 'TM - Talent Management', 'WE - Welfare & Engagement');
END
$seed$;

COMMIT;

-- Rollback (removes only what this file adds, for this workspace):
--   DELETE FROM public.tb_map_project_structure WHERE workspace_id = (SELECT id FROM public.workspaces WHERE invite_code = 'HR-DoubleA') AND holding = 'Double A' AND department_operator = 'HR';
--   DELETE FROM public.tb_master_action WHERE workspace_id = (SELECT id FROM public.workspaces WHERE invite_code = 'HR-DoubleA') AND action_category IN ('Operation', 'Business Partnering / Analysis', 'Meeting & Coordination', 'Project & Improvement', 'Issue & Urgent');
--   DELETE FROM public.tb_project_registry WHERE workspace_id = (SELECT id FROM public.workspaces WHERE invite_code = 'HR-DoubleA') AND project_name IN ('AL - Attendance & Leave', 'BP - HR Business Partner', 'ER - Employee Relations', 'EXP - Expat Management', 'GA - General Administration', 'GOV - Government Relations', 'HA - HR Analytics', 'HRD - Learning & Development', 'OM - Organization Management', 'OTH - Others', 'PJ - HR Project', 'PMS - Performance Management System', 'PY - Payroll & Compensation', 'RC - Recruitment', 'TM - Talent Management', 'WE - Welfare & Engagement');
--   DELETE FROM public.tb_master_project_type WHERE workspace_id = (SELECT id FROM public.workspaces WHERE invite_code = 'HR-DoubleA') AND type_name IN ('Operation', 'Business Partnering / Analysis', 'Meeting & Coordination', 'Project & Improvement', 'Issue & Urgent');
--   (tb_master_holding 'Double A' and tb_master_role 'HR' can be removed the same way if nothing else uses them.)
