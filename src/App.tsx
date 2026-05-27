import { useEffect, useMemo, useState } from 'react';
import { Home, MapPin, List, ChevronUp, ChevronDown, Plus, Menu, X, RefreshCw } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './App.css';
import './durablearticles.css';
import { getStatusBadgeClass, statusLabels } from './status';
import CityMap from './CityMap.tsx';
import AddPositionModal from './AddPositionModal';
import AddDeviceTableModal from './AddDeviceTableModal';
import ReportFormModal from './ReportFormModal';
import DeviceDetail from './DeviceDetail';
import { getDeviceTypeMeta, isKnownDeviceType, KNOWN_DEVICE_TYPE_ORDER, parseCustomTypeFromDescription } from './deviceTypeMeta';
import { fetchAllDevices, saveDevicePosition, syncPendingDevices } from './lib/data';
import { isSupabaseEnabled, supabase } from './lib/supabase';
import { fetchCustomDeviceTypes, type CustomDeviceType } from './lib/customDeviceTypes';
import type { Device, DeviceType, NewDeviceInput } from './types';



function OverviewPage({
  devices,
  customTypes,
  loading,
  addMode,
  onToggleAddMode,
  onAddPosition,
  onOpenDevice,
  onReportFromMap,
}: {
  devices: Device[];
  customTypes: CustomDeviceType[];
  loading: boolean;
  addMode: boolean;
  onToggleAddMode: () => void;
  onAddPosition: (lat: number, lng: number) => void;
  onOpenDevice: (device: Device) => void;
  onReportFromMap: (device: Device) => void;
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const navigate = useNavigate();

  const groupedDevices = useMemo(() => {
    const groups = new Map<string, Device[]>();
    devices.forEach((device) => {
      const list = groups.get(device.type) ?? [];
      list.push(device);
      groups.set(device.type, list);
    });

    return Array.from(groups.entries()).sort(([typeA], [typeB]) => {
      const idxA = KNOWN_DEVICE_TYPE_ORDER.findIndex((item) => item === typeA);
      const idxB = KNOWN_DEVICE_TYPE_ORDER.findIndex((item) => item === typeB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return typeA.localeCompare(typeB, 'th');
    });
  }, [devices, customTypes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <CityMap
          devices={devices}
          customTypes={customTypes}
          loading={loading}
          showRanges
          addMode={addMode}
          onAddPosition={onAddPosition}
          onOpenDevice={onOpenDevice}
          onReportDevice={onReportFromMap}
        />

        <button
          onClick={onToggleAddMode}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: addMode ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
        >
          <Plus size={20} />
          {addMode ? 'ยกเลิก' : 'เพิ่มตำแหน่ง'}
        </button>
      </div>

      <div
      className="overview-right-panel"
        style={{
          position: 'absolute',
          bottom: 0,
          right: '20px',
          width: '380px',
          height: isPanelOpen ? 'calc(100% - 20px)' : '60px',
          borderRadius: '16px',
          marginBottom: isPanelOpen ? '10px' : '0',
          zIndex: 1000,
          backgroundColor: 'white',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <div
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          style={{
            minHeight: '60px',
            background: 'white',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '8px', color: 'white' }}>
              <List size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>รายการอุปกรณ์</h3>
            </div>
          </div>

          <div style={{ color: '#94a3b8', display: 'flex' }}>
            {isPanelOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
            ทั้งหมด {devices.length} จุด
          </div>

          {groupedDevices.map(([type, items]) => {
            const customMeta = customTypes.find((item) => item.typeCode === type);
            const meta = getDeviceTypeMeta(type, customMeta ?? parseCustomTypeFromDescription(items[0]?.description));
            return (
              <div key={type} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>
                  {meta.icon} {meta.label} ({items.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((item) => (
                    <div
                      key={`${type}-${item.id}`}
                      className="list-card"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/devices/${encodeURIComponent(item.type)}?id=${encodeURIComponent(item.id)}`);
                      }}
                    >
                      <div className="card-left">
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>#{item.id}</div>
                        <div className="card-sub">{item.name}</div>
                      </div>
                      <div className={`status-pill ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeviceRoutePage({
  devices,
  customTypes,
  onRefresh,
  refreshing,
  onNavigateOverview,
  onComplaintSubmitted,
  onOpenReport,
  onOpenAddDevice,
}: {
  devices: Device[];
  customTypes: CustomDeviceType[];
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateOverview: () => void;
  onComplaintSubmitted: () => void;
  onOpenReport: (device: Device) => void;
  onOpenAddDevice: () => void;
}) {
  const params = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    KNOWN_DEVICE_TYPE_ORDER.forEach((item) => set.add(item));
    customTypes.forEach((item) => set.add(item.typeCode));
    devices.forEach((item) => set.add(item.type));

    const known = KNOWN_DEVICE_TYPE_ORDER.filter((item) => set.has(item));
    const custom = Array.from(set)
      .filter((item) => !isKnownDeviceType(item))
      .sort((a, b) => a.localeCompare(b, 'th'));

    return [...known, ...custom];
  }, [devices]);

  const routeType = params.type ? decodeURIComponent(params.type) : '';
  const fallbackType = availableTypes[0] ?? 'streetlight';
  const type = (availableTypes.includes(routeType) ? routeType : fallbackType) as DeviceType;

  const selectedId = searchParams.get('id') ?? undefined;

  const setSelectedId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="device-page" style={{ padding: '20px', background: 'white', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div className="device-tabs">
          {availableTypes.map((tabType) => {
            const customMeta = customTypes.find((item) => item.typeCode === tabType);
            const firstDevice = devices.find((item) => item.type === tabType);
            const meta = getDeviceTypeMeta(tabType, customMeta ?? parseCustomTypeFromDescription(firstDevice?.description));
            return (
              <button
                key={tabType}
                className={type === tabType ? 'active' : ''}
                onClick={() => navigate(`/devices/${encodeURIComponent(tabType)}`)}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" onClick={onOpenAddDevice} className="btn-add-device">
            <Plus size={16} />
            <span>เพิ่มอุปกรณ์</span>
          </button>
          <button onClick={onRefresh} className="btn-update" disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'กำลังโหลด...' : 'อัปเดตข้อมูล'}</span>
          </button>
        </div>
      </div>
      <div className="device-content">
        <DeviceDetail
          type={type}
          devices={devices}
          customTypes={customTypes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onNavigateOverview={onNavigateOverview}
          onComplaintSubmitted={onComplaintSubmitted}
          onOpenReport={onOpenReport}
        />
      </div>
    </div>
  );
}

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [tempLat, setTempLat] = useState(0);
  const [tempLng, setTempLng] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Device | null>(null);
  const [customTypes, setCustomTypes] = useState<CustomDeviceType[]>([]);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const loadDevices = async (withRefreshIndicator: boolean) => {
    if (withRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoadingSheets(true);
    }

    try {
      const data = await fetchAllDevices();
      const sampleDevice = data.length > 0 ? data[0] : null;
      console.debug('[App] loadDevices fetched:', {
        totalCount: data.length,
        byType: {
          streetlight: data.filter((d) => d.type === 'streetlight').length,
          wifi: data.filter((d) => d.type === 'wifi').length,
          hydrant: data.filter((d) => d.type === 'hydrant').length,
        },
        sampleDevice: sampleDevice
          ? {
              id: sampleDevice.id,
              name: sampleDevice.name,
              type: sampleDevice.type,
              status: sampleDevice.status,
              source: sampleDevice.source,
              syncStatus: sampleDevice.syncStatus,
              department: sampleDevice.department,
            }
          : null,
      });
      setDevices(data);
    } finally {
      setLoadingSheets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      await syncPendingDevices();
      if (disposed) return;
      await loadDevices(false);
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      void (async () => {
        const result = await syncPendingDevices();
        if (result.attempted > 0) {
          await loadDevices(true);
        }
      })();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    const client = supabase;

    const channel = client
      .channel('realtime-devices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload) => {
          console.debug('[App] realtime devices change:', {
            event: payload.eventType,
            table: payload.table,
          });
          void loadDevices(true);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadCustomTypes = async () => {
      const data = await fetchCustomDeviceTypes();
      setCustomTypes(data);
    };

    void loadCustomTypes();
  }, []);

  useEffect(() => {
    console.debug('[App] devices state updated:', {
      count: devices.length,
      latest: devices.length > 0 ? devices[devices.length - 1] : null,
    });
  }, [devices]);

  const handleAddPosition = (lat: number, lng: number) => {
    setTempLat(lat);
    setTempLng(lng);
    setIsAddModalOpen(true);
  };

  const handleSavePosition = async (data: NewDeviceInput) => {
    try {
      const newDevice = await saveDevicePosition(data);
      console.debug('[App] saveDevicePosition returned:', newDevice);

      setDevices((prev) => {
        const exists = prev.some((item) => item.type === newDevice.type && item.id === newDevice.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      await loadDevices(true);
      setAddMode(false);
      alert('เพิ่มตำแหน่งใหม่สำเร็จ!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกตำแหน่งอุปกรณ์ได้';
      console.error('[App] failed to save device position:', error);
      alert(`บันทึกไม่สำเร็จ: ${message}`);
    }
  };

  const toggleAddMode = () => {
    const next = !addMode;
    setAddMode(next);
    if (next) {
      alert('คลิกบนแผนที่เพื่อเลือกตำแหน่งที่ต้องการเพิ่ม');
    }
  };

  const handleOpenDevice = (device: Device) => {
    navigate(`/devices/${device.type}?id=${encodeURIComponent(device.id)}`);
  };

  const handleReportFromMap = (device: Device) => {
    if (reportTarget !== null) return;
    setReportTarget(device);
  };

  const reloadCustomTypes = async () => {
    const data = await fetchCustomDeviceTypes();
    setCustomTypes(data);
  };

  const activeMenu = useMemo<'overview' | 'devices'>(() => {
    if (location.pathname.startsWith('/devices')) return 'devices';
    return 'overview';
  }, [location.pathname]);

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      
      {/* 🟢 ส่วนที่เพิ่มใหม่ 1: ปุ่มเปิดเมนูบนมือถือ */}
      <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
        <Menu size={24} />
      </button>

      {/* 🟢 ส่วนที่เพิ่มใหม่ 2: พื้นหลังสีดำจางๆ ตอนกดเปิดเมนู */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* 🟡 ส่วนที่แก้ไข 1: แทรกตัวแปร isMobileMenuOpen ใส่ Class และปรับ zIndex เป็น 9999 */}
      <aside className={`shared-sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{ width: '250px', flexShrink: 0, zIndex: 9999 }}>
        
        {/* 🟡 ส่วนที่แก้ไข 2: ปรับ Layout Header เพื่อให้ใส่ปุ่ม [X] ปิดเมนูได้ */}
        <div className="sidebar-left-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="logo-icon">
              <Home size={20} color="white" />
            </div>
            <div>
              <h3>เทศบาลตำบล</h3>
              <p>พลูตาหลวง</p>
            </div>
          </div>
          
          {/* 🟢 ส่วนที่เพิ่มใหม่ 3: ปุ่ม X สำหรับปิดเมนู (จะโผล่มาเฉพาะมือถือ) */}
          {isMobileMenuOpen && (
            <div onClick={() => setIsMobileMenuOpen(false)} style={{ cursor: 'pointer', padding: '5px' }}>
              <X size={24} color="#94a3b8" />
            </div>
          )}
        </div>

        {/* เมนูรายการอุปกรณ์และภาพรวม (โค้ดเดิม ไม่มีการเปลี่ยนแปลง) */}
        <div className="menu-list">
          <NavLink to="/" className={`menu-item ${activeMenu === 'overview' ? 'active' : ''}`}>
            <Home size={18} /> ภาพรวม
          </NavLink>
          <NavLink to="/devices/streetlight" className={`menu-item ${activeMenu === 'devices' ? 'active' : ''}`}>
            <MapPin size={18} /> อุปกรณ์
          </NavLink>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage
                devices={devices}
                customTypes={customTypes}
                loading={loadingSheets}
                addMode={addMode}
                onToggleAddMode={toggleAddMode}
                onAddPosition={handleAddPosition}
                onOpenDevice={handleOpenDevice}
                onReportFromMap={handleReportFromMap}
              />
            }
          />
          <Route
            path="/devices/:type"
            element={
              <DeviceRoutePage
                devices={devices}
                customTypes={customTypes}
                onRefresh={() => {
                  void loadDevices(true);
                }}
                refreshing={isRefreshing}
                onNavigateOverview={() => navigate('/')}
                onComplaintSubmitted={() => {
                  // no-op hook for future analytics
                }}
                onOpenReport={handleReportFromMap}
                onOpenAddDevice={() => setIsAddDeviceOpen(true)}
              />
            }
          />
          <Route path="/devices" element={<Navigate to="/devices/streetlight" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AddPositionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddMode(false);
        }}
        customTypes={customTypes}
        onCustomTypesChanged={() => {
          void reloadCustomTypes();
        }}
        onSave={(data) => {
          void handleSavePosition(data);
        }}
        initialLat={tempLat}
        initialLng={tempLng}
      />

      <ReportFormModal
        isOpen={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        deviceId={reportTarget?.id ?? ''}
        deviceType={reportTarget?.type ?? 'streetlight'}
        deviceName={reportTarget?.name ?? '-'}
        location={reportTarget ? `${reportTarget.lat.toFixed(6)}, ${reportTarget.lng.toFixed(6)}` : '-'}
        status={reportTarget ? statusLabels[reportTarget.status] : '-'}
        customTypes={customTypes}
        onSubmitted={() => {
          // no-op hook for future analytics
        }}
      />

      <AddDeviceTableModal
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        customTypes={customTypes}
        onCreated={() => {
          void reloadCustomTypes();
        }}
      />
    </div>
  );
}

export default App;
