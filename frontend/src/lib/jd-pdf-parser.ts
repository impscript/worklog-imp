const MAX_JD_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_JD_PDF_PAGES = 15;
const MAX_JD_PDF_CHARS = 18_000;
const MIN_READABLE_CHARS = 50;

export type JdPdfExtractResult =
  | {
      ok: true;
      text: string;
      pageCount: number;
      extractedPages: number;
      fileName: string;
    }
  | {
      ok: false;
      reason: 'invalid_type' | 'file_too_large' | 'scanned_or_empty' | 'read_error';
      message: string;
      pageCount?: number;
    };

function isPdfFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

function readTextItemStr(item: unknown): string {
  if (item && typeof item === 'object' && 'str' in item) {
    const str = (item as { str?: unknown }).str;
    return typeof str === 'string' ? str : '';
  }
  return '';
}

/**
 * Extracts readable text from a JD PDF file in the browser using `pdfjs-dist`.
 * Detects scanned/image-only PDFs cleanly so callers never fabricate JD data.
 */
export async function extractJdPdfText(file: File): Promise<JdPdfExtractResult> {
  if (!isPdfFile(file)) {
    return {
      ok: false,
      reason: 'invalid_type',
      message: 'กรุณาเลือกไฟล์นามสกุล .pdf เท่านั้น',
    };
  }

  if (file.size > MAX_JD_PDF_SIZE_BYTES) {
    return {
      ok: false,
      reason: 'file_too_large',
      message: 'ไฟล์ PDF มีขนาดเกิน 10 MB กรุณาลดขนาดไฟล์ก่อนนำเข้า',
    };
  }

  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const buffer = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const extractedPages = Math.min(doc.numPages, MAX_JD_PDF_PAGES);
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= extractedPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageLine = content.items
        .map((item) => readTextItemStr(item))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageLine) {
        pageTexts.push(`--- หน้า ${pageNum} ---\n${pageLine}`);
      }
      if (pageTexts.join('\n\n').length >= MAX_JD_PDF_CHARS) {
        break;
      }
    }

    const combinedText = pageTexts.join('\n\n').slice(0, MAX_JD_PDF_CHARS).trim();
    const textWithoutHeaders = combinedText.replace(/--- หน้า \d+ ---/g, '').trim();

    if (textWithoutHeaders.length < MIN_READABLE_CHARS) {
      return {
        ok: false,
        reason: 'scanned_or_empty',
        pageCount: doc.numPages,
        message:
          'ไฟล์ PDF นี้เป็นภาพสแกนหรือมีข้อความน้อยเกินไป ไม่สามารถอ่านข้อความอัตโนมัติได้ กรุณาก็อปปี้ข้อความมาวางหรือใช้ปุ่ม "AI แนะนำ JD & น้ำหนัก" แทน',
      };
    }

    return {
      ok: true,
      text: combinedText,
      pageCount: doc.numPages,
      extractedPages,
      fileName: file.name,
    };
  } catch (err: unknown) {
    console.error('Failed to extract text from JD PDF:', err);
    return {
      ok: false,
      reason: 'read_error',
      message: 'ไม่สามารถเปิดอ่านไฟล์ PDF ได้ (ไฟล์อาจเสียหายหรือติดรหัสผ่าน)',
    };
  }
}
