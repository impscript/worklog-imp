import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Trash2, Plus, Sparkles, Key, Eye, EyeOff, 
  Shield, Cpu, AlertTriangle, RefreshCw, MessageSquare, Info, ShieldAlert, Trash, Globe, Palette, Copy, X,
  Brain, Code2, Image as ImageIcon, Wrench, MessagesSquare
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useNotification } from '../context/NotificationContext';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string; // Stores the actual model that served the response
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

/** What a model is best suited for — used as filter chips in the model picker */
type ModelCategory = 'general' | 'reasoning' | 'web' | 'coding' | 'vision' | 'image_gen' | 'tools';

interface ModelInfo {
  id: string;
  name: string;
  tier: 'free' | 'paid';
  description: string;
  privacy: string;
  categories: ModelCategory[];
}

const MODEL_CATEGORY_META: Record<ModelCategory, {
  label: string;
  shortLabel: string;
  hint: string;
  chipClass: string;
  badgeClass: string;
  Icon: typeof Globe;
}> = {
  general: {
    label: 'ถามตอบทั่วไป',
    shortLabel: 'ทั่วไป',
    hint: 'คุย เขียนข้อความ สรุปงานประจำวัน',
    chipClass: 'border-slate-300/80 text-slate-600 dark:text-slate-300 data-[active=true]:bg-slate-500/15 data-[active=true]:border-slate-400 data-[active=true]:text-slate-800 dark:data-[active=true]:text-slate-100',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
    Icon: MessagesSquare,
  },
  reasoning: {
    label: 'วิเคราะห์ / ใช้เหตุผล',
    shortLabel: 'วิเคราะห์',
    hint: 'คิดวิเคราะห์ วางแผน งานซับซ้อนหลายขั้น',
    chipClass: 'border-violet-300/80 text-violet-600 dark:text-violet-300 data-[active=true]:bg-violet-500/15 data-[active=true]:border-violet-400 data-[active=true]:text-violet-800 dark:data-[active=true]:text-violet-100',
    badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/25',
    Icon: Brain,
  },
  web: {
    label: 'ค้นหาเว็บ',
    shortLabel: 'ค้นหาเว็บ',
    hint: 'ข่าวล่าสุด / ข้อมูลเรียลไทม์จากอินเทอร์เน็ต (เช่น Perplexity)',
    chipClass: 'border-indigo-300/80 text-indigo-600 dark:text-indigo-300 data-[active=true]:bg-indigo-500/15 data-[active=true]:border-indigo-400 data-[active=true]:text-indigo-800 dark:data-[active=true]:text-indigo-100',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25',
    Icon: Globe,
  },
  coding: {
    label: 'เขียนโค้ด',
    shortLabel: 'โค้ด',
    hint: 'เขียน แก้บั๊ก อธิบายโค้ด / SQL',
    chipClass: 'border-amber-300/80 text-amber-700 dark:text-amber-300 data-[active=true]:bg-amber-500/15 data-[active=true]:border-amber-400 data-[active=true]:text-amber-900 dark:data-[active=true]:text-amber-100',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    Icon: Code2,
  },
  vision: {
    label: 'อ่านรูป / มัลติมีเดีย',
    shortLabel: 'รูปภาพ',
    hint: 'รับรูปภาพ PDF วิดีโอ หรือไฟล์เป็นอินพุต',
    chipClass: 'border-cyan-300/80 text-cyan-700 dark:text-cyan-300 data-[active=true]:bg-cyan-500/15 data-[active=true]:border-cyan-400 data-[active=true]:text-cyan-900 dark:data-[active=true]:text-cyan-100',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
    Icon: ImageIcon,
  },
  image_gen: {
    label: 'สร้างรูป',
    shortLabel: 'สร้างรูป',
    hint: 'โมเดลที่สร้างภาพเป็นเอาต์พุต',
    chipClass: 'border-pink-300/80 text-pink-600 dark:text-pink-300 data-[active=true]:bg-pink-500/15 data-[active=true]:border-pink-400 data-[active=true]:text-pink-800 dark:data-[active=true]:text-pink-100',
    badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-300 border-pink-500/25',
    Icon: Palette,
  },
  tools: {
    label: 'Tools / Agent',
    shortLabel: 'Tools',
    hint: 'รองรับ function calling / agentic workflow',
    chipClass: 'border-emerald-300/80 text-emerald-700 dark:text-emerald-300 data-[active=true]:bg-emerald-500/15 data-[active=true]:border-emerald-400 data-[active=true]:text-emerald-900 dark:data-[active=true]:text-emerald-100',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    Icon: Wrench,
  },
};

/** Infer use-case tags from OpenRouter model payload + id/name heuristics */
function categorizeOpenRouterModel(raw: {
  id?: string;
  name?: string;
  description?: string;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  reasoning?: unknown;
  pricing?: Record<string, string>;
}): ModelCategory[] {
  const id = (raw.id || '').toLowerCase();
  const name = (raw.name || '').toLowerCase();
  const desc = (raw.description || '').toLowerCase();
  const blob = `${id} ${name} ${desc}`;
  const inputs = raw.architecture?.input_modalities || [];
  const outputs = raw.architecture?.output_modalities || [];
  const params = raw.supported_parameters || [];
  const cats = new Set<ModelCategory>();

  // Native web / live search models (Perplexity Sonar family, :online variants)
  const isWebNative =
    id.startsWith('perplexity/') ||
    id.includes(':online') ||
    id.includes('/online') ||
    /\bsonar\b/.test(blob) ||
    (desc.includes('search') && (desc.includes('web') || desc.includes('internet') || desc.includes('real-time') || desc.includes('realtime') || id.includes('perplexity')));

  if (isWebNative) cats.add('web');

  // Image generation (output is image)
  if (outputs.includes('image') || /flux|dall-e|dalle|stable-diffusion|sdxl|imagen|midjourney|image.generat|text-to-image|t2i/.test(blob)) {
    cats.add('image_gen');
  }

  // Vision / multimodal input
  if (
    inputs.some(m => m === 'image' || m === 'file' || m === 'video' || m === 'audio') ||
    (raw.architecture?.modality || '').includes('image') ||
    /\b(vision|multimodal|vl\b|vlm)\b/.test(blob)
  ) {
    cats.add('vision');
  }

  // Reasoning / analysis
  if (
    raw.reasoning ||
    params.includes('reasoning') ||
    params.includes('include_reasoning') ||
    params.includes('reasoning_effort') ||
    /\b(reason|reasoning|think|o1\b|o3\b|o4\b|r1\b|deep.?research|agentic|analysis)\b/.test(blob)
  ) {
    cats.add('reasoning');
  }

  // Coding-focused
  if (/\b(code|coder|coding|codestral|devstral|codellama|deepseek-coder|qwen.?coder|starcoder|programming)\b/.test(blob)) {
    cats.add('coding');
  }

  // Tool / agent support
  if (params.includes('tools') || params.includes('tool_choice') || /\b(agent|function.?call|tool.?use)\b/.test(blob)) {
    cats.add('tools');
  }

  // Always tag pure chat models as general when they output text and aren't image-only generators
  if (!cats.has('image_gen') || outputs.includes('text') || outputs.length === 0) {
    cats.add('general');
  }

  // Strong coding signal for well-known general models that excel at code
  if (/\b(claude|gpt-4|gpt-5|gemini|deepseek|qwen|llama|opus|sonnet|codex)\b/.test(blob) && !cats.has('coding') && cats.has('general')) {
    // keep as general; don't over-tag every flagship as coding
  }

  return Array.from(cats);
}

function mapOpenRouterModel(m: any): ModelInfo {
  const promptPrice = parseFloat(m.pricing?.prompt || '0') * 1000000;
  const isFree = promptPrice === 0 || String(m.id || '').endsWith(':free');
  const categories = categorizeOpenRouterModel(m);
  const ctxK = m.context_length ? (m.context_length / 1000).toFixed(0) : '?';
  return {
    id: m.id,
    name: m.name || m.id,
    tier: isFree ? 'free' : 'paid',
    description: `${m.description || ''} (Context: ${ctxK}k)`,
    privacy: isFree
      ? '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
      : '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories,
  };
}

const AVAILABLE_MODELS: ModelInfo[] = [
  // Paid Tier (Recommended for Business/Sensitive Data)
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5 (Paid)',
    tier: 'paid',
    description: 'โมเดลที่ดีที่สุดในปัจจุบันด้านงานวิเคราะห์ เขียนโค้ด และใช้เหตุผลเชิงลึกระดับสูงสุด',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'reasoning', 'coding', 'tools'],
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (Paid)',
    tier: 'paid',
    description: 'โมเดลยอดนิยมด้านการวิเคราะห์ เขียนโค้ด และใช้เหตุผลเชิงลึก',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'reasoning', 'coding', 'tools'],
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (Paid)',
    tier: 'paid',
    description: 'โมเดลความเร็วสูง หน้าต่างบริบทใหญ่พิเศษ เหมาะสำหรับการประมวลผลเอกสารหรือเนื้อหายาวๆ',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Gemini 3.5 Flash (Paid)',
    tier: 'paid',
    description: 'โมเดลตระกูล Gemini ล่าสุด ความเร็วสูงพิเศษ เหมาะกับงานทั่วไปและการประมวลผลเร็ว',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'vision', 'tools'],
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Paid)',
    tier: 'paid',
    description: 'โมเดลประสิทธิภาพสูงรอบด้านจาก OpenAI ฉลาดและตอบคำถามภาษาไทยได้ดี',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'coding', 'vision', 'tools'],
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (Paid)',
    tier: 'paid',
    description: 'โมเดลขนาดเล็ก ทำงานเร็วมาก และราคาประหยัดอย่างคุ้มค่าจาก OpenAI',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'vision', 'tools'],
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash (Paid)',
    tier: 'paid',
    description: '⚡ โมเดล MoE สถาปัตยกรรมล่าสุด ความเร็วสูงเป็นพิเศษระดับ 284B จาก DeepSeek',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
    categories: ['general', 'coding', 'reasoning', 'tools'],
  },
  {
    id: 'perplexity/sonar',
    name: 'Perplexity Sonar Search (Paid)',
    tier: 'paid',
    description: '🌐 โมเดลพร้อมทักษะค้นหาเว็บเรียลไทม์ เหมาะสำหรับการสรุปข่าวสารล่าสุดในอินเทอร์เน็ต',
    privacy: '🔒 ปลอดภัย: มีนโยบายรักษาความเป็นส่วนตัวในการเข้าถึงข้อมูลผ่าน API',
    categories: ['web', 'general'],
  },
  {
    id: 'perplexity/sonar-reasoning',
    name: 'Perplexity Sonar Reasoning (Paid)',
    tier: 'paid',
    description: '🧠 โมเดลค้นหาข้อมูลอินเทอร์เน็ตเชิงลึก พร้อมการคิดวิเคราะห์หลายขั้นตอนก่อนตอบคำถาม',
    privacy: '🔒 ปลอดภัย: มีนโยบายรักษาความเป็นส่วนตัวในการเข้าถึงข้อมูลผ่าน API',
    categories: ['web', 'reasoning', 'general'],
  },
  // Free Tier (For standard queries/non-sensitive data)
  {
    id: 'openrouter/free',
    name: 'Auto Free Router (Free - แนะนำ)',
    tier: 'free',
    description: 'สลับเลือกโมเดลใช้งานฟรีที่เปิดให้บริการอยู่แบบอัตโนมัติ แก้ปัญหาโมเดลปลายทางออฟไลน์',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ',
    categories: ['general'],
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Free)',
    tier: 'free',
    description: 'โมเดลรุ่นทดลองรวดเร็วจาก Google ตอบสนองคำสั่งแบบกระชับฉับไว',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ',
    categories: ['general', 'vision'],
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    tier: 'free',
    description: 'โมเดลประสิทธิภาพสูงระดับ 70B ล่าสุดจาก Meta ตอบสนองรวดเร็วเป็นธรรมชาติ',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ',
    categories: ['general'],
  }
];

const QUICK_PROMPTS = [
  { label: '🎨 วาดภาพอนาคตของกรุงเทพฯ', text: 'A futuristic hyper-detailed digital art of Bangkok with flying vehicles, glowing signs, and green skyscrapers, cinematic lighting, 8k', isDrawPrompt: true },
  { label: '📰 สรุปข่าวเทคโนโลยีล่าสุด', text: 'ช่วยค้นหาข้อมูลและสรุปข่าวสารล่าสุดเกี่ยวกับเทคโนโลยี AI ในรอบสัปดาห์นี้ให้หน่อย' },
  { label: '📝 สรุปงานประจำวัน', text: 'ช่วยสรุปรายงานการทำงานประจำวันของฉันให้เป็นข้อๆ อย่างเป็นระเบียบตามข้อมูลนี้: [พิมพ์ประเด็นงานที่นี่]' },
  { label: '✉️ เขียนอีเมลลาหยุดสุภาพ', text: 'ช่วยเขียนอีเมลสำหรับส่งแจ้งผู้บริหารเพื่อขอลาหยุดพักผ่อน 1 วันเป็นภาษาไทยอย่างสุภาพเป็นทางการหน่อย' }
];

/** Image generation intent — drives model recommendation + prompt style */
type DrawIntent = 'illustration' | 'infographic' | 'thai_text';

type ImageTextQuality = 'excellent' | 'good' | 'weak';

interface ImageModelPreset {
  id: string;
  name: string;
  shortName: string;
  /** free = CF/quota, budget = cheap paid, quality = best output */
  cost: 'free' | 'budget' | 'quality';
  textQuality: ImageTextQuality;
  bestFor: DrawIntent[];
  badge: string;
  hint: string;
  supportsAspectRatio: boolean;
  /** When true, keep Thai labels in the image prompt (do not force EN-only) */
  keepThaiInPrompt: boolean;
}

/**
 * Curated OpenRouter image models — order = recommendation priority within a cost band.
 * Nano Banana = Gemini image family (strong layout + text). GPT Image = high visual polish.
 */
const IMAGE_MODEL_PRESETS: ImageModelPreset[] = [
  {
    id: 'google/gemini-3.1-flash-image',
    name: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    shortName: 'Nano Banana 2',
    cost: 'budget',
    textQuality: 'excellent',
    bestFor: ['infographic', 'thai_text', 'illustration'],
    badge: '⭐ แนะนำ Infographic / ไทย',
    hint: 'เก่งจัด layout + ตัวอักษร (รวมไทย) เร็ว ราคาคุ้ม — default งานโปสเตอร์/อินโฟ',
    supportsAspectRatio: true,
    keepThaiInPrompt: true,
  },
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Nano Banana (Gemini 2.5 Flash Image)',
    shortName: 'Nano Banana',
    cost: 'budget',
    textQuality: 'excellent',
    bestFor: ['infographic', 'thai_text', 'illustration'],
    badge: 'ข้อความไทยดี',
    hint: 'รุ่นคลาสสิกของ Nano Banana — คุยบริบท + วาด/แก้รูปได้',
    supportsAspectRatio: true,
    keepThaiInPrompt: true,
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Nano Banana Pro (Gemini 3 Pro Image)',
    shortName: 'Nano Banana Pro',
    cost: 'quality',
    textQuality: 'excellent',
    bestFor: ['infographic', 'thai_text', 'illustration'],
    badge: 'คุณภาพสูงสุด',
    hint: 'คมสุดในตระกูล Banana — งานสำคัญ / ตัวอักษรละเอียด',
    supportsAspectRatio: true,
    keepThaiInPrompt: true,
  },
  {
    id: 'openai/gpt-image-1',
    name: 'GPT Image 1',
    shortName: 'GPT Image',
    cost: 'quality',
    textQuality: 'excellent',
    bestFor: ['illustration', 'infographic', 'thai_text'],
    badge: 'สวย / ข้อความดี',
    hint: 'ภาพสวย สไตล์ทันสมัย ตัวอักษรบนภาพดี — ราคาสูงกว่า Flash',
    supportsAspectRatio: true,
    keepThaiInPrompt: true,
  },
  {
    id: 'openai/gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    shortName: 'GPT Image Mini',
    cost: 'budget',
    textQuality: 'good',
    bestFor: ['illustration', 'infographic'],
    badge: 'GPT ราคาเบา',
    hint: 'คุณภาพใกล้ GPT Image ราคาถูกกว่า — ทดลอง infographic ได้',
    supportsAspectRatio: true,
    keepThaiInPrompt: true,
  },
  {
    id: 'openai/gpt-5-image-mini',
    name: 'GPT-5 Image Mini',
    shortName: 'GPT-5 Image Mini',
    cost: 'budget',
    textQuality: 'good',
    bestFor: ['illustration', 'infographic'],
    badge: 'GPT-5 เบา',
    hint: 'ตระกูล GPT-5 ฝั่งภาพ ราคาประหยัด',
    supportsAspectRatio: false,
    keepThaiInPrompt: true,
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    name: 'FLUX.2 Klein (โควต้าฟรี OpenRouter)',
    shortName: 'Flux Klein ฟรี',
    cost: 'free',
    textQuality: 'weak',
    bestFor: ['illustration'],
    badge: 'ฟรีโควต้า',
    hint: 'เร็ว/ถูก เหมาะภาพ mood — ตัวอักษรไทยมักเพี้ยน ไม่ใช้กับ infographic',
    supportsAspectRatio: true,
    keepThaiInPrompt: false,
  },
  {
    id: 'black-forest-labs/flux.2-pro',
    name: 'FLUX.2 Pro',
    shortName: 'Flux Pro',
    cost: 'quality',
    textQuality: 'weak',
    bestFor: ['illustration'],
    badge: 'ภาพสวย (Flux)',
    hint: 'ภาพสวย แต่ข้อความบนภาพไม่แม่น — ใช้เป็นปก/hero ไม่ฝากข้อมูล',
    supportsAspectRatio: true,
    keepThaiInPrompt: false,
  },
];

const DEFAULT_OR_IMAGE_MODEL = 'google/gemini-3.1-flash-image';

function getImagePreset(modelId: string): ImageModelPreset | undefined {
  return IMAGE_MODEL_PRESETS.find((m) => m.id === modelId);
}

function recommendImageModel(intent: DrawIntent): ImageModelPreset {
  const preferred = IMAGE_MODEL_PRESETS.find(
    (m) => m.bestFor.includes(intent) && m.textQuality === 'excellent' && m.cost !== 'quality'
  );
  if (preferred) return preferred;
  return IMAGE_MODEL_PRESETS[0];
}

function detectDrawIntent(text: string): DrawIntent {
  const t = text.toLowerCase();
  if (/infographic|อินโฟ|อินโฟกราฟ|อินโฟกราฟิก|อินโฟกราฟฟิก|ข้อมูลสรุป.*รูป|โปสเตอร์ข้อมูล|แผนภาพ/.test(t) || /อินโฟ/.test(text)) {
    return 'infographic';
  }
  if (/ภาษาไทย|ตัวอักษรไทย|ข้อความไทย|thai text|ป้ายไทย/.test(t) || /[\u0e00-\u0e7f]{8,}/.test(text)) {
    // Long Thai content often wants readable Thai on image
    if (/infographic|อินโฟ|สรุป|หัวข้อ|bullet|ข้อ\s*\d/.test(t) || text.length > 200) {
      return 'infographic';
    }
    return 'thai_text';
  }
  return 'illustration';
}

/** Markdown image alt must be single-line without ] or newlines or the bubble shows raw "![..." junk */
function sanitizeImageAlt(text: string): string {
  return (text || 'Generated image')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Generated image';
}

function formatImageMarkdown(imageUrl: string, alt: string): string {
  return `![${sanitizeImageAlt(alt)}](${imageUrl})`;
}

/** Parse ![alt](url) — supports long data: URLs; rejects multiline alt leftovers from old bugs */
function parseImageMarkdown(text: string): { alt: string; url: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('![')) return null;
  const closeAlt = trimmed.indexOf('](');
  if (closeAlt < 2) return null;
  const alt = trimmed.slice(2, closeAlt);
  if (/[\r\n]/.test(alt)) return null;
  let i = closeAlt + 2;
  let url = '';
  if (trimmed.startsWith('data:', i)) {
    // data URLs: take rest until final closing )
    const lastParen = trimmed.lastIndexOf(')');
    if (lastParen <= i) return null;
    url = trimmed.slice(i, lastParen);
  } else {
    const closeUrl = trimmed.indexOf(')', i);
    if (closeUrl < 0) return null;
    url = trimmed.slice(i, closeUrl);
  }
  if (!url || (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:'))) {
    return null;
  }
  return { alt: alt || 'Generated image', url };
}

interface AISkill {
  id: string;
  name: string;
  placeholder: string;
  systemPrompt: string;
  color: string;
}

const AI_SKILLS: AISkill[] = [
  {
    id: 'none',
    name: '🔍 ทั่วไป',
    placeholder: 'พิมพ์คำถามของคุณเพื่อคุยกับ AI...',
    systemPrompt: '',
    color: 'slate'
  },
  {
    id: 'summarize',
    name: '📝 สรุปงานประจำวัน',
    placeholder: 'พิมพ์หรือวางบันทึกการทำงานย่อๆ เพื่อเรียบเรียงเป็นรายงานประจำวันส่งหัวหน้า...',
    systemPrompt: 'คุณคือ "ผู้เชี่ยวชาญด้านการบันทึกงานประจำวันของ Worklog" หน้าที่ของคุณคือการวิเคราะห์และเรียบเรียงข้อมูลประวัติการทำงานดิบที่ผู้ใช้พิมพ์เข้ามา ให้กลายเป็นรายงานผลการทำงานประจำวันระดับมืออาชีพอย่างเป็นทางการ\n\nเกณฑ์ในการจัดรูปแบบ:\n1. แยกแยะเนื้อหาออกเป็น 3 หัวข้อหลักด้วยสัญลักษณ์ Bullet point ที่ชัดเจน:\n   - 🎯 งานที่ทำเสร็จสิ้นแล้ว (Completed Tasks)\n   - ⏳ งานที่กำลังดำเนินการอยู่ (In-Progress Tasks)\n   - ⚠️ อุปสรรคหรือปัญหาที่พบ (Blockers / Challenges)\n2. ปรับแต่งภาษาเป็นภาษาไทยที่เป็นทางการ สุภาพ กระชับ และตรงประเด็นสำหรับส่งเสนอผู้บริหาร\n3. หลีกเลี่ยงคำฟุ่มเฟือย',
    color: 'emerald'
  },
  {
    id: 'plan',
    name: '📅 วางแผนงาน (PM)',
    placeholder: 'พิมพ์เป้าหมายโครงการหรือหัวข้องาน เพื่อแตกงานออกเป็นส่วนย่อยยิปย่อย...',
    systemPrompt: 'คุณคือ "ผู้เชี่ยวชาญการวางแผนโครงการ Agile PM" หน้าที่ของคุณคือการวิเคราะห์เป้าหมายโครงการหรือหัวข้องานขนาดใหญ่ที่ผู้ใช้ระบุ แล้วแตกออกมาเป็นแผนการทำงานย่อย (Sub-tasks) ที่เหมาะสมแก่การปฏิบัติจริงในระบบ\n\nเกณฑ์ในการจัดรูปแบบ:\n1. ลำดับหัวข้อย่อยและเรียงลำดับขั้นตอนก่อน-หลังให้มีความสอดคล้องทางตรรกะ\n2. ประเมินระยะเวลาทำจริงอย่างคร่าวๆ (Estimates) และระบุระดับความยาก (Complexity)\n3. ชี้แจงประเด็นความเสี่ยง (Potential Risks) และเสนอแนวทางการป้องกันปัญหากลุ่มงานนั้นๆ\n4. แสดงผลลัพธ์เป็นตารางหรือรายการ Markdown ที่อ่านง่ายชัดเจน',
    color: 'violet'
  },
  {
    id: 'debug',
    name: '💡 แก้โค้ด & ไอที',
    placeholder: 'พิมพ์โค้ด, คำสั่ง SQL หรือข้อผิดพลาด (Error) เพื่อให้ AI ช่วยวิเคราะห์หรือช่วยเขียนโค้ด...',
    systemPrompt: 'คุณคือ "สถาปนิกและนักพัฒนาซอฟต์แวร์ระดับอาวุโส" หน้าที่ของคุณคือการช่วยเหลือในการตรวจสอบข้อผิดพลาด เขียนคำสั่ง ดักจับบั๊ก หรือให้แนวคิดการออกแบบระบบไอทีและฐานข้อมูลขององค์กร\n\nเกณฑ์ในการตอบกลับ:\n1. เสนอแนะคำตอบทางเทคนิคอย่างเจาะลึก พร้อมแนบตัวอย่างโค้ดหรือคำสั่ง SQL ที่ล้างและปรับปรุงแล้ว\n2. อธิบายจุดที่ผิดพลาด (Root Cause) และวิธีป้องกันเพื่อไม่ให้ระบบล่มในอนาคตอย่างกระชับเข้าใจง่าย\n3. แนะนำแนวทางปฏิบัติที่ดีที่สุด (Best Practices) ด้านความเร็วและการประมวลผลระบบ',
    color: 'amber'
  }
];

export default function AiChatPage() {
  const { showToast } = useNotification();
  
  // Settings States
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('openrouter_chat_api_key') || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('openrouter_chat_model') || AVAILABLE_MODELS[0].id);
  const [isEditingKey, setIsEditingKey] = useState<boolean>(() => !localStorage.getItem('openrouter_chat_api_key'));
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [clearModalType, setClearModalType] = useState<'history' | 'key' | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string>('none');

  // Dynamic OpenRouter Models
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [customModelId, setCustomModelId] = useState<string>(() => {
    const stored = localStorage.getItem('openrouter_chat_model') || AVAILABLE_MODELS[0].id;
    const isPreset = AVAILABLE_MODELS.some(m => m.id === stored);
    return isPreset ? '' : stored;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  /** Category filter chips in model search modal ('all' = show every use-case) */
  const [modelCategoryFilter, setModelCategoryFilter] = useState<ModelCategory | 'all'>('all');
  const [modelTierFilter, setModelTierFilter] = useState<'all' | 'free' | 'paid'>('all');

  // Fetch all models dynamically from OpenRouter (public endpoint)
  useEffect(() => {
    const fetchOpenRouterModels = async () => {
      try {
        setIsLoadingModels(true);
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.data)) {
            setFetchedModels(json.data.map(mapOpenRouterModel));
          }
        }
      } catch (err) {
        console.error("Failed to fetch models from OpenRouter:", err);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchOpenRouterModels();
  }, []);

  // Flux Custom Parameters
  const [fluxStyle, setFluxStyle] = useState<string>('none');
  const [fluxRatio, setFluxRatio] = useState<string>('1:1');
  const [fluxSteps] = useState<number>(4);

  // Image Generation settings
  const [drawEngine, setDrawEngine] = useState<'flux_cf' | 'openrouter'>(() => (localStorage.getItem('openrouter_draw_engine') as 'flux_cf' | 'openrouter') || 'openrouter');
  const [openrouterImageModel, setOpenrouterImageModel] = useState<string>(() => localStorage.getItem('openrouter_image_model') || DEFAULT_OR_IMAGE_MODEL);
  const [drawIntent, setDrawIntent] = useState<DrawIntent>('illustration');
  /** Content from chat bubble to visualize (not only the short instruction in the input) */
  const [drawSourceText, setDrawSourceText] = useState<string>('');
  /** Image settings panel collapsed by default so chat stays readable */
  const [imageSettingsOpen, setImageSettingsOpen] = useState<boolean>(false);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('คัดลอกข้อความสำเร็จ!', 'success');
  };

  // Chat States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat sessions from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('worklog_ai_chat_sessions');
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    }
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) ||
    fetchedModels.find(m => m.id === selectedModel) || {
      id: selectedModel,
      name: selectedModel,
      tier: 'paid' as const,
      description: 'โมเดลกำหนดเองโดยผู้ใช้',
      privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ',
      categories: ['general'] as ModelCategory[],
    };

  const filteredSearchModels = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return fetchedModels.filter((m) => {
      if (modelTierFilter !== 'all' && m.tier !== modelTierFilter) return false;
      if (modelCategoryFilter !== 'all' && !m.categories?.includes(modelCategoryFilter)) return false;
      if (!query) return true;
      const catLabels = (m.categories || [])
        .map((c) => MODEL_CATEGORY_META[c]?.label || c)
        .join(' ')
        .toLowerCase();
      return (
        m.id.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query) ||
        (m.description || '').toLowerCase().includes(query) ||
        catLabels.includes(query)
      );
    });
  }, [fetchedModels, searchQuery, modelCategoryFilter, modelTierFilter]);

  const handleSaveApiKey = () => {
    localStorage.setItem('openrouter_chat_api_key', apiKey.trim());
    setIsEditingKey(false);
    showToast('บันทึก OpenRouter API Key สำเร็จ!', 'success');
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (modelId !== 'custom') {
      localStorage.setItem('openrouter_chat_model', modelId);
      const matched =
        AVAILABLE_MODELS.find(m => m.id === modelId) ||
        fetchedModels.find(m => m.id === modelId);
      const matchedName = matched?.name || modelId;
      showToast(`สลับโมเดลเป็น ${matchedName}`, 'info');

      const cats = matched?.categories || categorizeOpenRouterModel({ id: modelId, name: modelId });
      // Auto-enable web search for native search specialists (Perplexity etc.); keep user toggle otherwise
      if (cats.includes('web') || modelId.startsWith('perplexity/')) {
        setWebSearch(true);
        setDrawMode(false);
      }
      // Do NOT force webSearch off for other models — OpenRouter web_search tool works across models
    }
  };

  const handleCustomModelChange = (val: string) => {
    const cleanVal = val.trim();
    setCustomModelId(cleanVal);
    setSelectedModel(cleanVal);
    localStorage.setItem('openrouter_chat_model', cleanVal);
  };

  const handleCreateNewChat = () => {
    const newSessionId = 'session_' + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'บทสนทนาใหม่',
      createdAt: new Date().toISOString(),
      messages: []
    };
    
    const updated = [newSession, ...sessions];
    setSessions(updated);
    safeSaveSessions(updated);
    setActiveSessionId(newSessionId);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    safeSaveSessions(updated);
    
    if (activeSessionId === sessionId) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null);
    }
    showToast('ลบบทสนทนาสำเร็จ', 'success');
  };

  const handleClearHistory = () => {
    localStorage.removeItem('worklog_ai_chat_sessions');
    setSessions([]);
    setActiveSessionId(null);
    setClearModalType(null);
    showToast('ลบประวัติการแชททั้งหมดเรียบร้อยแล้ว', 'success');
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('openrouter_chat_api_key');
    setApiKey('');
    setIsEditingKey(true);
    setClearModalType(null);
    showToast('ลบ OpenRouter API Key เรียบร้อยแล้ว', 'success');
  };

  const safeSaveSessions = (sessionsToSave: ChatSession[]) => {
    try {
      localStorage.setItem('worklog_ai_chat_sessions', JSON.stringify(sessionsToSave));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn("LocalStorage quota exceeded! Pruning oldest generated images...");
        const cloned = JSON.parse(JSON.stringify(sessionsToSave)) as ChatSession[];
        let prunedAny = false;
        
        // Loop backwards from oldest to newest sessions to prune generated image data URLs
        for (let i = cloned.length - 1; i >= 0; i--) {
          const session = cloned[i];
          for (let j = 0; j < session.messages.length; j++) {
            const msg = session.messages[j];
            if (msg.role === 'assistant' && msg.content.includes('data:image/')) {
              msg.content = msg.content.replace(/!\[(.*?)\]\(data:image\/.*?;base64,.*?\)/g, '![Image: $1](ภาพถูกลบเพื่อประหยัดพื้นที่จัดเก็บของเบราว์เซอร์)');
              prunedAny = true;
              break;
            }
          }
          if (prunedAny) break;
        }

        if (prunedAny) {
          // Attempt to save again recursively
          safeSaveSessions(cloned);
          setSessions(cloned); // Sync state with the pruned version to keep UI updated
          showToast('พื้นที่เบราว์เซอร์เต็ม: ระบบได้ลบไฟล์ภาพแชทเก่าบางส่วนเพื่อบันทึกประวัติการแชทใหม่', 'info');
        } else {
          // If no images are left to prune, delete the oldest session
          if (cloned.length > 1) {
            cloned.pop(); // Remove the oldest session
            safeSaveSessions(cloned);
            setSessions(cloned); // Sync state with the pruned version
            showToast('พื้นที่เบราว์เซอร์เต็ม: ระบบได้ลบประวัติการแชทเก่าเพื่อบันทึกประวัติการแชทใหม่', 'info');
          } else {
            console.error("Cannot prune further, single session is too large");
          }
        }
      } else {
        console.error("Failed to save sessions to localStorage:", e);
      }
    }
  };

  /**
   * Build a model-ready image prompt from user instruction + optional chat source.
   * Text-strong models (Nano Banana / GPT Image) keep Thai labels; Flux gets EN-only scene prompts.
   */
  const buildImagePrompt = async (
    userInstruction: string,
    sourceContent: string,
    intent: DrawIntent,
    preset: ImageModelPreset | undefined,
    key: string,
    activeModel: string
  ): Promise<string> => {
    const keepThai = preset?.keepThaiInPrompt ?? false;
    const modelsToTry = [
      activeModel,
      "google/gemini-2.0-flash:free",
      "meta-llama/llama-3-8b-instruct:free",
      "openrouter/free",
    ];

    const sourceBlock = sourceContent.trim()
      ? `\n\n--- SOURCE CONTENT (facts / copy to visualize) ---\n${sourceContent.slice(0, 3500)}\n---`
      : '';

    let systemBrief = '';
    if (intent === 'infographic') {
      systemBrief = keepThai
        ? `You design prompts for an AI image model that CAN render Thai text accurately.
Write ONE detailed image-generation prompt for a clean corporate infographic poster.
Rules:
- Vertical or clear section layout, flat design, large readable titles, icons, whitespace
- Include EXACT Thai (and English if needed) strings that must appear on the image, in quotes
- Max 5 short sections; no tiny paragraph text
- Specify colors, hierarchy (title → sections → footer warning if any)
- Output ONLY the prompt, no markdown fences or intro`
        : `You design prompts for Flux-style models that are WEAK at text.
Write ONE detailed English image prompt for an infographic-style illustration WITHOUT relying on readable body text.
Use icons, shapes, color blocks, big short English labels only (3-5 words max per label).
Output ONLY the prompt.`;
    } else if (intent === 'thai_text' || keepThai) {
      systemBrief = `You design prompts for an AI image model that CAN render Thai text.
Write ONE detailed image-generation prompt. Keep any Thai labels exactly as the user needs them (in quotes).
Describe layout, style, lighting. Output ONLY the prompt.`;
    } else {
      systemBrief = `Translate/expand into a detailed English image prompt for Flux. No Thai characters. Output ONLY the prompt.`;
    }

    const userMsg = `${systemBrief}\n\nUser request: ${userInstruction}${sourceBlock}`;

    if (key.trim()) {
      for (const model of modelsToTry) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${key}`,
              "HTTP-Referer": window.location.origin,
              "X-Title": "Worklog AI Chat Image Prompt Builder",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: userMsg }],
              temperature: 0.4,
              max_tokens: intent === 'infographic' ? 600 : 280,
            }),
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (data.error) continue;
          const raw = data.choices?.[0]?.message?.content?.trim();
          if (!raw) continue;
          const cleaned = raw.replace(/^```[\w]*\n?|\n?```$/g, '').replace(/^["']|["']$/g, '').trim();
          if (!keepThai && /[\u0e00-\u0e7f]/.test(cleaned)) continue;
          if (cleaned.length > 20) return cleaned;
        } catch {
          /* try next */
        }
      }
    }

    // Fallback: stitch instruction + truncated source
    if (sourceContent.trim()) {
      return `${userInstruction}\n\nContent to visualize:\n${sourceContent.slice(0, 1200)}`;
    }
    return userInstruction;
  };

  /** Enter draw mode from an AI chat bubble with smart model recommendation */
  const handleCreateImageFromMessage = (content: string, intent?: DrawIntent) => {
    if (isGenerating) return;
    const clean = content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/```[\s\S]*?```/g, (block) => (block.length > 800 ? '[code omitted]' : block))
      .trim();
    if (!clean || clean.length < 8) {
      showToast('ไม่มีข้อความพอสำหรับสร้างรูป', 'warning');
      return;
    }

    const resolvedIntent = intent || detectDrawIntent(clean);
    const rec = recommendImageModel(resolvedIntent);

    setDrawMode(true);
    setWebSearch(false);
    setImageSettingsOpen(false); // keep chat visible — compact bar only
    setDrawIntent(resolvedIntent);
    setDrawSourceText(clean);
    setDrawEngine('openrouter');
    setOpenrouterImageModel(rec.id);
    localStorage.setItem('openrouter_draw_engine', 'openrouter');
    localStorage.setItem('openrouter_image_model', rec.id);

    if (resolvedIntent === 'infographic') {
      setFluxRatio('9:16');
      setFluxStyle('none');
      setInput('ทำเป็น infographic สวย ชัด อ่านง่าย ใช้ภาษาไทยบนภาพให้ถูกต้อง');
    } else if (resolvedIntent === 'thai_text') {
      setFluxRatio('1:1');
      setInput('สร้างภาพจากเนื้อหานี้ ตัวอักษรภาษาไทยต้องอ่านชัด');
    } else {
      setFluxRatio('1:1');
      setInput('วาดภาพประกอบสวย ๆ จากเนื้อหาด้านบน');
    }

    showToast(
      `พร้อมสร้างรูปด้วย ${rec.shortName} — กดส่งได้เลย (ตั้งค่าเพิ่มกดที่แถบบนช่องพิมพ์)`,
      'info'
    );
  };

  const handleSendMessage = async (customPrompt?: string, forceDraw = false) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isGenerating) return;
    
    const isDrawing = forceDraw || drawMode;

    if ((!isDrawing || (isDrawing && drawEngine === 'openrouter')) && !apiKey.trim()) {
      showToast('กรุณากรอก OpenRouter API Key ในแถบด้านซ้ายก่อนเริ่มใช้งาน', 'warning');
      setIsEditingKey(true);
      return;
    }

    let currentSessionId = activeSessionId;
    let updatedSessions = [...sessions];

    // Create session if not exists or if currently selected session is empty but we want a new chat
    if (!currentSessionId || sessions.length === 0) {
      const newSessionId = 'session_' + Date.now();
      const newSession: ChatSession = {
        id: newSessionId,
        title: textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : ''),
        createdAt: new Date().toISOString(),
        messages: []
      };
      updatedSessions = [newSession, ...updatedSessions];
      currentSessionId = newSessionId;
      setActiveSessionId(newSessionId);
    }

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    // Find the session and append the user message
    const sessionIndex = updatedSessions.findIndex(s => s.id === currentSessionId);
    if (sessionIndex === -1) return;

    const targetSession = { ...updatedSessions[sessionIndex] };
    
    // Auto-update title if it's the default name
    if (targetSession.title === 'บทสนทนาใหม่' && targetSession.messages.length === 0) {
      targetSession.title = textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : '');
    }

    targetSession.messages = [...targetSession.messages, userMessage];

    // Resolve draw intent for this send (refine from text when still on generic illustration)
    const activeDrawIntent: DrawIntent = isDrawing
      ? (drawIntent === 'illustration'
          ? detectDrawIntent(`${textToSend}\n${drawSourceText}`)
          : drawIntent)
      : drawIntent;
    const imagePreset = getImagePreset(openrouterImageModel);

    // Add assistant processing placeholder
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: isDrawing
        ? '⏳ กำลังออกแบบคำสั่งภาพ (Step 1/2)...'
        : (webSearch ? '🌐 กำลังค้นหาเว็บและเรียบเรียงคำตอบ...' : 'กำลังพิมพ์คำตอบ...'),
      timestamp: new Date().toISOString()
    };
    targetSession.messages = [...targetSession.messages, assistantPlaceholder];
    
    updatedSessions[sessionIndex] = targetSession;
    setSessions(updatedSessions);
    setInput('');
    setIsGenerating(true);

    // B. IMAGE GENERATION WORKFLOW
    if (isDrawing) {
      const sourceForImage = drawSourceText.trim();
      const imageModelLabel =
        drawEngine === 'openrouter'
          ? (imagePreset?.shortName || openrouterImageModel)
          : 'Flux Cloudflare (ฟรี)';

      // Warn if free/weak text model used for infographic
      if (
        (activeDrawIntent === 'infographic' || activeDrawIntent === 'thai_text') &&
        (drawEngine === 'flux_cf' || imagePreset?.textQuality === 'weak')
      ) {
        showToast(
          'งาน Infographic/ข้อความไทย แนะนำ Nano Banana 2 หรือ GPT Image — โมเดลฟรี/Flux มักอ่านตัวอักษรไม่คม',
          'warning'
        );
      }

      let finalPrompt = textToSend;
      let translationStatus = '';

      finalPrompt = await buildImagePrompt(
        textToSend,
        sourceForImage,
        activeDrawIntent,
        drawEngine === 'openrouter' ? imagePreset : undefined,
        apiKey,
        selectedModel
      );

      translationStatus =
        `⏳ กำลังสร้างรูป…\n` +
        `โมเดล: ${imageModelLabel} · ${activeDrawIntent} · ${fluxRatio}\n` +
        `อย่าปิดหน้านี้ (อาจใช้เวลา 15–90 วินาที)`;

      setSessions(prevSessions => {
        const updated = prevSessions.map(s => {
          if (s.id === currentSessionId) {
            const messagesCopy = [...s.messages];
            messagesCopy[messagesCopy.length - 1] = {
              role: 'assistant',
              content: translationStatus,
              timestamp: new Date().toISOString()
            };
            return { ...s, messages: messagesCopy };
          }
          return s;
        });
        return updated;
      });

      let promptWithStyle = finalPrompt;
      if (fluxStyle !== 'none') {
        const styleSuffixes: Record<string, string> = {
          realistic: ", hyper-realistic 8k photography, highly detailed, professional lighting, cinematic composition, photorealistic style",
          anime: ", anime key visual style, vibrant colors, detailed digital illustration, studio ghibli aesthetic, clean line art",
          pixel: ", retro 16-bit pixel art style, detailed game asset, pixelated grid aesthetic",
          watercolor: ", beautiful watercolor painting style, soft textures, wet brush details, pastel color palette, artistic canvas look",
          cyberpunk: ", futuristic cyberpunk style, neon night city, glowing dark synthwave aesthetic, highly detailed sci-fi scene",
          render3d: ", 3D clay toy model style, blender octane render, cute cartoon render, smooth plastics and clay textures",
          infographic: ", clean corporate infographic poster, flat design, large typography, icon sections, ample whitespace, vector style"
        };
        const suffix = styleSuffixes[fluxStyle];
        if (suffix) {
          promptWithStyle = `${finalPrompt}${suffix}`;
        }
      }

      const finishImageMessage = (imageUrl: string, usedModel: string) => {
        if (!imageUrl || typeof imageUrl !== 'string') {
          throw new Error('ไม่พบ URL รูปภาพจากระบบสร้างรูป');
        }
        setSessions(prevSessions => {
          const updated = prevSessions.map(s => {
            if (s.id === currentSessionId) {
              const messagesCopy = [...s.messages];
              // Short single-line alt only — long/multiline prompt used to break markdown and look "stuck"
              messagesCopy[messagesCopy.length - 1] = {
                role: 'assistant',
                content: formatImageMarkdown(imageUrl, imageModelLabel),
                timestamp: new Date().toISOString(),
                modelUsed: usedModel
              };
              return { ...s, messages: messagesCopy };
            }
            return s;
          });
          setTimeout(() => safeSaveSessions(updated), 0);
          return updated;
        });
        setDrawSourceText('');
        setIsGenerating(false);
        showToast('สร้างรูปสำเร็จ', 'success');
      };

      const abortCtrl = new AbortController();
      const timeoutMs = 120_000;
      const timeoutId = window.setTimeout(() => abortCtrl.abort(), timeoutMs);

      try {
        if (drawEngine === 'openrouter') {
          const body: Record<string, unknown> = {
            model: openrouterImageModel,
            prompt: promptWithStyle,
          };
          if (imagePreset?.supportsAspectRatio !== false) {
            body.aspect_ratio = fluxRatio;
          }

          const response = await fetch("https://openrouter.ai/api/v1/images", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": window.location.origin,
              "X-Title": "Worklog AI Chat Image Generator",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: abortCtrl.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg =
              errorData?.error?.message ||
              (typeof errorData?.error === 'string' ? errorData.error : null) ||
              `HTTP error (${response.status})`;
            throw new Error(msg);
          }

          const json = await response.json();
          const item = json.data?.[0];
          let imageUrl: string | undefined = item?.url;
          if (!imageUrl && item?.b64_json) {
            const media = item.media_type || 'image/png';
            imageUrl = `data:${media};base64,${item.b64_json}`;
          }
          // Some providers nest differently
          if (!imageUrl && typeof item?.image_url === 'string') {
            imageUrl = item.image_url;
          }
          if (!imageUrl && item?.image_url?.url) {
            imageUrl = item.image_url.url;
          }
          if (!imageUrl) {
            throw new Error("OpenRouter API ไม่ได้คืนค่ารูปภาพกลับมา (ลองโมเดลอื่นหรือตรวจเครดิตบัญชี)");
          }

          finishImageMessage(imageUrl, openrouterImageModel);
        } else {
          // Cloudflare Worker Flow (free Flux)
          const response = await fetch("https://flux-image-generator.play2earn.workers.dev/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              prompt: promptWithStyle,
              steps: fluxSteps,
              aspectRatio: fluxRatio
            }),
            signal: abortCtrl.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error || `HTTP error (${response.status})`);
          }

          const blob = await response.blob();
          if (!blob || blob.size < 32) {
            throw new Error('Cloudflare ไม่ได้ส่งไฟล์รูปกลับมา');
          }
          const base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                resolve(reader.result);
              } else {
                reject(new Error('แปลงรูปเป็น base64 ไม่สำเร็จ'));
              }
            };
            reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
            reader.readAsDataURL(blob);
          });
          finishImageMessage(base64data, 'flux-cloudflare');
        }
      } catch (err: any) {
        console.error("Image generation failed:", err);
        const isAbort = err?.name === 'AbortError';
        const errMsg = isAbort
          ? `หมดเวลารอรูป (${timeoutMs / 1000}s) — ลองใหม่หรือเปลี่ยนโมเดล`
          : (err?.message || 'Unknown error');
        showToast(`สร้างรูปภาพล้มเหลว: ${errMsg}`, 'error');
        
        setSessions(prevSessions => {
          const updated = prevSessions.map(s => {
            if (s.id === currentSessionId) {
              const messagesCopy = [...s.messages];
              messagesCopy[messagesCopy.length - 1] = {
                role: 'assistant',
                content:
                  `❌ สร้างรูปไม่สำเร็จ\n\n` +
                  `**สาเหตุ:** ${errMsg}\n\n` +
                  `**โมเดล:** ${imageModelLabel}\n` +
                  `**คำแนะนำ:** ตรวจ OpenRouter API Key / เครดิต · ลอง Nano Banana 2 อีกครั้ง · หรือสลับ Cloudflare ฟรีสำหรับภาพ mood\n\n` +
                  `<details><summary>คำสั่งภาพที่ใช้</summary>\n\n${promptWithStyle.slice(0, 800)}\n\n</details>`,
                timestamp: new Date().toISOString(),
                modelUsed: drawEngine === 'openrouter' ? openrouterImageModel : 'flux-cloudflare',
              };
              return { ...s, messages: messagesCopy };
            }
            return s;
          });
          setTimeout(() => safeSaveSessions(updated), 0);
          return updated;
        });
        setIsGenerating(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
      return;
    }

    // A. CHAT LOGIC (OpenRouter API)
    let requestModel = selectedModel;
    try {
      const formattedMessages = targetSession.messages
        .slice(0, -1) // remove placeholder
        .map(m => {
          // If the message contains a generated image from the assistant, strip the heavy base64 string
          let content = m.content;
          if (m.role === 'assistant') {
            content = content.replace(/!\[(.*?)\]\(data:image\/.*?;base64,.*?\)/g, '![Image: $1](Flux generated image)');
          }
          return { role: m.role, content: content };
        });

      // Inject system prompt for the active AI Skill if selected
      const activeSkill = AI_SKILLS.find(s => s.id === activeSkillId);
      const messagesToSend: { role: string; content: string }[] = [...formattedMessages];
      if (activeSkill && activeSkill.systemPrompt) {
        messagesToSend.unshift({
          role: 'system',
          content: activeSkill.systemPrompt
        });
      }

      // Keep the user's selected model — enable web via OpenRouter tools (not model swap to Perplexity)
      requestModel = selectedModel;

      if (webSearch) {
        messagesToSend.unshift({
          role: 'system',
          content:
            'You have access to real-time web search. Use it when the user needs current facts, news, or research. ' +
            'Cite sources with markdown links (e.g. [domain.com](https://...)). Prefer concise Thai answers when the user writes in Thai.'
        });
      }

      const openRouterHeaders = {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Worklog AI Chat",
        "Content-Type": "application/json"
      };

      // Primary: server tool (model decides when/how often to search). Fallback: legacy web plugin.
      const buildChatBody = (mode: 'tool' | 'plugin' | 'plain') => {
        const body: Record<string, unknown> = {
          model: requestModel,
          messages: messagesToSend,
          stream: true,
        };
        if (mode === 'tool' && webSearch) {
          body.tools = [
            {
              type: 'openrouter:web_search',
              parameters: {
                engine: 'auto',
                max_results: 5,
                max_uses: 3,
              },
            },
          ];
        } else if (mode === 'plugin' && webSearch) {
          body.plugins = [{ id: 'web', max_results: 5 }];
        }
        return body;
      };

      const postChat = async (mode: 'tool' | 'plugin' | 'plain') => {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: openRouterHeaders,
          body: JSON.stringify(buildChatBody(mode)),
        });
        return res;
      };

      let response: Response;
      if (webSearch) {
        response = await postChat('tool');
        if (!response.ok) {
          // Some free / non-tool models reject server tools — retry with web plugin
          const firstErr = await response.json().catch(() => ({}));
          const firstMsg = firstErr?.error?.message || `API error (${response.status})`;
          console.warn('Web search via server tool failed, retrying with web plugin:', firstMsg);
          response = await postChat('plugin');
          if (!response.ok) {
            const secondErr = await response.json().catch(() => ({}));
            throw new Error(secondErr?.error?.message || firstMsg || `API error (${response.status})`);
          }
        }
      } else {
        response = await postChat('plain');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error?.message || `API error (${response.status})`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response stream is not readable");
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              const content = data.choices[0]?.delta?.content || '';
              if (content) {
                assistantContent += content;

                // Update UI state in real-time
                setSessions(prevSessions => {
                  return prevSessions.map(s => {
                    if (s.id === currentSessionId) {
                      const messagesCopy = [...s.messages];
                      messagesCopy[messagesCopy.length - 1] = {
                        role: 'assistant',
                        content: assistantContent,
                        timestamp: new Date().toISOString(),
                        modelUsed: requestModel
                      };
                      return { ...s, messages: messagesCopy };
                    }
                    return s;
                  });
                });
              }
            } catch (e) {
              // Ignore partial parsing errors
            }
          }
        }
      }

      // Save final chat history
      setSessions(prevSessions => {
        setTimeout(() => safeSaveSessions(prevSessions), 0);
        return prevSessions;
      });

    } catch (err: any) {
      console.error("OpenRouter API error:", err);
      showToast(`การเชื่อมต่อล้มเหลว: ${err.message}`, 'error');
      
      setSessions(prevSessions => {
        const updated = prevSessions.map(s => {
          if (s.id === currentSessionId) {
            const messagesCopy = [...s.messages];
            messagesCopy[messagesCopy.length - 1] = {
              role: 'assistant',
              content: `⚠️ เกิดข้อผิดพลาด: ${err.message}\n\nกรุณาตรวจสอบความถูกต้องของ OpenRouter API Key และเครือข่ายอินเทอร์เน็ตของคุณ`,
              timestamp: new Date().toISOString(),
              modelUsed: requestModel
            };
            return { ...s, messages: messagesCopy };
          }
          return s;
        });
        setTimeout(() => safeSaveSessions(updated), 0);
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to format response message text (Simple Markdown-like formatter)
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    
    // Check if the message is a Markdown Image: ![alt](url)
    const parsedImg = parseImageMarkdown(text);
    if (parsedImg) {
      const altText = parsedImg.alt;
      const imageUrl = parsedImg.url;

      return (
        <div className="space-y-3 my-2 max-w-full">
          <div className="rounded-2xl border border-theme-border/60 overflow-hidden bg-slate-900/5 dark:bg-slate-950/20 max-w-sm shadow-md">
            <img 
              src={imageUrl} 
              alt={altText}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const sib = (e.target as HTMLImageElement).nextElementSibling;
                if (sib) (sib as HTMLElement).hidden = false;
              }}
              className="max-w-full h-auto object-cover select-text block transition-transform hover:scale-[1.01]" 
            />
            <div hidden className="p-3 text-[11px] text-rose-500 font-semibold">
              โหลดรูปไม่สำเร็จ (URL หมดอายุหรือเสีย) — ลองสร้างใหม่
            </div>
            <div className="p-3 border-t border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-theme-text-muted font-bold tracking-wide">AI Image</span>
                <a 
                  href={imageUrl} 
                  download={`flux-image-${Date.now()}.jpg`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold shadow-sm transition-all select-none cursor-pointer"
                >
                  <span>ดาวน์โหลด</span>
                </a>
              </div>
              {altText && altText !== 'ภาพที่สร้างจาก Flux' && (
                <div className="text-[9px] text-theme-text-secondary border-t border-theme-border/40 pt-2 font-mono leading-relaxed">
                  <span className="font-bold text-indigo-500">คำแปล Prompt (English):</span> {altText}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Old/broken image markdown (multiline alt) looked like generation "stuck" as raw text
    if (text.trim().startsWith('![') && text.includes('](')) {
      return (
        <div className="space-y-2 text-xs text-theme-text-secondary">
          <p className="font-bold text-amber-600 dark:text-amber-400">
            ⚠️ ข้อความนี้เป็นผลสร้างรูปรุ่นเก่าที่แสดงไม่ถูกต้อง
          </p>
          <p>กรุณากดสร้างรูปใหม่อีกครั้ง (ระบบแก้การบันทึกรูปแล้ว)</p>
        </div>
      );
    }

    // Split by code blocks
    const blocks = text.split(/(```[\s\S]*?```)/g);
    
    return blocks.map((block, idx) => {
      // Code Block
      if (block.startsWith('```') && block.endsWith('```')) {
        const code = block.slice(3, -3).trim();
        const lines = code.split('\n');
        let lang = 'code';
        let codeText = code;
        if (lines.length > 0 && !lines[0].includes(' ') && lines[0].length < 15) {
          lang = lines[0];
          codeText = lines.slice(1).join('\n');
        }
        return (
          <pre key={idx} className="bg-slate-950 text-slate-200 p-4 rounded-xl my-3 overflow-x-auto font-mono text-xs border border-slate-800 relative group max-w-full">
            <div className="absolute top-2 right-2 text-[9px] uppercase text-slate-500 font-bold bg-slate-900 px-2 py-0.5 rounded tracking-widest">{lang}</div>
            <code className="whitespace-pre-wrap block select-text">{codeText}</code>
          </pre>
        );
      }
      
      // Inline formatting (paragraphs, bold, list, inline code)
      const lines = block.split('\n');
      return (
        <div key={idx} className="space-y-2 my-1">
          {lines.map((line, lIdx) => {
            const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
            const lineText = isBullet ? line.trim().substring(2) : line;
            
            // Format bold **text**
            const parts = lineText.split(/(\*\*.*?\*\*)/g);
            const formattedLine = parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="font-extrabold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
              }
              // Format inline code `code`
              const inlineCodeParts = part.split(/(`.*?`)/g);
              return inlineCodeParts.map((subPart, sIdx) => {
                if (subPart.startsWith('`') && subPart.endsWith('`')) {
                  return <code key={sIdx} className="bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono text-xs border border-slate-200 dark:border-slate-800">{subPart.slice(1, -1)}</code>;
                }
                return subPart;
              });
            });
            
            if (isBullet) {
              return (
                <li key={lIdx} className="list-disc ml-6 text-theme-text-secondary leading-relaxed pl-1">
                  {formattedLine}
                </li>
              );
            }
            return <p key={lIdx} className="text-theme-text-secondary leading-relaxed min-h-[1.25rem]">{formattedLine}</p>;
          })}
        </div>
      );
    });
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-7rem)] w-full overflow-hidden rounded-2xl border border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/20 backdrop-blur-xl shadow-lg relative">
        
        {/* LEFT COLUMN: Sessions & Configs Sidebar */}
        <aside className="w-80 border-r border-theme-border/60 flex flex-col bg-theme-surface/40 dark:bg-theme-bg-page/30 shrink-0 hidden md:flex">
          
          {/* Header Action */}
          <div className="p-4 border-b border-theme-border/60">
            <button 
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold text-sm shadow-md shadow-indigo-500/10 active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Chat Sessions History List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <div className="text-[10px] font-bold text-theme-text-muted px-3 uppercase tracking-wider mb-2 mt-1">ประวัติการสนทนา</div>
            {sessions.length === 0 ? (
              <div className="text-xs text-theme-text-muted text-center py-8 font-mono italic">ไม่มีประวัติการแชท</div>
            ) : (
              sessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border group relative",
                      isActive 
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent hover:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <MessageSquare size={13} className="shrink-0 opacity-70" />
                      <span className="truncate">{s.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-1 rounded transition-opacity shrink-0"
                      title="ลบบทสนทนา"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* AI Settings Section (Key & Model Selection) */}
          <div className="p-4 border-t border-theme-border/60 bg-theme-surface-secondary/50 dark:bg-theme-bg-page/50 space-y-4">
            
            {/* Model Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                  เลือกปัญญาประดิษฐ์ (Model)
                </label>
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold transition-all cursor-pointer select-none"
                >
                  <Globe size={11} /> ค้นหาทั้งหมด ({fetchedModels.length || '...'})
                </button>
              </div>
              
              <div className="space-y-1.5">
                <select
                  value={AVAILABLE_MODELS.some(m => m.id === selectedModel) ? selectedModel : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      handleModelChange(customModelId || 'anthropic/claude-sonnet-5');
                    } else {
                      handleModelChange(e.target.value);
                    }
                  }}
                  className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-theme-border-strong bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <optgroup label="🔒 Paid Tier (ปลอดภัยสูง / แนะนำ)">
                    {AVAILABLE_MODELS.filter(m => m.tier === 'paid').map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="⚠️ Free Tier (ใช้งานทั่วไป)">
                    {AVAILABLE_MODELS.filter(m => m.tier === 'free').map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="⚙️ Custom Config">
                    <option value="custom">พิมพ์กำหนดเอง (Custom ID)...</option>
                  </optgroup>
                </select>

                {(!AVAILABLE_MODELS.some(m => m.id === selectedModel)) && (
                  <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={(e) => handleCustomModelChange(e.target.value)}
                      placeholder="e.g. anthropic/claude-sonnet-5"
                      className="w-full text-xs font-mono py-2 px-3 rounded-xl border border-theme-border-strong bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <p className="text-[9px] text-theme-text-muted">
                      ระบุ ID จาก OpenRouter เช่น <code className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 px-1 rounded font-mono">anthropic/claude-sonnet-5</code>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* API Key Config */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                  OpenRouter API Key
                </label>
                <button 
                  onClick={() => setIsEditingKey(!isEditingKey)}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {isEditingKey ? 'ยกเลิก' : (apiKey ? 'แก้ไข' : 'ใส่คีย์')}
                </button>
              </div>

              {isEditingKey ? (
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full text-xs font-mono py-2 pl-3 pr-8 rounded-xl border border-theme-border-strong bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-2 text-theme-text-muted hover:text-theme-text"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all"
                  >
                    บันทึก
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-theme-surface border border-theme-border/60">
                  <Key size={13} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-mono text-theme-text-secondary truncate flex-1">
                    {apiKey ? '••••••••••••••••••••••••••••••••' : 'ยังไม่ได้ตั้งค่าคีย์'}
                  </span>
                  <div className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse", !apiKey && "bg-slate-400")} />
                </div>
              )}
            </div>

             {/* Clear Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setClearModalType('history')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-rose-300 dark:border-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
              >
                <Trash2 size={12} />
                <span>ล้างประวัติแชท</span>
              </button>
              <button
                onClick={() => setClearModalType('key')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-amber-300 dark:border-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
              >
                <Key size={12} />
                <span>ล้าง API Key</span>
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-theme-surface/10 dark:bg-theme-bg-page/5">
          
          {/* Header Bar */}
          <header className="h-14 border-b border-theme-border/60 px-6 flex items-center justify-between bg-theme-surface/50 dark:bg-theme-bg-page/40 backdrop-blur-md relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "p-1.5 rounded-lg shrink-0",
                activeModelInfo.tier === 'paid' 
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              )}>
                <Cpu size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-theme-text leading-none flex items-center gap-1.5 truncate">
                  <span>{activeModelInfo.name}</span>
                  {activeModelInfo.tier === 'paid' ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      <Shield size={8} /> Secure
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-500/15 text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Standard
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {(activeModelInfo.categories || ['general']).slice(0, 4).map((c) => {
                    const meta = MODEL_CATEGORY_META[c];
                    if (!meta) return null;
                    const Icon = meta.Icon;
                    return (
                      <span
                        key={c}
                        title={meta.hint}
                        className={cn(
                          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold border",
                          meta.badgeClass
                        )}
                      >
                        <Icon size={9} />
                        {meta.shortLabel}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[10px] text-theme-text-muted truncate mt-0.5 hidden sm:block">
                  {activeModelInfo.description}
                </p>
              </div>
            </div>
            
            {/* Mobile indicator showing configs */}
            <div className="md:hidden flex items-center gap-1.5">
              <select
                value={AVAILABLE_MODELS.some(m => m.id === selectedModel) ? selectedModel : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    handleModelChange(customModelId || 'anthropic/claude-sonnet-5');
                  } else {
                    handleModelChange(e.target.value);
                  }
                }}
                className="text-[10px] font-semibold py-1.5 px-2 rounded-lg border border-theme-border-strong bg-theme-surface text-theme-text focus:outline-none cursor-pointer max-w-[120px]"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.tier === 'paid' ? '🔒' : '⚠️'} {m.name}</option>
                ))}
                <option value="custom">⚙️ Custom...</option>
              </select>
              <button
                onClick={() => setIsSearchModalOpen(true)}
                type="button"
                className="p-1.5 rounded-lg border border-theme-border bg-theme-surface text-indigo-500 hover:text-indigo-600 cursor-pointer flex items-center justify-center shrink-0"
                title="ค้นหาโมเดลทั้งหมด"
              >
                <Globe size={12} />
              </button>
            </div>
          </header>

          {/* Privacy Note Banner */}
          <div className="px-6 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-theme-border/40 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <ShieldAlert size={12} className="shrink-0" />
            <span>
              ข้อมูลแชทถูกเก็บไว้ในเครื่องของคุณ 100% ไม่มีการอัปโหลดเก็บในฐานข้อมูลกลางบริษัท | ความปลอดภัยโมเดล: {activeModelInfo.privacy}
            </span>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {(!activeSession || activeSession.messages.length === 0) ? (
              // Empty State Welcome screen
              <div className="max-w-2xl mx-auto py-12 px-4 space-y-8 animate-fade-in">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/10">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <h2 className="text-base font-extrabold text-theme-text tracking-wide">
                    ปรึกษาสอบถาม AI ในระดับองค์กร
                  </h2>
                  <p className="text-xs text-theme-text-secondary max-w-md mx-auto">
                    ค้นหาไอเดีย ตรวจแก้เอกสาร คำนวณชั่วโมงงาน หรือช่วยวิเคราะห์ข้อมูลได้อย่างไร้กังวลด้วยระบบถอดคีย์เก็บแบบ Local Storage
                  </p>
                </div>

                {/* API Key Missing Alert */}
                {!apiKey && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed space-y-2 flex gap-3">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <span className="font-bold">⚠️ ยังไม่มีคีย์ API เชื่อมต่อ:</span> เพื่อให้ AI ตอบคำถามได้กรุณาขอ OpenRouter API Key จากระบบของคุณและบันทึกในช่อง **"OpenRouter API Key"** แถบเมนูด้านซ้าย (หรือแถบตั้งค่าเบราว์เซอร์)
                    </div>
                  </div>
                )}

                {/* Quick Templates List */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                    ⚡ เทมเพลตคำถามด่วน (Quick Prompts)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(qp.text, qp.isDrawPrompt)}
                        className="p-3 text-left rounded-xl border border-theme-border bg-theme-surface hover:border-indigo-500/40 hover:bg-indigo-50/10 dark:hover:bg-indigo-500/5 text-xs text-theme-text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold active:scale-[0.98] transition-all"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Local first guarantee details */}
                <div className="p-4 rounded-xl bg-theme-surface-secondary dark:bg-theme-bg-page/40 border border-theme-border/60 flex items-start gap-3">
                  <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-theme-text-secondary leading-relaxed space-y-1">
                    <p className="font-bold text-theme-text">🔒 ปลอดภัยสูงสุดสำหรับข้อมูลภายในองค์กร:</p>
                    <p>1. หน้าแชทนี้เป็นลักษณะ <strong>Client-Only</strong> (คุยตรงจากเบราว์เซอร์ถึง OpenRouter / ระบบวาดภาพ)</p>
                    <p>2. คีย์และบันทึกสนทนาทั้งหมดเซฟไว้เฉพาะในเครื่องคอมพิวเตอร์ของคุณเท่านั้น บริษัทไม่เข้าถึงข้อมูลนี้</p>
                    <p>3. แนะนำให้สลับเป็นกลุ่มโมเดล <strong>Paid Tier</strong> เมื่อต้องการสอบถามเรื่องที่มีความอ่อนไหวสูง</p>
                  </div>
                </div>
              </div>
            ) : (
              // Active Chat Log messages
              <div className="max-w-3xl mx-auto space-y-6">
                {activeSession.messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex gap-4 items-start select-text",
                        isUser ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border",
                        isUser 
                          ? "bg-indigo-600 text-white border-indigo-500" 
                          : "bg-theme-surface text-theme-text border-theme-border/80"
                      )}>
                        {isUser ? 'ME' : 'AI'}
                      </div>

                      {/* Bubble */}
                      <div className={cn(
                        "flex flex-col max-w-[80%] rounded-2xl p-4 shadow-sm border text-sm",
                        isUser 
                          ? "bg-indigo-600/10 dark:bg-indigo-500/10 border-indigo-500/25 text-theme-text ml-auto" 
                          : "bg-theme-surface border-theme-border/80 text-theme-text mr-auto"
                      )}>
                        {/* Content */}
                        <div className="whitespace-pre-wrap">
                          {isUser ? m.content : renderMessageContent(m.content)}
                        </div>

                        {/* Timestamp & Meta */}
                        <div className="mt-2 text-[9px] text-theme-text-muted flex flex-col gap-2 font-mono font-bold">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              {!m.content.startsWith('![') && (
                                <button
                                  onClick={() => handleCopyText(m.content)}
                                  className={cn(
                                    "font-semibold transition-colors flex items-center gap-0.5 select-none cursor-pointer",
                                    isUser ? "text-indigo-300 hover:text-indigo-200" : "text-indigo-500 hover:text-indigo-600"
                                  )}
                                  title="คัดลอกข้อความ"
                                >
                                  <Copy size={10} />
                                  <span>คัดลอก</span>
                                </button>
                              )}
                            </div>
                            {!isUser && (
                              <span className="uppercase text-[8px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded tracking-wide shrink-0">
                                {m.content.startsWith('![')
                                  ? (getImagePreset(m.modelUsed || '')?.shortName || m.modelUsed || 'AI Image')
                                  : (AVAILABLE_MODELS.find(mod => mod.id === m.modelUsed)?.name || activeModelInfo.name).split(' (')[0]}
                              </span>
                            )}
                          </div>
                          {/* Create image from AI text — avoid when already an image or generating */}
                          {!isUser && !m.content.startsWith('![') && m.content.length > 40 && !isGenerating && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleCreateImageFromMessage(m.content, 'infographic')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 transition-all cursor-pointer select-none"
                                title="ใช้ Nano Banana / GPT Image ทำ infographic จากข้อความนี้"
                              >
                                <Palette size={11} />
                                ทำ Infographic
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCreateImageFromMessage(m.content, 'illustration')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-theme-border bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text transition-all cursor-pointer select-none"
                                title="วาดภาพประกอบจากข้อความนี้"
                              >
                                <Sparkles size={11} />
                                สร้างรูปประกอบ
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* INPUT FORM CONTAINER */}
          <footer className="p-4 border-t border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/40 backdrop-blur-md relative z-10">
            <div className="max-w-3xl mx-auto">
              
              {/* API Key Missing warning just above input */}
              {!apiKey && !drawMode && (
                <div className="mb-2 text-[10px] text-center text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 p-2 rounded-xl flex items-center justify-center gap-1.5 border border-amber-500/10 animate-pulse">
                  <AlertTriangle size={10} />
                  <span>ยังไม่ได้ตั้งค่า API Key! กรุณากรอก API Key ในแถบด้านซ้ายก่อนทำการสนทนา (เว้นแต่จะใช้โหมดสร้างรูปภาพฟรี)</span>
                </div>
              )}

              {/* Image mode: compact summary by default (don't cover chat) */}
              {drawMode && (
                <div className="mb-2 space-y-2 animate-fade-in text-xs">
                  <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-xl border border-violet-500/25 bg-violet-500/5 dark:bg-violet-950/20">
                    <span className="inline-flex items-center gap-1 font-extrabold text-violet-600 dark:text-violet-300 text-[10px] uppercase tracking-wide shrink-0">
                      <Palette size={12} />
                      สร้างรูป
                    </span>
                    <span className="text-[11px] font-bold text-theme-text truncate max-w-[10rem] sm:max-w-none">
                      {drawEngine === 'openrouter'
                        ? (getImagePreset(openrouterImageModel)?.shortName || openrouterImageModel)
                        : 'Cloudflare ฟรี'}
                    </span>
                    <span className="text-[9px] text-theme-text-muted hidden sm:inline">·</span>
                    <span className="text-[10px] text-theme-text-secondary">
                      {drawIntent === 'infographic' ? 'Infographic' : drawIntent === 'thai_text' ? 'ข้อความไทย' : 'ภาพประกอบ'}
                      {' · '}{fluxRatio}
                    </span>
                    {drawSourceText && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                        📎 จากแชท
                      </span>
                    )}
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setImageSettingsOpen((v) => !v)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 cursor-pointer"
                      >
                        {imageSettingsOpen ? 'ซ่อนตั้งค่า' : 'ตั้งค่า'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrawMode(false);
                          setImageSettingsOpen(false);
                          setDrawSourceText('');
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-theme-border text-theme-text-muted hover:text-theme-text cursor-pointer"
                      >
                        ปิด
                      </button>
                    </div>
                  </div>

                  {imageSettingsOpen && (
                    <div className="p-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-violet-950/10 backdrop-blur-md space-y-3 max-h-[min(42vh,360px)] overflow-y-auto custom-scrollbar">
                      {drawSourceText && (
                        <div className="text-[10px] text-theme-text-secondary bg-theme-surface/60 border border-theme-border/50 rounded-xl px-2.5 py-2 line-clamp-2">
                          📎 ต้นทาง: {drawSourceText.slice(0, 160)}{drawSourceText.length > 160 ? '…' : ''}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-theme-text-secondary uppercase">ประเภทงาน</label>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { id: 'infographic' as DrawIntent, label: '📊 Infographic' },
                            { id: 'thai_text' as DrawIntent, label: '🇹🇭 ข้อความไทย' },
                            { id: 'illustration' as DrawIntent, label: '🎨 ภาพประกอบ' },
                          ]).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setDrawIntent(opt.id);
                                const rec = recommendImageModel(opt.id);
                                setDrawEngine('openrouter');
                                setOpenrouterImageModel(rec.id);
                                localStorage.setItem('openrouter_draw_engine', 'openrouter');
                                localStorage.setItem('openrouter_image_model', rec.id);
                                if (opt.id === 'infographic') setFluxRatio('9:16');
                                showToast(`แนะนำ: ${rec.shortName}`, 'info');
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                                drawIntent === opt.id
                                  ? "bg-violet-500/15 border-violet-400 text-violet-700 dark:text-violet-200"
                                  : "border-theme-border text-theme-text-muted hover:text-theme-text"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-theme-text-secondary uppercase">ช่องทาง</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDrawEngine('openrouter');
                              localStorage.setItem('openrouter_draw_engine', 'openrouter');
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border cursor-pointer",
                              drawEngine === 'openrouter'
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                                : "border-theme-border text-theme-text-muted"
                            )}
                          >
                            OpenRouter
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawEngine('flux_cf');
                              localStorage.setItem('openrouter_draw_engine', 'flux_cf');
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border cursor-pointer",
                              drawEngine === 'flux_cf'
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                                : "border-theme-border text-theme-text-muted"
                            )}
                          >
                            Cloudflare ฟรี
                          </button>
                        </div>
                      </div>

                      {drawEngine === 'openrouter' && (
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-theme-text-secondary uppercase">โมเดลรูป</label>
                          <select
                            value={openrouterImageModel}
                            onChange={(e) => {
                              setOpenrouterImageModel(e.target.value);
                              localStorage.setItem('openrouter_image_model', e.target.value);
                            }}
                            className="w-full text-xs font-semibold py-2 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500 cursor-pointer"
                          >
                            {IMAGE_MODEL_PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.shortName} — {p.badge}
                              </option>
                            ))}
                            <option value="black-forest-labs/flux.2-flex">FLUX.2 Flex</option>
                            <option value="black-forest-labs/flux.2-max">FLUX.2 Max</option>
                          </select>
                          {getImagePreset(openrouterImageModel) && (
                            <p className="text-[9px] text-theme-text-muted leading-relaxed">
                              {getImagePreset(openrouterImageModel)!.hint}
                            </p>
                          )}
                        </div>
                      )}

                      {drawEngine === 'flux_cf' && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-2">
                          ⚠️ ฟรีเหมาะภาพ mood — ข้อความไทย/Infographic มักเพี้ยน แนะนำ OpenRouter + Nano Banana 2
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-theme-text-secondary uppercase">สไตล์</label>
                          <select
                            value={fluxStyle}
                            onChange={(e) => setFluxStyle(e.target.value)}
                            className="w-full text-[11px] font-semibold py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface cursor-pointer"
                          >
                            <option value="none">Default</option>
                            <option value="infographic">Infographic</option>
                            <option value="realistic">Realistic</option>
                            <option value="anime">Anime</option>
                            <option value="pixel">Pixel</option>
                            <option value="watercolor">Watercolor</option>
                            <option value="cyberpunk">Cyberpunk</option>
                            <option value="render3d">3D</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-theme-text-secondary uppercase">สัดส่วน</label>
                          <select
                            value={fluxRatio}
                            onChange={(e) => setFluxRatio(e.target.value)}
                            className="w-full text-[11px] font-semibold py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface cursor-pointer"
                          >
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16 Infographic</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Skills Pill Selection Bar - Only visible when Draw Mode is OFF */}
              {!drawMode && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 animate-fade-in">
                  <span className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mr-1 select-none">
                    🎯 ทักษะ AI (Skills):
                  </span>
                  {AI_SKILLS.map(skill => {
                    const isActive = activeSkillId === skill.id;
                    const colorStyles: Record<string, string> = {
                      slate: isActive 
                        ? "bg-slate-500/10 border-slate-500/35 text-slate-700 dark:text-slate-300"
                        : "bg-theme-surface border-theme-border/60 hover:bg-slate-500/5 hover:border-slate-500/30 text-theme-text-secondary hover:text-slate-600 dark:hover:text-slate-300",
                      emerald: isActive 
                        ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-400"
                        : "bg-theme-surface border-theme-border/60 hover:bg-emerald-500/5 hover:border-emerald-500/30 text-theme-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400",
                      violet: isActive 
                        ? "bg-violet-500/10 border-violet-500/35 text-violet-700 dark:text-violet-400"
                        : "bg-theme-surface border-theme-border/60 hover:bg-violet-500/5 hover:border-violet-500/30 text-theme-text-secondary hover:text-violet-600 dark:hover:text-violet-400",
                      amber: isActive 
                        ? "bg-amber-500/10 border-amber-500/35 text-amber-700 dark:text-amber-400"
                        : "bg-theme-surface border-theme-border/60 hover:bg-amber-500/5 hover:border-amber-500/30 text-theme-text-secondary hover:text-amber-600 dark:hover:text-amber-400"
                    };

                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          setActiveSkillId(skill.id);
                          showToast(`สลับใช้งานทักษะ: ${skill.name.replace(/^[^\w\s\u0e00-\u0e7f]+/g, '').trim()}`, 'info');
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all select-none cursor-pointer flex items-center gap-1",
                          colorStyles[skill.color]
                        )}
                      >
                        <span>{skill.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2 bg-theme-surface dark:bg-theme-surface-secondary/70 rounded-2xl border border-theme-border-strong p-1.5 focus-within:border-indigo-500/80 focus-within:shadow-[0_0_12px_rgba(99,102,241,0.05)] transition-all"
              >
                {/* Web Search Toggle Switch — enables OpenRouter web_search for ANY selected model */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !webSearch;
                    setWebSearch(nextVal);
                    if (nextVal) {
                      setDrawMode(false);
                      showToast(
                        `เปิดค้นหาเว็บแล้ว — ใช้โมเดล ${activeModelInfo.name} ค้นหาอินเทอร์เน็ตผ่าน OpenRouter (อาจมีค่าใช้จ่ายเพิ่ม)`,
                        'info'
                      );
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-bold border transition-all shrink-0 select-none",
                    webSearch 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                      : "bg-theme-surface border-theme-border/80 text-theme-text-muted hover:text-theme-text"
                  )}
                  title="ค้นหาข้อมูลจากอินเทอร์เน็ตแบบเรียลไทม์ด้วยโมเดลที่เลือกอยู่ (OpenRouter web search)"
                >
                  <Globe size={14} className={cn(webSearch && "animate-pulse")} />
                  <span className="hidden sm:inline">ค้นหาเว็บ {webSearch ? 'ON' : 'OFF'}</span>
                </button>

                {/* Draw Mode Toggle — separate from chat/web search */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !drawMode;
                    setDrawMode(nextVal);
                    if (nextVal) {
                      setWebSearch(false);
                      setImageSettingsOpen(false);
                      // Prefer text-strong default when opening draw mode blank
                      if (!getImagePreset(openrouterImageModel)) {
                        const rec = recommendImageModel(drawIntent);
                        setDrawEngine('openrouter');
                        setOpenrouterImageModel(rec.id);
                        localStorage.setItem('openrouter_draw_engine', 'openrouter');
                        localStorage.setItem('openrouter_image_model', rec.id);
                      }
                      showToast(
                        'โหมดสร้างรูปพร้อม — กดส่งได้เลย · ตั้งค่าเพิ่มกดปุ่ม「ตั้งค่า」',
                        'info'
                      );
                    } else {
                      setDrawSourceText('');
                      setImageSettingsOpen(false);
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-bold border transition-all shrink-0 select-none",
                    drawMode 
                      ? "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                      : "bg-theme-surface border-theme-border/80 text-theme-text-muted hover:text-theme-text"
                  )}
                  title="โหมดสร้างรูป (OpenRouter: Nano Banana / GPT Image / Flux หรือ Cloudflare ฟรี)"
                >
                  <Palette size={14} className={cn(drawMode && "animate-pulse")} />
                  <span className="hidden sm:inline">สร้างรูป {drawMode ? 'ON' : 'OFF'}</span>
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    drawMode 
                      ? (apiKey 
                          ? (drawSourceText
                              ? "ปรับคำสั่งเพิ่มได้ เช่น 'โทนเขียว หัวข้อใหญ่' แล้วกดส่ง — จะใช้เนื้อหาจากแชทด้วย"
                              : "อธิบายรูปที่อยากได้ (ไทยได้) · Infographic แนะนำ Nano Banana 2...")
                          : "ใส่ API Key ด้านซ้าย หรือใช้ Cloudflare ฟรี (ตัวอักษรไทยอาจเพี้ยน)")
                      : (apiKey 
                          ? (webSearch 
                              ? "ค้นหาและถามคำถามจากอินเทอร์เน็ตสดๆ..." 
                              : (AI_SKILLS.find(s => s.id === activeSkillId)?.placeholder || "พิมพ์คำถามของคุณเพื่อคุยกับ AI..."))
                          : "กรุณาใส่ API Key ด้านซ้ายเพื่อเริ่มสนทนา")
                  }
                  disabled={(!apiKey && !drawMode) || isGenerating}
                  rows={1}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-theme-text placeholder-theme-text-muted py-2.5 px-3 resize-none max-h-32 min-h-[38px] leading-relaxed custom-scrollbar disabled:opacity-50"
                />
                
                <button
                  type="submit"
                  disabled={(!apiKey && !drawMode) || !input.trim() || isGenerating}
                  className={cn(
                    "p-2.5 rounded-xl flex items-center justify-center text-white transition-all scale-95 hover:scale-100 disabled:opacity-50 disabled:scale-95 shrink-0",
                    isGenerating
                      ? "bg-slate-600 cursor-not-allowed"
                      : "bg-indigo-500 hover:bg-indigo-600 hover:shadow-md hover:shadow-indigo-500/15"
                  )}
                  title="ส่งข้อความ"
                >
                  {isGenerating ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </form>
              
              <div className="mt-1.5 text-center text-[9px] text-theme-text-muted font-semibold tracking-wide flex items-center justify-center gap-1">
                <span>ผู้ให้บริการระบบ OpenRouter API | ข้อมูลจะถูกคุ้มครองตามข้อกำหนดนโยบายความเป็นส่วนตัวของ API Provider</span>
                {webSearch && <span className="text-indigo-500">• ค้นหาเว็บ ON — ใช้โมเดลปัจจุบัน + OpenRouter search (มีค่าใช้จ่ายเพิ่มได้)</span>}
                {drawMode && (
                  <span className="text-violet-500">
                    • สร้างรูป ON — {drawEngine === 'openrouter'
                      ? (getImagePreset(openrouterImageModel)?.shortName || openrouterImageModel)
                      : 'Cloudflare ฟรี'}
                    {drawSourceText ? ' · มีเนื้อหาจากแชท' : ''}
                  </span>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* SEARCH MODELS MODAL */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[88vh] text-theme-text animate-scale-in">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-theme-border/50 bg-theme-surface-secondary/40 flex justify-between items-center shrink-0 gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-base">ค้นหาโมเดล OpenRouter ทั้งหมด</h3>
                <p className="text-xs text-theme-text-muted mt-1">
                  เลือกจากโมเดล Live — กรองตามประเภทงานเพื่อไม่ให้เลือกโมเดลผิดโจทย์
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                  setModelCategoryFilter('all');
                  setModelTierFilter('all');
                }}
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-secondary transition-all cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search + Filters */}
            <div className="px-5 py-4 border-b border-theme-border/30 bg-theme-surface-secondary/20 space-y-3 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหา เช่น claude, gemini, gpt, deepseek, llama..."
                  className="flex-1 text-sm py-2.5 px-3.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                />
                {isLoadingModels && (
                  <div className="flex items-center justify-center px-2">
                    <RefreshCw size={16} className="animate-spin text-indigo-500" />
                  </div>
                )}
              </div>

              {/* Use-case category filters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                    เหมาะสำหรับ (ประเภทงาน)
                  </span>
                  {(modelCategoryFilter !== 'all' || modelTierFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setModelCategoryFilter('all');
                        setModelTierFilter('all');
                      }}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer shrink-0"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-active={modelCategoryFilter === 'all'}
                    onClick={() => setModelCategoryFilter('all')}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                      "border-theme-border text-theme-text-secondary data-[active=true]:bg-indigo-500/15 data-[active=true]:border-indigo-400 data-[active=true]:text-indigo-700 dark:data-[active=true]:text-indigo-200"
                    )}
                  >
                    ทั้งหมด
                  </button>
                  {(Object.keys(MODEL_CATEGORY_META) as ModelCategory[]).map((cat) => {
                    const meta = MODEL_CATEGORY_META[cat];
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={cat}
                        type="button"
                        title={meta.hint}
                        data-active={modelCategoryFilter === cat}
                        onClick={() => setModelCategoryFilter(cat)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                          meta.chipClass
                        )}
                      >
                        <Icon size={12} />
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>
                {/* Tier filter */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <span className="text-[10px] font-bold text-theme-text-muted self-center mr-0.5">ราคา:</span>
                  {([
                    { id: 'all' as const, label: 'ทุก tier' },
                    { id: 'free' as const, label: 'Free' },
                    { id: 'paid' as const, label: 'Paid' },
                  ]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      data-active={modelTierFilter === t.id}
                      onClick={() => setModelTierFilter(t.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                        "border-theme-border text-theme-text-secondary data-[active=true]:bg-emerald-500/15 data-[active=true]:border-emerald-400 data-[active=true]:text-emerald-700 dark:data-[active=true]:text-emerald-200"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {modelCategoryFilter === 'web' && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 leading-relaxed">
                    💡 โมเดลป้าย <strong>ค้นหาเว็บ</strong> (เช่น Perplexity) เก่งค้นหาเป็นพิเศษ
                    — แต่โมเดลอื่นก็ค้นหาได้เมื่อกดปุ่ม <strong>ค้นหาเว็บ ON</strong> ผ่าน OpenRouter web search
                  </p>
                )}
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
              {isLoadingModels && fetchedModels.length === 0 ? (
                <div className="py-12 text-center text-sm text-theme-text-muted animate-pulse">
                  กำลังโหลดรายการโมเดลล่าสุดจาก OpenRouter...
                </div>
              ) : filteredSearchModels.length === 0 ? (
                <div className="py-12 text-center text-sm text-theme-text-muted space-y-2">
                  <p>ไม่พบโมเดลตามเงื่อนไขที่เลือก</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModelCategoryFilter('all');
                      setModelTierFilter('all');
                    }}
                    className="text-indigo-500 font-bold hover:underline cursor-pointer"
                  >
                    ล้างตัวกรองและลองใหม่
                  </button>
                </div>
              ) : (
                filteredSearchModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      handleModelChange(m.id);
                      setCustomModelId(m.id);
                      setIsSearchModalOpen(false);
                      setSearchQuery('');
                      setModelCategoryFilter('all');
                      setModelTierFilter('all');
                    }}
                    className="w-full text-left px-4 py-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors rounded-xl flex flex-col gap-2 group cursor-pointer border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/10"
                  >
                    <div className="flex items-start justify-between w-full gap-3">
                      <span className="text-sm font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {m.name}
                      </span>
                      <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.tier === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25' 
                          : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/25'
                      }`}>
                        {m.tier === 'paid' ? 'Paid' : 'Free'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-theme-text-muted select-all">
                      {m.id}
                    </span>
                    {/* Capability badges */}
                    {m.categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.categories
                          .filter((c) => c !== 'general' || m.categories.length === 1)
                          .slice(0, 5)
                          .map((c) => {
                            const meta = MODEL_CATEGORY_META[c];
                            if (!meta) return null;
                            const Icon = meta.Icon;
                            return (
                              <span
                                key={c}
                                title={meta.hint}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                  meta.badgeClass
                                )}
                              >
                                <Icon size={11} />
                                {meta.shortLabel}
                              </span>
                            );
                          })}
                        {m.categories.includes('general') && m.categories.length > 1 && (
                          <span
                            title={MODEL_CATEGORY_META.general.hint}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                              MODEL_CATEGORY_META.general.badgeClass
                            )}
                          >
                            <MessagesSquare size={11} />
                            ทั่วไป
                          </span>
                        )}
                      </div>
                    )}
                    {m.description && (
                      <p className="text-xs text-theme-text-secondary leading-relaxed line-clamp-2">
                        {m.description}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-theme-border/50 bg-theme-surface-secondary/40 text-[11px] text-theme-text-muted flex justify-between items-center shrink-0 gap-3">
              <span>
                แสดง {filteredSearchModels.length.toLocaleString()} / {fetchedModels.length.toLocaleString()} รายการ
              </span>
              <button
                onClick={async () => {
                  setFetchedModels([]);
                  setIsLoadingModels(true);
                  try {
                    const res = await fetch("https://openrouter.ai/api/v1/models");
                    if (res.ok) {
                      const json = await res.json();
                      if (json && Array.isArray(json.data)) {
                        setFetchedModels(json.data.map(mapOpenRouterModel));
                        showToast('อัปเดตรายชื่อโมเดลเรียบร้อย!', 'success');
                      }
                    }
                  } catch (err) {
                    console.error("Re-fetch failed:", err);
                    showToast('รีเฟรชข้อมูลล้มเหลว', 'error');
                  } finally {
                    setIsLoadingModels(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 hover:text-theme-text font-bold transition-all cursor-pointer shrink-0"
              >
                <RefreshCw size={12} className={isLoadingModels ? "animate-spin" : ""} /> รีเฟรชรายการ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM CLEAR MODAL */}
      {clearModalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 p-6 shadow-2xl relative animate-scale-in">
            <div className="flex gap-4 items-start">
              <div className={cn(
                "p-3 rounded-full shrink-0",
                clearModalType === 'history' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
              )}>
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-theme-text">
                  {clearModalType === 'history' ? 'ยืนยันการล้างประวัติการแชท?' : 'ยืนยันการล้าง API Key?'}
                </h3>
                <p className="text-xs text-theme-text-secondary leading-relaxed">
                  {clearModalType === 'history' 
                    ? 'การดำเนินการนี้จะลบประวัติการสนทนาทั้งหมดของคุณออกจากเว็บบราวเซอร์อย่างถาวร โดยยังคงรักษา API Key ไว้' 
                    : 'การดำเนินการนี้จะลบ OpenRouter API Key ออกจากเว็บบราวเซอร์ โดยยังคงเก็บประวัติการสนทนาทั้งหมดของคุณไว้'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setClearModalType(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text transition-all select-none cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={clearModalType === 'history' ? handleClearHistory : handleClearApiKey}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-md transition-all select-none cursor-pointer",
                  clearModalType === 'history' 
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/15" 
                    : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/15"
                )}
              >
                {clearModalType === 'history' ? 'ล้างประวัติแชท' : 'ล้าง API Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
