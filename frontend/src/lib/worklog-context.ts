/**
 * Worklog & Project Context Helper for AI Chat
 * Retrieves user's recent worklogs, active projects, and work patterns from Supabase
 * to provide grounded context for AI reasoning, daily summaries, and PM planning.
 */

import { supabase, ensureValidSupabaseSession } from './supabase';

export interface WorklogSummaryContext {
  userName: string;
  empId?: string;
  totalEntries: number;
  totalHours: number;
  dateRange: string;
  entries: {
    work_date: string;
    project_name: string;
    project_type?: string;
    action?: string;
    task_description?: string;
    total_hours: number;
    holding?: string;
    bu?: string;
    department?: string;
  }[];
  markdownSummary: string;
}

export type WorklogFetchRange = 'today' | 'this_week' | 'last_7_days' | 'this_month' | 'recent_30';

export async function fetchUserWorklogContext(range: WorklogFetchRange = 'this_week'): Promise<WorklogSummaryContext | null> {
  try {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);

    const userId = session.id;
    const userName = session.fullName || session.name || session.nickname || 'ผู้ใช้งาน';
    const workspaceId = session.activeWorkspaceId;

    await ensureValidSupabaseSession();

    const now = new Date();
    let startDateStr = '';
    const endDateStr = now.toISOString().split('T')[0];

    if (range === 'today') {
      startDateStr = endDateStr;
    } else if (range === 'this_week' || range === 'last_7_days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDateStr = d.toISOString().split('T')[0];
    } else if (range === 'this_month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateStr = d.toISOString().split('T')[0];
    } else {
      // recent 30 days
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDateStr = d.toISOString().split('T')[0];
    }

    let query = supabase
      .from('col_worklog')
      .select('work_date, start_time, end_time, total_hours, project_name, project_type, holding, bu, department, module, action, task_description, remark')
      .eq('user_id', userId)
      .order('work_date', { ascending: false });

    if (startDateStr) {
      query = query.gte('work_date', startDateStr);
    }
    if (workspaceId && workspaceId !== 'N/A') {
      query = query.eq('workspace_id', workspaceId);
    }

    query = query.limit(60);

    const { data, error } = await query;
    if (error) {
      console.warn('[Worklog Context] Error querying col_worklog:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        userName,
        empId: session.empId,
        totalEntries: 0,
        totalHours: 0,
        dateRange: `${startDateStr} ถึง ${endDateStr}`,
        entries: [],
        markdownSummary: `### ข้อมูล Worklog (${userName}):\nไม่พบรายการบันทึกงานในช่วงวันที่ ${startDateStr} ถึง ${endDateStr}`,
      };
    }

    interface WorklogDbRow {
      work_date: string;
      project_name?: string;
      project_type?: string;
      action?: string;
      task_description?: string;
      remark?: string;
      total_hours: number | string;
      holding?: string;
      bu?: string;
      department?: string;
    }

    const mappedEntries = (data as unknown as WorklogDbRow[]).map((d) => ({
      work_date: d.work_date,
      project_name: d.project_name || 'ทั่วไป',
      project_type: d.project_type || '',
      action: d.action || '',
      task_description: d.task_description || d.remark || '',
      total_hours: typeof d.total_hours === 'number' ? d.total_hours : parseFloat(d.total_hours) || 0,
      holding: d.holding,
      bu: d.bu,
      department: d.department,
    }));

    const totalHours = mappedEntries.reduce((acc, curr) => acc + curr.total_hours, 0);

    // Group by project for quick aggregate
    const projectHoursMap = new Map<string, number>();
    mappedEntries.forEach((e) => {
      const p = e.project_name || 'ทั่วไป';
      projectHoursMap.set(p, (projectHoursMap.get(p) || 0) + e.total_hours);
    });

    const projectSummaryList = Array.from(projectHoursMap.entries())
      .map(([p, h]) => `- **${p}**: ${h.toFixed(1)} ชม.`)
      .join('\n');

    const detailRows = mappedEntries
      .slice(0, 25)
      .map(
        (e) =>
          `| ${e.work_date} | ${e.project_name} | ${e.action || '-'} | ${e.total_hours} ชม. | ${(e.task_description || '-').replace(/[\r\n]+/g, ' ')} |`
      )
      .join('\n');

    const markdownSummary = `
### 📊 สรุปประวัติการลงเวลา Worklog ของ ${userName}
- **ช่วงวันที่**: ${startDateStr} ถึง ${endDateStr}
- **จำนวนรายการ**: ${mappedEntries.length} รายการ | **ชั่วโมงรวม**: ${totalHours.toFixed(1)} ชั่วโมง
- **สัดส่วนโครงการ**:
${projectSummaryList}

#### 📋 ตารางรายการบันทึกงานล่าสุด (สูงสุด 25 รายการ):
| วันที่ | โครงการ | กิจกรรม (Action) | ชั่วโมง | รายละเอียดงาน |
| :--- | :--- | :--- | :--- | :--- |
${detailRows}
`.trim();

    return {
      userName,
      empId: session.empId,
      totalEntries: mappedEntries.length,
      totalHours,
      dateRange: `${startDateStr} ถึง ${endDateStr}`,
      entries: mappedEntries,
      markdownSummary,
    };
  } catch (err) {
    console.error('[Worklog Context] Failed to build context:', err);
    return null;
  }
}
