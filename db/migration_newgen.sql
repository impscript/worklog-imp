-- ==========================================
-- Worklog NewGen: Schema Migration
-- ==========================================

-- 1. Master Tables (กลุ่มพจนานุกรม)
CREATE TABLE IF NOT EXISTS public.tb_master_holding (
  holding_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.tb_master_role (
  role_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.tb_master_project_type (
  type_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.tb_master_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_category TEXT NOT NULL,
  action_name TEXT NOT NULL,
  UNIQUE(action_category, action_name)
);

-- 2. Mapping Tables (กลุ่มความสัมพันธ์ - Cascading)
CREATE TABLE IF NOT EXISTS public.tb_map_user_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  holding TEXT REFERENCES public.tb_master_holding(holding_name),
  department_operator TEXT REFERENCES public.tb_master_role(role_name),
  UNIQUE(name, holding, department_operator)
);

CREATE TABLE IF NOT EXISTS public.tb_map_project_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding TEXT REFERENCES public.tb_master_holding(holding_name),
  department_operator TEXT REFERENCES public.tb_master_role(role_name),
  project_type TEXT REFERENCES public.tb_master_project_type(type_name),
  project_name TEXT NOT NULL,
  module TEXT,
  bu TEXT NOT NULL,
  department TEXT NOT NULL
);

-- 3. Users Table (อิงจาก IDMS Employee Profile)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  position TEXT,
  department TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transaction Table (col_worklog)
CREATE TABLE IF NOT EXISTS public.col_worklog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_time BOOLEAN DEFAULT false,
  total_hours DECIMAL(4,2) NOT NULL CHECK (total_hours > 0),
  
  -- Cascading Fields
  holding TEXT REFERENCES public.tb_master_holding(holding_name),
  department_operator TEXT REFERENCES public.tb_master_role(role_name),
  project_type TEXT REFERENCES public.tb_master_project_type(type_name),
  project_name TEXT NOT NULL,
  module TEXT,
  bu TEXT NOT NULL,
  department TEXT NOT NULL,
  action_name TEXT NOT NULL,
  action_channel TEXT,
  
  description TEXT,
  channel TEXT DEFAULT 'Web App',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Security & RLS Policies
-- ==========================================
ALTER TABLE public.tb_master_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_master_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_master_project_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_master_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_map_user_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_map_project_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.col_worklog ENABLE ROW LEVEL SECURITY;

-- Allow public read access to master and mapping tables (for cascading dropdowns)
CREATE POLICY "Public read access for master holding" ON public.tb_master_holding FOR SELECT USING (true);
CREATE POLICY "Public read access for master role" ON public.tb_master_role FOR SELECT USING (true);
CREATE POLICY "Public read access for master project type" ON public.tb_master_project_type FOR SELECT USING (true);
CREATE POLICY "Public read access for master action" ON public.tb_master_action FOR SELECT USING (true);
CREATE POLICY "Public read access for map user role" ON public.tb_map_user_role FOR SELECT USING (true);
CREATE POLICY "Public read access for map project structure" ON public.tb_map_project_structure FOR SELECT USING (true);
CREATE POLICY "Public read access for users" ON public.users FOR SELECT USING (true);

-- API (Proxy) level will handle inserts/updates securely, but let's allow all for dev
CREATE POLICY "Allow full access to col_worklog for dev" ON public.col_worklog FOR ALL USING (true);
CREATE POLICY "Allow full access to users for dev" ON public.users FOR ALL USING (true);
