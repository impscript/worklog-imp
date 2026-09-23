// Manually maintained release notes for the "What's new" popup shown to users
// after a new version ships. Add a new entry to the TOP of this array each time
// you want to announce something — write it in plain language a non-technical
// employee can understand, not in developer/commit-message style.
//
// The FIRST entry's `version` is what the app currently considers "latest": a
// user sees the popup whenever the version stored in their browser doesn't
// match this one, then it's recorded as seen and won't show again until the
// next entry is added here.

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD, for display only
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-09-23',
    highlights: [
      'เพิ่มปุ่ม "ซ่อนโครงการชั่วคราว" ในหน้า Gantt & Kanban สำหรับตอนนำเสนอผู้บริหาร กดซ่อนโครงการที่ไม่เกี่ยวข้องออกจากจอได้ชั่วคราว (ไม่กระทบข้อมูลจริง กู้คืนได้ทุกเมื่อ และทุกคนที่เข้าหน้านี้จะเห็นเหมือนกัน)',
      'เพิ่มตัวเลือก "เฉพาะโครงการแม่" ให้เลือกดูเฉพาะโครงการหลัก ไม่นับรวมโครงการย่อยปนกัน ตัวเลขบนการ์ดกับในตารางจะตรงกันเสมอ',
      'แก้ไขข้อมูลโครงการในหน้า Gantt แล้วไม่ต้องโหลดหน้าใหม่ทั้งตาราง ทำงานต่อจากจุดเดิมที่ค้างอยู่ได้ทันที',
      'ปรับหน้าจอ Gantt & Kanban ให้กะทัดรัดขึ้น เห็นตารางงานได้มากขึ้นในจอเดียว',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-09-17',
    highlights: [
      'ถ้าเคยสังเกตว่างานที่บันทึกไว้บางรายการหายไปจาก Google Calendar (ทั้งที่หน้าเว็บแจ้งว่าซิงค์สำเร็จแล้ว) ตอนนี้แก้ต้นเหตุแล้ว',
      'ส่วนงานเก่าที่หายไปก่อนหน้านี้ ต้องกดซ่อมด้วยตัวเอง: ไปที่หน้า "ปฏิทิน" เลือกเดือนที่มีปัญหา แล้วกดปุ่ม "ล้างและซิงค์ใหม่" เพื่อสร้างข้อมูลบน Google Calendar ใหม่ทั้งหมด (ทำแบบนี้ทีละเดือนสำหรับทุกเดือนที่เคยเจอปัญหา)',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-17',
    highlights: [
      'เพิ่มเมนู "งานประจำ" สำหรับบันทึกงานที่ต้องทำซ้ำๆ (รายวัน/รายสัปดาห์/รายเดือน/รายปี) พร้อมระบบเตือนว่าวันนี้มีงานอะไรต้องทำบ้าง',
      'แก้ปัญหาบันทึกงานแล้วไม่ขึ้นบน Google Calendar บางรายการ',
      'แก้ปัญหาปฏิทินโหลดข้อมูลใหม่บ่อยเกินไปตอนสลับหน้าต่าง',
      'แก้ปัญหาบอร์ดผู้นำ (Leaderboard) แสดงชื่อไม่ครบเมื่อสลับดู Workspace อื่น',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-01',
    highlights: [
      'เวอร์ชันเริ่มต้นของระบบแจ้งอัปเดต',
    ],
  },
];

export function getLatestVersion(): string {
  return CHANGELOG[0]?.version || '1.0.0';
}

// localStorage key tracking which version's popup a browser has already seen.
export const SEEN_VERSION_KEY = 'worklog_last_seen_version';
