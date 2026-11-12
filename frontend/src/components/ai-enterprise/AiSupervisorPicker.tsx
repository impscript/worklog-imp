import { useState } from 'react';
import { Search, UserCheck, X, AlertCircle, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiTeamMember } from './AiTeamMemberPicker';
import { searchEmployees } from './aiEmployeeSearch';

export type AiSupervisor = Pick<AiTeamMember, 'emp_id' | 'name' | 'department' | 'position' | 'email'>;

interface AiSupervisorPickerProps {
  value: AiSupervisor | null;
  onChange: (value: AiSupervisor | null) => void;
  /** Employee IDs / emails that cannot be the supervisor (the requester and everyone on the request). */
  blockedEmpIds: string[];
  blockedEmails: string[];
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

export default function AiSupervisorPicker({ value, onChange, blockedEmpIds, blockedEmails }: AiSupervisorPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AiSupervisor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    setMessage('');
    try {
      const found = await searchEmployees(q);
      setResults(found);
      if (found.length === 0) setMessage(`ไม่พบข้อมูลพนักงานที่ตรงกับ "${q}"`);
    } catch (err: unknown) {
      setMessage('เกิดข้อผิดพลาดในการค้นหา: ' + (err instanceof Error ? err.message : String(err)));
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const blockedReason = (c: AiSupervisor): string => {
    const idHit = c.emp_id && blockedEmpIds.some((id) => norm(id) === norm(c.emp_id));
    const mailHit = c.email && blockedEmails.some((e) => norm(e) === norm(c.email));
    return idHit || mailHit ? 'เป็นผู้ขอ/ผู้ใช้สิทธิ์ในคำขอนี้' : '';
  };

  const pick = (c: AiSupervisor) => {
    const reason = blockedReason(c);
    if (reason) {
      setMessage(`เลือก ${c.name} ไม่ได้: ${reason} กรุณาเลือกหัวหน้าระดับถัดไป`);
      return;
    }
    onChange({ emp_id: c.emp_id, name: c.name, department: c.department, position: c.position, email: c.email });
    setQuery('');
    setResults([]);
    setMessage('');
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white inline-flex items-center justify-center shrink-0">
            <UserCheck size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-theme-text truncate">{value.name}</div>
            <div className="text-[11px] text-theme-text-muted truncate">
              {value.emp_id ? `รหัส: ${value.emp_id} • ` : ''}
              {value.department}
              {value.position ? ` • ${value.position}` : ''}
            </div>
            {!value.email && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">ไม่พบอีเมลของหัวหน้าในระบบ ทีม Process จะติดต่อผ่านรหัสพนักงาน</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
        >
          <X size={13} /> เปลี่ยน
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                void runSearch();
              }
            }}
            placeholder="พิมพ์รหัสพนักงาน หรือชื่อหัวหน้า เช่น 10045"
            aria-label="ค้นหาหัวหน้าสายงาน"
            className="w-full text-xs py-2 pl-8 pr-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={isSearching || !query.trim()}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
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

      {message && (
        <p className="text-xs text-rose-500 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}

      {results.length > 0 && (
        <div className="p-2 rounded-xl bg-theme-surface border border-theme-border shadow-md space-y-1 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-0.5">
            <span className="text-[10px] text-theme-text-muted font-bold uppercase">ผลการค้นหา ({results.length} คน):</span>
            <button type="button" onClick={() => setResults([])} className="text-[10px] text-theme-text-muted hover:text-theme-text cursor-pointer">
              ✕ ปิด
            </button>
          </div>
          {results.map((c) => {
            const reason = blockedReason(c);
            return (
              <div key={c.emp_id || c.name} className="p-2 rounded-lg hover:bg-theme-surface-secondary flex items-center justify-between gap-2 text-xs transition-colors">
                <div className="min-w-0">
                  <div className="font-bold text-theme-text flex items-center gap-1.5">
                    <span className="truncate">{c.name}</span>
                    {c.emp_id && <span className="font-mono text-[10px] text-theme-text-muted">({c.emp_id})</span>}
                  </div>
                  <div className="text-[10px] text-theme-text-muted truncate">
                    {c.department}
                    {c.position ? ` • ${c.position}` : ''}
                  </div>
                  {reason && <div className="text-[10px] text-rose-500">{reason}</div>}
                </div>
                <button
                  type="button"
                  disabled={!!reason}
                  onClick={() => pick(c)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer',
                    reason ? 'bg-theme-surface-tertiary text-theme-text-muted cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  )}
                >
                  <UserPlus size={11} />
                  <span>เลือกเป็นหัวหน้า</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
