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
//   A=id | B=first_name | C=last_name | D=birth_date | E=gender
//   F=phone | G=emergency_contact | H=emergency_phone | I=address
//   J=subdistrict | K=district | L=allergies | M=conditions
//   N=status | O=lat | P=lng | Q=created_at | R=treatment_type | S=treatments_list
//
// โครงสร้าง Sheet "treatments" (row 1 = header):
//   A=id | B=patient_id | C=date | D=doctor | E=diagnosis
//   F=note | G=next_visit | H=created_at | I=procedure

import type { Patient, NewPatientInput, NewTreatmentInput, TreatmentRecord } from '../patientTypes';

const SPREADSHEET_ID = (import.meta.env.VITE_PATIENT_SPREADSHEET_ID as string) ?? '';
const API_KEY        = (import.meta.env.VITE_GOOGLE_API_KEY as string) ?? '';
const SA_EMAIL       = (import.meta.env.VITE_GOOGLE_SA_EMAIL as string) ?? '';
const SA_KEY         = ((import.meta.env.VITE_GOOGLE_SA_KEY as string) ?? '').replace(/\\n/g, '\n');

const SHEETS_BASE      = 'https://sheets.googleapis.com/v4/spreadsheets';
const PATIENTS_SHEET   = 'patients';
const TREATMENTS_SHEET = 'treatments';

const isMockMode = () => !SPREADSHEET_ID || !API_KEY;
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
    id: r[0], first_name: r[1] ?? '', last_name: r[2] ?? '',
    birth_date: r[3] ?? '', gender: (r[4] ?? 'ไม่ระบุ') as Patient['gender'],
    phone: r[5] ?? '', emergency_contact: r[6] ?? '', emergency_phone: r[7] ?? '',
    address: r[8] ?? '', subdistrict: r[9] ?? '', district: r[10] ?? '',
    allergies: r[11] ?? '',
    conditions: safeJSON<string[]>(r[12], []).filter((c): c is string => typeof c === 'string'),
    status: (['general', 'disabled', 'elderly', 'finished'].includes(r[13]) ? r[13] : 'general') as Patient['status'],
    lat: parseFloat(r[14] ?? '0') || 0, lng: parseFloat(r[15] ?? '0') || 0,
    created_at: r[16] ?? '', treatments: [],
    treatment_type: r[17] ?? '',
    treatments_list: safeJSON<string[]>(r[18], []),
  };
}

function rowToTreatment(r: string[]): TreatmentRecord | null {
  if (!r[0]?.trim()) return null;
  return {
    id: r[0], patient_id: r[1] ?? '', date: r[2] ?? '',
    doctor: r[3] ?? '', diagnosis: r[4] ?? '',
    note: r[5] ?? '', next_visit: r[6] ?? '',
    created_at: r[7] ?? '',
    procedure: r[8] ?? '',
  };
}

function patientToRow(p: NewPatientInput, id: string, createdAt?: string): string[] {
  return [
    id, p.first_name, p.last_name, p.birth_date, p.gender,
    p.phone ?? '', p.emergency_contact ?? '', p.emergency_phone ?? '',
    p.address ?? '', p.subdistrict ?? '', p.district ?? '',
    p.allergies ?? '', JSON.stringify(p.conditions ?? []),
    p.status,
    String(p.lat), String(p.lng),
    createdAt ?? new Date().toISOString(),
    p.treatment_type ?? '',
    JSON.stringify(p.treatments_list ?? []),
  ];
}

function treatmentToRow(t: NewTreatmentInput, id: string): string[] {
  return [
    id, t.patient_id, t.date, t.doctor ?? '', t.diagnosis,
    t.note ?? '', t.next_visit ?? '',
    new Date().toISOString(),
    t.procedure ?? '',
  ];
}

function safeJSON<T>(s: string, fb: T): T {
  try { return JSON.parse(s) as T; } catch { return fb; }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PATIENTS: Patient[] = [];

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
    const p: Patient = { id: genId('PT'), ...input, treatments: [], created_at: new Date().toISOString() };
    MOCK_PATIENTS.unshift(p); return p;
  }
  const id = genId('PT');
  const row = patientToRow(input, id);
  await appendRow(PATIENTS_SHEET, row);
  return { id, ...input, treatments: [], created_at: row[18] };
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