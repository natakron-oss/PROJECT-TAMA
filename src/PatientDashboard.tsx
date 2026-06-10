// src/PatientDashboard.tsx
import { useMemo } from 'react';
import { Users, AlertTriangle, CheckCircle, Archive, UserPlus, LogIn, LogOut } from 'lucide-react';
import type { Patient } from './patientTypes';
import { PATIENT_STATUS_CONFIG, calcAge, avatarColor, initials } from './patientTypes';
import './Patient.css';

interface PatientDashboardProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  currentUser?: string;
  isLoggedIn?: boolean;   // เพิ่ม
  onLogin?: () => void;   // เพิ่ม
  onLogout?: () => void;  // เพิ่ม (optional ถ้าอยากให้ logout จาก header ด้วย)
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
    active:   patients.filter((p) => p.status === 'active').length,
    critical: patients.filter((p) => p.status === 'critical').length,
    inactive: patients.filter((p) => p.status === 'inactive').length,
  }), [patients]);

  const criticalPatients = useMemo(() =>
    patients.filter((p) => p.status === 'critical'), [patients]);

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
    { label: 'ผู้ป่วยทั้งหมด',  val: counts.total,    icon: <Users size={22} />,        bg: '#eff6ff', ic: '#2563eb' },
    { label: 'อยู่ในการดูแล',    val: counts.active,   icon: <CheckCircle size={22} />,   bg: '#ecfdf5', ic: '#10b981' },
    { label: 'ต้องเฝ้าระวัง',    val: counts.critical, icon: <AlertTriangle size={22} />, bg: '#fef2f2', ic: '#ef4444' },
    { label: 'ปิดเคสแล้ว',      val: counts.inactive, icon: <Archive size={22} />,       bg: '#f8fafc', ic: '#64748b' },
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
            <button
              className="pt-btn pt-btn-primary"
              onClick={onAddPatient}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 14px' }}
            >
              <UserPlus size={15} />
              + เพิ่มผู้ป่วยใหม่
            </button>
          </div>
        </div>

        {/* ขวาบน: แสดง user + ปุ่ม logout หรือปุ่ม login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          {isLoggedIn && currentUser ? (
            <>
              {/* Avatar + ชื่อ */}
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
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{currentUser}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>ออนไลน์</div>
                </div>
              </div>

              {/* ปุ่ม Logout */}
              <button
                onClick={onLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: 'transparent', border: '1px solid #e2e8f0',
                  color: '#64748b', cursor: 'pointer', fontSize: '13px',
                }}
              >
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </>
          ) : (
            /* ปุ่ม Login */
            <button
              onClick={onLogin}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px',
                background: '#2563eb', color: 'white',
                border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px',
              }}
            >
              <LogIn size={15} /> เข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
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
        {/* เฝ้าระวัง */}
        <div className="pt-card">
          <div className="pt-card-head">
            <span className="pt-card-title">🚨 ผู้ป่วยที่ต้องเฝ้าระวัง</span>
            <span className="pt-badge-red">{counts.critical} ราย</span>
          </div>
          {criticalPatients.length === 0 ? (
            <div className="pt-empty">ไม่มีผู้ป่วยที่ต้องเฝ้าระวัง 🎉</div>
          ) : (
            criticalPatients.map((pt) => (
              <div key={pt.id} className="pt-patient-row" onClick={() => onSelectPatient(pt)}>
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

        {/* นัดใน 14 วัน */}
        <div className="pt-card">
          <div className="pt-card-head">
            <span className="pt-card-title">📅 นัดหมายใน 14 วันข้างหน้า</span>
            <span className="pt-badge-blue">{upcomingVisits.length} ราย</span>
          </div>
          {upcomingVisits.length === 0 ? (
            <div className="pt-empty">ไม่มีนัดหมายในช่วงนี้</div>
          ) : (
            upcomingVisits.map(({ patient: pt, treatment: t }) => (
              <div key={t.id} className="pt-patient-row" onClick={() => onSelectPatient(pt)}>
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

      {/* ผู้ป่วยล่าสุด */}
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
                <tr key={pt.id} onClick={() => onSelectPatient(pt)} className="pt-table-row">
                  <td>
                    <div className="pt-table-patient">
                      <div className="pt-avatar pt-avatar-sm" style={{ background: avatarColor(pt.first_name) }}>
                        {initials(pt.first_name, pt.last_name)}
                      </div>
                      <div>
                        <div className="pt-patient-name">{pt.first_name} {pt.last_name}</div>
                        <div className="pt-patient-sub">{pt.hn}</div>
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
                    <span className="pt-status-badge" style={{ background: sc.bg, color: sc.color }}>
                      <span className="pt-dot" style={{ background: sc.color }} />
                      {sc.label}
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