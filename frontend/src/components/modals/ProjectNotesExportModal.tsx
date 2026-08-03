import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Download, Printer, Search, RefreshCw, FileText,
  AlertTriangle, Wrench, StickyNote, Activity, Table, AlignLeft,
  FolderTree
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';

export type NoteType = 'usage' | 'wi' | 'incident' | 'maintenance' | 'general';

export interface ProjectNote {
  id: string;
  project_id: string;
  workspace_id?: string | null;
  note_type: NoteType;
  title?: string | null;
  content: string;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectItem {
  id: string;
  project_name: string;
  project_code?: string | null;
  status?: string | null;
  holding?: string | null;
  department_operator?: string | null;
  bu?: string | null;
}

interface ProjectNotesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  workspaceId?: string | null;
}

const NOTE_TYPES: { type: NoteType; label: string; shortLabel: string; icon: React.ReactNode; colorClass: string }[] = [
  { type: 'wi',          label: 'Work Instruction (WI)', shortLabel: 'WI',         icon: <FileText size={13} />,       colorClass: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20' },
  { type: 'usage',       label: 'Usage Note',            shortLabel: 'Usage',      icon: <StickyNote size={13} />,     colorClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20' },
  { type: 'incident',    label: 'Incident / Issue',      shortLabel: 'Incident',   icon: <AlertTriangle size={13} />,  colorClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20' },
  { type: 'maintenance', label: 'Maintenance',           shortLabel: 'Maintenance',icon: <Wrench size={13} />,         colorClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20' },
  { type: 'general',     label: 'General Log',           shortLabel: 'General',    icon: <Activity size={13} />,       colorClass: 'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/20' },
];

export default function ProjectNotesExportModal({
  isOpen,
  onClose,
  projects,
  workspaceId,
}: ProjectNotesExportModalProps) {
  const { showToast } = useNotification();
  const [allNotes, setAllNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Settings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteType, setSelectedNoteType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'matrix' | 'document'>('matrix');
  const [onlyProjectsWithNotes, setOnlyProjectsWithNotes] = useState(false);

  // Fetch all notes for workspace/projects
  const fetchAllNotes = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      let query = supabase.from('tb_project_notes').select('*');
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      } else if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        query = query.in('project_id', projectIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setAllNotes(data || []);
    } catch (err: any) {
      console.error('Error fetching project notes:', err);
      showToast('โหลดบันทึกโปรเจคล้มเหลว: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  }, [isOpen, workspaceId, projects, showToast]);

  useEffect(() => {
    if (isOpen) {
      fetchAllNotes();
    }
  }, [isOpen, fetchAllNotes]);

  // Group notes by project_id and note_type
  const notesByProjectMap = useMemo(() => {
    const map: Record<string, Record<NoteType, ProjectNote[]>> = {};

    projects.forEach(p => {
      map[p.id] = {
        wi: [],
        usage: [],
        incident: [],
        maintenance: [],
        general: [],
      };
    });

    allNotes.forEach(note => {
      if (!map[note.project_id]) {
        map[note.project_id] = {
          wi: [],
          usage: [],
          incident: [],
          maintenance: [],
          general: [],
        };
      }
      if (map[note.project_id][note.note_type]) {
        map[note.project_id][note.note_type].push(note);
      }
    });

    return map;
  }, [projects, allNotes]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const pNotesObj = notesByProjectMap[p.id];
      const totalNotesCount = pNotesObj
        ? Object.values(pNotesObj).reduce((acc, arr) => acc + arr.length, 0)
        : 0;

      if (onlyProjectsWithNotes && totalNotesCount === 0) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (p.project_name || '').toLowerCase().includes(q);
        const matchesCode = (p.project_code || '').toLowerCase().includes(q);
        const matchesHolding = (p.holding || '').toLowerCase().includes(q);
        const matchesDept = (p.department_operator || '').toLowerCase().includes(q);

        // check if any note content matches search
        let matchesNotes = false;
        if (pNotesObj) {
          Object.values(pNotesObj).forEach(arr => {
            arr.forEach(n => {
              if ((n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)) {
                matchesNotes = true;
              }
            });
          });
        }

        if (!matchesName && !matchesCode && !matchesHolding && !matchesDept && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [projects, notesByProjectMap, searchQuery, onlyProjectsWithNotes]);

  // CSV Exporters
  const downloadCSV = (filename: string, csvContent: string) => {
    // Add UTF-8 BOM byte order mark \uFEFF to support Thai in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลด CSV สำเร็จ ✅', 'success');
  };

  const handleExportMatrixCSV = () => {
    if (filteredProjects.length === 0) {
      showToast('ไม่พบข้อมูลสำหรับส่งออก CSV', 'error');
      return;
    }

    const headers = [
      'Project Code',
      'Project Name',
      'Status',
      'Holding',
      'Department',
      'Work Instruction (WI)',
      'Usage Notes',
      'Incidents & Issues',
      'Maintenance Notes',
      'General Logs',
      'Total Notes'
    ];

    const rows = [headers.map(h => `"${h}"`).join(',')];

    filteredProjects.forEach(p => {
      const pNotes = notesByProjectMap[p.id] || { wi: [], usage: [], incident: [], maintenance: [], general: [] };

      const formatNotesCell = (notesArr: ProjectNote[]) => {
        if (!notesArr || notesArr.length === 0) return '""';
        const formattedStr = notesArr.map((n, idx) => {
          const titleStr = n.title ? `[${n.title}] ` : '';
          const authorStr = n.author_name ? ` (${n.author_name})` : '';
          const dateStr = new Date(n.created_at).toLocaleDateString('th-TH');
          return `${idx + 1}. ${titleStr}${n.content.replace(/"/g, '""')}${authorStr} [${dateStr}]`;
        }).join('\n');
        return `"${formattedStr}"`;
      };

      const totalCount = Object.values(pNotes).reduce((acc, arr) => acc + arr.length, 0);

      const rowValues = [
        `"${(p.project_code || '').replace(/"/g, '""')}"`,
        `"${(p.project_name || '').replace(/"/g, '""')}"`,
        `"${(p.status || '').replace(/"/g, '""')}"`,
        `"${(p.holding || '').replace(/"/g, '""')}"`,
        `"${(p.department_operator || '').replace(/"/g, '""')}"`,
        formatNotesCell(pNotes.wi),
        formatNotesCell(pNotes.usage),
        formatNotesCell(pNotes.incident),
        formatNotesCell(pNotes.maintenance),
        formatNotesCell(pNotes.general),
        `"${totalCount}"`
      ];

      rows.push(rowValues.join(','));
    });

    const filename = `project_notes_matrix_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, rows.join('\n'));
  };

  const handleExportAllNotesCSV = () => {
    if (allNotes.length === 0) {
      showToast('ไม่มีบันทึกข้อมูลในระบบส่งออก', 'error');
      return;
    }

    const headers = [
      'Project Code',
      'Project Name',
      'Holding',
      'Note Type',
      'Title',
      'Content',
      'Author',
      'Created At',
      'Updated At'
    ];

    const rows = [headers.map(h => `"${h}"`).join(',')];

    filteredProjects.forEach(p => {
      const pNotes = notesByProjectMap[p.id];
      if (!pNotes) return;

      Object.entries(pNotes).forEach(([type, arr]) => {
        arr.forEach(n => {
          const rowValues = [
            `"${(p.project_code || '').replace(/"/g, '""')}"`,
            `"${(p.project_name || '').replace(/"/g, '""')}"`,
            `"${(p.holding || '').replace(/"/g, '""')}"`,
            `"${type.toUpperCase()}"`,
            `"${(n.title || '').replace(/"/g, '""')}"`,
            `"${(n.content || '').replace(/"/g, '""')}"`,
            `"${(n.author_name || '').replace(/"/g, '""')}"`,
            `"${new Date(n.created_at).toLocaleString('th-TH')}"`,
            `"${new Date(n.updated_at).toLocaleString('th-TH')}"`
          ];
          rows.push(rowValues.join(','));
        });
      });
    });

    const filename = `project_notes_all_records_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, rows.join('\n'));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto bg-black/70 backdrop-blur-md print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Dialog Container */}
      <div className="relative z-10 w-full max-w-7xl h-[92vh] theme-panel border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col print:h-auto print:border-none print:shadow-none print:rounded-none print:bg-white print:text-slate-900">
        
        {/* ── Modal Header (Hidden on Print) ── */}
        <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between bg-theme-surface-secondary/80 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
                <span>Project Notes Overview & Export</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                  Preview
                </span>
              </h2>
              <p className="text-xs text-theme-text-muted">
                พรีวิวและสรุปบันทึกโน้ตของโปรเจกต์ทั้งหมด ส่งออก CSV หรือพิมพ์ออก PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllNotes}
              className="p-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Controls Toolbar (Hidden on Print) ── */}
        <div className="px-6 py-3 border-b border-theme-border bg-theme-surface/50 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          {/* Left: Filters & Search */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาโปรเจกต์ หรือ ข้อความใน Note..."
                className="w-full theme-field pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:ring-2 focus:ring-indigo-500/30 outline-none"
              />
            </div>

            {/* Note Type Filter */}
            <select
              value={selectedNoteType}
              onChange={e => setSelectedNoteType(e.target.value)}
              className="theme-field px-3 py-1.5 rounded-xl text-xs border outline-none"
            >
              <option value="all">📂 หมวดหมู่ Note ทั้งหมด</option>
              {NOTE_TYPES.map(nt => (
                <option key={nt.type} value={nt.type}>{nt.label}</option>
              ))}
            </select>

            {/* Checkbox: Show only projects with notes */}
            <label className="flex items-center gap-2 text-xs text-theme-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyProjectsWithNotes}
                onChange={e => setOnlyProjectsWithNotes(e.target.checked)}
                className="rounded border-theme-border text-indigo-600 focus:ring-indigo-500"
              />
              <span>เฉพาะโปรเจกต์ที่มี Notes</span>
            </label>
          </div>

          {/* Right: View mode & Export actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-theme-surface-secondary rounded-xl border border-theme-border p-0.5">
              <button
                onClick={() => setViewMode('matrix')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                  viewMode === 'matrix'
                    ? 'bg-white dark:bg-theme-surface text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/20 font-bold'
                    : 'text-theme-text-muted hover:text-theme-text'
                )}
              >
                <Table size={13} />
                <span>Matrix View</span>
              </button>
              <button
                onClick={() => setViewMode('document')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                  viewMode === 'document'
                    ? 'bg-white dark:bg-theme-surface text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/20 font-bold'
                    : 'text-theme-text-muted hover:text-theme-text'
                )}
              >
                <AlignLeft size={13} />
                <span>Document View</span>
              </button>
            </div>

            <div className="h-4 w-px bg-theme-border mx-1 hidden md:block" />

            {/* CSV Matrix Export */}
            <button
              onClick={handleExportMatrixCSV}
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              title="ส่งออก CSV แบบตารางสรุป Matrix"
            >
              <Download size={13} />
              <span>CSV (Matrix)</span>
            </button>

            {/* CSV Raw Export */}
            <button
              onClick={handleExportAllNotesCSV}
              className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              title="ส่งออก CSV รายการ Notes ทั้งหมด (Flat list)"
            >
              <Download size={13} />
              <span>CSV (All Notes)</span>
            </button>

            {/* Print / Save PDF */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* ── Main Printable Content Area ── */}
        <div className="flex-1 overflow-auto p-6 bg-theme-surface print:p-0 print:overflow-visible print:bg-white">
          
          {/* Document Printable Header (Shown on Print / Doc Mode) */}
          <div className="mb-6 p-4 rounded-xl border border-theme-border bg-theme-surface-secondary/50 print:border-b-2 print:border-slate-300 print:bg-white print:p-0 print:mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-xl font-bold text-theme-text print:text-slate-900">
                  📋 Project Registry Notes Overview Report
                </h1>
                <p className="text-xs text-theme-text-muted print:text-slate-600 mt-1">
                  รายงานสรุปบันทึกการปฏิบัติงานและเอกสารอ้างอิงรายโปรเจกต์ | ข้อมูล ณ วันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="text-right text-xs text-theme-text-muted print:text-slate-600">
                <div>โปรเจกต์ทั้งหมด: <strong className="text-theme-text print:text-slate-900">{filteredProjects.length}</strong> โครงการ</div>
                <div>บันทึกทั้งหมด: <strong className="text-theme-text print:text-slate-900">{allNotes.length}</strong> รายการ</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-theme-text-muted">
              <RefreshCw size={24} className="animate-spin mb-3 text-indigo-500" />
              <p className="text-sm font-medium">กำลังโหลดข้อมูลบันทึกโปรเจกต์...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-theme-border rounded-2xl">
              <FolderTree size={40} className="mx-auto mb-3 text-theme-text-muted opacity-40" />
              <h3 className="text-base font-bold text-theme-text">ไม่พบข้อมูลโปรเจกต์ตรงตามเงื่อนไข</h3>
              <p className="text-xs text-theme-text-muted mt-1">ลองปรับเปลี่ยนคำค้นหา หรือยกเลิกการกรอง</p>
            </div>
          ) : viewMode === 'matrix' ? (
            /* ─────────────────────────────────────────────────────────────
               MATRIX TABLE VIEW
               ───────────────────────────────────────────────────────────── */
            <div className="w-full overflow-x-auto rounded-xl border border-theme-border shadow-sm print:border-slate-300">
              <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
                <thead>
                  <tr className="bg-theme-surface-secondary border-b border-theme-border text-theme-text-secondary font-bold print:bg-slate-100 print:text-slate-900">
                    <th className="py-3 px-4 w-[220px] sticky left-0 z-10 bg-theme-surface-secondary border-r border-theme-border print:static print:bg-slate-100">
                      โปรเจกต์ (Project Info)
                    </th>
                    {NOTE_TYPES.filter(nt => selectedNoteType === 'all' || selectedNoteType === nt.type).map(nt => (
                      <th key={nt.type} className="py-3 px-3 min-w-[180px] max-w-[240px] border-r border-theme-border last:border-r-0">
                        <div className="flex items-center gap-1.5">
                          {nt.icon}
                          <span>{nt.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border print:divide-slate-200">
                  {filteredProjects.map((project, idx) => {
                    const pNotesObj = notesByProjectMap[project.id] || { wi: [], usage: [], incident: [], maintenance: [], general: [] };
                    const activeTypes = NOTE_TYPES.filter(nt => selectedNoteType === 'all' || selectedNoteType === nt.type);

                    return (
                      <tr key={project.id} className="hover:bg-theme-surface-secondary/40 transition-colors print:page-break-inside-avoid">
                        {/* Project Info Column */}
                        <td className="py-3 px-4 sticky left-0 z-10 bg-theme-surface border-r border-theme-border align-top font-medium print:static print:bg-white">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-theme-text-muted font-mono mt-0.5">{idx + 1}.</span>
                            <div>
                              <div className="font-bold text-theme-text print:text-slate-900 leading-tight">
                                {project.project_name}
                              </div>
                              {project.project_code && (
                                <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 print:text-indigo-800 font-semibold mt-0.5">
                                  {project.project_code}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                {project.status && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-theme-surface-secondary border border-theme-border text-theme-text-secondary print:border-slate-300">
                                    {project.status}
                                  </span>
                                )}
                                {project.holding && (
                                  <span className="text-[10px] text-theme-text-muted print:text-slate-600">
                                    🏢 {project.holding}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Note Type Columns */}
                        {activeTypes.map(nt => {
                          const notesList = pNotesObj[nt.type] || [];
                          return (
                            <td key={nt.type} className="py-3 px-3 border-r border-theme-border last:border-r-0 align-top">
                              {notesList.length === 0 ? (
                                <span className="text-theme-text-muted/40 italic text-[11px] print:text-slate-300">—</span>
                              ) : (
                                <div className="space-y-2">
                                  {notesList.map(n => (
                                    <div
                                      key={n.id}
                                      className={cn(
                                        'p-2 rounded-lg text-[11px] border leading-relaxed',
                                        nt.colorClass,
                                        'print:bg-slate-50 print:text-slate-900 print:border-slate-300'
                                      )}
                                    >
                                      {n.title && (
                                        <div className="font-bold border-b border-current/15 pb-1 mb-1 flex items-center justify-between gap-1">
                                          <span>{n.title}</span>
                                        </div>
                                      )}
                                      <p className="whitespace-pre-wrap break-words">{n.content}</p>
                                      <div className="mt-1.5 pt-1 border-t border-current/10 text-[9px] opacity-80 flex items-center justify-between gap-1">
                                        <span>👤 {n.author_name || 'ไม่ระบุชื่อ'}</span>
                                        <span>📅 {new Date(n.created_at).toLocaleDateString('th-TH')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               EXECUTIVE DOCUMENT VIEW
               ───────────────────────────────────────────────────────────── */
            <div className="space-y-6">
              {filteredProjects.map((project, idx) => {
                const pNotesObj = notesByProjectMap[project.id] || { wi: [], usage: [], incident: [], maintenance: [], general: [] };
                const totalProjectNotes = Object.values(pNotesObj).reduce((a, b) => a + b.length, 0);

                return (
                  <div
                    key={project.id}
                    className="p-5 rounded-2xl border border-theme-border bg-theme-surface-secondary/30 print:bg-white print:border-slate-300 print:p-4 print:page-break-inside-avoid shadow-sm"
                  >
                    {/* Project Header */}
                    <div className="flex items-start justify-between border-b border-theme-border pb-3 mb-4 print:border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                            #{idx + 1}
                          </span>
                          <h3 className="text-base font-bold text-theme-text print:text-slate-900">
                            {project.project_name}
                          </h3>
                          {project.project_code && (
                            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              ({project.project_code})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-theme-text-muted print:text-slate-600 mt-1">
                          {project.status && <span>Status: <strong>{project.status}</strong></span>}
                          {project.holding && <span>Holding: <strong>{project.holding}</strong></span>}
                          {project.department_operator && <span>Dept: <strong>{project.department_operator}</strong></span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 rounded-full bg-theme-surface border border-theme-border text-xs font-semibold text-theme-text-secondary print:border-slate-300">
                          {totalProjectNotes} Notes
                        </span>
                      </div>
                    </div>

                    {/* Notes by Type */}
                    {totalProjectNotes === 0 ? (
                      <p className="text-xs text-theme-text-muted italic py-2">ไม่มีบันทึกข้อมูลในโปรเจกต์นี้</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {NOTE_TYPES.filter(nt => selectedNoteType === 'all' || selectedNoteType === nt.type).map(nt => {
                          const notesList = pNotesObj[nt.type] || [];
                          if (notesList.length === 0) return null;

                          return (
                            <div key={nt.type} className="p-3 rounded-xl border border-theme-border bg-theme-surface print:bg-slate-50 print:border-slate-200">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-theme-text mb-2 print:text-slate-900">
                                {nt.icon}
                                <span>{nt.label} ({notesList.length})</span>
                              </div>
                              <div className="space-y-2">
                                {notesList.map(n => (
                                  <div key={n.id} className="p-2.5 rounded-lg bg-theme-surface-secondary/70 border border-theme-border/70 text-xs print:bg-white print:border-slate-300">
                                    {n.title && <div className="font-bold text-theme-text print:text-slate-900 mb-1">{n.title}</div>}
                                    <p className="text-theme-text-secondary print:text-slate-800 whitespace-pre-wrap">{n.content}</p>
                                    <div className="mt-2 text-[10px] text-theme-text-muted print:text-slate-500 flex items-center justify-between">
                                      <span>โดย: {n.author_name || 'ไม่ระบุ'}</span>
                                      <span>{new Date(n.created_at).toLocaleString('th-TH')}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
