-- =============================================================================
-- Migration: Seed Workspaces & Mapping Rules
-- =============================================================================

-- Seed default workspaces
INSERT INTO public.workspaces (id, workspace_name, invite_code) VALUES
('a59b2075-8ce6-4b95-a4df-1e8ea36a0001', 'Improvement (IMP)', 'IMP-TEAM-99'),
('a59b2075-8ce6-4b95-a4df-1e8ea36a0002', 'Digital Innovation Technology (IT)', 'IT-TEAM-99')
ON CONFLICT DO NOTHING;

-- Seed hrms mapping rules
INSERT INTO public.tb_hrms_mapping_rule (hrms_bu_working, hrms_line_of_work, mapped_workspace_id) VALUES
('Others_President Office', 'Improvement', 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'),
('Corporate LO&RE', 'Digital Innovation Technology', 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002'),
('Corporate DA', 'Digital Innovation Technology', 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002')
ON CONFLICT (hrms_bu_working, hrms_line_of_work) DO UPDATE 
SET mapped_workspace_id = EXCLUDED.mapped_workspace_id;
