-- =============================================================================
-- Migration: Database Trigger to Auto-Sync Workspace and Role to Users Table
-- =============================================================================

-- 1. Create function to sync workspace changes to users profile
CREATE OR REPLACE FUNCTION public.sync_user_workspace_role()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.users
    SET active_workspace_id = NEW.workspace_id,
        workspace_role = NEW.role
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
    SET active_workspace_id = NULL,
        workspace_role = NULL
    WHERE id = OLD.user_id AND active_workspace_id = OLD.workspace_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop trigger if exists and create it
DROP TRIGGER IF EXISTS tr_sync_user_workspace_role ON public.workspace_users;

CREATE TRIGGER tr_sync_user_workspace_role
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_workspace_role();
