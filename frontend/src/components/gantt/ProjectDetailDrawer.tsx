import React, { useState, useMemo } from 'react';
import {
  X,
  Save,
  Calendar,
  User,
  Users,
  DollarSign,
  Flag,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type {
  GanttProject,
  ProjectStatus,
  TeamMemberContribution,
  ProjectMilestone,
  TeamRole,
} from '../../lib/project-management';
import {
  TEAM_ROLE_LABELS,
  calculateTotalSavings,
  updateProjectGanttOverview,
  saveTeamMemberContributions,
  saveProjectMilestones,
  saveProjectCostSavings,
} from '../../lib/project-management';
import { MilestoneEditorModal } from './MilestoneEditorModal';
import { ConfirmDialogModal } from '../modals/ConfirmDialogModal';
import { cn } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';

interface ProjectDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: GanttProject | null;
  onProjectUpdated: () => void;
  availableUsers?: { id: string; name: string; email?: string }[];
}

interface ProjectDetailDrawerContentProps {
  project: GanttProject;
  onClose: () => void;
  onProjectUpdated: () => void;
  availableUsers: { id: string; name: string; email?: string }[];
}

const ProjectDetailDrawerContent: React.FC<ProjectDetailDrawerContentProps> = ({
  project,
  onClose,
  onProjectUpdated,
  availableUsers,
}) => {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'savings'>('overview');
  const [isSaving, setIsSaving] = useState(false);

  // Tab 1: Overview Form State
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [dueDate, setDueDate] = useState(project.due_date || '');
  const [status, setStatus] = useState<ProjectStatus>(project.status || 'in_progress');
  const [progress, setProgress] = useState(project.progress_percent || 0);
  const [ownerTeam, setOwnerTeam] = useState(project.owner_team || 'IMP');
  const [ownerHolding, setOwnerHolding] = useState(project.owner_holding || '');
  const [headLeadId, setHeadLeadId] = useState(project.head_lead_user_id || '');
  const [headLeadName, setHeadLeadName] = useState(project.head_lead_name || '');
  const [milestonesList, setMilestonesList] = useState<ProjectMilestone[]>(project.milestones || []);

  // Tab 2: Team Contributions State
  const [teamList, setTeamList] = useState<TeamMemberContribution[]>(project.team_contributions || []);
  const [selectedNewUserId, setSelectedNewUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('developer');

  // Tab 3: Cost Savings State
  const cs = project.cost_savings;
  const [directSavings, setDirectSavings] = useState(Number(cs?.direct_savings_annual) || 0);
  const [directNotes, setDirectNotes] = useState(cs?.direct_savings_notes || '');
  const [indirectHours, setIndirectHours] = useState(Number(cs?.indirect_manhour_saved_annual) || 0);
  const [indirectRate, setIndirectRate] = useState(Number(cs?.indirect_hourly_rate) || 350);
  const [indirectNotes, setIndirectNotes] = useState(cs?.indirect_savings_notes || '');
  const [avoidanceSavings, setAvoidanceSavings] = useState(Number(cs?.avoidance_savings_annual) || 0);
  const [avoidanceNotes, setAvoidanceNotes] = useState(cs?.avoidance_savings_notes || '');
  const [supportSavings, setSupportSavings] = useState(Number(cs?.support_savings_annual) || 0);
  const [supportNotes, setSupportNotes] = useState(cs?.support_savings_notes || '');
  const [manualTotalOverride, setManualTotalOverride] = useState<number | null>(
    cs?.manual_total_savings_override !== undefined ? cs.manual_total_savings_override : null
  );
  const [baselineBefore, setBaselineBefore] = useState(cs?.baseline_before || '');
  const [targetAfter, setTargetAfter] = useState(cs?.target_after || '');
  const [formulaNotes, setFormulaNotes] = useState(cs?.calculation_formula || '');
  const [refProofUrl, setRefProofUrl] = useState(cs?.ref_proof_url || '');
  const [verificationStatus, setVerificationStatus] = useState<'draft' | 'pending' | 'verified' | 'rejected'>(
    cs?.verification_status || 'draft'
  );

  // Milestone Modal State
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

  // Confirmation Modals State
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showVerificationSignoffModal, setShowVerificationSignoffModal] = useState(false);

  // Computed Savings Summary
  const computedIndirectAnnual = indirectHours * indirectRate;
  const currentTotalSavings = calculateTotalSavings({
    direct_savings_annual: directSavings,
    indirect_manhour_saved_annual: indirectHours,
    indirect_hourly_rate: indirectRate,
    indirect_savings_annual: computedIndirectAnnual,
    avoidance_savings_annual: avoidanceSavings,
    support_savings_annual: supportSavings,
    manual_total_savings_override: manualTotalOverride,
  });

  // Team Target % Total Validation
  const totalTargetPercent = teamList.reduce((acc, curr) => acc + (Number(curr.target_contribution_percent) || 0), 0);

  // Detect Unsaved Dirty Changes
  const isDirty = useMemo(() => {
    if (startDate !== (project.start_date || '')) return true;
    if (dueDate !== (project.due_date || '')) return true;
    if (status !== (project.status || 'in_progress')) return true;
    if (progress !== (project.progress_percent || 0)) return true;
    if (ownerTeam !== (project.owner_team || 'IMP')) return true;
    if (ownerHolding !== (project.owner_holding || '')) return true;
    if (headLeadId !== (project.head_lead_user_id || '')) return true;
    if (headLeadName !== (project.head_lead_name || '')) return true;
    if (JSON.stringify(teamList) !== JSON.stringify(project.team_contributions || [])) return true;
    if (JSON.stringify(milestonesList) !== JSON.stringify(project.milestones || [])) return true;
    if (directSavings !== (Number(cs?.direct_savings_annual) || 0)) return true;
    if (indirectHours !== (Number(cs?.indirect_manhour_saved_annual) || 0)) return true;
    if (avoidanceSavings !== (Number(cs?.avoidance_savings_annual) || 0)) return true;
    if (supportSavings !== (Number(cs?.support_savings_annual) || 0)) return true;
    if (verificationStatus !== (cs?.verification_status || 'draft')) return true;
    return false;
  }, [
    startDate, dueDate, status, progress, ownerTeam, ownerHolding, headLeadId, headLeadName,
    teamList, milestonesList, directSavings, indirectHours, avoidanceSavings, supportSavings,
    verificationStatus, project, cs
  ]);

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  };

  // Selectable users that are not already added to the team
  const selectableUsers = availableUsers.filter(
    (u) => !teamList.some((t) => t.user_id === u.id || t.user_name.toLowerCase() === u.name.toLowerCase())
  );

  // Helper to round to nearest 5%
  const roundToNearest5 = (val: number) => Math.round(val / 5) * 5;

  // Auto-rebalance Target % across remaining members to always equal 100% (in 5% steps)
  const handleUpdateTeamTargetPercent = (changedIndex: number, newPercent: number) => {
    const n = teamList.length;
    if (n <= 1) {
      setTeamList(teamList.map((m) => ({ ...m, target_contribution_percent: 100 })));
      return;
    }

    const clampedVal = Math.max(0, Math.min(100, roundToNearest5(newPercent)));
    const remainingBudget = Math.max(0, 100 - clampedVal);

    const otherMembers = teamList.filter((_, idx) => idx !== changedIndex);
    const currentOthersSum = otherMembers.reduce(
      (sum, m) => sum + (Number(m.target_contribution_percent) || 0),
      0
    );

    const updated = teamList.map((m, idx) => {
      if (idx === changedIndex) {
        return { ...m, target_contribution_percent: clampedVal };
      }

      let calculated: number;
      if (currentOthersSum > 0) {
        const currentVal = Number(m.target_contribution_percent) || 0;
        calculated = roundToNearest5((currentVal / currentOthersSum) * remainingBudget);
      } else {
        calculated = roundToNearest5(remainingBudget / (n - 1));
      }

      return {
        ...m,
        target_contribution_percent: Math.max(0, calculated),
      };
    });

    // Ensure exact 100% sum in 5% steps
    const currentTotal = updated.reduce(
      (sum, m) => sum + (Number(m.target_contribution_percent) || 0),
      0
    );
    const diff = 100 - currentTotal;
    if (diff !== 0 && n > 1) {
      const adjustIdx = changedIndex === 0 ? 1 : 0;
      updated[adjustIdx].target_contribution_percent = Math.max(
        0,
        updated[adjustIdx].target_contribution_percent + diff
      );
    }

    setTeamList(updated);
  };

  // Equal Split Helper in 5% steps (50/50, 35/35/30, 25/25/25/25, etc.)
  const handleEqualSplitTargetPercent = () => {
    const n = teamList.length;
    if (n === 0) return;
    if (n === 1) {
      setTeamList([{ ...teamList[0], target_contribution_percent: 100 }]);
      return;
    }

    const rawPerPerson = 100 / n;
    const basePercent = roundToNearest5(rawPerPerson);

    const updated = teamList.map((m) => ({
      ...m,
      target_contribution_percent: basePercent,
    }));

    // Reconcile remaining 5% difference
    const curTotal = basePercent * n;
    let diff = 100 - curTotal;
    let i = 0;
    while (diff !== 0 && i < n) {
      const step = diff > 0 ? 5 : -5;
      updated[i].target_contribution_percent += step;
      diff -= step;
      i = (i + 1) % n;
    }

    setTeamList(updated);
    showToast('จัดสรรสัดส่วน Target % ทีละ 5% ให้ทุกคนเรียบร้อย (รวม 100%)', 'info');
  };

  // Add new member to team list from dropdown selection (in 5% steps)
  const handleAddTeamMember = () => {
    if (!selectedNewUserId) return;
    const userObj = availableUsers.find((u) => u.id === selectedNewUserId);
    if (!userObj) return;

    const newMember: TeamMemberContribution = {
      project_id: project.id,
      user_id: userObj.id,
      user_name: userObj.name,
      role_in_project: newMemberRole,
      target_contribution_percent: 0,
      actual_contribution_percent: 0,
      logged_worklog_hours: 0,
    };

    const nextList = [...teamList, newMember];
    const n = nextList.length;
    const rawPerPerson = 100 / n;
    const basePercent = roundToNearest5(rawPerPerson);

    const balanced = nextList.map((m) => ({
      ...m,
      target_contribution_percent: basePercent,
    }));

    const curTotal = basePercent * n;
    let diff = 100 - curTotal;
    let i = 0;
    while (diff !== 0 && i < n) {
      const step = diff > 0 ? 5 : -5;
      balanced[i].target_contribution_percent += step;
      diff -= step;
      i = (i + 1) % n;
    }

    setTeamList(balanced);
    setSelectedNewUserId('');
    showToast(`เพิ่ม ${newMember.user_name} ในทีมเรียบร้อย (สัดส่วน 5% รวม 100%)`, 'success');
  };

  const handleRemoveTeamMember = (index: number) => {
    const remaining = teamList.filter((_, idx) => idx !== index);
    if (remaining.length > 0) {
      const n = remaining.length;
      const rawPerPerson = 100 / n;
      const basePercent = roundToNearest5(rawPerPerson);

      const balanced = remaining.map((m) => ({
        ...m,
        target_contribution_percent: basePercent,
      }));

      const curTotal = basePercent * n;
      let diff = 100 - curTotal;
      let i = 0;
      while (diff !== 0 && i < n) {
        const step = diff > 0 ? 5 : -5;
        balanced[i].target_contribution_percent += step;
        diff -= step;
        i = (i + 1) % n;
      }
      setTeamList(balanced);
    } else {
      setTeamList([]);
    }
  };

  const handleUpdateTeamMember = (index: number, patch: Partial<TeamMemberContribution>) => {
    setTeamList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  // Milestone actions
  const handleSaveMilestone = (m: ProjectMilestone) => {
    if (m.id) {
      setMilestonesList(milestonesList.map((item) => (item.id === m.id ? m : item)));
    } else {
      setMilestonesList([...milestonesList, { ...m, id: `milestone_${Date.now()}` }]);
    }
  };

  const handleDeleteMilestone = (index: number) => {
    setMilestonesList(milestonesList.filter((_, idx) => idx !== index));
  };

  // Master Save Execution
  const executeSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. Save Project Overview
      await updateProjectGanttOverview(project.id, {
        start_date: startDate || null,
        due_date: dueDate || null,
        status,
        progress_percent: Number(progress),
        owner_team: ownerTeam,
        owner_holding: ownerHolding || null,
        head_lead_user_id: headLeadId || null,
        head_lead_name: headLeadName || null,
      });

      // 2. Save Team Contributions
      await saveTeamMemberContributions(project.id, project.workspace_id, teamList);

      // 3. Save Milestones
      await saveProjectMilestones(project.id, project.workspace_id, milestonesList);

      // 4. Save Cost Savings
      await saveProjectCostSavings(project.id, project.workspace_id, {
        direct_savings_annual: directSavings,
        direct_savings_notes: directNotes,
        indirect_manhour_saved_annual: indirectHours,
        indirect_hourly_rate: indirectRate,
        indirect_savings_annual: computedIndirectAnnual,
        indirect_savings_notes: indirectNotes,
        avoidance_savings_annual: avoidanceSavings,
        avoidance_savings_notes: avoidanceNotes,
        support_savings_annual: supportSavings,
        support_savings_notes: supportNotes,
        manual_total_savings_override: manualTotalOverride,
        baseline_before: baselineBefore,
        target_after: targetAfter,
        calculation_formula: formulaNotes,
        ref_proof_url: refProofUrl,
        verification_status: verificationStatus,
      });

      showToast('บันทึกข้อมูลโครงการสำเร็จเรียบร้อย! 🎉', 'success');
      onProjectUpdated();
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Failed to update project:', err);
      showToast(`บันทึกไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (verificationStatus === 'verified' && cs?.verification_status !== 'verified') {
      setShowVerificationSignoffModal(true);
    } else {
      void executeSaveAll();
    }
  };

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[540px] lg:w-[680px] bg-theme-surface/95 dark:bg-theme-bg-page/95 backdrop-blur-2xl border-l border-theme-border/80 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 text-theme-text select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border/80 bg-theme-surface-secondary/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-base text-theme-text truncate">
                {project.project_name}
              </h2>
              <p className="text-[11px] text-theme-text-muted">
                {project.owner_team || 'IMP'} · {project.owner_holding || 'Double A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer select-none"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>บันทึก</span>
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-2 rounded-2xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-theme-border/60 bg-theme-surface/40 px-6 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <Calendar size={14} />
            <span>1. ภาพรวม & Milestones</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'team'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <Users size={14} />
            <span>2. ทีม & สัดส่วน Contribution ({teamList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('savings')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'savings'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <DollarSign size={14} />
            <span>3. Save Cost 4 มิติ (฿)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: Overview & Milestones
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fade-in">
              {/* Timeline & Status Card */}
              <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface/60 space-y-4">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-500" />
                  กำหนดการ & สถานะโครงการ
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      วันเริ่มต้น (Start Date)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      กำหนดเสร็จ (Due Date) *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      สถานะสากล (5 Stages)
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="planning">🔵 Planning (วางแผน)</option>
                      <option value="in_progress">🟡 In Progress (กำลังพัฒนา)</option>
                      <option value="testing">🟣 Testing / UAT (ทดสอบ)</option>
                      <option value="completed">🟢 Completed (ส่งมอบแล้ว)</option>
                      <option value="on_hold">⚪ On Hold (พักชั่วคราว)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="font-bold text-theme-text-muted text-[10px] uppercase">
                        ความคืบหน้า ({progress}%)
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full accent-indigo-600 mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      ทีมรับผิดชอบ (Team)
                    </label>
                    <select
                      value={ownerTeam}
                      onChange={(e) => setOwnerTeam(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="IMP">IMP</option>
                      <option value="IT">IT</option>
                      <option value="IMP&IT">IMP&IT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      Holding
                    </label>
                    <input
                      type="text"
                      value={ownerHolding}
                      onChange={(e) => setOwnerHolding(e.target.value)}
                      placeholder="เช่น Double A, Logistic..."
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Milestones List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                    <Flag size={14} className="text-purple-500" />
                    เป้าหมายย่อย (Milestones & Phases)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMilestone(null);
                      setIsMilestoneModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-purple-500/30 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>เพิ่ม Milestone</span>
                  </button>
                </div>

                {milestonesList.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-theme-border/80 bg-theme-surface/30 text-theme-text-muted space-y-1">
                    <p className="font-semibold">ยังไม่มี Milestone ย่อย</p>
                    <p className="text-[10px]">กดปุ่ม "เพิ่ม Milestone" เพื่อแตกเป้าหมายของโครงการ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {milestonesList.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl border border-theme-border bg-theme-surface flex items-center justify-between gap-3 shadow-xs hover:border-purple-400 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-theme-text truncate">
                              {idx + 1}. {m.milestone_name}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.2 text-[9px] font-bold rounded-md uppercase',
                                m.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              )}
                            >
                              {m.status} ({m.progress_percent}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-theme-text-muted flex items-center gap-3">
                            {m.due_date && <span>📅 กำหนด: {m.due_date}</span>}
                            {m.assigned_user_name && <span>👤 ผู้รับผิดชอบ: {m.assigned_user_name}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMilestone(m);
                              setIsMilestoneModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-purple-600 cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMilestone(idx)}
                            className="p-1.5 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: Team & Contribution Hub (Hybrid Model)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <div className="space-y-5 animate-fade-in">
              {/* Head Lead Selection */}
              <div className="p-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <User size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-theme-text">👑 หัวหน้าโครงการ (Head / Project Lead)</h3>
                    <p className="text-[10px] text-theme-text-muted">ผู้รับผิดชอบหลักของโครงการนี้</p>
                  </div>
                </div>

                <div>
                  <select
                    value={headLeadId || (availableUsers.find((u) => u.name === headLeadName)?.id || '')}
                    onChange={(e) => {
                      const selected = availableUsers.find((u) => u.id === e.target.value);
                      if (selected) {
                        setHeadLeadId(selected.id);
                        setHeadLeadName(selected.name);
                      } else {
                        setHeadLeadId('');
                        setHeadLeadName('');
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl border border-indigo-500/40 bg-theme-surface text-theme-text font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
                  >
                    <option value="">-- เลือกหัวหน้าโครงการจากสมาชิกในทีม (Head / Project Lead) --</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        👑 {u.name} {u.email ? `(${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Total Target Contribution Gauge */}
              <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-theme-text">
                      สัดส่วนเป้าหมายรวม (Total Target %):
                    </span>
                    <button
                      type="button"
                      disabled={teamList.length === 0}
                      onClick={handleEqualSplitTargetPercent}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer select-none"
                    >
                      ⚖️ จัดสรรเท่ากัน
                    </button>
                  </div>
                  <span
                    className={cn(
                      'font-mono font-black text-sm px-2.5 py-0.5 rounded-xl border',
                      totalTargetPercent === 100
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    {totalTargetPercent.toFixed(0)}% {totalTargetPercent === 100 ? '✓ ลงตัว 100%' : '⚠️ ไม่เท่ากับ 100%'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-border/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      totalTargetPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                    style={{ width: `${Math.min(100, totalTargetPercent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-theme-text-muted">
                  * เมื่อมี 2 คนขึ้นไป การเลื่อนสไลเดอร์ % ของใคร ระบบจะปรับเกลี่ย % ของคนที่เหลือให้อัตโนมัติ เพื่อให้ผลรวมได้ 100% เสมอ
                </p>
              </div>

              {/* Add Member Dropdown Bar */}
              <div className="p-3.5 rounded-2xl border border-theme-border bg-theme-surface flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  value={selectedNewUserId}
                  onChange={(e) => setSelectedNewUserId(e.target.value)}
                  className="flex-1 min-w-[180px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- เลือกสมาชิกที่จะเพิ่มเข้าทีม --</option>
                  {selectableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as TeamRole)}
                  className="py-2 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs cursor-pointer shrink-0 font-bold"
                >
                  <option value="developer">💻 Developer</option>
                  <option value="qa">🧪 QA / Tester</option>
                  <option value="uiux">🎨 UI/UX</option>
                  <option value="consultant">💡 Consultant</option>
                  <option value="support">🛠️ Support</option>
                  <option value="lead">👑 Lead</option>
                </select>
                <button
                  type="button"
                  disabled={!selectedNewUserId}
                  onClick={handleAddTeamMember}
                  className={cn(
                    'px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 select-none',
                    selectedNewUserId
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer'
                      : 'bg-theme-surface-secondary text-theme-text-muted cursor-not-allowed border border-theme-border'
                  )}
                >
                  + เพิ่มทีม
                </button>
              </div>

              {/* Team Members List (with Target % vs Actual % Variance) */}
              <div className="space-y-3">
                {teamList.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-theme-border text-theme-text-muted space-y-1">
                    <Users size={28} className="mx-auto opacity-30 text-indigo-500" />
                    <p className="font-bold">ยังไม่มีรายชื่อสมาชิกในทีม</p>
                    <p className="text-[10px]">พิมพ์ชื่อและกด "+ เพิ่มทีม" ด้านบน</p>
                  </div>
                ) : (
                  teamList.map((tm, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3 shadow-xs"
                    >
                      {/* Top: Name, Role, Delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-theme-text">
                            {tm.user_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-theme-surface-secondary text-theme-text border border-theme-border/60">
                            {TEAM_ROLE_LABELS[tm.role_in_project] || tm.role_in_project}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeamMember(idx)}
                          className="p-1 rounded-lg text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Middle: Target % Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-theme-text-muted">
                            Target Contribution:
                          </span>
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {tm.target_contribution_percent}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={tm.target_contribution_percent}
                          onChange={(e) =>
                            handleUpdateTeamTargetPercent(idx, Number(e.target.value))
                          }
                          className="w-full accent-indigo-600 cursor-pointer"
                        />
                      </div>

                      {/* Bottom: Worklog Actual Hours vs Manual Override */}
                      <div className="p-3 rounded-2xl bg-theme-surface-secondary/40 border border-theme-border/40 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-theme-text-muted flex items-center gap-1">
                            <Clock size={12} className="text-emerald-500" />
                            ชั่วโมง Worklog จริง:
                          </span>
                          <span className="font-mono font-bold text-theme-text">
                            {tm.logged_worklog_hours || 0} ชม. (คำนวณได้ ~{tm.actual_contribution_percent || 0}%)
                          </span>
                        </div>

                        {/* Manual Override inputs for flexibility */}
                        <div className="pt-1 border-t border-theme-border/40 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                              ปรับชั่วโมงด้วยมือ (Manual Hrs)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={tm.manual_actual_hours ?? ''}
                              onChange={(e) =>
                                handleUpdateTeamMember(idx, {
                                  manual_actual_hours: e.target.value ? parseFloat(e.target.value) : null,
                                })
                              }
                              placeholder="เช่น 80 (ถ้าไม่ลง Worklog)"
                              className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                              ปรับ Actual % ด้วยมือ (Override %)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={tm.manual_actual_percent ?? ''}
                              onChange={(e) =>
                                handleUpdateTeamMember(idx, {
                                  manual_actual_percent: e.target.value ? parseFloat(e.target.value) : null,
                                })
                              }
                              placeholder="เช่น 35%"
                              className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: 4-Dimension MECE Cost Savings Sheet
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'savings' && (
            <div className="space-y-5 animate-fade-in">
              {/* Grand Total Value Saved Banner */}
              <div className="p-5 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-theme-surface to-theme-surface shadow-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={16} className="text-emerald-500" />
                    ยอดประหยัดรวมทั้งโครงการ (Total Annual Savings)
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border',
                      verificationStatus === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500'
                    )}
                  >
                    {verificationStatus === 'verified' ? '✅ ผ่านการรับรอง (Verified)' : '⏳ ฉบับร่าง (Draft)'}
                  </span>
                </div>

                <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ฿ {currentTotalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
                  <span className="text-xs font-bold text-theme-text-muted">/ ปี</span>
                </div>
              </div>

              {/* 4 MECE Dimension Inputs */}
              <div className="space-y-4">
                {/* 1. Direct Cash Savings */}
                <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 font-black text-[11px] flex items-center justify-center">
                        1
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Direct Savings (ลดการจ่ายเงินสดจริง)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                      กระทบงบ P&L จริง
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ยอดเงินประหยัดต่อปี (บาท/ปี)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={directSavings}
                        onChange={(e) => setDirectSavings(Number(e.target.value))}
                        placeholder="เช่น 500000"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียดการลดค่าใช้จ่าย
                      </label>
                      <input
                        type="text"
                        value={directNotes}
                        onChange={(e) => setDirectNotes(e.target.value)}
                        placeholder="เช่น ยกเลิก License ระบบเดิม, ย้าย Server..."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Indirect Manhour Savings */}
                <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-[11px] flex items-center justify-center">
                        2
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Indirect Savings (ประหยัดเวลา / เพิ่มผลิตภาพ)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      = ฿{computedIndirectAnnual.toLocaleString()} / ปี
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        เวลาที่ประหยัดได้รวม (ชม./ปี)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={indirectHours}
                        onChange={(e) => setIndirectHours(Number(e.target.value))}
                        placeholder="เช่น 1200 (100 ชม./ด. x 12)"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        อัตราค่าแรงมาตรฐาน (บาท/ชม.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={indirectRate}
                        onChange={(e) => setIndirectRate(Number(e.target.value))}
                        placeholder="ค่ามาตรฐาน 350 บ./ชม."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                      คำอธิบายกระบวนการที่ประหยัดเวลาได้
                    </label>
                    <input
                      type="text"
                      value={indirectNotes}
                      onChange={(e) => setIndirectNotes(e.target.value)}
                      placeholder="เช่น ลดเวลาทำเอกสารอนุมัติของ HR จาก 3 ชม. เหลือ 15 นาที..."
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 3. Cost Avoidance */}
                <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-[11px] flex items-center justify-center">
                        3
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Cost Avoidance (หลีกเลี่ยงต้นทุนอนาคต)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      ไม่ต้องจ่ายในอนาคต
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ยอดต้นทุนที่เลี่ยงได้ (บาท/ปี)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={avoidanceSavings}
                        onChange={(e) => setAvoidanceSavings(Number(e.target.value))}
                        placeholder="เช่น 480000 (เลี่ยงจ้างคน 1 อัตรา)"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียดการหลีกเลี่ยงต้นทุน
                      </label>
                      <input
                        type="text"
                        value={avoidanceNotes}
                        onChange={(e) => setAvoidanceNotes(e.target.value)}
                        placeholder="เช่น สเกลงานรองรับผู้ใช้ 3 เท่าโดยไม่ต้องเพิ่ม Headcount..."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Support & Maintenance Savings */}
                <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-black text-[11px] flex items-center justify-center">
                        4
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Support & Usage Savings (ลดงานซัพพอร์ต & OpEx)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                      ลด Incident / Ticket
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ประหยัดค่าซัพพอร์ต (บาท/ปี)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={supportSavings}
                        onChange={(e) => setSupportSavings(Number(e.target.value))}
                        placeholder="เช่น 150000"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียด
                      </label>
                      <input
                        type="text"
                        value={supportNotes}
                        onChange={(e) => setSupportNotes(e.target.value)}
                        placeholder="เช่น ลดจำนวน Helpdesk Ticket ลง 80%..."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Manual Total Override (Optional) */}
                <div className="p-4 rounded-3xl border border-theme-border/60 bg-theme-surface-secondary/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-theme-text text-[11px]">
                      🔧 ปรับยอด Save Cost รวมด้วยมือ (Manual Override)
                    </label>
                    {manualTotalOverride !== null && (
                      <button
                        type="button"
                        onClick={() => setManualTotalOverride(null)}
                        className="text-[10px] text-rose-500 hover:underline cursor-pointer font-semibold"
                      >
                        ยกเลิกการ Override
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={manualTotalOverride ?? ''}
                    onChange={(e) =>
                      setManualTotalOverride(e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="เว้นว่างไว้หากต้องการให้ระบบรวม 4 มิติอัตโนมัติ..."
                    className="w-full py-1.5 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs"
                  />
                  <p className="text-[10px] text-theme-text-muted">
                    * ใส่เฉพาะกรณีที่มีตัวเลขรับรองพิเศษจากผู้บริหารที่ไม่ตรงกับสูตรมาตรฐาน
                  </p>
                </div>

                {/* Calculation Proof & Evidence Section */}
                <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3">
                  <h4 className="font-extrabold text-xs text-theme-text flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-emerald-500" />
                    หลักฐานและสูตรคำนวณ (Calculation Proof & Audit)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Baseline เดิม (ก่อนทำ)
                      </label>
                      <textarea
                        rows={2}
                        value={baselineBefore}
                        onChange={(e) => setBaselineBefore(e.target.value)}
                        placeholder="เช่น เดิมใช้ 5 คน ทำเอกสาร 120 ชม./ด. จ่าย License ปีละ 6 แสน..."
                        className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Target ผลลัพธ์ (หลังทำ)
                      </label>
                      <textarea
                        rows={2}
                        value={targetAfter}
                        onChange={(e) => setTargetAfter(e.target.value)}
                        placeholder="เช่น ระบบอัตโนมัติทำงานใน 15 นาที ลด License เหลือ 1 แสน..."
                        className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                      สูตรการคำนวณและสมมติฐาน (Assumptions)
                    </label>
                    <input
                      type="text"
                      value={formulaNotes}
                      onChange={(e) => setFormulaNotes(e.target.value)}
                      placeholder="เช่น (120 ชม. - 20 ชม.) x 12 ด. x 350 บ. + ค่า License 500,000 บ."
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ลิงก์ไฟล์หลักฐาน / เอกสารตรวจรับ (URL)
                      </label>
                      <input
                        type="url"
                        value={refProofUrl}
                        onChange={(e) => setRefProofUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        สถานะการรับรองตัวเลข (Audit Status)
                      </label>
                      <select
                        value={verificationStatus}
                        onChange={(e) =>
                          setVerificationStatus(
                            e.target.value as 'draft' | 'pending' | 'verified' | 'rejected'
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-bold"
                      >
                        <option value="draft">⏳ Draft (ฉบับร่าง)</option>
                        <option value="pending">🟡 Pending Sign-off (รอตรวจสอบ)</option>
                        <option value="verified">✅ Verified (รับรองตัวเลขแล้ว)</option>
                        <option value="rejected">❌ Rejected (ปฏิเสธตัวเลข)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme-border/80 bg-theme-surface-secondary/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-theme-text-muted">
            {activeTab === 'overview' && <span>แก้ไขวันเริ่ม, Due Date, สถานะ และ Milestone</span>}
            {activeTab === 'team' && <span>ปรับ Target % ของทีม (รวม = 100%) และ Hours</span>}
            {activeTab === 'savings' && <span>ยอดประหยัด 4 มิติ รวม ฿{currentTotalSavings.toLocaleString()} / ปี</span>}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveClick}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer select-none"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </div>

      {/* Milestone Editor Modal */}
      <MilestoneEditorModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        milestone={editingMilestone}
        onSave={handleSaveMilestone}
        availableUsers={availableUsers}
      />

      {/* Discard Unsaved Changes Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={onClose}
        title="มีข้อมูลที่ยังไม่ได้บันทึก"
        message="คุณได้ทำการแก้ไขข้อมูลโครงการนี้ หากปิดตอนนี้ การเปลี่ยนแปลงทั้งหมดจะไม่ถูกบันทึก"
        description="ต้องการยกเลิกการแก้ไขและปิดหน้าต่างใช่หรือไม่?"
        confirmText="ละทิ้งการแก้ไข (Discard)"
        cancelText="แก้ไขต่อ (Keep Editing)"
        variant="warning"
      />

      {/* Verification Sign-off Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={showVerificationSignoffModal}
        onClose={() => setShowVerificationSignoffModal(false)}
        onConfirm={executeSaveAll}
        title="ยืนยันการรับรองตัวเลขผลประหยัด (Sign-off Verified Savings)"
        message={`คุณกำลังจะรับรองตัวเลขผลประหยัดต้นทุนรวม ฿${currentTotalSavings.toLocaleString()} / ปี ให้มีสถานะเป็น "Verified (รับรองแล้ว)"`}
        description="การรับรองนี้จะถูกใช้เป็นหลักฐานทางการเงินและ Audit โปรดตรวจสอบว่ามีสูตรและเอกสารอ้างอิงครบถ้วน"
        confirmText="ยืนยันการรับรองและบันทึก"
        cancelText="ตรวจสอบอีกครั้ง"
        variant="success"
        isLoading={isSaving}
      />
    </>
  );
};

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
  availableUsers = [],
}) => {
  if (!isOpen || !project) return null;

  return (
    <ProjectDetailDrawerContent
      key={project.id}
      project={project}
      onClose={onClose}
      onProjectUpdated={onProjectUpdated}
      availableUsers={availableUsers}
    />
  );
};
