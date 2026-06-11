// src/patientTypes.ts

export type PatientStatus = 'general' | 'disabled' | 'elderly' | 'finished';

export type ProcedureCategory = 'musculoskeletal' | 'neurological' | 'cardiovascular';

export interface ProcedureOption {
  value: string;
  label: string;
  labelTh: string;
}

export const PROCEDURE_CATEGORIES: Record<ProcedureCategory, { label: string; labelTh: string }> = {
  musculoskeletal:  { label: 'Musculoskeletal',           labelTh: 'ระบบกระดูกและกล้ามเนื้อ' },
  neurological:     { label: 'Neurological',              labelTh: 'ระบบประสาทและสมอง' },
  cardiovascular:   { label: 'Cardiovascular & Pulmonary', labelTh: 'ระบบหัวใจและหลอดเลือดและปอด' },
};

export const PROCEDURE_OPTIONS: ProcedureOption[] = [
  { value: 'hot_pack',                   label: 'Hot pack',                    labelTh: 'ประคบร้อน' },
  { value: 'cold_pack',                  label: 'Cold pack',                   labelTh: 'ประคบเย็น' },
  { value: 'ultrasound_diathermy',       label: 'Ultrasound Diathermy',        labelTh: 'อัลตราซาวน์ความร้อนลึก' },
  { value: 'ultrasound_combined',        label: 'Ultrasound Combined Diathermy', labelTh: 'อัลตราซาวน์ความร้อนลึกและกระตุ้นไฟฟ้า' },
  { value: 'tens',                       label: 'TENs',                        labelTh: 'เครื่องกระตุ้นเส้นประสาทด้วยไฟฟ้าผ่านผิวหนัง' },
  { value: 'electrical_stimulation',     label: 'Electrical stimulation',      labelTh: 'เครื่องกระตุ้นไฟฟ้า' },
  { value: 'lumbar_traction',            label: 'Lumbar traction',             labelTh: 'เครื่องดึงหลัง' },
  { value: 'cervical_traction',          label: 'Cervical traction',           labelTh: 'เครื่องดึงคอ' },
  { value: 'paraffin',                   label: 'Paraffin',                    labelTh: 'พาราฟิน' },
  { value: 'therapeutic_exercise',       label: 'Therapeutic exercise',        labelTh: 'การออกกำลังกายเพื่อการบำบัดรักษา' },
  { value: 'bicycle_ergometer',          label: 'Bicycle ergometer',           labelTh: 'เครื่องปั่นจักรยานกับที่' },
  { value: 'balance_training',           label: 'Balance training',            labelTh: 'การฝึกการทรงท่าและการทรงตัว' },
  { value: 'bed_mobility_training',      label: 'Bed mobility training',       labelTh: 'การฝึกเคลื่อนไหวบนเตียง' },
  { value: 'mobilization_therapy',       label: 'Mobilization therapy',        labelTh: 'การขยับ เคลื่อนไหวข้อต่อ' },
  { value: 'ambulation_training',        label: 'Ambulation training',         labelTh: 'การฝึกเคลื่อนไหว/ฝึกเดิน' },
];

// ตัวเลือก treatment_type แต่ละครั้งที่บันทึกการรักษา
export type TreatmentType = 'MS' | 'neuro' | '';

export const TREATMENT_TYPE_OPTIONS: { value: TreatmentType; label: string; labelTh: string }[] = [
  { value: 'MS',    label: 'MS',    labelTh: 'ระบบกระดูกและกล้ามเนื้อ (Musculoskeletal)' },
  { value: 'neuro', label: 'Neuro', labelTh: 'ระบบประสาท (Neurological)' },
];

export interface TreatmentRecord {
  id?: string;
  patient_id: string;
  date: string;
  doctor: string;
  diagnosis: string;
  procedure?: string;
  note?: string;
  next_visit?: string;
  created_at?: string;

  // ✅ ย้ายมาจาก Patient — บันทึกต่อครั้งที่รักษา
  treatment_type?: TreatmentType;   // 'MS' | 'neuro' | ''
  treatments_list?: string[];        // รายการหัตถการที่เลือก (สูงสุด 4 รายการ)
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: 'ชาย' | 'หญิง' | 'ไม่ระบุ';
  phone: string;
  emergency_contact?: string;
  emergency_phone?: string;
  address: string;
  subdistrict?: string;
  district?: string;
  allergies?: string;
  conditions: string[];
  status: PatientStatus;
  lat: number;
  lng: number;
  created_at?: string;
  updated_at?: string;
  treatments?: TreatmentRecord[];
  // ✅ ลบ treatment_type และ treatments_list ออกจากที่นี่แล้ว
}

export interface NewPatientInput {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: 'ชาย' | 'หญิง' | 'ไม่ระบุ';
  phone: string;
  emergency_contact?: string;
  emergency_phone?: string;
  address: string;
  subdistrict?: string;
  district?: string;
  allergies?: string;
  conditions: string[];
  status: PatientStatus;
  lat: number;
  lng: number;
  // ✅ ลบ treatment_type และ treatments_list ออกแล้ว
}

export const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string }> = {
  general:  { label: 'ผู้ป่วยทั่วไป', color: '#10b981', bg: '#ecfdf5' },
  disabled: { label: 'ผู้พิการ',      color: '#ef4444', bg: '#fef2f2' },
  elderly:  { label: 'ผู้สูงอายุ',     color: '#3b82f6', bg: '#eff6ff' },
  finished: { label: 'จำหน่าย',       color: '#64748b', bg: '#f8fafc' },
};

export const CONDITION_COLORS: Record<string, string> = {
  'เบาหวาน':            '#f59e0b',
  'ความดันโลหิตสูง':    '#ef4444',
  'โรคหัวใจ':           '#ec4899',
  'โรคไต':              '#8b5cf6',
  'ต้อกระจก':           '#06b6d4',
  'ไทรอยด์':            '#84cc16',
  'หอบหืด':             '#0ea5e9',
  'มะเร็ง':             '#dc2626',
};

export function getConditionColor(condition: string): string {
  return CONDITION_COLORS[condition] ?? '#6366f1';
}

export function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age;
}

export function avatarColor(name: string): string {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export function initials(firstName: string, lastName: string): string {
  return (firstName?.[0] ?? '') + (lastName?.[0] ?? '');
}