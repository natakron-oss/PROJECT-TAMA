// src/PatientPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Map } from 'lucide-react';
import logoImg from './assets/logo.jpg';
import { isSupabaseEnabled } from './lib/supabase';
import {
  fetchPatients,
  createPatient,
  updatePatient,
  deletePatient,
  addTreatment,
  deleteTreatment,
} from './lib/patientData';
import type { Patient, NewPatientInput, TreatmentType } from './patientTypes';
import PatientDashboard   from './PatientDashboard';
import PatientList        from './PatientList';
import PatientMap         from './PatientMap';
import PatientDetail      from './PatientDetail';
import PatientFormModal   from './PatientFormModal';
import TreatmentFormModal from './TreatmentFormModal';
import './Patient.css';

type NewTreatmentInput = {
  patient_id: string;
  date: string;
  doctor: string;
  diagnosis: string;
  procedure?: string;
  note?: string;
  next_visit?: string;
  treatment_type?: TreatmentType;
  treatments_list?: string[];
};

type PatientSubPage = 'dashboard' | 'list' | 'map';

// เมนูทั้งหมด — แสดงเฉพาะ dashboard ถ้ายังไม่ login
const ALL_NAV_ITEMS: { id: PatientSubPage; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'ภาพรวม' },
  { id: 'list',      icon: <Users size={18} />,           label: 'รายชื่อผู้ป่วย' },
  { id: 'map',       icon: <Map size={18} />,             label: 'แผนที่ผู้ป่วย' },
];

interface PatientPageProps {
  onLogout?: () => void;
  onLogin?: () => void;
  currentUser?: string;
  isLoggedIn?: boolean;
}

export default function PatientPage({ onLogout, onLogin, currentUser, isLoggedIn }: PatientPageProps) {
  const [subPage, setSubPage] = useState<PatientSubPage>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);

  const safePatients = patients ?? [];
  const [loading, setLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [editTarget, setEditTarget]           = useState<Patient | null>(null);
  const [treatmentTarget, setTreatmentTarget] = useState<Patient | null>(null);
  const [mapSelectedId, setMapSelectedId]     = useState<string | null>(null);
  const [mapPickedLat, setMapPickedLat]       = useState<number | undefined>();
  const [mapPickedLng, setMapPickedLng]       = useState<number | undefined>();

  // ถ้า logout อยู่ที่หน้าอื่น ให้กลับมา dashboard
  useEffect(() => {
    if (!isLoggedIn) setSubPage('dashboard');
  }, [isLoggedIn]);

  // เมนูที่เห็นได้ขึ้นอยู่กับสถานะ login
  const navItems = isLoggedIn
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((i) => i.id === 'dashboard');

  // ─── Load ─────────────────────────────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPatients();
      setPatients(data);
    } catch (err) {
      console.error('[PatientPage] loadPatients error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPatients(); }, [loadPatients]);

  // Realtime Supabase
  useEffect(() => {
    if (!isSupabaseEnabled) return;
    import('./lib/supabase').then(({ supabase }) => {
      if (!supabase) return;
      const channel = supabase
        .channel('realtime-patients')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
          void loadPatients();
        })
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    });
  }, [loadPatients]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleSavePatient = async (input: NewPatientInput) => {
    if (editTarget) {
      await updatePatient(editTarget.id, input);
      setPatients((prev) => prev.map((p) => p.id === editTarget.id ? { ...p, ...input } : p));
      setSelectedPatient((prev) => prev?.id === editTarget.id ? { ...prev, ...input } : prev);
      setEditTarget(null);
    } else {
      const newPt = await createPatient(input);
      setPatients((prev) => [newPt, ...prev]);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm('ต้องการลบผู้ป่วยนี้และประวัติทั้งหมดใช่หรือไม่?')) return;
    await deletePatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
    if (selectedPatient?.id === id) setSelectedPatient(null);
  };

  const handleAddTreatment = async (input: NewTreatmentInput) => {
    const record = await addTreatment(input);
    setPatients((prev) =>
      prev.map((p) => p.id === input.patient_id
        ? { ...p, treatments: [record, ...(p.treatments ?? [])] }
        : p,
      ),
    );
    setSelectedPatient((prev) => {
      if (!prev) return null;
      return prev.id === input.patient_id
        ? { ...prev, treatments: [record, ...(prev.treatments ?? [])] }
        : prev;
    });
  };

  const handleDeleteTreatment = async (treatmentId: string) => {
    if (!window.confirm('ต้องการลบบันทึกการรักษานี้ใช่หรือไม่?')) return;
    await deleteTreatment(treatmentId);
    const removeFromList = (list: Patient['treatments']) =>
      (list ?? []).filter((t) => t.id !== treatmentId);
    setPatients((prev) => prev.map((p) => ({ ...p, treatments: removeFromList(p.treatments) })));
    setSelectedPatient((prev) => prev ? { ...prev, treatments: removeFromList(prev.treatments) } : null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="ps-root">

      {/* ══ Sidebar ══════════════════════════════════════════════════════════ */}
      <aside className="ps-sidebar">
        <div className="ps-brand">
          <div className="ps-brand-icon" style={{ background: 'none', padding: 0, overflow: 'hidden' }}>
            <img src={logoImg} alt="logo" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <div>
            <div className="ps-brand-name">SANPAKWAN SMART REHAB CENTER</div>
            <div className="ps-brand-sub">เทศบาลตำบลสันผักหวาน</div>
          </div>
        </div>

        <nav className="ps-nav">
          <div className="ps-nav-label">เมนูหลัก</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`ps-nav-btn ${subPage === item.id ? 'active' : ''}`}
              onClick={() => setSubPage(item.id)}
            >
              <span className="ps-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ps-sidebar-footer" style={{ gap: '4px' }}>
          <div className="ps-footer-stat">
            <span>ผู้ป่วยทั้งหมด</span>
            <span className="ps-footer-num">{safePatients.length} ราย</span>
          </div>
          <div className="ps-footer-stat">
            <span>ผู้ป่วยทั่วไป</span>
            <span className="ps-footer-num" style={{ color: '#10b981' }}>
              {safePatients.filter((p) => p.status === 'general').length}
            </span>
          </div>
          <div className="ps-footer-stat">
            <span>ผู้สูงอายุ</span>
            <span className="ps-footer-num" style={{ color: '#3b82f6' }}>
              {safePatients.filter((p) => p.status === 'elderly').length}
            </span>
          </div>
          <div className="ps-footer-stat">
            <span>ผู้พิการ</span>
            <span className="ps-footer-num" style={{ color: '#ef4444' }}>
              {safePatients.filter((p) => p.status === 'disabled').length}
            </span>
          </div>
          <div className="ps-footer-stat">
            <span>จำหน่ายแล้ว</span>
            <span className="ps-footer-num" style={{ color: '#64748b' }}>
              {safePatients.filter((p) => p.status === 'finished').length}
            </span>
          </div>
        </div>
      </aside>

      {/* ══ Main ═════════════════════════════════════════════════════════════ */}
      <div className="ps-main">
        {subPage === 'dashboard' && (
          <PatientDashboard
            patients={safePatients}
            onSelectPatient={(pt) => {
              if (isLoggedIn) { setSubPage('list'); setSelectedPatient(pt); }
            }}
            onAddPatient={() => { if (isLoggedIn) setShowAddModal(true); }}
            currentUser={currentUser}
            isLoggedIn={isLoggedIn}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        )}
        {subPage === 'list' && isLoggedIn && (
          <PatientList
            patients={safePatients}
            loading={loading}
            onSelectPatient={setSelectedPatient}
            onAddPatient={() => setShowAddModal(true)}
            onAddTreatment={(pt) => setTreatmentTarget(pt)}
            onDeletePatient={(id) => void handleDeletePatient(id)}
            onRefresh={() => void loadPatients()}
          />
        )}
        {subPage === 'map' && isLoggedIn && (
          <PatientMap
            patients={safePatients}
            selectedId={mapSelectedId}
            onSelectPatient={(pt) => { setMapSelectedId(pt.id); setSelectedPatient(pt); }}
            onAddPatientAtLocation={(lat, lng) => {
              setMapPickedLat(lat);
              setMapPickedLng(lng);
              setEditTarget(null);
              setShowAddModal(true);
            }}
          />
        )}
      </div>

      {/* ══ Detail Panel — เฉพาะ login ═══════════════════════════════════════ */}
      {isLoggedIn && selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onAddTreatment={(pt) => { setTreatmentTarget(pt); setSelectedPatient(null); }}
          onDeleteTreatment={(id) => void handleDeleteTreatment(id)}
          onEditPatient={(pt) => { setEditTarget(pt); setShowAddModal(true); setSelectedPatient(null); }}
          onDeletePatient={(id) => void handleDeletePatient(id)}
        />
      )}

      {/* ══ Modals — เฉพาะ login ══════════════════════════════════════════════ */}
      {isLoggedIn && (
        <>
          <PatientFormModal
            isOpen={showAddModal}
            onClose={() => { setShowAddModal(false); setEditTarget(null); setMapPickedLat(undefined); setMapPickedLng(undefined); }}
            onSave={(input) => handleSavePatient(input)}
            editTarget={editTarget}
            initialLat={mapPickedLat}
            initialLng={mapPickedLng}
          />
          <TreatmentFormModal
            isOpen={Boolean(treatmentTarget)}
            onClose={() => setTreatmentTarget(null)}
            patient={treatmentTarget!}
            onSave={(input) => handleAddTreatment(input)}
          />
        </>
      )}
    </div>
  );
}