import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, RefreshCw, AlertTriangle, ChevronDown, Trash2,
  Plus, UserMinus, Users, Shield, Activity, X, Key, Clock, Check, Search, Pencil, ChevronRight, Lock
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';

type PageTab = 'workspaces' | 'grants' | 'system_users';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  viewer:   { label: 'Viewer',   color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  analyst:  { label: 'Analyst',  color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  manager:  { label: 'Manager',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { showToast, showConfirm } = useNotification();

  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PageTab>('workspaces');

  // Workspaces tab state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOrphan, setSelectedOrphan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Create workspace state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Grants tab state
  const [grants, setGrants] = useState<any[]>([]);
  const [isGrantsLoading, setIsGrantsLoading] = useState(false);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({
    user_id: '',
    workspace_ids: [] as string[],
    grant_role: 'analyst' as 'viewer' | 'analyst' | 'manager',
    expires_at: '',
    notes: '',
  });
  const [isSavingGrant, setIsSavingGrant] = useState(false);
  // null = create mode, string = editing grant id
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  // For edit mode: single workspace_id stored here
  const [editWsId, setEditWsId] = useState('');

  // System Users tab state
  const [sysSearch, setSysSearch] = useState('');
  const [isTogglingRole, setIsTogglingRole] = useState<string | null>(null);
  const [sysRoleFilter, setSysRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [sysCurrentPage, setSysCurrentPage] = useState(1);
  const [sysPageSize, setSysPageSize] = useState(25);

  // Searchable combobox state for grant modal
  const [userSearch, setUserSearch] = useState('');
  const [wsSearch, setWsSearch] = useState('');
  const [isUserDropOpen, setIsUserDropOpen] = useState(false);
  const [isWsDropOpen, setIsWsDropOpen] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);
  const wsSearchRef = useRef<HTMLDivElement>(null);

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

  const loadGrants = async () => {
    setIsGrantsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_workspace_grants')
        .select('*, users!user_id(id, full_name, emp_id, department), workspaces!workspace_id(workspace_name, invite_code), granted_by_user:users!granted_by(full_name)')
        .order('granted_at', { ascending: false });
      if (error) throw error;
      setGrants(data || []);
    } catch (err: any) {
      // Fallback simpler query if join alias fails
      try {
        const { data } = await supabase
          .from('user_workspace_grants')
          .select('*')
          .order('granted_at', { ascending: false });
        setGrants(data || []);
      } catch { /* ignore */ }
    } finally {
      setIsGrantsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
      loadGrants();
    }
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
        workspace_id: wsId, user_id: selectedOrphan, role: 'user',
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
      message: `ต้องการลบ ${userName} ออกจากฝ่ายงานนี้หรือไม่?\n\n• Workspace: ${wsName || 'นี้'}`,
      confirmText: 'ลบสมาชิก', type: 'danger',
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

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setIsCreating(true);
    try {
      const code = newWsName
        .replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s]/g, '').trim()
        .split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').substring(0, 6)
        + '-' + Math.floor(100 + Math.random() * 900);
      const { data, error } = await supabase
        .from('workspaces').insert({ workspace_name: newWsName.trim(), invite_code: code })
        .select().single();
      if (error) throw error;
      showToast(`สร้าง Workspace "${data.workspace_name}" สำเร็จ! Invite Code: ${data.invite_code}`, 'success');
      setNewWsName(''); setIsCreateOpen(false); loadData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkspace = async (wsId: string, wsName: string) => {
    const ok = await showConfirm({
      title: '⚠️ ยืนยันการลบ Workspace',
      message: `คุณกำลังจะลบ Workspace: "${wsName}"\n• ID: ${wsId}\n\nการลบจะลบ workspace_users, master data, worklog ทั้งหมด\nการกระทำไม่สามารถย้อนกลับได้`,
      confirmText: 'ลบ Workspace ถาวร', type: 'danger',
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

  // ── Grant Management ──────────────────────────────────────────────────────────────
  const handleSaveGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantForm.user_id || grantForm.workspace_ids.length === 0) {
      showToast('กรุณาเลือกพนักงานและอย่างน้อย 1 Workspace', 'error');
      return;
    }
    setIsSavingGrant(true);
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      const sess = sessionStr ? JSON.parse(sessionStr) : null;
      const rows = grantForm.workspace_ids.map(wsId => ({
        user_id: grantForm.user_id,
        workspace_id: wsId,
        grant_role: grantForm.grant_role,
        granted_by: sess?.id || null,
        expires_at: grantForm.expires_at ? new Date(grantForm.expires_at).toISOString() : null,
        notes: grantForm.notes || null,
      }));
      const { error } = await supabase
        .from('user_workspace_grants')
        .upsert(rows, { onConflict: 'user_id,workspace_id' });
      if (error) throw error;

      // ── Audit Log ──
      try {
        const targetUser = allUsers.find(u => u.id === grantForm.user_id);
        const auditRows = grantForm.workspace_ids.map(wsId => {
          const ws = workspaces.find(w => w.id === wsId);
          return {
            workspace_id: wsId,
            actor_id: sess?.id || null,
            actor_name: sess?.full_name || 'System Admin',
            action: 'GRANT_ADDED',
            target_id: grantForm.user_id,
            target_name: targetUser?.full_name || 'Unknown User',
            metadata: {
              grant_role: grantForm.grant_role,
              workspace_name: ws?.workspace_name,
              expires_at: grantForm.expires_at,
              notes: grantForm.notes,
            },
          };
        });
        await supabase.from('tb_audit_log').insert(auditRows);
      } catch (err) {
        console.error('Audit logging failed:', err);
      }

      showToast(`บันทึก Access Grant สำเร็จ! (${rows.length} Workspace)`, 'success');
      setIsGrantModalOpen(false);
      setGrantForm({ user_id: '', workspace_ids: [], grant_role: 'analyst', expires_at: '', notes: '' });
      loadGrants();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsSavingGrant(false);
    }
  };

  const handleRevokeGrant = async (grantId: string, userName: string, wsName: string) => {
    const ok = await showConfirm({
      title: 'ยืนยันการถอนสิทธิ์',
      message: `ถอนสิทธิ์การเข้าถึง Workspace "${wsName}" ของ ${userName} ใช่หรือไม่?`,
      confirmText: 'ถอนสิทธิ์', type: 'danger',
    });
    if (!ok) return;
    try {
      const revoked = grants.find(g => g.id === grantId);
      const { error } = await supabase.from('user_workspace_grants').delete().eq('id', grantId);
      if (error) throw error;

      // ── Audit Log ──
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        const sess = sessionStr ? JSON.parse(sessionStr) : null;
        await supabase.from('tb_audit_log').insert({
          workspace_id: revoked?.workspace_id || null,
          actor_id: sess?.id || null,
          actor_name: sess?.full_name || 'System Admin',
          action: 'GRANT_REVOKED',
          target_id: revoked?.user_id || null,
          target_name: userName,
          metadata: {
            workspace_name: wsName,
            notes: 'Revoked access grant',
          },
        });
      } catch (err) {
        console.error('Audit logging failed:', err);
      }

      showToast('ถอนสิทธิ์สำเร็จ!', 'success');
      loadGrants();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleUpdateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrantId) return;
    setIsSavingGrant(true);
    try {
      const updated = grants.find(g => g.id === editingGrantId);
      const wsData = workspaces.find(w => w.id === updated?.workspace_id);
      const wsName = updated?.workspaces?.workspace_name || wsData?.workspace_name;

      const { error } = await supabase
        .from('user_workspace_grants')
        .update({
          grant_role: grantForm.grant_role,
          expires_at: grantForm.expires_at ? new Date(grantForm.expires_at).toISOString() : null,
          notes: grantForm.notes || null,
        })
        .eq('id', editingGrantId);
      if (error) throw error;

      // ── Audit Log ──
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        const sess = sessionStr ? JSON.parse(sessionStr) : null;
        const targetUser = allUsers.find(u => u.id === updated?.user_id);
        await supabase.from('tb_audit_log').insert({
          workspace_id: updated?.workspace_id || null,
          actor_id: sess?.id || null,
          actor_name: sess?.full_name || 'System Admin',
          action: 'GRANT_UPDATED',
          target_id: updated?.user_id || null,
          target_name: targetUser?.full_name || 'Unknown User',
          metadata: {
            workspace_name: wsName,
            old_grant_role: updated?.grant_role,
            new_grant_role: grantForm.grant_role,
            expires_at: grantForm.expires_at,
            notes: grantForm.notes,
          },
        });
      } catch (err) {
        console.error('Audit logging failed:', err);
      }

      showToast('อัปเดต Access Grant สำเร็จ!', 'success');
      setIsGrantModalOpen(false);
      setEditingGrantId(null);
      setEditWsId('');
      loadGrants();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsSavingGrant(false);
    }
  };

  const handleToggleSysRole = async (user: any) => {
    if (user.emp_id === '10005208') {
      showToast('ไม่สามารถแก้ไขหรือถอนสิทธิ์ของบัญชีผู้พัฒนาหลักระบบนี้ได้', 'error');
      return;
    }
    const isMakingSys = user.role !== 'admin';
    if (isMakingSys) {
      const ok = await showConfirm({
        title: '⚠️ ยืนยันการเพิ่มสิทธิ์ SYS',
        message: `กำลังจะให้สิทธิ์ Super Admin (ระดับ System) แก่ ${user.full_name}\n\nSYS Admin สามารถเข้าถึงทุก Workspace และบายบาส RLS ทั้งหมด\nคุณแน่ใจหรือไม่?`,
        confirmText: 'ให้สิทธิ์ SYS',
        type: 'danger',
      });
      if (!ok) return;
    }
    setIsTogglingRole(user.id);
    try {
      const newRole = isMakingSys ? 'admin' : 'user';
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', user.id);
      if (error) throw error;

      // ── Audit Log ──
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        const sess = sessionStr ? JSON.parse(sessionStr) : null;
        await supabase.from('tb_audit_log').insert({
          workspace_id: null, // Global level system action
          actor_id: sess?.id || null,
          actor_name: sess?.full_name || 'System Admin',
          action: 'SYS_ROLE_CHANGED',
          target_id: user.id,
          target_name: user.full_name,
          metadata: {
            old_role: user.role,
            new_role: newRole,
            reason: isMakingSys ? 'Promoted to SYS Admin' : 'Demoted to User/Staff',
          },
        });
      } catch (err) {
        console.error('Audit logging failed:', err);
      }

      showToast(
        isMakingSys ? `ให้สิทธิ์ SYS แก่ ${user.full_name} สำเร็จ!` : `ถอนสิทธิ์ SYS ของ ${user.full_name} สำเร็จ!`,
        'success'
      );
      // Reload allUsers
      const { data } = await supabase
        .from('users')
        .select('id, emp_id, full_name, nickname, department, role, active_workspace_id')
        .order('full_name');
      if (data) {
        // Update local state via re-load
        setAllUsers(data);
      }
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsTogglingRole(null);
    }
  };

  const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

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
                <h1 className="text-2xl font-black text-theme-text tracking-tight">Workspaces Monitor</h1>
                <p className="text-xs text-theme-text-muted mt-0.5 flex items-center gap-1">
                  <Shield size={10} className="text-rose-400" />
                  ภาพรวมฝ่ายงานทั้งหมดในระบบ — เฉพาะ Super Admin
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadData(); loadGrants(); }}
              disabled={isLoading}
              className="flex items-center gap-2 bg-theme-surface-secondary border border-theme-border rounded-xl px-4 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text hover:border-indigo-500/40 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
              รีเฟรช
            </button>
            {activeTab === 'workspaces' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/30 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
              >
                <Plus size={14} />
                สร้าง Workspace ใหม่
              </button>
            )}
            {activeTab === 'grants' && (
              <button
                onClick={() => { setIsGrantModalOpen(true); setUserSearch(''); setWsSearch(''); setIsUserDropOpen(false); setIsWsDropOpen(false); setGrantForm({ user_id: '', workspace_ids: [], grant_role: 'analyst', expires_at: '', notes: '' }); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/30 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
              >
                <Key size={14} />
                เพิ่ม Access Grant
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-theme-surface-secondary/60 border border-theme-border/50 rounded-2xl p-1 w-fit">
          {([
            ['workspaces', LayoutGrid, 'Workspaces'] as const,
            ['grants', Key, 'Access Grants'] as const,
            ['system_users', Shield, 'System Users'] as const,
          ]).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as PageTab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
                activeTab === tab
                  ? 'bg-theme-surface border border-theme-border/60 text-theme-text shadow-sm'
                  : 'text-theme-text-secondary hover:text-theme-text'
              )}
            >
              <Icon size={13} />
              {label}
              {tab === 'grants' && grants.length > 0 && (
                <span className="ml-1 text-[9px] font-black bg-indigo-500/20 text-indigo-400 rounded-full px-1.5 py-0.5">{grants.length}</span>
              )}
              {tab === 'system_users' && (
                <span className="ml-1 text-[9px] font-black bg-rose-500/20 text-rose-400 rounded-full px-1.5 py-0.5">
                  {allUsers.filter(u => u.role === 'admin').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ TAB: WORKSPACES ══════════════════════════════════════════════════════════ */}
        {activeTab === 'workspaces' && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Workspaces', value: `${workspaces.length} กลุ่ม`, icon: <LayoutGrid size={18} />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'Assigned Members', value: `${workspaceUsers.length} คน`, icon: <Users size={18} />, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Orphaned Users', value: `${orphanedUsers.length} คน`, icon: <AlertTriangle size={18} />, color: orphanedUsers.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-theme-text-muted', bg: orphanedUsers.length > 0 ? 'bg-amber-500/10' : 'bg-theme-surface-secondary' },
              ].map(stat => (
                <div key={stat.label} className="bg-theme-surface-secondary/60 border border-theme-border/60 rounded-2xl p-5 flex items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.bg, stat.color)}>{stat.icon}</div>
                  <div>
                    <p className="text-[10px] text-theme-text-secondary uppercase tracking-wider font-semibold">{stat.label}</p>
                    <p className={cn('text-2xl font-black mt-0.5', stat.color)}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Orphaned Users Quick List */}
            {orphanedUsers.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-750 dark:text-amber-400 flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} />
                  พนักงานที่รอเข้าสังกัด ({orphanedUsers.length} คน) — กดขยาย Workspace เพื่อ Assign
                </h3>
                <div className="flex flex-wrap gap-2">
                  {orphanedUsers.map(u => (
                    <span key={u.id} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg px-2.5 py-1">
                      {u.full_name}
                      <span className="font-mono text-amber-700/80 dark:text-amber-400/70">({u.emp_id})</span>
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
                            <tr className="hover:bg-slate-700/10 transition-colors group">
                              <td className="py-3.5 px-4">
                                <button type="button" onClick={() => setExpandedId(isExpanded ? null : ws.id)} className="p-1 rounded-lg hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">
                                  <ChevronDown size={14} className={cn('transition-transform duration-200', isExpanded && 'rotate-180')} />
                                </button>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-theme-text text-[13px]">{ws.workspace_name}</span>
                                  <span className="text-[9px] text-theme-text-muted font-mono opacity-60">{ws.id}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold text-[12px] bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-0.5">{ws.invite_code}</span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-flex items-center gap-1 font-bold text-theme-text"><Users size={12} className="text-theme-text-muted" />{members.length} คน</span>
                              </td>
                              <td className="py-3.5 px-4 text-theme-text-secondary font-mono text-[11px]">
                                {new Date(ws.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button type="button" onClick={() => handleDeleteWorkspace(ws.id, ws.workspace_name)} className="p-2 border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-400 rounded-xl transition-all" title="ลบ Workspace">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-theme-surface-secondary/30 px-6 py-5 border-b border-theme-border">
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap justify-between items-center gap-3">
                                      <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">สมาชิกในฝ่าย: {ws.workspace_name}</h4>
                                      {orphanedUsers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <select value={selectedOrphan} onChange={e => setSelectedOrphan(e.target.value)} className="bg-theme-surface border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500">
                                            <option value="">-- เลือกพนักงานไร้สังกัด --</option>
                                            {orphanedUsers.map(u => (<option key={u.id} value={u.id}>{u.full_name} ({u.emp_id})</option>))}
                                          </select>
                                          <button type="button" disabled={!selectedOrphan || isSubmitting === ws.id} onClick={() => handleAddUser(ws.id)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-50">
                                            <Plus size={12} />ยัดเข้าแผนก
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {members.length === 0 ? (
                                      <p className="text-xs text-theme-text-muted text-center py-6">ยังไม่มีสมาชิกสังกัดอยู่</p>
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
                                                  {mem.users?.nickname && <span className="text-theme-text-muted font-normal ml-1">({mem.users.nickname})</span>}
                                                </td>
                                                <td className="py-2 px-4 font-mono text-theme-text-secondary">{mem.users?.emp_id}</td>
                                                <td className="py-2 px-4">
                                                  <div className="flex items-center gap-1.5">
                                                    <select value={mem.role} onChange={e => handleChangeRole(mem.id, e.target.value as any)} className="bg-theme-surface-secondary border border-theme-border rounded px-2 py-0.5 text-[10px] font-bold text-theme-text focus:outline-none">
                                                      <option value="user">User</option>
                                                      <option value="manager">Manager</option>
                                                      <option value="admin">Admin (Owner)</option>
                                                    </select>
                                                    {mem.users?.role === 'admin' && (
                                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 shrink-0" title="Global Super Admin">
                                                        <Shield size={8} />SYS
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                  <button type="button" disabled={isSubmitting === mem.id} onClick={() => handleRemoveUser(mem.id, mem.user_id, mem.users?.full_name, ws.workspace_name)} className="p-1 text-theme-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all" title="ถอดออกจากฝ่าย">
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
          </>
        )}

        {/* ══ TAB: ACCESS GRANTS ═══════════════════════════════════════════════════════ */}
        {activeTab === 'grants' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl px-5 py-4 text-xs text-indigo-300">
              <Key size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-indigo-200">Cross-Workspace Access Grants</p>
                <p className="text-indigo-300/80">อนุญาตให้พนักงาน (เช่น HR, ผู้บริหาร) ดูข้อมูลจาก Workspace อื่นโดยไม่ต้องเปลี่ยน active workspace</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    ['viewer', 'ดู Calendar เท่านั้น'],
                    ['analyst', 'ดู Reports + AI Enhance (Read-only)'],
                    ['manager', 'ดูและจัดการข้อมูลบางส่วน'],
                  ].map(([role, desc]) => {
                    const info = ROLE_LABELS[role];
                    return (
                      <span key={role} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold', info.color)}>
                        <span className="font-black">{info.label}:</span> {desc}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grants — Grouped by Employee */}
            <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border/40">
                <h2 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <Key size={15} className="text-indigo-400" />
                  Access Grants ทั้งหมด
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-theme-text-muted font-mono">{grants.length} grants</span>
                  <span className="text-[11px] text-theme-text-muted font-mono">·</span>
                  <span className="text-[11px] text-theme-text-muted font-mono">
                    {Object.keys(grants.reduce((acc: Record<string, boolean>, g) => { acc[g.user_id] = true; return acc; }, {})).length} คน
                  </span>
                </div>
              </div>

              {isGrantsLoading ? (
                <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-theme-text-muted" /></div>
              ) : grants.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Key size={32} className="text-theme-text-muted/30 mx-auto" />
                  <p className="text-sm text-theme-text-muted">ยังไม่มี Access Grant ในระบบ</p>
                  <p className="text-xs text-theme-text-muted/70">กด "เพิ่ม Access Grant" เพื่อให้สิทธิ์ข้าม Workspace</p>
                </div>
              ) : (() => {
                // Group grants by user_id
                const grouped: Record<string, typeof grants> = {};
                grants.forEach(g => {
                  const uid = g.user_id;
                  if (!grouped[uid]) grouped[uid] = [];
                  grouped[uid].push(g);
                });
                // Sort groups by employee name
                const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
                  const nameA = a[0].users?.full_name || '';
                  const nameB = b[0].users?.full_name || '';
                  return nameA.localeCompare(nameB, 'th');
                });

                return (
                  <div className="divide-y divide-theme-border/40">
                    {sortedGroups.map(([userId, userGrants]) => {
                      const firstGrant = userGrants[0];
                      const userName = firstGrant.users?.full_name || allUsers.find(u => u.id === userId)?.full_name || userId.substring(0, 8) + '…';
                      const empId = firstGrant.users?.emp_id || allUsers.find(u => u.id === userId)?.emp_id || '—';
                      const dept = firstGrant.users?.department || allUsers.find(u => u.id === userId)?.department || '';
                      return (
                        <div key={userId}>
                          {/* Employee group header */}
                          <div className="flex items-center gap-3 px-5 py-3 bg-theme-surface-secondary/60">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                              <Users size={14} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-theme-text">{userName}</span>
                                <span className="font-mono text-[10px] text-theme-text-muted bg-theme-surface px-1.5 py-0.5 rounded">{empId}</span>
                                {dept && <span className="text-[10px] text-theme-text-secondary">{dept}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                              {userGrants.length} workspace{userGrants.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {/* Workspace grant rows */}
                          <div className="divide-y divide-theme-border/20">
                            {userGrants.map(g => {
                              const expired = isExpired(g.expires_at);
                              const wsData = workspaces.find(w => w.id === g.workspace_id);
                              const wsName = g.workspaces?.workspace_name || wsData?.workspace_name || g.workspace_id.substring(0, 8) + '…';
                              const wsCode = g.workspaces?.invite_code || wsData?.invite_code;
                              return (
                                <div key={g.id} className={cn('flex items-center gap-3 px-5 py-2.5 pl-16 hover:bg-indigo-500/5 transition-colors group', expired && 'opacity-50')}>
                                  <ChevronRight size={12} className="text-theme-text-muted/40 flex-shrink-0 -ml-5 mr-1" />
                                  {/* Workspace info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-theme-text">{wsName}</span>
                                      {wsCode && <span className="font-mono text-[10px] text-indigo-400">{wsCode}</span>}
                                    </div>
                                  </div>
                                  {/* Role badge */}
                                  <div className="flex-shrink-0">
                                    {ROLE_LABELS[g.grant_role] && (
                                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black', ROLE_LABELS[g.grant_role].color)}>
                                        {ROLE_LABELS[g.grant_role].label}
                                      </span>
                                    )}
                                  </div>
                                  {/* Expiry */}
                                  <div className="flex-shrink-0 w-24 text-right">
                                    {g.expires_at ? (
                                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono', expired ? 'text-rose-400' : 'text-amber-400')}>
                                        <Clock size={10} />
                                        {expired ? '⚠️ ' : ''}
                                        {new Date(g.expires_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                                        <Check size={10} />ถาวร
                                      </span>
                                    )}
                                  </div>
                                  {/* Notes */}
                                  <div className="text-[10px] text-theme-text-secondary w-24 truncate text-right" title={g.notes || ''}>
                                    {g.notes || <span className="opacity-40">—</span>}
                                  </div>
                                  {/* Actions */}
                                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingGrantId(g.id);
                                        setEditWsId(g.workspace_id);
                                        setGrantForm({
                                          user_id: g.user_id,
                                          workspace_ids: [g.workspace_id],
                                          grant_role: g.grant_role,
                                          expires_at: g.expires_at ? g.expires_at.substring(0, 10) : '',
                                          notes: g.notes || '',
                                        });
                                        setUserSearch('');
                                        setWsSearch('');
                                        setIsUserDropOpen(false);
                                        setIsWsDropOpen(false);
                                        setIsGrantModalOpen(true);
                                      }}
                                      className="p-1.5 border border-transparent hover:border-indigo-500/20 hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-400 rounded-xl transition-all"
                                      title="แก้ไข Grant"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeGrant(g.id, userName, wsName)}
                                      className="p-1.5 border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-400 rounded-xl transition-all"
                                      title="ถอนสิทธิ์"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {/* ══ TAB: SYSTEM USERS ════════════════════════════════════════════════════════ */}
        {activeTab === 'system_users' && (
          <div className="space-y-6">
            {/* Search and Stats Row */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              {/* Search and Role Filter Group */}
              <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
                {/* Search bar */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={sysSearch}
                    onChange={(e) => {
                      setSysSearch(e.target.value);
                      setSysCurrentPage(1);
                    }}
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก..."
                    className="w-full bg-theme-surface-secondary/80 border border-theme-border rounded-2xl py-2.5 pl-10 pr-4 text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all shadow-sm"
                  />
                </div>

                {/* Role filter select dropdown */}
                <div className="flex items-center gap-2 bg-theme-surface-secondary/80 border border-theme-border rounded-2xl px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase">ประเภทสิทธิ์:</span>
                  <select
                    value={sysRoleFilter}
                    onChange={(e) => {
                      setSysRoleFilter(e.target.value as any);
                      setSysCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-theme-text focus:outline-none cursor-pointer"
                  >
                    <option value="all">ทั้งหมด ({allUsers.length})</option>
                    <option value="admin">เฉพาะ SYS Admin ({allUsers.filter(u => u.role === 'admin').length})</option>
                    <option value="user">เฉพาะ User / Staff ({allUsers.filter(u => u.role !== 'admin').length})</option>
                  </select>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-surface-tertiary/60 border border-theme-border/50 rounded-xl">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase">พนักงานทั้งหมด:</span>
                  <span className="text-xs font-black text-theme-text font-mono">{allUsers.length} คน</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <Shield size={12} className="text-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-rose-400 uppercase">SYS Admin:</span>
                  <span className="text-xs font-black text-rose-400 font-mono">
                    {allUsers.filter(u => u.role === 'admin').length} คน
                  </span>
                </div>
              </div>
            </div>

            {/* Users list with Client-side Pagination */}
            <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden">
              {(() => {
                // 1. Filter
                const filtered = allUsers.filter(u => {
                  // Role filter check
                  if (sysRoleFilter === 'admin' && u.role !== 'admin') return false;
                  if (sysRoleFilter === 'user' && u.role === 'admin') return false;

                  // Search filter check
                  const q = sysSearch.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (u.full_name || '').toLowerCase().includes(q) ||
                    (u.emp_id || '').toLowerCase().includes(q) ||
                    (u.department || '').toLowerCase().includes(q) ||
                    (u.nickname || '').toLowerCase().includes(q)
                  );
                });

                // 2. Pagination calculation
                const totalItems = filtered.length;
                const totalPages = Math.ceil(totalItems / sysPageSize) || 1;
                
                // Adjust current page if out of bounds
                const activePage = Math.min(Math.max(1, sysCurrentPage), totalPages);
                
                const startIndex = (activePage - 1) * sysPageSize;
                const endIndex = Math.min(startIndex + sysPageSize, totalItems);
                const paginatedUsers = filtered.slice(startIndex, endIndex);

                return (
                  <>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border/40">
                      <h2 className="text-sm font-black text-theme-text flex items-center gap-2">
                        <Shield size={15} className="text-rose-500" />
                        รายชื่อผู้ใช้และสิทธิ์ระบบกลาง (System Roles)
                      </h2>
                      <span className="text-[10px] text-theme-text-muted">
                        {sysSearch || sysRoleFilter !== 'all' ? `พบผลการค้นหา ${totalItems} คน` : `ทั้งหมด ${totalItems} คน`}
                      </span>
                    </div>

                    {totalItems === 0 ? (
                      <div className="text-center py-16 space-y-3">
                        <Users size={32} className="text-theme-text-muted/30 mx-auto" />
                        <p className="text-sm text-theme-text-muted">ไม่พบข้อมูลตามแผนกหรือชื่อคำค้นหา</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-theme-surface-secondary/80 text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border text-[10px]">
                                <th className="py-3 px-5">พนักงาน</th>
                                <th className="py-3 px-5">รหัสพนักงาน</th>
                                <th className="py-3 px-5">แผนก/ฝ่ายงาน</th>
                                <th className="py-3 px-5">สิทธิ์ระดับระบบกลาง (System Role)</th>
                                <th className="py-3 px-5 text-center">จัดการสิทธิ์ SYS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme-border/40">
                              {paginatedUsers.map(u => {
                                const isSys = u.role === 'admin';
                                const loading = isTogglingRole === u.id;
                                return (
                                  <tr key={u.id} className="hover:bg-slate-700/5 transition-colors">
                                    <td className="py-3 px-5">
                                      <div className="font-semibold text-theme-text flex items-center gap-1.5">
                                        {u.full_name}
                                        {u.nickname && (
                                          <span className="text-[10px] font-normal text-theme-text-muted">({u.nickname})</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-5 font-mono text-[11px] text-theme-text-secondary">{u.emp_id || '—'}</td>
                                    <td className="py-3 px-5 text-theme-text-secondary">{u.department || '—'}</td>
                                    <td className="py-3 px-5">
                                      {isSys ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1">
                                          <Shield size={10} /> SYS Admin (Super)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-theme-text-secondary bg-theme-surface-secondary border border-theme-border rounded-lg px-2.5 py-1">
                                          User / Staff
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                      {u.emp_id === '10005208' ? (
                                        <button
                                          type="button"
                                          disabled
                                          className="px-3 py-1.5 rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text-muted text-[10px] font-bold shadow-sm flex items-center gap-1.5 mx-auto cursor-not-allowed"
                                        >
                                          <Lock size={11} />
                                          บัญชีหลักระบบ
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={loading}
                                          onClick={() => handleToggleSysRole(u)}
                                          className={cn(
                                            "px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5 mx-auto disabled:opacity-50",
                                            isSys
                                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                              : "bg-theme-surface border-theme-border text-theme-text hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                                          )}
                                        >
                                          {loading ? (
                                            <RefreshCw size={11} className="animate-spin" />
                                          ) : isSys ? (
                                            <UserMinus size={11} />
                                          ) : (
                                            <Shield size={11} />
                                          )}
                                          {loading
                                            ? "กำลังอัปเดต..."
                                            : isSys
                                            ? "ถอนสิทธิ์ SYS"
                                            : "แต่งตั้งเป็น SYS"}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination footer bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-theme-border/40 gap-4 bg-theme-surface-secondary/20">
                          {/* Left: Row range info & page size switcher */}
                          <div className="flex items-center gap-3 text-[11px] text-theme-text-secondary">
                            <span>
                              แสดง <span className="font-bold text-theme-text">{startIndex + 1} - {endIndex}</span> จากทั้งหมด <span className="font-bold text-theme-text">{totalItems}</span> คน
                            </span>
                            <span className="text-theme-border">|</span>
                            <div className="flex items-center gap-1.5">
                              <span>แสดงหน้าละ:</span>
                              <select
                                value={sysPageSize}
                                onChange={(e) => {
                                  setSysPageSize(Number(e.target.value));
                                  setSysCurrentPage(1);
                                }}
                                className="bg-theme-surface border border-theme-border rounded-lg px-2 py-0.5 font-bold text-theme-text cursor-pointer focus:outline-none"
                              >
                                {[10, 25, 50, 100].map(sz => (
                                  <option key={sz} value={sz}>{sz} คน</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Right: Paging Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={activePage === 1}
                              onClick={() => setSysCurrentPage(1)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-theme-text bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-surface-secondary transition-all disabled:opacity-40"
                            >
                              หน้าแรก
                            </button>
                            <button
                              type="button"
                              disabled={activePage === 1}
                              onClick={() => setSysCurrentPage(activePage - 1)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-theme-text bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-surface-secondary transition-all disabled:opacity-40"
                            >
                              ก่อนหน้า
                            </button>

                            <span className="text-xs text-theme-text-secondary font-semibold px-2">
                              หน้า <span className="font-black text-theme-text">{activePage}</span> / {totalPages}
                            </span>

                            <button
                              type="button"
                              disabled={activePage === totalPages}
                              onClick={() => setSysCurrentPage(activePage + 1)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-theme-text bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-surface-secondary transition-all disabled:opacity-40"
                            >
                              ถัดไป
                            </button>
                            <button
                              type="button"
                              disabled={activePage === totalPages}
                              onClick={() => setSysCurrentPage(totalPages)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-theme-text bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-surface-secondary transition-all disabled:opacity-40"
                            >
                              หน้าสุดท้าย
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        


        {/* ── Create Workspace Modal ──────────────────────────────────────────────────── */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-theme-surface border border-theme-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-theme-text">สร้างฝ่ายงานใหม่</h2>
                  <p className="text-xs text-theme-text-muted mt-0.5">ระบบจะสร้าง Invite Code ให้อัตโนมัติ</p>
                </div>
                <button onClick={() => { setIsCreateOpen(false); setNewWsName(''); }} className="p-2 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all"><X size={16} /></button>
              </div>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">ชื่อฝ่ายงาน / Workspace Name</label>
                  <input type="text" value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="ตัวอย่าง: Human Resource Department" className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-sm text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" required autoFocus />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setIsCreateOpen(false); setNewWsName(''); }} className="flex-1 py-2.5 rounded-xl border border-theme-border text-xs font-bold text-theme-text-secondary hover:bg-theme-surface-secondary transition-all">ยกเลิก</button>
                  <button type="submit" disabled={isCreating || !newWsName.trim()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isCreating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                    {isCreating ? 'กำลังสร้าง...' : 'สร้าง Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Add Grant Modal ────────────────────────────────────────────────────────── */}
        {isGrantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
               onClick={(e) => { if (e.target === e.currentTarget) setIsGrantModalOpen(false); }}>
            <div className="bg-theme-surface border border-theme-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-theme-text flex items-center gap-2">
                    {editingGrantId ? <Pencil size={16} className="text-indigo-400" /> : <Key size={16} className="text-indigo-400" />}
                    {editingGrantId ? 'แก้ไข Access Grant' : 'เพิ่ม Access Grant'}
                  </h2>
                  <p className="text-xs text-theme-text-muted mt-0.5">
                    {editingGrantId
                      ? 'แก้ไขระดับสิทธิ์ วันหมดอายุ หรือหมายเหตุ'
                      : 'ให้สิทธิ์พนักงานเข้าถึงข้อมูลข้าม Workspace'}
                  </p>
                </div>
                <button onClick={() => { setIsGrantModalOpen(false); setEditingGrantId(null); setEditWsId(''); }} className="p-2 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all"><X size={16} /></button>
              </div>

              <form onSubmit={editingGrantId ? handleUpdateGrant : handleSaveGrant} className="space-y-4">

                {/* ── Searchable User Picker ─────────────────── */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">พนักงาน (ผู้รับสิทธิ์)</label>
                  {(() => {
                    const selectedUser = allUsers.find(u => u.id === grantForm.user_id);
                    const filteredUsers = allUsers.filter(u => {
                      if (u.role === 'admin') return false;
                      const q = userSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        (u.full_name || '').toLowerCase().includes(q) ||
                        (u.emp_id || '').toLowerCase().includes(q) ||
                        (u.department || '').toLowerCase().includes(q) ||
                        (u.nickname || '').toLowerCase().includes(q)
                      );
                    });
                    return (
                      <div ref={userSearchRef} className="relative">
                        {/* Selected chip or search input */}
                        {selectedUser && (!isUserDropOpen || editingGrantId) ? (
                          <div className={cn(
                            "flex items-center justify-between w-full border rounded-xl py-2.5 px-4",
                            editingGrantId
                              ? 'bg-theme-surface-secondary border-theme-border cursor-not-allowed'
                              : 'bg-indigo-500/10 border-indigo-500/30'
                          )}>
                            <div>
                              <p className={cn('text-sm font-bold', editingGrantId ? 'text-theme-text-secondary' : 'text-indigo-300')}>{selectedUser.full_name}</p>
                              <p className="text-[10px] text-theme-text-muted">{selectedUser.emp_id} · {selectedUser.department || 'N/A'}</p>
                            </div>
                            {editingGrantId ? (
                              <span className="ml-2 text-[9px] text-theme-text-muted bg-theme-surface px-1.5 py-0.5 rounded border border-theme-border">ล็อก</span>
                            ) : (
                              <button type="button" onClick={() => { setGrantForm(f => ({ ...f, user_id: '' })); setUserSearch(''); setIsUserDropOpen(true); }}
                                className="ml-2 p-1 rounded-lg hover:bg-red-500/20 text-theme-text-muted hover:text-red-400 transition-all">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                            <input
                              type="text"
                              autoFocus={isUserDropOpen}
                              value={userSearch}
                              onChange={e => { setUserSearch(e.target.value); setIsUserDropOpen(true); }}
                              onFocus={() => setIsUserDropOpen(true)}
                              placeholder="ค้นหาชื่อ, รหัสพนักงาน, หน่วยงาน..."
                              className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}
                        {/* Dropdown results */}
                        {isUserDropOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-theme-surface border border-theme-border rounded-xl shadow-2xl overflow-hidden">
                            <div className="max-h-52 overflow-y-auto divide-y divide-theme-border/30">
                              {filteredUsers.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-theme-text-muted text-center">ไม่พบพนักงาน</div>
                              ) : filteredUsers.map(u => (
                                <button key={u.id} type="button"
                                  onClick={() => { setGrantForm(f => ({ ...f, user_id: u.id })); setUserSearch(''); setIsUserDropOpen(false); }}
                                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-500/10 transition-colors text-left group">
                                  <div>
                                    <p className="text-sm font-semibold text-theme-text group-hover:text-indigo-300 transition-colors">{u.full_name}</p>
                                    <p className="text-[10px] text-theme-text-muted">
                                      <span className="font-mono bg-theme-surface-secondary px-1.5 py-0.5 rounded mr-1.5">{u.emp_id}</span>
                                      {u.department || 'N/A'}
                                    </p>
                                  </div>
                                  {grantForm.user_id === u.id && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
                                </button>
                              ))}
                            </div>
                            <div className="px-3 py-1.5 bg-theme-surface-secondary border-t border-theme-border flex items-center justify-between">
                              <span className="text-[10px] text-theme-text-muted">{filteredUsers.length} รายการ</span>
                              <button type="button" onClick={() => setIsUserDropOpen(false)} className="text-[10px] text-theme-text-muted hover:text-theme-text transition-colors">ปิด ✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ── Workspace Picker (Multi in create, locked in edit) ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">Workspace ที่ให้เข้าถึง</label>
                    {!editingGrantId && grantForm.workspace_ids.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        เลือกแล้ว {grantForm.workspace_ids.length} รายการ
                      </span>
                    )}
                  </div>
                  {editingGrantId ? (
                    // Edit mode: locked single workspace chip
                    (() => {
                      const ws = workspaces.find(w => w.id === editWsId);
                      return (
                        <div className="flex items-center justify-between w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 cursor-not-allowed">
                          <div>
                            <p className="text-sm font-bold text-theme-text-secondary">{ws?.workspace_name || editWsId}</p>
                            <p className="text-[10px] text-theme-text-muted font-mono">{ws?.invite_code}</p>
                          </div>
                          <span className="ml-2 text-[9px] text-theme-text-muted bg-theme-surface px-1.5 py-0.5 rounded border border-theme-border">ล็อก</span>
                        </div>
                      );
                    })()
                  ) : (() => {
                    const filteredWs = workspaces.filter(w => {
                      const q = wsSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        (w.workspace_name || '').toLowerCase().includes(q) ||
                        (w.invite_code || '').toLowerCase().includes(q)
                      );
                    });
                    const toggleWs = (wsId: string) => {
                      setGrantForm(f => ({
                        ...f,
                        workspace_ids: f.workspace_ids.includes(wsId)
                          ? f.workspace_ids.filter(id => id !== wsId)
                          : [...f.workspace_ids, wsId],
                      }));
                    };
                    return (
                      <div ref={wsSearchRef} className="relative space-y-2">
                        {/* Selected chips */}
                        {grantForm.workspace_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            {grantForm.workspace_ids.map(wsId => {
                              const ws = workspaces.find(w => w.id === wsId);
                              if (!ws) return null;
                              return (
                                <span key={wsId} className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                                  {ws.workspace_name}
                                  <button type="button" onClick={() => toggleWs(wsId)}
                                    className="hover:text-red-400 transition-colors ml-0.5">
                                    <X size={10} />
                                  </button>
                                </span>
                              );
                            })}
                            <button type="button" onClick={() => setGrantForm(f => ({ ...f, workspace_ids: [] }))}
                              className="text-[10px] text-theme-text-muted hover:text-red-400 transition-colors ml-auto self-center px-1">
                              ล้างทั้งหมด
                            </button>
                          </div>
                        )}
                        {/* Search input */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                          <input
                            type="text"
                            value={wsSearch}
                            onChange={e => { setWsSearch(e.target.value); setIsWsDropOpen(true); }}
                            onFocus={() => setIsWsDropOpen(true)}
                            placeholder={grantForm.workspace_ids.length > 0 ? "เพิ่ม Workspace อื่น..." : "ค้นหา Workspace หรือรหัส..."}
                            className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        {/* Checkbox-style dropdown — stays open while selecting */}
                        {isWsDropOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-theme-surface border border-theme-border rounded-xl shadow-2xl overflow-hidden">
                            <div className="max-h-48 overflow-y-auto divide-y divide-theme-border/30">
                              {filteredWs.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-theme-text-muted text-center">ไม่พบ Workspace</div>
                              ) : filteredWs.map(w => {
                                const isChecked = grantForm.workspace_ids.includes(w.id);
                                return (
                                  <button key={w.id} type="button"
                                    onClick={() => toggleWs(w.id)}
                                    className={cn(
                                      'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group',
                                      isChecked ? 'bg-emerald-500/10' : 'hover:bg-emerald-500/5'
                                    )}>
                                    {/* Checkbox indicator */}
                                    <div className={cn(
                                      'w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all',
                                      isChecked
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-theme-border group-hover:border-emerald-500/50'
                                    )}>
                                      {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn('text-sm font-semibold truncate transition-colors', isChecked ? 'text-emerald-300' : 'text-theme-text group-hover:text-emerald-300')}>{w.workspace_name}</p>
                                      <p className="text-[10px] text-theme-text-muted font-mono">{w.invite_code}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="px-3 py-1.5 bg-theme-surface-secondary border-t border-theme-border flex items-center justify-between">
                              <span className="text-[10px] text-theme-text-muted">
                                {filteredWs.length} รายการ
                                {grantForm.workspace_ids.length > 0 && (
                                  <span className="text-emerald-400 ml-1.5">· เลือกแล้ว {grantForm.workspace_ids.length}</span>
                                )}
                              </span>
                              <button type="button" onClick={() => setIsWsDropOpen(false)} className="text-[10px] text-theme-text-muted hover:text-theme-text transition-colors">ปิด ✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>


                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">ระดับสิทธิ์ (Grant Role)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['viewer', 'analyst', 'manager'] as const).map(role => {
                      const info = ROLE_LABELS[role];
                      return (
                        <button key={role} type="button" onClick={() => setGrantForm(f => ({ ...f, grant_role: role }))}
                          className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border text-[10px] font-bold transition-all', grantForm.grant_role === role ? info.color + ' ring-1 ring-current' : 'border-theme-border text-theme-text-secondary hover:border-indigo-500/40')}>
                          <span className="font-black text-[11px]">{info.label}</span>
                          <span className="text-[9px] font-normal opacity-70">
                            {role === 'viewer' ? 'Calendar only' : role === 'analyst' ? 'Reports + AI' : 'All read access'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">วันหมดอายุ (ว่างไว้ = ถาวร)</label>
                    <input type="date" value={grantForm.expires_at} onChange={e => setGrantForm(f => ({ ...f, expires_at: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-sm text-theme-text focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">หมายเหตุ (ไม่บังคับ)</label>
                    <input type="text" value={grantForm.notes} onChange={e => setGrantForm(f => ({ ...f, notes: e.target.value }))} placeholder="เช่น: HR ตรวจสอบ Q3" className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-sm text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setIsGrantModalOpen(false); setEditingGrantId(null); setEditWsId(''); }} className="flex-1 py-2.5 rounded-xl border border-theme-border text-xs font-bold text-theme-text-secondary hover:bg-theme-surface-secondary transition-all">ยกเลิก</button>
                  <button type="submit"
                    disabled={isSavingGrant || !grantForm.user_id || (!editingGrantId && grantForm.workspace_ids.length === 0)}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSavingGrant ? <RefreshCw size={12} className="animate-spin" /> : editingGrantId ? <Pencil size={12} /> : <Key size={12} />}
                    {isSavingGrant ? 'กำลังบันทึก...' : editingGrantId ? 'บันทึกการแก้ไข' : grantForm.workspace_ids.length > 1 ? `บันทึก ${grantForm.workspace_ids.length} Grants` : 'บันทึก Grant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
