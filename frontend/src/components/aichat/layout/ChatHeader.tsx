import React from 'react';
import {
  Menu,
  Cpu,
  Brain,
  Globe,
  LayoutTemplate,
  Key,
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
}

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
}) => {
  return (
    <header className="h-14 border-b border-theme-border/60 px-4 sm:px-6 flex items-center justify-between bg-theme-surface/60 dark:bg-theme-bg-page/40 backdrop-blur-md relative z-10 shrink-0">
      {/* Left: Sidebar Toggle & Model Info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex p-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer select-none"
          title={isSidebarOpen ? 'ซ่อนแถบข้าง' : 'แสดงแถบข้าง'}
        >
          <Menu size={16} />
        </button>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileHistory}
          className="flex md:hidden p-2 rounded-xl border border-theme-border bg-theme-surface text-theme-text-muted hover:text-theme-text cursor-pointer"
        >
          <Menu size={16} />
        </button>

        {/* Model Selector Dropdown & Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'p-1.5 rounded-xl shrink-0 hidden sm:flex items-center justify-center',
              activeModelInfo.tier === 'paid'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
            )}
          >
            <Cpu size={16} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="text-xs font-black py-1.5 pl-2.5 pr-7 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[140px] sm:max-w-[220px] truncate"
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

            {/* Model Search Trigger */}
            <button
              type="button"
              onClick={onOpenModelSearch}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-500/20 transition-all cursor-pointer select-none"
              title="ค้นหาโมเดลทั้งหมดใน OpenRouter"
            >
              <Globe size={12} />
              <span>ค้นหาโมเดลทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Thinking Effort, Artifacts & Settings */}
      <div className="flex items-center gap-2">
        {/* Thinking Effort Selector */}
        <div className="hidden sm:flex items-center gap-1 bg-theme-surface-secondary/50 p-1 rounded-2xl border border-theme-border/60 text-[10px]">
          <span className="font-bold text-theme-text-muted px-1.5 flex items-center gap-1">
            <Brain size={12} className="text-violet-500" />
            ความคิด:
          </span>
          {(['low', 'medium', 'high'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => onChangeThinkingLevel(lvl)}
              className={cn(
                'px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer select-none',
                thinkingLevel === lvl
                  ? 'bg-violet-500 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
            >
              {lvl === 'low' ? '⚡ เร็ว' : lvl === 'medium' ? '⚖️ สมดุล' : '🧠 คิดลึก'}
            </button>
          ))}
        </div>

        {/* Artifacts / Canvas Toggle */}
        <button
          type="button"
          onClick={onToggleArtifactDrawer}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none',
            isArtifactDrawerOpen
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : hasArtifacts
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
              : 'border-theme-border bg-theme-surface text-theme-text-muted hover:text-theme-text'
          )}
          title="เปิด-ปิดหน้าต่าง Canvas / Artifact"
        >
          <LayoutTemplate size={14} />
          <span className="hidden sm:inline">Canvas</span>
        </button>

        {/* API Key Modal Button */}
        <button
          type="button"
          onClick={onOpenApiKeyModal}
          className="p-2 rounded-xl border border-theme-border bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer select-none"
          title="ตั้งค่า API Key"
        >
          <Key size={14} />
        </button>
      </div>
    </header>
  );
};
