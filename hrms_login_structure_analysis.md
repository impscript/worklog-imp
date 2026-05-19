# Analysis of HRMS Login Integration Structure

เอกสารฉบับนี้วิเคราะห์โครงสร้างระบบ Login ที่เชื่อมต่อกับ HRMS (IDMS) ของ Advance Agro เพื่อนำไปประยุกต์ใช้กับโปรเจคใหม่ โดยเน้นที่การยืนยันตัวตนผ่านส่วนกลางและการจัดการฐานข้อมูลภายในแบบ Auto-Provisioning

## 1. การเชื่อมต่อ Endpoint (IDMS Authentication)

ระบบใช้ Endpoint ของ IDMS ในการเช็คสิทธิ์ผู้ใช้งาน โดยมีรายละเอียดดังนี้:

- **URL:** `https://mobiledev.advanceagro.net/ws/api/idms/authentication/`
- **Method:** `GET`
- **Parameters:**
  - `account`: ชื่อผู้ใช้งาน HRMS (Username)
  - `password`: รหัสผ่านที่ผ่านการเข้ารหัส **MD5**
  - `Service`: `0000` (ค่าคงที่)
  - `AgentId`: `SystemMango` (ค่าคงที่สำหรับแอปพลิเคชันนี้)
  - `AgentCode`: `Np4kfRh5` (รหัสยืนยันตัวตนของแอปพลิเคชัน)

### ตัวอย่างการประกอบ URL:
```text
https://mobiledev.advanceagro.net/ws/api/idms/authentication/?account=USER_NAME&password=MD5_PASSWORD&Service=0000&AgentId=SystemMango&AgentCode=Np4kfRh5
```

---

## 2. การเข้ารหัส (MD5 Encryption)

รหัสผ่านที่ส่งไปยัง IDMS **ต้อง** ถูกแปลงเป็น MD5 Hash ก่อนเสมอ 
- ใช้ Library: `js-md5` หรือ `crypto-js`
- ตัวอย่างโค้ด: `const hashedPassword = md5(rawPassword);`

---

## 3. การดึงข้อมูลรายละเอียดพนักงาน (Employee Profile)

หลังจากที่ Login สำเร็จและได้รับ `EmpId` มาแล้ว หากในฐานข้อมูลยังไม่มีข้อมูลพนักงานคนนี้ ระบบควรไปดึงข้อมูลรายละเอียดเพิ่มเติมเพื่อนำมาบันทึก (หรือให้ผู้ใช้ตรวจสอบก่อนกดยืนยัน) โดยใช้ Endpoint ดังนี้:

- **URL:** `https://api-idms.advanceagro.net/hrms/employee/[EmpId]`
- **Method:** `GET`

### ตัวอย่าง JSON ที่ได้รับ:
```json
{
  "status": "success",
  "message": "ok",
  "data": {
    "employee": {
      "ID_Emp": "10005208",
      "EmpName": "ชัชวาลย์ ตุลาผล",
      "CompanyName": "บริษัท ไอพี 5 จำกัด",
      "Department": "Improvement",
      "Position": "Operation Process Improvement Section Manager",
      "EMail": "chatchawan_tu@mibholding.com",
      "Sim_Number": "0858353379"
    }
  }
}
```

### การ Mapping ข้อมูลลง Database:
| API Field | Database Field | คำอธิบาย |
| :--- | :--- | :--- |
| `ID_Emp` | `emp_id` | รหัสพนักงาน |
| `EmpName` | `full_name` | ชื่อ-นามสกุล |
| `EMail` | `email` | อีเมลพนักงาน |
| `Sim_Number` | `phone` | เบอร์โทรศัพท์ |
| `Position` | `position` | ตำแหน่งงาน |
| `Department` | `department` | แผนก/ฝ่าย |

---

## 4. การดึงรูปภาพประจำตัวพนักงาน (Face Image / Profile Avatar)

ระบบดึงรูปภาพใบหน้าของพนักงานโดยตรงจาก URL ส่วนกลางดังนี้:

- **URL:** `https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=[EmpId]`
- **Method:** `GET`

---

## 5. Workflow สำหรับโปรเจคใหม่ (Login + Auto Profile Fetch)

ระบบจะทำงานร่วมกันระหว่าง API ทั้ง 3 ตัว เพื่อให้ผู้ใช้งานไม่ต้องกรอกข้อมูลเองทั้งหมด:

```mermaid
sequenceDiagram
    participant User as ผู้ใช้งาน
    participant App as Frontend (React)
    participant Proxy as API Proxy (Vite / Serverless)
    participant IDMS as IDMS Auth API
    participant HRMS as HRMS Employee API
    participant DB as Local Database (Supabase)

    User->>App: 1. กรอก Username/Password
    App->>Proxy: ส่งรหัสที่เข้ารหัส MD5
    Proxy->>IDMS: เรียก Auth API (/api/idms/...)
    IDMS-->>Proxy: ตอบกลับ (Result: OK, EmpId: 10005208)
    Proxy-->>App: ส่งผลลัพธ์พร้อม EmpId
    
    App->>DB: 2. เช็คในตาราง users ว่ามี EmpId นี้หรือยัง?
    DB-->>App: (ไม่พบข้อมูล)

    App->>Proxy: 3. ขอข้อมูลพนักงานเพิ่มเติม (EmpId: 10005208)
    Proxy->>HRMS: เรียก Employee Profile API (/api/hrms/...)
    HRMS-->>Proxy: ตอบกลับข้อมูล (ชื่อ, ตำแหน่ง, เบอร์โทร)
    Proxy-->>App: ส่งข้อมูลพนักงานกลับ

    App->>User: 4. แสดงหน้า "Confirm Profile" (พรีভিউข้อมูล + รูปใบหน้า)
    User->>App: ตรวจสอบและกดยืนยัน
    
    App->>DB: 5. INSERT ข้อมูลลงตาราง users (Status: 'Active')
    DB-->>App: บันทึกสำเร็จ
    
    App->>User: 6. เข้าสู่ระบบสำเร็จ (Dashboard)
```

## 6. การกำหนดค่าในโปรเจค

### การเชื่อมต่อ Local Vite Proxy (`vite.config.ts`):
```typescript
server: {
  proxy: {
    '/api/idms': {
      target: 'http://mobiledev.advanceagro.net',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/idms/, '/ws/api/idms')
    },
    '/api/hrms': {
      target: 'http://api-idms.advanceagro.net',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/hrms/, '/hrms')
    }
  }
}
```

### ตัวอย่างการเรียกใช้งานจริงในโค้ด React:
```typescript
import md5 from 'md5';

const agentId = 'SystemMango';
const agentCode = 'Np4kfRh5';
const hashedPassword = md5(password);

// 1. ตรวจสอบสิทธิ์ (IDMS)
const idmsUrl = `/api/idms/authentication/?account=${encodeURIComponent(username)}&password=${encodeURIComponent(hashedPassword)}&Service=0000&AgentId=${agentId}&AgentCode=${agentCode}`;
const authRes = await fetch(idmsUrl);
const authData = await authRes.json();

if (authData.Result === 'OK') {
  const empId = authData.EmpId;
  
  // 2. ดึงข้อมูลพนักงาน (HRMS)
  const hrmsRes = await fetch(`/api/hrms/employee/${empId}`);
  const hrmsData = await hrmsRes.json();
  const employee = hrmsData.data?.employee;
  
  // 3. ดึงรูปภาพพนักงาน
  const faceImageUrl = `https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${empId}`;
}
```
