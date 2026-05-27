// Type definitions for City Devices

export interface CityDevice {
  id: string;
  name: string;
  type: 'streetlight' | 'wifi' | 'hydrant' | 'cctv' | 'busstop';
  lat: number;
  lng: number;
  status: 'normal' | 'damaged' | 'repairing';
  department: string;
  description?: string;
}
