// src/patientTypes.ts

export type PatientStatus = 'general' | 'disabled' | 'elderly' | 'finished';

export interface TreatmentRecord {
  id?: string;
  patient_id: string;
  date: string;
  doctor: string;
  diagnosis: string;
  note?: string;
  next_visit?: string;
  created_at?: string;
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
  
  // 💡 จุดเพิ่มใหม่: ข้อมูลประเภทและรายการทางกายภาพบำบัด
  treatment_type: string;   // เก็บค่า 'MS' หรือ 'neuro' หรือ ''
  treatments_list: string[]; // เก็บอาเรย์ของรายการที่ติ๊กเลือก (สูงสุด 4 อัน)
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

  // 💡 จุดเพิ่มใหม่: สำหรับฟอร์มเพิ่มผู้ป่วยใหม่
  treatment_type: string;
  treatments_list: string[];
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