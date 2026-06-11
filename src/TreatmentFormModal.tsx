// src/TreatmentFormModal.tsx
import { useEffect, useState } from 'react';
import { X, Save, Calendar, FileText } from 'lucide-react';
import type { Patient, TreatmentType } from './patientTypes';
import { PROCEDURE_OPTIONS, TREATMENT_TYPE_OPTIONS } from './patientTypes';
import './Patient.css';

interface TreatmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onSave: (input: {
    patient_id: string;
    date: string;
    doctor: string;
    diagnosis: string;
    procedure?: string;
    note?: string;
    next_visit?: string;
    treatment_type?: TreatmentType;
    treatments_list?: string[];
  }) => Promise<void>;
}

type TreatmentTab = 'record' | 'appointment';

const MAX_TREATMENTS_LIST = 4;

export default function TreatmentFormModal({ isOpen, onClose, patient, onSave }: TreatmentFormModalProps) {
  const [date, setDate]                     = useState('');
  const [doctor, setDoctor]                 = useState('');
  const [diagnosis, setDiagnosis]           = useState('');
  const [procedure, setProcedure]           = useState('');
  const [note, setNote]                     = useState('');
  const [nextVisit, setNextVisit]           = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [activeTab, setActiveTab]           = useState<TreatmentTab>('record');

  // ✅ State ใหม่: treatment_type และ treatments_list ต่อครั้งที่รักษา
  const [treatmentType, setTreatmentType]   = useState<TreatmentType>('');
  const [treatmentsList, setTreatmentsList] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setDoctor('');
      setDiagnosis('');
      setProcedure('');
      setNote('');
      setNextVisit('');
      setError('');
      setSaving(false);
      setActiveTab('record');
      setTreatmentType('');
      setTreatmentsList([]);
    }
  }, [isOpen]);

  // Toggle รายการใน treatments_list (สูงสุด MAX_TREATMENTS_LIST รายการ)
  function toggleTreatmentItem(value: string) {
    setTreatmentsList((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX_TREATMENTS_LIST) return prev; // ถึงขีดสูงสุดแล้ว
      return [...prev, value];
    });
  }

  async function handleSubmit() {
    if (!diagnosis.trim()) {
      setError('กรุณากรอกผลการวินิจฉัย / อาการ ในแท็บข้อมูลการรักษา');
      setActiveTab('record');
      return;
    }
    if (!doctor.trim()) {
      setError('กรุณากรอกชื่อผู้ตรวจ / เจ้าหน้าที่ ในแท็บข้อมูลการรักษา');
      setActiveTab('record');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSave({
        patient_id: patient.id,
        date,
        doctor,
        diagnosis,
        procedure: procedure || undefined,
        note: note.trim() || undefined,
        next_visit: nextVisit || undefined,
        treatment_type: treatmentType || undefined,
        treatments_list: treatmentsList.length > 0 ? treatmentsList : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="pt-modal-overlay" onClick={onClose}>
      <div className="pt-modal" style={{ maxWidth: '640px', width: '90%' }} onClick={(e) => e.stopPropagation()}>

        {/* ส่วนหัว */}
        <div className="pt-modal-header" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: 'white', borderBottom: 'none' }}>
          <div className="pt-modal-title" style={{ color: 'white' }}>
            🩺 ติดตามประวัติการรักษา
          </div>
          <button className="pt-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* แท็บ */}
        <div className="pt-detail-tabs" style={{ position: 'static', padding: '0 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className={`pt-detail-tab ${activeTab === 'record' ? 'active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            <FileText size={14} /> ข้อมูลการรักษา
          </button>
          <button
            type="button"
            className={`pt-detail-tab ${activeTab === 'appointment' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointment')}
          >
            <Calendar size={14} /> การนัดหมายล่วงหน้า
          </button>
        </div>

        {/* เนื้อหา */}
        <div className="pt-modal-body" style={{ minHeight: '340px', paddingTop: '16px' }}>
          {error && <div className="pt-error-msg" style={{ marginBottom: '14px' }}>{error}</div>}

          {/* 📋 แท็บที่ 1: ข้อมูลการรักษา */}
          {activeTab === 'record' && (
            <>
              <div className="pt-form-section-title">ข้อมูลผู้ป่วย</div>
              <div className="tf-patient-card" style={{ marginBottom: '16px', background: '#f8fafc' }}>
                <div>
                  <div className="pt-patient-name">👤 {patient.first_name} {patient.last_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    เบอร์โทรศัพท์: {patient.phone || '—'}
                  </div>
                </div>
              </div>

              <div className="pt-form-section-title">รายละเอียดการตรวจประเมิน</div>
              <div className="pt-form-row">
                <div className="pt-form-group">
                  <label className="pt-label">วันที่ตรวจ <span className="pt-req">*</span></label>
                  <input className="pt-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="pt-form-group">
                  <label className="pt-label">ผู้ตรวจ / เจ้าหน้าที่ <span className="pt-req">*</span></label>
                  <input className="pt-input" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อ-นามสกุล เจ้าหน้าที่" />
                </div>
              </div>

              {/* ✅ ประเภทแผนการรักษา (ต่อครั้ง) */}
              <div className="pt-form-group">
                <label className="pt-label">ประเภทแผนการรักษา <span className="pt-optional">(เลือกได้ 1 ประเภท)</span></label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {TREATMENT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTreatmentType(treatmentType === opt.value ? '' : opt.value)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        border: `2px solid ${treatmentType === opt.value ? '#6d28d9' : '#e2e8f0'}`,
                        background: treatmentType === opt.value ? '#f5f3ff' : '#ffffff',
                        color: treatmentType === opt.value ? '#6d28d9' : '#64748b',
                        fontWeight: treatmentType === opt.value ? 700 : 400,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      ⚡ {opt.label} — {opt.labelTh}
                    </button>
                  ))}
                </div>
              </div>

              {/* ✅ รายการหัตถการที่ใช้ในครั้งนี้ (checkbox, สูงสุด 4) */}
              <div className="pt-form-group">
                <label className="pt-label">
                  รายการหัตถการที่ใช้ครั้งนี้{' '}
                  <span className="pt-optional">
                    (เลือกได้สูงสุด {MAX_TREATMENTS_LIST} รายการ — เลือกแล้ว {treatmentsList.length}/{MAX_TREATMENTS_LIST})
                  </span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {PROCEDURE_OPTIONS.map((opt) => {
                    const checked = treatmentsList.includes(opt.value);
                    const disabled = !checked && treatmentsList.length >= MAX_TREATMENTS_LIST;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleTreatmentItem(opt.value)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          border: `1.5px solid ${checked ? '#1d4ed8' : '#e2e8f0'}`,
                          background: checked ? '#eff6ff' : disabled ? '#f8fafc' : '#ffffff',
                          color: checked ? '#1d4ed8' : disabled ? '#cbd5e1' : '#475569',
                          fontSize: '12px',
                          fontWeight: checked ? 600 : 400,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {checked ? '✓ ' : ''}{opt.label} — {opt.labelTh}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-form-group">
                <label className="pt-label">หัตการกายภาพบำบัด (หลัก)</label>
                <select
                  className="pt-input"
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">— เลือกหัตการหลัก (ถ้ามี) —</option>
                  {PROCEDURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.labelTh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-form-group">
                <label className="pt-label">ผลการวินิจฉัย / อาการที่พบ <span className="pt-req">*</span></label>
                <input className="pt-input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="เช่น ความดันปกติ, มีอาการวิงเวียน" />
              </div>

              <div className="pt-form-group">
                <label className="pt-label">บันทึกเพิ่มเติม / การสั่งยา</label>
                <textarea className="pt-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ระบุรายละเอียดเพิ่มเติม หรือคำแนะนำประกอบการรักษา (ถ้ามี)" style={{ minHeight: '90px' }} />
              </div>
            </>
          )}

          {/* 📅 แท็บที่ 2: การนัดหมายล่วงหน้า */}
          {activeTab === 'appointment' && (
            <>
              <div className="pt-form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> กำหนดการติดตามผลครั้งถัดไป
              </div>

              <div className="pt-form-group" style={{ marginTop: '6px' }}>
                <label className="pt-label">วันนัดหมายครั้งต่อไป <span className="pt-optional">(หากไม่มีนัดหมายใหม่ ไม่ต้องระบุข้อมูล)</span></label>
                <input className="pt-input" type="date" value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} style={{ maxWidth: '320px' }} />
              </div>

              {nextVisit && (
                <div className="tf-appt-summary" style={{ marginTop: '24px', maxWidth: '100%' }}>
                  <div className="tf-appt-summary-title">📋 สรุปข้อมูลตารางนัดหมายล่วงหน้า</div>
                  <div className="tf-appt-summary-row" style={{ marginTop: '6px' }}>
                    <span>รายชื่อคนไข้:</span>
                    <strong>{patient.first_name} {patient.last_name}</strong>
                  </div>
                  <div className="tf-appt-summary-row">
                    <span>กำหนดติดตามผลครั้งถัดไป:</span>
                    <strong style={{ color: '#1e40af' }}>
                      {new Date(nextVisit).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </strong>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-modal-footer" style={{ borderTop: '1px solid #f1f5f9', background: '#ffffff' }}>
          <button className="pt-btn pt-btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="pt-btn pt-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            <Save size={16} />
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
          </button>
        </div>

      </div>
    </div>
  );
}