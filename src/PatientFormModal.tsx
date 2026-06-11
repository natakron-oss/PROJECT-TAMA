// src/PatientFormModal.tsx
import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Patient, NewPatientInput, PatientStatus } from './patientTypes';
import './Patient.css';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: NewPatientInput) => Promise<void>;
  editTarget?: Patient | null;  
  initialLat?: number;          
  initialLng?: number;
}

const EMPTY_FORM: NewPatientInput = {
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: 'ไม่ระบุ',
  phone: '',
  emergency_contact: '',
  emergency_phone: '',
  address: '',
  subdistrict: 'สันผักหวาน',
  district: 'หางดง',
  allergies: '',
  conditions: [],
  status: 'general', 
  lat: 0,
  lng: 0,
};

export default function PatientFormModal({ isOpen, onClose, onSave, editTarget, initialLat, initialLng }: PatientFormModalProps) {
  const [form, setForm]             = useState<NewPatientInput>(EMPTY_FORM);
  const [condInput, setCondInput]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [coordError, setCoordError] = useState(false);

  const isEdit = Boolean(editTarget);

  useEffect(() => {
    if (!isOpen) return;
    if (editTarget) {
      setForm({
        first_name:        editTarget.first_name,
        last_name:         editTarget.last_name,
        birth_date:        editTarget.birth_date,
        gender:            editTarget.gender,
        phone:             editTarget.phone ?? '',
        emergency_contact: editTarget.emergency_contact ?? '',
        emergency_phone:   editTarget.emergency_phone ?? '',
        address:           editTarget.address ?? '',
        subdistrict:       editTarget.subdistrict ?? 'สันผักหวาน',
        district:          editTarget.district ?? 'หางดง',
        allergies:         editTarget.allergies ?? '',
        conditions:        editTarget.conditions ?? [],
        status:            editTarget.status,
        lat:               editTarget.lat,
        lng:               editTarget.lng,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        lat: initialLat ?? EMPTY_FORM.lat,
        lng: initialLng ?? EMPTY_FORM.lng,
      });
    }
    setCondInput('');
    setError('');
    setCoordError(false);
    setSaving(false);
  }, [isOpen, editTarget]);

  const set = <K extends keyof NewPatientInput>(key: K, value: NewPatientInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function addCondition() {
    const val = condInput.trim();
    if (!val) return;
    if (!form.conditions.includes(val)) {
      set('conditions', [...form.conditions, val]);
    }
    setCondInput('');
  }

  function removeCondition(c: string) {
    set('conditions', form.conditions.filter((x) => x !== c));
  }

  async function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('กรุณากรอกชื่อและนามสกุล');
      return;
    }
    if (!form.birth_date) {
      setError('กรุณากรอกวันเกิด');
      return;
    }
    if (!form.phone.trim()) {
      setError('กรุณากรอกเบอร์โทร');
      return;
    }
    const latValid = isFinite(form.lat) && form.lat >= -90  && form.lat <= 90  && form.lat !== 0;
    const lngValid = isFinite(form.lng) && form.lng >= -180 && form.lng <= 180 && form.lng !== 0;
    if (!latValid || !lngValid) {
      setCoordError(true);
      setError('กรุณากรอกละติจูดและลองจิจูดให้ถูกต้อง (lat: -90 ถึง 90, lng: -180 ถึง 180)');
      return;
    }
    setCoordError(false);
    try {
      setSaving(true);
      setError('');
      await onSave(form);
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
      <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pt-modal-header">
          <div className="pt-modal-title">
            {isEdit ? '✏️ แก้ไขข้อมูลผู้ป่วย' : '➕ เพิ่มผู้ป่วยใหม่'}
          </div>
          <button className="pt-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pt-modal-body">
          {error && <div className="pt-error-msg">{error}</div>}

          {/* ─── ข้อมูลพื้นฐาน ─────────────────────────────────────── */}
          <div className="pt-form-section-title">ข้อมูลพื้นฐาน</div>
          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">สถานะ</label>
              <select className="pt-select" value={form.status} onChange={(e) => set('status', e.target.value as PatientStatus)}>
                <option value="general">ผู้ป่วยทั่วไป</option>
                <option value="disabled">ผู้พิการ</option>
                <option value="elderly">ผู้สูงอายุ</option>
                <option value="finished">จำหน่าย</option>
              </select>
            </div>
            <div className="pt-form-group">
              <label className="pt-label">ประวัติแพ้ยา</label>
              <input className="pt-input" value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value)} placeholder="ใส่ - ถ้าไม่มี" />
            </div>
          </div>

          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">ชื่อ <span className="pt-req">*</span></label>
              <input className="pt-input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="ชื่อ" autoFocus />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">นามสกุล <span className="pt-req">*</span></label>
              <input className="pt-input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="นามสกุล" />
            </div>
          </div>

          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">วันเกิด <span className="pt-req">*</span></label>
              <input className="pt-input" type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">เพศ</label>
              <select className="pt-select" value={form.gender} onChange={(e) => set('gender', e.target.value as NewPatientInput['gender'])}>
                <option>ชาย</option>
                <option>หญิง</option>
                <option>ไม่ระบุ</option>
              </select>
            </div>
          </div>

          {/* ─── ติดต่อ ──────────────────────────────────────────────── */}
          <div className="pt-form-section-title">ข้อมูลติดต่อ</div>
          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">เบอร์โทรผู้ป่วย <span className="pt-req">*</span></label>
              <input className="pt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0xx-xxx-xxxx" />
            </div>
          </div>
          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">ชื่อผู้ติดต่อฉุกเฉิน</label>
              <input className="pt-input" value={form.emergency_contact ?? ''} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">เบอร์โทรฉุกเฉิน</label>
              <input className="pt-input" value={form.emergency_phone ?? ''} onChange={(e) => set('emergency_phone', e.target.value)} placeholder="0xx-xxx-xxxx" />
            </div>
          </div>

          {/* ─── ที่อยู่ ─────────────────────────────────────────────── */}
          <div className="pt-form-section-title">ที่อยู่ / พิกัด</div>
          <div className="pt-form-group">
            <label className="pt-label">ที่อยู่</label>
            <input className="pt-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="บ้านเลขที่ ซอย ถนน หมู่บ้าน" />
          </div>
          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">ตำบล</label>
              <input className="pt-input" value={form.subdistrict ?? ''} onChange={(e) => set('subdistrict', e.target.value)} />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">อำเภอ</label>
              <input className="pt-input" value={form.district ?? ''} onChange={(e) => set('district', e.target.value)} />
            </div>
          </div>
          <div className="pt-form-row">
            <div className="pt-form-group">
              <label className="pt-label">ละติจูด <span className="pt-req">*</span></label>
              <input
                className={`pt-input${coordError && (form.lat === 0 || !isFinite(form.lat) || form.lat < -90 || form.lat > 90) ? ' pt-input-error' : ''}`}
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => { set('lat', parseFloat(e.target.value) || 0); setCoordError(false); setError(''); }}
                placeholder="เช่น 12.7489"
              />
            </div>
            <div className="pt-form-group">
              <label className="pt-label">ลองจิจูด <span className="pt-req">*</span></label>
              <input
                className={`pt-input${coordError && (form.lng === 0 || !isFinite(form.lng) || form.lng < -180 || form.lng > 180) ? ' pt-input-error' : ''}`}
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => { set('lng', parseFloat(e.target.value) || 0); setCoordError(false); setError(''); }}
                placeholder="เช่น 100.9614"
              />
            </div>
          </div>

          {/* ─── โรคประจำตัว ─────────────────────────────────────────── */}
          <div className="pt-form-section-title">โรคประจำตัว</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="pt-input"
              value={condInput}
              onChange={(e) => setCondInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
              placeholder="เช่น เบาหวาน แล้วกด Enter"
              style={{ flex: 1 }}
            />
            <button type="button" className="pt-btn pt-btn-secondary" onClick={addCondition}>เพิ่ม</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {form.conditions.map((c) => (
              <span key={c} className="pt-condition-removable">
                {c}
                <button onClick={() => removeCondition(c)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="pt-modal-footer">
          <button className="pt-btn pt-btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="pt-btn pt-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            <Save size={16} />
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}