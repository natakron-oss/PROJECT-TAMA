import { useEffect, useState } from 'react';
import { X, MapPin, Save } from 'lucide-react';
import './AddPositionModal.css';
import type { DeviceStatus } from './status';
import { getDeviceTypeMeta, KNOWN_DEVICE_TYPE_ORDER } from './deviceTypeMeta';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import { REQUIRED_DEVICE_COLUMNS } from './lib/customDeviceSchemas';
import { getSchemaHeaders } from './lib/googleSheetsSchema';
import type { DeviceType, NewDeviceInput } from './types';

const DEFAULT_SCHEMA_SPREADSHEET_ID = '1o0HsgmEeKRmKO6mUKGrppjgAIsFWlfJ87U-YPcpTMYo';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewDeviceInput) => void;
  customTypes: CustomDeviceType[];
  onCustomTypesChanged: () => void;
  initialLat?: number;
  initialLng?: number;
}

type DeviceTypeOption = {
  value: DeviceType;
  label: string;
  icon: string;
};

const baseDeviceTypes: DeviceTypeOption[] = KNOWN_DEVICE_TYPE_ORDER.map((value) => {
  const meta = getDeviceTypeMeta(value);
  return {
    value,
    label: meta.label,
    icon: meta.icon,
  };
});

const statusOptions: Array<{ value: DeviceStatus; label: string }> = [
  { value: 'normal', label: '✓ ปกติ' },
  { value: 'damaged', label: '⚠️ ชำรุด' },
  { value: 'repairing', label: '🔧 กำลังซ่อม' }
];

function toDeviceStatus(value: string): DeviceStatus {
  if (value === 'normal' || value === 'damaged' || value === 'repairing') {
    return value;
  }
  return 'normal';
}


function AddPositionModal({ isOpen, onClose, onSave, customTypes, onCustomTypesChanged: _onCustomTypesChanged, initialLat = 0, initialLng = 0 }: AddPositionModalProps) {
  const [type, setType] = useState<DeviceType>('streetlight');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DeviceStatus>('normal');
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  const [useRadiusPin, setUseRadiusPin] = useState(true);
  const [useSketchPin, setUseSketchPin] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState<number>(100);

  // --- States สำหรับฟิลด์ยืดหยุ่น ---
  const [lampType, setLampType] = useState('');
  const [bulbType, setBulbType] = useState('');
  const [watt, setWatt] = useState('');
  const [owner, setOwner] = useState('');
  const [isp, setIsp] = useState('');
  const [speed, setSpeed] = useState('');
  const [pressure, setPressure] = useState('');

  const [customSchemaColumns, setCustomSchemaColumns] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [loadingCustomSchema, setLoadingCustomSchema] = useState(false);
  const [customSchemaError, setCustomSchemaError] = useState<string | null>(null);

  const customDeviceTypeOptions: DeviceTypeOption[] = customTypes.map((item) => ({
    value: item.typeCode,
    label: item.label,
    icon: item.icon,
  }));

  const deviceTypes = [...baseDeviceTypes, ...customDeviceTypeOptions];
  const activeType = deviceTypes.find((item) => item.value === type);

  useEffect(() => {
    if (!isOpen) return;
    setLat(initialLat);
    setLng(initialLng);
  }, [initialLat, initialLng, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const isCustom = type !== 'streetlight' && type !== 'wifi' && type !== 'hydrant';
    if (!isCustom) {
      setCustomSchemaColumns([]);
      setCustomFieldValues({});
      setLoadingCustomSchema(false);
      setCustomSchemaError(null);
      return;
    }

    const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
    const token = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
    const spreadsheetId =
      (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? DEFAULT_SCHEMA_SPREADSHEET_ID;

    if (!appsScriptUrl.trim()) {
      setCustomSchemaColumns([]);
      setCustomFieldValues({});
      setLoadingCustomSchema(false);
      setCustomSchemaError('ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_SCHEMA_URL');
      return;
    }

    const excludedSet = new Set(REQUIRED_DEVICE_COLUMNS.map((col) => col.trim().toUpperCase()));
    let disposed = false;
    setLoadingCustomSchema(true);
    setCustomSchemaError(null);

    void (async () => {
      try {
        const headers = await getSchemaHeaders({
          appsScriptUrl,
          token,
          spreadsheetId,
          sheetName: String(type),
        });

        const columns = headers
          .map((h) => h.trim())
          .filter((h) => h.length > 0)
          // show any column beyond required ones (case-insensitive)
          .filter((h) => !excludedSet.has(h.toUpperCase()));

        if (disposed) return;
        setCustomSchemaColumns(columns);
        setCustomFieldValues((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const col of columns) {
            if (typeof next[col] !== 'string') next[col] = '';
          }
          // remove keys no longer present
          for (const key of Object.keys(next)) {
            if (!columns.includes(key)) delete next[key];
          }
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[AddPositionModal] failed to load custom schema headers:', { message, error });
        if (disposed) return;
        setCustomSchemaColumns([]);
        setCustomFieldValues({});
        setCustomSchemaError(message || 'โหลดคอลัมน์ไม่สำเร็จ');
      } finally {
        if (!disposed) setLoadingCustomSchema(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [type, isOpen]);

  const updateCustomField = (key: string, value: string) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('กรุณากรอกชื่อตำแหน่ง');
      return;
    }

    if (!useRadiusPin && !useSketchPin) {
      alert('กรุณาเลือกรูปแบบหมุดอย่างน้อย 1 แบบ');
      return;
    }

    const sanitizedRadius = typeof radiusMeters === 'number' ? radiusMeters : parseFloat(String(radiusMeters));
    
    onSave({
      type,
      customTypeLabel: activeType?.label,
      customTypeIcon: activeType?.icon,
      name: name.trim(),
      description: description.trim(),
      status,
      lat,
      lng,
      useRadiusPin,
      useSketchPin,
      radiusMeters: useRadiusPin ? sanitizedRadius : undefined,
      // ส่งข้อมูลเฉพาะทางไปด้วย
      lampType, bulbType, watt, owner,
      isp, speed, pressure,
      customFields: (type !== 'streetlight' && type !== 'wifi' && type !== 'hydrant') ? customFieldValues : undefined,
    });

    // Reset form
    setName(''); setDescription(''); setStatus('normal'); setType('streetlight');
    setUseRadiusPin(true); setUseSketchPin(false); setRadiusMeters(100);
    setLampType(''); setBulbType(''); setWatt(''); setOwner('');
    setIsp(''); setSpeed(''); setPressure('');
    setCustomSchemaColumns([]);
    setCustomFieldValues({});
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <MapPin size={24} color="#3b82f6" />
            <h2>เพิ่มตำแหน่งใหม่</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">


          <div className="form-group">
            <label>ประเภทอุปกรณ์ <span className="required">*</span></label>
            <div className="device-type-grid">
              {deviceTypes.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  className={`device-type-button ${type === dt.value ? 'active' : ''}`}
                  onClick={() => setType(dt.value)}
                >
                  <span className="device-icon">{dt.icon}</span>
                  <span className="device-label">{dt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ส่วนข้อมูลยืดหยุ่นตามประเภทที่เลือก */}
          <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ color: '#3b82f6', marginBottom: '12px' }}>ข้อมูลเฉพาะของ{deviceTypes.find(d => d.value === type)?.label}</label>
            
            {type === 'streetlight' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><span className="form-hint">เจ้าของครุภัณฑ์</span><input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="เช่น กฟภ., เทศบาล" className="form-input" /></div>
                <div><span className="form-hint">กำลังไฟ (วัตต์)</span><input type="text" value={watt} onChange={e => setWatt(e.target.value)} placeholder="เช่น 120W" className="form-input" /></div>
                <div><span className="form-hint">ประเภทโคม</span><input type="text" value={lampType} onChange={e => setLampType(e.target.value)} placeholder="เช่น กิ่งเดี่ยว" className="form-input" /></div>
                <div><span className="form-hint">ชนิดหลอด</span><input type="text" value={bulbType} onChange={e => setBulbType(e.target.value)} placeholder="เช่น LED" className="form-input" /></div>
              </div>
            )}

            {type === 'wifi' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><span className="form-hint">ผู้ให้บริการ (ISP)</span><input type="text" value={isp} onChange={e => setIsp(e.target.value)} placeholder="เช่น NT, TOT" className="form-input" /></div>
                <div><span className="form-hint">ความเร็วอินเทอร์เน็ต</span><input type="text" value={speed} onChange={e => setSpeed(e.target.value)} placeholder="เช่น 1000/500 Mbps" className="form-input" /></div>
              </div>
            )}

            {type === 'hydrant' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><span className="form-hint">ระดับแรงดันน้ำ</span><input type="text" value={pressure} onChange={e => setPressure(e.target.value)} placeholder="เช่น ปกติ, สูง" className="form-input" /></div>
              </div>
            )}

            {type !== 'streetlight' && type !== 'wifi' && type !== 'hydrant' && (
              <div>
                {loadingCustomSchema && <span className="form-hint">กำลังโหลดคอลัมน์จาก Google Sheets...</span>}
                {!loadingCustomSchema && customSchemaColumns.length === 0 && (
                  <span className="form-hint">
                    {customSchemaError
                      ? `โหลดคอลัมน์ไม่สำเร็จ: ${customSchemaError}`
                      : 'ไม่พบคอลัมน์ข้อมูลจำเพาะในชีตนี้'}
                  </span>
                )}
                {!loadingCustomSchema && customSchemaColumns.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {customSchemaColumns.map((col) => (
                      <div key={col}>
                        <span className="form-hint">{col}</span>
                        <input
                          type="text"
                          value={customFieldValues[col] ?? ''}
                          onChange={(e) => updateCustomField(col, e.target.value)}
                          placeholder={`เช่น ${col}`}
                          className="form-input"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ฟอร์มส่วนที่เหลือ (ชื่อ, รูปแบบหมุด, พิกัด ฯลฯ) คงเดิม */}
          <div className="form-group">
            <label>รูปแบบหมุด <span className="required">*</span></label>
            <div className="pin-type-options">
              <label className="pin-type-option">
                <input type="checkbox" checked={useRadiusPin} onChange={(e) => setUseRadiusPin(e.target.checked)} />
                <span>หมุดรัศมี</span>
              </label>
              <label className="pin-type-option">
                <input type="checkbox" checked={useSketchPin} onChange={(e) => setUseSketchPin(e.target.checked)} />
                <span>หมุดแบบร่าง (สี่เหลี่ยม + เส้นเชื่อม)</span>
              </label>
            </div>
            {useRadiusPin && (
              <div className="pin-radius-row">
                <label className="pin-radius-label">รัศมี (เมตร)</label>
                <input type="number" min={1} value={radiusMeters || ''} onChange={(e) => setRadiusMeters(parseFloat(e.target.value))} className="form-input" required />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>ชื่อตำแหน่ง <span className="required">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น หน้าโรงเรียน..." className="form-input" required />
          </div>

          <div className="form-group">
            <label>พิกัด (Latitude, Longitude)</label>
            <div className="coordinate-inputs">
              <input type="number" step="0.000001" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} className="form-input" />
              <input type="number" step="0.000001" value={lng} onChange={(e) => setLng(parseFloat(e.target.value))} className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label>สถานะ</label>
            <select value={status} onChange={(e) => setStatus(toDeviceStatus(e.target.value))} className="form-select">
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>หมายเหตุ</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-textarea" rows={3} />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">ยกเลิก</button>
            <button type="submit" className="btn-primary"><Save size={18} />บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPositionModal;