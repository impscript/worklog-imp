import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Download, Database, Sparkles, Settings, Eye, Play, Check, Users, User, ChevronUp, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface CSVRow {
  [key: string]: string;
}

interface MappingConfig {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  project_name: string;
  action_name: string;
  description: string;
  total_hours: string;
  is_ot: string;
}

interface PreviewRow {
  id: string | null;
  actionType: 'insert' | 'update';
  work_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  project_name: string;
  action_name: string;
  description: string;
  is_ot: boolean;
  status: 'ready' | 'warning' | 'error';
  message: string;
  original: CSVRow;
  holding: string;
  department_operator: string;
  project_type: string;
  module: string;
  bu: string;
  department: string;
  action_channel: string | null;
  break_time: boolean;
}

interface UserRecord {
  id: string;
  full_name: string;
  nickname: string;
  department: string;
}

import { useNotification } from '../context/NotificationContext';

export default function MigratePage() {
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // User selection states
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [selectedImportUserId, setSelectedImportUserId] = useState<string>('');
  const [selectedExportUserId, setSelectedExportUserId] = useState<string>('');

  // CSV parsing states
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Mapping states
  const [mappings, setMappings] = useState<MappingConfig>({
    id: '',
    work_date: '',
    start_time: '',
    end_time: '',
    project_name: '',
    action_name: '',
    description: '',
    total_hours: '',
    is_ot: ''
  });

  // Settings states
  const [fallbackHolding, setFallbackHolding] = useState<string>('Double A');
  const [fallbackOperator, setFallbackOperator] = useState<string>('IMP');
  const [fallbackAction, setFallbackAction] = useState<string>('Others');
  const [fallbackStartTime, setFallbackStartTime] = useState<string>('08:30');
  const [autoSplitOT, setAutoSplitOT] = useState<boolean>(true);
  const [existingImportUserIds, setExistingImportUserIds] = useState<Set<string>>(new Set());

  // Preview & Processing states
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'warning' | 'error'>('all');
  const [newProjectsList, setNewProjectsList] = useState<any[]>([]);
  const [holidaysList, setHolidaysList] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);

  // Export states
  const [exportStartDate, setExportStartDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [exportEndDate, setExportEndDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportRecordCount, setExportRecordCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(sessionStr);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentUser(user);
    setSelectedImportUserId(user.id);
    setSelectedExportUserId(user.id);

    // Load project list to validate project names
    async function loadMasterData() {
      const { data } = await supabase.from('tb_map_project_structure').select('project_name, holding, department_operator, bu, department, project_type, module');
      if (data) {
        setNewProjectsList(data);
      }
      const { data: holidayData } = await supabase.from('tb_master_holiday').select('date');
      if (holidayData) {
        setHolidaysList(holidayData.map(h => h.date));
      }
      // Load all users for selection dropdowns filtered by active workspace
      let userQuery = supabase.from('users').select('id, full_name, nickname, department');
      if (user.activeWorkspaceId) {
        userQuery = userQuery.eq('active_workspace_id', user.activeWorkspaceId);
      }
      const { data: usersData } = await userQuery.order('full_name');
      if (usersData) {
        setUsersList(usersData);
      }
    }
    loadMasterData();
  }, [navigate]);

  useEffect(() => {
    if (!selectedImportUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExistingImportUserIds(new Set());
      return;
    }
    async function fetchExistingIds() {
      const { data } = await supabase
        .from('col_worklog')
        .select('id')
        .eq('user_id', selectedImportUserId);
      if (data) {
        setExistingImportUserIds(new Set(data.map((r: any) => r.id)));
      }
    }
    fetchExistingIds();
  }, [selectedImportUserId]);

  // CSV Parsing function
  const parseCSV = (text: string) => {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Double quotes inside quotes means single literal quote
          currentField += '"';
          i++;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
        if (currentLine.some(field => field !== '')) {
          lines.push(currentLine);
        }
        currentLine = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip extra newline char in Windows style
        }
      } else {
        currentField += char;
      }
    }

    // Add trailing field/line if exists
    if (currentField !== '' || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some(field => field !== '')) {
        lines.push(currentLine);
      }
    }

    if (lines.length === 0) return;

    const headers = lines[0];
    const rows = lines.slice(1).map(line => {
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = line[index] || '';
      });
      return row;
    });

    setCsvHeaders(headers);
    setCsvData(rows);

    // Auto-map headers
    const newMappings = { ...mappings };
    headers.forEach(h => {
      const norm = h.toLowerCase().replace(/[\s_-]/g, '');
      if (norm === 'id' || norm === 'uuid' || norm === 'worklogid') newMappings.id = h;
      if (norm.includes('date') || norm === 'workdate') newMappings.work_date = h;
      if (norm.includes('start') || norm === 'starttime') newMappings.start_time = h;
      if (norm.includes('end') || norm === 'endtime') newMappings.end_time = h;
      if (norm.includes('project') || norm === 'projname') newMappings.project_name = h;
      if (norm.includes('action') || norm === 'actname' || norm === 'task') newMappings.action_name = h;
      if (norm.includes('description') || norm === 'desc' || norm === 'detail') newMappings.description = h;
      if (norm.includes('hours') || norm === 'totalhours' || norm === 'duration') newMappings.total_hours = h;
      if (norm.includes('ot') || norm === 'isot') newMappings.is_ot = h;
    });
    setMappings(newMappings);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          parseCSV(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          parseCSV(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  // Run validation and build Preview Table whenever mappings, csvData, or settings change
  useEffect(() => {
    if (csvData.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewRows([]);
      return;
    }

    const compiledRows: PreviewRow[] = [];

    const findMatch = (projName: string) => {
      if (!projName) return null;
      const norm = (str: string) => str.toLowerCase().replace(/\s+/g, '');
      const normName = norm(projName);
      return newProjectsList.find(p => norm(p.project_name) === normName);
    };

    const getCsvMetadata = (row: CSVRow, keys: string[], fallback: string): string => {
      for (const k of keys) {
        if (row[k] !== undefined) return row[k];
        const foundKey = Object.keys(row).find(
          rk => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, '')
        );
        if (foundKey && row[foundKey] !== undefined) return row[foundKey];
      }
      return fallback;
    };

    csvData.forEach((row) => {
      const raw_id = mappings.id ? row[mappings.id] || null : null;

      // Normalize date: supports YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, MM/DD/YYYY
      const normalizeDate = (raw: string): string => {
        if (!raw) return '';
        // Already ISO format
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        // DD/MM/YYYY or D/M/YYYY (day <= 12 is ambiguous but Thai CSVs always use this)
        const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmyMatch) {
          const [, d, m, y] = dmyMatch;
          return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
        return raw; // Return as-is, let Date.parse decide
      };

      const work_date = normalizeDate(row[mappings.work_date] || '');
      const raw_start = row[mappings.start_time] || '';
      const raw_end = row[mappings.end_time] || '';
      const raw_hours = parseFloat(row[mappings.total_hours] || '0');
      const project_name = row[mappings.project_name] || '';
      const action_name = row[mappings.action_name] || fallbackAction;
      const description = row[mappings.description] || '';
      const is_ot_val = row[mappings.is_ot] || '';
      let is_ot = is_ot_val.toLowerCase() === 'true' || is_ot_val === '1' || is_ot_val.toLowerCase() === 'yes';

      // Auto-detect OT if date is in holiday list or falls on a weekend
      let isWeekendOrHoliday = false;
      if (work_date && !isNaN(Date.parse(work_date))) {
        const parsedDate = new Date(work_date);
        const day = parsedDate.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = day === 0 || day === 6;
        const isHoliday = holidaysList.includes(work_date);
        isWeekendOrHoliday = isWeekend || isHoliday;
        if (isWeekendOrHoliday) {
          is_ot = true;
        }
      }

      // Check actionType
      const actionType: 'insert' | 'update' = (raw_id && existingImportUserIds.has(raw_id)) ? 'update' : 'insert';

      // 1. Validate date
      if (!work_date || isNaN(Date.parse(work_date))) {
        compiledRows.push({
          id: raw_id,
          actionType,
          work_date,
          start_time: '',
          end_time: '',
          total_hours: 0,
          project_name,
          action_name,
          description,
          is_ot,
          status: 'error',
          message: 'Invalid or missing work date',
          original: row,
          holding: fallbackHolding,
          department_operator: fallbackOperator,
          project_type: 'Management',
          module: '',
          bu: '',
          department: '',
          action_channel: null,
          break_time: true,
        });
        return;
      }

      // 2. Validate start & end times or hours
      let start_time = raw_start;
      let end_time = raw_end;
      let total_hours = raw_hours;
      let timeWarning = false;
      let warningMessage = '';

      if (!start_time || !end_time) {
        if (total_hours <= 0) {
          compiledRows.push({
            id: raw_id,
            actionType,
            work_date,
            start_time: '',
            end_time: '',
            total_hours: 0,
            project_name,
            action_name,
            description,
            is_ot,
            status: 'error',
            message: 'Missing start/end times and valid total hours',
            original: row,
            holding: fallbackHolding,
            department_operator: fallbackOperator,
            project_type: 'Management',
            module: '',
            bu: '',
            department: '',
            action_channel: null,
            break_time: true,
          });
          return;
        } else {
          timeWarning = true;
          warningMessage = `Will reconstruct times starting from ${fallbackStartTime}`;
          // Generate times
          start_time = `${fallbackStartTime}:00`;
          const [startH, startM] = fallbackStartTime.split(':').map(Number);
          const totalMins = (startH * 60 + startM) + (total_hours * 60);
          const endH = Math.floor(totalMins / 60) % 24;
          const endM = Math.round(totalMins % 60);
          end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
        }
      } else {
        // Calculate hours based on times if not explicitly mapped
        if (total_hours <= 0) {
          const [sH, sM] = start_time.split(':').map(Number);
          const [eH, eM] = end_time.split(':').map(Number);
          if (!isNaN(sH) && !isNaN(eH)) {
            const diff = (eH * 60 + eM) - (sH * 60 + sM);
            total_hours = diff > 0 ? diff / 60 : (diff + 24 * 60) / 60;
          }
        }
      }

      // Determine structural values with high intelligence:
      // (1) Extract directly from CSV columns if they are not empty (respect user's cleaned data!)
      let holding = getCsvMetadata(row, ['holding'], '').trim();
      let department_operator = getCsvMetadata(row, ['department_operator', 'operator', 'dept_operator'], '').trim();
      let project_type = getCsvMetadata(row, ['project_type', 'projecttype', 'type'], '').trim();
      let module = getCsvMetadata(row, ['module'], '').trim();
      let bu = getCsvMetadata(row, ['bu'], '').trim();
      let department = getCsvMetadata(row, ['department', 'dept'], '').trim();
      let action_channel: string | null = null;
      let break_time = true;

      // Handle split column "Module : BU : Department" if it is present and individual fields are empty
      const splitCol = getCsvMetadata(row, ['Module : BU : Department', 'Module:BU:Department'], '').trim();
      if (splitCol && (!bu || !department)) {
        const parts = splitCol.split(':').map(p => p.trim());
        if (parts.length === 3) {
          if (!module) module = parts[0];
          if (!bu) bu = parts[1];
          if (!department) department = parts[2];
        } else if (parts.length === 2) {
          if (!module) module = '';
          if (!bu) bu = parts[0];
          if (!department) department = parts[1];
        }
      }

      // (2) Fallback to matched project in database registry if fields are still empty
      const match = findMatch(project_name);
      if (match) {
        if (!holding) holding = match.holding;
        if (!department_operator) department_operator = match.department_operator;
        if (!project_type) project_type = match.project_type || 'Management';
        if (!module) module = match.module || '';
        if (!bu) bu = match.bu || '';
        if (!department) department = match.department || '';
      }

      // (3) Apply ultimate default fallbacks if still empty
      if (!holding) holding = fallbackHolding;
      if (!department_operator) department_operator = fallbackOperator;
      if (!project_type) project_type = 'Management';
      if (!bu) bu = '';
      if (!department) department = '';

      const csvChannel = getCsvMetadata(row, ['action_channel', 'channel'], '');
      if (csvChannel) action_channel = csvChannel;

      const csvBreakTime = getCsvMetadata(row, ['break_time', 'breaktime'], '');
      if (csvBreakTime) {
        break_time = csvBreakTime.toLowerCase() === 'true' || csvBreakTime === '1' || csvBreakTime.toLowerCase() === 'yes';
      }

      let status: 'ready' | 'warning' | 'error' = 'ready';
      let message = actionType === 'update' ? 'Will update existing worklog' : 'Ready to import';

      // (4) Robust validation status and message
      if (!holding || !department_operator || !bu || !department) {
        status = 'error';
        message = 'Missing required structural fields (Holding, Operator, BU, Department)';
      } else if (!match) {
        status = 'warning';
        message = `Project mismatch. Will map via explicit CSV columns [${holding} > ${bu} > ${department}]`;
      } else if (timeWarning) {
        status = 'warning';
        message = warningMessage;
      }

      // Check auto-split boundary
      if (autoSplitOT && !raw_id && !isWeekendOrHoliday && start_time && end_time) {
        const parsedDate = new Date(work_date);
        const day = parsedDate.getDay(); // 1 = Mon, ..., 5 = Fri
        const boundaryHour = (day === 5) ? 17 : 18; // Friday 17:00, Mon-Thu 18:00
        
        const [sH, sM] = start_time.split(':').map(Number);
        const [eH, eM] = end_time.split(':').map(Number);
        
        if (!isNaN(sH) && !isNaN(eH)) {
          const startMins = sH * 60 + sM;
          let endMins = eH * 60 + eM;
          if (endMins < startMins) endMins += 24 * 60; // Next day/midnight crossing
          
          const boundaryMins = boundaryHour * 60;
          
          if (startMins < boundaryMins && endMins > boundaryMins) {
            // Split into Normal and OT
            const normalHours = (boundaryMins - startMins) / 60;
            const otHours = (endMins - boundaryMins) / 60;
            
            // 1. Normal Portion
            compiledRows.push({
              id: null,
              actionType: 'insert',
              work_date,
              start_time,
              end_time: `${String(boundaryHour).padStart(2, '0')}:00`,
              total_hours: normalHours,
              project_name,
              action_name,
              description: description ? `${description} (Normal)` : 'Normal portion',
              is_ot: false,
              status,
              message: `${message} (Normal split portion)`,
              original: row,
              holding,
              department_operator,
              project_type,
              module,
              bu,
              department,
              action_channel,
              break_time,
            });
            
            // 2. OT Portion
            compiledRows.push({
              id: null,
              actionType: 'insert',
              work_date,
              start_time: `${String(boundaryHour).padStart(2, '0')}:00`,
              end_time,
              total_hours: otHours,
              project_name,
              action_name,
              description: description ? `${description} (OT Split)` : 'OT split portion',
              is_ot: true,
              status,
              message: `${message} (OT split portion)`,
              original: row,
              holding,
              department_operator,
              project_type,
              module,
              bu,
              department,
              action_channel,
              break_time,
            });
            
            return; // We have split, skip adding the unsplit row
          }
        }
      }

      // Otherwise, add single row
      compiledRows.push({
        id: raw_id,
        actionType,
        work_date,
        start_time,
        end_time,
        total_hours,
        project_name,
        action_name,
        description,
        is_ot,
        status,
        message,
        original: row,
        holding,
        department_operator,
        project_type,
        module,
        bu,
        department,
        action_channel,
        break_time,
      });
    });

    setPreviewRows(compiledRows);
  }, [csvData, mappings, fallbackHolding, fallbackOperator, fallbackAction, fallbackStartTime, autoSplitOT, existingImportUserIds, holidaysList, newProjectsList]);

  // Memoize unique project names from registry for the dropdown
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(newProjectsList.map(p => p.project_name))).sort();
  }, [newProjectsList]);

  // Reset page and selection states when active CSV is cleared
  const resetFileState = () => {
    setCsvData([]);
    setFileName('');
    setExpandedRowIdx(null);
    setCurrentPage(1);
    setStatusFilter('all');
    setImportStats(null);
    setImportProgress(0);
  };

  // Multi-field update with live validation and auto structural mappings
  const handleUpdateRow = (idx: number, updatedFields: Partial<PreviewRow>) => {
    setPreviewRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], ...updatedFields };

      // Auto-calculate total hours if start_time or end_time is modified
      if (updatedFields.start_time !== undefined || updatedFields.end_time !== undefined) {
        const start = updatedFields.start_time !== undefined ? updatedFields.start_time : row.start_time;
        const end = updatedFields.end_time !== undefined ? updatedFields.end_time : row.end_time;
        if (start && end) {
          const [sH, sM] = start.split(':').map(Number);
          const [eH, eM] = end.split(':').map(Number);
          if (!isNaN(sH) && !isNaN(eH)) {
            const diff = (eH * 60 + eM) - (sH * 60 + sM);
            row.total_hours = diff > 0 ? diff / 60 : (diff + 24 * 60) / 60;
          }
        }
      }

      // Check project match to update structural fields if project_name changed
      if (updatedFields.project_name !== undefined) {
        const norm = (str: string) => str.toLowerCase().replace(/\s+/g, '');
        const normName = norm(row.project_name);
        const match = newProjectsList.find(p => norm(p.project_name) === normName);
        if (match) {
          row.holding = match.holding;
          row.department_operator = match.department_operator;
          row.project_type = match.project_type || 'Management';
          row.module = match.module || '';
          row.bu = match.bu || '';
          row.department = match.department || '';
        }
      }

      // Re-run validation on this row
      let status: 'ready' | 'warning' | 'error' = 'ready';
      let message = row.actionType === 'update' ? 'Will update existing worklog' : 'Ready to import';

      // 1. Validate date
      if (!row.work_date || isNaN(Date.parse(row.work_date))) {
        status = 'error';
        message = 'Invalid or missing work date';
      } else {
        // 2. Validate start/end times or hours
        if (!row.start_time || !row.end_time) {
          if (row.total_hours <= 0) {
            status = 'error';
            message = 'Missing start/end times and valid total hours';
          }
        }
      }

      // Validate required structural fields
      if (status !== 'error') {
        if (!row.holding || !row.department_operator || !row.bu || !row.department) {
          status = 'error';
          message = 'Missing required structural fields (Holding, Operator, BU, Department)';
        } else {
          // Check if project name matches
          const norm = (str: string) => str.toLowerCase().replace(/\s+/g, '');
          const normName = norm(row.project_name);
          const match = newProjectsList.find(p => norm(p.project_name) === normName);
          if (!match) {
            status = 'warning';
            message = `Project mismatch. Will map via explicit columns [${row.holding} > ${row.bu} > ${row.department}]`;
          }
        }
      }

      row.status = status;
      row.message = message;
      next[idx] = row;
      return next;
    });
  };

  // Handle CSV Import
  const handleImport = async () => {
    if (previewRows.length === 0 || isProcessing) return;
    const errors = previewRows.filter(r => r.status === 'error');
    if (errors.length > 0) {
      showToast(`Please fix the ${errors.length} error(s) before importing.`, 'error');
      return;
    }

    setIsProcessing(true);
    setImportProgress(0);
    setImportStats(null);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];

      const dbRecord: any = {
        user_id: selectedImportUserId || currentUser.id,
        work_date: row.work_date,
        start_time: row.start_time.includes(':') && row.start_time.split(':').length === 2 ? `${row.start_time}:00` : row.start_time,
        end_time: row.end_time.includes(':') && row.end_time.split(':').length === 2 ? `${row.end_time}:00` : row.end_time,
        break_time: row.break_time,
        total_hours: row.total_hours,
        holding: row.holding,
        department_operator: row.department_operator,
        project_type: row.project_type,
        project_name: row.project_name,
        module: row.module || null,
        bu: row.bu || '-',
        department: row.department || '-',
        action_name: row.action_name || fallbackAction,
        description: row.description || '',
        is_ot: row.is_ot,
        is_implied_ot: false,
        channel: row.action_channel || 'CSV Import',
        workspace_id: currentUser?.activeWorkspaceId
      };

      if (row.id) {
        dbRecord.id = row.id;
      }

      let query;
      if (row.id) {
        query = supabase.from('col_worklog').upsert([dbRecord], { onConflict: 'id' });
      } else {
        query = supabase.from('col_worklog').insert([dbRecord]);
      }

      const { error } = await query;

      if (error) {
        console.error('Failed to import/upsert row:', error, dbRecord);
        failedCount++;
      } else {
        successCount++;
      }

      setImportProgress(Math.round(((i + 1) / previewRows.length) * 100));
    }

    // Refresh existing import user IDs
    if (selectedImportUserId) {
      const { data } = await supabase
        .from('col_worklog')
        .select('id')
        .eq('user_id', selectedImportUserId);
      if (data) {
        setExistingImportUserIds(new Set(data.map((r: any) => r.id)));
      }
    }

    setImportStats({ success: successCount, failed: failedCount });
    setIsProcessing(false);

    // Refresh master view if needed
    setCsvData([]);
    setFileName('');
  };

  // Preview export count when params change
  useEffect(() => {
    if (!selectedExportUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExportRecordCount(null);
      return;
    }
    async function countExport() {
      const { count } = await supabase
        .from('col_worklog')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', selectedExportUserId)
        .gte('work_date', exportStartDate)
        .lte('work_date', exportEndDate);
      setExportRecordCount(count ?? 0);
    }
    countExport();
  }, [selectedExportUserId, exportStartDate, exportEndDate]);

  // CSV Export function
  const handleExport = async () => {
    if (!selectedExportUserId || isExporting) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('col_worklog')
        .select('*')
        .eq('user_id', selectedExportUserId)
        .gte('work_date', exportStartDate)
        .lte('work_date', exportEndDate)
        .order('work_date', { ascending: true });

      if (error) {
        console.error('Failed to export logs:', error);
        showToast('Failed to export logs. Please try again.', 'error');
        return;
      }

      if (!data || data.length === 0) {
        showToast('No worklogs found for the selected date range.', 'warning');
        return;
      }

      // Construct CSV text
      const csvHeadersList = [
        'id',
        'work_date',
        'start_time',
        'end_time',
        'total_hours',
        'break_time',
        'holding',
        'department_operator',
        'project_type',
        'project_name',
        'module',
        'bu',
        'department',
        'action_name',
        'action_channel',
        'description',
        'is_ot',
        'is_implied_ot',
        'channel'
      ];

      const csvRows = [csvHeadersList.join(',')];

      data.forEach((row: any) => {
        const values = csvHeadersList.map(header => {
          let val = row[header];
          if (val === null || val === undefined) {
            val = '';
          }
          const strVal = String(val);
          // Escape quotes and wrap in quotes if has comma or quotes
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        });
        csvRows.push(values.join(','));
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      const selectedUser = usersList.find(u => u.id === selectedExportUserId);
      const nameSlug = selectedUser ? selectedUser.nickname || selectedUser.full_name.replace(/\s+/g, '_') : 'unknown';
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `worklog_${nameSlug}_${exportStartDate}_to_${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Derived state: Filtered and Paginated rows for preview table
  const filteredRows = useMemo(() => {
    return previewRows.map((row, index) => ({ ...row, originalIndex: index }))
      .filter(row => {
        if (statusFilter === 'all') return true;
        return row.status === statusFilter;
      });
  }, [previewRows, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  // Adjust page if it exceeds total pages
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-theme-text tracking-tight theme-heading-gradient flex items-center gap-2">
            <Database className="text-indigo-400" />
            <span>Data Migration (Import & Export CSV)</span>
          </h1>
          <p className="text-sm text-theme-text-secondary mt-1">
            Easily import historical work entries from custom CSV backups or export your current logged work activities.
          </p>
        </div>

        {/* Two-Column Tool Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Workspaces: CSV Importer & Preview */}
          <div className="lg:col-span-2 space-y-6">

            {/* Import Target User Selector */}
            {csvData.length === 0 && (
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2 mb-3">
                  <User size={16} className="text-indigo-400" />
                  <span>Import Target User</span>
                </h3>
                <p className="text-xs text-theme-text-secondary mb-3">Select which employee this CSV data will be imported for.</p>
                <select
                  value={selectedImportUserId}
                  onChange={(e) => setSelectedImportUserId(e.target.value)}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2.5 text-sm font-medium text-theme-text focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                >
                  <option value="">-- Select Employee --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.nickname}) — {u.department}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {csvData.length === 0 ? (
              /* Step 1: File Upload Box */
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-4 ai-glass",
                  dragActive 
                    ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.15)]" 
                    : "border-theme-border/80 hover:border-indigo-500/50 hover:bg-theme-surface-secondary dark:hover:bg-theme-surface-secondary/10"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".csv" 
                  className="hidden" 
                />
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                  <UploadCloud size={32} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-theme-text">Drag & drop your CSV backup here</h3>
                  <p className="text-sm text-theme-text-secondary mt-1">or click to browse your computer files</p>
                </div>
                <div className="text-xs text-theme-text-secondary bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Supports auto header detection & fuzzy mapping</span>
                </div>
              </div>
            ) : (
              /* Step 2: Mapping, Preview & Import Control Panel */
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* File Header */}
                <div className="flex justify-between items-center border-b border-theme-border/80 pb-4">
                  <div>
                    <span className="text-xs text-theme-text-secondary uppercase tracking-widest font-bold">Active File</span>
                    <h3 className="text-lg font-bold text-theme-text font-mono">{fileName}</h3>
                  </div>
                  <button 
                    onClick={resetFileState}
                    className="px-3 py-1.5 rounded-xl border border-theme-border text-xs font-bold text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary transition-all"
                  >
                    Reset File
                  </button>
                </div>

                {/* Live Validation & Preview Table */}
                <div className="space-y-4">
                  {/* Summary & Filters Header */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 p-3 rounded-xl border border-theme-border/60">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-indigo-400" />
                      <span className="text-xs font-bold text-theme-text uppercase tracking-wider">
                        Validation Preview ({previewRows.length} Rows)
                      </span>
                    </div>

                    {/* Interactive Filter Tabs */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer",
                          statusFilter === 'all'
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                            : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border text-theme-text-secondary hover:text-theme-text-secondary"
                        )}
                      >
                        All ({previewRows.length})
                      </button>
                      <button
                        onClick={() => { setStatusFilter('ready'); setCurrentPage(1); }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer",
                          statusFilter === 'ready'
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border text-theme-text-secondary hover:text-emerald-400"
                        )}
                      >
                        <CheckCircle2 size={10} />
                        Ready ({previewRows.filter(r => r.status === 'ready').length})
                      </button>
                      <button
                        onClick={() => { setStatusFilter('warning'); setCurrentPage(1); }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer",
                          statusFilter === 'warning'
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border text-theme-text-secondary hover:text-amber-400"
                        )}
                      >
                        <AlertCircle size={10} />
                        Warnings ({previewRows.filter(r => r.status === 'warning').length})
                      </button>
                      <button
                        onClick={() => { setStatusFilter('error'); setCurrentPage(1); }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer",
                          statusFilter === 'error'
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border text-theme-text-secondary hover:text-rose-400"
                        )}
                      >
                        <AlertCircle size={10} />
                        Errors ({previewRows.filter(r => r.status === 'error').length})
                      </button>
                    </div>
                  </div>

                  {/* Main Table */}
                  <div className="overflow-x-auto border border-theme-border rounded-xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border-b border-theme-border/60 font-semibold text-theme-text-secondary">
                          <th className="p-3 w-[100px]">Status</th>
                          <th className="p-3 w-[120px]">Work Date</th>
                          <th className="p-3 w-[140px]">Times / Hours</th>
                          <th className="p-3">Project Name</th>
                          <th className="p-3">Action Name</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 w-[60px] text-center">Correct</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-theme-text-secondary italic">
                              No logs found matching filter "{statusFilter}"
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((row) => {
                            const isExpanded = expandedRowIdx === row.originalIndex;
                            const isWorkDateInvalid = !row.work_date || isNaN(Date.parse(row.work_date));
                            const isTimeInvalid = (!row.start_time || !row.end_time) && row.total_hours <= 0;
                            const isProjMismatch = !newProjectsList.some(
                              p => p.project_name.toLowerCase().replace(/\s+/g, '') === row.project_name.toLowerCase().replace(/\s+/g, '')
                            );
                            const isStructInvalid = !row.holding || !row.department_operator || !row.bu || !row.department;

                            return (
                              <React.Fragment key={row.originalIndex}>
                                <tr 
                                  onClick={() => setExpandedRowIdx(isExpanded ? null : row.originalIndex)}
                                  className={cn(
                                    "hover:bg-theme-surface/80 dark:bg-theme-bg-page/30 text-theme-text-secondary transition-all cursor-pointer",
                                    isExpanded && "bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border-l-2 border-indigo-500",
                                    row.status === 'error' && "hover:bg-rose-500/5",
                                    row.status === 'warning' && "hover:bg-amber-500/5"
                                  )}
                                >
                                  {/* Status Column */}
                                  <td className="p-3">
                                    <div className="flex flex-col gap-1">
                                      <span className={cn(
                                        "inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded font-bold uppercase text-[9px] tracking-wide border w-fit",
                                        row.status === 'ready' && "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                                        row.status === 'warning' && "text-amber-400 bg-amber-500/10 border-amber-500/20",
                                        row.status === 'error' && "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                      )}>
                                        {row.status}
                                      </span>
                                      {row.status !== 'error' && (
                                        <span className={cn(
                                          "inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded font-bold uppercase text-[8px] tracking-wider w-fit border",
                                          row.actionType === 'update' 
                                            ? "text-sky-400 bg-sky-500/10 border-sky-500/20" 
                                            : "text-violet-400 bg-violet-500/10 border-violet-500/20"
                                        )}>
                                          {row.actionType === 'update' ? 'Update' : 'Insert'}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Work Date */}
                                  <td className={cn(
                                    "p-3 font-mono font-bold text-theme-text",
                                    isWorkDateInvalid && "text-rose-400 underline decoration-rose-500/40"
                                  )}>
                                    {row.work_date || 'Missing Date'}
                                  </td>

                                  {/* Times / Hours */}
                                  <td className={cn(
                                    "p-3 font-mono",
                                    isTimeInvalid && "text-rose-400"
                                  )}>
                                    <div className="font-semibold text-theme-text">
                                      {row.start_time ? `${row.start_time} - ${row.end_time}` : '-'}
                                    </div>
                                    <div className="text-[10px] text-theme-text-secondary font-mono">({row.total_hours.toFixed(1)} hrs)</div>
                                  </td>

                                  {/* Project Name */}
                                  <td className="p-3">
                                    <span className={cn(
                                      "font-semibold text-theme-text",
                                      isProjMismatch && "text-amber-400 underline decoration-amber-500/40"
                                    )}>
                                      {row.project_name || 'Missing Project'}
                                    </span>
                                  </td>

                                  {/* Action Name */}
                                  <td className="p-3 text-theme-text-secondary">{row.action_name}</td>

                                  {/* Description */}
                                  <td className="p-3 italic truncate max-w-[150px]" title={row.description}>
                                    {row.description || '-'}
                                  </td>

                                  {/* Expand / Correct Trigger */}
                                  <td className="p-3 text-center">
                                    <button 
                                      className={cn(
                                        "p-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95",
                                        row.status === 'error' && "border-rose-500/30 text-rose-400 bg-rose-500/10",
                                        row.status === 'warning' && "border-amber-500/30 text-amber-400 bg-amber-500/10",
                                        row.status === 'ready' && "border-theme-border text-theme-text-secondary hover:text-theme-text"
                                      )}
                                      title="Fix row inline"
                                    >
                                      {isExpanded ? <ChevronUp size={14} /> : <Pencil size={14} />}
                                    </button>
                                  </td>
                                </tr>

                                {/* Interactive Editor Expansion Panel */}
                                {isExpanded && (
                                  <tr className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 border-b border-theme-border/80">
                                    <td colSpan={7} className="p-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/95 border border-indigo-500/30 rounded-xl p-5 shadow-2xl space-y-4 text-xs">
                                        <div className="flex flex-col gap-1 border-b border-theme-border/80 pb-3">
                                          <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                              <Pencil size={12} />
                                              <span>Inline Data Editor — Row #{row.originalIndex + 1}</span>
                                            </h4>
                                            <span className={cn(
                                              "inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded font-bold uppercase text-[9px] tracking-wide border w-fit",
                                              row.status === 'ready' && "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                                              row.status === 'warning' && "text-amber-400 bg-amber-500/10 border-amber-500/20",
                                              row.status === 'error' && "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                            )}>
                                              {row.status}
                                            </span>
                                          </div>
                                          {row.message && (
                                            <p className={cn(
                                              "text-[10px] font-semibold mt-1",
                                              row.status === 'error' && "text-rose-400",
                                              row.status === 'warning' && "text-amber-400",
                                              row.status === 'ready' && "text-emerald-400"
                                            )}>
                                              💡 {row.message}
                                            </p>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                          {/* Col 1: Date & Time */}
                                          <div className="space-y-3">
                                            <h5 className="font-bold text-theme-text-secondary uppercase tracking-widest text-[9px] border-b border-theme-border/60 pb-1">Date & Time</h5>
                                            
                                            <div className="flex flex-col gap-1">
                                              <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                <span>Work Date</span>
                                                {isWorkDateInvalid && <span className="text-rose-400 text-[8px] uppercase">Required</span>}
                                              </label>
                                              <input
                                                type="date"
                                                value={row.work_date}
                                                onChange={(e) => handleUpdateRow(row.originalIndex, { work_date: e.target.value })}
                                                className={cn(
                                                  "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text font-mono focus:border-indigo-500 transition-all",
                                                  isWorkDateInvalid ? "border-rose-500/60 focus:ring-1 focus:ring-rose-500/20" : "border-theme-border"
                                                )}
                                              />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>Start Time</span>
                                                  {isTimeInvalid && <span className="text-rose-400 text-[8px] uppercase">Req</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  placeholder="08:30"
                                                  value={row.start_time}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { start_time: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text font-mono focus:border-indigo-500 transition-all",
                                                    isTimeInvalid ? "border-rose-500/60 focus:ring-1 focus:ring-rose-500/20" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>End Time</span>
                                                  {isTimeInvalid && <span className="text-rose-400 text-[8px] uppercase">Req</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  placeholder="17:30"
                                                  value={row.end_time}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { end_time: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text font-mono focus:border-indigo-500 transition-all",
                                                    isTimeInvalid ? "border-rose-500/60 focus:ring-1 focus:ring-rose-500/20" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                              <label className="text-[10px] font-bold text-theme-text-secondary">Total Hours</label>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={row.total_hours}
                                                onChange={(e) => handleUpdateRow(row.originalIndex, { total_hours: parseFloat(e.target.value) || 0 })}
                                                className="bg-theme-surface-secondary dark:bg-theme-bg-page border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text font-mono focus:border-indigo-500 transition-all"
                                              />
                                            </div>
                                          </div>

                                          {/* Col 2: Project Registry Mappings */}
                                          <div className="space-y-3">
                                            <h5 className="font-bold text-theme-text-secondary uppercase tracking-widest text-[9px] border-b border-theme-border/60 pb-1">Project Alignment</h5>

                                            <div className="flex flex-col gap-1">
                                              <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                <span>Registered Project</span>
                                                {isProjMismatch && <span className="text-amber-400 text-[8px] uppercase">Mismatch</span>}
                                              </label>
                                              <select
                                                value={row.project_name}
                                                onChange={(e) => handleUpdateRow(row.originalIndex, { project_name: e.target.value })}
                                                className={cn(
                                                  "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all",
                                                  isProjMismatch ? "border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 bg-amber-500/5" : "border-theme-border"
                                                )}
                                              >
                                                <option value="">-- Select Project to Auto-map --</option>
                                                {!uniqueProjects.includes(row.project_name) && row.project_name && (
                                                  <option value={row.project_name}>{row.project_name} (Imported / Unregistered)</option>
                                                )}
                                                {uniqueProjects.map(p => (
                                                  <option key={p} value={p}>{p}</option>
                                                ))}
                                              </select>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                              <label className="text-[10px] font-bold text-theme-text-secondary">Action / Task</label>
                                              <input
                                                type="text"
                                                value={row.action_name}
                                                onChange={(e) => handleUpdateRow(row.originalIndex, { action_name: e.target.value })}
                                                className="bg-theme-surface-secondary dark:bg-theme-bg-page border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all"
                                              />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                              <label className="text-[10px] font-bold text-theme-text-secondary">Description</label>
                                              <textarea
                                                value={row.description}
                                                rows={2}
                                                onChange={(e) => handleUpdateRow(row.originalIndex, { description: e.target.value })}
                                                className="bg-theme-surface-secondary dark:bg-theme-bg-page border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all resize-none"
                                              />
                                            </div>
                                          </div>

                                          {/* Col 3: Hierarchy Structures */}
                                          <div className="space-y-3">
                                            <h5 className="font-bold text-theme-text-secondary uppercase tracking-widest text-[9px] border-b border-theme-border/60 pb-1">Structural Hierarchy</h5>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>Holding</span>
                                                  {isStructInvalid && !row.holding && <span className="text-rose-400 text-[7px] uppercase">*</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  value={row.holding}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { holding: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all font-semibold",
                                                    isStructInvalid && !row.holding ? "border-rose-500/60" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>Operator</span>
                                                  {isStructInvalid && !row.department_operator && <span className="text-rose-400 text-[7px] uppercase">*</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  value={row.department_operator}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { department_operator: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all font-semibold",
                                                    isStructInvalid && !row.department_operator ? "border-rose-500/60" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>BU</span>
                                                  {isStructInvalid && !row.bu && <span className="text-rose-400 text-[7px] uppercase">*</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  value={row.bu}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { bu: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all font-semibold",
                                                    isStructInvalid && !row.bu ? "border-rose-500/60" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-theme-text-secondary flex items-center justify-between">
                                                  <span>Department</span>
                                                  {isStructInvalid && !row.department && <span className="text-rose-400 text-[7px] uppercase">*</span>}
                                                </label>
                                                <input
                                                  type="text"
                                                  value={row.department}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { department: e.target.value })}
                                                  className={cn(
                                                    "bg-theme-surface-secondary dark:bg-theme-bg-page border rounded-lg px-3 py-2 text-xs text-theme-text focus:border-indigo-500 transition-all font-semibold",
                                                    isStructInvalid && !row.department ? "border-rose-500/60" : "border-theme-border"
                                                  )}
                                                />
                                              </div>
                                            </div>

                                            <div className="flex gap-4 pt-3 border-t border-theme-border/50">
                                              <label className="flex items-center gap-2 text-[10px] font-bold text-theme-text-secondary cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={row.is_ot}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { is_ot: e.target.checked })}
                                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-theme-surface-secondary dark:bg-theme-bg-page border-theme-border"
                                                />
                                                <span>Overtime (OT)</span>
                                              </label>

                                              <label className="flex items-center gap-2 text-[10px] font-bold text-theme-text-secondary cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={row.break_time}
                                                  onChange={(e) => handleUpdateRow(row.originalIndex, { break_time: e.target.checked })}
                                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-theme-surface-secondary dark:bg-theme-bg-page border-theme-border"
                                                />
                                                <span>Break (1 hr)</span>
                                              </label>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex justify-end pt-3 border-t border-theme-border/80 gap-3">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedRowIdx(null)}
                                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-theme-text rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                          >
                                            Done
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {filteredRows.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs font-semibold text-theme-text-secondary">
                      <div className="flex items-center gap-2">
                        <span>Show</span>
                        <select
                          value={rowsPerPage}
                          onChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg px-2.5 py-1 text-xs text-theme-text focus:border-indigo-500"
                        >
                          <option value={10}>10 rows</option>
                          <option value={20}>20 rows</option>
                          <option value={50}>50 rows</option>
                          <option value={100}>100 rows</option>
                          <option value={filteredRows.length}>All ({filteredRows.length})</option>
                        </select>
                        <span>per page</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary hover:text-theme-text transition-all disabled:opacity-40 disabled:hover:bg-theme-surface-secondary disabled:hover:text-theme-text-secondary cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        
                        <span className="font-mono text-theme-text">
                          Page {currentPage} of {totalPages || 1}
                        </span>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages || totalPages === 0}
                          className="p-2 rounded-lg border border-theme-border bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary hover:text-theme-text transition-all disabled:opacity-40 disabled:hover:bg-theme-surface-secondary disabled:hover:text-theme-text-secondary cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Action Button */}
                <div className="pt-4 border-t border-theme-border/80 flex flex-col gap-4">
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-indigo-400">Importing rows to Supabase database...</span>
                        <span className="text-theme-text font-mono">{importProgress}%</span>
                      </div>
                      <div className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary rounded-full h-2 overflow-hidden border border-theme-border">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : importStats ? (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                          <Check size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-theme-text">Import completed successfully!</h4>
                          <p className="text-xs text-theme-text-secondary">
                            Successfully imported {importStats.success} logs. Mismatches/Errors skipped: {importStats.failed}.
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setImportStats(null);
                          navigate('/');
                        }}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-theme-text rounded-xl text-xs font-bold transition-all shadow-md"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleImport}
                      disabled={previewRows.filter(r => r.status === 'error').length > 0}
                      className={cn(
                        "w-full py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                        previewRows.filter(r => r.status === 'error').length > 0
                          ? "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary border border-theme-border/50 cursor-not-allowed"
                          : "bg-indigo-500 hover:bg-indigo-600 text-theme-text hover:shadow-indigo-500/10 active:scale-95"
                      )}
                    >
                      <Play size={16} />
                      <span>Start Importing {previewRows.length} Rows to new database</span>
                    </button>
                  )}
                </div>

              </div>
            )}

          </div>

          {/* Right Workspace: Configuration Mapping & Exporter */}
          <div className="space-y-6">
            
            {/* CSV Mapping Fields Settings */}
            {csvData.length > 0 && (
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
                  <Settings size={16} className="text-indigo-400 animate-spin-slow" />
                  <span>CSV Header Mapping</span>
                </h3>
                
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Worklog ID (Optional for Upserts)</label>
                    <select 
                      value={mappings.id}
                      onChange={(e) => setMappings({ ...mappings, id: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Generate New (Insert) --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Work Date (Required)</label>
                    <select 
                      value={mappings.work_date}
                      onChange={(e) => setMappings({ ...mappings, work_date: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Project Name (Required)</label>
                    <select 
                      value={mappings.project_name}
                      onChange={(e) => setMappings({ ...mappings, project_name: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Start Time (Optional)</label>
                    <select 
                      value={mappings.start_time}
                      onChange={(e) => setMappings({ ...mappings, start_time: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Reconstruct / Skip --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">End Time (Optional)</label>
                    <select 
                      value={mappings.end_time}
                      onChange={(e) => setMappings({ ...mappings, end_time: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Reconstruct / Skip --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Hours / Duration (Required if Times omitted)</label>
                    <select 
                      value={mappings.total_hours}
                      onChange={(e) => setMappings({ ...mappings, total_hours: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Action/Task (Optional)</label>
                    <select 
                      value={mappings.action_name}
                      onChange={(e) => setMappings({ ...mappings, action_name: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Default Fallback --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">Description (Optional)</label>
                    <select 
                      value={mappings.description}
                      onChange={(e) => setMappings({ ...mappings, description: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- Leave Blank --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-theme-text-secondary">OT Flag (Optional)</label>
                    <select 
                      value={mappings.is_ot}
                      onChange={(e) => setMappings({ ...mappings, is_ot: e.target.value })}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    >
                      <option value="">-- False --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-theme-border/80 space-y-3">
                  <h4 className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings size={12} />
                    <span>Import Settings</span>
                  </h4>
                  
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border/60">
                    <div className="space-y-0.5 pr-2">
                      <label className="text-[11px] font-bold text-theme-text cursor-pointer flex items-center gap-1.5" htmlFor="autoSplitOTToggle">
                        Auto-Split Overtime (OT)
                      </label>
                      <p className="text-[9px] text-theme-text-secondary leading-tight">
                        Weekday logs crossing 18:00 (Mon-Thu) / 17:00 (Fri) will split into Normal & OT portions.
                      </p>
                    </div>
                    <input 
                      type="checkbox"
                      id="autoSplitOTToggle"
                      checked={autoSplitOT}
                      onChange={(e) => setAutoSplitOT(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-theme-surface-secondary dark:bg-theme-surface-secondary border-theme-border"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-theme-border/80 space-y-3">
                  <h4 className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">Fallback Values</h4>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-theme-text-secondary">Default Holding (For project mismatches)</label>
                    <input 
                      type="text"
                      value={fallbackHolding}
                      onChange={(e) => setFallbackHolding(e.target.value)}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-theme-text-secondary">Default Operator Role</label>
                    <input 
                      type="text"
                      value={fallbackOperator}
                      onChange={(e) => setFallbackOperator(e.target.value)}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-theme-text-secondary">Default Action</label>
                    <input 
                      type="text"
                      value={fallbackAction}
                      onChange={(e) => setFallbackAction(e.target.value)}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-theme-text-secondary">Default Start Time (For reconstruction)</label>
                    <input 
                      type="text"
                      value={fallbackStartTime}
                      onChange={(e) => setFallbackStartTime(e.target.value)}
                      className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* CSV Exporter Container */}
            <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
                <Download className="text-indigo-400" />
                <span>Export logs to CSV</span>
              </h3>
              
              <p className="text-xs text-theme-text-secondary">
                Download a backup of logged work hours in a standard CSV format compatible with this importer.
              </p>

              <div className="space-y-3">
                {/* Employee Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-theme-text-secondary flex items-center gap-1">
                    <Users size={11} /> Select Employee
                  </label>
                  <select
                    value={selectedExportUserId}
                    onChange={(e) => setSelectedExportUserId(e.target.value)}
                    className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2.5 text-xs font-medium text-theme-text focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  >
                    <option value="">-- Select Employee --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.nickname}) — {u.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-theme-text-secondary">Start Date</label>
                  <input 
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-theme-text-secondary">End Date</label>
                  <input 
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl px-3 py-2 text-xs font-medium text-theme-text focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Record count preview */}
                {exportRecordCount !== null && selectedExportUserId && (
                  <div className="text-xs font-medium text-theme-text-secondary bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border/60 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span>Records found:</span>
                    <span className={cn(
                      "font-bold font-mono",
                      exportRecordCount > 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {exportRecordCount} rows
                    </span>
                  </div>
                )}

                <button
                  onClick={handleExport}
                  disabled={isExporting || !selectedExportUserId || exportRecordCount === 0}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-1.5 text-theme-text text-xs font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 mt-2",
                    !selectedExportUserId || exportRecordCount === 0
                      ? "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary border border-theme-border/50 cursor-not-allowed"
                      : "bg-indigo-500 hover:bg-indigo-600 disabled:bg-theme-surface-tertiary dark:bg-theme-surface-tertiary"
                  )}
                >
                  <Download size={14} />
                  <span>{isExporting ? 'Exporting...' : `Export Work Logs${exportRecordCount ? ` (${exportRecordCount})` : ''}`}</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </AppLayout>
  );
}
