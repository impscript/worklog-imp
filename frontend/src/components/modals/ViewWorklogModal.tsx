import { Zap, X, Calendar, Clock, Briefcase, Tag, Layers, Printer, CheckCircle2, Laptop, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
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
  const [employeeProfile, setEmployeeProfile] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && log?.user_id) {
      const fetchEmployeeProfile = async () => {
        const { data } = await supabase
          .from('users')
          .select('full_name, position, employee_level')
          .eq('id', log.user_id)
          .maybeSingle();
        if (data) {
          setEmployeeProfile(data);
        }
      };
      fetchEmployeeProfile();
    } else {
      setEmployeeProfile(null);
    }
  }, [isOpen, log?.user_id]);

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
          const token = await googleCalendar.getAccessTokenAsync(log.user_id);
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
              await googleCalendar.deleteEvent(log.user_id, calendarId, log.gcal_event_id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 print-backdrop print:bg-transparent print:p-0 print:static print:block print:inset-auto">
      <div className="w-full max-w-3xl bg-theme-surface-modal border border-theme-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col print-job-card print:bg-white print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 shrink-0 print:hidden">
          <div>
            <h2 className="text-lg font-black text-theme-text tracking-tight flex items-center gap-2">
              <Zap className="text-indigo-400" size={20} />
              <span>รายละเอียดใบงานบันทึกการทำงาน</span>
            </h2>
            <p className="text-xs text-theme-text-secondary mt-0.5">ตรวจสอบความถูกต้องและรายละเอียดภาพรวมทั้งหมดของใบงาน</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="text-theme-text-secondary hover:text-theme-text bg-theme-surface-tertiary hover:bg-slate-700 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs"
            >
              <Printer size={14} />
              <span>พิมพ์ใบงาน (Print)</span>
            </button>
            <button 
              onClick={onClose}
              className="text-theme-text-secondary hover:text-theme-text bg-theme-surface-tertiary hover:bg-slate-700 p-2 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content - Styled like a Premium Job Card / Invoice (Screen Only) */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-theme-text-secondary print:hidden">
          
          {/* Printable Job Ticket Header */}
          <div className="flex justify-between items-start border-b border-theme-border pb-6">
            <div>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Management Operating System</span>
              <h1 className="text-2xl font-black text-theme-text mt-1">JOB REPORT CARD</h1>
              <p className="text-xs text-theme-text-secondary mt-1 font-mono">ID: {log.id}</p>
            </div>
            
            <div className="text-right">
              <span className={cn(
                "px-3 py-1 text-xs font-black rounded-full border uppercase tracking-wider",
                (log.is_ot || log.is_implied_ot)
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                  : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
              )}>
                {(log.is_ot || log.is_implied_ot) ? '⚡ OVERTIME WORK' : '💼 STANDARD WORK'}
              </span>
              <div className="text-xs text-theme-text-muted mt-2 font-mono">Created: {new Date(log.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Job Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border p-6 rounded-2xl">
            
            {/* Left Column: Organization Structure & Classification */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Layers size={14} />
                <span>โครงสร้างองค์กรและการจำแนก</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">Holding</span>
                  <span className="text-sm font-bold text-theme-text">{log.holding}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">Business Unit (BU)</span>
                  <span className="text-sm font-bold text-theme-text">{log.bu || '-'}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">Department Operator</span>
                  <span className="text-sm font-bold text-theme-text">{log.department_operator}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">Department</span>
                  <span className="text-sm font-bold text-theme-text">{log.department || '-'}</span>
                </div>
              </div>

              <div className="border-t border-theme-border pt-3">
                <span className="text-[9px] font-bold text-theme-text-muted uppercase block">Project Type / Category</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("px-2.5 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wider border", typeColors[cat])}>
                    {cat}
                  </span>
                  <span className="text-xs text-theme-text-secondary">({log.project_type})</span>
                </div>
              </div>
            </div>

            {/* Right Column: Date, Time & Project Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Calendar size={14} />
                <span>เวลาปฏิบัติงานและโครงการ</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">วันที่ทำงาน</span>
                  <span className="text-sm font-bold text-theme-text flex items-center gap-1 font-mono">
                    <Calendar size={12} className="text-theme-text-secondary" />
                    {log.work_date}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">ชั่วโมงการทำงานรวม</span>
                  <span className="text-sm font-extrabold text-indigo-300 font-mono">
                    {log.total_hours.toFixed(1)} ชั่วโมง
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-theme-text-muted uppercase block">เวลา เริ่ม - สิ้นสุด</span>
                  <span className="text-sm font-bold text-theme-text flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-theme-text-secondary" />
                    {log.start_time.slice(0, 5)} - {log.end_time.slice(0, 5)}
                  </span>
                </div>
                {breakTimeDisplay && (
                  <div>
                    <span className="text-[11px] font-bold text-theme-text-muted uppercase block">หักช่วงเวลาพัก</span>
                    <span className="text-sm font-bold text-theme-text">
                      {breakTimeDisplay}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-theme-border pt-3">
                <span className="text-[9px] font-bold text-theme-text-muted uppercase block">ชื่อโครงการ (Project Name)</span>
                <span className="text-sm font-black text-theme-text block mt-0.5">{log.project_name}</span>
                {log.module && (
                  <span className="text-xs text-theme-text-secondary block font-medium mt-0.5">Module: {log.module}</span>
                )}
              </div>
            </div>

          </div>

          {/* Action & Description Panel */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Briefcase size={14} />
              <span>การปฏิบัติงานและรายละเอียดงาน</span>
            </h3>

            <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border p-6 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-theme-text-muted uppercase block">กิจกรรมหลัก (Action Name)</span>
                  <span className="text-sm font-extrabold text-theme-text flex items-center gap-1.5 mt-1">
                    <Tag size={12} className="text-indigo-400" />
                    {log.action_name}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-theme-text-muted uppercase block">ช่องทางการสื่อสาร (Action Channels)</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {log.action_channel ? (
                      (log.action_channel as string).split(',').map((c: string) => c.trim()).map((channel: string) => (
                        <span 
                          key={channel}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 uppercase tracking-wider flex items-center gap-0.5",
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
                      <span className="text-xs text-theme-text-muted italic">ไม่ได้เลือกช่องทาง</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-theme-border pt-4">
                <span className="text-[11px] font-bold text-theme-text-muted uppercase block mb-1.5">รายละเอียดงานปฏิบัติจริง</span>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/70 border border-theme-border p-4 rounded-xl text-xs text-theme-text leading-relaxed font-sans italic whitespace-pre-wrap">
                  {log.description ? `"${log.description}"` : 'ไม่มีการระบุรายละเอียดเพิ่มเติม'}
                </div>
              </div>
            </div>
          </div>

          {/* Images Section */}
          {log.image_urls && log.image_urls.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <span>🖼️ รูปภาพประกอบใบงาน / Attachments ({log.image_urls.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {log.image_urls.map((url: string, idx: number) => (
                  <a 
                    key={idx} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="relative group aspect-video rounded-2xl overflow-hidden border border-theme-border bg-theme-surface-secondary cursor-pointer shadow-lg hover:border-indigo-500/50 transition-all duration-300"
                  >
                    <img 
                      src={url} 
                      alt={`Attachment ${idx + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-900/90 text-white rounded-lg border border-slate-700 shadow-md">
                        🔍 เปิดรูปขนาดเต็ม / View Full
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Public Link Sharing Section */}
          <div className="bg-gradient-to-r from-indigo-500/5 to-teal-500/5 border border-indigo-500/10 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <span>🔗 ลิงก์แชร์ใบงานสาธารณะ (Public Ref Link)</span>
              </span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Calendar Sync Ready
              </span>
            </div>
            <p className="text-xs text-theme-text-secondary leading-normal">
              คัดลอกลิงก์ด้านล่างนี้เพื่อนำไปแนบในรายละเอียดของปฏิทิน (Google Calendar) เพื่อให้ผู้ร่วมงานกดเปิดดูรายละเอียดและรูปภาพประกอบได้โดยไม่ต้องล็อกอิน
            </p>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly
                value={`${window.location.origin}/worklog/share/${log.id}`}
                className="w-full bg-theme-surface-secondary/70 border border-theme-border text-xs px-3.5 py-2.5 rounded-xl text-theme-text-secondary font-mono focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/worklog/share/${log.id}`);
                  showToast('คัดลอกลิงก์แชร์เรียบร้อยแล้ว! / Share link copied!', 'success');
                }}
                className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-500/10 shrink-0"
              >
                <span>คัดลอก / Copy</span>
              </button>
            </div>
          </div>

          {/* Sync status and Sign-off */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-theme-border">
            
            {/* Sync status */}
            <div className="flex items-start gap-3 bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border p-4 rounded-xl">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-theme-text-secondary uppercase block">สถานะการบันทึก</span>
                <span className="text-xs font-bold text-theme-text block mt-0.5">บันทึกสำเร็จในระบบเรียบร้อย</span>
                <div className="flex items-center gap-1 text-xs text-theme-text-muted mt-1 font-mono">
                  <Laptop size={10} />
                  <span>Channel: {log.channel || 'Web App'}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* PRINT-ONLY Optimized A4 Document Layout */}
        <div className="hidden print:block p-0 text-black space-y-3 font-sans text-xs">
          {/* Header Zone */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Management Operating System</span>
              <h1 className="text-lg font-extrabold text-black">JOB REPORT CARD</h1>
              <p className="text-[8px] text-slate-500 font-mono mt-0.5">ID: {log.id}</p>
            </div>
            <div className="text-right">
              <span className="inline-block border border-slate-950 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                {(log.is_ot || log.is_implied_ot) ? '⚡ OVERTIME WORK' : '💼 STANDARD WORK'}
              </span>
              <div className="text-[8px] text-slate-500 mt-1 font-mono font-medium">Created: {new Date(log.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Metadata Grid (Compact Table Matrix) */}
          <table className="w-full border-collapse border border-slate-300 text-[10px] leading-tight">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold w-1/4">Holding</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-semibold">{log.holding}</td>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold w-1/4">วันที่ทำงาน</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-mono font-semibold">{log.work_date}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">Business Unit (BU)</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4">{log.bu || '-'}</td>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">ชั่วโมงทำงานรวม</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-mono font-bold">{log.total_hours.toFixed(1)} ชั่วโมง</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">Dept Operator</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-semibold">{log.department_operator}</td>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">เวลา เริ่ม - สิ้นสุด</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-mono font-semibold">{log.start_time.slice(0, 5)} - {log.end_time.slice(0, 5)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">Department</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4">{log.department || '-'}</td>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">หักช่วงเวลาพัก</td>
                <td className="border border-slate-300 px-2.5 py-1.5 w-1/4 font-semibold">{breakTimeDisplay || 'ไม่มี'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">Project / Module</td>
                <td className="border border-slate-300 px-2.5 py-1.5 font-bold text-slate-800" colSpan={3}>
                  {log.project_name} {log.module ? `(Module: ${log.module})` : ''}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-bold">กิจกรรมหลัก (Action)</td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-slate-800" colSpan={3}>
                  {log.action_name} {log.action_channel ? ` | ช่องทาง: ${log.action_channel}` : ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Description Section */}
          <div className="space-y-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">รายละเอียดงานปฏิบัติจริง</h3>
            <div className="border border-slate-300 p-3 rounded bg-white text-[10px] leading-normal font-sans italic whitespace-pre-wrap">
              {log.description ? `"${log.description}"` : 'ไม่มีการระบุรายละเอียดเพิ่มเติม'}
            </div>
          </div>

          {/* Footer Sync & Signatures */}
          <div className="flex justify-between items-end pt-4 border-t border-slate-300 mt-2">
            <div className="text-[8px] text-slate-500 font-mono space-y-0.5">
              <div>System Status: บันทึกสำเร็จในระบบเรียบร้อย</div>
              <div>Source Channel: {log.channel || 'Web App'}</div>
            </div>
            
            <div className="text-right">
              <div className="w-40 border-b border-slate-400 mb-1"></div>
              <div className="text-[10px] font-bold text-slate-800">
                {employeeProfile?.full_name || 'ผู้บันทึกการปฏิบัติงาน'}
              </div>
              <div className="text-[9px] text-slate-500 font-medium">
                {employeeProfile?.position || log.department_operator} ({log.department_operator})
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (hidden when printing) */}
        <div className="p-6 border-t border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 flex justify-between items-center shrink-0 print:hidden">
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
            <div className="text-xs text-theme-text-muted font-bold bg-theme-surface-tertiary/40 border border-theme-border px-3 py-1.5 rounded-xl font-mono">
              🔒 Read-Only (ผู้ใช้อื่น)
            </div>
          )}

          {/* Close Button (Right) */}
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-theme-text text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-md shadow-indigo-500/10"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* ==================== PREMIUM CONFIRM BOX OVERLAY ==================== */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-theme-surface-modal border border-rose-500/20 rounded-3xl p-6 shadow-2xl shadow-rose-950/20 animate-in zoom-in-95 duration-150">
            
            {/* Warning Icon & Title */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl shrink-0 animate-bounce">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-theme-text">ต้องการลบใบงานนี้ใช่หรือไม่?</h3>
                <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
                  การกระทำนี้จะไม่สามารถย้อนกลับได้ ใบงานบันทึกเวลาของวันที่ <span className="text-rose-400 font-bold font-mono">{log.work_date}</span> โครงการ <span className="text-theme-text font-bold">"{log.project_name}"</span> จะถูกลบออกจากฐานข้อมูลอย่างถาวร
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-theme-border">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-theme-surface-tertiary hover:bg-slate-700 text-theme-text-secondary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-theme-text text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
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
