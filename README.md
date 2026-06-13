# 🏥 SANPAKWAN SMART REHAB CENTER

ระบบบริหารจัดการผู้ป่วยกายภาพบำบัด เทศบาลตำบลสันผักหวาน  
พัฒนาด้วย React + TypeScript + Vite เชื่อมต่อฐานข้อมูล Google Sheets

---

## 📁 โครงสร้างไฟล์

```
src/
├── assets/
│   └── logo.jpg                  # โลโก้ศูนย์ฟื้นฟูสมรรถภาพ
├── lib/
│   ├── patientData.ts            # ฟังก์ชัน CRUD เชื่อมต่อ Google Sheets / Supabase
│   └── supabase.ts               # Supabase client (ถ้าเปิดใช้)
├── App.tsx                       # Root component + routing
├── main.tsx                      # Entry point
├── index.css                     # Global styles
├── Patient.css                   # Styles ของระบบผู้ป่วยทั้งหมด
├── patientTypes.ts               # Types, interfaces, constants ทั้งหมด
├── PatientPage.tsx               # หน้าหลัก — layout sidebar + routing subpage
├── PatientDashboard.tsx          # แท็บ "ภาพรวม" — สถิติและกราฟสรุป
├── PatientList.tsx               # แท็บ "รายชื่อผู้ป่วย" — ตาราง + ค้นหา + filter
├── PatientMap.tsx                # แท็บ "แผนที่ผู้ป่วย" — Leaflet map
├── PatientDetail.tsx             # Panel รายละเอียดผู้ป่วย (ข้อมูล + ประวัติการรักษา)
├── PatientFormModal.tsx          # Modal เพิ่ม/แก้ไขผู้ป่วย
├── TreatmentFormModal.tsx        # Modal บันทึกการรักษา (มี 2 แท็บ)
├── LoginPage.tsx                 # หน้า login
└── vite-env.d.ts
```

---

## ⚙️ การติดตั้ง

```bash
npm install
npm run dev
```

---

## 🗄️ ฐานข้อมูล Google Sheets

ระบบใช้ Google Sheets เป็น database ผ่าน Google Apps Script (Web App)

### ชีตที่ต้องมี

#### ชีต `patients`
| คอลัมน์ | ประเภท | ตัวอย่าง |
|---|---|---|
| id | String | PT-001 |
| first_name | String | สมชาย |
| last_name | String | ใจดี |
| birth_date | String (YYYY-MM-DD) | 1965-03-12 |
| gender | String | ชาย / หญิง / ไม่ระบุ |
| phone | String | 081-234-5678 |
| emergency_contact | String | สมหญิง ใจดี |
| emergency_phone | String | 081-234-5679 |
| address | String | 12 หมู่ 1 บ้านสันผักหวาน |
| subdistrict | String | สันผักหวาน |
| district | String | หางดง |
| allergies | String | ยาเพนิซิลิน |
| conditions | JSON Array | ["เบาหวาน","ความดันโลหิตสูง"] |
| status | String | general / disabled / elderly / finished |
| lat | Number | 18.7065 |
| lng | Number | 98.9645 |
| created_at | ISO String | 2024-01-01T00:00:00.000Z |

#### ชีต `treatments`
| คอลัมน์ | ประเภท | ตัวอย่าง |
|---|---|---|
| id | String | T-001 |
| patient_id | String | PT-001 |
| date | String (YYYY-MM-DD) | 2024-06-01 |
| doctor | String | นพ.วิชัย สุขสม |
| diagnosis | String | ติดตามเบาหวาน |
| note | String | น้ำตาลลดลงดี HbA1c 7.2 |
| next_visit | String (YYYY-MM-DD) | 2024-09-01 |
| created_at | ISO String | 2024-06-01T00:00:00.000Z |
| procedure | String | therapeutic_exercise |
| treatment_type | String | MS / neuro |
| treatments_list | String (comma-separated) | hot_pack,tens,balance_training |

> **หมายเหตุ:** `treatments_list` เก็บเป็น string คั่นด้วย comma เช่น `"hot_pack,tens"` — ระบบจะแปลงเป็น array ให้อัตโนมัติตอนโหลดข้อมูล

---

## 👥 ระบบสิทธิ์

| Role | สิ่งที่ทำได้ |
|---|---|
| **user** | ดูทุกเมนู, เพิ่ม/แก้ไข/ลบผู้ป่วย, บันทึกการรักษา |
| **viewer** | ดูได้เฉพาะแท็บ "ภาพรวม" (Dashboard) เท่านั้น ไม่มีปุ่มแก้ไข/ลบ/เพิ่มใดๆ |

---

## 🧩 Components หลัก

### `PatientPage.tsx`
- Layout หลักของระบบ มี Sidebar และ routing ระหว่าง 3 subpage
- จัดการ state กลาง (patients, selectedPatient, modals)
- เรียก CRUD functions จาก `patientData.ts`

### `PatientDetail.tsx`
- Panel แสดงรายละเอียดผู้ป่วย เลื่อนออกมาจากขวา
- แท็บ **ข้อมูลผู้ป่วย**: อายุ, เพศ, แพ้ยา, โรคประจำตัว, ผู้ติดต่อ, ที่อยู่
- แท็บ **ประวัติการรักษา**: รายการ TreatmentCard แต่ละครั้ง พร้อม popup รายละเอียด

### `TreatmentFormModal.tsx`
- Modal บันทึกการรักษา มี 2 แท็บ:
  - **ข้อมูลการรักษา**: วันที่, ผู้ตรวจ, ประเภทการรักษา (MS/Neuro), รายการหัตถการ (สูงสุด 4), diagnosis, note
  - **การนัดหมายล่วงหน้า**: วันนัดครั้งต่อไป

### `PatientFormModal.tsx`
- Modal เพิ่ม/แก้ไขข้อมูลผู้ป่วย
- ข้อมูลพื้นฐาน, ติดต่อ, ที่อยู่/พิกัด, โรคประจำตัว

---

## 🏷️ ประเภทการรักษา (treatment_type)

| ค่า | ความหมาย |
|---|---|
| `MS` | Musculoskeletal — ระบบกระดูกและกล้ามเนื้อ |
| `neuro` | Neurological — ระบบประสาท |

บันทึกต่อครั้งที่รักษา (ไม่ใช่ต่อผู้ป่วย)

---

## 🔧 หัตถการกายภาพบำบัด (PROCEDURE_OPTIONS)

| value | label |
|---|---|
| hot_pack | Hot pack — ประคบร้อน |
| cold_pack | Cold pack — ประคบเย็น |
| ultrasound_diathermy | Ultrasound Diathermy — อัลตราซาวน์ความร้อนลึก |
| ultrasound_combined | Ultrasound Combined Diathermy |
| tens | TENs — เครื่องกระตุ้นเส้นประสาทด้วยไฟฟ้า |
| electrical_stimulation | Electrical stimulation — เครื่องกระตุ้นไฟฟ้า |
| lumbar_traction | Lumbar traction — เครื่องดึงหลัง |
| cervical_traction | Cervical traction — เครื่องดึงคอ |
| paraffin | Paraffin — พาราฟิน |
| therapeutic_exercise | Therapeutic exercise — การออกกำลังกายเพื่อบำบัด |
| bicycle_ergometer | Bicycle ergometer — เครื่องปั่นจักรยานกับที่ |
| balance_training | Balance training — การฝึกการทรงตัว |
| bed_mobility_training | Bed mobility training — การฝึกเคลื่อนไหวบนเตียง |
| mobilization_therapy | Mobilization therapy — การขยับข้อต่อ |
| ambulation_training | Ambulation training — การฝึกเดิน |

---

## 📦 Dependencies หลัก

```json
{
  "react": "^18",
  "typescript": "^5",
  "vite": "^5",
  "leaflet": "สำหรับแผนที่",
  "lucide-react": "สำหรับไอคอน"
}
```

---

## 📝 การ Deploy

1. Build: `npm run build`
2. อัปโหลดโฟลเดอร์ `dist/` ไปยัง hosting (Netlify, Vercel, หรือ GitHub Pages)
3. ตั้งค่า environment variable สำหรับ Google Apps Script URL และ Supabase (ถ้าใช้)

---

*พัฒนาสำหรับ ศูนย์ฟื้นฟูสมรรถภาพผู้สูงอายุและคนพิการ เทศบาลตำบลสันผักหวาน*
