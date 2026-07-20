import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WorkspaceGrant {
  workspace_id: string;
  grant_role: 'viewer' | 'analyst' | 'manager';
  expires_at: string | null;
  workspace_name?: string;
  invite_code?: string;
}

/**
 * Returns the list of workspaces the current user has been granted cross-workspace access to.
 * Does NOT include the user's own active workspace (use session.activeWorkspaceId for that).
 */
export function useWorkspaceGrants() {
  const [grants, setGrants] = useState<WorkspaceGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchGrants() {
      try {
        setIsLoading(true);
        // Call DB function (SECURITY DEFINER, returns only own active grants)
        const { data: grantRows, error } = await supabase.rpc('get_granted_workspace_ids');
        if (error || !grantRows || grantRows.length === 0) {
          if (!cancelled) setGrants([]);
          return;
        }

        // Fetch workspace names for display
        const wsIds = grantRows.map((g: any) => g.workspace_id);
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('id, workspace_name, invite_code')
          .in('id', wsIds);

        const enriched: WorkspaceGrant[] = grantRows.map((g: any) => {
          const ws = wsData?.find((w: any) => w.id === g.workspace_id);
          return {
            workspace_id: g.workspace_id,
            grant_role: g.grant_role,
            expires_at: g.expires_at,
            workspace_name: ws?.workspace_name,
            invite_code: ws?.invite_code,
          };
        });

        if (!cancelled) setGrants(enriched);
      } catch (err) {
        console.warn('[useWorkspaceGrants] Failed to fetch grants:', err);
        if (!cancelled) setGrants([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGrants();
    return () => { cancelled = true; };
  }, []);

  return { grants, isLoading };
}
