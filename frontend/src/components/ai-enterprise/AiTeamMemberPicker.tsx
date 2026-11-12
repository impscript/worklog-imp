import { useState } from 'react';
import {
  UserPlus,
  Search,
  X,
  Check,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { searchEmployees } from './aiEmployeeSearch';
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

const memberKeyOf = (m: AiTeamMember) => m.emp_id || m.email || m.name;

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
      const candidates = await searchEmployees(query);

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
    onChange(members.filter(m => memberKeyOf(m) !== targetKey));
  };

  const isFull = members.length >= totalSeats;

  return (
    <div className="space-y-3">
      {/* 1. Search first */}
      {!isFull && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                placeholder="เช่น 10045, ชัชวาลย์, หรือ Somchai..."
                aria-label="ค้นหาและเพิ่มสมาชิก (พิมพ์ชื่อ หรือ รหัสพนักงาน)"
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
                          <span>+ เพิ่มเข้ารายชื่อ</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Table of the people picked so far */}
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
              <span>+ เพิ่มฉัน ({sessionUser.full_name || sessionUser.name || 'ตัวแทน'}) เป็นผู้ขอหลัก</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-theme-border/70">
          <table className="w-full text-xs">
            <thead className="bg-theme-surface-secondary/60 text-theme-text-muted">
              <tr>
                <th className="text-right font-semibold px-3 py-2 w-10">#</th>
                <th className="text-left font-semibold px-3 py-2">ชื่อ</th>
                <th className="text-left font-semibold px-3 py-2">รหัสพนักงาน</th>
                <th className="text-left font-semibold px-3 py-2">ฝ่าย / แผนก</th>
                <th className="text-left font-semibold px-3 py-2">ตำแหน่ง</th>
                <th className="px-3 py-2 w-12" aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/50">
              {members.map((member, idx) => (
                <tr key={`${memberKeyOf(member)}-${idx}`} className={member.is_lead ? 'bg-indigo-500/5' : undefined}>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-theme-text-muted">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-theme-text">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span>{member.name}</span>
                      {member.is_lead && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white shrink-0">
                          ผู้ขอหลัก
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-theme-text-muted">{member.emp_id || '—'}</td>
                  <td className="px-3 py-2 text-theme-text">{member.department || '—'}</td>
                  <td className="px-3 py-2 text-theme-text-muted">{member.position || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {!member.is_lead && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(memberKeyOf(member))}
                        className="w-6 h-6 rounded-md hover:bg-rose-500/15 hover:text-rose-500 text-theme-text-muted inline-flex items-center justify-center transition-colors cursor-pointer"
                        title={`นำคุณ ${member.name} ออก`}
                        aria-label={`นำคุณ ${member.name} ออก`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-theme-border bg-theme-surface-secondary/60 font-semibold">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-theme-text">รวม</td>
                <td
                  colSpan={4}
                  className={cn(
                    'px-3 py-2 text-right font-mono tabular-nums',
                    isFull ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'
                  )}
                >
                  {members.length} / {totalSeats} สิทธิ์
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Partial Allocation Tolerance Checkbox */}
      {!isFull && (
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
      )}
    </div>
  );
}
