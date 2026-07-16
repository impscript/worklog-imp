import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { Users, UserMinus, Plus, QrCode, RefreshCw, Copy, Check, Shield, AlertCircle } from 'lucide-react';

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

export default function TeamPage() {
  const { showToast } = useNotification();
  const [session, setSession] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  
  // Adding new member state
  const [newEmpId, setNewEmpId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Custom confirmation modal state
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

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

    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนรหัสเชิญใหม่? รหัสเดิมจะใช้งานไม่ได้ทันที')) return;

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

      setMembers(prev => prev.filter(m => m.id !== memberToRemove.id));
      showToast(`ลบคุณ ${memberToRemove.users.full_name} ออกจากฝ่ายสำเร็จ!`, 'success');
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการลบ: ' + err.message, 'error');
    } finally {
      setIsRemoving(false);
      setMemberToRemove(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId.trim() || !session?.activeWorkspaceId) return;

    setIsAdding(true);
    try {
      // 1. Find user by emp_id (include active_workspace_id to check if already in another workspace)
      const { data: targetUser, error: userErr } = await supabase
        .from('users')
        .select('id, full_name, active_workspace_id')
        .eq('emp_id', newEmpId.trim())
        .maybeSingle();

      if (userErr) throw userErr;
      if (!targetUser) {
        // Fallback: check HRMS to distinguish "never logged in" vs "invalid ID"
        try {
          const hrmsRes = await fetch(`/api/hrms/employee/${newEmpId.trim()}`);
          if (hrmsRes.ok) {
            const hrmsText = await hrmsRes.text();
            const hrmsData = JSON.parse(hrmsText);
            const empData = hrmsData?.data?.employee || hrmsData?.employee || hrmsData || null;
            const empName = empData?.Emp_Fname || empData?.Emp_Name || empData?.Name || '';
            if (empData && (empData.EmpID || empData.Emp_ID || empData.CardID)) {
              // Employee exists in HRMS but hasn't logged into this system yet
              showToast(
                `พนักงาน${empName ? ` "${empName}"` : ''} (${newEmpId.trim()}) มีในระบบบริษัทแล้ว แต่ยังไม่เคย Login เข้าระบบ Worklog กรุณาแจ้งให้พนักงานล็อกอินก่อน แล้วค่อยเพิ่มเข้าทีม`,
                'warning'
              );
              return;
            }
          }
        } catch {
          // HRMS lookup failed silently — fall through to generic error
        }
        showToast('ไม่พบรหัสพนักงานนี้ในระบบ กรุณาตรวจสอบรหัสอีกครั้ง / Employee ID not found', 'error');
        return;
      }

      // 2. Check if already member of THIS workspace
      const isExist = members.some(m => m.user_id === targetUser.id);
      if (isExist) {
        showToast('พนักงานคนนี้อยู่ในฝ่ายนี้อยู่แล้ว / Already a member of this team', 'warning');
        return;
      }

      // 3. Check if already belongs to ANOTHER workspace (1 user = 1 workspace only)
      if (
        targetUser.active_workspace_id &&
        targetUser.active_workspace_id !== session.activeWorkspaceId
      ) {
        showToast(
          `คุณ ${targetUser.full_name} สังกัดฝ่ายงานอื่นอยู่แล้ว ไม่สามารถเพิ่มได้ / Employee already belongs to another team`,
          'error'
        );
        return;
      }

      // 4. Insert in workspace_users
      const { error: insertErr } = await supabase
        .from('workspace_users')
        .insert({
          workspace_id: session.activeWorkspaceId,
          user_id: targetUser.id,
          role: 'user'
        });
      if (insertErr) throw insertErr;

      // 4. Update user's active workspace
      await supabase
        .from('users')
        .update({ active_workspace_id: session.activeWorkspaceId })
        .eq('id', targetUser.id);

      showToast(`เพิ่มคุณ ${targetUser.full_name} เข้าทีมเรียบร้อย!`, 'success');
      setNewEmpId('');
      fetchWorkspaceAndMembers(session.activeWorkspaceId);
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
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
                          className="p-2 border border-theme-border hover:bg-slate-700 text-theme-text-secondary hover:text-theme-text rounded-xl transition-all active:scale-95 shrink-0"
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

              {/* Add Member manually */}
              {isWAdmin && (
                <div className="bg-theme-surface-tertiary border border-theme-border rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                    <Plus size={16} />
                    <span>เพิ่มสมาชิกโดยรหัสพนักงาน</span>
                  </h3>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newEmpId}
                      onChange={e => setNewEmpId(e.target.value)}
                      placeholder="ป้อนรหัสพนักงาน เช่น 11602338"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isAdding}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-theme-border transition-all flex items-center justify-center gap-2"
                    >
                      {isAdding ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span>เชิญเข้าทีม / Add to Team</span>
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>

            {/* Right: Members List (2 Columns) */}
            <div className="lg:col-span-2 space-y-4">
              
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                  2. รายชื่อสมาชิกทีม ({members.length} คน)
                </h3>
              </div>

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
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden border border-slate-600 shrink-0">
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
