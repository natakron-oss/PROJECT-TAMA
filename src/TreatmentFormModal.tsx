// src/TreatmentFormModal.tsx
import { useEffect, useState } from 'react';
import { X, Save, Calendar, FileText } from 'lucide-react';
import type { Patient } from './patientTypes';
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
    note?: string;
    next_visit?: string;
  }) => Promise<void>;
}

// สร้างชนิดข้อมูลสำหรับระบุแท็บที่กำลังทำงานอยู่
type TreatmentTab = 'record' | 'appointment';

export default function TreatmentFormModal({ isOpen, onClose, patient, onSave }: TreatmentFormModalProps) {
  const [date, setDate]           = useState('');
  const [doctor, setDoctor]       = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [note, setNote]           = useState('');
  const [nextVisit, setNextVisit] = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // 💡 จุดเพิ่ม 1: ตัวแปร State สำหรับสลับหน้าแท็บ (ค่าเริ่มต้นคือหน้าบันทึกการรักษา 'record')
  const [activeTab, setActiveTab] = useState<TreatmentTab>('record');

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setDoctor('');
      setDiagnosis('');
      setNote('');
      setNextVisit('');
      setError('');
      setSaving(false);
      setActiveTab('record'); // รีเซ็ตกลับมาที่แท็บแรกทุกครั้งที่เปิดป๊อปอัป
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!diagnosis.trim()) {
      setError('กรุณากรอกผลการวินิจฉัย / อาการ ในแท็บข้อมูลการรักษา');
      setActiveTab('record'); // สลับแท็บกลับไปเพื่อให้เจ้าหน้าที่เห็นช่องที่ลืมกรอก
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
        note: note.trim() || undefined,
        next_visit: nextVisit || undefined,
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
        
        {/* ส่วนหัวหน้าต่างป๊อปอัป */}
        <div className="pt-modal-header" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: 'white', borderBottom: 'none' }}>
          <div className="pt-modal-title" style={{ color: 'white' }}>
            🩺 ติดตามประวัติการรักษา
          </div>
          <button className="pt-icon-btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 💡 จุดเพิ่ม 2: เมนูแท็บสำหรับสลับหน้าบันทึกการรักษาและการนัดหมาย (ดึงดีไซน์สากลของระบบมาใช้) */}
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

        {/* ส่วนเนื้อหาหลักในป๊อปอัป (ปรับเปลี่ยนตามแท็บที่เลือก) */}
        <div className="pt-modal-body" style={{ minHeight: '340px', paddingTop: '16px' }}>
          {error && <div className="pt-error-msg" style={{ marginBottom: '14px' }}>{error}</div>}

          {/* 📋 แท็บที่ 1: หน้าบันทึกข้อมูลการรักษา */}
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

          {/* 📅 แท็บที่ 2: หน้ากำหนดการนัดหมายล่วงหน้า */}
          {activeTab === 'appointment' && (
            <>
              <div className="pt-form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> กำหนดการติดตามผลครั้งถัดไป
              </div>
              
              <div className="pt-form-group" style={{ marginTop: '6px' }}>
                <label className="pt-label">วันนัดหมายครั้งต่อไป <span className="pt-optional">(หากไม่มีนัดหมายใหม่ ไม่ต้องระบุข้อมูล)</span></label>
                <input className="pt-input" type="date" value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} style={{ maxWidth: '320px' }} />
              </div>

              {/* แสดงกล่องสรุปนัดหมาย (Appt Summary) อัตโนมัติเมื่อเจ้าหน้าที่ระบุวันนัดหมายล่วงหน้า */}
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

        {/* ส่วนท้ายปุ่มกดดำเนินงาน */}
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