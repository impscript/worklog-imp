import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Workspace {
  id: string;
  workspace_name: string;
  invite_code: string;
}

interface WorkspaceSwitcherProps {
  workspacesList: Workspace[];
  selectedWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
}

export default function WorkspaceSwitcher({
  workspacesList,
  selectedWorkspaceId,
  onSelect,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedWorkspace = workspacesList.find((w) => w.id === selectedWorkspaceId) || workspacesList[0];

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter workspaces
  const filtered = workspacesList.filter((w) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (w.workspace_name || '').toLowerCase().includes(q) ||
      (w.invite_code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/60 hover:border-indigo-500/40 rounded-xl shadow-sm text-xs font-bold text-theme-text transition-all active:scale-95",
          isOpen && "ring-1 ring-indigo-500 border-indigo-500/50"
        )}
      >
        <LayoutGrid size={14} className="text-indigo-500 flex-shrink-0" />
        <span className="truncate max-w-[150px] sm:max-w-[200px]" title={selectedWorkspace?.workspace_name}>
          {selectedWorkspace?.workspace_name || 'เลือก Workspace'}
        </span>
        {selectedWorkspace?.invite_code && (
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold flex-shrink-0">
            {selectedWorkspace.invite_code}
          </span>
        )}
        <ChevronDown size={12} className={cn("text-theme-text-muted flex-shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 z-50 bg-theme-surface border border-theme-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ai-glass">
          {/* Search box */}
          <div className="p-3 border-b border-theme-border/30 bg-theme-surface-secondary/40">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาฝ่ายงาน/Workspace..."
                className="w-full bg-theme-surface-secondary/80 border border-theme-border/60 rounded-xl py-1.5 pl-8 pr-3 text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* List items */}
          <div className="max-h-60 overflow-y-auto divide-y divide-theme-border/10 py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-xs text-theme-text-muted text-center">ไม่พบ Workspace</div>
            ) : (
              filtered.map((w) => {
                const isSelected = w.id === selectedWorkspaceId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onSelect(w.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-500/10 transition-colors text-left group",
                      isSelected && "bg-indigo-500/5"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className={cn(
                        "text-xs font-bold truncate group-hover:text-indigo-400 transition-colors",
                        isSelected ? "text-indigo-400" : "text-theme-text"
                      )}>
                        {w.workspace_name}
                      </p>
                      <p className="text-[10px] text-theme-text-muted font-mono mt-0.5">{w.invite_code}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <Check size={11} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count info */}
          <div className="px-3 py-1.5 bg-theme-surface-secondary/60 border-t border-theme-border/30 text-[10px] text-theme-text-muted flex justify-between items-center">
            <span>ทั้งหมด {workspacesList.length} ฝ่าย</span>
            {filtered.length !== workspacesList.length && (
              <span>ค้นพบ {filtered.length} ฝ่าย</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
