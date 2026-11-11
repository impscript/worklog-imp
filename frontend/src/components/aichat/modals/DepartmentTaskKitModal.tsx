import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Zap,
  Sparkles,
  Calculator,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  FileCheck2,
  ArrowRight
} from 'lucide-react';
import {
  DEPARTMENT_TASK_KITS,
  type DepartmentTaskKit,
} from '../../../lib/department-task-kits';
import { cn } from '../../../lib/utils';

interface DepartmentTaskKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTaskKit: (task: DepartmentTaskKit) => void;
}

const CATEGORY_TABS: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: 'ทั้งหมด (All)', icon: '🏢' },
  { id: 'accounting', label: 'บัญชีและการเงิน', icon: '💰' },
  { id: 'procurement', label: 'จัดซื้อและสัญญา', icon: '📑' },
  { id: 'legal', label: 'กฎหมายและกำกับดูแล', icon: '⚖️' },
  { id: 'hr', label: 'ทรัพยากรบุคคล (HR)', icon: '👥' },
  { id: 'it', label: 'ไอทีและนวัตกรรม', icon: '💻' },
  { id: 'audit', label: 'ตรวจสอบภายใน & PI', icon: '🔍' },
  { id: 'marketing', label: 'พัฒนาธุรกิจ & BD', icon: '📈' },
  { id: 'plant', label: 'วิศวกรรม & โรงงาน', icon: '🏭' },
];

export const DepartmentTaskKitModal: React.FC<DepartmentTaskKitModalProps> = ({
  isOpen,
  onClose,
  onSelectTaskKit,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Filter task kits
  const filteredTasks = useMemo(() => {
    return DEPARTMENT_TASK_KITS.filter((kit) => {
      const matchCat = selectedCategory === 'all' || kit.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        kit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kit.deptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kit.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-theme-surface dark:bg-theme-bg-page border border-theme-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-theme-border flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-theme-text">
                  คลังโจทย์ทดสอบมาตรฐาน 8 ฝ่ายงาน (Department Benchmark Kits)
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {DEPARTMENT_TASK_KITS.length} โจทย์องค์กร
                </span>
              </div>
              <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                โจทย์จริงอ้างอิงตามโครงสร้างองค์กร (Accounting, Procurement, Legal, HR, IT, Audit, BD, Plant) เพื่อนำไปประลองใน Arena วัดความแม่นยำก่อนขอ License FM-001
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary border border-transparent hover:border-theme-border transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-3 sm:p-4 border-b border-theme-border bg-theme-surface/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาโจทย์ตามชื่อฝ่าย, หัวข้อภาษี, กฎหมาย, เครื่องจักร, TOR..."
              className="w-full text-xs font-medium pl-9 pr-3.5 py-2 rounded-xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted/60 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Department Filter Tabs (Horizontal Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border',
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary'
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Filter size={36} className="mx-auto text-theme-text-muted/40 mb-3" />
              <p className="text-sm font-bold text-theme-text">ไม่พบโจทย์ทดสอบที่ตรงกับเงื่อนไข</p>
              <p className="text-xs text-theme-text-muted mt-1">ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-theme-border bg-theme-surface hover:border-indigo-500/40 transition-all p-4 sm:p-5 flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-theme-surface-secondary text-theme-text border border-theme-border">
                          {task.deptName}
                        </span>

                        {/* Difficulty badge */}
                        <span
                          className={cn(
                            'text-[10px] font-black px-2 py-0.5 rounded-full border',
                            task.difficulty === 'high_reasoning'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                              : task.difficulty === 'speed_draft'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          )}
                        >
                          {task.difficulty === 'high_reasoning'
                            ? '🧠 ตรรกะซับซ้อนสูง (High Reasoning)'
                            : task.difficulty === 'speed_draft'
                            ? '⚡ รวดเร็ว & งานร่าง (Speed Draft)'
                            : '⚖️ งานวิเคราะห์มาตรฐาน (Standard)'}
                        </span>

                        {/* Preset recommendation */}
                        <span className="text-[10px] font-bold text-theme-text-muted flex items-center gap-1">
                          {task.suggestedArenaPreset === 'math_reasoning' && <Calculator size={11} className="text-amber-500" />}
                          {task.suggestedArenaPreset === 'speed_budget' && <Zap size={11} className="text-emerald-500" />}
                          {task.suggestedArenaPreset === 'flagship_heavy' && <Sparkles size={11} className="text-indigo-500" />}
                          <span>
                            แนะนำสูตร:{' '}
                            {task.suggestedArenaPreset === 'math_reasoning'
                              ? 'ตรวจงบ & คิดเลข'
                              : task.suggestedArenaPreset === 'speed_budget'
                              ? 'ความเร็วสุดประหยัด'
                              : 'เรือธงรอบด้าน'}
                          </span>
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-theme-text mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {task.title}
                      </h3>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    {/* Action Button: Load Task */}
                    <button
                      type="button"
                      onClick={() => onSelectTaskKit(task)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shrink-0 transition-all flex items-center gap-1.5 shadow-sm hover:shadow-indigo-500/20 cursor-pointer"
                    >
                      <span>⚡ โหลดโจทย์นี้เข้า Arena</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {/* Rubric Points Preview */}
                  <div className="pt-2 border-t border-theme-border/60">
                    <div className="text-[11px] font-black text-theme-text-muted mb-1.5 flex items-center gap-1.5">
                      <FileCheck2 size={13} className="text-emerald-500" />
                      <span>เกณฑ์การตรวจข้อสอบ (Evaluation Rubrics):</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-theme-text-muted">
                      {task.evaluationRubric.slice(0, 4).map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Prompt Preview Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <span>ซ่อน Prompt ละเอียด</span>
                          <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          <span>ดูเนื้อหาโจทย์เต็ม (Prompt)</span>
                          <ChevronDown size={12} />
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-theme-surface-secondary/70 border border-theme-border text-xs font-mono text-theme-text leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {task.prompt}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme-border bg-theme-surface/80 flex items-center justify-between text-xs text-theme-text-muted">
          <span>
            แสดง {filteredTasks.length} จาก {DEPARTMENT_TASK_KITS.length} โจทย์
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-theme-border hover:bg-theme-surface-secondary text-theme-text font-bold cursor-pointer transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
