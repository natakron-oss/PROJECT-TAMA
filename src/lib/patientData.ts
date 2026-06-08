// src/lib/patientData.ts
// layer เดียวกับ data.ts เดิม — ใช้ supabase client ตัวเดิม

import { supabase, isSupabaseEnabled } from './supabase';
import type { Patient, NewPatientInput, NewTreatmentInput, TreatmentRecord } from '../patientTypes';

// ─── SQL Schema ที่ต้องรันใน Supabase ────────────────────────────────────────
//
//  create table patients (
//    id            uuid primary key default gen_random_uuid(),
//    hn            text unique,
//    first_name    text not null,
//    last_name     text not null,
//    birth_date    date not null,
//    gender        text not null default 'ไม่ระบุ',
//    phone         text,
//    emergency_contact text,
//    emergency_phone   text,
//    address       text,
//    subdistrict   text,
//    district      text,
//    blood_type    text,
//    allergies     text,
//    conditions    jsonb default '[]',
//    status        text not null default 'active',
//    lat           float8 not null default 0,
//    lng           float8 not null default 0,
//    created_at    timestamptz default now(),
//    updated_at    timestamptz default now()
//  );
//
//  create table patient_treatments (
//    id          uuid primary key default gen_random_uuid(),
//    patient_id  uuid references patients(id) on delete cascade,
//    date        date not null,
//    doctor      text,
//    diagnosis   text not null,
//    note        text,
//    next_visit  date,
//    created_at  timestamptz default now()
//  );
//
// ─────────────────────────────────────────────────────────────────────────────

// Mock data สำหรับตอนที่ยัง config Supabase ไม่เสร็จ
const MOCK_PATIENTS: Patient[] = [
  {
    id: 'PT-001', hn: 'HN-2024-001',
    first_name: 'สมชาย', last_name: 'ใจดี',
    birth_date: '1965-03-12', gender: 'ชาย',
    phone: '081-234-5678', emergency_contact: 'สมหญิง ใจดี', emergency_phone: '081-234-5679',
    address: '123 ซอยสุขสันต์ หมู่ 3', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7489, lng: 100.9614,
    conditions: ['เบาหวาน', 'ความดันโลหิตสูง'],
    blood_type: 'A+', allergies: 'ยาเพนิซิลิน', status: 'active',
    treatments: [
      { id: 'T-001', patient_id: 'PT-001', date: '2024-06-01', doctor: 'นพ.วิชัย สุขสม', diagnosis: 'ติดตามเบาหวาน', note: 'น้ำตาลลดลงดี HbA1c 7.2', next_visit: '2024-09-01' },
      { id: 'T-002', patient_id: 'PT-001', date: '2024-03-15', doctor: 'นพ.วิชัย สุขสม', diagnosis: 'ความดันโลหิตสูง', note: 'ปรับยา Amlodipine 10mg', next_visit: '2024-06-01' },
    ],
  },
  {
    id: 'PT-002', hn: 'HN-2024-002',
    first_name: 'มาลี', last_name: 'รักสุขภาพ',
    birth_date: '1978-11-25', gender: 'หญิง',
    phone: '089-876-5432', emergency_contact: 'วิชัย รักสุขภาพ', emergency_phone: '089-876-5433',
    address: '45 ถนนพลูตาหลวง', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7512, lng: 100.9589,
    conditions: ['โรคหัวใจ'],
    blood_type: 'O+', allergies: '-', status: 'active',
    treatments: [
      { id: 'T-003', patient_id: 'PT-002', date: '2024-06-10', doctor: 'นพ.ประยุทธ หัวใจดี', diagnosis: 'ตรวจหัวใจประจำปี', note: 'EKG ปกติ ยังคงยาเดิม', next_visit: '2024-12-10' },
    ],
  },
  {
    id: 'PT-003', hn: 'HN-2024-003',
    first_name: 'ประเสริฐ', last_name: 'แข็งแรง',
    birth_date: '1950-07-04', gender: 'ชาย',
    phone: '062-111-2222', emergency_contact: 'สุนิสา แข็งแรง', emergency_phone: '062-111-2223',
    address: '78 หมู่บ้านสุขใจ ซอย 5', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7455, lng: 100.9650,
    conditions: ['เบาหวาน', 'ต้อกระจก'],
    blood_type: 'B+', allergies: 'แอสไพริน', status: 'inactive',
    treatments: [
      { id: 'T-004', patient_id: 'PT-003', date: '2024-05-20', doctor: 'นพ.สมศักดิ์ มองดี', diagnosis: 'ตรวจตา', note: 'ผ่าตัดต้อกระจกข้างขวาเรียบร้อย', next_visit: '2024-08-20' },
    ],
  },
  {
    id: 'PT-004', hn: 'HN-2024-004',
    first_name: 'สุนีย์', last_name: 'ยืนยาว',
    birth_date: '1988-02-14', gender: 'หญิง',
    phone: '094-555-6666', emergency_contact: 'ธนา ยืนยาว', emergency_phone: '094-555-6667',
    address: '200 หมู่ 7 ถนนชลบุรี', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7530, lng: 100.9560,
    conditions: ['ไทรอยด์'],
    blood_type: 'AB+', allergies: '-', status: 'active',
    treatments: [
      { id: 'T-005', patient_id: 'PT-004', date: '2024-06-15', doctor: 'นพ.กิตติ ต่อมดี', diagnosis: 'ติดตามไทรอยด์', note: 'TSH ปกติ ลดยาลง', next_visit: '2024-09-15' },
    ],
  },
  {
    id: 'PT-005', hn: 'HN-2024-005',
    first_name: 'บุญมี', last_name: 'สุขใจ',
    birth_date: '1942-09-30', gender: 'ชาย',
    phone: '065-333-4444', emergency_contact: 'บุปผา สุขใจ', emergency_phone: '065-333-4445',
    address: '15 ซอยบ้านพัก ม.2', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7470, lng: 100.9630,
    conditions: ['ความดันโลหิตสูง', 'โรคไต', 'เบาหวาน'],
    blood_type: 'A-', allergies: 'Sulfa drugs', status: 'critical',
    treatments: [
      { id: 'T-006', patient_id: 'PT-005', date: '2024-06-20', doctor: 'นพ.วิทยา ไตดี', diagnosis: 'ติดตามโรคไต', note: 'Creatinine 2.1 ต้องติดตามใกล้ชิด', next_visit: '2024-07-20' },
    ],
  },
];

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchPatients(): Promise<Patient[]> {
  if (!isSupabaseEnabled || !supabase) {
    console.debug('[patientData] supabase not configured — using mock data');
    return MOCK_PATIENTS;
  }

  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      treatments:patient_treatments (
        id, patient_id, date, doctor, diagnosis, note, next_visit, created_at
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...row,
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    treatments: (row.treatments ?? []).sort(
      (a: TreatmentRecord, b: TreatmentRecord) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
  })) as Patient[];
}

export async function fetchPatientById(id: string): Promise<Patient | null> {
  if (!isSupabaseEnabled || !supabase) {
    return MOCK_PATIENTS.find((p) => p.id === id) ?? null;
  }

  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      treatments:patient_treatments (
        id, patient_id, date, doctor, diagnosis, note, next_visit, created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...data,
    conditions: Array.isArray(data.conditions) ? data.conditions : [],
    treatments: (data.treatments ?? []).sort(
      (a: TreatmentRecord, b: TreatmentRecord) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    ),
  } as Patient;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPatient(input: NewPatientInput): Promise<Patient> {
  if (!isSupabaseEnabled || !supabase) {
    const newPt: Patient = {
      id: 'PT-' + Date.now(),
      hn: input.hn ?? 'HN-' + Date.now(),
      ...input,
      treatments: [],
      created_at: new Date().toISOString(),
    };
    MOCK_PATIENTS.unshift(newPt);
    return newPt;
  }

  const { data, error } = await supabase
    .from('patients')
    .insert({
      hn: input.hn ?? null,
      first_name: input.first_name,
      last_name: input.last_name,
      birth_date: input.birth_date,
      gender: input.gender,
      phone: input.phone ?? null,
      emergency_contact: input.emergency_contact ?? null,
      emergency_phone: input.emergency_phone ?? null,
      address: input.address,
      subdistrict: input.subdistrict ?? null,
      district: input.district ?? null,
      blood_type: input.blood_type ?? null,
      allergies: input.allergies ?? null,
      conditions: input.conditions,
      status: input.status,
      lat: input.lat,
      lng: input.lng,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...(data as Patient), conditions: input.conditions, treatments: [] };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updatePatient(id: string, input: Partial<NewPatientInput>): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    const idx = MOCK_PATIENTS.findIndex((p) => p.id === id);
    if (idx !== -1) Object.assign(MOCK_PATIENTS[idx], input);
    return;
  }

  const { error } = await supabase
    .from('patients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePatient(id: string): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    const idx = MOCK_PATIENTS.findIndex((p) => p.id === id);
    if (idx !== -1) MOCK_PATIENTS.splice(idx, 1);
    return;
  }

  const { error } = await supabase.from('patients').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Treatments ───────────────────────────────────────────────────────────────

export async function addTreatment(input: NewTreatmentInput): Promise<TreatmentRecord> {
  if (!isSupabaseEnabled || !supabase) {
    const record: TreatmentRecord = {
      id: 'T-' + Date.now(),
      ...input,
      created_at: new Date().toISOString(),
    };
    const pt = MOCK_PATIENTS.find((p) => p.id === input.patient_id);
    if (pt) pt.treatments = [record, ...(pt.treatments ?? [])];
    return record;
  }

  const { data, error } = await supabase
    .from('patient_treatments')
    .insert({
      patient_id: input.patient_id,
      date: input.date,
      doctor: input.doctor ?? null,
      diagnosis: input.diagnosis,
      note: input.note ?? null,
      next_visit: input.next_visit ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TreatmentRecord;
}

export async function deleteTreatment(treatmentId: string): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    for (const pt of MOCK_PATIENTS) {
      if (pt.treatments) {
        pt.treatments = pt.treatments.filter((t) => t.id !== treatmentId);
      }
    }
    return;
  }

  const { error } = await supabase
    .from('patient_treatments')
    .delete()
    .eq('id', treatmentId);

  if (error) throw new Error(error.message);
}