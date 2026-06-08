// src/lib/patientData.ts
// ─── Google Sheets API v4 — อ่าน/เขียน/ลบ ข้อมูลผู้ป่วย ─────────────────────
//
// env ที่ต้องใส่ใน .env:
//   VITE_PATIENT_SPREADSHEET_ID=1abc...     ← Spreadsheet ID
//   VITE_GOOGLE_API_KEY=AIza...             ← สำหรับ อ่าน
//   VITE_GOOGLE_SA_EMAIL=xxx@iam.gserviceaccount.com
//   VITE_GOOGLE_SA_KEY=-----BEGIN PRIVATE KEY-----\nMII...  (แทน newline ด้วย \n)
//
// โครงสร้าง Sheet "patients" (row 1 = header):
//   A=id | B=hn | C=first_name | D=last_name | E=birth_date | F=gender
//   G=phone | H=emergency_contact | I=emergency_phone | J=address
//   K=subdistrict | L=district | M=blood_type | N=allergies
//   O=conditions(JSON) | P=status | Q=lat | R=lng | S=created_at
//
// โครงสร้าง Sheet "treatments" (row 1 = header):
//   A=id | B=patient_id | C=date | D=doctor | E=diagnosis
//   F=note | G=next_visit | H=created_at

import type { Patient, NewPatientInput, NewTreatmentInput, TreatmentRecord } from '../patientTypes';

const SPREADSHEET_ID = (import.meta.env.VITE_PATIENT_SPREADSHEET_ID as string) ?? '';
const API_KEY        = (import.meta.env.VITE_GOOGLE_API_KEY as string) ?? '';
const SA_EMAIL       = (import.meta.env.VITE_GOOGLE_SA_EMAIL as string) ?? '';
const SA_KEY         = ((import.meta.env.VITE_GOOGLE_SA_KEY as string) ?? '').replace(/\\n/g, '\n');

const SHEETS_BASE      = 'https://sheets.googleapis.com/v4/spreadsheets';
const PATIENTS_SHEET   = 'patients';
const TREATMENTS_SHEET = 'treatments';

const isMockMode = () => !SPREADSHEET_ID || !API_KEY;

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PATIENTS: Patient[] = [
  {
    id: 'PT-001', hn: 'HN-2024-001',
    first_name: 'สมชาย', last_name: 'ใจดี', birth_date: '1965-03-12', gender: 'ชาย',
    phone: '081-234-5678', emergency_contact: 'สมหญิง ใจดี', emergency_phone: '081-234-5679',
    address: '123 ซอยสุขสันต์ หมู่ 3', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7489, lng: 100.9614, conditions: ['เบาหวาน', 'ความดันโลหิตสูง'],
    blood_type: 'A+', allergies: 'ยาเพนิซิลิน', status: 'active',
    treatments: [{ id: 'T-001', patient_id: 'PT-001', date: '2024-06-01', doctor: 'นพ.วิชัย สุขสม', diagnosis: 'ติดตามเบาหวาน', note: 'HbA1c 7.2', next_visit: '2024-09-01' }],
  },
  {
    id: 'PT-002', hn: 'HN-2024-002',
    first_name: 'มาลี', last_name: 'รักสุขภาพ', birth_date: '1978-11-25', gender: 'หญิง',
    phone: '089-876-5432', emergency_contact: 'วิชัย รักสุขภาพ', emergency_phone: '089-876-5433',
    address: '45 ถนนพลูตาหลวง', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7512, lng: 100.9589, conditions: ['โรคหัวใจ'],
    blood_type: 'O+', allergies: '-', status: 'active', treatments: [],
  },
  {
    id: 'PT-003', hn: 'HN-2024-003',
    first_name: 'บุญมี', last_name: 'สุขใจ', birth_date: '1942-09-30', gender: 'ชาย',
    phone: '065-333-4444', emergency_contact: 'บุปผา สุขใจ', emergency_phone: '065-333-4445',
    address: '15 ซอยบ้านพัก ม.2', subdistrict: 'พลูตาหลวง', district: 'สัตหีบ',
    lat: 12.7470, lng: 100.9630, conditions: ['ความดันโลหิตสูง', 'โรคไต', 'เบาหวาน'],
    blood_type: 'A-', allergies: 'Sulfa drugs', status: 'critical', treatments: [],
  },
];

// ─── JWT / OAuth2 ─────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  if (!SA_EMAIL || !SA_KEY) throw new Error('ยังไม่ได้ตั้งค่า VITE_GOOGLE_SA_EMAIL / VITE_GOOGLE_SA_KEY');

  const now   = Math.floor(Date.now() / 1000);
  const enc   = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const header  = enc({ alg: 'RS256', typ: 'JWT' });
  const payload = enc({ iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now });
  const data    = `${header}.${payload}`;

  const keyData   = SA_KEY.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
  const sig       = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

  const res  = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${data}.${sig}` }) });
  if (!res.ok) throw new Error(`OAuth2 error ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

// ─── Sheet I/O ────────────────────────────────────────────────────────────────
async function readSheet(sheet: string): Promise<string[][]> {
  const res = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}?key=${API_KEY}`);
  if (!res.ok) throw new Error(`อ่าน Sheet "${sheet}" ไม่สำเร็จ: ${res.status}`);
  return ((await res.json()) as { values?: string[][] }).values ?? [];
}

async function appendRow(sheet: string, values: string[]): Promise<void> {
  const token = await getAccessToken();
  const res   = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [values] }) });
  if (!res.ok) throw new Error(`เพิ่มแถวไม่สำเร็จ: ${res.status}`);
}

async function updateRow(sheet: string, rowIdx: number, values: string[]): Promise<void> {
  const token = await getAccessToken();
  const range = `${sheet}!A${rowIdx + 2}`;
  const res   = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [values] }) });
  if (!res.ok) throw new Error(`แก้ไขแถวไม่สำเร็จ: ${res.status}`);
}

async function clearRow(sheet: string, rowIdx: number): Promise<void> {
  const token = await getAccessToken();
  const range = `${sheet}!A${rowIdx + 2}:Z${rowIdx + 2}`;
  const res   = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:clear`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`ลบแถวไม่สำเร็จ: ${res.status}`);
}

// ─── Row converters ───────────────────────────────────────────────────────────
function rowToPatient(r: string[]): Patient | null {
  if (!r[0]?.trim()) return null;
  return {
    id: r[0], hn: r[1] ?? '', first_name: r[2] ?? '', last_name: r[3] ?? '',
    birth_date: r[4] ?? '', gender: (r[5] ?? 'ไม่ระบุ') as Patient['gender'],
    phone: r[6] ?? '', emergency_contact: r[7] ?? '', emergency_phone: r[8] ?? '',
    address: r[9] ?? '', subdistrict: r[10] ?? '', district: r[11] ?? '',
    blood_type: r[12] ?? '', allergies: r[13] ?? '',
    conditions: safeJSON<string[]>(r[14], []),
    status: (r[15] ?? 'active') as Patient['status'],
    lat: parseFloat(r[16] ?? '0') || 0, lng: parseFloat(r[17] ?? '0') || 0,
    created_at: r[18] ?? '', treatments: [],
  };
}

function rowToTreatment(r: string[]): TreatmentRecord | null {
  if (!r[0]?.trim()) return null;
  return { id: r[0], patient_id: r[1] ?? '', date: r[2] ?? '', doctor: r[3] ?? '', diagnosis: r[4] ?? '', note: r[5] ?? '', next_visit: r[6] ?? '', created_at: r[7] ?? '' };
}

function patientToRow(p: NewPatientInput, id: string, createdAt?: string): string[] {
  return [id, p.hn ?? '', p.first_name, p.last_name, p.birth_date, p.gender, p.phone ?? '', p.emergency_contact ?? '', p.emergency_phone ?? '', p.address ?? '', p.subdistrict ?? '', p.district ?? '', p.blood_type ?? '', p.allergies ?? '', JSON.stringify(p.conditions ?? []), p.status, String(p.lat), String(p.lng), createdAt ?? new Date().toISOString()];
}

function treatmentToRow(t: NewTreatmentInput, id: string): string[] {
  return [id, t.patient_id, t.date, t.doctor ?? '', t.diagnosis, t.note ?? '', t.next_visit ?? '', new Date().toISOString()];
}

function safeJSON<T>(s: string, fb: T): T {
  try { return JSON.parse(s) as T; } catch { return fb; }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function fetchPatients(): Promise<Patient[]> {
  if (isMockMode()) { console.debug('[patientData] mock mode'); return MOCK_PATIENTS; }

  const [pRows, tRows] = await Promise.all([readSheet(PATIENTS_SHEET), readSheet(TREATMENTS_SHEET)]);
  const patients   = pRows.slice(1).map(rowToPatient).filter(Boolean) as Patient[];
  const treatments = tRows.slice(1).map(rowToTreatment).filter(Boolean) as TreatmentRecord[];

  const map = new Map(patients.map((p) => [p.id, p]));
  treatments.forEach((t) => { const p = map.get(t.patient_id); if (p) p.treatments!.unshift(t); });
  patients.forEach((p) => { p.treatments = (p.treatments ?? []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); });

  return patients;
}

export async function fetchPatientById(id: string): Promise<Patient | null> {
  return (await fetchPatients()).find((p) => p.id === id) ?? null;
}

export async function createPatient(input: NewPatientInput): Promise<Patient> {
  if (isMockMode()) {
    const p: Patient = { id: genId('PT'), hn: input.hn ?? genId('HN'), ...input, treatments: [], created_at: new Date().toISOString() };
    MOCK_PATIENTS.unshift(p); return p;
  }
  const id = genId('PT');
  const row = patientToRow(input, id);
  await appendRow(PATIENTS_SHEET, row);
  return { id, hn: input.hn ?? '', ...input, treatments: [], created_at: row[18] };
}

export async function updatePatient(id: string, input: Partial<NewPatientInput>): Promise<void> {
  if (isMockMode()) { const i = MOCK_PATIENTS.findIndex((p) => p.id === id); if (i !== -1) Object.assign(MOCK_PATIENTS[i], input); return; }

  const rows = await readSheet(PATIENTS_SHEET);
  const data = rows.slice(1);
  const idx  = data.findIndex((r) => r[0] === id);
  if (idx === -1) throw new Error(`ไม่พบผู้ป่วย id: ${id}`);

  const existing = rowToPatient(data[idx])!;
  const merged   = { ...existing, ...input, conditions: input.conditions ?? existing.conditions };
  await updateRow(PATIENTS_SHEET, idx, patientToRow(merged, id, existing.created_at));
}

export async function deletePatient(id: string): Promise<void> {
  if (isMockMode()) { const i = MOCK_PATIENTS.findIndex((p) => p.id === id); if (i !== -1) MOCK_PATIENTS.splice(i, 1); return; }

  // ลบ treatments ก่อน (จากล่างขึ้นบน ไม่งั้น index เลื่อน)
  const tRows = await readSheet(TREATMENTS_SHEET);
  const tIdxs = tRows.slice(1).map((r, i) => r[1] === id ? i : -1).filter((i) => i !== -1).reverse();
  for (const i of tIdxs) await clearRow(TREATMENTS_SHEET, i);

  const pRows = await readSheet(PATIENTS_SHEET);
  const pIdx  = pRows.slice(1).findIndex((r) => r[0] === id);
  if (pIdx !== -1) await clearRow(PATIENTS_SHEET, pIdx);
}

export async function addTreatment(input: NewTreatmentInput): Promise<TreatmentRecord> {
  if (isMockMode()) {
    const record: TreatmentRecord = { id: genId('T'), ...input, created_at: new Date().toISOString() };
    const p = MOCK_PATIENTS.find((x) => x.id === input.patient_id);
    if (p) p.treatments = [record, ...(p.treatments ?? [])];
    return record;
  }
  const id  = genId('T');
  const row = treatmentToRow(input, id);
  await appendRow(TREATMENTS_SHEET, row);
  return { id, ...input, created_at: row[7] };
}

export async function deleteTreatment(treatmentId: string): Promise<void> {
  if (isMockMode()) { MOCK_PATIENTS.forEach((p) => { p.treatments = (p.treatments ?? []).filter((t) => t.id !== treatmentId); }); return; }

  const rows = await readSheet(TREATMENTS_SHEET);
  const idx  = rows.slice(1).findIndex((r) => r[0] === treatmentId);
  if (idx !== -1) await clearRow(TREATMENTS_SHEET, idx);
}