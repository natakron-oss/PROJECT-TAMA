// src/PatientDashboard.tsx
import { useMemo, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Archive, UserPlus, LogIn, LogOut, UserCheck } from 'lucide-react';
import type { Patient } from './patientTypes';
import { PATIENT_STATUS_CONFIG, calcAge, avatarColor, initials } from './patientTypes';
import './Patient.css';

interface PatientDashboardProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  currentUser?: string;
  isLoggedIn?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function PatientDashboard({
  patients,
  onSelectPatient,
  onAddPatient,
  currentUser,
  isLoggedIn,
  onLogin,
  onLogout,
}: PatientDashboardProps) {
  const counts = useMemo(() => ({
    total:    patients.length,
    general:  patients.filter((p) => p.status === 'general').length,
    disabled: patients.filter((p) => p.status === 'disabled').length,
    elderly:  patients.filter((p) => p.status === 'elderly').length,
    finished: patients.filter((p) => p.status === 'finished').length,
  }), [patients]);

  const carePatients = useMemo(() =>
    patients.filter((p) => p.status === 'general' || p.status === 'disabled' || p.status === 'elderly'),
    [patients]
  );

  const [listFilter, setListFilter] = useState<'all' | 'general' | 'elderly' | 'disabled'>('all');

  const displayedPatients = useMemo(() => {
    if (listFilter === 'all') return carePatients;
    return carePatients.filter((p) => p.status === listFilter);
  }, [carePatients, listFilter]);

  const recentPatients = useMemo(() =>
    [...patients]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 6),
    [patients],
  );

  const upcomingVisits = useMemo(() => {
    const today = new Date();
    const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    return patients
      .flatMap((p) =>
        (p.treatments ?? [])
          .filter((t) => t.next_visit && new Date(t.next_visit) >= today && new Date(t.next_visit) <= in14)
          .map((t) => ({ patient: p, treatment: t })),
      )
      .sort((a, b) => new Date(a.treatment.next_visit!).getTime() - new Date(b.treatment.next_visit!).getTime())
      .slice(0, 5);
  }, [patients]);

  const stats = [
    { label: 'ผู้ป่วยทั้งหมด', val: counts.total,    icon: <Users size={22} />,        bg: '#eff6ff', ic: '#2563eb' },
    { label: 'ผู้ป่วยทั่วไป',   val: counts.general,  icon: <UserCheck size={22} />,    bg: '#ecfdf5', ic: '#10b981' },
    { label: 'ผู้สูงอายุ',      val: counts.elderly,  icon: <AlertTriangle size={22} />, bg: '#fef2f2', ic: '#ef4444' },
    { label: 'ผู้พิการ',        val: counts.disabled, icon: <CheckCircle size={22} />,   bg: '#ecfdf5', ic: '#0051ff' },
    { label: 'จำหน่าย',        val: counts.finished, icon: <Archive size={22} />,       bg: '#f8fafc', ic: '#64748b' },
  ];

  const userAvatarBg = (name: string) => {
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="pt-page">
      <div className="pt-page-header">
        <div>
          <h1 className="pt-page-title">📊 ภาพรวมระบบผู้ป่วย</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p className="pt-page-sub" style={{ margin: 0 }}>เทศบาลตำบลสันผักหวาน — ข้อมูล ณ วันนี้</p>

            {isLoggedIn && (
              <button
                className="pt-btn pt-btn-primary"
                onClick={onAddPatient}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 14px' }}
              >
                <UserPlus size={15} />
                + เพิ่มผู้ป่วยใหม่
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          {isLoggedIn && currentUser ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: userAvatarBg(currentUser),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '15px', flexShrink: 0,
                }}>
                  {currentUser.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{currentUser}</span>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>ออนไลน์</div>
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: 'transparent', border: '1px solid #fbcfe8',
                  color: '#be185d', cursor: 'pointer', fontSize: '13px',
                }}
              >
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #db2777, #be185d)',
                color: 'white', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px',
                boxShadow: '0 4px 14px rgba(219,39,119,0.35)',
              }}
            >
              <LogIn size={15} /> เข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>

      <div className="pt-stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="pt-stat-card">
            <div className="pt-stat-icon" style={{ background: s.bg, color: s.ic }}>{s.icon}</div>
            <div>
              <div className="pt-stat-num">{s.val}</div>
              <div className="pt-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-two-col">
        <div className="pt-card">
          <div className="pt-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="pt-card-title">🚨 รายชื่อผู้ป่วยในการดูแล</span>
              <span className="pt-badge-red">{displayedPatients.length} ราย</span>
            </div>
            <select
              className="pt-select"
              style={{ padding: '4px 30px 4px 12px', fontSize: '13px', borderRadius: '8px', minHeight: '32px' }}
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value as 'all' | 'general' | 'elderly' | 'disabled')}
            >
              <option value="all">ดูทั้งหมด</option>
              <option value="general">ทั่วไป</option>
              <option value="elderly">ผู้สูงอายุ</option>
              <option value="disabled">ผู้พิการ</option>
            </select>
          </div>

          {displayedPatients.length === 0 ? (
            <div className="pt-empty">ไม่มีผู้ป่วยในหมวดหมู่นี้ 🎉</div>
          ) : (
            displayedPatients.map((pt) => (
              <div
                key={pt.id}
                className="pt-patient-row"
                onClick={() => isLoggedIn && onSelectPatient(pt)}
                style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}
              >
                <div className="pt-avatar" style={{ background: avatarColor(pt.first_name) }}>
                  {initials(pt.first_name, pt.last_name)}
                </div>
                <div className="pt-patient-info">
                  <div className="pt-patient-name">{pt.first_name} {pt.last_name}</div>
                  <div className="pt-patient-sub">{pt.conditions.join(', ') || '—'}</div>
                </div>
                <div className="pt-patient-age">{calcAge(pt.birth_date)} ปี</div>
              </div>
            ))
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <span className="pt-card-title">📅 นัดหมายใน 14 วันข้างหน้า</span>
            <span className="pt-badge-blue">{upcomingVisits.length} ราย</span>
          </div>
          {upcomingVisits.length === 0 ? (
            <div className="pt-empty">ไม่มีนัดหมายในช่วงนี้</div>
          ) : (
            upcomingVisits.map(({ patient: pt, treatment: t }) => (
              <div
                key={t.id}
                className="pt-patient-row"
                onClick={() => isLoggedIn && onSelectPatient(pt)}
                style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}
              >
                <div className="pt-avatar pt-avatar-sm" style={{ background: avatarColor(pt.first_name) }}>
                  {initials(pt.first_name, pt.last_name)}
                </div>
                <div className="pt-patient-info">
                  <div className="pt-patient-name">{pt.first_name} {pt.last_name}</div>
                  <div className="pt-patient-sub">{t.diagnosis}</div>
                </div>
                <div className="pt-visit-date">
                  {new Date(t.next_visit!).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-card" style={{ marginTop: '20px' }}>
        <div className="pt-card-head">
          <span className="pt-card-title">👥 รายการผู้ป่วยล่าสุด</span>
        </div>
        <table className="pt-table">
          <thead>
            <tr>
              <th>ผู้ป่วย</th>
              <th>อายุ</th>
              <th>โรคประจำตัว</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {recentPatients.map((pt) => {
              const sc = PATIENT_STATUS_CONFIG[pt.status];
              return (
                <tr
                  key={pt.id}
                  onClick={() => isLoggedIn && onSelectPatient(pt)}
                  className="pt-table-row"
                  style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}
                >
                  <td>
                    <div className="pt-table-patient">
                      <div className="pt-avatar pt-avatar-sm" style={{ background: avatarColor(pt.first_name) }}>
                        {initials(pt.first_name, pt.last_name)}
                      </div>
                      <div>
                        <div className="pt-patient-name">{pt.first_name} {pt.last_name}</div>
                        <div className="pt-patient-sub">{pt.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td>{calcAge(pt.birth_date)} ปี ({pt.gender})</td>
                  <td>
                    {pt.conditions.slice(0, 2).map((c) => (
                      <span key={c} className="pt-condition-tag" style={{ background: '#f1f5f9', color: '#475569' }}>{c}</span>
                    ))}
                    {pt.conditions.length > 2 && (
                      <span className="pt-condition-more">+{pt.conditions.length - 2}</span>
                    )}
                  </td>
                  <td>
                    <span className="pt-status-badge" style={{ background: sc?.bg ?? '#f1f5f9', color: sc?.color ?? '#64748b' }}>
                      <span className="pt-dot" style={{ background: sc?.color ?? '#64748b' }} />
                      {sc?.label ?? 'ไม่ระบุ'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}