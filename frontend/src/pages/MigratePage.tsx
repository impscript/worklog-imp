import { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Download, Database, Sparkles, Settings, Eye, Play, Check, Users, User } from 'lucide-react';
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

export default function MigratePage() {
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
      // Load all users for selection dropdowns
      const { data: usersData } = await supabase.from('users').select('id, full_name, nickname, department').order('full_name');
      if (usersData) {
        setUsersList(usersData);
      }
    }
    loadMasterData();
  }, [navigate]);

  useEffect(() => {
    if (!selectedImportUserId) {
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
      const work_date = row[mappings.work_date] || '';
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

      // Determine structural values: (1) matched project, (2) csv columns, (3) fallbacks
      let holding = fallbackHolding;
      let department_operator = fallbackOperator;
      let project_type = 'Management';
      let module = '';
      let bu = '';
      let department = '';
      let action_channel: string | null = null;
      let break_time = true;

      const match = findMatch(project_name);
      if (match) {
        holding = match.holding;
        department_operator = match.department_operator;
        project_type = match.project_type || 'Management';
        module = match.module || '';
        bu = match.bu || '';
        department = match.department || '';
      } else {
        // Check CSV metadata fallback
        holding = getCsvMetadata(row, ['holding'], fallbackHolding);
        department_operator = getCsvMetadata(row, ['department_operator', 'operator', 'dept_operator'], fallbackOperator);
        project_type = getCsvMetadata(row, ['project_type', 'projecttype', 'type'], 'Management');
        module = getCsvMetadata(row, ['module'], '');
        bu = getCsvMetadata(row, ['bu'], '');
        department = getCsvMetadata(row, ['department', 'dept'], '');
      }

      const csvChannel = getCsvMetadata(row, ['action_channel', 'channel'], null);
      if (csvChannel) action_channel = csvChannel;

      const csvBreakTime = getCsvMetadata(row, ['break_time', 'breaktime'], '');
      if (csvBreakTime) {
        break_time = csvBreakTime.toLowerCase() === 'true' || csvBreakTime === '1' || csvBreakTime.toLowerCase() === 'yes';
      }

      let status: 'ready' | 'warning' | 'error' = 'ready';
      let message = actionType === 'update' ? 'Will update existing worklog' : 'Ready to import';

      if (!match) {
        status = 'warning';
        message = `Project mismatch. Will map to fallback [${holding} - ${department_operator}]`;
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

  // Handle CSV Import
  const handleImport = async () => {
    if (previewRows.length === 0 || isProcessing) return;
    const errors = previewRows.filter(r => r.status === 'error');
    if (errors.length > 0) {
      alert(`Please fix the ${errors.length} error(s) before importing.`);
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
        channel: row.action_channel || 'CSV Import'
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
    if (!selectedExportUserId) { setExportRecordCount(null); return; }
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
        alert('Failed to export logs. Please try again.');
        return;
      }

      if (!data || data.length === 0) {
        alert('No worklogs found for the selected date range.');
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

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
            <Database className="text-indigo-400" />
            <span>Data Migration (Import & Export CSV)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Easily import historical work entries from custom CSV backups or export your current logged work activities.
          </p>
        </div>

        {/* Two-Column Tool Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Workspaces: CSV Importer & Preview */}
          <div className="lg:col-span-2 space-y-6">

            {/* Import Target User Selector */}
            {csvData.length === 0 && (
              <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                  <User size={16} className="text-indigo-400" />
                  <span>Import Target User</span>
                </h3>
                <p className="text-xs text-slate-400 mb-3">Select which employee this CSV data will be imported for.</p>
                <select
                  value={selectedImportUserId}
                  onChange={(e) => setSelectedImportUserId(e.target.value)}
                  className="w-full bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
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
                    : "border-slate-700/80 hover:border-indigo-500/50 hover:bg-slate-900/10"
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
                  <h3 className="text-lg font-bold text-white">Drag & drop your CSV backup here</h3>
                  <p className="text-sm text-slate-400 mt-1">or click to browse your computer files</p>
                </div>
                <div className="text-xs text-slate-500 bg-[#0F172A]/50 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Supports auto header detection & fuzzy mapping</span>
                </div>
              </div>
            ) : (
              /* Step 2: Mapping, Preview & Import Control Panel */
              <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* File Header */}
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Active File</span>
                    <h3 className="text-lg font-bold text-white font-mono">{fileName}</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setCsvData([]);
                      setFileName('');
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    Reset File
                  </button>
                </div>

                {/* Live Validation & Preview Table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Eye size={16} className="text-indigo-400" />
                      <span>Data Preview & Validation ({previewRows.length} Rows)</span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>Ready: {previewRows.filter(r => r.status === 'ready').length}</span>
                      </span>
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle size={12} />
                        <span>Warnings: {previewRows.filter(r => r.status === 'warning').length}</span>
                      </span>
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle size={12} />
                        <span>Errors: {previewRows.filter(r => r.status === 'error').length}</span>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#0F172A]/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800/60 font-semibold text-slate-300">
                          <th className="p-3">Status</th>
                          <th className="p-3">Work Date</th>
                          <th className="p-3">Times / Hours</th>
                          <th className="p-3">Project Name</th>
                          <th className="p-3">Action Name</th>
                          <th className="p-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {previewRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-950/20 text-slate-300">
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
                            <td className="p-3 font-mono font-bold text-white">{row.work_date}</td>
                            <td className="p-3">
                              <div className="font-mono font-semibold">
                                {row.start_time ? `${row.start_time} - ${row.end_time}` : '-'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">({row.total_hours.toFixed(1)} hrs)</div>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-white">{row.project_name}</span>
                            </td>
                            <td className="p-3 text-slate-400">{row.action_name}</td>
                            <td className="p-3 italic truncate max-w-[150px]" title={row.description}>
                              {row.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewRows.length > 5 && (
                    <p className="text-[11px] text-slate-500 text-right italic">Showing first 5 rows for verification.</p>
                  )}
                </div>

                {/* Active Action Button */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-4">
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-indigo-400">Importing rows to Supabase database...</span>
                        <span className="text-white font-mono">{importProgress}%</span>
                      </div>
                      <div className="w-full bg-[#0F172A] rounded-full h-2 overflow-hidden border border-slate-800">
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
                          <h4 className="text-sm font-bold text-white">Import completed successfully!</h4>
                          <p className="text-xs text-slate-400">
                            Successfully imported {importStats.success} logs. Mismatches/Errors skipped: {importStats.failed}.
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setImportStats(null);
                          navigate('/');
                        }}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"
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
                          ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                          : "bg-indigo-500 hover:bg-indigo-600 text-white hover:shadow-indigo-500/10 active:scale-95"
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
              <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Settings size={16} className="text-indigo-400 animate-spin-slow" />
                  <span>CSV Header Mapping</span>
                </h3>
                
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Worklog ID (Optional for Upserts)</label>
                    <select 
                      value={mappings.id}
                      onChange={(e) => setMappings({ ...mappings, id: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Generate New (Insert) --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Work Date (Required)</label>
                    <select 
                      value={mappings.work_date}
                      onChange={(e) => setMappings({ ...mappings, work_date: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Project Name (Required)</label>
                    <select 
                      value={mappings.project_name}
                      onChange={(e) => setMappings({ ...mappings, project_name: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Start Time (Optional)</label>
                    <select 
                      value={mappings.start_time}
                      onChange={(e) => setMappings({ ...mappings, start_time: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Reconstruct / Skip --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">End Time (Optional)</label>
                    <select 
                      value={mappings.end_time}
                      onChange={(e) => setMappings({ ...mappings, end_time: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Reconstruct / Skip --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Hours / Duration (Required if Times omitted)</label>
                    <select 
                      value={mappings.total_hours}
                      onChange={(e) => setMappings({ ...mappings, total_hours: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Action/Task (Optional)</label>
                    <select 
                      value={mappings.action_name}
                      onChange={(e) => setMappings({ ...mappings, action_name: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Default Fallback --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Description (Optional)</label>
                    <select 
                      value={mappings.description}
                      onChange={(e) => setMappings({ ...mappings, description: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- Leave Blank --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400">OT Flag (Optional)</label>
                    <select 
                      value={mappings.is_ot}
                      onChange={(e) => setMappings({ ...mappings, is_ot: e.target.value })}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    >
                      <option value="">-- False --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <h4 className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings size={12} />
                    <span>Import Settings</span>
                  </h4>
                  
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0F172A]/50 border border-slate-800/60">
                    <div className="space-y-0.5 pr-2">
                      <label className="text-[11px] font-bold text-slate-200 cursor-pointer flex items-center gap-1.5" htmlFor="autoSplitOTToggle">
                        Auto-Split Overtime (OT)
                      </label>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Weekday logs crossing 18:00 (Mon-Thu) / 17:00 (Fri) will split into Normal & OT portions.
                      </p>
                    </div>
                    <input 
                      type="checkbox"
                      id="autoSplitOTToggle"
                      checked={autoSplitOT}
                      onChange={(e) => setAutoSplitOT(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-[#0F172A] border-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <h4 className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">Fallback Values</h4>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-400">Default Holding (For project mismatches)</label>
                    <input 
                      type="text"
                      value={fallbackHolding}
                      onChange={(e) => setFallbackHolding(e.target.value)}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-400">Default Operator Role</label>
                    <input 
                      type="text"
                      value={fallbackOperator}
                      onChange={(e) => setFallbackOperator(e.target.value)}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-400">Default Action</label>
                    <input 
                      type="text"
                      value={fallbackAction}
                      onChange={(e) => setFallbackAction(e.target.value)}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-400">Default Start Time (For reconstruction)</label>
                    <input 
                      type="text"
                      value={fallbackStartTime}
                      onChange={(e) => setFallbackStartTime(e.target.value)}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* CSV Exporter Container */}
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Download className="text-indigo-400" />
                <span>Export logs to CSV</span>
              </h3>
              
              <p className="text-xs text-slate-400">
                Download a backup of logged work hours in a standard CSV format compatible with this importer.
              </p>

              <div className="space-y-3">
                {/* Employee Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Users size={11} /> Select Employee
                  </label>
                  <select
                    value={selectedExportUserId}
                    onChange={(e) => setSelectedExportUserId(e.target.value)}
                    className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
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
                  <label className="text-[11px] font-bold text-slate-400">Start Date</label>
                  <input 
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400">End Date</label>
                  <input 
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="bg-[#0F172A] border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Record count preview */}
                {exportRecordCount !== null && selectedExportUserId && (
                  <div className="text-xs font-medium text-slate-400 bg-[#0F172A]/50 border border-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
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
                    "w-full inline-flex items-center justify-center gap-1.5 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 mt-2",
                    !selectedExportUserId || exportRecordCount === 0
                      ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                      : "bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800"
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
