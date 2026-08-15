import React from 'react';
import { X, Palette, Check, Info } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface ImageStudioConfig {
  engine: 'flux_cf' | 'openrouter';
  modelId: string;
  ratio: string;
  style: string;
  intent: 'illustration' | 'infographic' | 'thai_text';
}

const ASPECT_RATIO_OPTIONS = [
  { id: '16:9', label: '16:9', frameW: 24, frameH: 14, hint: 'แนวนอนกว้าง (Presentation/Hero)' },
  { id: '4:3', label: '4:3', frameW: 20, frameH: 15, hint: 'มาตรฐาน (Classic)' },
  { id: '1:1', label: '1:1', frameW: 16, frameH: 16, hint: 'จัตุรัส (Square)' },
  { id: '3:4', label: '3:4', frameW: 15, frameH: 20, hint: 'แนวตั้ง (Portrait)' },
  { id: '9:16', label: '9:16', frameW: 14, frameH: 24, hint: 'สตอรี่ / Infographic แนวตั้ง' },
];

const STYLES = [
  { id: 'none', label: 'ค่าเริ่มต้น (Default)' },
  { id: 'infographic', label: '📊 Infographic Poster' },
  { id: 'realistic', label: '📸 ภาพถ่ายเสมือนจริง (Realistic)' },
  { id: 'render3d', label: '🧊 3D Render (Octane/Blender)' },
  { id: 'anime', label: '🎨 การ์ตูน / Anime' },
  { id: 'watercolor', label: '🖌️ สีน้ำ (Watercolor)' },
  { id: 'cyberpunk', label: '🌆 ไซเบอร์พังก์ (Cyberpunk)' },
];

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ImageStudioConfig;
  onChangeConfig: (newConfig: Partial<ImageStudioConfig>) => void;
  hasApiKey: boolean;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  hasApiKey,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-theme-text animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-theme-text">สตูดิโอสร้างภาพ (Image Studio)</h3>
              <p className="text-[11px] text-theme-text-muted">ปรับแต่งเอนจิน สัดส่วนภาพ และสไตล์การวาด</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {/* Engine Selection */}
          <div className="space-y-2">
            <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
              1. เลือกเอนจินสร้างภาพ (Engine)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option A: Free Flux */}
              <button
                type="button"
                onClick={() => onChangeConfig({ engine: 'flux_cf' })}
                className={cn(
                  'p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2',
                  config.engine === 'flux_cf'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                    : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">⚡ ฟรี · Flux</span>
                  {config.engine === 'flux_cf' && <Check size={14} className="text-emerald-500" />}
                </div>
                <p className="text-[10px] text-theme-text-muted leading-relaxed">
                  สร้างภาพฟรีผ่าน Cloudflare Worker (แปลอังกฤษอัตโนมัติ)
                </p>
              </button>

              {/* Option B: Paid Banana */}
              <button
                type="button"
                onClick={() => onChangeConfig({ engine: 'openrouter' })}
                className={cn(
                  'p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2',
                  config.engine === 'openrouter'
                    ? 'border-violet-500 bg-violet-500/10 text-violet-950 dark:text-violet-200 ring-2 ring-violet-500/30'
                    : 'border-theme-border bg-theme-surface hover:border-theme-border-strong'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">✨ คมชัด · Nano Banana</span>
                  {config.engine === 'openrouter' && <Check size={14} className="text-violet-500" />}
                </div>
                <p className="text-[10px] text-theme-text-muted leading-relaxed">
                  เก่ง Infographic + ข้อความไทยเป๊ะ (ใช้ OpenRouter API Key)
                </p>
              </button>
            </div>
            {config.engine === 'openrouter' && !hasApiKey && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-1">
                <Info size={12} /> ยังไม่ได้ใส่ API Key ในระบบ
              </p>
            )}
          </div>

          {/* Aspect Ratio Selector */}
          <div className="space-y-2">
            <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
              2. สัดส่วนภาพ (Aspect Ratio)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ASPECT_RATIO_OPTIONS.map((opt) => {
                const active = config.ratio === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeConfig({ ratio: opt.id })}
                    className={cn(
                      'p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer',
                      active
                        ? 'border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200 ring-1 ring-violet-500/30'
                        : 'border-theme-border bg-theme-surface hover:border-theme-border-strong text-theme-text-secondary'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-[3px] border transition-colors',
                        active ? 'border-violet-500 bg-violet-500/40' : 'border-theme-text-muted/60 bg-transparent'
                      )}
                      style={{ width: opt.frameW, height: opt.frameH }}
                    />
                    <span className="font-bold text-[11px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
              3. สไตล์ภาพ (Style)
            </label>
            <select
              value={config.style}
              onChange={(e) => onChangeConfig({ style: e.target.value })}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {STYLES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            เรียบร้อย
          </button>
        </div>
      </div>
    </div>
  );
};
