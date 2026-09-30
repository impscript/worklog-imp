import React from 'react';
import { Layers, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { GanttProject } from '../../lib/project-management';

interface ExecutiveSummaryKPIsProps {
  projects: GanttProject[];
}

// Shared card shell: soft shadow + hairline border instead of a hard outline,
// generous padding, and a big rounded radius — closer to an Apple widget than
// a bordered dashboard tile.
const cardClass =
  'relative p-5 rounded-[28px] border border-black/[0.06] dark:border-white/[0.08] bg-theme-surface/80 dark:bg-theme-bg-page/60 backdrop-blur-xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_24px_-14px_rgba(0,0,0,0.18)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_16px_32px_-14px_rgba(0,0,0,0.22)] transition-shadow duration-300 flex flex-col gap-4';

function StatDot({ colorClass }: { colorClass: string }) {
  return <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', colorClass)} />;
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3 select-none">
      {/* CARD 1: Total Projects & Health */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-theme-text-muted">
            {t('gantt.kpi.portfolio')}
          </span>
          <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers size={16} strokeWidth={2.25} />
          </div>
        </div>

        <div>
          <div className="text-3xl font-bold text-theme-text tracking-tight tabular-nums">
            {totalProjects}
            <span className="text-sm font-medium text-theme-text-muted ml-1.5">{t('gantt.kpi.projectsUnit')}</span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-[12.5px] text-theme-text-muted">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{projectCount}</span>
            <span>{t('gantt.kpi.mainProjects')}</span>
            <span className="text-theme-text-muted/40">·</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{supportCount}</span>
            <span>{t('gantt.kpi.supportProjects')}</span>
          </div>

          {/* Status summary — a dot carries the color, so the text itself can
              stay plain and quiet, matching how iOS widgets pair a colored
              dot with a number instead of tinting the whole label. */}
          <div className="flex items-center gap-3 mt-2.5 text-[12.5px] text-theme-text-muted flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <StatDot colorClass="bg-emerald-500" />
              {activeCount} {t('gantt.kpi.active')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatDot colorClass="bg-blue-500" />
              {completedCount} {t('gantt.kpi.completed')}
            </span>
            {onHoldCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <StatDot colorClass="bg-slate-400" />
                {onHoldCount} {t('gantt.kpi.onHold')}
              </span>
            )}
            {delayedCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <StatDot colorClass="bg-rose-500" />
                {delayedCount} {t('gantt.kpi.delayed')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: Total Value Realization (Total Savings) */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-theme-text-muted">
            {t('gantt.kpi.totalSavings')}
          </span>
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign size={16} strokeWidth={2.25} />
          </div>
        </div>

        <div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
            ฿{totalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[12.5px] text-theme-text-muted mt-2 truncate">
            {t('gantt.kpi.savingsBreakdown')}
          </div>
        </div>
      </div>

      {/* CARD 3: Direct Hard Cash Saved */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-theme-text-muted">
            {t('gantt.kpi.hardCash')}
          </span>
          <div className="w-9 h-9 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <TrendingUp size={16} strokeWidth={2.25} />
          </div>
        </div>

        <div>
          <div className="text-3xl font-bold text-theme-text tracking-tight tabular-nums">
            ฿{totalDirectCash.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[12.5px] text-theme-text-muted mt-2 truncate">
            {t('gantt.kpi.licenseAndMaterial')}
          </div>
        </div>
      </div>

      {/* CARD 4: Manhours & Productivity Saved */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-theme-text-muted">
            {t('gantt.kpi.productivity')}
          </span>
          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={16} strokeWidth={2.25} />
          </div>
        </div>

        <div>
          <div className="text-3xl font-bold text-theme-text tracking-tight tabular-nums">
            {totalManhours.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            <span className="text-sm font-medium text-theme-text-muted ml-1.5">{t('gantt.kpi.hoursUnit')}</span>
          </div>
          <div className="text-[12.5px] text-theme-text-muted mt-2 truncate">
            {t('gantt.kpi.fteEquivalent')} ~{fteEquivalent} {t('gantt.kpi.annualFte')}
          </div>
        </div>
      </div>
    </div>
  );
};
