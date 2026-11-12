import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiRequest } from '../../pages/AiEnterprisePage';
import { statusMeta } from './aiRequestStatus';

interface AiRequestSelectProps {
  requests: AiRequest[];
  value: string;
  onChange: (id: string) => void;
  /** Requests that belong in the first group (listed first). Defaults to requests waiting for review. */
  isFirstGroup?: (request: AiRequest) => boolean;
  groupLabels?: { first: string; second: string };
  placeholder?: string;
  /** Which edge of the field the dropdown panel lines up with. */
  align?: 'left' | 'right';
}

type Option = { req: AiRequest; group: 'first' | 'second' };

const DEFAULT_GROUP_LABELS = { first: 'คำขอรอพิจารณา', second: 'คำขอที่ประเมินแล้ว' };
const defaultIsFirstGroup = (r: AiRequest) => r.status === 'pending_review';

/** Searchable replacement for the native request <select>: type to filter by title, department or requester. */
export default function AiRequestSelect({
  requests,
  value,
  onChange,
  isFirstGroup = defaultIsFirstGroup,
  groupLabels = DEFAULT_GROUP_LABELS,
  placeholder = 'เลือกคำขอ',
  align = 'right',
}: AiRequestSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = requests.find((r) => r.id === value);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (r: AiRequest) =>
      !q || [r.title, r.department, r.requester_name].some((v) => (v || '').toLowerCase().includes(q));
    const first = requests.filter((r) => isFirstGroup(r) && match(r)).map((req) => ({ req, group: 'first' as const }));
    const second = requests.filter((r) => !isFirstGroup(r) && match(r)).map((req) => ({ req, group: 'second' as const }));
    return [...first, ...second];
  }, [requests, query, isFirstGroup]);

  // Close when the user clicks anywhere outside the control
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row visible while moving with the arrow keys
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  const openPanel = () => {
    setQuery('');
    // the list shows the first group before the second, so start on the current one in that order
    const ordered = [...requests.filter((r) => isFirstGroup(r)), ...requests.filter((r) => !isFirstGroup(r))];
    setCursor(Math.max(0, ordered.findIndex((r) => r.id === value)));
    setOpen(true);
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(options.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[cursor];
      if (opt) choose(opt.req.id);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text hover:border-indigo-500/50 focus:outline-none focus:border-indigo-500 font-medium text-left cursor-pointer"
      >
        <span className="truncate">
          {selected ? `${selected.title} (${selected.department})` : placeholder}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-theme-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn('absolute z-30 mt-1 w-full sm:w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border border-theme-border bg-theme-surface shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-theme-border">
            <Search className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-label="ค้นหาคำขอ"
              placeholder="ค้นหาชื่อคำขอ ฝ่าย หรือผู้ขอ"
              className="w-full bg-transparent text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none"
            />
          </div>

          <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-4 text-center text-xs text-theme-text-muted">ไม่พบคำขอที่ตรงกับคำค้นหา</li>}
            {options.map((o, i) => {
              const meta = statusMeta(o.req.status);
              const showHeader = i === 0 || options[i - 1].group !== o.group;
              const isCurrent = o.req.id === value;
              return (
                <li key={o.req.id} role="presentation">
                  {showHeader && (
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-theme-text-muted">
                      {groupLabels[o.group]}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(o.req.id)}
                    className={cn(
                      'w-full flex items-start gap-2 px-3 py-2 text-left cursor-pointer',
                      i === cursor ? 'bg-indigo-500/10' : 'hover:bg-theme-surface-secondary',
                    )}
                  >
                    <span className="mt-0.5 w-3.5 shrink-0">{isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-theme-text truncate">{o.req.title}</span>
                      <span className="block text-[11px] text-theme-text-muted truncate">
                        {[o.req.department, o.req.requester_name].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.badge)}>{meta.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
