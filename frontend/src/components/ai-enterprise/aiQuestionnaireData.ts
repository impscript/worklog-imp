/**
 * AI Needs Assessment Questionnaire Engine & Types
 * ระบบประเมินความต้องการใช้งาน AI และจับคู่โมเดลที่เหมาะสมตามระเบียบองค์กร WI-PI-AI-001
 *
 * ครอบคลุมการวิเคราะห์ 5 มิติ:
 * 1. เป้าหมายหลักในการใช้งาน (Primary Goal)
 * 2. ระดับความลับของข้อมูล (Data Sensitivity & Privacy)
 * 3. ความต้องการพิเศษเฉพาะทาง (Special Needs / Workloads)
 * 4. รูปแบบการทำงานร่วมกัน (Collaboration Mode)
 * 5. ความถี่และปริมาณการใช้งาน (Usage Frequency)
 */

import { DEPARTMENT_AI_PRESETS, type DepartmentAiPreset } from './aiDepartmentPresets';

export interface WizardQuestionOption {
  id: string;
  label: string;
  description: string;
  badge?: string;
  iconName: string;
  tags?: string[];
}

export interface WizardQuestion {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  options: WizardQuestionOption[];
}

export interface WizardAnswers {
  primaryGoal?: string; // Q1: numbers_accounting | writing_comms | creative_media | coding_automation | research_analysis
  dataSensitivity?: string; // Q2: public | internal | confidential | restricted
  specialNeeds?: string; // Q3: dashboard_visuals | image_gen | erp_database | long_docs
  collaborationMode?: string; // Q4: solo_pro | team_shared | company_portal
  usageFrequency?: string; // Q5: ad_hoc | daily_standard | heavy_all_day
}

export interface AssessmentResult {
  matchedRouteId: 'subscription_team' | 'subscription_premium' | 'api_payg' | 'enterprise_zdr';
  recommendedProvider: string; // e.g. 'Anthropic Claude' or 'OpenAI ChatGPT' or 'Multi-Provider API Gateway'
  primaryModel: string; // e.g. 'Claude 3.5 Sonnet' or 'ChatGPT (GPT-4o)' or 'DeepSeek R1'
  secondaryModel: string;
  estimatedCost: string;
  recommendedSeats: number;
  summaryTitle: string;
  matchReason: string;
  keyFeatures: string[];
  complianceNotice: string;
  multiDeviceRule: string;
  suggestedDepartmentId?: string; // e.g. 'accounting_finance', 'digital_innovation_it', 'business_development_commercial', etc.
}

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: 'primaryGoal',
    stepNumber: 1,
    title: 'เป้าหมายหลักในการนำ AI มาช่วยงาน (Primary Work Goal)',
    subtitle: 'เลือกประเภทของงานที่คุณหรือทีมต้องจัดการเป็นประจำมากที่สุด เพื่อกำหนดจุดเด่นของ AI Model',
    options: [
      {
        id: 'numbers_accounting',
        label: 'ตัวเลข งบการเงิน บัญชี และสูตรคำนวณ Excel',
        description: 'วิเคราะห์งบดุล ภ.ง.ด. กระทบยอดบัญชีแยกประเภท (GL) ตรวจสอบความถูกต้องของตารางคำนวณซับซ้อน',
        badge: 'ความแม่นยำสูง (Precision)',
        iconName: 'Calculator',
        tags: ['Claude Sonnet', 'งบการเงิน & GL', 'ภาษี ภ.ง.ด.', 'Excel/CSV']
      },
      {
        id: 'writing_comms',
        label: 'ร่างเอกสาร หนังสือราชการ และสื่อสารองค์กร',
        description: 'ร่างหนังสือทางการ อีเมลธุรกิจ จัดทำบันทึกข้อความ สรุปการประชุม แปลภาษา และขัดเกลาสำนวน',
        badge: 'งานประจำวัน (Daily Comms)',
        iconName: 'FileText',
        tags: ['Claude Haiku', 'หนังสือราชการ', 'อีเมลธุรกิจ', 'สรุปการประชุม']
      },
      {
        id: 'creative_media',
        label: 'ออกแบบกราฟิก สร้างภาพ และผลิตสื่อการตลาด',
        description: 'สร้างภาพโปรโมตคุณภาพสูงด้วย Midjourney / Flux ออกแบบแบนเนอร์ตัวอักษรคมชัดด้วย Ideogram และทำกราฟิกเวกเตอร์ด้วย Recraft',
        badge: 'ความคิดสร้างสรรค์ (Visual AI)',
        iconName: 'Sparkles',
        tags: ['Midjourney & Flux', 'Ideogram v2', 'Recraft v3 (Vector)', 'Canva Magic Studio']
      },
      {
        id: 'coding_automation',
        label: 'เขียนโปรแกรม พัฒนาระบบ และระบบอัตโนมัติ (Automation)',
        description: 'เขียนโค้ด Python, SQL, Web API ดีบั๊กข้อผิดพลาด และเชื่อมโยงระบบอัตโนมัติข้ามเครื่องมือ',
        badge: 'วิศวกรรม & IT (High Throughput)',
        iconName: 'Code2',
        tags: ['Claude Sonnet & Code CLI', 'Full-stack & API', 'Python / n8n', 'Automated QA']
      },
      {
        id: 'research_analysis',
        label: 'ค้นคว้า วิจัย วิเคราะห์สัญญา และเอกสารยาว',
        description: 'อ่านสรุปสัญญาทางกฎหมาย ข้อกำหนดจัดซื้อ (TOR) รายงานวิเคราะห์คู่แข่ง และนโยบายหนา 50-100+ หน้า',
        badge: 'วิเคราะห์เชิงลึก (Deep Reasoning)',
        iconName: 'Scale',
        tags: ['Claude Sonnet', 'Gemini Flash (1M+ คำ)', 'DeepSeek Reasoner', 'ตรวจสัญญา & TOR']
      }
    ]
  },
  {
    id: 'dataSensitivity',
    stepNumber: 2,
    title: 'ระดับชั้นความลับของข้อมูลที่นำมาประมวลผล (Data Sensitivity)',
    subtitle: 'อ้างอิงตามระเบียบความปลอดภัยสารสนเทศและ WI-PI-AI-001 เพื่อกำหนดมาตรการกักเก็บข้อมูล',
    options: [
      {
        id: 'public',
        label: 'ข้อมูลสาธารณะทั่วไป (Public Data)',
        description: 'ข่าวสาร ข้อมูลที่เปิดเผยต่อสาธารณะ บทความวิชาการ คู่มือมาตรฐานสากล หรือข้อมูลบนเว็บไซต์ทั่วไป',
        badge: 'ปลอดภัยไร้ข้อจำกัด',
        iconName: 'Globe',
        tags: ['ข่าวสารทั่วไป', 'คู่มือมาตรฐาน', 'ข้อมูลสาธารณะ']
      },
      {
        id: 'internal',
        label: 'ข้อมูลใช้เฉพาะภายในองค์กร (Internal Use Only)',
        description: 'บันทึกข้อความภายใน ขั้นตอนการทำงาน (SOP) คู่มือพนักงาน และแบบฟอร์มเอกสารของบริษัท',
        badge: 'ใช้งานได้ตามปกติ',
        iconName: 'Building',
        tags: ['SOP ภายใน', 'คู่มือพนักงาน', 'บันทึกช่วยจำ']
      },
      {
        id: 'confidential',
        label: 'ข้อมูลสำคัญทางธุรกิจ (Confidential Data)',
        description: 'งบการเงินภายใน สัญญาคู่ค้า ใบเสนอราคา ข้อมูลเงินเดือน หรือข้อมูลลูกค้าที่มีผลต่อธุรกิจ',
        badge: 'ต้องมี ZDR & Data Masking',
        iconName: 'Shield',
        tags: ['งบการเงิน', 'ราคาจัดซื้อ', 'ข้อมูลคู่ค้า', 'สัญญาทางธุรกิจ']
      },
      {
        id: 'restricted',
        label: 'ข้อมูลลับที่สุด / ความมั่นคง (Restricted / Strictly Secret)',
        description: 'รหัสผ่านระบบ กุญแจ API ข้อมูลลับทางการค้า สูตรการผลิต หรือข้อมูลอ่อนไหว PDPA ระดับสูง',
        badge: 'ห้ามใช้ Public Cloud เด็ดขาด',
        iconName: 'Lock',
        tags: ['API Keys & Passwords', 'สูตรลับทางการค้า', 'PDPA อ่อนไหว', 'Private Only']
      }
    ]
  },
  {
    id: 'specialNeeds',
    stepNumber: 3,
    title: 'ลักษณะความต้องการเฉพาะทางเพิ่มเติม (Special Needs)',
    subtitle: 'เลือกรูปแบบการป้อนข้อมูลและผลลัพธ์ที่ตอบโจทย์ขั้นตอนการทำงานจริงของคุณ',
    options: [
      {
        id: 'dashboard_visuals',
        label: 'ชาร์ต แดชบอร์ด และการนำเสนอข้อมูลสถิติ',
        description: 'แปลงตารางข้อมูลดิบเป็นกราฟ ชาร์ตเปรียบเทียบ KPI และสรุป Insight รายงานผู้บริหาร',
        badge: 'Data Visuals',
        iconName: 'BarChart3',
        tags: ['Charts & KPI', 'Executive Dashboard', 'สถิติเปรียบเทียบ']
      },
      {
        id: 'image_gen',
        label: 'การสร้างรูปภาพและงานศิลป์ (AI Image Generation)',
        description: 'สร้างภาพต้นแบบ อาร์ตเวิร์ก หรือกราฟิกเวกเตอร์คุณภาพสูง พร้อมจัดวางตัวอักษรบนภาพ',
        badge: 'Multimodal Image',
        iconName: 'Image',
        tags: ['Midjourney & Flux', 'Ideogram v2', 'Recraft v3 (SVG)', 'Canva Magic']
      },
      {
        id: 'erp_database',
        label: 'เชื่อมต่อฐานข้อมูล หรือระบบ ERP / SAP / CRM',
        description: 'ต้องการให้ AI ช่วยเขียนคิวรี ตรวจสอบโครงสร้างข้อมูล หรือเชื่อมประสานงานกับระบบหลัก',
        badge: 'System Integration',
        iconName: 'Database',
        tags: ['SQL Queries', 'SAP/ERP Interface', 'ระบบคงคลัง/บิล']
      },
      {
        id: 'long_docs',
        label: 'อ่านเอกสารขนาดยาว หลายสิบหรือหลักร้อยหน้า',
        description: 'อ่านวิเคราะห์สัญญาหนาๆ เล่มรายงานประจำปี TOR หรือมาตรฐาน ISO ครบทั้งเล่มโดยไม่หลุดบริบท',
        badge: 'Large Context (200k+)',
        iconName: 'BookOpen',
        tags: ['สัญญา 50+ หน้า', 'TOR เล่มใหญ่', 'รายงานประจำปี']
      }
    ]
  },
  {
    id: 'collaborationMode',
    stepNumber: 4,
    title: 'รูปแบบการทำงานร่วมกันในฝ่ายหรือทีมงาน (Collaboration Mode)',
    subtitle: 'ช่วยกำหนดประเภทสิทธิ์การใช้งาน (Seat License vs Shared Projects vs API Portal) ที่คุ้มค่าที่สุด',
    options: [
      {
        id: 'solo_pro',
        label: 'ผู้เชี่ยวชาญเฉพาะทาง (Solo Specialist)',
        description: 'ใช้งานคนเดียวเป็นหลักในการทำงานเชิงลึก ไม่จำเป็นต้องแชร์ Project หรือสร้างคลังเอกสารร่วมกับผู้อื่น',
        badge: '1 ที่นั่งเฉพาะทาง',
        iconName: 'UserCheck',
        tags: ['ความคล่องตัวเดี่ยว', 'เน้นงานส่วนบุคคล', '1 Account Multi-device']
      },
      {
        id: 'team_shared',
        label: 'ทีมทำงานร่วมกัน พร้อมคลังความรู้กลาง (Team Shared Knowledge)',
        description: 'มีทีม 2 คนขึ้นไป ต้องการแชร์โฟลเดอร์ระเบียบ แบบฟอร์ม และข้อกำหนดกลางใน Shared Projects',
        badge: 'แนะนำสูงสุดสำหรับองค์กร',
        iconName: 'Users',
        tags: ['Shared Projects', 'แชร์โฟลเดอร์กลาง', 'โควตาทีม', 'Zero Data Retention']
      },
      {
        id: 'company_portal',
        label: 'ใช้ผ่านพอร์ทัลกลางของบริษัท (Enterprise Company Portal)',
        description: 'ให้พนักงานทั้งแผนกเข้าถึงผ่านหน้าเว็บกลางขององค์กร ล็อกอินด้วย SSO พนักงาน จ่ายตามการใช้งานจริง',
        badge: 'กระจายทั่วถึง (High Reach)',
        iconName: 'Globe',
        tags: ['SSO พนักงาน', 'เข้าถึงได้ทุกคน', 'คิดเงินตาม Token', 'เซฟงบ 70%+']
      }
    ]
  },
  {
    id: 'usageFrequency',
    stepNumber: 5,
    title: 'ความถี่และปริมาณการใช้งานต่อวัน (Usage Frequency & Workload)',
    subtitle: 'ประเมินเพื่อป้องกันการเจอปัญหา Rate Limit หรือจ่ายค่าบริการใบอนุญาตเกินความจำเป็น',
    options: [
      {
        id: 'ad_hoc',
        label: 'ใช้งานเป็นครั้งคราว (Ad-hoc / นานๆ ครั้ง)',
        description: 'สัปดาห์ละ 1-2 ครั้ง หรือเฉพาะเวลามีงานโปรเจกต์พิเศษ ไม่ได้เปิดใช้งานตลอดวันทำงาน',
        badge: 'ต้นทุนต่ำ (Pay-Per-Token)',
        iconName: 'Clock',
        tags: ['สัปดาห์ละ 1-2 ครั้ง', 'จ่ายตามจริง', 'ไม่มีค่าธรรมเนียมคงที่']
      },
      {
        id: 'daily_standard',
        label: 'ใช้งานประจำทุกวันในเวลาทำงาน (Daily Standard 2-4 ชม./วัน)',
        description: 'ใช้เปิดควบคู่การทำงานปกติ ร่างอีเมล ตอบแชต ค้นหาข้อมูล และช่วยตรวจงานเป็นประจำ',
        badge: 'มาตรฐานสมดุล (Standard Seat)',
        iconName: 'CalendarCheck',
        tags: ['วันละ 2-4 ชม.', 'โควตากำลังดี', 'ทำงานลื่นไหล']
      },
      {
        id: 'heavy_all_day',
        label: 'ใช้งานเข้มข้นตลอดทั้งวัน (Heavy Power User / 5+ ชม./วัน)',
        description: 'เป็น Co-pilot หลักในการเขียนโค้ด วิเคราะห์งบต่อเนื่องทั้งวัน ต้องการโควตาสูงสุดและประมวลผลเร็ว',
        badge: 'โควตาสูงสุด (Power Co-pilot)',
        iconName: 'Zap',
        tags: ['วันละ 5+ ชม.', 'ต้องการ 5x Capacity', 'Plan Mode / Copilot']
      }
    ]
  }
];

/**
 * คำนวณและประเมินผลลัพธ์สิทธิ์ AI ที่เหมาะสมตามคำตอบ (Scoring & Matching Engine)
 */
export function evaluateAiNeeds(answers: WizardAnswers): AssessmentResult {
  const { primaryGoal, dataSensitivity, specialNeeds, collaborationMode, usageFrequency } = answers;

  // กฎที่ 1: ข้อมูลลับที่สุด (Restricted) - ห้ามใช้ Public AI โดยเด็ดขาด
  if (dataSensitivity === 'restricted') {
    return {
      matchedRouteId: 'enterprise_zdr',
      recommendedProvider: 'On-Premise / Private Enterprise Gateway (CoE Approved)',
      primaryModel: 'Azure OpenAI Private VPC / Local Model (CoE Controlled)',
      secondaryModel: 'DeepSeek R1 (Local Cluster)',
      estimatedCost: 'งบประมาณตามโครงสร้างพื้นฐานกลาง (CoE / IT CapEx)',
      recommendedSeats: 1,
      summaryTitle: '🔒 สิทธิ์ควบคุมเข้มงวด: ไม่อนุญาตให้ใช้ Public Cloud AI โดยเด็ดขาด',
      matchReason:
        'เนื่องจากข้อมูลของคุณถูกจัดเป็นข้อมูลลับที่สุด (Restricted) มีความเสี่ยงต่อความมั่นคงหรือข้อมูลลับทางการค้า จึงต้องประมวลผลผ่านระบบ On-Premise หรือ Private Gateway ภายใต้การควบคุมของ IT & DPO เท่านั้น เพื่อป้องกันการรั่วไหล 100%',
      keyFeatures: [
        'Zero Data Retention (ZDR) ควบคุมโดย IT องค์กร 100%',
        'ระบบเครือข่าย Private VPC แยกขาดจากอินเทอร์เน็ตสาธารณะ',
        'มีระบบ Audit Log ตรวจจับ DLP และบันทึกประวัติการสืบค้นย้อนหลัง',
        'ไม่ส่งข้อมูลออกนอก Private Gateway หรือ Public Cloud ใดๆ'
      ],
      complianceNotice:
        '⚠️ ห้ามนำข้อมูล Restricted ไปกรอกลง Public AI (ChatGPT, Claude เว็บทั่วไป) เด็ดขาด ตามระเบียบ WI-PI-AI-001 ฝ่าฝืนมีบทลงโทษทางวินัยขั้นสูงสุด',
      multiDeviceRule:
        'จำกัดการเข้าถึงเฉพาะอุปกรณ์บริษัทที่ติดตั้ง MDM และเชื่อมต่อผ่านระบบเครือข่ายภายใน (Corporate VPN/Intranet) เท่านั้น',
      suggestedDepartmentId: 'digital_innovation_it'
    };
  }

  // กฎที่ 2: งานสร้างสรรค์ / เจนรูปภาพมัลติมีเดีย (Image Generation / Creative Media)
  if (specialNeeds === 'image_gen' || primaryGoal === 'creative_media') {
    const seats = collaborationMode === 'solo_pro' ? 1 : 2;
    return {
      matchedRouteId: 'subscription_team',
      recommendedProvider: 'Midjourney + Flux.1 + Canva Magic Studio',
      primaryModel: 'Midjourney & Flux (Visual AI) + Ideogram',
      secondaryModel: 'Recraft (Vector/SVG) & Canva Magic Studio',
      estimatedCost: '$25 - $30 / ที่นั่ง / เดือน (~875 - 1,050 บาท)',
      recommendedSeats: seats,
      summaryTitle: '🎨 ชุดเครื่องมือสร้างสรรค์และมัลติมีเดีย (Visual & Media Studio)',
      matchReason:
        'งานด้านการสร้างสื่อ รูปภาพ และคอนเทนต์มัลติมีเดีย ต้องการพลังของโมเดล Visual AI ยุคใหม่อย่าง Midjourney และ Flux ร่วมกับ Ideogram สำหรับตัวอักษรบนภาพ และ Recraft สำหรับภาพเวกเตอร์ เพื่อให้ได้ผลงานระดับมืออาชีพโดยไม่ต้องเริ่มจากศูนย์',
      keyFeatures: [
        'สร้างภาพกราฟิกความละเอียดสูงเสมือนจริงด้วย Midjourney และ Flux',
        'ออกแบบตัวอักษรและแบนเนอร์โปสเตอร์คมชัดด้วย Ideogram',
        'สร้างภาพเวกเตอร์ (SVG) และไอคอนแบรนด์ด้วย Recraft',
        'จัดวางเลย์เอาต์สื่อประชาสัมพันธ์และแชร์ Asset ร่วมกันในทีมด้วย Canva Magic Studio'
      ],
      complianceNotice:
        'ตรวจสอบลิขสิทธิ์ภาพและห้ามนำภาพที่มีเครื่องหมายการค้า คู่แข่ง หรือใบหน้าบุคคลอื่นโดยไม่ได้รับอนุญาตมาตัดต่อ',
      multiDeviceRule:
        '1 ผู้ใช้งานล็อกอินบนคอมพิวเตอร์และแท็บเล็ตได้ แต่ห้ามแชร์บัญชีเพื่อเจนรูปภาพข้ามแผนก ให้รวมศูนย์ Asset ใน Team Shared Folder',
      suggestedDepartmentId: 'business_development_commercial'
    };
  }

  // กฎที่ 3: งานโค้ด / ระบบอัตโนมัติ หรือใช้งานเข้มข้นตลอดทั้งวัน (Coding / Heavy User)
  if (primaryGoal === 'coding_automation' || usageFrequency === 'heavy_all_day') {
    if (primaryGoal === 'coding_automation') {
      const seats = collaborationMode === 'solo_pro' ? 1 : 3;
      return {
        matchedRouteId: 'subscription_premium',
        recommendedProvider: 'Anthropic Claude + GitHub Copilot',
        primaryModel: 'Claude Sonnet (Coding & Plan Mode)',
        secondaryModel: 'GitHub Copilot / DeepSeek Reasoner',
        estimatedCost: '$25 - $40 / ที่นั่ง / เดือน (~875 - 1,400 บาท)',
        recommendedSeats: seats,
        summaryTitle: '⚡ วิศวกรรมระบบและระบบอัตโนมัติ (High-Throughput Engineering & Automation)',
        matchReason:
          'งานเขียนโปรแกรม สคริปต์ และระบบอัตโนมัติต้องการพลังวิเคราะห์โค้ดระดับท็อปของ Claude Sonnet และโควตาคำนวณสูงเพื่อป้องกัน Rate Limit ในการประมวลผลโค้ดเบสใหญ่',
        keyFeatures: [
          'Artifacts & Plan Mode สำหรับการเขียนโค้ดและดีบั๊กโปรแกรม',
          'เชื่อมโยงสถาปัตยกรรมระบบ สคริปต์ Python, SQL และ Web API',
          'วิเคราะห์โค้ดเบสขนาดใหญ่และสร้างการทดสอบอัตโนมัติ',
          'โควตาข้อความสูงสุด 5x สำหรับผู้ใช้งานระดับ Power User'
        ],
        complianceNotice:
          'ห้ามส่ง API Keys, Passwords หรือข้อมูลลับของฐานข้อมูลขึ้นโมเดล ตรวจสอบ Code Security Scan เสมอ',
        multiDeviceRule:
          'ใช้งานข้ามเวิร์กสเตชันและโน้ตบุ๊กของตนเองได้ แนะนำให้ผูกกับ Git Repository กลางแทนการแชร์รหัสผ่าน',
        suggestedDepartmentId: 'digital_innovation_it'
      };
    }

    // Heavy user แต่ไม่ใช่งานเขียนโปรแกรม
    const seats = collaborationMode === 'solo_pro' ? 1 : 3;
    return {
      matchedRouteId: 'subscription_premium',
      recommendedProvider: 'Anthropic Claude',
      primaryModel: 'Claude Sonnet (High Capacity)',
      secondaryModel: 'Claude Haiku',
      estimatedCost: '$25 - $35 / ที่นั่ง / เดือน (~875 - 1,225 บาท)',
      recommendedSeats: seats,
      summaryTitle: '🚀 สิทธิ์การประมวลผลขั้นสูงต่อเนื่อง (High-Capacity Enterprise Seat)',
      matchReason:
        'สำหรับการใช้งานหนักมากกว่า 5 ชม./วัน โควตาการคำนวณของ Premium Plan จะช่วยให้ทำงานได้ต่อเนื่องโดยไม่ติด Rate Limit กลางคัน และทำงานได้อย่างเต็มประสิทธิภาพ',
      keyFeatures: [
        'โควตาข้อความเพิ่มขึ้น 5 เท่า (5x Message Capacity)',
        'สิทธิ์การเข้าถึงโมเดลความเร็วสูงพิเศษในช่วงชั่วโมงเร่งด่วน',
        'ฟีเจอร์ Extended Thinking สำหรับงานคิดเชิงวิเคราะห์ที่ซับซ้อน',
        'Shared Projects ไม่จำกัดพื้นที่ในการเก็บคู่มือและคลังเอกสาร'
      ],
      complianceNotice:
        'ปฏิบัติตามมาตรฐาน WI-PI-AI-001 และ Data Masking อย่างเคร่งครัด ห้ามอัปโหลดข้อมูลส่วนบุคคลที่ไม่จำเป็น',
      multiDeviceRule:
        '1 ผู้ใช้งานล็อกอินได้ทั้งคอมพิวเตอร์และมือถือ ห้ามแชร์บัญชีเพื่อแบ่งกันใช้งานเพราะระบบจะระงับการเข้าถึง',
      suggestedDepartmentId: 'digital_innovation_it'
    };
  }

  // กฎที่ 4: งานตัวเลข / การเงิน / เอกสารยาว / ข้อมูลลับระดับธุรกิจ (Numbers, Accounting, Legal, Long Docs, Confidential)
  if (
    primaryGoal === 'numbers_accounting' ||
    primaryGoal === 'research_analysis' ||
    dataSensitivity === 'confidential' ||
    specialNeeds === 'long_docs'
  ) {
    const seats = collaborationMode === 'solo_pro' ? 1 : 3;
    let deptId = 'accounting_finance';
    if (primaryGoal === 'research_analysis') {
      deptId = 'legal_compliance';
    } else if (specialNeeds === 'long_docs' && primaryGoal !== 'numbers_accounting') {
      deptId = 'process_improvement_audit';
    }

    return {
      matchedRouteId: 'subscription_team',
      recommendedProvider: 'Anthropic Claude',
      primaryModel: 'Claude Sonnet (งานตัวเลข งบการเงิน และเอกสารยาว)',
      secondaryModel: 'Claude Haiku (งานร่างเมลและสรุปย่อเพื่อประหยัดโควตา)',
      estimatedCost: '$20 - $25 / ที่นั่ง / เดือน (~700 - 875 บาท)',
      recommendedSeats: seats,
      summaryTitle: '📊 ผู้ช่วยระดับพรีเมียมสายวิเคราะห์และเอกสาร (Enterprise Analytical Seat)',
      matchReason:
        'Claude Sonnet ให้ความแม่นยำทางตัวเลขและตรรกะสูงสุดในอุตสาหกรรม อ่านตาราง Excel งบการเงิน และเอกสารยาวได้โดยไม่คลาดเคลื่อน พร้อมการคุ้มครองข้อมูลธุรกิจภายใต้ Team Plan',
      keyFeatures: [
        'อ่านและวิเคราะห์งบดุล ภ.ง.ด. กระทบยอดบัญชี และสูตรคำนวณ Excel แม่นยำสูง',
        'รองรับเอกสารขนาดยาว (สัญญา, TOR, รายงานประจำปี 50-100 หน้า)',
        'สร้าง Shared Project กลาง เช่น ผังบัญชี (COA) หรือคลังสัญญาให้ทีมดึงใช้ได้ทันที',
        'Zero Data Retention (ZDR) — ข้อมูลขององค์กรจะไม่ถูกนำไปใช้เทรน AI เด็ดขาด'
      ],
      complianceNotice:
        'ปฏิบัติตามหลัก Data Masking เสมอ: เซนเซอร์ชื่อบุคคลภายนอก เลขที่บัญชี หรือเลขบัตรประชาชนก่อนอัปโหลด',
      multiDeviceRule:
        '1 ผู้ใช้งานล็อกอินได้ทั้งคอมพิวเตอร์และสมาร์ตโฟน ห้ามแชร์บัญชีร่วมกันเด็ดขาด หากต้องการแบ่งปันข้อมูล ให้ใช้ฟีเจอร์ Shared Projects',
      suggestedDepartmentId: deptId
    };
  }

  // กฎที่ 5: ใช้งานเป็นครั้งคราว หรือผ่านพอร์ทัลกลางบริษัท (Ad-hoc / Company Portal)
  if (usageFrequency === 'ad_hoc' || collaborationMode === 'company_portal') {
    return {
      matchedRouteId: 'api_payg',
      recommendedProvider: 'Enterprise Multi-Provider API Gateway (CoE Managed)',
      primaryModel: 'DeepSeek Reasoner & Chat + Claude Haiku (ผ่านเว็บพอร์ทัลกลาง)',
      secondaryModel: 'Gemini Flash & GPT Mini',
      estimatedCost: '$2 - $8 / คน / เดือน (~70 - 280 บาท จ่ายตาม Token จริง)',
      recommendedSeats: 5,
      summaryTitle: '🌐 ทางเลือกสุดประหยัดผ่านพอร์ทัลกลาง (Pay-Per-Token API Gateway)',
      matchReason:
        'สำหรับการใช้งานเป็นครั้งคราว หรือเน้นงานทั่วไปผ่านเว็บพอร์ทัลกลางของบริษัท การคิดเงินตาม Token จริงจะช่วยประหยัดงบประมาณองค์กรได้มากกว่า 70% และเข้าถึงได้ทุกคนในแผนก',
      keyFeatures: [
        'จ่ายตามการใช้งานจริง (Pay as you go) ไม่มีค่าสมาชิกล่วงหน้า',
        'เชื่อมต่อพอร์ทัลกลางผ่าน Single Sign-On (SSO) ด้วยรหัสพนักงาน',
        'สลับโมเดล AI ได้หลากหลายตามความเหมาะสมของงาน',
        'มีระบบ Data Masking และ Audit Log อัตโนมัติที่ Gateway'
      ],
      complianceNotice:
        'ควบคุมความปลอดภัยผ่าน API Gateway กลาง มีการบันทึกประวัติการเรียกใช้เพื่อตรวจสอบย้อนหลังตามระเบียบ',
      multiDeviceRule:
        'เข้าใช้งานผ่านเบราว์เซอร์จากอุปกรณ์ใดก็ได้ที่อยู่ในระบบเครือข่ายบริษัทโดยใช้รหัสพนักงาน (SSO)',
      suggestedDepartmentId: 'human_resources'
    };
  }

  // ค่ามาตรฐานเริ่มต้น (Default Fallback: เช่น งานเขียนเอกสารทั่วไป ใช้งานปกติทุกวัน)
  return {
    matchedRouteId: 'subscription_team',
    recommendedProvider: 'Anthropic Claude',
    primaryModel: 'Claude Sonnet',
    secondaryModel: 'Claude Haiku',
    estimatedCost: '$20 - $25 / ที่นั่ง / เดือน (~700 - 875 บาท)',
    recommendedSeats: 2,
    summaryTitle: '💼 ผู้ช่วยอัจฉริยะมาตรฐานองค์กร (Standard Enterprise Seat)',
    matchReason:
      'สมดุลยอดเยี่ยมระหว่างความฉลาด การทำงานร่วมกันในทีม และความปลอดภัย เหมาะสำหรับงานร่างเอกสาร สื่อสาร และวิเคราะห์ประจำวัน',
    keyFeatures: [
      'ร่างหนังสือ อีเมล และเอกสารนำเสนอระดับมืออาชีพ',
      'แปลภาษาและปรับระดับภาษาทางการ',
      'สร้าง Shared Projects สำหรับงานในฝ่าย',
      'Zero Data Retention คุ้มครองข้อมูลพนักงานและองค์กร'
    ],
    complianceNotice:
      'รักษาความปลอดภัยข้อมูลตามระเบียบ WI-PI-AI-001 ห้ามนำข้อมูลลูกค้าหรือพนักงานแบบไม่ปกปิดขึ้นประมวลผล',
    multiDeviceRule:
      'ล็อกอินอุปกรณ์ส่วนตัวได้ แต่ห้ามแชร์รหัสผ่านร่วมกันในแผนก',
    suggestedDepartmentId: 'human_resources'
  };
}

/**
 * ดึงข้อมูล Department Preset จาก ID ที่แนะนำ
 */
export function getSuggestedDepartmentPreset(departmentId?: string): DepartmentAiPreset | undefined {
  if (!departmentId) return undefined;
  return DEPARTMENT_AI_PRESETS.find((p) => p.id === departmentId);
}
