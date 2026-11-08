import { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  X,
  Check,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export interface AiTeamMember {
  emp_id: string;
  name: string;
  department: string;
  position?: string;
  email?: string;
  is_lead?: boolean;
}

interface AiTeamMemberPickerProps {
  totalSeats: number;
  members: AiTeamMember[];
  onChange: (members: AiTeamMember[]) => void;
  sessionUser?: {
    id?: string;
    emp_id?: string;
    name?: string;
    full_name?: string;
    department?: string;
    position?: string;
    email?: string;
  } | null;
  allowPartialAllocation: boolean;
  onAllowPartialChange: (val: boolean) => void;
}

export default function AiTeamMemberPicker({
  totalSeats,
  members,
  onChange,
  sessionUser,
  allowPartialAllocation,
  onAllowPartialChange
}: AiTeamMemberPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AiTeamMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Handle Search by Name or Emp ID
  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const candidates: AiTeamMember[] = [];

      // 1. Search in local `users` table first
      try {
        const { data: localUsers, error: localErr } = await supabase
          .from('users')
          .select('emp_id, full_name, nickname, department, position, email')
          .or(`full_name.ilike.%${query}%,emp_id.ilike.%${query}%,nickname.ilike.%${query}%`)
          .limit(6);

        if (!localErr && localUsers) {
          localUsers.forEach(u => {
            candidates.push({
              emp_id: u.emp_id || '',
              name: u.full_name || u.nickname || 'ไม่ระบุชื่อ',
              department: u.department || 'ไม่ระบุแผนก',
              position: u.position || '',
              email: u.email || '',
              is_lead: false
            });
          });
        }
      } catch {
        // Continue to HRMS
      }

      // 2. Query HRMS search API
      try {
        const res = await fetch(`/api/hrms/employee/search/${encodeURIComponent(query)}/?index=0&row=6`);
        if (res.ok) {
          const json = await res.json();
          const hrmsList = (json?.data?.search || json?.search || []) as Array<Record<string, string | undefined>>;
          hrmsList.forEach((h) => {
            const hEmpId = h.empId || h.EmpID || '';
            const hName = h.name || `${h.FNameT || ''} ${h.LNameT || ''}`.trim() || 'พนักงาน';
            if (hEmpId && !candidates.some(c => c.emp_id === hEmpId)) {
              candidates.push({
                emp_id: hEmpId,
                name: hName,
                department: h.department || h.Department || 'ไม่ระบุแผนก',
                position: h.position || h.Position || '',
                email: h.email || h.EMail || '',
                is_lead: false
              });
            }
          });
        }
      } catch {
        // HRMS search fallback failover
      }

      setSearchResults(candidates);
      if (candidates.length === 0) {
        setSearchError(`ไม่พบข้อมูลพนักงานที่ตรงกับ "${query}"`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setSearchError('เกิดข้อผิดพลาดในการค้นหา: ' + errMsg);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add Member
  const handleAddMember = (candidate: AiTeamMember) => {
    const isDup = members.some(m =>
      (candidate.emp_id && m.emp_id === candidate.emp_id) ||
      (candidate.email && m.email && m.email === candidate.email) ||
      m.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
    );
    if (isDup) {
      setSearchError(`คุณ ${candidate.name} อยู่ในรายชื่อสมาชิกแล้ว`);
      return;
    }

    if (members.length >= totalSeats) {
      setSearchError(`สิทธิ์เต็มแล้ว (${totalSeats} สิทธิ์) หากต้องการเพิ่มอีก กรุณาปรับเพิ่มจำนวนสิทธิ์ที่ขอ`);
      return;
    }

    onChange([...members, candidate]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
  };

  // Remove Member (Lead cannot be removed)
  const handleRemoveMember = (targetKey: string) => {
    onChange(members.filter(m => (m.emp_id || m.email || m.name) !== targetKey));
  };

  const isFull = members.length >= totalSeats;
  const progressPct = Math.min(100, Math.round((members.length / Math.max(1, totalSeats)) * 100));

  return (
    <div className="space-y-4 p-4 rounded-xl bg-theme-surface-secondary/40 border border-theme-border/80">
      {/* Header & Quota Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/50 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            <h4 className="text-xs font-bold text-theme-text">
              ระบุรายชื่อสมาชิกในทีมที่จะใช้งานร่วมกัน (Team Seat Allocation)
            </h4>
          </div>
          <p className="text-[11px] text-theme-text-muted mt-0.5">
            ตัวแทนยื่นขอ 1 คำขอสำหรับทั้งทีม สมาชิกทุกคนในรายชื่อจะได้รับสิทธิ์เข้าใช้งานโปรเจกต์นี้
          </p>
        </div>

        {/* Quota Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border",
              isFull
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25"
            )}
          >
            {members.length} / {totalSeats} สิทธิ์ ({progressPct}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-theme-surface overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            isFull ? "bg-emerald-500" : "bg-indigo-500"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Tagged Members List */}
      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
          รายชื่อสมาชิกที่จัดสรรสิทธิ์แล้ว ({members.length} คน):
        </label>

        {members.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-theme-border text-center text-xs text-theme-text-muted flex flex-col items-center gap-2">
            <span>ยังไม่ได้ระบุรายชื่อ (ระบบจะเพิ่มตัวแทนผู้ยื่นเป็นสิทธิ์ที่ 1 อัตโนมัติ)</span>
            {sessionUser && (
              <button
                type="button"
                onClick={() => handleAddMember({
                  emp_id: sessionUser.emp_id || '',
                  name: sessionUser.full_name || sessionUser.name || 'ตัวแทนผู้ยื่น',
                  department: sessionUser.department || 'ไม่ระบุแผนก',
                  position: sessionUser.position || '',
                  email: sessionUser.email || '',
                  is_lead: true
                })}
                className="mt-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck size={13} />
                <span>+ เพิ่มฉัน ({sessionUser.full_name || sessionUser.name || 'ตัวแทน'}) เป็น Lead สิทธิ์ที่ 1</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {members.map((member, idx) => (
              <div
                key={member.emp_id || idx}
                className={cn(
                  "p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all",
                  member.is_lead
                    ? "bg-indigo-500/10 border-indigo-500/40 text-theme-text shadow-2xs"
                    : "bg-theme-surface border-theme-border/70 hover:border-theme-border text-theme-text"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0",
                      member.is_lead
                        ? "bg-indigo-600 text-white"
                        : "bg-theme-surface-secondary text-theme-text-muted border border-theme-border"
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate flex items-center gap-1.5" title={member.name}>
                      <span>{member.name}</span>
                      {member.is_lead && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-600 text-white shrink-0">
                          Lead
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-theme-text-muted truncate">
                      {member.emp_id ? `รหัส: ${member.emp_id} • ` : ''}{member.department}
                    </div>
                  </div>
                </div>

                {/* Remove button (Only for non-leads or when more than 1) */}
                {!member.is_lead && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.emp_id || member.email || member.name)}
                    className="w-5 h-5 rounded-md hover:bg-rose-500/15 hover:text-rose-500 text-theme-text-muted flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    title={`ลบคุณ ${member.name}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search & Add Member Input (Only when quota is not full) */}
      {!isFull ? (
        <div className="pt-2 border-t border-theme-border/40 space-y-2">
          <label className="block text-[11px] font-semibold text-theme-text flex items-center gap-1.5">
            <UserPlus size={13} className="text-indigo-500" />
            <span>ค้นหาและเพิ่มสมาชิกคนที่ {members.length + 1} (พิมพ์ชื่อ หรือ รหัสพนักงาน):</span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                placeholder="เช่น 10045, ชัชวาลย์, หรือ Somchai..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleSearch();
                  }
                }}
                className="w-full text-xs py-2 pl-8 pr-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleSearch();
              }}
              disabled={isSearching || !searchQuery.trim()}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>ค้นหา...</span>
                </>
              ) : (
                <>
                  <Search size={13} />
                  <span>ค้นหา</span>
                </>
              )}
            </button>
          </div>

          {/* Search Error */}
          {searchError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{searchError}</span>
            </p>
          )}

          {/* Search Candidates Dropdown / List */}
          {searchResults.length > 0 && (
            <div className="p-2 rounded-xl bg-theme-surface border border-theme-border shadow-md space-y-1 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-0.5">
                <span className="text-[10px] text-theme-text-muted font-bold uppercase">
                  ผลการค้นหา ({searchResults.length} คน):
                </span>
                <button
                  type="button"
                  onClick={() => setSearchResults([])}
                  className="text-[10px] text-theme-text-muted hover:text-theme-text cursor-pointer"
                >
                  ✕ ปิด
                </button>
              </div>
              {searchResults.map((c) => {
                const isAlreadyAdded = members.some(m => m.emp_id === c.emp_id);
                return (
                  <div
                    key={c.emp_id || c.name}
                    className="p-2 rounded-lg hover:bg-theme-surface-secondary flex items-center justify-between gap-2 text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-theme-text flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.emp_id && (
                          <span className="font-mono text-[10px] text-theme-text-muted">
                            ({c.emp_id})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-theme-text-muted flex items-center gap-2">
                        <span>{c.department}</span>
                        {c.position && <span>• {c.position}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => handleAddMember(c)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer",
                        isAlreadyAdded
                          ? "bg-theme-surface-tertiary text-theme-text-muted cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs active:scale-95"
                      )}
                    >
                      {isAlreadyAdded ? (
                        <>
                          <Check size={11} />
                          <span>เพิ่มแล้ว</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={11} />
                          <span>+ เพิ่มเข้าทีม</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck size={16} />
            <span className="font-semibold">ระบุรายชื่อสมาชิกครบทั้ง {totalSeats} สิทธิ์เรียบร้อยแล้ว</span>
          </div>
          <span className="text-[11px] text-theme-text-muted">
            หากต้องการเปลี่ยนสมาชิก ให้กด ✕ ที่การ์ดคนเดิม
          </span>
        </div>
      )}

      {/* Partial Allocation Tolerance Checkbox */}
      {!isFull && (
        <div className="pt-2">
          <label className="flex items-center gap-2 text-xs text-theme-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowPartialAllocation}
              onChange={(e) => onAllowPartialChange(e.target.checked)}
              className="rounded border-theme-border text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>
              ระบุเฉพาะสมาชิกที่ทราบก่อน (สามารถระบุอีก {totalSeats - members.length} คนที่เหลือเพิ่มเติมภายหลังได้รับอนุมัติ)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
