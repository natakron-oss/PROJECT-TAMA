export type DeviceColumnName = string;

export type CustomDeviceSchema = {
  typeCode: string;
  columns: DeviceColumnName[];
  createdAt: string;
  updatedAt: string;
};

export const REQUIRED_DEVICE_COLUMNS: DeviceColumnName[] = [
  'LOCATION',
  'LAT',
  'LON',
  'IMG_FILE',
  'IMG_DATE',
  'STATUS',
  'STATUSDATE',
  'RANGE',
];

const STORAGE_KEY = 'projectpruta.custom-device-schemas';

function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeColumnName(name: string): string {
  return name.trim().replace(/\s+/g, '_').toUpperCase();
}

export function normalizeCustomColumns(names: string[]): string[] {
  const normalized = names
    .map((item) => normalizeColumnName(item))
    .filter((item) => Boolean(item));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of normalized) {
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }

  return result;
}

export function loadCustomDeviceSchemas(): Record<string, CustomDeviceSchema> {
  if (typeof window === 'undefined') return {};

  const parsed = safeParseJson(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== 'object') return {};

  const raw = parsed as Record<string, unknown>;
  const output: Record<string, CustomDeviceSchema> = {};

  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    if (typeof row.typeCode !== 'string') continue;
    if (!Array.isArray(row.columns)) continue;

    output[key] = {
      typeCode: row.typeCode,
      columns: row.columns.filter((item) => typeof item === 'string') as string[],
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
    };
  }

  return output;
}

export function saveCustomDeviceSchema(typeCode: string, customColumns: string[]): CustomDeviceSchema {
  const now = new Date().toISOString();
  const normalizedCustom = normalizeCustomColumns(customColumns);
  const allColumns = [...REQUIRED_DEVICE_COLUMNS, ...normalizedCustom];

  const existing = loadCustomDeviceSchemas()[typeCode];
  const schema: CustomDeviceSchema = {
    typeCode,
    columns: allColumns,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (typeof window !== 'undefined') {
    const all = loadCustomDeviceSchemas();
    all[typeCode] = schema;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  return schema;
}
