import { useState, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  X,
  Building2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiTeamMember } from './AiTeamMemberPicker';

export interface RosterSlot {
  slotNumber: number;
  isOccupied: boolean;
  member?: AiTeamMember;
  requestTitle?: string;
  requestId?: string;
  requestStatus?: string;
  aiTool?: string;
  department?: string;
  activeDays?: number;
  monthlyHoursSaved?: number;
  /** Month (YYYY-MM) of the report the numbers come from. */
  reportMonth?: string;
  /** 'unknown' = no monthly report submitted yet, so there is nothing to judge. */
  healthStatus?: 'healthy' | 'warning' | 'risk' | 'unknown';
}

interface AiRequestForRoster {
  id: string;
  project_title: string;
  department: string;
  applicant_name: string;
  applicant_emp_id?: string;
  status: string;
  requested_seats: number;
  ai_tool?: string;
  team_members?: AiTeamMember[];
  monthly_reports?: Array<{
    month: string;
    actual_active_days?: number;
    hours_saved_monthly?: number;
  }>;
}

interface AiSeatRosterGridProps {
  requests: AiRequestForRoster[];
  totalQuota?: number;
  onSelectRequest?: (requestId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

function formatReportMonth(key?: string) {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return ' ' + new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

export default function AiSeatRosterGrid({
  requests,
  totalQuota = 20,
  onSelectRequest,
  onNavigateTab
}: AiSeatRosterGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'occupied' | 'vacant' | 'warning'>('all');
  const [selectedSlot, setSelectedSlot] = useState<RosterSlot | null>(null);

  // 1. Flatten all active/approved requests into individual seat slots
  const slots: RosterSlot[] = useMemo(() => {
    const list: RosterSlot[] = [];
    let currentSlot = 1;

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date();
    const currentMonthKey = monthKey(today);
    const previousMonthKey = monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));

    // Filter only approved / active initiatives
    const activeRequests = requests.filter(r =>
      r.status === 'approved' || r.status === 'active' || r.status === 'in_review'
    );

    activeRequests.forEach(req => {
      const members = req.team_members && req.team_members.length > 0
        ? req.team_members
        : [
            {
              emp_id: req.applicant_emp_id || '',
              name: req.applicant_name,
              department: req.department,
              is_lead: true
            }
          ];

      // The review is monthly, so use last month's report; fall back to this month's if that is all there is.
      // An older report says nothing about last month, so it is ignored.
      const reports = req.monthly_reports || [];
      const reportFor = (key: string) => reports.find((r) => (r.month || '').slice(0, 7) === key);
      const latestReport = reportFor(previousMonthKey) ?? reportFor(currentMonthKey);
      const activeDays = latestReport?.actual_active_days ?? undefined;
      const hoursSaved = latestReport?.hours_saved_monthly ?? undefined;

      // Monthly review: a seat is at risk only when it was not used at all last month.
      // Without a report there is no evidence either way, so it is shown as unknown rather than guessed.
      let healthStatus: NonNullable<RosterSlot['healthStatus']> = 'unknown';
      if (activeDays !== undefined) {
        healthStatus = activeDays >= 1 ? 'healthy' : 'risk';
      }

      members.forEach(member => {
        if (currentSlot <= totalQuota) {
          list.push({
            slotNumber: currentSlot,
            isOccupied: true,
            member,
            requestTitle: req.project_title,
            requestId: req.id,
            requestStatus: req.status,
            aiTool: req.ai_tool || 'GitHub Copilot Enterprise',
            department: member.department || req.department,
            activeDays,
            monthlyHoursSaved: hoursSaved,
            reportMonth: latestReport?.month?.slice(0, 7),
            healthStatus
          });
          currentSlot++;
        }
      });
    });

    // Fill remaining slots up to totalQuota as vacant
    while (currentSlot <= totalQuota) {
      list.push({
        slotNumber: currentSlot,
        isOccupied: false
      });
      currentSlot++;
    }

    return list;
  }, [requests, totalQuota]);

  // 2. Computed Analytics
  const occupiedCount = useMemo(() => slots.filter(s => s.isOccupied).length, [slots]);
  const vacantCount = totalQuota - occupiedCount;
  const warningCount = useMemo(
    () => slots.filter(s => s.isOccupied && s.healthStatus === 'risk').length,
    [slots]
  );
  const utilizationPct = Math.round((occupiedCount / totalQuota) * 100);

  // 3. Filtered Slots
  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      // Filter Type
      if (filterType === 'occupied' && !slot.isOccupied) return false;
      if (filterType === 'vacant' && slot.isOccupied) return false;
      if (filterType === 'warning' && (!slot.isOccupied || slot.healthStatus !== 'risk')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!slot.isOccupied) {
          return `สิทธิ์ว่าง slot #${slot.slotNumber}`.toLowerCase().includes(q);
        }
        const m = slot.member;
        const matchesName = m?.name?.toLowerCase().includes(q) ?? false;
        const matchesEmpId = m?.emp_id?.toLowerCase().includes(q) ?? false;
        const matchesDept = slot.department?.toLowerCase().includes(q) ?? false;
        const matchesTitle = slot.requestTitle?.toLowerCase().includes(q) ?? false;
        return matchesName || matchesEmpId || matchesDept || matchesTitle;
      }

      return true;
    });
  }, [slots, filterType, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Analytics Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border shadow-xs">
          <div className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
            โควตารวมทั้งหมด (Total Quota)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-theme-text">{totalQuota}</span>
            <span className="text-xs text-theme-text-muted">ที่นั่ง (Pilot Pool)</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border shadow-xs">
          <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} />
            <span>จัดสรรแล้ว (Occupied)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {occupiedCount}
            </span>
            <span className="text-xs text-theme-text-muted">({utilizationPct}% ของโควตา)</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border shadow-xs">
          <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            <span>สิทธิ์ว่างพร้อมจัดสรร (Available)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {vacantCount}
            </span>
            <span className="text-xs text-theme-text-muted">ที่นั่ง</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border shadow-xs">
          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={13} />
            <span>ไม่ได้ใช้งานเดือนที่ผ่านมา</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {warningCount}
            </span>
            <span className="text-xs text-theme-text-muted">ที่นั่ง (เสี่ยงถูกระงับสิทธิ์)</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ครองสิทธิ์, รหัสพนักงาน, แผนก, หรือโครงการ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs py-2 pl-8 pr-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              filterType === 'all'
                ? "bg-theme-surface-secondary text-theme-text border border-theme-border shadow-2xs"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
            )}
          >
            ทั้งหมด ({slots.length})
          </button>
          <button
            onClick={() => setFilterType('occupied')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              filterType === 'occupied'
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
            )}
          >
            มีผู้ใช้งาน ({occupiedCount})
          </button>
          <button
            onClick={() => setFilterType('vacant')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              filterType === 'vacant'
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
            )}
          >
            สิทธิ์ว่าง ({vacantCount})
          </button>
          {warningCount > 0 && (
            <button
              onClick={() => setFilterType('warning')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                filterType === 'warning'
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
              )}
            >
              ไม่ได้ใช้งาน ({warningCount})
            </button>
          )}
        </div>
      </div>

      {/* Grid of 20 Slots or Empty State */}
      {filteredSlots.length === 0 ? (
        <div className="p-8 text-center bg-theme-surface-secondary/40 border border-dashed border-theme-border rounded-xl space-y-2">
          <Users size={28} className="mx-auto text-theme-text-muted" />
          <div className="text-xs font-bold text-theme-text">ไม่พบสิทธิ์ที่ตรงกับเงื่อนไขการค้นหา</div>
          <div className="text-[11px] text-theme-text-muted">
            ลองเปลี่ยนคำค้นหา หรือกดตัวกรอง "ทั้งหมด"
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
            }}
            className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredSlots.map((slot) => {
          if (!slot.isOccupied) {
            // Vacant Slot Card
            return (
              <div
                key={`vacant-${slot.slotNumber}`}
                className="p-3.5 rounded-xl border border-dashed border-theme-border/80 bg-theme-surface-secondary/20 hover:bg-theme-surface-secondary/40 transition-all flex flex-col justify-between min-h-[148px] group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-theme-text-muted font-mono font-bold mb-2">
                    <span>SLOT #{String(slot.slotNumber).padStart(2, '0')}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500/40" />
                  </div>
                  <div className="text-center py-2">
                    <div className="w-8 h-8 rounded-full border border-dashed border-emerald-500/50 bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-1.5">
                      <Sparkles size={14} />
                    </div>
                    <div className="text-xs font-bold text-theme-text">สิทธิ์ว่างพร้อมจัดสรร</div>
                    <div className="text-[10px] text-theme-text-muted">Unallocated Seat</div>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('request')}
                    className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-semibold bg-theme-surface hover:bg-theme-surface-secondary text-theme-text border border-theme-border flex items-center justify-center gap-1 transition-colors cursor-pointer group-hover:border-indigo-500/50"
                  >
                    <span>ยื่นขอใช้งานสิทธิ์นี้</span>
                    <ArrowRight size={11} />
                  </button>
                )}
              </div>
            );
          }

          // Occupied Slot Card
          const m = slot.member;
          const initials = m?.name
            ? m.name.split(' ').map(n => n[0]).slice(0, 2).join('')
            : 'AI';

          return (
            <div
              key={`slot-${slot.slotNumber}`}
              onClick={() => setSelectedSlot(slot)}
              className={cn(
                "p-3.5 rounded-xl border bg-theme-surface hover:shadow-md transition-all flex flex-col justify-between min-h-[148px] cursor-pointer group relative overflow-hidden",
                slot.healthStatus === 'warning' || slot.healthStatus === 'risk'
                  ? "border-amber-500/30 hover:border-amber-500"
                  : "border-theme-border/80 hover:border-indigo-500/50"
              )}
            >
              {/* Slot Number & Status Header */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-theme-text-muted mb-2">
                  <span className="font-bold text-theme-text">
                    SLOT #{String(slot.slotNumber).padStart(2, '0')}
                  </span>
                  {m?.is_lead && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white">
                      Lead
                    </span>
                  )}
                </div>

                {/* Member Identity */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-500/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-theme-text truncate group-hover:text-indigo-500 transition-colors" title={m?.name}>
                      {m?.name}
                    </div>
                    <div className="text-[10px] text-theme-text-muted truncate">
                      {m?.emp_id ? `${m.emp_id} • ` : ''}{slot.department}
                    </div>
                  </div>
                </div>

                {/* Tagged Initiative */}
                <div className="mt-2.5 text-[10px] text-theme-text-muted bg-theme-surface-secondary/60 p-1.5 rounded-md truncate" title={slot.requestTitle}>
                  <span className="font-semibold text-theme-text">โครงการ:</span> {slot.requestTitle}
                </div>
              </div>

              {/* Active Days Health Progress */}
              <div className="mt-2.5 pt-2 border-t border-theme-border/40">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-theme-text-muted flex items-center gap-1">
                    <Clock size={10} />
                    <span>Active Days:</span>
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      slot.healthStatus === 'healthy'
                        ? "text-emerald-600 dark:text-emerald-400"
                        : slot.healthStatus === 'unknown'
                        ? "text-theme-text-muted"
                        : slot.healthStatus === 'warning'
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-500"
                    )}
                  >
                    {slot.activeDays === undefined ? 'ยังไม่มีรายงาน' : `${slot.activeDays}/20 วัน`}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-theme-surface-secondary mt-1 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      slot.healthStatus === 'healthy'
                        ? "bg-emerald-500"
                        : slot.healthStatus === 'unknown'
                        ? "bg-theme-border"
                        : slot.healthStatus === 'warning'
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${Math.min(100, Math.round(((slot.activeDays ?? 0) / 20) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Detail Slideout / Modal for selected slot */}
      {selectedSlot && selectedSlot.member && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-theme-surface border border-theme-border rounded-2xl shadow-2xl p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs">
                  SLOT #{String(selectedSlot.slotNumber).padStart(2, '0')}
                </span>
                <h3 className="font-bold text-sm text-theme-text">ข้อมูลผู้ถือครองสิทธิ์ AI</h3>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="w-7 h-7 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-secondary/50">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                {selectedSlot.member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div className="font-bold text-sm text-theme-text flex items-center gap-1.5">
                  <span>{selectedSlot.member.name}</span>
                  {selectedSlot.member.is_lead && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                      Team Lead
                    </span>
                  )}
                </div>
                <div className="text-xs text-theme-text-muted mt-0.5">
                  {selectedSlot.member.emp_id ? `รหัสพนักงาน: ${selectedSlot.member.emp_id}` : ''}
                </div>
                <div className="text-xs text-theme-text-muted flex items-center gap-1 mt-0.5">
                  <Building2 size={12} />
                  <span>{selectedSlot.department}</span>
                  {selectedSlot.member.position && <span>• {selectedSlot.member.position}</span>}
                </div>
              </div>
            </div>

            {/* Project & Activity Stats */}
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl border border-theme-border bg-theme-surface space-y-1.5">
                <div className="text-[11px] text-theme-text-muted font-bold uppercase">
                  โครงการที่สังกัด (Initiative):
                </div>
                <div className="font-semibold text-theme-text">{selectedSlot.requestTitle}</div>
                <div className="text-[11px] text-indigo-500 flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>เครื่องมือ: {selectedSlot.aiTool}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl border border-theme-border bg-theme-surface">
                  <div className="text-[10px] text-theme-text-muted">วันที่มีการบันทึก Daily AI Log</div>
                  <div className={cn('text-lg font-bold font-mono mt-0.5', selectedSlot.activeDays === undefined ? 'text-theme-text-muted' : selectedSlot.activeDays >= 1 ? 'text-emerald-500' : 'text-rose-500')}>
                    {selectedSlot.activeDays === undefined ? 'ยังไม่มีข้อมูล' : `${selectedSlot.activeDays} / 20 วัน`}
                  </div>
                  <div className="text-[10px] text-theme-text-muted">
                    {selectedSlot.activeDays === undefined
                      ? 'ยังไม่มีรายงานของเดือนที่ผ่านมาหรือเดือนนี้'
                      : `จากรายงานเดือน${formatReportMonth(selectedSlot.reportMonth)} · ไม่ได้ใช้งานเลยทั้งเดือน สิทธิ์จะถูกระงับ`}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-theme-border bg-theme-surface">
                  <div className="text-[10px] text-theme-text-muted">เวลาเฉลี่ยที่ประหยัดได้</div>
                  <div className="text-lg font-bold font-mono text-indigo-500 mt-0.5">
                    {selectedSlot.monthlyHoursSaved === undefined ? 'ยังไม่มีข้อมูล' : `${selectedSlot.monthlyHoursSaved} ชม./เดือน`}
                  </div>
                  <div className="text-[10px] text-theme-text-muted">จากรายงานรายเดือนล่าสุด</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-2">
              {onSelectRequest && selectedSlot.requestId && (
                <button
                  onClick={() => {
                    onSelectRequest(selectedSlot.requestId!);
                    setSelectedSlot(null);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>ดูรายละเอียดโครงการ</span>
                  <ExternalLink size={13} />
                </button>
              )}
              <button
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-theme-surface-secondary hover:bg-theme-surface-tertiary text-theme-text border border-theme-border transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
