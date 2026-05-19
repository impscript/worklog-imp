-- ==========================================
-- Worklog NewGen: Seed Data from Blueprint
-- ==========================================

-- 1. Master Holding
INSERT INTO public.tb_master_holding (holding_name) VALUES 
('Double A'), ('Real Estate'), ('All Holding'), ('Logistic'), ('Power')
ON CONFLICT DO NOTHING;

-- 2. Master Role
INSERT INTO public.tb_master_role (role_name) VALUES 
('IT'), ('IMP'), ('IMP&IT')
ON CONFLICT DO NOTHING;

-- 3. Master Project Type
INSERT INTO public.tb_master_project_type (type_name) VALUES 
('Management'), ('Project'), ('Support MA'), ('Support Go-Live'), ('Upgrade')
ON CONFLICT DO NOTHING;

-- 4. Master Action
INSERT INTO public.tb_master_action (action_category, action_name) VALUES 
('Project', 'User Requirement Gathering'),
('Project', 'Planning'),
('Project', 'Report / Dashboard Design'),
('Project', 'Process Mapping / Optimization'),
('Project', 'Set template'),
('Project', 'Data Preparation / Cleansing'),
('Project', 'System Setup / Configuration'),
('Project', 'Research/Develop/Implement'),
('Project', 'Testing / UAT Support'),
('Project', 'Document work'),
('Project', 'CRUD Account'),
('Project', 'CRUD Authorization'),
('Project', 'Training / Knowledge Transfer / Consult'),
('Project', 'Issue Resolution / Troubleshooting'),
('Project', 'Check & Correction'),
('Project', 'Others'),
('Support', 'Report / Dashboard Design'),
('Support', 'Process Mapping / Optimization'),
('Support', 'Data Preparation / Cleansing'),
('Support', 'System Setup / Configuration'),
('Support', 'CRUD Form'),
('Support', 'CRUD Function'),
('Support', 'CRUD List'),
('Support', 'CRUD Master Data'),
('Support', 'CRUD Record'),
('Support', 'CRUD Report'),
('Support', 'CRUD System'),
('Support', 'Testing / UAT Support'),
('Support', 'Document work'),
('Support', 'CRUD Account'),
('Support', 'CRUD Authorization'),
('Support', 'Reset password'),
('Support', 'Training / Knowledge Transfer / Consult'),
('Support', 'Issue Resolution / Troubleshooting'),
('Support', 'Check & Correction'),
('Support', 'Others'),
('Management', 'Receive Policy'),
('Management', 'Plan/Strategy/Review/Delegate/Resolve/Coach')
ON CONFLICT DO NOTHING;

-- 5. Map User Role
INSERT INTO public.tb_map_user_role (name, holding, department_operator) VALUES 
('Jintana', 'Double A', 'IT'),
('Jintana', 'Real Estate', 'IMP'),
('Jintana', 'Real Estate', 'IMP&IT'),
('Jintana', 'Double A', 'IMP&IT'),
('Sutti', 'Real Estate', 'IT'),
('Sutti', 'Double A', 'IT'),
('Sutti', 'Logistic', 'IT'),
('Sutti', 'Power', 'IT'),
('Kanokaon', 'Real Estate', 'IT'),
('Kanokaon', 'Double A', 'IT'),
('Kanokaon', 'Logistic', 'IT'),
('Kanokaon', 'Power', 'IT'),
('Yawee', 'Real Estate', 'IT'),
('Yawee', 'Double A', 'IT'),
('Yawee', 'Logistic', 'IT'),
('Yawee', 'Power', 'IT'),
('Chatchawan', 'Real Estate', 'IMP'),
('Chatchawan', 'Double A', 'IMP'),
('Chatchawan', 'Power', 'IMP'),
('Chatchawan', 'All Holding', 'IMP'),
('Ronnachai', 'Real Estate', 'IMP'),
('Ronnachai', 'Double A', 'IMP'),
('Ronnachai', 'All Holding', 'IMP'),
('Weerasak', 'Double A', 'IT'),
('Weerasak', 'Real Estate', 'IMP'),
('Nakorn', 'Double A', 'IT'),
('Mungkung', 'Real Estate', 'IT'),
('Mungkung', 'Double A', 'IT'),
('Mungkung', 'Logistic', 'IT'),
('Mungkung', 'Power', 'IT'),
('CRMC', 'Real Estate', 'IMP');

-- 6. Map Project Structure
INSERT INTO public.tb_map_project_structure (holding, department_operator, project_type, project_name, module, bu, department) VALUES 
('Real Estate', 'IT', 'Management', 'Policy', '-', 'Corporate', 'IT'),
('Real Estate', 'IMP', 'Management', 'Policy', '-', 'Corporate', 'IMP'),
('Double A', 'IT', 'Management', 'TeamOps', '-', 'Corporate', 'IT'),
('Double A', 'IT', 'Project', 'ERP - Netsuite', 'Function Readiness - MFG', 'Production', 'Book Plant'),
('Double A', 'IT', 'Project', 'ERP - Netsuite', 'Function Readiness - MRP', 'Production', 'Winder'),
('Double A', 'IT', 'Project', 'ERP - Netsuite', 'Function Readiness - O2C', 'O2C - Export', 'Sale'),
('Double A', 'IT', 'Project', 'WMS', 'Warehouse Double A', 'Double A', 'Warehouse'),
('Double A', 'IMP', 'Support Go-Live', 'ERP - Netsuite', 'Item Master', 'Master Data', 'IT'),
('All Holding', 'IMP', 'Support MA', 'Application form - Website', 'Appscript', 'Corporate', 'HR Recruit'),
('Real Estate', 'IMP', 'Project', '304 CRM', '-', 'IP', 'CRM'),
('Real Estate', 'IMP', 'Project', 'Contractor Grading System (CGS)', '-', 'Housing', 'Construction'),
('Real Estate', 'IMP', 'Support MA', 'Daily task project IP', 'บันทึกการทำงานรปภ', 'Housing', 'Juristic'),
('Real Estate', 'IT', 'Project', 'Web Corporate', 'Audit Management System', 'Corporate', 'Internal Audit'),
('Real Estate', 'IT', 'Project', 'Web Operation', 'ตลาดถนนคนเดิน', 'Com&Res', 'Operation'),
('Real Estate', 'IT', 'Project', 'Website Official - Housing', 'Home Page', 'Housing', 'Sale&Marketing'),
('Logistic', 'IMP', 'Project', 'บันทึกมิเตอร์น้ำมัน', '-', 'Logistic', 'CR'),
('Power', 'IT', 'Project', 'Web Operation', 'แจ้งเตือนต่อใบอนุญาติ NPS', 'Permit', 'Legel'),
('Logistic', 'IT', 'Project', 'Web Corporate', 'Vender Payment', 'All BU', 'All Department');
