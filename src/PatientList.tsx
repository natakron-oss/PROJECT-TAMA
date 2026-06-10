// src/PatientList.tsx
import { useMemo, useState } from 'react';
import { RefreshCw, Search, Plus } from 'lucide-react';
import type { Patient, PatientStatus } from './patientTypes';
import { PATIENT_STATUS_CONFIG, calcAge, getConditionColor, avatarColor, initials } from './patientTypes';
import './Patient.css';

interface PatientListProps {
  patients: Patient[];
  loading: boolean;
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  onAddTreatment: (patient: Patient) => void;
  onDeletePatient: (id: string) => void;
  onRefresh: () => void;
}

// 1. อัปเดตแท็บตัวกรองด้านบนให้เป็นสถานะใหม่ทั้งหมด
const FILTER_TABS: { value: 'all' | PatientStatus; label: string }[] = [
  { value: 'all',      label: 'ทั้งหมด' },
  { value: 'general',  label: 'ทั่วไป' },
  { value: 'elderly',  label: 'ผู้สูงอายุ' },
  { value: 'disabled', label: 'ผู้พิการ' },
  { value: 'finished', label: 'จำหน่าย' },
];

export default function PatientList({
  patients,
  loading,
  onSelectPatient,
  onAddPatient,
  onAddTreatment,
  onDeletePatient,
  onRefresh,
}: PatientListProps) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | PatientStatus>('all');

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        // จุดที่ 2: ลบ p.hn ออกจากฟังก์ชันค้นหา เพื่อไม่ให้ตัวแปรพัง
        return `${p.first_name} ${p.last_name} ${p.phone}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [patients, filter, search]);

  return (
    <div className="pt-page">
      <div className="pt-page-header">
        <div>
          <h1 className="pt-page-title">👥 รายชื่อผู้ป่วย</h1>
          <p className="pt-page-sub">ทั้งหมด {patients.length} ราย</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="pt-btn pt-btn-secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
          <button className="pt-btn pt-btn-primary" onClick={onAddPatient}>
            <Plus size={16} /> เพิ่มผู้ป่วย
          </button>
        </div>
      </div>

      <div className="pt-card">
        {/* Toolbar */}
        <div className="pt-toolbar">
          <div className="pt-search-box">
            <Search size={16} color="#94a3b8" />
            <input
              className="pt-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, เบอร์โทร..." // เอาคำว่า HN ออก
            />
          </div>
          <div className="pt-filter-tabs">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`pt-filter-tab ${filter === tab.value ? 'active' : ''}`}
                onClick={() => setFilter(tab.value)}
              >
                {tab.label}
                <span className="pt-tab-count">
                  {tab.value === 'all'
                    ? patients.length
                    : patients.filter((p) => p.status === tab.value).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="pt-table-wrap">
          <table className="pt-table">
            <thead>
              <tr>
                <th>ผู้ป่วย</th>
                <th>อายุ / เพศ</th>
                <th>โรคประจำตัว</th>
                <th>เบอร์โทร</th>
                {/* จุดที่ 3: ลบ <th>กรุ๊ปเลือด</th> ออกไปแล้ว */}
                <th>การรักษาล่าสุด</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pt) => {
                const sc = PATIENT_STATUS_CONFIG[pt.status];
                const lastTreatment = pt.treatments?.[0];
                return (
                  <tr
                    key={pt.id}
                    className="pt-table-row"
                    onClick={() => onSelectPatient(pt)}
                  >
                    <td>
                      <div className="pt-table-patient">
                        <div
                          className="pt-avatar pt-avatar-sm"
                          style={{ background: avatarColor(pt.first_name) }}
                        >
                          {initials(pt.first_name, pt.last_name)}
                        </div>
                        <div>
                          {/* ลบแถบแสดงผลโค้ด HN ใต้ชื่อผู้ป่วยออกแล้ว */}
                          <div className="pt-patient-name">{pt.first_name} {pt.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{calcAge(pt.birth_date)} ปี ({pt.gender})</td>
                    <td>
                      {pt.conditions.slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="pt-condition-tag"
                          style={{ background: getConditionColor(c) + '22', color: getConditionColor(c) }}
                        >
                          {c}
                        </span>
                      ))}
                      {pt.conditions.length > 2 && (
                        <span className="pt-condition-more">+{pt.conditions.length - 2}</span>
                      )}
                    </td>
                    <td style={{ color: '#475569' }}>{pt.phone || '—'}</td>
                    
                    {/* ลบช่อง <td> กรุ๊ปเลือด ออกไปเรียบร้อยแล้ว */}

                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {lastTreatment
                        ? <>
                            <div>{new Date(lastTreatment.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                            <div style={{ color: '#94a3b8' }}>{lastTreatment.diagnosis}</div>
                          </>
                        : '—'
                      }
                    </td>
                    <td>
                      <span className="pt-status-badge" style={{ background: sc?.bg ?? '#f1f5f9', color: sc?.color ?? '#64748b' }}>
                        <span className="pt-dot" style={{ background: sc?.color ?? '#64748b' }} />
                        {sc?.label ?? 'ไม่ระบุ'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="pt-action-btn"
                          onClick={() => onSelectPatient(pt)}
                        >
                          ดูข้อมูล
                        </button>
                        <button
                          className="pt-action-btn pt-action-btn-blue"
                          onClick={() => onAddTreatment(pt)}
                        >
                          + รักษา
                        </button>
                        <button
                          className="pt-action-btn pt-action-btn-danger"
                          onClick={() => onDeletePatient(pt.id)}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="pt-empty">
              {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่พบผู้ป่วยที่ตรงกับเงื่อนไข'}
            </div>
          )}
        </div>

        <div className="pt-table-footer">
          แสดง {filtered.length} จาก {patients.length} ราย
        </div>
      </div>
    </div>
  );
}