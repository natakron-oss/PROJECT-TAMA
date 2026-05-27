import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './CityMap.css';
import { statusColors, statusLabels as sharedStatusLabels } from './status';
import { getDeviceTypeMeta, parseCustomTypeFromDescription } from './deviceTypeMeta';
import type { Device } from './types';
import type { CustomDeviceType } from './lib/customDeviceTypes';
import { isSupabaseEnabled, supabase } from './lib/supabase';

// Get Esri World Imagery satellite preview (FREE, no API key required, CORS-friendly)
function getEsriSatelliteUrl(lat: number, lng: number, zoom: number = 18): string {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const ytile = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  
  // Direct tile URL from Esri - no key needed, high quality satellite imagery
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ytile}/${xtile}`;
}

// Get Google Street View link (opens in new tab - 360° panorama view)
function getGoogleStreetViewLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

const iconDefaultPrototype = (
  L.Icon.Default as unknown as {
    prototype: {
      _getIconUrl?: string;
    };
  }
).prototype;
delete iconDefaultPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CityMapProps {
  devices: Device[];
  customTypes: CustomDeviceType[];
  loading?: boolean;
  onAddPosition?: (lat: number, lng: number) => void;
  onReportDevice?: (device: Device) => void;
  onOpenDevice?: (device: Device) => void;
  addMode?: boolean;
  showRanges?: boolean;
  showConnections?: boolean;
}

const statusLabels = sharedStatusLabels;

const CHONBURI_BOUNDS: [[number, number], [number, number]] = [
  [12.3, 100.7],
  [13.6, 101.5],
];

const CHONBURI_CENTER: [number, number] = [12.7011, 100.9674];
const CHONBURI_LATLNG_BOUNDS = L.latLngBounds(CHONBURI_BOUNDS);

function CityMap({
  devices,
  customTypes,
  loading = false,
  onAddPosition,
  onReportDevice,
  onOpenDevice,
  addMode = false,
  showRanges = true,
  showConnections = true,
}: CityMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const rangeLayerRef = useRef<L.LayerGroup | null>(null);
  const connectionLayerRef = useRef<L.LayerGroup | null>(null);
  const hasSetInitialCenterRef = useRef(false);
  const complaintImageCacheRef = useRef<Map<string, string | null>>(new Map());

  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    streetlight: true,
    wifi: true,
    hydrant: true,
  });

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => set.add(d.type));
    return Array.from(set);
  }, [devices]);

  const visibleDevices = useMemo(
    () => devices.filter((d) => enabledTypes[d.type] !== false),
    [devices, enabledTypes],
  );

  const syncSummary = useMemo(() => {
    let pending = 0;
    let error = 0;

    devices.forEach((device) => {
      if (device.syncStatus === 'pending') pending += 1;
      if (device.syncStatus === 'error') error += 1;
    });

    return {
      pending,
      error,
    };
  }, [devices]);

  useEffect(() => {
    console.debug('[CityMap] render cycle:', {
      totalDevices: devices.length,
      visibleDevices: visibleDevices.length,
      enabledTypes,
    });
  }, [devices, visibleDevices, enabledTypes]);

  const getDeviceRangeMeters = (device: Device): number => {
    if (typeof device.rangeMeters === 'number' && Number.isFinite(device.rangeMeters) && device.rangeMeters >= 0) {
      return device.rangeMeters;
    }
    return 0;
  };

  const addDeviceRangeHeat = (layer: L.LayerGroup, device: Device) => {
    const baseRadius = getDeviceRangeMeters(device);
    if (baseRadius <= 0) return;

    const color = statusColors[device.status];
    const rings: Array<{ radius: number; opacity: number }> = [
      { radius: baseRadius, opacity: 0.1 },
      { radius: baseRadius * 0.66, opacity: 0.14 },
      { radius: baseRadius * 0.33, opacity: 0.22 },
    ];

    rings.forEach((ring) => {
      L.circle([device.lat, device.lng], {
        radius: ring.radius,
        stroke: false,
        fillColor: color,
        fillOpacity: ring.opacity,
        interactive: false,
      }).addTo(layer);
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CHONBURI_CENTER,
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: CHONBURI_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    // Keep navigation strictly within the municipal service area.
    map.setMaxBounds(CHONBURI_LATLNG_BOUNDS);
    map.panInsideBounds(CHONBURI_LATLNG_BOUNDS, { animate: false });
    mapRef.current = map;

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 10,
      maxZoom: 18,
      crossOrigin: true,
      keepBuffer: 4,
      updateWhenIdle: true,
      updateWhenZooming: false,
    });

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        minZoom: 10,
        maxZoom: 18,
        crossOrigin: true,
        keepBuffer: 4,
        updateWhenIdle: true,
        updateWhenZooming: false,
      },
    );

    osm.addTo(map);

    L.control.layers(
      {
        '2D (แผนที่)': osm,
        ดาวเทียม: satellite,
      },
      undefined,
      { position: 'bottomleft' },
    ).addTo(map);

    rangeLayerRef.current = L.layerGroup().addTo(map);
    connectionLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    // Ensure tiles are laid out after React/CSS finish sizing the container.
    const initialInvalidate = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(mapContainerRef.current);

    return () => {
      window.clearTimeout(initialInvalidate);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      rangeLayerRef.current = null;
      connectionLayerRef.current = null;
      tempMarkerRef.current = null;
      hasSetInitialCenterRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const rafId = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [loading, visibleDevices.length]);

  const haversineMeters = (a: Pick<Device, 'lat' | 'lng'>, b: Pick<Device, 'lat' | 'lng'>): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  type ConnectionSegment = { type: Device['type']; from: Device; to: Device };

  const buildTypeMstConnections = (inputDevices: Device[]): ConnectionSegment[] => {
    const byType = new Map<Device['type'], Device[]>();
    inputDevices.forEach((d) => {
      const list = byType.get(d.type) ?? [];
      list.push(d);
      byType.set(d.type, list);
    });

    const segments: ConnectionSegment[] = [];

    for (const [type, list] of byType.entries()) {
      if (list.length < 2) continue;

      const inTree = new Array<boolean>(list.length).fill(false);
      inTree[0] = true;
      let inCount = 1;

      while (inCount < list.length) {
        let bestFrom = -1;
        let bestTo = -1;
        let bestDist = Number.POSITIVE_INFINITY;

        for (let i = 0; i < list.length; i++) {
          if (!inTree[i]) continue;
          for (let j = 0; j < list.length; j++) {
            if (inTree[j]) continue;
            const dist = haversineMeters(list[i], list[j]);
            if (dist < bestDist) {
              bestDist = dist;
              bestFrom = i;
              bestTo = j;
            }
          }
        }

        if (bestFrom === -1 || bestTo === -1) break;

        inTree[bestTo] = true;
        inCount++;
        segments.push({ type, from: list[bestFrom], to: list[bestTo] });
      }
    }

    return segments;
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.off('click');
    if (!(addMode && onAddPosition)) return;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
      }

      const tempIcon = L.divIcon({
        className: 'temp-marker',
        html: `
          <div class="marker-container temp-marker-icon" style="background-color: #8b5cf6; animation: pulse 1.5s infinite;">
            <span class="marker-icon">📍</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      tempMarkerRef.current = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      tempMarkerRef.current.bindPopup('ตำแหน่งใหม่<br>คลิกปุ่มบันทึกด้านล่าง').openPopup();
      onAddPosition(lat, lng);
    });
  }, [addMode, onAddPosition]);

  const addDeviceMarker = (layer: L.LayerGroup, device: Device) => {
    const customTypeMeta = customTypes.find((item) => item.typeCode === device.type);
    const deviceInfo = getDeviceTypeMeta(device.type, customTypeMeta ?? parseCustomTypeFromDescription(device.description));
    const markerColor = statusColors[device.status];
    
    // Use device image if available, otherwise use Esri satellite preview
    const mapImageUrl = device.deviceImageUrl?.trim() || getEsriSatelliteUrl(device.lat, device.lng);
    const streetViewLink = getGoogleStreetViewLink(device.lat, device.lng);
    const popupSourceLabel = device.deviceImageUrl?.trim() ? 'รูปจริง' : 'รูปแผนที่อัตโนมัติ';

    // Add status-based animation class
    const statusClass = `marker-status-${device.status}`;
    const markerContainerClass = device.sketchPin
      ? `marker-container marker-container--sketch ${statusClass}`
      : `marker-container ${statusClass}`;

    const syncBadgeHtml =
      device.syncStatus === 'pending'
        ? '<span class="marker-sync-badge marker-sync-badge--pending" title="รอซิงก์ขึ้น Cloud">⏳</span>'
        : device.syncStatus === 'error'
          ? '<span class="marker-sync-badge marker-sync-badge--error" title="ซิงก์ไม่สำเร็จ">!</span>'
          : '';

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="${markerContainerClass}" style="background-color: ${markerColor}">
          ${syncBadgeHtml}
          <span class="marker-icon">${deviceInfo.icon}</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });

    const marker = L.marker([device.lat, device.lng], { icon: customIcon }).addTo(layer);

    const popupContent = `
      <div class="device-popup" style="font-family: 'Prompt', sans-serif;">
        <div class="popup-cover" style="height: 140px; background-color: #f3f4f6; position: relative; display: flex; justify-content: center; align-items: center;">
          <img class="popup-location-image" src="${mapImageUrl}" alt="รูปสถานที่ ${device.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          
          <div style="display: none; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); justify-content: center; align-items: center; color: white; font-size: 14px; font-weight: bold; text-align: center; padding: 16px;">
            📍 ไม่สามารถโหลดรูปได้
          </div>

          <div class="popup-image-source" style="position: absolute; top: 12px; right: 12px; background-color: rgba(15,23,42,0.8); color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${popupSourceLabel}</div>

          <div style="position: absolute; top: 12px; left: 12px; background-color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; color: ${statusColors[device.status]}; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 4px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColors[device.status]};"></div>
            ${statusLabels[device.status]}
          </div>
        </div>

        <div class="popup-details" style="padding: 16px 16px 0 16px;">
          <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #1f2937; line-height: 1.3;">${device.name}</h3>
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">${deviceInfo.label} • รหัส: ${device.id}</p>

          <div style="font-size: 13px; line-height: 1.6; color: #4b5563;">
            <div style="display: flex; gap: 8px;">
              <span style="font-weight: 600; min-width: 60px;">หน่วยงาน:</span>
              <span>${device.department}</span>
            </div>
            ${
              device.description
                ? `
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <span style="font-weight: 600; min-width: 60px;">หมายเหตุ:</span>
                <span>${device.description}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>

        <div class="popup-footer" style="padding: 16px;">
          <a href="${streetViewLink}" target="_blank" rel="noopener noreferrer" class="street-view-btn" style="display: block; width: 100%; padding: 10px; background-color: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; text-align: center; text-decoration: none; transition: 0.2s; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2); margin-bottom: 10px;" onmouseover="this.style.backgroundColor='#059669'" onmouseout="this.style.backgroundColor='#10b981'">
            🔍 ดูภาพ Street View (360°)
          </a>

          <button class="report-issue-btn" style="width: 100%; padding: 10px; background-color: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);" onmouseover="this.style.backgroundColor='#dc2626'" onmouseout="this.style.backgroundColor='#ef4444'">
            📢 แจ้งซ่อมแซม / ร้องเรียน
          </button>

          <button class="goto-devices-btn" style="width: 100%; padding: 10px; background-color: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2); margin-top: 10px;" onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
            🧭 ไปหน้าอุปกรณ์
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'custom-popup google-maps-style',
    });

    marker.on('popupopen', (e) => {
      const popupElement = e.popup.getElement();
      if (!popupElement) return;

      const imageElement = popupElement.querySelector<HTMLImageElement>('.popup-location-image');
      const sourceBadge = popupElement.querySelector<HTMLElement>('.popup-image-source');
      
      // When popup opens, check if there's a newer complaint image from Supabase
      if (!device.deviceImageUrl?.trim() && imageElement && sourceBadge && isSupabaseEnabled && supabase) {
        const cacheKey = `${device.type}:${device.id}`;
        const cached = complaintImageCacheRef.current.get(cacheKey);

        if (cached !== undefined) {
          if (cached) {
            imageElement.src = cached;
            sourceBadge.textContent = 'รูปจริง (ร้องเรียนล่าสุด)';
          }
          // Otherwise keep the default MapQuest map
        } else {
          // Fetch latest complaint image from Supabase
          void (async () => {
            const result = await supabase
              .from('complaints')
              .select('image_url')
              .eq('device_id', device.id)
              .not('image_url', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (result.error) {
              complaintImageCacheRef.current.set(cacheKey, null);
              return;
            }

            const latestImage = result.data?.image_url?.trim() || null;
            complaintImageCacheRef.current.set(cacheKey, latestImage);

            if (latestImage) {
              imageElement.src = latestImage;
              sourceBadge.textContent = 'รูปจริง (ร้องเรียนล่าสุด)';
            }
            // Otherwise use MapQuest map (already loaded by default)
          })();
        }
      }

      const reportBtn = popupElement.querySelector('.report-issue-btn');
      if (reportBtn) {
        reportBtn.addEventListener(
          'click',
          () => {
            onReportDevice?.(device);
            marker.closePopup();
          },
          { once: true },
        );
      }

      const gotoDevicesBtn = popupElement.querySelector('.goto-devices-btn');
      if (gotoDevicesBtn) {
        gotoDevicesBtn.addEventListener(
          'click',
          () => {
            onOpenDevice?.(device);
            marker.closePopup();
          },
          { once: true },
        );
      }
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const rangeLayer = rangeLayerRef.current;
    const connectionLayer = connectionLayerRef.current;
    if (!map || !markerLayer || !rangeLayer || !connectionLayer) return;

    markerLayer.clearLayers();
    rangeLayer.clearLayers();
    connectionLayer.clearLayers();

    console.debug('[CityMap] rebuilding layers:', {
      markerCount: visibleDevices.length,
      showRanges,
      showConnections,
    });

    visibleDevices.forEach((device) => {
      if (showRanges) {
        addDeviceRangeHeat(rangeLayer, device);
      }
      addDeviceMarker(markerLayer, device);
    });

    if (showConnections) {
      const sketchDevices = visibleDevices.filter((d) => d.sketchPin);
      const segments = buildTypeMstConnections(sketchDevices);
      segments.forEach((seg) => {
        const customTypeMeta = customTypes.find((item) => item.typeCode === seg.type);
        const typeColor = getDeviceTypeMeta(seg.type, customTypeMeta ?? parseCustomTypeFromDescription(seg.from.description)).color;
        L.polyline(
          [
            [seg.from.lat, seg.from.lng],
            [seg.to.lat, seg.to.lng],
          ],
          {
            color: typeColor,
            weight: 2,
            opacity: 0.7,
            lineCap: 'round',
            interactive: false,
          },
        ).addTo(connectionLayer);
      });
    }

    if (!hasSetInitialCenterRef.current && visibleDevices.length > 0) {
      const bounds = L.latLngBounds(visibleDevices.map((device) => [device.lat, device.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      map.panInsideBounds(CHONBURI_LATLNG_BOUNDS, { animate: false });
      hasSetInitialCenterRef.current = true;
    } else if (!hasSetInitialCenterRef.current) {
      map.setView(CHONBURI_CENTER, 12, { animate: false });
      map.panInsideBounds(CHONBURI_LATLNG_BOUNDS, { animate: false });
      hasSetInitialCenterRef.current = true;
    }
  }, [visibleDevices, showRanges, showConnections]);

  return (
    <div className="city-map-container">
      <div className="map-header">
        <h2>🗺️ ผังเมืองดิจิทัลเทศบาล</h2>
        <p>
          {loading
            ? 'กำลังโหลดข้อมูล...'
            : `แผนที่แสดงอุปกรณ์และสิ่งอำนวยความสะดวกต่างๆ ในเขตเทศบาล (${devices.length} รายการ)`}
        </p>
      </div>

      {loading && (
        <div className="map-loading-overlay" role="status" aria-live="polite">
          <div className="map-loading-card">
            <div className="map-loading-spinner" aria-hidden="true" />
            <div className="map-loading-text">กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      )}

      <div className="map-legend">
        <h3>สัญลักษณ์</h3>
        <div className="legend-items">
          {availableTypes
            .map((type) => {
              const sample = devices.find((item) => item.type === type);
              const customTypeMeta = customTypes.find((item) => item.typeCode === type);
              const info = getDeviceTypeMeta(type, customTypeMeta ?? parseCustomTypeFromDescription(sample?.description));
              const count = devices.filter((d) => d.type === type).length;
              const enabled = enabledTypes[type] !== false;
              return (
                <button
                  key={type}
                  type="button"
                  className={`legend-item legend-toggle ${enabled ? 'is-on' : 'is-off'}`}
                  onClick={() => setEnabledTypes((prev) => ({ ...prev, [type]: !prev[type] }))}
                >
                  <div className="legend-marker" style={{ backgroundColor: info.color }}>
                    {info.icon}
                  </div>
                  <span>{info.label} ({count})</span>
                </button>
              );
            })}
        </div>

        <h3>สถานะ</h3>
        <div className="legend-items">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="legend-item">
              <div className="status-indicator" style={{ backgroundColor: statusColors[status as keyof typeof statusColors] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {(syncSummary.pending > 0 || syncSummary.error > 0) && (
        <div className="map-sync-summary" role="status" aria-live="polite">
          <h4>สถานะซิงก์</h4>
          {syncSummary.pending > 0 && <p>⏳ รอส่งขึ้น Cloud: {syncSummary.pending}</p>}
          {syncSummary.error > 0 && <p>! ส่งไม่สำเร็จ: {syncSummary.error}</p>}
        </div>
      )}

      <div ref={mapContainerRef} className={`city-map-leaflet-container ${addMode ? 'is-add-mode' : ''}`} />

      <div className="map-footer">
        <p>
          {addMode
            ? '🖱️ คลิกบนแผนที่เพื่อเลือกตำแหน่งที่ต้องการเพิ่ม'
            : '💡 คลิกที่ Marker เพื่อดูรายละเอียดของอุปกรณ์แต่ละตัว'}
        </p>
      </div>
    </div>
  );
}

export default CityMap;
