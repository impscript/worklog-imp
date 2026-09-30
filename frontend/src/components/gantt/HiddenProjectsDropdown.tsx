import React from 'react';
import { EyeOff, Eye, ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface HiddenProjectsDropdownProps {
  hiddenProjects: { id: string; project_name: string }[];
  onRestoreProject: (id: string) => void;
  onRestoreAllHidden: () => void;
}

// Lives next to the Registry button in the page header (not inside the filter
// toolbar) since hiding a project is a presentation override, not a data
// filter — kept as its own small component so it can be placed independently.
export const HiddenProjectsDropdown: React.FC<HiddenProjectsDropdownProps> = ({
  hiddenProjects,
  onRestoreProject,
  onRestoreAllHidden,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredHiddenProjects = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return hiddenProjects;
    return hiddenProjects.filter((p) => p.project_name.toLowerCase().includes(q));
  }, [hiddenProjects, search]);

  if (hiddenProjects.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          // Reset the search box on every toggle so it's always blank on open
          setSearch('');
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer select-none shadow-xs hover:bg-slate-500/15"
        title={t('gantt.filters.hiddenProjects')}
      >
        <EyeOff size={13} />
        <span>{t('gantt.filters.hiddenProjects')}</span>
        <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-600 text-white shrink-0 shadow-xs">
          {hiddenProjects.length}
        </span>
        <ChevronDown
          size={13}
          className={cn('transition-transform duration-200 shrink-0', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 min-w-[240px] max-w-[320px] w-max rounded-2xl border border-theme-border bg-theme-surface dark:bg-theme-surface-modal shadow-2xl backdrop-blur-xl p-2.5 animate-fade-in space-y-2">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-theme-border/60 text-xs">
            <span className="font-bold text-theme-text">{t('gantt.filters.hiddenProjects')}</span>
            <button
              type="button"
              onClick={() => {
                onRestoreAllHidden();
                setIsOpen(false);
              }}
              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer shrink-0"
              title={t('gantt.filters.restoreAllHidden')}
            >
              <RotateCcw size={11} />
              <span>{t('gantt.filters.restoreAllHidden')}</span>
            </button>
          </div>

          {hiddenProjects.length > 5 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('gantt.filters.searchOption')}
                className="w-full text-xs py-1.5 pl-7 pr-6 rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {filteredHiddenProjects.length === 0 ? (
              <div className="py-4 text-center text-xs text-theme-text-muted">
                {t('gantt.filters.noOptionsFound')}
              </div>
            ) : (
              filteredHiddenProjects.map((p) => (
                <div
                  key={`hidden-item-${p.id}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs text-theme-text hover:bg-theme-surface-tertiary transition-all"
                >
                  <span className="truncate">🙈 {p.project_name}</span>
                  <button
                    type="button"
                    onClick={() => onRestoreProject(p.id)}
                    className="p-1 rounded-lg hover:bg-slate-500/20 text-theme-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer shrink-0"
                    title={t('gantt.filters.restoreProject')}
                  >
                    <Eye size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
