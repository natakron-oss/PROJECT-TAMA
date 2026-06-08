// src/PatientDetail.tsx
import { useState } from 'react';
import { X, Edit, Trash2, MapPin, Phone, Heart, AlertCircle, User } from 'lucide-react';
import type { Patient, TreatmentRecord } from './patientTypes';
import {
  PATIENT_STATUS_CONFIG,
  calcAge,
  getConditionColor,
  avatarColor,
  initials,
} from './patientTypes';
import './Patient.css';

interface PatientDetailProps {
  patient: Patient;
  onClose: () => void;
  onAddTreatment: (patient: Patient) => void;
  onDeleteTreatment: (treatmentId: string) => void;
  onEditPatient: (patient: Patient) => void;
  onDeletePatient: (id: string) => void;
}

type DetailTab = 'info' | 'treatments';

export default function PatientDetail({
  patient,
  onClose,
  onAddTreatment,
  onDeleteTreatment,
  onEditPatient,
  onDeletePatient,
}: PatientDetailProps) {
  const [tab, setTab] = useState<DetailTab>('info');
  const age = calcAge(patient.birth_date);
  const sc  = PATIENT_STATUS_CONFIG[patient.status];
  const color = avatarColor(patient.first_name);

  return (
    <div className="pt-detail-overlay" onClick={onClose}>
      <div className="pt-detail-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="pt-detail-header">
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div className="pt-detail-avatar" style={{ background: color }}>
              {initials(patient.first_name, patient.last_name)}
            </div>
            <div>
              <div className="pt-detail-hn">{patient.hn}</div>
              <div className="pt-detail-name">{patient.first_name} {patient.last_name}</div>
              <span
                className="pt-status-badge"
                style={{ background: sc.bg, color: sc.color, marginTop: '6px', display: 'inline-flex' }}
              >
                <span className="pt-dot" style={{ background: sc.color }} />
                {sc.label}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <button
              className="pt-icon-btn"
              title="แก้ไข"
              onClick={() => onEditPatient(patient)}
            >
              <Edit size={16} />
            </button>
            <button
              className="pt-icon-btn pt-icon-btn-danger"
              title="ลบ"
              onClick={() => onDeletePatient(patient.id)}
            >
              <Trash2 size={16} />
            </button>
            <button className="pt-icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="pt-detail-tabs">
          <button
            className={`pt-detail-tab ${tab === 'info' ? 'active' : ''}`}
            onClick={() => setTab('info')}
          >
            <User size={14} /> ข้อมูลผู้ป่วย
          </button>
          <button
            className={`pt-detail-tab ${tab === 'treatments' ? 'active' : ''}`}
            onClick={() => setTab('treatments')}
          >
            <Heart size={14} /> ประวัติการรักษา ({patient.treatments?.length ?? 0})
          </button>
        </div>

        {/* Body */}
        <div className="pt-detail-body">

          {/* ─── Tab: ข้อมูล ───────────────────────────────────────── */}
          {tab === 'info' && (
            <>
              {/* ข้อมูลพื้นฐาน */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><User size={13} /> ข้อมูลทั่วไป</div>
                <div className="pt-info-grid">
                  <InfoItem label="อายุ"      value={`${age} ปี`} />
                  <InfoItem label="เพศ"       value={patient.gender} />
                  <InfoItem label="วันเกิด"   value={new Date(patient.birth_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} />
                  <InfoItem label="กรุ๊ปเลือด" value={patient.blood_type ?? '—'} highlight />
                </div>
              </section>

              {/* แพ้ยา */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><AlertCircle size={13} /> ประวัติแพ้ยา</div>
                {patient.allergies && patient.allergies !== '-' ? (
                  <div className="pt-allergy-tag">⚠️ {patient.allergies}</div>
                ) : (
                  <div className="pt-empty-sm">ไม่มีประวัติแพ้ยา</div>
                )}
              </section>

              {/* โรคประจำตัว */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><Heart size={13} /> โรคประจำตัว</div>
                {patient.conditions.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {patient.conditions.map((c) => (
                      <span
                        key={c}
                        className="pt-condition-tag"
                        style={{ background: getConditionColor(c) + '22', color: getConditionColor(c) }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="pt-empty-sm">ไม่มีโรคประจำตัว</div>
                )}
              </section>

              {/* ผู้ติดต่อ */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><Phone size={13} /> ผู้ติดต่อ</div>
                <div className="pt-info-grid">
                  <InfoItem label="เบอร์ผู้ป่วย"  value={patient.phone || '—'} />
                  <InfoItem label="ผู้ติดต่อฉุกเฉิน" value={patient.emergency_contact || '—'} />
                  <InfoItem label="เบอร์ฉุกเฉิน"  value={patient.emergency_phone || '—'} />
                </div>
              </section>

              {/* ที่อยู่ */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><MapPin size={13} /> ที่อยู่</div>
                <div className="pt-address-box">
                  {patient.address}
                  {patient.subdistrict && `, ต.${patient.subdistrict}`}
                  {patient.district && `, อ.${patient.district}`}
                </div>
                <div className="pt-coords">
                  📍 พิกัด: {patient.lat.toFixed(5)}, {patient.lng.toFixed(5)}
                </div>
              </section>
            </>
          )}

          {/* ─── Tab: ประวัติการรักษา ───────────────────────────────── */}
          {tab === 'treatments' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button
                  className="pt-btn pt-btn-primary"
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                  onClick={() => onAddTreatment(patient)}
                >
                  + บันทึกการรักษา
                </button>
              </div>

              {(patient.treatments ?? []).length === 0 ? (
                <div className="pt-empty">ยังไม่มีประวัติการรักษา</div>
              ) : (
                (patient.treatments ?? []).map((t: TreatmentRecord) => (
                  <TreatmentCard
                    key={t.id}
                    treatment={t}
                    onDelete={onDeleteTreatment}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="pt-info-item">
      <div className="pt-info-label">{label}</div>
      <div className={`pt-info-value ${highlight ? 'pt-info-highlight' : ''}`}>{value}</div>
    </div>
  );
}

function TreatmentCard({ treatment: t, onDelete }: { treatment: TreatmentRecord; onDelete: (id: string) => void }) {
  return (
    <div className="pt-treatment-card">
      <div className="pt-treatment-top">
        <div className="pt-treatment-date">
          📅 {new Date(t.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          {t.doctor && <span className="pt-treatment-doctor"> • {t.doctor}</span>}
        </div>
        {t.id && (
          <button
            className="pt-icon-btn pt-icon-btn-danger"
            style={{ width: '24px', height: '24px' }}
            onClick={() => onDelete(t.id!)}
            title="ลบ"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="pt-treatment-diag">{t.diagnosis}</div>
      {t.note && <div className="pt-treatment-note">{t.note}</div>}
      {t.next_visit && (
        <div className="pt-treatment-next">
          🔔 นัดครั้งต่อไป:{' '}
          {new Date(t.next_visit).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}