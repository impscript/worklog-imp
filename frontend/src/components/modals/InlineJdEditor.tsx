import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  Scale,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Loader2,
  RotateCcw,
  FileUp,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { extractJdPdfText } from '../../lib/jd-pdf-parser';

export interface JdResponsibilityItem {
  category: string;
  weight: number;
}

export interface SavedJdRecord {
  id?: string;
  jd_text: string;
  position_name: string;
  jd_source?: string;
  key_responsibilities: JdResponsibilityItem[];
}

export interface InlineJdEditorProps {
  userId: string;
  workspaceId: string;
  defaultPosition?: string;
  initialJd?: {
    id?: string;
    jd_text?: string;
    position_name?: string;
    key_responsibilities?: Record<string, unknown>[];
  } | null;
  isManagerEvaluated: boolean;
  canEdit: boolean;
  disabled?: boolean;
  onSaved: (saved: SavedJdRecord) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const MANAGER_PRESET_RESPONSIBILITIES: JdResponsibilityItem[] = [
  { category: 'การบริหารจัดการและวางแผนงานทีม (Planning & Strategy)', weight: 20 },
  { category: 'การส่งมอบผลลัพธ์และโครงการหลัก (Execution & Delivery)', weight: 25 },
  { category: 'การพัฒนาทีมและ Coaching (People & Coaching)', weight: 20 },
  { category: 'ความรับผิดชอบและการแก้ปัญหาเชิงระบบ (Accountability & Governance)', weight: 20 },
  { category: 'การริเริ่มปรับปรุงและนวัตกรรม (Proactiveness & Improvement)', weight: 15 },
];

const OFFICER_PRESET_RESPONSIBILITIES: JdResponsibilityItem[] = [
  { category: 'การปฏิบัติงานหลักและส่งมอบงาน (Execution & Delivery)', weight: 35 },
  { category: 'คุณภาพและความถูกต้องของงาน (Quality & Accuracy)', weight: 20 },
  { category: 'การวางแผนและจัดสรรเวลา (Planning & Time Management)', weight: 15 },
  { category: 'ความรับผิดชอบและการติดตามงาน (Accountability & Follow-up)', weight: 15 },
  { category: 'การเรียนรู้และปรับปรุงงาน (Learning & Improvement)', weight: 15 },
];

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function normalizeResponsibilities(raw: unknown): JdResponsibilityItem[] {
  if (!Array.isArray(raw)) return [];

  const result: JdResponsibilityItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const category = typeof record.category === 'string' ? record.category : '';
    const rawWeight = record.weight ?? record.weight_percentage;
    const parsedWeight =
      typeof rawWeight === 'number'
        ? rawWeight
        : typeof rawWeight === 'string' && rawWeight.trim() !== ''
          ? Number(rawWeight)
          : 0;

    result.push({
      category,
      weight: clampWeight(parsedWeight),
    });
  }
  return result;
}

function computeDefaultNewWeight(currentTotal: number): number {
  return Math.max(5, Math.min(20, 100 - currentTotal));
}

async function extractInvokeErrorMessage(error: unknown, fallback: string): Promise<string> {
  let errMsg = fallback;

  if (error instanceof Error && error.message) {
    errMsg = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      errMsg = msg;
    }
  }

  if (typeof error === 'object' && error !== null && 'context' in error) {
    const ctx = (error as { context?: unknown }).context;
    if (
      typeof ctx === 'object' &&
      ctx !== null &&
      'clone' in ctx &&
      typeof (ctx as { clone?: unknown }).clone === 'function'
    ) {
      try {
        const cloned = (ctx as { clone: () => { text: () => Promise<string> } }).clone();
        const text = await cloned.text();
        try {
          const parsed: unknown = JSON.parse(text);
          if (typeof parsed === 'object' && parsed !== null) {
            const parsedRecord = parsed as Record<string, unknown>;
            if (typeof parsedRecord.error === 'string' && parsedRecord.error.trim()) {
              return parsedRecord.error;
            }
            if (typeof parsedRecord.message === 'string' && parsedRecord.message.trim()) {
              return parsedRecord.message;
            }
          }
        } catch {
          if (text && text.length < 150) {
            return text;
          }
        }
      } catch {
        // Ignore response body parsing failures and fall back to error.message
      }
    }
  }

  return errMsg;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export const InlineJdEditor: React.FC<InlineJdEditorProps> = ({
  userId,
  workspaceId,
  defaultPosition = '',
  initialJd,
  isManagerEvaluated,
  canEdit,
  disabled = false,
  onSaved,
  onCancel,
  onDirtyChange,
}) => {
  const { showToast } = useNotification();

  const initialPosition = initialJd?.position_name || defaultPosition || '';
  const initialJdText = initialJd?.jd_text || '';
  const initialResponsibilities = useMemo(
    () => normalizeResponsibilities(initialJd?.key_responsibilities),
    [initialJd?.key_responsibilities]
  );

  const [positionName, setPositionName] = useState<string>(initialPosition);
  const [jdText, setJdText] = useState<string>(initialJdText);
  const [jdSource, setJdSource] = useState<string>('manual_entry');
  const [responsibilities, setResponsibilities] = useState<JdResponsibilityItem[]>(initialResponsibilities);

  const [newCategory, setNewCategory] = useState<string>('');
  const [newWeight, setNewWeight] = useState<number>(() =>
    computeDefaultNewWeight(initialResponsibilities.reduce((sum, r) => sum + r.weight, 0))
  );

  const [isRecommending, setIsRecommending] = useState<boolean>(false);
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pdfDraftInfo, setPdfDraftInfo] = useState<{
    fileName: string;
    confidence: string;
    notes: string[];
  } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = !canEdit || disabled;
  const isBusy = isRecommending || isParsingPdf || isSaving;

  const totalWeight = useMemo(
    () => responsibilities.reduce((sum, r) => sum + r.weight, 0),
    [responsibilities]
  );

  const isDirty = useMemo(() => {
    if (positionName !== initialPosition) return true;
    if (jdText !== initialJdText) return true;
    if (responsibilities.length !== initialResponsibilities.length) return true;
    return responsibilities.some((item, idx) => {
      const initialItem = initialResponsibilities[idx];
      return item.category !== initialItem.category || item.weight !== initialItem.weight;
    });
  }, [positionName, initialPosition, jdText, initialJdText, responsibilities, initialResponsibilities]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleReset = () => {
    setPositionName(initialPosition);
    setJdText(initialJdText);
    setResponsibilities(initialResponsibilities);
    setJdSource('manual_entry');
    setPdfDraftInfo(null);
    setNewCategory('');
    setNewWeight(
      computeDefaultNewWeight(initialResponsibilities.reduce((sum, r) => sum + r.weight, 0))
    );
  };

  const handlePdfFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isReadOnly || isBusy) return;

    setIsParsingPdf(true);
    try {
      const extracted = await extractJdPdfText(file);
      if (!extracted.ok) {
        showToast(extracted.message, 'warning', 6000);
        return;
      }

      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'parse_jd_pdf',
          pdf_text: extracted.text,
          file_name: extracted.fileName,
          default_position: positionName.trim() || defaultPosition || '',
          workspace_id: workspaceId,
        },
      });

      if (error) {
        const errMsg = await extractInvokeErrorMessage(error, 'ไม่สามารถสกัดข้อมูล JD จากไฟล์ PDF ได้');
        throw new Error(errMsg);
      }

      const payload = (typeof data === 'object' && data !== null ? data : null) as Record<
        string,
        unknown
      > | null;

      if (typeof payload?.position_name === 'string' && payload.position_name.trim()) {
        setPositionName(payload.position_name.trim());
      }

      if (typeof payload?.jd_text === 'string' && payload.jd_text.trim()) {
        setJdText(payload.jd_text.trim());
      }

      if (Array.isArray(payload?.key_responsibilities) && payload.key_responsibilities.length > 0) {
        const normalized = normalizeResponsibilities(payload.key_responsibilities);
        setResponsibilities(normalized);
        setNewWeight(computeDefaultNewWeight(normalized.reduce((sum, r) => sum + r.weight, 0)));
      }

      const confidence =
        typeof payload?.confidence === 'string' && ['high', 'medium', 'low'].includes(payload.confidence)
          ? payload.confidence
          : 'medium';
      const notes = Array.isArray(payload?.extraction_notes)
        ? payload.extraction_notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        : [];

      setJdSource('uploaded');
      setPdfDraftInfo({
        fileName: extracted.fileName,
        confidence,
        notes,
      });

      showToast(
        `ร่างข้อมูล JD จากไฟล์ "${extracted.fileName}" แล้ว กรุณาตรวจสอบข้อความและน้ำหนักให้ครบ 100% ก่อนกดบันทึก`,
        'info',
        5500
      );
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'ไม่สามารถนำเข้าข้อมูลจากไฟล์ PDF ได้'), 'error');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleAiRecommend = async () => {
    if (isReadOnly || isBusy) return;
    const targetPosition = positionName.trim() || defaultPosition || 'General Staff';
    setIsRecommending(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'recommend_jd',
          position: targetPosition,
          target_weights: responsibilities,
          workspace_id: workspaceId,
        },
      });

      if (error) {
        const errMsg = await extractInvokeErrorMessage(error, 'ไม่สามารถขอคำแนะนำ JD จาก AI ได้');
        throw new Error(errMsg);
      }

      const payload = (typeof data === 'object' && data !== null ? data : null) as Record<
        string,
        unknown
      > | null;

      if (typeof payload?.jd_text === 'string') {
        setJdText(payload.jd_text);
      }

      if (Array.isArray(payload?.key_responsibilities) && payload.key_responsibilities.length > 0) {
        const normalized = normalizeResponsibilities(payload.key_responsibilities);
        setResponsibilities(normalized);
        setNewWeight(computeDefaultNewWeight(normalized.reduce((sum, r) => sum + r.weight, 0)));
      }

      setJdSource('ai_recommended');
      const actualModel = typeof payload?.actualModel === 'string' ? ` (${payload.actualModel})` : '';
      showToast(`AI แนะนำ JD สำหรับตำแหน่ง "${targetPosition}" เรียบร้อยแล้ว${actualModel}`, 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'ไม่สามารถขอคำแนะนำ JD จาก AI ได้'), 'error');
    } finally {
      setIsRecommending(false);
    }
  };

  const handleApplyStarterPreset = () => {
    if (isReadOnly || isBusy) return;
    const preset = isManagerEvaluated
      ? MANAGER_PRESET_RESPONSIBILITIES
      : OFFICER_PRESET_RESPONSIBILITIES;
    const cloned = preset.map((item) => ({ ...item }));
    setResponsibilities(cloned);
    setNewWeight(computeDefaultNewWeight(100));
  };

  const handleAutoBalance = () => {
    if (isReadOnly || isBusy || responsibilities.length === 0 || totalWeight === 100) return;

    const count = responsibilities.length;
    let runningSum = 0;

    const balanced = responsibilities.map((item, idx) => {
      if (idx === count - 1) {
        return {
          ...item,
          weight: Math.max(0, 100 - runningSum),
        };
      }

      const rawScaled =
        totalWeight === 0 ? Math.floor(100 / count) : Math.round((item.weight / totalWeight) * 100);
      const safeWeight = Math.min(100 - runningSum, Math.max(0, rawScaled));
      runningSum += safeWeight;

      return {
        ...item,
        weight: safeWeight,
      };
    });

    setResponsibilities(balanced);
    setNewWeight(computeDefaultNewWeight(100));
  };

  const handleCategoryChange = (index: number, category: string) => {
    setResponsibilities((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, category } : item))
    );
  };

  const handleWeightChange = (index: number, value: number) => {
    const nextWeight = clampWeight(Math.round(value));
    setResponsibilities((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, weight: nextWeight } : item))
    );
  };

  const handleRemoveResponsibility = (index: number) => {
    setResponsibilities((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const nextTotal = next.reduce((sum, r) => sum + r.weight, 0);
      setNewWeight(computeDefaultNewWeight(nextTotal));
      return next;
    });
  };

  const handleAddResponsibility = () => {
    if (isReadOnly || isBusy) return;
    const trimmed = newCategory.trim();
    if (!trimmed) {
      showToast('กรุณากรอกชื่อหมวดภารกิจความรับผิดชอบ', 'warning');
      return;
    }

    const clamped = clampWeight(Math.round(newWeight));
    const nextList = [...responsibilities, { category: trimmed, weight: clamped }];
    const nextTotal = nextList.reduce((sum, r) => sum + r.weight, 0);

    setResponsibilities(nextList);
    setNewCategory('');
    setNewWeight(computeDefaultNewWeight(nextTotal));
  };

  const handleSave = async () => {
    if (!canEdit || disabled || isBusy) return;

    const trimmedJd = jdText.trim();
    if (!trimmedJd) {
      showToast('กรุณากรอกรายละเอียด Job Description (JD) ก่อนบันทึก', 'warning');
      return;
    }

    const cleanResponsibilities: JdResponsibilityItem[] = responsibilities
      .map((item) => ({
        category: item.category.trim(),
        weight: clampWeight(item.weight),
      }))
      .filter((item) => item.category.length > 0);

    const cleanTotalWeight = cleanResponsibilities.reduce((sum, item) => sum + item.weight, 0);
    if (cleanResponsibilities.length > 0 && cleanTotalWeight !== 100) {
      showToast(`น้ำหนักรวมต้องเท่ากับ 100% พอดี (ปัจจุบัน ${cleanTotalWeight}%)`, 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const trimmedPosition = positionName.trim();
      const nowIso = new Date().toISOString();

      const { data: savedRow, error } = await supabase
        .from('tb_user_jd')
        .upsert(
          {
            user_id: userId,
            jd_text: trimmedJd,
            jd_source: jdSource,
            position_name: trimmedPosition,
            key_responsibilities: cleanResponsibilities,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        )
        .select('id, jd_text, position_name, jd_source, key_responsibilities')
        .maybeSingle();

      if (error) {
        if (error.message.toLowerCase().includes('row-level security')) {
          showToast(
            'ไม่มีสิทธิ์บันทึกข้อมูล: เฉพาะเจ้าตัวพนักงาน, Admin ของ Workspace หรือ System Admin เท่านั้นที่สามารถแก้ไขและบันทึก JD ได้',
            'error',
            5000
          );
          return;
        }
        throw new Error(error.message);
      }

      if (trimmedPosition) {
        const { error: userSyncError } = await supabase
          .from('users')
          .update({
            position: trimmedPosition,
            updated_at: nowIso,
          })
          .eq('id', userId);

        if (userSyncError) {
          console.warn('Non-fatal warning syncing users.position:', userSyncError);
        }
      }

      const rowObj = (typeof savedRow === 'object' && savedRow !== null ? savedRow : null) as Record<
        string,
        unknown
      > | null;

      const savedRecord: SavedJdRecord = {
        id: typeof rowObj?.id === 'string' ? rowObj.id : initialJd?.id,
        jd_text: typeof rowObj?.jd_text === 'string' ? rowObj.jd_text : trimmedJd,
        position_name:
          typeof rowObj?.position_name === 'string' ? rowObj.position_name : trimmedPosition,
        jd_source: typeof rowObj?.jd_source === 'string' ? rowObj.jd_source : jdSource,
        key_responsibilities: Array.isArray(rowObj?.key_responsibilities)
          ? normalizeResponsibilities(rowObj.key_responsibilities)
          : cleanResponsibilities,
      };

      setResponsibilities(savedRecord.key_responsibilities);
      setPdfDraftInfo(null);
      showToast('บันทึก JD และสัดส่วนน้ำหนักเรียบร้อยแล้ว', 'success');
      onSaved(savedRecord);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'ไม่สามารถบันทึก Job Description ได้');
      if (msg.toLowerCase().includes('row-level security')) {
        showToast(
          'ไม่มีสิทธิ์บันทึกข้อมูล: เฉพาะเจ้าตัวพนักงาน, Admin ของ Workspace หรือ System Admin เท่านั้นที่สามารถแก้ไขและบันทึก JD ได้',
          'error',
          5000
        );
      } else {
        showToast(`บันทึก JD ไม่สำเร็จ: ${msg}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const weightStatus = useMemo(() => {
    if (totalWeight === 100) {
      return {
        barClass: 'bg-emerald-500',
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
        label: 'ครบ 100% พร้อมบันทึก',
      };
    }
    if (totalWeight < 100) {
      return {
        barClass: 'bg-amber-500',
        badgeClass:
          'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
        label: `ขาดอีก ${100 - totalWeight}%`,
      };
    }
    return {
      barClass: 'bg-rose-500',
      badgeClass:
        'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      label: `เกินมา ${totalWeight - 100}%`,
    };
  }, [totalWeight]);

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-white/95 dark:bg-slate-900/90 p-4 space-y-4 shadow-sm">
      {/* Permission Notice */}
      {!canEdit && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">โหมดดูข้อมูลอย่างเดียว:</span>{' '}
            เฉพาะเจ้าตัวพนักงาน, Admin ของ Workspace หรือ System Admin เท่านั้นที่สามารถแก้ไขและบันทึก JD ของผู้ใช้นี้ได้
          </div>
        </div>
      )}

      {/* PDF Draft Verification Banner */}
      {pdfDraftInfo && (
        <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300/80 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <FileText size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>ฉบับร่างจาก PDF: {pdfDraftInfo.fileName}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300/70 dark:border-amber-700/60">
              ความมั่นใจการถอดข้อความ:{' '}
              {pdfDraftInfo.confidence === 'high'
                ? 'สูง'
                : pdfDraftInfo.confidence === 'low'
                  ? 'ต่ำ (ควรตรวจละเอียด)'
                  : 'ปานกลาง'}
            </span>
          </div>
          <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            ข้อมูลนี้เป็นเพียง<strong>ฉบับร่างที่ยังไม่ถูกบันทึก</strong> กรุณาตรวจสอบรายละเอียด JD และสัดส่วนน้ำหนักให้ครบ 100% แล้วกดปุ่ม <strong>&quot;บันทึก JD ลงระบบ&quot;</strong> เพื่อให้ระบบนำไปใช้ประเมิน
          </p>
          {pdfDraftInfo.notes.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
              {pdfDraftInfo.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Position Input + PDF Import & AI Recommend */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Briefcase size={14} className="text-indigo-500" />
            <span>ชื่อตำแหน่งงาน (Position Name)</span>
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfFileSelected}
              className="hidden"
              disabled={isReadOnly || isBusy}
            />
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isReadOnly || isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isParsingPdf ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>กำลังอ่านไฟล์ PDF...</span>
                </>
              ) : (
                <>
                  <FileUp size={13} />
                  <span>นำเข้าจาก PDF (ช่วยร่าง)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleAiRecommend}
              disabled={isReadOnly || isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRecommending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>กำลังสร้างคำแนะนำ...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>AI แนะนำ JD &amp; น้ำหนัก</span>
                </>
              )}
            </button>
          </div>
        </div>

        <input
          type="text"
          value={positionName}
          onChange={(e) => setPositionName(e.target.value)}
          disabled={isReadOnly || isBusy}
          placeholder="เช่น Senior Software Engineer, HR Specialist, Marketing Manager"
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
        />
      </div>

      {/* JD Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            รายละเอียด Job Description (JD)
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            {jdText.length.toLocaleString()} ตัวอักษร
          </span>
        </div>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          disabled={isReadOnly || isBusy}
          rows={5}
          placeholder="ระบุขอบเขตงาน หน้าที่ความรับผิดชอบหลัก KPI หรือเป้าหมายสำคัญของตำแหน่งนี้..."
          className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 resize-y leading-relaxed disabled:opacity-60"
        />
      </div>

      {/* Responsibility Weight Distribution */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Scale size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              สัดส่วนน้ำหนักความรับผิดชอบ (Responsibility Weights)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {responsibilities.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${weightStatus.badgeClass}`}
              >
                {totalWeight === 100 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                <span className="font-mono">{totalWeight}%</span>
                <span>• {weightStatus.label}</span>
              </span>
            )}

            {responsibilities.length > 0 && totalWeight !== 100 && (
              <button
                type="button"
                onClick={handleAutoBalance}
                disabled={isReadOnly || isBusy}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                เกลี่ยให้ครบ 100%
              </button>
            )}
          </div>
        </div>

        {/* Visual Weight Progress Bar */}
        {responsibilities.length > 0 && (
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/70 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${weightStatus.barClass}`}
              style={{ width: `${Math.min(100, Math.max(0, totalWeight))}%` }}
            />
          </div>
        )}

        {/* Empty State & Starter Preset */}
        {responsibilities.length === 0 ? (
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              ยังไม่มีหมวดภารกิจและสัดส่วนน้ำหนัก สามารถเพิ่มเองทีละข้อหรือใช้โครงสร้างมาตรฐาน 5 ด้านได้ทันที
            </p>
            <button
              type="button"
              onClick={handleApplyStarterPreset}
              disabled={isReadOnly || isBusy}
              className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ใช้โครงสร้างมาตรฐาน 5 ด้าน
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {responsibilities.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center gap-2.5"
              >
                <input
                  type="text"
                  value={item.category}
                  onChange={(e) => handleCategoryChange(idx, e.target.value)}
                  disabled={isReadOnly || isBusy}
                  placeholder={`หมวดภารกิจที่ ${idx + 1}`}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={item.weight}
                    onChange={(e) => handleWeightChange(idx, Number(e.target.value))}
                    disabled={isReadOnly || isBusy}
                    aria-label={`สัดส่วนน้ำหนัก ${item.category || `หมวด ${idx + 1}`}`}
                    className="w-24 sm:w-28 accent-indigo-600 cursor-pointer disabled:opacity-50"
                  />

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.weight}
                      onChange={(e) => handleWeightChange(idx, Number(e.target.value))}
                      disabled={isReadOnly || isBusy}
                      className="w-14 px-2 py-1 text-xs font-mono font-bold text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                    />
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      %
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveResponsibility(idx)}
                    disabled={isReadOnly || isBusy}
                    title="ลบหมวดภารกิจ"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline Add Responsibility Form */}
        <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddResponsibility();
              }
            }}
            disabled={isReadOnly || isBusy}
            placeholder="เพิ่มหมวดภารกิจใหม่ เช่น การประสานงานลูกค้า"
            className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
          />

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={newWeight}
                onChange={(e) => setNewWeight(clampWeight(Number(e.target.value)))}
                disabled={isReadOnly || isBusy}
                aria-label="น้ำหนักหมวดภารกิจใหม่"
                className="w-16 px-2 py-1.5 text-xs font-mono font-bold text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              />
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">%</span>
            </div>

            <button
              type="button"
              onClick={handleAddResponsibility}
              disabled={isReadOnly || isBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              <span>เพิ่มหมวดภารกิจ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div>
          {isDirty && canEdit && !disabled && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={13} />
              <span>คืนค่าเดิม</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnly || isBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>บันทึก JD</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineJdEditor;
