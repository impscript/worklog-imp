import React from 'react';
import { Layers, DollarSign, Clock, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GanttProject } from '../../lib/project-management';

interface ExecutiveSummaryKPIsProps {
  projects: GanttProject[];
}

export const ExecutiveSummaryKPIs: React.FC<ExecutiveSummaryKPIsProps> = ({ projects }) => {
  const { t } = useTranslation();
  const totalProjects = projects.length;
  const activeCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning' || p.status === 'testing').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const onHoldCount = projects.filter((p) => p.status === 'on_hold').length;
  const delayedCount = projects.filter((p) => p.project_health === 'delayed').length;
  const projectCount = projects.filter((p) => {
    const type = (p.worklog_project_type || 'Project').toLowerCase();
    return type === 'project' || type === 'upgrade';
  }).length;
  const supportCount = projects.filter((p) => {
    const type = (p.worklog_project_type || '').toLowerCase();
    return type.includes('support') || type.includes('ma');
  }).length;

  // Cost Savings Sums
  let totalSavings = 0;
  let totalDirectCash = 0;
  let totalManhours = 0;

  projects.forEach((p) => {
    totalSavings += p.total_savings_annual;
    if (p.cost_savings) {
      totalDirectCash += Number(p.cost_savings.direct_savings_annual) || 0;
      totalManhours += Number(p.cost_savings.indirect_manhour_saved_annual) || 0;
    }
  });

  const fteEquivalent = (totalManhours / 1920).toFixed(1);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5 select-none">
      {/* CARD 1: Total Projects & Health */}
      <div className="p-4 rounded-3xl border border-theme-border/70 bg-theme-surface/70 dark:bg-theme-bg-page/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
            {t('gantt.kpi.portfolio')}
          </span>
          <div className="p-2 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Layers size={18} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight">
            {totalProjects} <span className="text-xs font-semibold text-theme-text-muted">{t('gantt.kpi.projectsUnit')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10.5px] font-bold flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              🚀 Project {projectCount}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              🛠️ Support {supportCount}
            </span>
            <span className="text-theme-text-muted">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              🟢 {t('gantt.kpi.active')} {activeCount}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
              ✓ {t('gantt.kpi.completed')} {completedCount}
            </span>
            {onHoldCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  ⏸️ {t('gantt.kpi.onHold')} {onHoldCount}
                </span>
              </>
            )}
            {delayedCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={11} /> {t('gantt.kpi.delayed')} {delayedCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: Total Value Realization (Total Savings) */}
      <div className="p-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-theme-surface/70 to-theme-surface/40 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
            {t('gantt.kpi.totalSavings')}
          </span>
          <div className="p-2 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
            ฿ {totalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-theme-text-muted mt-2 truncate">
            4D (Direct + Indirect + Avoidance + Support)
          </div>
        </div>
      </div>

      {/* CARD 3: Direct Hard Cash Saved */}
      <div className="p-4 rounded-3xl border border-theme-border/70 bg-theme-surface/70 dark:bg-theme-bg-page/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
            {t('gantt.kpi.hardCash')}
          </span>
          <div className="p-2 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight">
            ฿ {totalDirectCash.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-theme-text-muted truncate">
            <span>{t('gantt.kpi.licenseAndMaterial')}</span>
          </div>
        </div>
      </div>

      {/* CARD 4: Manhours & Productivity Saved */}
      <div className="p-4 rounded-3xl border border-theme-border/70 bg-theme-surface/70 dark:bg-theme-bg-page/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
            {t('gantt.kpi.productivity')}
          </span>
          <div className="p-2 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock size={18} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight">
            {totalManhours.toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-semibold text-theme-text-muted">{t('gantt.kpi.hoursUnit')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 dark:text-amber-300 font-bold">
            <ShieldCheck size={13} />
            <span>{t('gantt.kpi.fteEquivalent')} ~{fteEquivalent} {t('gantt.kpi.annualFte')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
