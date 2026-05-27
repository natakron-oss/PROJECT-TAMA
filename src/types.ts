import type { DeviceStatus } from './status';

export type KnownDeviceType = 'streetlight' | 'wifi' | 'hydrant';
export type DeviceType = KnownDeviceType | (string & {});
export type SyncStatus = 'synced' | 'pending' | 'error';

export interface BaseDevice {
  id: string;
  name: string;
  type: DeviceType;
  lat: number;
  lng: number;
  status: DeviceStatus;
  department: string;
  description?: string;
  customFields?: Record<string, string>;
  deviceImageUrl?: string;
  rangeMeters?: number;
  sketchPin?: boolean;
  syncStatus?: SyncStatus;
  source: 'sheet' | 'supabase';
}

export interface StreetLightDevice extends BaseDevice {
  type: 'streetlight';
  lampType?: string;
  bulbType?: string;
  watt?: string;
  boxId?: string;
  owner?: string;
  imageDate?: string;
}

export interface WifiDevice extends BaseDevice {
  type: 'wifi';
  isp?: string;
  speed?: string;
  deviceCount?: number;
}

export interface HydrantDevice extends BaseDevice {
  type: 'hydrant';
  pressure?: string;
  lastCheck?: string;
}

export type Device = StreetLightDevice | WifiDevice | HydrantDevice | BaseDevice;

export interface NewDeviceInput {
  type: DeviceType;
  customTypeLabel?: string;
  customTypeIcon?: string;
  name: string;
  description: string;
  status: DeviceStatus;
  lat: number;
  lng: number;
  useRadiusPin: boolean;
  useSketchPin: boolean;
  radiusMeters?: number;

  // For custom device types whose schema is defined in Google Sheets
  customFields?: Record<string, string>;
  
  // --- ฟิลด์ใหม่ที่เพิ่มเข้ามาเพื่อความยืดหยุ่น ---
  lampType?: string;
  bulbType?: string;
  watt?: string;
  owner?: string;
  isp?: string;
  speed?: string;
  pressure?: string;
}

export interface ComplaintInput {
  deviceId: string;
  deviceType: DeviceType;
  deviceName: string;
  location: string;
  status: string;
  description?: string;
  imageUrl?: string;
  attachmentFile?: File;
  onUploadProgress?: (percent: number) => void;
}

export interface AppNavigateDetail {
  page?: 'overview' | 'devices';
  tab?: DeviceType;
  selectedId?: string;
}