import { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, Plus, Sparkles, Key, Eye, EyeOff, 
  Shield, Cpu, AlertTriangle, RefreshCw, MessageSquare, Info, ShieldAlert, Trash, Globe, Palette, Copy
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

interface ModelInfo {
  id: string;
  name: string;
  tier: 'free' | 'paid';
  description: string;
  privacy: string;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  // Paid Tier (Recommended for Business/Sensitive Data)
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (Paid)',
    tier: 'paid',
    description: 'โมเดลที่ดีที่สุดในปัจจุบันด้านงานวิเคราะห์ เขียนโค้ด และใช้เหตุผลเชิงลึก',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ'
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5 (Paid)',
    tier: 'paid',
    description: 'โมเดลความเร็วสูง หน้าต่างบริบทใหญ่พิเศษ เหมาะสำหรับการประมวลผลเอกสารหรือเนื้อหายาวๆ',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ'
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Paid)',
    tier: 'paid',
    description: 'โมเดลประสิทธิภาพสูงรอบด้านจาก OpenAI ฉลาดและตอบคำถามภาษาไทยได้ดี',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (Paid)',
    tier: 'paid',
    description: 'โมเดลขนาดเล็ก ทำงานเร็วมาก และราคาประหยัดอย่างคุ้มค่าจาก OpenAI',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash (Paid)',
    tier: 'paid',
    description: '⚡ โมเดล MoE สถาปัตยกรรมล่าสุด ความเร็วสูงเป็นพิเศษระดับ 284B จาก DeepSeek',
    privacy: '🔒 ปลอดภัยสูงสุด: มีนโยบาย Data Privacy ไม่นำข้อมูล API ไปฝึกสอนโมเดลต่อ'
  },
  {
    id: 'perplexity/sonar',
    name: 'Perplexity Sonar Search (Paid)',
    tier: 'paid',
    description: '🌐 โมเดลพร้อมทักษะค้นหาเว็บเรียลไทม์ เหมาะสำหรับการสรุปข่าวสารล่าสุดในอินเทอร์เน็ต',
    privacy: '🔒 ปลอดภัย: มีนโยบายรักษาความเป็นส่วนตัวในการเข้าถึงข้อมูลผ่าน API'
  },
  {
    id: 'perplexity/sonar-reasoning',
    name: 'Perplexity Sonar Reasoning (Paid)',
    tier: 'paid',
    description: '🧠 โมเดลค้นหาข้อมูลอินเทอร์เน็ตเชิงลึก พร้อมการคิดวิเคราะห์หลายขั้นตอนก่อนตอบคำถาม',
    privacy: '🔒 ปลอดภัย: มีนโยบายรักษาความเป็นส่วนตัวในการเข้าถึงข้อมูลผ่าน API'
  },
  // Free Tier (For standard queries/non-sensitive data)
  {
    id: 'openrouter/free',
    name: 'Auto Free Router (Free - แนะนำ)',
    tier: 'free',
    description: 'สลับเลือกโมเดลใช้งานฟรีที่เปิดให้บริการอยู่แบบอัตโนมัติ แก้ปัญหาโมเดลปลายทางออฟไลน์',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Free)',
    tier: 'free',
    description: 'โมเดลรุ่นทดลองรวดเร็วจาก Google ตอบสนองคำสั่งแบบกระชับฉับไว',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
  },
  {
    id: 'meta-llama/llama-3-8b-instruct:free',
    name: 'Llama 3 8B (Free)',
    tier: 'free',
    description: 'โมเดลแชทระดับกลางยอดนิยมจาก Meta ตอบสนองรวดเร็วเป็นธรรมชาติ',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
  },
  {
    id: 'qwen/qwen-2-7b-instruct:free',
    name: 'Qwen 2 7B (Free)',
    tier: 'free',
    description: 'โมเดลที่โดดเด่นในด้านความเร็วและไวยากรณ์ภาษาทั่วไป',
    privacy: '⚠️ ความปลอดภัยทั่วไป: ข้อมูลอาจถูกรวบรวมเพื่อใช้พัฒนาคุณภาพบริการ'
  }
];

const QUICK_PROMPTS = [
  { label: '🎨 วาดภาพอนาคตของกรุงเทพฯ', text: 'A futuristic hyper-detailed digital art of Bangkok with flying vehicles, glowing signs, and green skyscrapers, cinematic lighting, 8k', isDrawPrompt: true },
  { label: '📰 สรุปข่าวเทคโนโลยีล่าสุด', text: 'ช่วยค้นหาข้อมูลและสรุปข่าวสารล่าสุดเกี่ยวกับเทคโนโลยี AI ในรอบสัปดาห์นี้ให้หน่อย' },
  { label: '📝 สรุปงานประจำวัน', text: 'ช่วยสรุปรายงานการทำงานประจำวันของฉันให้เป็นข้อๆ อย่างเป็นระเบียบตามข้อมูลนี้: [พิมพ์ประเด็นงานที่นี่]' },
  { label: '✉️ เขียนอีเมลลาหยุดสุภาพ', text: 'ช่วยเขียนอีเมลสำหรับส่งแจ้งผู้บริหารเพื่อขอลาหยุดพักผ่อน 1 วันเป็นภาษาไทยอย่างสุภาพเป็นทางการหน่อย' }
];

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

  // Flux Custom Parameters
  const [fluxStyle, setFluxStyle] = useState<string>('none');
  const [fluxRatio, setFluxRatio] = useState<string>('1:1');
  const [fluxSteps, setFluxSteps] = useState<number>(4);

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
  const activeModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const handleSaveApiKey = () => {
    localStorage.setItem('openrouter_chat_api_key', apiKey.trim());
    setIsEditingKey(false);
    showToast('บันทึก OpenRouter API Key สำเร็จ!', 'success');
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('openrouter_chat_model', modelId);
    showToast(`สลับโมเดลเป็น ${AVAILABLE_MODELS.find(m => m.id === modelId)?.name}`, 'info');

    // Automatically toggle webSearch visual helper based on model
    if (modelId.startsWith('perplexity/')) {
      setWebSearch(true);
      setDrawMode(false);
    } else {
      setWebSearch(false);
    }
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

  const translatePromptToEnglish = async (thaiPrompt: string, key: string, activeModel: string): Promise<string> => {
    // List of models to try in order of preference
    const modelsToTry = [
      activeModel,
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3-8b-instruct:free",
      "qwen/qwen-2-7b-instruct:free",
      "openrouter/free"
    ];

    let lastError = "";

    // 1. Try OpenRouter translation if key is available
    if (key.trim()) {
      for (const model of modelsToTry) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${key}`,
              "HTTP-Referer": window.location.origin,
              "X-Title": "Worklog AI Chat Prompt Translator",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "user",
                  content: `Translate the following prompt into a detailed English image prompt for Flux. Output ONLY the English translation. Do not include quotes, intro, or explanations.\n\nPrompt: ${thaiPrompt}`
                }
              ],
              temperature: 0.3,
              max_tokens: 150
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.error) {
              lastError = data.error.message || `API error (${data.error.code})`;
            } else {
              const translated = data.choices?.[0]?.message?.content?.trim();
              if (translated && translated.length > 0) {
                const cleaned = translated.replace(/^["'`]|["'`]$/g, '');
                // Verify that it translated and doesn't still contain Thai characters
                const hasThai = /[\u0e00-\u0e7f]/.test(cleaned);
                if (!hasThai) {
                  console.log(`Successfully translated using model ${model}:`, cleaned);
                  return cleaned;
                } else {
                  lastError = `โมเดล ${model} คืนค่าเป็นภาษาไทยดิบ`;
                }
              } else {
                lastError = `โมเดล ${model} ส่งคำตอบว่างเปล่า`;
              }
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            lastError = errData?.error?.message || `HTTP error ${response.status}`;
          }
        } catch (err: any) {
          lastError = err.message || "Network error";
          console.warn(`Translation attempt with model ${model} failed:`, err);
        }
      }
    } else {
      lastError = "ไม่มี API Key (ข้ามการใช้ OpenRouter)";
    }

    // 2. Fallback to free public MyMemory Translation API to at least translate the words to English!
    try {
      console.log("Attempting fallback translation via MyMemory API...");
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(thaiPrompt)}&langpair=th|en`;
      const myMemoryRes = await fetch(myMemoryUrl);
      if (myMemoryRes.ok) {
        const myMemoryData = await myMemoryRes.json();
        const translatedText = myMemoryData?.responseData?.translatedText?.trim();
        if (translatedText && translatedText.length > 0) {
          const hasThai = /[\u0e00-\u0e7f]/.test(translatedText);
          if (!hasThai) {
            console.log("Successfully translated using MyMemory API:", translatedText);
            return translatedText;
          }
        }
      }
    } catch (mymemoryErr) {
      console.warn("MyMemory translation fallback failed:", mymemoryErr);
    }

    console.warn("All translation attempts failed. Last error:", lastError);
    showToast(`ระบบแปลคำสั่งขัดข้อง (${lastError}) จะส่งคำสั่งเดิมไปวาดรูป`, 'warning');
    return thaiPrompt;
  };

  const handleSendMessage = async (customPrompt?: string, forceDraw = false) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isGenerating) return;
    
    const isDrawing = forceDraw || drawMode;

    if (!isDrawing && !apiKey.trim()) {
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

    // Add assistant processing placeholder
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: isDrawing ? '⏳ กำลังแปลและปรับแต่งคำสั่งภาพ (Step 1/2)...' : 'กำลังพิมพ์คำตอบ...',
      timestamp: new Date().toISOString()
    };
    targetSession.messages = [...targetSession.messages, assistantPlaceholder];
    
    updatedSessions[sessionIndex] = targetSession;
    setSessions(updatedSessions);
    setInput('');
    setIsGenerating(true);

    // B. IMAGE GENERATION WORKFLOW (Flux Worker)
    if (isDrawing) {
      let finalPrompt = textToSend;
      let translationStatus = '';
      
      // Always attempt to translate the prompt for Flux (uses OpenRouter first, then keyless MyMemory fallback)
      finalPrompt = await translatePromptToEnglish(textToSend, apiKey, selectedModel);
      
      // Verify that it translated successfully and does not contain Thai characters
      const hasThai = /[\u0e00-\u0e7f]/.test(finalPrompt);
      if (!hasThai) {
        const isEnhanced = finalPrompt !== textToSend;
        if (isEnhanced) {
          translationStatus = `✓ แปลและปรับแต่งคำสั่งสำเร็จ (Step 1/2):\n"${finalPrompt}"\n\n⏳ กำลังส่งคำสั่งไปวาดรูปด้วย Flux (Step 2/2)...`;
        } else {
          translationStatus = `✓ แปลคำสั่งสำเร็จ (Step 1/2):\n"${finalPrompt}"\n\n⏳ กำลังส่งคำสั่งไปวาดรูปด้วย Flux (Step 2/2)...`;
        }
      } else {
        translationStatus = `⚠️ การแปลคำสั่งขัดข้อง (Step 1/2):\nใช้ภาษาไทยเดิม: "${textToSend}"\n\n⏳ กำลังส่งคำสั่งไปวาดรูปด้วย Flux (Step 2/2)...`;
      }

      // Update session UI text with Step 1 translation status
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
          render3d: ", 3D clay toy model style, blender octane render, cute cartoon render, smooth plastics and clay textures"
        };
        const suffix = styleSuffixes[fluxStyle];
        if (suffix) {
          promptWithStyle = `${finalPrompt}${suffix}`;
        }
      }

      try {
        const response = await fetch("https://flux-image-generator.play2earn.workers.dev/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: promptWithStyle,
            steps: fluxSteps,
            aspectRatio: fluxRatio
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `HTTP error (${response.status})`);
        }

        const blob = await response.blob();
        
        // Convert blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;

          setSessions(prevSessions => {
            const updated = prevSessions.map(s => {
              if (s.id === currentSessionId) {
                const messagesCopy = [...s.messages];
                messagesCopy[messagesCopy.length - 1] = {
                  role: 'assistant',
                  content: `![${promptWithStyle}](${base64data})`,
                  timestamp: new Date().toISOString()
                };
                return { ...s, messages: messagesCopy };
              }
              return s;
            });
            setTimeout(() => safeSaveSessions(updated), 0);
            return updated;
          });
          setIsGenerating(false);
        };
      } catch (err: any) {
        console.error("Flux image generation failed:", err);
        showToast(`สร้างรูปภาพล้มเหลว: ${err.message}`, 'error');
        
        setSessions(prevSessions => {
          const updated = prevSessions.map(s => {
            if (s.id === currentSessionId) {
              const messagesCopy = [...s.messages];
              messagesCopy[messagesCopy.length - 1] = {
                role: 'assistant',
                content: `${translationStatus}\n\n❌ เกิดข้อผิดพลาดในการสร้างภาพ (Step 2/2): ${err.message}\n\nกรุณาตรวจสอบการเชื่อมต่อกับระบบ Flux Image Generator`,
                timestamp: new Date().toISOString()
              };
              return { ...s, messages: messagesCopy };
            }
            return s;
          });
          setTimeout(() => safeSaveSessions(updated), 0);
          return updated;
        });
        setIsGenerating(false);
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

      // Determine model based on webSearch toggle
      requestModel = webSearch
        ? (selectedModel.startsWith('perplexity/') ? selectedModel : 'perplexity/sonar')
        : selectedModel;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Worklog AI Chat",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: requestModel,
          messages: messagesToSend,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `API error (${response.status})`);
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
    const imgMatch = text.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1];
      const imageUrl = imgMatch[2];

      return (
        <div className="space-y-3 my-2 max-w-full">
          <div className="rounded-2xl border border-theme-border/60 overflow-hidden bg-slate-900/5 dark:bg-slate-950/20 max-w-sm shadow-md">
            <img 
              src={imageUrl} 
              alt={altText} 
              className="max-w-full h-auto object-cover select-text block transition-transform hover:scale-[1.01]" 
            />
            <div className="p-3 border-t border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-theme-text-muted font-bold tracking-wide">โมเดล Flux-1-schnell</span>
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
            <div>
              <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                เลือกปัญญาประดิษฐ์ (Model)
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-theme-border-strong bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
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
              </select>
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
                <p className="text-[10px] text-theme-text-muted truncate mt-0.5">
                  {activeModelInfo.description}
                </p>
              </div>
            </div>
            
            {/* Mobile indicator showing configs */}
            <div className="md:hidden flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="text-[10px] font-semibold py-1.5 px-2.5 rounded-lg border border-theme-border-strong bg-theme-surface text-theme-text focus:outline-none"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.tier === 'paid' ? '🔒' : '⚠️'} {m.name}</option>
                ))}
              </select>
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
                        <div className="mt-2 text-[9px] text-theme-text-muted flex items-center justify-between gap-4 font-mono font-bold">
                          <div className="flex items-center gap-2">
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
                            <span className="uppercase text-[8px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded tracking-wide">
                              {m.content.startsWith('![') 
                                ? 'Flux Image' 
                                : (AVAILABLE_MODELS.find(mod => mod.id === m.modelUsed)?.name || activeModelInfo.name).split(' (')[0]}
                            </span>
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

              {/* Flux Parameter Settings Drawer - Only visible when Draw Mode is ON */}
              {drawMode && (
                <div className="mb-3 p-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-violet-950/10 backdrop-blur-md space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-violet-500/10 pb-2">
                    <span className="font-extrabold text-violet-600 dark:text-violet-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <Palette size={12} className="animate-pulse" />
                      ตั้งค่าการสร้างรูปภาพ (Flux Settings)
                    </span>
                    <span className="text-[9px] text-theme-text-muted">ปรับแต่งสไตล์และสัดส่วนภาพถ่าย</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Style Preset */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-secondary uppercase">สไตล์ภาพ (Style)</label>
                      <select
                        value={fluxStyle}
                        onChange={(e) => setFluxStyle(e.target.value)}
                        className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="none">ตามที่พิมพ์ (Default)</option>
                        <option value="realistic">📸 ภาพถ่ายสมจริง (Realistic)</option>
                        <option value="anime">🎨 การ์ตูน/อนิเมะ (Anime)</option>
                        <option value="pixel">👾 พิกเซลอาร์ต (Pixel Art)</option>
                        <option value="watercolor">🖌️ ภาพวาดสีน้ำ (Watercolor)</option>
                        <option value="cyberpunk">🌌 ไซเบอร์พังก์ (Cyberpunk)</option>
                        <option value="render3d">🧸 เรนเดอร์ 3D (3D Toy/Clay)</option>
                      </select>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-secondary uppercase">สัดส่วนภาพ (Aspect Ratio)</label>
                      <select
                        value={fluxRatio}
                        onChange={(e) => setFluxRatio(e.target.value)}
                        className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="1:1">1:1 สี่เหลี่ยมจัตุรัส</option>
                        <option value="16:9">16:9 แนวนอนกว้าง</option>
                        <option value="9:16">9:16 แนวตั้งมือถือ</option>
                        <option value="4:3">4:3 รูปถ่ายคลาสสิก</option>
                        <option value="3:4">3:4 แนวตั้งคลาสสิก</option>
                      </select>
                    </div>

                    {/* Quality / Steps */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-secondary uppercase">ระดับความละเอียด (Quality)</label>
                      <select
                        value={fluxSteps}
                        onChange={(e) => setFluxSteps(Number(e.target.value))}
                        className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="4">ด่วน (4 Steps - มาตรฐาน)</option>
                        <option value="8">สูง (8 Steps - คมชัด)</option>
                        <option value="12">สูงสุด (12 Steps - รายละเอียดครบ)</option>
                      </select>
                    </div>
                  </div>
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
                {/* Web Search Toggle Switch */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !webSearch;
                    setWebSearch(nextVal);
                    if (nextVal) {
                      setDrawMode(false);
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-bold border transition-all shrink-0 select-none",
                    webSearch 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                      : "bg-theme-surface border-theme-border/80 text-theme-text-muted hover:text-theme-text"
                  )}
                  title="ค้นหาข้อมูลจากอินเทอร์เน็ตแบบเรียลไทม์ (Web Search)"
                >
                  <Globe size={14} className={cn(webSearch && "animate-pulse")} />
                  <span className="hidden sm:inline">ค้นหาเว็บ {webSearch ? 'ON' : 'OFF'}</span>
                </button>

                {/* Draw Mode Toggle Switch */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !drawMode;
                    setDrawMode(nextVal);
                    if (nextVal) {
                      setWebSearch(false);
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-bold border transition-all shrink-0 select-none",
                    drawMode 
                      ? "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                      : "bg-theme-surface border-theme-border/80 text-theme-text-muted hover:text-theme-text"
                  )}
                  title="สร้างภาพวาดฟรีผ่านโมเดล Flux-1-schnell"
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
                          ? "พิมพ์ภาษาไทยได้เลย! AI จะแปลและวาดรูปอัจฉริยะด้วย Flux อัตโนมัติ..." 
                          : "พิมพ์คำอธิบายรูปภาพภาษาอังกฤษเพื่อภาพที่ตรงปก (หรือใส่ API Key ด้านซ้ายเพื่อแปลไทยออโต้)...")
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
                {webSearch && <span className="text-indigo-500">• กำลังใช้งานการค้นหาเว็บเรียลไทม์</span>}
                {drawMode && <span className="text-violet-500">• กำลังใช้งานโหมดสร้างรูปภาพด้วย Flux</span>}
              </div>
            </div>
          </footer>
        </div>
      </div>

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
