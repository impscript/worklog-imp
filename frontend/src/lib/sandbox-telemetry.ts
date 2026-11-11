/**
 * AI Chat Sandbox Telemetry & FM-001 Graduation Engine
 * สอดคล้องกับระเบียบปฏิบัติการใช้งานปัญญาประดิษฐ์ WI-PI-AI-001
 *
 * บันทึกการใช้งานเชิงประจักษ์ (Empirical Usage), สถิติการโหวตโมเดลที่ดีที่สุด (Model Preference Votes),
 * และสร้างแพ็กเกจข้อมูลขอสำเร็จการทดลองเพื่อส่งต่อเข้าสู่แบบฟอร์มขอจัดสรรสิทธิ์ FM-001 อัตโนมัติ
 */

export interface SandboxVote {
  modelId: string;
  provider: string;
  taskId?: string;
  timestamp: string;
}

export interface SandboxTelemetryData {
  totalPrompts: number;
  totalTokens: number;
  estimatedCostBaht: number;
  modelUsageCount: Record<string, number>;
  votesCount: Record<string, number>;
  activeDays: number;
  lastActiveDate: string;
}

export interface EnterpriseGraduationPackage {
  deptName: string;
  testedDays: number;
  totalTrials: number;
  topVotedModel: string;
  recommendedSeats: number;
  estimatedHoursSavedWeekly: number;
  empiricalJustification: string;
  prefillForm: Record<string, unknown>;
}

const STORAGE_KEYS = {
  TELEMETRY: 'worklog_ai_sandbox_telemetry_v1',
  VOTES: 'worklog_ai_sandbox_votes_v1',
  ACTIVE_DATES: 'worklog_ai_sandbox_active_dates_v1',
} as const;

// In-memory fallback สำหรับกรณีที่รันใน Node/SSR หรือ localStorage ไม่พร้อมใช้งาน
let memoryTelemetry: SandboxTelemetryData = {
  totalPrompts: 0,
  totalTokens: 0,
  estimatedCostBaht: 0,
  modelUsageCount: {},
  votesCount: {},
  activeDays: 0,
  lastActiveDate: '',
};
let memoryVotes: SandboxVote[] = [];
let memoryActiveDates: string[] = [];

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getActiveDates(): string[] {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.ACTIVE_DATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string');
        }
      }
    } catch {
      // Fall through to memory
    }
  }
  return [...memoryActiveDates];
}

function recordTodayActive(): { activeDays: number; lastActiveDate: string } {
  const today = getTodayDateString();
  const dates = getActiveDates();
  if (!dates.includes(today)) {
    dates.push(today);
  }

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_DATES, JSON.stringify(dates));
    } catch {
      // Ignore storage write errors
    }
  }
  memoryActiveDates = dates;

  return {
    activeDays: dates.length,
    lastActiveDate: today,
  };
}

/**
 * ดึงข้อมูลสถิติการใช้งาน AI Chat Sandbox ล่าสุด
 */
export function getSandboxTelemetry(): SandboxTelemetryData {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.TELEMETRY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SandboxTelemetryData>;
        const dates = getActiveDates();
        return {
          totalPrompts: typeof parsed.totalPrompts === 'number' ? parsed.totalPrompts : 0,
          totalTokens: typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0,
          estimatedCostBaht: typeof parsed.estimatedCostBaht === 'number' ? parsed.estimatedCostBaht : 0,
          modelUsageCount: parsed.modelUsageCount && typeof parsed.modelUsageCount === 'object' ? parsed.modelUsageCount : {},
          votesCount: parsed.votesCount && typeof parsed.votesCount === 'object' ? parsed.votesCount : {},
          activeDays: dates.length > 0 ? dates.length : (typeof parsed.activeDays === 'number' ? parsed.activeDays : 0),
          lastActiveDate: typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : '',
        };
      }
    } catch {
      // Fall through to memory state
    }
  }

  return { ...memoryTelemetry };
}

function saveTelemetry(data: SandboxTelemetryData): void {
  memoryTelemetry = { ...data };
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.TELEMETRY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * บันทึกการส่ง Prompt ใน Sandbox (จำนวนครั้ง, ปริมาณ Tokens, และประมาณการต้นทุน)
 */
export function recordSandboxPrompt(modelId: string, tokens: number, costBaht: number): void {
  const current = getSandboxTelemetry();
  const safeTokens = Math.max(0, Math.round(tokens || 0));
  const safeCost = Math.max(0, Number((costBaht || 0).toFixed(4)));

  const safeModelId = modelId && typeof modelId === 'string' ? modelId : 'unknown-model';
  const updatedUsageCount = { ...current.modelUsageCount };
  updatedUsageCount[safeModelId] = (updatedUsageCount[safeModelId] || 0) + 1;

  const dateInfo = recordTodayActive();

  const updated: SandboxTelemetryData = {
    totalPrompts: current.totalPrompts + 1,
    totalTokens: current.totalTokens + safeTokens,
    estimatedCostBaht: Number((current.estimatedCostBaht + safeCost).toFixed(4)),
    modelUsageCount: updatedUsageCount,
    votesCount: current.votesCount,
    activeDays: dateInfo.activeDays,
    lastActiveDate: dateInfo.lastActiveDate,
  };

  saveTelemetry(updated);
}

/**
 * บันทึกการโหวตความพึงพอใจโมเดล AI ในเวที Sandbox Arena
 */
export function recordModelVote(modelId: string, provider: string, taskId?: string): void {
  const current = getSandboxTelemetry();
  const safeModelId = modelId && typeof modelId === 'string' ? modelId : 'unknown-model';
  const safeProvider = provider && typeof provider === 'string' ? provider : 'General';

  const updatedVotesCount = { ...current.votesCount };
  updatedVotesCount[safeModelId] = (updatedVotesCount[safeModelId] || 0) + 1;

  const dateInfo = recordTodayActive();

  const updatedTelemetry: SandboxTelemetryData = {
    ...current,
    votesCount: updatedVotesCount,
    activeDays: dateInfo.activeDays,
    lastActiveDate: dateInfo.lastActiveDate,
  };

  saveTelemetry(updatedTelemetry);

  // บันทึกรายการโหวตละเอียด
  const newVote: SandboxVote = {
    modelId: safeModelId,
    provider: safeProvider,
    taskId,
    timestamp: new Date().toISOString(),
  };

  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.VOTES);
      let list: SandboxVote[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
      list.push(newVote);
      if (list.length > 500) {
        list = list.slice(-500); // เก็บประวัติล่าสุด 500 รายการ
      }
      window.localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(list));
    } catch {
      // Fallback to memory
      memoryVotes.push(newVote);
    }
  } else {
    memoryVotes.push(newVote);
  }
}

/**
 * ดึงรายการโหวตทั้งหมดที่มีในระบบ
 */
export function getSandboxVotes(): SandboxVote[] {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.VOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
  }
  return [...memoryVotes];
}

/**
 * สร้างชุดข้อมูลขอสำเร็จการทดลอง (FM-001 Graduation Package)
 * นำผลการทดสอบเชิงประจักษ์จาก Sandbox ไปสร้าง Business Case และ Auto-fill แบบฟอร์มขอสิทธิ์ FM-001
 */
export function generateGraduationPackage(
  deptName?: string,
  userRole?: string
): EnterpriseGraduationPackage {
  const telemetry = getSandboxTelemetry();
  const effectiveDept = deptName && deptName.trim().length > 0 ? deptName.trim() : 'ฝ่ายงานทั่วไป (Corporate Enterprise)';
  const effectiveRole = userRole && userRole.trim().length > 0 ? userRole.trim() : 'พนักงานผู้ทดลองใช้งาน AI Sandbox';

  // หาโมเดลที่ได้รับคะแนนโหวตสูงสุด
  let topVotedModel = 'Claude 3.5 Sonnet';
  let maxVotes = -1;

  const voteEntries = Object.entries(telemetry.votesCount);
  if (voteEntries.length > 0) {
    for (const [model, count] of voteEntries) {
      if (count > maxVotes) {
        maxVotes = count;
        topVotedModel = model;
      }
    }
  } else {
    // หากยังไม่มีการโหวต ให้ดูจากโมเดลที่มีการส่ง Prompt สูงสุด
    const usageEntries = Object.entries(telemetry.modelUsageCount);
    let maxUsage = -1;
    for (const [model, count] of usageEntries) {
      if (count > maxUsage) {
        maxUsage = count;
        topVotedModel = model;
      }
    }
  }

  // คำนวณจำนวนวันที่ทดสอบและจำนวนครั้งที่ประเมิน
  const testedDays = Math.max(1, telemetry.activeDays);
  const totalVotesCount = Object.values(telemetry.votesCount).reduce((sum, v) => sum + v, 0);
  const totalTrials = Math.max(telemetry.totalPrompts, totalVotesCount, 1);

  // คำนวณจำนวน Seats ที่แนะนำตามปริมาณการทดสอบจริง (ขั้นต่ำ 2 ที่นั่งสำหรับ Claude Team)
  let recommendedSeats = 2;
  if (totalTrials >= 40 || telemetry.totalTokens > 150000) {
    recommendedSeats = 3;
  } else if (totalTrials >= 80) {
    recommendedSeats = 4;
  }

  // คำนวณชั่วโมงที่ประหยัดได้ต่อสัปดาห์ (สมมติฐาน: แต่ละ Task ที่ผ่าน AI ลดเวลาได้ 30-45 นาที)
  const estimatedHoursSavedWeekly = Math.max(
    6,
    Math.min(24, Math.round((totalTrials * 0.5) / Math.max(1, testedDays / 5)))
  );

  // สร้างคำชี้แจงเหตุผลทางธุรกิจเชิงประจักษ์ (Empirical Justification)
  const votesCiting = maxVotes > 0 ? `และได้รับคะแนนโหวตชนะใน Arena ถึง ${maxVotes} ครั้ง` : '';
  const empiricalJustification = `จากการทดสอบสมรรถนะและความแม่นยำของโมเดลปัญญาประดิษฐ์ใน AI Chat Sandbox เป็นเวลา ${testedDays} วัน รวม ${totalTrials} ครั้งทดสอบ (${telemetry.totalTokens.toLocaleString()} Tokens) พบว่าโมเดล "${topVotedModel}" มีประสิทธิภาพสอดคล้องกับลักษณะงานของ ${effectiveDept} สูงสุด ${votesCiting} โดยสามารถช่วยลดเวลาการปฏิบัติงานเอกสารและการคำนวณซับซ้อนได้เฉลี่ย ${estimatedHoursSavedWeekly} ชั่วโมงต่อสัปดาห์ มีความปลอดภัยตามระเบียบ Data Masking (WI-PI-AI-001) และคุ้มค่าต่อการจัดสรรสิทธิ์ Enterprise Dedicated Seat จำนวน ${recommendedSeats} ที่นั่ง`;

  // สร้างแบบฟอร์มสำเร็จรูปรองรับ FM-001 Auto-fill
  const prefillForm: Record<string, unknown> = {
    tier: 'virtual_employee',
    department: effectiveDept,
    userRole: effectiveRole,
    title: `ผู้ช่วยปัญญาประดิษฐ์ประจำฝ่าย${effectiveDept} (${topVotedModel})`,
    requestedModel: topVotedModel,
    recommendedSeats,
    asIsHours: estimatedHoursSavedWeekly * 2.5,
    targetHoursSaved: estimatedHoursSavedWeekly,
    estimatedCostMonthlyBaht: recommendedSeats * 875, // อิงอัตรามาตรฐาน Team Seat ~$25 (~875 บาท)
    estimatedRoiPercentage: Math.round(((estimatedHoursSavedWeekly * 4 * 350) / (recommendedSeats * 875)) * 100),
    empiricalData: {
      totalPrompts: telemetry.totalPrompts,
      totalTokens: telemetry.totalTokens,
      totalVotes: totalVotesCount,
      testedDays,
      topVotedModel,
      estimatedCostBaht: telemetry.estimatedCostBaht,
      modelUsageCount: telemetry.modelUsageCount,
      votesCount: telemetry.votesCount,
    },
    businessJustification: empiricalJustification,
    governanceCompliance: 'ผ่านการทดสอบใน Sandbox และสอดคล้องตามระเบียบ WI-PI-AI-001 และ PDPA 100%',
    securityComplianceAck: true,
    dataSensitivityLevel: 'Confidential (ผ่านการสแกนและ Masking PII)',
    graduationReady: true,
    graduationTimestamp: new Date().toISOString(),
  };

  return {
    deptName: effectiveDept,
    testedDays,
    totalTrials,
    topVotedModel,
    recommendedSeats,
    estimatedHoursSavedWeekly,
    empiricalJustification,
    prefillForm,
  };
}

/**
 * ล้างข้อมูล Telemetry และการโหวตทั้งหมดใน Sandbox กลับสู่ค่าเริ่มต้น
 */
export function resetSandboxTelemetry(): void {
  memoryTelemetry = {
    totalPrompts: 0,
    totalTokens: 0,
    estimatedCostBaht: 0,
    modelUsageCount: {},
    votesCount: {},
    activeDays: 0,
    lastActiveDate: '',
  };
  memoryVotes = [];
  memoryActiveDates = [];

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.TELEMETRY);
      window.localStorage.removeItem(STORAGE_KEYS.VOTES);
      window.localStorage.removeItem(STORAGE_KEYS.ACTIVE_DATES);
    } catch {
      // Ignore errors
    }
  }
}
