import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Brain,
  Code2,
  Image as ImageIcon,
  Wrench,
  MessagesSquare,
  Palette,
} from 'lucide-react';
import { isRetiredChatModel, DEFAULT_FREE_CHAT_MODEL } from '../lib/chat-files';

export type ModelCategory = 'general' | 'reasoning' | 'web' | 'coding' | 'vision' | 'image_gen' | 'tools';
export type ThinkingLevel = 'low' | 'medium' | 'high';

export interface ModelInfo {
  id: string;
  name: string;
  tier: 'free' | 'paid';
  description: string;
  privacy: string;
  categories: ModelCategory[];
  contextLength?: number;
}

export interface ModelCategoryMeta {
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  chipClass: string;
  badgeClass: string;
}

export interface SmartRouterPreset {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  model: string;
}

export interface OpenRouterRawModel {
  id?: string;
  name?: string;
  description?: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  supported_parameters?: string[];
  reasoning?: boolean;
}

export const MODEL_CATEGORY_META: Record<ModelCategory, ModelCategoryMeta> = {
  reasoning: {
    label: '🧠 วิเคราะห์เชิงลึก / ให้เหตุผล (Reasoning & Deep Think)',
    shortLabel: 'คิดวิเคราะห์',
    Icon: Brain,
    chipClass: 'border-violet-300/80 text-violet-700 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
  },
  coding: {
    label: '💻 เขียนโค้ด / ออกแบบระบบ (Coding & Tech)',
    shortLabel: 'โค้ด & ไอที',
    Icon: Code2,
    chipClass: 'border-blue-300/80 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  },
  vision: {
    label: '👁️ อ่านภาพ / แปลงเอกสาร (Vision & Documents)',
    shortLabel: 'อ่านภาพ/เอกสาร',
    Icon: ImageIcon,
    chipClass: 'border-emerald-300/80 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  image_gen: {
    label: '🎨 สร้างรูปภาพ / โปสเตอร์ (Image Generation)',
    shortLabel: 'สร้างภาพ',
    Icon: Palette,
    chipClass: 'border-pink-300/80 text-pink-700 dark:text-pink-300 bg-pink-500/10 hover:bg-pink-500/20',
    badgeClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  },
  web: {
    label: '🌐 ค้นหาข้อมูลออนไลน์ (Online Web Search)',
    shortLabel: 'ค้นหาเว็บ',
    Icon: Globe,
    chipClass: 'border-cyan-300/80 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  },
  tools: {
    label: '🛠️ การเรียกใช้เครื่องมือ (Tool Use & Agents)',
    shortLabel: 'เครื่องมือ',
    Icon: Wrench,
    chipClass: 'border-amber-300/80 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  general: {
    label: '💬 แชทสนทนาทั่วไป (General Conversation)',
    shortLabel: 'ทั่วไป',
    Icon: MessagesSquare,
    chipClass: 'border-slate-300/80 text-slate-700 dark:text-slate-300 bg-slate-500/10 hover:bg-slate-500/20',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  },
};

export const SMART_PRESETS: SmartRouterPreset[] = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: '🧠 Claude 3.7 Sonnet (ฉลาดรอบด้าน)',
    description: 'สุดยอดโมเดลคิดลึก เขียนโค้ด และเรียบเรียงภาษาไทยเป็นเลิศ',
    bestFor: 'งานสรุปรายงานประจำวัน, เอกสารทางการ, วางแผนกลยุทธ์',
    model: 'anthropic/claude-3.7-sonnet',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: '⚡ Gemini 2.5 Flash (เร็ว & ประหยัด)',
    description: 'โมเดลความเร็วสูง รองรับ Context ยาว และอ่านภาพ/PDF แม่นยำ',
    bestFor: 'การทำงานประจำวันทั่วไป, แนบเอกสารและรูปภาพ',
    model: 'google/gemini-2.5-flash',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: '🔬 DeepSeek R1 (คิดเลข & โค้ดลึกซึ้ง)',
    description: 'โมเดล Open-Weight ที่เก่งการให้เหตุผลระดับท็อปโลก',
    bestFor: 'คณิตศาสตร์, ตรวจสอบข้อผิดพลาดในโค้ด, ตรรกะซับซ้อน',
    model: 'deepseek/deepseek-r1',
  },
  {
    id: 'openai/gpt-4o',
    name: '🌟 GPT-4o (โมเดลเรือธง OpenAI)',
    description: 'ฉลาด สมดุล ตอบสนองรวดเร็ว รองรับงานมัลติมีเดียครบเครื่อง',
    bestFor: 'งานออกแบบ, งานเอกสาร, การคิดเชิงสร้างสรรค์',
    model: 'openai/gpt-4o',
  },
  {
    id: 'openrouter/free',
    name: '🆓 OpenRouter Free Router (ฟรี)',
    description: 'เราเตอร์เลือกโมเดลฟรีที่กำลังออนไลน์ให้อัตโนมัติ',
    bestFor: 'ทดลองใช้งานทั่วไป ไม่เสียเครดิต',
    model: 'openrouter/free',
  },
];

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    tier: 'paid',
    description: 'ฉลาดรอบด้าน สรุปภาษาไทยสละสลวย โค้ดแม่นยำ',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['reasoning', 'coding', 'general', 'vision', 'tools'],
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tier: 'paid',
    description: 'โมเดลความเร็วสูง เก่งทั้งข้อความและรูปภาพ Context ยาว 1M+',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'vision', 'coding', 'tools'],
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tier: 'paid',
    description: 'โมเดลเรือธงของ Google เก่งการคิดเชิงลึกและการวิเคราะห์ข้อมูลปริมาณมาก',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['reasoning', 'coding', 'vision', 'tools', 'general'],
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    tier: 'paid',
    description: 'โมเดล Reasoning ชั้นนำระดับโลก คิดทีละขั้นตอนอย่างละเอียด',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['reasoning', 'coding'],
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    tier: 'paid',
    description: 'โมเดลแชทความเร็วสูง คุ้มค่าที่สุดสำหรับงานประจำวัน',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'coding', 'tools'],
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    tier: 'paid',
    description: 'โมเดลเรือธงของ OpenAI ฉลาดรอบด้าน ตอบโต้รวดเร็วและแม่นยำ',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'coding', 'vision', 'tools'],
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    tier: 'paid',
    description: 'โมเดลขนาดเล็กที่เร็วและประหยัด เหมาะสำหรับงานสรุปข้อมูลสั้นๆ',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'vision'],
  },
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    tier: 'free',
    description: 'เราเตอร์เลือกโมเดลฟรีที่ออนไลน์อัตโนมัติ ไม่เสียค่าใช้จ่าย',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ',
    categories: ['general'],
  },
];

export const DEFAULT_FAVORITE_MODEL_IDS = [
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-r1',
  'openai/gpt-4o',
  'openrouter/free',
];

export function categorizeOpenRouterModel(raw: OpenRouterRawModel): ModelCategory[] {
  const id = (raw.id || '').toLowerCase();
  const name = (raw.name || '').toLowerCase();
  const desc = (raw.description || '').toLowerCase();
  const blob = `${id} ${name} ${desc}`;
  const inputs = raw.architecture?.input_modalities || [];
  const outputs = raw.architecture?.output_modalities || [];
  const params = raw.supported_parameters || [];
  const cats = new Set<ModelCategory>();

  if (
    id.startsWith('perplexity/') ||
    id.includes(':online') ||
    id.includes('/online') ||
    /\bsonar\b/.test(blob) ||
    (desc.includes('search') && (desc.includes('web') || desc.includes('internet') || desc.includes('real-time') || desc.includes('realtime')))
  ) {
    cats.add('web');
  }

  if (outputs.includes('image') || /flux|dall-e|dalle|stable-diffusion|sdxl|imagen|midjourney|image.generat|text-to-image|t2i/.test(blob)) {
    cats.add('image_gen');
  }

  if (
    inputs.some((m: string) => m === 'image' || m === 'file' || m === 'video' || m === 'audio') ||
    (raw.architecture?.modality || '').includes('image') ||
    /\b(vision|multimodal|vl\b|vlm)\b/.test(blob)
  ) {
    cats.add('vision');
  }

  if (
    raw.reasoning ||
    params.includes('reasoning') ||
    params.includes('include_reasoning') ||
    params.includes('reasoning_effort') ||
    /\b(reason|reasoning|think|o1\b|o3\b|o4\b|r1\b|deep.?research|agentic|analysis)\b/.test(blob)
  ) {
    cats.add('reasoning');
  }

  if (/\b(code|coder|coding|codestral|devstral|codellama|deepseek-coder|qwen.?coder|starcoder|programming)\b/.test(blob)) {
    cats.add('coding');
  }

  if (params.includes('tools') || params.includes('tool_choice') || /\b(agent|function.?call|tool.?use)\b/.test(blob)) {
    cats.add('tools');
  }

  if (!cats.has('image_gen') || outputs.includes('text') || outputs.length === 0) {
    cats.add('general');
  }

  return Array.from(cats);
}

export function mapOpenRouterModel(m: OpenRouterRawModel): ModelInfo {
  const promptPrice = parseFloat(m.pricing?.prompt || '0') * 1000000;
  const isFree = promptPrice === 0 || String(m.id || '').endsWith(':free');
  const categories = categorizeOpenRouterModel(m);
  const ctxK = m.context_length ? (m.context_length / 1000).toFixed(0) : '?';
  const isGuardrail = /guardrail|content-safety|moderation|embedding|rerank|tts|stt|whisper/i.test(m.id || '');

  return {
    id: m.id || '',
    name: m.name || m.id || '',
    tier: isFree ? 'free' : 'paid',
    description: isGuardrail
      ? `⚠️ โมเดลกรองเนื้อหา/Moderation`
      : `${m.description || ''} (Context: ${ctxK}k)`,
    privacy: isFree
      ? '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
      : '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories,
    contextLength: m.context_length,
  };
}

export function useOpenRouterModels(showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void) {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const stored = localStorage.getItem('openrouter_chat_model') || AVAILABLE_MODELS[0].id;
    if (isRetiredChatModel(stored)) {
      localStorage.setItem('openrouter_chat_model', DEFAULT_FREE_CHAT_MODEL);
      return DEFAULT_FREE_CHAT_MODEL;
    }
    return stored;
  });

  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(() => {
    return (localStorage.getItem('openrouter_thinking_level') as ThinkingLevel) || 'medium';
  });

  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('openrouter_favorite_models');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_FAVORITE_MODEL_IDS;
  });

  // Fetch all live models dynamically from OpenRouter
  const fetchOpenRouterModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          setFetchedModels(json.data.map(mapOpenRouterModel));
        }
      }
    } catch (err) {
      console.error('Failed to fetch models from OpenRouter:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        if (res.ok && !ignore) {
          const json = await res.json();
          if (json && Array.isArray(json.data)) {
            setFetchedModels(json.data.map(mapOpenRouterModel));
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const toggleFavoriteModel = useCallback(
    (modelId: string) => {
      setFavoriteModelIds((prev) => {
        const exists = prev.includes(modelId);
        const next = exists ? prev.filter((id) => id !== modelId) : [...prev, modelId];
        localStorage.setItem('openrouter_favorite_models', JSON.stringify(next));
        showToast?.(
          exists ? `นำ ${modelId} ออกจากรายการโปรดแล้ว` : `เพิ่ม ${modelId} เป็นโมเดลโปรดเรียบร้อย ⭐`,
          'info'
        );
        return next;
      });
    },
    [showToast]
  );

  const handleSelectModel = useCallback(
    (modelId: string) => {
      let nextModel = modelId;
      if (isRetiredChatModel(nextModel)) {
        showToast?.(`โมเดล ${nextModel} ถูกยกเลิกแล้ว สลับไปใช้โมเดลฟรีที่เสถียรแทน`, 'warning');
        nextModel = DEFAULT_FREE_CHAT_MODEL;
      }
      setSelectedModel(nextModel);
      localStorage.setItem('openrouter_chat_model', nextModel);
    },
    [showToast]
  );

  const handleChangeThinkingLevel = useCallback((lvl: ThinkingLevel) => {
    setThinkingLevel(lvl);
    localStorage.setItem('openrouter_thinking_level', lvl);
  }, []);

  // Combined models list (static + fetched)
  const allModelsMap = useMemo(() => {
    const map = new Map<string, ModelInfo>();
    AVAILABLE_MODELS.forEach((m) => map.set(m.id, m));
    fetchedModels.forEach((m) => map.set(m.id, m));
    return map;
  }, [fetchedModels]);

  const favoriteModelsList = useMemo(() => {
    return favoriteModelIds
      .map((id) => allModelsMap.get(id) || {
        id,
        name: id.split('/').pop() || id,
        tier: (id.endsWith(':free') || id === 'openrouter/free' ? 'free' : 'paid') as 'free' | 'paid',
        description: 'โมเดลที่บันทึกไว้ในรายการโปรด',
        privacy: id.endsWith(':free') ? '⚠️ ข้อมูลทั่วไป' : '🔒 ปลอดภัยสูงสุด',
        categories: ['general'] as ModelCategory[],
      });
  }, [favoriteModelIds, allModelsMap]);

  const activeModelInfo: ModelInfo = useMemo(() => {
    return (
      allModelsMap.get(selectedModel) || {
        id: selectedModel,
        name: selectedModel.split('/').pop() || selectedModel,
        tier: (selectedModel.endsWith(':free') || selectedModel === 'openrouter/free' ? 'free' : 'paid') as 'free' | 'paid',
        description: 'โมเดลที่กำลังเลือกใช้งาน',
        privacy: selectedModel.endsWith(':free') ? '⚠️ ข้อมูลทั่วไป' : '🔒 ปลอดภัยสูงสุด',
        categories: ['general'] as ModelCategory[],
      }
    );
  }, [selectedModel, allModelsMap]);

  return {
    selectedModel,
    setSelectedModel: handleSelectModel,
    thinkingLevel,
    setThinkingLevel: handleChangeThinkingLevel,
    fetchedModels,
    isLoadingModels,
    refreshModels: fetchOpenRouterModels,
    favoriteModelIds,
    favoriteModelsList,
    toggleFavoriteModel,
    activeModelInfo,
    allModelsMap,
  };
}
