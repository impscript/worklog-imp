import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Check, AlertTriangle, Calendar as CalendarIcon, Zap, Clock, Eye, Sparkles, Share2, Copy, Upload, X, Cpu, Shield } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn, isChatchawanUser } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';
import ImportICSModal from '../components/modals/ImportICSModal';
import { syncWorklogToGCal, googleCalendar } from '../lib/google-calendar';
import { compressImage } from '../lib/image-compressor';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Generate Time Options in 15-minute intervals (00:00 to 24:00 - 24 Hours)
const timeOptions = Array.from({ length: 97 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const min = (i % 4) * 15;
  const val24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  return { label: val24, value: val24 };
});

const DEFAULT_WORK_START_TIME = '08:00';
const DEFAULT_WORK_END_TIME = '17:00';
const NEXT_WORKLOG_GAP_MINUTES = 5;

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

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = parts.length === 3 ? Number(parts[2]) : 0;
  if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || h > 24 || m < 0 || m > 59 || s < 0 || s >= 60) return null;
  if (h === 24 && (m > 0 || s > 0)) return null;
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const boundedMinutes = Math.max(0, Math.min(totalMinutes, 24 * 60));
  const hours = Math.floor(boundedMinutes / 60);
  const minutes = boundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getNextDefaultTimeRange(entries: Array<{ end_time?: string | null }>): { startTime: string; endTime: string } {
  const latestEndMinutes = entries.reduce((latest, entry) => {
    const endMinutes = parseTimeToMinutes(entry.end_time || '');
    return endMinutes === null ? latest : Math.max(latest, endMinutes);
  }, -1);

  if (latestEndMinutes < 0) {
    return { startTime: DEFAULT_WORK_START_TIME, endTime: DEFAULT_WORK_END_TIME };
  }

  // Keep the suggested entry inside the selected work date at the end-of-day boundary.
  const nextStartMinutes = Math.min(latestEndMinutes + NEXT_WORKLOG_GAP_MINUTES, (24 * 60) - 1);
  const defaultEndMinutes = parseTimeToMinutes(DEFAULT_WORK_END_TIME) || 0;
  const nextEndMinutes = nextStartMinutes < defaultEndMinutes
    ? defaultEndMinutes
    : Math.min(nextStartMinutes + 60, 24 * 60);

  return {
    startTime: formatMinutesToTime(nextStartMinutes),
    endTime: formatMinutesToTime(nextEndMinutes)
  };
}

function calculateSegmentHours(startTime: string, endTime: string, deductLunch = false): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return 0;

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

  const res = Math.round((totalMinutes / 60) * 100) / 100;
  return isNaN(res) ? 0 : res;
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

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return [];

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

function formatTimeRange(startMins: number, endMins: number) {
  const format = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  return { startTime: format(startMins), endTime: format(endMins) };
}

function findSmartTimeSlot(hoursNeeded: number, existingEntries: any[]): { startTime: string, endTime: string } | null {
  const neededMins = Math.round(hoursNeeded * 60);
  const workingBlocks = [
    { start: 480, end: 720 }, // 08:00 - 12:00
    { start: 780, end: 1020 } // 13:00 - 17:00
  ];
  const bookedSlots = existingEntries.map(entry => {
    const [sH, sM] = entry.start_time.split(':').map(Number);
    const [eH, eM] = entry.end_time.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
  }).sort((a, b) => a.start - b.start);

  for (const block of workingBlocks) {
    let currentPointer = block.start;
    for (const booked of bookedSlots) {
      if (booked.end <= currentPointer) continue;
      if (booked.start >= block.end) break;
      if (booked.start > currentPointer) {
        const gapMins = booked.start - currentPointer;
        if (gapMins >= neededMins) {
          return formatTimeRange(currentPointer, currentPointer + neededMins);
        }
      }
      currentPointer = Math.max(currentPointer, booked.end);
    }
    if (block.end - currentPointer >= neededMins) {
      return formatTimeRange(currentPointer, currentPointer + neededMins);
    }
  }
  return null;
}

export default function LogWorkPage() {
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [session] = useState(() => JSON.parse(localStorage.getItem('worklog_session') || '{}'));

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [viewingLog, setViewingLog] = useState<any | null>(null);
  const [userDisplayLabels, setUserDisplayLabels] = useState<Record<string, string>>({});

  // Dynamic template & image attachment states
  const [dbTemplates, setDbTemplates] = useState<any[]>([
    { id: '1', template_name: 'เทมเพลตประชุม', template_content: '[วัตถุประสงค์]: \n[บทบาทของคุณ]: \n[ข้อสรุป]: \n[Next Steps]: ', icon: '📝' },
    { id: '2', template_name: 'เทมเพลตงานทั่วไป', template_content: '[งานที่ทำ]: \n[ผลลัพธ์ที่ได้]: \n[KPI/เป้าหมาย]: \n[Next Steps]: ', icon: '⚙️' },
    { id: '3', template_name: 'เทมเพลต PARIL (ทดลอง)', template_content: '[Plan]: \n[Action]: \n[Result]: \n[Impact]: \n[Lesson Learned]: ', icon: '🎯' }
  ]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [createdShareLinkId, setCreatedShareLinkId] = useState<string | null>(null);

  // Google Calendar .ics Import states
  const [rawICSContent, setRawICSContent] = useState<string>('');
  const [isICSModalOpen, setIsICSModalOpen] = useState<boolean>(false);
  const [isICSCollapseOpen, setIsICSCollapseOpen] = useState<boolean>(false);
  
  // Form State
  const [date, setDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [startTime, setStartTime] = useState(DEFAULT_WORK_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_WORK_END_TIME);
  const lastValidStartTime = useRef(DEFAULT_WORK_START_TIME);
  const lastValidEndTime = useRef(DEFAULT_WORK_END_TIME);
  const [isBreak, setIsBreak] = useState(true);
  const [description, setDescription] = useState('');

  // Auto-draft saving to LocalStorage to protect field technician worklog descriptions
  useEffect(() => {
    const savedDraft = localStorage.getItem('worklog_draft_desc');
    if (savedDraft) {
      setDescription(savedDraft);
    }
  }, []);

  useEffect(() => {
    if (description) {
      localStorage.setItem('worklog_draft_desc', description);
    } else {
      localStorage.removeItem('worklog_draft_desc');
    }
  }, [description]);
  const [isExplicitOt, setIsExplicitOt] = useState(false);
  const [isTimeCustomized, setIsTimeCustomized] = useState(false);
  const isTimeCustomizedRef = useRef(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  const getWorklogGuide = () => {
    const isMeeting = /meeting|discuss|sync|ประชุม|คุย/i.test(actionName || '');
    if (isMeeting) {
      return {
        placeholder: "เช่น:\n[วัตถุประสงค์]: ประชุมอัปเดตความคืบหน้าโปรเจกต์ X และปัญหาคอขวดของทีม\n[บทบาทของคุณ]: เป็นผู้ดำเนินการประชุม (Lead) / เข้าร่วมและเสนอแนะ\n[ข้อสรุป]: ตัดสินใจเลื่อนกำหนดการ Deploy เป็นวันที่ 30 และเปลี่ยนทีมดูแลระบบคลาวด์\n[Next Steps]: ส่งอีเมลสรุปรายงานให้ผู้รับผิดชอบ และนัดหมายตรวจสอบระบบอีกครั้งในวันจันทร์หน้า",
        guide: "💡 สำหรับการประชุม: ควรสรุป วัตถุประสงค์ | บทบาทของคุณ (เช่น Lead/Participant) | ข้อสรุป | และ Action Items ถัดไป",
        template: "[วัตถุประสงค์]: \n[บทบาทของคุณ]: \n[ข้อสรุป]: \n[Next Steps]: "
      };
    } else {
      return {
        placeholder: "เช่น:\n[งานที่ทำ]: พัฒนาโมดูลชำระเงินและเชื่อมต่อกับ API ของธนาคาร\n[ผลลัพธ์ที่ได้]: ทำเสร็จสมบูรณ์ 100% ตามแผน สามารถกดชำระเงินและออกใบเสร็จได้สำเร็จ\n[KPI/เป้าหมาย]: ลดระยะเวลารอทำรายการของลูกค้าลง 30% สอดคล้องกับ KPI ปรับปรุง UX\n[Next Steps]: นัดทีม QA ทดสอบการจำลองชำระเงินในสภาพแวดล้อมจำลอง (Staging) วันพรุ่งนี้",
        guide: "💡 สำหรับงานทั่วไป: ควรสรุป งานที่ทำ | ผลลัพธ์ที่ได้ | KPI/เป้าหมายที่เกี่ยวข้อง | และขั้นตอนถัดไป",
        template: "[งานที่ทำ]: \n[ผลลัพธ์ที่ได้]: \n[KPI/เป้าหมาย]: \n[Next Steps]: "
      };
    }
  };

  const handleICSFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRawICSContent(text);
        setIsICSModalOpen(true);
      }
    };
    reader.onerror = () => {
      showToast('ไม่สามารถอ่านไฟล์ได้ / Failed to read file', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
        
        // 1. Compress image client-side using canvas compressor utility
        const compressedBlob = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        
        // 2. Prepare FormData
        const formData = new FormData();
        formData.append('file', compressedFile);

        // 3. Upload to Cloudflare R2 proxy endpoint
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

  // Time Mode State
  const [timeMode, setTimeMode] = useState<'range' | 'duration'>('range');
  const [durationHours, setDurationHours] = useState<number>(2);

  // Cascading State
  const [selectedHolding, setSelectedHolding] = useState<string>('');
  const [selectedRoleOperator, setSelectedRoleOperator] = useState<string>('');
  const [holding, setHolding] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [projectType, setProjectType] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('');

   const [module, setModule] = useState<string>('');
  const [actionName, setActionName] = useState<string>('');
  const [selectedActionChannels, setSelectedActionChannels] = useState<string[]>([]);

  const [bu, setBu] = useState<string>('');
  const [department, setDepartment] = useState<string>('');

  const [timeAssessment, setTimeAssessment] = useState<{
    standardTimeMin: number | null;
    standardTimeMax: number | null;
    timeAssessment: 'มาก' | 'น้อย' | 'ดี' | null;
    timeAssessmentReason: string | null;
  } | null>(null);

  // Reset time assessment on input change
  useEffect(() => {
    setTimeAssessment(null);
  }, [actionName, durationHours, startTime, endTime, timeMode]);

  // Supabase Data State
  const [mapUserRole, setMapUserRole] = useState<any[]>([]);
  const [mapProjectStructure, setMapProjectStructure] = useState<any[]>([]);
  const [masterActions, setMasterActions] = useState<any[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  // Simulated User States
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [resolvedUserId, setResolvedUserId] = useState<string>('');
  const [isCurrentUserChatchawan, setIsCurrentUserChatchawan] = useState<boolean>(false);

  // Daily context state
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  const [isHolidayDate, setIsHolidayDate] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const resetTimeDefaults = () => {
    isTimeCustomizedRef.current = false;
    setIsTimeCustomized(false);
    setStartTime(DEFAULT_WORK_START_TIME);
    setEndTime(DEFAULT_WORK_END_TIME);
    lastValidStartTime.current = DEFAULT_WORK_START_TIME;
    lastValidEndTime.current = DEFAULT_WORK_END_TIME;
  };

  const markTimeCustomized = () => {
    isTimeCustomizedRef.current = true;
    setIsTimeCustomized(true);
  };

  // Synchronize URL parameter when search changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam !== date) {
      isTimeCustomizedRef.current = false;
      setDate(dateParam);
    }
  }, [date, location.search]);

  // Load unique user list and default selection
  useEffect(() => {
    async function loadUsersAndResolve() {
      try {
        // Calculate clean name for current logged-in user
        let currentCleanName = '';
        const rawSessionName = session.nickname || session.name?.split(' ')[0] || '';
        currentCleanName = rawSessionName.includes('_') ? rawSessionName.split('_')[0] : rawSessionName;

        if (session.id) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('nickname, full_name')
            .eq('id', session.id)
            .maybeSingle();
            
          if (dbUser) {
            const rawName = dbUser.nickname || dbUser.full_name?.split(' ')[0] || '';
            currentCleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
          }
        }
        
        let isThai = /[\u0e00-\u0e7f]/.test(currentCleanName);
        if (isThai) {
          const fallbackName = session.nickname || '';
          if (fallbackName && !/[\u0e00-\u0e7f]/.test(fallbackName)) {
            currentCleanName = fallbackName.includes('_') ? fallbackName.split('_')[0] : fallbackName;
          }
        }
        if (currentCleanName.includes('.')) {
          currentCleanName = currentCleanName.split('.')[0];
        }
        if (currentCleanName) {
          currentCleanName = currentCleanName.charAt(0).toUpperCase() + currentCleanName.slice(1);
        }
        
        if (!currentCleanName.trim()) {
          currentCleanName = 'Guest';
        }

        // If the logged-in user is Chatchawan, load everyone. Otherwise, only show ourselves.
        let uniqueNames: string[] = [];
        const isChatchawan = isChatchawanUser(session);
        setIsCurrentUserChatchawan(isChatchawan);
        
        const labelMap: Record<string, string> = {};
        if (isChatchawan) {
          let nameQuery = supabase.from('tb_map_user_role').select('name, user_id');
          const wsId = session?.activeWorkspaceId;
          if (wsId && wsId !== 'N/A') {
            nameQuery = nameQuery.eq('workspace_id', wsId) as any;
          }
          const { data } = await nameQuery;
          
          const nameToUserId: Record<string, string> = {};
          if (data) {
            uniqueNames = Array.from(new Set(data.map(d => d.name).filter(Boolean))) as string[];
            data.forEach(d => {
              if (d.name && d.user_id) {
                nameToUserId[d.name] = d.user_id;
              }
            });
          }

          // Fetch all user records from DB to translate uniqueNames to readable display labels
          const { data: dbUsers } = await supabase
            .from('users')
            .select('id, emp_id, full_name, nickname');
            
          if (dbUsers) {
            uniqueNames.forEach(name => {
              const matchedUserId = nameToUserId[name];
              const matchedUser = dbUsers.find(u => 
                (matchedUserId && u.id === matchedUserId) ||
                u.emp_id === name || 
                u.full_name?.toLowerCase() === name.toLowerCase() || 
                u.nickname?.toLowerCase() === name.toLowerCase()
              );
              if (matchedUser) {
                let cleanNick = matchedUser.nickname || '';
                if (cleanNick.includes('_')) {
                  cleanNick = cleanNick.split('_')[0];
                }
                if (cleanNick) {
                  cleanNick = cleanNick.charAt(0).toUpperCase() + cleanNick.slice(1);
                }
                labelMap[name] = matchedUser.full_name || cleanNick || name;
              } else {
                labelMap[name] = name;
              }
            });
          }
        } else {
          uniqueNames = [currentCleanName];
        }

        // Always make sure the logged-in user's name is in the list
        if (currentCleanName && !uniqueNames.some(name => name.toLowerCase() === currentCleanName.toLowerCase())) {
          uniqueNames.push(currentCleanName);
        }

        if (currentCleanName && !labelMap[currentCleanName]) {
          labelMap[currentCleanName] = currentCleanName;
        }

        setUserDisplayLabels(labelMap);
        
        uniqueNames.sort((a, b) => {
          const labelA = (labelMap[a] || a).toLowerCase();
          const labelB = (labelMap[b] || b).toLowerCase();
          return labelA.localeCompare(labelB, 'th');
        });

        setAllUsers(uniqueNames);
        
        if (!selectedUser) {
          setSelectedUser(currentCleanName);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    }
    loadUsersAndResolve();
  }, [session]);

  // Resolve user_id whenever selectedUser changes (supports emp_id, full_name, or nickname)
  useEffect(() => {
    async function resolveUser() {
      if (!selectedUser) return;
      try {
        let query = supabase.from('users').select('id');
        if (/^\d+$/.test(selectedUser)) {
          // If it's a numeric employee ID
          query = query.eq('emp_id', selectedUser);
        } else {
          // Else search full_name or nickname
          query = query.or(`full_name.ilike.%${selectedUser}%,nickname.ilike.%${selectedUser}%`);
        }

        const { data: userData } = await query.limit(1).maybeSingle();
        
        if (userData) {
          setResolvedUserId(userData.id);
        } else {
          setResolvedUserId(session.id || '');
        }
      } catch (err) {
        console.error('Error resolving user ID:', err);
        setResolvedUserId(session.id || '');
      }
    }
    resolveUser();
  }, [selectedUser, session]);

  // Fetch Data from Supabase
  useEffect(() => {
    async function loadData() {
      setIsLoadingMaster(true);
      try {
        // Fetch full user record from DB (emp_id, full_name, nickname)
        let dbUserRecord: { nickname: string; full_name: string; emp_id: string } | null = null;
        if (session.id) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('nickname, full_name, emp_id')
            .eq('id', session.id)
            .maybeSingle();
          if (dbUser) dbUserRecord = dbUser;
        }

        // Build a list of candidate name values to match in tb_map_user_role
        const candidateNames: string[] = [];
        if (dbUserRecord) {
          if (dbUserRecord.full_name) candidateNames.push(dbUserRecord.full_name.trim());
          if (dbUserRecord.emp_id) candidateNames.push(dbUserRecord.emp_id.trim());
          if (dbUserRecord.nickname) {
            const nn = dbUserRecord.nickname.includes('_')
              ? dbUserRecord.nickname.split('_')[0]
              : dbUserRecord.nickname;
            candidateNames.push(nn.trim());
            // Capitalize version
            if (nn) candidateNames.push(nn.charAt(0).toUpperCase() + nn.slice(1));
          }
        }
        // Fallback from session
        const rawSessionName = session.nickname || session.name?.split(' ')[0] || '';
        const sessionClean = rawSessionName.includes('_') ? rawSessionName.split('_')[0] : rawSessionName;
        if (sessionClean) candidateNames.push(sessionClean);

        // Deduplicate
        const uniqueCandidates = Array.from(new Set(candidateNames.filter(Boolean)));

        // Resolve cleanName for display (prefer English/alphanumeric)
        let cleanName = 'Chatchawan';
        if (dbUserRecord?.nickname && !/^[\d]+$/.test(dbUserRecord.nickname)) {
          const nn = dbUserRecord.nickname.includes('_') ? dbUserRecord.nickname.split('_')[0] : dbUserRecord.nickname;
          if (!/[\u0e00-\u0e7f]/.test(nn)) cleanName = nn.charAt(0).toUpperCase() + nn.slice(1);
          else cleanName = dbUserRecord.full_name || cleanName;
        } else if (dbUserRecord?.full_name) {
          cleanName = dbUserRecord.full_name;
        }
        if (!cleanName.trim()) cleanName = 'Chatchawan';

        const targetUser = selectedUser || cleanName;
        console.log('LogWorkPage loading mappings for targetUser:', targetUser, '| candidates:', uniqueCandidates);

        const workspaceId = session?.activeWorkspaceId;
        let useGlobal = true;
        if (workspaceId && workspaceId !== 'N/A') {
          const { data: wsData } = await supabase.from('workspaces').select('use_global_master').eq('id', workspaceId).maybeSingle();
          if (wsData) {
            useGlobal = wsData.use_global_master;
          }
        }

        // Build user role mapping query
        // After DB normalization, tb_map_user_role.name is now always emp_id (e.g. "688166")
        // Primary lookup: user_id FK (most reliable, covers all backfilled rows)
        // Fallback:       name = emp_id  (for old rows without user_id, or CRMC-style entries)
        let userQuery;
        const isSimulating = isChatchawanUser(session) && selectedUser && selectedUser !== cleanName;

        if (isSimulating) {
          // selectedUser is the 'name' value from tb_map_user_role — now emp_id format
          // Resolve UUID: try emp_id first, then full_name as backup
          let simUserId: string | null = null;

          const { data: byEmpId } = await supabase
            .from('users').select('id').eq('emp_id', selectedUser).limit(1).maybeSingle();
          if (byEmpId?.id) {
            simUserId = byEmpId.id;
          } else {
            // selectedUser might still be an old-format full_name (edge case)
            const { data: byFullName } = await supabase
              .from('users').select('id').eq('full_name', selectedUser).limit(1).maybeSingle();
            if (byFullName?.id) simUserId = byFullName.id;
          }

          if (simUserId) {
            userQuery = supabase.from('tb_map_user_role').select('*').eq('user_id', simUserId).eq('is_active', true);
          } else {
            // CRMC-style special name — query by exact name
            userQuery = supabase.from('tb_map_user_role').select('*').eq('name', selectedUser.trim()).eq('is_active', true);
          }
        } else if (session.id) {
          // Normal user — query by user_id FK (primary)
          // Fallback handled after query if empty (see below)
          userQuery = supabase.from('tb_map_user_role').select('*').eq('user_id', session.id).eq('is_active', true);
        } else {
          // No session id — fallback by emp_id or nickname
          const empId = dbUserRecord?.emp_id || '';
          userQuery = empId
            ? supabase.from('tb_map_user_role').select('*').eq('name', empId).eq('is_active', true)
            : supabase.from('tb_map_user_role').select('*').eq('name', 'CRMC').eq('is_active', true);
        }

        let projQuery = supabase.from('tb_map_project_structure').select('*').eq('is_active', true);
        let actQuery = supabase.from('tb_master_action').select('*').eq('is_active', true);
        let tplQuery = supabase.from('tb_master_worklog_templates').select('*').eq('is_active', true);

        if (workspaceId && workspaceId !== 'N/A') {
          if (useGlobal) {
            userQuery = userQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
            projQuery = projQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
            actQuery = actQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
          } else {
            userQuery = userQuery.eq('workspace_id', workspaceId);
            projQuery = projQuery.eq('workspace_id', workspaceId);
            actQuery = actQuery.eq('workspace_id', workspaceId);
          }
          tplQuery = tplQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        }

        const [resUser, resProj, resAct, resTpl] = await Promise.all([
          userQuery,
          projQuery,
          actQuery,
          tplQuery
        ]);

        if (resUser.data && resUser.data.length > 0) {
          console.log('✅ User role mapping found:', resUser.data.length, 'rows');
          setMapUserRole(resUser.data);
        } else if (!isSimulating && session.id && dbUserRecord?.emp_id) {
          // user_id query returned no rows — try name = emp_id fallback (old data before backfill)
          const empIdKey = dbUserRecord.emp_id;
          console.warn('user_id query returned 0 rows, trying emp_id fallback:', empIdKey);
          let empFallbackQuery = supabase.from('tb_map_user_role').select('*').eq('name', empIdKey).eq('is_active', true);
          if (workspaceId && workspaceId !== 'N/A') {
            empFallbackQuery = empFallbackQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`) as any;
          }
          const { data: empFallbackData } = await empFallbackQuery;
          if (empFallbackData && empFallbackData.length > 0) {
            console.log('✅ emp_id fallback found:', empFallbackData.length, 'rows');
            setMapUserRole(empFallbackData);
          }
        } else if (!resUser.data || resUser.data.length === 0) {
          const fallback = await supabase.from('tb_map_user_role').select('*').eq('name', '10005208').eq('is_active', true);
          if (fallback.data) setMapUserRole(fallback.data);
        }

        let projData = resProj.data || [];
        
        // Log any errors for debugging
        if (resProj.error) {
          console.warn('tb_project_registry error:', resProj.error.message, '| code:', resProj.error.code);
        }
        if (resUser.error) {
          console.warn('tb_map_user_role error:', resUser.error.message);
        }
        
        if (projData.length === 0) {
          console.warn('tb_project_registry returned 0 rows — trying scoped registry fallback');
          // Fallback: try project registry with workspace scope
          let registryFallbackQuery = supabase.from('tb_project_registry').select('*').not('status', 'in', '("inactive","retired")');
          if (workspaceId && workspaceId !== 'N/A') {
            registryFallbackQuery = registryFallbackQuery.eq('workspace_id', workspaceId) as any;
          }
          const { data: projNoWs, error: projNoWsErr } = await registryFallbackQuery;
          if (projNoWsErr) console.warn('tb_project_registry (fallback) error:', projNoWsErr.message);
          if (projNoWs && projNoWs.length > 0) {
            projData = projNoWs;
          } else {
            // Last resort: legacy table (scoped)
            console.warn('tb_project_registry empty — falling back to tb_map_project_structure');
            let legacyQuery = supabase.from('tb_map_project_structure').select('*').eq('is_active', true);
            if (workspaceId && workspaceId !== 'N/A') {
              legacyQuery = legacyQuery.eq('workspace_id', workspaceId) as any;
            }
            const { data: fallbackProjs, error: fallbackErr } = await legacyQuery;
            if (fallbackErr) console.warn('tb_map_project_structure error:', fallbackErr.message);
            if (fallbackProjs) projData = fallbackProjs;
          }
        }
        
        console.log(`Loaded ${projData.length} project rows`);
        setMapProjectStructure(projData);

        if (resAct.data) setMasterActions(resAct.data);
        if (resTpl.data && resTpl.data.length > 0) {
          const uniqueTpls = resTpl.data.reduce((acc: any[], current: any) => {
            const existingIndex = acc.findIndex(t => t.template_name === current.template_name);
            if (existingIndex === -1) {
              acc.push(current);
            } else if (current.workspace_id && !acc[existingIndex].workspace_id) {
              acc[existingIndex] = current;
            }
            return acc;
          }, []);
          setDbTemplates(uniqueTpls);
        }
      } catch (err) {
        console.error('loadData error:', err);
      } finally {
        setIsLoadingMaster(false);
      }
    }
    loadData();
  }, [session, selectedUser]);

  // Fetch daily entries and holiday status
  useEffect(() => {
    let active = true;
    async function loadDailyData() {
      let userId = resolvedUserId;
      if (selectedUser) {
        try {
          let query = supabase.from('users').select('id');
          if (/^\d+$/.test(selectedUser)) {
            query = query.eq('emp_id', selectedUser);
          } else {
            query = query.or(`full_name.ilike.%${selectedUser}%,nickname.ilike.%${selectedUser}%`);
          }
          const { data: userData } = await query.limit(1).maybeSingle();
          if (userData && active) {
            userId = userData.id;
          }
        } catch (err) {
          console.error('Error resolving user ID inline:', err);
        }
      }
      if (!userId) {
        userId = session.id || '';
      }
      if (!userId) return;

      // 1. Fetch existing entries
      const { data: logs } = await supabase
        .from('col_worklog')
        .select('*')
        .eq('user_id', userId)
        .eq('work_date', date);
      if (active && logs) {
        setExistingEntries(logs);
        if (!isTimeCustomizedRef.current) {
          const nextDefault = getNextDefaultTimeRange(logs);
          setIsTimeCustomized(false);
          setStartTime(nextDefault.startTime);
          setEndTime(nextDefault.endTime);
          lastValidStartTime.current = nextDefault.startTime;
          lastValidEndTime.current = nextDefault.endTime;
        }
      }

      // 2. Check if weekend or holiday
      const d = new Date(date);
      const day = d.getDay(); // 0 = Sunday, 6 = Saturday
      if (day === 0 || day === 6) {
        if (active) {
          setIsHolidayDate(true);
          setHolidayName(day === 0 ? 'วันอาทิตย์ (Weekend)' : 'วันเสาร์ (Weekend)');
        }
      } else {
        const { data: holiday } = await supabase
          .from('tb_master_holiday')
          .select('name')
          .eq('date', date)
          .maybeSingle();
        if (active) {
          if (holiday) {
            setIsHolidayDate(true);
            setHolidayName(holiday.name);
          } else {
            setIsHolidayDate(false);
            setHolidayName('');
          }
        }
      }
    }
    loadDailyData();
    return () => {
      active = false;
    };
  }, [date, session, refreshTrigger, resolvedUserId, selectedUser]);

  // Automatically check/force explicit OT flag if holiday is detected
  useEffect(() => {
    if (isHolidayDate) {
      setIsExplicitOt(true);
    } else {
      setIsExplicitOt(false);
    }
  }, [isHolidayDate]);

  const allowedProjects = useMemo(() => {
    return mapProjectStructure.filter(proj => 
      mapUserRole.some(ur => {
        // "ALL" or "All Holding" in user mapping means wildcard — matches any project holding/dept
        const holdingWild = (ur.holding || '').trim().toLowerCase() === 'all' ||
          (ur.holding || '').trim().toLowerCase() === 'all holding';
        const deptWild = (ur.department_operator || '').trim().toLowerCase() === 'all';

        const holdingMatch = holdingWild ||
          (ur.holding || '').trim().toLowerCase() === (proj.holding || '').trim().toLowerCase();
        const deptMatch = deptWild ||
          (ur.department_operator || '').trim().toLowerCase() === (proj.department_operator || '').trim().toLowerCase();

        return holdingMatch && deptMatch;
      })
    );
  }, [mapProjectStructure, mapUserRole]);

  const selectedProjectDescription = useMemo(() => {
    if (!selectedProjectKey) return null;
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    const matched = allowedProjects.find(p =>
      p.project_name === pName &&
      p.holding === pHolding &&
      p.department_operator === pRole
    );
    return matched?.project_description || null;
  }, [selectedProjectKey, allowedProjects]);

  const availableHoldings = useMemo(() => {
    return Array.from(new Set(allowedProjects.map(p => p.holding).filter(Boolean))).sort() as string[];
  }, [allowedProjects]);

  const availableRoleOperators = useMemo(() => {
    if (!selectedHolding) return [];
    
    // Find matching role operators from User Mappings
    const matches = mapUserRole.filter(ur => {
      const urHolding = (ur.holding || '').trim().toLowerCase();
      const selHolding = selectedHolding.trim().toLowerCase();
      return urHolding === 'all' || urHolding === 'all holding' || urHolding === selHolding;
    });

    // If any mapping is ALL/wildcard for operator, or we want to resolve to actual projects,
    // we should extract the actual department_operators available in the projects under this holding
    const hasWildcardDept = matches.some(ur => (ur.department_operator || '').trim().toLowerCase() === 'all');
    
    if (hasWildcardDept) {
      // Return all actual departments available in allowedProjects for this holding
      const depts = allowedProjects
        .filter(p => (p.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase())
        .map(p => p.department_operator)
        .filter(Boolean);
      return Array.from(new Set(depts)).sort() as string[];
    }

    return Array.from(new Set(
      matches
        .map(ur => ur.department_operator)
        .filter(Boolean)
    )).sort() as string[];
  }, [mapUserRole, selectedHolding, allowedProjects]);

  const availableProjectTypes = useMemo(() => {
    if (!selectedHolding || !selectedRoleOperator) return [];
    const filtered = allowedProjects.filter(p => {
      const hMatch = (p.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase() || selectedHolding.toLowerCase() === 'all';
      const rMatch = (p.department_operator || '').trim().toLowerCase() === selectedRoleOperator.trim().toLowerCase() || selectedRoleOperator.toLowerCase() === 'all';
      return hMatch && rMatch;
    });
    return Array.from(new Set(filtered.map(p => p.project_type))).sort();
  }, [allowedProjects, selectedHolding, selectedRoleOperator]);

  const availableProjects = useMemo(() => {
    if (!projectType || !selectedHolding || !selectedRoleOperator) return [];
    
    const typeProjs = allowedProjects.filter(p => {
      const tMatch = p.project_type === projectType;
      const hMatch = (p.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase() || selectedHolding.toLowerCase() === 'all';
      const rMatch = (p.department_operator || '').trim().toLowerCase() === selectedRoleOperator.trim().toLowerCase() || selectedRoleOperator.toLowerCase() === 'all';
      return tMatch && hMatch && rMatch;
    });
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    
    for (const p of typeProjs) {
      const key = `${p.project_name}|${p.holding}|${p.department_operator}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ label: p.project_name, value: key });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [projectType, allowedProjects, selectedHolding, selectedRoleOperator]);

  const availableModules = useMemo(() => {
    if (!selectedProjectKey) return [];
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    return Array.from(new Set(
      allowedProjects
        .filter(p => 
          p.project_type === projectType && 
          p.project_name === pName && 
          p.holding === pHolding && 
          p.department_operator === pRole
        )
        .map(p => p.module)
        .filter(Boolean)
    )).sort() as string[];
  }, [selectedProjectKey, projectType, allowedProjects]);

  // When no modules exist for the selected project, expose BU/Dept options for manual selection
  const noModuleMode = selectedProjectKey && availableModules.length === 0;

  const availableBUs = useMemo(() => {
    if (!noModuleMode) return [];
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    return Array.from(new Set(
      allowedProjects
        .filter(p =>
          p.project_type === projectType &&
          p.project_name === pName &&
          p.holding === pHolding &&
          p.department_operator === pRole
        )
        .map(p => p.bu)
        .filter(Boolean)
    )).sort() as string[];
  }, [noModuleMode, selectedProjectKey, projectType, allowedProjects]);

  const availableDepts = useMemo(() => {
    if (!noModuleMode || !bu) return [];
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    return Array.from(new Set(
      allowedProjects
        .filter(p =>
          p.project_type === projectType &&
          p.project_name === pName &&
          p.holding === pHolding &&
          p.department_operator === pRole &&
          p.bu === bu
        )
        .map(p => p.department)
        .filter(Boolean)
    )).sort() as string[];
  }, [noModuleMode, bu, selectedProjectKey, projectType, allowedProjects]);

  const availableBUsForModule = useMemo(() => {
    if (!selectedProjectKey || !module) return [];
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    return Array.from(new Set(
      allowedProjects
        .filter(p =>
          p.project_type === projectType &&
          p.project_name === pName &&
          p.holding === pHolding &&
          p.department_operator === pRole &&
          p.module === module
        )
        .map(p => p.bu)
        .filter(Boolean)
    )).sort() as string[];
  }, [selectedProjectKey, projectType, module, allowedProjects]);

  const availableDeptsForModule = useMemo(() => {
    if (!selectedProjectKey || !module || !bu) return [];
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    return Array.from(new Set(
      allowedProjects
        .filter(p =>
          p.project_type === projectType &&
          p.project_name === pName &&
          p.holding === pHolding &&
          p.department_operator === pRole &&
          p.module === module &&
          p.bu === bu
        )
        .map(p => p.department)
        .filter(Boolean)
    )).sort() as string[];
  }, [selectedProjectKey, projectType, module, bu, allowedProjects]);

  const availableActions = useMemo(() => {
    if (!masterActions || masterActions.length === 0) return [];
    if (!projectType) return Array.from(new Set(masterActions.map(a => a.action_name).filter(Boolean))).sort();

    const normProjType = projectType.trim().toLowerCase();

    // Tier 1: Exact case-insensitive match with action_category
    let filtered = masterActions.filter(a => 
      a.action_category && a.action_category.trim().toLowerCase() === normProjType
    );

    // Tier 2: Partial/contains match (e.g. "Support Go-Live" matches "Support", or vice versa)
    if (filtered.length === 0) {
      filtered = masterActions.filter(a => {
        if (!a.action_category) return false;
        const normCat = a.action_category.trim().toLowerCase();
        return normProjType.includes(normCat) || normCat.includes(normProjType);
      });
    }

    // Tier 3: Resilient fallback to all active actions if no category match is found
    if (filtered.length === 0) {
      filtered = masterActions;
    }

    return Array.from(new Set(filtered.map(a => a.action_name).filter(Boolean))).sort();
  }, [projectType, masterActions]);

  // Sync derived fields from selected project key and module
  useEffect(() => {
    if (selectedProjectKey) {
      const [pName, pHolding, pRole] = selectedProjectKey.split('|');
      setProjectName(pName);
      setHolding(pHolding);
      setRole(pRole);

      const hasModules = allowedProjects.some(p =>
        p.project_type === projectType &&
        p.project_name === pName &&
        p.holding === pHolding &&
        p.department_operator === pRole &&
        p.module
      );

      if (hasModules) {
        if (module) {
          const matches = allowedProjects.filter(p =>
            p.project_type === projectType &&
            p.project_name === pName &&
            p.holding === pHolding &&
            p.department_operator === pRole &&
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
          setBu('');
          setDepartment('');
        }
      } else {
        // No-module mode: BU/Dept chosen by user via dropdown — don't auto-set
        // (keep whatever the user selected, only reset when project changes)
      }
    } else {
      setProjectName('');
      setHolding('');
      setRole('');
      setBu('');
      setDepartment('');
    }
  }, [selectedProjectKey, module, projectType, allowedProjects]);

  // Consolidated single-pass auto-selection for cascaded form fields
  useEffect(() => {
    if (availableHoldings.length === 1 && !selectedHolding) {
      setSelectedHolding(availableHoldings[0]);
    } else if (selectedHolding && availableRoleOperators.length === 1 && !selectedRoleOperator) {
      setSelectedRoleOperator(availableRoleOperators[0]);
    } else if (selectedHolding && selectedRoleOperator && availableProjectTypes.length === 1 && !projectType) {
      setProjectType(availableProjectTypes[0]);
    } else if (projectType && availableProjects.length === 1 && !selectedProjectKey) {
      setSelectedProjectKey(availableProjects[0].value);
    } else if (selectedProjectKey && availableModules.length === 1 && !module) {
      setModule(availableModules[0]);
    } else if (projectType && availableActions.length === 1 && !actionName) {
      setActionName(availableActions[0]);
    }

    const buOpts = noModuleMode ? availableBUs : availableBUsForModule;
    if (buOpts.length === 1 && !bu) {
      setBu(buOpts[0]);
    }
    const deptOpts = noModuleMode ? availableDepts : availableDeptsForModule;
    if (deptOpts.length === 1 && !department) {
      setDepartment(deptOpts[0]);
    }
  }, [
    availableHoldings, selectedHolding,
    availableRoleOperators, selectedRoleOperator,
    availableProjectTypes, projectType,
    availableProjects, selectedProjectKey,
    availableModules, module,
    availableActions, actionName,
    noModuleMode, availableBUs, availableBUsForModule, bu,
    availableDepts, availableDeptsForModule, department
  ]);

  // Calculate live preview calculations (Overlap, Normal, OT, Implied OT)
  const preview = useMemo(() => {
    if (timeMode === 'duration') {
      return {
        duration: durationHours,
        normalHours: durationHours,
        otHours: 0,
        isOverlap: false,
        overlappingEvent: '',
        isImpliedOt: false,
        segments: [{
          work_date: date,
          hours: durationHours,
          start_time: '00:00', // Dummy
          end_time: '00:00',
          is_ot: isExplicitOt || isHolidayDate
        }]
      };
    }

    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);

    if (startMins === null || endMins === null) {
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

    // 1. Time overlap check
    let isOverlap = false;
    let overlappingEvent = '';

    for (const entry of existingEntries) {
      const eStart = parseTimeToMinutes(entry.start_time);
      const eEnd = parseTimeToMinutes(entry.end_time);
      if (eStart === null || eEnd === null) continue;

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
  }, [startTime, endTime, isBreak, existingEntries, isExplicitOt, isHolidayDate, date, timeMode, durationHours]);

  // Call AI to rephrase and enhance work description for executives
  const handleEnhanceDescription = async () => {
    if (!description.trim()) {
      showToast('กรุณากรอกรายละเอียดงานบางส่วนก่อนเพื่อให้ AI ช่วยปรับปรุง / Please enter some details first', 'warning');
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'enhance_description',
          description: description,
          project_name: projectName,
          action_name: actionName,
          duration: preview.normalHours + preview.otHours,
          workspace_id: session?.activeWorkspaceId,
        }
      });

      if (error) throw error;
      
      if (data?.enhanced_text) {
        setDescription(data.enhanced_text);
        if (data.standard_time_min !== undefined && data.standard_time_min !== null) {
          setTimeAssessment({
            standardTimeMin: data.standard_time_min,
            standardTimeMax: data.standard_time_max,
            timeAssessment: data.time_assessment,
            timeAssessmentReason: data.time_assessment_reason
          });
        } else {
          setTimeAssessment(null);
        }
        showToast('รายละเอียดงานได้รับการขัดเกลาด้วย AI และประเมินเวลาเรียบร้อย! / Work description polished & time assessed by AI', 'success');
      } else {
        showToast('ไม่สามารถขัดเกลาคำได้ กรุณาลองอีกครั้ง / Failed to rephrase description, please try again', 'error');
      }
    } catch (err: any) {
      console.error('Error enhancing description:', err);
      let errMsg = err.message || err;
      if (err.context && typeof err.context.clone === 'function') {
        try {
          const resClone = err.context.clone();
          const text = await resClone.text();
          try {
            const parsed = JSON.parse(text);
            if (parsed.error) errMsg = parsed.error;
            else if (parsed.message) errMsg = parsed.message;
          } catch {
            if (text && text.length < 150) errMsg = text;
          }
        } catch (e) {
          console.error('Failed to parse error response context:', e);
        }
      }
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ AI: ' + errMsg, 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAIClassify = async () => {
    if (!description.trim()) {
      showToast('กรุณากรอกรายละเอียดงานก่อนเพื่อใช้ในการวิเคราะห์จำแนกประเภท', 'warning');
      return;
    }
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'classify_work_description',
          description: description,
          workspace_projects: allowedProjects,
          master_actions: masterActions,
          workspace_id: session?.activeWorkspaceId,
        }
      });

      if (error) throw error;

      if (data?.classification) {
        const cls = data.classification;
        
        if (cls.holding) setSelectedHolding(cls.holding);
        if (cls.department_operator) setSelectedRoleOperator(cls.department_operator);
        if (cls.project_type) setProjectType(cls.project_type);
        if (cls.project_name) {
          const key = cls.module && cls.module !== '-'
            ? `${cls.project_name}|${cls.module}|${cls.bu || '-'}|${cls.department || '-'}`
            : `${cls.project_name}|-|${cls.bu || '-'}|${cls.department || '-'}`;
          setSelectedProjectKey(key);
          setModule(cls.module || '-');
          setBu(cls.bu || '');
          setDepartment(cls.department || '');
        }
        if (cls.action_name) setActionName(cls.action_name);

        showToast(`AI จับคู่โครงการสำเร็จ! (ความมั่นใจ ${Math.round((cls.confidence_score || 1) * 100)}%) \nเหตุผล: ${cls.reason || ''}`, 'success');
      }
    } catch (err: any) {
      console.error('Error classifying work:', err);
      showToast('ไม่สามารถจับคู่โครงการด้วย AI ได้: ' + err.message, 'error');
    } finally {
      setIsClassifying(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!session?.activeWorkspaceId) {
      showToast(t('logWork.selectWorkspaceFirst'), 'error');
      return;
    }

    // 1. Perform validation checks to let the user know what's missing
    if (!projectType) {
      showToast(t('logWork.selectProjectType'), 'error');
      return;
    }
    if (!selectedProjectKey || !projectName) {
      showToast(t('logWork.selectProject'), 'error');
      return;
    }
    if (availableModules.length > 0 && !module) {
      showToast(t('logWork.selectModule'), 'error');
      return;
    }
    const isBuDeptSelectable = noModuleMode || (projectName && module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1));
    if (isBuDeptSelectable) {
      if (!bu) {
        showToast(t('logWork.selectBU'), 'error');
        return;
      }
      if (!department) {
        showToast(t('logWork.selectDepartment'), 'error');
        return;
      }
    }
    if (!actionName) {
      showToast(t('logWork.selectAction'), 'error');
      return;
    }
    if (preview.duration <= 0) {
      showToast('กรุณาระบุจำนวนชั่วโมงหรือเลือกช่วงเวลาทำงานที่มากกว่า 0 / Work hours must be greater than 0', 'error');
      return;
    }

    let finalSegments = preview.segments;
    
    if (timeMode === 'duration') {
      const autoSlot = findSmartTimeSlot(durationHours, existingEntries);
      if (autoSlot) {
        finalSegments = [{
          work_date: date,
          hours: durationHours,
          start_time: autoSlot.startTime,
          end_time: autoSlot.endTime,
          is_ot: isExplicitOt || isHolidayDate
        }];
      } else {
        showToast('ไม่พบช่วงเวลาว่างติดต่อกันในเวลาทำงานปกติ กรุณาระบุเวลาด้วยตนเอง', 'error');
        setTimeMode('range');
        return;
      }
    } else {
      if (preview.isOverlap) {
        showToast(`ข้อมูลเวลาทำงานบางส่วนคาบเกี่ยวกับรายการอื่น (${preview.overlappingEvent})`, 'warning');
      }
    }

    setIsSubmitting(true);
    try {
      // Get the correct user ID from the active session or simulated user
      let userId = resolvedUserId || session.id;
      
      if (!userId) {
        // Fallback for safety/dev
        const mapName = selectedUser || session.nickname || session.name?.split(' ')[0] || 'Chatchawan';
        let { data: userData } = await supabase.from('users').select('id').eq('nickname', mapName).maybeSingle();
        userId = userData?.id;
        
        if (!userId) {
          const { data: newUser, error: createErr } = await supabase.from('users').insert({
            emp_id: `EMP-${Math.floor(Math.random() * 10000)}`,
            email: `${mapName.toLowerCase()}@example.com`,
            full_name: mapName,
            nickname: mapName,
            role: 'user'
          }).select('id').maybeSingle();
          
          if (createErr) throw new Error('Failed to create mock user: ' + createErr.message);
          userId = newUser?.id;
        }
      }

      // Check Google Calendar connection readiness BEFORE writing to database
      try {
        const { ready } = await googleCalendar.checkSessionReady(userId);
        if (!ready) {
          showToast('กำลังเชื่อมต่อ Google Calendar... กรุณารอสักครู่ / Connecting Google Calendar...', 'info');
          
          const inserts = [];
          if (finalSegments.length > 1) {
            for (let i = 0; i < finalSegments.length; i++) {
              const segment = finalSegments[i];
              const segmentPrefix = segment.is_ot ? '[OT]' : '[Normal]';
              inserts.push({
                user_id: userId,
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
                channel: 'Web App',
                is_ot: segment.is_ot,
                is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
                image_urls: attachedImages,
                workspace_id: session.activeWorkspaceId
              });
            }
          } else {
            const segment = finalSegments[0] || {
              work_date: date,
              hours: preview.duration,
              start_time: timeMode === 'range' ? startTime : '00:00',
              end_time: timeMode === 'range' ? endTime : '00:00',
              is_ot: isExplicitOt || isHolidayDate
            };
            inserts.push({
              user_id: userId,
              work_date: segment.work_date,
              start_time: segment.start_time + ':00',
              end_time: segment.end_time + ':00',
              break_time: timeMode === 'range' ? isBreak : false,
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
              description: description,
              channel: 'Web App',
              is_ot: segment.is_ot,
              is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
              image_urls: attachedImages,
              workspace_id: session.activeWorkspaceId
            });
          }

          const pendingSync = {
            action: 'insert',
            inserts
          };
          
          localStorage.setItem('gcal_pending_sync', JSON.stringify(pendingSync));
          localStorage.setItem('gcal_pending_origin', window.location.pathname + window.location.search);
          
          setTimeout(() => {
            window.location.href = googleCalendar.getAuthUrl();
          }, 1000);
          
          setIsSubmitting(false);
          return;
        }
      } catch (gcalErr) {
        console.warn('[GCal] Session check failed, proceeding without redirect:', gcalErr);
      }

      let savedId = null;
      const createSecureWorklog = async (segment: any, descriptionValue: string, breakTime: boolean) => {
        return supabase.rpc('create_worklog_secure', {
          p_workspace_id: session.activeWorkspaceId,
          p_target_user_id: userId,
          p_payload: {
            work_date: segment.work_date,
            start_time: segment.start_time + ':00',
            end_time: segment.end_time + ':00',
            break_time: breakTime,
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
            description: descriptionValue,
            channel: 'Web App',
            is_ot: segment.is_ot,
            is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt,
            image_urls: attachedImages
          }
        });
      };

      if (finalSegments.length > 1) {
        // We need to SPLIT this entry!
        for (let i = 0; i < finalSegments.length; i++) {
          const segment = finalSegments[i];
          const segmentPrefix = segment.is_ot ? '[OT]' : '[Normal]';

          const { data, error } = await createSecureWorklog(
            segment,
            description ? `${segmentPrefix} ${description}` : `${segment.is_ot ? 'OT' : 'Normal'} portion`,
            !segment.is_ot ? isBreak : false
          );

          if (error) throw error;
          if (data) {
            savedId = data.id;
            // Trigger sync in background
            syncWorklogToGCal(data.id, 'insert');
          }
        }
      } else {
        // Standard single entry
        const segment = finalSegments[0] || {
          work_date: date,
          hours: preview.duration,
          start_time: timeMode === 'range' ? startTime : '00:00',
          end_time: timeMode === 'range' ? endTime : '00:00',
          is_ot: isExplicitOt || isHolidayDate
        };

        const { data, error } = await createSecureWorklog(
          segment,
          description,
          timeMode === 'range' ? isBreak : false
        );

        if (error) throw error;
        if (data) {
          savedId = data.id;
          // Trigger sync in background
          syncWorklogToGCal(data.id, 'insert');
        }
      }
      
      if (savedId) {
        setCreatedShareLinkId(savedId);
      }
      
      showToast(t('logWork.saveSuccess'), 'success');
      
      // Clear form inputs so the user has a clean state for the next entry
      setProjectType('');
      setSelectedProjectKey('');
      setModule('');
      setActionName('');
      setBu('');
      setDepartment('');
      setDescription('');
      setSelectedActionChannels([]);
      setDurationHours(2);
      setIsBreak(true);
      resetTimeDefaults();
      setAttachedImages([]);
      
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err: any) {
      console.error(err);
      showToast(t('logWork.saveError') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectHolding = (h: string) => {
    const next = selectedHolding === h ? '' : h;
    setSelectedHolding(next);
    setSelectedRoleOperator('');
    setProjectType('');
    setSelectedProjectKey('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleSelectRoleOperator = (r: string) => {
    const next = selectedRoleOperator === r ? '' : r;
    setSelectedRoleOperator(next);
    setProjectType('');
    setSelectedProjectKey('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleSelectProjectType = (type: string) => {
    setProjectType(type);
    setSelectedProjectKey('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  const handleSelectProjectKey = (key: string) => {
    setSelectedProjectKey(key);
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-theme-text mb-8 tracking-tight">Log Work</h1>

        {!session?.activeWorkspaceId ? (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <Shield size={16} className="text-amber-600 dark:text-amber-400" />
              <span>กรุณาเลือก Workspace ก่อนบันทึกใบงาน ระบบจะบันทึกงานของคุณใน Workspace ที่เลือก</span>
            </span>
            <a href="/workspaces" className="underline text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200">เลือก Workspace</a>
          </div>
        ) : (
          session?.role === 'admin' && (
            <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>{t('logWork.recordingIn')} <strong>{session.workspaceName || session.activeWorkspaceId}</strong></span>
              </span>
              <a href="/workspaces" className="underline text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100">{t('logWork.changeWorkspace')}</a>
            </div>
          )
        )}

        {/* Collapsible Google Calendar .ics Import Banner */}
        <div className="mb-6 bg-gradient-to-br from-indigo-100/40 via-violet-50/20 to-slate-50/10 dark:from-indigo-900/20 dark:via-indigo-950/20 dark:to-slate-900/30 border border-indigo-200/50 dark:border-indigo-500/10 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setIsICSCollapseOpen(!isICSCollapseOpen)}
              className="flex-1 flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  นำเข้าบันทึกงานด้วยไฟล์ปฏิทิน (.ics) / Import Google Calendar
                </span>
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                {isICSCollapseOpen ? 'ซ่อนรายละเอียด / Collapse' : 'ขยายข้อมูลนำเข้า / Expand'}
              </span>
            </button>
          </div>

          {isICSCollapseOpen && (
            <div className="mt-4 pt-4 border-t border-indigo-200/30 dark:border-indigo-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                <p className="text-xs text-theme-text-secondary max-w-xl">
                  อัปโหลดไฟล์ `.ics` ที่ส่งออกมาจากระบบปฏิทินของคุณเพื่อดึงกิจกรรมเป็นรายการบันทึกงานอัตโนมัติ จากนั้นสามารถส่งให้ AI ช่วยประเมินผลงานย้อนหลังได้ทันที
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <label className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-indigo-500/30 transition-all cursor-pointer active:scale-95 shadow-lg shadow-indigo-500/20">
                  <Upload size={14} />
                  <span>เลือกไฟล์ .ics / Upload .ics File</span>
                  <input 
                    type="file" 
                    accept=".ics" 
                    onChange={handleICSFileUpload} 
                    className="sr-only" 
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-theme-surface-tertiary bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border dark:border-theme-border/50 rounded-2xl p-6 md:p-8 shadow-xl shadow-black/20">
          
          {/* Date Picker & User Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">เลือกวันที่ / Select Date</label>
              <div className="relative w-full">
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => {
                    resetTimeDefaults();
                    setDate(e.target.value);
                  }}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border-strong dark:border-theme-border-strong rounded-lg py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {isCurrentUserChatchawan && (
              <DropdownField
                label="ผู้ใช้งานจำลองสิทธิ์ / Simulating User"
                value={selectedUser}
                onChange={(v) => {
                  resetTimeDefaults();
                  setSelectedUser(v);
                }}
                options={allUsers.map((u) => ({
                  value: u,
                  label: `${userDisplayLabels[u] || u}${u.toLowerCase() === (session.nickname || '').split('_')[0].toLowerCase() ? ' (You)' : ''}`
                }))}
                placeholder="เลือกผู้ใช้งาน / Select User"
                disabled={!isCurrentUserChatchawan}
              />
            )}
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full mb-8"></div>

          {/* Cascading Logic Area */}
          <div className="space-y-6 mb-8">
            
            {/* Row 1: Holding & Role Operator — button chips */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-2">HOLDING</label>
                <div className="flex flex-wrap gap-2">
                  {isLoadingMaster ? (
                    <span className="text-xs text-theme-text-secondary italic animate-pulse">กำลังโหลด...</span>
                  ) : availableHoldings.length === 0 ? (
                    <span className="text-xs text-amber-500 font-semibold italic bg-amber-500/5 border border-amber-500/10 px-3.5 py-2 rounded-xl">
                      ⚠️ ไม่มีข้อมูลโครงการของแผนกคุณในระบบ (สามารถเพิ่มโครงการใหม่ได้ที่หน้า Project Registry)
                    </span>
                  ) : (
                    availableHoldings.map((h) => {
                      const isSelected = selectedHolding === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSelectHolding(h)}
                          className={cn(
                            "px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 border flex items-center gap-1.5 active:scale-95 shadow-sm",
                            isSelected
                              ? "bg-gradient-to-r from-violet-500 to-indigo-600 border-indigo-400/30 text-white hover:from-violet-600 hover:to-indigo-700 shadow-indigo-500/20"
                              : "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 border-theme-border dark:border-theme-border/50 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/80 hover:border-indigo-400/40"
                          )}
                        >
                          <span className="text-sm">🏢</span>
                          <span>{h}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className={cn(
                  "block text-xs font-semibold mb-2",
                  !selectedHolding ? "text-theme-text-secondary/50" : "text-theme-text-secondary"
                )}>ROLE OPERATOR (DEPARTMENT OPERATOR)</label>
                <div className="flex flex-wrap gap-2">
                  {!selectedHolding ? (
                    <span className="text-xs text-theme-text-secondary/50 italic">เลือก Holding ก่อน / Select Holding first</span>
                  ) : availableRoleOperators.length === 0 ? (
                    <span className="text-xs text-theme-text-secondary italic">กำลังโหลด...</span>
                  ) : (
                    availableRoleOperators.map((r) => {
                      const isSelected = selectedRoleOperator === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleSelectRoleOperator(r)}
                          className={cn(
                            "px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 border flex items-center gap-1.5 active:scale-95 shadow-sm",
                            isSelected
                              ? "bg-gradient-to-r from-cyan-500 to-teal-600 border-teal-400/30 text-white hover:from-cyan-600 hover:to-teal-700 shadow-teal-500/20"
                              : "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 border-theme-border dark:border-theme-border/50 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/80 hover:border-teal-400/40"
                          )}
                        >
                          <span className="text-sm">👤</span>
                          <span>{r}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Project Type & Project Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DropdownField 
                label="Project Type" 
                value={projectType} 
                onChange={handleSelectProjectType} 
                options={availableProjectTypes}
                disabled={!selectedRoleOperator}
                placeholder="Select Type"
              />
              <SearchableCombobox
                label="Project Name"
                value={selectedProjectKey}
                onChange={handleSelectProjectKey}
                options={availableProjects}
                disabled={!projectType}
                placeholder="Search project..."
              />
            </div>

            {/* Row 2: Module & Action */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DropdownField 
                label="Module / Phase" 
                value={module} 
                onChange={setModule} 
                options={availableModules} 
                disabled={!selectedProjectKey || availableModules.length === 0}
                placeholder={availableModules.length === 0 && selectedProjectKey ? "No Module (Auto-skip)" : "Select Module"}
              />
              <SearchableCombobox
                label="Action"
                value={actionName}
                onChange={setActionName}
                options={availableActions}
                disabled={!projectType}
                placeholder="Search action..."
              />
            </div>

            {selectedProjectDescription && (
              <div className="p-4 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/10 dark:border-indigo-500/10 text-xs text-theme-text-secondary leading-relaxed flex flex-col gap-1.5 shadow-sm mt-2">
                <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                  <span>📖 Project Background & Objectives:</span>
                </div>
                <p className="font-normal text-theme-text-secondary italic">
                  {selectedProjectDescription}
                </p>
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!description.includes(`[Project Context]: ${selectedProjectDescription}`)) {
                        setDescription(prev => {
                          const prefix = prev.trim() ? `${prev}\n\n` : '';
                          return `${prefix}[Project Context]: ${selectedProjectDescription}\n`;
                        });
                      }
                    }}
                    className="px-2 py-1 text-[10px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-500/20 dark:border-indigo-500/30 transition-all cursor-pointer"
                  >
                    ➕ แทรกบริบทโปรเจกต์ลงรายละเอียดงาน / Insert Context
                  </button>
                </div>
              </div>
            )}

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
                      <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">BUSINESS UNIT <span className="text-rose-400">*</span></label>
                      <select
                        value={bu}
                        onChange={e => { setBu(e.target.value); setDepartment(''); }}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-theme-border dark:border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      >
                        <option value="">— Select BU —</option>
                        {buOpts.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">TARGET DEPARTMENT <span className="text-rose-400">*</span></label>
                      <select
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        disabled={!bu}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-theme-border dark:border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-40"
                      >
                        <option value="">— Select Department —</option>
                        {deptOpts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 border border-theme-border dark:border-theme-border/50 rounded-xl text-xs font-semibold text-theme-text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">Business Unit:</span>
                      <span className="text-theme-text font-mono">{bu || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">Target Department:</span>
                      <span className="text-theme-text font-mono">{department || '-'}</span>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Optional Action Channels as Clickable Tag Chips */}
            <div className="space-y-2 mt-4">
              <label className="block text-xs font-semibold text-theme-text-secondary">ช่องทางการสื่อสาร (Action Channels - Optional)</label>
              <div className="flex flex-wrap gap-2.5">
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
                        "px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 border flex items-center gap-1.5 active:scale-95 shadow-sm",
                        isSelected
                          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 border-indigo-400/30 text-theme-text hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/10 animate-in zoom-in-95 duration-100"
                          : "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 border-theme-border dark:border-theme-border/50 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/80 hover:border-theme-border-strong dark:border-theme-border-strong"
                      )}
                    >
                      {channelOption === 'Meeting' && <span className="text-sm">👥</span>}
                      {channelOption === 'Discuss via phone' && <span className="text-sm">📞</span>}
                      {channelOption === 'On site' && <span className="text-sm">📍</span>}
                      {channelOption === 'Leave' && <span className="text-sm">🌴</span>}
                      <span>{channelOption}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto-filled Preview (only in module mode when BU/Dept are unique/auto-derived) */}
            {!noModuleMode && (bu || department) && !(availableBUsForModule.length > 1 || availableDeptsForModule.length > 1) && (
              <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mt-4">
                <Check className="text-indigo-400 shrink-0" size={18} />
                <div className="text-sm">
                  <span className="text-theme-text-secondary">Auto-filled BU: </span><span className="text-theme-text font-medium mr-4">{bu}</span>
                  <span className="text-theme-text-secondary">Dept: </span><span className="text-theme-text font-medium">{department}</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-700/50 w-full mb-8"></div>

          {/* Time & Hours */}
          <div className="flex flex-col md:flex-row gap-8 mb-8">
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-theme-text-secondary">ระบุเวลา / Specify Time</label>
                  <div className="flex bg-theme-surface-secondary dark:bg-theme-surface-secondary p-1 rounded-lg border border-theme-border dark:border-theme-border">
                    <button
                      type="button"
                      onClick={() => setTimeMode('range')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        timeMode === 'range' ? "bg-indigo-600 text-theme-text" : "text-theme-text-secondary hover:text-theme-text"
                      )}
                    >
                      🕒 ช่วงเวลา
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeMode('duration')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        timeMode === 'duration' ? "bg-indigo-600 text-theme-text" : "text-theme-text-secondary hover:text-theme-text"
                      )}
                    >
                      ⏳ จำนวนชั่วโมง
                    </button>
                  </div>
                </div>

                {timeMode === 'range' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <span className="block text-xs text-theme-text-secondary mb-1">เวลาเริ่มต้น / Start Time</span>
                        <TimeSelectInput 
                          value={startTime}
                          onChange={val => { setStartTime(val); markTimeCustomized(); }}
                          onBlur={val => {
                            const formatted = validateAndFormatTime(val, lastValidStartTime.current);
                            setStartTime(formatted);
                            lastValidStartTime.current = formatted;
                          }}
                          options={timeOptions}
                          placeholder="HH:MM"
                        />
                      </div>
                      <span className="text-slate-500 mt-4">-</span>
                      <div className="flex-1">
                        <span className="block text-xs text-theme-text-secondary mb-1">เวลาสิ้นสุด / End Time</span>
                        <TimeSelectInput 
                          value={endTime}
                          onChange={val => { setEndTime(val); markTimeCustomized(); }}
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
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                      <span className="text-[10px] uppercase font-bold text-theme-text-muted mr-1 select-none">ปรับเวลา (End Time):</span>
                      {[-30, -10, -5, 5, 10, 15, 30, 60].map((mins) => {
                        const label = mins > 0 
                          ? `+${mins >= 60 ? `${mins / 60}h` : `${mins}m`}` 
                          : `${mins === -60 ? '-1h' : `${mins}m`}`;
                        return (
                          <button
                            key={`adj-${mins}`}
                            type="button"
                            onClick={() => {
                              setEndTime(prev => addMinutesToTime(prev, mins));
                              markTimeCustomized();
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-theme-border/60 hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 text-theme-text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer active:scale-95"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 max-w-xs">
                    <span className="block text-xs text-theme-text-secondary mb-1">จำนวนชั่วโมง / Hours spent</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.5"
                        min="0.5"
                        value={durationHours}
                        onChange={e => setDurationHours(parseFloat(e.target.value) || 0)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border-strong dark:border-theme-border-strong rounded-lg py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center space-x-3 cursor-pointer group flex-1">
                  <div className={cn(
                    "relative flex items-center justify-center w-5 h-5 rounded border transition-colors",
                    isBreak ? "bg-indigo-500 border-indigo-500" : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-slate-500 group-hover:border-indigo-400"
                  )}>
                    <input type="checkbox" checked={isBreak} onChange={e => setIsBreak(e.target.checked)} className="sr-only" />
                    {isBreak && <Check size={14} className="text-theme-text" />}
                  </div>
                  <span className="text-sm text-theme-text-secondary group-hover:text-theme-text transition-colors">หักพักเบรกเที่ยง / Break (1 hr)</span>
                </label>

                <label className={cn(
                  "flex items-center space-x-3 cursor-pointer group flex-1",
                  isHolidayDate ? "opacity-60 cursor-not-allowed" : ""
                )}>
                  <div className={cn(
                    "relative flex items-center justify-center w-5 h-5 rounded border transition-colors",
                    isExplicitOt ? "bg-amber-500 border-amber-500" : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-slate-500 group-hover:border-amber-400"
                  )}>
                    <input 
                      type="checkbox" 
                      checked={isExplicitOt} 
                      onChange={e => !isHolidayDate && setIsExplicitOt(e.target.checked)} 
                      disabled={isHolidayDate}
                      className="sr-only" 
                    />
                    {isExplicitOt && <Check size={14} className="text-theme-text" />}
                  </div>
                  <span className="text-sm text-theme-text-secondary group-hover:text-theme-text transition-colors">บันทึกเป็น OT เจาะจง / Explicit OT</span>
                </label>
              </div>
            </div>

            {/* Hours Display Breakdown */}
            <div className="w-full md:w-80 bg-theme-surface-secondary dark:bg-theme-bg-page border border-theme-border dark:border-theme-border/60 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="mb-4">
                <span className="text-theme-text-secondary text-sm font-medium">รวมเวลาทำงาน / Total Hours</span>
                <div className="flex items-baseline mt-1">
                  <span className="text-4xl font-bold text-theme-text tracking-tight">{preview.duration.toFixed(1)}</span>
                  <span className="text-sm text-theme-text-secondary ml-1.5 font-medium">hrs</span>
                </div>
              </div>
              <div className="space-y-2 border-t border-theme-border dark:border-theme-border pt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text-secondary">ชั่วโมงปกติ / Regular:</span>
                  <span className="text-theme-text font-semibold">{preview.normalHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text-secondary">ชั่วโมง OT / Overtime:</span>
                  <span className="text-amber-400 font-semibold">{preview.otHours.toFixed(1)} hrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <div className="mb-2">
              <label className="block text-sm font-semibold text-theme-text-secondary">
                รายละเอียดงาน / Work Description <span className="text-rose-400">*</span>
              </label>
            </div>
            
            {/* Worklog templates wrapped on a new row */}
            <div className="flex flex-wrap gap-2 mb-3">
              {dbTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleInjectTemplate(tpl.template_content)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{tpl.icon || '📝'}</span>
                  <span>{tpl.template_name}</span>
                </button>
              ))}
            </div>

            {/* Guide Info Box */}
            <div className="mb-3 p-3 rounded-xl bg-indigo-500/5 dark:bg-slate-900/30 border border-indigo-500/10 dark:border-indigo-500/5 text-xs text-theme-text-secondary leading-relaxed flex items-start gap-2 shadow-sm">
              <span className="text-indigo-600 dark:text-indigo-400 shrink-0">💡</span>
              <p className="font-medium text-theme-text-secondary">
                {getWorklogGuide().guide}
              </p>
            </div>

            <textarea 
              rows={6}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="กรอกรายละเอียดงานของคุณที่นี่..."
              className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border-strong dark:border-theme-border-strong rounded-lg p-4 text-theme-text placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none mb-2 font-sans text-xs leading-relaxed"
            ></textarea>

            {/* Image Attachment Upload Section */}
            <div className="mb-6 p-4 bg-theme-surface-secondary/40 border border-theme-border rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-theme-text-secondary">
                  แนบรูปภาพประกอบใบงาน / Attach Images (สูงสุด 2 รูป)
                </label>
                <span className="text-[10px] text-theme-text-muted">R2 Storage / Auto Compress</span>
              </div>
              
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
                        <span className="text-[10px] text-theme-text-secondary font-bold">คลิกเพื่อแนบรูปภาพ</span>
                        <span className="text-[9px] text-theme-text-muted mt-0.5">JPG, PNG (ไม่เกิน 10MB)</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Guide Key Suggest list */}
            <div className="mb-3 p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-theme-border/60 text-[11px] text-theme-text-muted leading-relaxed space-y-1 shadow-sm">
              <span className="font-bold text-theme-text-secondary uppercase tracking-wider block mb-1">📌 แนวทางการบันทึกผลงาน (ไกด์ไลน์เพื่อความชัดเจน):</span>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-theme-text-secondary">สิ่งที่ทำ:</strong> อธิบายรายละเอียดว่าทำอะไรให้ชัดเจน (คนนอกหรือผู้บริหารอ่านแล้วเข้าใจได้ทันที)</li>
                <li><strong className="text-theme-text-secondary">ผลลัพธ์ที่ได้:</strong> ระบุผลลัพธ์ที่เป็นรูปธรรม ชิ้นงาน ผลประชุม หรือ KPI/เป้าหมายที่เกี่ยวข้อง</li>
                <li><strong className="text-theme-text-secondary">ความคืบหน้า & ขั้นตอนถัดไป:</strong> ทำได้เสร็จทั้งหมด หรือเหลืออีกกี่ % และคาดว่าจะเสร็จในอีกกี่วัน (Next Step)</li>
              </ul>
            </div>
            
            {/* AI Tools Container — Admin only */}
            {session && session.role === 'admin' && (
              <div className="space-y-3">
                {/* AI Sparkle Polish */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 gap-3 shadow-inner animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                      <Sparkles size={16} className={cn("animate-pulse", isEnhancing && "animate-spin")} />
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-widest block mb-0.5">ขัดเกลาคำด้วย AI / AI Sparkle</span>
                      <span className="text-xs text-theme-text-secondary leading-normal block">
                        ช่วยเกลาคำอธิบายงานให้ออกมาในแง่บวก เห็นภาพความสำเร็จ ประหยัดเวลา และประหยัดต้นทุนสำหรับผู้บริหาร
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnhanceDescription}
                    disabled={isEnhancing}
                    className={cn(
                      "px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-theme-surface-tertiary dark:bg-theme-surface-tertiary disabled:text-slate-500 disabled:border-theme-border dark:border-theme-border/50 text-theme-text text-xs font-bold rounded-xl border border-indigo-500/30 shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95 transition-all",
                      isEnhancing && "cursor-not-allowed"
                    )}
                  >
                    {isEnhancing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังขัดเกลา...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>ยกระดับด้วย AI / AI Polish</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AI Project Classifier */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-violet-500/5 border border-violet-500/10 rounded-2xl p-4 gap-3 shadow-inner animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl shrink-0">
                      <Cpu size={16} className={cn("animate-pulse", isClassifying && "animate-spin")} />
                    </div>
                    <div>
                      <span className="text-[10px] text-violet-400 uppercase font-black tracking-widest block mb-0.5">วิเคราะห์โครงการด้วย AI / AI Project Auto-Classify</span>
                      <span className="text-xs text-theme-text-secondary leading-normal block">
                        วิเคราะห์เนื้อหาการทำงาน เพื่อจับคู่โครงการ สังกัด และประเภทกิจกรรมอัตโนมัติจากทะเบียนโครงการของคุณ
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAIClassify}
                    disabled={isClassifying}
                    className={cn(
                      "px-4 py-2 bg-violet-600/90 hover:bg-violet-600 disabled:bg-theme-surface-tertiary dark:bg-theme-surface-tertiary disabled:text-slate-500 disabled:border-theme-border dark:border-theme-border/50 text-theme-text text-xs font-bold rounded-xl border border-violet-500/30 shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95 transition-all",
                      isClassifying && "cursor-not-allowed"
                    )}
                  >
                    {isClassifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังวิเคราะห์...</span>
                      </>
                    ) : (
                      <>
                        <Cpu size={13} />
                        <span>วิเคราะห์โครงการ / Auto-Classify</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            {/* AI Time Assessment Result Card */}
            {timeAssessment && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-theme-border dark:border-theme-border/60 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between border-b border-theme-border dark:border-theme-border/30 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-theme-text-secondary">AI Time Efficiency Assessment</span>
                  </div>
                  {timeAssessment.timeAssessment === 'ดี' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                      🟢 เหมาะสม (Good)
                    </span>
                  )}
                  {timeAssessment.timeAssessment === 'มาก' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">
                      🔴 ใช้เวลามาก (Too Much)
                    </span>
                  )}
                  {timeAssessment.timeAssessment === 'น้อย' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                      🟡 ใช้เวลาน้อย (Too Little)
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-theme-text-muted block text-[10px] font-bold uppercase tracking-wider mb-0.5">เวลามาตรฐาน (Standard Time)</span>
                    <span className="font-extrabold text-theme-text">
                      {timeAssessment.standardTimeMin?.toFixed(1)} - {timeAssessment.standardTimeMax?.toFixed(1)} ชั่วโมง
                    </span>
                  </div>
                  <div>
                    <span className="text-theme-text-muted block text-[10px] font-bold uppercase tracking-wider mb-0.5">เวลาที่บันทึก (Your Logged Time)</span>
                    <span className="font-extrabold text-indigo-500">
                      {(preview.normalHours + preview.otHours).toFixed(1)} ชั่วโมง
                    </span>
                  </div>
                </div>

                {timeAssessment.timeAssessmentReason && (
                  <div className="text-xs text-theme-text-secondary leading-relaxed bg-theme-surface-secondary/40 p-3 rounded-xl border border-theme-border/20 font-medium">
                    {timeAssessment.timeAssessmentReason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-6 border-t border-theme-border dark:border-theme-border/50">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-theme-text-secondary disabled:shadow-none text-theme-text font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก / Save Log'}
            </button>
          </div>

          {/* Validation & Holiday Premium Alerts */}
          <div className="space-y-4 mt-6">
            {preview.isOverlap && (holding || isTimeCustomized) && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-800 dark:text-red-200">
                <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-red-950 dark:text-red-300">ช่วงเวลาทำงานทับซ้อนกัน / Time Overlap Alert</h4>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">เวลาที่คุณเลือกทับซ้อนกับรายการที่บันทึกแล้ว: <span className="font-semibold text-theme-text">{preview.overlappingEvent}</span></p>
                </div>
              </div>
            )}

            {isHolidayDate && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200">
                <CalendarIcon className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-amber-950 dark:text-amber-300">{t('logWork.isHoliday')} ({holidayName})</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">ชั่วโมงทำงานทั้งหมดของวันหยุดจะถูกคิดสัดส่วนสะสมเป็นชั่วโมง OT ทั้งหมด 🌟</p>
                </div>
              </div>
            )}

            {preview.isImpliedOt && (holding || isTimeCustomized) && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start gap-3 text-indigo-800 dark:text-indigo-200">
                <Zap className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-indigo-950 dark:text-indigo-300">ชั่วโมงสะสมปกติเกิน 8 ชม. ต่อวัน / Implied Overtime</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1 font-normal">
                    ยอดรวมชั่วโมงงานปกติในวันนี้ของคุณเต็ม 8 ชม. แล้ว ส่วนต่างอีก <span className="font-semibold text-theme-text">{preview.otHours.toFixed(1)} ชม.</span> จะถูกปัดเป็น OT แฝงให้อัตโนมัติ
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Today's Logged Activities */}
          {existingEntries.length > 0 && (
            <div className="mt-10 pt-8 border-t border-theme-border dark:border-theme-border/50">
              <h3 className="text-lg font-semibold text-theme-text mb-4 flex items-center gap-2">
                <Clock size={18} className="text-indigo-400" />
                <span>งานที่คุณบันทึกแล้วในวันนี้ / Activities Logged Today</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {existingEntries.map((entry) => (
                  <div key={entry.id} className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border border-theme-border dark:border-theme-border/50 rounded-xl p-4 flex flex-col justify-between hover:border-theme-border-strong dark:border-theme-border-strong transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-theme-text text-sm line-clamp-1">{entry.project_name}</h4>
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-full",
                          entry.is_ot || entry.is_implied_ot 
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" 
                            : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20"
                        )}>
                          {entry.is_ot ? 'OT' : entry.is_implied_ot ? 'OT แฝง' : 'ปกติ'}
                        </span>
                      </div>
                      <p className="text-xs text-theme-text-secondary mb-2">{entry.module || 'No Module'} • {entry.action_name}</p>
                      {entry.description && (
                        <p className="text-xs text-theme-text-secondary line-clamp-2 italic bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/30 p-2 rounded border border-theme-border dark:border-theme-border/30 mb-2">
                          "{entry.description}"
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-theme-text-secondary border-t border-theme-border dark:border-theme-border pt-2 mt-1">
                      <span>{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setViewingLog(entry)}
                          className="text-theme-text-secondary hover:text-theme-text font-semibold transition-colors uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>ดูใบงาน / View</span>
                        </button>
                        <button
                          onClick={() => setEditingLog(entry)}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          แก้ไข / Edit
                        </button>
                        <span className="font-medium text-theme-text">{Number(entry.total_hours).toFixed(1)} hrs</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {editingLog && (
        <EditWorklogModal
          isOpen={!!editingLog}
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaveSuccess={() => {
            setEditingLog(null);
            setRefreshTrigger(prev => prev + 1); // Triggers re-fetch of existing entries and daily context
          }}
        />
      )}

      <ViewWorklogModal
        isOpen={!!viewingLog}
        log={viewingLog}
        onClose={() => setViewingLog(null)}
      />

      <ImportICSModal
        isOpen={isICSModalOpen}
        onClose={() => setIsICSModalOpen(false)}
        rawICSContent={rawICSContent}
        onImportSuccess={() => setRefreshTrigger(prev => prev + 1)}
        allowedProjects={allowedProjects}
        mapUserRole={mapUserRole}
        session={session}
      />

      {createdShareLinkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-theme-surface-modal border border-indigo-500/20 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shrink-0">
                <Share2 size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-theme-text">บันทึกใบงานสำเร็จ! / Log Saved!</h3>
                <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
                  ใบงานของคุณได้รับการบันทึกและอัปโหลดรูปภาพแล้ว คุณสามารถคัดลอกลิงก์แชร์ด้านล่างเพื่อไปแนบในรายละเอียดของปฏิทินงาน (Google Calendar)
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/worklog/share/${createdShareLinkId}`}
                    className="w-full bg-theme-surface-secondary border border-theme-border text-xs px-3.5 py-2.5 rounded-xl text-theme-text font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/worklog/share/${createdShareLinkId}`);
                      showToast('คัดลอกลิงก์แชร์เรียบร้อยแล้ว! / Link copied!', 'success');
                    }}
                    className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>คัดลอก</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setCreatedShareLinkId(null)}
                className="px-5 py-2 bg-theme-surface-tertiary hover:bg-slate-700 text-theme-text-secondary text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

interface DropdownOption {
  label: string;
  value: string;
}

function DropdownField({ label, value, onChange, options, disabled, placeholder }: { label: string, value: string, onChange: (v: string) => void, options: (string | DropdownOption)[], disabled?: boolean, placeholder?: string }) {
  return (
    <div>
      <label className={cn("block text-sm font-medium mb-1.5 transition-colors", disabled ? "text-slate-500" : "text-theme-text-secondary")}>
        {label}
      </label>
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full appearance-none border rounded-lg py-2.5 px-4 focus:outline-none focus:ring-2 transition-all",
            disabled 
              ? "bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border-theme-border dark:border-theme-border/50 text-slate-500 cursor-not-allowed" 
              : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border-strong dark:border-theme-border-strong text-theme-text focus:ring-indigo-500 focus:border-transparent cursor-pointer hover:border-slate-500"
          )}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(opt => {
            const optVal = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={optVal} value={optVal}>{optLabel}</option>
            );
          })}
        </select>
        <ChevronDown size={16} className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none", disabled ? "text-slate-600" : "text-theme-text-secondary")} />
      </div>
    </div>
  )
}

// ─── Searchable Combobox ──────────────────────────────────────────────────
// Replaces plain <select> for fields with many options (Project Name, Action).
// Supports type-to-filter, click-to-select, and click-outside-to-close.
function SearchableCombobox({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | DropdownOption)[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Display label for the currently selected value
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const opt = options.find((o) =>
      (typeof o === 'string' ? o : o.value) === value
    );
    return opt ? (typeof opt === 'string' ? opt : opt.label) : value;
  }, [value, options]);

  // Filter options by search query
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => {
      const lbl = typeof o === 'string' ? o : o.label;
      return lbl.toLowerCase().includes(q);
    });
  }, [options, query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optVal: string) => {
    onChange(optVal);
    setIsOpen(false);
    setQuery('');
  };

  // When open: show typed query; when closed: show selected label
  const displayValue = isOpen ? query : selectedLabel;

  return (
    <div ref={containerRef}>
      <label
        className={cn(
          'block text-sm font-medium mb-1.5 transition-colors',
          disabled ? 'text-slate-500' : 'text-theme-text-secondary'
        )}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setQuery('');
            }
          }}
          disabled={disabled}
          placeholder={selectedLabel || placeholder}
          autoComplete="off"
          className={cn(
            'w-full border rounded-lg py-2.5 px-4 pr-10 focus:outline-none focus:ring-2 transition-all text-sm',
            disabled
              ? 'bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border-theme-border dark:border-theme-border/50 text-slate-500 cursor-not-allowed'
              : 'bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border-strong dark:border-theme-border-strong text-theme-text focus:ring-indigo-500 focus:border-transparent cursor-text hover:border-slate-500'
          )}
        />
        <ChevronDown
          size={16}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200',
            disabled ? 'text-slate-600' : 'text-theme-text-secondary',
            isOpen && 'rotate-180'
          )}
        />

        {/* Dropdown list */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-theme-surface-modal border border-theme-border dark:border-theme-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Result count hint */}
            {query && (
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              </div>
            )}
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-500 text-center flex flex-col items-center gap-1">
                  <span className="text-2xl">🔍</span>
                  <span>No matches found</span>
                </div>
              ) : (
                filtered.map((opt) => {
                  const optVal = typeof opt === 'string' ? opt : opt.value;
                  const optLabel = typeof opt === 'string' ? opt : opt.label;
                  const isSelected = optVal === value;
                  return (
                    <button
                      key={optVal}
                      type="button"
                      // Use onMouseDown to fire before onBlur closes the dropdown
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(optVal); }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5 group',
                        isSelected
                          ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                          : 'text-theme-text-secondary hover:bg-slate-700/60 hover:text-theme-text'
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center justify-center w-4 h-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        <Check size={13} className="text-indigo-600 dark:text-indigo-400" />
                      </span>
                      <span className="leading-snug">{optLabel}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
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
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => onBlur && onBlur(value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border-strong dark:border-theme-border-strong rounded-lg py-2.5 pl-4 pr-10 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-text hover:border-slate-500 text-sm transition-all",
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
        <div className="absolute z-50 mt-1 max-h-48 overflow-y-auto w-full bg-theme-surface-modal border border-theme-border dark:border-theme-border rounded-xl shadow-2xl overflow-x-hidden">
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
                    ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-theme-text-secondary hover:bg-theme-surface-tertiary hover:text-theme-text"
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
