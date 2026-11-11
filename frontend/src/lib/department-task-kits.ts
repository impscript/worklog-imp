/**
 * Department Benchmark Test Kits for 8 Departments
 * อ้างอิงตามโครงสร้าง Manpower องค์กร (Summary Manpower Corp. / RE & LO / Holding / 304IP)
 *
 * ชุดข้อสอบและโจทย์ทดสอบมาตรฐานประจำฝ่ายงาน (Benchmark Arena Task Kits)
 * เพื่อใช้ในการทดสอบประเมินโมเดล AI ใน Chat Sandbox เปรียบเทียบผลลัพธ์และความคุ้มค่า
 * ก่อนการยื่นขออนุมัติจัดสรรสิทธิ์ใช้งานจริงตามแบบฟอร์ม FM-001
 */

export interface DepartmentTaskKit {
  id: string;
  deptId: string;
  deptName: string;
  category: 'accounting' | 'procurement' | 'legal' | 'hr' | 'it' | 'audit' | 'marketing' | 'plant';
  title: string;
  description: string;
  difficulty: 'standard' | 'high_reasoning' | 'speed_draft';
  prompt: string;
  suggestedArenaPreset: 'speed_budget' | 'flagship_heavy' | 'math_reasoning';
  evaluationRubric: string[];
}

export const DEPARTMENT_TASK_KITS: DepartmentTaskKit[] = [
  // 1. บัญชีและการเงิน (Accounting & Finance)
  {
    id: 'task-acc-001',
    deptId: 'accounting_finance',
    deptName: 'ฝ่ายบัญชีและการเงิน',
    category: 'accounting',
    title: 'ตรวจสอบงบดุลและคำนวณภาษีหัก ณ ที่จ่าย ภ.ง.ด. 53/54 พร้อม DTA',
    description: 'วิเคราะห์ภาระภาษีหัก ณ ที่จ่ายสำหรับการจ่ายค่าบริการซอฟต์แวร์และลิขสิทธิ์ข้ามประเทศ (สิงคโปร์-ไทย) พร้อมกระทบยอดบัญชี',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'math_reasoning',
    prompt: `คุณคือผู้เชี่ยวชาญด้านภาษีและบัญชีการเงินระดับสูง (Senior Tax & Accounting Specialist) ของกลุ่มบริษัท กรุณาช่วยตรวจสอบและคำนวณรายการจ่ายเงินค่าบริการต่างประเทศต่อไปนี้:

บริบทรายการธุรกรรม:
บริษัทฯ ได้ทำสัญญาว่าจ้างบริการ Cloud Infrastructure and Software License กับบริษัท SaaS Pte Ltd (จดทะเบียนในประเทศสิงคโปร์และมี Certificate of Residence จาก IRAS) ในงวดเดือนปัจจุบัน มีรายการเรียกเก็บเงินดังนี้:
1. ค่าบริการ Cloud Hosting Server ประจำเดือน: 15,000 USD (อัตราแลกเปลี่ยน ธปท. วันบันทึกรายการ 35.50 บาท/USD)
2. ค่าสิทธิ์การใช้งาน Proprietary API Algorithm (Royalties/License): 20,000 USD
3. ค่าบริการ Technical Support & Custom Training ที่วิศวกรส่งงานทางรีโมต: 8,000 USD
เงื่อนไขในสัญญา: ผู้ว่าจ้างในไทยตกลงเป็นผู้ออกภาษีหัก ณ ที่จ่ายแทนผู้รับเงินทั้งหมด (ออกให้ตลอดไป หรือ Gross-up)

สิ่งที่ต้องการให้วิเคราะห์และจัดทำ:
1. วิเคราะห์ภาระภาษีเงินได้นิติบุคคลหัก ณ ที่จ่ายตามประมวลรัษฎากร (ม.70) เทียบกับอนุสัญญาภาษีซ้อน (DTA ไทย - สิงคโปร์) ว่าแต่ละรายการเข้าข่ายข้อใด อัตราเท่าใด และต้องยื่นแบบ ภ.ง.ด. 54 หรือไม่
2. วิเคราะห์ภาระภาษีมูลค่าเพิ่ม (ภ.พ. 36) ตาม ม.83/6 ว่าต้องนำส่งในอัตราเท่าใด ยอดฐานภาษีเท่าใด
3. คำนวณยอดเงินภาษีที่ต้องนำส่งจริงในรูปเงินบาท โดยใช้สูตร Gross-up (ออกภาษีแทนตลอดไป) พร้อมแสดงวิธีคำนวณทีละขั้นอย่างละเอียด
4. จัดทำบันทึกบัญชีสมุดรายวันทั่วไป (Dr. / Cr.) ตามมาตรฐานบัญชีไทย (TFRS) พร้อมระบุชื่อบัญชีและตัวเลขที่ถูกต้อง`,
    evaluationRubric: [
      'อ้างอิงข้อบทในอนุสัญญาภาษีซ้อน (DTA ไทย-สิงคโปร์) เช่น ข้อ 7 (กำไรจากธุรกิจ) และข้อ 12 (ค่าสิทธิ) ได้ถูกต้องแม่นยำ',
      'คำนวณสูตร Gross-up ภาษีหัก ณ ที่จ่าย (ภ.ง.ด. 54) ได้ถูกต้องตามวิธีคำนวณของกรมสรรพากร',
      'ระบุภาระภาษีมูลค่าเพิ่ม (ภ.พ. 36) ร้อยละ 7 และสิทธิ์การนำไปเคลมภาษีซื้อในเดือนถัดไปได้ชัดเจน',
      'แสดงการบันทึกบัญชี Dr./Cr. สมดุลทั้งสองด้าน พร้อมคำนวณเป็นสกุลเงินบาทตามอัตราแลกเปลี่ยนที่กำหนด',
    ],
  },

  // 2. จัดซื้อและบริหารสัญญา (Procurement & Vendor Management)
  {
    id: 'task-proc-001',
    deptId: 'procurement_vendor',
    deptName: 'ฝ่ายจัดซื้อและบริหารสัญญา',
    category: 'procurement',
    title: 'เปรียบเทียบใบเสนอราคาและเงื่อนไข TOR จัดซื้อเครื่องจักรอุตสาหกรรม 3 เจ้า',
    description: 'จัดทำตารางเปรียบเทียบเชิงวิเคราะห์ Total Cost of Ownership (TCO) 5 ปี สำหรับการจัดซื้อ Air Compressor System',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือผู้จัดการฝ่ายจัดซื้อเชิงกลยุทธ์ (Strategic Procurement Manager) ในนิคมอุตสาหกรรม 304 กรุณาวิเคราะห์และเปรียบเทียบใบเสนอราคาระบบเครื่องอัดอากาศอุตสาหกรรม (Screw Air Compressor 75 kW) จากคู่เทียบ 3 ราย:

ข้อมูลผู้เสนอราคา:
1. Vendor A (แบรนด์ยุโรป - ตัวแทนจำหน่ายอย่างเป็นทางการ):
   - ราคาเครื่องจักร: 1,850,000 บาท (รวม VAT แล้ว)
   - การรับประกัน: 3 ปี ฟรีค่าแรงและอะไหล่สิ้นเปลืองรอบปีแรก
   - การใช้พลังงาน: 78 kW ที่ full load (Specific Power 6.2 kW/m³/min)
   - สัญญาบริการบำรุงรักษา (PM Contract): ปีที่ 2-5 ปีละ 85,000 บาท
   - Credit Term: 60 วันหลังส่งมอบและทดสอบระบบผ่าน
   - อะไหล่สำรองในประเทศ: มีคลังสินค้าในไทย จัดส่งได้ใน 24 ชม.

2. Vendor B (แบรนด์ญี่ปุ่น - ผู้ผลิตโดยตรง):
   - ราคาเครื่องจักร: 1,550,000 บาท (ยังไม่รวม VAT 7%)
   - การรับประกัน: 2 ปี ฟรีค่าแรงตรวจเช็กทุก 3 เดือน (ไม่รวมค่าอะไหล่สิ้นเปลือง)
   - การใช้พลังงาน: 82 kW ที่ full load (Specific Power 6.6 kW/m³/min)
   - สัญญาบริการบำรุงรักษา (PM Contract): ปีที่ 3-5 ปีละ 110,000 บาท
   - Credit Term: มัดจำ 30%, 70% ก่อนส่งมอบเครื่อง
   - อะไหล่สำรองในประเทศ: ส่งจากคลังหลักสิงคโปร์ Lead time 5-7 วันทำการ

3. Vendor C (แบรนด์เอเชีย - ประกอบในประเทศ):
   - ราคาเครื่องจักร: 1,150,000 บาท (รวม VAT แล้ว)
   - การรับประกัน: 1 ปี
   - การใช้พลังงาน: 89 kW ที่ full load (Specific Power 7.1 kW/m³/min)
   - สัญญาบริการบำรุงรักษา (PM Contract): ปีละ 65,000 บาท ทุกปี
   - Credit Term: 30 วันหลังรับสินค้า
   - อะไหล่สำรองในประเทศ: ผลิตในประเทศ อะไหล่หาง่าย

สมมติฐานการปฏิบัติงาน:
- โรงงานเดินเครื่อง 24 ชม. x 330 วันต่อปี (7,920 ชั่วโมงต่อปี) โหลดเฉลี่ย 80%
- ค่าไฟฟ้าเฉลี่ยอัตรา TOU 4.20 บาท/kWh

สิ่งที่ต้องการให้ส่งมอบ:
1. ตารางเปรียบเทียบคุณสมบัติเชิงเทคนิคและเงื่อนไขการค้า (Matrix Comparison Table)
2. การคำนวณต้นทุนการเป็นเจ้าของตลอดอายุ 5 ปี (5-Year TCO: Capex + Energy Cost + Maintenance Cost)
3. การประเมินความเสี่ยงด้าน Operational Downtime และ Supply Chain Risk
4. ข้อเสนอแนะเชิงกลยุทธ์ในการคัดเลือกผู้ชนะ พร้อมระบุประเด็นและข้อความสำหรับการเจรจาต่อรองรอบสุดท้าย (Counter-negotiation tactics)`,
    evaluationRubric: [
      'แปลงราคาให้เป็นฐานภาษีเดียวกัน (Net vs Gross VAT 7%) และคำนวณค่าไฟฟ้า 5 ปีได้ถูกต้องตามสมมติฐาน',
      'คำนวณ Total Cost of Ownership (TCO) 5 ปีได้แม่นยำ พร้อมแสดงว่า Vendor ใดคุ้มค่าที่สุดในระยะยาว',
      'วิเคราะห์ความเสี่ยงเรื่อง Lead time อะไหล่และผลกระทบต่อ Downtime โรงงานได้อย่างเป็นมืออาชีพ',
      'ให้ข้อเสนอแนะเชิงกลยุทธ์พร้อมประเด็นต่อรองที่นำไปใช้ในการประชุมเจรจาได้ทันที',
    ],
  },

  // 3. กฎหมายและกำกับดูแล (Legal & Compliance)
  {
    id: 'task-legal-001',
    deptId: 'legal_compliance',
    deptName: 'ฝ่ายกฎหมายและกำกับดูแล',
    category: 'legal',
    title: 'รีวิวข้อสัญญา NDA & Limitation of Liability clause ตามกฎหมายไทย',
    description: 'ตรวจสอบความเสี่ยงในสัญญา Non-Disclosure Agreement ฉบับร่างของคู่ค้าต่างประเทศ และจัดทำ Redline Clauses ที่รัดกุม',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือที่ปรึกษากฎหมายองค์กรอาวุโส (Senior Corporate Legal Counsel) กรุณาตรวจสอบข้อสัญญาในร่างสัญญา Non-Disclosure and Joint Development Agreement (NDA) ที่คู่ค้าต่างชาติต้องการให้กลุ่มบริษัทลงนาม:

ข้อสัญญาเดิมในร่าง (Draft Clauses):
"Section 8. Limitation of Liability and Indemnification
8.1 To the maximum extent permitted by applicable law, Disclosing Party shall not be liable to Receiving Party for any indirect, incidental, punitive, or consequential damages. However, Receiving Party shall indemnify, defend and hold harmless Disclosing Party, its affiliates, directors and employees from and against any and all claims, losses, damages, liabilities and expenses (including full attorney fees on an indemnity basis) arising directly or indirectly from any breach of confidentiality by Receiving Party, without any financial cap or limitation whatsoever.
8.2 Injunction and Specific Performance: Receiving Party acknowledges that any breach would cause irreparable harm, and agrees that Disclosing Party may obtain immediate ex-parte injunctions without proving actual damages and without posting any bond or collateral."

"Section 11. Governing Law and Dispute Resolution
This Agreement shall be governed exclusively by the laws of the State of New York, USA. Any dispute arising out of or in connection with this contract shall be referred to and finally resolved by arbitration administered by the American Arbitration Association (AAA) in New York City in accordance with its Commercial Arbitration Rules."

สิ่งที่ต้องการให้ส่งมอบ:
1. การระบุข้อเสี่ยงทางกฎหมาย (Legal Red Flags & Risk Assessment) ตามหลักกฎหมายไทย และ พ.ร.บ. ว่าด้วยข้อสัญญาที่ไม่เป็นธรรม พ.ศ. 2540
2. การวิเคราะห์ข้อเสียเปรียบเชิงปฏิบัติการ (Asymmetry of Obligations, Financial Exposure, Venue of Dispute Resolution)
3. ร่างข้อสัญญาฉบับแก้ไขแบบ Redline (ภาษาอังกฤษที่เป็นสากล พร้อมคำแปลและคำอธิบายภาษาไทย) ที่สร้างความสมดุล (Mutual Protection), มี Cap of Liability ที่ชัดเจน และเปลี่ยนสถานที่ระงับข้อพิพาทมายังประเทศไทยหรือสิงคโปร์ (SIAC/THAC)
4. คำแนะนำสำหรับฝ่ายบริหารในการต่อรองกับคู่ค้า`,
    evaluationRubric: [
      'ตรวจพบความไม่สมดุลของสัญญา (One-sided Uncapped Indemnity) และการห้ามขอหลักประกันคุ้มครองชั่วคราว',
      'วิเคราะห์ผลกระทบตาม พ.ร.บ. ว่าด้วยข้อสัญญาที่ไม่เป็นธรรม และความยากลำบากในการดำเนินคดีในนิวยอร์ก',
      'จัดทำร่างแก้ไขข้อความภาษาอังกฤษ (Redline markup) ที่มีคุณภาพระดับสำนักงานกฎหมายสากล',
      'เสนอทางเลือกอนุญาโตตุลาการที่เป็นกลางและประหยัดต้นทุน เช่น SIAC (สิงคโปร์) หรือ TAI/THAC (ไทย)',
    ],
  },

  // 4. ทรัพยากรบุคคลและพัฒนาองค์กร (Human Resources & OD)
  {
    id: 'task-hr-001',
    deptId: 'human_resources',
    deptName: 'ฝ่ายทรัพยากรบุคคลและพัฒนาองค์กร',
    category: 'hr',
    title: 'ออกแบบ Job Description และคำถามสัมภาษณ์ตามเกณฑ์ 3Ts (Talent, Task, Team fit)',
    description: 'จัดทำโครงสร้างกำหนดหน้าที่งาน (JD) และชุดคำถามสัมภาษณ์เชิงพฤติกรรม (STAR Technique) สำหรับตำแหน่ง Lead AI Engineer',
    difficulty: 'standard',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือผู้จัดการฝ่ายพัฒนาองค์กรและสรรหาบุคลากร (HR & OD Lead) ขององค์กรธุรกิจขนาดใหญ่ กรุณาช่วยออกแบบระบบการสรรหาและคัดเลือกพนักงานสำหรับตำแหน่งใหม่:

ตำแหน่งงาน: Lead AI & Process Automation Specialist (สังกัดฝ่าย DIT / PI-IA)
ภารกิจหลัก: ขับเคลื่อนการประยุกต์ใช้โมเดล AI (LLMs, Workflows, Data Masking) เพื่อลดชั่วโมงการทำงานของฝ่ายบัญชี จัดซื้อ โรงงาน ตามกรอบ WI-PI-AI-001

สิ่งที่ต้องการให้จัดทำ:
1. โครงสร้าง Job Description (JD) ที่ทันสมัยและดึงดูดบุคลากรระดับชั้นนำ:
   - Job Purpose & Business Impact
   - Core Responsibilities (แบ่งตามสัดส่วนเวลา 100%)
   - Technical & Behavioral Competencies
   - Key Performance Indicators (KPIs / OKRs) สำหรับ 90 วันแรกและ 1 ปีแรก
2. ชุดคำถามสัมภาษณ์แบบโครงสร้าง (Structured Behavioral Interview Guide) ตามกรอบ 3Ts:
   - Talent: คำถามวัดขีดความสามารถเชิงลึกทางเทคนิค สถาปัตยกรรม AI และการแก้ปัญหาเฉพาะหน้า
   - Task: คำถามวัดการบริหารจัดการโครงการ การลำดับความสำคัญ และการส่งมอบงานภายใต้แรงกดดัน
   - Team Fit: คำถามวัดวัฒนธรรมการทำงาน การสื่อสารกับแผนกที่ไม่ใช่สายเทคนิค (Non-tech Stakeholders) และความยืดหยุ่น
3. เกณฑ์การให้คะแนน (Scoring Rubric 1 - 5) พร้อมตัวบ่งชี้พฤติกรรมคำตอบ (Behavioral Anchored Rating Scales - BARS) ที่แยกความแตกต่างระหว่างผู้สมัครระดับปานกลางและระดับยอดเยี่ยม`,
    evaluationRubric: [
      'จัดทำ Job Description ได้เป็นมืออาชีพ มีความชัดเจนในบทบาทและมี KPI ที่วัดผลเชิงปริมาณได้จริง',
      'ออกแบบคำถามครบถ้วนทั้ง 3 มิติ (Talent, Task, Team Fit) โดยใช้เทคนิค STAR Method',
      'มี Scoring Rubric (BARS) ที่มีตัวอย่างพฤติกรรมชัดเจน ช่วยให้กรรมการสัมภาษณ์ให้คะแนนได้อย่างเที่ยงธรรม',
      'สำนวนภาษาไทยและอังกฤษสละสลวย เข้ากับบริบทการจ้างงานสายเทคโนโลยีในองค์กรชั้นนำ',
    ],
  },

  // 5. เทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล (Digital Innovation IT)
  {
    id: 'task-it-001',
    deptId: 'digital_innovation_it',
    deptName: 'ฝ่ายเทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล',
    category: 'it',
    title: 'วิเคราะห์สถาปัตยกรรม Microservices และหาช่องโหว่ SQL Injection / API Security',
    description: 'ตรวจสอบโค้ด API Endpoint ภาษา TypeScript/Node.js ชี้จุดเกิดช่องโหว่ความปลอดภัย และเขียนโค้ดแก้ไขให้ปลอดภัยตาม OWASP',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือ Principal Software Architect & Application Security Lead ของบริษัท กรุณาตรวจสอบโค้ด API Handler และสถาปัตยกรรมระบบต่อไปนี้:

บริบทของโค้ด:
ทีมพัฒนาได้ส่ง Pull Request สำหรับ API endpoint ที่ใช้ในการค้นหาและส่งออกรายงานการเงิน/จัดซื้อ ดังนี้:

\`\`\`typescript
import { Request, Response } from 'express';
import { dbPool } from '../database';

export async function getDepartmentTransactions(req: Request, res: Response) {
  try {
    const { deptId, startDate, endDate, minAmount, sortBy, sortOrder } = req.query;
    
    // ตรวจสอบ JWT Token เบื้องต้น
    const userRole = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    // สร้าง Dynamic Query
    let query = \`SELECT t.id, t.transaction_date, t.vendor_name, t.amount, t.description, d.dept_name 
                 FROM transactions t 
                 JOIN departments d ON t.dept_id = d.id 
                 WHERE t.dept_id = '\${deptId}'\`;

    if (startDate && endDate) {
      query += \` AND t.transaction_date BETWEEN '\${startDate}' AND '\${endDate}'\`;
    }

    if (minAmount) {
      query += \` AND t.amount >= \${minAmount}\`;
    }

    // Dynamic Ordering
    const orderColumn = sortBy ? String(sortBy) : 'transaction_date';
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
    query += \` ORDER BY \${orderColumn} \${direction} LIMIT 100\`;

    const [rows] = await dbPool.query(query);
    return res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', debugMessage: error.message, stack: error.stack });
  }
}
\`\`\`

สิ่งที่ต้องการให้ส่งมอบ:
1. การวิเคราะห์ช่องโหว่ความปลอดภัยอย่างละเอียด (Vulnerability Assessment):
   - ชี้จุดที่เกิด SQL Injection พร้อมแสดง Payload ตัวอย่างที่ผู้โจมตีสามารถขโมยข้อมูล (Data Exfiltration) หรือทำ Privilege Escalation
   - ชี้จุดบกพร่องด้าน Information Disclosure (การรั่วไหลของ Stack Trace)
   - ชี้จุดบกพร่องด้าน Broken Object Level Authorization (BOLA) และ Type Safety
2. เขียนโค้ดปรับปรุงใหม่ฉบับสมบูรณ์ (Production-ready TypeScript):
   - ใช้ Parameterized Query / Prepared Statements หรือ Query Builder อย่างปลอดภัย 100%
   - นำ Zod Schema Validation มาใช้ตรวจทาน Input Parameters อย่างเข้มงวด
   - Whitelist คอลัมน์ที่อนุญาตให้ Order By ได้อย่างปลอดภัย
   - ปิดช่องโหว่ Error Leakage และทำ Strict Typing ไร้ \`any\`
3. ข้อเสนอแนะเชิงสถาปัตยกรรมในการป้องกันระดับ Infrastructure (WAF, Rate Limiting, Connection Pooling)`,
    evaluationRubric: [
      'ระบุจุดเกิด SQL Injection ทั้งใน Where Clause และ Order By Clause ได้อย่างถูกต้องครบถ้วน',
      'เขียนโค้ดแก้ไขด้วย TypeScript ที่ปลอดภัย 100% โดยใช้ Parameterized Query และ Zod Validation',
      'กำจัดการใช้ any ทั้งหมด และจัดการ Error Handling ไม่ให้หลุด Stack Trace สู่ผู้ใช้ภายนอก',
      'เสนอแนะแนวทางป้องกันเชิงลึก (Defense in Depth) ในระดับสถาปัตยกรรม Microservices ได้อย่างมีน้ำหนัก',
    ],
  },

  // 6. ปรับปรุงกระบวนการและตรวจสอบภายใน (Process Improvement & Internal Audit)
  {
    id: 'task-audit-001',
    deptId: 'process_improvement_audit',
    deptName: 'ฝ่ายปรับปรุงกระบวนการและตรวจสอบภายใน',
    category: 'audit',
    title: 'วิเคราะห์ช่องโหว่การควบคุมภายในกระบวนการจัดซื้อตามกรอบ COSO Framework',
    description: 'จัดทำตาราง Risk and Control Matrix (RACM) และสืบสวนประเด็นความเสี่ยงเรื่อง Split Purchase Orders และ Segregation of Duties',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือผู้จัดการฝ่ายตรวจสอบภายในและพัฒนากระบวนการ (Internal Audit & PI Manager) ได้รับมอบหมายให้เข้าตรวจประเมินกระบวนการจัดซื้อจัดจ้าง (Procure-to-Pay Cycle) ของโรงงานในเครือ:

ข้อมูลจากการสุ่มตรวจ Audit Sample:
1. พบรายการออกใบสั่งซื้อ (PO) ให้กับ Vendor รายเดิมจำนวน 4 ใบ ในวันเดียวกัน ใบละ 480,000 บาท รวมเป็นเงิน 1,920,000 บาท
   (ระเบียบบริษัทระบุว่า: ยอดจัดซื้อไม่เกิน 500,000 บาท ผู้จัดการฝ่ายโรงงานมีอำนาจอนุมัติได้เอง หากเกิน 500,000 บาท ต้องเสนอขออนุมัติจากรองกรรมการผู้จัดการ)
2. สินค้าที่สั่งซื้อเป็นอุปกรณ์ระบบท่อและวาล์ว พบว่าผู้ร้องขอ (Requester) และผู้ตรวจรับสินค้าลงนามตรวจรับในระบบ ERP คือบุคคลคนเดียวกัน
3. ไม่มีเอกสารเปรียบเทียบราคา 3 ราย (Quotation Comparison Sheet) แนบในระบบ โดยให้เหตุผลว่าเป็น "อะไหล่ฉุกเฉินเฉพาะทาง (Emergency Single Source)"
4. บันทึกบัญชีเจ้าหนี้การค้าตั้งยอดตามใบแจ้งหนี้ แต่ไม่มีการตรวจสอบ 3-Way Matching เทียบกับใบรับสินค้าตัวจริงที่มีลายเซ็นฝ่ายสโตร์

สิ่งที่ต้องการให้จัดทำ:
1. การระบุความเสี่ยงและประเด็นข้อสังเกตการตรวจสอบ (Audit Findings & Root Cause Analysis) ตามหลักการควบคุมภายใน COSO:
   - การแตกใบสั่งซื้อเพื่อหลีกเลี่ยงอำนาจอนุมัติ (Split PO / Smurfing)
   - การขาดการแบ่งแยกหน้าที่ที่เหมาะสม (Lack of Segregation of Duties - SOD)
   - ความเสี่ยงต่อการเกิดผลประโยชน์ทับซ้อนและการทุจริต (Conflict of Interest & Fraud Exposure)
2. ตาราง Risk and Control Matrix (RACM) ครอบคลุม:
   - Sub-Process
   - Risk Description
   - Control Objective
   - Key Control Activity (Preventive / Detective)
   - Audit Test Procedure
3. แผนปฏิบัติการแก้ไขและป้องกัน (Corrective and Preventive Action Plan - CAPA) พร้อมระบุ Target Timeline, Responsible Unit และกลไก Automated ERP Controls`,
    evaluationRubric: [
      'ตรวจจับและอธิบายรูปแบบการหลีกเลี่ยงอำนาจอนุมัติ (Structuring / Split PO) ได้ชัดเจนตรงประเด็น',
      'นำกรอบ COSO Internal Control Framework มาประยุกต์ใช้อย่างถูกต้องในมิติ Control Activities และ Monitoring',
      'สร้างตาราง RACM ที่มีรายละเอียดระดับปฏิบัติการ และแยก Preventive vs Detective Controls ชัดเจน',
      'เสนอมาตรการควบคุมเชิงเทคนิคบน ERP (เช่น System Hard-Stop, 3-Way Matching Enforce) ที่ใช้แก้ปัญหาได้ถาวร',
    ],
  },

  // 7. พัฒนาธุรกิจและการตลาด (Business Development & Commercial)
  {
    id: 'task-bd-001',
    deptId: 'business_development_commercial',
    deptName: 'ฝ่ายพัฒนาธุรกิจและการตลาด',
    category: 'marketing',
    title: 'วางแผนกลยุทธ์ Go-to-Market และแคมเปญกระตุ้นยอดขายอุตสาหกรรม B2B',
    description: 'จัดทำแผนกลยุทธ์เชิงพาณิชย์สำหรับโครงการพัฒนา Solar Rooftop & Smart Energy Solutions เจาะกลุ่มโรงงานในนิคมอุตสาหกรรม',
    difficulty: 'standard',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือรองผู้อำนวยการฝ่ายพัฒนาธุรกิจและการตลาดเชิงพาณิชย์ (VP of Business Development & Commercial) ของกลุ่มบริษัท กรุณาจัดทำแผนกลยุทธ์ Go-to-Market (GTM Plan) สำหรับบริการใหม่:

ข้อเสนอทางธุรกิจใหม่: "Industrial Clean Energy as a Service (Private PPA Solar Rooftop & Battery Energy Storage)"
กลุ่มเป้าหมายหลัก: โรงงานอุตสาหกรรมขนาดกลางและขนาดใหญ่ในพื้นที่นิคมอุตสาหกรรม 304 และระเบียงเศรษฐกิจภาคตะวันออก (EEC)
จุดขายหลัก:
- ลูกค้าไม่ต้องลงทุน Capex เริ่มต้น บริษัทฯ เป็นผู้ลงทุน ติดตั้ง และดูแลรักษาระบบให้ทั้งหมด 100%
- รับประกันส่วนลดค่าไฟฟ้าจากอัตราปกติของ กฟภ. ขั้นต่ำ 15-20% ตลอดอายุสัญญา 15-20 ปี
- ช่วยตอบโจทย์ข้อกำหนดลดการปล่อยก๊าซเรือนกระจก (RE100 / CBAM / ESG Mandate) ของโรงงานส่งออก

สิ่งที่ต้องการให้ส่งมอบในแผน GTM:
1. การวิเคราะห์กลุ่มเป้าหมาย (Customer Segmentation & ICP - Ideal Customer Profile):
   - แยกตามประเภทอุตสาหกรรมที่ใช้ไฟฟ้าสูงช่วงกลางวัน (เช่น อิเล็กทรอนิกส์, ชิ้นส่วนยานยนต์, พลาสติก)
   - ระบุผู้มีอำนาจตัดสินใจ (Decision-Making Unit: CFO, Plant Director, ESG Officer)
2. Value Proposition Canvas & Messaging Framework:
   - การสื่อสารประโยชน์ด้านการลดต้นทุน (Cost Saving) ควบคู่กับประโยชน์ด้านภาษี BOI และการลดคาร์บอน
   - การจัดการข้อโต้แย้งหลัก (Objection Handling: ความเสี่ยงหลังคารั่ว, อายุสัญญาผูกพันยาวนาน)
3. ขั้นตอนการขายระดับองค์กร (Enterprise B2B Sales Pipeline & Outreach Cadence):
   - Stage 1: Lead Identification & Pre-qualification (ใช้โดรน/ดาวเทียมสำรวจพื้นที่หลังคา)
   - Stage 2: Technical Energy Audit & Preliminary Feasibility Proposal
   - Stage 3: Term Sheet & Executive Pitch Presentation
   - Stage 4: Contract Negotiation & Closing
4. แคมเปญการตลาดและตัวชี้วัดความสำเร็จ (GTM Campaign & Metrics):
   - การจัด Exclusive Executive Luncheon และความร่วมมือกับสภาอุตสาหกรรม
   - เป้าหมายทางการเงิน: Pipeline Value, Deal Velocity, และ Customer Acquisition Cost (CAC) vs Lifetime Value (LTV)`,
    evaluationRubric: [
      'เข้าใจพลวัตตลาดอุตสาหกรรม B2B ในไทย และประเด็น ESG/CBAM/RE100 ที่สร้างความต้องการซื้อจริง',
      'ออกแบบ Value Proposition และบทสนทนาขจัดข้อโต้แย้ง (Objection Handling) ได้อย่างน่าเชื่อถือ',
      'วางกระบวนการ Enterprise Sales Funnel ได้เป็นลำดับขั้นตอน สมจริงกับการขายลูกค้าระดับบรรษัท',
      'กำหนดตัวชี้วัดเชิงปริมาณ (CAC, LTV, Close Rate, Pipeline Volume) ที่สอดคล้องกับธรรมชาติของธุรกิจ',
    ],
  },

  // 8. วิศวกรรมและปฏิบัติการโรงงาน / จป. (Plant Operations & Safety / SHO)
  {
    id: 'task-plant-001',
    deptId: 'plant_operations_safety',
    deptName: 'ฝ่ายวิศวกรรมและปฏิบัติการโรงงาน',
    category: 'plant',
    title: 'ร่างรายงานสอบสวนอุบัติเหตุ (Incident Investigation Report) ตามหลัก 5-Whys และ Fishbone',
    description: 'วิเคราะห์อุบัติการณ์สารเคมีรั่วไหลในกะดึก สืบสวนหา Root Cause ตามมาตรฐาน ISO 45001 และจัดทำแผน CAPA',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'flagship_heavy',
    prompt: `คุณคือผู้จัดการฝ่ายความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม (EHS Manager / เจ้าหน้าที่ความปลอดภัยระดับวิชาชีพ - จป.วิชาชีพ) กรุณาจัดทำรายงานการสอบสวนอุบัติการณ์ (Incident Investigation Report):

รายละเอียดเหตุการณ์ (Incident Narrative):
- วันที่และเวลาเกิดเหตุ: เมื่อคืนที่ผ่านมา เวลา 02:45 น. (กะดึก) บริเวณหน่วยถ่ายโอนสารเคมี (Chemical Unloading Station No. 2)
- พนักงานผู้ประสบเหตุ: นายสมบูรณ์ (ช่างซ่อมบำรุงกะดึก อายุงาน 6 เดือน) ได้รับบาดเจ็บสารเคมีกรดไฮโดรคลอริกเจือจาง (HCl 15%) กระเซ็นถูกบริเวณแขนขวาและหน้าอก เกิดแผลไหม้ระดับที่ 1 (First-degree chemical burn) ปฐมพยาบาลล้างน้ำฉุกเฉินและส่งโรงพยาบาล
- สถานการณ์ขณะเกิดเหตุ: ปั๊มถ่ายโอนสารเคมีเกิดอาการแรงดันตก ช่างซ่อมบำรุงจึงเข้าทำการปลดข้อต่อ Flange ท่อส่งสารเคมีเพื่อตรวจสอบการอุดตัน โดยไม่ได้ทำการตัดแยกพลังงานและระบายแรงดันตกค้าง (Lockout/Tagout - LOTO) ในระบบ
- สภาพแวดล้อม: แสงสว่างบริเวณหน้างานหลอดไฟขาด 1 ดวง ช่างสวมถุงมือยางธรรมดา แต่ไม่ได้สวม Face Shield และชุดกันสารเคมีเต็มตัว (Chemical Apron) โดยให้การว่า "ต้องการรีบซ่อมแซมให้เสร็จเพราะโรงงานกำลังจะเริ่มกะเช้า และชุดป้องกันสารเคมีถูกเก็บไว้ในตู้ล็อกเกอร์ที่อยู่อีกอาคารหนึ่ง"

สิ่งที่ต้องการให้จัดทำ:
1. การจัดทำแบบฟอร์มรายงานการสอบสวนอุบัติเหตุอย่างเป็นทางการตามข้อกำหนดกระทรวงแรงงานและ ISO 45001
2. การวิเคราะห์สาเหตุรากเหง้าด้วยเทคนิค 5-Whys Analysis (เจาะลึกทั้งด้านพฤติกรรม ระบบงาน และการจัดการ)
3. การสังเคราะห์ผังสาเหตุและผล (Fishbone / Ishikawa Diagram) จำแนก 4M1E:
   - Man (คน/ทักษะ)
   - Machine / Equipment (เครื่องจักร/เครื่องมือ)
   - Method (วิธีการ/ระเบียบ SOP/LOTO)
   - Material (สารเคมี/อุปกรณ์ PPE)
   - Environment (สภาพแวดล้อม/แสงสว่าง/ความกดดันด้านเวลา)
4. แผนปฏิบัติการแก้ไขและป้องกัน (Corrective and Preventive Actions - CAPA) โดยเรียงลำดับตามลำดับขั้นการควบคุมความเสี่ยง (Hierarchy of Controls: Elimination, Substitution, Engineering Controls, Administrative Controls, PPE)`,
    evaluationRubric: [
      'จัดทำโครงสร้างรายงานอุบัติเหตุได้ครบถ้วนตามหลักการของ จป.วิชาชีพ และมาตรฐาน ISO 45001',
      'วิเคราะห์ 5-Whys ได้ลึกซึ้ง ไม่หยุดแค่การกล่าวโทษพนักงาน (Human Error) แต่มองทะลุถึงปัญหาเชิงระบบ',
      'แยกองค์ประกอบ 4M1E ใน Fishbone Diagram ได้อย่างครอบคลุมทุกมิติ',
      'จัดหมวดหมู่มาตรการแก้ไขตาม Hierarchy of Controls โดยเน้น Engineering และ Administrative Controls มากกว่าแค่การแจก PPE',
    ],
  },

  // 9. บัญชีและการเงิน (Accounting & Treasury - Cash Flow Forecasting)
  {
    id: 'task-acc-002',
    deptId: 'accounting_finance',
    deptName: 'ฝ่ายบัญชีและการเงิน',
    category: 'accounting',
    title: 'วิเคราะห์กระแสเงินสดและแบบจำลอง Debt Service Coverage Ratio (DSCR Covenant)',
    description: 'จัดทำแบบจำลองคาดการณ์สภาพคล่องทางการเงิน ทดสอบ Financial Covenants เทียบกับเงื่อนไขสัญญาสินเชื่อธนาคาร',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'math_reasoning',
    prompt: `คุณคือผู้จัดการฝ่ายบริหารเงินและโครงสร้างทุน (Treasury & Corporate Finance Manager) ของกลุ่มบริษัท กรุณาช่วยวิเคราะห์สภาพคล่องทางการเงินและตรวจสอบเงื่อนไขสัญญาเงินกู้ (Loan Covenants):

ข้อมูลการดำเนินงานไตรมาสถัดไป (Projected Next Quarter):
- ประมาณการรายได้จากการดำเนินงาน: 240 ล้านบาท
- ประมาณการต้นทุนผันแปร (Variable Cash Costs): 60% ของรายได้
- ต้นทุนคงที่ที่เป็นเงินสด (Fixed Cash Operating Expenses): 45 ล้านบาท
- ค่าเสื่อมราคาและค่าตัดจำหน่าย (Non-cash Depreciation & Amortization): 22 ล้านบาท
- ดอกเบี้ยจ่ายตามสัญญากู้ยืม: 8.5 ล้านบาท
- เงินต้นเงินกู้ยืมระยะยาวที่ถึงกำหนดชำระในงวด: 18.0 ล้านบาท
- งบลงทุนซ่อมบำรุงที่จำเป็น (Maintenance CAPEX): 12 ล้านบาท
- ประมาณการภาษีเงินได้นิติบุคคลจ่าย: 4.5 ล้านบาท

เงื่อนไข Covenants ตามสัญญาสินเชื่อกับสถาบันการเงิน:
1. Debt Service Coverage Ratio (DSCR) ต้องไม่ต่ำกว่า 1.25 เท่า
   (สูตร: DSCR = [EBITDA - Maintenance CAPEX - Cash Taxes] / [Debt Service: Principal + Interest])
2. Interest Coverage Ratio (ICR) ต้องไม่ต่ำกว่า 3.0 เท่า
   (สูตร: ICR = EBITDA / Interest Expense)

สิ่งที่ต้องการให้ส่งมอบ:
1. ตารางแสดงการคำนวณ EBITDA, Free Cash Flow to Firm (FCFF) และการชำระหนี้สินอย่างเป็นระบบ
2. การคำนวณอัตราส่วน DSCR และ ICR เทียบกับเกณฑ์ของสถาบันการเงิน พร้อมระบุสถานะว่าผ่านเกณฑ์หรือสุ่มเสี่ยงผิดนัดชำระทางเทคนิค (Technical Default)
3. การทดสอบความอ่อนไหว (Sensitivity Analysis): หากรายได้ลดลง 10% หรือ 20% เนื่องจากสภาวะเศรษฐกิจ อัตราส่วน DSCR จะเปลี่ยนแปลงเป็นเท่าใด และรายได้ต่ำสุดที่บริษัทยังรักษาระดับ DSCR ที่ 1.25 เท่าได้คือเท่าใด
4. มาตรการเชิงรุกของฝ่ายบริหารเงินในการบริหาร Working Capital เพื่อรักษาสภาพคล่อง`,
    evaluationRubric: [
      'คำนวณ EBITDA, DSCR และ Interest Coverage Ratio ได้ถูกต้องตรงตามสูตรทางการเงินที่ระบุ',
      'ทำ Sensitivity Analysis ได้แม่นยำ พร้อมระบุ Break-even Revenue ที่รักษา Covenant ได้อย่างชัดเจน',
      'ประเมินความเสี่ยงต่อสัญญากู้ยืมและชี้ประเด็นผลกระทบทางการเงินได้อย่างมืออาชีพ',
      'เสนอแนะแนวทางการบริหาร Working Capital (AR/AP/Inventory) ที่เป็นรูปธรรม',
    ],
  },

  // 10. วิศวกรรมโรงงาน (Plant Ops - Predictive Maintenance Telemetry)
  {
    id: 'task-plant-002',
    deptId: 'plant_operations_safety',
    deptName: 'ฝ่ายวิศวกรรมและปฏิบัติการโรงงาน',
    category: 'plant',
    title: 'วิเคราะห์ข้อมูลการสั่นสะเทือนมอเตอร์ (Vibration FFT) และแผนซ่อมบำรุงเชิงคาดการณ์',
    description: 'วินิจฉัยความผิดปกติของมอเตอร์ปั๊มน้ำหล่อเย็นขนาด 250 kW จากข้อมูลคลื่นความถี่การสั่นสะเทือนตามมาตรฐาน ISO 10816-3',
    difficulty: 'high_reasoning',
    suggestedArenaPreset: 'math_reasoning',
    prompt: `คุณคือวิศวกรซ่อมบำรุงและผู้เชี่ยวชาญการวิเคราะห์การสั่นสะเทือน (Reliability & Vibration Analyst Level II) ของโรงงาน กรุณาวิเคราะห์ข้อมูลการตรวจวัดการสั่นสะเทือน (Vibration Analysis) ของมอเตอร์ขับปั๊มน้ำหล่อเย็นหลัก (Primary Cooling Water Pump Motor 250 kW, 1,485 RPM):

ข้อมูลจากการตรวจวัดด้วยเครื่องวิเคราะห์การสั่นสะเทือน (Vibration Spectrum Data):
- ความเร็วรอบมอเตอร์ (1X Running Speed): 24.75 Hz (1,485 RPM)
- ค่ารวมความเร็วการสั่นสะเทือน (Overall Velocity RMS): 7.8 mm/s ในแนวรัศมี (Radial Direction) เทียบกับ Baseline ปกติที่ 2.1 mm/s
- ตามมาตรฐาน ISO 10816-3 (Group 1: Large machines on flexible foundation):
  - Zone A (Good): < 2.3 mm/s
  - Zone B (Satisfactory): 2.3 - 4.5 mm/s
  - Zone C (Unsatisfactory / Alert): 4.5 - 7.1 mm/s
  - Zone D (Unacceptable / Danger): > 7.1 mm/s
- ข้อมูล FFT Spectrum แสดงยอดคลื่นความถี่เด่น (Dominant Peaks):
  - Peak ที่ 1X (24.75 Hz): แอมพลิจูด 1.8 mm/s
  - Peak ที่ 2X (49.50 Hz): แอมพลิจูด 5.2 mm/s (สูงเด่นมาก พร้อม 180° Phase Difference ข้าม Flange Coupling)
  - ความถี่สูง (High Frequency Spectrum > 1,500 Hz): ไม่พบความถี่ข้อบกพร่องของตลับลูกปืน (BPFO, BPFI)

สิ่งที่ต้องการให้วิเคราะห์และส่งมอบ:
1. การวินิจฉัยประเภทของความผิดปกติ (Fault Diagnosis):
   - วิเคราะห์เปรียบเทียบระหว่าง Mechanical Unbalance, Shaft Misalignment (Angular vs Parallel), และ Bearing Defect
   - ระบุสาเหตุที่มีความเป็นไปได้สูงสุดพร้อมหลักฐานสนับสนุนจากข้อมูล Peak และ Phase Difference
2. การประเมินระดับความรุนแรงตามมาตรฐาน ISO 10816-3 และผลกระทบหากปล่อยให้เครื่องจักรทำงานต่อไป
3. แผนการแก้ไขปัญหาเร่งด่วน (Corrective Action Plan):
   - ขั้นตอนการตรวจเช็กหน้างาน (Laser Alignment, Soft Foot Check, Pipe Strain Inspection)
   - กรอบเวลาที่ต้องหยุดเครื่องซ่อมบำรุง และเกณฑ์การยอมรับหลังการปรับแต่ง (Acceptance Criteria)`,
    evaluationRubric: [
      'วินิจฉัยความผิดปกติได้ถูกต้องว่าเป็น Shaft Misalignment โดยพิจารณาจาก 2X Harmonic Peak และ Phase Shift',
      'ประเมินระดับความรุนแรงตามเกณฑ์ ISO 10816-3 Zone D (Danger) ได้อย่างถูกต้อง',
      'แยกแยะความแตกต่างระหว่างอาการลูกปืนแตก (Bearing Defect) กับ Misalignment ได้อย่างมีหลักวิชาการ',
      'จัดทำขั้นตอนการแก้ไขเชิงปฏิบัติการ (Laser Alignment, Soft Foot, Thermal Growth) ได้ตามหลักวิศวกรรมสากล',
    ],
  },
];

/**
 * ดึงชุด Task Kit ตามรหัสฝ่าย (Department ID)
 */
export function getTaskKitsByDept(deptId: string): DepartmentTaskKit[] {
  return DEPARTMENT_TASK_KITS.filter((kit) => kit.deptId === deptId);
}

/**
 * ดึงชุด Task Kit ตามหมวดหมู่ (Category)
 */
export function getTaskKitsByCategory(category: DepartmentTaskKit['category']): DepartmentTaskKit[] {
  return DEPARTMENT_TASK_KITS.filter((kit) => kit.category === category);
}

/**
 * ดึงข้อมูล Task Kit เดี่ยวตามรหัส ID
 */
export function getTaskKitById(id: string): DepartmentTaskKit | undefined {
  return DEPARTMENT_TASK_KITS.find((kit) => kit.id === id);
}

/**
 * ดึงชุด Task Kit ตามระดับความยาก (Difficulty)
 */
export function getTaskKitsByDifficulty(difficulty: DepartmentTaskKit['difficulty']): DepartmentTaskKit[] {
  return DEPARTMENT_TASK_KITS.filter((kit) => kit.difficulty === difficulty);
}
