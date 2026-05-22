import { Zap, X, Calendar, Clock, Briefcase, Tag, Layers, Printer, CheckCircle2, Laptop, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { googleCalendar } from '../../lib/google-calendar';

interface ViewWorklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: any;
  onDeleteSuccess?: () => void;
}

export default function ViewWorklogModal({ isOpen, onClose, log, onDeleteSuccess }: ViewWorklogModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useNotification();

  // Get current logged-in user from localStorage to verify ownership
  const sessionStr = localStorage.getItem('worklog_session');
  const session = sessionStr ? JSON.parse(sessionStr) : null;
  const isOwner = session && session.id === log?.user_id;

  if (!isOpen || !log) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!isOwner) {
      showToast('คุณไม่มีสิทธิ์ในการลบใบงานนี้ / You do not have permission to delete this worklog.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Delete from Google Calendar if event exists and calendar sync is configured
      if (log.gcal_event_id) {
        try {
          const token = googleCalendar.getAccessToken();
          if (token) {
            // Fetch user calendar settings
            const { data: user } = await supabase
              .from('users')
              .select('gcal_sync_enabled, gcal_calendar_id')
              .eq('id', log.user_id)
              .maybeSingle();

            if (user?.gcal_sync_enabled) {
              const calendarId = user.gcal_calendar_id || 'primary';
              console.log('[GCal Sync] Deleting event from Google Calendar:', log.gcal_event_id);
              await googleCalendar.deleteEvent(calendarId, log.gcal_event_id);
              console.log('[GCal Sync] Google Calendar event deleted successfully');
            }
          }
        } catch (gcalErr: any) {
          console.warn('[GCal Sync] Failed to delete calendar event during worklog deletion:', gcalErr);
        }
      }

      // 2. Delete from Supabase Database
      const { error } = await supabase
        .from('col_worklog')
        .delete()
        .eq('id', log.id);

      if (error) throw error;

      showToast('ลบใบงานบันทึกงานเรียบร้อยแล้ว! / Worklog successfully deleted!', 'success');
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      setShowConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Error deleting worklog:', err);
      showToast('ไม่สามารถลบใบงานได้: ' + (err.message || err), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getTableType = (projType: string) => {
    if (projType === 'Support MA' || projType === 'Support Go-Live') return 'Support';
    if (projType === 'Management') return 'Management';
    return 'Project';
  };

  const cat = getTableType(log.project_type);

  const typeColors = {
    Project: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    Support: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Management: "text-amber-400 bg-amber-500/10 border-amber-500/20"
  };

  const getBreakTimeDisplay = () => {
    if (!log.break_time || !log.start_time || !log.end_time) return null;
    const [startH, startM] = log.start_time.split(':').map(Number);
    const [endH, endM] = log.end_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const lunchStart = 12 * 60;
    const lunchEnd = 13 * 60;

    const crossesMidnight = endMinutes < startMinutes || (endMinutes === startMinutes && startMinutes > 0);

    let overlapMinutes = 0;
    if (crossesMidnight) {
      const overlapStart1 = Math.max(startMinutes, lunchStart);
      const overlapEnd1 = Math.min(24 * 60, lunchEnd);
      if (overlapEnd1 > overlapStart1) {
        overlapMinutes += (overlapEnd1 - overlapStart1);
      }
      const overlapStart2 = Math.max(0, lunchStart);
      const overlapEnd2 = Math.min(endMinutes, lunchEnd);
      if (overlapEnd2 > overlapStart2) {
        overlapMinutes += (overlapEnd2 - overlapStart2);
      }
    } else {
      const overlapStart = Math.max(startMinutes, lunchStart);
      const overlapEnd = Math.min(endMinutes, lunchEnd);
      if (overlapEnd > overlapStart) {
        overlapMinutes = overlapEnd - overlapStart;
      }
    }

    if (overlapMinutes > 0) {
      const hrs = overlapMinutes / 60;
      return `✅ ใช่ (${hrs === 1 ? '1' : hrs.toFixed(1)} ชั่วโมง)`;
    }
    return null;
  };

  const breakTimeDisplay = getBreakTimeDisplay();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 print:bg-white print:p-0 print:static print:inset-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col print:bg-white print:border-none print:shadow-none print:max-h-full print:w-full print:rounded-none">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#0F172A]/40 shrink-0 print:hidden">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Zap className="text-indigo-400" size={20} />
              <span>รายละเอียดใบงานบันทึกการทำงาน</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ตรวจสอบความถูกต้องและรายละเอียดภาพรวมทั้งหมดของใบงาน</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs"
            >
              <Printer size={14} />
              <span>พิมพ์ใบงาน (Print)</span>
            </button>
            <button 
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content - Styled like a Premium Job Card / Invoice */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-slate-600 dark:text-slate-300 print:overflow-visible print:p-0 print:text-black">
          
          {/* Printable Job Ticket Header */}
          <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700/50 pb-6 print:border-slate-300">
            <div>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest print:text-indigo-600">Work Log Ticket</span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1 print:text-black">JOB REPORT CARD</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">ID: {log.id}</p>
            </div>
            
            <div className="text-right">
              <span className={cn(
                "px-3 py-1 text-xs font-black rounded-full border uppercase tracking-wider",
                (log.is_ot || log.is_implied_ot)
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400 print:border-amber-600 print:text-amber-600"
                  : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 print:border-indigo-600 print:text-indigo-600"
              )}>
                {(log.is_ot || log.is_implied_ot) ? '⚡ OVERTIME WORK' : '💼 STANDARD WORK'}
              </span>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">Created: {new Date(log.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Job Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-[#0F172A]/30 border border-slate-200 dark:border-slate-700/40 p-6 rounded-2xl print:bg-slate-50 print:border-slate-300 print:grid-cols-2">
            
            {/* Left Column: Organization Structure & Classification */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5 print:text-indigo-600">
                <Layers size={14} />
                <span>โครงสร้างองค์กรและการจำแนก</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Holding</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{log.holding}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Business Unit (BU)</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{log.bu || '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Department Operator</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{log.department_operator}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Department</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{log.department || '-'}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/30 pt-3 print:border-slate-200">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Project Type / Category</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("px-2.5 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider border", typeColors[cat])}>
                    {cat}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">({log.project_type})</span>
                </div>
              </div>
            </div>

            {/* Right Column: Date, Time & Project Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5 print:text-indigo-600">
                <Calendar size={14} />
                <span>เวลาปฏิบัติงานและโครงการ</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">วันที่ทำงาน</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black flex items-center gap-1 font-mono">
                    <Calendar size={12} className="text-slate-500 dark:text-slate-400" />
                    {log.work_date}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">ชั่วโมงการทำงานรวม</span>
                  <span className="text-sm font-extrabold text-indigo-300 print:text-indigo-600 font-mono">
                    {log.total_hours.toFixed(1)} ชั่วโมง
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">เวลา เริ่ม - สิ้นสุด</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-slate-500 dark:text-slate-400" />
                    {log.start_time.slice(0, 5)} - {log.end_time.slice(0, 5)}
                  </span>
                </div>
                {breakTimeDisplay && (
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">หักช่วงเวลาพัก</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">
                      {breakTimeDisplay}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/30 pt-3 print:border-slate-200">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">ชื่อโครงการ (Project Name)</span>
                <span className="text-sm font-black text-slate-900 dark:text-white print:text-black block mt-0.5">{log.project_name}</span>
                {log.module && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium mt-0.5">Module: {log.module}</span>
                )}
              </div>
            </div>

          </div>

          {/* Action & Description Panel */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5 print:text-indigo-600">
              <Briefcase size={14} />
              <span>การปฏิบัติงานและรายละเอียดงาน</span>
            </h3>

            <div className="bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-700/50 p-6 rounded-2xl space-y-4 print:bg-white print:border-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">กิจกรรมหลัก (Action Name)</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 print:text-black flex items-center gap-1.5 mt-1">
                    <Tag size={12} className="text-indigo-400" />
                    {log.action_name}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">ช่องทางการสื่อสาร (Action Channels)</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {log.action_channel ? (
                      (log.action_channel as string).split(',').map((c: string) => c.trim()).map((channel: string) => (
                        <span 
                          key={channel}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 uppercase tracking-wider flex items-center gap-0.5",
                            channel === 'Meeting' && "bg-indigo-500/10 border-indigo-500/25 text-indigo-400",
                            channel === 'Discuss via phone' && "bg-amber-500/10 border-amber-500/25 text-amber-400",
                            channel === 'On site' && "bg-rose-500/10 border-rose-500/25 text-rose-400"
                          )}
                        >
                          {channel === 'Meeting' && '👥'}
                          {channel === 'Discuss via phone' && '📞'}
                          {channel === 'On site' && '📍'}
                          <span>{channel}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">ไม่ได้เลือกช่องทาง</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/30 pt-4 print:border-slate-200">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">รายละเอียดงานปฏิบัติจริง</span>
                <div className="bg-slate-50 dark:bg-[#0F172A]/70 border border-slate-200 dark:border-slate-800/40 p-4 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans italic whitespace-pre-wrap print:bg-slate-50 print:border-slate-300 print:text-black">
                  {log.description ? `"${log.description}"` : 'ไม่มีการระบุรายละเอียดเพิ่มเติม'}
                </div>
              </div>
            </div>
          </div>

          {/* Sync status and Sign-off */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700/30 print:border-slate-200 print:grid-cols-2">
            
            {/* Sync status */}
            <div className="flex items-start gap-3 bg-slate-50 dark:bg-[#0F172A]/30 border border-slate-200 dark:border-slate-700/40 p-4 rounded-xl print:bg-none print:border-none print:p-0">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">สถานะการบันทึก</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white print:text-black block mt-0.5">บันทึกสำเร็จในระบบเรียบร้อย</span>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 font-mono">
                  <Laptop size={10} />
                  <span>Channel: {log.channel || 'Web App'}</span>
                </div>
              </div>
            </div>

            {/* Print Signature block (only visible when printing or in summary) */}
            <div className="hidden print:flex flex-col justify-end items-end text-right">
              <div className="w-48 border-b border-black/80 mt-12 mb-2"></div>
              <span className="text-xs font-bold text-black uppercase mr-8">ผู้บันทึกการปฏิบัติงาน</span>
              <span className="text-[10px] text-slate-500 mr-12">({log.department_operator})</span>
            </div>

          </div>

        </div>

        {/* Modal Footer (hidden when printing) */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0F172A]/40 flex justify-between items-center shrink-0 print:hidden">
          {/* Delete Button (Left) */}
          {isOwner ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-black rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>ลบใบงานนี้ (Delete)</span>
            </button>
          ) : (
            <div className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/30 px-3 py-1.5 rounded-xl font-mono">
              🔒 Read-Only (ผู้ใช้อื่น)
            </div>
          )}

          {/* Close Button (Right) */}
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-md shadow-indigo-500/10"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* ==================== PREMIUM CONFIRM BOX OVERLAY ==================== */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#1E293B] border border-rose-500/20 rounded-3xl p-6 shadow-2xl shadow-rose-950/20 animate-in zoom-in-95 duration-150">
            
            {/* Warning Icon & Title */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl shrink-0 animate-bounce">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">ต้องการลบใบงานนี้ใช่หรือไม่?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  การกระทำนี้จะไม่สามารถย้อนกลับได้ ใบงานบันทึกเวลาของวันที่ <span className="text-rose-400 font-bold font-mono">{log.work_date}</span> โครงการ <span className="text-slate-800 dark:text-slate-200 font-bold">"{log.project_name}"</span> จะถูกลบออกจากฐานข้อมูลอย่างถาวร
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-slate-900 dark:text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>ยืนยันลบใบงาน</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
