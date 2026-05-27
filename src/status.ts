export type DeviceStatus = 'normal' | 'damaged' | 'repairing';

// ใช้เฉดสีเดิมในโปรเจกต์ (เขียว/แดง/เหลือง)
export const statusColors: Record<DeviceStatus, string> = {
  normal: '#10b981',
  damaged: '#ef4444',
  repairing: '#f59e0b',
};

export const statusLabels: Record<DeviceStatus, string> = {
  normal: '✓ ปกติ',
  damaged: '⚠️ ชำรุด',
  repairing: '🔧 กำลังซ่อม',
};

export function parseDeviceStatus(statusText?: string | null): DeviceStatus {
  const raw = (statusText ?? '').trim().toLowerCase();
  if (!raw) return 'normal';

  // รองรับรูปแบบจาก Supabase DB (English)
  if (raw === 'normal' || raw.includes('normal')) return 'normal';
  if (raw === 'damaged' || raw === 'broken' || raw.includes('broken') || raw.includes('damage')) return 'damaged';
  if (raw === 'repairing' || raw.includes('repair')) return 'repairing';

  // รองรับรูปแบบจาก Google Sheets (ภาษาไทยเป็นหลัก)
  if (raw.includes('ปกติ')) return 'normal';
  if (raw.includes('ชำรุด')) return 'damaged';
  if (raw.includes('กำลังซ่อม') || raw.includes('ซ่อม')) return 'repairing';

  return 'normal';
}

/**
 * สำหรับ badge/pill ใน UI ที่ใช้คลาสเดิมจาก durablearticles.css
 */
export function getStatusBadgeClass(statusText?: string | null): '' | 'status-normal' | 'status-broken' | 'status-fix' {
  const raw = (statusText ?? '').trim();
  if (!raw) return '';

  if (raw.includes('ปกติ')) return 'status-normal';
  if (raw.includes('ชำรุด')) return 'status-broken';
  if (raw.includes('กำลังซ่อม') || raw.includes('ซ่อม')) return 'status-fix';

  return '';
}
