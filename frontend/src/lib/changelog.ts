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
