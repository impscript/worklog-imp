export interface AiModelPresetOption {
  id: string;
  label: string;
}

export const DEFAULT_HR_STANDARD_MODEL = 'anthropic/claude-sonnet-4.5';

/**
 * Single Source of Truth for curated, valid AI model presets shared across
 * Admin → AI Settings and AI Half - End Year (AppraisalConfirmModal).
 */
export const AI_MODEL_PRESETS: Record<string, AiModelPresetOption[]> = {
  openrouter: [
    { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 (แนะนำหลัก · ภาษาไทยเป๊ะ & เป็นกลาง)' },
    { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 (วิเคราะห์ลึก & คุมเกณฑ์ HR แม่น)' },
    { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5 (Flagship · เหมาะกับระดับ Manager/Executive)' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Context กว้าง · Worklog จำนวนมาก)' },
    { id: 'google/gemini-4-carbon', label: 'Gemini 4 Carbon (Flagship Long-Context)' },
    { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol (สมดุล · วิเคราะห์เชิงโครงสร้าง)' },
    { id: 'openai/gpt-6.2-astra', label: 'GPT-6.2 Astra (Flagship Reasoning)' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (เร็ว & ประหยัด · สำหรับทดลอง)' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (แนะนำ · Context กว้าง & แม่นยำ)' },
    { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Flagship Long-Context)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (เร็ว & คุ้มค่า)' },
  ],
  openai: [
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (แนะนำ · สมดุล)' },
    { id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra (Flagship Reasoning)' },
    { id: 'gpt-4o', label: 'GPT-4o (Standard)' },
  ],
  opencode: [
    { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash' },
    { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super' },
  ],
  cloudflare: [
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast' },
    { id: '@cf/qwen/qwen2.5-72b-instruct', label: 'Qwen 2.5 72B (แม่นยำ)' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill 32B (Reasoning)' },
  ],
};
