import type { DeviceType, KnownDeviceType } from './types';

export type DeviceTypeMeta = {
  label: string;
  icon: string;
  color: string;
};

export const KNOWN_DEVICE_TYPE_ORDER: KnownDeviceType[] = ['streetlight', 'wifi', 'hydrant'];

const KNOWN_DEVICE_TYPE_META: Record<KnownDeviceType, DeviceTypeMeta> = {
  streetlight: {
    label: 'ไฟส่องสว่าง',
    icon: '💡',
    color: '#f59e0b',
  },
  wifi: {
    label: 'Wi-Fi สาธารณะ',
    icon: '📶',
    color: '#10b981',
  },
  hydrant: {
    label: 'หัวดับเพลิง/ประปา',
    icon: '🚒',
    color: '#ef4444',
  },
};

export function isKnownDeviceType(type: string): type is KnownDeviceType {
  return type === 'streetlight' || type === 'wifi' || type === 'hydrant';
}

function fallbackLabel(type: string): string {
  if (!type.trim()) return 'ประเภทไม่ระบุ';

  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDeviceTypeMeta(
  type: DeviceType,
  customMeta?: Partial<Pick<DeviceTypeMeta, 'label' | 'icon' | 'color'>>,
): DeviceTypeMeta {
  if (isKnownDeviceType(type)) {
    return KNOWN_DEVICE_TYPE_META[type];
  }

  return {
    label: customMeta?.label?.trim() || fallbackLabel(type),
    icon: customMeta?.icon?.trim() || '🧩',
    color: customMeta?.color?.trim() || '#6366f1',
  };
}

export function parseCustomTypeFromDescription(description?: string): { label?: string; icon?: string } {
  if (!description) return {};

  const labelMatch = description.match(/\[ประเภท:([^\]]+)\]/);
  const iconMatch = description.match(/\[ไอคอน:([^\]]+)\]/);

  return {
    label: labelMatch?.[1]?.trim(),
    icon: iconMatch?.[1]?.trim(),
  };
}
