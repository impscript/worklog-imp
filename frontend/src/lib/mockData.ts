// Mock data based on db/seed_newgen.sql for local development

export const MASTER_ACTIONS = [
  { category: 'Project', name: 'User Requirement Gathering' },
  { category: 'Project', name: 'Planning' },
  { category: 'Project', name: 'System Setup / Configuration' },
  { category: 'Project', name: 'Testing / UAT Support' },
  { category: 'Project', name: 'Document work' },
  { category: 'Support', name: 'Issue Resolution / Troubleshooting' },
  { category: 'Support', name: 'CRUD Record' },
  { category: 'Support', name: 'System Setup / Configuration' },
  { category: 'Management', name: 'Receive Policy' },
  { category: 'Management', name: 'Plan/Strategy/Review/Delegate/Resolve/Coach' }
];

export const MAP_PROJECT_STRUCTURE = [
  { holding: 'Real Estate', department_operator: 'IT', project_type: 'Management', project_name: 'Policy', module: '-', bu: 'Corporate', department: 'IT' },
  { holding: 'Real Estate', department_operator: 'IMP', project_type: 'Management', project_name: 'Policy', module: '-', bu: 'Corporate', department: 'IMP' },
  { holding: 'Double A', department_operator: 'IT', project_type: 'Management', project_name: 'TeamOps', module: '-', bu: 'Corporate', department: 'IT' },
  { holding: 'Double A', department_operator: 'IT', project_type: 'Project', project_name: 'ERP - Netsuite', module: 'Function Readiness - MFG', bu: 'Production', department: 'Book Plant' },
  { holding: 'Double A', department_operator: 'IT', project_type: 'Project', project_name: 'ERP - Netsuite', module: 'Function Readiness - MRP', bu: 'Production', department: 'Winder' },
  { holding: 'Double A', department_operator: 'IT', project_type: 'Project', project_name: 'WMS', module: 'Warehouse Double A', bu: 'Double A', department: 'Warehouse' },
  { holding: 'Double A', department_operator: 'IMP', project_type: 'Support Go-Live', project_name: 'ERP - Netsuite', module: 'Item Master', bu: 'Master Data', department: 'IT' },
  { holding: 'All Holding', department_operator: 'IMP', project_type: 'Support MA', project_name: 'Application form - Website', module: 'Appscript', bu: 'Corporate', department: 'HR Recruit' },
  { holding: 'Real Estate', department_operator: 'IMP', project_type: 'Project', project_name: '304 CRM', module: '-', bu: 'IP', department: 'CRM' },
  { holding: 'Real Estate', department_operator: 'IMP', project_type: 'Support MA', project_name: 'Daily task project IP', module: 'บันทึกการทำงานรปภ', bu: 'Housing', department: 'Juristic' },
  { holding: 'Logistic', department_operator: 'IMP', project_type: 'Project', project_name: 'บันทึกมิเตอร์น้ำมัน', module: '-', bu: 'Logistic', department: 'CR' },
];

export const MAP_USER_ROLE = [
  { name: 'Chatchawan', holding: 'Real Estate', department_operator: 'IMP' },
  { name: 'Chatchawan', holding: 'Double A', department_operator: 'IMP' },
  { name: 'Chatchawan', holding: 'Power', department_operator: 'IMP' },
  { name: 'Chatchawan', holding: 'All Holding', department_operator: 'IMP' },
  { name: 'Sutti', holding: 'Real Estate', department_operator: 'IT' },
  { name: 'Sutti', holding: 'Double A', department_operator: 'IT' },
];
