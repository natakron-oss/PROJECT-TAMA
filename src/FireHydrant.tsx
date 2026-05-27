import DeviceDetail from './DeviceDetail';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import type { Device } from './types';

interface FireHydrantProps {
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

function FireHydrant(props: FireHydrantProps) {
  return <DeviceDetail {...props} type="hydrant" />;
}

export default FireHydrant;
