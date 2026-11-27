export interface AiModelPresetOption {
  id: string;
  label: string;
}

export const DEFAULT_HR_STANDARD_MODEL = 'anthropic/claude-sonnet-4.5';
export const DEFAULT_UTILITY_MODEL = 'google/gemini-2.5-flash';

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

const OPENROUTER_LIVE_CACHE_KEY = 'worklog_openrouter_live_models_v1';
const OPENROUTER_LIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALLOWED_LIVE_PREFIXES = ['anthropic/', 'google/', 'openai/'] as const;

interface CachedLiveModels {
  fetchedAt: number;
  models: AiModelPresetOption[];
}

interface RawOpenRouterModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  architecture?: {
    output_modalities?: unknown;
  };
}

function formatContextBadge(ctx?: number): string {
  if (!ctx || !Number.isFinite(ctx) || ctx <= 0) return '';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 === 0 ? 0 : 1)}M ctx`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K ctx`;
  return `${ctx} ctx`;
}

function readCachedLiveModels(): AiModelPresetOption[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OPENROUTER_LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedLiveModels>;
    if (
      typeof parsed.fetchedAt === 'number' &&
      Date.now() - parsed.fetchedAt < OPENROUTER_LIVE_CACHE_TTL_MS &&
      Array.isArray(parsed.models)
    ) {
      return parsed.models.filter(
        (m): m is AiModelPresetOption =>
          Boolean(m && typeof m.id === 'string' && typeof m.label === 'string')
      );
    }
  } catch {
    // Ignore corrupt cache
  }
  return null;
}

/**
 * Fetches live production text models from OpenRouter's public registry (24h cached).
 * Filters to major families (Anthropic / Google / OpenAI) and excludes curated duplicates
 * and free/image/audio-only variants. Gracefully returns [] if offline or blocked.
 */
export async function fetchLiveOpenRouterModels(forceRefresh = false): Promise<AiModelPresetOption[]> {
  if (!forceRefresh) {
    const cached = readCachedLiveModels();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: unknown };
    if (!Array.isArray(json.data)) return [];

    const curatedIds = new Set(AI_MODEL_PRESETS.openrouter.map((m) => m.id.toLowerCase()));
    const seen = new Set<string>();
    const results: AiModelPresetOption[] = [];

    for (const item of json.data as RawOpenRouterModel[]) {
      const id = typeof item?.id === 'string' ? item.id.trim() : '';
      if (!id) continue;
      const lowerId = id.toLowerCase();

      if (!ALLOWED_LIVE_PREFIXES.some((prefix) => lowerId.startsWith(prefix))) continue;
      if (curatedIds.has(lowerId) || seen.has(lowerId)) continue;
      if (
        lowerId.includes(':free') ||
        lowerId.includes(':extended') ||
        lowerId.includes('image') ||
        lowerId.includes('audio') ||
        lowerId.includes('tts') ||
        lowerId.includes('whisper') ||
        lowerId.includes('embed') ||
        lowerId.includes('moderation')
      ) {
        continue;
      }

      const outModalities = item.architecture?.output_modalities;
      if (Array.isArray(outModalities) && !outModalities.includes('text')) {
        continue;
      }

      const rawName = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id;
      const cleanName = rawName.replace(/^(Anthropic|Google|OpenAI):\s*/i, '');
      const ctxBadge =
        typeof item.context_length === 'number' ? formatContextBadge(item.context_length) : '';
      const label = ctxBadge ? `${cleanName} (${ctxBadge})` : cleanName;

      seen.add(lowerId);
      results.push({ id, label });
    }

    results.sort((a, b) => a.id.localeCompare(b.id));

    if (typeof localStorage !== 'undefined' && results.length > 0) {
      try {
        const cachePayload: CachedLiveModels = {
          fetchedAt: Date.now(),
          models: results,
        };
        localStorage.setItem(OPENROUTER_LIVE_CACHE_KEY, JSON.stringify(cachePayload));
      } catch {
        // Ignore storage quota errors
      }
    }

    return results;
  } catch (err) {
    console.warn('Failed to fetch live OpenRouter models (using curated fallback):', err);
    return [];
  }
}
