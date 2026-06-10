// src/PatientDetail.tsx
import { useState } from 'react';
import { X, Edit, Trash2, MapPin, Phone, Heart, AlertCircle, User, Activity } from 'lucide-react';
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
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentRecord | null>(null);

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
              <div className="pt-detail-name">{patient.first_name} {patient.last_name}</div>
              <span
                className="pt-status-badge"
                style={{ background: sc?.bg ?? '#f1f5f9', color: sc?.color ?? '#64748b', marginTop: '6px', display: 'inline-flex' }}
              >
                <span className="pt-dot" style={{ background: sc?.color ?? '#64748b' }} />
                {sc?.label ?? 'ไม่ระบุ'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <button className="pt-icon-btn" title="แก้ไข" onClick={() => onEditPatient(patient)}><Edit size={16} /></button>
            <button className="pt-icon-btn pt-icon-btn-danger" title="ลบ" onClick={() => onDeletePatient(patient.id)}><Trash2 size={16} /></button>
            <button className="pt-icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="pt-detail-tabs">
          <button className={`pt-detail-tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}><User size={14} /> ข้อมูลผู้ป่วย</button>
          <button className={`pt-detail-tab ${tab === 'treatments' ? 'active' : ''}`} onClick={() => setTab('treatments')}><Heart size={14} /> ประวัติการรักษา ({patient.treatments?.length ?? 0})</button>
        </div>

        {/* Body */}
        <div className="pt-detail-body">

          {/* ─── Tab: ข้อมูล ───────────────────────────────────────── */}
          {tab === 'info' && (
            <>
              {/* ข้อมูลทั่วไป */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><User size={13} /> ข้อมูลทั่วไป</div>
                <div className="pt-info-grid">
                  <InfoItem label="อายุ"      value={`${age} ปี`} />
                  <InfoItem label="เพศ"       value={patient.gender} />
                  <InfoItem label="วันเกิด"   value={new Date(patient.birth_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} />
                </div>
              </section>

              {/* 💡 จุดเพิ่มใหม่: ข้อมูลทางกายภาพบำบัดและการบำบัดฟื้นฟู */}
              <section className="pt-detail-section">
                <div className="pt-section-title"><Activity size={13} /> ข้อมูลทางกายภาพบำบัด</div>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>ประเภทแผนการรักษา:</div>
                    {patient.treatment_type ? (
                      <span className="pt-blood-badge" style={{ background: '#f5f3ff', color: '#6d28d9', fontSize: '13px', display: 'inline-block', marginTop: '4px', padding: '4px 12px' }}>
                        ⚡ {patient.treatment_type === 'MS' ? 'MS (ระบบกระดูกและกล้ามเนื้อ)' : 'neuro (ระบบประสาท)'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>ยังไม่ได้ระบุประเภท</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>รายการหัตถการ / วิธีการรักษาที่ใช้:</div>
                    {patient.treatments_list && patient.treatments_list.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {patient.treatments_list.map((item) => (
                          <span key={item} className="pt-condition-tag" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px' }}>
                            ✓ {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>ยังไม่มีรายการบำบัดที่ระบุ</span>
                    )}
                  </div>
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
                <div className="pt-coords">📍 พิกัด: {patient.lat.toFixed(5)}, {patient.lng.toFixed(5)}</div>
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
                    onViewDetail={() => setSelectedTreatment(t)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* หน้าต่างขยายดูรายละเอียดการรักษา */}
      {selectedTreatment && (
        <div className="pt-modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTreatment(null)}>
          <div className="pt-modal" style={{ maxWidth: '520px', width: '90%', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="pt-modal-header" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: 'white' }}>
              <div className="pt-modal-title" style={{ color: 'white' }}>🔍 รายละเอียดการตรวจรักษา</div>
              <button className="pt-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }} onClick={() => setSelectedTreatment(null)}><X size={18} /></button>
            </div>
            
            <div className="pt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '3px' }}>ผู้ป่วย</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{patient.first_name} {patient.last_name}</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>วันที่ตรวจ</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {new Date(selectedTreatment.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>เจ้าหน้าที่ผู้ตรวจ</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{selectedTreatment.doctor || '—'}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #2563eb', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>ผลการวินิจฉัย / อาการที่พบ</div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', marginTop: '6px', lineHeight: '1.4' }}>{selectedTreatment.diagnosis}</div>
              </div>

              {selectedTreatment.note && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>บันทึกเพิ่มเติม / การสั่งยา</div>
                  <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', fontSize: '13.5px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{selectedTreatment.note}</div>
                </div>
              )}

              {selectedTreatment.next_visit && (
                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                  <span style={{ fontSize: '18px' }}>🔔</span>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>นัดหมายติดตามผลครั้งถัดไป</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '1px' }}>
                      {new Date(selectedTreatment.next_visit).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-modal-footer">
              <button className="pt-btn pt-btn-secondary" onClick={() => setSelectedTreatment(null)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="pt-info-item">
      <div className="pt-info-label">{label}</div>
      <div className={`pt-info-value ${highlight ? 'pt-info-highlight' : ''}`}>{value}</div>
    </div>
  );
}

function TreatmentCard({ 
  treatment: t, 
  onDelete,
  onViewDetail
}: { 
  treatment: TreatmentRecord; 
  onDelete: (id: string) => void;
  onViewDetail: () => void;
}) {
  return (
    <div className="pt-treatment-card" onClick={onViewDetail} style={{ cursor: 'pointer', transition: 'all 0.15s' }} title="คลิกเพื่อดูรายละเอียดเพิ่มเติม">
      <div className="pt-treatment-top">
        <div className="pt-treatment-date">
          📅 {new Date(t.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          {t.doctor && <span className="pt-treatment-doctor"> • {t.doctor}</span>}
        </div>
        {t.id && (
          <button
            className="pt-icon-btn pt-icon-btn-danger"
            style={{ width: '24px', height: '24px' }}
            onClick={(e) => { e.stopPropagation(); onDelete(t.id!); }}
            title="ลบ"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="pt-treatment-diag">{t.diagnosis}</div>
      {t.note && <div className="pt-treatment-note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.note}</div>}
      {t.next_visit && (
        <div className="pt-treatment-next">
          🔔 นัดครั้งต่อไป:{' '}
          {new Date(t.next_visit).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}