-- =============================================================================
-- Migration: Create tb_project_notes Table for Mini CRUD Project Logs/Notes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tb_project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Note type classification
  note_type TEXT NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('usage', 'wi', 'incident', 'maintenance', 'general')),
    
  title TEXT,
  content TEXT NOT NULL,
  author_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_notes_project 
  ON public.tb_project_notes(project_id);

CREATE INDEX IF NOT EXISTS idx_project_notes_workspace 
  ON public.tb_project_notes(workspace_id);

-- Enable RLS
ALTER TABLE public.tb_project_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies matching tb_project_registry access
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tb_project_notes' 
    AND policyname = 'Members read project notes'
  ) THEN
    CREATE POLICY "Members read project notes" 
      ON public.tb_project_notes 
      FOR SELECT 
      USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tb_project_notes' 
    AND policyname = 'Members write project notes'
  ) THEN
    CREATE POLICY "Members write project notes" 
      ON public.tb_project_notes 
      FOR ALL 
      USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin())
      WITH CHECK (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;
END $$;

-- Migrate existing last_usage_note data into tb_project_notes if available
INSERT INTO public.tb_project_notes (project_id, workspace_id, note_type, title, content, author_name)
SELECT 
  id AS project_id,
  workspace_id,
  'usage' AS note_type,
  'บันทึกการใช้งาน (Migrated)' AS title,
  last_usage_note AS content,
  'System Migration' AS author_name
FROM public.tb_project_registry
WHERE last_usage_note IS NOT NULL AND TRIM(last_usage_note) <> ''
ON CONFLICT DO NOTHING;
