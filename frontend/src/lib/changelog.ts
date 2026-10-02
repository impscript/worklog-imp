// Manually maintained release notes for the "What's new" popup shown to users
// after a new version ships. Add a new entry to the TOP of this array each time
// you want to announce something — write it in plain language a non-technical
// employee can understand, not in developer/commit-message style.
//
// Wrap the key phrase of each bullet in **double asterisks** (e.g. the feature
// name or the main benefit) — UpdateAnnouncementModal renders that part in
// bold so readers can scan the highlights without reading every word.
//
// The FIRST entry's `version` is what the app currently considers "latest": a
// user sees the popup whenever the version stored in their browser doesn't
// match this one, then it's recorded as seen and won't show again until the
// next entry is added here.

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD, for display only
  title?: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-10-02',
    title: 'AI ประเมินผลงานรอบครึ่งปี/สิ้นปี (HR Official Standard)',
    highlights: [
      'เพิ่มระบบ **"AI ประเมินผลงานรอบครึ่งปี/สิ้นปี"** ตามเกณฑ์ HR 5 มิติจากบันทึกงานจริงอย่างเป็นธรรม',
      'วิเคราะห์ **"Modern Operating Paradigm"** เฉพาะบุคคล ตรวจจับการใช้ AI, ผู้ใช้งานจริง และ Expert Review',
      'ระบบ **"ประวัติการประเมิน"** แยกแท็บรอบประเมินทางการ พร้อมคลิกเปิดดูผลประเมินย้อนหลังได้ 100%',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-01',
    title: 'ยกระดับระบบคำนวณผลประหยัด (Save Cost)',
    highlights: [
      'ปรับหน้า **"Save Cost"** ใน Gantt ใหม่ สรุปผลประหยัดแยกมิติ กดขยายดูรายละเอียดได้สบายตาขึ้น',
      'Direct Savings เพิ่มเครื่องมือ **"อ้างอิงราคาตลาด"** คำนวณต้นทุนตามตำแหน่งและประสบการณ์อัตโนมัติ',
      'Indirect Savings ระบุ**รายการย่อยตามหมวดงานและแผนก** พร้อมคำนวณผู้ได้รับประโยชน์อัตโนมัติ',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-23',
    title: 'ปรับปรุงการแสดงผล Gantt & Kanban สำหรับผู้บริหาร',
    highlights: [
      'เพิ่มปุ่ม **"ซ่อนโครงการชั่วคราว"** ในหน้า Gantt & Kanban สำหรับนำเสนอผู้บริหาร โดยไม่กระทบข้อมูลจริง',
      'เพิ่มตัวเลือก **"เฉพาะโครงการแม่"** กรองดูเฉพาะโครงการหลักเพื่อความแม่นยำของตัวเลขสรุป',
      'แก้ไขข้อมูลโครงการได้โดย**ไม่ต้องโหลดหน้าใหม่ทั้งตาราง** ทำงานต่อเนื่องได้ทันที',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-09-17',
    title: 'ปรับปรุงความเสถียรการซิงค์ Google Calendar',
    highlights: [
      'แก้ปัญหางานบางรายการไม่แสดงบน **Google Calendar** พร้อมเพิ่มปุ่ม **"ล้างและซิงค์ใหม่"** ในหน้าปฏิทิน',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-17',
    title: 'ระบบงานประจำ (Routine Tasks) & Leaderboard',
    highlights: [
      'เพิ่มเมนู **"งานประจำ"** สำหรับบันทึกงานประจำรายวัน/สัปดาห์/เดือน พร้อมระบบแจ้งเตือนงานวันนี้',
      'ปรับปรุงการซิงค์ปฏิทิน และแก้ปัญหา Leaderboard แสดงชื่อไม่ครบเมื่อสลับ Workspace',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-01',
    title: 'เปิดตัวระบบ IMP Worklog',
    highlights: [
      'เปิดตัวระบบบันทึกงาน **IMP Worklog** และระบบแจ้งเตือนอัปเดตเวอร์ชันใหม่',
    ],
  },
];

export function getLatestVersion(): string {
  return CHANGELOG[0]?.version || '1.0.0';
}

// localStorage key tracking which version's popup a browser has already seen.
export const SEEN_VERSION_KEY = 'worklog_last_seen_version';
