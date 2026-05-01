/**
 * Read/write a single Google Sheet:
 *   - Reads use the public `gviz/tq?tqx=out:csv` endpoint per tab. CORS-friendly.
 *   - Writes go to a deployed Apps Script web app (see apps-script/Code.gs).
 *     POSTs use Content-Type: text/plain to avoid the CORS preflight that
 *     application/json would trigger; Apps Script web apps don't handle
 *     OPTIONS correctly.
 */

export type SheetsConfig = {
  sheetId: string;
  scriptUrl: string;
  secret: string;
};

/**
 * Build the public CSV URL for one tab. The `headers=1` parameter is
 * essential: without it, gviz tries to auto-detect how many leading
 * string-only rows form the header and frequently merges several rows
 * (e.g. our key/value rows up to the first numeric value) into a single
 * "header", leaving real data rows missing from the parsed output.
 * Forcing headers=1 makes row 1 the header and row 2+ the data.
 */
export function csvUrl(sheetId: string, tab: string): string {
  return (
    'https://docs.google.com/spreadsheets/d/' +
    encodeURIComponent(sheetId) +
    '/gviz/tq?tqx=out:csv&headers=1&sheet=' +
    encodeURIComponent(tab)
  );
}

/** Fetch one tab's contents as CSV text. Throws on non-2xx. */
export async function fetchTab(sheetId: string, tab: string): Promise<string> {
  const res = await fetch(csvUrl(sheetId, tab), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load Sheet tab "${tab}": ${res.status}`);
  }
  // Sheets returns text/csv; charset utf-8 — straightforward.
  return res.text();
}

export type ActionName =
  | 'upsertScore'
  | 'upsertPlayer'
  | 'removePlayer'
  | 'saveCourse'
  | 'saveTeeTimes'
  | 'saveMatches'
  | 'clearMatches';

export type Action = {
  action: ActionName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
};

/** Send a write action to the Apps Script. Throws if the script returns ok:false. */
export async function postAction(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  action: Action
): Promise<unknown> {
  const body = JSON.stringify({
    secret: cfg.secret,
    action: action.action,
    payload: action.payload,
  });
  const res = await fetch(cfg.scriptUrl, {
    method: 'POST',
    // text/plain to dodge the CORS preflight; Apps Script reads e.postData.contents anyway.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Apps Script POST failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { ok: boolean; error?: string; result?: unknown };
  if (!json.ok) {
    throw new Error(json.error ?? 'Apps Script returned ok=false');
  }
  return json.result;
}
