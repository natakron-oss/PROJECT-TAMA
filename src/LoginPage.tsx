// src/LoginPage.tsx
import { useState } from 'react';
import { Activity, Lock, User, UserPlus } from 'lucide-react';

const SPREADSHEET_ID = (import.meta.env.VITE_PATIENT_SPREADSHEET_ID as string) ?? '';
const API_KEY        = (import.meta.env.VITE_GOOGLE_API_KEY as string) ?? '';
const SA_EMAIL       = (import.meta.env.VITE_GOOGLE_SA_EMAIL as string) ?? '';
const SA_KEY         = ((import.meta.env.VITE_GOOGLE_SA_KEY as string) ?? '').replace(/\\n/g, '\n');
const SHEETS_BASE    = 'https://sheets.googleapis.com/v4/spreadsheets';
const USERS_SHEET    = 'user';

const isMockMode = () => !SPREADSHEET_ID || !API_KEY;

const MOCK_USERS = [
  { id: 'U-001', username: 'admin', password: 'admin123', role: 'admin' },
  { id: 'U-002', username: 'user',  password: 'user123',  role: 'user'  },
];

async function getAccessToken(): Promise<string> {
  const now     = Math.floor(Date.now() / 1000);
  const enc     = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const header  = enc({ alg: 'RS256', typ: 'JWT' });
  const payload = enc({ iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now });
  const data    = `${header}.${payload}`;
  const keyData   = SA_KEY.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
  const sig       = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${data}.${sig}` }) });
  if (!res.ok) throw new Error(`OAuth2 error ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function fetchUsers() {
  const res = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${USERS_SHEET}?key=${API_KEY}`);
  if (!res.ok) throw new Error('อ่าน Sheet user ไม่สำเร็จ');
  const rows: string[][] = ((await res.json()) as { values?: string[][] }).values ?? [];
  return rows.slice(1).filter((r) => r[0]?.trim()).map((r) => ({
    id: r[0], username: r[1] ?? '', password: r[2] ?? '', role: r[3] ?? 'user',
  }));
}

async function registerUser(username: string, password: string) {
  const token = await getAccessToken();
  const id    = `U-${Date.now()}`;
  const row   = [id, username, password, 'user', new Date().toISOString()];
  const res   = await fetch(
    `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${USERS_SHEET}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) }
  );
  if (!res.ok) throw new Error('สมัครสมาชิกไม่สำเร็จ');
  return { id, username, password, role: 'user' };
}

interface LoginPageProps {
  onLogin: (username: string, role: string) => void; // ✅ เพิ่ม role
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setLoading(true); setError('');
    try {
      const users = isMockMode() ? MOCK_USERS : await fetchUsers();
      const found = users.find((u) => u.username === username && u.password === password);
      if (found) {
        onLogin(found.username, found.role); // ✅ ส่ง role ด้วย
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password || !confirm) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setLoading(true); setError('');
    try {
      const users = isMockMode() ? MOCK_USERS : await fetchUsers();
      if (users.find((u) => u.username === username)) { setError('ชื่อผู้ใช้นี้มีอยู่แล้ว'); return; }
      if (isMockMode()) {
        MOCK_USERS.push({ id: `U-${Date.now()}`, username, password, role: 'user' });
      } else {
        await registerUser(username, password);
      }
      onLogin(username, 'user'); // ✅ user ใหม่ได้ role = 'user' เสมอ
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m); setError(''); setUsername(''); setPassword(''); setConfirm('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Activity size={28} color="white" />
          </div>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b' }}>ระบบผู้ป่วย</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>เทศบาลตำบลสันผักหวาน</div>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? '#2563eb' : '#64748b',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
              {m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>ชื่อผู้ใช้</label>
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="กรอกชื่อผู้ใช้"
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>รหัสผ่าน</label>
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="กรอกรหัสผ่าน"
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {mode === 'register' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>ยืนยันรหัสผ่าน</label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', color: '#ef4444', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <button
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {mode === 'login'
            ? (loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ')
            : (loading ? 'กำลังสมัคร...' : <><UserPlus size={16} /> สมัครสมาชิก</>)
          }
        </button>
      </div>
    </div>
  );
}