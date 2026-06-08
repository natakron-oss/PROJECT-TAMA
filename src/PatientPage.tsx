// src/PatientPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Map, Activity } from 'lucide-react';
import { isSupabaseEnabled } from './lib/supabase';
import {
  fetchPatients,
  createPatient,
  updatePatient,
  deletePatient,
  addTreatment,
  deleteTreatment,
} from './lib/patientData';
import type { Patient, NewPatientInput, NewTreatmentInput } from './patientTypes';
import PatientDashboard   from './PatientDashboard';
import PatientList        from './PatientList';
import PatientMap         from './PatientMap';
import PatientDetail      from './PatientDetail';
import PatientFormModal   from './PatientFormModal';
import TreatmentFormModal from './TreatmentFormModal';
import './Patient.css';

type PatientSubPage = 'dashboard' | 'list' | 'map';

const NAV_ITEMS: { id: PatientSubPage; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'ภาพรวม' },
  { id: 'list',      icon: <Users size={18} />,           label: 'รายชื่อผู้ป่วย' },
  { id: 'map',       icon: <Map size={18} />,             label: 'แผนที่ผู้ป่วย' },
];

export default function PatientPage() {
  const [subPage, setSubPage] = useState<PatientSubPage>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [editTarget, setEditTarget]           = useState<Patient | null>(null);
  const [treatmentTarget, setTreatmentTarget] = useState<Patient | null>(null);
  const [mapSelectedId, setMapSelectedId]     = useState<string | null>(null);
  const [mapPickedLat, setMapPickedLat]       = useState<number | undefined>();
  const [mapPickedLng, setMapPickedLng]       = useState<number | undefined>();

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
    setSelectedPatient((prev) =>
      prev?.id === input.patient_id
        ? { ...prev, treatments: [record, ...(prev.treatments ?? [])] }
        : prev,
    );
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
        {/* Brand */}
        <div className="ps-brand">
          <div className="ps-brand-icon">
            <Activity size={22} color="white" />
          </div>
          <div>
            <div className="ps-brand-name">ระบบผู้ป่วย</div>
            <div className="ps-brand-sub">เทศบาลตำบลสันผักหวาน</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="ps-nav">
          <div className="ps-nav-label">เมนูหลัก</div>
          {NAV_ITEMS.map((item) => (
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

        {/* Footer stats */}
        <div className="ps-sidebar-footer">
          <div className="ps-footer-stat">
            <span>ผู้ป่วยทั้งหมด</span>
            <span className="ps-footer-num">{patients.length}</span>
          </div>
          <div className="ps-footer-stat">
            <span>เฝ้าระวัง</span>
            <span className="ps-footer-num" style={{ color: '#ef4444' }}>
              {patients.filter((p) => p.status === 'critical').length}
            </span>
          </div>
          <div className="ps-footer-stat">
            <span>ดูแลอยู่</span>
            <span className="ps-footer-num" style={{ color: '#10b981' }}>
              {patients.filter((p) => p.status === 'active').length}
            </span>
          </div>
        </div>
      </aside>

      {/* ══ Main ═════════════════════════════════════════════════════════════ */}
      <div className="ps-main">
        {subPage === 'dashboard' && (
          <PatientDashboard
            patients={patients}
            onSelectPatient={(pt) => { setSelectedPatient(pt); setSubPage('list'); }}
            onAddPatient={() => setShowAddModal(true)}
          />
        )}
        {subPage === 'list' && (
          <PatientList
            patients={patients}
            loading={loading}
            onSelectPatient={setSelectedPatient}
            onAddPatient={() => setShowAddModal(true)}
            onAddTreatment={(pt) => setTreatmentTarget(pt)}
            onDeletePatient={(id) => void handleDeletePatient(id)}
            onRefresh={() => void loadPatients()}
          />
        )}
        {subPage === 'map' && (
          <PatientMap
            patients={patients}
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

      {/* ══ Detail Panel ═════════════════════════════════════════════════════ */}
      {selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onAddTreatment={(pt) => { setTreatmentTarget(pt); setSelectedPatient(null); }}
          onDeleteTreatment={(id) => void handleDeleteTreatment(id)}
          onEditPatient={(pt) => { setEditTarget(pt); setShowAddModal(true); setSelectedPatient(null); }}
          onDeletePatient={(id) => void handleDeletePatient(id)}
        />
      )}

      {/* ══ Modals ═══════════════════════════════════════════════════════════ */}
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
        patient={treatmentTarget}
        onSave={(input) => handleAddTreatment(input)}
      />
    </div>
  );
}