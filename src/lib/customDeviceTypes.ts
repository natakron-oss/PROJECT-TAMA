import { isSupabaseEnabled, supabase } from './supabase';
import { isKnownDeviceType } from '../deviceTypeMeta';
import { getSchemaHeaders, listSchemaSheets } from './googleSheetsSchema';
import { REQUIRED_DEVICE_COLUMNS } from './customDeviceSchemas';

const DEFAULT_SCHEMA_SPREADSHEET_ID = '1o0HsgmEeKRmKO6mUKGrppjgAIsFWlfJ87U-YPcpTMYo';
const DEV_CUSTOM_TYPES_DEDUPE_WINDOW_MS = 1500;

let customTypesInFlight: Promise<CustomDeviceType[]> | null = null;
let lastCustomTypesFetchAt = 0;
let lastCustomTypesResult: CustomDeviceType[] | null = null;

export interface CustomDeviceType {
  id: string;
  typeCode: string;
  label: string;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CustomDeviceTypeRow {
  id: string;
  type_code: string;
  label: string;
  icon: string;
  color: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export type CustomDeviceTypeInput = {
  typeCode: string;
  label: string;
  icon: string;
  color?: string;
};

export type CustomDeviceTypeUpdate = {
  label?: string;
  icon?: string;
  color?: string;
};

export function normalizeCustomDeviceTypeCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function mapRow(row: CustomDeviceTypeRow): CustomDeviceType {
  return {
    id: row.id,
    typeCode: row.type_code,
    label: row.label,
    icon: row.icon,
    color: row.color ?? '#6366f1',
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureSupabase(): NonNullable<typeof supabase> {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the dev server.',
    );
  }

  return supabase;
}

export async function fetchCustomDeviceTypes(): Promise<CustomDeviceType[]> {
  if (customTypesInFlight) {
    return customTypesInFlight;
  }

  if (
    import.meta.env.DEV &&
    lastCustomTypesResult &&
    Date.now() - lastCustomTypesFetchAt < DEV_CUSTOM_TYPES_DEDUPE_WINDOW_MS
  ) {
    return lastCustomTypesResult;
  }

  const request = (async () => {
  const appsScriptUrl = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_URL as string | undefined) ?? '';
  const appsScriptToken = (import.meta.env.VITE_APPS_SCRIPT_SCHEMA_TOKEN as string | undefined) ?? '';
  const spreadsheetId =
    (import.meta.env.VITE_DEVICE_SCHEMA_SPREADSHEET_ID as string | undefined) ?? DEFAULT_SCHEMA_SPREADSHEET_ID;

  // Prefer Google Sheets as source of truth when configured.
  if (appsScriptUrl.trim()) {
    try {
      const sheets = await listSchemaSheets({
        appsScriptUrl,
        token: appsScriptToken,
        spreadsheetId,
      });

      const requiredSet = new Set(REQUIRED_DEVICE_COLUMNS);

      const candidates = sheets
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .filter((name) => !isKnownDeviceType(name));

      const validated = await Promise.all(
        candidates.map(async (sheetName) => {
          try {
            const headers = await getSchemaHeaders({
              appsScriptUrl,
              token: appsScriptToken,
              spreadsheetId,
              sheetName,
            });
            const headerSet = new Set(headers.map((h) => h.trim().toUpperCase()).filter(Boolean));
            const ok = Array.from(requiredSet).every((col) => headerSet.has(col));
            return ok ? sheetName : null;
          } catch {
            return null;
          }
        }),
      );

      const result = validated
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
        .sort((a, b) => a.localeCompare(b, 'th'))
        .map((name) => ({
          id: `sheet:${name}`,
          typeCode: name,
          label: name,
          icon: '🧩',
          color: '#6366f1',
          isActive: true,
          createdAt: null,
          updatedAt: null,
        }));

      lastCustomTypesResult = result;
      lastCustomTypesFetchAt = Date.now();
      return result;
    } catch (error) {
      console.warn('[customDeviceTypes] Failed to load custom types from Google Sheets; falling back to Supabase:', error);
    }
  }

  if (!isSupabaseEnabled || !supabase) {
    lastCustomTypesResult = [];
    lastCustomTypesFetchAt = Date.now();
    return [];
  }

  const result = await (supabase.from('custom_device_types') as any)
    .select('*')
    .eq('is_active', true)
    .order('label', { ascending: true });

  if (result.error) {
    console.warn('[customDeviceTypes] Failed to load custom types:', {
      message: result.error.message,
      code: result.error.code,
    });
    lastCustomTypesResult = [];
    lastCustomTypesFetchAt = Date.now();
    return [];
  }

  const mapped = (result.data ?? []).map(mapRow);
  lastCustomTypesResult = mapped;
  lastCustomTypesFetchAt = Date.now();
  return mapped;
  })();

  customTypesInFlight = request;

  try {
    return await request;
  } finally {
    customTypesInFlight = null;
  }
}

export async function createCustomDeviceType(input: CustomDeviceTypeInput): Promise<CustomDeviceType> {
  const client = ensureSupabase();
  const payload = {
    type_code: normalizeCustomDeviceTypeCode(input.typeCode),
    label: input.label.trim(),
    icon: input.icon.trim() || '🧩',
    color: input.color?.trim() || '#6366f1',
    is_active: true,
  };

  const result = await (client.from('custom_device_types') as any)
    .insert(payload)
    .select('*')
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return mapRow(result.data as CustomDeviceTypeRow);
}

export async function updateCustomDeviceType(id: string, updates: CustomDeviceTypeUpdate): Promise<CustomDeviceType> {
  const client = ensureSupabase();
  const payload: Record<string, string> = {};

  if (typeof updates.label === 'string') {
    payload.label = updates.label.trim();
  }
  if (typeof updates.icon === 'string') {
    payload.icon = updates.icon.trim() || '🧩';
  }
  if (typeof updates.color === 'string') {
    payload.color = updates.color.trim() || '#6366f1';
  }

  const result = await (client.from('custom_device_types') as any)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return mapRow(result.data as CustomDeviceTypeRow);
}

export async function deleteCustomDeviceType(id: string): Promise<void> {
  const client = ensureSupabase();
  const result = await (client.from('custom_device_types') as any)
    .update({ is_active: false })
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}
