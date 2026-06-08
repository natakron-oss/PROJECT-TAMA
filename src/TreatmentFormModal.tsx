// src/TreatmentFormModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { X, Save, Calendar, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import type { Patient, NewTreatmentInput } from './patientTypes';
import { avatarColor, initials, PATIENT_STATUS_CONFIG } from './patientTypes';
import './Patient.css';

interface TreatmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSave: (input: NewTreatmentInput) => Promise<void>;
}

// ─── Appointment Calendar ──────────────────────────────────────────────────
const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];
const THAI_DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function AppointmentCalendar({
  value,
  onChange,
  minDate,
}: {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(() => {
    if (value) return new Date(value).getFullYear();
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value).getMonth();
    return today.getMonth();
  });

  const selectedDate = value ? new Date(value) : null;
  const minD         = minDate ? new Date(minDate) : today;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();

  // สร้าง grid 6 แถว × 7 คอลัมน์
  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth, firstDay, daysInMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function isDisabled(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const m = new Date(minD);
    m.setHours(0, 0, 0, 0);
    return d < m;
  }

  function isSelected(day: number) {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth()    === viewMonth &&
      selectedDate.getDate()     === day
    );
  }

  function isToday(day: number) {
    return (
      today.getFullYear() === viewYear &&
      today.getMonth()    === viewMonth &&
      today.getDate()     === day
    );
  }

  function handleSelect(day: number) {
    if (isDisabled(day)) return;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
  }

  // Quick-pick: +1M, +2M, +3M, +6M
  function quickPick(months: number) {
    const d = new Date(today);
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    onChange(`${y}-${mo}-${dy}`);
    setViewYear(y);
    setViewMonth(d.getMonth());
  }

  return (
    <div className="tf-calendar">
      {/* Quick picks */}
      <div className="tf-quick-picks">
        <span className="tf-quick-label"><Bell size={12} /> นัดด่วน:</span>
        {[
          { label: '1 เดือน', months: 1 },
          { label: '2 เดือน', months: 2 },
          { label: '3 เดือน', months: 3 },
          { label: '6 เดือน', months: 6 },
        ].map(({ label, months }) => (
          <button
            key={months}
            type="button"
            className="tf-quick-btn"
            onClick={() => quickPick(months)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className="tf-cal-nav">
        <button type="button" className="tf-cal-nav-btn" onClick={prevMonth}>
          <ChevronLeft size={16} />
        </button>
        <span className="tf-cal-month-label">
          {THAI_MONTHS[viewMonth]} {viewYear + 543}
        </span>
        <button type="button" className="tf-cal-nav-btn" onClick={nextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="tf-cal-grid">
        {THAI_DAYS_SHORT.map((d) => (
          <div key={d} className="tf-cal-day-head">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="tf-cal-cell">
            {day !== null && (
              <button
                type="button"
                className={[
                  'tf-cal-day',
                  isSelected(day) ? 'selected' : '',
                  isToday(day)    ? 'today'    : '',
                  isDisabled(day) ? 'disabled' : '',
                ].join(' ')}
                onClick={() => handleSelect(day)}
                disabled={isDisabled(day)}
              >
                {day}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Selected display */}
      {value && (
        <div className="tf-cal-selected-display">
          📅 นัด:{' '}
          {new Date(value).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function TreatmentFormModal({ isOpen, onClose, patient, onSave }: TreatmentFormModalProps) {
  const [form, setForm] = useState<Omit<NewTreatmentInput, 'patient_id'>>({
    date:       new Date().toISOString().slice(0, 10),
    doctor:     '',
    diagnosis:  '',
    note:       '',
    next_visit: '',
  });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      date:       new Date().toISOString().slice(0, 10),
      doctor:     '',
      diagnosis:  '',
      note:       '',
      next_visit: '',
    });
    setError('');
    setSaving(false);
    setShowCalendar(false);
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
  const sc    = PATIENT_STATUS_CONFIG[patient.status];

  return (
    <div className="pt-modal-overlay" onClick={onClose}>
      <div className="pt-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="pt-modal-header tf-modal-header-styled">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="tf-header-icon">📋</div>
            <div>
              <div className="pt-modal-title" style={{ color: 'white' }}>บันทึกประวัติการรักษา</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>
                กรอกข้อมูลการรักษาและนัดหมายผู้ป่วย
              </div>
            </div>
          </div>
          <button className="pt-icon-btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="tf-modal-body-two-col">

          {/* ─── LEFT: ข้อมูลการรักษา ───────────────────────── */}
          <div className="tf-col-left">

            {/* Patient badge */}
            <div className="tf-patient-card">
              <div className="pt-avatar" style={{ background: color, width: 48, height: 48, fontSize: 18, borderRadius: 12 }}>
                {initials(patient.first_name, patient.last_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                  {patient.first_name} {patient.last_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{patient.hn}</div>
                <span
                  className="pt-status-badge"
                  style={{ background: sc.bg, color: sc.color, marginTop: '5px', display: 'inline-flex', fontSize: '11px', padding: '2px 8px' }}
                >
                  <span className="pt-dot" style={{ background: sc.color, width: 6, height: 6 }} />
                  {sc.label}
                </span>
              </div>
            </div>

            {error && <div className="pt-error-msg">{error}</div>}

            {/* Section title */}
            <div className="pt-form-section-title" style={{ marginTop: '4px' }}>ข้อมูลการรักษา</div>

            <div className="pt-form-row">
              <div className="pt-form-group">
                <label className="pt-label">วันที่รักษา <span className="pt-req">*</span></label>
                <input
                  className="pt-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </div>
              <div className="pt-form-group">
                <label className="pt-label">แพทย์ผู้รักษา</label>
                <input
                  className="pt-input"
                  value={form.doctor}
                  onChange={(e) => set('doctor', e.target.value)}
                  placeholder="นพ. / พญ."
                />
              </div>
            </div>

            <div className="pt-form-group">
              <label className="pt-label">การวินิจฉัย <span className="pt-req">*</span></label>
              <input
                className="pt-input"
                value={form.diagnosis}
                onChange={(e) => set('diagnosis', e.target.value)}
                placeholder="เช่น ติดตามเบาหวาน, ตรวจความดัน"
                autoFocus
              />
            </div>

            <div className="pt-form-group">
              <label className="pt-label">บันทึกเพิ่มเติม</label>
              <textarea
                className="pt-textarea"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                rows={4}
                placeholder="ผลการรักษา ยาที่ให้ ผลเลือด น้ำตาล ความดัน ฯลฯ"
              />
            </div>
          </div>

          {/* ─── RIGHT: ระบบนัดหมาย ─────────────────────────── */}
          <div className="tf-col-right">
            <div className="tf-appt-header">
              <Calendar size={15} color="#2563eb" />
              <span>ระบบนัดหมายล่วงหน้า</span>
            </div>

            {/* Toggle calendar */}
            <div className="tf-next-visit-row">
              <div className="pt-form-group" style={{ flex: 1 }}>
                <label className="pt-label">วันนัดครั้งต่อไป</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="pt-input"
                    type="date"
                    value={form.next_visit ?? ''}
                    onChange={(e) => set('next_visit', e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className={`tf-cal-toggle-btn ${showCalendar ? 'active' : ''}`}
                    onClick={() => setShowCalendar((v) => !v)}
                    title="เปิดปฏิทิน"
                  >
                    <Calendar size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar */}
            {showCalendar && (
              <AppointmentCalendar
                value={form.next_visit ?? ''}
                onChange={(d) => { set('next_visit', d); }}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            )}

            {/* ถ้าไม่แสดง calendar ให้แสดง placeholder */}
            {!showCalendar && (
              <div className="tf-cal-placeholder">
                <Calendar size={32} color="#cbd5e1" />
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                  กดปุ่ม 📅 เพื่อเปิดปฏิทิน<br />
                  <span style={{ fontSize: '12px' }}>หรือกรอกวันที่โดยตรง</span>
                </div>
                {/* Quick picks ย่อ */}
                <div className="tf-quick-picks" style={{ marginTop: '14px', justifyContent: 'center' }}>
                  {[
                    { label: '+1 เดือน', months: 1 },
                    { label: '+2 เดือน', months: 2 },
                    { label: '+3 เดือน', months: 3 },
                    { label: '+6 เดือน', months: 6 },
                  ].map(({ label, months }) => {
                    function quickPick() {
                      const d = new Date();
                      d.setMonth(d.getMonth() + months);
                      const y  = d.getFullYear();
                      const mo = String(d.getMonth() + 1).padStart(2, '0');
                      const dy = String(d.getDate()).padStart(2, '0');
                      set('next_visit', `${y}-${mo}-${dy}`);
                    }
                    return (
                      <button
                        key={months}
                        type="button"
                        className="tf-quick-btn"
                        onClick={quickPick}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {form.next_visit && (
                  <div className="tf-cal-selected-display" style={{ marginTop: '12px' }}>
                    📅 นัด:{' '}
                    {new Date(form.next_visit).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Summary card */}
            {form.next_visit && (
              <div className="tf-appt-summary">
                <div className="tf-appt-summary-title">📌 สรุปนัดหมาย</div>
                <div className="tf-appt-summary-row">
                  <span>ผู้ป่วย</span>
                  <strong>{patient.first_name} {patient.last_name}</strong>
                </div>
                <div className="tf-appt-summary-row">
                  <span>วันนัด</span>
                  <strong>
                    {new Date(form.next_visit).toLocaleDateString('th-TH', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </strong>
                </div>
                {form.diagnosis && (
                  <div className="tf-appt-summary-row">
                    <span>เรื่อง</span>
                    <strong style={{ color: '#2563eb' }}>{form.diagnosis}</strong>
                  </div>
                )}
                {(() => {
                  const diff = Math.ceil(
                    (new Date(form.next_visit).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  return diff > 0 ? (
                    <div className="tf-appt-countdown">
                      อีก <span>{diff}</span> วัน
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ─── Footer ─────────────────────────────────────────── */}
        <div className="pt-modal-footer">
          <button className="pt-btn pt-btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="pt-btn pt-btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
            <Save size={16} />
            {saving ? 'กำลังบันทึก...' : 'บันทึกการรักษา'}
          </button>
        </div>
      </div>
    </div>
  );
}