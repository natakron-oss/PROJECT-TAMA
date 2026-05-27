import Papa from 'papaparse';
import { parseDeviceStatus, statusLabels } from '../status';
import type { ComplaintInput, Device, HydrantDevice, NewDeviceInput, StreetLightDevice, SyncStatus, WifiDevice } from '../types';
import { isSupabaseEnabled, supabase } from './supabase';
import { appendSchemaRow, deleteSchemaRow } from './googleSheetsSchema';

const SHEET_STREETLIGHT =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=0&single=true&output=csv';
const SHEET_WIFI =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=123712203&single=true&output=csv';
const SHEET_HYDRANT =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=872918807&single=true&output=csv';
const LOCAL_DEVICE_CACHE_KEY = 'projectpruta.cached-devices';
const DEV_FETCH_ALL_DEDUPE_WINDOW_MS = 1500;

let fetchAllDevicesInFlight: Promise<Device[]> | null = null;
let lastFetchAllDevicesAt = 0;
let lastFetchAllDevicesResult: Device[] | null = null;

interface StreetLightRow {
  ASSET_ID?: string;
  ASSETOWNER?: string;
  LOCATION?: string;
  MOO?: string;
  LAMP_TYPE?: string;
  BULB_TYPE?: string;
  BULB_QTY?: string;
  WATT?: string;
  BOX_ID?: string;
  STATUS?: string;
  STATUSDATE?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
  IMG_DATE?: string;
}

interface WifiRow {
  WIFI_ID?: string;
  LOCATION?: string;
  ISP?: string;
  SPEED?: string;
  DEVICE_COUNT?: string;
  STATUS?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
}

interface HydrantRow {
  HYDRANT_ID?: string;
  LOCATION?: string;
  PRESSURE?: string;
  LAST_CHECK?: string;
  STATUS?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
}

const DEFAULT_DEPARTMENT = 'เทศบาลตำบลพลูตาหลวง';
const COMPLAINT_IMAGE_BUCKET = import.meta.env.VITE_SUPABASE_COMPLAINT_BUCKET || 'complaint-images';

type CachedDevice = Device & {
  _syncStatus: SyncStatus;
  _updatedAt: string;
  _lastError?: string | null;
};

function toCachedDevice(raw: unknown): CachedDevice | null {
  if (!raw || typeof raw !== 'object') return null;

  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.type !== 'string') return null;

  const syncStatusRaw = value._syncStatus;
  const syncStatus: SyncStatus =
    syncStatusRaw === 'pending' || syncStatusRaw === 'error' || syncStatusRaw === 'synced'
      ? syncStatusRaw
      : 'synced';

  const updatedAtRaw = value._updatedAt;
  const updatedAt = typeof updatedAtRaw === 'string' && updatedAtRaw.trim() ? updatedAtRaw : new Date().toISOString();

  return {
    ...(value as unknown as Device),
    source: 'supabase',
    _syncStatus: syncStatus,
    _updatedAt: updatedAt,
    _lastError: typeof value._lastError === 'string' ? value._lastError : null,
  };
}

function readLocalDeviceCache(): CachedDevice[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_DEVICE_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => toCachedDevice(item))
      .filter((item): item is CachedDevice => item !== null);
  } catch {
    return [];
  }
}

function cachedToDevice(device: CachedDevice): Device {
  const { _syncStatus: _ignoredStatus, _updatedAt: _ignoredUpdatedAt, _lastError: _ignoredError, ...rest } = device;
  return {
    ...rest,
    syncStatus: device._syncStatus,
    source: 'supabase',
  };
}

function getLocalCachedDevicesForMerge(): Device[] {
  return readLocalDeviceCache().map(cachedToDevice);
}

function removeSyncedCacheNotInDb(dbDevices: Device[]): void {
  const current = readLocalDeviceCache();
  if (current.length === 0) return;

  const dbKeys = new Set(dbDevices.map((device) => `${device.type}:${device.id}`));
  const next = current.filter((item) => item._syncStatus !== 'synced' || dbKeys.has(`${item.type}:${item.id}`));

  if (next.length !== current.length) {
    writeLocalDeviceCache(next);
    console.debug('[data] Local cache cleanup removed stale synced rows:', {
      removed: current.length - next.length,
    });
  }
}

function writeLocalDeviceCache(cache: CachedDevice[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCAL_DEVICE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('[data] Failed to write local device cache:', error);
  }
}

function upsertLocalDeviceCache(
  device: Device,
  syncStatus: SyncStatus,
  options?: { replaceType?: string; replaceId?: string; errorMessage?: string | null },
): void {
  const current = readLocalDeviceCache();
  const nextUpdatedAt = new Date().toISOString();

  const nextDevice: CachedDevice = {
    ...device,
    source: 'supabase',
    _syncStatus: syncStatus,
    _updatedAt: nextUpdatedAt,
    _lastError: options?.errorMessage ?? null,
  };

  const next = current.filter((item) => {
    if (item.type === device.type && item.id === device.id) return false;
    if (options?.replaceType && options?.replaceId && item.type === options.replaceType && item.id === options.replaceId) return false;
    return true;
  });

  next.push(nextDevice);
  writeLocalDeviceCache(next);
}

function removeLocalDeviceCacheEntry(type: string, deviceId: string): void {
  const current = readLocalDeviceCache();
  if (current.length === 0) return;

  const next = current.filter((item) => !(item.type === type && item.id === deviceId));
  if (next.length !== current.length) {
    writeLocalDeviceCache(next);
  }
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

async function uploadComplaintImageWithProgress(file: File, path: string, onProgress?: (percent: number) => void): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing for upload');
  }

  const encodedPath = encodeStoragePath(path);
  const url = `${supabaseUrl}/storage/v1/object/${COMPLAINT_IMAGE_BUCKET}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };

    xhr.onerror = () => reject(new Error('Network error while uploading image'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || 'Unknown error'}`));
    };

    xhr.send(file);
  });
}

function parseCsvRows<T>(url: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data ?? []);
      },
      error: (error) => reject(error),
    });
  });
}

function parseNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRange(value: string | undefined): number {
  const parsed = parseNumber(value);
  if (parsed === null || parsed <= 0) return 0;
  return parsed;
}

const BASE_SHEET_COLUMNS = new Set([
  'LOCATION',
  'LAT',
  'LNG',
  'LON',
  'IMG_FILE',
  'IMG_DATE',
  'STATUS',
  'STATUSDATE',
  'RANGE',
]);

function collectCustomFieldsFromRow(
  row: Record<string, unknown>,
  excludedKeys: Set<string>,
): Record<string, string> | undefined {
  const output: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = String(rawKey ?? '').trim();
    if (!key) continue;
    const upperKey = key.toUpperCase();

    if (BASE_SHEET_COLUMNS.has(upperKey)) continue;
    if (excludedKeys.has(key) || excludedKeys.has(upperKey)) continue;

    if (rawValue === null || typeof rawValue === 'undefined') continue;
    if (typeof rawValue === 'object') continue;

    const value = String(rawValue).trim();
    if (!value) continue;

    output[key] = value;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function mapStreetLights(rows: StreetLightRow[]): StreetLightDevice[] {
  const result: StreetLightDevice[] = [];

  for (const row of rows) {
    if ((row.ASSET_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    const customFields = collectCustomFieldsFromRow(row as unknown as Record<string, unknown>, new Set([
      'ASSET_ID',
      'ASSETOWNER',
      'LAMP_TYPE',
      'BULB_TYPE',
      'WATT',
      'BOX_ID',
    ]));

    result.push({
      id: row.ASSET_ID ?? '',
      name: row.LOCATION || 'โคมไฟ',
      type: 'streetlight',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.LAMP_TYPE,
      rangeMeters: parseRange(row.RANGE),
      lampType: row.LAMP_TYPE,
      bulbType: row.BULB_TYPE,
      watt: row.WATT,
      boxId: row.BOX_ID,
      owner: row.ASSETOWNER,
      imageDate: row.IMG_DATE,
      customFields,
      source: 'sheet',
    });
  }

  return result;
}

function mapWifi(rows: WifiRow[]): WifiDevice[] {
  const result: WifiDevice[] = [];

  for (const row of rows) {
    if ((row.WIFI_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    const customFields = collectCustomFieldsFromRow(row as unknown as Record<string, unknown>, new Set([
      'WIFI_ID',
      'ISP',
      'SPEED',
      'DEVICE_COUNT',
    ]));

    result.push({
      id: row.WIFI_ID ?? '',
      name: row.LOCATION || 'Wi-Fi',
      type: 'wifi',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.ISP,
      rangeMeters: parseRange(row.RANGE),
      isp: row.ISP,
      speed: row.SPEED,
      deviceCount: parseNumber(row.DEVICE_COUNT) ?? 0,
      customFields,
      source: 'sheet',
    });
  }

  return result;
}

function mapHydrants(rows: HydrantRow[]): HydrantDevice[] {
  const result: HydrantDevice[] = [];

  for (const row of rows) {
    if ((row.HYDRANT_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    const customFields = collectCustomFieldsFromRow(row as unknown as Record<string, unknown>, new Set([
      'HYDRANT_ID',
      'PRESSURE',
      'LAST_CHECK',
    ]));

    result.push({
      id: row.HYDRANT_ID ?? '',
      name: row.LOCATION || 'ประปา',
      type: 'hydrant',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.PRESSURE,
      rangeMeters: parseRange(row.RANGE),
      pressure: row.PRESSURE,
      lastCheck: row.LAST_CHECK,
      customFields,
      source: 'sheet',
    });
  }

  return result;
}

interface DeviceDbRow {
  [key: string]: unknown;
  id?: string;
  device_code?: string;
  name?: string;
  device_type?: string;
  type?: string;
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  status?: string;
  department?: string;
  description?: string | null;
  range_meters?: number | string | null;
  range?: number | string | null;
  sketch_pin?: boolean | null;
  sketchPin?: boolean | null;
  device_image_url?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
}

function mapDeviceType(value: string | undefined): Device['type'] | null {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;
  return normalized as Device['type'];
}

function mapToDbFormat(device: any) {
  const resolvedId = String(device?.id ?? device?.device_code ?? '').trim();
  const lat = parseNumber(device?.lat);
  const lng = parseNumber(device?.lng ?? device?.lon);
  const rangeMeters = parseNumber(device?.rangeMeters ?? device?.range_meters ?? device?.range);

  return {
    id: resolvedId,
    name: typeof device?.name === 'string' ? device.name : '',
    type: typeof device?.type === 'string' ? device.type : 'streetlight',
    lat: lat ?? 0,
    lng: lng ?? 0,
    status: typeof device?.status === 'string' ? device.status : 'normal',
    description: typeof device?.description === 'string' ? device.description : '',
    department: typeof device?.department === 'string' && device.department.trim() ? device.department : DEFAULT_DEPARTMENT,
    range_meters: rangeMeters ?? 100,
    sketch_pin: Boolean(device?.sketchPin ?? device?.sketch_pin ?? false),
    use_sketch_pin: Boolean(device?.useSketchPin ?? device?.use_sketch_pin ?? false),
    use_radius_pin: Boolean(device?.useRadiusPin ?? device?.use_radius_pin ?? true),
    device_type: typeof device?.device_type === 'string' ? device.device_type : (typeof device?.type === 'string' ? device.type : ''),
    device_code: typeof device?.device_code === 'string' && device.device_code.trim() ? device.device_code : resolvedId,
    source: 'supabase',
  };
}

function buildDeviceInsertPayloadCandidates(device: any): Array<Record<string, unknown>> {
  const mapped = mapToDbFormat(device);

  return [
    mapped,
    {
      id: mapped.id,
      device_code: mapped.device_code,
      name: mapped.name,
      device_type: mapped.device_type,
      lat: mapped.lat,
      lng: mapped.lng,
      status: mapped.status,
      department: mapped.department,
      description: mapped.description || null,
      range_meters: mapped.range_meters,
      sketch_pin: mapped.sketch_pin,
    },
  ];
}

async function upsertDeviceWithFallback(
  devicesTable: any,
  device: any,
): Promise<{ data: any; error: any; lastError: any }> {
  const payloadCandidates = buildDeviceInsertPayloadCandidates(device);
  let result: { data: any; error: any } = { data: null, error: null };
  let lastError: any = null;

  for (const payload of payloadCandidates) {
    for (const onConflict of ['id', 'device_code']) {
      result = await devicesTable.upsert(payload, { onConflict }).select('*');
      if (!result.error) {
        return { data: result.data, error: null, lastError: null };
      }

      lastError = result.error;

      // Keep trying other payload/conflict combinations for schema and constraint variations.
      if (result.error.code === '42703' || result.error.code === '42P10' || result.error.code === '23505') {
        continue;
      }

      break;
    }
  }

  return { data: result.data, error: result.error, lastError };
}

function mapDbRows(rows: DeviceDbRow[]): Device[] {
  const mapped: Array<Device | null> = rows
    .map((row, idx) => {
      const id = (row.device_code ?? row.id ?? '').trim();
      const type = mapDeviceType(row.device_type ?? row.type);
      const lat = parseNumber(row.lat);
      const lng = parseNumber(row.lng) ?? parseNumber(row.lon);
      if (!id || type === null || lat === null || lng === null) {
        return null;
      }

      const parsedStatus = parseDeviceStatus(row.status);
      
      if (idx === 0) {
        console.debug('[data] mapDbRows first row status conversion:', {
          rawStatus: row.status,
          parsedStatus,
          rowData: { id, name: row.name, type, status: row.status },
        });
      }

      const device: Device = {
        id,
        name: row.name?.trim() || id,
        type,
        lat,
        lng,
        status: parsedStatus,
        department: row.department ?? DEFAULT_DEPARTMENT,
        description: row.description ?? '',
        deviceImageUrl: row.device_image_url ?? row.image_url ?? row.photo_url ?? undefined,
        rangeMeters: parseNumber((row.range_meters ?? row.range) ?? undefined) ?? 0,
        sketchPin: row.sketch_pin ?? row.sketchPin ?? false,
        syncStatus: 'synced' as const,
        source: 'supabase' as const,
      };

      const excludedDbKeys = new Set<string>([
        'id',
        'device_code',
        'name',
        'device_type',
        'type',
        'lat',
        'lng',
        'lon',
        'status',
        'department',
        'description',
        'range_meters',
        'range',
        'sketch_pin',
        'sketchPin',
        'device_image_url',
        'image_url',
        'photo_url',
        'created_at',
        'updated_at',
        'use_sketch_pin',
        'use_radius_pin',
        'useSketchPin',
        'useRadiusPin',
        'syncStatus',
        'source',
      ]);

      const customFields = collectCustomFieldsFromRow(row, excludedDbKeys);
      if (customFields) {
        device.customFields = customFields;
      }

      return device;
    });

  const result = mapped.filter((item): item is Device => item !== null);
  
  if (result.length > 0) {
    console.debug('[data] mapDbRows mapped DB rows:', {
      count: result.length,
      sample: {
        id: result[0].id,
        name: result[0].name,
        status: result[0].status,
        source: result[0].source,
      },
    });
  }

  return result;
}

export async function fetchSheetDevices(): Promise<Device[]> {
  const [streetRows, wifiRows, hydrantRows] = await Promise.all([
    parseCsvRows<StreetLightRow>(SHEET_STREETLIGHT),
    parseCsvRows<WifiRow>(SHEET_WIFI),
    parseCsvRows<HydrantRow>(SHEET_HYDRANT),
  ]);

  return [...mapStreetLights(streetRows), ...mapWifi(wifiRows), ...mapHydrants(hydrantRows)];
}

async function fetchDbDevicesWithMeta(): Promise<{ devices: Device[]; success: boolean }> {
  if (!isSupabaseEnabled || !supabase) return { devices: [], success: false };

  const devicesTable = supabase.from('devices') as any;

  const orderedResult = await devicesTable.select('*').order('created_at', { ascending: true });

  if (orderedResult.error) {
    console.warn('[data] Ordered fetch failed, retrying without order(created_at):', {
      message: orderedResult.error.message,
      code: orderedResult.error.code,
      details: orderedResult.error.details,
      hint: orderedResult.error.hint,
    });

    const fallbackResult = await devicesTable.select('*');
    if (fallbackResult.error) {
      console.error('[data] Failed to fetch devices from Supabase:', {
        message: fallbackResult.error.message,
        code: fallbackResult.error.code,
        details: fallbackResult.error.details,
        hint: fallbackResult.error.hint,
      });
      return { devices: [], success: false };
    }

    const mapped = mapDbRows(fallbackResult.data ?? []);
    console.debug('[data] Supabase fallback fetch success:', {
      rawCount: (fallbackResult.data ?? []).length,
      mappedCount: mapped.length,
    });
    return { devices: mapped, success: true };
  }

  const mapped = mapDbRows(orderedResult.data ?? []);
  console.debug('[data] Supabase ordered fetch success:', {
    rawCount: (orderedResult.data ?? []).length,
    mappedCount: mapped.length,
  });
  return { devices: mapped, success: true };
}

export async function fetchDbDevices(): Promise<Device[]> {
  const { devices } = await fetchDbDevicesWithMeta();
  return devices;
}

export async function fetchAllDevices(): Promise<Device[]> {
  if (fetchAllDevicesInFlight) {
    return fetchAllDevicesInFlight;
  }

  if (
    import.meta.env.DEV &&
    lastFetchAllDevicesResult &&
    Date.now() - lastFetchAllDevicesAt < DEV_FETCH_ALL_DEDUPE_WINDOW_MS
  ) {
    return lastFetchAllDevicesResult;
  }

  const request = (async () => {
  const [sheetDevices, dbResult] = await Promise.all([fetchSheetDevices(), fetchDbDevicesWithMeta()]);
  const dbDevices = dbResult.devices;
  const cachedDevices = getLocalCachedDevicesForMerge();

  // DB is source of truth for synced rows: purge stale synced cache entries after successful DB read.
  if (dbResult.success) {
    removeSyncedCacheNotInDb(dbDevices);
  }

  // Supabase is the authoritative source for any device it has
  // Priority: DB (Supabase) > Local Cache > Google Sheets
  const mergedByKey = new Map<string, Device>();
  
  // Layer 1: Start with all sheet devices as baseline
  for (const device of sheetDevices) {
    mergedByKey.set(`${device.type}:${device.id}`, device);
  }
  
  // Layer 2: Override with cached devices (includes pending/error status)
  for (const device of cachedDevices) {
    const key = `${device.type}:${device.id}`;
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, {
      ...existing,
      ...device,
      source: 'supabase',
    });
  }
  
  // Layer 3: Override with DB devices (SUPABASE WINS - always)
  for (const device of dbDevices) {
    const key = `${device.type}:${device.id}`;
    const existing = mergedByKey.get(key);
    // DB data completely overrides previous data, preserving extra fields if needed
    mergedByKey.set(key, {
      ...existing,
      ...device,
      source: 'supabase',
      syncStatus: 'synced' as const,
    });
  }

  const merged = Array.from(mergedByKey.values());

  console.debug('[data] fetchAllDevices merged result:', {
    sheetCount: sheetDevices.length,
    cachedCount: cachedDevices.length,
    dbCount: dbDevices.length,
    mergedCount: merged.length,
    dbSuccess: dbResult.success,
  });

  // Log any discrepancies where the same device exists in multiple sources
  const sheetIds = new Set(sheetDevices.map(d => `${d.type}:${d.id}`));
  const dbIds = new Set(dbDevices.map(d => `${d.type}:${d.id}`));
  const overlap = new Set([...sheetIds].filter(id => dbIds.has(id)));
  if (overlap.size > 0) {
    console.debug('[data] Devices found in both Sheet and DB (DB version used):', overlap.size);
  }

  lastFetchAllDevicesResult = merged;
  lastFetchAllDevicesAt = Date.now();

  return merged;
  })();

  fetchAllDevicesInFlight = request;

  try {
    return await request;
  } finally {
    fetchAllDevicesInFlight = null;
  }
}

export async function saveDevicePosition(input: NewDeviceInput): Promise<Device> {
  const deviceCode = `NEW-${Date.now()}`;
  
  // --- จัดการแพ็กข้อมูลยืดหยุ่นใส่เข้าไปใน Description ---
  let finalDescription = input.description || '';
  const extraDetails: string[] = [];

  if (input.type === 'streetlight') {
    if (input.owner) extraDetails.push(`เจ้าของ: ${input.owner}`);
    if (input.watt) extraDetails.push(`กำลังไฟ: ${input.watt}`);
    if (input.lampType) extraDetails.push(`โคม: ${input.lampType}`);
    if (input.bulbType) extraDetails.push(`หลอด: ${input.bulbType}`);
  } else if (input.type === 'wifi') {
    if (input.isp) extraDetails.push(`ISP: ${input.isp}`);
    if (input.speed) extraDetails.push(`ความเร็ว: ${input.speed}`);
  } else if (input.type === 'hydrant') {
    if (input.pressure) extraDetails.push(`แรงดันน้ำ: ${input.pressure}`);
  }

  if (input.customFields && typeof input.customFields === 'object') {
    for (const [key, value] of Object.entries(input.customFields)) {
      const normalizedKey = String(key).trim();
      const normalizedValue = String(value ?? '').trim();
      if (!normalizedKey || !normalizedValue) continue;
      extraDetails.push(`${normalizedKey}: ${normalizedValue}`);
    }
  }

  if (input.customTypeLabel) {
    extraDetails.push(`[ประเภท:${input.customTypeLabel}]`);
  }
  if (input.customTypeIcon) {
    extraDetails.push(`[ไอคอน:${input.customTypeIcon}]`);
  }

  // ถ้ามีการกรอกข้อมูลเพิ่มเติม ให้เอามาต่อท้ายหมายเหตุเดิม
  if (extraDetails.length > 0) {
    const detailsString = extraDetails.join(' | ');
    finalDescription = finalDescription 
      ? `${finalDescription}\n(รายละเอียด: ${detailsString})` 
      : `รายละเอียด: ${detailsString}`;
  }

  // สร้าง Object Device เตรียมคืนค่า
  const device: Device = {
    id: deviceCode,
    name: input.name,
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    department: DEFAULT_DEPARTMENT,
    description: finalDescription, // ใช้ description ที่รวมร่างแล้ว
    rangeMeters: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketchPin: input.useSketchPin,
    source: 'supabase',
    // แนบค่าจริงไปด้วยเผื่อ Frontend เอาไปใช้ต่อเลย (Cast type เพื่อเลี่ยง TS Error ชั่วคราว)
    ...(input as any) 
  };

  // Queue as pending first so offline/network failures can be synced later.
  upsertLocalDeviceCache(device, 'pending');

  // Optional: also append the device to Google Sheets schema tab for custom device types.
  // This is separate from the public CSV feeds (those are read-only from the frontend).
  try {
    const isKnown = input.type === 'streetlight' || input.type === 'wifi' || input.type === 'hydrant';
    if (!isKnown) {
      const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
      const token = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
      const spreadsheetId = (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? '';

      if (appsScriptUrl.trim() && spreadsheetId.trim()) {
        const dataForSheet: Record<string, string> = {
          LOCATION: input.name,
          LAT: Number.isFinite(input.lat) ? input.lat.toFixed(6) : String(input.lat),
          LON: Number.isFinite(input.lng) ? input.lng.toFixed(6) : String(input.lng),
          IMG_FILE: '',
          IMG_DATE: '',
          STATUS: statusLabels[input.status] ?? String(input.status),
          STATUSDATE: new Date().toISOString(),
          RANGE: String(input.useRadiusPin ? (input.radiusMeters ?? 0) : 0),
        };

        if (input.customFields && typeof input.customFields === 'object') {
          for (const [key, value] of Object.entries(input.customFields)) {
            const normalizedKey = String(key).trim();
            const normalizedValue = String(value ?? '').trim();
            if (!normalizedKey || !normalizedValue) continue;
            dataForSheet[normalizedKey] = normalizedValue;
          }
        }

        // Also include common known fields; ignored if column doesn't exist in the sheet.
        if (input.owner) dataForSheet.ASSETOWNER = input.owner;
        if (input.watt) dataForSheet.WATT = input.watt;
        if (input.lampType) dataForSheet.LAMP_TYPE = input.lampType;
        if (input.bulbType) dataForSheet.BULB_TYPE = input.bulbType;
        if (input.isp) dataForSheet.ISP = input.isp;
        if (input.speed) dataForSheet.SPEED = input.speed;
        if (input.pressure) dataForSheet.PRESSURE = input.pressure;

        await appendSchemaRow({
          appsScriptUrl,
          token,
          spreadsheetId,
          sheetName: String(input.type),
          data: dataForSheet,
        });
      }
    }
  } catch (error) {
    console.warn('[data] Failed to append device row to Google Sheets:', error);
  }

  if (!isSupabaseEnabled || !supabase) {
    console.warn('[data] Supabase is disabled or missing env vars; queued device as pending in local cache.');
    return device;
  }

  const devicesTable = supabase.from('devices') as any;
  const upsertTarget = {
    ...device,
    rangeMeters: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketchPin: input.useSketchPin,
    useSketchPin: input.useSketchPin,
    useRadiusPin: input.useRadiusPin,
    device_type: input.type,
    device_code: device.id,
  };

  const insertResult = await upsertDeviceWithFallback(devicesTable, upsertTarget);
  const lastInsertError = insertResult.lastError;

  if (insertResult.error) {
    console.error('Failed to save device to Supabase:', {
      message: lastInsertError?.message ?? insertResult.error.message,
      code: lastInsertError?.code ?? insertResult.error.code,
      details: lastInsertError?.details ?? insertResult.error.details,
      hint: lastInsertError?.hint ?? insertResult.error.hint,
    });
    upsertLocalDeviceCache(device, 'pending', {
      errorMessage: lastInsertError?.message ?? insertResult.error.message,
    });
    console.warn('[data] Insert failed; device remains pending in local cache.');
    return device;
  }

  const insertedDevice = mapDbRows(insertResult.data ?? [])[0] ?? device;
  upsertLocalDeviceCache(insertedDevice, 'synced', {
    replaceType: device.type,
    replaceId: device.id,
    errorMessage: null,
  });

  return insertedDevice;
}

export async function syncPendingDevices(): Promise<{ attempted: number; synced: number; failed: number }> {
  const cache = readLocalDeviceCache();
  const queue = cache
    .filter((item) => item._syncStatus === 'pending' || item._syncStatus === 'error')
    .sort((a, b) => a._updatedAt.localeCompare(b._updatedAt));

  if (queue.length === 0) {
    return { attempted: 0, synced: 0, failed: 0 };
  }

  if (!isSupabaseEnabled || !supabase) {
    console.warn('[data] syncPendingDevices skipped: Supabase is disabled.');
    return { attempted: queue.length, synced: 0, failed: queue.length };
  }

  const devicesTable = supabase.from('devices') as any;
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    const mappedPayload = mapToDbFormat(item);

    if (!mappedPayload.id) {
      failed += 1;
      upsertLocalDeviceCache(item, 'error', {
        errorMessage: 'Device id is missing before insert',
      });
      continue;
    }

    const insertResult = await upsertDeviceWithFallback(devicesTable, item);
    const lastError = insertResult.lastError;

    if (insertResult.error) {
      failed += 1;
      upsertLocalDeviceCache(item, 'error', {
        errorMessage: lastError?.message ?? insertResult.error.message,
      });
      continue;
    }

    const syncedDevice = mapDbRows(insertResult.data ?? [])[0] ?? cachedToDevice(item);
    upsertLocalDeviceCache(syncedDevice, 'synced', {
      replaceType: item.type,
      replaceId: item.id,
      errorMessage: null,
    });
    synced += 1;
  }

  console.debug('[data] syncPendingDevices summary:', {
    attempted: queue.length,
    synced,
    failed,
  });

  return {
    attempted: queue.length,
    synced,
    failed,
  };
}

export async function saveComplaint(input: ComplaintInput): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    return;
  }

  let imageUrl = input.imageUrl ?? null;
  if (input.attachmentFile) {
    const safeName = input.attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${input.deviceType}/${input.deviceId}/${Date.now()}-${safeName}`;
    input.onUploadProgress?.(0);

    try {
      await uploadComplaintImageWithProgress(input.attachmentFile, path, input.onUploadProgress);
      const publicUrl = supabase.storage.from(COMPLAINT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      imageUrl = publicUrl || null;
    } catch (xhrError) {
      console.warn('[data] XHR upload failed, fallback to supabase-js upload:', xhrError);

      const upload = await supabase.storage.from(COMPLAINT_IMAGE_BUCKET).upload(path, input.attachmentFile, {
        upsert: false,
        contentType: input.attachmentFile.type || undefined,
      });

      if (upload.error) {
        console.warn('[data] Complaint image upload failed, continue without image:', {
          message: upload.error.message,
          bucket: COMPLAINT_IMAGE_BUCKET,
        });
      } else {
        input.onUploadProgress?.(100);
        const publicUrl = supabase.storage.from(COMPLAINT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        imageUrl = publicUrl || null;
      }
    }
  }

  const complaintsTable = supabase.from('complaints') as any;
  const basePayload = {
    device_id: input.deviceId,
    device_type: input.deviceType,
    device_name: input.deviceName,
    location: input.location,
    status: input.status,
    description: input.description ?? null,
  };

  let result = await complaintsTable.insert({
    ...basePayload,
    image_url: imageUrl,
  });

  if (result.error?.code === '42703') {
    result = await complaintsTable.insert(basePayload);
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

// ดึงข้อมูลประวัติการซ่อม/ร้องเรียนของอุปกรณ์นั้นๆ
export async function fetchDeviceComplaints(deviceId: string) {
  if (!isSupabaseEnabled || !supabase) return [];

  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch complaints:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    image_url: row.image_url ?? row.attachment_url ?? null,
  }));
}

export interface DeviceEditHistoryItem {
  id: string;
  device_id: string;
  changed_by: string | null;
  before_name: string | null;
  after_name: string | null;
  before_status: string | null;
  after_status: string | null;
  note: string | null;
  created_at: string | null;
}

type UpdateDeviceMeta = {
  changedBy?: string;
  note?: string;
  before?: {
    name?: string;
    status?: string;
  };
};

function formatSupabaseError(error: any): string {
  if (!error) return 'Unknown Supabase error';
  const parts = [error.message, error.code, error.hint].filter(Boolean);
  return parts.join(' | ');
}

async function writeDeviceEditLog(deviceId: string, payload: Omit<DeviceEditHistoryItem, 'id' | 'device_id' | 'created_at'>) {
  if (!isSupabaseEnabled || !supabase) return;

  const result = await (supabase.from('device_change_logs') as any).insert({
    device_id: deviceId,
    changed_by: payload.changed_by,
    before_name: payload.before_name,
    after_name: payload.after_name,
    before_status: payload.before_status,
    after_status: payload.after_status,
    note: payload.note,
  });

  if (result.error) {
    // ไม่ทำให้การบันทึกหลักล้มเหลว หากตาราง log ยังไม่ถูกสร้างหรือ policy ยังไม่พร้อม
    console.warn('[data] Failed to write device change log:', {
      message: result.error.message,
      code: result.error.code,
    });
  }
}

export async function fetchDeviceEditLogs(deviceId: string): Promise<DeviceEditHistoryItem[]> {
  if (!isSupabaseEnabled || !supabase) return [];

  const { data, error } = await (supabase.from('device_change_logs') as any)
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[data] Failed to fetch device change logs:', {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  return (data ?? []) as DeviceEditHistoryItem[];
}

// อัปเดตข้อมูลอุปกรณ์ (เตรียมไว้สำหรับปุ่ม Save)
export async function updateDeviceData(deviceId: string, updates: Partial<Device>, meta?: UpdateDeviceMeta) {
  if (!isSupabaseEnabled || !supabase) return;

  const devicesTable = supabase.from('devices') as any;
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === 'string') {
    const normalizedName = updates.name.trim();
    payload.name = normalizedName;
  }
  if (updates.status) {
    payload.status = updates.status;
  }
  if (typeof updates.description === 'string') {
    payload.description = updates.description;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const beforeName = meta?.before?.name ?? updates.name ?? null;
  const beforeStatus = meta?.before?.status ?? updates.status ?? null;
  const afterName = typeof payload.name === 'string' ? payload.name : (updates.name ?? null);
  const afterStatus = typeof payload.status === 'string' ? payload.status : (updates.status ?? null);

  let result = await devicesTable.update(payload).eq('device_code', deviceId).select('id');
  if (result.error?.code === '42703') {
    result = await devicesTable.update(payload).eq('id', deviceId).select('id');
  }

  if (result.error) {
    throw new Error(formatSupabaseError(result.error));
  }

  // ถ้าไม่เจอแถวเดิม ให้สร้างแถวใหม่สำหรับ device นี้เพื่อให้ค่าแก้ไขใช้งานได้จริง
  if ((result.data?.length ?? 0) === 0) {
    const fallbackPayload = {
      device_code: deviceId,
      name: (payload.name as string) ?? deviceId,
      device_type: updates.type,
      lat: updates.lat,
      lng: updates.lng,
      status: (payload.status as string) ?? 'normal',
      department: updates.department ?? DEFAULT_DEPARTMENT,
      description: (payload.description as string | null | undefined) ?? null,
      range_meters: updates.rangeMeters ?? 0,
      sketch_pin: updates.sketchPin ?? false,
    };

    if (!fallbackPayload.device_type || typeof fallbackPayload.lat !== 'number' || typeof fallbackPayload.lng !== 'number') {
      throw new Error('Cannot create missing device row: missing type or coordinates.');
    }

    const insertResult = await upsertDeviceWithFallback(devicesTable, {
      id: deviceId,
      device_code: fallbackPayload.device_code,
      name: fallbackPayload.name,
      type: fallbackPayload.device_type,
      device_type: fallbackPayload.device_type,
      lat: fallbackPayload.lat,
      lng: fallbackPayload.lng,
      status: fallbackPayload.status,
      department: fallbackPayload.department,
      description: fallbackPayload.description,
      rangeMeters: fallbackPayload.range_meters,
      sketchPin: fallbackPayload.sketch_pin,
    });

    if (insertResult.error) {
      throw new Error(formatSupabaseError(insertResult.error));
    }
  }

  const hasNameChanged = (beforeName ?? '') !== (afterName ?? '');
  const hasStatusChanged = (beforeStatus ?? '') !== (afterStatus ?? '');

  if (hasNameChanged || hasStatusChanged) {
    await writeDeviceEditLog(deviceId, {
      changed_by: meta?.changedBy ?? 'web-user',
      before_name: beforeName,
      after_name: afterName,
      before_status: beforeStatus,
      after_status: afterStatus,
      note: meta?.note ?? null,
    });
  }
}

export async function deleteDeviceData(device: {
  id: string;
  type: Device['type'];
  name?: string;
  lat?: number;
  lng?: number;
}): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error('Supabase is not enabled');
  }

  // For custom device types, also delete from Google Sheets schema tab.
  // Built-in types (streetlight/wifi/hydrant) are read from public CSV feeds and are not managed by this Apps Script.
  const isKnown = device.type === 'streetlight' || device.type === 'wifi' || device.type === 'hydrant';
  if (!isKnown) {
    const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
    const token = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
    const spreadsheetId = (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? '';

    if (appsScriptUrl.trim() && spreadsheetId.trim() && device.name && typeof device.lat === 'number' && typeof device.lng === 'number') {
      const result = await deleteSchemaRow({
        appsScriptUrl,
        token,
        spreadsheetId,
        sheetName: String(device.type),
        where: {
          LOCATION: device.name,
          LAT: Number.isFinite(device.lat) ? device.lat.toFixed(6) : String(device.lat),
          LON: Number.isFinite(device.lng) ? device.lng.toFixed(6) : String(device.lng),
        },
      });

      if (!result.deleted) {
        console.warn('[data] deleteSchemaRow: row not found; continuing with DB delete', {
          deviceId: device.id,
          type: device.type,
        });
      }
    }
  }

  const devicesTable = supabase.from('devices') as any;

  let result = await devicesTable.delete().eq('device_code', device.id).select('id');
  if (result.error?.code === '42703') {
    result = await devicesTable.delete().eq('id', device.id).select('id');
  }

  // ถ้าใช้ device_code แล้วไม่เจอแถว ให้ลองลบด้วย id ด้วย
  if (!result.error && (result.data?.length ?? 0) === 0) {
    const fallback = await devicesTable.delete().eq('id', device.id).select('id');
    if (fallback.error || (fallback.data?.length ?? 0) > 0) {
      result = fallback;
    }
  }

  if (result.error) {
    throw new Error(formatSupabaseError(result.error));
  }

  removeLocalDeviceCacheEntry(device.type, device.id);
}
