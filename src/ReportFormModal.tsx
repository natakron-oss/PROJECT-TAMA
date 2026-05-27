import { useEffect, useState } from 'react';
import { fetchDeviceComplaints, saveComplaint } from './lib/data';
import { getDeviceTypeMeta } from './deviceTypeMeta';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import type { DeviceType } from './types';

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceType: DeviceType;
  customTypes: CustomDeviceType[];
  deviceName?: string;
  location?: string;
  status?: string;
  onSubmitted?: () => void;
}

interface ToastState {
  message: string;
  tone: 'success' | 'error' | 'info';
}

function ReportFormModal({
  isOpen,
  onClose,
  deviceId,
  deviceType,
  customTypes,
  deviceName = '-',
  location = '-',
  status = '-',
  onSubmitted,
}: ReportFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [latestDbImageUrl, setLatestDbImageUrl] = useState<string | null>(null);
  const [loadingDbImage, setLoadingDbImage] = useState(false);

  const showToast = (message: string, tone: ToastState['tone']) => {
    setToast({ message, tone });
  };

  useEffect(() => {
    if (!attachmentFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(attachmentFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [attachmentFile]);

  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setAttachmentFile(null);
      setAttachmentError(null);
      setUploadProgress(null);
      setLatestDbImageUrl(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !deviceId) return;

    let cancelled = false;
    const loadLatestImage = async () => {
      try {
        setLoadingDbImage(true);
        const rows = await fetchDeviceComplaints(deviceId);
        if (cancelled) return;
        const firstWithImage = rows.find((row: any) => typeof row.image_url === 'string' && row.image_url.trim() !== '');
        setLatestDbImageUrl(firstWithImage?.image_url ?? null);
      } finally {
        if (!cancelled) {
          setLoadingDbImage(false);
        }
      }
    };

    void loadLatestImage();
    return () => {
      cancelled = true;
    };
  }, [isOpen, deviceId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentError(null);
  };

  const handleAttachmentChange = (file: File | null) => {
    if (!file) {
      clearAttachment();
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAttachmentError('รองรับเฉพาะไฟล์ JPG, PNG, WEBP');
      setAttachmentFile(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachmentError('ไฟล์รูปต้องมีขนาดไม่เกิน 5MB');
      setAttachmentFile(null);
      return;
    }

    setAttachmentError(null);
    setAttachmentFile(file);
  };

  const handleSubmit = async () => {
    if (!deviceId) {
      showToast('ไม่พบรหัสอุปกรณ์', 'error');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress(attachmentFile ? 0 : null);
      await saveComplaint({
        deviceId,
        deviceType,
        deviceName,
        location,
        status,
        description: description.trim() || undefined,
        attachmentFile: attachmentFile ?? undefined,
        onUploadProgress: (percent) => {
          setUploadProgress(percent);
        },
      });

      onSubmitted?.();
      showToast('บันทึกเรื่องร้องเรียนเรียบร้อย', 'success');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึก';
      showToast(`บันทึกเรื่องร้องเรียนไม่สำเร็จ: ${message}`, 'error');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const customMeta = customTypes.find((item) => item.typeCode === deviceType);
  const deviceIcon = getDeviceTypeMeta(deviceType, customMeta ?? undefined).icon;
  const statusColor = status.includes('ปกติ')
    ? '#10b981'
    : status.includes('ซ่อม')
      ? '#f59e0b'
      : '#ef4444';

  return (
    <>
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
            background:
              toast.tone === 'success' ? '#16a34a' : toast.tone === 'error' ? '#dc2626' : '#0ea5e9',
            boxShadow: '0 10px 20px rgba(2, 6, 23, 0.25)',
          }}
        >
          {toast.message}
        </div>
      )}

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 20000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={onClose}
        >
          <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: 'white',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(2, 6, 23, 0.25)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
        <div
          style={{
            height: '140px',
            backgroundColor: '#f3f4f6',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: '10px',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '64px', opacity: 0.2 }}>{deviceIcon}</span>

          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: 'white',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: statusColor,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor }} />
            {status}
          </div>
        </div>

        <h3 style={{ margin: 0, color: '#1e293b' }}>แจ้งซ่อมแซม / ร้องเรียน</h3>
        <p style={{ margin: '6px 0 12px 0', color: '#64748b', fontSize: '0.9rem' }}>
          {deviceName} ({deviceId})
        </p>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>รูปล่าสุดจากระบบ</div>
          {loadingDbImage ? (
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>กำลังโหลดรูปจากฐานข้อมูล...</div>
          ) : latestDbImageUrl ? (
            <a href={latestDbImageUrl} target="_blank" rel="noreferrer">
              <img
                src={latestDbImageUrl}
                alt="รูปจากฐานข้อมูล"
                style={{ width: '100%', maxWidth: '320px', maxHeight: '180px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0' }}
              />
            </a>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>ยังไม่มีรูปจากฐานข้อมูลสำหรับอุปกรณ์นี้</div>
          )}
        </div>

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#334155' }}>รายละเอียดเพิ่มเติม</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="เช่น ไฟกะพริบช่วงกลางคืน"
          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', resize: 'vertical' }}
        />

        <label style={{ display: 'block', marginTop: '12px', marginBottom: '6px', fontWeight: 600, color: '#334155' }}>แนบรูป (ไม่บังคับ)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleAttachmentChange(e.target.files?.[0] ?? null)}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>รองรับ JPG/PNG/WEBP และขนาดไม่เกิน 5MB</div>

        {attachmentError && (
          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>{attachmentError}</div>
        )}

        {attachmentFile && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}>ไฟล์ที่เลือก: {attachmentFile.name}</div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="ตัวอย่างรูปแนบ"
                style={{ width: '100%', maxWidth: '320px', maxHeight: '180px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0' }}
              />
            )}
            <button
              type="button"
              onClick={clearAttachment}
              style={{
                marginTop: '8px',
                padding: '6px 10px',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                background: '#fff1f2',
                color: '#b91c1c',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ลบรูปนี้
            </button>
          </div>
        )}

        {uploadProgress !== null && submitting && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
              <span>กำลังอัปโหลดรูป</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: '#0ea5e9',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: 'white',
              color: '#475569',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={submitting}
            style={{
              padding: '10px 14px',
              background: submitting ? '#fca5a5' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'กำลังบันทึก...' : 'ส่งเรื่องร้องเรียน'}
          </button>
        </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReportFormModal;