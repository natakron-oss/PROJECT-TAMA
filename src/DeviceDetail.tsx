import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Droplet, Gauge, Lightbulb, MapPin, RefreshCw, Signal, Wifi, Clock, Edit, Check, X, Trash2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './durablearticles.css';
import { getStatusBadgeClass, statusColors, statusLabels, type DeviceStatus } from './status';
import { getDeviceTypeMeta, isKnownDeviceType, parseCustomTypeFromDescription } from './deviceTypeMeta';
import ReportButton from './ReportButton';
import type { Device, DeviceType } from './types';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import { deleteDeviceData, fetchDeviceComplaints, fetchDeviceEditLogs, type DeviceEditHistoryItem, updateDeviceData } from './lib/data';
import { findSchemaRow } from './lib/googleSheetsSchema';

const BASE_SPEC_KEYS = new Set([
  'LOCATION',
  'LAT',
  'LNG',
  'LON',
  'IMG_FILE',
  'IMG_DATE',
  'STATUS',
  'STATUSDATE',
  'RANGE',
]);

function normalizeText(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).trim();
}

function toSpecEntries(fields: Record<string, string> | undefined): Array<[string, string]> {
  if (!fields) return [];
  return Object.entries(fields)
    .map(([k, v]) => [normalizeText(k), normalizeText(v)] as [string, string])
    .filter(([k, v]) => Boolean(k) && Boolean(v) && !BASE_SPEC_KEYS.has(k.toUpperCase()));
}

const iconDefaultPrototype = (L.Icon.Default as any).prototype;
delete iconDefaultPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DeviceDetailProps {
  type: DeviceType;
  devices: Device[];
  customTypes: CustomDeviceType[];
  selectedId?: string;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateOverview: () => void;
  onComplaintSubmitted: () => void;
  onOpenReport: (device: Device) => void;
}

interface ComplaintHistoryItem {
  status: string;
  description: string | null;
  created_at: string | null;
  image_url?: string | null;
}

type OptimisticEdit = {
  name: string;
  status: DeviceStatus;
};

type ToastState = {
  message: string;
  tone: 'success' | 'error' | 'info';
};

type TypeConfig = { title: string; subtitle: string; icon: string; listIcon: ReactNode };

const TYPE_CONFIG: Record<'streetlight' | 'wifi' | 'hydrant', TypeConfig> = {
  streetlight: { title: 'ไฟส่องสว่าง', subtitle: 'ฐานข้อมูลครุภัณฑ์ไฟสาธารณะ', icon: '💡', listIcon: <Lightbulb size={20} color="#2563eb" /> },
  wifi: { title: 'ไวไฟชุมชน', subtitle: 'จุดกระจายสัญญาณอินเทอร์เน็ตฟรี', icon: '📶', listIcon: <Wifi size={20} color="#2563eb" /> },
  hydrant: { title: 'ประปาหัวแดง', subtitle: 'จุดจ่ายน้ำดับเพลิงและแรงดันน้ำ', icon: '🚒', listIcon: <Droplet size={20} color="#dc2626" /> },
};

function getTypeConfig(type: DeviceType, customMeta?: CustomDeviceType | null, sampleDescription?: string): TypeConfig {
  if (isKnownDeviceType(type)) {
    // เปลี่ยนจาก: return TYPE_CONFIG[type];
// เป็น:
return TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.streetlight; 
// หรือใช้ default config ถ้าหาไม่เจอ
  }

  const meta = getDeviceTypeMeta(type, customMeta ?? parseCustomTypeFromDescription(sampleDescription));
  return {
    title: meta.label,
    subtitle: 'หมวดอุปกรณ์ที่เพิ่มเอง',
    icon: meta.icon,
    listIcon: <MapPin size={20} color="#2563eb" />,
  };
}

function toLatLng(device: Device): [number, number] | null {
  if (!Number.isFinite(device.lat) || !Number.isFinite(device.lng)) return null;
  return [device.lat, device.lng];
}

function DeviceDetail({
  type, devices, customTypes, selectedId, onSelect, onRefresh, refreshing: _refreshing, onNavigateOverview: _onNavigateOverview, onComplaintSubmitted: _onComplaintSubmitted, onOpenReport,
}: DeviceDetailProps) {
  const filteredDevices = useMemo(() => devices.filter((device) => device.type === type), [devices, type]);
  const config = getTypeConfig(type, customTypes.find((item) => item.typeCode === type) ?? null, filteredDevices[0]?.description);

  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // --- State ใหม่สำหรับ Tabs, History และ Edit Mode ---
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [historyList, setHistoryList] = useState<ComplaintHistoryItem[]>([]);
  const [editHistoryList, setEditHistoryList] = useState<DeviceEditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- State สำหรับเก็บค่าตอนแก้ไข ---
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<DeviceStatus>('normal');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [optimisticEdits, setOptimisticEdits] = useState<Record<string, OptimisticEdit>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const [sheetSpecs, setSheetSpecs] = useState<Record<string, string> | null>(null);
  const [sheetSpecsLoading, setSheetSpecsLoading] = useState(false);
  const [sheetSpecsError, setSheetSpecsError] = useState<string | null>(null);

  const showToast = (message: string, tone: ToastState['tone']) => {
    setToast({ message, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const timerId = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  useEffect(() => {
    if (selectedId) setCurrentId(selectedId);
    else if (!currentId && filteredDevices.length > 0) setCurrentId(filteredDevices[0].id);
  }, [selectedId, filteredDevices, currentId]);

  const applyOptimisticEdit = (device: Device): Device => {
    const patch = optimisticEdits[device.id];
    if (!patch) return device;
    return {
      ...device,
      name: patch.name,
      status: patch.status,
    };
  };

  const displayedDevices = useMemo(
    () => filteredDevices.map((device) => applyOptimisticEdit(device)),
    [filteredDevices, optimisticEdits],
  );

  // สร้างตัวแปร selectedDevice
  const selectedDevice = useMemo(
    () => displayedDevices.find((item) => item.id === currentId) ?? displayedDevices[0],
    [displayedDevices, currentId],
  );

  const selectedBaseDevice = useMemo(
    () => filteredDevices.find((item) => item.id === currentId) ?? filteredDevices[0],
    [filteredDevices, currentId],
  );

  // --- ย้ายฟังก์ชันและ useEffect ที่เรียกใช้ selectedDevice มาไว้ตรงนี้ ---
  // เมื่อกดปุ่ม "แก้ไข" ให้ดึงค่าปัจจุบันมาใส่ฟอร์มรอไว้
  useEffect(() => {
    if (isEditing && selectedDevice) {
      setEditName(selectedDevice.name);
      setEditStatus(selectedDevice.status);
    }
  }, [isEditing, selectedDevice]);

  // ฟังก์ชันกดบันทึก
  const handleSaveEdit = async () => {
    if (!selectedDevice || !selectedBaseDevice) return;
    const normalizedName = editName.trim();
    if (!normalizedName) {
      showToast('กรุณาระบุสถานที่ตั้ง', 'error');
      return;
    }

    const rollbackName = selectedBaseDevice.name;
    const rollbackStatus = selectedBaseDevice.status;
    setOptimisticEdits((prev) => ({
      ...prev,
      [selectedBaseDevice.id]: {
        name: normalizedName,
        status: editStatus,
      },
    }));

    try {
      setIsSaving(true);
      await updateDeviceData(selectedBaseDevice.id, {
        ...selectedBaseDevice,
        name: normalizedName,
        status: editStatus,
      }, {
        changedBy: 'web-user',
        note: 'แก้ไขจาก Device Detail',
        before: {
          name: rollbackName,
          status: rollbackStatus,
        },
      });
      showToast('บันทึกการแก้ไขเรียบร้อยแล้ว', 'success');
      setIsEditing(false); // ปิดโหมดแก้ไข
      onRefresh(); // สั่งรีเฟรชข้อมูลให้ตารางอัปเดต
    } catch (error) {
      setOptimisticEdits((prev) => {
        const next = { ...prev };
        delete next[selectedBaseDevice.id];
        return next;
      });
      setEditName(rollbackName);
      setEditStatus(rollbackStatus);
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      const isPermissionIssue = message.includes('42501') || message.toLowerCase().includes('permission denied');
      showToast(
        isPermissionIssue
          ? 'บันทึกไม่สำเร็จ: สิทธิ์ฐานข้อมูลไม่เพียงพอ (RLS/Policy)'
          : `บันทึกไม่สำเร็จ: ${message}`,
        'error',
      );
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;
    if (isSaving || isDeleting) return;

    const ok = window.confirm(`ยืนยันการลบอุปกรณ์นี้?\n\n${selectedDevice.name} (${selectedDevice.id})`);
    if (!ok) return;

    try {
      setIsDeleting(true);
      await deleteDeviceData({
        id: selectedDevice.id,
        type: selectedDevice.type,
        name: selectedDevice.name,
        lat: selectedDevice.lat,
        lng: selectedDevice.lng,
      });
      showToast('ลบอุปกรณ์เรียบร้อยแล้ว', 'success');
      setIsEditing(false);
      _onNavigateOverview();
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบอุปกรณ์';
      const isPermissionIssue = message.includes('42501') || message.toLowerCase().includes('permission denied');
      showToast(
        isPermissionIssue
          ? 'ลบไม่สำเร็จ: สิทธิ์ฐานข้อมูลไม่เพียงพอ (RLS/Policy)'
          : `ลบไม่สำเร็จ: ${message}`,
        'error',
      );
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  // เมื่อเลือกอุปกรณ์ใหม่ ให้ปิดโหมด Edit และถ้าอยู่หน้า History ให้ดึงข้อมูลใหม่
  useEffect(() => {
    if (!selectedDevice) return;
    setCurrentId(selectedDevice.id);
    setIsEditing(false);

    if (activeTab === 'history') {
      loadHistory(selectedDevice.id);
    }
  }, [selectedDevice, activeTab]);

  // Load specification values from Google Sheets for custom device types.
  useEffect(() => {
    if (!selectedDevice) return;

    const isKnown = selectedDevice.type === 'streetlight' || selectedDevice.type === 'wifi' || selectedDevice.type === 'hydrant';
    if (isKnown) {
      setSheetSpecs(null);
      setSheetSpecsError(null);
      setSheetSpecsLoading(false);
      return;
    }

    const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
    const token = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
    const spreadsheetId = (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? '';

    if (!appsScriptUrl.trim() || !spreadsheetId.trim()) {
      setSheetSpecs(null);
      setSheetSpecsError('ยังไม่ได้ตั้งค่า Apps Script / Spreadsheet');
      setSheetSpecsLoading(false);
      return;
    }

    let disposed = false;
    (async () => {
      setSheetSpecsLoading(true);
      setSheetSpecsError(null);
      try {
        const where = {
          LOCATION: selectedDevice.name,
          LAT: selectedDevice.lat.toFixed(6),
          LON: selectedDevice.lng.toFixed(6),
        };

        const result = await findSchemaRow({
          appsScriptUrl,
          token,
          spreadsheetId,
          sheetName: String(selectedDevice.type),
          where,
        });

        if (disposed) return;
        if (!result.found || !result.data) {
          setSheetSpecs(null);
          setSheetSpecsError('ไม่พบข้อมูลในชีตนี้');
          return;
        }

        setSheetSpecs(result.data);
      } catch (error) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        setSheetSpecs(null);
        setSheetSpecsError(message || 'โหลดข้อมูลจากชีตไม่สำเร็จ');
      } finally {
        if (!disposed) setSheetSpecsLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [selectedDevice]);

  const loadHistory = async (id: string) => {
    setLoadingHistory(true);
    try {
      const [complaints, editLogs] = await Promise.all([
        fetchDeviceComplaints(id),
        fetchDeviceEditLogs(id),
      ]);
      setHistoryList(complaints as ComplaintHistoryItem[]);
      setEditHistoryList(editLogs);
    } finally {
      setLoadingHistory(false);
    }
  };

  // แผนที่ทำงานเหมือนเดิม (ย่อโค้ดเพื่อความกระชับ)
  useEffect(() => {
    if (!mapContainerRef.current || !selectedDevice) return;
    const latLng = toLatLng(selectedDevice);
    if (!latLng) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(latLng, 16);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        crossOrigin: true,
      }).addTo(map);
      window.setTimeout(() => {
        map.invalidateSize();
      }, 120);
    } else {
      mapRef.current.setView(latLng, 16);
      mapRef.current.invalidateSize();
    }

    if (markerRef.current) markerRef.current.remove();
    const markerColor = statusColors[selectedDevice.status];
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-container" style="background-color: ${markerColor}"><span class="marker-icon">${config.icon}</span></div>`,
      iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40],
    });

    markerRef.current = L.marker(latLng, { icon: customIcon }).addTo(mapRef.current);
  }, [selectedDevice, config.icon]);

  if (filteredDevices.length === 0) {
    return (
      <div className="sl-container"><div className="sl-header"><h2>{config.title}</h2><p>ไม่พบข้อมูลอุปกรณ์</p></div></div>
    );
  }

  const renderDetailRows = (device: Device) => {
    if (device.type === 'streetlight') {
      const streetlight = device as any;
      return (
        <>
          <div><span className="sl-field-label">ประเภทโคม</span><p className="sl-field-value">{streetlight.lampType || '-'}</p></div>
          <div><span className="sl-field-label">หลอดไฟ</span><p className="sl-field-value">{streetlight.bulbType || '-'}</p></div>
          <div><span className="sl-field-label">กำลังไฟ</span><p className="sl-field-value">{streetlight.watt || '-'}</p></div>
        </>
      );
    }
    if (device.type === 'wifi') {
      const wifi = device as any;
      return (
        <>
          <div><span className="sl-field-label">ผู้ให้บริการ</span><p className="sl-field-value">{wifi.isp || '-'}</p></div>
          <div><span className="sl-field-label">ความเร็ว</span><p className="sl-field-value"><Signal size={16} style={{ display: 'inline' }} /> {wifi.speed || '-'}</p></div>
        </>
      );
    }
    if (device.type === 'hydrant') {
      const hydrant = device as any;
      return (
        <>
          <div><span className="sl-field-label">ระดับแรงดันน้ำ</span><p className="sl-field-value"><Gauge size={16} style={{ display: 'inline' }} /> {hydrant.pressure || '-'}</p></div>
        </>
      );
    }

    const specsFromSheet = toSpecEntries(sheetSpecs ?? undefined);
    const specsFromDevice = toSpecEntries(device.customFields);

    const merged = new Map<string, string>();
    for (const [k, v] of specsFromDevice) merged.set(k, v);
    for (const [k, v] of specsFromSheet) merged.set(k, v);

    const entries = Array.from(merged.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    if (sheetSpecsLoading) {
      return (
        <>
          <div><span className="sl-field-label">ข้อมูลจำเพาะ</span><p className="sl-field-value">กำลังโหลดข้อมูลจาก Google Sheets...</p></div>
        </>
      );
    }

    if (sheetSpecsError) {
      return (
        <>
          <div><span className="sl-field-label">ข้อมูลจำเพาะ</span><p className="sl-field-value">{sheetSpecsError}</p></div>
        </>
      );
    }

    if (entries.length === 0) {
      return (
        <>
          <div><span className="sl-field-label">ข้อมูลจำเพาะ</span><p className="sl-field-value">-</p></div>
        </>
      );
    }

    return (
      <>
        {entries.map(([key, value]) => (
          <div key={key}><span className="sl-field-label">{key}</span><p className="sl-field-value">{value}</p></div>
        ))}
      </>
    );
  };

  return (
    <div className="sl-container">
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 21000,
            minWidth: '260px',
            maxWidth: '420px',
            padding: '12px 14px',
            borderRadius: '10px',
            color: 'white',
            fontWeight: 700,
            background: toast.tone === 'success' ? '#16a34a' : toast.tone === 'error' ? '#dc2626' : '#0ea5e9',
            boxShadow: '0 10px 20px rgba(2, 6, 23, 0.25)',
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="sl-header">
        <div className="header-row">
          <div><h2>{config.title}</h2><p>{config.subtitle}</p></div>
        </div>
      </div>

      <div className="sl-layout">
        {/* กล่องซ้าย รายการอุปกรณ์ (โค้ดเดิม) */}
        <div className="sl-panel">
          <div className="sl-panel-header">
            {config.listIcon}<h3>รายการ ({filteredDevices.length})</h3>
          </div>
          <div className="sl-list-content">
            {displayedDevices.map((item) => (
              <div key={item.id} onClick={() => onSelect(item.id)} className={`sl-card ${selectedDevice?.id === item.id ? 'active' : ''}`}>
                <div className="sl-card-row">
                  <span className="sl-id">{item.id}</span>
                  <span className={`sl-status ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</span>
                </div>
                <p className="sl-location">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* กล่องขวา รายละเอียด / ประวัติ */}
        <div className="sl-panel">
          <div className="sl-panel-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color="#2563eb" />
              <h3>ข้อมูลอุปกรณ์: {selectedDevice?.id}</h3>
            </div>

            {/* แท็บสลับหน้า */}
            <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setActiveTab('detail')}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeTab === 'detail' ? '#eff6ff' : 'transparent', color: activeTab === 'detail' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'detail' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <MapPin size={16} /> รายละเอียด
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeTab === 'history' ? '#eff6ff' : 'transparent', color: activeTab === 'history' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'history' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Clock size={16} /> ประวัติซ่อม
              </button>
            </div>
          </div>

          <div className="sl-scrollable-content">
            {/* แผนที่ย่อ */}
            <div className="sl-map-area" ref={mapContainerRef} style={{ height: '220px', width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }} />

            <div className="sl-detail-box" style={{ flex: 1 }}>

              {/* --- เนื้อหาแท็บ "รายละเอียด" --- */}
              {activeTab === 'detail' && selectedDevice && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>{selectedDevice.name}</h2>
                      <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>พิกัด: {selectedDevice.lat.toFixed(6)}, {selectedDevice.lng.toFixed(6)}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className={`sl-status ${getStatusBadgeClass(statusLabels[selectedDevice.status])}`} style={{ fontSize: '0.9rem', padding: '6px 12px', display: 'flex', alignItems: 'center' }}>
                        {statusLabels[selectedDevice.status]}
                      </span>

                      {/* ปุ่มแก้ไข */}
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        disabled={isDeleting}
                        style={{ padding: '6px 12px', background: isEditing ? '#fef2f2' : '#f1f5f9', color: isEditing ? '#ef4444' : '#475569', border: 'none', borderRadius: '20px', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        {isEditing ? <><X size={16} /> ยกเลิก</> : <><Edit size={16} /> แก้ไข</>}
                      </button>

                      <button
                        onClick={handleDeleteDevice}
                        disabled={isDeleting || isSaving}
                        style={{ padding: '6px 12px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '20px', cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer', opacity: isDeleting || isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        <Trash2 size={16} /> {isDeleting ? 'กำลังลบ...' : 'ลบ'}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#3b82f6' }}>โหมดแก้ไขข้อมูล</h4>
                      <div className="sl-detail-grid">
                        <div>
                          <span className="sl-field-label">สถานที่ตั้ง</span>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <span className="sl-field-label">สถานะ</span>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as DeviceStatus)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="normal">ปกติดี</option>
                            <option value="damaged">ชำรุด</option>
                            <option value="repairing">กำลังซ่อม</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        style={{ marginTop: '16px', padding: '8px 16px', background: isSaving ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSaving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Check size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                      </button>
                    </div>
                  ) : (
                    <div className="sl-detail-grid">
                      <div><span className="sl-field-label">หน่วยงาน</span><p className="sl-field-value">{selectedDevice.department}</p></div>
                      <div><span className="sl-field-label">รายละเอียด (รวม)</span><p className="sl-field-value" style={{ whiteSpace: 'pre-line' }}>{selectedDevice.description || '-'}</p></div>
                      {renderDetailRows(selectedDevice)}
                    </div>
                  )}

                  <ReportButton
                    deviceId={selectedDevice.id}
                    deviceType={selectedDevice.type}
                    deviceName={selectedDevice.name}
                    location={`${selectedDevice.lat.toFixed(6)}, ${selectedDevice.lng.toFixed(6)}`}
                    status={statusLabels[selectedDevice.status]}
                    onOpenReport={() => onOpenReport(selectedDevice)}
                  />
                </>
              )}

              {/* --- เนื้อหาแท็บ "ประวัติการซ่อม" --- */}
              {activeTab === 'history' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>ประวัติการแจ้งซ่อม: {selectedDevice?.id}</h3>

                  {loadingHistory ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}><RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto' }} />กำลังโหลดประวัติ...</div>
                  ) : historyList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                      <Check size={32} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
                      ยังไม่มีประวัติการแจ้งซ่อม อุปกรณ์นี้ใช้งานได้ปกติดี
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {historyList.map((historyItem, index) => (
                        <div key={index} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ color: '#334155' }}>สถานะแจ้ง: {historyItem.status}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              {historyItem.created_at ? new Date(historyItem.created_at).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>รายละเอียด: {historyItem.description || '-'}</p>
                          {historyItem.image_url && (
                            <a href={historyItem.image_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '10px' }}>
                              <img
                                src={historyItem.image_url}
                                alt="รูปแนบการร้องเรียน"
                                style={{ width: '100%', maxWidth: '260px', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                              />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginTop: '20px', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>ประวัติการแก้ไขข้อมูล</h3>
                  {editHistoryList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                      ยังไม่มีประวัติการแก้ไขสถานที่ตั้ง/สถานะ
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {editHistoryList.map((logItem) => (
                        <div key={logItem.id} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '12px' }}>
                            <strong style={{ color: '#334155' }}>ผู้แก้ไข: {logItem.changed_by || 'ไม่ระบุ'}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              {logItem.created_at ? new Date(logItem.created_at).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                            สถานที่ตั้ง: {logItem.before_name || '-'} → {logItem.after_name || '-'}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                            สถานะ: {logItem.before_status || '-'} → {logItem.after_status || '-'}
                          </p>
                          {logItem.note && (
                            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#475569' }}>หมายเหตุ: {logItem.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeviceDetail;