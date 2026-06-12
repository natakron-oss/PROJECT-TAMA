// src/LoginPage.tsx
import { useState } from 'react';
import { Activity, Lock, User } from 'lucide-react';

const SPREADSHEET_ID = (import.meta.env.VITE_PATIENT_SPREADSHEET_ID as string) ?? '';
const API_KEY        = (import.meta.env.VITE_GOOGLE_API_KEY as string) ?? '';
const SHEETS_BASE    = 'https://sheets.googleapis.com/v4/spreadsheets';
const USERS_SHEET    = 'user';

const isMockMode = () => !SPREADSHEET_ID || !API_KEY;

const MOCK_USERS = [
  { id: 'U-001', username: 'admin', password: 'admin123' },
  { id: 'U-002', username: 'user',  password: 'user123'  },
];

async function fetchUsers() {
  const res = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}/values/${USERS_SHEET}?key=${API_KEY}`);
  if (!res.ok) throw new Error('อ่าน Sheet user ไม่สำเร็จ');
  const rows: string[][] = ((await res.json()) as { values?: string[][] }).values ?? [];
  return rows.slice(1).filter((r) => r[0]?.trim()).map((r) => ({
    id: r[0], username: r[1] ?? '', password: r[2] ?? '',
  }));
}

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setLoading(true); setError('');
    try {
      const users = isMockMode() ? MOCK_USERS : await fetchUsers();
      const found = users.find((u) => u.username === username && u.password === password);
      if (found) {
        onLogin(found.username);
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
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
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#ef4444', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  );
}