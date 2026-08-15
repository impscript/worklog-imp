/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Globe, Palette, Database } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface AISkill {
  id: string;
  name: string;
  placeholder: string;
  systemPrompt: string;
}

export const AI_SKILLS: AISkill[] = [
  {
    id: 'none',
    name: '🔍 ทั่วไป',
    placeholder: 'พิมพ์คำถามของคุณเพื่อคุยกับ AI...',
    systemPrompt: '',
  },
  {
    id: 'summarize',
    name: '📝 สรุปงานประจำวัน',
    placeholder: 'พิมพ์บันทึกการทำงาน เพื่อเรียบเรียงเป็นรายงานประจำวันส่งหัวหน้า...',
    systemPrompt:
      'คุณคือ "ผู้เชี่ยวชาญด้านการบันทึกงานประจำวันของ Worklog" หน้าที่ของคุณคือการวิเคราะห์และเรียบเรียงข้อมูลประวัติการทำงานดิบที่ผู้ใช้พิมพ์เข้ามา ให้กลายเป็นรายงานผลการทำงานประจำวันระดับมืออาชีพอย่างเป็นทางการ\n\nเกณฑ์ในการจัดรูปแบบ:\n1. แยกแยะเนื้อหาออกเป็น 3 หัวข้อหลัก:\n   - 🎯 งานที่ทำเสร็จสิ้นแล้ว (Completed Tasks)\n   - ⏳ งานที่กำลังดำเนินการอยู่ (In-Progress Tasks)\n   - ⚠️ อุปสรรคหรือปัญหาที่พบ (Blockers / Challenges)\n2. ปรับแต่งภาษาเป็นภาษาไทยที่เป็นทางการ สุภาพ กระชับ',
  },
  {
    id: 'plan',
    name: '📅 วางแผนงาน (PM)',
    placeholder: 'พิมพ์เป้าหมายโครงการ เพื่อแตกงานออกเป็นส่วนย่อย...',
    systemPrompt:
      'คุณคือ "ผู้เชี่ยวชาญการวางแผนโครงการ Agile PM" วิเคราะห์เป้าหมายโครงการหรือหัวข้องาน แล้วแตกออกมาเป็นแผนการทำงานย่อย (Sub-tasks) พร้อมประเมินระยะเวลา (Estimates) และความเสี่ยง',
  },
  {
    id: 'debug',
    name: '💡 แก้โค้ด & ไอที',
    placeholder: 'พิมพ์โค้ด หรือคำสั่ง SQL เพื่อให้ AI ช่วยวิเคราะห์...',
    systemPrompt:
      'คุณคือ "สถาปนิกและนักพัฒนาซอฟต์แวร์ระดับอาวุโส" หน้าที่ของคุณคือการตรวจสอบข้อผิดพลาด ดักจับบั๊ก หรือให้แนวคิดการออกแบบระบบไอทีและฐานข้อมูล พร้อมเสนอแนะ Best Practices',
  },
];

interface QuickToolChipsProps {
  webSearch: boolean;
  onToggleWebSearch: () => void;
  isDrawMode: boolean;
  onToggleDrawMode: () => void;
  hasWorklogContext: boolean;
  onFetchWorklogContext: () => void;
  onClearWorklogContext?: () => void;
  activeSkillId: string;
  onSelectSkill: (skillId: string) => void;
}

export const QuickToolChips: React.FC<QuickToolChipsProps> = ({
  webSearch,
  onToggleWebSearch,
  isDrawMode,
  onToggleDrawMode,
  hasWorklogContext,
  onFetchWorklogContext,
  onClearWorklogContext,
  activeSkillId,
  onSelectSkill,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-xs select-none">
      {/* Web Search Chip */}
      <button
        type="button"
        onClick={onToggleWebSearch}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer',
          webSearch
            ? 'bg-indigo-500/15 border-indigo-400 text-indigo-700 dark:text-indigo-300 shadow-xs'
            : 'bg-theme-surface/70 border-theme-border/70 text-theme-text-muted hover:text-theme-text hover:border-theme-border-strong'
        )}
        title="เปิด-ปิดการค้นหาข้อมูลอินเทอร์เน็ตสดผ่าน OpenRouter"
      >
        <Globe size={13} className={cn(webSearch && 'animate-pulse text-indigo-500')} />
        <span>ค้นหาเว็บ {webSearch ? 'ON' : 'OFF'}</span>
      </button>

      {/* Worklog Context Superpower Chip */}
      <button
        type="button"
        onClick={() => {
          if (hasWorklogContext && onClearWorklogContext) {
            onClearWorklogContext();
          } else {
            onFetchWorklogContext();
          }
        }}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer',
          hasWorklogContext
            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-700 dark:text-emerald-300 shadow-xs'
            : 'bg-theme-surface/70 border-theme-border/70 text-theme-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400/40'
        )}
        title="ดึงประวัติการลงเวลาล่าสุดของคุณจาก Supabase เพื่อให้ AI นำไปสรุปหรือวิเคราะห์"
      >
        <Database size={13} className={cn(hasWorklogContext && 'text-emerald-500')} />
        <span>{hasWorklogContext ? '✓ ดึง Worklog แล้ว' : '📊 ดึงงานของฉัน (Worklog)'}</span>
      </button>

      {/* Image Gen Chip */}
      <button
        type="button"
        onClick={onToggleDrawMode}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer',
          isDrawMode
            ? 'bg-violet-500/15 border-violet-400 text-violet-700 dark:text-violet-300 shadow-xs'
            : 'bg-theme-surface/70 border-theme-border/70 text-theme-text-muted hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-400/40'
        )}
        title="เข้าสู่โหมดสร้างรูปภาพและ Infographic"
      >
        <Palette size={13} className={cn(isDrawMode && 'text-violet-500')} />
        <span>สร้างภาพ / Infographic</span>
      </button>

      {/* Role Skills (if not draw mode) */}
      {!isDrawMode && (
        <div className="flex items-center gap-1 pl-1 border-l border-theme-border/60">
          {AI_SKILLS.filter((s) => s.id !== 'none').map((skill) => {
            const active = activeSkillId === skill.id;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => onSelectSkill(active ? 'none' : skill.id)}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer',
                  active
                    ? 'bg-amber-500/15 border-amber-400 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'bg-theme-surface/60 border-theme-border/60 text-theme-text-muted hover:text-theme-text'
                )}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
