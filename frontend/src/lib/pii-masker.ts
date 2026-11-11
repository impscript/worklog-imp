/**
 * WI-PI-AI-001 Data Masking & PII Scanner
 * สอดคล้องกับระเบียบปฏิบัติการใช้งานปัญญาประดิษฐ์ WI-PI-AI-001 และ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
 *
 * ทำหน้าที่ตรวจจับและ Masking ข้อมูลส่วนบุคคลอ่อนไหว (PII) ก่อนส่งต่อไปยัง LLM:
 * 1. เลขประจำตัวประชาชนไทย (Thai National ID - 13 หลัก ทั้งแบบมีขีด/เว้นวรรค และตัวเลขติดกัน พร้อม Checksum)
 * 2. เลขที่บัญชีธนาคาร (Bank Account Numbers - 10-12 หลัก)
 * 3. เบอร์โทรศัพท์มือถือและเบอร์บ้านในประเทศไทย (Thai Phone Numbers)
 * 4. อีเมล (Email Addresses)
 */

export type PiiType = 'thai_id' | 'bank_account' | 'phone' | 'email';

export interface PiiMatch {
  type: PiiType;
  rawText: string;
  startIndex: number;
  endIndex: number;
  replacement: string;
}

export interface PiiScanResult {
  hasPii: boolean;
  detectedTypes: ('thai_id' | 'bank_account' | 'phone' | 'email')[];
  maskedText: string;
  matchesCount: number;
  matches?: PiiMatch[];
}

export const PII_MASKS: Record<PiiType, string> = {
  thai_id: '[MASKED_THAI_ID]',
  bank_account: '[MASKED_BANK_ACC]',
  phone: '[MASKED_PHONE]',
  email: '[MASKED_EMAIL]',
};

/**
 * คำนวณตรวจสอบ Checksum ของเลขประจำตัวประชาชนไทย 13 หลัก
 * สูตร: Sum(d_i * (14 - i)) mod 11, checkDigit = (11 - mod) mod 10
 */
export function isValidThaiIdChecksum(idStr: string): boolean {
  const digits = idStr.replace(/\D/g, '');
  if (digits.length !== 13) return false;

  // ป้องกันเลขตองหรือเลขจำลอง เช่น 0000000000000 หรือ 1111111111111
  if (/^(\d)\1{12}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits.charAt(i), 10);
    sum += digit * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(digits.charAt(12), 10);
}

/**
 * สแกนหา PII ในข้อความและส่งคืนผลลัพธ์พร้อมข้อความที่ทำการ Mask เรียบร้อยแล้ว
 */
export function scanPii(text: string): PiiScanResult {
  if (!text || typeof text !== 'string') {
    return {
      hasPii: false,
      detectedTypes: [],
      maskedText: text || '',
      matchesCount: 0,
      matches: [],
    };
  }

  const rawMatches: PiiMatch[] = [];

  // 1. ตรวจจับ Email Address (standard email regex)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let m: RegExpExecArray | null;
  while ((m = emailRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'email',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.email,
    });
  }

  // 2. ตรวจจับเลขบัตรประชาชนไทย (Thai National ID)
  // รูปแบบมีขีดหรือวรรค: 1-2345-67890-12-3 หรือ 1 2345 67890 12 3
  const formattedIdRegex = /\b\d{1}[-\s]\d{4}[-\s]\d{5}[-\s]\d{2}[-\s]\d{1}\b/g;
  while ((m = formattedIdRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'thai_id',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.thai_id,
    });
  }

  // รูปแบบ 13 หลักติดกัน: \b\d{13}\b
  const raw13DigitsRegex = /\b\d{13}\b/g;
  while ((m = raw13DigitsRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'thai_id',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.thai_id,
    });
  }

  // 3. ตรวจจับเบอร์โทรศัพท์ (Thai Phone Numbers)
  // มือถือ/บ้าน มีขีดหรือวรรค e.g. 081-234-5678, 081-2345678, 02-123-4567, +66 81-234-5678
  const formattedPhoneRegex = /\b(?:\+?66[-\s]?|0)(?:[689]\d{1}[-\s]?\d{3,4}[-\s]?\d{4}|[2-7]\d{1}[-\s]?\d{3}[-\s]?\d{3,4})\b/g;
  while ((m = formattedPhoneRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'phone',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.phone,
    });
  }

  // เบอร์มือถือ 10 หลักติดกัน เริ่มต้นด้วย 06, 08, 09
  const rawMobileRegex = /\b0[689]\d{8}\b/g;
  while ((m = rawMobileRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'phone',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.phone,
    });
  }

  // เบอร์บ้าน 9-10 หลักติดกัน เริ่มต้นด้วย 02-07
  const rawLandlineRegex = /\b0[2-7]\d{7,8}\b/g;
  while ((m = rawLandlineRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'phone',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.phone,
    });
  }

  // 4. ตรวจจับเลขที่บัญชีธนาคาร (Bank Account Numbers - 10-12 หลัก)
  // รูปแบบมีขีด e.g. 123-1-45678-9, 123-4-56789-0, 123-456789-0
  const formattedBankRegex = /\b\d{3}[-\s]\d{1,2}[-\s]\d{4,6}[-\s]\d{1}\b|\b\d{3}[-\s]\d{6,7}[-\s]\d{1}\b/g;
  while ((m = formattedBankRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'bank_account',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.bank_account,
    });
  }

  // ตัวเลข 10-12 หลักติดกัน ที่ไม่ขึ้นต้นด้วย 0 (เนื่องจากถ้าขึ้นต้นด้วย 0 จะเป็นเบอร์โทรศัพท์)
  const rawBankRegex = /\b[1-9]\d{9,11}\b/g;
  while ((m = rawBankRegex.exec(text)) !== null) {
    rawMatches.push({
      type: 'bank_account',
      rawText: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      replacement: PII_MASKS.bank_account,
    });
  }

  // กำจัด Match ที่ซ้อนทับกัน (De-duplicate and resolve overlapping spans)
  // เรียงลำดับตาม startIndex ก่อน ถ้าเท่ากันให้เลือกช่วงที่ยาวกว่า
  rawMatches.sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  const resolvedMatches: PiiMatch[] = [];
  let lastEnd = -1;

  for (const match of rawMatches) {
    if (match.startIndex >= lastEnd) {
      resolvedMatches.push(match);
      lastEnd = match.endIndex;
    }
  }

  // ทำการ Mask ข้อความจากขวาไปซ้าย (จากท้ายมาหน้า) เพื่อไม่ให้ index เลื่อน
  let maskedText = text;
  const sortedDesc = [...resolvedMatches].sort((a, b) => b.startIndex - a.startIndex);
  for (const match of sortedDesc) {
    maskedText =
      maskedText.slice(0, match.startIndex) +
      match.replacement +
      maskedText.slice(match.endIndex);
  }

  // รวบรวมประเภทที่ตรวจพบ (Unique Types)
  const detectedTypesSet = new Set<('thai_id' | 'bank_account' | 'phone' | 'email')>();
  for (const match of resolvedMatches) {
    detectedTypesSet.add(match.type);
  }

  const detectedTypes = Array.from(detectedTypesSet);

  return {
    hasPii: resolvedMatches.length > 0,
    detectedTypes,
    maskedText,
    matchesCount: resolvedMatches.length,
    matches: resolvedMatches,
  };
}

/**
 * Mask ข้อความที่มี PII ทั้งหมดด้วยป้ายกำกับมาตรฐาน
 * [MASKED_THAI_ID], [MASKED_BANK_ACC], [MASKED_PHONE], [MASKED_EMAIL]
 */
export function maskPii(text: string): string {
  return scanPii(text).maskedText;
}
