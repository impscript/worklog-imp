import { Clock, CheckCircle2, AlertCircle, type LucideIcon } from 'lucide-react';
import type { AiRequest, AiEvaluation } from '../../pages/AiEnterprisePage';

export type AiRequestStatus = AiRequest['status'];

/** Plain-language labels shared by the home page and the request history page. */
export const STATUS_META: Record<AiRequestStatus, { label: string; hint: string; badge: string; Icon: LucideIcon }> = {
  pending_review: {
    label: 'รอพิจารณา',
    hint: 'คำขอส่งแล้ว กำลังรอคณะกรรมการ CoE พิจารณา',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    Icon: Clock,
  },
  approved_sandbox: {
    label: 'อนุมัติแล้ว',
    hint: 'ใช้งานได้ในรอบ Sandbox 90 วัน อย่าลืมส่งรายงานผลงานรายเดือน',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    Icon: CheckCircle2,
  },
  waiting_list: {
    label: 'อยู่ในคิวรอ',
    hint: 'ผ่านการพิจารณาแล้ว รอสิทธิ์ว่างเพื่อเริ่มใช้งาน',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    Icon: Clock,
  },
  rejected: {
    label: 'ส่งกลับปรับปรุง',
    hint: 'ดูเหตุผลจาก CoE แล้วยื่นคำขอใหม่ได้',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    Icon: AlertCircle,
  },
  completed: {
    label: 'เสร็จสิ้น',
    hint: 'โครงการนี้สิ้นสุดแล้ว',
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    Icon: CheckCircle2,
  },
};

export const STATUS_ORDER: AiRequestStatus[] = ['pending_review', 'approved_sandbox', 'waiting_list', 'rejected', 'completed'];

export const DECISION_LABEL: Record<AiEvaluation['decision'], string> = {
  approve_sandbox: 'อนุมัติ (Sandbox 90 วัน)',
  waiting_list: 'ขึ้นคิวรอ',
  revision_needed: 'ส่งกลับให้แก้ไข',
  reject: 'ไม่อนุมัติ',
};

const UNKNOWN_STATUS_META = {
  hint: 'สถานะนี้ไม่อยู่ในรายการที่ระบบรู้จัก',
  badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
  Icon: AlertCircle,
};

/** Status label/badge for any value coming from the database; unknown values fall back instead of crashing. */
export function statusMeta(status: string | null | undefined) {
  return STATUS_META[status as AiRequestStatus] ?? { ...UNKNOWN_STATUS_META, label: status ? String(status) : 'ไม่ระบุสถานะ' };
}

/** JSON columns normally arrive as arrays, but older rows or other clients may have stored them as text or null. */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
