import { supabase } from '../../lib/supabase';
import type { AiTeamMember } from './AiTeamMemberPicker';

/**
 * Look an employee up by employee ID or name: first the workspace `users` table, then the HRMS search API.
 * Shared by the team-member picker and the supervisor picker so both behave identically.
 */
export async function searchEmployees(rawQuery: string): Promise<AiTeamMember[]> {
  // Characters with a meaning in PostgREST filters would break the .or() expression below.
  const query = rawQuery.replace(/[,()*%]/g, ' ').trim();
  if (!query) return [];

  const candidates: AiTeamMember[] = [];

  // 1. Local `users` table first
  try {
    const { data: localUsers, error: localErr } = await supabase
      .from('users')
      .select('emp_id, full_name, nickname, department, position, email')
      .or(`full_name.ilike.%${query}%,emp_id.ilike.%${query}%,nickname.ilike.%${query}%`)
      .limit(6);

    if (!localErr && localUsers) {
      localUsers.forEach((u) => {
        candidates.push({
          emp_id: u.emp_id || '',
          name: u.full_name || u.nickname || 'ไม่ระบุชื่อ',
          department: u.department || 'ไม่ระบุแผนก',
          position: u.position || '',
          email: u.email || '',
          is_lead: false,
        });
      });
    }
  } catch {
    // Continue to HRMS
  }

  // 2. HRMS search API
  try {
    const res = await fetch(`/api/hrms/employee/search/${encodeURIComponent(query)}/?index=0&row=6`);
    if (res.ok) {
      const json = await res.json();
      const hrmsList = (json?.data?.search || json?.search || []) as Array<Record<string, string | undefined>>;
      hrmsList.forEach((h) => {
        const hEmpId = h.empId || h.EmpID || '';
        const hName = h.name || `${h.FNameT || ''} ${h.LNameT || ''}`.trim() || 'พนักงาน';
        if (hEmpId && !candidates.some((c) => c.emp_id === hEmpId)) {
          candidates.push({
            emp_id: hEmpId,
            name: hName,
            department: h.department || h.Department || 'ไม่ระบุแผนก',
            position: h.position || h.Position || '',
            email: h.email || h.EMail || '',
            is_lead: false,
          });
        }
      });
    }
  } catch {
    // HRMS search fallback failover
  }

  return candidates;
}
