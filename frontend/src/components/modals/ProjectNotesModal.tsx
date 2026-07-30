import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Plus, Edit2, Trash2, Save, FileText, AlertTriangle,
  Wrench, StickyNote, Activity, RefreshCw, User, Calendar
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

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: React.ReactNode; color: string }> = {
  wi:          { label: 'Work Instruction (WI)', icon: <FileText size={13} />,       color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  usage:       { label: 'Usage Note',            icon: <StickyNote size={13} />,     color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  incident:    { label: 'Incident / Issue',      icon: <AlertTriangle size={13} />,  color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  maintenance: { label: 'Maintenance',           icon: <Wrench size={13} />,         color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  general:     { label: 'General Log',           icon: <Activity size={13} />,       color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
};

interface ProjectNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: { id: string; project_name: string; workspace_id?: string | null } | null;
  onNotesUpdated?: () => void;
}

export default function ProjectNotesModal({
  isOpen,
  onClose,
  project,
  onNotesUpdated,
}: ProjectNotesModalProps) {
  const { showToast, showConfirm } = useNotification();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form State
  const [noteType, setNoteType] = useState<NoteType>('wi');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');

  // Auto-fill current user name as author default
  useEffect(() => {
    if (isOpen) {
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session?.userName || session?.displayName || session?.user?.name) {
            setAuthorName(session.userName || session.displayName || session.user?.name || '');
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
  }, [isOpen]);

  const loadNotes = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_project_notes')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err: any) {
      showToast('โหลดบันทึกโปรเจคล้มเหลว: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  }, [project?.id, showToast]);

  useEffect(() => {
    if (isOpen && project?.id) {
      loadNotes();
      resetForm();
    }
  }, [isOpen, project?.id, loadNotes]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingNoteId(null);
    setNoteType('wi');
    setTitle('');
    setContent('');
  };

  const handleEditClick = (note: ProjectNote) => {
    setIsEditing(true);
    setEditingNoteId(note.id);
    setNoteType(note.note_type);
    setTitle(note.title || '');
    setContent(note.content);
    if (note.author_name) setAuthorName(note.author_name);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('กรุณากรอกรายละเอียดบันทึก', 'error');
      return;
    }
    if (!project?.id) return;

    setSubmitting(true);
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const workspaceId = session?.activeWorkspaceId || project.workspace_id;

      const payload = {
        project_id: project.id,
        workspace_id: workspaceId || null,
        note_type: noteType,
        title: title.trim() || null,
        content: content.trim(),
        author_name: authorName.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && editingNoteId) {
        const { error } = await supabase
          .from('tb_project_notes')
          .update(payload)
          .eq('id', editingNoteId);

        if (error) throw error;
        showToast('อัปเดตบันทึกสำเร็จ ✅', 'success');
      } else {
        const { error } = await supabase
          .from('tb_project_notes')
          .insert(payload);

        if (error) throw error;
        showToast('เพิ่มบันทึกใหม่สำเร็จ ✅', 'success');
      }

      resetForm();
      await loadNotes();
      if (onNotesUpdated) onNotesUpdated();
    } catch (err: any) {
      showToast('บันทึกข้อมูลไม่สำเร็จ: ' + (err.message || err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (note: ProjectNote) => {
    const ok = await showConfirm({
      title: 'ยืนยันการลบบันทึก',
      message: `คุณกำลังจะลบบันทึก: "${note.title || 'ไม่มีหัวข้อ'}"\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      type: 'danger',
    });

    if (!ok) return;

    try {
      const { error } = await supabase
        .from('tb_project_notes')
        .delete()
        .eq('id', note.id);

      if (error) throw error;
      showToast('ลบบันทึกเรียบร้อยแล้ว', 'success');
      await loadNotes();
      if (onNotesUpdated) onNotesUpdated();
    } catch (err: any) {
      showToast('ลบบันทึกไม่สำเร็จ: ' + (err.message || err), 'error');
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl theme-panel border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-text flex items-center gap-2">
                <span>บันทึก & Internal Logs</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                  {project.project_name}
                </span>
              </h2>
              <p className="text-[11px] text-theme-text-muted">
                จัดการบันทึก Work Instructions (WI), บันทึกการใช้งาน, การดูแลรักษา และประวัติสำคัญ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-theme-surface-tertiary text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* ── Form Section ── */}
          <form onSubmit={handleSave} className="p-4 rounded-xl border border-theme-border/80 bg-theme-surface-secondary/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                {isEditing ? (
                  <><Edit2 size={13} className="text-indigo-500" /> แก้ไขบันทึก</>
                ) : (
                  <><Plus size={13} className="text-indigo-500" /> เพิ่มบันทึกใหม่</>
                )}
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-indigo-500 hover:underline font-semibold"
                >
                  + เพิ่มรายการใหม่แทน
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  ประเภทบันทึก *
                </label>
                <select
                  value={noteType}
                  onChange={e => setNoteType(e.target.value as NoteType)}
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all"
                >
                  {Object.entries(NOTE_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  หัวข้อ / Topic (ไม่บังคับ)
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="เช่น คู่มือการ Deploy, ช่องทางติดต่อ Admin..."
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  ผู้บันทึก
                </label>
                <input
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  placeholder="ชื่อผู้บันทึก..."
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                รายละเอียดบันทึก *
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                placeholder="ระบุรายละเอียด Work Instruction, วิธีการใช้งาน หรือประวัติปรับปรุง..."
                className="w-full theme-field rounded-lg px-3.5 py-2.5 text-xs border focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all resize-y"
              />
            </div>

            <div className="flex justify-end gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary border border-theme-border transition-all"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center gap-1.5"
              >
                {submitting ? (
                  <><RefreshCw size={13} className="animate-spin" /> บันทึก...</>
                ) : (
                  <><Save size={13} /> {isEditing ? 'อัปเดต' : 'บันทึกรายการ'}</>
                )}
              </button>
            </div>
          </form>

          {/* ── Notes List Section ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-purple-500" />
                ประวัติบันทึกทั้งหมด ({notes.length} รายการ)
              </h3>
              <button
                type="button"
                onClick={loadNotes}
                className="p-1 rounded text-theme-text-muted hover:text-theme-text transition-colors"
                title="รีเฟรช"
              >
                <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-theme-text-muted flex justify-center items-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-500" />
                กำลังโหลดบันทึก...
              </div>
            ) : notes.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-theme-border/70 rounded-xl">
                <p className="text-xs text-theme-text-muted">ยังไม่มีบันทึกในโปรเจคนี้ กรุณากรอกแบบฟอร์มด้านบนเพื่อเพิ่มบันทึกแรก</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notes.map(note => {
                  const typeCfg = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.general;
                  const formattedDate = new Date(note.created_at).toLocaleDateString('th-TH', {
                    year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl border border-theme-border/80 bg-theme-surface hover:border-purple-500/30 transition-all group relative"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                            typeCfg.color
                          )}>
                            {typeCfg.icon}
                            <span>{typeCfg.label}</span>
                          </span>
                          {note.title && (
                            <h4 className="text-xs font-bold text-theme-text">
                              {note.title}
                            </h4>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleEditClick(note)}
                            className="p-1 rounded border border-theme-border bg-theme-surface-secondary hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                            title="แก้ไข"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(note)}
                            className="p-1 rounded border border-theme-border bg-theme-surface-secondary hover:bg-rose-50 dark:hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                            title="ลบ"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-theme-text-secondary whitespace-pre-wrap leading-relaxed mt-1">
                        {note.content}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-theme-border/40 text-[10px] text-theme-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          <span>{formattedDate}</span>
                        </span>
                        {note.author_name && (
                          <span className="flex items-center gap-1">
                            <User size={11} />
                            <span>โดย: <strong className="text-theme-text-secondary">{note.author_name}</strong></span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-theme-border/60 bg-theme-surface-secondary/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary border border-theme-border transition-all"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
