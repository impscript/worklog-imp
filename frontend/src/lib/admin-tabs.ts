import {
  Database,
  Shield,
  Cpu,
  Activity,
  DollarSign,
  UserCheck,
  GitMerge,
  Users,
  Calendar,
  Plus,
  Sliders,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export type AdminTab =
  | 'holding'
  | 'role'
  | 'project_type'
  | 'action'
  | 'map_user'
  | 'map_project'
  | 'users'
  | 'ai_settings'
  | 'ai_prompt'
  | 'holiday'
  | 'templates'
  | 'salary_rate';

// The IT salary rate reference is IMP's own tool (used to cost in-house builds),
// so only the Process Improvement workspace manages it in the Admin UI.
export const PROCESS_IMPROVEMENT_WORKSPACE_ID = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

export const ADMIN_TABS: { key: AdminTab; label: string; icon: LucideIcon }[] = [
  { key: 'holding', label: 'Holdings', icon: Database },
  { key: 'role', label: 'Roles', icon: Shield },
  { key: 'project_type', label: 'Project Types', icon: Cpu },
  { key: 'action', label: 'Actions', icon: Activity },
  { key: 'salary_rate', label: 'IT Salary Rates', icon: DollarSign },
  { key: 'map_user', label: 'User Mappings', icon: UserCheck },
  { key: 'map_project', label: 'Project Structures', icon: GitMerge },
  { key: 'users', label: 'System Users', icon: Users },
  { key: 'holiday', label: 'Holidays', icon: Calendar },
  { key: 'templates', label: 'Worklog Templates', icon: Plus },
  { key: 'ai_settings', label: 'AI Settings', icon: Sliders },
  { key: 'ai_prompt', label: 'AI Prompts', icon: MessageSquare },
];

interface AdminTabSession {
  role?: string;
  workspaceRole?: string;
  activeWorkspaceId?: string;
}

// System-level accounts have no workspace assignment; workspace admins
// (role=admin WITH a workspace) are scoped to their workspace like managers.
function isSuperAdminSession(session: AdminTabSession | null | undefined) {
  return session?.role === 'admin' && (!session?.activeWorkspaceId || session.activeWorkspaceId === 'N/A');
}

export function getAllowedAdminTabs(session: AdminTabSession | null | undefined) {
  if (isSuperAdminSession(session)) return ADMIN_TABS;
  const isProcessImprovementWorkspace = session?.activeWorkspaceId === PROCESS_IMPROVEMENT_WORKSPACE_ID;
  // Hide global system administration tabs from workspace level admins/managers,
  // and hide the IT Salary Rate reference tab outside the Process Improvement workspace.
  return ADMIN_TABS.filter(
    (t) => t.key !== 'users' && t.key !== 'holiday' && (t.key !== 'salary_rate' || isProcessImprovementWorkspace)
  );
}

export function getDefaultAdminTab(session: AdminTabSession | null | undefined): AdminTab {
  const isWorkspaceStaff = session?.workspaceRole === 'admin' || session?.workspaceRole === 'manager';
  return session && session.role !== 'admin' && isWorkspaceStaff ? 'templates' : 'holding';
}
