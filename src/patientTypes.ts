// src/patientTypes.ts

export type PatientStatus = 'active' | 'inactive' | 'critical';

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
  hn: string;
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
  blood_type?: string;
  allergies?: string;
  conditions: string[];           // เก็บเป็น JSON array ใน Supabase
  status: PatientStatus;
  lat: number;
  lng: number;
  created_at?: string;
  updated_at?: string;
  treatments?: TreatmentRecord[]; // join มาจาก patient_treatments
}

export interface NewPatientInput {
  hn?: string;
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
  blood_type?: string;
  allergies?: string;
  conditions: string[];
  status: PatientStatus;
  lat: number;
  lng: number;
}

export interface NewTreatmentInput {
  patient_id: string;
  date: string;
  doctor: string;
  diagnosis: string;
  note?: string;
  next_visit?: string;
}

export const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'ดูแลอยู่',       color: '#10b981', bg: '#ecfdf5' },
  inactive: { label: 'ปิดเคส',         color: '#64748b', bg: '#f1f5f9' },
  critical: { label: 'ต้องเฝ้าระวัง', color: '#ef4444', bg: '#fef2f2' },
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