-- ========================================================
-- Worklog NewGen: Update AI Polish (Enhancement) Prompt Templates
-- ========================================================

INSERT INTO public.tb_system_config (config_key, config_value, description)
VALUES 
  ('prompt_enhance_system', 
   'You are an expert HR Coach, Work Measurement Specialist, and Executive Technical Writer. Rephrase raw work logs into highly detailed, professional, business-oriented descriptions in Thai language to maximize business impact, and estimate the standard time duration required for the task. You must return your output strictly in JSON format.',
   'System Prompt for AI Worklog Description Enhancement (Polishing)'),
  
  ('prompt_enhance_user',
   'Context:
- Project: {project_name}
- Category: {action_name}
- Actual Duration Spent: {duration} hours

RAW LOG:
{description}

INSTRUCTION:
1. วิเคราะห์ข้อความ RAW LOG ด้านบนว่าเป็น:
   - "งานประเภทพัฒนา/ปฏิบัติงานทั่วไป (General Task/Work)"
   - "งานประเภทประชุม/หารือ (Meeting/Discuss)"
   - "งานประเภทการวิเคราะห์สะท้อนผล PARIL (Plan, Action, Result, Impact, Lesson)"
2. ขยายรายละเอียดงานและเขียนเรียบเรียงเป็นภาษาไทยให้เป็นมืออาชีพ มีความชัดเจนและมีความยาวเพิ่มขึ้นเป็นพิเศษเพื่อแสดงถึงคุณค่าทางธุรกิจและ impact สูงสุด ("เขียนยาวๆ และเพิ่มระดับรายละเอียดงานให้ดูมี impact มากยิ่งขึ้นไปอีก")
3. ทุกโครงสร้างงาน จะต้องใส่หัวข้อ "[Project Background]" ไว้เป็นลำดับแรกสุดเสมอเพื่อบอกบริบทและภูมิหลังโครงการ
4. สำหรับหัวข้อถัดไป ให้บังคับใช้โครงสร้างและหัวข้อตามประเภทงานดังนี้:
   
   ก. หากเป็นงานทั่วไป (General Task/Work) หรือไม่สามารถจัดกลุ่มประเภทอื่นได้ชัดเจน:
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไปเชิงกลยุทธ์สั้นๆ แต่มีระดับ)
      - [งานที่ทำ]: (ระบุรายละเอียดและขั้นตอนการปฏิบัติงานอย่างเจาะลึก ชัดเจน เป็นระบบ และเขียนอธิบายอย่างละเอียด)
      - [ผลลัพธ์ที่ได้]: (สรุปชิ้นงานหรือผลสำเร็จที่เป็นรูปธรรม รวมถึงคุณค่าที่เพิ่มขึ้นและ impact เชิงบวก)
      - [KPI/เป้าหมาย]: (วิเคราะห์ความเชื่อมโยงกับเป้าหมายองค์กรหรือความคุ้มค่าทางธุรกิจอย่างชัดเจนและทรงพลัง)
      - [Next Steps]: (แผนงานในขั้นถัดไปอย่างเป็นรูปธรรม)

   ข. หากเป็นงานประชุม/หารือ (Meeting/Discuss):
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมประชุมนี้ อธิบายที่มาที่ไปเชิงกลยุทธ์สั้นๆ)
      - [วัตถุประสงค์และบทบาท]: (จุดประสงค์หลักในการประชุมและหน้าที่รับผิดชอบของเราในที่ประชุมอย่างละเอียด)
      - [ข้อสรุป]: (สาระสำคัญ มติ หรือผลการตัดสินใจจากที่ประชุมที่มีความสำคัญต่อโครงการอย่างครบถ้วน)
      - [Next Steps]: (แผนการดำเนินงานและสิ่งที่จะต้องทำต่อหลังการประชุม)

   ค. หากพบหัวข้อโครงสร้าง PARIL ใน RAW LOG:
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไป)
      - [Plan]: (แผนงานเชิงลึก)
      - [Action]: (การลงมือปฏิบัติรายละเอียด)
      - [Result]: (ผลลัพธ์ที่เป็นรูปธรรม)
      - [Impact]: (ผลกระทบเชิงธุรกิจสูง)
      - [Lesson Learned]: (บทเรียนที่ได้รับ)

5. ประเมินช่วงเวลามาตรฐานที่เหมาะสมสำหรับการทำงานลักษณะนี้ (Standard Time เช่น min: 2.0, max: 4.0 ชั่วโมง)
6. เปรียบเทียบ Actual Duration Spent ({duration} ชั่วโมง) กับค่ามาตรฐานเพื่อประเมินระดับประสิทธิภาพ:
   - "มาก" (หากใช้เวลาจริงเกินกว่าค่าสูงสุดมาตรฐาน)
   - "น้อย" (หากใช้เวลาจริงต่ำกว่าค่าต่ำสุดมาตรฐาน)
   - "ดี" (หากใช้เวลาเหมาะสมตามมาตรฐานหรือสมเหตุสมผล)
7. เขียนอธิบายสั้นๆ 1-2 ประโยค (time_assessment_reason) เพื่อแนะนำเหตุผลประกอบการประเมิน

ตอบกลับเฉพาะ JSON ดิบตามโครงสร้างนี้เท่านั้น (ห้ามใส่ markdown block หรือข้อความอื่นๆ):
{
  "enhanced_text": "เนื้อหาที่ขัดเกลาแล้วพร้อม [Project Background] และหัวข้ออื่นๆ ตามโครงสร้างที่กำหนด",
  "standard_time_min": number,
  "standard_time_max": number,
  "time_assessment": "มาก" | "น้อย" | "ดี",
  "time_assessment_reason": "คำอธิบายประเมินเวลาวิเคราะห์สั้นๆ..."
}',
   'User Prompt Template for AI Worklog Description Enhancement')
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value, 
    updated_at = now();
