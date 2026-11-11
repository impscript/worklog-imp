/**
 * Enterprise AI Governance & Department Preset Hub
 * ข้อมูลโครงสร้างและพรีเซ็ตการจัดสรร AI ประจำฝ่ายงานองค์กร
 * อ้างอิงตามโครงสร้าง Manpower องค์กร (Summary Manpower Corp.xlsx / RE & LO / Holding / 304IP)
 *
 * สอดคล้องกับระเบียบปฏิบัติการใช้งานปัญญาประดิษฐ์ WI-PI-AI-001
 * และมาตรฐานความปลอดภัยข้อมูล Zero Data Retention (ZDR)
 */

export type AiLicensingRouteId = 'subscription_team' | 'subscription_premium' | 'api_payg' | 'enterprise_zdr';

export type DepartmentColorTheme =
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'rose'
  | 'cyan'
  | 'purple'
  | 'blue'
  | 'orange';

export interface AiLicensingRoute {
  id: AiLicensingRouteId;
  name: string;
  badge: string;
  priceRange: string;
  billingType: string;
  bestFor: string;
  pros: string[];
  cons: string[];
  securityLevel: string;
  colorScheme: 'indigo' | 'purple' | 'emerald' | 'amber';
}

export interface AiModelComparison {
  id: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google' | 'DeepSeek';
  modelName: string;
  flagshipBadge: string;
  strengths: string[];
  idealTasks: string;
  contextWindow: string;
  recommendedRoute: string;
  speedRating: number; // 1-5
  reasoningRating: number; // 1-5
  costEfficiency: number; // 1-5
  businessHighlight: string;
}

export interface DepartmentAiPreset {
  id: string;
  deptCode: string;
  deptName: string;
  deptNameEn: string;
  colorTheme: DepartmentColorTheme;
  iconName: 'Calculator' | 'Scale' | 'Users' | 'FileSignature' | 'Code2' | 'Settings' | 'Briefcase' | 'ShieldCheck';
  headcountActual: number;
  headcountOc: number;
  workCharacteristics: string[];
  recommendedProvider: string;
  primaryModel: string;
  secondaryModel: string;
  licensingType:
    | 'Subscription (Claude Team Standard)'
    | 'Subscription (Claude Team Premium / Code)'
    | 'Pay-Per-Token API / Internal Portal'
    | 'Hybrid (Team Seat + Internal Portal)';
  estimatedCostPerSeat: string;
  recommendedSeats: number;
  whyThisFits: string;
  deviceAndSharingRule: string;
  zdrAndPrivacyNote: string;
  proTricks: string[];
  prefillForm: {
    tier: 'virtual_employee' | 'general_web';
    title: string;
    aiJd: string;
    asIsProcess: string;
    workFrequency: 'daily' | 'weekly' | 'monthly';
    asIsHours: number;
    targetHoursSaved: number;
    aiFunctions: string[];
    expectedBenefits: string;
    recommendedSeats: number;
  };
}

/**
 * ช่องทางการจัดสรรสิทธิ์และสถาปัตยกรรมต้นทุนใบอนุญาต (AI Licensing Routes)
 */
export const LICENSING_ROUTES: AiLicensingRoute[] = [
  {
    id: 'subscription_team',
    name: 'Claude Team Standard',
    badge: 'ยอดนิยม • สายเอกสาร',
    priceRange: '฿700 - ฿875',
    billingType: 'รายเดือน ($20 - $25 / คน)',
    bestFor: 'บัญชี, จัดซื้อ, กฎหมาย, ทรัพยากรบุคคล (HR) และผู้ใช้งานวิเคราะห์เอกสารทุกวัน',
    pros: [
      'แชร์ฐานข้อมูลและผังบัญชีในทีมได้ผ่าน Shared Projects โดยไม่ต้องส่งไฟล์ซ้ำ',
      'ปลอดภัยตามระเบียบองค์กร ไม่นำข้อมูลบริษัทไปเทรน AI (Zero Data Training)',
      '1 บัญชีสามารถสลับใช้งานระหว่างโน้ตบุ๊กทำงานกับมือถือได้สะดวก'
    ],
    cons: [
      'มีเงื่อนไขการเปิดใช้งานขั้นต่ำ 2 ที่นั่ง (Seats)',
      'ห้ามใช้รหัสผ่านร่วมกันในเวลาเดียวกัน (เพื่อป้องกันบัญชีถูกระงับตามเงื่อนไข)'
    ],
    securityLevel: 'มาตรฐานความปลอดภัยองค์กร SOC 2 Type II, Zero Data Retention for Training',
    colorScheme: 'indigo'
  },
  {
    id: 'subscription_premium',
    name: 'Claude Team Premium / Copilot',
    badge: 'งานหนัก • โปรแกรมเมอร์',
    priceRange: '฿3,500 - ฿4,375',
    billingType: 'รายเดือน ($100 - $125 / คน)',
    bestFor: 'ทีมพัฒนาซอฟต์แวร์, Data Science, AI Engineer ที่ต้องประมวลผลงานหนักตลอดวัน',
    pros: [
      'โควตาประมวลผลสูงกว่าปกติ 5 เท่า รองรับการเขียนโค้ดและวิเคราะห์ข้อมูลต่อเนื่อง',
      'รองรับเครื่องมือเขียนโปรแกรมอัตโนมัติ (Claude Code CLI / GitHub Copilot)',
      'ประมวลผลคำตอบรวดเร็ว สม่ำเสมอแม้ในช่วงชั่วโมงที่มีผู้ใช้งานหนาแน่น'
    ],
    cons: [
      'ค่าบริการสูงกว่าแพ็กเกจปกติ 4-5 เท่า เหมาะกับผู้เชี่ยวชาญเฉพาะทาง',
      'ต้องมีทักษะด้านโปรแกรมมิ่งเพื่อดึงประสิทธิภาพได้คุ้มค่าที่สุด'
    ],
    securityLevel: 'SOC 2 Type II, GitHub Enterprise Security, Zero Training Protection',
    colorScheme: 'purple'
  },
  {
    id: 'api_payg',
    name: 'พอร์ทัลกลางองค์กร (AI Chat Sandbox)',
    badge: 'จ่ายตามจริง • ใช้ไม่ประจำ',
    priceRange: '฿70 - ฿280',
    billingType: 'ตามปริมาณใช้งาน ($2 - $8 / คน)',
    bestFor: 'พนักงานที่ใช้งานเป็นครั้งคราว ค้นคว้า ร่างอีเมล แปลภาษา หรือทดลองประลองโมเดล',
    pros: [
      'ไม่มีค่าธรรมเนียมรายเดือนคงที่ จ่ายตามที่เรียกใช้งานจริง ประหยัดงบสูงสุด',
      'ล็อกอินด้วยอีเมลองค์กร ใช้งานได้ทั้ง Claude, GPT, Gemini, DeepSeek ในที่เดียว',
      'มีเกราะตรวจจับและ Mask ข้อมูลส่วนบุคคล (PII) อัตโนมัติตามระเบียบ WI-PI-AI-001'
    ],
    cons: [
      'ไม่มีระบบแชร์โฟลเดอร์เอกสารกลางแบบเว็บหลักของต่างประเทศ',
      'ความเร็วขึ้นอยู่กับปริมาณทราฟฟิกของเครือข่ายภายในบริษัท'
    ],
    securityLevel: 'ข้อมูลอยู่ภายใต้เครือข่ายองค์กร (Internal Gateway) พร้อม Audit Trail ทุก Transaction',
    colorScheme: 'emerald'
  },
  {
    id: 'enterprise_zdr',
    name: 'Claude Enterprise (Dedicated)',
    badge: 'ความลับสูงสุด • แผนกใหญ่',
    priceRange: '~฿2,100',
    billingType: 'สัญญาองค์กรรายปี (~$60 / คน)',
    bestFor: 'ผู้บริหารระดับสูง, ศูนย์กลาง AI CoE, หน่วยงานที่มีข้อมูลความลับสูงสุด (Confidential)',
    pros: [
      'สัญญาคุ้มครองความปลอดภัยระดับสูงสุด (Enterprise ZDR พร้อม Corporate SSO Login)',
      'ขยายขีดความสามารถการอ่านเอกสารยาวระดับ 500,000 คำ สำหรับรายงานขนาดใหญ่',
      'มีระบบจัดการสิทธิ์ผู้ใช้งานจากส่วนกลางและรายงานตรวจสอบการใช้งานอย่างละเอียด'
    ],
    cons: [
      'ต้องมีจำนวนผู้ใช้งานขั้นต่ำ 20 ที่นั่งขึ้นไป และมีรอบสัญญาผูกพันรายปี',
      'ขั้นตอนการจัดซื้อและอนุมัติสัญญาต้องผ่านกระบวนการจัดซื้อระดับองค์กร'
    ],
    securityLevel: 'Enterprise-Grade Governance, SSO/SCIM, Role-Based Access Control, Full Audit Logs',
    colorScheme: 'amber'
  }
];

/**
 * ตารางเปรียบเทียบขีดความสามารถโมเดลปัญญาประดิษฐ์ระดับองค์กร (AI Model Matrix)
 */
export const AI_MODEL_MATRIX: AiModelComparison[] = [
  {
    id: 'claude-sonnet',
    provider: 'Anthropic',
    modelName: 'Claude Sonnet',
    flagshipBadge: 'ที่ 1 สำหรับงานเอกสารองค์กร',
    strengths: [
      'วิเคราะห์งบการเงิน ตัวเลขบัญชี และข้อสัญญากฎหมายได้แม่นยำสูงสุด',
      'ภาษาไทยสละสลวย ถูกต้องตามแบบแผนราชการและหนังสือธุรกิจ',
      'ไม่มโนตัวเลขผิดพลาด (Low Hallucination ในตาราง Excel)',
      'มีโหมดคิดลึก (Extended Thinking) สำหรับโจทย์ซับซ้อน'
    ],
    idealTasks: 'วิเคราะห์งบการเงิน, ตรวจสอบสัญญา, กระทบยอดบัญชี, ร่างหนังสือทางการ และรายงานผู้บริหาร',
    contextWindow: '200,000 คำ (~500 หน้ากระดาษ)',
    recommendedRoute: 'Claude Team (Standard / Premium)',
    speedRating: 4,
    reasoningRating: 5,
    costEfficiency: 4,
    businessHighlight: 'แม่นยำด้านตัวเลขและภาษาสูงสุด เหมาะกับฝ่ายบัญชี จัดซื้อ กฎหมาย และ HR'
  },
  {
    id: 'gemini-flash',
    provider: 'Google',
    modelName: 'Gemini Flash & Pro',
    flagshipBadge: 'อ่านเอกสารกองโต & คลิปเสียง',
    strengths: [
      'อ่านเอกสารได้ยาวที่สุดในโลก (คลังเอกสาร 1,000 - 3,000 หน้าในครั้งเดียว)',
      'รับไฟล์เสียงบันทึกการประชุม 2-3 ชั่วโมงมาสรุปประเด็นได้ทันที',
      'ตอบสนองรวดเร็วมาก เหมาะกับงานค้นหาข้อมูลในคลังระเบียบ',
      'ผสานการทำงานร่วมกับ Google Workspace ได้อย่างคล่องตัว'
    ],
    idealTasks: 'ค้นคลังคู่มือโรงงาน (SOP), สรุปไฟล์เสียงประชุม, อ่านเอกสารประมูล TOR หนาๆ',
    contextWindow: '1,000,000 - 2,000,000 คำ',
    recommendedRoute: 'พอร์ทัลกลางองค์กร (AI Chat Sandbox)',
    speedRating: 5,
    reasoningRating: 4,
    costEfficiency: 5,
    businessHighlight: 'เก่งการอ่านเอกสารยาวและถอดเทปเสียงประชุม รวดเร็วและประหยัดต้นทุน'
  },
  {
    id: 'gpt-4o',
    provider: 'OpenAI',
    modelName: 'GPT & o-series',
    flagshipBadge: 'คล่องตัวรอบด้าน & งานภาพ',
    strengths: [
      'เข้าใจรูปภาพ แผนผัง ไดอะแกรม และตารางลายมือได้ดีเยี่ยม',
      'มีความคิดสร้างสรรค์สูง ช่วยคิดไอเดียและร่างข้อความสื่อสาร',
      'มีโมเดลตระกูล o-series สำหรับคิดแก้สมการโจทย์ตรรกะเชิงลึก',
      'ค้นหาข้อมูลสดบนอินเทอร์เน็ตได้อย่างรวดเร็ว'
    ],
    idealTasks: 'ระดมสมองแคมเปญการตลาด, อ่านผังรูปภาพหน้างาน, สรุปข่าวสาร และคิดเลขเชิงลึก',
    contextWindow: '128,000 - 200,000 คำ',
    recommendedRoute: 'พอร์ทัลกลางองค์กร (AI Chat Sandbox)',
    speedRating: 5,
    reasoningRating: 4,
    costEfficiency: 4,
    businessHighlight: 'คล่องตัวทุกมิติ (ภาพ เสียง ข้อความ) เหมาะกับงานการตลาดและสื่อสาร'
  },
  {
    id: 'deepseek-chat',
    provider: 'DeepSeek',
    modelName: 'DeepSeek Reasoner & Chat',
    flagshipBadge: 'ตรรกะลึกซึ้ง ราคาประหยัดสุด',
    strengths: [
      'ระบบคิดแบบเหตุผลเป็นขั้นเป็นตอน (Reasoner) ในการแก้โจทย์ซับซ้อน',
      'ราคาประหยัดที่สุด ถูกกว่าโมเดลอื่นถึง 80-90% จ่ายตามจริงไม่กี่สตางค์',
      'เข้าใจภาษาไทยและบริบทงานธุรกิจเอเชียได้อย่างเป็นธรรมชาติ',
      'เหมาะสำหรับการต่อเป็นระบบอัตโนมัติภายในบริษัท'
    ],
    idealTasks: 'คำนวณสูตรสถิติ, ประมวลผลข้อมูลปริมาณมาก, บอตตอบคำถามพนักงาน',
    contextWindow: '64,000 - 128,000 คำ',
    recommendedRoute: 'พอร์ทัลกลางองค์กร (AI Chat Sandbox)',
    speedRating: 4,
    reasoningRating: 5,
    costEfficiency: 5,
    businessHighlight: 'คิดเลขและตรรกะได้ดีเยี่ยมในราคาถูกที่สุด ประหยัดงบองค์กรสูงสุด'
  }
];

/**
 * พรีเซ็ตการจัดสรร AI ประจำ 8 ฝ่ายงานองค์กร (Department AI Presets)
 * สอดคล้องกับโครงสร้าง Manpower: RE, LO, Holding, และนิคมอุตสาหกรรม 304IP
 */
export const DEPARTMENT_AI_PRESETS: DepartmentAiPreset[] = [
  {
    id: 'accounting_finance',
    deptCode: 'ACC-FIN',
    deptName: 'ฝ่ายบัญชีและการเงิน',
    deptNameEn: 'Accounting & Finance (RE / LO / Holding / 304IP)',
    colorTheme: 'emerald',
    iconName: 'Calculator',
    headcountActual: 104, // 56 RE + 19 LO + 29 Finance & Insurance
    headcountOc: 114, // 62 RE + 20 LO + 32 Finance & Insurance
    workCharacteristics: [
      'วิเคราะห์งบการเงิน, ปิดบัญชีประจำเดือน (Month-end Closing), ตรวจสอบ ภ.ง.ด. 50, 51, 53, 54',
      'กระทบยอดรายการบัญชีแยกประเภท (GL Reconciliation) และกระทบยอด Bank Statement',
      'ตรวจสอบสัญญาเงินกู้, ดอกเบี้ย และข้อกำหนด DTA (Double Tax Agreement)',
      'จัดทำแบบจำลองกระแสเงินสด (Cash Flow Forecasting) และวิเคราะห์สัดส่วนทางการเงิน (Financial Ratios)'
    ],
    recommendedProvider: 'Anthropic',
    primaryModel: 'Claude Sonnet (งานวิเคราะห์งบ/ภ.ง.ด./กระทบยอด)',
    secondaryModel: 'Claude Haiku (งานร่างเมล/สรุปย่อทั่วไป เพื่อเซฟโควตา)',
    licensingType: 'Subscription (Claude Team Standard)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน (เริ่มต้นขั้นต่ำเพียง 2 Seats)',
    recommendedSeats: 3,
    whyThisFits:
      'Claude Sonnet มีความแม่นยำทางตัวเลขและตรรกะสูงสุดในการอ่านตาราง Excel งบการเงิน และวิเคราะห์ข้อกฎหมายภาษี โดยไม่หลอน (Hallucinate) ข้อมูลตัวเลขผิดพลาดเหมือนโมเดลทั่วไป',
    deviceAndSharingRule:
      '1 Account ล็อกอินข้ามอุปกรณ์ส่วนตัวได้ (โน้ตบุ๊ก+มือถือ) แต่ห้ามแชร์รหัสเดียวกันใช้งานพร้อมกันหลายคน (ผิด ToS และระบบเตะออก) แนะนำสร้าง Shared Project เช่น "Holding & IP Accounting Hub" อัปโหลดผังบัญชี (COA) เป็นกองกลางให้ดึงใช้ข้ามเครื่องได้ทันที',
    zdrAndPrivacyNote:
      'Team Plan ไม่นำข้อมูลไปเทรน AI โดยอัตโนมัติ (Zero Data Training) และใช้เทคนิค Data Masking ปิดเลขบัญชี/ชื่อบริษัทก่อนอัปโหลด',
    proTricks: [
      'สลับใช้ Sonnet เฉพาะตอนตรวจงบ/กระทบยอดซับซ้อน และใช้ Haiku สำหรับงานร่างหนังสือทั่วไป',
      'เปิดฟีเจอร์ Extended Thinking / Plan Mode เมื่อต้องตรวจสอบเงื่อนไขภาษี ภ.ง.ด. 54 หรือ DTA ที่ซับซ้อน',
      'สร้าง Shared Project เก็บผังบัญชี (Chart of Accounts) และระเบียบการเงินไว้เป็นฐานความรู้กลาง ไม่ต้องแนบไฟล์ซ้ำทุกครั้ง'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยอัจฉริยะฝ่ายบัญชีและการเงิน (Virtual Accounting & Finance Specialist)',
      aiJd: 'ปฏิบัติการวิเคราะห์กระทบยอดบัญชี GL, ตรวจสอบความถูกต้องของแบบภาษี ภ.ง.ด. และร่างรายงานวิเคราะห์ผลการดำเนินงานทางการเงินประจำไตรมาส',
      asIsProcess:
        'นักบัญชีและนักวิเคราะห์การเงินต้องดาวน์โหลดงบจาก SAP/ERP มารวมใน Excel กระทบยอดมือทีละบรรทัด และเขียนสรุปรายงานใช้เวลารวมกว่า 28 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 28,
      targetHoursSaved: 12,
      aiFunctions: [
        'ตรวจสอบและกระทบยอดรายการบัญชีและ Bank Statement อัตโนมัติ',
        'วิเคราะห์เงื่อนไขภาษีหัก ณ ที่จ่าย ภ.ง.ด. 53/54 และอนุสัญญาภาษีซ้อน (DTA)',
        'สร้างตารางสรุปผลการดำเนินงานและไฮไลต์รายการผลต่าง (Variance Analysis)'
      ],
      expectedBenefits: 'ลดเวลาปิดบัญชีประจำงวดลง 40% และป้องกันข้อผิดพลาดในการยื่นแบบภาษีที่อาจมีเบี้ยปรับเงินเพิ่ม',
      recommendedSeats: 3
    }
  },
  {
    id: 'procurement_vendor',
    deptCode: 'PROC',
    deptName: 'ฝ่ายจัดซื้อและบริหารสัญญา',
    deptNameEn: 'Procurement & Vendor Management',
    colorTheme: 'amber',
    iconName: 'FileSignature',
    headcountActual: 18,
    headcountOc: 22,
    workCharacteristics: [
      'เปรียบเทียบใบเสนอราคา (Quotation Comparison Sheet) หลายคู่เทียบพร้อมกัน',
      'ตรวจสอบเงื่อนไขและร่างสัญญาจัดซื้อจัดจ้าง (TOR, SLAs, Incoterms, Warranty)',
      'คัดกรองคุณสมบัติผู้ขายและประเมินความเสี่ยงคู่ค้า (Vendor Risk Assessment)',
      'เจรจาต่อรองราคาและวิเคราะห์แนวโน้มราคาตลาดของวัตถุดิบและอุปกรณ์อุตสาหกรรม'
    ],
    recommendedProvider: 'Anthropic & Internal Portal',
    primaryModel: 'Claude Sonnet (เทียบตารางใบเสนอราคา & ตรวจสัญญา)',
    secondaryModel: 'DeepSeek Chat (คัดกรองสเปกและแปลงภาษาคู่ค้า)',
    licensingType: 'Subscription (Claude Team Standard)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน',
    recommendedSeats: 2,
    whyThisFits:
      'Claude Sonnet มีความโดดเด่นสูงสุดในการแปลงตาราง PDF ใบเสนอราคาที่หน้าตาไม่เหมือนกัน ให้กลายเป็นตารางเปรียบเทียบสเปกและราคาเดียวกัน พร้อมจับจุดต่างของเงื่อนไขการรับประกันและค่าขนส่ง',
    deviceAndSharingRule:
      '1 Account ใช้งานส่วนบุคคลบนเครื่อง PC สำนักงานและแท็บเล็ตตรวจรับงาน สามารถสร้าง Shared Project "Vendor Evaluation & Pricing Hub" เพื่อแชร์ประวัติราคากลางและเงื่อนไขสัญญามาตรฐาน',
    zdrAndPrivacyNote:
      'Zero Data Training รับประกันว่าสเปกเครื่องจักร ราคากลางการประมูล และข้อมูลคู่ค้าจะไม่รั่วไหลออกสู่วงจรเทรนโมเดลภายนอก',
    proTricks: [
      'อัปโหลดไฟล์ PDF ใบเสนอราคา 3-5 เจ้าพร้อมกัน สั่งให้เทียบราคาเป็นตารางพร้อมคำนวณราคารวมภาษี/เงื่อนไข Incoterms',
      'ใช้ Prompt มาตรฐานในการสแกนจุดเสี่ยงในร่างสัญญาจัดซื้อ เช่น ค่าปรับล่าช้า การรับประกัน และเกณฑ์การตรวจรับ',
      'เก็บแค็ตตาล็อกและราคากลางปีล่าสุดไว้ใน Claude Project เพื่อให้ตรวจสอบราคาส่วนลดได้อย่างรวดเร็ว'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยวิเคราะห์การจัดซื้อและสัญญา (Virtual Procurement Analyst)',
      aiJd: 'ทำหน้าที่วิเคราะห์เปรียบเทียบใบเสนอราคาคู่เทียบ สรุปตารางเปรียบเทียบสเปกและราคา และตรวจร่างสัญญาจัดซื้อให้ตรงตามมาตรฐานองค์กร',
      asIsProcess:
        'เจ้าหน้าที่จัดซื้อต้องพิมพ์ข้อมูลจากใบเสนอราคาหลายสิบฉบับลงตาราง Excel ด้วยมือ และอ่านเงื่อนไขการส่งมอบทีละหน้า ใช้เวลาประมาณ 20 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 20,
      targetHoursSaved: 9,
      aiFunctions: [
        'เปรียบเทียบและสรุปตารางใบเสนอราคาคู่เทียบอัตโนมัติ',
        'สแกนตรวจเงื่อนไขความเสี่ยงในสัญญาจัดซื้อและบันทึกข้อตกลง',
        'ร่างหนังสือชี้แจงการขออนุมัติจัดซื้อและเจรจาต่อรองราคา'
      ],
      expectedBenefits: 'ร่นระยะเวลาออกใบเปรียบเทียบราคาจาก 2 วันเหลือ 2 ชั่วโมง และเพิ่มอำนาจการต่อรองราคาด้วยการวิเคราะห์เชิงลึก',
      recommendedSeats: 2
    }
  },
  {
    id: 'legal_compliance',
    deptCode: 'LEGAL',
    deptName: 'ฝ่ายกฎหมายและกำกับดูแล',
    deptNameEn: 'Legal & Compliance',
    colorTheme: 'indigo',
    iconName: 'Scale',
    headcountActual: 14,
    headcountOc: 19,
    workCharacteristics: [
      'ร่างและตรวจสอบสัญญาทางธุรกิจ (NDA, Commercial Agreements, Lease Agreements)',
      'ทบทวนข้อกำหนดทางกฎหมาย กฎกระทรวง และข้อบังคับการนิคมอุตสาหกรรม/BOI/ก.ล.ต.',
      'ตรวจสอบการปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance Audit)',
      'วิเคราะห์ความเสี่ยงทางคดีความและร่างหนังสือบอกกล่าวทวงถาม (Legal Notice)'
    ],
    recommendedProvider: 'Anthropic',
    primaryModel: 'Claude Sonnet (อ่านสัญญาภาษาไทย/อังกฤษ คมชัดสูงสุด)',
    secondaryModel: 'Claude Haiku (สกัดสาระสำคัญและคัดแยกหมวดหมู่เอกสาร)',
    licensingType: 'Subscription (Claude Team Standard)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน',
    recommendedSeats: 2,
    whyThisFits:
      'Claude Sonnet ให้การวิเคราะห์สัญญากฎหมายสองภาษา (ไทย-อังกฤษ) ที่แม่นยำสูง รักษานัยสำคัญของข้อความ ไม่ตัดทอนสาระสำคัญ และจับข้อความที่คลุมเครือหรือสุ่มเสี่ยงได้อย่างละเอียดถี่ถ้วน',
    deviceAndSharingRule:
      'ใช้งานผ่านบัญชีเฉพาะบุคคลของนักกฎหมายประจำทีม ห้ามแชร์การเข้าถึงบุคคลภายนอก และสร้าง Shared Project "Corporate Legal Templates" เพื่อเก็บมาตรฐานสัญญาของกลุ่มบริษัท',
    zdrAndPrivacyNote:
      'Zero Data Training มีผลบังคับใช้ 100% สำหรับ Team Plan สัญญาและข้อมูลคดีความจะไม่ถูกนำไปใช้เทรนโมเดล พร้อมแนะนำให้ตัดชื่อบุคคลก่อนการวิเคราะห์สัญญาคดีพิเศษ',
    proTricks: [
      'ตั้ง System Instruction ใน Claude Project ให้สวมบทบาท Senior Corporate Counsel พร้อมระบุขอบเขตความเสี่ยงที่องค์กรยอมรับได้',
      'ให้ตรวจสอบสัญญาเทียบกับ Red Flags Checklist มาตรฐานของบริษัท (Indemnity, Limitation of Liability, Termination)',
      'ใช้โหมดวิเคราะห์แบบเปรียบเทียบสัญญาฉบับแก้ไขกับฉบับตั้งต้น เพื่อตรวจหาข้อความที่แอบสอดไส้'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยที่ปรึกษากฎหมายองค์กร (Virtual Legal Counsel)',
      aiJd: 'ช่วยทบทวนข้อสัญญาทางธุรกิจภาษาไทย-อังกฤษ สกัดข้อตกลงสำคัญ ตรวจสอบความสอดคล้องกับระเบียบ PDPA และจัดทำตารางสรุปภาระผูกพันตามสัญญา',
      asIsProcess:
        'นิติกรต้องอ่านตรวจทานสัญญาความยาว 30-100 หน้าทีละฉบับ ขีดเส้นใต้และทำตารางสรุปความเสี่ยง ใช้เวลาเฉลี่ย 25 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 25,
      targetHoursSaved: 11,
      aiFunctions: [
        'ตรวจทานร่างสัญญาทางธุรกิจและชี้จุดเสี่ยงทางกฎหมาย (Redlining & Risk Flagging)',
        'ร่างสัญญามาตรฐานและหนังสือบอกกล่าวทวงถามตามเทมเพลตองค์กร',
        'ตรวจสอบข้อกำหนดการปฏิบัติตามกฎหมาย PDPA และสัญญาประมวลผลข้อมูล (DPA)'
      ],
      expectedBenefits: 'ลดระยะเวลาการรีวิวสัญญาลง 50% พร้อมยกระดับการตรวจจับความเสี่ยงที่ไม่รัดกุมในสัญญาการค้า',
      recommendedSeats: 2
    }
  },
  {
    id: 'human_resources',
    deptCode: 'HR',
    deptName: 'ฝ่ายทรัพยากรบุคคลและพัฒนาองค์กร',
    deptNameEn: 'Human Resources & Organization Development',
    colorTheme: 'rose',
    iconName: 'Users',
    headcountActual: 23,
    headcountOc: 34,
    workCharacteristics: [
      'คัดกรองประวัติผู้สมัครงาน (Resume Screening) และจับคู่ทักษะกับ JD',
      'ร่างประกาศรับสมัครงาน, ข้อสอบคัดเลือก และคำถามสัมภาษณ์เชิงพฤติกรรม (STAR)',
      'ออกแบบหลักสูตรฝึกอบรมและสื่อการเรียนรู้พัฒนาพนักงาน (Training Roadmap)',
      'จัดทำและสื่อสารนโยบายองค์กร, ระเบียบข้อบังคับ และแบบสำรวจความผูกพัน (Employee Engagement)'
    ],
    recommendedProvider: 'Anthropic & Internal Portal',
    primaryModel: 'Claude Sonnet (งานร่างนโยบาย ออกแบบหลักสูตร และประเมินสมรรถนะ)',
    secondaryModel: 'Claude Haiku (งานคัดกรอง Resume เบื้องต้นและร่างหนังสือรับรอง)',
    licensingType: 'Hybrid (Team Seat + Internal Portal)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน (Team Seat) + พอร์ทัลภายในสำหรับงานทั่วไป',
    recommendedSeats: 2,
    whyThisFits:
      'Claude มีน้ำเสียงการสื่อสารภาษาไทยที่สุภาพ เป็นมืออาชีพ และเข้าใจบริบทการบริหารทรัพยากรบุคคล สามารถร่างทั้งนโยบายทางการและข้อความสื่อสารภายในที่สร้างความผูกพันได้อย่างยอดเยี่ยม',
    deviceAndSharingRule:
      '1 Account ใช้งานสำหรับ HR Specialist และ HR Director โดยสามารถเชื่อมโยง Shared Project "HR Policy & JD Framework" เพื่อรวบรวม Job Description มาตรฐานของทุกตำแหน่งงาน',
    zdrAndPrivacyNote:
      'ห้ามอัปโหลดข้อมูลส่วนบุคคลอ่อนไหว (Sensitive PII) เช่น บัตรประชาชน ข้อมูลสุขภาพ หรือประวัติอาชญากรรม ให้ทำการคัดกรองเฉพาะทักษะและประวัติการทำงานเท่านั้น',
    proTricks: [
      'สร้าง Claude Project สำหรับออกแบบเส้นทางสายอาชีพ (Career Path) และกรอบประเมินสมรรถนะ (Competency Matrix)',
      'ใช้ Claude ช่วยร่างคำถามสัมภาษณ์ตามเกณฑ์ Competency และโมเดล STAR เพื่อให้ผู้สัมภาษณ์ใช้งานได้ทันที',
      'แปลงเนื้อหานโยบายที่ซับซ้อนให้กลายเป็นข้อความสรุปสั้นๆ เข้าใจง่ายสำหรับแคมเปญสื่อสารภายใน'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยพัฒนาองค์กรและสรรหาบุคลากร (Virtual HR Specialist)',
      aiJd: 'ช่วยสกัดคุณสมบัติผู้สมัครงานจาก Resume, ร่างแผนการฝึกอบรมประจำปี, พัฒนาคู่มือและนโยบายทรัพยากรบุคคล และร่างแบบสำรวจความผูกพัน',
      asIsProcess:
        'ทีม HR ต้องอ่าน Resume ผู้สมัครกว่าร้อยคนต่อเดือนด้วยตนเอง และใช้เวลาเขียนร่างหลักสูตรอบรมและนโยบาย ใช้เวลาประมาณ 22 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 22,
      targetHoursSaved: 10,
      aiFunctions: [
        'คัดกรองและประเมินความสอดคล้องของ Resume เทียบกับข้อกำหนดของตำแหน่งงาน',
        'ออกแบบโครงสร้างหลักสูตรฝึกอบรม (Training Curriculum) และเกณฑ์การวัดผล',
        'ร่างและปรับปรุงระเบียบข้อบังคับการทำงานและคำประกาศนโยบายองค์กร'
      ],
      expectedBenefits: 'ลดเวลาการคัดกรองประวัติผู้สมัครลง 60% และยกระดับมาตรฐานการฝึกอบรมและสื่อสารองค์กร',
      recommendedSeats: 2
    }
  },
  {
    id: 'digital_innovation_it',
    deptCode: 'DIT',
    deptName: 'ฝ่ายเทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล',
    deptNameEn: 'Digital Innovation Technology & Software Engineering',
    colorTheme: 'cyan',
    iconName: 'Code2',
    headcountActual: 5,
    headcountOc: 5,
    workCharacteristics: [
      'พัฒนาแอปพลิเคชันและเว็บพอร์ทัลภายในองค์กร (Full-stack TypeScript, React, Go, Python)',
      'ดูแลโครงสร้างระบบคลาวด์ ฐานข้อมูล และระบบอัตโนมัติ (DevOps, Docker, CI/CD, n8n)',
      'วิเคราะห์และออกแบบสถาปัตยกรรมระบบ (Solution Architecture & API Integration)',
      'ตรวจสอบช่องโหว่ความปลอดภัยโค้ด (Code Review, Refactoring & Security Audit)'
    ],
    recommendedProvider: 'Anthropic & OpenAI',
    primaryModel: 'Claude Sonnet (เขียนโค้ด ดีบั๊ก และรีวิวสถาปัตยกรรมซอฟต์แวร์)',
    secondaryModel: 'GPT & o-series (ค้นคว้าแก้ปัญหาลอจิกและระดมไอเดียสถาปัตยกรรม)',
    licensingType: 'Subscription (Claude Team Premium / Code)',
    estimatedCostPerSeat: '$100 - $125 / คน / เดือน (สำหรับโปรแกรมเมอร์/สถาปนิก) หรือ Team Standard',
    recommendedSeats: 2,
    whyThisFits:
      'Claude Sonnet เป็นโมเดลเขียนโค้ดอันดับ 1 ของโลก สามารถอ่านโค้ดทั้งโมดูล เขียนฟังก์ชัน TypeScript ที่ปลอดภัยไร้บั๊ก และใช้งานร่วมกับ Claude Code CLI ใน Terminal ได้โดยตรง',
    deviceAndSharingRule:
      '1 Account ใช้งานบนเครื่อง Developer Workstation และรีโมตเซิร์ฟเวอร์ โดยทีม DIT ใช้ทำหน้าที่เป็น Core AI Enabler ในการสร้างเครื่องมือให้แผนกอื่นๆ ในองค์กร',
    zdrAndPrivacyNote:
      'Zero Data Training ห้ามหลุด Source Code บริษัทออกไปเทรนโมเดลภายนอกเด็ดขาด และห้ามใส่ API Keys/Secrets ใน Prompt (ใช้ .env เสมอ)',
    proTricks: [
      'ใช้งานร่วมกับ Claude Code CLI ใน Terminal เพื่อให้ AI ช่วยเขียน Unit Test และรีแฟกเตอร์โค้ดแบบอัตโนมัติ',
      'สร้าง Project Template พร้อม System Prompt ที่กำหนด Coding Standards, Linting Rules และ Design System ของบริษัท',
      'ให้ AI ตรวจสอบด้านความปลอดภัย OWASP Top 10 ก่อนส่งมอบโค้ดขึ้น Production ทุกครั้ง'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'วิศวกรซอฟต์แวร์เสมือน (Virtual Software & Systems Engineer)',
      aiJd: 'รับผิดชอบการเขียนโปรแกรมอัตโนมัติ, เขียน Unit/Integration Tests, ดีบั๊กโค้ดที่ซับซ้อน, และสร้างส่วนต่อประสาน API ระหว่างระบบ ERP กับเว็บภายใน',
      asIsProcess:
        'นักพัฒนาระบบต้องเขียน Boilerplate Code, ค้นหาวิธีแก้บั๊กจากอินเทอร์เน็ต และเขียนคู่มือระบบด้วยมือ ใช้เวลาประมาณ 35 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 35,
      targetHoursSaved: 16,
      aiFunctions: [
        'เขียนและรีแฟกเตอร์โค้ดระบบงาน Full-stack (React, TypeScript, Backend APIs)',
        'สร้าง Unit Test และ Integration Test ครอบคลุมฟังก์ชันสำคัญอย่างเป็นระบบ',
        'จัดทำเอกสารข้อกำหนดทางเทคนิค (Technical Specification) และแผนผังระบบ'
      ],
      expectedBenefits: 'เพิ่มความเร็วในการส่งมอบฟีเจอร์ใหม่ขึ้น 2-3 เท่า และลดข้อผิดพลาดของระบบลงมากกว่า 50%',
      recommendedSeats: 2
    }
  },
  {
    id: 'process_improvement_audit',
    deptCode: 'PI-IA',
    deptName: 'ฝ่ายปรับปรุงกระบวนการและตรวจสอบภายใน',
    deptNameEn: 'Process Improvement & Internal Audit',
    colorTheme: 'purple',
    iconName: 'ShieldCheck',
    headcountActual: 13, // 3 Process Improvement + 10 Internal Audit
    headcountOc: 26, // 3 Process Improvement + 23 Internal Audit
    workCharacteristics: [
      'ตรวจสอบความถูกต้องของการควบคุมภายใน (Internal Controls & Compliance Audit)',
      'วิเคราะห์ผังกระบวนการทำงาน (Process Mapping / As-Is vs To-Be Workflows)',
      'ตรวจจับรายการผิดปกติและแนวโน้มการทุจริตในข้อมูลบันทึกระบบ (Fraud & Anomaly Detection)',
      'จัดทำรายงานการตรวจสอบและข้อเสนอแนะเชิงปรับปรุง (Audit Observations & Corrective Actions)'
    ],
    recommendedProvider: 'Anthropic & Internal Portal',
    primaryModel: 'Claude Sonnet (วิเคราะห์ Gap Analysis, กฎบัตร และรายงานการตรวจสอบ)',
    secondaryModel: 'DeepSeek Reasoner (คำนวณสถิติและวิเคราะห์ตรรกะข้อผิดพลาดในข้อมูลขนาดใหญ่)',
    licensingType: 'Subscription (Claude Team Standard)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน',
    recommendedSeats: 2,
    whyThisFits:
      'งานตรวจสอบภายในและปรับปรุงกระบวนการต้องการการคิดเชิงวิพากษ์ (Critical Thinking) และการตรวจจับความไม่สอดคล้องของข้อกำหนด Claude Sonnet มีความละเอียดสูงในการทำ Gap Analysis เทียบระเบียบปฏิบัติ',
    deviceAndSharingRule:
      'ใช้งานโดยผู้ตรวจสอบภายในและทีมวิศวกรกระบวนการ สามารถสร้าง Shared Project "Audit Workpapers & COSO Framework" เพื่อเป็นฐานข้อมูลตรวจสอบมาตรฐาน',
    zdrAndPrivacyNote:
      'การตรวจสอบข้อมูลธุรกรรมต้องไม่นำข้อมูลลับของลูกค้าหรือข้อมูลบุคคลป้อนเข้าสู่ระบบโดยตรง ให้ใช้เทคนิค Data Masking และสุ่มตัวอย่าง (Sampling Data) ก่อน',
    proTricks: [
      'ให้ AI ตรวจสอบร่างคู่มือการปฏิบัติงาน (SOP) เทียบกับกรอบควบคุมภายใน COSO เพื่อชี้จุดอ่อนของการควบคุม',
      'แปลงรายงานปัญหาหน้างานที่กระจัดกระจายให้กลายเป็นแบบจำลอง Cause-and-Effect (Fishbone Diagram) พร้อมข้อเสนอแนะเชิงรูปธรรม',
      'ใช้ช่วยร่างข้อสังเกตการตรวจสอบ (Audit Findings) ให้มีสำนวนที่เป็นกลาง อ้างอิงหลักฐานเชิงประจักษ์ชัดเจน'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยตรวจสอบภายในและปรับปรุงกระบวนการ (Virtual Audit & Process Analyst)',
      aiJd: 'ช่วยวิเคราะห์กระบวนการทำงานแบบ As-Is, จัดทำตารางประเมินความเสี่ยงและจุดควบคุม (RACM), และร่างรายงานข้อสังเกตการตรวจสอบภายใน',
      asIsProcess:
        'ผู้ตรวจสอบต้องอ่านนโยบายและตรวจกระดาษทำการ (Workpapers) นับพันแผ่น สรุปผลความเบี่ยงเบนของกระบวนการ ใช้เวลาเฉลี่ย 26 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 26,
      targetHoursSaved: 11,
      aiFunctions: [
        'ตรวจจับความขัดแย้งของระเบียบปฏิบัติและข้อบกพร่องในการควบคุมภายใน (Gap Analysis)',
        'ร่างรายงานข้อสังเกตการตรวจสอบและแผนปฏิบัติการแก้ไข (CAPA)',
        'วิเคราะห์และสังเคราะห์แผนผังกระบวนการข้ามหน่วยงานเพื่อลดขั้นตอนสูญเปล่า'
      ],
      expectedBenefits: 'เพิ่มขอบเขตการตรวจสอบได้ครอบคลุมขึ้น 2 เท่า และลดเวลาการจัดทำรายงานการตรวจสอบลง 45%',
      recommendedSeats: 2
    }
  },
  {
    id: 'business_development_commercial',
    deptCode: 'BD-COMM',
    deptName: 'ฝ่ายพัฒนาธุรกิจและการตลาด',
    deptNameEn: 'Business Development & Commercial',
    colorTheme: 'blue',
    iconName: 'Briefcase',
    headcountActual: 22,
    headcountOc: 24,
    workCharacteristics: [
      'วิเคราะห์ความเป็นไปได้ของโครงการลงทุนใหม่ (Feasibility Studies & Market Research)',
      'จัดทำสไลด์และเอกสารนำเสนอโครงการต่อลูกค้าระดับองค์กร (Pitch Decks & Proposals)',
      'ติดตามแนวโน้มอุตสาหกรรมพลังงานสะอาด นิคมอุตสาหกรรม และคู่แข่งทางการตลาด',
      'คำนวณและประเมินผลตอบแทนทางการเงินของโครงการ (IRR, NPV, Payback Period)'
    ],
    recommendedProvider: 'Anthropic & OpenAI',
    primaryModel: 'Claude Sonnet (งานศึกษาความเป็นไปได้และร่างข้อเสนอโครงการ)',
    secondaryModel: 'GPT & o-series (ค้นคว้าข้อมูลการตลาด ระดมไอเดียเชิงกลยุทธ์ และภาพประกอบ)',
    licensingType: 'Subscription (Claude Team Standard)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน',
    recommendedSeats: 2,
    whyThisFits:
      'Claude Sonnet และ GPT ผสานจุดแข็งด้านการสังเคราะห์งานวิจัยตลาด การเขียนข้อเสนอทางธุรกิจที่โน้มน้าวใจ และการแปลงข้อมูลเชิงเทคนิคให้กลายเป็น Executive Summary ที่ผู้บริหารระดับสูงตัดสินใจได้ทันที',
    deviceAndSharingRule:
      '1 Account สำหรับเจ้าหน้าที่ BD ประจำสำนักงานและนำเสนอหน้างาน สามารถตั้ง Shared Project "Clean Energy & Industrial Land Market Intelligence" ร่วมกันในทีม',
    zdrAndPrivacyNote:
      'ข้อมูลแผนยุทธศาสตร์โครงการและตัวเลขผลตอบแทนที่ยังไม่เปิดเผยต่อสาธารณะจะได้รับการคุ้มครองภายใต้ Zero Data Training',
    proTricks: [
      'สร้าง Project รวบรวมข้อมูลสิทธิประโยชน์ BOI, ผังผืนที่ดิน และจุดขายของนิคมฯ 304IP ไว้ตอบคำถามลูกค้าได้อย่างทันท่วงที',
      'สั่งให้ AI ปรับสำนวนข้อเสนอโครงการตามบุคลิกของลูกค้า เช่น ลูกค้าสัญชาติญี่ปุ่น ยุโรป หรือจีน',
      'ให้จำลองเป็นผู้ร่วมทุนหรือลูกค้าเพื่อตั้งคำถามยากๆ (Devil\'s Advocate) ท้าทายโมเดลธุรกิจก่อนนำเสนอจริง'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยวิเคราะห์กลยุทธ์และพัฒนาธุรกิจ (Virtual Business Development Strategist)',
      aiJd: 'ช่วยค้นคว้าวิจัยตลาดอุตสาหกรรม ร่างเอกสารข้อเสนอโครงการเชิงพาณิชย์ วิเคราะห์โมเดลความเป็นไปได้ทางธุรกิจ และจัดทำบทสรุปผู้บริหาร',
      asIsProcess:
        'ทีม BD ต้องรวบรวมข้อมูลตลาดจากหลายแหล่ง นำมาพิมพ์รายงานความเป็นไปได้และเตรียมสไลด์นำเสนอ ใช้เวลาประมาณ 24 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 24,
      targetHoursSaved: 10,
      aiFunctions: [
        'ค้นคว้าและสังเคราะห์แนวโน้มตลาดอุตสาหกรรมและพฤติกรรมกลุ่มเป้าหมาย',
        'ร่างข้อเสนอโครงการทางธุรกิจ (Business Proposals) และเนื้อหานำเสนอผู้บริหาร',
        'วิเคราะห์ปัจจัยเสี่ยงและจุดคุ้มทุนเบื้องต้นของโครงการลงทุนใหม่'
      ],
      expectedBenefits: 'ร่นเวลาจัดทำข้อเสนอโครงการจาก 5 วันทำการเหลือ 1.5 วัน และเพิ่มโอกาสชนะการเจรจาการค้า',
      recommendedSeats: 2
    }
  },
  {
    id: 'plant_operations_safety',
    deptCode: 'PLANT-SHO',
    deptName: 'ฝ่ายวิศวกรรมและปฏิบัติการโรงงาน',
    deptNameEn: 'Plant Operations & Safety / SHO',
    colorTheme: 'orange',
    iconName: 'Settings',
    headcountActual: 15,
    headcountOc: 15,
    workCharacteristics: [
      'วิเคราะห์บันทึกการทำงานของเครื่องจักรและแผนบำรุงรักษาเชิงป้องกัน (Preventive Maintenance)',
      'ทบทวนและอัปเดตคู่มือขั้นตอนการปฏิบัติงานมาตรฐาน (SOPs & Safety Protocols)',
      'จัดทำรายงานการสอบสวนอุบัติการณ์และความปลอดภัยในการทำงาน (Safety Incident Reports & JSA)',
      'ติดตามการปฏิบัติตามมาตรฐานสิ่งแวดล้อม ความปลอดภัย อาชีวอนามัย (EHS / ISO 14001, 45001)'
    ],
    recommendedProvider: 'Google & Anthropic',
    primaryModel: 'Gemini Flash & Pro (อ่านคู่มือโรงงานและวิเคราะห์ภาพหน้างาน)',
    secondaryModel: 'Claude Sonnet (ร่างขั้นตอน SOP และรายงานความปลอดภัยอย่างเป็นระบบ)',
    licensingType: 'Hybrid (Team Seat + Internal Portal)',
    estimatedCostPerSeat: '$20 - $25 / คน / เดือน (สำหรับหัวหน้างาน SHO) + พอร์ทัลภายใน',
    recommendedSeats: 2,
    whyThisFits:
      'Gemini Flash & Pro รองรับบริบทขนาดใหญ่ สามารถค้นหาข้ามคู่มือซ่อมบำรุงเครื่องจักรหนาหลายร้อยหน้าได้ในเสี้ยววินาที ขณะที่ Claude Sonnet โดดเด่นในการร่างขั้นตอนความปลอดภัยและแบบฟอร์ม JSA ที่รัดกุม',
    deviceAndSharingRule:
      'ใช้งานผ่านแท็บเล็ตตรวจโรงงานและเครื่องคอมพิวเตอร์ในศูนย์ควบคุม (Control Room) มี Shared Project สำหรับรวบรวมระเบียบความปลอดภัยและแผนรับมือเหตุฉุกเฉิน',
    zdrAndPrivacyNote:
      'ปลอดภัย ไม่นำภาพถ่ายเครื่องจักรหรือกระบวนการผลิตเฉพาะที่เป็นความลับทางเทคนิคไปเปิดเผยหรือเทรนภายนอก',
    proTricks: [
      'อัปโหลดคู่มือเครื่องจักร (User Manual) ทั้งเล่มไว้ในโมเดล แล้วสอบถามขั้นตอนการแก้ปัญหา Error Code ได้ทันที',
      'ป้อนข้อมูลเหตุการณ์เฉียดเกิดอุบัติเหตุ (Near Miss) ให้ AI ช่วยสร้างมาตรการป้องกันเชิงรุก (Preventive Actions)',
      'สั่งให้ AI แปลงระเบียบความปลอดภัยตัวอักษรยาวๆ ให้เป็น Safety Checklist หน้างานที่เข้าใจง่ายและปฏิบัติได้จริง'
    ],
    prefillForm: {
      tier: 'virtual_employee',
      title: 'ผู้ช่วยวิศวกรความปลอดภัยและปฏิบัติการโรงงาน (Virtual Safety & Plant Operations Specialist)',
      aiJd: 'ช่วยสกัดขั้นตอนการแก้ปัญหาจากคู่มือเครื่องจักร, จัดทำเอกสารประเมินความปลอดภัยในการทำงาน (JSA), และร่างรายงานการตรวจสอบมาตรฐานความปลอดภัย',
      asIsProcess:
        'เจ้าหน้าที่ความปลอดภัยและวิศวกรต้องค้นหาคู่มือเครื่องจักรหนาหลายร้อยหน้า และเขียนรายงานความปลอดภัยและสถิติด้วยตนเอง ใช้เวลาประมาณ 20 ชม./สัปดาห์',
      workFrequency: 'daily',
      asIsHours: 20,
      targetHoursSaved: 8,
      aiFunctions: [
        'ค้นหาและสรุปแนวทางแก้ไขปัญหาเครื่องจักรจากคู่มือทางเทคนิค (Troubleshooting Guides)',
        'ร่างและทบทวนเอกสารวิเคราะห์ความปลอดภัยในการทำงาน (Job Safety Analysis - JSA)',
        'สรุปสถิติความปลอดภัยและจัดทำรายงานอุบัติการณ์ตามมาตรฐาน ISO 45001'
      ],
      expectedBenefits: 'ลดเวลาค้นหาคู่มือซ่อมบำรุงลง 70% และยกระดับการตรวจตราความปลอดภัยเชิงรุกในโรงงาน',
      recommendedSeats: 2
    }
  }
];

/**
 * ฟังก์ชันตัวช่วยค้นหาและคำนวณสถิติของ Department Presets
 */

/**
 * ดึงข้อมูล Department Preset ตาม ID
 */
export function getDepartmentPresetById(id: string): DepartmentAiPreset | undefined {
  return DEPARTMENT_AI_PRESETS.find((preset) => preset.id === id);
}

/**
 * ดึงข้อมูล Licensing Route ตาม ID
 */
export function getLicensingRouteById(id: AiLicensingRouteId): AiLicensingRoute | undefined {
  return LICENSING_ROUTES.find((route) => route.id === id);
}

/**
 * คำนวณจำนวนที่นั่ง AI ที่แนะนำรวมทุกฝ่าย (Recommended Seats Pool)
 */
export function calculateTotalRecommendedSeats(): number {
  return DEPARTMENT_AI_PRESETS.reduce((sum, dept) => sum + dept.recommendedSeats, 0);
}

/**
 * คำนวณจำนวนพนักงานจริงรวมทุกฝ่ายที่ครอบคลุมใน Presets
 */
export function calculateTotalActualHeadcount(): number {
  return DEPARTMENT_AI_PRESETS.reduce((sum, dept) => sum + dept.headcountActual, 0);
}
