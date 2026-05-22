import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Check, AlertTriangle, Calendar as CalendarIcon, Zap, Clock, Eye, Sparkles } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';
import { syncWorklogToGCal } from '../lib/google-calendar';

// Generate Time Options (00:00 to 24:00 - 24 Hours)
const timeOptions = Array.from({ length: 49 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  const period = hour >= 12 && hour < 24 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 && hour < 24 ? hour - 12 : (hour === 24 ? 12 : hour));
  const timeString = hour === 24 ? 'Midnight (24:00)' : `${displayHour.toString().padStart(2, '0')}:${min} ${period}`;
  const val24 = `${hour.toString().padStart(2, '0')}:${min}`;
  return { label: `${val24} (${timeString})`, value: val24 };
});

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
  const [session] = useState(() => JSON.parse(localStorage.getItem('worklog_session') || '{}'));
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [viewingLog, setViewingLog] = useState<any | null>(null);
  
  // Form State
  const [date, setDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isBreak, setIsBreak] = useState(true);
  const [description, setDescription] = useState('');
  const [isExplicitOt, setIsExplicitOt] = useState(false);
  const [isTimeCustomized, setIsTimeCustomized] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

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

  // Auto-calculated fields
  const [bu, setBu] = useState<string>('');
  const [department, setDepartment] = useState<string>('');

  // Supabase Data State
  const [mapUserRole, setMapUserRole] = useState<any[]>([]);
  const [mapProjectStructure, setMapProjectStructure] = useState<any[]>([]);
  const [masterActions, setMasterActions] = useState<any[]>([]);

  // Simulated User States
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [resolvedUserId, setResolvedUserId] = useState<string>('');

  // Daily context state
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  const [isHolidayDate, setIsHolidayDate] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load unique user list and default selection
  useEffect(() => {
    async function loadUsersAndResolve() {
      try {
        // Calculate clean name for current logged-in user
        let currentCleanName = 'Chatchawan';
        if (session.id) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('nickname, full_name')
            .eq('id', session.id)
            .maybeSingle();
            
          if (dbUser) {
            const rawName = dbUser.nickname || dbUser.full_name?.split(' ')[0] || '';
            currentCleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
          } else {
            const rawName = session.nickname || session.name?.split(' ')[0] || 'Chatchawan';
            currentCleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
          }
        } else {
          const rawName = session.nickname || session.name?.split(' ')[0] || 'Chatchawan';
          currentCleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
        }
        
        let isThai = /[\u0e00-\u0e7f]/.test(currentCleanName);
        if (isThai) {
          const fallbackName = session.nickname || '';
          if (fallbackName && !/[\u0e00-\u0e7f]/.test(fallbackName)) {
            currentCleanName = fallbackName.includes('_') ? fallbackName.split('_')[0] : fallbackName;
          } else {
            currentCleanName = 'Chatchawan';
          }
        }
        if (currentCleanName.includes('.')) {
          currentCleanName = currentCleanName.split('.')[0];
        }
        currentCleanName = currentCleanName.charAt(0).toUpperCase() + currentCleanName.slice(1);
        
        if (!currentCleanName.trim()) {
          currentCleanName = 'Chatchawan';
        }

        // We only want the logged-in user and Chatchawan in the list
        let uniqueNames: string[] = ['Chatchawan'];
        if (!uniqueNames.some(name => name.toLowerCase() === currentCleanName.toLowerCase())) {
          uniqueNames.push(currentCleanName);
        }
        
        uniqueNames.sort();
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

  // Resolve user_id whenever selectedUser changes
  useEffect(() => {
    async function resolveUser() {
      if (!selectedUser) return;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .ilike('nickname', `%${selectedUser}%`)
          .limit(1)
          .maybeSingle();
        
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
      let cleanName = 'Chatchawan';
      
      if (session.id) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('nickname, full_name')
          .eq('id', session.id)
          .maybeSingle();
          
        if (dbUser) {
          const rawName = dbUser.nickname || dbUser.full_name?.split(' ')[0] || '';
          cleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
        } else {
          const rawName = session.nickname || session.name?.split(' ')[0] || 'Chatchawan';
          cleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
        }
      } else {
        const rawName = session.nickname || session.name?.split(' ')[0] || 'Chatchawan';
        cleanName = rawName.includes('_') ? rawName.split('_')[0] : rawName;
      }
      
      let isThai = /[\u0e00-\u0e7f]/.test(cleanName);
      if (isThai) {
        const fallbackName = session.nickname || '';
        if (fallbackName && !/[\u0e00-\u0e7f]/.test(fallbackName)) {
          cleanName = fallbackName.includes('_') ? fallbackName.split('_')[0] : fallbackName;
        } else {
          cleanName = 'Chatchawan';
        }
      }
      if (cleanName.includes('.')) {
        cleanName = cleanName.split('.')[0];
      }
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      
      if (!cleanName.trim()) {
        cleanName = 'Chatchawan';
      }

      const targetUser = selectedUser || cleanName;
      console.log('LogWorkPage loading mappings for targetUser:', targetUser);

      const [resUser, resProj, resAct] = await Promise.all([
        supabase.from('tb_map_user_role').select('*').ilike('name', targetUser.trim()),
        supabase.from('tb_map_project_structure').select('*'),
        supabase.from('tb_master_action').select('*')
      ]);

      if (resUser.data && resUser.data.length > 0) {
        setMapUserRole(resUser.data);
      } else {
        const fallback = await supabase.from('tb_map_user_role').select('*').ilike('name', 'Chatchawan');
        if (fallback.data) setMapUserRole(fallback.data);
      }
      if (resProj.data) setMapProjectStructure(resProj.data);
      if (resAct.data) setMasterActions(resAct.data);
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
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .ilike('nickname', `%${selectedUser}%`)
            .limit(1)
            .maybeSingle();
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
      if (active) {
        if (logs) {
          setExistingEntries(logs);
        } else {
          setExistingEntries([]);
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
      mapUserRole.some(ur => 
        (ur.holding || '').trim().toLowerCase() === (proj.holding || '').trim().toLowerCase() && 
        (ur.department_operator || '').trim().toLowerCase() === (proj.department_operator || '').trim().toLowerCase()
      )
    );
  }, [mapProjectStructure, mapUserRole]);

  const availableHoldings = useMemo(() => {
    return Array.from(new Set(allowedProjects.map(p => p.holding).filter(Boolean))).sort() as string[];
  }, [allowedProjects]);

  const availableRoleOperators = useMemo(() => {
    if (!selectedHolding) return [];
    return Array.from(new Set(
      mapUserRole
        .filter(ur => (ur.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase())
        .map(ur => ur.department_operator)
        .filter(Boolean)
    )).sort() as string[];
  }, [mapUserRole, selectedHolding]);

  const availableProjectTypes = useMemo(() => {
    if (!selectedHolding || !selectedRoleOperator) return [];
    const filtered = allowedProjects.filter(p => 
      (p.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase() && 
      (p.department_operator || '').trim().toLowerCase() === selectedRoleOperator.trim().toLowerCase()
    );
    return Array.from(new Set(filtered.map(p => p.project_type))).sort();
  }, [allowedProjects, selectedHolding, selectedRoleOperator]);

  const availableProjects = useMemo(() => {
    if (!projectType || !selectedHolding || !selectedRoleOperator) return [];
    
    const typeProjs = allowedProjects.filter(p => 
      p.project_type === projectType && 
      (p.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase() && 
      (p.department_operator || '').trim().toLowerCase() === selectedRoleOperator.trim().toLowerCase()
    );
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
    if (!projectType) return [];
    const category = projectType === 'Management' ? 'Management' : projectType.includes('Support') ? 'Support' : 'Project';
    return masterActions.filter(a => a.action_category === category).map(a => a.action_name).sort();
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

  // Resets
  useEffect(() => {
    setSelectedRoleOperator('');
    setProjectType('');
    setSelectedProjectKey('');
  }, [selectedHolding]);

  useEffect(() => {
    setProjectType('');
    setSelectedProjectKey('');
  }, [selectedRoleOperator]);

  useEffect(() => {
    setSelectedProjectKey('');
  }, [projectType]);

  useEffect(() => {
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  }, [selectedProjectKey]);

  // Reset all selections when switching simulated user
  useEffect(() => {
    setSelectedHolding('');
    setSelectedRoleOperator('');
    setProjectType('');
    setSelectedProjectKey('');
    setModule('');
    setActionName('');
    setBu('');
    setDepartment('');
  }, [selectedUser]);

  // Auto-select if only 1 option available
  useEffect(() => {
    if (availableHoldings.length === 1 && !selectedHolding) {
      setSelectedHolding(availableHoldings[0]);
    }
  }, [availableHoldings, selectedHolding]);

  useEffect(() => {
    if (availableRoleOperators.length === 1 && !selectedRoleOperator) {
      setSelectedRoleOperator(availableRoleOperators[0]);
    }
  }, [availableRoleOperators, selectedRoleOperator]);

  useEffect(() => {
    if (availableProjectTypes.length === 1 && !projectType) {
      setProjectType(availableProjectTypes[0]);
    }
  }, [availableProjectTypes, projectType]);

  useEffect(() => {
    if (availableProjects.length === 1 && !selectedProjectKey) {
      setSelectedProjectKey(availableProjects[0].value);
    }
  }, [availableProjects, selectedProjectKey]);

  useEffect(() => {
    if (availableModules.length === 1 && !module) {
      setModule(availableModules[0]);
    }
  }, [availableModules, module]);

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

    // 1. Time overlap check
    let isOverlap = false;
    let overlappingEvent = '';

    for (const entry of existingEntries) {
      // Parse database start/end times ("08:00:00" -> "08:00")
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
          duration: preview.normalHours + preview.otHours
        }
      });

      if (error) throw error;
      
      if (data?.enhanced_text) {
        setDescription(data.enhanced_text);
        showToast('รายละเอียดงานได้รับการขัดเกลาด้วย AI เรียบร้อย! / Work description successfully polished by AI', 'success');
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 1. Perform validation checks to let the user know what's missing
    if (!projectType) {
      showToast('กรุณาเลือกประเภทงาน / Please select Project Type', 'error');
      return;
    }
    if (!selectedProjectKey || !projectName) {
      showToast('กรุณาเลือกโครงการ / Please select Project Name', 'error');
      return;
    }
    if (availableModules.length > 0 && !module) {
      showToast('กรุณาเลือกโมดูล / Please select Module', 'error');
      return;
    }
    const isBuDeptSelectable = noModuleMode || (projectName && module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1));
    if (isBuDeptSelectable) {
      if (!bu) {
        showToast('กรุณาเลือก Business Unit (BU) / Please select Business Unit', 'error');
        return;
      }
      if (!department) {
        showToast('กรุณาเลือก Target Department / Please select Target Department', 'error');
        return;
      }
    }
    if (!actionName) {
      showToast('กรุณาเลือกกิจกรรม / Please select Action', 'error');
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
        showToast(`ไม่สามารถบันทึกได้เนื่องจากมีเวลาคาบเกี่ยวกับรายการอื่น (${preview.overlappingEvent})`, 'error');
        return;
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

      if (finalSegments.length > 1) {
        // We need to SPLIT this entry!
        for (let i = 0; i < finalSegments.length; i++) {
          const segment = finalSegments[i];
          const segmentPrefix = segment.is_ot ? '[OT]' : '[Normal]';

          const { data, error } = await supabase.from('col_worklog').insert({
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
            is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt
          }).select('id').maybeSingle();

          if (error) throw error;
          if (data) {
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

        const { data, error } = await supabase.from('col_worklog').insert({
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
          is_implied_ot: segment.is_ot && !isHolidayDate && !isExplicitOt
        }).select('id').maybeSingle();

        if (error) throw error;
        if (data) {
          // Trigger sync in background
          syncWorklogToGCal(data.id, 'insert');
        }
      }
      
      showToast('บันทึกใบงานสำเร็จแล้ว! / Work log saved successfully!', 'success');
      
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
      setIsTimeCustomized(false);
      setStartTime('08:00');
      setEndTime('17:00');
      
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err: any) {
      console.error(err);
      showToast('Error saving worklog: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8 tracking-tight">Log Work</h1>
        
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-xl shadow-black/20">
          
          {/* Date Picker & User Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">เลือกวันที่ / Select Date</label>
              <div className="relative w-full">
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <DropdownField
              label="ผู้ใช้งานจำลองสิทธิ์ / Simulating User"
              value={selectedUser}
              onChange={(v) => setSelectedUser(v)}
              options={allUsers.map((u) => ({
                value: u,
                label: `${u}${u.toLowerCase() === (session.nickname || '').split('_')[0].toLowerCase() ? ' (You)' : ''}`
              }))}
              placeholder="เลือกผู้ใช้งาน / Select User"
            />
          </div>

          <div className="h-px bg-slate-700/50 w-full mb-8"></div>

          {/* Cascading Logic Area */}
          <div className="space-y-6 mb-8">
            
            {/* Row 1: Holding & Role Operator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DropdownField
                label="Holding"
                value={selectedHolding}
                onChange={setSelectedHolding}
                options={availableHoldings}
                placeholder="Select Holding"
              />
              <DropdownField
                label="Role Operator (Department Operator)"
                value={selectedRoleOperator}
                onChange={setSelectedRoleOperator}
                options={availableRoleOperators}
                disabled={!selectedHolding}
                placeholder={!selectedHolding ? "Select Holding first" : "Select Role Operator"}
              />
            </div>

            {/* Row 2: Project Type & Project Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DropdownField 
                label="Project Type" 
                value={projectType} 
                onChange={setProjectType} 
                options={availableProjectTypes}
                disabled={!selectedRoleOperator}
                placeholder="Select Type"
              />
              <SearchableCombobox
                label="Project Name"
                value={selectedProjectKey}
                onChange={setSelectedProjectKey}
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">BUSINESS UNIT <span className="text-rose-400">*</span></label>
                      <select
                        value={bu}
                        onChange={e => { setBu(e.target.value); setDepartment(''); }}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-[#0F172A]/80 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      >
                        <option value="">— Select BU —</option>
                        {buOpts.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">TARGET DEPARTMENT <span className="text-rose-400">*</span></label>
                      <select
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        disabled={!bu}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-[#0F172A]/80 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-40"
                      >
                        <option value="">— Select Department —</option>
                        {deptOpts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs font-semibold text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">Business Unit:</span>
                      <span className="text-slate-200 font-mono">{bu || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">Target Department:</span>
                      <span className="text-slate-200 font-mono">{department || '-'}</span>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Optional Action Channels as Clickable Tag Chips */}
            <div className="space-y-2 mt-4">
              <label className="block text-xs font-semibold text-slate-400">ช่องทางการสื่อสาร (Action Channels - Optional)</label>
              <div className="flex flex-wrap gap-2.5">
                {['Meeting', 'Discuss via phone', 'On site'].map((channelOption) => {
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
                          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 border-indigo-400/30 text-white hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/10 animate-in zoom-in-95 duration-100"
                          : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-slate-600"
                      )}
                    >
                      {channelOption === 'Meeting' && <span className="text-sm">👥</span>}
                      {channelOption === 'Discuss via phone' && <span className="text-sm">📞</span>}
                      {channelOption === 'On site' && <span className="text-sm">📍</span>}
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
                  <span className="text-slate-400">Auto-filled BU: </span><span className="text-white font-medium mr-4">{bu}</span>
                  <span className="text-slate-400">Dept: </span><span className="text-white font-medium">{department}</span>
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
                  <label className="block text-sm font-medium text-slate-300">ระบุเวลา / Specify Time</label>
                  <div className="flex bg-[#0F172A] p-1 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTimeMode('range')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        timeMode === 'range' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      🕒 ช่วงเวลา
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeMode('duration')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        timeMode === 'duration' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      ⏳ จำนวนชั่วโมง
                    </button>
                  </div>
                </div>

                {timeMode === 'range' ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <span className="block text-xs text-slate-400 mb-1">เวลาเริ่มต้น / Start Time</span>
                      <div className="relative">
                        <select 
                          value={startTime}
                          onChange={e => { setStartTime(e.target.value); setIsTimeCustomized(true); }}
                          className="w-full appearance-none bg-[#0F172A] border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {timeOptions.map(t => <option key={`start-${t.value}`} value={t.value}>{t.label}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <span className="text-slate-500 mt-4">-</span>
                    <div className="flex-1">
                      <span className="block text-xs text-slate-400 mb-1">เวลาสิ้นสุด / End Time</span>
                      <div className="relative">
                        <select 
                          value={endTime}
                          onChange={e => { setEndTime(e.target.value); setIsTimeCustomized(true); }}
                          className="w-full appearance-none bg-[#0F172A] border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {timeOptions.map(t => <option key={`end-${t.value}`} value={t.value}>{t.label}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 max-w-xs">
                    <span className="block text-xs text-slate-400 mb-1">จำนวนชั่วโมง / Hours spent</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.5"
                        min="0.5"
                        value={durationHours}
                        onChange={e => setDurationHours(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center space-x-3 cursor-pointer group flex-1">
                  <div className={cn(
                    "relative flex items-center justify-center w-5 h-5 rounded border transition-colors",
                    isBreak ? "bg-indigo-500 border-indigo-500" : "bg-[#0F172A] border-slate-500 group-hover:border-indigo-400"
                  )}>
                    <input type="checkbox" checked={isBreak} onChange={e => setIsBreak(e.target.checked)} className="sr-only" />
                    {isBreak && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">หักพักเบรกเที่ยง / Break (1 hr)</span>
                </label>

                <label className={cn(
                  "flex items-center space-x-3 cursor-pointer group flex-1",
                  isHolidayDate ? "opacity-60 cursor-not-allowed" : ""
                )}>
                  <div className={cn(
                    "relative flex items-center justify-center w-5 h-5 rounded border transition-colors",
                    isExplicitOt ? "bg-amber-500 border-amber-500" : "bg-[#0F172A] border-slate-500 group-hover:border-amber-400"
                  )}>
                    <input 
                      type="checkbox" 
                      checked={isExplicitOt} 
                      onChange={e => !isHolidayDate && setIsExplicitOt(e.target.checked)} 
                      disabled={isHolidayDate}
                      className="sr-only" 
                    />
                    {isExplicitOt && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">บันทึกเป็น OT เจาะจง / Explicit OT</span>
                </label>
              </div>
            </div>

            {/* Hours Display Breakdown */}
            <div className="w-full md:w-80 bg-slate-900 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="mb-4">
                <span className="text-slate-400 text-sm font-medium">รวมเวลาทำงาน / Total Hours</span>
                <div className="flex items-baseline mt-1">
                  <span className="text-4xl font-bold text-white tracking-tight">{preview.duration.toFixed(1)}</span>
                  <span className="text-sm text-slate-400 ml-1.5 font-medium">hrs</span>
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">ชั่วโมงปกติ / Regular:</span>
                  <span className="text-slate-200 font-semibold">{preview.normalHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">ชั่วโมง OT / Overtime:</span>
                  <span className="text-amber-400 font-semibold">{preview.otHours.toFixed(1)} hrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-2">รายละเอียดงาน / Work Description</label>
            <textarea 
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What did you work on today?"
              className="w-full bg-[#0F172A] border border-slate-600 rounded-lg p-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none mb-3"
            ></textarea>
            
            {/* AI Enhancement Container */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
                  <Sparkles size={16} className={cn("animate-pulse", isEnhancing && "animate-spin")} />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-400 uppercase font-black tracking-widest block mb-0.5">ขัดเกลาคำด้วย AI / AI Sparkle</span>
                  <span className="text-xs text-slate-400 leading-normal block">
                    ช่วยเกลาคำอธิบายงานให้ออกมาในแง่บวก เห็นภาพความสำเร็จ ประหยัดเวลา และประหยัดต้นทุนสำหรับผู้บริหาร
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnhanceDescription}
                disabled={isEnhancing}
                className={cn(
                  "px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700/50 text-white text-xs font-bold rounded-xl border border-indigo-500/30 shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95 transition-all",
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
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-6 border-t border-slate-700/50">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก / Save Log'}
            </button>
          </div>

          {/* Validation & Holiday Premium Alerts */}
          <div className="space-y-4 mt-6">
            {preview.isOverlap && (holding || isTimeCustomized) && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-red-300">ช่วงเวลาทำงานทับซ้อนกัน / Time Overlap Alert</h4>
                  <p className="text-sm text-red-400 mt-1">เวลาที่คุณเลือกทับซ้อนกับรายการที่บันทึกแล้ว: <span className="font-semibold text-white">{preview.overlappingEvent}</span></p>
                </div>
              </div>
            )}

            {isHolidayDate && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-200">
                <CalendarIcon className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-amber-300">วันหยุดนักขัตฤกษ์ / วันหยุดเสาร์-อาทิตย์ ({holidayName})</h4>
                  <p className="text-sm text-amber-400 mt-1">ชั่วโมงทำงานทั้งหมดของวันหยุดจะถูกคิดสัดส่วนสะสมเป็นชั่วโมง OT ทั้งหมด 🌟</p>
                </div>
              </div>
            )}

            {preview.isImpliedOt && (holding || isTimeCustomized) && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start gap-3 text-indigo-200">
                <Zap className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-indigo-300">ชั่วโมงสะสมปกติเกิน 8 ชม. ต่อวัน / Implied Overtime</h4>
                  <p className="text-sm text-indigo-400 mt-1">
                    ยอดรวมชั่วโมงงานปกติในวันนี้ของคุณเต็ม 8 ชม. แล้ว ส่วนต่างอีก <span className="font-semibold text-white">{preview.otHours.toFixed(1)} ชม.</span> จะถูกปัดเป็น OT แฝงให้อัตโนมัติ
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Today's Logged Activities */}
          {existingEntries.length > 0 && (
            <div className="mt-10 pt-8 border-t border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-indigo-400" />
                <span>งานที่คุณบันทึกแล้วในวันนี้ / Activities Logged Today</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {existingEntries.map((entry) => (
                  <div key={entry.id} className="bg-[#0F172A]/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-white text-sm line-clamp-1">{entry.project_name}</h4>
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-full",
                          entry.is_ot || entry.is_implied_ot 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        )}>
                          {entry.is_ot ? 'OT' : entry.is_implied_ot ? 'OT แฝง' : 'ปกติ'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{entry.module || 'No Module'} • {entry.action_name}</p>
                      {entry.description && (
                        <p className="text-xs text-slate-300 line-clamp-2 italic bg-slate-800/30 p-2 rounded border border-slate-700/30 mb-2">
                          "{entry.description}"
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-800 pt-2 mt-1">
                      <span>{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setViewingLog(entry)}
                          className="text-slate-400 hover:text-slate-200 font-semibold transition-colors uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
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
                        <span className="font-medium text-slate-200">{Number(entry.total_hours).toFixed(1)} hrs</span>
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
      <label className={cn("block text-sm font-medium mb-1.5 transition-colors", disabled ? "text-slate-500" : "text-slate-300")}>
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
              ? "bg-[#0F172A]/50 border-slate-700/50 text-slate-500 cursor-not-allowed" 
              : "bg-[#0F172A] border-slate-600 text-slate-200 focus:ring-indigo-500 focus:border-transparent cursor-pointer hover:border-slate-500"
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
        <ChevronDown size={16} className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none", disabled ? "text-slate-600" : "text-slate-400")} />
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
          disabled ? 'text-slate-500' : 'text-slate-300'
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
              ? 'bg-[#0F172A]/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-[#0F172A] border-slate-600 text-slate-200 focus:ring-indigo-500 focus:border-transparent cursor-text hover:border-slate-500'
          )}
        />
        <ChevronDown
          size={16}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200',
            disabled ? 'text-slate-600' : 'text-slate-400',
            isOpen && 'rotate-180'
          )}
        />

        {/* Dropdown list */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
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
                          : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center justify-center w-4 h-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        <Check size={13} className="text-indigo-400" />
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
