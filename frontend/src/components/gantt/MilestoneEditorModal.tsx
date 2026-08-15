import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import type { ProjectMilestone } from '../../lib/project-management';

interface MilestoneEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: ProjectMilestone | null;
  onSave: (milestone: ProjectMilestone) => void;
}

interface MilestoneFormContentProps {
  milestone: ProjectMilestone | null;
  onClose: () => void;
  onSave: (milestone: ProjectMilestone) => void;
}

const MilestoneFormContent: React.FC<MilestoneFormContentProps> = ({
  milestone,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(milestone?.milestone_name || '');
  const [startDate, setStartDate] = useState(milestone?.start_date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(milestone?.due_date || '');
  const [status, setStatus] = useState<ProjectMilestone['status']>(milestone?.status || 'in_progress');
  const [progress, setProgress] = useState(milestone?.progress_percent || 0);
  const [assignedUser, setAssignedUser] = useState(milestone?.assigned_user_name || '');
  const [notes, setNotes] = useState(milestone?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: milestone?.id,
      project_id: milestone?.project_id || '',
      milestone_name: name.trim(),
      start_date: startDate || null,
      due_date: dueDate || null,
      status,
      progress_percent: Number(progress) || 0,
      assigned_user_name: assignedUser.trim() || null,
      sequence_order: milestone?.sequence_order || 0,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
      {/* Milestone Name */}
      <div className="space-y-1">
        <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
          ชื่อ Milestone *
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น Phase 1: ออกแบบ DB และ API..."
          className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="block font-bold text-theme-text-muted text-[10px] uppercase tracking-wider">
            วันเริ่มต้น
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block font-bold text-theme-text-muted text-[10px] uppercase tracking-wider">
            กำหนดเสร็จ (Due Date)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Status & Progress */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="block font-bold text-theme-text-muted text-[10px] uppercase tracking-wider">
            สถานะ
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectMilestone['status'])}
            className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500"
          >
            <option value="planning">Planning (วางแผน)</option>
            <option value="in_progress">In Progress (กำลังทำ)</option>
            <option value="completed">Completed (เสร็จสิ้น)</option>
            <option value="blocked">Blocked (ติดปัญหา)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block font-bold text-theme-text-muted text-[10px] uppercase tracking-wider">
            ความคืบหน้า ({progress}%)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-purple-600 mt-2 cursor-pointer"
          />
        </div>
      </div>

      {/* Assigned User */}
      <div className="space-y-1">
        <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
          ผู้รับผิดชอบหลัก
        </label>
        <input
          type="text"
          value={assignedUser}
          onChange={(e) => setAssignedUser(e.target.value)}
          placeholder="เช่น คุณสมชาย (Dev Lead)..."
          className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="block font-bold text-theme-text-muted text-[10px] uppercase tracking-wider">
          หมายเหตุ / รายละเอียดเพิ่มเติม
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="เงื่อนไข หรือสิ่งที่จะส่งมอบ..."
          className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-purple-500 custom-scrollbar resize-none"
        />
      </div>

      {/* Footer Buttons */}
      <div className="pt-2 flex items-center justify-end gap-2 border-t border-theme-border/40">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text font-bold text-xs cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 cursor-pointer"
        >
          บันทึก Milestone
        </button>
      </div>
    </form>
  );
};

export const MilestoneEditorModal: React.FC<MilestoneEditorModalProps> = ({
  isOpen,
  onClose,
  milestone,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden text-theme-text animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Flag size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-theme-text">
                {milestone ? 'แก้ไข Milestone' : 'เพิ่ม Milestone ใหม่'}
              </h3>
              <p className="text-[11px] text-theme-text-muted">กำหนดเป้าหมายสำคัญของโครงการ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body with fresh key */}
        <MilestoneFormContent
          key={milestone?.id || 'new_milestone'}
          milestone={milestone}
          onClose={onClose}
          onSave={onSave}
        />
      </div>
    </div>
  );
};
