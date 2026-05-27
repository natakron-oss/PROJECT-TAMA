type CreateSchemaArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
};

type ListSchemasArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
};

type GetHeadersArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
  sheetName: string;
};

type AppendRowArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
  sheetName: string;
  data: Record<string, string>;
};

type FindRowArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
  sheetName: string;
  where: { LOCATION: string; LAT: string; LON: string };
};

type DeleteRowArgs = {
  appsScriptUrl: string;
  token?: string;
  spreadsheetId: string;
  sheetName: string;
  where: { LOCATION: string; LAT: string; LON: string };
};

declare global {
  interface Window {
    __projectPrutaJsonpCallbacks?: Record<string, (payload: any) => void>;
  }
}

function buildUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function safeUrlForLog(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return url.origin + url.pathname;
  } catch {
    return baseUrl;
  }
}

async function jsonpRequest<TPayload>(args: {
  appsScriptUrl: string;
  params: Record<string, string>;
  timeoutMs?: number;
  log: { action: string; meta?: Record<string, unknown> };
}): Promise<TPayload> {
  const callbackKey = `cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  window.__projectPrutaJsonpCallbacks ??= {};

  const safeUrl = safeUrlForLog(args.appsScriptUrl);
  const url = buildUrl(args.appsScriptUrl, {
    ...args.params,
    callback: `__projectPrutaJsonpCallbacks.${callbackKey}`,
  });

  console.debug('[googleSheetsSchema] request:start', {
    appsScriptUrl: safeUrl,
    callbackKey,
    action: args.log.action,
    ...(args.log.meta ?? {}),
  });

  const payload = await new Promise<TPayload>((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      console.error('[googleSheetsSchema] request:timeout', {
        callbackKey,
        action: args.log.action,
      });
      delete window.__projectPrutaJsonpCallbacks?.[callbackKey];
      reject(new Error('Request timed out'));
    }, args.timeoutMs ?? 20000);

    window.__projectPrutaJsonpCallbacks![callbackKey] = (data: any) => {
      window.clearTimeout(timerId);
      delete window.__projectPrutaJsonpCallbacks?.[callbackKey];
      console.debug('[googleSheetsSchema] request:callback', {
        callbackKey,
        action: args.log.action,
        ok: Boolean(data?.ok),
        hasError: Boolean(data?.error),
      });
      resolve(data as TPayload);
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.onload = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    script.onerror = () => {
      window.clearTimeout(timerId);
      delete window.__projectPrutaJsonpCallbacks?.[callbackKey];
      if (script.parentNode) script.parentNode.removeChild(script);
      console.error('[googleSheetsSchema] request:script_error', {
        callbackKey,
        action: args.log.action,
        appsScriptUrl: safeUrl,
      });
      reject(new Error('Failed to load Apps Script response'));
    };

    document.body.appendChild(script);
  });

  return payload;
}

export async function createOrUpdateSchemaSheet(args: CreateSchemaArgs): Promise<void> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string }>({
    appsScriptUrl: args.appsScriptUrl,
    params: {
      action: 'createSchema',
      token: args.token ?? '',
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      headers: JSON.stringify(args.headers),
    },
    log: {
      action: 'createSchema',
      meta: {
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        headerCount: args.headers.length,
        hasToken: Boolean(args.token),
      },
    },
  });

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  console.debug('[googleSheetsSchema] request:success', {
    spreadsheetId: args.spreadsheetId,
    sheetName: args.sheetName,
  });
}

export async function listSchemaSheets(args: ListSchemasArgs): Promise<string[]> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string; sheets?: unknown }>({
    appsScriptUrl: args.appsScriptUrl,
    params: {
      action: 'listSchemas',
      token: args.token ?? '',
      spreadsheetId: args.spreadsheetId,
    },
    log: {
      action: 'listSchemas',
      meta: {
        spreadsheetId: args.spreadsheetId,
        hasToken: Boolean(args.token),
      },
    },
  });

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  if (!Array.isArray(payload.sheets)) {
    return [];
  }

  return payload.sheets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function getSchemaHeaders(args: GetHeadersArgs): Promise<string[]> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string; headers?: unknown }>({
    appsScriptUrl: args.appsScriptUrl,
    params: {
      action: 'getHeaders',
      token: args.token ?? '',
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
    },
    log: {
      action: 'getHeaders',
      meta: {
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        hasToken: Boolean(args.token),
      },
    },
  });

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  if (!Array.isArray(payload.headers)) {
    return [];
  }

  return payload.headers.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function appendSchemaRow(args: AppendRowArgs): Promise<{ rowNumber: number }> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string; rowNumber?: unknown }>(
    {
      appsScriptUrl: args.appsScriptUrl,
      params: {
        action: 'appendRow',
        token: args.token ?? '',
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        data: JSON.stringify(args.data ?? {}),
      },
      log: {
        action: 'appendRow',
        meta: {
          spreadsheetId: args.spreadsheetId,
          sheetName: args.sheetName,
          hasToken: Boolean(args.token),
          keyCount: Object.keys(args.data ?? {}).length,
        },
      },
    },
  );

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  const rowNumber = typeof payload.rowNumber === 'number' ? payload.rowNumber : Number(payload.rowNumber);
  return { rowNumber: Number.isFinite(rowNumber) ? rowNumber : 0 };
}

export async function findSchemaRow(args: FindRowArgs): Promise<{ found: boolean; rowNumber?: number; data?: Record<string, string> }> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string; found?: unknown; rowNumber?: unknown; data?: unknown }>({
    appsScriptUrl: args.appsScriptUrl,
    params: {
      action: 'findRow',
      token: args.token ?? '',
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      where: JSON.stringify(args.where ?? {}),
    },
    log: {
      action: 'findRow',
      meta: {
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        hasToken: Boolean(args.token),
      },
    },
  });

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  const found = Boolean(payload.found);
  const rowNumber = typeof payload.rowNumber === 'number' ? payload.rowNumber : Number(payload.rowNumber);
  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? (payload.data as Record<string, string>)
    : undefined;

  return {
    found,
    rowNumber: Number.isFinite(rowNumber) ? rowNumber : undefined,
    data,
  };
}

export async function deleteSchemaRow(args: DeleteRowArgs): Promise<{ deleted: boolean; rowNumber?: number }> {
  const safeUrl = safeUrlForLog(args.appsScriptUrl);

  const payload = await jsonpRequest<{ ok: boolean; error?: string; deleted?: unknown; rowNumber?: unknown }>(
    {
      appsScriptUrl: args.appsScriptUrl,
      params: {
        action: 'deleteRow',
        token: args.token ?? '',
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        where: JSON.stringify(args.where ?? {}),
      },
      log: {
        action: 'deleteRow',
        meta: {
          spreadsheetId: args.spreadsheetId,
          sheetName: args.sheetName,
          hasToken: Boolean(args.token),
        },
      },
    },
  );

  if (!payload.ok) {
    console.error('[googleSheetsSchema] request:failed', {
      appsScriptUrl: safeUrl,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      error: payload.error || 'Apps Script error',
    });
    throw new Error(payload.error || 'Apps Script error');
  }

  const deleted = Boolean(payload.deleted);
  const rowNumber = typeof payload.rowNumber === 'number' ? payload.rowNumber : Number(payload.rowNumber);

  return {
    deleted,
    rowNumber: Number.isFinite(rowNumber) ? rowNumber : undefined,
  };
}
