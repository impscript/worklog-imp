นี่คือไฟล์ทั้งหมดที่คุณสามารถคัดลอก (Copy) ไปวางเพื่อใช้งานต่อได้เลยครับ โดยผมได้จัดเตรียมไฟล์ Blueprint Workflow และไฟล์ CSV สำหรับการ Import เข้าไปเป็น Master Data ใน Vibecode (หรือ Database อื่นๆ) ให้เรียบร้อยครับ

---

### 1. ไฟล์ Blueprint Workflow
**ชื่อไฟล์:** `worklog-newgen-workflow.md`

```markdown
# Blueprint Workflow: Worklog NewGen

## 1. Database & Collections (โครงสร้างฐานข้อมูล)
ระบบจะประกอบด้วยตาราง 3 กลุ่มหลัก เพื่อทำ Cascading Dropdown:
1. **Master Collections**: เก็บรายชื่อเพื่อเป็น Dropdown (Holding, Role, Type, Project Name, Module, BU, Department, Action)
2. **Mapping Collections**: 
   - `col_map_user_role`: กำหนดสิทธิ์พนักงาน (User -> Holding -> Role)
   - `col_map_project_structure`: กำหนดโครงสร้างโปรเจกต์ (Holding -> Role -> Type -> Project Name -> Module -> BU -> Department)
3. **Transaction Collection**: `col_worklog` เก็บข้อมูลการบันทึกเวลาทำงาน

## 2. Form Logic & Cascading Dropdowns (หน้าฟอร์มบันทึกงาน)
**Step 1: Initialization**
- `Date`: Default = Today()
- `User Name / Email`: ดึงอัตโนมัติจาก Current User ที่ Login

**Step 2: Cascading Filters (Filter เรียงตามลำดับ)**
1. **Holding**: Filter จาก `col_map_user_role` ที่ผูกกับ User ปัจจุบัน
2. **Role (department_operator)**: Filter จาก `col_map_user_role` ตาม `Holding` ที่เลือก
3. **Project Type**: Filter จาก `col_map_project_structure` ตาม `Holding` และ `Role`
4. **Project Name**: Filter จาก `col_map_project_structure` ตาม `Project Type`
5. **Module**: Filter จาก `col_map_project_structure` ตาม `Project Name`
6. **BU**: Filter จาก `col_map_project_structure` ตาม `Module` (และเงื่อนไขก่อนหน้า)
7. **Department**: Filter จาก `col_map_project_structure` ตาม `BU`
8. **Action Name**: Filter จาก `col_master_action` โดยดึงเฉพาะรายการที่ตรงกับ `Project Type` (เช่น ถ้าเป็น Project ให้แสดงเฉพาะหมวด Project Action)

**Step 3: Time Calculation Logic**
- **Start Time** / **End Time**: ผู้ใช้ระบุเวลา
- **Break Time**: Checkbox "หักพักเที่ยง 1 ชั่วโมง"
- **Total Hours**: ใช้ Formula คำนวณ `(End Time - Start Time) - Break Time` 
- *Validation*: ไม่อนุญาตให้ Submit หาก End Time น้อยกว่า Start Time

**Step 4: Submission**
- ข้อมูลทั้งหมด (รวมถึงช่อง Text `Description` และ Dropdown `Channel`) จะถูกบันทึกลง `col_worklog`
```

---

### 2. ไฟล์ CSV สำหรับ Master Data (กลุ่มพจนานุกรม)
สามารถ Copy ไปเซฟเป็นไฟล์นามสกุล `.csv` แล้ว Import เข้า Vibecode ได้เลยครับ

**ชื่อไฟล์:** `tb_master_holding.csv`
```csv
holding_name
Double A
Real Estate
All Holding
Logistic
Power
```

**ชื่อไฟล์:** `tb_master_role.csv`
```csv
role_name
IT
IMP
IMP&IT
```

**ชื่อไฟล์:** `tb_master_project_type.csv`
```csv
type_name
Management
Project
Support MA
Support Go-Live
Upgrade
```

**ชื่อไฟล์:** `tb_master_action.csv`
*(อ้างอิงจากแหล่งข้อมูล dll_action โดยจัดกลุ่ม Category ให้ง่ายต่อการ Filter)*
```csv
action_category,action_name
Project,User Requirement Gathering
Project,Planning
Project,Report / Dashboard Design
Project,Process Mapping / Optimization
Project,Set template
Project,Data Preparation / Cleansing
Project,System Setup / Configuration
Project,Research/Develop/Implement
Project,Testing / UAT Support
Project,Document work
Project,CRUD Account
Project,CRUD Authorization
Project,Training / Knowledge Transfer / Consult
Project,Issue Resolution / Troubleshooting
Project,Check & Correction
Project,Others
Support,Report / Dashboard Design
Support,Process Mapping / Optimization
Support,Data Preparation / Cleansing
Support,System Setup / Configuration
Support,CRUD Form
Support,CRUD Function
Support,CRUD List
Support,CRUD Master Data
Support,CRUD Record
Support,CRUD Report
Support,CRUD System
Support,Testing / UAT Support
Support,Document work
Support,CRUD Account
Support,CRUD Authorization
Support,Reset password
Support,Training / Knowledge Transfer / Consult
Support,Issue Resolution / Troubleshooting
Support,Check & Correction
Support,Others
Management,Receive Policy
Management,Plan/Strategy/Review/Delegate/Resolve/Coach
```

---

### 3. ไฟล์ CSV สำหรับ Mapping Data (กลุ่มความสัมพันธ์)
กลุ่มนี้จะใช้สำหรับการทำ Filter บนหน้าจอ (Cascading)

**ชื่อไฟล์:** `tb_map_user_role.csv`
*(นำข้อมูลจากชีท user_relation มาใช้ เพื่อระบุว่าใครมีสิทธิ์ใน Holding / Role ไหนบ้าง)*
```csv
Name,Holding,department_operator
Jintana,Double A,IT
Jintana,Real Estate,IMP
Jintana,Real Estate,IMP&IT
Jintana,Double A,IMP&IT
Sutti,Real Estate,IT
Sutti,Double A,IT
Sutti,Logistic,IT
Sutti,Power,IT
Kanokaon,Real Estate,IT
Kanokaon,Double A,IT
Kanokaon,Logistic,IT
Kanokaon,Power,IT
Yawee,Real Estate,IT
Yawee,Double A,IT
Yawee,Logistic,IT
Yawee,Power,IT
Chatchawan,Real Estate,IMP
Chatchawan,Double A,IMP
Chatchawan,Power,IMP
Chatchawan,All Holding,IMP
Ronnachai,Real Estate,IMP
Ronnachai,Double A,IMP
Ronnachai,All Holding,IMP
Weerasak,Double A,IT
Weerasak,Real Estate,IMP
Nakorn,Double A,IT
Mungkung,Real Estate,IT
Mungkung,Double A,IT
Mungkung,Logistic,IT
Mungkung,Power,IT
CRMC,Real Estate,IMP
```

**ชื่อไฟล์:** `tb_map_project_structure.csv`
*(อ้างอิงจาก all_project_relation ที่ Normalization แล้ว - ผมดึงตัวอย่างข้อมูลสำคัญและครอบคลุมทุก Holding/Type มาให้เพื่อให้เทสระบบได้ทันที สามารถนำไฟล์ต้นฉบับไป Import ต่อได้เลยครับ)*
```csv
Holding,department_operator,Project_Type,Project_Name,Module,BU,Department
Real Estate,IT,Management,Policy,,Corporate,IT
Real Estate,IMP,Management,Policy,,Corporate,IMP
Double A,IT,Management,TeamOps,,Corporate,IT
Double A,IT,Project,ERP - Netsuite,Function Readiness - MFG,Production,Book Plant
Double A,IT,Project,ERP - Netsuite,Function Readiness - MRP,Production,Winder
Double A,IT,Project,ERP - Netsuite,Function Readiness - O2C,O2C - Export,Sale
Double A,IT,Project,WMS,Warehouse Double A,Double A,Warehouse
Double A,IMP,Support Go-Live,ERP - Netsuite,Item Master,Master Data,IT
All Holding,IMP,Support MA,Application form - Website,Appscript,Corporate,HR Recruit
Real Estate,IMP,Project,304 CRM,,IP,CRM
Real Estate,IMP,Project,Contractor Grading System (CGS),,Housing,Construction
Real Estate,IMP,Support MA,Daily task project IP,บันทึกการทำงานรปภ,Housing,Juristic
Real Estate,IT,Project,Web Corporate,Audit Management System,Corporate,Internal Audit
Real Estate,IT,Project,Web Operation,ตลาดถนนคนเดิน,Com&Res,Operation
Real Estate,IT,Project,Website Official - Housing,Home Page,Housing,Sale&Marketing
Logistic,IMP,Project,บันทึกมิเตอร์น้ำมัน,,Logistic,CR
Power,IT,Project,Web Operation,แจ้งเตือนต่อใบอนุญาติ NPS,Permit,Legel
Logistic,IT,Project,Web Corporate,Vender Payment,All BU,All Department
```

**คำแนะนำเพิ่มเติมตอน Import เข้า Vibecode:** 
ข้อมูลในไฟล์ `tb_map_project_structure.csv` ช่อง **Module** ที่มีค่าว่าง (เช่น โปรเจกต์ Policy) ตอน Import ให้ตั้งค่าเป็น Blank หรือ "-" เพื่อให้ระบบ Dropdown รู้ว่าสิ้นสุดแล้วและให้ข้ามไปเลือก BU และ Department ได้เลยครับ