import type { AiTeamMember } from './AiTeamMemberPicker';

export type FrequencyUnit = 'day' | 'week' | 'month';
export type EstimateBasis = 'measured' | 'sandbox' | 'experience';

/** One piece of work the requester wants AI to help with. Numbers are per week for the owner. */
export interface AiUseCase {
  id: string;
  title: string;
  owner_key: string;
  as_is_process: string;
  ai_functions: string[];
  frequency_count: number;
  frequency_unit: FrequencyUnit;
  minutes_before: number;
  minutes_after: number;
  basis: EstimateBasis;
}

export interface FormIssue {
  code: string;
  message: string;
  /** DOM id of the section / card to scroll to */
  targetId?: string;
}

export interface MemberLoad {
  key: string;
  name: string;
  taskCount: number;
  hoursBefore: number;
  hoursSaved: number;
}

export interface RequestSummary {
  perMember: MemberLoad[];
  hoursBeforePerWeek: number;
  hoursSavedPerWeek: number;
  adjustedSavedPerWeek: number;
  hoursSavedPerMonth: number;
  valuePerMonthThb: number;
}

// Same constants the rest of the hub uses for ROI (see metrics in AiEnterprisePage).
export const WEEKS_PER_MONTH = 4.2;
export const WORKDAYS_PER_WEEK = 5;
export const HOURLY_RATE_THB = 300;
export const MAX_TASKS_PER_MEMBER_WARN = 5;

export const BASIS_OPTIONS: Array<{ value: EstimateBasis; label: string; factor: number }> = [
  { value: 'measured', label: 'นับ/จับเวลาจริง', factor: 1 },
  { value: 'sandbox', label: 'อ้างอิงผลทดลอง Sandbox', factor: 0.85 },
  { value: 'experience', label: 'ประมาณจากประสบการณ์', factor: 0.7 },
];

export const FREQUENCY_UNIT_LABEL: Record<FrequencyUnit, string> = {
  day: 'ต่อวัน',
  week: 'ต่อสัปดาห์',
  month: 'ต่อเดือน',
};

export function newUseCaseId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `uc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyUseCase(ownerKey = ''): AiUseCase {
  return {
    id: newUseCaseId(),
    title: '',
    owner_key: ownerKey,
    as_is_process: '',
    ai_functions: [],
    frequency_count: 1,
    frequency_unit: 'week',
    minutes_before: 60,
    minutes_after: 30,
    basis: 'experience',
  };
}

/** Same key the team picker uses to identify / remove a member. */
export function memberKey(m: Pick<AiTeamMember, 'emp_id' | 'email' | 'name'>): string {
  return (m.emp_id || m.email || m.name || '').trim();
}

const norm = (s: string | undefined | null) => (s || '').trim().toLowerCase();

export function timesPerWeek(t: Pick<AiUseCase, 'frequency_count' | 'frequency_unit'>): number {
  const n = Number.isFinite(t.frequency_count) ? t.frequency_count : 0;
  if (t.frequency_unit === 'day') return n * WORKDAYS_PER_WEEK;
  if (t.frequency_unit === 'month') return n / WEEKS_PER_MONTH;
  return n;
}

export function hoursBeforePerWeek(t: AiUseCase): number {
  return (timesPerWeek(t) * Math.max(0, t.minutes_before || 0)) / 60;
}

export function hoursSavedPerWeek(t: AiUseCase): number {
  const diff = Math.max(0, (t.minutes_before || 0) - (t.minutes_after || 0));
  return (timesPerWeek(t) * diff) / 60;
}

export function basisFactor(basis: EstimateBasis): number {
  return BASIS_OPTIONS.find((b) => b.value === basis)?.factor ?? 0.7;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(tasks: AiUseCase[], members: AiTeamMember[]): RequestSummary {
  const byKey = new Map<string, MemberLoad>();
  members.forEach((m) => {
    const key = memberKey(m);
    byKey.set(key, { key, name: m.name, taskCount: 0, hoursBefore: 0, hoursSaved: 0 });
  });

  let before = 0;
  let saved = 0;
  let adjusted = 0;
  tasks.forEach((t) => {
    const b = hoursBeforePerWeek(t);
    const s = hoursSavedPerWeek(t);
    before += b;
    saved += s;
    adjusted += s * basisFactor(t.basis);
    const row = byKey.get(t.owner_key);
    if (row) {
      row.taskCount += 1;
      row.hoursBefore += b;
      row.hoursSaved += s;
    }
  });

  const monthly = saved * WEEKS_PER_MONTH;
  return {
    perMember: Array.from(byKey.values()),
    hoursBeforePerWeek: round2(before),
    hoursSavedPerWeek: round2(saved),
    adjustedSavedPerWeek: round2(adjusted),
    hoursSavedPerMonth: round2(monthly),
    valuePerMonthThb: Math.round(monthly * HOURLY_RATE_THB),
  };
}

/** Validation of a single task card. Used by the card (inline) and by the whole-form check. */
export function validateUseCase(t: AiUseCase, members: AiTeamMember[], index: number): FormIssue[] {
  const label = t.title.trim() ? `งานที่ ${index + 1} "${t.title.trim()}"` : `งานที่ ${index + 1}`;
  const target = `req-task-${t.id}`;
  const issues: FormIssue[] = [];

  if (!t.title.trim()) issues.push({ code: 'task-title', message: `${label}: กรุณาระบุชื่องาน`, targetId: target });
  if (!members.some((m) => memberKey(m) === t.owner_key)) {
    issues.push({ code: 'task-owner', message: `${label}: กรุณาเลือกผู้รับผิดชอบจากรายชื่อในข้อ 1`, targetId: target });
  }
  if (!t.as_is_process.trim()) {
    issues.push({ code: 'task-process', message: `${label}: กรุณาอธิบายวิธีทำงานปัจจุบันและจุดที่ติดขัด`, targetId: target });
  }
  if (t.ai_functions.length === 0) {
    issues.push({ code: 'task-functions', message: `${label}: กรุณาเลือกอย่างน้อย 1 อย่างที่ให้ AI ช่วย`, targetId: target });
  }
  if (!(t.frequency_count > 0)) {
    issues.push({ code: 'task-frequency', message: `${label}: ความถี่ต้องมากกว่า 0`, targetId: target });
  }
  if (!(t.minutes_before > 0)) {
    issues.push({ code: 'task-before', message: `${label}: เวลาที่ใช้ตอนนี้ต้องมากกว่า 0 นาที`, targetId: target });
  }
  if (!(t.minutes_after >= 0)) {
    issues.push({ code: 'task-after', message: `${label}: เวลาเมื่อมี AI ต้องไม่ติดลบ`, targetId: target });
  } else if (t.minutes_before > 0 && t.minutes_after >= t.minutes_before) {
    issues.push({
      code: 'task-no-saving',
      message: `${label}: เวลาเมื่อมี AI ต้องน้อยกว่าเวลาที่ใช้ตอนนี้ (ไม่เช่นนั้นไม่ได้ประหยัดเวลา)`,
      targetId: target,
    });
  }
  return issues;
}

/** Soft warnings for a task (do not block submit). */
export function warnUseCase(t: AiUseCase, index: number): FormIssue[] {
  const label = t.title.trim() ? `งานที่ ${index + 1} "${t.title.trim()}"` : `งานที่ ${index + 1}`;
  const issues: FormIssue[] = [];
  if (t.minutes_before > 0 && t.minutes_after >= 0 && t.minutes_after < t.minutes_before) {
    const cut = 1 - t.minutes_after / t.minutes_before;
    if (cut > 0.8) {
      issues.push({
        code: 'task-cut-high',
        message: `${label}: ลดเวลาเกิน 80% ของเดิม ควรมีหลักฐานหรือผลทดลองรองรับ`,
        targetId: `req-task-${t.id}`,
      });
    }
  }
  if (hoursSavedPerWeek(t) > 20) {
    issues.push({
      code: 'task-saving-high',
      message: `${label}: ประหยัดเกิน 20 ชม./สัปดาห์ ตรวจความถี่และจำนวนนาทีอีกครั้ง`,
      targetId: `req-task-${t.id}`,
    });
  }
  return issues;
}

export interface RequestFormInput {
  requesterEmail?: string;
  requesterEmpId?: string;
  /** The requester's line manager, picked by employee ID / name search. */
  supervisor: { emp_id: string; name: string; email?: string } | null;
  members: AiTeamMember[];
  seats: number;
  allowPartial: boolean;
  tasks: AiUseCase[];
  consent: boolean;
  /** Virtual AI Employee requests must describe the AI's job (JD). */
  requireAiJd?: boolean;
  aiJd?: string;
}

export interface RequestFormValidation {
  errors: FormIssue[];
  warnings: FormIssue[];
}

export function validateRequestForm(input: RequestFormInput): RequestFormValidation {
  const errors: FormIssue[] = [];
  const warnings: FormIssue[] = [];
  const { members, tasks } = input;

  // --- Section 1: supervisor ---------------------------------------------------------------
  const sup = input.supervisor;
  if (!sup || !sup.name.trim()) {
    errors.push({
      code: 'sup-missing',
      message: 'กรุณาเลือกหัวหน้าสายงาน (ค้นหาด้วยรหัสพนักงานหรือชื่อ)',
      targetId: 'req-sec-1',
    });
  } else {
    const supId = norm(sup.emp_id);
    const supMail = norm(sup.email);
    const idHit = !!supId && (supId === norm(input.requesterEmpId) || members.some((m) => norm(m.emp_id) === supId));
    const mailHit = !!supMail && (supMail === norm(input.requesterEmail) || members.some((m) => norm(m.email) === supMail));
    if (idHit || mailHit) {
      errors.push({
        code: 'sup-self',
        message: 'หัวหน้าที่ยืนยันต้องไม่ใช่ผู้ขอหรือผู้ใช้สิทธิ์ในคำขอนี้ (เลือกหัวหน้าระดับถัดไป)',
        targetId: 'req-sec-1',
      });
    } else if (!supId && !supMail) {
      errors.push({
        code: 'sup-unidentified',
        message: 'หัวหน้าที่เลือกไม่มีรหัสพนักงานหรืออีเมล ระบุตัวตนไม่ได้ กรุณาเลือกจากผลการค้นหา',
        targetId: 'req-sec-1',
      });
    } else if (!supMail) {
      warnings.push({
        code: 'sup-no-email',
        message: 'ไม่พบอีเมลของหัวหน้าในระบบ ทีม Process จะติดต่อผ่านรหัสพนักงาน',
        targetId: 'req-sec-1',
      });
    }
  }

  if (input.requireAiJd && !(input.aiJd || '').trim()) {
    errors.push({ code: 'ai-jd', message: 'กรุณาระบุหน้าที่ของพนักงาน AI (JD) สำหรับสิทธิ์แบบพนักงานเสมือน', targetId: 'req-sec-1' });
  }

  // --- Section 1: members / seats ------------------------------------------------------------
  if (members.length === 0) {
    errors.push({ code: 'members-empty', message: 'กรุณาระบุรายชื่อผู้ใช้อย่างน้อย 1 คน', targetId: 'req-sec-1' });
  }
  const seen = new Set<string>();
  members.forEach((m) => {
    const keys = [norm(m.emp_id), norm(m.email), norm(m.name)].filter(Boolean);
    if (keys.some((k) => seen.has(k))) {
      errors.push({ code: 'members-dup', message: `รายชื่อซ้ำ: ${m.name}`, targetId: 'req-sec-1' });
    }
    keys.forEach((k) => seen.add(k));
  });
  if (members.length > input.seats) {
    errors.push({
      code: 'seats-under',
      message: `จำนวนสิทธิ์ที่ขอ (${input.seats}) น้อยกว่ารายชื่อ (${members.length} คน) กรุณาเพิ่มสิทธิ์หรือนำชื่อออก`,
      targetId: 'req-sec-1',
    });
  } else if (members.length < input.seats) {
    if (!input.allowPartial) {
      errors.push({
        code: 'seats-over',
        message: `ระบุรายชื่อไม่ครบ ${input.seats} สิทธิ์ (มี ${members.length} คน) กรุณาเพิ่มรายชื่อ หรือติ๊ก "ระบุเฉพาะสมาชิกที่ทราบก่อน"`,
        targetId: 'req-sec-1',
      });
    } else {
      warnings.push({
        code: 'seats-unnamed',
        message: `ยังไม่ระบุชื่อ ${input.seats - members.length} สิทธิ์ สิทธิ์เหล่านี้เปิดใช้งานไม่ได้จนกว่าจะระบุชื่อครบ`,
        targetId: 'req-sec-1',
      });
    }
  }

  // --- Section 2: tasks ------------------------------------------------------------------------
  if (tasks.length === 0) {
    errors.push({ code: 'tasks-empty', message: 'กรุณาเพิ่มงานอย่างน้อย 1 งาน', targetId: 'req-sec-2' });
  }
  tasks.forEach((t, i) => {
    errors.push(...validateUseCase(t, members, i));
    warnings.push(...warnUseCase(t, i));
  });

  const titleOwner = new Set<string>();
  tasks.forEach((t, i) => {
    const key = `${norm(t.owner_key)}|${norm(t.title)}`;
    if (t.title.trim() && titleOwner.has(key)) {
      errors.push({
        code: 'task-dup',
        message: `งานที่ ${i + 1} "${t.title.trim()}" ซ้ำกับงานอื่นของผู้รับผิดชอบคนเดียวกัน`,
        targetId: `req-task-${t.id}`,
      });
    }
    titleOwner.add(key);
  });

  // --- Section 3: workload per person ---------------------------------------------------------
  const summary = summarize(tasks, members);
  if (members.length > 1) {
    const idle = summary.perMember.filter((m) => m.taskCount === 0);
    if (idle.length > 0) {
      errors.push({
        code: 'member-no-task',
        message: `ยังไม่มีงานของ ${idle.map((m) => m.name).join(', ')} กรุณามอบหมายงานให้ หรือนำชื่อออกจากข้อ 1 (สิทธิ์จะลดตาม)`,
        targetId: 'req-sec-3',
      });
    }
    if (summary.hoursBeforePerWeek > 0) {
      const top = [...summary.perMember].sort((a, b) => b.hoursBefore - a.hoursBefore)[0];
      if (top && top.hoursBefore / summary.hoursBeforePerWeek > 0.7) {
        warnings.push({
          code: 'load-skew',
          message: `${top.name} ถือภาระงานเกิน 70% ของทั้งหมด สิทธิ์ของคนอื่นอาจใช้งานน้อยกว่าที่ขอ พิจารณาลดจำนวนสิทธิ์`,
          targetId: 'req-sec-3',
        });
      }
    }
  }
  summary.perMember
    .filter((m) => m.taskCount > MAX_TASKS_PER_MEMBER_WARN)
    .forEach((m) =>
      warnings.push({
        code: 'load-many',
        message: `${m.name} รับผิดชอบ ${m.taskCount} งาน (เกิน ${MAX_TASKS_PER_MEMBER_WARN}) ตรวจว่าแยกงานละเอียดเกินไปหรือไม่`,
        targetId: 'req-sec-3',
      })
    );

  // --- Section 4: consent ----------------------------------------------------------------------
  if (!input.consent) {
    errors.push({ code: 'consent', message: 'กรุณาติ๊กยืนยันข้อตกลงด้านความปลอดภัยของข้อมูล', targetId: 'req-sec-4' });
  }

  return { errors, warnings };
}

/** Move every task owned by `fromKey` to `toKey` (used when a member is removed). */
export function reassignTasks(tasks: AiUseCase[], fromKey: string, toKey: string): AiUseCase[] {
  return tasks.map((t) => (t.owner_key === fromKey ? { ...t, owner_key: toKey } : t));
}

export interface LegacyRequestFields {
  title: string;
  as_is_process: string;
  work_frequency: 'daily' | 'weekly' | 'monthly';
  as_is_hours_per_week: number;
  ai_functions: string[];
  target_hours_saved_per_week: number;
}

/**
 * The existing columns of tb_ai_enterprise_requests are NOT NULL and are read by the dashboard / evaluation /
 * report screens, so they are still filled from the task list: totals for the whole request, task titles joined
 * into the title / as-is text. The structured list itself is saved in `use_cases`.
 */
export function buildLegacyFields(tasks: AiUseCase[], members: AiTeamMember[]): LegacyRequestFields {
  const nameOf = (key: string) => members.find((m) => memberKey(m) === key)?.name || '';
  const first = tasks[0]?.title.trim() || 'คำขอใช้งาน AI';
  const title = (tasks.length > 1 ? `${first} และอีก ${tasks.length - 1} งาน` : first).slice(0, 200);

  const as_is_process = tasks
    .map((t, i) => {
      const owner = nameOf(t.owner_key);
      return `${i + 1}) ${t.title.trim()}${owner ? ` (ผู้รับผิดชอบ: ${owner})` : ''}\n${t.as_is_process.trim()}`;
    })
    .join('\n\n');

  const dominant = [...tasks].sort((a, b) => timesPerWeek(b) - timesPerWeek(a))[0];
  const work_frequency: LegacyRequestFields['work_frequency'] =
    dominant?.frequency_unit === 'day' ? 'daily' : dominant?.frequency_unit === 'month' ? 'monthly' : 'weekly';

  const summary = summarize(tasks, members);
  return {
    title,
    as_is_process,
    work_frequency,
    as_is_hours_per_week: summary.hoursBeforePerWeek,
    ai_functions: Array.from(new Set(tasks.flatMap((t) => t.ai_functions))),
    target_hours_saved_per_week: summary.hoursSavedPerWeek,
  };
}

/** Task list as stored in `use_cases` (raw inputs plus the numbers derived from them, for SQL reporting). */
export function serializeUseCases(tasks: AiUseCase[]) {
  return tasks.map((t) => ({
    ...t,
    title: t.title.trim(),
    as_is_process: t.as_is_process.trim(),
    hours_before_per_week: round2(hoursBeforePerWeek(t)),
    hours_saved_per_week: round2(hoursSavedPerWeek(t)),
    basis_factor: basisFactor(t.basis),
  }));
}

/** A preset / sandbox package gives a single title + hours-per-week pair; express it as one weekly task. */
export function taskFromHoursPair(opts: {
  ownerKey: string;
  title: string;
  asIsProcess: string;
  aiFunctions: string[];
  asIsHoursPerWeek: number;
  targetHoursSavedPerWeek: number;
  basis?: EstimateBasis;
}): AiUseCase {
  const before = Math.max(0, opts.asIsHoursPerWeek) * 60;
  const after = Math.max(0, opts.asIsHoursPerWeek - opts.targetHoursSavedPerWeek) * 60;
  return {
    ...emptyUseCase(opts.ownerKey),
    title: opts.title,
    as_is_process: opts.asIsProcess,
    ai_functions: opts.aiFunctions,
    frequency_count: 1,
    frequency_unit: 'week',
    minutes_before: Math.round(before),
    minutes_after: Math.round(after),
    basis: opts.basis ?? 'experience',
  };
}
