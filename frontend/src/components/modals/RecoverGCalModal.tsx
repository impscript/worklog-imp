import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Clock, Sparkles, RefreshCw, CheckCircle2, Search, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { googleCalendar } from '../../lib/google-calendar';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import ModalPortal from './ModalPortal';

interface ProjectStructure {
  id?: string;
  project_name: string;
  holding?: string;
  department_operator?: string;
  project_type?: string;
  module?: string | null;
  bu?: string;
  department?: string;
}

interface UserRole {
  id?: string;
  holding?: string;
  department_operator?: string;
  name?: string;
  user_id?: string;
}

interface MasterAction {
  id?: string;
  action_name: string;
  action_category?: string;
}

interface SessionUser {
  id: string;
  emp_id?: string;
  active_workspace_id?: string;
  activeWorkspaceId?: string;
  full_name?: string;
}

export interface RecoverableEvent {
  id: string;
  gcalEventId: string;
  summary: string;
  rawDescription: string;
  cleanDescription: string;
  workDate: string;      // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  duration: number;      // Hours
  isAllDay: boolean;
  isOT: boolean;
  
  // Existing state in DB
  alreadyInDB: boolean;
  existingWorklogId?: string;

  // Detected pattern from event
  hasPattern: boolean;
  detectedProjectName?: string;
  detectedProjectType?: string;
  detectedModule?: string | null;
  detectedHolding?: string;
  detectedRoleOperator?: string;
  detectedBu?: string;
  detectedDept?: string;
  detectedActionName?: string;
  detectedDescription?: string;
}

interface RecoverGCalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoverySuccess: () => void;
  sessionUser: SessionUser | null;
  targetMonth: Date;
  workspaceId?: string;
}

const MONTH_NAMES = [
  'มกราคม (January)', 'กุมภาพันธ์ (February)', 'มีนาคม (March)', 'เมษายน (April)',
  'พฤษภาคม (May)', 'มิถุนายน (June)', 'กรกฎาคม (July)', 'สิงหาคม (August)',
  'กันยายน (September)', 'ตุลาคม (October)', 'พฤศจิกายน (November)', 'ธันวาคม (December)'
];

export default function RecoverGCalModal({
  isOpen,
  onClose,
  onRecoverySuccess,
  sessionUser,
  targetMonth,
  workspaceId
}: RecoverGCalModalProps) {
  const { showToast } = useNotification();

  // ── Month Range Calculations ─────────────────────────────────────────────
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  // ── Master Data States ───────────────────────────────────────────────────
  const [allowedProjects, setAllowedProjects] = useState<ProjectStructure[]>([]);
  const [mapUserRole, setMapUserRole] = useState<UserRole[]>([]);
  const [masterActions, setMasterActions] = useState<MasterAction[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  // ── GCal Events & Recovery States ────────────────────────────────────────
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [events, setEvents] = useState<RecoverableEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'missing' | 'existing'>('missing');
  const [searchQuery, setSearchQuery] = useState('');
  const [forceOverrideAll, setForceOverrideAll] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // ── Target Mapping Dropdown States ───────────────────────────────────────
  const [selectedHolding, setSelectedHolding] = useState('');
  const [selectedRoleOperator, setSelectedRoleOperator] = useState('');
  const [projectType, setProjectType] = useState('');
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [module, setModule] = useState('');
  const [actionName, setActionName] = useState('');
  const [bu, setBu] = useState('');
  const [department, setDepartment] = useState('');

  // ── Cascading State Updaters ─────────────────────────────────────────────
  const applyCascades = useCallback((
    newHolding: string,
    newRoleOp: string,
    newType: string,
    newProjKey: string,
    projsList: ProjectStructure[],
    rolesList: UserRole[]
  ) => {
    // 1. Resolve Holding
    let resolvedHolding = newHolding;
    const holdings = Array.from(new Set(projsList.map(p => p.holding).filter(Boolean))) as string[];
    if (!resolvedHolding && holdings.length > 0) {
      resolvedHolding = holdings[0];
    }
    setSelectedHolding(resolvedHolding);

    // 2. Resolve Role Operator
    let resolvedRoleOp = newRoleOp;
    const operators = Array.from(new Set(
      rolesList
        .filter(ur => {
          const holdingWild = (ur.holding || '').trim().toLowerCase() === 'all' || (ur.holding || '').trim().toLowerCase() === 'all holding';
          return holdingWild || (ur.holding || '').trim().toLowerCase() === resolvedHolding.trim().toLowerCase();
        })
        .map(ur => ur.department_operator)
        .filter(Boolean)
    )) as string[];
    if (!operators.includes(resolvedRoleOp)) {
      resolvedRoleOp = operators[0] || '';
    }
    setSelectedRoleOperator(resolvedRoleOp);

    // 3. Resolve Project Type
    let resolvedType = newType;
    const types = Array.from(new Set(
      projsList
        .filter(p =>
          (p.holding || '').trim().toLowerCase() === resolvedHolding.trim().toLowerCase() &&
          (p.department_operator || '').trim().toLowerCase() === resolvedRoleOp.trim().toLowerCase()
        )
        .map(p => p.project_type)
        .filter(Boolean)
    )) as string[];
    if (!types.includes(resolvedType)) {
      resolvedType = types[0] || '';
    }
    setProjectType(resolvedType);

    // 4. Resolve Project Key
    let resolvedKey = newProjKey;
    const typeProjs = projsList.filter(p =>
      p.project_type === resolvedType &&
      (p.holding || '').trim().toLowerCase() === resolvedHolding.trim().toLowerCase() &&
      (p.department_operator || '').trim().toLowerCase() === resolvedRoleOp.trim().toLowerCase()
    );
    const availableKeys = Array.from(new Set(typeProjs.map(p => `${p.project_name}|${p.holding}|${p.department_operator}`)));
    if (!availableKeys.includes(resolvedKey)) {
      resolvedKey = availableKeys[0] || '';
    }
    setSelectedProjectKey(resolvedKey);

    // 5. Resolve Module & BU/Dept
    if (resolvedKey) {
      const [pName, pHolding, pRole] = resolvedKey.split('|');
      const filteredForMod = projsList.filter(p =>
        p.project_type === resolvedType &&
        p.project_name === pName &&
        p.holding === pHolding &&
        p.department_operator === pRole
      );
      const modOptions = Array.from(new Set(filteredForMod.map(p => p.module).filter(Boolean))) as string[];
      const resolvedMod = modOptions[0] || '';
      setModule(resolvedMod);

      const buOptions = Array.from(new Set(filteredForMod.map(p => p.bu).filter(Boolean))) as string[];
      const deptOptions = Array.from(new Set(filteredForMod.map(p => p.department).filter(Boolean))) as string[];
      setBu(buOptions[0] || '');
      setDepartment(deptOptions[0] || '');
    } else {
      setModule('');
      setBu('');
      setDepartment('');
    }
  }, []);

  const handleHoldingChange = (h: string) => {
    applyCascades(h, '', '', '', allowedProjects, mapUserRole);
  };

  const handleRoleOperatorChange = (op: string) => {
    applyCascades(selectedHolding, op, '', '', allowedProjects, mapUserRole);
  };

  const handleProjectTypeChange = (t: string) => {
    applyCascades(selectedHolding, selectedRoleOperator, t, '', allowedProjects, mapUserRole);
  };

  const handleProjectKeyChange = (key: string) => {
    applyCascades(selectedHolding, selectedRoleOperator, projectType, key, allowedProjects, mapUserRole);
  };

  const handleModuleChange = (modVal: string) => {
    setModule(modVal);
    if (!selectedProjectKey) return;
    const [pName, pHolding, pRole] = selectedProjectKey.split('|');
    const filtered = allowedProjects.filter(p =>
      p.project_name === pName &&
      p.holding === pHolding &&
      p.department_operator === pRole &&
      (!modVal || p.module === modVal)
    );
    const bus = Array.from(new Set(filtered.map(p => p.bu).filter(Boolean))) as string[];
    const depts = Array.from(new Set(filtered.map(p => p.department).filter(Boolean))) as string[];
    if (bus.length === 1) setBu(bus[0]);
    if (depts.length === 1) setDepartment(depts[0]);
  };

  // ── Load Master Data (Roles, Projects, Actions) ──────────────────────────
  const loadMasterData = useCallback(async () => {
    if (!sessionUser?.id) return;
    setIsLoadingMaster(true);
    try {
      const activeWs = workspaceId || sessionUser.activeWorkspaceId || sessionUser.active_workspace_id;
      let useGlobal = true;

      if (activeWs && activeWs !== 'N/A') {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('use_global_master')
          .eq('id', activeWs)
          .maybeSingle();
        if (wsData) useGlobal = wsData.use_global_master;
      }

      // Query User Role
      let userQuery = supabase
        .from('tb_map_user_role')
        .select('*')
        .eq('user_id', sessionUser.id)
        .eq('is_active', true);
      if (activeWs && activeWs !== 'N/A') {
        userQuery = useGlobal
          ? (userQuery.or(`workspace_id.eq.${activeWs},workspace_id.is.null`) as unknown as typeof userQuery)
          : (userQuery.eq('workspace_id', activeWs) as unknown as typeof userQuery);
      }

      // Query Projects
      let projQuery = supabase
        .from('tb_map_project_structure')
        .select('*')
        .eq('is_active', true);
      if (activeWs && activeWs !== 'N/A') {
        projQuery = useGlobal
          ? (projQuery.or(`workspace_id.eq.${activeWs},workspace_id.is.null`) as unknown as typeof projQuery)
          : (projQuery.eq('workspace_id', activeWs) as unknown as typeof projQuery);
      }

      // Query Actions
      let actQuery = supabase
        .from('tb_master_action')
        .select('*')
        .eq('is_active', true);
      if (activeWs && activeWs !== 'N/A') {
        actQuery = useGlobal
          ? (actQuery.or(`workspace_id.eq.${activeWs},workspace_id.is.null`) as unknown as typeof actQuery)
          : (actQuery.eq('workspace_id', activeWs) as unknown as typeof actQuery);
      }

      const [resUser, resProj, resAct] = await Promise.all([userQuery, projQuery, actQuery]);

      let userRoles: UserRole[] = resUser.data || [];
      if (userRoles.length === 0 && sessionUser.emp_id) {
        const { data: empFallback } = await supabase
          .from('tb_map_user_role')
          .select('*')
          .eq('name', sessionUser.emp_id)
          .eq('is_active', true);
        if (empFallback && empFallback.length > 0) userRoles = empFallback;
      }
      setMapUserRole(userRoles);

      let projs: ProjectStructure[] = resProj.data || [];
      if (projs.length === 0) {
        const { data: regProjs } = await supabase
          .from('tb_project_registry')
          .select('*')
          .not('status', 'in', '("inactive","retired")');
        if (regProjs) projs = regProjs;
      }

      let activeAllowed: ProjectStructure[] = projs;
      if (userRoles.length > 0) {
        const filtered = projs.filter((p) =>
          userRoles.some((ur) => {
            const holdingWild = (ur.holding || '').trim().toLowerCase() === 'all' || (ur.holding || '').trim().toLowerCase() === 'all holding';
            const deptWild = (ur.department_operator || '').trim().toLowerCase() === 'all';
            const holdingMatch = holdingWild || (ur.holding || '').trim().toLowerCase() === (p.holding || '').trim().toLowerCase();
            const deptMatch = deptWild || (ur.department_operator || '').trim().toLowerCase() === (p.department_operator || '').trim().toLowerCase();
            return holdingMatch && deptMatch;
          })
        );
        activeAllowed = filtered.length > 0 ? filtered : projs;
      }
      setAllowedProjects(activeAllowed);

      const actionList: MasterAction[] = resAct.data || [];
      setMasterActions(actionList);

      // Initialize dropdown cascade defaults
      applyCascades('', '', '', '', activeAllowed, userRoles);
      if (actionList.length > 0) {
        setActionName(actionList[0].action_name);
      }
    } catch (err) {
      console.error('[RecoverGCalModal] Error loading master data:', err);
    } finally {
      setIsLoadingMaster(false);
    }
  }, [sessionUser, workspaceId, applyCascades]);

  // ── Fetch & Parse GCal Events for Target Month ───────────────────────────
  const fetchMonthGCalEvents = useCallback(async () => {
    if (!sessionUser?.id) return;
    setIsLoadingEvents(true);
    setEvents([]);
    setSelectedEventIds([]);

    try {
      const { data: user } = await supabase
        .from('users')
        .select('gcal_calendar_id')
        .eq('id', sessionUser.id)
        .maybeSingle();

      const calendarId = user?.gcal_calendar_id || 'primary';

      // 1. Fetch raw Google Calendar events
      const rawEvents = await googleCalendar.listEventsForRange(
        sessionUser.id,
        calendarId,
        monthStart,
        monthEnd
      );

      // 2. Fetch existing col_worklog records for this user & month range
      const activeWs = workspaceId || sessionUser.activeWorkspaceId || sessionUser.active_workspace_id;
      let dbQuery = supabase
        .from('col_worklog')
        .select('id, gcal_event_id, work_date, start_time, end_time, project_name, action_name')
        .eq('user_id', sessionUser.id)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd);

      if (activeWs && activeWs !== 'N/A') {
        dbQuery = dbQuery.eq('workspace_id', activeWs);
      }

      const { data: existingLogs } = await dbQuery;
      const existingGcalIdMap = new Map<string, string>();
      const existingDateSigSet = new Set<string>();

      (existingLogs || []).forEach(log => {
        if (log.gcal_event_id) {
          existingGcalIdMap.set(log.gcal_event_id, log.id);
        }
        if (log.work_date && log.start_time) {
          const normTime = log.start_time.slice(0, 5);
          existingDateSigSet.add(`${log.work_date}|${normTime}`);
        }
      });

      // 3. Process events & detect patterns
      const parsedList: RecoverableEvent[] = [];

      for (const evt of rawEvents) {
        const summary = (evt.summary || 'Google Calendar Event').trim();
        const rawDesc = evt.description || '';
        const cleanDesc = googleCalendar.convertHtmlToPlainText(rawDesc);

        const startDateTime = evt.start?.dateTime || evt.start?.date;
        if (!startDateTime) continue;

        const isAllDay = !evt.start?.dateTime;
        let startDate: Date;
        let endDate: Date;

        if (isAllDay) {
          const parts = evt.start.date.split('-');
          startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (evt.end?.date) {
            const endParts = evt.end.date.split('-');
            endDate = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
          } else {
            endDate = new Date(startDate.getTime() + 86400000);
          }
        } else {
          startDate = new Date(evt.start.dateTime);
          endDate = evt.end?.dateTime ? new Date(evt.end.dateTime) : new Date(startDate.getTime() + 3600000);
        }

        const existsById = existingGcalIdMap.has(evt.id);
        const existingWorklogId = existingGcalIdMap.get(evt.id);

        const parsedWorklog = googleCalendar.parseEventDescriptionToWorklog(evt, sessionUser.id);
        const hasPattern = Boolean(parsedWorklog);

        if (isAllDay) {
          const diffDays = Math.max(1, Math.min(31, Math.round((endDate.getTime() - startDate.getTime()) / 86400000)));

          for (let dayOffset = 0; dayOffset < diffDays; dayOffset++) {
            const dayDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayOffset);
            const yStr = dayDate.getFullYear();
            const mStr = String(dayDate.getMonth() + 1).padStart(2, '0');
            const dStr = String(dayDate.getDate()).padStart(2, '0');
            const dateStr = `${yStr}-${mStr}-${dStr}`;

            const itemSummary = diffDays > 1 ? `${summary} (Day ${dayOffset + 1}/${diffDays})` : summary;
            const subKey = `${evt.id}_day_${dayOffset}`;
            const alreadyInDB = existsById || existingDateSigSet.has(`${dateStr}|08:00`);

            parsedList.push({
              id: subKey,
              gcalEventId: evt.id,
              summary: itemSummary,
              rawDescription: rawDesc,
              cleanDescription: cleanDesc,
              workDate: dateStr,
              startTime: '08:00',
              endTime: '17:00',
              duration: 8.0,
              isAllDay: true,
              isOT: parsedWorklog?.is_ot || false,
              alreadyInDB,
              existingWorklogId,
              hasPattern,
              detectedProjectName: parsedWorklog?.project_name,
              detectedProjectType: parsedWorklog?.project_type,
              detectedModule: parsedWorklog?.module,
              detectedHolding: parsedWorklog?.holding,
              detectedRoleOperator: parsedWorklog?.department_operator,
              detectedBu: parsedWorklog?.bu,
              detectedDept: parsedWorklog?.department,
              detectedActionName: parsedWorklog?.action_name,
              detectedDescription: parsedWorklog?.description
            });
          }
        } else {
          let diffMs = endDate.getTime() - startDate.getTime();
          if (diffMs <= 0) diffMs = 3600000;
          const rawDuration = Math.round((diffMs / 3600000) * 100) / 100;
          const duration = Math.min(24.0, Math.max(0.25, isNaN(rawDuration) ? 1.0 : rawDuration));

          const yStr = startDate.getFullYear();
          const mStr = String(startDate.getMonth() + 1).padStart(2, '0');
          const dStr = String(startDate.getDate()).padStart(2, '0');
          const dateStr = `${yStr}-${mStr}-${dStr}`;

          const startH = String(startDate.getHours()).padStart(2, '0');
          const startM = String(startDate.getMinutes()).padStart(2, '0');
          const startTime = `${startH}:${startM}`;

          const endH = String(endDate.getHours()).padStart(2, '0');
          const endM = String(endDate.getMinutes()).padStart(2, '0');
          const endTime = `${endH}:${endM}`;

          const alreadyInDB = existsById || existingDateSigSet.has(`${dateStr}|${startTime}`);

          parsedList.push({
            id: evt.id,
            gcalEventId: evt.id,
            summary,
            rawDescription: rawDesc,
            cleanDescription: cleanDesc,
            workDate: dateStr,
            startTime,
            endTime,
            duration,
            isAllDay: false,
            isOT: parsedWorklog?.is_ot || false,
            alreadyInDB,
            existingWorklogId,
            hasPattern,
            detectedProjectName: parsedWorklog?.project_name,
            detectedProjectType: parsedWorklog?.project_type,
            detectedModule: parsedWorklog?.module,
            detectedHolding: parsedWorklog?.holding,
            detectedRoleOperator: parsedWorklog?.department_operator,
            detectedBu: parsedWorklog?.bu,
            detectedDept: parsedWorklog?.department,
            detectedActionName: parsedWorklog?.action_name,
            detectedDescription: parsedWorklog?.description
          });
        }
      }

      parsedList.sort((a, b) => {
        if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
        return a.startTime.localeCompare(b.startTime);
      });

      setEvents(parsedList);

      const missingIds = parsedList.filter(e => !e.alreadyInDB).map(e => e.id);
      setSelectedEventIds(missingIds);
      setFilterTab(missingIds.length > 0 ? 'missing' : 'all');
    } catch (err: unknown) {
      console.error('[RecoverGCalModal] Error fetching events:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast('ไม่สามารถดึงข้อมูลจาก Google Calendar: ' + msg, 'error');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [sessionUser, monthStart, monthEnd, workspaceId, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadMasterData();
      fetchMonthGCalEvents();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadMasterData, fetchMonthGCalEvents]);

  // ── Derived Options for Render ───────────────────────────────────────────
  const availableHoldings = useMemo(() => {
    return Array.from(new Set(allowedProjects.map(p => p.holding).filter(Boolean))).sort() as string[];
  }, [allowedProjects]);

  const availableRoleOperators = useMemo(() => {
    if (!selectedHolding) return [];
    return Array.from(new Set(
      mapUserRole
        .filter(ur => {
          const holdingWild = (ur.holding || '').trim().toLowerCase() === 'all' || (ur.holding || '').trim().toLowerCase() === 'all holding';
          return holdingWild || (ur.holding || '').trim().toLowerCase() === selectedHolding.trim().toLowerCase();
        })
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

  const availableActions = useMemo(() => {
    if (!masterActions || masterActions.length === 0) return [];
    if (!projectType) return Array.from(new Set(masterActions.map(a => a.action_name).filter(Boolean))).sort();

    const normProjType = projectType.trim().toLowerCase();
    let filtered = masterActions.filter(a =>
      a.action_category && a.action_category.trim().toLowerCase() === normProjType
    );

    if (filtered.length === 0) {
      filtered = masterActions.filter(a => {
        if (!a.action_category) return false;
        const normCat = a.action_category.trim().toLowerCase();
        return normProjType.includes(normCat) || normCat.includes(normProjType);
      });
    }

    if (filtered.length === 0) {
      filtered = masterActions;
    }

    return Array.from(new Set(filtered.map(a => a.action_name).filter(Boolean))).sort();
  }, [projectType, masterActions]);

  // ── Filtered Events for Table ─────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      if (filterTab === 'missing' && evt.alreadyInDB) return false;
      if (filterTab === 'existing' && !evt.alreadyInDB) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = evt.summary.toLowerCase().includes(q);
        const matchDesc = evt.cleanDescription.toLowerCase().includes(q);
        const matchDate = evt.workDate.includes(q);
        if (!matchTitle && !matchDesc && !matchDate) return false;
      }

      return true;
    });
  }, [events, filterTab, searchQuery]);

  const toggleEventSelect = (id: string) => {
    setSelectedEventIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredEvents.map(e => e.id);
    setSelectedEventIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const deselectAllFiltered = () => {
    const idSet = new Set(filteredEvents.map(e => e.id));
    setSelectedEventIds(prev => prev.filter(id => !idSet.has(id)));
  };

  const totalSelectedHours = useMemo(() => {
    const idSet = new Set(selectedEventIds);
    return events
      .filter(e => idSet.has(e.id))
      .reduce((sum, e) => sum + e.duration, 0);
  }, [events, selectedEventIds]);

  // ── Handle Recovery Import ────────────────────────────────────────────────
  const handleExecuteRecovery = async () => {
    if (!sessionUser?.id) return;
    const selectedList = events.filter(e => selectedEventIds.includes(e.id));
    if (selectedList.length === 0) {
      showToast('กรุณาเลือกกิจกรรมอย่างน้อย 1 รายการเพื่อกู้คืน', 'warning');
      return;
    }

    const newItems = selectedList.filter(e => !e.alreadyInDB);
    const existingItems = selectedList.filter(e => e.alreadyInDB);

    // If all selected items already exist in DB, do not re-insert duplicates
    if (newItems.length === 0) {
      showToast(`รายการที่เลือกทั้ง ${existingItems.length} รายการมีอยู่ในระบบเรียบร้อยแล้ว`, 'info');
      onRecoverySuccess();
      onClose();
      return;
    }

    const hasUnmapped = newItems.some(e => !e.hasPattern || forceOverrideAll);
    if (hasUnmapped) {
      if (!selectedHolding) {
        showToast('กรุณาเลือก Holding', 'error');
        return;
      }
      if (!selectedRoleOperator) {
        showToast('กรุณาเลือก Role Operator', 'error');
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
        showToast('กรุณาเลือก Action Name / กิจกรรม', 'error');
        return;
      }
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: newItems.length });

    try {
      const activeWs = workspaceId || sessionUser.activeWorkspaceId || sessionUser.active_workspace_id;
      const [defaultProjName] = (selectedProjectKey || '').split('|');

      const inserts = newItems.map(ev => {
        const useDetected = ev.hasPattern && !forceOverrideAll;

        const finalHolding = useDetected ? (ev.detectedHolding || selectedHolding) : selectedHolding;
        const finalRoleOperator = useDetected ? (ev.detectedRoleOperator || selectedRoleOperator) : selectedRoleOperator;
        const finalProjectType = useDetected ? (ev.detectedProjectType || projectType) : projectType;
        const finalProjectName = useDetected ? (ev.detectedProjectName || defaultProjName) : defaultProjName;
        const finalModule = useDetected ? (ev.detectedModule || module || null) : (module || null);
        const finalBu = useDetected ? (ev.detectedBu || bu || '') : (bu || '');
        const finalDept = useDetected ? (ev.detectedDept || department || '') : (department || '');
        const finalActionName = useDetected ? (ev.detectedActionName || actionName) : actionName;

        const finalDescription = (useDetected && ev.detectedDescription !== undefined)
          ? ev.detectedDescription
          : (ev.cleanDescription
            ? `[GCal Recovery] ${ev.summary}\n\n${ev.cleanDescription}`
            : `[GCal Recovery] ${ev.summary}`);

        const rawDuration = Number(ev.duration);
        const safeTotalHours = (!isNaN(rawDuration) && rawDuration > 0)
          ? Math.min(24.0, Math.max(0.25, Math.round(rawDuration * 100) / 100))
          : 8.0;

        return {
          user_id: sessionUser.id,
          work_date: ev.workDate,
          start_time: ev.startTime.length === 5 ? ev.startTime + ':00' : ev.startTime,
          end_time: ev.endTime.length === 5 ? ev.endTime + ':00' : ev.endTime,
          break_time: ev.isAllDay,
          total_hours: safeTotalHours,
          holding: finalHolding,
          department_operator: finalRoleOperator,
          project_type: finalProjectType,
          project_name: finalProjectName,
          module: finalModule,
          bu: finalBu,
          department: finalDept,
          action_name: finalActionName,
          description: finalDescription,
          channel: 'Google Calendar Recovery',
          is_ot: ev.isOT,
          gcal_event_id: ev.gcalEventId,
          workspace_id: activeWs && activeWs !== 'N/A' ? activeWs : undefined
        };
      });

      const BATCH_SIZE = 50;
      let totalSuccess = 0;

      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const chunk = inserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('col_worklog').insert(chunk);
        if (error) {
          throw new Error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} ล้มเหลว (${error.message})`);
        }
        totalSuccess += chunk.length;
        setImportProgress({ current: totalSuccess, total: inserts.length });
      }

      const skippedNote = existingItems.length > 0 ? ` (ข้าม ${existingItems.length} รายการที่มีอยู่ในระบบแล้ว)` : '';
      showToast(`กู้คืนใบงานสำเร็จจำนวน ${totalSuccess} รายการเข้าสู่ระบบเรียบร้อยแล้ว!${skippedNote}`, 'success');
      onRecoverySuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[RecoverGCalModal] Import error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast('เกิดข้อผิดพลาดในการกู้คืนข้อมูล: ' + msg, 'error');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  if (!isOpen) return null;

  const missingCount = events.filter(e => !e.alreadyInDB).length;
  const existingCount = events.filter(e => e.alreadyInDB).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-5xl bg-theme-surface-modal border border-theme-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-theme-text flex items-center gap-2">
                <span>กู้คืนใบงานจาก Google Calendar</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 uppercase tracking-wide">
                  Smart Month Sync
                </span>
              </h2>
              <p className="text-xs text-theme-text-secondary mt-0.5">
                ประจำเดือน <span className="font-bold text-theme-text">{monthLabel}</span> • สแกนพบ {events.length} รายการ ({missingCount} ยังไม่เคยนำเข้า)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 text-theme-text-muted hover:text-theme-text hover:bg-slate-500/10 rounded-xl transition-all cursor-pointer disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ───────────────────────────────────── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* Section 1: Destination Project Classification */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Layers size={14} />
                <span>1. กำหนด Project ปลายทางสำหรับรายการที่ไม่มี Pattern กำกับ</span>
              </h3>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-theme-text-secondary hover:text-theme-text select-none">
                <input
                  type="checkbox"
                  checked={forceOverrideAll}
                  onChange={e => setForceOverrideAll(e.target.checked)}
                  className="rounded border-slate-500 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">บังคับใช้ Project นี้กับทุกรายการที่เลือก</span>
              </label>
            </div>

            <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
              {/* Row 1: Holding & Role Operator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">HOLDING</label>
                  <select
                    value={selectedHolding}
                    onChange={e => handleHoldingChange(e.target.value)}
                    disabled={isLoadingMaster}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— เลือก Holding —</option>
                    {availableHoldings.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">ROLE OPERATOR</label>
                  <select
                    value={selectedRoleOperator}
                    onChange={e => handleRoleOperatorChange(e.target.value)}
                    disabled={!selectedHolding || isLoadingMaster}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— เลือก Role Operator —</option>
                    {availableRoleOperators.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Project Type & Project Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">PROJECT TYPE</label>
                  <select
                    value={projectType}
                    onChange={e => handleProjectTypeChange(e.target.value)}
                    disabled={!selectedRoleOperator}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— เลือก Project Type —</option>
                    {availableProjectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">PROJECT NAME</label>
                  <select
                    value={selectedProjectKey}
                    onChange={e => handleProjectKeyChange(e.target.value)}
                    disabled={!projectType}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— เลือก Project Name —</option>
                    {availableProjects.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: Module & Action Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">MODULE / PHASE</label>
                  <select
                    value={module}
                    onChange={e => handleModuleChange(e.target.value)}
                    disabled={!selectedProjectKey || availableModules.length === 0}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">{availableModules.length === 0 && selectedProjectKey ? 'ไม่มี Module (Auto-skip)' : '— เลือก Module —'}</option>
                    {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">ACTION / กิจกรรม</label>
                  <select
                    value={actionName}
                    onChange={e => setActionName(e.target.value)}
                    disabled={!projectType}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                  >
                    <option value="">— เลือกกิจกรรม —</option>
                    {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 4: BU & Department (Conditional) */}
              {selectedProjectKey && (noModuleMode || (module && (availableBUsForModule.length > 1 || availableDeptsForModule.length > 1))) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 border-t border-theme-border/60 pt-3">
                  <div>
                    <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">BUSINESS UNIT (BU)</label>
                    <select
                      value={bu}
                      onChange={e => { setBu(e.target.value); setDepartment(''); }}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— เลือก BU —</option>
                      {(noModuleMode ? availableBUs : availableBUsForModule).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5">TARGET DEPARTMENT</label>
                    <select
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={!bu}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                    >
                      <option value="">— เลือก Department —</option>
                      {(noModuleMode ? availableDepts : availableDeptsForModule).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Scanned GCal Events Table & Filter */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                  2. รายการนัดหมายที่ตรวจพบบนปฏิทิน ({selectedEventIds.length} จาก {events.length} รายการที่เลือก)
                </h3>
                <p className="text-[11px] text-theme-text-secondary mt-0.5">
                  ระบบคัดกรองขยะ HTML / ข้อความ Teams ลิงก์ยาวๆ ออกให้อัตโนมัติ
                </p>
              </div>

              {/* Total Hours Badge */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 rounded-xl text-xs font-mono font-bold">
                  รวม {totalSelectedHours.toFixed(1)} ชั่วโมง
                </span>
                <button
                  type="button"
                  onClick={fetchMonthGCalEvents}
                  disabled={isLoadingEvents}
                  className="p-1.5 rounded-xl border border-theme-border text-theme-text-secondary hover:text-theme-text hover:bg-slate-500/10 transition-all cursor-pointer"
                  title="สแกนใหม่อีกครั้ง"
                >
                  <RefreshCw size={14} className={isLoadingEvents ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Controls Bar: Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-theme-surface-secondary border border-theme-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterTab('missing')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    filterTab === 'missing'
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  ยังไม่มีในระบบ ({missingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    filterTab === 'all'
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  ทั้งหมด ({events.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('existing')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    filterTab === 'existing'
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  มีในระบบแล้ว ({existingCount})
                </button>
              </div>

              {/* Search & Bulk Select */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อหรือวันที่..."
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl border border-theme-border hover:bg-slate-500/10 text-theme-text-secondary hover:text-theme-text transition-all cursor-pointer"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl border border-theme-border hover:bg-slate-500/10 text-theme-text-secondary hover:text-theme-text transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="border border-theme-border rounded-2xl overflow-hidden max-h-[320px] overflow-y-auto custom-scrollbar bg-theme-surface-secondary/40 shadow-inner">
              {isLoadingEvents ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2.5 text-theme-text-secondary">
                  <RefreshCw size={24} className="animate-spin text-emerald-500" />
                  <span className="text-xs font-semibold">กำลังสแกนปฏิทิน Google Calendar ในเดือน {monthLabel}...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-12 text-center text-theme-text-muted italic text-xs">
                  {events.length === 0
                    ? `ไม่พบรายการนัดหมายบนปฏิทิน Google Calendar ในเดือน ${monthLabel}`
                    : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-surface-secondary text-theme-text-secondary uppercase tracking-wider font-bold border-b border-theme-border sticky top-0 z-10">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredEvents.length > 0 && filteredEvents.every(e => selectedEventIds.includes(e.id))}
                          onChange={e => {
                            if (e.target.checked) {
                              selectAllFiltered();
                            } else {
                              deselectAllFiltered();
                            }
                          }}
                          className="rounded border-slate-500 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-28">วันที่ / Date</th>
                      <th className="py-2.5 px-3 w-28">เวลา / Time</th>
                      <th className="py-2.5 px-3">นัดหมายใน GCal</th>
                      <th className="py-2.5 px-3 w-48">Project ปลายทาง</th>
                      <th className="py-2.5 px-3 w-28 text-center">สถานะ</th>
                      <th className="py-2.5 px-3 w-16 text-center">ชม.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/50">
                    {filteredEvents.map(ev => {
                      const isChecked = selectedEventIds.includes(ev.id);
                      const [defaultProjName] = (selectedProjectKey || '').split('|');
                      const willUseDetected = ev.hasPattern && !forceOverrideAll;
                      const targetProjDisplay = willUseDetected
                        ? `${ev.detectedProjectName || 'Work Log'}`
                        : (defaultProjName || 'ยังไม่ระบุ');
                      const targetActionDisplay = willUseDetected
                        ? `${ev.detectedActionName || 'General'}`
                        : (actionName || 'ยังไม่ระบุ');

                      return (
                        <tr
                          key={ev.id}
                          className={cn(
                            "hover:bg-indigo-500/5 transition-all cursor-pointer",
                            isChecked ? "bg-indigo-500/10 dark:bg-indigo-500/10" : "",
                            ev.alreadyInDB ? "opacity-75" : ""
                          )}
                          onClick={() => toggleEventSelect(ev.id)}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEventSelect(ev.id)}
                              className="rounded border-slate-500 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-theme-text whitespace-nowrap">
                            {ev.workDate}
                          </td>
                          <td className="py-2.5 px-3 text-theme-text-secondary font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-theme-text-muted shrink-0" />
                              <span>{ev.startTime} - {ev.endTime}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[260px]">
                            <span className="font-bold text-theme-text block truncate" title={ev.summary}>
                              {ev.summary}
                            </span>
                            {ev.cleanDescription && (
                              <span className="text-[10px] text-theme-text-muted truncate block max-w-[260px]" title={ev.cleanDescription}>
                                {ev.cleanDescription}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 max-w-[190px]">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 truncate">
                                {willUseDetected ? (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-500 shrink-0">
                                    ✨ ตรวจพบ
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-500/10 text-indigo-400 shrink-0">
                                    🎯 ค่าที่เลือก
                                  </span>
                                )}
                                <span className="font-bold text-theme-text truncate text-[11px]" title={targetProjDisplay}>
                                  {targetProjDisplay}
                                </span>
                              </div>
                              <span className="text-[10px] text-theme-text-secondary truncate block pl-0.5" title={targetActionDisplay}>
                                ⚡ {targetActionDisplay}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {ev.alreadyInDB ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <CheckCircle2 size={10} />
                                <span>มีในระบบแล้ว</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Sparkles size={10} />
                                <span>พร้อมกู้คืน</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                            {ev.duration}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-t border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-theme-text-secondary text-center sm:text-left">
            {importProgress ? (
              <span className="flex items-center gap-2 font-bold text-indigo-500">
                <RefreshCw size={13} className="animate-spin" />
                กำลังนำเข้า {importProgress.current} จาก {importProgress.total} รายการ...
              </span>
            ) : (
              <span>
                เลือก <strong className="text-theme-text">{selectedEventIds.length}</strong> รายการ 
                (รวม <strong className="text-indigo-500">{totalSelectedHours.toFixed(1)}</strong> ชม.)
                {selectedEventIds.some(id => events.find(e => e.id === id)?.alreadyInDB) && (
                  <span className="text-amber-500 ml-1.5 font-semibold text-[11px]">
                    (มีบางรายการที่ซ้ำในระบบ)
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 sm:flex-initial px-4 py-2 border border-theme-border text-xs font-bold text-theme-text-secondary hover:text-theme-text hover:bg-slate-500/10 rounded-xl transition-all cursor-pointer disabled:opacity-40"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleExecuteRecovery}
              disabled={isImporting || selectedEventIds.length === 0 || isLoadingEvents}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 text-white text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none",
                selectedEventIds.length > 0 && selectedEventIds.every(id => events.find(e => e.id === id)?.alreadyInDB)
                  ? "bg-slate-600 hover:bg-slate-700 shadow-slate-600/20"
                  : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20"
              )}
            >
              {isImporting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>กำลังกู้คืนข้อมูล...</span>
                </>
              ) : selectedEventIds.length > 0 && selectedEventIds.every(id => events.find(e => e.id === id)?.alreadyInDB) ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>มีในระบบแล้ว ({selectedEventIds.length})</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>กู้คืน {selectedEventIds.filter(id => !events.find(e => e.id === id)?.alreadyInDB).length || selectedEventIds.length} รายการเข้าสู่ระบบ</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
    </ModalPortal>
  );
}
