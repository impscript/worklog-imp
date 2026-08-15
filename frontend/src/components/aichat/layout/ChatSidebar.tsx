import React, { useState, useMemo } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Pin,
  Key,
  X,
  Sparkles,
} from 'lucide-react';
import type { ChatSession, GroupedSessions } from '../../../hooks/useChatSessions';
import { cn } from '../../../lib/utils';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onTogglePinSession: (id: string) => void;
  onOpenClearModal: (type: 'history' | 'key') => void;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  isMobileOpen,
  onCloseMobile,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateNewChat,
  onDeleteSession,
  onTogglePinSession,
  onOpenClearModal,
  onOpenApiKeyModal,
  hasApiKey,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo((): GroupedSessions => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const last7DaysStart = todayStart - 86400000 * 7;

    const res: GroupedSessions = { today: [], yesterday: [], last7Days: [], older: [] };

    filteredSessions.forEach((s) => {
      const time = new Date(s.createdAt).getTime();
      if (s.isPinned || time >= todayStart) {
        res.today.push(s);
      } else if (time >= yesterdayStart) {
        res.yesterday.push(s);
      } else if (time >= last7DaysStart) {
        res.last7Days.push(s);
      } else {
        res.older.push(s);
      }
    });
    return res;
  }, [filteredSessions]);

  const renderSessionGroup = (title: string, groupSessions: ChatSession[]) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="space-y-1 my-2">
        <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider px-3 py-1">
          {title} ({groupSessions.length})
        </div>
        {groupSessions.map((s) => {
          const isActive = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              onClick={() => {
                onSelectSession(s.id);
                onCloseMobile();
              }}
              className={cn(
                'group flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-all border relative select-none',
                isActive
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                <MessageSquare size={13} className={cn('shrink-0', isActive ? 'text-indigo-500' : 'opacity-60')} />
                <span className="truncate">{s.title || 'บทสนทนาใหม่'}</span>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePinSession(s.id);
                  }}
                  className="p-1 rounded-lg hover:bg-theme-surface text-theme-text-muted hover:text-amber-500 transition-colors"
                  title={s.isPinned ? 'ถอดหมุด' : 'ปักหมุด'}
                >
                  <Pin size={12} className={cn(s.isPinned && 'fill-amber-400 text-amber-400')} />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDeleteSession(s.id, e)}
                  className="p-1 rounded-lg hover:bg-theme-surface text-theme-text-muted hover:text-rose-500 transition-colors"
                  title="ลบแชทนี้"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      {/* Top Section */}
      <div className="p-3.5 space-y-3 border-b border-theme-border/60">
        {/* New Chat Button */}
        <button
          type="button"
          onClick={() => {
            onCreateNewChat();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/15 active:scale-95 transition-all cursor-pointer select-none"
        >
          <Plus size={16} />
          <span>สร้างแชทใหม่ (New Chat)</span>
        </button>

        {/* Search Chat Input */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-theme-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาประวัติการแชท..."
            className="w-full text-xs py-2 pl-8 pr-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Middle: Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-xs text-theme-text-muted space-y-2">
            <MessageSquare size={24} className="mx-auto opacity-30" />
            <p>ยังไม่มีประวัติการสนทนา</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-xs text-theme-text-muted">
            ไม่พบแชทที่ตรงกับคำค้นหา
          </div>
        ) : (
          <>
            {renderSessionGroup('📌 ปักหมุด / วันนี้', grouped.today)}
            {renderSessionGroup('เมื่อวานนี้', grouped.yesterday)}
            {renderSessionGroup('7 วันที่ผ่านมา', grouped.last7Days)}
            {renderSessionGroup('ก่อนหน้านี้', grouped.older)}
          </>
        )}
      </div>

      {/* Bottom Bar: Settings & Storage */}
      <div className="p-3 border-t border-theme-border/60 bg-theme-surface/40 dark:bg-theme-bg-page/40 space-y-2 text-xs">
        {/* API Key Status Pill */}
        <button
          type="button"
          onClick={onOpenApiKeyModal}
          className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-theme-border/80 bg-theme-surface hover:bg-theme-surface-secondary text-theme-text transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Key size={14} className={hasApiKey ? 'text-emerald-500' : 'text-amber-500'} />
            <span className="font-bold text-[11px] truncate">
              {hasApiKey ? 'API Key: พร้อมใช้งาน 🟢' : 'ยังไม่ได้ใส่ API Key 🔴'}
            </span>
          </div>
          <span className="text-[10px] text-indigo-500 font-bold shrink-0">ตั้งค่า</span>
        </button>

        {/* Clear Data Trigger */}
        <div className="flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => onOpenClearModal('history')}
            className="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-300 dark:hover:border-rose-800 transition-all cursor-pointer text-center"
          >
            ล้างประวัติแชท
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'border-r border-theme-border/60 bg-theme-surface/40 dark:bg-theme-bg-page/40 shrink-0 hidden md:flex flex-col transition-all duration-300 relative',
          isOpen ? 'w-72 sm:w-80' : 'w-0 border-r-0 overflow-hidden'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-4/5 max-w-xs h-full bg-theme-surface dark:bg-theme-bg-page border-r border-theme-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-theme-border/60">
              <span className="font-extrabold text-sm text-theme-text flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                ประวัติการสนทนา
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{sidebarContent}</div>
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
