import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Clock, AlertTriangle, Calendar as CalendarIcon, Zap, ChevronDown, Check, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import { syncWorklogToGCal, googleCalendar } from '../../lib/google-calendar';
import { compressImage } from '../../lib/image-compressor';

// Generate Time Options (00:00 to 24:00 - 24 Hours)
// Generate Time Options in 15-minute intervals (00:00 to 24:00 - 24 Hours)
const timeOptions = Array.from({ length: 97 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const min = (i % 4) * 15;
  const val24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  return { label: val24, value: val24 };
});

const validateAndFormatTime = (timeStr: string, fallback: string): string => {
  const clean = timeStr.trim();
  
  // Try to match HH:MM or H:MM
  const match = clean.match(/^([0-1]?[0-9]|2[0-4]):([0-5][0-9])$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h === 24 && m > 0) return fallback;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  
  // Try to match HHMM or HMM
  const digitsMatch = clean.match(/^([0-1]?[0-9]|2[0-4])([0-5][0-9])$/);
  if (digitsMatch) {
    const h = parseInt(digitsMatch[1], 10);
    const m = parseInt(digitsMatch[2], 10);
    if (h === 24 && m > 0) return fallback;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // Try to match single or double digit hour (e.g., 8 -> 08:00, 17 -> 17:00)
  const singleHourMatch = clean.match(/^([0-1]?[0-9]|2[0-4])$/);
  if (singleHourMatch) {
    const h = parseInt(singleHourMatch[1], 10);
    return `${h.toString().padStart(2, '0')}:00`;
  }

  return fallback;
};

interface WorklogEntry {
  id: string;
  user_id: string;
  workspace_id: string;
  work_date: string;
  holding: string;
  department_operator: string;
  project_type: string;
  project_name: string;
  action_name: string;
  total_hours: number;
  description: string | null;
  created_at: string;
  is_ot: boolean;
  is_implied_ot: boolean;
  bu: string;
  start_time?: string;
  end_time?: string;
  break_time?: boolean;
  module?: string | null;
  department?: string;
  channel?: string;
  action_channel?: string | null;
  image_urls?: string[];
}

interface SplitEntry {
  work_date: string;
  hours: number;
  start_time: string;
  end_time: string;
  is_ot: boolean;
}

function getEndOfWorkdayTime(dateStr: string, isHoliday: boolean): string | null {
  if (!dateStr || isHoliday) return null;
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return null;
  if (day === 5) return '17:00';
  return '18:00';
}

function addMinutesToTime(timeStr: string, mins: number): string {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const totalMins = (h * 60 + m + mins + 1440) % 1440;
  const newH = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const newM = String(totalMins % 60).padStart(2, '0');
  return `${newH}:${newM}`;
}

function calculateSegmentHours(startTime: string, endTime: string, deductLunch = false): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) totalMinutes = 0;

  if (deductLunch) {
    const lunchStart = 12 * 60;
    const lunchEnd = 13 * 60;
    const overlapStart = Math.max(startMinutes, lunchStart);
    const overlapEnd = Math.min(endMinutes, lunchEnd);
    if (overlapEnd > overlapStart) {
      totalMinutes -= (overlapEnd - overlapStart);
    }
  }

  return Math.round((totalMinutes / 60) * 100) / 100;
}

function splitEntriesWithOT(
  workDate: string,
  startTime: string,
  endTime: string,
  deductLunch: boolean,
  isHoliday: boolean
): SplitEntry[] {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const entries: SplitEntry[] = [];

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const crossesMidnight = endMinutes < startMinutes || (endMinutes === startMinutes && startMinutes > 0);
  const endOfWorkday = getEndOfWorkdayTime(workDate, isHoliday);

  if (endOfWorkday === null) {
    if (crossesMidnight) {
      const date1 = new Date(workDate);
      const date2 = new Date(workDate);
      date2.setDate(date2.getDate() + 1);

      const hoursDay1 = (24 * 60 - startMinutes) / 60;
      const hoursDay2 = endMinutes / 60;

      let day1Hours = hoursDay1;
      if (deductLunch) {
        const lunchStart = 12 * 60;
        const lunchEnd = 13 * 60;
        const overlapStart = Math.max(startMinutes, lunchStart);
        const overlapEnd = Math.min(24 * 60, lunchEnd);
        if (overlapEnd > overlapStart) {
          day1Hours -= (overlapEnd - overlapStart) / 60;
        }
      }

      entries.push({
        work_date: formatDate(date1),
        hours: Math.round(day1Hours * 100) / 100,
        start_time: startTime,
        end_time: '23:59',
        is_ot: true
      });

      entries.push({
        work_date: formatDate(date2),
        hours: Math.round(hoursDay2 * 100) / 100,
        start_time: '00:00',
        end_time: endTime,
        is_ot: true
      });
    } else {
      const hours = calculateSegmentHours(startTime, endTime, deductLunch);
      entries.push({
        work_date: workDate,
        hours: hours,
        start_time: startTime,
        end_time: endTime,
        is_ot: true
      });
    }
    return entries;
  }

  const [endWorkH, endWorkM] = endOfWorkday.split(':').map(Number);
  const endOfWorkdayMinutes = endWorkH * 60 + endWorkM;

  if (crossesMidnight) {
    if (startMinutes < endOfWorkdayMinutes) {
      const normalHours = calculateSegmentHours(startTime, endOfWorkday, deductLunch);
      if (normalHours > 0) {
        entries.push({
          work_date: workDate,
          hours: normalHours,
          start_time: startTime,
          end_time: endOfWorkday,
          is_ot: false
        });
      }

      const otHoursDay1 = (24 * 60 - endOfWorkdayMinutes) / 60;
      if (otHoursDay1 > 0) {
        entries.push({
          work_date: workDate,
          hours: Math.round(otHoursDay1 * 100) / 100,
          start_time: endOfWorkday,
          end_time: '23:59',
          is_ot: true
        });
      }
    } else {
      const otHoursDay1 = (24 * 60 - startMinutes) / 60;
      entries.push({
        work_date: workDate,
        hours: Math.round(otHoursDay1 * 100) / 100,
        start_time: startTime,
        end_time: '23:59',
        is_ot: true
      });
    }

    const date2 = new Date(workDate);
    date2.setDate(date2.getDate() + 1);
    const date2Str = formatDate(date2);
    const hoursDay2 = endMinutes / 60;

    if (hoursDay2 > 0) {
      entries.push({
        work_date: date2Str,
        hours: Math.round(hoursDay2 * 100) / 100,
        start_time: '00:00',
        end_time: endTime,
        is_ot: true
      });
    }
  } else {
    if (endMinutes > endOfWorkdayMinutes && startMinutes < endOfWorkdayMinutes) {
      const normalHours = calculateSegmentHours(startTime, endOfWorkday, deductLunch);
      const otHours = calculateSegmentHours(endOfWorkday, endTime, false);

      if (normalHours > 0) {
        entries.push({
          work_date: workDate,
          hours: normalHours,
          start_time: startTime,
          end_time: endOfWorkday,
          is_ot: false
        });
      }

      if (otHours > 0) {
        entries.push({
          work_date: workDate,
          hours: otHours,
          start_time: endOfWorkday,
          end_time: endTime,
          is_ot: true
        });
      }
    } else if (startMinutes >= endOfWorkdayMinutes) {
      const otHours = calculateSegmentHours(startTime, endTime, false);
      entries.push({
        work_date: workDate,
        hours: otHours,
        start_time: startTime,
        end_time: endTime,
        is_ot: true
      });
    } else {
      const normalHours = calculateSegmentHours(startTime, endTime, deductLunch);
      entries.push({
        work_date: workDate,
        hours: normalHours,
        start_time: startTime,
        end_time: endTime,
        is_ot: false
      });
    }
  }

  return entries;
}

interface EditWorklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: WorklogEntry | null;
  onSaveSuccess: () => void;
}

export default function EditWorklogModal({ isOpen, onClose, log, onSaveSuccess }: EditWorklogModalProps) {
  const { showToast } = useNotification();
  const [session] = useState(() => JSON.parse(localStorage.getItem('worklog_session') || '{}'));

  // ── Ownership Guard ──────────────────────────────────────────────────────────
  // Only the log's owner can edit. Admins who "view as" another user cannot edit
  // their worklogs either — they should use the admin panel.
  const isOwner = !log || session?.id === log.user_id;

  if (isOpen && log && !isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-theme-surface-modal border border-theme-border rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h3 className="text-lg font-black text-theme-text mb-2">ไม่มีสิทธิ์แก้ไขใบงานนี้</h3>
          <p className="text-sm text-theme-text-secondary mb-6 leading-relaxed">
            คุณสามารถแก้ไขได้เฉพาะใบงานบันทึกการทำงานของตัวเองเท่านั้น<br/>
            <span className="text-[11px] font-mono text-theme-text-muted">(You can only edit your own worklogs.)</span>
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Form State
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const lastValidStartTime = useRef('08:00');
  const lastValidEndTime = useRef('17:00');
  const [isBreak, setIsBreak] = useState(true);
  const [description, setDescription] = useState('');
  const [dbTemplates, setDbTemplates] = useState<any[]>([
    { id: '1', template_name: 'เทมเพลตประชุม', template_content: '[วัตถุประสงค์]: \n[บทบาทของคุณ]: \n[ข้อสรุป]: \n[Next Steps]: ', icon: '📝' },
    { id: '2', template_name: 'เทมเพลตงานทั่วไป', template_content: '[งานที่ทำ]: \n[ผลลัพธ์ที่ได้]: \n[KPI/เป้าหมาย]: \n[Next Steps]: ', icon: '⚙️' },
    { id: '3', template_name: 'เทมเพลต PARIL (ทดลอง)', template_content: '[Plan]: \n[Action]: \n[Result]: \n[Impact]: \n[Lesson Learned]: ', icon: '🎯' }
  ]);
  const [isExplicitOt, setIsExplicitOt] = useState(false);
  const [selectedActionChannels, setSelectedActionChannels] = useState<string[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);

  const handleInjectTemplate = (templateText: string) => {
    if (!description.trim()) {
      setDescription(templateText);
    } else {
      setDescription(prev => {
        const separator = prev.endsWith('\n') ? '' : '\n';
        return prev + separator + templateText;
      });
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachedImages.length + files.length > 2) {
      showToast('แนบรูปได้ไม่เกิน 2 รูป ต่อใบงาน / Max 2 images allowed', 'error');
      return;
    }

    setUploadingImages(true);
    try {
      const uploadedUrls = [...attachedImages];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBlob = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('file', compressedFile);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Server returned status ${response.status}: ${errText || 'Unknown Error'}`);
        }

        let result;
        try {
          result = await response.json();
        } catch (jsonErr) {
          throw new Error('Server did not return a valid JSON response. Please check if your local server is running in Wrangler/Pages dev mode instead of raw Vite dev mode to support /api/upload endpoint.');
        }

        if (result && result.success && result.url) {
          uploadedUrls.push(result.url);
        } else {
          throw new Error(result?.error || 'Upload failed');
        }
      }
      setAttachedImages(uploadedUrls);
      showToast('อัปโหลดรูปภาพประกอบสำเร็จ! / Images uploaded successfully', 'success');
    } catch (err: any) {
      console.error('[Upload Error]', err);
      showToast('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + err.message, 'error');
    } finally {
      setUploadingImages(false);
    }
  };

  // Cascading Dropdown States
  const [holding, setHolding] = useState('');
  const [role, setRole] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [module, setModule] = useState('');
  const [actionName, setActionName] = useState('');

  // Auto-calculated fields
  const [bu, setBu] = useState('');
  const [department, setDepartment] = useState('');

  // Dropdown options loaded from DB
  const [mapUserRole, setMapUserRole] = useState<any[]>([]);
  const [mapProjectStructure, setMapProjectStructure] = useState<any[]>([]);
  const [masterActions, setMasterActions] = useState<any[]>([]);

  // Verification lists
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  const [isHolidayDate, setIsHolidayDate] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch Mapping Structures
  useEffect(() => {
    if (!isOpen || !log) return;
    
    async function loadDropdownData() {
      const targetUserId = log?.user_id || session.id;
      const workspaceId = session?.activeWorkspaceId;

      // 1. First fetch user details from DB to build cleanName fallback
      let cleanName = 'Chatchawan';
      let dbEmpId = '';
      if (targetUserId) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('nickname, full_name, emp_id')
          .eq('id', targetUserId)
          .maybeSingle();
          
        if (dbUser) {
          dbEmpId = dbUser.emp_id || '';
          const rawName = dbUser.nickname || dbUser.full_name?.split(' ')[0] || '';
          cleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
        }
      }

      const isThai = /[\u0e00-\u0e7f]/.test(cleanName);
      if (isThai || !cleanName.trim()) {
        cleanName = 'Chatchawan';
      }

      // Build workspace-scoped queries for dropdown data
      let userQuery = supabase.from('tb_map_user_role').select('*').eq('user_id', targetUserId);
      let projQuery = supabase.from('tb_map_project_structure').select('*');
      let actQuery = supabase.from('tb_master_action').select('*');
      let tplQuery = supabase.from('tb_master_worklog_templates').select('*');

      if (workspaceId) {
        userQuery = (userQuery as any).eq('workspace_id', workspaceId);
        projQuery = (projQuery as any).eq('workspace_id', workspaceId);
        actQuery = (actQuery as any).eq('workspace_id', workspaceId);
        tplQuery = (tplQuery as any).eq('workspace_id', workspaceId);
      }

      const [resUser, resProj, resAct, resTpl] = await Promise.all([
        userQuery,
        projQuery,
        actQuery,
        tplQuery
      ]);

      if (resUser.data && resUser.data.length > 0) {
        setMapUserRole(resUser.data);
      } else {
        // Fallback 1: Query by cleanName/nickname
        let nameQuery = supabase.from('tb_map_user_role').select('*').ilike('name', cleanName.trim());
        if (workspaceId) nameQuery = nameQuery.eq('workspace_id', workspaceId);
        const { data: nameData } = await nameQuery;

        if (nameData && nameData.length > 0) {
          setMapUserRole(nameData);
        } else {
          // Fallback 2: Query by empId if available
          let empData = null;
          if (dbEmpId) {
            let empQuery = supabase.from('tb_map_user_role').select('*').eq('name', dbEmpId);
            if (workspaceId) empQuery = empQuery.eq('workspace_id', workspaceId);
            const { data } = await empQuery;
            empData = data;
          }

          if (empData && empData.length > 0) {
            setMapUserRole(empData);
          } else {
            // Fallback 3: Chatchawan
            let fallbackQuery = supabase.from('tb_map_user_role').select('*').ilike('name', 'Chatchawan');
            if (workspaceId) fallbackQuery = (fallbackQuery as any).eq('workspace_id', workspaceId);
            const fallback = await fallbackQuery;
            if (fallback.data) setMapUserRole(fallback.data);
          }
        }
      }

      if (resProj.data) setMapProjectStructure(resProj.data);
      if (resAct.data) setMasterActions(resAct.data);
      if (resTpl.data && resTpl.data.length > 0) {
        setDbTemplates(resTpl.data);
      }
    }
    loadDropdownData();
  }, [isOpen, log, session]);

  // Prepopulate form when log changes
  useEffect(() => {
    if (log && isOpen) {
      setDate(log.work_date);
      setStartTime(log.start_time ? log.start_time.slice(0, 5) : '08:00');
      setEndTime(log.end_time ? log.end_time.slice(0, 5) : '17:00');
      setIsBreak(log.break_time !== undefined ? log.break_time : true);
      setDescription(log.description || '');
      setIsExplicitOt(log.is_ot);
      
      // Cascading fields
      setHolding(log.holding);
      setRole(log.department_operator);
      setProjectType(log.project_type);
      setProjectName(log.project_name);
      setModule(log.module || '');
      setActionName(log.action_name);
      setBu(log.bu || '');
      setDepartment(log.department || '');
      setAttachedImages(log.image_urls || []);

      // Action channels
      if (log.action_channel) {
        setSelectedActionChannels(log.action_channel.split(',').map((c: string) => c.trim()));
      } else {
        setSelectedActionChannels([]);
      }
    }
  }, [log, isOpen]);

  // Reset or restore isExplicitOt when user changes the work date
  useEffect(() => {
    if (!log || !isOpen) return;
    if (date === log.work_date) {
      setIsExplicitOt(log.is_ot);
    } else {
      setIsExplicitOt(false);
    }
  }, [date, log, isOpen]);

  // Fetch other entries of the day to prevent overlaps
  useEffect(() => {
    if (!isOpen || !log || !date) return;

    const currentLogId = log.id;
    const currentUserId = log.user_id;

    async function loadDailyData() {
      if (!log) return;
      // 1. Fetch other logs on this date (exclude current log if editing)
      let query = supabase
        .from('col_worklog')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('work_date', date)
        .eq('workspace_id', log.workspace_id);
      
      if (currentLogId) {
        query = query.neq('id', currentLogId);
      }

      const { data: logs } = await query;
      
      if (logs) setExistingEntries(logs);

      // 2. Check if weekend/holiday
      const d = new Date(date);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        setIsHolidayDate(true);
        setHolidayName(day === 0 ? 'วันอาทิตย์ (Weekend)' : 'วันเสาร์ (Weekend)');
      } else {
        const { data: holiday } = await supabase
          .from('tb_master_holiday')
          .select('name')
          .eq('date', date)
          .maybeSingle();
        
        if (holiday) {
          setIsHolidayDate(true);
          setHolidayName(holiday.name);
        } else {
          setIsHolidayDate(false);
          setHolidayName('');
        }
      }
    }
    loadDailyData();
  }, [date, isOpen, log]);

  // Handle auto explicit OT triggers on holidays
  useEffect(() => {
    if (isHolidayDate) {
      setIsExplicitOt(true);
    }
  }, [isHolidayDate]);

  // Memoized dropdown constraints matching LogWorkPage
  const availableHoldings = useMemo(() => {
    return Array.from(new Set(mapProjectStructure.map(p => p.holding).filter(Boolean))).sort() as string[];
  }, [mapProjectStructure]);
  
  const availableRoles = useMemo(() => {
    if (!holding) return [];
    
    // Find matching role operators from User Mappings
    const matches = mapUserRole.filter(ur => {
      const urHolding = (ur.holding || '').trim().toLowerCase();
      const selHolding = holding.trim().toLowerCase();
      return urHolding === 'all' || urHolding === 'all holding' || urHolding === selHolding;
    });

    const hasWildcardDept = matches.some(ur => (ur.department_operator || '').trim().toLowerCase() === 'all');
    
    if (hasWildcardDept || matches.length === 0) {
      // Fallback to extracting all department operators defined on actual projects in this holding
      const structureOperators = mapProjectStructure
        .filter(p => (p.holding || '').trim().toLowerCase() === holding.trim().toLowerCase())
        .map(p => p.department_operator)
        .filter(Boolean);
      return Array.from(new Set(structureOperators)).sort() as string[];
    }

    return Array.from(new Set(matches.map(m => m.department_operator).filter(Boolean))).sort() as string[];
  }, [holding, mapUserRole, mapProjectStructure]);

  const availableProjectTypes = useMemo(() => {
    if (!holding || !role) return [];
    return Array.from(new Set(mapProjectStructure
      .filter(p => 
        (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() && 
        (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase()
      )
      .map(p => p.project_type))).sort();
  }, [holding, role, mapProjectStructure]);

  const availableProjects = useMemo(() => {
    if (!holding || !role || !projectType) return [];
    return Array.from(new Set(mapProjectStructure
      .filter(p => 
        (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() && 
        (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() && 
        p.project_type === projectType
      )
      .map(p => p.project_name))).sort();
  }, [holding, role, projectType, mapProjectStructure]);

  const availableModules = useMemo(() => {
    if (!projectName) return [];
    return Array.from(new Set(
      mapProjectStructure
        .filter(p => 
          (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() && 
          (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() && 
          p.project_type === projectType && 
          p.project_name === projectName
        )
        .map(p => p.module)
        .filter(Boolean) as string[]
    )).sort();
  }, [projectName, projectType, role, holding, mapProjectStructure]);

  // When no modules exist for the selected project, expose BU/Dept options for manual selection
  const noModuleMode = projectName && availableModules.length === 0;

  const availableBUs = useMemo(() => {
    if (!noModuleMode) return [];
    return Array.from(new Set(
      mapProjectStructure
        .filter(p =>
          (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() &&
          (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() &&
          p.project_type === projectType &&
          p.project_name === projectName
        )
        .map(p => p.bu)
        .filter(Boolean)
    )).sort() as string[];
  }, [noModuleMode, projectName, projectType, role, holding, mapProjectStructure]);

  const availableDepts = useMemo(() => {
    if (!noModuleMode || !bu) return [];
    return Array.from(new Set(
      mapProjectStructure
        .filter(p =>
          (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() &&
          (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() &&
          p.project_type === projectType &&
          p.project_name === projectName &&
          p.bu === bu
        )
        .map(p => p.department)
        .filter(Boolean)
    )).sort() as string[];
  }, [noModuleMode, bu, projectName, projectType, role, holding, mapProjectStructure]);

  const availableBUsForModule = useMemo(() => {
    if (!projectName || !module) return [];
    return Array.from(new Set(
      mapProjectStructure
        .filter(p =>
          (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() &&
          (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() &&
          p.project_type === projectType &&
          p.project_name === projectName &&
          p.module === module
        )
        .map(p => p.bu)
        .filter(Boolean)
    )).sort() as string[];
  }, [projectName, projectType, role, holding, module, mapProjectStructure]);

  const availableDeptsForModule = useMemo(() => {
    if (!projectName || !module || !bu) return [];
    return Array.from(new Set(
      mapProjectStructure
        .filter(p =>
          (p.holding || '').trim().toLowerCase() === (holding || '').trim().toLowerCase() &&
          (p.department_operator || '').trim().toLowerCase() === (role || '').trim().toLowerCase() &&
          p.project_type === projectType &&
          p.project_name === projectName &&
          p.module === module &&
          p.bu === bu
        )
        .map(p => p.department)
        .filter(Boolean)
    )).sort() as string[];
  }, [projectName, projectType, role, holding, module, bu, mapProjectStructure]);

  const availableActions = useMemo(() => {
    if (!projectType) return [];
    const category = projectType === 'Management' ? 'Management' : projectType.includes('Support') ? 'Support' : 'Project';
    return masterActions.filter(a => a.action_category === category).map(a => a.action_name).sort();
  }, [projectType, masterActions]);

  // Cascade resets
  const handleHoldingChange = (val: string) => {
    setHolding(val);
    setRole('');
    setProjectType('');
    setProjectName('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleRoleChange = (val: string) => {
    setRole(val);
    setProjectType('');
    setProjectName('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleProjectTypeChange = (val: string) => {
    setProjectType(val);
    setProjectName('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  // Sync BU & Department
  useEffect(() => {
    if (projectName) {
      const hasModules = mapProjectStructure.some(p =>
        p.holding === holding &&
        p.department_operator === role &&
        p.project_type === projectType &&
        p.project_name === projectName &&
        p.module
      );

      if (hasModules) {
        if (module) {
          const matches = mapProjectStructure.filter(p =>
            p.holding === holding &&
            p.department_operator === role &&
            p.project_type === projectType &&
            p.project_name === projectName &&
            p.module === module
          );
          
          const uniqueBUs = Array.from(new Set(matches.map(m => m.bu).filter(Boolean)));
          
          if (uniqueBUs.length === 1) {
            const singleBU = uniqueBUs[0];
            setBu(singleBU);
            
            const deptsForBU = Array.from(new Set(
              matches
                .filter(m => m.bu === singleBU)
                .map(m => m.department)
                .filter(Boolean)
            ));
            
            if (deptsForBU.length === 1) {
              setDepartment(deptsForBU[0]);
            } else {
              if (!deptsForBU.includes(department)) {
                setDepartment('');
              }
            }
          } else {
            if (!uniqueBUs.includes(bu)) {
              setBu('');
              setDepartment('');
            } else {
              const deptsForBU = Array.from(new Set(
                matches
                  .filter(m => m.bu === bu)
                  .map(m => m.department)
                  .filter(Boolean)
              ));
              if (!deptsForBU.includes(department)) {
                setDepartment('');
              }
            }
          }
        } else {
          // Only clear if the module actually changed to empty
          setBu('');
          setDepartment('');
        }
      } else {
        // No-module mode: BU/Dept chosen by user via dropdown — don't auto-set or clear prepopulated value
      }
    }
  }, [projectName, module, holding, role, projectType, mapProjectStructure]);

  // Live Durations & Overlaps preview calculations
  const preview = useMemo(() => {
    if (!startTime || !endTime) {
      return {
        duration: 0,
        normalHours: 0,
        otHours: 0,
        isOverlap: false,
        overlappingEvent: '',
        isImpliedOt: false,
        segments: [] as SplitEntry[]
      };
    }
    
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);

    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;

    // 1. Time overlap verify
    let isOverlap = false;
    let overlappingEvent = '';

    for (const entry of existingEntries) {
      const [eSH, eSM] = entry.start_time.split(':').map(Number);
      const [eEH, eEM] = entry.end_time.split(':').map(Number);
      const eStart = eSH * 60 + eSM;
      const eEnd = eEH * 60 + eEM;

      if (startMins < eEnd && endMins > eStart) {
        isOverlap = true;
        overlappingEvent = `${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)} (${entry.project_name})`;
        break;
      }
    }

    // 2. OT vs Normal calculation using official workday end boundaries
    const isHoliday = isHolidayDate || isExplicitOt;
    const segments = splitEntriesWithOT(date, startTime, endTime, isBreak, isHoliday);

    let totalDuration = 0;
    let normalHours = 0;
    let otHours = 0;

    for (const segment of segments) {
      totalDuration += segment.hours;
      if (segment.is_ot) {
        otHours += segment.hours;
      } else {
        normalHours += segment.hours;
      }
    }

    // Implied OT is true if any segment is OT and user didn't explicitly tick OT/Holiday
    const isImpliedOt = otHours > 0 && !isHolidayDate && !isExplicitOt;

    return {
      duration: Math.round(totalDuration * 100) / 100,
      normalHours: Math.round(normalHours * 100) / 100,
      otHours: Math.round(otHours * 100) / 100,
      isOverlap,
      overlappingEvent,
      isImpliedOt,
      segments
    };
  }, [startTime, endTime, isBreak, existingEntries, isExplicitOt, isHolidayDate, date]);

  // Handle Updates
  const handleSave = () => {
    if (!log || !holding || !role || !projectType || !projectName || !actionName || preview.duration <= 0) {
      showToast('โปรดกรอกข้อมูลให้ครบทุกช่องก่อนบันทึก', 'warning');
      return;
    }
    
    if (availableModules.length > 0 && !module) {
      showToast('กรุณาเลือกโมดูล / Please select Module', 'warning');
      return;
    }

    const isBuDeptSelectable = noModuleMode || (projectName && module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1));
    if (isBuDeptSelectable) {
      if (!bu) {
        showToast('กรุณาเลือก Business Unit (BU) / Please select Business Unit', 'warning');
        return;
      }
      if (!department) {
        showToast('กรุณาเลือก Target Department / Please select Target Department', 'warning');
        return;
      }
    }
    
    setShowConfirmModal(true);
  };

  const executeSave = async () => {
    if (!log) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);
    const sessionStr = localStorage.getItem('worklog_session');
    const sessionObj = sessionStr ? JSON.parse(sessionStr) : null;
    const workspaceId = sessionObj?.activeWorkspaceId;

    try {
      const { ready } = await googleCalendar.checkSessionReady(log.user_id);
      if (!ready) {
        showToast('กำลังเชื่อมต่อ Google Calendar... กรุณารอสักครู่ / Connecting Google Calendar...', 'info');

        let updatePayload: any = {};
        let inserts: any[] = [];

        if (preview.segments.length > 1) {
          const segment0 = preview.segments[0];
          const segment0Prefix = segment0.is_ot ? '[OT]' : '[Normal]';
          updatePayload = {
            work_date: segment0.work_date,
            start_time: segment0.start_time + ':00',
            end_time: segment0.end_time + ':00',
            break_time: !segment0.is_ot ? isBreak : false,
            total_hours: segment0.hours,
            holding,
            department_operator: role,
            project_type: projectType,
            project_name: projectName,
            module: module || null,
            bu,
            department,
            action_name: actionName,
            action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
            description: description ? `${segment0Prefix} ${description}` : `${segment0.is_ot ? 'OT' : 'Normal'} portion`,
            is_ot: segment0.is_ot,
            is_implied_ot: segment0.is_ot && !isHolidayDate && !isExplicitOt,
            image_urls: attachedImages,
            workspace_id: workspaceId
          };

          for (let i = 1; i < preview.segments.length; i++) {
            const segment = preview.segments[i];
            const segmentPrefix = segment.is_ot ? '[OT]' : '[Normal]';
            inserts.push({
              user_id: log.user_id,
              work_date: segment.work_date,
              start_time: segment.start_time + ':00',
              end_time: segment.end_time + ':00',
              break_time: !segment.is_ot ? isBreak : false,
              total_hours: segment.hours,
              holding,
              department_operator: role,
              project_type: projectType,
              project_name: projectName,
              module: module || null,
              bu,
              department,
              action_name: actionName,
              action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
              description: description ? `${segmentPrefix} ${description}` : `${segment.is_ot ? 'OT' : 'Normal'} portion`,
              channel: log.channel || 'Web App',
              is_ot: segment.is_ot,
              is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              workspace_id: workspaceId
            });
          }
        } else {
          const segment = preview.segments[0] || {
            work_date: date,
            hours: preview.duration,
            start_time: startTime,
            end_time: endTime,
            is_ot: isExplicitOt || isHolidayDate
          };
          updatePayload = {
            work_date: segment.work_date,
            start_time: segment.start_time + ':00',
            end_time: segment.end_time + ':00',
            break_time: isBreak,
            total_hours: segment.hours,
            holding,
            department_operator: role,
            project_type: projectType,
            project_name: projectName,
            module: module || null,
            bu,
            department,
            action_name: actionName,
            action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
            description,
            is_ot: segment.is_ot,
            is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
            image_urls: attachedImages,
            workspace_id: workspaceId
          };
        }

        const pendingSync = log.id ? {
          action: 'update',
          logId: log.id,
          updatePayload,
          inserts
        } : {
          action: 'insert',
          inserts: preview.segments.length > 1
            ? [{ ...updatePayload, user_id: log.user_id, channel: 'Web App' }, ...inserts]
            : [{ ...updatePayload, user_id: log.user_id, channel: 'Web App' }]
        };

        localStorage.setItem('gcal_pending_sync', JSON.stringify(pendingSync));
        localStorage.setItem('gcal_pending_origin', window.location.pathname + window.location.search);

        setTimeout(() => {
          window.location.href = googleCalendar.getAuthUrl();
        }, 1000);

        setIsSubmitting(false);
        onClose();
        return;
      }
    } catch (gcalErr) {
      console.warn('[GCal] Session check failed, proceeding without redirect:', gcalErr);
    }

    try {
      if (preview.segments.length > 1) {
        // We need to SPLIT this entry!
        const segment0 = preview.segments[0];
        const segment0Prefix = segment0.is_ot ? '[OT]' : '[Normal]';

        if (log.id) {
          // 1. Update the first segment onto the current entry
          const { error: errorNormal } = await supabase
            .from('col_worklog')
            .update({
              work_date: segment0.work_date,
              start_time: segment0.start_time + ':00',
              end_time: segment0.end_time + ':00',
              break_time: !segment0.is_ot ? isBreak : false,
              total_hours: segment0.hours,
              holding,
              department_operator: role,
              project_type: projectType,
              project_name: projectName,
              module: module || null,
              bu,
              department,
              action_name: actionName,
              action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
              description: description ? `${segment0Prefix} ${description}` : `${segment0.is_ot ? 'OT' : 'Normal'} portion`,
              is_ot: segment0.is_ot,
              is_implied_ot: segment0.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              workspace_id: workspaceId
            })
            .eq('id', log.id)
            .eq('workspace_id', workspaceId);

          if (errorNormal) throw errorNormal;
          
          // Sync first updated segment
          syncWorklogToGCal(log.id, 'update')
            .then(() => showToast('✅ Synced to Google Calendar', 'success'))
            .catch((syncErr: any) => {
              showToast('Google Calendar sync failed: ' + syncErr.message, 'error');
            });
        } else {
          // 1. Insert the first segment as a new entry
          const { data: dataNew0, error: errorNew0 } = await supabase
            .from('col_worklog')
            .insert({
              user_id: log.user_id,
              work_date: segment0.work_date,
              start_time: segment0.start_time + ':00',
              end_time: segment0.end_time + ':00',
              break_time: !segment0.is_ot ? isBreak : false,
              total_hours: segment0.hours,
              holding,
              department_operator: role,
              project_type: projectType,
              project_name: projectName,
              module: module || null,
              bu,
              department,
              action_name: actionName,
              action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
              description: description ? `${segment0Prefix} ${description}` : `${segment0.is_ot ? 'OT' : 'Normal'} portion`,
              channel: 'Web App',
              is_ot: segment0.is_ot,
              is_implied_ot: segment0.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              workspace_id: workspaceId
            })
            .select('id')
            .maybeSingle();

          if (errorNew0) throw errorNew0;
          if (dataNew0) {
            syncWorklogToGCal(dataNew0.id, 'insert')
              .then(() => showToast('✅ Synced to Google Calendar', 'success'))
              .catch((syncErr: any) => {
                showToast('Google Calendar sync failed: ' + syncErr.message, 'error');
              });
          }
        }

        // 2. Insert remaining segments as new entries
        for (let i = 1; i < preview.segments.length; i++) {
          const segment = preview.segments[i];
          const segmentPrefix = segment.is_ot ? '[OT]' : '[Normal]';

          const { data: dataNew, error: errorNew } = await supabase.from('col_worklog').insert({
            user_id: log.user_id,
            work_date: segment.work_date,
            start_time: segment.start_time + ':00',
            end_time: segment.end_time + ':00',
            break_time: !segment.is_ot ? isBreak : false,
            total_hours: segment.hours,
            holding,
            department_operator: role,
            project_type: projectType,
            project_name: projectName,
            module: module || null,
            bu,
            department,
            action_name: actionName,
            action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
            description: description ? `${segmentPrefix} ${description}` : `${segment.is_ot ? 'OT' : 'Normal'} portion`,
            channel: log.channel || 'Web App',
            is_ot: segment.is_ot,
            is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
            image_urls: attachedImages,
            workspace_id: workspaceId
          }).select('id').maybeSingle();

          if (errorNew) throw errorNew;
          if (dataNew) {
            syncWorklogToGCal(dataNew.id, 'insert')
              .then(() => showToast('✅ Synced to Google Calendar', 'success'))
              .catch((syncErr: any) => {
                showToast('Google Calendar sync failed: ' + syncErr.message, 'error');
              });
          }
        }
      } else {
        // Standard single entry update
        const segment = preview.segments[0] || {
          work_date: date,
          hours: preview.duration,
          start_time: startTime,
          end_time: endTime,
          is_ot: isExplicitOt || isHolidayDate
        };

        if (log.id) {
          const { error } = await supabase
            .from('col_worklog')
            .update({
              work_date: segment.work_date,
              start_time: segment.start_time + ':00',
              end_time: segment.end_time + ':00',
              break_time: isBreak,
              total_hours: segment.hours,
              holding,
              department_operator: role,
              project_type: projectType,
              project_name: projectName,
              module: module || null,
              bu,
              department,
              action_name: actionName,
              action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
              description,
              is_ot: segment.is_ot,
              is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              workspace_id: workspaceId
            })
            .eq('id', log.id)
            .eq('workspace_id', workspaceId);

          if (error) throw error;
          
          // Sync updated log
          syncWorklogToGCal(log.id, 'update')
            .then(() => showToast('✅ Synced to Google Calendar', 'success'))
            .catch((syncErr: any) => {
              showToast('Google Calendar sync failed: ' + syncErr.message, 'error');
            });
        } else {
          // Standard single entry insert
          const { data: dataNew, error } = await supabase
            .from('col_worklog')
            .insert({
              user_id: log.user_id,
              work_date: segment.work_date,
              start_time: segment.start_time + ':00',
              end_time: segment.end_time + ':00',
              break_time: isBreak,
              total_hours: segment.hours,
              holding,
              department_operator: role,
              project_type: projectType,
              project_name: projectName,
              module: module || null,
              bu,
              department,
              action_name: actionName,
              action_channel: selectedActionChannels.length > 0 ? selectedActionChannels.join(', ') : null,
              description,
              is_ot: segment.is_ot,
              is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              channel: 'Web App',
              workspace_id: workspaceId
            })
            .select('id')
            .maybeSingle();

          if (error) throw error;
          if (dataNew) {
            syncWorklogToGCal(dataNew.id, 'insert')
              .then(() => showToast('✅ Synced to Google Calendar', 'success'))
              .catch((syncErr: any) => {
                showToast('Google Calendar sync failed: ' + syncErr.message, 'error');
              });
          }
        }
      }

      showToast(log.id ? 'Worklog updated successfully!' : 'Worklog created successfully!', 'success');
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('Error saving updates: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-theme-surface-modal border border-theme-border dark:border-theme-border/80 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-theme-border dark:border-theme-border/50 flex justify-between items-center bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 shrink-0">
          <div>
            <h2 className="text-lg font-black text-theme-text tracking-tight flex items-center gap-2">
              <Zap className="text-indigo-400" size={20} />
              <span>{log.id ? "แก้ไขใบงานบันทึกการทำงาน" : "สร้างใบงานบันทึกการทำงาน"}</span>
            </h2>
            <p className="text-xs text-theme-text-secondary mt-0.5">
              {log.id ? `แก้ไขรายละเอียดใบงานรหัส ${log.id.slice(0, 8)}...` : "กรอกข้อมูลเพื่อสร้างใบงานบันทึกการทำงานใหม่"}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-theme-text-secondary hover:text-theme-text bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-theme-text-secondary">
          
          {/* Section 1: Time range */}
          <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border dark:border-theme-border/40 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-2 mb-1">
              <Clock size={14} className="text-indigo-400" />
              <span>ข้อมูลวันและเวลาปฏิบัติงาน</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">วันที่ทำงาน</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-text-muted">
                    <CalendarIcon size={16} />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 pl-10 pr-3 text-xs text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">เวลาเริ่มงาน</label>
                <TimeSelectInput
                  value={startTime}
                  onChange={val => { setStartTime(val); }}
                  onBlur={val => {
                    const formatted = validateAndFormatTime(val, lastValidStartTime.current);
                    setStartTime(formatted);
                    lastValidStartTime.current = formatted;
                  }}
                  options={timeOptions}
                  placeholder="HH:MM"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">เวลาเลิกงาน</label>
                <TimeSelectInput
                  value={endTime}
                  onChange={val => { setEndTime(val); }}
                  onBlur={val => {
                    const formatted = validateAndFormatTime(val, lastValidEndTime.current);
                    setEndTime(formatted);
                    lastValidEndTime.current = formatted;
                  }}
                  options={timeOptions}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {/* Quick Adjust Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-theme-text-muted mr-1 select-none">ปรับเวลา (End Time):</span>
              {[-30, -10, -5, 5, 10, 15, 30, 60].map((mins) => {
                const label = mins > 0 
                  ? `+${mins >= 60 ? `${mins / 60}h` : `${mins}m`}` 
                  : `${mins === -60 ? '-1h' : `${mins}m`}`;
                return (
                  <button
                    key={`edit-adj-${mins}`}
                    type="button"
                    onClick={() => setEndTime(prev => addMinutesToTime(prev, mins))}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-theme-border/60 hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 text-theme-text-secondary hover:text-indigo-400 transition-all cursor-pointer active:scale-95"
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Overlap & duration summary alerts */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-theme-border dark:border-theme-border">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBreak}
                    onChange={(e) => setIsBreak(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-theme-text-secondary font-semibold">หักชั่วโมงพัก 1 ชม. (กรณีงาน &gt; 4 ชม.)</span>
                </label>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                {isHolidayDate && (
                  <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-wider">
                    🎉 {holidayName || 'Holiday / Weekend'}
                  </span>
                )}
                <div className="text-right">
                  <span className="text-theme-text-secondary">สรุปชั่วโมงงาน: </span>
                  <span className="text-indigo-400 font-black font-mono text-sm">{preview.duration.toFixed(1)} ชม.</span>
                </div>
              </div>
            </div>

            {/* Warn Alert block */}
            {preview.isOverlap && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs animate-pulse">
                <AlertTriangle size={18} className="shrink-0" />
                <span>มีชั่วโมงทำงานคาบเกี่ยวกับรายการเดิมในระบบ: <strong>{preview.overlappingEvent}</strong></span>
              </div>
            )}
            
            {preview.otHours > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-400 text-xs">
                <Zap size={18} className="shrink-0 animate-bounce" />
                <span>
                  จะคำนวณเข้าสู่ระบบเป็น <strong>Normal {preview.normalHours.toFixed(1)}h</strong> และ <strong>OT {preview.otHours.toFixed(1)}h</strong> ({isHolidayDate ? 'วันหยุดปฏิบัติงาน' : 'ชั่วโมงส่วนที่เกิน 8h ในหนึ่งวัน'})
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Cascading Select fields */}
          <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border dark:border-theme-border/40 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-1 flex items-center gap-2">
              <Zap size={14} className="text-indigo-400" />
              <span>ข้อมูลโครงการและการวิเคราะห์ (Cascading Dropdowns)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">1. Holding BU</label>
                <select
                  value={holding}
                  onChange={(e) => handleHoldingChange(e.target.value)}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                >
                  <option value="">-- เลือก Holding --</option>
                  {availableHoldings.map((h) => (
                    <option key={`h-${h}`} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">2. Role Operator</label>
                <select
                  value={role}
                  disabled={!holding}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 transition-all"
                >
                  <option value="">-- เลือก Role --</option>
                  {availableRoles.map((r) => (
                    <option key={`r-${r}`} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">3. Project Type</label>
                <select
                  value={projectType}
                  disabled={!role}
                  onChange={(e) => handleProjectTypeChange(e.target.value)}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 transition-all"
                >
                  <option value="">-- เลือกประเภทงาน --</option>
                  {availableProjectTypes.map((t) => (
                    <option key={`t-${t}`} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">4. Project Name</label>
                <SearchableCombobox
                  value={projectName}
                  onChange={handleProjectNameChange}
                  options={availableProjects}
                  disabled={!projectType}
                  placeholder="Search project..."
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">5. Module (ถ้ามี)</label>
                <select
                  value={module}
                  disabled={!projectName || availableModules.length === 0}
                  onChange={(e) => setModule(e.target.value)}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 transition-all"
                >
                  <option value="">-- ไม่มีโมดูล / ทั้งโครงการ --</option>
                  {availableModules.map((m) => (
                    <option key={`m-${m}`} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">6. Action Name</label>
                <SearchableCombobox
                  value={actionName}
                  onChange={setActionName}
                  options={availableActions}
                  disabled={!projectType}
                  placeholder="Search action..."
                />
              </div>
            </div>

            {/* Business Unit & Department — auto-derived (with module) or selectable (no module or multi-option module) */}
            {projectName && (() => {
              const showDropdowns = noModuleMode || (
                module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1)
              );
              
              if (showDropdowns) {
                const buOpts = noModuleMode ? availableBUs : availableBUsForModule;
                const deptOpts = noModuleMode ? availableDepts : availableDeptsForModule;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">Business Unit <span className="text-rose-400">*</span></label>
                      <select
                        value={bu}
                        onChange={e => { setBu(e.target.value); setDepartment(''); }}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                      >
                        <option value="">-- เลือก Business Unit --</option>
                        {buOpts.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1.5 ml-1">Target Department <span className="text-rose-400">*</span></label>
                      <select
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        disabled={!bu}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 transition-all"
                      >
                        <option value="">-- เลือก Target Department --</option>
                        {deptOpts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-xl border border-theme-border dark:border-theme-border/50 text-[11px] font-semibold text-theme-text-secondary">
                    <div>7. Business Unit: <span className="text-theme-text font-mono">{bu || '-'}</span></div>
                    <div>8. Target Department: <span className="text-theme-text font-mono">{department || '-'}</span></div>
                  </div>
                );
              }
            })()}

            {/* Optional Action Channels as Clickable Tag Chips */}
            <div className="space-y-2 mt-4 pt-2 border-t border-theme-border dark:border-theme-border/30">
              <label className="block text-[10px] uppercase font-bold text-theme-text-muted ml-1">ช่องทางการสื่อสาร (Action Channels - Optional)</label>
              <div className="flex flex-wrap gap-2">
                {['Meeting', 'Discuss via phone', 'On site', 'Leave'].map((channelOption) => {
                  const isSelected = selectedActionChannels.includes(channelOption);
                  return (
                    <button
                      key={channelOption}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedActionChannels(selectedActionChannels.filter(c => c !== channelOption));
                        } else {
                          setSelectedActionChannels([...selectedActionChannels, channelOption]);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 border flex items-center gap-1.5 active:scale-95 shadow-sm",
                        isSelected
                          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 border-indigo-400/30 text-theme-text hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/10 animate-in zoom-in-95 duration-100"
                          : "bg-theme-surface-secondary dark:bg-theme-surface-secondary/70 border-theme-border dark:border-theme-border/80 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-secondary"
                      )}
                    >
                      {channelOption === 'Meeting' && <span className="text-xs">👥</span>}
                      {channelOption === 'Discuss via phone' && <span className="text-xs">📞</span>}
                      {channelOption === 'On site' && <span className="text-xs">📍</span>}
                      {channelOption === 'Leave' && <span className="text-xs">🌴</span>}
                      <span>{channelOption}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Description input */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1 ml-1">รายละเอียดงาน (Work Description)</label>
            
            {/* Worklog templates wrapped row */}
            <div className="flex flex-wrap gap-2 mb-2">
              {dbTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleInjectTemplate(tpl.template_content)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{tpl.icon || '📝'}</span>
                  <span>{tpl.template_name}</span>
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="กรอกรายละเอียดงานที่ปฏิบัติ..."
              className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border dark:border-theme-border rounded-2xl py-3 px-4 text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all leading-relaxed"
            />
          </div>

          {/* Section 4: Image Attachments */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1 ml-1">รูปภาพประกอบใบงาน (สูงสุด 2 รูป / Max 2 Images)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {attachedImages.map((url, idx) => (
                <div key={idx} className="relative group aspect-video rounded-xl overflow-hidden border border-theme-border bg-theme-surface-secondary shadow-inner">
                  <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all shadow-md active:scale-90"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              {attachedImages.length < 2 && (
                <label className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed border-theme-border rounded-xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all aspect-video",
                  uploadingImages && "opacity-50 pointer-events-none"
                )}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleImageChange} 
                    className="sr-only" 
                  />
                  {uploadingImages ? (
                    <>
                      <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-2" />
                      <span className="text-[10px] text-theme-text-secondary font-bold">กำลังอัปโหลด...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="text-theme-text-secondary mb-1.5" />
                      <span className="text-[10px] text-theme-text-secondary font-bold font-sans">คลิกเพื่อแนบรูปภาพ</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-theme-border dark:border-theme-border/50 bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-theme-border dark:border-theme-border text-theme-text-secondary text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            ยกเลิก
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSubmitting || preview.duration <= 0 || !holding || !role || !projectType || !projectName || !actionName}
            className={cn(
              "px-5 py-2.5 text-theme-text text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-md",
              "bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              log.id ? 'บันทึกการแก้ไข' : 'สร้างใบงาน'
            )}
          </button>
        </div>

      </div>

      {/* Premium Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-theme-surface-modal border border-theme-border dark:border-theme-border/80 rounded-3xl p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Zap size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-theme-text tracking-tight">
                  {log.id ? "ยืนยันการบันทึกการแก้ไข?" : "ยืนยันการสร้างใบงาน?"}
                </h3>
                <p className="text-[11px] text-theme-text-secondary mt-0.5 font-medium">
                  {log.id ? "โปรดยืนยันการเปลี่ยนแปลงข้อมูลใบงานนี้" : "โปรดยืนยันข้อมูลเพื่อสร้างใบงานบันทึกการทำงานใหม่"}
                </p>
              </div>
            </div>

            {/* Time Split Summary */}
            <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border dark:border-theme-border/80 p-4 rounded-2xl space-y-2">
              <span className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">สรุปการบันทึกชั่วโมงปฏิบัติงาน</span>
              
              {preview.segments.map((seg, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs border-b border-theme-border dark:border-theme-border/40 pb-2 last:border-none last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-extrabold border uppercase tracking-wider",
                      seg.is_ot
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                        : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                    )}>
                      {seg.is_ot ? 'OT Portion' : 'Normal Portion'}
                    </span>
                    <span className="text-theme-text-secondary font-mono text-[10px]">{seg.start_time.slice(0, 5)} - {seg.end_time.slice(0, 5)}</span>
                  </div>
                  <span className="font-extrabold text-theme-text font-mono">{seg.hours.toFixed(1)} ชั่วโมง</span>
                </div>
              ))}

              <div className="flex justify-between items-center text-xs pt-2 border-t border-theme-border dark:border-theme-border/30">
                <span className="font-bold text-theme-text-secondary">ชั่วโมงรวมทั้งหมด (Total):</span>
                <span className="font-black text-indigo-400 font-mono text-sm">{preview.duration.toFixed(1)} ชั่วโมง</span>
              </div>
            </div>

            {preview.segments.length > 1 && (
              <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-[10px] text-amber-300 leading-relaxed font-medium">
                ⚠️ **ระบบทำการแบ่งใบงาน (Automatic OT Split):** เนื่องจากเวลาการทำงานคาบเกี่ยวระหว่างเวลาทำงานปกติและล่วงเวลา (OT) ใบงานจะถูกบันทึกแยกออกเป็น **{preview.segments.length} รายการ** โดยอัตโนมัติตามนโยบายบริษัท
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-theme-border dark:border-theme-border/60 text-theme-text-secondary text-[11px] font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-theme-text text-[11px] font-bold rounded-xl transition-all active:scale-[0.98] shadow-md shadow-indigo-500/10 cursor-pointer"
              >
                ยืนยันและบันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Searchable Combobox (local to EditWorklogModal) ──────────────────────────
function SearchableCombobox({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (v: string) => {
    onChange(v);
    setIsOpen(false);
    setQuery('');
  };

  const displayValue = isOpen ? query : value;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => { setQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
        onFocus={() => { if (!disabled) { setIsOpen(true); setQuery(''); } }}
        disabled={disabled}
        placeholder={value || placeholder}
        autoComplete="off"
        className={`w-full border rounded-xl py-2.5 px-3 pr-9 text-xs focus:outline-none focus:ring-2 transition-all ${
          disabled
            ? 'bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border-theme-border dark:border-theme-border/50 text-theme-text-muted cursor-not-allowed opacity-40'
            : 'bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border-theme-border dark:border-theme-border text-theme-text focus:ring-indigo-500 focus:border-transparent cursor-text'
        }`}
      />
      <ChevronDown
        size={14}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${
          disabled ? 'text-slate-600' : 'text-theme-text-secondary'
        } ${isOpen ? 'rotate-180' : ''}`}
      />
      {isOpen && !disabled && (
        <div className="absolute z-[60] mt-1 w-full bg-theme-surface-modal border border-theme-border dark:border-theme-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {query && (
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-theme-text-muted text-center">🔍 No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                  className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 transition-colors ${
                    opt === value
                      ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                      : 'text-theme-text-secondary hover:bg-slate-700/60 hover:text-theme-text'
                  }`}
                >
                  <span className={`flex items-center w-3.5 h-3.5 shrink-0 ${opt === value ? 'opacity-100' : 'opacity-0'}`}>
                    <Check size={12} className="text-indigo-400" />
                  </span>
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time Dropdown Select with Typing Allowed (Hybrid) ─────────────────────
interface TimeSelectInputProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
  onBlur?: (val: string) => void;
}

function TimeSelectInput({
  value,
  onChange,
  options,
  placeholder = 'HH:MM',
  className,
  onBlur,
}: TimeSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => onBlur && onBlur(value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border dark:border-theme-border rounded-xl py-2.5 px-3 text-xs text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-text",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-secondary hover:text-theme-text focus:outline-none transition-colors"
      >
        <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-48 overflow-y-auto w-full bg-theme-surface-modal border border-theme-border dark:border-theme-border rounded-xl shadow-2xl overflow-x-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                  if (onBlur) onBlur(opt.value);
                }}
                className={cn(
                  "w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2",
                  opt.value === value
                    ? "bg-indigo-500/20 text-indigo-300 font-semibold"
                    : "text-theme-text-secondary hover:bg-slate-700/60 hover:text-theme-text"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

