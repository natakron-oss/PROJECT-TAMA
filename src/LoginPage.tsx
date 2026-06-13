// src/LoginPage.tsx
import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import logoImg from './assets/logo.jpg';

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
    <div className="login-page-root" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
      fontFamily: "'Sarabun', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        width: '380px',
        boxShadow: '0 8px 40px rgba(219,39,119,0.12)',
        border: '1px solid #fce7f3',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            overflow: 'hidden', margin: '0 auto 14px',
            boxShadow: '0 4px 16px rgba(219,39,119,0.2)',
            border: '3px solid #fbcfe8',
          }}>
            <img src={logoImg} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: '18px', color: '#1a0a12' }}>ระบบผู้ป่วย</div>
          <div style={{ fontSize: '13px', color: '#c084ab', marginTop: '4px' }}>เทศบาลตำบลสันผักหวาน</div>

          {/* divider */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #fbcfe8, transparent)', margin: '18px 0 0' }} />
        </div>

        {/* Username */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', color: '#6b2145', fontWeight: 600, display: 'block', marginBottom: '6px' }}>ชื่อผู้ใช้</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#f472b6' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="กรอกชื่อผู้ใช้"
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                border: '1.5px solid #fbcfe8', borderRadius: '10px',
                fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                fontFamily: "'Sarabun', sans-serif", color: '#1a0a12',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#f472b6'}
              onBlur={(e) => e.target.style.borderColor = '#fbcfe8'}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: '#6b2145', fontWeight: 600, display: 'block', marginBottom: '6px' }}>รหัสผ่าน</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#f472b6' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="กรอกรหัสผ่าน"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                border: '1.5px solid #fbcfe8', borderRadius: '10px',
                fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                fontFamily: "'Sarabun', sans-serif", color: '#1a0a12',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#f472b6'}
              onBlur={(e) => e.target.style.borderColor = '#fbcfe8'}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', color: '#ef4444',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', marginBottom: '14px',
            border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        {/* Button */}
        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: 700,
            fontFamily: "'Sarabun', sans-serif",
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(219,39,119,0.35)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  );
}