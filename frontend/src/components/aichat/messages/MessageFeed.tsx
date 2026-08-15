import React, { useRef, useEffect } from 'react';
import { Sparkles, ShieldCheck, Zap, Bot, ArrowRight } from 'lucide-react';
import type { Message } from '../../../hooks/useChatSessions';
import { MessageItem } from './MessageItem';

interface MessageFeedProps {
  messages: Message[];
  isStreaming?: boolean;
  hasApiKey: boolean;
  onSendQuickPrompt: (prompt: string, isDraw?: boolean) => void;
  onCopyText: (text: string) => void;
  onRegenerateLast?: () => void;
  onEditPrompt?: (content: string) => void;
  onGenerateImageFromText?: (text: string) => void;
  onOpenInCanvas?: (content: string, title?: string) => void;
  onOpenApiKeyModal: () => void;
  onFetchWorklogSummary?: () => void;
}

const QUICK_PROMPTS = [
  {
    title: '📊 สรุปงานประจำสัปดาห์ (Worklog)',
    desc: 'ดึงข้อมูลการลงเวลาของฉันจากระบบมาเรียบเรียงเป็นรายงาน',
    prompt: 'ช่วยสรุปบันทึกการทำงาน Worklog ของฉันในรอบสัปดาห์นี้ให้เป็นรายงานผลงานประจำวันแบบมืออาชีพ',
    isWorklog: true,
  },
  {
    title: '📅 วางแผนงานโครงการ (Agile PM)',
    desc: 'แตกเป้าหมายโครงการออกเป็น Sub-tasks และประเมินความเสี่ยง',
    prompt: 'ช่วยวางแผนแตกงานย่อย (Sub-tasks) สำหรับโครงการ: [ระบุชื่อโครงการ] พร้อมประเมินระยะเวลาและลำดับความสำคัญ',
  },
  {
    title: '🎨 สร้างโปสเตอร์ Infographic สวยงาม',
    desc: 'วาดภาพ Infographic สรุปข้อมูลภาษาไทยคมชัด',
    prompt: 'A modern clean corporate infographic poster summarizing AI benefits with clean layout, pastel colors, 8k',
    isDraw: true,
  },
  {
    title: '💡 วิเคราะห์และตรวจสอบโค้ด / SQL',
    desc: 'หา Root Cause บั๊ก ปรับปรุง Performance และ Best Practices',
    prompt: 'ช่วยตรวจสอบโค้ด/คำสั่ง SQL ต่อไปนี้ว่ามีจุดผิดพลาดหรือสามารถ Optimize ให้เร็วขึ้นได้อย่างไร: [วางโค้ดที่นี่]',
  },
];

export const MessageFeed: React.FC<MessageFeedProps> = ({
  messages,
  isStreaming = false,
  hasApiKey,
  onSendQuickPrompt,
  onCopyText,
  onRegenerateLast,
  onEditPrompt,
  onGenerateImageFromText,
  onOpenInCanvas,
  onOpenApiKeyModal,
  onFetchWorklogSummary,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          {/* Hero Welcome */}
          <div className="text-center space-y-3 pt-6">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
              <Bot size={28} className="animate-pulse" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-theme-text tracking-tight">
              Worklog AI Workspace
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-secondary max-w-lg mx-auto leading-relaxed">
              ผู้ช่วยอัจฉริยะระดับองค์กร ช่วยสรุปบันทึกงาน วางแผนโครงการ เขียนโค้ด และสร้างภาพ Infographic
            </p>
          </div>

          {/* API Key Notice */}
          {!hasApiKey && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Zap size={18} className="text-amber-500 shrink-0" />
                <span>ยังไม่ได้ตั้งค่า OpenRouter API Key สำหรับโมเดล AI</span>
              </div>
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 shadow-sm transition-all cursor-pointer"
              >
                ตั้งค่าคีย์
              </button>
            </div>
          )}

          {/* Quick Prompt Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-500" />
                คำถามและคำสั่งด่วน (Quick Prompts)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (qp.isWorklog && onFetchWorklogSummary) {
                      onFetchWorklogSummary();
                    } else {
                      onSendQuickPrompt(qp.prompt, qp.isDraw);
                    }
                  }}
                  className="p-3.5 text-left rounded-2xl border border-theme-border bg-theme-surface/70 hover:bg-theme-surface hover:border-indigo-500/50 hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-theme-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {qp.title}
                    </span>
                    <ArrowRight size={14} className="text-theme-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed line-clamp-2">
                    {qp.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy & Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-theme-surface/60 border border-theme-border/60 flex items-start gap-3 text-xs text-theme-text-secondary">
            <ShieldCheck size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-theme-text">🔒 ความเป็นส่วนตัวและความปลอดภัยระดับองค์กร:</span>
              <p className="text-[11px] leading-relaxed">
                การสนทนาและ API Key ถูกจัดเก็บไว้ในเบราว์เซอร์เครื่องของคุณ 100% ไม่มีบันทึกในเซิร์ฟเวอร์กลาง ปลอดภัยต่อข้อมูลความลับภายใน
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((m, idx) => (
          <MessageItem
            key={idx}
            message={m}
            isStreaming={isStreaming && idx === messages.length - 1 && m.role === 'assistant'}
            onCopyText={onCopyText}
            onRegenerate={idx === messages.length - 1 && m.role === 'assistant' ? onRegenerateLast : undefined}
            onEditPrompt={onEditPrompt}
            onGenerateImageFromText={onGenerateImageFromText}
            onOpenInCanvas={onOpenInCanvas}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};
