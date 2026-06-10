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

// ✅ NAV_ITEMS ทุกอัน — กรอง role ใน render แทน
const NAV_ITEMS: { id: PatientSubPage; icon: React.ReactNode; label: string; adminOnly: boolean }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'ภาพรวม',       adminOnly: false },
  { id: 'list',      icon: <Users size={18} />,           label: 'รายชื่อผู้ป่วย', adminOnly: true  },
  { id: 'map',       icon: <Map size={18} />,             label: 'แผนที่ผู้ป่วย',  adminOnly: true  },
];

interface PatientPageProps {
  onLogout?: () => void;
  onLogin?: () => void;
  currentUser?: string;
  isLoggedIn?: boolean;
  userRole?: 'admin' | 'user'; // ✅ เพิ่ม
}

export default function PatientPage({ onLogout, onLogin, currentUser, isLoggedIn, userRole }: PatientPageProps) {
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

  const isAdmin = userRole === 'admin'; // ✅ shorthand

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

  // ✅ ถ้า role เปลี่ยน (logout แล้ว login ใหม่) reset กลับ dashboard เสมอ
  useEffect(() => {
    setSubPage('dashboard');
  }, [userRole]);

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
        <div className="ps-brand">
          <div className="ps-brand-icon">
            <Activity size={22} color="white" />
          </div>
          <div>
            <div className="ps-brand-name">ระบบผู้ป่วย</div>
            <div className="ps-brand-sub">เทศบาลตำบลสันผักหวาน</div>
          </div>
        </div>

        <nav className="ps-nav">
          <div className="ps-nav-label">เมนูหลัก</div>
          {NAV_ITEMS
            .filter((item) => !item.adminOnly || isAdmin) // ✅ กรองเมนูตาม role
            .map((item) => (
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

        <div className="ps-sidebar-footer">
          <div className="ps-footer-stat">
            <span>ผู้ป่วยทั้งหมด</span>
            <span className="ps-footer-num">{safePatients.length}</span>
          </div>
          <div className="ps-footer-stat">
            <span>เฝ้าระวัง</span>
            <span className="ps-footer-num" style={{ color: '#ef4444' }}>
              {safePatients.filter((p) => p.status === 'critical').length}
            </span>
          </div>
          <div className="ps-footer-stat">
            <span>ดูแลอยู่</span>
            <span className="ps-footer-num" style={{ color: '#10b981' }}>
              {safePatients.filter((p) => p.status === 'active').length}
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
              // ✅ user ธรรมดาคลิก patient แล้วไม่ให้ไปหน้า list
              if (isAdmin) { setSelectedPatient(pt); setSubPage('list'); }
              else { setSelectedPatient(pt); }
            }}
            onAddPatient={() => setShowAddModal(true)}
            currentUser={currentUser}
            isLoggedIn={isLoggedIn}
            userRole={userRole}   // ✅ ส่งลงไป
            onLogin={onLogin}
            onLogout={onLogout}
          />
        )}
        {/* ✅ หน้า list/map render เฉพาะ admin เข้าถึงได้ */}
        {subPage === 'list' && isAdmin && (
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
        {subPage === 'map' && isAdmin && (
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

      {/* ══ Detail Panel ═════════════════════════════════════════════════════ */}
      {selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onAddTreatment={isAdmin ? (pt) => { setTreatmentTarget(pt); setSelectedPatient(null); } : undefined}
          onDeleteTreatment={isAdmin ? (id) => void handleDeleteTreatment(id) : undefined}
          onEditPatient={isAdmin ? (pt) => { setEditTarget(pt); setShowAddModal(true); setSelectedPatient(null); } : undefined}
          onDeletePatient={isAdmin ? (id) => void handleDeletePatient(id) : undefined}
        />
      )}

      {/* ══ Modals — admin only ═══════════════════════════════════════════════ */}
      {isAdmin && (
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
            patient={treatmentTarget}
            onSave={(input) => handleAddTreatment(input)}
          />
        </>
      )}
    </div>
  );
}