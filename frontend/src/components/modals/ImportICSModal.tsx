import { useState, useMemo, useEffect } from 'react';
import { X, Clock, Sparkles, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';

interface ICSEvent {
  summary: string;
  description: string;
  startDate: Date;
  endDate: Date;
  dateStr: string;      // YYYY-MM-DD
  startTimeStr: string; // HH:MM
  endTimeStr: string;   // HH:MM
  duration: number;     // Hours
}

interface ImportICSModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawICSContent: string;
  onImportSuccess: () => void;
  allowedProjects: any[];
  mapUserRole: any[];
  session: any;
}

export default function ImportICSModal({
  isOpen,
  onClose,
  rawICSContent,
  onImportSuccess,
  allowedProjects,
  mapUserRole,
  session
}: ImportICSModalProps) {
  const { showToast } = useNotification();
  const [parsedEvents, setParsedEvents] = useState<ICSEvent[]>([]);
  const [selectedEventIndexes, setSelectedEventIndexes] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const [icsText, setIcsText] = useState('');
  const [outlookUrl, setOutlookUrl] = useState('');
  const [isFetchingOutlook, setIsFetchingOutlook] = useState(false);

  useEffect(() => {
    if (rawICSContent) {
      setIcsText(rawICSContent);
    }
  }, [rawICSContent]);

  useEffect(() => {
    if (isOpen && !rawICSContent && session?.id) {
      async function loadOutlookUrl() {
        const { data } = await supabase
          .from('users')
          .select('outlook_calendar_url')
          .eq('id', session.id)
          .maybeSingle();
        if (data?.outlook_calendar_url) {
          setOutlookUrl(data.outlook_calendar_url);
        }
      }
      loadOutlookUrl();
    }
  }, [isOpen, rawICSContent, session]);

  const handleSyncOutlook = async () => {
    if (!outlookUrl.trim()) {
      showToast('กรุณาระบุลิงก์ปฏิทิน Outlook', 'warning');
      return;
    }
    setIsFetchingOutlook(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-outlook-calendar', {
        body: { outlookUrl: outlookUrl.trim() }
      });
      if (error) throw error;
      if (data?.icsData) {
        setIcsText(data.icsData);
        showToast('ดึงข้อมูลปฏิทิน Outlook สำเร็จ!', 'success');
      } else {
        throw new Error('ไม่พบข้อมูลปฏิทิน');
      }
    } catch (err: any) {
      console.error('Error syncing Outlook:', err);
      showToast('ไม่สามารถเชื่อมต่อปฏิทินได้: ' + err.message, 'error');
    } finally {
      setIsFetchingOutlook(false);
    }
  };

  // Form states matching cascading dropdowns
  const [selectedHolding, setSelectedHolding] = useState('');
  const [selectedRoleOperator, setSelectedRoleOperator] = useState('');
  const [projectType, setProjectType] = useState('');
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [module, setModule] = useState('');
  const [actionName, setActionName] = useState('');
  const [bu, setBu] = useState('');
  const [department, setDepartment] = useState('');

  // Dropdown list derivations
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
    return Array.from(new Set(filtered.map(p => p.project_type))).sort() as string[];
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

  const noModuleMode = selectedProjectKey && availableModules.length === 0;

  // Retrieve unique BUs and Departments from projects for dropdowns
  const { availableBUs, availableDepts } = useMemo(() => {
    if (!selectedProjectKey) return { availableBUs: [], availableDepts: [] };
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    const filtered = allowedProjects.filter(p =>
      p.project_name === pName &&
      p.holding === pHolding &&
      p.department_operator === pRole
    );
    return {
      availableBUs: Array.from(new Set(filtered.map(p => p.bu).filter(Boolean))).sort() as string[],
      availableDepts: Array.from(new Set(filtered.map(p => p.department).filter(Boolean))).sort() as string[]
    };
  }, [selectedProjectKey, allowedProjects]);

  const { availableBUsForModule, availableDeptsForModule } = useMemo(() => {
    if (!selectedProjectKey || !module) return { availableBUsForModule: [], availableDeptsForModule: [] };
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    const filtered = allowedProjects.filter(p =>
      p.project_name === pName &&
      p.holding === pHolding &&
      p.department_operator === pRole &&
      p.module === module
    );
    return {
      availableBUsForModule: Array.from(new Set(filtered.map(p => p.bu).filter(Boolean))).sort() as string[],
      availableDeptsForModule: Array.from(new Set(filtered.map(p => p.department).filter(Boolean))).sort() as string[]
    };
  }, [selectedProjectKey, module, allowedProjects]);

  const [masterActions, setMasterActions] = useState<any[]>([]);
  
  useEffect(() => {
    if (!isOpen) return;
    async function fetchActions() {
      try {
        const workspaceId = session?.activeWorkspaceId;
        let useGlobal = true;
        
        if (workspaceId && workspaceId !== 'N/A') {
          const { data: wsData } = await supabase
            .from('workspaces')
            .select('use_global_master')
            .eq('id', workspaceId)
            .maybeSingle();
          if (wsData) {
            useGlobal = wsData.use_global_master;
          }
        }

        let query = supabase.from('tb_master_action').select('*');
        if (workspaceId && workspaceId !== 'N/A') {
          if (useGlobal) {
            query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
          } else {
            query = query.eq('workspace_id', workspaceId);
          }
        }

        const { data } = await query;
        if (data) {
          setMasterActions(data);
        }
      } catch (err) {
        console.error('Error fetching actions in ImportICSModal:', err);
      }
    }
    fetchActions();
  }, [isOpen, session]);

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

  // Parse ICS logic
  useEffect(() => {
    if (!isOpen || !icsText) return;

    function parseICSDate(str: string): { date: Date; isAllDay: boolean } | null {
      if (!str) return null;
      const clean = str.trim().replace(/[^0-9TZ]/g, '');
      if (clean.length < 8) return null;
      
      const y = parseInt(clean.substring(0, 4), 10);
      const m = parseInt(clean.substring(4, 6), 10) - 1;
      const d = parseInt(clean.substring(6, 8), 10);
      
      if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

      const isAllDay = !clean.includes('T');
      if (isAllDay) {
        return { date: new Date(y, m, d, 0, 0, 0), isAllDay: true };
      }

      const tIndex = clean.indexOf('T');
      const h = parseInt(clean.substring(tIndex + 1, tIndex + 3), 10) || 0;
      const min = parseInt(clean.substring(tIndex + 3, tIndex + 5), 10) || 0;
      const s = parseInt(clean.substring(tIndex + 5, tIndex + 7), 10) || 0;
      
      if (clean.endsWith('Z')) {
        return { date: new Date(Date.UTC(y, m, d, h, min, s)), isAllDay: false };
      } else {
        return { date: new Date(y, m, d, h, min, s), isAllDay: false };
      }
    }

    const events: ICSEvent[] = [];
    const lines = icsText.split(/\r?\n/);
    let currentEvent: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        line += lines[i + 1].substring(1);
        i++;
      }
      line = line.trim();
      if (!line) continue;
      
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.dtstart) {
          const startParsed = parseICSDate(currentEvent.dtstart);
          if (startParsed) {
            const start = startParsed.date;
            const isAllDay = startParsed.isAllDay || (currentEvent.dtstartKey && currentEvent.dtstartKey.toUpperCase().includes('VALUE=DATE'));

            let end: Date;
            if (currentEvent.dtend) {
              const endParsed = parseICSDate(currentEvent.dtend);
              end = endParsed ? endParsed.date : (isAllDay ? new Date(start.getTime() + 86400000) : new Date(start.getTime() + 3600000));
            } else {
              end = isAllDay ? new Date(start.getTime() + 86400000) : new Date(start.getTime() + 3600000);
            }

            if (isAllDay) {
              // Calculate number of days in the all-day event
              const diffDays = Math.max(1, Math.min(31, Math.round((end.getTime() - start.getTime()) / 86400000)));
              
              for (let dayOffset = 0; dayOffset < diffDays; dayOffset++) {
                const dayDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayOffset);
                const yStr = dayDate.getFullYear();
                const mStr = String(dayDate.getMonth() + 1).padStart(2, '0');
                const dStr = String(dayDate.getDate()).padStart(2, '0');
                const dateStr = `${yStr}-${mStr}-${dStr}`;

                const eventSummary = diffDays > 1 
                  ? `${currentEvent.summary || 'Google Calendar Event'} (Day ${dayOffset + 1}/${diffDays})`
                  : (currentEvent.summary || 'Google Calendar Event');

                events.push({
                  summary: eventSummary,
                  description: currentEvent.description || '',
                  startDate: dayDate,
                  endDate: dayDate,
                  dateStr,
                  startTimeStr: '08:00',
                  endTimeStr: '17:00',
                  duration: 8.0
                });
              }
            } else {
              // Timed event
              let diffMs = end.getTime() - start.getTime();
              if (diffMs <= 0) diffMs = 3600000; // Fallback 1 hour if inverted/instant

              const rawDuration = Math.round((diffMs / 3600000) * 100) / 100;
              // Safe clamping between 0.25h (15m) and 24.0h
              const duration = Math.min(24.0, Math.max(0.25, isNaN(rawDuration) ? 1.0 : rawDuration));

              const yStr = start.getFullYear();
              const mStr = String(start.getMonth() + 1).padStart(2, '0');
              const dStr = String(start.getDate()).padStart(2, '0');
              const dateStr = `${yStr}-${mStr}-${dStr}`;
              
              const startH = String(start.getHours()).padStart(2, '0');
              const startM = String(start.getMinutes()).padStart(2, '0');
              const startTimeStr = `${startH}:${startM}`;
              
              const endH = String(end.getHours()).padStart(2, '0');
              const endM = String(end.getMinutes()).padStart(2, '0');
              const endTimeStr = `${endH}:${endM}`;

              events.push({
                summary: currentEvent.summary || 'Google Calendar Event',
                description: currentEvent.description || '',
                startDate: start,
                endDate: end,
                dateStr,
                startTimeStr,
                endTimeStr,
                duration
              });
            }
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const fullKey = line.substring(0, colonIdx);
          const val = line.substring(colonIdx + 1);
          const key = fullKey.split(';')[0].trim().toUpperCase();
          const cleanVal = val
            .replace(/\\,/g, ',')
            .replace(/\\n/g, '\n')
            .replace(/\\N/g, '\n')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');

          if (key === 'SUMMARY') {
            currentEvent.summary = cleanVal;
          } else if (key === 'DESCRIPTION') {
            currentEvent.description = cleanVal;
          } else if (key === 'DTSTART') {
            currentEvent.dtstart = val;
            currentEvent.dtstartKey = fullKey;
          } else if (key === 'DTEND') {
            currentEvent.dtend = val;
            currentEvent.dtendKey = fullKey;
          }
        }
      }
    }

    // Sort events by date descending
    const sorted = events.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    setParsedEvents(sorted);
    // Checked all by default
    setSelectedEventIndexes(sorted.map((_, idx) => idx));

    // Preset holding/operator if user has one
    if (availableHoldings.length > 0) setSelectedHolding(availableHoldings[0]);
  }, [isOpen, icsText, availableHoldings]);

  // Set default operators when holding changes
  useEffect(() => {
    if (availableRoleOperators.length > 0) {
      setSelectedRoleOperator(availableRoleOperators[0]);
    } else {
      setSelectedRoleOperator('');
    }
  }, [availableRoleOperators]);

  // Set default project type when operator changes
  useEffect(() => {
    if (availableProjectTypes.length > 0) {
      setProjectType(availableProjectTypes[0]);
    } else {
      setProjectType('');
    }
  }, [availableProjectTypes]);

  // Set default project name when type changes
  useEffect(() => {
    if (availableProjects.length > 0) {
      setSelectedProjectKey(availableProjects[0].value);
    } else {
      setSelectedProjectKey('');
    }
  }, [availableProjects]);

  // Set default module when project changes
  useEffect(() => {
    if (availableModules.length > 0) {
      setModule(availableModules[0]);
    } else {
      setModule('');
    }
  }, [availableModules]);

  // Auto-select unique BUs and Departments
  useEffect(() => {
    if (selectedProjectKey) {
      const buOpts = noModuleMode ? availableBUs : availableBUsForModule;
      const deptOpts = noModuleMode ? availableDepts : availableDeptsForModule;
      if (buOpts.length === 1) setBu(buOpts[0]);
      if (deptOpts.length === 1) setDepartment(deptOpts[0]);
    }
  }, [selectedProjectKey, module, noModuleMode, availableBUs, availableDepts, availableBUsForModule, availableDeptsForModule]);

  if (!isOpen) return null;

  const toggleEventSelect = (index: number) => {
    setSelectedEventIndexes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleImport = async () => {
    if (selectedEventIndexes.length === 0) {
      showToast('กรุณาเลือกกิจกรรมอย่างน้อย 1 รายการเพื่อนำเข้า / Please select at least 1 event', 'warning');
      return;
    }
    if (!projectType) {
      showToast('กรุณาเลือก Project Type', 'error');
      return;
    }
    if (!selectedProjectKey) {
      showToast('กรุณาเลือก Project Name', 'error');
      return;
    }
    if (availableModules.length > 0 && !module) {
      showToast('กรุณาเลือก Module', 'error');
      return;
    }
    const isBuDeptRequired = noModuleMode || (module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1));
    if (isBuDeptRequired) {
      if (!bu) {
        showToast('กรุณาเลือก Business Unit (BU)', 'error');
        return;
      }
      if (!department) {
        showToast('กรุณาเลือก Department', 'error');
        return;
      }
    }
    if (!actionName) {
      showToast('กรุณาเลือกกิจกรรม', 'error');
      return;
    }

    setIsImporting(true);
    try {
      const [pName] = selectedProjectKey.split('|');
      const inserts = selectedEventIndexes.map(index => {
        const ev = parsedEvents[index];
        const combinedDesc = ev.description 
          ? `[Imported] ${ev.summary}\n\n${ev.description}`
          : `[Imported] ${ev.summary}`;

        const rawDuration = Number(ev.duration);
        const safeTotalHours = (!isNaN(rawDuration) && rawDuration > 0)
          ? Math.min(24.0, Math.max(0.25, Math.round(rawDuration * 100) / 100))
          : 8.0;

        return {
          user_id: session.id,
          work_date: ev.dateStr,
          start_time: ev.startTimeStr.length === 5 ? ev.startTimeStr + ':00' : ev.startTimeStr,
          end_time: ev.endTimeStr.length === 5 ? ev.endTimeStr + ':00' : ev.endTimeStr,
          break_time: false,
          total_hours: safeTotalHours,
          holding: selectedHolding,
          department_operator: selectedRoleOperator,
          project_type: projectType,
          project_name: pName,
          module: module || null,
          bu,
          department,
          action_name: actionName,
          description: combinedDesc,
          channel: 'Google Calendar Import',
          is_ot: false,
          workspace_id: session?.activeWorkspaceId
        };
      });

      // Insert in batches of 50 to ensure high reliability for ~300+ items
      const BATCH_SIZE = 50;
      let totalSuccess = 0;
      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const chunk = inserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('col_worklog').insert(chunk);
        if (error) {
          throw new Error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (${error.message})`);
        }
        totalSuccess += chunk.length;
      }

      showToast(`นำเข้ากิจกรรมสำเร็จจำนวน ${totalSuccess} รายการ! / Imported ${totalSuccess} events successfully!`, 'success');
      onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error importing calendar events:', err);
      showToast('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const totalSelectedHours = selectedEventIndexes.reduce((sum, idx) => sum + parsedEvents[idx].duration, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-theme-surface-modal border border-theme-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 shrink-0">
          <div>
            <h2 className="text-lg font-black text-theme-text tracking-tight flex items-center gap-2">
              <Sparkles className="text-indigo-400" size={20} />
              <span>นำเข้าบันทึกปฏิทินงาน Google / Outlook Calendar (.ics)</span>
            </h2>
            <p className="text-xs text-theme-text-secondary mt-0.5">ระบุการจับคู่โครงการและเลือกกิจกรรมในปฏิทินงานที่คุณต้องการบันทึกเข้าระบบ</p>
          </div>
          <button 
            onClick={onClose}
            className="text-theme-text-secondary hover:text-theme-text bg-theme-surface-tertiary hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-xl transition-all"
            disabled={isImporting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">

          {/* Outlook Sync Option */}
          {(!rawICSContent || outlookUrl) && (
            <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-300/40 dark:border-indigo-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                    <Sparkles className="text-indigo-400" size={14} />
                    <span>ดึงปฏิทินแบบเรียลไทม์ผ่านลิงก์ Outlook / Sync via Outlook Feed Link</span>
                  </h4>
                  <p className="text-[11px] text-theme-text-secondary">
                    ป้อนลิงก์ปฏิทิน Outlook (.ics) หรืออัปเดตเพื่อกดซิงก์ดึงข้อมูลการประชุมล่าสุดโดยตรง
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncOutlook}
                  disabled={isFetchingOutlook || !outlookUrl}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/10 flex items-center gap-1.5 shrink-0"
                >
                  {isFetchingOutlook ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังดึงข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={12} />
                      <span>กดดึงข้อมูลปฏิทิน / Fetch Calendar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={outlookUrl}
                  onChange={e => setOutlookUrl(e.target.value)}
                  placeholder="วางลิงก์ https://outlook.office365.com/.../calendar.ics"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!outlookUrl.trim()) return;
                    const { error } = await supabase
                      .from('users')
                      .update({ outlook_calendar_url: outlookUrl })
                      .eq('id', session.id);
                    if (!error) {
                      showToast('บันทึกลิงก์ปฏิทินลงโปรไฟล์สำเร็จ / Outlook link saved!', 'success');
                    } else {
                      showToast('เกิดข้อผิดพลาดในการบันทึก: ' + error.message, 'error');
                    }
                  }}
                  className="px-3.5 py-2 border border-theme-border hover:bg-slate-100 dark:hover:bg-slate-700 text-theme-text-secondary hover:text-theme-text text-xs font-bold rounded-xl transition-all"
                >
                  บันทึกใช้งานถาวร / Save
                </button>
              </div>
            </div>
          )}
          
          {/* Section 1: Target Destination Configuration */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
              1. กำหนดการจับคู่โครงการและสังกัด (Import Classification)
            </h3>
            
            <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border rounded-2xl p-5 space-y-4">
              
              {/* Row 1: Holding & Role Operator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">HOLDING</label>
                  <select
                    value={selectedHolding}
                    onChange={e => { setSelectedHolding(e.target.value); setSelectedRoleOperator(''); }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select Holding —</option>
                    {availableHoldings.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">ROLE OPERATOR</label>
                  <select
                    value={selectedRoleOperator}
                    onChange={e => setSelectedRoleOperator(e.target.value)}
                    disabled={!selectedHolding}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— Select Role Operator —</option>
                    {availableRoleOperators.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Project Type & Project Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">PROJECT TYPE</label>
                  <select
                    value={projectType}
                    onChange={e => setProjectType(e.target.value)}
                    disabled={!selectedRoleOperator}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— Select Project Type —</option>
                    {availableProjectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">PROJECT NAME</label>
                  <select
                    value={selectedProjectKey}
                    onChange={e => setSelectedProjectKey(e.target.value)}
                    disabled={!projectType}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— Select Project —</option>
                    {availableProjects.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: Module & Action */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">MODULE / PHASE</label>
                  <select
                    value={module}
                    onChange={e => setModule(e.target.value)}
                    disabled={!selectedProjectKey || availableModules.length === 0}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">{availableModules.length === 0 && selectedProjectKey ? 'No Module (Auto-skip)' : '— Select Module —'}</option>
                    {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">ACTION CATEGORY</label>
                  <select
                    value={actionName}
                    onChange={e => setActionName(e.target.value)}
                    disabled={!projectType}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— Select Action —</option>
                    {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 4: BU & Dept */}
              {selectedProjectKey && (noModuleMode || (module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1))) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-theme-border/60 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">BUSINESS UNIT (BU)</label>
                    <select
                      value={bu}
                      onChange={e => { setBu(e.target.value); setDepartment(''); }}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— Select BU —</option>
                      {(noModuleMode ? availableBUs : availableBUsForModule).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">TARGET DEPARTMENT</label>
                    <select
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={!bu}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                    >
                      <option value="">— Select Department —</option>
                      {(noModuleMode ? availableDepts : availableDeptsForModule).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Section 2: Event list to select */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                2. เลือกกิจกรรมที่ต้องการบันทึก ({selectedEventIndexes.length} จาก {parsedEvents.length} รายการ)
              </h3>
              <div className="text-xs font-bold font-mono text-indigo-500 dark:text-indigo-300">
                รวมทั้งหมด {totalSelectedHours.toFixed(1)} ชั่วโมง
              </div>
            </div>

            <div className="border border-theme-border rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar bg-theme-surface-secondary/50 dark:bg-slate-950/20">
              {parsedEvents.length === 0 ? (
                <div className="p-8 text-center text-theme-text-muted italic text-xs">
                  ไม่พบกิจกรรมใด ๆ ในช่วงเวลาดังกล่าว / No events found
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-surface-secondary/80 text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border">
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedEventIndexes.length === parsedEvents.length}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedEventIndexes(parsedEvents.map((_, i) => i));
                            } else {
                              setSelectedEventIndexes([]);
                            }
                          }}
                          className="rounded border-slate-500 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-3 px-4 w-32">วันที่ / Date</th>
                      <th className="py-3 px-4 w-32">เวลา / Time</th>
                      <th className="py-3 px-4">กิจกรรมปฏิทิน / Calendar Activity</th>
                      <th className="py-3 px-4 w-20 text-center">ชั่วโมง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/50">
                    {parsedEvents.map((ev, idx) => {
                      const isChecked = selectedEventIndexes.includes(idx);
                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-indigo-50 dark:hover:bg-slate-700/20 transition-all cursor-pointer ${
                            isChecked ? 'bg-indigo-50 dark:bg-indigo-500/5' : ''
                          }`}
                          onClick={() => toggleEventSelect(idx)}
                        >
                          <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEventSelect(idx)}
                              className="rounded border-slate-500 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-theme-text">{ev.dateStr}</td>
                          <td className="py-3 px-4 text-theme-text-secondary font-mono flex items-center gap-1 mt-1">
                            <Clock size={12} />
                            <span>{ev.startTimeStr} - {ev.endTimeStr}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-theme-text block truncate max-w-[320px]">{ev.summary}</span>
                            {ev.description && (
                              <span className="text-[10px] text-theme-text-muted truncate block max-w-[320px]">{ev.description}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-indigo-600 dark:text-indigo-300 font-mono">{ev.duration}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
            <AlertTriangle size={14} className="text-amber-500" />
            <span>คำอธิบายของปฏิทินงานเดิมจะถูกแนบไปด้วย</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2.5 bg-theme-surface-tertiary hover:bg-slate-100 dark:hover:bg-slate-700 text-theme-text-secondary text-xs font-bold rounded-xl transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || selectedEventIndexes.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังนำเข้า...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>นำเข้า {selectedEventIndexes.length} รายการ</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
