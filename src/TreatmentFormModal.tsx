// src/TreatmentFormModal.tsx
import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Patient, NewTreatmentInput } from './patientTypes';
import { avatarColor, initials } from './patientTypes';
import './Patient.css';

interface TreatmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSave: (input: NewTreatmentInput) => Promise<void>;
}

export default function TreatmentFormModal({ isOpen, onClose, patient, onSave }: TreatmentFormModalProps) {
  const [form, setForm] = useState<Omit<NewTreatmentInput, 'patient_id'>>({
    date:       new Date().toISOString().slice(0, 10),
    doctor:     '',
    diagnosis:  '',
    note:       '',
    next_visit: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({ date: new Date().toISOString().slice(0, 10), doctor: '', diagnosis: '', note: '', next_visit: '' });
    setError('');
    setSaving(false);
  }, [isOpen]);

  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!patient) return;
    if (!form.diagnosis.trim()) { setError('กรุณากรอกการวินิจฉัย'); return; }
    try {
      setSaving(true);
      setError('');
      await onSave({ ...form, patient_id: patient.id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !patient) return null;

  const color = avatarColor(patient.first_name);

  return (
    <div className="pt-modal-overlay" onClick={onClose}>
      <div className="pt-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="pt-modal-header">
          <div className="pt-modal-title">📋 บันทึกประวัติการรักษา</div>
          <button className="pt-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pt-modal-body">
          {/* Patient info */}
          <div className="pt-patient-badge">
            <div className="pt-avatar pt-avatar-sm" style={{ background: color }}>
              {initials(patient.first_name, patient.last_name)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                {patient.first_name} {patient.last_name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{patient.hn}</div>
            </div>
          </div>

          {error && <div className="pt-error-msg">{error}</div>}

          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">วันที่รักษา <span className="pt-req">*</span></label>
              <input className="pt-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">แพทย์ผู้รักษา</label>
              <input className="pt-input" value={form.doctor} onChange={(e) => set('doctor', e.target.value)} placeholder="นพ. / พญ." />
            </div>
          </div>

          <div className="pt-form-group">
            <label className="pt-label">การวินิจฉัย <span className="pt-req">*</span></label>
            <input className="pt-input" value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder="เช่น ติดตามเบาหวาน" autoFocus />
          </div>

          <div className="pt-form-group">
            <label className="pt-label">บันทึกเพิ่มเติม</label>
            <textarea
              className="pt-textarea"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              rows={3}
              placeholder="ผลการรักษา ยาที่ให้ ผลเลือด ฯลฯ"
            />
          </div>

          <div className="pt-form-group">
            <label className="pt-label">วันนัดครั้งต่อไป</label>
            <input className="pt-input" type="date" value={form.next_visit ?? ''} onChange={(e) => set('next_visit', e.target.value)} />
          </div>
        </div>

        <div className="pt-modal-footer">
          <button className="pt-btn pt-btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="pt-btn pt-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            <Save size={16} />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}