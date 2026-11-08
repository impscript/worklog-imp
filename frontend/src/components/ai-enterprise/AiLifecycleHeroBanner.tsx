import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sliders,
  Laptop,
  Bot,
  Zap,
  Target,
  AlertTriangle,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type LifecycleStepId = 'intake' | 'evaluation' | 'execution' | 'review';

interface StepDetail {
  id: LifecycleStepId;
  stepNumber: number;
  title: string;
  subtitle: string;
  role: string;
  timeline: string;
  tabTarget: 'dashboard' | 'request' | 'reports' | 'evaluations' | 'governance';
  actionLabel: string;
  what: string;
  who: string;
  when: string;
  how: string[];
  pillar3T: {
    name: 'Trust' | 'Transparency' | 'Transformation';
    desc: string;
    badgeClass: string;
  };
  sampleMetric: {
    label: string;
    value: string;
    delta: string;
    subtext: string;
  };
}

const LIFECYCLE_STEPS: StepDetail[] = [
  {
    id: 'intake',
    stepNumber: 1,
    title: 'เลือก Tier & ยื่นขอ FM-001',
    subtitle: 'กำหนด AI JD & ขอจัดสรรสิทธิ์',
    role: 'ผู้ขอใช้งาน (Requester)',
    timeline: 'ยื่นได้ตลอดเวลา (พิจารณารอบถัดไป)',
    tabTarget: 'request',
    actionLabel: 'เปิดฟอร์มยื่นคำขอ FM-001',
    what: 'ระบุโจทย์งาน กระบวนการทำงานเดิม (As-Is) และเลือกประเภทสิทธิ์ที่ต้องการใช้งานให้ตรงกับเนื้องาน',
    who: 'พนักงานทุกระดับ หรือหัวหน้าทีม (Department Lead / Project Owner)',
    when: 'ยื่นคำขอได้ตลอดทั้งเดือน โดย CoE จะนำเข้าประชุมพิจารณาตัดรอบทุกวันที่ 15',
    how: [
      'ประเมินความจำเป็น: หากเป็นงานเฉพาะทาง/สัญญาลึก เลือก Tier 1 (Virtual AI Employee) หรือหากเป็นงานค้นคว้าทั่วไปเลือก Tier 2 (Web UI)',
      'เขียนคำบรรยายลักษณะงาน (AI JD) ให้ชัดเจนเสมือนกำลังจ้างพนักงานเข้ามาช่วยงาน 1 ตำแหน่ง',
      'ประเมินเวลาที่ใช้ปัจจุบัน (ชม./สัปดาห์) และคาดการณ์เวลาที่จะประหยัดได้จริง',
      'กดยืนยันการประเมินความปลอดภัยข้อมูล (ไม่นำ PII / Customer Secrets ป้อนเข้าโมเดล)'
    ],
    pillar3T: {
      name: 'Trust',
      desc: 'คัดกรองข้อมูลปลอดภัยตามระเบียบ WI-PI-AI-001 ไม่ใช้ข้อมูลลับลูกค้าและปฏิบัติตาม PDPA 100%',
      badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    },
    sampleMetric: {
      label: 'สัดส่วนคำขอใช้งานจำแนกตาม Tier',
      value: '72% Tier 1',
      delta: 'Virtual AI + JD',
      subtext: 'ความต้องการระบบวิเคราะห์เอกสารและเขียนโค้ดสูงสุด'
    }
  },
  {
    id: 'evaluation',
    stepNumber: 2,
    title: 'CoE ประเมินความคุ้มค่า',
    subtitle: 'Rubric 100 คะแนน (เกณฑ์ผ่าน ≥ 70)',
    role: 'คณะกรรมการ (AI CoE & IT)',
    timeline: 'ตัดรอบพิจารณาทุกวันที่ 15',
    tabTarget: 'evaluations',
    actionLabel: 'ดูเกณฑ์และบันทึกคะแนน CoE',
    what: 'คณะกรรมการพิจารณาความคุ้มค่าตาม 4 มิติเชิงลึก เพื่อจัดสรรสิทธิ์ที่มีจำกัดให้เกิดผลลัพธ์สูงสุดต่อองค์กร',
    who: 'คณะกรรมการ AI Center of Excellence (CoE), ทีม Process Improvement และตัวแทน IT',
    when: 'ประชุมพิจารณาทุกวันที่ 15 ของเดือน เพื่อส่งมอบสิทธิ์เริ่มสัญญาในรอบเดือนถัดไป',
    how: [
      'มิติที่ 1: ความชัดเจนของปัญหาและ As-Is Process (เต็ม 30 คะแนน)',
      'มิติที่ 2: ความคุ้มค่าทางธุรกิจและเป้าหมายชั่วโมงที่ประหยัดได้ (เต็ม 30 คะแนน)',
      'มิติที่ 3: ความพร้อมของข้อมูลและ Process Readiness (เต็ม 20 คะแนน)',
      'มิติที่ 4: ความปลอดภัยข้อมูลและความตระหนักด้าน PDPA (เต็ม 20 คะแนน)',
      'เกณฑ์การตัดสิน: ≥ 70 คะแนน อนุมัติสิทธิ์ Sandbox 1-3 เดือน / < 70 ส่งกลับปรับแก้โจทย์'
    ],
    pillar3T: {
      name: 'Transparency',
      desc: 'เกณฑ์การให้คะแนนแบบเปิดเผย ตรวจสอบได้ ทุกแผนกใช้มาตรฐาน 100 คะแนนเดียวกัน',
      badgeClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
    },
    sampleMetric: {
      label: 'เกณฑ์มาตรฐานการอนุมัติ (Pass Benchmark)',
      value: '70 / 100',
      delta: 'Min Pass Score',
      subtext: 'พิจารณา 4 มิติ ครอบคลุมทั้ง ROI และ Data Safety'
    }
  },
  {
    id: 'execution',
    stepNumber: 3,
    title: 'จัดสรรสิทธิ์ & ลุยงานจริง',
    subtitle: 'สร้าง Project & คีย์ Daily Worklog',
    role: 'ผู้ใช้งานจริง (Active Licensee)',
    timeline: 'สัญญาทดลอง 1-3 เดือน (Sandbox Period)',
    tabTarget: 'reports',
    actionLabel: 'ดูรายการโครงการและผลงาน',
    what: 'รับ Account เข้าใช้งาน ร่วมกับคีย์ข้อมูลการประหยัดเวลาและ Prompt ใน Daily Worklog ทุกวัน',
    who: 'พนักงานที่ได้รับสิทธิ์ License (Tier 1 Claude Team หรือ Tier 2 Web Portal)',
    when: 'ปฏิบัติงานต่อเนื่องทุกวันทำการ ตลอดระยะเวลาสัญญาที่ได้รับการจัดสรร',
    how: [
      'IT มอบหมาย License และคู่มือการตั้งค่าความปลอดภัย',
      'ระบบอัตโนมัติสร้าง Project "[AI] ..." ในระบบ Worklog ให้ทันที',
      'พนักงานบันทึกชั่วโมงที่ประหยัดได้จริงและภารกิจที่ทำร่วมกับ AI ใน Daily Worklog',
      'รักษาหลักการ Human-in-the-loop: ตรวจสอบความถูกต้องของผลลัพธ์จาก AI ทุกครั้งก่อนส่งมอบงานจริง'
    ],
    pillar3T: {
      name: 'Transformation',
      desc: 'Transform Me: พนักงานยกระดับตนเอง เรียนรู้ Prompt Engineering และเพิ่ม Productivity จริง',
      badgeClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    },
    sampleMetric: {
      label: 'เวลาที่ประหยัดได้จริงเฉลี่ยต่อคน',
      value: '8.4 ชม./สัปดาห์',
      delta: '+35% vs Target',
      subtext: 'วัดผลจริงจากการบันทึก Daily Worklog'
    }
  },
  {
    id: 'review',
    stepNumber: 4,
    title: 'ส่งผลงาน FM-002 & หมุนเวียนสิทธิ์',
    subtitle: 'Smart Sync Worklog & Seat Roaming',
    role: 'ผู้ใช้ & คณะกรรมการ CoE',
    timeline: 'ส่งผลงานภายในวันที่ 25 ของทุกเดือน',
    tabTarget: 'reports',
    actionLabel: 'กดส่งผลงาน & ซิงค์ Worklog (FM-002)',
    what: 'ส่งรายงานสรุปผลงานประจำเดือนผ่าน Smart Sync Worklog หากสิทธิ์ไม่ถูกใช้งานจะหมุนเวียนให้ทีมอื่น (Seat Roaming)',
    who: 'ผู้ถือครองสิทธิ์ทุกคน และ คณะกรรมการ CoE ผู้ตรวจสอบ',
    when: 'ระบบเปิดให้ส่งรายงานผลงานวันที่ 20-25 ของทุกเดือน เพื่อพิจารณาต่ออายุสิทธิ์ในรอบเดือนถัดไป',
    how: [
      'กดปุ่ม "Smart Sync Daily Worklog" เพื่อดึงชั่วโมงที่บันทึกจริงมาสรุปอัตโนมัติ',
      'แนบผลงานที่เป็นรูปธรรม เช่น เอกสารที่วิเคราะห์ได้, โค้ดที่สร้างสำเร็จ, หรือกระบวนการที่ลดเวลาลง',
      'CoE ทบทวนผลงาน: อัตราการใช้งานสม่ำเสมอ -> คงสิทธิ์ / สร้างผลงานโดดเด่น -> ขยายผล Scale',
      'Seat Roaming Protocol: หากใช้งานน้อยกว่า 10 วันทำการ หรือไม่มีผลงาน สิทธิ์จะถูกโอนย้ายให้ทีมใน Waiting List'
    ],
    pillar3T: {
      name: 'Transformation',
      desc: 'Transform Us: แบ่งปัน Use Case ที่สำเร็จให้เพื่อนร่วมงาน และหมุนเวียนทรัพยากรให้เกิดประโยชน์สูงสุด',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    },
    sampleMetric: {
      label: 'อัตราการหมุนเวียนสิทธิ์คุ้มค่า (Seat Health)',
      value: '91.8%',
      delta: 'Active Utilization',
      subtext: 'หมุนเวียนสิทธิ์ว่างให้ผู้รอใน Waiting List ทันที'
    }
  }
];

interface AiLifecycleHeroBannerProps {
  activeTab: string;
  onSelectTab: (tab: 'dashboard' | 'request' | 'reports' | 'evaluations' | 'governance') => void;
  totalRequests?: number;
  approvedSeats?: number;
  totalWeeklyHoursSaved?: number;
}

export default function AiLifecycleHeroBanner({
  onSelectTab,
  totalRequests = 0,
  approvedSeats = 0,
  totalWeeklyHoursSaved = 0
}: AiLifecycleHeroBannerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<LifecycleStepId>('intake');

  const selectedStep = LIFECYCLE_STEPS.find(s => s.id === selectedStepId) || LIFECYCLE_STEPS[0];

  return (
    <div className="bg-theme-surface border border-theme-border/90 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all duration-300">
      {/* 1. Header Bar with Toggle & SLA Notice */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-amber-500/10 border-b border-theme-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Zap size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-tight text-theme-text flex items-center gap-2">
                Enterprise AI Lifecycle & Adoption Flywheel
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                4-Stage Governance Loop
              </span>
            </div>
            <p className="text-[11px] text-theme-text-muted mt-0.5 flex items-center gap-2">
              <span>วงจรการขอสิทธิ์ ประเมินความคุ้มค่า และติดตามผลลัพธ์ AI ตามระเบียบ WI-PI-AI-001</span>
              <span className="hidden md:inline text-theme-border">•</span>
              <span className="hidden md:inline font-mono font-bold text-amber-500">
                SLA: ตัดรอบพิจารณาวันที่ 15 | ส่งรายงานวันที่ 25
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-theme-bg-page/70 border border-theme-border/60 text-[11px]">
            <span className="text-theme-text-muted">คำขอทั้งหมด: <strong className="text-theme-text font-mono">{totalRequests}</strong></span>
            <span className="text-theme-border">|</span>
            <span className="text-theme-text-muted">สิทธิ์ที่อนุมัติ: <strong className="text-indigo-500 font-mono">{approvedSeats}</strong></span>
            <span className="text-theme-border">|</span>
            <span className="text-theme-text-muted">เซฟเวลาได้: <strong className="text-emerald-500 font-mono">{totalWeeklyHoursSaved}h/wk</strong></span>
          </div>

          {/* Toggle Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="px-3 py-1.5 rounded-lg border border-theme-border/80 bg-theme-surface hover:bg-theme-surface-tertiary text-theme-text text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title={isExpanded ? 'ย่อแถบแนะนำขั้นตอน' : 'ขยายแถบแนะนำขั้นตอน'}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} className="text-theme-text-muted" />
                <span>ย่อคู่มือวงจร</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} className="text-theme-text-muted" />
                <span>ดูขั้นตอน & Flow วงจร</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-5 space-y-5 animate-fade-in">
          {/* 2. Four Interactive Stepper Cards with Connectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 relative">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isSelected = selectedStepId === step.id;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 group flex flex-col justify-between",
                    isSelected
                      ? "bg-gradient-to-b from-indigo-500/10 via-theme-surface to-indigo-500/5 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-theme-bg-page/50 hover:bg-theme-surface border-theme-border/80 hover:border-indigo-500/40"
                  )}
                >
                  {/* Top Row: Step Number & Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black font-mono transition-all",
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/40"
                              : "bg-theme-surface border border-theme-border text-theme-text-muted group-hover:text-theme-text"
                          )}
                        >
                          {step.stepNumber}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
                          {step.role}
                        </span>
                      </div>

                      {/* SLA Pill */}
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-theme-surface border border-theme-border text-amber-500">
                        {step.id === 'evaluation' ? 'รอบ 15' : step.id === 'review' ? 'รอบ 25' : step.timeline.split(' ')[0]}
                      </span>
                    </div>

                    {/* Step Title & Subtitle */}
                    <h3 className="text-xs font-bold text-theme-text group-hover:text-indigo-500 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-[11px] text-theme-text-muted mt-0.5 line-clamp-2">
                      {step.subtitle}
                    </p>
                  </div>

                  {/* Bottom Row: 3T Badge & Select Indicator */}
                  <div className="mt-3 pt-2.5 border-t border-theme-border/40 flex items-center justify-between text-[10px]">
                    <span className={cn("px-1.5 py-0.5 rounded font-bold border", step.pillar3T.badgeClass)}>
                      {step.pillar3T.name}
                    </span>
                    <span
                      className={cn(
                        "font-semibold flex items-center gap-1 transition-colors",
                        isSelected ? "text-indigo-500 font-bold" : "text-theme-text-muted group-hover:text-theme-text"
                      )}
                    >
                      <span>คลิกดูวิธีทำ</span>
                      <ArrowRight size={11} className={cn("transition-transform", isSelected && "translate-x-0.5")} />
                    </span>
                  </div>

                  {/* Flow Connector Arrow Indicator for Large Screens */}
                  {idx < LIFECYCLE_STEPS.length - 1 && (
                    <div className="hidden xl:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-theme-text-muted/40">
                      <div className="w-4 h-4 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-[10px] shadow-2xs">
                        →
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3. Mebius Step Inspector Panel (Detailed Guidance & Visuals) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-theme-bg-page via-theme-surface to-indigo-950/10 border border-theme-border/80 shadow-inner">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Actionable Guide (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Header of Inspector */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center font-black font-mono text-sm">
                      0{selectedStep.stepNumber}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-theme-text flex items-center gap-2">
                        <span>{selectedStep.title}</span>
                        <span className="text-xs font-normal text-theme-text-muted">
                          ({selectedStep.subtitle})
                        </span>
                      </h4>
                      <p className="text-xs text-theme-text-muted mt-0.5">
                        ผู้รับผิดชอบหลัก: <strong className="text-theme-text">{selectedStep.who}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Action Button that switches Tab */}
                  <button
                    onClick={() => onSelectTab(selectedStep.tabTarget)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>{selectedStep.actionLabel}</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* What & When */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                      <Target size={12} />
                      เป้าหมายของขั้นตอนนี้ (What)
                    </span>
                    <p className="text-xs text-theme-text mt-1 leading-relaxed">
                      {selectedStep.what}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                      <Clock size={12} />
                      กำหนดการ & SLA (When)
                    </span>
                    <p className="text-xs text-theme-text mt-1 leading-relaxed">
                      {selectedStep.when}
                    </p>
                  </div>
                </div>

                {/* Step-by-Step Checklist (How) */}
                <div>
                  <h5 className="text-xs font-bold text-theme-text flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>ขั้นตอนดำเนินการเชิงปฏิบัติ (How to Execute)</span>
                  </h5>
                  <div className="space-y-1.5">
                    {selectedStep.how.map((instruction, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg bg-theme-surface/50 border border-theme-border/50 text-xs text-theme-text-muted hover:text-theme-text transition-colors"
                      >
                        <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-snug">{instruction}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3Ts & Transformation Callout */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 flex items-start gap-2.5">
                  <Lightbulb size={16} className="text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      หลักการ 3Ts: {selectedStep.pillar3T.name}
                    </span>
                    <p className="text-xs text-theme-text-muted mt-0.5">
                      {selectedStep.pillar3T.desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Mebius Data Visualization Card (5 Cols) */}
              <div className="lg:col-span-5">
                <div className="bg-theme-surface border border-theme-border/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  {/* Layer 1: Header & Control Tag */}
                  <div className="flex items-center justify-between pb-3 border-b border-theme-border/50">
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      Mebius Visual Insight
                    </span>
                    <span className="text-[10px] font-mono text-theme-text-muted">
                      Step 0{selectedStep.stepNumber} Simulation
                    </span>
                  </div>

                  {/* Layer 2: Hero KPI Ticker */}
                  <div className="mt-3">
                    <span className="text-xs text-theme-text-muted font-medium">
                      {selectedStep.sampleMetric.label}
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-theme-text font-mono tracking-tight">
                        {selectedStep.sampleMetric.value}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {selectedStep.sampleMetric.delta}
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-text-muted mt-0.5">
                      {selectedStep.sampleMetric.subtext}
                    </p>
                  </div>

                  {/* Layer 3: Visual Canvas tailored per Step */}
                  <div className="mt-4 p-3 rounded-xl bg-theme-bg-page/70 border border-theme-border/60">
                    {selectedStep.id === 'intake' && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                          <span>เปรียบเทียบประเภทสิทธิ์ (Tier Allocation)</span>
                          <span className="text-[10px] text-theme-text-muted">โควตา 100%</span>
                        </div>
                        {/* Segmented Bar */}
                        <div className="h-3 w-full rounded-full bg-theme-surface overflow-hidden flex border border-theme-border/50">
                          <div className="h-full bg-indigo-500 w-[72%]" title="Tier 1: 72%" />
                          <div className="h-full bg-purple-400 w-[28%]" title="Tier 2: 28%" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div className="p-2 rounded-lg bg-theme-surface border border-theme-border/40">
                            <div className="flex items-center gap-1.5 text-indigo-500 font-bold text-xs">
                              <Bot size={13} />
                              <span>Tier 1: Claude Team</span>
                            </div>
                            <p className="text-[10px] text-theme-text-muted mt-1 leading-snug">
                              สำหรับงานวิเคราะห์เอกสารขนาดยาว เขียนโปรแกรม มี AI JD ชัดเจน
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-theme-surface border border-theme-border/40">
                            <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                              <Laptop size={13} />
                              <span>Tier 2: Web Portal</span>
                            </div>
                            <p className="text-[10px] text-theme-text-muted mt-1 leading-snug">
                              ผ่าน chat.futuregreenergy.com สำหรับค้นคว้า & งานทั่วไป
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedStep.id === 'evaluation' && (
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                          <span>Rubric 4 มิติ (คะแนนเต็ม 100)</span>
                          <span className="text-[10px] text-emerald-500 font-mono font-bold">เกณฑ์ผ่าน ≥ 70</span>
                        </div>
                        {/* 4 Rubric Bars */}
                        <div className="space-y-1.5 text-[11px]">
                          <div>
                            <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                              <span>1. ความชัดเจนของปัญหา (As-Is Process)</span>
                              <span className="font-mono font-bold">30 คะแนน</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-theme-surface overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full w-full" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                              <span>2. ความคุ้มค่าและชั่วโมงที่ประหยัด (ROI)</span>
                              <span className="font-mono font-bold">30 คะแนน</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-theme-surface overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full w-full" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                              <span>3. ความพร้อมของข้อมูล (Readiness)</span>
                              <span className="font-mono font-bold">20 คะแนน</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-theme-surface overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full w-full" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                              <span>4. ความปลอดภัย & PDPA</span>
                              <span className="font-mono font-bold">20 คะแนน</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-theme-surface overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full w-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedStep.id === 'execution' && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                          <span>แนวโน้มชั่วโมงประหยัดได้ (Weekly Saved)</span>
                          <span className="text-[10px] text-emerald-500 font-mono font-bold">▲ โตขึ้นต่อเนื่อง</span>
                        </div>
                        {/* Mini Sparkline Curve via SVG */}
                        <div className="h-16 w-full flex items-end">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 0 50 Q 50 40, 70 30 T 130 18 T 200 8 L 200 60 L 0 60 Z"
                              fill="url(#sparklineGrad)"
                            />
                            <path
                              d="M 0 50 Q 50 40, 70 30 T 130 18 T 200 8"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                            />
                            <circle cx="200" cy="8" r="4" fill="#10b981" className="animate-ping" />
                            <circle cx="200" cy="8" r="3" fill="#10b981" />
                          </svg>
                        </div>
                        <div className="flex justify-between text-[10px] text-theme-text-muted font-mono pt-1 border-t border-theme-border/40">
                          <span>W1: 3.5 ชม.</span>
                          <span>W2: 5.8 ชม.</span>
                          <span>W3: 7.2 ชม.</span>
                          <span className="text-emerald-500 font-bold">W4: 9.5 ชม.</span>
                        </div>
                      </div>
                    )}

                    {selectedStep.id === 'review' && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                          <span>สถานะการใช้งาน & Seat Roaming</span>
                          <span className="text-[10px] text-amber-500 font-mono font-bold">ส่งก่อนวันที่ 25</span>
                        </div>
                        {/* Roaming Health Meter */}
                        <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border/50 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-theme-text">อัตราการใช้งานประจำเดือน</span>
                            <span className="font-mono font-black text-indigo-500">18 / 22 วันทำการ</span>
                          </div>
                          <div className="h-2 rounded-full bg-theme-bg-page overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full w-[82%]" />
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted mt-1">
                            <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                            <span>เกณฑ์คงสิทธิ์: ต้อง Active ≥ 10 วันทำการ/เดือน</span>
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>หากสิทธิ์ไม่ Active ระบบจะ Roam สิทธิ์ให้ Waiting List รอบวันที่ 1 ของเดือนถัดไป</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Layer 4: Secondary Ledger Metrics */}
                  <div className="mt-3 pt-3 border-t border-theme-border/40 flex items-center justify-between text-[10px] text-theme-text-muted">
                    <span className="flex items-center gap-1">
                      <Sliders size={11} className="text-indigo-500" />
                      <span>Data-Driven Governance</span>
                    </span>
                    <span className="font-mono font-semibold text-theme-text">
                      WI-PI-AI-001 Standard
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
