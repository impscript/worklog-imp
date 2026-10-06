import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  User, 
  Cpu, 
  Calendar, 
  FileText, 
  Layers, 
  CheckCircle2, 
  Clock,
  Briefcase,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ModalPortal from './ModalPortal';

export interface AvailableProviderItem {
  id: string;
  label: string;
  isConfigured: boolean;
}

export interface AppraisalConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: {
    provider: string;
    model: string;
    supervisorNotes: string;
  }) => void;
  isLoading?: boolean;
  evaluatedUser: {
    id: string;
    full_name?: string;
    emp_id?: string;
    position?: string;
    department?: string;
    avatar_url?: string;
  } | null;
  candidateJd?: {
    id?: string;
    jd_text?: string;
    position_name?: string;
    key_responsibilities?: Record<string, unknown>[];
  } | null;
  isManagerEvaluated: boolean;
  selectedCycle: 'half_year' | 'end_year';
  dateRange: { start: string; end: string };
  candidateLogsCount: number;
  uniqueLoggedDays: number;
  businessDays: number;
  holidayCountInPeriod: number;
  loggingCoveragePct: number;
  systemProvider: string;
  systemModel: string;
  availableProviders: AvailableProviderItem[];
  presetModels?: Record<string, { id: string; label: string }[]>;
}

const DEFAULT_APPRAISAL_PRESET_MODELS: Record<string, { id: string; label: string }[]> = {
  gemini: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (ฉลาดลึกซึ้ง · แม่นยำสูงสุด)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (เร็ว & คุณภาพสูง)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (แนะนำ · เสถียร)' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Next-Gen Preview)' },
    { id: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking (วิเคราะห์เชิงลึก)' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (บริบท 2M)' },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet (Hybrid Reasoning · ล่าสุด)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (ฉลาดที่สุด · ยอดนิยม)' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (Next-Gen Preview)' },
    { id: 'openai/gpt-5', label: 'GPT-5 (Next-Gen Preview)' },
    { id: 'openai/gpt-4.5-preview', label: 'GPT-4.5 Preview (Orion · ลึกซึ้ง)' },
    { id: 'openai/o3-mini', label: 'OpenAI o3-mini (Reasoning Model ความเร็วสูง)' },
    { id: 'openai/gpt-4o', label: 'GPT-4o (เต็มประสิทธิภาพ)' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (คุ้มค่า · สมดุล)' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (ฉลาดวิเคราะห์)' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (เร็ว & คุณภาพสูง)' },
    { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash (Next-Gen Preview)' },
    { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'google/gemini-2.0-flash:free', label: 'Gemini 2.0 Flash (Free ใช้งานฟรี)' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (Reasoning ชั้นนำ)' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (ประหยัด)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
  ],
  openai: [
    { id: 'gpt-5', label: 'GPT-5 (Next-Gen Preview)' },
    { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
    { id: 'o3-mini', label: 'o3-mini (Reasoning Model แนะนำ)' },
    { id: 'gpt-4o', label: 'GPT-4o (เต็มประสิทธิภาพ)' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (คุ้มค่า)' },
  ],
  opencode: [
    { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free' },
    { id: 'gemini-3.8-flash-free', label: 'Gemini 3.8 Flash Free (Next-Gen)' },
    { id: 'claude-sonnet-5-preview', label: 'Claude Sonnet 5 Preview' },
    { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free' },
    { id: 'big-pickle', label: 'Big Pickle' },
  ],
  cloudflare: [
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast (Free)' },
    { id: '@cf/qwen/qwen2.5-72b-instruct', label: 'Qwen 2.5 72B (แม่นยำ)' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill 32B (Reasoning)' },
    { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (เร็ว)' },
    { id: '@cf/google/gemma-7b-it', label: 'Gemma 7B (Free)' },
  ],
};

const AppraisalConfirmModalContent: React.FC<Omit<AppraisalConfirmModalProps, 'isOpen'>> = ({
  onClose,
  onConfirm,
  isLoading = false,
  evaluatedUser,
  candidateJd,
  isManagerEvaluated,
  selectedCycle,
  dateRange,
  candidateLogsCount,
  uniqueLoggedDays,
  businessDays,
  holidayCountInPeriod,
  loggingCoveragePct,
  systemProvider,
  systemModel,
  availableProviders,
  presetModels = DEFAULT_APPRAISAL_PRESET_MODELS,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(systemProvider || 'openrouter');
  const [selectedModel, setSelectedModel] = useState<string>(systemModel || 'google/gemini-2.0-flash:free');
  const [isCustomModelInput, setIsCustomModelInput] = useState<boolean>(false);
  const [isJdExpanded, setIsJdExpanded] = useState<boolean>(true);
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');

  // When provider changes, select the first preset model for that provider if current model doesn't match
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    const presets = presetModels[newProvider] || [];
    if (presets.length > 0 && !presets.some((m) => m.id === selectedModel)) {
      setSelectedModel(presets[0].id);
    }
  };

  const currentPresets = presetModels[selectedProvider] || [];

  // Coverage health style
  const getHealthBadge = () => {
    if (loggingCoveragePct >= 80) {
      return {
        label: 'หลักฐานสมบูรณ์มาก (>=80%)',
        color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50',
        barColor: 'bg-emerald-500',
        tip: 'ความสม่ำเสมอของบันทึกงานอยู่ในเกณฑ์ดีเยี่ยม หลักฐานมีความน่าเชื่อถือสูงสำหรับ AI',
      };
    }
    if (loggingCoveragePct >= 60) {
      return {
        label: 'หลักฐานปานกลาง (60-79%)',
        color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50',
        barColor: 'bg-amber-500',
        tip: 'ข้อมูลมีความครอบคลุมปานกลาง หากมีผลงานเด่นนอกระบบสามารถระบุเสริมในช่องด้านล่างได้',
      };
    }
    return {
      label: 'บันทึกงานไม่ต่อเนื่อง (<60%)',
      color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50',
      barColor: 'bg-rose-500',
      tip: 'พนักงานลงบันทึกงานไม่ต่อเนื่อง แนะนำให้หัวหน้างานระบุผลงานเด่น/Milestones ในกล่องด้านล่าง เพื่อป้องกันไม่ให้คะแนนประเมินต่ำกว่าความเป็นจริง',
    };
  };

  const health = getHealthBadge();

  const handleStart = () => {
    onConfirm({
      provider: selectedProvider,
      model: selectedModel,
      supervisorNotes: supervisorNotes.trim(),
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div className="w-full max-w-2xl my-auto rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden text-slate-900 dark:text-white animate-scale-in transition-all">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-transparent dark:from-indigo-950/30 dark:via-purple-950/15 dark:to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                      เตรียมพร้อมประเมินผลงานด้วย AI
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                      {selectedCycle === 'half_year' ? 'Half-Year' : 'End-Year'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-500" />
                    <span>ช่วงเวลา: {dateRange.start} ถึง {dateRange.end}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* 1. Target Employee Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-base border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {evaluatedUser?.avatar_url ? (
                    <img
                      src={evaluatedUser.avatar_url}
                      alt={evaluatedUser.full_name || 'Employee'}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    <User size={22} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {evaluatedUser?.full_name || 'ไม่ระบุชื่อ'}
                    </span>
                    {evaluatedUser?.emp_id && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                        {evaluatedUser.emp_id}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {evaluatedUser?.position || 'ตำแหน่งงานทั่วไป'} • {evaluatedUser?.department || 'ฝ่ายงาน'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200/80 dark:border-purple-800/50">
                <Layers size={14} />
                <span>
                  {isManagerEvaluated
                    ? 'ระดับผู้จัดการ (half-year-manager.md)'
                    : 'ระดับปฏิบัติการ (half-year-officer.md)'}
                </span>
              </div>
            </div>

            {/* 1.5 Job Description (JD) Review Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-850 border border-indigo-100/90 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    ขอบเขตหน้าที่ความรับผิดชอบ (Job Description - JD)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                      candidateJd?.jd_text
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                    }`}
                  >
                    {candidateJd?.jd_text ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    {candidateJd?.jd_text ? 'พบเอกสาร JD ในระบบ' : 'อ้างอิงตำแหน่งมาตรฐาน'}
                  </span>
                  {candidateJd?.jd_text && (
                    <button
                      type="button"
                      onClick={() => setIsJdExpanded(!isJdExpanded)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer ml-1"
                    >
                      <span>{isJdExpanded ? 'ย่อ' : 'ดู JD'}</span>
                      {isJdExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Position Header & Responsibilities Count */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">ตำแหน่งงาน: </span>
                  <strong className="text-indigo-700 dark:text-indigo-300 font-semibold">
                    {candidateJd?.position_name || evaluatedUser?.position || 'ตำแหน่งงานทั่วไป'}
                  </strong>
                </div>
                {candidateJd?.key_responsibilities && candidateJd.key_responsibilities.length > 0 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    ({candidateJd.key_responsibilities.length} หมวดภารกิจ)
                  </span>
                )}
              </div>

              {/* Responsibilities Chips */}
              {candidateJd?.key_responsibilities && candidateJd.key_responsibilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {candidateJd.key_responsibilities.map((resp, i) => {
                    const category = (resp as { category?: string }).category || `หมวดที่ ${i + 1}`;
                    const weight = (resp as { weight?: number; weight_percentage?: number }).weight ?? (resp as { weight?: number; weight_percentage?: number }).weight_percentage;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                      >
                        <span>{category}</span>
                        {weight != null && (
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {weight}%
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* JD Text Display (Scrollable review area) */}
              {candidateJd?.jd_text ? (
                isJdExpanded && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span>เนื้อหา Job Description ที่ใช้เป็นเกณฑ์เปรียบเทียบ:</span>
                      <span className="font-mono text-[10px]">{candidateJd.jd_text.length.toLocaleString()} ตัวอักษร</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto custom-scrollbar text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-sans pr-1">
                      {candidateJd.jd_text}
                    </div>
                  </div>
                )
              ) : (
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-0.5 leading-relaxed">
                    <div className="font-bold text-[11px]">ยังไม่พบเอกสาร JD เฉพาะบุคคลในระบบ</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      ระบบจะวิเคราะห์จากกิจกรรมในบันทึกจริง (Worklog) ควบคู่กับกรอบมาตรฐานตำแหน่ง <strong>{evaluatedUser?.position || 'Officer'}</strong> ({isManagerEvaluated ? 'half-year-manager.md' : 'half-year-officer.md'}) โดยอัตโนมัติ
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Evidence Health & Readiness Meter */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    ความพร้อมของหลักฐาน (Evidence Health)
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${health.color}`}>
                  {loggingCoveragePct >= 80 ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {health.label}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-200 dark:bg-slate-700/70 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${health.barColor} transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(5, loggingCoveragePct))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    บันทึกงานจริง: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{candidateLogsCount} งาน</strong>
                  </span>
                  <span>
                    ลงงานแล้ว: <strong className="text-slate-800 dark:text-slate-200 font-mono">{uniqueLoggedDays}/{businessDays} วันทำการ</strong>
                    {holidayCountInPeriod > 0 ? ` (หักวันหยุด ${holidayCountInPeriod} วัน)` : ''}
                  </span>
                  <span>
                    ความสม่ำเสมอ: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{loggingCoveragePct}%</strong>
                  </span>
                </div>
              </div>

              {/* Tip / Advisory notice */}
              <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                💡 {health.tip}
              </p>
            </div>

            {/* 3. AI Engine Configuration (Run-time Switcher) */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    เครื่องมือ AI ที่ใช้ประมวลผล (AI Engine)
                  </span>
                </div>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  สลับได้เฉพาะรอบนี้ (Run-time)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Provider Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    AI Provider (ผู้ให้บริการ)
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.isConfigured}>
                        {p.label} {p.isConfigured ? '✓ (พร้อมใช้งาน)' : '✕ (ยังไม่ได้ใส่ Key)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      AI Model (โมเดล)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                    >
                      {isCustomModelInput ? 'เลือกจาก Preset' : 'พิมพ์ Model เอง'}
                    </button>
                  </div>
                  {isCustomModelInput ? (
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isLoading}
                      placeholder="เช่น google/gemini-3.8-flash, anthropic/claude-sonnet-5"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  ) : (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                    >
                      {currentPresets.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                      {!currentPresets.some((m) => m.id === selectedModel) && (
                        <option value={selectedModel}>
                          {selectedModel} (กำหนดเอง)
                        </option>
                      )}
                    </select>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                ℹ️ การเปลี่ยน Provider หรือ Model ในหน้านี้จะใช้เฉพาะการวิเคราะห์ครั้งนี้เท่านั้น โดยไม่กระทบค่าเริ่มต้นของระบบส่วนกลาง
              </p>
            </div>

            {/* 4. Supervisor Focus & Offline Milestones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>ข้อคิดเห็น & ผลงานเสริมนอกระบบจากหัวหน้างาน</span>
                  <span className="text-[10px] font-normal text-slate-400">(ทางเลือก / ไม่บังคับ)</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {supervisorNotes.length}/1000 ตัวอักษร
                </span>
              </div>
              <textarea
                value={supervisorNotes}
                onChange={(e) => setSupervisorNotes(e.target.value.slice(0, 1000))}
                disabled={isLoading}
                rows={3}
                placeholder="เช่น พนักงานช่วยผลักดันโปรเจกต์ส่งมอบก่อนกำหนด 2 สัปดาห์, ช่วยเทรนนิ่งน้องใหม่ 2 ท่าน, หรือมีผลงานพิเศษนอกเหนือจากบันทึกงาน..."
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ข้อความนี้จะถูกส่งให้ AI นำไปประกอบการพิจารณาคะแนน 5 มิติ และจะถูกบันทึกแสดงในรายงานประเมินทางการ (Official HR Report)
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading || candidateLogsCount === 0}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-md hover:shadow-indigo-500/25 transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังเริ่มต้น...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>ยืนยันและเริ่มประเมินด้วย AI ทันที</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export const AppraisalConfirmModal: React.FC<AppraisalConfirmModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <AppraisalConfirmModalContent
      key={`${props.isOpen}-${props.systemProvider}-${props.systemModel}`}
      {...props}
    />
  );
};

export default AppraisalConfirmModal;
