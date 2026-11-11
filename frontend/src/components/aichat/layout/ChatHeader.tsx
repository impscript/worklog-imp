import React from 'react';
import {
  Menu,
  Cpu,
  Brain,
  Globe,
  LayoutTemplate,
  Key,
  Swords,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import type { ModelInfo, ThinkingLevel } from '../../../hooks/useOpenRouterModels';
import { SMART_PRESETS } from '../../../hooks/useOpenRouterModels';
import { cn } from '../../../lib/utils';

interface ChatHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileHistory: () => void;
  activeModelInfo: ModelInfo;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  favoriteModelsList: ModelInfo[];
  thinkingLevel: ThinkingLevel;
  onChangeThinkingLevel: (level: ThinkingLevel) => void;
  onOpenModelSearch: () => void;
  onOpenApiKeyModal: () => void;
  hasArtifacts: boolean;
  isArtifactDrawerOpen: boolean;
  onToggleArtifactDrawer: () => void;
  // Arena & Sandbox Controls
  isArenaMode?: boolean;
  onToggleArenaMode?: () => void;
  onOpenTaskKitsModal?: () => void;
  onOpenGraduationModal?: () => void;
}

const THINKING_OPTIONS = [
  { level: 'low', icon: '⚡', label: 'เร็ว', hint: 'ตอบเร็ว คิดน้อย' },
  { level: 'medium', icon: '⚖️', label: 'สมดุล', hint: 'สมดุลระหว่างความเร็วและความลึก' },
  { level: 'high', icon: '🧠', label: 'คิดลึก', hint: 'คิดละเอียดที่สุด ใช้เวลานานกว่า' },
] as const;

// All responsive rules use container queries (@xl:, @3xl: …) so the toolbar adapts to the width of the chat
// area itself — which shrinks when the app sidebar and the history sidebar are open — instead of the viewport.
const BTN = 'inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap';
const BTN_NEUTRAL = 'border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-secondary';

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileHistory,
  activeModelInfo,
  selectedModel,
  onSelectModel,
  favoriteModelsList,
  thinkingLevel,
  onChangeThinkingLevel,
  onOpenModelSearch,
  onOpenApiKeyModal,
  hasArtifacts,
  isArtifactDrawerOpen,
  onToggleArtifactDrawer,
  isArenaMode = false,
  onToggleArenaMode,
  onOpenTaskKitsModal,
  onOpenGraduationModal,
}) => {
  return (
    <header className="@container shrink-0 relative z-10 border-b border-theme-border/60 bg-theme-surface/60 dark:bg-theme-bg-page/40 backdrop-blur-md">
      <div className="h-14 px-3 sm:px-4 flex items-center gap-2">
        {/* Left: sidebar toggle + model picker (takes the remaining space and shrinks first) */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={cn(BTN, BTN_NEUTRAL, 'w-9 hidden md:inline-flex text-theme-text-muted')}
            title={isSidebarOpen ? 'ซ่อนแถบข้าง' : 'แสดงแถบข้าง'}
            aria-label={isSidebarOpen ? 'ซ่อนแถบข้าง' : 'แสดงแถบข้าง'}
          >
            <Menu size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenMobileHistory}
            className={cn(BTN, BTN_NEUTRAL, 'w-9 md:hidden text-theme-text-muted')}
            aria-label="เปิดประวัติการสนทนา"
          >
            <Menu size={16} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'hidden @md:flex w-9 h-9 rounded-lg items-center justify-center shrink-0',
                activeModelInfo.tier === 'paid'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
              )}
              title={activeModelInfo.tier === 'paid' ? 'โมเดลแบบเสียค่าใช้จ่าย' : 'โมเดลฟรี'}
            >
              <Cpu size={16} />
            </span>

            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              aria-label="เลือกโมเดล AI"
              className="h-9 min-w-0 w-full max-w-[240px] text-xs font-semibold pl-2.5 pr-7 rounded-lg border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
            >
              <optgroup label="🤖 Presets มาตรฐาน">
                {SMART_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={`⭐ โมเดลโปรด (${favoriteModelsList.length})`}>
                {favoriteModelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.tier === 'paid' ? '🔒' : '⚠️'} {m.name}
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              type="button"
              onClick={onOpenModelSearch}
              className={cn(BTN, BTN_NEUTRAL, 'hidden @xl:inline-flex px-2.5 text-indigo-600 dark:text-indigo-400')}
              title="ค้นหาโมเดลทั้งหมดใน OpenRouter"
              aria-label="ค้นหาโมเดลทั้งหมด"
            >
              <Globe size={14} />
              <span className="hidden @7xl:inline">ค้นหาโมเดล</span>
            </button>
          </div>
        </div>

        {/* Right: tools, grouped. Each group collapses to icon-only before anything can overlap. */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Group 1: Arena & test material */}
          <div className="flex items-center gap-1.5">
            {onToggleArenaMode && (
              <button
                type="button"
                onClick={onToggleArenaMode}
                aria-pressed={isArenaMode}
                className={cn(
                  BTN,
                  'px-2.5',
                  isArenaMode
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600'
                    : 'border-theme-border bg-theme-surface text-theme-text-muted hover:text-amber-600 hover:border-amber-500/40'
                )}
                title="สลับโหมดประลอง 4 ค่าย (Side-by-Side Model Arena)"
              >
                <Swords size={15} className={isArenaMode ? 'animate-pulse' : ''} />
                <span className="hidden @3xl:inline">ประลอง Arena</span>
                <span className="hidden @5xl:inline text-[10px] px-1.5 py-0.5 rounded-md bg-black/15">4 ค่าย</span>
              </button>
            )}

            {onOpenTaskKitsModal && (
              <button
                type="button"
                onClick={onOpenTaskKitsModal}
                className={cn(BTN, BTN_NEUTRAL, 'hidden @2xl:inline-flex px-2.5')}
                title="คลังโจทย์ทดสอบมาตรฐาน 8 ฝ่ายงาน"
                aria-label="คลังโจทย์ทดสอบ 8 ฝ่ายงาน"
              >
                <BookOpen size={15} className="text-indigo-500" />
                <span className="hidden @5xl:inline">โจทย์ 8 ฝ่าย</span>
              </button>
            )}

            {onOpenGraduationModal && (
              <button
                type="button"
                onClick={onOpenGraduationModal}
                className={cn(BTN, 'hidden @3xl:inline-flex px-2.5 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400')}
                title="สรุปผลลัพธ์ Sandbox และส่งข้อมูลขอสิทธิ์ใช้งาน AI (FM-001)"
                aria-label="สรุปผล Sandbox และขอสิทธิ์ใช้งาน AI"
              >
                <GraduationCap size={15} />
                <span className="hidden @6xl:inline">ขอสิทธิ์จากผล Sandbox</span>
              </button>
            )}
          </div>

          <span className="hidden @4xl:block h-6 w-px bg-theme-border" aria-hidden="true" />

          {/* Group 2: thinking depth */}
          <div
            role="group"
            aria-label="ระดับการคิดของ AI"
            className="hidden @4xl:flex items-center h-9 p-0.5 rounded-lg border border-theme-border bg-theme-surface-secondary/60"
          >
            <span className="hidden @7xl:flex items-center gap-1 px-2 text-[11px] font-semibold text-theme-text-muted">
              <Brain size={13} className="text-violet-500" />
              ความคิด
            </span>
            {THINKING_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                type="button"
                onClick={() => onChangeThinkingLevel(opt.level)}
                aria-pressed={thinkingLevel === opt.level}
                title={`${opt.label}: ${opt.hint}`}
                className={cn(
                  'h-8 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer select-none inline-flex items-center gap-1 whitespace-nowrap',
                  thinkingLevel === opt.level
                    ? 'bg-violet-500 text-white shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text'
                )}
              >
                <span aria-hidden="true">{opt.icon}</span>
                <span className="hidden @7xl:inline">{opt.label}</span>
              </button>
            ))}
          </div>

          <span className="hidden @4xl:block h-6 w-px bg-theme-border" aria-hidden="true" />

          {/* Group 3: canvas & API key */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleArtifactDrawer}
              aria-pressed={isArtifactDrawerOpen}
              className={cn(
                BTN,
                'px-2.5',
                isArtifactDrawerOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : hasArtifacts
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                  : 'border-theme-border bg-theme-surface text-theme-text-muted hover:text-theme-text'
              )}
              title="เปิด-ปิดหน้าต่าง Canvas / Artifact"
            >
              <LayoutTemplate size={15} />
              <span className="hidden @4xl:inline">Canvas</span>
            </button>

            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className={cn(BTN, BTN_NEUTRAL, 'w-9 text-theme-text-muted hover:text-theme-text')}
              title="ตั้งค่า API Key"
              aria-label="ตั้งค่า API Key"
            >
              <Key size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
