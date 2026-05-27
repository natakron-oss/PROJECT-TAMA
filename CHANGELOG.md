# 📝 Change Log - ระบบผังเมืองดิจิทัลเทศบาล

## 🗓️ วันที่ 4 เมษายน 2026

### ✅ แก้ไขสมบูรณ์: Data Sync & Status Rendering Pipeline

#### 🔒 ระบบ Upsert ที่แข็งแรง (Duplicate Key 23505 Fix)
- เปลี่ยนจาก `insert()` เป็น `upsert()` ในทุกจุดเขียนข้อมูลอุปกรณ์
  - `saveDevicePosition()` - บันทึกอุปกรณ์ใหม่
  - `syncPendingDevices()` - ซิงค์ข้อมูลค้างไว้
  - `updateDeviceData()` - ปรับปรุงข้อมูลเดิม (fallback insert)
- เพิ่ม `upsertDeviceWithFallback()` ที่รองรับ conflict target หลายแบบ
  - ลองแบบแรก: `id` เป็น primary key
  - ลองแบบรอง: `device_code` เป็น unique identifier
  - ผ่าน schema ต่างกันระหว่าง legacy/modern database

#### 🗺️ Data Mapping ที่เข้มแข็ง (Field Normalization)
- เพิ่ม `mapToDbFormat()` เพื่อ normalize ฟิลด์ CamelCase → snake_case
  - ส่วนรองรับ fallback: `id` ← `device_code`, `lat` ← `lng`/`lon`
  - ส่อง active ค่า default สำหรับ range, status, department
- เพิ่ม `buildDeviceInsertPayloadCandidates()` สำหรับ multi-schema support
  - payload 1: ฟิลด์เต็มจาก mapToDbFormat
  - payload 2: ฟิลด์ legacy-compatible (ตัดออก optional fields)

#### 📊 Merge Logic 3-Layer (Source of Truth)
- ปรับ `fetchAllDevices()` ให้ชัดเจน layer priority:
  1. **Layer 1 (Base):** Google Sheets devices
  2. **Layer 2 (Override):** Local Cache (pending/error status)
  3. **Layer 3 (WINS):** Supabase DB devices (Supabase จำเป็นต้องชนะเสมอ)
- เพิ่ม debug logging ระบุว่ามี overlap device กี่ตัว (Sheet ∩ DB)
- รับรอง `source: 'supabase'` และ `syncStatus: 'synced'` บน DB devices

#### ✨ Status Parsing ที่ Robust (English + Thai)
- แก้ `parseDeviceStatus()` ใน `status.ts` เพื่อรองรับ:
  - **English values:** `'normal'`, `'damaged'`, `'broken'`, `'repairing'`
  - **Thai values:** `'ปกติ'`, `'ชำรุด'`, `'กำลังซ่อม'`, `'ซ่อม'`
  - Case-insensitive matching ด้วย `toLowerCase()`
- ทำให้ไม่ว่า DB เก็บเป็นค่าอังกฤษหรือไทย สถานะจะแสดงผลถูกบน UI

#### 🔍 Debug Logging ที่ละเอียด
- เพิ่ม log ในการ map DB rows:
  - `[data] mapDbRows first row status conversion:` - แสดง raw ↔ parsed status
  - ช่วยสืบสวนปัญหา status mismatch ระหว่าง DB กับ UI
- เพิ่ม log ในการ merge:
  - `[data] fetchAllDevices merged result:` - แสดง sheetCount/cachedCount/dbCount
  - `[data] Devices found in both Sheet and DB:` - แสดง overlap
- เพิ่ม log ใน `App.tsx loadDevices()` ด้วย sample device output

#### 🧪 Verification
- ตรวจ TypeScript errors: ✅ ผ่าน
- ตรวจ production build: ✅ ผ่าน

---

## 🗓️ วันที่ 1 เมษายน 2026

### ✅ สรุปงานที่ทำรอบล่าสุด

#### 🔄 Hybrid Data Persistence (Sheets + Supabase)
- ปรับ `fetchAllDevices()` ให้ข้อมูลจาก Supabase ทับข้อมูลจาก Google Sheets ด้วย key `type:id`
  - แก้ปัญหาแก้ไขข้อมูลแล้วเด้งกลับค่าเดิมจาก Sheets
  - ทำให้ Supabase เป็นแหล่งข้อมูลปัจจุบัน (Current Truth)

#### ✍️ โหมดแก้ไขข้อมูลอุปกรณ์ (สถานที่ตั้ง/สถานะ)
- ปรับ `updateDeviceData()` ให้ปลอดภัยขึ้น
  - ไม่ส่งค่า `undefined` ไป update
  - รองรับ update ด้วยทั้ง `device_code` และ `id`
  - เพิ่ม fallback insert หลายรูปแบบเพื่อรองรับ schema ต่างกันระหว่าง legacy/modern
- เพิ่ม validation ในหน้า `DeviceDetail`
  - บังคับกรอกสถานที่ตั้งก่อนบันทึก

#### ⚡ Optimistic UI + Rollback
- เพิ่ม optimistic update ใน `DeviceDetail`
  - ผู้ใช้เห็นชื่อสถานที่และสถานะเปลี่ยนทันทีเมื่อกดบันทึก
  - ถ้าบันทึกไม่สำเร็จจะ rollback กลับค่าเดิมอัตโนมัติ

#### 🔔 UX ปรับปรุง: เปลี่ยน Alert เป็น Toast
- เปลี่ยนข้อความแจ้งเตือนการบันทึกจาก `alert()` เป็น toast แบบ non-blocking
  - แจ้งเตือนสำเร็จ/ผิดพลาดโดยไม่บล็อกการใช้งานหน้า
  - แสดงข้อความ error จาก backend ได้ละเอียดขึ้น
  - ตรวจจับกรณีสิทธิ์ไม่พอ (RLS/Policy) และแจ้งข้อความเฉพาะ

#### 🧾 History Logs สำหรับการแก้ไขข้อมูล
- เพิ่มระบบบันทึกประวัติการแก้ไขอุปกรณ์ใน data layer
  - เก็บ `before_name`, `after_name`, `before_status`, `after_status`, `changed_by`, `note`, `created_at`
  - เขียน log แบบ non-fatal: ถ้าตาราง log ยังไม่พร้อม การบันทึกอุปกรณ์หลักยังทำงานต่อได้
- เพิ่มการแสดงผลในแท็บประวัติของ `DeviceDetail`
  - โหลดประวัติร้องเรียนและประวัติแก้ไขข้อมูลพร้อมกัน
  - แสดงผู้แก้ไข เวลา และ before/after ชัดเจน

#### 🧪 Verification
- ตรวจ TypeScript errors ในไฟล์ที่แก้: ✅ ผ่าน
- ตรวจ production build (`npm run build`): ✅ ผ่าน

## 🗓️ วันที่ 24 มีนาคม 2026

### 🚀 ปรับระบบครั้งใหญ่สู่ Production-ready

#### 🔴 Critical Bug Fixes
- แก้ปัญหา payload ของปุ่มแจ้งซ่อม/ร้องเรียนให้ส่งข้อมูลอุปกรณ์ถูกประเภท
  - ส่ง `deviceId`, `deviceType`, `deviceName`, `status`, `location` ตามอุปกรณ์ที่เลือกจริง
  - แก้เคสเดิมที่บางหน้าส่งค่า Wi-Fi ID ซ้ำกับทุกประเภท
- แก้ `AddPositionModal` ให้ sync พิกัดจาก props อย่างถูกต้องผ่าน `useEffect`
  - เมื่อคลิกแผนที่แล้วเปิด modal จะได้ lat/lng ล่าสุดเสมอ
- แก้ map reset/recenter ใน `CityMap`
  - ไม่เรียก set center ทุก re-render
  - ตั้ง center ครั้งแรกเท่านั้น และคุม behavior ตอนมี/ไม่มีข้อมูล
- แก้ loading race condition
  - เปลี่ยนจาก timeout เป็น async flow ที่ปิด loading หลัง fetch ครบจริง

#### 🟡 Refactor โครงสร้างอุปกรณ์
- สร้างคอมโพเนนต์ใหม่ `DeviceDetail.tsx` สำหรับใช้งานร่วมกันทุกประเภทอุปกรณ์
- แทนที่โค้ดซ้ำใน
  - `StreetLight.tsx`
  - `WifiSpot.tsx`
  - `FireHydrant.tsx`
- ลด duplicated UI/logic และรวม pattern การแสดงผลให้เป็นมาตรฐานเดียว

#### 🔵 TypeScript Hardening
- เพิ่ม model กลางใน `src/types.ts`
  - `Device`, `StreetLightDevice`, `WifiDevice`, `HydrantDevice` และ input types
- ลบ `any` ออกจาก flow หลักของระบบแผนที่/ข้อมูล
- ปรับ type safety ของ parsing และ state management ให้ strict-compatible

#### 🟢 Supabase Integration
- เพิ่ม client และ schema types ใน `src/lib/supabase.ts`
- เพิ่ม data service กลางใน `src/lib/data.ts`
  - อ่านข้อมูลอุปกรณ์จาก Sheets + Supabase แล้ว merge
  - บันทึกตำแหน่งอุปกรณ์ใหม่ลงตาราง `devices`
  - บันทึกรายการร้องเรียนลงตาราง `complaints`
- รองรับกรณีไม่มี env โดย fallback อย่างปลอดภัย

#### 🟠 Routing และ Data Flow
- เปลี่ยน navigation แบบ state-based เป็น `react-router-dom`
  - รองรับ back button และ deep link
  - เส้นทางหลัก: overview + device detail ตามประเภท
- ย้ายการ fetch ข้อมูลขึ้นระดับ App เพื่อลดการดึงข้อมูลซ้ำ
- อัปเดต `main.tsx` ให้มี `BrowserRouter` อย่างเป็นทางการ

#### 🗺️ GIS / Leaflet Restriction (Chonburi)
- คุมพื้นที่ใช้งานแผนที่ให้อยู่ในจังหวัดชลบุรีด้วย `maxBounds`
- ตั้ง `maxBoundsViscosity = 1.0` เพื่อกันลากออกนอกพื้นที่อย่างเข้มงวด
- ล็อกระดับการซูม
  - `minZoom: 10`
  - `maxZoom: 18`
- กำหนด initial center เป็น `12.7011, 100.9674`
- ยังคงฟีเจอร์เดิมครบ: marker, popup, layer logic

#### 📈 Monitoring & Web Vitals
- เพิ่ม Vercel Analytics (`<Analytics />`) ที่ root ของแอป
- เพิ่ม Vercel Speed Insights (`<SpeedInsights />`) ที่ root ของแอป

#### 📚 Documentation
- ปรับ `README.md` ใหม่ทั้งไฟล์ให้ใช้งานจริงได้ดีขึ้น
  - ภาพรวมระบบ
  - วิธีติดตั้ง/รัน
  - คำสั่งที่ใช้บ่อย
  - Environment variables
  - แนวทาง deploy และพัฒนาต่อ

#### ✅ Verification
- ตรวจสอบผ่าน TypeScript typecheck
- ตรวจสอบผ่าน production build (Vite)

## 🗓️ วันที่ 11 กุมภาพันธ์ 2026

### ✨ ฟีเจอร์ใหม่ - ระบบเพิ่มตำแหน่งอุปกรณ์ใหม่

#### 🎯 เพิ่มระบบเพิ่มตำแหน่งแบบ Interactive
- **ปุ่มเพิ่มตำแหน่ง**
  - ปุ่มสีเขียว "เพิ่มตำแหน่ง" อยู่มุมบนขวาของแผนที่
  - สามารถเปิด/ปิดโหมดเพิ่มตำแหน่งได้
  - เปลี่ยนเป็นสีแดง "ยกเลิก" เมื่ออยู่ในโหมดเพิ่มตำแหน่ง
  - มี hover effect และ animation เพื่อการใช้งานที่ดีขึ้น

- **คลิกบนแผนที่เพื่อเพิ่มตำแหน่ง**
  - เมื่อเปิดโหมดเพิ่ม สามารถคลิกที่ใดก็ได้บนแผนที่
  - แสดง Marker สีม่วงกระพริบ 📍 พร้อม animation pulse
  - ดึงพิกัด (Latitude, Longitude) จากตำแหน่งที่คลิก
  - Popup แสดง "ตำแหน่งใหม่" พร้อมข้อความแนะนำ

#### 📋 Modal Form สำหรับกรอกข้อมูล (AddPositionModal.tsx)
- **การเลือกประเภทอุปกรณ์**
  - Button Grid แสดง 3 ประเภท: 💡 ไฟส่องสว่าง, 📶 Wi-Fi สาธารณะ, 🚒 ประปา/ดับเพลิง
  - Active state แสดงด้วยสีและ shadow เมื่อเลือก
  - รองรับการเปลี่ยนประเภทได้ก่อนบันทึก

- **ฟิลด์กรอกข้อมูล**
  - ชื่อตำแหน่ง (required) - placeholder: "หน้าโรงเรียน, ถนนสายหลัก..."
  - พิกัด (Lat, Lng) - แสดงค่าจากตำแหน่งที่คลิก, แก้ไขได้ (step: 0.000001)
  - สถานะ - dropdown: ✓ ปกติ, ⚠️ ชำรุด, 🔧 กำลังซ่อม
  - หมายเหตุ - textarea สำหรับรายละเอียดเพิ่มเติม (optional)

- **UX/UI Features**
  - Form validation: ตรวจสอบชื่อตำแหน่งต้องไม่ว่าง
  - Modal overlay พร้อม click outside to close
  - Animation: fadeIn/slideUp เมื่อเปิด Modal
  - Responsive design ขนาดสูงสุด 600px
  - ปุ่ม "ยกเลิก" และ "บันทึก" มี icon จาก lucide-react

#### 🗺️ อัปเดต CityMap Component
- **เพิ่ม Props ใหม่**
  - `onAddPosition?: (lat: number, lng: number) => void` - callback เมื่อคลิกแผนที่
  - `addMode?: boolean` - สถานะโหมดเพิ่มตำแหน่ง

- **Event Handling**
  - เพิ่ม map.on('click') event listener เมื่ออยู่ใน addMode
  - สร้าง temp marker สีม่วง + animation pulse
  - เรียก callback พร้อมพิกัดที่คลิก

- **Animation CSS**
  - เพิ่ม @keyframes pulse สำหรับ temp marker
  - Animation: scale(1) ↔ scale(1.1) with opacity fade

#### 🔄 อัปเดต App.tsx - State Management
- **States ใหม่**
  - `isAddModalOpen: boolean` - สถานะเปิด/ปิด Modal
  - `addMode: boolean` - สถานะโหมดเพิ่มตำแหน่ง
  - `tempLat, tempLng: number` - เก็บพิกัดชั่วคราว
  - `newPositions: any[]` - array เก็บตำแหน่งใหม่ที่เพิ่มเข้ามา

- **Functions ใหม่**
  - `handleAddPosition(lat, lng)` - รับพิกัดจาก map และเปิด Modal
  - `handleSavePosition(data)` - บันทึกข้อมูลใหม่เข้า newPositions array
  - `toggleAddMode()` - เปิด/ปิดโหมดเพิ่มตำแหน่ง พร้อม alert แจ้งเตือน

- **Data Integration**
  - อัปเดต `mapDevices` useMemo ให้รวม newPositions
  - สร้าง ID แบบ `NEW-${Date.now()}` สำหรับอุปกรณ์ใหม่
  - ข้อมูลจัดเก็บใน memory (พร้อมเชื่อมต่อ backend/Sheets ต่อได้)

#### 📁 ไฟล์ใหม่ที่สร้าง
1. **src/AddPositionModal.tsx** (174 บรรทัด)
   - React component สำหรับ Modal form
   - TypeScript interface: `NewPositionData`
   - Form validation และ state management

2. **src/AddPositionModal.css** (195 บรรทัด)
   - Styling สำหรับ Modal overlay และ content
   - Form elements: input, select, textarea
   - Device type button grid
   - Animation: fadeIn, slideUp
   - Responsive design

3. **src/mockData.ts**
   - TypeScript interface definition
   - Export `CityDevice` interface
   - รองรับ 5 ประเภท: streetlight, wifi, hydrant, cctv, busstop

#### 🎨 CSS Updates
- **CityMap.css**
  - เพิ่ม @keyframes pulse animation
  - เพิ่ม .temp-marker-icon class
  - รองรับ temp marker สีม่วงกระพริบ

### 📦 ไฟล์ที่แก้ไข
- `src/App.tsx` - เพิ่ม state management และ integration
- `src/CityMap.tsx` - เพิ่ม click handler และ temp marker
- `src/CityMap.css` - เพิ่ม animation
- `src/AddPositionModal.tsx` - ไฟล์ใหม่
- `src/AddPositionModal.css` - ไฟล์ใหม่
- `src/mockData.ts` - ไฟล์ใหม่

### 🚀 การใช้งาน
1. คลิกปุ่ม "เพิ่มตำแหน่ง" มุมบนขวาของแผนที่
2. คลิกบนแผนที่ที่ตำแหน่งที่ต้องการเพิ่ม
3. กรอกข้อมูลในฟอร์มที่เปิดขึ้นมา
4. เลือกประเภทอุปกรณ์และสถานะ
5. กดปุ่ม "บันทึก"
6. ตำแหน่งใหม่จะปรากฏบนแผนที่ทันที

### 🔮 พัฒนาต่อได้
- [ ] เชื่อมต่อกับ Google Sheets API เพื่อบันทึกข้อมูลถาวร
- [ ] เพิ่มระบบแก้ไขและลบตำแหน่ง
- [ ] เพิ่มการ export ข้อมูลเป็น CSV
- [ ] เพิ่มระบบ undo/redo
- [ ] เพิ่มการอัพโหลดรูปภาพประกอบ

---

## 🗓️ วันที่ 10 กุมภาพันธ์ 2026

### ✨ ฟีเจอร์ใหม่ - ระบบแผนที่แบบ Real-time

#### 🗺️ เพิ่ม Marker แสดงพิกัด LAT/LON จาก Google Sheets
- **แผนที่หน้าภาพรวม (Overview)**
  - แสดงพิกัดจริงจากฟิลด์ LAT และ LNG/LON ใน Google Sheets
  - เพิ่มข้อมูลพิกัดใน popup ของ marker (รูปแบบ: lat.toFixed(6), lng.toFixed(6))
  - แสดงสถิติอุปกรณ์ที่มีพิกัดบนแผนที่ (จำนวนรวมและแยกตามประเภท)

- **แผนที่แบบ Interactive ในหน้ารายละเอียดอุปกรณ์**
  - **ไฟส่องสว่าง (StreetLight.tsx)**: แสดง Leaflet map พร้อม marker 💡 สีเหลือง
  - **ไวไฟชุมชน (WifiSpot.tsx)**: แสดง Leaflet map พร้อม marker 📶 สีเขียว
  - **ประปาหัวแดง (FireHydrant.tsx)**: แสดง Leaflet map พร้อม marker 🚒 สีแดง
  - แผนที่จะอัปเดตพิกัดทันทีเมื่อเลือกอุปกรณ์ใหม่
  - Zoom level: 16 (ระดับถนน)
  - แสดง popup พร้อมข้อมูลรายละเอียดเมื่อคลิก marker

### 🔧 การแก้ไขและปรับปรุง

#### ✏️ ลบระบบสุ่มพิกัด (Random Coordinates)
- **App.tsx**
  - ✅ ลบฟังก์ชัน `generateRandomCoords()` ออกทั้งหมด
  - ✅ ลบตัวแปร `CENTER_LAT` และ `CENTER_LNG` ที่ไม่ใช้แล้ว
  - ✅ เปลี่ยนจากการสุ่มพิกัดเป็นการข้าม (skip) รายการที่ไม่มีพิกัด
  - ✅ รองรับทั้งชื่อคอลัมน์ `LNG` และ `LON` จาก Google Sheets
  - เงื่อนไข: `if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;`

#### 📦 Dependencies ใหม่
- **Leaflet**: เพิ่มใน StreetLight.tsx, WifiSpot.tsx, FireHydrant.tsx
  ```typescript
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  ```
- แก้ไขปัญหา Leaflet default icon paths
  ```typescript
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({...});
  ```

#### 🎨 Custom Marker Styling
- **เพิ่ม CSS สำหรับ marker ทรงหยดน้ำ (teardrop shape)**
  ```css
  .marker-container {
    width: 40px;
    height: 40px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 3px solid white;
  }
  .marker-icon {
    transform: rotate(45deg);
    font-size: 20px;
  }
  ```

#### 📄 ไฟล์ที่แก้ไข

1. **`src/CityMap.tsx`**
   - เพิ่มแสดงพิกัดใน popup: `${device.lat.toFixed(6)}, ${device.lng.toFixed(6)}`

2. **`src/App.tsx`**
   - ลบฟังก์ชัน `generateRandomCoords()`
   - ปรับ `getMapDevices()` ให้ข้ามรายการที่ไม่มีพิกัด
   - รองรับทั้ง `LNG` และ `LON` column names
   - เพิ่มส่วนสถิติอุปกรณ์บนแผนที่ในหน้า Overview

3. **`src/StreetLight.tsx`**
   - เพิ่ม Leaflet map imports และ refs
   - เพิ่ม `useEffect` สำหรับสร้างและอัปเดตแผนที่
   - แทนที่ mockup map area ด้วย Leaflet map container
   - เพิ่ม custom marker styles

4. **`src/WifiSpot.tsx`**
   - เพิ่ม Leaflet map imports และ refs
   - เพิ่ม `useEffect` สำหรับสร้างและอัปเดตแผนที่
   - แทนที่ mockup map area ด้วย Leaflet map container
   - เพิ่ม custom marker styles

5. **`src/FireHydrant.tsx`**
   - เพิ่ม Leaflet map imports และ refs
   - เพิ่ม `useEffect` สำหรับสร้างและอัปเดตแผนที่
   - แทนที่ mockup map area ด้วย Leaflet map container
   - เพิ่ม custom marker styles

### 🐛 Bug Fixes
- แก้ไขปัญหาอุปกรณ์ที่ไม่มีพิกัดถูกสุ่มไปอยู่ที่ไม่ถูกต้อง
- แก้ไขปัญหาการแสดงแผนที่เมื่อเปลี่ยนอุปกรณ์ (cleanup map instance)
- รองรับทั้งชื่อคอลัมน์ `LON` และ `LNG` เพื่อความยืดหยุ่น

### 📊 ผลลัพธ์
- ✅ แผนที่ทุกหน้าใช้พิกัดจริงจาก Google Sheets
- ✅ แสดงเฉพาะอุปกรณ์ที่มีพิกัดที่ถูกต้อง
- ✅ ไม่มีการสุ่มพิกัดปลอมอีกต่อไป
- ✅ ผู้ใช้สามารถคลิกดู marker และข้อมูลรายละเอียดได้
- ✅ แผนที่ responsive และแสดงผลได้ดีบนทุกหน้าจอ

---

## 🗓️ วันที่ 4 กุมภาพันธ์ 2026

### ✨ ฟีเจอร์ใหม่

#### 🗺️ ระบบแผนที่ผังเมืองดิจิทัล (City Map)
- **เพิ่มระบบแผนที่ OpenStreetMap + Leaflet.js** ในหน้า Overview
- แสดงตำแหน่งอุปกรณ์เมืองแบบ Real-time จากข้อมูล Google Sheets
- รองรับอุปกรณ์ 3 ประเภท:
  - 💡 **ไฟส่องสว่าง** (สีเหลืองทอง)
  - 📶 **Wi-Fi สาธารณะ** (สีเขียว)
  - 🚒 **หัวดับเพลิง/ประปา** (สีแดง)

#### 🎨 UI/UX
- **Header แผนที่**: แสดงชื่อระบบและจำนวนอุปกรณ์ทั้งหมด
- **Legend**: แสดงสัญลักษณ์และสถานะของอุปกรณ์แต่ละประเภท พร้อมจำนวน
- **Custom Markers**: ใช้ Emoji เป็นไอคอนแทนที่ marker default
- **Interactive Pop-up**: คลิกที่ marker เพื่อดูข้อมูลรายละเอียด
  - รหัสอุปกรณ์
  - ชื่อ/ตำแหน่ง
  - สถานะ (✓ ปกติ / ⚠️ ชำรุด / 🔧 กำลังซ่อม)
  - หน่วยงานรับผิดชอบ
  - หมายเหตุเพิ่มเติม

### 🔧 การแก้ไขและปรับปรุง

#### 📂 ไฟล์ที่สร้างใหม่

1. **`src/mockData.ts`**
   - ข้อมูลตัวอย่าง (Mock Data) สำหรับทดสอบระบบ
   - รวมข้อมูลอุปกรณ์ 4 ประเภท: หัวดับเพลิง, CCTV, Wi-Fi, ป้ายรถเมล์
   - พิกัดตัวอย่างในพื้นที่กรุงเทพฯ

2. **`src/CityMap.tsx`**
   - Component หลักสำหรับแสดงแผนที่
   - รับ props: `devices` และ `loading`
   - ใช้ Leaflet.js สำหรับ render แผนที่
   - คำนวณจุดศูนย์กลางแผนที่อัตโนมัติจากตำแหน่งอุปกรณ์
   - รองรับการแสดง Loading state

3. **`src/CityMap.css`**
   - Styling สำหรับแผนที่และ components ต่างๆ
   - Custom marker และ popup styles
   - Responsive design สำหรับมือถือ
   - Override Leaflet default styles

#### ✏️ ไฟล์ที่แก้ไข

1. **`package.json`**
   - ติดตั้ง `leaflet` และ `@types/leaflet`
   - ใช้ flag `--legacy-peer-deps` เพื่อหลีกเลี่ยง peer dependency conflict

2. **`src/App.tsx`**
   - Import `CityMap` component
   - เพิ่มฟังก์ชัน `generateRandomCoords()` - สุ่มพิกัดรอบๆ จุดศูนย์กลาง
   - เพิ่มฟังก์ชัน `getMapDevices()` - แปลงข้อมูลจาก Google Sheets ให้เป็นรูปแบบที่แผนที่ใช้งาน
   - แสดง `<CityMap>` ในหน้า Overview
   - ส่ง props `devices` และ `loading` ไปยัง CityMap

3. **`src/App.css`**
   - เพิ่ม `margin-right: 29rem` ให้ `.map-container` เพื่อไม่ให้ซ้อนทับกับ sidebar ขวา

### 📍 ระบบพิกัด (Coordinates System)

#### ตำแหน่งพื้นที่: **พลูตาหลวง อ.สัตหีบ จ.ชลบุรี**
- **Latitude**: 12.7011°
- **Longitude**: 100.9674°

#### Logic การจัดการพิกัด
```
IF ข้อมูลมี LAT และ LNG ที่ถูกต้อง:
  → ใช้พิกัดจริงจาก Google Sheets
ELSE:
  → สุ่มพิกัดรอบๆ พลูตาหลวง
    - ไฟส่องสว่าง: รัศมี 1.5 กม.
    - Wi-Fi และประปา: รัศมี 2 กม.
```

### 🐛 Bug Fixes

1. **แผนที่หายไป**: แก้โดยลบเงื่อนไข `devices.length === 0` ออกจาก useEffect ทำให้แผนที่แสดงได้แม้ยังไม่มีข้อมูล
2. **ซ้อนทับ Sidebar**: แก้โดยเพิ่ม margin-right ให้ map-container
3. **ตัวแปรประกาศซ้ำ**: ลบการประกาศ `devices`, `CENTER_LAT`, `CENTER_LNG` ซ้ำออก

### 🔍 Debug Features

- เพิ่ม `console.log` ใน `getMapDevices()` เพื่อตรวจสอบข้อมูลที่ส่งไปแผนที่
- แสดงจำนวนอุปกรณ์ทั้งหมดใน console

### 📊 สรุปการเปลี่ยนแปลง

| รายการ | จำนวน |
|--------|-------|
| ไฟล์สร้างใหม่ | 3 ไฟล์ |
| ไฟล์แก้ไข | 3 ไฟล์ |
| Dependencies ใหม่ | 2 packages |
| ฟีเจอร์ใหม่ | 1 ระบบ (แผนที่) |
| Bug Fixes | 3 issues |

### 🎯 ผลลัพธ์

✅ ระบบแผนที่ผังเมืองดิจิทัลพร้อมใช้งาน  
✅ แสดงข้อมูลจาก Google Sheets แบบ Real-time  
✅ รองรับการสุ่มพิกัดอัตโนมัติสำหรับข้อมูลที่ไม่มี LAT/LNG  
✅ UI/UX สวยงาม ใช้งานง่าย  
✅ Responsive สำหรับทุกอุปกรณ์  

### 📝 หมายเหตุสำหรับผู้ดูแลระบบ

**เพื่อให้แผนที่แสดงพิกัดจริง:**
1. เปิด Google Sheets ของคุณ
2. เพิ่มคอลัมน์ `LAT` และ `LNG` ในทุก sheet (ไฟส่องสว่าง, Wi-Fi, ประปา)
3. ใส่พิกัด Latitude และ Longitude ที่ถูกต้องสำหรับแต่ละอุปกรณ์
4. ระบบจะอ่านและแสดงพิกัดจริงโดยอัตโนมัติ

**เครื่องมือหาพิกัด:**
- Google Maps: คลิกขวา → เลือก Latitude, Longitude
- OpenStreetMap: คลิกขวา → Show address

---

💻 Developed by: GitHub Copilot  
📅 Date: 4 February 2026  
🏢 Project: เทศบาลตำบลพลูตาหลวง - ระบบผังเมืองดิจิทัล
