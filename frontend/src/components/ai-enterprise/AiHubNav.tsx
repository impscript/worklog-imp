import { Home, Compass, PlusCircle, FileCheck2, TrendingUp, BookOpen, Sliders, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiHubTab } from './aiHubTabs';

interface NavItem {
  id: AiHubTab;
  label: string;
  icon: LucideIcon;
}

// Ordered by the employee journey: land → choose → request → report → read.
const MEMBER_ITEMS: NavItem[] = [
  { id: 'home', label: 'หน้าแรก', icon: Home },
  { id: 'presets', label: 'เลือกแพ็กเกจ', icon: Compass },
  { id: 'request', label: 'ขอใช้งาน AI', icon: PlusCircle },
  { id: 'reports', label: 'รายงานผลงาน', icon: FileCheck2 },
  { id: 'dashboard', label: 'ผลลัพธ์ & สถิติ', icon: TrendingUp },
  { id: 'governance', label: 'คู่มือ & นโยบาย', icon: BookOpen },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: 'evaluations', label: 'พิจารณาคำขอ', icon: Sliders },
];

interface AiHubNavProps {
  active: AiHubTab;
  onChange: (tab: AiHubTab) => void;
  isAdmin: boolean;
  pendingCount: number;
}

function NavButton({ item, active, onChange, badge }: { item: NavItem; active: boolean; onChange: (tab: AiHubTab) => void; badge?: number }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 -mb-px',
        active
          ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300'
          : 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-border'
      )}
    >
      <Icon size={16} className={active ? 'text-indigo-600 dark:text-indigo-400' : 'text-theme-text-muted'} />
      <span>{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold inline-flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function AiHubNav({ active, onChange, isAdmin, pendingCount }: AiHubNavProps) {
  return (
    <nav aria-label="AI Enterprise Hub" className="flex items-end gap-1 overflow-x-auto scrollbar-none border-b border-theme-border/80">
      {MEMBER_ITEMS.map((item) => (
        <NavButton key={item.id} item={item} active={active === item.id} onChange={onChange} />
      ))}

      {isAdmin && (
        <>
          <span className="self-center mx-2 h-5 w-px bg-theme-border shrink-0" aria-hidden="true" />
          <span className="self-center mr-1 text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted shrink-0">
            ผู้ดูแล
          </span>
          {ADMIN_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={active === item.id}
              onChange={onChange}
              badge={item.id === 'evaluations' ? pendingCount : undefined}
            />
          ))}
        </>
      )}
    </nav>
  );
}
