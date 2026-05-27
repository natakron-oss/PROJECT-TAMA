import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import './AddPositionModal.css';
import './AddDeviceTableModal.css';
import {
  normalizeCustomDeviceTypeCode,
  type CustomDeviceType,
} from './lib/customDeviceTypes';
import {
  REQUIRED_DEVICE_COLUMNS,
  normalizeCustomColumns,
} from './lib/customDeviceSchemas';
import { createOrUpdateSchemaSheet } from './lib/googleSheetsSchema';

const DEFAULT_SCHEMA_SPREADSHEET_ID = '1o0HsgmEeKRmKO6mUKGrppjgAIsFWlfJ87U-YPcpTMYo';

type AddDeviceTableModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customTypes: CustomDeviceType[];
  onCreated: () => void;
};

function isDuplicateTypeCode(code: string, customTypes: CustomDeviceType[]): boolean {
  return customTypes.some((item) => item.typeCode === code);
}

export default function AddDeviceTableModal({ isOpen, onClose, customTypes, onCreated }: AddDeviceTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [specColumns, setSpecColumns] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const normalizedTypeCode = useMemo(() => normalizeCustomDeviceTypeCode(tableName), [tableName]);
  const normalizedSpecs = useMemo(() => normalizeCustomColumns(specColumns), [specColumns]);

  const hasDuplicate = useMemo(
    () => Boolean(normalizedTypeCode) && isDuplicateTypeCode(normalizedTypeCode, customTypes),
    [normalizedTypeCode, customTypes],
  );

  useEffect(() => {
    if (!isOpen) return;
    setTableName('');
    setSpecColumns(['']);
    setSaving(false);
  }, [isOpen]);

  const updateSpecAt = (index: number, value: string) => {
    setSpecColumns((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const removeSpecAt = (index: number) => {
    setSpecColumns((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addSpecRow = () => {
    setSpecColumns((prev) => [...prev, '']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.debug('[AddDeviceTableModal] submit:start', {
      tableName: tableName.trim(),
      normalizedTypeCode,
      specCountRaw: specColumns.length,
      specCountNormalized: normalizedSpecs.length,
    });

    if (!tableName.trim()) {
      console.debug('[AddDeviceTableModal] submit:validation_failed', { reason: 'missing_table_name' });
      alert('กรุณากรอกชื่ออุปกรณ์ (ชื่อ Table)');
      return;
    }

    if (!normalizedTypeCode) {
      console.debug('[AddDeviceTableModal] submit:validation_failed', { reason: 'invalid_type_code' });
      alert('ชื่อ Table ต้องเป็นภาษาอังกฤษ/ตัวเลข และใช้ - หรือ _ ได้');
      return;
    }

    if (hasDuplicate) {
      console.debug('[AddDeviceTableModal] submit:validation_failed', { reason: 'duplicate_type_code', normalizedTypeCode });
      alert('ชื่อ Table นี้มีอยู่แล้ว');
      return;
    }

    const requiredSet = new Set(REQUIRED_DEVICE_COLUMNS);
    const invalidSpec = normalizedSpecs.find((name) => requiredSet.has(name));
    if (invalidSpec) {
      console.debug('[AddDeviceTableModal] submit:validation_failed', { reason: 'spec_conflicts_required', invalidSpec });
      alert(`ข้อมูลจำเพาะซ้ำกับคอลัมน์บังคับ: ${invalidSpec}`);
      return;
    }

    try {
      setSaving(true);

      console.debug('[AddDeviceTableModal] submit:stage', { stage: 'config' });

      const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
      const appsScriptToken = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
      const spreadsheetId = (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? DEFAULT_SCHEMA_SPREADSHEET_ID;

      if (!appsScriptUrl.trim()) {
        console.error('[AddDeviceTableModal] submit:error', { stage: 'config', reason: 'missing_VITE_APPS_SCRIPT_SCHEMA_URL' });
        alert('ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_SCHEMA_URL สำหรับสร้างแท็บใน Google Sheets');
        return;
      }

      const headers = [...REQUIRED_DEVICE_COLUMNS, ...normalizedSpecs];

      // 1) Create/update sheet tab + header columns in Google Sheets
      console.debug('[AddDeviceTableModal] submit:stage', {
        stage: 'google_sheets',
        appsScriptUrl,
        spreadsheetId,
        sheetName: normalizedTypeCode,
        headerCount: headers.length,
        hasToken: Boolean(appsScriptToken),
      });
      await createOrUpdateSchemaSheet({
        appsScriptUrl,
        token: appsScriptToken,
        spreadsheetId,
        sheetName: normalizedTypeCode,
        headers,
      });

      console.debug('[AddDeviceTableModal] submit:stage_success', { stage: 'google_sheets', sheetName: normalizedTypeCode });

      onCreated();
      onClose();
      console.debug('[AddDeviceTableModal] submit:success', { typeCode: normalizedTypeCode });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเพิ่มอุปกรณ์ได้';
      console.error('[AddDeviceTableModal] submit:failed', {
        typeCode: normalizedTypeCode,
        message,
        error,
      });
      alert(`บันทึกไม่สำเร็จ: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Plus size={24} color="#f59e0b" />
            <h2>เพิ่มอุปกรณ์</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="ปิด">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="modal-body">
          <div className="form-group">
            <label>
              ชื่ออุปกรณ์ (ชื่อ Table) <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="เช่น cctv, traffic_cam"
              autoFocus
            />
            <div className="add-device-hint">
              <div>
                จะถูกบันทึกเป็น Table code: <span className="add-device-code">{normalizedTypeCode || '-'}</span>
              </div>
              {hasDuplicate && <div className="add-device-warn">มี Table code นี้อยู่แล้ว</div>}
            </div>
          </div>

          <div className="form-group">
            <label>ข้อมูลบังคับ (สร้างเป็น Column อัตโนมัติ)</label>
            <div className="add-device-required-grid">
              {REQUIRED_DEVICE_COLUMNS.map((col) => (
                <div key={col} className="add-device-chip">
                  {col}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>ข้อมูลจำเพาะ (เพิ่ม/ลบ/ตั้งชื่อเองได้)</label>
            <div className="add-device-spec-list">
              {specColumns.map((value, index) => (
                <div key={index} className="add-device-spec-row">
                  <input
                    type="text"
                    className="form-input"
                    value={value}
                    onChange={(e) => updateSpecAt(index, e.target.value)}
                    placeholder="เช่น MODEL, SERIAL_NO"
                  />
                  <button
                    type="button"
                    className="btn-secondary add-device-icon-btn"
                    onClick={() => removeSpecAt(index)}
                    disabled={specColumns.length <= 1}
                    aria-label="ลบคอลัมน์"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              <button type="button" className="btn-secondary add-device-add-row" onClick={addSpecRow}>
                <Plus size={18} /> เพิ่มคอลัมน์
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              ยกเลิก
            </button>
            <button type="submit" className="btn-primary" disabled={saving || hasDuplicate || !normalizedTypeCode}>
              <Save size={18} />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
