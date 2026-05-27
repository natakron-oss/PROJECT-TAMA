import DeviceDetail from './DeviceDetail';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import type { Device } from './types';

interface StreetLightProps {
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

function StreetLight(props: StreetLightProps) {
  return <DeviceDetail {...props} type="streetlight" />;
}

export default StreetLight;
