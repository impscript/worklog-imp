import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, RefreshCw, AlertTriangle, ChevronDown, Trash2,
  Plus, UserMinus, Users, Shield, Activity
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { showToast, showConfirm } = useNotification();

  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOrphan, setSelectedOrphan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) { navigate('/login'); return; }
    const user = JSON.parse(sessionStr);
    setSession(user);
    const isSuperAdmin = user.role === 'admin';
    if (!isSuperAdmin) { navigate('/'); }
  }, [navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wsRes, wuRes, usersRes] = await Promise.all([
        supabase.from('workspaces').select('*').order('workspace_name'),
        supabase.from('workspace_users').select('*, users(*)'),
        supabase.from('users').select('id, emp_id, full_name, nickname, department, role, active_workspace_id').order('full_name'),
      ]);
      if (wsRes.data) setWorkspaces(wsRes.data);
      if (wuRes.data) setWorkspaceUsers(wuRes.data);
      if (usersRes.data) setAllUsers(usersRes.data);
    } catch (err) {
      console.error('Error loading workspace data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  const orphanedUsers = useMemo(() => {
    return allUsers.filter(u => {
      const inWorkspace = workspaceUsers.some(wu => wu.user_id === u.id);
      return !inWorkspace && u.emp_id && u.role !== 'admin';
    });
  }, [allUsers, workspaceUsers]);

  const handleAddUser = async (wsId: string) => {
    if (!selectedOrphan) return;
    setIsSubmitting(wsId);
    try {
      const { error: insErr } = await supabase.from('workspace_users').insert({
        workspace_id: wsId,
        user_id: selectedOrphan,
        role: 'user',
      });
      if (insErr) throw insErr;
      const { error: updErr } = await supabase
        .from('users').update({ active_workspace_id: wsId }).eq('id', selectedOrphan);
      if (updErr) throw updErr;
      showToast('เพิ่มพนักงานเข้าแผนกสำเร็จ!', 'success');
      setSelectedOrphan('');
      loadData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleRemoveUser = async (wuId: string, uId: string, userName: string, wsName?: string) => {
    const ok = await showConfirm({
      title: 'ยืนยันการลบสมาชิก',
      message:
        `ต้องการลบ ${userName} ออกจากฝ่ายงานนี้หรือไม่?\n\n` +
        `• Workspace: ${wsName || 'นี้'}`,
      confirmText: 'ลบสมาชิก',
      type: 'danger',
    });
    if (!ok) return;
    setIsSubmitting(wuId);
    try {
      const { error: delErr } = await supabase.from('workspace_users').delete().eq('id', wuId);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase
        .from('users').update({ active_workspace_id: null, workspace_role: null }).eq('id', uId);
      if (updErr) throw updErr;
      showToast('ลบสมาชิกสำเร็จ!', 'success');
      loadData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleChangeRole = async (wuId: string, newRole: 'admin' | 'manager' | 'user') => {
    try {
      const { error } = await supabase
        .from('workspace_users').update({ role: newRole }).eq('id', wuId);
      if (error) throw error;
      showToast('ปรับระดับสิทธิ์สำเร็จ!', 'success');
      loadData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleDeleteWorkspace = async (wsId: string, wsName: string) => {
    const ok = await showConfirm({
      title: '⚠️ ยืนยันการลบ Workspace',
      message:
        `คุณกำลังจะลบ Workspace: "${wsName}"\n` +
        `• ID: ${wsId}\n\n` +
        `การลบนี้จะลบข้อมูลต่อไปนี้ใน Workspace นี้เท่านั้น:\n` +
        `  - ความสัมพันธ์พนักงาน (workspace_users)\n` +
        `  - Master data และ Mapping ทั้งหมดของ Workspace นี้\n` +
        `  - ใบงานบันทึก (worklog) ทั้งหมดของ Workspace นี้\n\n` +
        `การกระทำไม่สามารถย้อนกลับได้ กรุณาตรวจสอบชื่อ Workspace ให้ถูกต้อง`,
      confirmText: 'ลบ Workspace ถาวร',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', wsId);
      if (error) throw error;
      showToast('ลบฝ่ายงานสำเร็จ!', 'success');
      loadData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <LayoutGrid size={20} className="text-rose-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-theme-text tracking-tight">
                  Workspaces Monitor
                </h1>
                <p className="text-xs text-theme-text-muted mt-0.5 flex items-center gap-1">
                  <Shield size={10} className="text-rose-400" />
                  ภาพรวมฝ่ายงานทั้งหมดในระบบ — เฉพาะ Super Admin
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 bg-theme-surface-secondary border border-theme-border rounded-xl px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text hover:border-indigo-500/40 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
            รีเฟรช
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Total Workspaces',
              value: `${workspaces.length} กลุ่ม`,
              icon: <LayoutGrid size={18} />,
              color: 'text-indigo-400',
              bg: 'bg-indigo-500/10',
            },
            {
              label: 'Assigned Members',
              value: `${workspaceUsers.length} คน`,
              icon: <Users size={18} />,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
            },
            {
              label: 'Orphaned Users',
              value: `${orphanedUsers.length} คน`,
              icon: <AlertTriangle size={18} />,
              color: orphanedUsers.length > 0 ? 'text-amber-400' : 'text-theme-text-muted',
              bg: orphanedUsers.length > 0 ? 'bg-amber-500/10' : 'bg-theme-surface-secondary',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-theme-surface-secondary/60 border border-theme-border/60 rounded-2xl p-5 flex items-center gap-4"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.bg, stat.color)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">{stat.label}</p>
                <p className={cn('text-2xl font-black mt-0.5', stat.color)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Orphaned Users Quick List */}
        {orphanedUsers.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-3">
              <AlertTriangle size={14} />
              พนักงานที่รอเข้าสังกัด ({orphanedUsers.length} คน) — กดขยาย Workspace เพื่อ Assign
            </h3>
            <div className="flex flex-wrap gap-2">
              {orphanedUsers.map(u => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg px-2.5 py-1"
                >
                  {u.full_name}
                  <span className="font-mono text-amber-400/70">({u.emp_id})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Workspace Directory Table */}
        <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border/40">
            <h2 className="text-sm font-black text-theme-text flex items-center gap-2">
              <Activity size={15} className="text-indigo-400" />
              รายการฝ่ายงานทั้งหมด
            </h2>
            <span className="text-[11px] text-theme-text-muted font-mono">{workspaces.length} workspaces</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-theme-text-muted">
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-16 text-theme-text-muted text-sm">ยังไม่มีฝ่ายงานในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-theme-surface-secondary/80 text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border text-[11px]">
                    <th className="py-3.5 px-4 w-8"></th>
                    <th className="py-3.5 px-4">ฝ่ายงาน / Workspace</th>
                    <th className="py-3.5 px-4">Invite Code</th>
                    <th className="py-3.5 px-4 text-center">สมาชิก</th>
                    <th className="py-3.5 px-4">วันที่สร้าง</th>
                    <th className="py-3.5 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/40">
                  {workspaces.map(ws => {
                    const isExpanded = expandedId === ws.id;
                    const members = workspaceUsers.filter(wu => wu.workspace_id === ws.id);

                    return (
                      <Fragment key={ws.id}>
                        {/* Workspace Row */}
                        <tr className="hover:bg-slate-700/10 transition-colors group">
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : ws.id)}
                              className="p-1 rounded-lg hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-400 transition-all"
                            >
                              <ChevronDown
                                size={14}
                                className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
                              />
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-extrabold text-theme-text text-[13px]">{ws.workspace_name}</span>
                              <span className="text-[9px] text-theme-text-muted font-mono opacity-60">{ws.id}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-indigo-400 font-bold text-[12px] bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-0.5">
                              {ws.invite_code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-theme-text">
                              <Users size={12} className="text-theme-text-muted" />
                              {members.length} คน
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-theme-text-secondary font-mono text-[11px]">
                            {new Date(ws.created_at).toLocaleDateString('th-TH', {
                              day: '2-digit', month: 'short', year: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteWorkspace(ws.id, ws.workspace_name)}
                              className="p-2 border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-400 rounded-xl transition-all"
                              title="ลบ Workspace"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>

                        {/* Drill-Down Members Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-theme-surface-secondary/30 px-6 py-5 border-b border-theme-border">
                              <div className="space-y-4">

                                {/* Header + Assign orphan */}
                                <div className="flex flex-wrap justify-between items-center gap-3">
                                  <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                                    สมาชิกในฝ่าย: {ws.workspace_name}
                                  </h4>

                                  {orphanedUsers.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={selectedOrphan}
                                        onChange={e => setSelectedOrphan(e.target.value)}
                                        className="bg-theme-surface border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500"
                                      >
                                        <option value="">-- เลือกพนักงานไร้สังกัด --</option>
                                        {orphanedUsers.map(u => (
                                          <option key={u.id} value={u.id}>
                                            {u.full_name} ({u.emp_id})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        disabled={!selectedOrphan || isSubmitting === ws.id}
                                        onClick={() => handleAddUser(ws.id)}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                      >
                                        <Plus size={12} />
                                        ยัดเข้าแผนก
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Members Table */}
                                {members.length === 0 ? (
                                  <p className="text-xs text-theme-text-muted text-center py-6">
                                    ยังไม่มีสมาชิกสังกัดอยู่
                                  </p>
                                ) : (
                                  <div className="border border-theme-border/60 rounded-xl overflow-hidden bg-theme-surface">
                                    <table className="w-full text-left text-[11px]">
                                      <thead>
                                        <tr className="bg-theme-surface-secondary/60 text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border text-[10px]">
                                          <th className="py-2.5 px-4">สมาชิก</th>
                                          <th className="py-2.5 px-4">รหัสพนักงาน</th>
                                          <th className="py-2.5 px-4">ระดับสิทธิ์</th>
                                          <th className="py-2.5 px-4 text-center">ถอดสมาชิก</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-theme-border/40">
                                        {members.map(mem => (
                                          <tr key={mem.id} className="hover:bg-slate-700/5">
                                            <td className="py-2 px-4 font-semibold text-theme-text">
                                              {mem.users?.full_name || '—'}
                                              {mem.users?.nickname && (
                                                <span className="text-theme-text-muted font-normal ml-1">
                                                  ({mem.users.nickname})
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-4 font-mono text-theme-text-secondary">
                                              {mem.users?.emp_id}
                                            </td>
                                            <td className="py-2 px-4">
                                              <select
                                                value={mem.role}
                                                onChange={e => handleChangeRole(mem.id, e.target.value as any)}
                                                className="bg-theme-surface-secondary border border-theme-border rounded px-2 py-0.5 text-[10px] font-bold text-theme-text focus:outline-none"
                                              >
                                                <option value="user">User</option>
                                                <option value="manager">Manager</option>
                                                <option value="admin">Admin (Owner)</option>
                                              </select>
                                            </td>
                                            <td className="py-2 px-4 text-center">
                                              <button
                                                type="button"
                                                disabled={isSubmitting === mem.id}
                                                onClick={() =>
                                                  handleRemoveUser(mem.id, mem.user_id, mem.users?.full_name, ws.workspace_name)
                                                }
                                                className="p-1 text-theme-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                                                title="ถอดออกจากฝ่าย"
                                              >
                                                <UserMinus size={13} />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
