-- =============================================================================
-- tb_project_registry — Project Portfolio Master Table
-- =============================================================================
-- Purpose: 1 record = 1 unique project (deduplicated from tb_map_project_structure)
--          Admin manages status, hierarchy, deploy info
--          Self-referencing for parent-child (Program → Module/Sub-project)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tb_project_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identity
  project_name TEXT UNIQUE NOT NULL,
  project_slug TEXT GENERATED ALWAYS AS (
    LOWER(REGEXP_REPLACE(project_name, '[^a-zA-Z0-9\\s-]', '', 'g'))
  ) STORED,
  description TEXT,
  
  -- 🔑 Hierarchical
  parent_project_id UUID 
    REFERENCES public.tb_project_registry(id) 
    ON DELETE SET NULL,
  
  -- Module (optional — for sub-projects under a parent)
  module TEXT,
  
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN (
      'planning',      -- 🔵 วางแผน
      'development',   -- 🟡 กำลังพัฒนา
      'active',        -- 🟢 ใช้งานจริง (production)
      'inactive',      -- ⚪ ไม่มีคนใช้แต่ระบบยังอยู่
      'sunset',        -- 🟠 กำลังปลดระวาง
      'retired'        -- 🔴 ปิดระบบแล้ว
    )),
  
  -- Project type classification
  project_type TEXT DEFAULT 'web_app' 
    CHECK (project_type IN (
      'web_app', 'api', 'mobile', 'desktop', 'integration', 
      'extension', 'module', 'internal_tool', 'infra', 'other'
    )),
  
  -- Ownership
  owner_holding TEXT,
  owner_team TEXT,
  
  -- Deployment / Access
  deploy_url TEXT,
  health_check_url TEXT,
  health_check_type TEXT DEFAULT 'http_200'
    CHECK (health_check_type IN ('http_200', 'http_302', 'custom')),
  
  -- Key dates
  go_live_date DATE,
  last_verified_date DATE,
  sunset_date DATE,
  
  -- Admin notes
  last_usage_note TEXT,
  
  -- Metadata
  is_auto_check_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_project_registry_parent 
  ON public.tb_project_registry(parent_project_id);

CREATE INDEX IF NOT EXISTS idx_project_registry_status 
  ON public.tb_project_registry(status);

CREATE INDEX IF NOT EXISTS idx_project_registry_holding 
  ON public.tb_project_registry(owner_holding);

-- Enable RLS (same as other tables)
ALTER TABLE public.tb_project_registry ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tb_project_registry' 
    AND policyname = 'Allow authenticated read'
  ) THEN
    CREATE POLICY "Allow authenticated read" 
      ON public.tb_project_registry 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;
END $$;

-- Allow all authenticated users to insert/update/delete (RBAC enforced via app)
-- The existing session already validates user role at login
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tb_project_registry' 
    AND policyname = 'Allow authenticated write'
  ) THEN
    CREATE POLICY "Allow authenticated write" 
      ON public.tb_project_registry 
      FOR ALL 
      TO authenticated 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- Helper: Get root parent (top-level project)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_project_root(p_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  WITH RECURSIVE project_ancestors AS (
    -- Anchor: the project itself
    SELECT id, parent_project_id
    FROM public.tb_project_registry
    WHERE id = p_id
    
    UNION ALL
    
    -- Recursive: walk up to parent
    SELECT p.id, p.parent_project_id
    FROM public.tb_project_registry p
    JOIN project_ancestors a ON p.id = a.parent_project_id
  )
  SELECT id FROM project_ancestors WHERE parent_project_id IS NULL
  LIMIT 1;
$$;

-- =============================================================================
-- Helper: Get full project tree (recursive CTE for convenience)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_project_tree()
RETURNS TABLE (
  id UUID,
  project_name TEXT,
  parent_project_id UUID,
  level INT,
  path TEXT[],
  status TEXT,
  deploy_url TEXT,
  owner_holding TEXT
)
LANGUAGE SQL STABLE
AS $$
  WITH RECURSIVE project_tree AS (
    -- Anchor: top-level projects
    SELECT 
      id, project_name, parent_project_id, 
      1 AS level,
      ARRAY[project_name] AS path,
      status, deploy_url, owner_holding
    FROM public.tb_project_registry
    WHERE parent_project_id IS NULL
    
    UNION ALL
    
    -- Recursive: children
    SELECT 
      c.id, c.project_name, c.parent_project_id,
      p.level + 1,
      p.path || c.project_name,
      c.status, c.deploy_url, c.owner_holding
    FROM public.tb_project_registry c
    JOIN project_tree p ON c.parent_project_id = p.id
  )
  SELECT * FROM project_tree
  ORDER BY path;
$$;
