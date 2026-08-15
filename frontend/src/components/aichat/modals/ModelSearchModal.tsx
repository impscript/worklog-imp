import React, { useState, useMemo } from 'react';
import { Search, Star, RefreshCw, X } from 'lucide-react';
import type { ModelInfo, ModelCategory } from '../../../hooks/useOpenRouterModels';
import { MODEL_CATEGORY_META } from '../../../hooks/useOpenRouterModels';
import { cn } from '../../../lib/utils';

interface ModelSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectModel: (modelId: string) => void;
  favoriteModelIds: string[];
  onToggleFavorite: (modelId: string) => void;
}

export const ModelSearchModal: React.FC<ModelSearchModalProps> = ({
  isOpen,
  onClose,
  models,
  isLoading,
  onRefresh,
  onSelectModel,
  favoriteModelIds,
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ModelCategory | 'all' | 'favorites'>('all');
  const [tierFilter] = useState<'all' | 'free' | 'paid'>('all');

  const filteredModels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return models.filter((m) => {
      if (categoryFilter === 'favorites' && !favoriteModelIds.includes(m.id)) return false;
      if (tierFilter !== 'all' && m.tier !== tierFilter) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'favorites' && !m.categories?.includes(categoryFilter)) {
        return false;
      }
      if (!q) return true;
      const catLabels = (m.categories || [])
        .map((c) => MODEL_CATEGORY_META[c]?.label || c)
        .join(' ')
        .toLowerCase();
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        catLabels.includes(q)
      );
    });
  }, [models, searchQuery, categoryFilter, tierFilter, favoriteModelIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-theme-text animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-extrabold text-base text-theme-text">ค้นหาโมเดล OpenRouter ทั้งหมด</h3>
            <p className="text-xs text-theme-text-muted mt-0.5">
              เลือกจากโมเดล Live พร้อมฟิลเตอร์ตามความถนัดของงาน
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="px-5 py-3.5 border-b border-theme-border/40 bg-theme-surface-secondary/20 space-y-3 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-3 text-theme-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา เช่น claude-3.7, gemini, deepseek-r1, gpt-4o..."
                className="w-full text-xs sm:text-sm py-2.5 pl-10 pr-4 rounded-2xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>
            {isLoading && (
              <div className="flex items-center justify-center px-3">
                <RefreshCw size={16} className="animate-spin text-indigo-500" />
              </div>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                categoryFilter === 'all'
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-xs'
                  : 'border-theme-border bg-theme-surface text-theme-text-secondary hover:text-theme-text'
              )}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'favorites' ? 'all' : 'favorites')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                categoryFilter === 'favorites'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'border-amber-300/80 text-amber-600 dark:text-amber-300 bg-amber-500/10'
              )}
            >
              <Star size={12} className={cn(categoryFilter === 'favorites' && 'fill-white')} />
              <span>โปรด ({favoriteModelIds.length})</span>
            </button>
            {(Object.keys(MODEL_CATEGORY_META) as ModelCategory[]).map((cat) => {
              const meta = MODEL_CATEGORY_META[cat];
              const Icon = meta.Icon;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(active ? 'all' : cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : meta.chipClass
                  )}
                >
                  <Icon size={12} />
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          {isLoading && models.length === 0 ? (
            <div className="py-16 text-center text-xs text-theme-text-muted animate-pulse">
              กำลังโหลดรายชื่อโมเดลล่าสุดจาก OpenRouter...
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="py-16 text-center text-xs text-theme-text-muted space-y-2">
              <p>ไม่พบโมเดลตามเงื่อนไขที่ระบุ</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
                className="text-indigo-500 font-bold hover:underline cursor-pointer"
              >
                ล้างตัวกรองและลองใหม่
              </button>
            </div>
          ) : (
            filteredModels.map((m) => {
              const isFav = favoriteModelIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="w-full text-left px-4 py-3 hover:bg-theme-surface-secondary/50 transition-colors rounded-2xl flex items-start gap-3 group border border-transparent hover:border-theme-border/60"
                >
                  <button
                    type="button"
                    title={isFav ? 'ถอดจากรายการโปรด' : 'เพิ่มเป็นโมเดลโปรด'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(m.id);
                    }}
                    className="mt-0.5 p-1 rounded-lg text-theme-text-muted hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <Star
                      size={16}
                      className={cn(isFav ? 'fill-amber-400 text-amber-400' : 'opacity-40 hover:opacity-100')}
                    />
                  </button>

                  <div
                    onClick={() => {
                      onSelectModel(m.id);
                      onClose();
                    }}
                    className="flex-1 min-w-0 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {m.name}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase',
                          m.tier === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        )}
                      >
                        {m.tier === 'paid' ? 'Paid 🔒' : 'Free ⚡'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-theme-text-muted truncate">{m.id}</div>

                    {/* Category badges */}
                    {m.categories && m.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {m.categories.slice(0, 4).map((c) => {
                          const meta = MODEL_CATEGORY_META[c];
                          if (!meta) return null;
                          const Icon = meta.Icon;
                          return (
                            <span
                              key={c}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border',
                                meta.badgeClass
                              )}
                            >
                              <Icon size={10} />
                              {meta.shortLabel}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {m.description && (
                      <p className="text-xs text-theme-text-secondary line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-between text-xs text-theme-text-muted shrink-0">
          <span>
            แสดง {filteredModels.length.toLocaleString()} จาก {models.length.toLocaleString()} โมเดล
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>รีเฟรชรายการสด</span>
          </button>
        </div>
      </div>
    </div>
  );
};
