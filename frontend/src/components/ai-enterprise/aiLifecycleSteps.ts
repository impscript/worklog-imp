export type LifecycleStepId = 'intake' | 'evaluation' | 'execution' | 'review';

export interface StepDetail {
  id: LifecycleStepId;
  stepNumber: number;
  title: string;
  subtitle: string;
  role: string;
  timeline: string;
  /** Optional shortcut shown under the step; the request step has none (the form opens from the page header). */
  tabTarget?: 'dashboard' | 'evaluations' | 'reports' | 'governance';
  actionLabel?: string;
  what: string;
  who: string;
  when: string;
  how: string[];
  pillar3T: {
    name: 'Trust' | 'Transparency' | 'Transformation';
    desc: string;
    badgeClass: string;
  };
  sampleMetric: {
    label: string;
    value: string;
    delta: string;
    subtext: string;
  };
}

export const LIFECYCLE_STEPS: StepDetail[] = [
  {
    id: 'intake',
    stepNumber: 1,
    title: 'เลือก Tier & ยื่นขอใช้งาน AI',
    subtitle: 'กำหนด AI JD & ขอจัดสรรสิทธิ์',
    role: 'ผู้ขอใช้งาน (Requester)',
    timeline: 'ยื่นได้ตลอดเวลา (พิจารณารอบถัดไป)',
    what: 'ระบุโจทย์งาน กระบวนการทำงานเดิม (As-Is) และเลือกประเภทสิทธิ์ที่ต้องการใช้งานให้ตรงกับเนื้องาน',
    who: 'พนักงานทุกระดับ หรือหัวหน้าทีม (Department Lead / Project Owner)',
    when: 'ยื่นคำขอได้ตลอดทั้งเดือน โดย CoE จะนำเข้าประชุมพิจารณาตัดรอบทุกวันที่ 15',
    how: [
      'ประเมินความจำเป็น: หากเป็นงานเฉพาะทาง/สัญญาลึก เลือก Tier 1 (Virtual AI Employee) หรือหากเป็นงานค้นคว้าทั่วไปเลือก Tier 2 (Web UI)',
      'เขียนคำบรรยายลักษณะงาน (AI JD) ให้ชัดเจนเสมือนกำลังจ้างพนักงานเข้ามาช่วยงาน 1 ตำแหน่ง',
      'ประเมินเวลาที่ใช้ปัจจุบัน (ชม./สัปดาห์) และคาดการณ์เวลาที่จะประหยัดได้จริง',
      'กดยืนยันการประเมินความปลอดภัยข้อมูล (ไม่นำ PII / Customer Secrets ป้อนเข้าโมเดล)'
    ],
    pillar3T: {
      name: 'Trust',
      desc: 'คัดกรองข้อมูลปลอดภัยตามระเบียบ WI-PI-AI-001 ไม่ใช้ข้อมูลลับลูกค้าและปฏิบัติตาม PDPA 100%',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
    },
    sampleMetric: {
      label: 'สัดส่วนคำขอใช้งานจำแนกตาม Tier',
      value: '72% Tier 1',
      delta: 'Virtual AI + JD',
      subtext: 'ความต้องการระบบวิเคราะห์เอกสารและเขียนโค้ดสูงสุด'
    }
  },
  {
    id: 'evaluation',
    stepNumber: 2,
    title: 'CoE ประเมินความคุ้มค่า',
    subtitle: 'Rubric 100 คะแนน (เกณฑ์ผ่าน ≥ 70)',
    role: 'คณะกรรมการ (AI CoE & IT)',
    timeline: 'ตัดรอบพิจารณาทุกวันที่ 15',
    tabTarget: 'evaluations',
    actionLabel: 'ดูเกณฑ์และบันทึกคะแนน CoE',
    what: 'คณะกรรมการพิจารณาความคุ้มค่าตาม 4 มิติเชิงลึก เพื่อจัดสรรสิทธิ์ที่มีจำกัดให้เกิดผลลัพธ์สูงสุดต่อองค์กร',
    who: 'คณะกรรมการ AI Center of Excellence (CoE), ทีม Process Improvement และตัวแทน IT',
    when: 'ประชุมพิจารณาทุกวันที่ 15 ของเดือน เพื่อส่งมอบสิทธิ์เริ่มสัญญาในรอบเดือนถัดไป',
    how: [
      'มิติที่ 1: ความชัดเจนของปัญหาและ As-Is Process (เต็ม 25 คะแนน)',
      'มิติที่ 2: ความคุ้มค่าทางธุรกิจและเป้าหมายชั่วโมงที่ประหยัดได้ (เต็ม 35 คะแนน)',
      'มิติที่ 3: ความพร้อมของข้อมูลและ Process Readiness (เต็ม 20 คะแนน)',
      'มิติที่ 4: ความปลอดภัยข้อมูลและความตระหนักด้าน PDPA (เต็ม 20 คะแนน)',
      'เกณฑ์การตัดสิน: ≥ 70 คะแนน อนุมัติสิทธิ์ Sandbox 1-3 เดือน / < 70 ส่งกลับปรับแก้โจทย์'
    ],
    pillar3T: {
      name: 'Transparency',
      desc: 'เกณฑ์การให้คะแนนแบบเปิดเผย ตรวจสอบได้ ทุกแผนกใช้มาตรฐาน 100 คะแนนเดียวกัน',
      badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25'
    },
    sampleMetric: {
      label: 'เกณฑ์มาตรฐานการอนุมัติ (Pass Benchmark)',
      value: '70 / 100',
      delta: 'Min Pass Score',
      subtext: 'พิจารณา 4 มิติ ครอบคลุมทั้ง ROI และ Data Safety'
    }
  },
  {
    id: 'execution',
    stepNumber: 3,
    title: 'จัดสรรสิทธิ์ & ลุยงานจริง',
    subtitle: 'สร้าง Project & คีย์ Daily Worklog',
    role: 'ผู้ใช้งานจริง (Active Licensee)',
    timeline: 'สัญญาทดลอง 1-3 เดือน (Sandbox Period)',
    tabTarget: 'reports',
    actionLabel: 'ดูรายการโครงการและผลงาน',
    what: 'รับ Account เข้าใช้งาน ร่วมกับคีย์ข้อมูลการประหยัดเวลาและ Prompt ใน Daily Worklog ทุกวัน',
    who: 'พนักงานที่ได้รับสิทธิ์ License (Tier 1 Claude Team หรือ Tier 2 Web Portal)',
    when: 'ปฏิบัติงานต่อเนื่องทุกวันทำการ ตลอดระยะเวลาสัญญาที่ได้รับการจัดสรร',
    how: [
      'IT มอบหมาย License และคู่มือการตั้งค่าความปลอดภัย',
      'ระบบอัตโนมัติสร้าง Project "[AI] ..." ในระบบ Worklog ให้ทันที',
      'พนักงานบันทึกชั่วโมงที่ประหยัดได้จริงและภารกิจที่ทำร่วมกับ AI ใน Daily Worklog',
      'รักษาหลักการ Human-in-the-loop: ตรวจสอบความถูกต้องของผลลัพธ์จาก AI ทุกครั้งก่อนส่งมอบงานจริง'
    ],
    pillar3T: {
      name: 'Transformation',
      desc: 'Transform Me: พนักงานยกระดับตนเอง เรียนรู้ Prompt Engineering และเพิ่ม Productivity จริง',
      badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25'
    },
    sampleMetric: {
      label: 'เวลาที่ประหยัดได้จริงเฉลี่ยต่อคน',
      value: '8.4 ชม./สัปดาห์',
      delta: '+35% vs Target',
      subtext: 'วัดผลจริงจากการบันทึก Daily Worklog'
    }
  },
  {
    id: 'review',
    stepNumber: 4,
    title: 'ส่งผลงานรายเดือน & หมุนเวียนสิทธิ์',
    subtitle: 'Smart Sync Worklog & Seat Roaming',
    role: 'ผู้ใช้ & คณะกรรมการ CoE',
    timeline: 'ส่งผลงานภายในวันที่ 25 ของทุกเดือน',
    tabTarget: 'reports',
    actionLabel: 'ส่งผลงาน & ซิงค์ Worklog',
    what: 'ส่งรายงานสรุปผลงานประจำเดือนผ่าน Smart Sync Worklog หากเดือนที่ผ่านมาไม่ได้ใช้งานเลย สิทธิ์จะถูกระงับและหมุนเวียนให้ทีมอื่นใน Waiting List',
    who: 'ผู้ถือครองสิทธิ์ทุกคน และ คณะกรรมการ CoE ผู้ตรวจสอบ',
    when: 'ระบบเปิดให้ส่งรายงานผลงานวันที่ 20-25 ของทุกเดือน เพื่อพิจารณาต่ออายุสิทธิ์ในรอบเดือนถัดไป',
    how: [
      'กดปุ่ม "Smart Sync Daily Worklog" เพื่อดึงชั่วโมงที่บันทึกจริงมาสรุปอัตโนมัติ',
      'แนบผลงานที่เป็นรูปธรรม เช่น เอกสารที่วิเคราะห์ได้, โค้ดที่สร้างสำเร็จ, หรือกระบวนการที่ลดเวลาลง',
      'CoE ทบทวนผลงาน: อัตราการใช้งานสม่ำเสมอ -> คงสิทธิ์ / สร้างผลงานโดดเด่น -> ขยายผล Scale',
      'พิจารณาเป็นรายเดือน: หากเดือนที่ผ่านมาไม่ได้ใช้งานเลย สิทธิ์จะถูกระงับและโอนให้ทีมใน Waiting List'
    ],
    pillar3T: {
      name: 'Transformation',
      desc: 'Transform Us: แบ่งปัน Use Case ที่สำเร็จให้เพื่อนร่วมงาน และหมุนเวียนทรัพยากรให้เกิดประโยชน์สูงสุด',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
    },
    sampleMetric: {
      label: 'อัตราการหมุนเวียนสิทธิ์คุ้มค่า (Seat Health)',
      value: '91.8%',
      delta: 'Active Utilization',
      subtext: 'หมุนเวียนสิทธิ์ว่างให้ผู้รอใน Waiting List ทันที'
    }
  }
];
