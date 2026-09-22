-- Persistent "hide from Gantt & Kanban report" flag, shared across everyone who
-- views the workspace's Gantt/Kanban executive report (survives refresh, does not
-- touch any project data). Access to that page — and therefore who can toggle
-- this flag — is already gated by the existing "Admins or managers manage own
-- projects" UPDATE policy on this table.
alter table public.tb_project_registry
  add column if not exists is_hidden_from_gantt boolean not null default false;
