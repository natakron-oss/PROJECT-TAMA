// src/PatientMap.tsx
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, X } from 'lucide-react';
import type { Patient } from './patientTypes';
import {
  PATIENT_STATUS_CONFIG,
  calcAge,
  getConditionColor,
  avatarColor,
  initials,
} from './patientTypes';
import './Patient.css';

// Fix default icon paths
const iconProto = (L.Icon.Default as any).prototype;
delete iconProto._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MAP_CENTER: [number, number] = [18.7060, 98.9510];
const MAP_ZOOM = 14;

interface PatientMapProps {
  patients: Patient[];
  selectedId?: string | null;
  onSelectPatient: (patient: Patient) => void;
  onAddPatientAtLocation?: (lat: number, lng: number) => void; // เปิด modal พร้อมพิกัด
}

export default function PatientMap({
  patients,
  selectedId,
  onSelectPatient,
  onAddPatientAtLocation,
}: PatientMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const markersRef      = useRef<Map<string, L.Marker>>(new Map());
  const tempMarkerRef   = useRef<L.Marker | null>(null);
  const addModeRef         = useRef(false); // ref เพื่อให้ click handler อ่านค่าปัจจุบันได้
  const onSelectPatientRef = useRef(onSelectPatient); // ป้องกัน stale closure

  const [addMode, setAddMode] = useState(false);

  // sync ref ทุกครั้งที่ prop เปลี่ยน
  useEffect(() => { onSelectPatientRef.current = onSelectPatient; }, [onSelectPatient]);

  // ─── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // คลิกบนแผนที่ — ถ้าอยู่ใน add mode วาง marker ชั่วคราวแล้วเปิด modal
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!addModeRef.current) return;

      const { lat, lng } = e.latlng;

      // ลบ temp marker เก่า
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }

      // วาง temp marker สีเขียว
      const tempIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 40px; height: 40px; border-radius: 50%;
            background: #10b981; color: white;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
            border: 3px solid white;
            box-shadow: 0 0 0 3px #10b98188, 0 4px 12px rgba(0,0,0,0.4);
            animation: ptPulse 1s ease infinite;
          ">+</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const tempMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      tempMarker.bindPopup(
        `<div style="font-family:'Sarabun',sans-serif;text-align:center;padding:4px 8px;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:6px;">📍 ตำแหน่งที่เลือก</div>
          <div style="font-size:12px;color:#64748b;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>`,
        { closeButton: false }
      ).openPopup();

      tempMarkerRef.current = tempMarker;

      // ปิด add mode แล้วเปิด form modal พร้อมพิกัด
      addModeRef.current = false;
      setAddMode(false);
      onAddPatientAtLocation?.(lat, lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      tempMarkerRef.current = null;
    };
  }, []);

  // sync addModeRef ให้ตรงกับ state เสมอ
  useEffect(() => {
    addModeRef.current = addMode;
    // เปลี่ยน cursor แผนที่
    const container = mapRef.current?.getContainer();
    if (container) {
      container.style.cursor = addMode ? 'crosshair' : '';
    }
    // ถ้าออก add mode ลบ temp marker
    if (!addMode && tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  }, [addMode]);

  // ─── Sync markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker, id) => {
      if (!patients.find((p) => p.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    patients.forEach((pt) => {
      if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;

      const color      = avatarColor(pt.first_name);
      const isSelected = pt.id === selectedId;
      const size       = isSelected ? 44 : 36;

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:${size}px; height:${size}px; border-radius:50%;
            background:${color}; color:white;
            display:flex; align-items:center; justify-content:center;
            font-weight:700; font-size:${isSelected ? 15 : 13}px;
            border:${isSelected ? '3px' : '2px'} solid white;
            box-shadow:${isSelected
              ? `0 0 0 3px ${color}88, 0 4px 12px rgba(0,0,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.3)'};
            font-family:'Sarabun',sans-serif; transition:all 0.2s;
          ">${initials(pt.first_name, pt.last_name)}</div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const conditionHtml = pt.conditions.slice(0, 3).map((c) =>
        `<span style="display:inline-block;background:${getConditionColor(c)}22;color:${getConditionColor(c)};
          padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;margin:2px 2px 0;">${c}</span>`
      ).join('');

      const popup = L.popup({ maxWidth: 240, closeButton: false }).setContent(`
        <div style="font-family:'Sarabun',sans-serif;padding:4px;">
          <div style="font-weight:700;font-size:14px;color:#0f172a;">${pt.first_name} ${pt.last_name}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;"> อายุ ${calcAge(pt.birth_date)} ปี</div>
          <div style="margin-top:6px;">${conditionHtml}</div>
          <div style="font-size:12px;color:#475569;margin-top:8px;">📍 ${pt.address}</div>
          <div style="margin-top:6px;">
            <span style="display:inline-flex;align-items:center;gap:4px;
              padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;
              background:${PATIENT_STATUS_CONFIG[pt.status].bg};
              color:${PATIENT_STATUS_CONFIG[pt.status].color};">
              ${PATIENT_STATUS_CONFIG[pt.status].label}
            </span>
          </div>
        </div>
      `);

      const existing = markersRef.current.get(pt.id);
      if (existing) {
        existing.setIcon(icon);
        existing.bindPopup(popup);
        existing.off('click');
        existing.on('click', () => {
          if (addModeRef.current) return;
          onSelectPatientRef.current(pt);
          existing.openPopup();
        });
      } else {
        const marker = L.marker([pt.lat, pt.lng], { icon })
          .bindPopup(popup)
          .addTo(map);
        marker.on('click', () => {
          if (addModeRef.current) return; // ไม่ select ถ้าอยู่ใน add mode
          onSelectPatientRef.current(pt);
          marker.openPopup();
        });
        markersRef.current.set(pt.id, marker);
      }
    });
  }, [patients, selectedId]);

  // ─── Fly to selected ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const pt = patients.find((p) => p.id === selectedId);
    if (!pt) return;
    mapRef.current.flyTo([pt.lat, pt.lng], 17, { duration: 0.8 });
    markersRef.current.get(pt.id)?.openPopup();
  }, [selectedId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="pt-map-layout">

      {/* แผนที่ */}
      <div ref={mapContainerRef} className="pt-map-container" />

      {/* แถบบอกสถานะ add mode */}
      {addMode && (
        <div className="pt-map-addmode-banner" style={{ left: 'calc(50% - 140px)', transform: 'none' }}>
          <span>📍 คลิกบนแผนที่เพื่อเลือกตำแหน่งบ้านผู้ป่วย</span>
          <button
            className="pt-map-addmode-cancel"
            onClick={() => setAddMode(false)}
          >
            <X size={14} /> ยกเลิก
          </button>
        </div>
      )}

      {/* Sidebar */}
      <div className="pt-map-sidebar pt-map-sidebar-right">
        <div className="pt-map-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={15} color="#2563eb" />
            ที่บ้านผู้ป่วย ({patients.length} ราย)
          </div>
          {/* ปุ่มเพิ่มผู้ป่วย */}
          <button
            className={`pt-map-add-btn ${addMode ? 'active' : ''}`}
            onClick={() => setAddMode((v) => !v)}
            title={addMode ? 'ยกเลิกการเพิ่ม' : 'เพิ่มผู้ป่วยใหม่'}
          >
            {addMode ? <X size={15} /> : <Plus size={15} />}
            {addMode ? 'ยกเลิก' : 'เพิ่ม'}
          </button>
        </div>

        {/* คำแนะนำตอน add mode */}
        {addMode && (
          <div className="pt-map-hint">
            👆 คลิกบนแผนที่เพื่อปักหมุดตำแหน่งบ้าน
          </div>
        )}

        <div className="pt-map-list">
          {patients.map((pt) => {
            const sc = PATIENT_STATUS_CONFIG[pt.status];
            return (
              <div
                key={pt.id}
                className={`pt-map-item ${selectedId === pt.id ? 'selected' : ''}`}
                onClick={() => {
                  if (addMode) return;
                  onSelectPatient(pt);
                }}
                style={{ cursor: addMode ? 'not-allowed' : 'pointer', opacity: addMode ? 0.5 : 1 }}
              >
                <div
                  className="pt-avatar pt-avatar-sm"
                  style={{ background: avatarColor(pt.first_name) }}
                >
                  {initials(pt.first_name, pt.last_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pt-patient-name" style={{ fontSize: '13px' }}>
                    {pt.first_name} {pt.last_name}
                  </div>
                  <div className="pt-patient-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pt.address}
                  </div>
                </div>
                <span className="pt-dot" style={{ background: sc.color, width: 8, height: 8, flexShrink: 0 }} />
              </div>
            );
          })}
          {patients.length === 0 && (
            <div className="pt-empty">ไม่มีข้อมูลผู้ป่วย</div>
          )}
        </div>
      </div>
    </div>
  );
}