/**
 * Client-side helpers for AI Chat attachments + safe image persistence.
 * Keeps large base64 out of localStorage to avoid Chrome OOM / Aw Snap.
 */

export type ChatFileKind = 'image' | 'pdf' | 'spreadsheet' | 'text' | 'other';

export interface ChatAttachment {
  id: string;
  name: string;
  kind: ChatFileKind;
  mime: string;
  size: number;
  /** Compressed data URL for images (kept small) */
  dataUrl?: string;
  /** Extracted text for PDF / Excel / CSV / plain text */
  textContent?: string;
  /** Short human summary for chips */
  summary: string;
}

const MAX_IMAGE_EDGE = 1280;
const MAX_IMAGE_BYTES_PERSIST = 450_000; // ~450KB data URL budget per image in storage
const MAX_EXTRACT_CHARS = 24_000;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB

export function isDataImageUrl(s: string): boolean {
  return typeof s === 'string' && s.startsWith('data:image/');
}

/** Strip oversized data:image payloads so localStorage / JSON never holds multi-MB strings */
export function stripHeavyMediaFromText(text: string): string {
  if (!text || !text.includes('data:image/')) return text;
  return text.replace(
    /!\[([^\]]*)\]\(data:image\/[^)]+\)/g,
    '![$1](about:blank#image-purged)'
  );
}

export function prepareSessionsForStorage<T extends { messages: { content: string }[] }>(
  sessions: T[]
): T[] {
  return sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m) => ({
      ...m,
      content: stripHeavyMediaFromText(m.content),
    })),
  }));
}

/** Resize + JPEG-compress a data URL / blob for safe in-memory + optional short-term display */
export async function compressImageSource(
  source: string | Blob,
  opts?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = opts?.quality ?? 0.72;

  const blob =
    typeof source === 'string'
      ? await (await fetch(source)).blob()
      : source;

  const bitmap = await createImageBitmap(blob);
  try {
    let { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    // Progressive quality drop if still huge
    while (dataUrl.length > MAX_IMAGE_BYTES_PERSIST && q > 0.35) {
      q -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    // Further shrink dimensions if needed
    if (dataUrl.length > MAX_IMAGE_BYTES_PERSIST) {
      const w2 = Math.round(width * 0.65);
      const h2 = Math.round(height * 0.65);
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(bitmap, 0, 0, w2, h2);
      dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

/**
 * Prefer remote http(s) URLs (cheap to store).
 * For data URLs / blobs: compress heavily before putting in chat state.
 */
export async function normalizeImageForChat(src: string | Blob): Promise<string> {
  if (typeof src === 'string' && /^https?:\/\//i.test(src)) {
    return src;
  }
  if (typeof src === 'string' && src.startsWith('blob:')) {
    const blob = await (await fetch(src)).blob();
    return compressImageSource(blob);
  }
  return compressImageSource(src);
}

function detectKind(file: File): ChatFileKind {
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('sheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    /\.(xlsx|xls|csv)$/.test(name)
  ) {
    return 'spreadsheet';
  }
  if (mime.startsWith('text/') || /\.(txt|md|json|log)$/.test(name)) return 'text';
  return 'other';
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Vite-friendly worker
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const maxPages = Math.min(doc.numPages, 25);
  const parts: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ');
    parts.push(`--- หน้า ${i} ---\n${line}`);
    if (parts.join('\n').length > MAX_EXTRACT_CHARS) break;
  }
  const text = parts.join('\n\n').slice(0, MAX_EXTRACT_CHARS);
  if (!text.trim()) {
    return `(PDF: ${file.name} — ${doc.numPages} หน้า · ดึงข้อความไม่ได้ อาจเป็นสแกนภาพ)`;
  }
  return `PDF: ${file.name} (${doc.numPages} หน้า, แสดง ${maxPages} หน้า)\n\n${text}`;
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const raw = await file.text();
    const lines = raw.split(/\r?\n/).slice(0, 80);
    const body = lines.join('\n').slice(0, MAX_EXTRACT_CHARS);
    return `CSV: ${file.name}\nแถวตัวอย่าง (สูงสุด 80):\n${body}`;
  }

  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames.slice(0, 5);
  const chunks: string[] = [`Excel: ${file.name}`, `ชีท: ${wb.SheetNames.join(', ')}`];

  for (const sheetName of sheets) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const sample = rows.slice(0, 40);
    const asCsv = sample
      .map((r) => r.map((c) => String(c ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');
    chunks.push(`\n### ชีท: ${sheetName} (${rows.length} แถว, แสดง ${sample.length})\n${asCsv}`);
    if (chunks.join('\n').length > MAX_EXTRACT_CHARS) break;
  }
  return chunks.join('\n').slice(0, MAX_EXTRACT_CHARS);
}

/** Parse a user File into a ChatAttachment ready for chat / OpenRouter */
export async function processChatFile(file: File): Promise<ChatAttachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกิน ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB`);
  }

  const kind = detectKind(file);
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const base = {
    id,
    name: file.name,
    kind,
    mime: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (kind === 'image') {
    const dataUrl = await compressImageSource(file, { maxEdge: 1600, quality: 0.78 });
    return {
      ...base,
      dataUrl,
      summary: `รูป ${file.name}`,
    };
  }

  if (kind === 'pdf') {
    const textContent = await extractPdfText(file);
    return {
      ...base,
      textContent,
      summary: `PDF ${file.name} · ${Math.round(textContent.length / 1000)}k ตัวอักษร`,
    };
  }

  if (kind === 'spreadsheet') {
    const textContent = await extractSpreadsheetText(file);
    return {
      ...base,
      textContent,
      summary: `ตาราง ${file.name}`,
    };
  }

  if (kind === 'text') {
    const textContent = (await file.text()).slice(0, MAX_EXTRACT_CHARS);
    return {
      ...base,
      textContent,
      summary: `ข้อความ ${file.name}`,
    };
  }

  throw new Error('รองรับเฉพาะ รูป (png/jpg/webp), PDF, Excel/CSV, ข้อความ');
}

/** Build OpenRouter multimodal / text content parts from attachments + user text */
export function buildMessageContentParts(
  text: string,
  attachments: ChatAttachment[]
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl);
  const docs = attachments.filter((a) => a.textContent);

  const docBlock = docs
    .map((d) => `\n\n[ไฟล์แนบ: ${d.name}]\n${d.textContent}`)
    .join('');

  const fullText = `${text}${docBlock}`.trim() || (images.length ? 'โปรดวิเคราะห์ไฟล์แนบ' : text);

  if (images.length === 0) {
    return fullText;
  }

  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: fullText },
  ];
  for (const img of images) {
    parts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl! },
    });
  }
  return parts;
}

export function attachmentsNeedVision(attachments: ChatAttachment[]): boolean {
  return attachments.some((a) => a.kind === 'image' && !!a.dataUrl);
}

/** Prefer a known vision-capable chat model id when user has images attached */
export function suggestVisionChatModel(currentId: string): string | null {
  const id = currentId.toLowerCase();
  if (
    id.includes('vision') ||
    id.includes('gpt-4o') ||
    id.includes('gpt-5') ||
    id.includes('claude') ||
    id.includes('gemini') ||
    id.includes('llama-4') ||
    id.includes('qwen') && id.includes('vl')
  ) {
    return null; // keep current
  }
  return 'google/gemini-2.5-flash';
}
