import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  description?: string;
}

export interface MultiSelectPreset {
  label: string;
  icon?: React.ReactNode;
  values: string[];
}

interface MultiSelectFilterProps {
  label: string;
  defaultAllLabel?: string;
  icon?: React.ReactNode;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  presets?: MultiSelectPreset[];
  searchPlaceholder?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  defaultAllLabel,
  icon,
  options,
  selectedValues,
  onChange,
  presets,
  searchPlaceholder,
  className,
  align = 'left',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
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

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, search]);

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;
  const isNoneSelected = selectedValues.length === 0;

  const handleToggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleApplyPreset = (presetValues: string[]) => {
    onChange(presetValues);
  };

  // Find label when only 1 item selected
  const singleSelectedLabel = useMemo(() => {
    if (selectedValues.length !== 1) return null;
    const found = options.find((o) => o.value === selectedValues[0]);
    return found ? found.label : selectedValues[0];
  }, [selectedValues, options]);

  return (
    <div className={cn('relative inline-block text-left', isOpen ? 'z-50' : 'z-10', className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none shadow-xs',
          selectedValues.length > 0
            ? 'bg-indigo-50/90 dark:bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
            : 'border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-secondary hover:border-theme-border/80'
        )}
        title={selectedValues.length > 0 ? `${label} (${selectedValues.length})` : label}
      >
        {icon && <span className="shrink-0 text-theme-text-muted">{icon}</span>}
        
        <span className="truncate max-w-[150px]">
          {selectedValues.length === 0
            ? defaultAllLabel || label
            : selectedValues.length === 1
            ? singleSelectedLabel
            : label}
        </span>

        {selectedValues.length > 1 && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-600 text-white shrink-0 shadow-xs">
            {selectedValues.length}
          </span>
        )}

        <ChevronDown
          size={13}
          className={cn(
            'text-theme-text-muted transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180 text-indigo-600 dark:text-indigo-400'
          )}
        />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 mt-1.5 min-w-[240px] max-w-[320px] w-max rounded-2xl border border-theme-border bg-theme-surface dark:bg-theme-surface-modal shadow-2xl backdrop-blur-xl p-2.5 animate-fade-in space-y-2',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {/* Header with Title and Quick All / Clear */}
          <div className="flex items-center justify-between pb-1.5 border-b border-theme-border/60 text-xs">
            <div className="flex items-center gap-1 font-bold text-theme-text">
              <span>{label}</span>
              {selectedValues.length > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                  {selectedValues.length}/{options.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={isAllSelected}
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer',
                  isAllSelected
                    ? 'text-theme-text-muted/40 cursor-not-allowed'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                )}
              >
                {t('gantt.filters.selectAll')}
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={isNoneSelected}
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer',
                  isNoneSelected
                    ? 'text-theme-text-muted/40 cursor-not-allowed'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                )}
              >
                {t('gantt.filters.clear')}
              </button>
            </div>
          </div>

          {/* Quick Presets Bar (e.g. Project vs Support bundle) */}
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1.5 border-b border-theme-border/40">
              {presets.map((preset) => {
                const isActive =
                  preset.values.length > 0 &&
                  preset.values.every((v) => selectedValues.includes(v)) &&
                  selectedValues.length === preset.values.length;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyPreset(preset.values)}
                    className={cn(
                      'text-[10.5px] font-semibold px-2 py-0.8 rounded-lg border transition-all cursor-pointer flex items-center gap-1',
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-theme-surface-secondary/70 border-theme-border/70 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary'
                    )}
                  >
                    {preset.icon && <span className="text-[11px]">{preset.icon}</span>}
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Box if > 5 options */}
          {options.length > 5 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder || t('gantt.filters.searchOption')}
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

          {/* Options Checklist */}
          <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-theme-text-muted">
                {t('gantt.filters.noOptionsFound')}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isChecked = selectedValues.includes(option.value);
                return (
                  <label
                    key={option.value}
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggleOption(option.value);
                    }}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none group',
                      isChecked
                        ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 font-semibold'
                        : 'text-theme-text hover:bg-theme-surface-tertiary'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Checkbox box */}
                      <div
                        className={cn(
                          'w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0',
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'border-theme-border bg-theme-surface group-hover:border-indigo-400'
                        )}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>

                      {/* Icon */}
                      {option.icon && (
                        <span className="shrink-0 text-theme-text-muted group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {option.icon}
                        </span>
                      )}

                      {/* Label & Description */}
                      <div className="truncate">
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                          <p className="text-[10px] text-theme-text-muted truncate font-normal">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Optional Badge */}
                    {option.badge !== undefined && (
                      <span className="text-[10px] font-mono font-bold text-theme-text-muted px-1.5 py-0.2 rounded bg-theme-surface-secondary shrink-0">
                        {option.badge}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Action to close */}
          <div className="pt-1.5 border-t border-theme-border/60 flex items-center justify-between">
            <span className="text-[10.5px] text-theme-text-muted">
              {selectedValues.length === 0
                ? t('gantt.filters.defaultAll')
                : t('gantt.filters.selectedCount', { count: selectedValues.length })}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              {t('gantt.filters.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
