import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { Users, UserMinus, Plus, QrCode, RefreshCw, Copy, Check, Shield, AlertCircle, ClipboardList, Search, UserPlus, Phone, Building2, Mail } from 'lucide-react';
import { cn } from '../lib/utils';

interface TeamMember {
  id: string; // workspace_users id
  user_id: string;
  role: 'admin' | 'manager' | 'user';
  users: {
    emp_id: string;
    full_name: string;
    nickname: string;
    position: string;
    department: string;
    email: string;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  actor_name: string | null;
  target_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface HRMSCandidate {
  empId: string;
  name: string;
  sim?: string;
  email?: string;
  company?: string;
  companyName?: string;
  department?: string;
  position?: string;
  hasPhoto?: string;
  status?: number;
}

export default function TeamPage() {
  const { showToast, showConfirm } = useNotification();
  const [session, setSession] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  
  // Adding new member & provisioning states
  const [addMemberTab, setAddMemberTab] = useState<'id' | 'search'>('id');
  const [newEmpId, setNewEmpId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HRMSCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Custom confirmation modal state
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Audit log state
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // --- Audit Log Helper ---
  const logAudit = useCallback(async (
    action: string,
    targetId: string | null,
    targetName: string | null,
    metadata: Record<string, any> = {}
  ) => {
    if (!session?.activeWorkspaceId) return;
    try {
      await supabase.from('tb_audit_log').insert({
        workspace_id: session.activeWorkspaceId,
        actor_id: session.id,
        actor_name: session.full_name || session.name || null,
        action,
        target_id: targetId,
        target_name: targetName,
        metadata,
      });
    } catch {
      // Audit log failure is non-blocking
    }
  }, [session]);

  const fetchAuditLog = useCallback(async (wId: string) => {
    setIsAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_audit_log')
        .select('id, action, actor_name, target_name, metadata, created_at')
        .eq('workspace_id', wId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setAuditLog(data || []);
    } catch {
      setAuditLog([]);
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (sessionStr) {
      setSession(JSON.parse(sessionStr));
    }
  }, []);

  const fetchWorkspaceAndMembers = async (wId: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch Workspace Info
      const { data: wData, error: wErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', wId)
        .single();
      if (wErr) throw wErr;
      setWorkspace(wData);

      // 2. Fetch Workspace Members
      const { data: memData, error: memErr } = await supabase
        .from('workspace_users')
        .select(`
          id,
          user_id,
          role,
          users (
            emp_id,
            full_name,
            nickname,
            position,
            department,
            email
          )
        `)
        .eq('workspace_id', wId);
      if (memErr) throw memErr;
      setMembers(memData as any || []);
    } catch (err: any) {
      console.error('Error fetching team:', err);
      showToast('ไม่สามารถดึงข้อมูลทีมได้: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.activeWorkspaceId) {
      fetchWorkspaceAndMembers(session.activeWorkspaceId);
    }
  }, [session]);

  const handleCopyLink = () => {
    if (!workspace) return;
    const inviteLink = `${window.location.origin}/login?invite=${workspace.invite_code}`;
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    showToast('คัดลอกลิงก์เชิญสำเร็จ! / Invite link copied!', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetInviteCode = async () => {
    if (!workspace || !session?.activeWorkspaceId) return;
    
    // Check role - only Admin can reset
    const isWAdmin = session.workspaceRole === 'admin' || session.role === 'admin';
    if (!isWAdmin) {
      showToast('เฉพาะหัวหน้าทีม/Admin เท่านั้นที่สามารถรีเซ็ตรหัสเชิญได้', 'error');
      return;
    }

    const ok = await showConfirm({
      title: 'เปลี่ยนรหัสเชิญใหม่',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนรหัสเชิญใหม่? รหัสเดิมจะใช้งานไม่ได้ทันที',
      type: 'danger',
      confirmText: 'เปลี่ยนรหัสใหม่',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;

    const newCode = `${workspace.workspace_name.split(' ')[0].toUpperCase()}-TEAM-${Math.floor(Math.random() * 9000 + 1000)}`;

    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ invite_code: newCode })
        .eq('id', session.activeWorkspaceId);

      if (error) throw error;
      setWorkspace((prev: any) => ({ ...prev, invite_code: newCode }));
      showToast('รีเซ็ทรหัสเชิญแผนกสำเร็จ! / Invite code reset successful!', 'success');
    } catch (err: any) {
      showToast('ไม่สามารถเปลี่ยนรหัสได้: ' + err.message, 'error');
    }
  };

  const handleRemoveClick = (member: TeamMember) => {
    if (!session?.activeWorkspaceId) return;
    
    // Security check: cannot kick yourself
    if (member.user_id === session.id) {
      showToast('คุณไม่สามารถลบตัวเองออกจากทีมได้', 'warning');
      return;
    }

    setMemberToRemove(member);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove || !session?.activeWorkspaceId) return;
    
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from('workspace_users')
        .delete()
        .eq('id', memberToRemove.id);

      if (error) throw error;

      // Update user's active workspace reference to null
      await supabase
        .from('users')
        .update({ active_workspace_id: null, workspace_role: null })
        .eq('id', memberToRemove.user_id);

      // Audit log
      await logAudit('MEMBER_REMOVED', memberToRemove.user_id, memberToRemove.users.full_name, {
        emp_id: memberToRemove.users.emp_id,
        previous_role: memberToRemove.role,
      });

      setMembers(prev => prev.filter(m => m.id !== memberToRemove.id));
      showToast(`ลบคุณ ${memberToRemove.users.full_name} ออกจากฝ่ายสำเร็จ!`, 'success');
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการลบ: ' + err.message, 'error');
    } finally {
      setIsRemoving(false);
      setMemberToRemove(null);
    }
  };

  // Search employee by Name or Phone number via HRMS API
  const handleSearchByNameOrPhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/hrms/employee/search/${encodeURIComponent(query)}/?index=0&row=5`);
      if (!res.ok) {
        throw new Error('ไม่สามารถค้นหาข้อมูลจากระบบ HRMS ได้');
      }
      const json = await res.json();
      const list: HRMSCandidate[] = json?.data?.search || json?.search || [];
      setSearchResults(list);
      if (list.length === 0) {
        setSearchError(`ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา "${query}"`);
      }
    } catch (err: any) {
      console.error('HRMS search error:', err);
      setSearchError(err.message || 'เกิดข้อผิดพลาดในการค้นหา');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Provision & Add Member to Workspace
  const handleProvisionAndAddMember = async (empIdToProvision: string) => {
    const cleanEmpId = empIdToProvision.trim();
    if (!cleanEmpId || !session?.activeWorkspaceId) return;

    setIsAdding(true);
    try {
      // 1. Find user by emp_id in local database `users` table
      let { data: targetUser, error: userErr } = await supabase
        .from('users')
        .select('id, emp_id, full_name, nickname, active_workspace_id')
        .eq('emp_id', cleanEmpId)
        .maybeSingle();

      if (userErr) throw userErr;

      // 2. If user DOES NOT exist in database -> Auto Provision from HRMS API!
      if (!targetUser) {
        let empData: any = null;
        try {
          const hrmsRes = await fetch(`/api/hrms/employee/${cleanEmpId}/`);
          if (hrmsRes.ok) {
            const hrmsText = await hrmsRes.text();
            const hrmsJson = JSON.parse(hrmsText);
            empData = hrmsJson?.data?.employee || hrmsJson?.employee || hrmsJson || null;
          }
        } catch (e) {
          console.error('Failed to fetch HRMS employee detail:', e);
        }

        if (!empData || (!empData.ID_Emp && !empData.EmpID && !empData.CardID)) {
          showToast(`ไม่พบรหัสพนักงาน "${cleanEmpId}" ในระบบ HRMS บริษัท กรุณาตรวจสอบรหัสอีกครั้ง`, 'error');
          return;
        }

        // Map employee profile from HRMS response
        const empName = empData.EmpName || `${empData.FNameT || ''} ${empData.LNameT || ''}`.trim() || 'พนักงานใหม่';
        const nickname = empData.DisplayName || empData.FNameT || empName.split(' ')[0];
        const email = empData.EMail || empData.Gmail || `${cleanEmpId}@advanceagro.com`;
        const department = empData.Department || empData.Section || 'General';
        const position = empData.Position || empData.JobTitle || 'Staff';
        const phone = empData.Sim_Number || '';
        const companyCode = String(empData.Company_Code || empData.Comp_NameE || empData.CompanyID || '');
        const companyName = empData.CompanyName || '';

        // Insert new profile into `users` DB table
        const { data: newUser, error: insertUserErr } = await supabase
          .from('users')
          .insert({
            emp_id: cleanEmpId,
            full_name: empName,
            nickname: nickname,
            email: email,
            department: department,
            position: position,
            phone: phone,
            company_code: companyCode,
            company_name: companyName,
            status: 'Active',
            active_workspace_id: session.activeWorkspaceId
          })
          .select('id, emp_id, full_name, nickname, active_workspace_id')
          .maybeSingle();

        if (insertUserErr) {
          // RPC fallback
          const { data: rpcUser, error: rpcErr } = await supabase.rpc('provision_hrms_user', {
            p_emp_id: cleanEmpId,
            p_email: email,
            p_full_name: empName,
            p_nickname: nickname,
            p_department: department,
            p_position: position,
            p_phone: phone,
            p_employee_level: empData.LevelName || '',
            p_role_start_date: empData.StartDate ? empData.StartDate.split('T')[0] : null,
            p_company_code: companyCode,
            p_company_name: companyName
          });
          if (rpcErr) throw rpcErr;
          targetUser = rpcUser;
        } else {
          targetUser = newUser;
        }

        if (targetUser) {
          showToast(`สร้างข้อมูลพนักงานคุณ ${empName} (${cleanEmpId}) เข้าระบบเรียบร้อย!`, 'info');
        }
      }

      if (!targetUser) {
        showToast('ไม่สามารถดึงหรือบันทึกข้อมูลพนักงานได้ กรุณาลองใหม่อีกครั้ง', 'error');
        return;
      }

      // 3. User now exists in DB. Check Workspace Membership conditions:
      // Condition A: Already a member of THIS workspace
      const isExistInThisWs = members.some(m => m.user_id === targetUser.id);
      if (isExistInThisWs) {
        showToast(`คุณ ${targetUser.full_name} เป็นสมาชิกของฝ่ายงานนี้อยู่แล้ว`, 'warning');
        return;
      }

      // Condition B: Check if user already belongs to ANY OTHER workspace in workspace_users
      const { data: existingMemberships } = await supabase
        .from('workspace_users')
        .select('workspace_id, workspaces(workspace_name, invite_code)')
        .eq('user_id', targetUser.id);

      if (existingMemberships && existingMemberships.length > 0) {
        const otherMembership = existingMemberships.find((m: any) => m.workspace_id !== session.activeWorkspaceId);
        if (otherMembership) {
          const wsName = (otherMembership as any).workspaces?.workspace_name || (otherMembership as any).workspaces?.invite_code || 'ฝ่ายงานอื่น';
          showToast(
            `คุณ ${targetUser.full_name} (${targetUser.emp_id}) สังกัดฝ่ายงานอยู่แล้ว [สังกัด: ${wsName}] ไม่สามารถเพิ่มซ้ำได้`,
            'warning'
          );
          return;
        }
      }

      // Condition C: Insert in workspace_users & update active_workspace_id
      const { error: insertWsErr } = await supabase
        .from('workspace_users')
        .insert({
          workspace_id: session.activeWorkspaceId,
          user_id: targetUser.id,
          role: 'user'
        });
      if (insertWsErr) throw insertWsErr;

      await supabase
        .from('users')
        .update({ active_workspace_id: session.activeWorkspaceId })
        .eq('id', targetUser.id);

      await logAudit('MEMBER_ADDED', targetUser.id, targetUser.full_name, { role: 'user', emp_id: cleanEmpId });

      showToast(`เพิ่มคุณ ${targetUser.full_name} เข้าทีมเรียบร้อย!`, 'success');
      setNewEmpId('');
      setSearchQuery('');
      setSearchResults([]);
      fetchWorkspaceAndMembers(session.activeWorkspaceId);
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการเพิ่มพนักงาน: ' + err.message, 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const inviteLink = workspace 
    ? `${window.location.origin}/login?invite=${workspace.invite_code}` 
    : '';

  const qrImageUrl = workspace 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}` 
    : '';

  const isWAdmin = session?.workspaceRole === 'admin' || session?.role === 'admin';

  // Fetch audit log when tab switches
  useEffect(() => {
    if (activeTab === 'audit' && session?.activeWorkspaceId) {
      fetchAuditLog(session.activeWorkspaceId);
    }
  }, [activeTab, session, fetchAuditLog]);

  const ACTION_LABEL: Record<string, { label: string; color: string }> = {
    MEMBER_ADDED:   { label: 'เพิ่มสมาชิก', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    MEMBER_REMOVED: { label: 'ลบสมาชิก',   color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    ROLE_CHANGED:   { label: 'เปลี่ยน Role', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme-text flex items-center gap-2">
              <Users className="text-indigo-400" />
              <span>จัดการฝ่ายงาน / Manage Team</span>
            </h1>
            <p className="text-xs text-theme-text-secondary mt-1">
              จัดการสมาชิก อัปเดตข้อมูล และแชร์รหัสเชิญสำหรับพนักงานย่อยภายในฝ่ายงานของคุณ
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : !workspace ? (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 text-center text-theme-text-secondary">
            <AlertCircle className="mx-auto text-amber-500 mb-2" size={32} />
            <p className="text-sm">คุณยังไม่มีสิทธิ์สังกัด Workspace ฝ่ายงานใด ๆ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Invite Sharing & Configuration (1 Column) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Invite Card */}
              <div className="bg-theme-surface-tertiary border border-theme-border rounded-2xl p-6 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <QrCode size={150} className="text-indigo-400" />
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 font-mono">WORKSPACE NAME</span>
                  <h3 className="text-lg font-black text-theme-text">{workspace.workspace_name}</h3>
                  <div className="flex items-center gap-1 text-[9.5px] text-theme-text-secondary font-mono bg-theme-surface-secondary dark:bg-slate-900/30 border border-theme-border rounded px-2 py-0.5 w-fit">
                    <span className="text-theme-text-muted">ID:</span>
                    <span>{workspace.id}</span>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center bg-theme-surface-secondary/50 dark:bg-slate-950/20 border border-theme-border rounded-xl p-6 space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl shadow-xl">
                    <img 
                      src={qrImageUrl} 
                      alt="Workspace Invite QR Code" 
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <span className="text-[10px] text-theme-text-secondary text-center leading-relaxed">
                    สแกน QR Code นี้เพื่อล็อกอิน SSO และเข้าร่วมทีมโดยอัตโนมัติ
                  </span>
                </div>

                {/* Share Link Info */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-theme-text-secondary mb-1.5 font-mono">INVITE CODE</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-theme-surface-secondary border border-theme-border-strong rounded-xl py-2 px-4 text-theme-text font-mono font-bold text-center text-sm">
                        {workspace.invite_code}
                      </div>
                      {isWAdmin && (
                        <button
                          type="button"
                          onClick={handleResetInviteCode}
                          title="Reset Invite Code"
                          className="p-2 border border-theme-border hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text rounded-xl transition-all active:scale-95 shrink-0"
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-theme-text-secondary mb-1.5 font-mono">INVITE LINK</label>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-500/10 border border-indigo-500/30 transition-all active:scale-[0.98]"
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      <span>คัดลอกลิงก์แชร์ / Copy Invite Link</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Add Member & Provisioning Card */}
              {isWAdmin && (
                <div className="bg-theme-surface-tertiary border border-theme-border rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-theme-border/60 pb-2.5">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                      <UserPlus size={16} />
                      <span>เพิ่มสมาชิก / Provisioning</span>
                    </h3>
                  </div>

                  {/* Mode Switcher Tabs */}
                  <div className="flex rounded-xl p-1 bg-theme-surface border border-theme-border/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setAddMemberTab('id')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 text-[11px]",
                        addMemberTab === 'id'
                          ? "bg-indigo-500 text-white shadow-sm"
                          : "text-theme-text-muted hover:text-theme-text"
                      )}
                    >
                      <Plus size={13} />
                      <span>รหัสพนักงาน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMemberTab('search')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 text-[11px]",
                        addMemberTab === 'search'
                          ? "bg-indigo-500 text-white shadow-sm"
                          : "text-theme-text-muted hover:text-theme-text"
                      )}
                    >
                      <Search size={13} />
                      <span>ชื่อ / เบอร์โทร</span>
                    </button>
                  </div>

                  {/* Mode 1: By Employee ID */}
                  {addMemberTab === 'id' && (
                    <form onSubmit={(e) => { e.preventDefault(); handleProvisionAndAddMember(newEmpId); }} className="space-y-3">
                      <input
                        type="text"
                        required
                        value={newEmpId}
                        onChange={e => setNewEmpId(e.target.value)}
                        placeholder="ป้อนรหัสพนักงาน เช่น 10005208"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isAdding || !newEmpId.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isAdding ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>เชิญเข้าทีม / Add to Team</span>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Mode 2: Search By Name or Phone */}
                  {addMemberTab === 'search' && (
                    <div className="space-y-3">
                      <form onSubmit={handleSearchByNameOrPhone} className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="พิมพ์ ชื่อ หรือ เบอร์โทร (เช่น 3379)"
                            className="w-full px-3.5 py-2.5 pl-8 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500"
                          />
                          <Search size={13} className="absolute left-2.5 top-3 text-theme-text-muted" />
                        </div>
                        <button
                          type="submit"
                          disabled={isSearching || !searchQuery.trim()}
                          className="px-3.5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isSearching ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>ค้นหา</span>
                          )}
                        </button>
                      </form>

                      {/* Error notice */}
                      {searchError && (
                        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium px-1">
                          {searchError}
                        </p>
                      )}

                      {/* Candidate list */}
                      {searchResults.length > 0 && (
                        <div className="space-y-2 pt-1 max-h-64 overflow-y-auto custom-scrollbar">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted px-1">
                            ผลการค้นหา ({searchResults.length} รายการ)
                          </div>
                          {searchResults.map((cand) => (
                            <div
                              key={cand.empId}
                              className="p-3 rounded-xl border border-theme-border/80 bg-theme-surface hover:bg-theme-surface-secondary transition-all space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-theme-text flex items-center gap-1.5 flex-wrap">
                                    <span>{cand.name}</span>
                                    <span className="font-mono text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold">
                                      ID: {cand.empId}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-theme-text-secondary mt-0.5">
                                    {cand.position || 'พนักงาน'} {cand.department ? `· ฝ่าย ${cand.department}` : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isAdding}
                                  onClick={() => handleProvisionAndAddMember(cand.empId)}
                                  className="px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  <Plus size={13} />
                                  <span>เพิ่มเข้าทีม</span>
                                </button>
                              </div>
                              {(cand.companyName || cand.sim || cand.email) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-theme-text-muted border-t border-theme-border/40 pt-1.5">
                                  {cand.companyName && (
                                    <span className="flex items-center gap-1">
                                      <Building2 size={10} className="text-slate-400" />
                                      {cand.companyName}
                                    </span>
                                  )}
                                  {cand.sim && (
                                    <span className="flex items-center gap-1 font-mono">
                                      <Phone size={10} className="text-emerald-500" />
                                      {cand.sim}
                                    </span>
                                  )}
                                  {cand.email && (
                                    <span className="flex items-center gap-1 font-mono truncate">
                                      <Mail size={10} className="text-sky-500" />
                                      {cand.email}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Right: Members List + Audit Log (2 Columns) */}
            <div className="lg:col-span-2 space-y-4">

              {/* Tab switcher */}
              <div className="flex items-center gap-1 bg-theme-surface-secondary border border-theme-border rounded-xl p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'members'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-theme-text-secondary hover:text-theme-text'
                  }`}
                >
                  <Users size={12} />
                  <span>สมาชิก ({members.length})</span>
                </button>
                {isWAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'audit'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-theme-text-secondary hover:text-theme-text'
                    }`}
                  >
                    <ClipboardList size={12} />
                    <span>Audit Log</span>
                  </button>
                )}
              </div>

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="bg-theme-surface-tertiary border border-theme-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-theme-surface-secondary/80 text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border">
                          <th className="py-4 px-5">สมาชิก / Member</th>
                          <th className="py-4 px-5">รหัสพนักงาน / ID</th>
                          <th className="py-4 px-5">ตำแหน่ง / Position</th>
                          <th className="py-4 px-5">ระดับสิทธิ์ฝ่าย</th>
                          {isWAdmin && <th className="py-4 px-5 w-20 text-center">จัดการ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border/50">
                        {members.map((mem) => {
                          const isSelf = mem.user_id === session?.id;
                          return (
                            <tr key={mem.id} className="hover:bg-slate-700/10 transition-colors">
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden border border-indigo-500/30 shrink-0">
                                    <img 
                                      src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${mem.users.emp_id}`}
                                      alt="User Avatar"
                                      className="w-full h-full object-cover"
                                      onError={e => {
                                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(mem.users.full_name)}&background=6366f1&color=fff`;
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-theme-text block">
                                      {mem.users.full_name} {isSelf && <span className="text-[10px] text-indigo-400 font-mono">(You)</span>}
                                    </span>
                                    <span className="text-[10px] text-theme-text-muted block">{mem.users.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 font-mono text-theme-text-secondary font-semibold">{mem.users.emp_id}</td>
                              <td className="py-3.5 px-5 text-theme-text-secondary">{mem.users.position}</td>
                              <td className="py-3.5 px-5">
                                {mem.role === 'admin' ? (
                                  <span className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase font-mono">
                                    <Shield size={10} />
                                    <span>Admin</span>
                                  </span>
                                ) : mem.role === 'manager' ? (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase font-mono">
                                    <span>Manager</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase font-mono">
                                    <span>User</span>
                                  </span>
                                )}
                              </td>
                              {isWAdmin && (
                                <td className="py-3.5 px-5 text-center">
                                  {!isSelf && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveClick(mem)}
                                      title="Remove from Team"
                                      className="p-2 border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-400 rounded-xl transition-all active:scale-95"
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Log Tab */}
              {activeTab === 'audit' && isWAdmin && (
                <div className="bg-theme-surface-tertiary border border-theme-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme-border bg-theme-surface-secondary/50">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={14} className="text-indigo-400" />
                      <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Audit Log</span>
                      <span className="text-[10px] text-theme-text-muted">— บันทึกการเปลี่ยนแปลงสมาชิก (50 รายการล่าสุด)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => session?.activeWorkspaceId && fetchAuditLog(session.activeWorkspaceId)}
                      className="p-1.5 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all"
                      title="Refresh"
                    >
                      <RefreshCw size={12} className={isAuditLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {isAuditLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                    </div>
                  ) : auditLog.length === 0 ? (
                    <div className="text-center py-12 text-theme-text-muted text-xs">
                      <ClipboardList className="mx-auto mb-2 opacity-30" size={28} />
                      ยังไม่มีบันทึกกิจกรรม
                    </div>
                  ) : (
                    <div className="divide-y divide-theme-border/50">
                      {auditLog.map(entry => {
                        const info = ACTION_LABEL[entry.action] ?? { label: entry.action, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
                        const ts = new Date(entry.created_at);
                        const dateStr = ts.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
                        const timeStr = ts.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-theme-surface-secondary/50 transition-colors">
                            <span className={`mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${info.color}`}>
                              {info.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-theme-text">
                                <span className="font-semibold">{entry.actor_name || 'Unknown'}</span>
                                {' → '}
                                <span className="font-semibold">{entry.target_name || '—'}</span>
                              </p>
                              {Object.keys(entry.metadata || {}).length > 0 && (
                                <p className="text-[10px] text-theme-text-muted mt-0.5 font-mono">
                                  {Object.entries(entry.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[10px] text-theme-text-muted block font-mono">{dateStr}</span>
                              <span className="text-[10px] text-theme-text-muted block font-mono">{timeStr}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        )}

        {/* Custom Confirmation Modal */}
        {memberToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                  <UserMinus size={22} />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-theme-text">ยืนยันการลบสมาชิกออกจากฝ่าย</h3>
                  <p className="text-xs text-theme-text-secondary leading-relaxed">
                    คุณแน่ใจหรือไม่ว่าต้องการลบคุณ <span className="font-extrabold text-theme-text">{memberToRemove.users.full_name}</span> ({memberToRemove.users.emp_id}) ออกจากการสังกัดฝ่ายงานนี้?
                  </p>
                  <p className="text-xs text-amber-400 mt-3 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    ⚠️ Workspace ที่จะลบสมาชิก: <span className="font-bold">{session?.workspaceName || session?.activeWorkspaceId || 'ไม่ระบุ'}</span>
                  </p>
                </div>

                <div className="flex w-full gap-3 pt-3 border-t border-theme-border/60 mt-4">
                  <button
                    type="button"
                    disabled={isRemoving}
                    onClick={() => setMemberToRemove(null)}
                    className="flex-1 px-4 py-2.5 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-secondary/85 text-theme-text-secondary rounded-xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    ยกเลิก / Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isRemoving}
                    onClick={handleConfirmRemove}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/15"
                  >
                    {isRemoving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>ยืนยันลบสมาชิก / Confirm</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
