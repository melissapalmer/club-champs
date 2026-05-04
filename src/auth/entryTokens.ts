import { postAction, type SheetsConfig } from '../sheets/api';
import { DEFAULT_SITE_BASE_URL, DEV_BASE_URL_OVERRIDE } from '../sheets/settings';

/**
 * Shape returned by the Apps Script `getEntryUrls` action — pre-built URLs
 * for the admin Config sub-tab to print / copy. Group tokens are computed
 * server-side from (day, time, SHARED_SECRET); per-player tokens are the
 * stored `entryToken` cell.
 */
export type EntryUrls = {
  players: { saId: string; name: string; url: string }[];
  groups: { day: number; time: string; names: string[]; url: string }[];
  tentUrl: string;
};

/**
 * The base URL Apps Script bakes into QR / magic-link URLs. Strategy:
 *
 *   1. If admin is on localhost AND we're in `npm run dev`, prefer the LAN
 *      override (e.g. http://10.0.0.7:5173/) so phones on the same Wi-Fi
 *      can reach the dev server. Configured in settings.ts.
 *   2. Otherwise if admin is on localhost (e.g. previewing a prod build
 *      locally), fall back to the baked production URL.
 *   3. Otherwise use the current origin — covers both real prod and the
 *      "I'm already browsing via the LAN IP" case.
 */
export function siteBaseUrl(): string {
  const { protocol, host, pathname } = window.location;
  const isLocalhost =
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:');
  if (isLocalhost) {
    if (import.meta.env.DEV && DEV_BASE_URL_OVERRIDE) return DEV_BASE_URL_OVERRIDE;
    if (DEFAULT_SITE_BASE_URL) return DEFAULT_SITE_BASE_URL;
  }
  const path = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/');
  return `${protocol}//${host}${path}`;
}

export async function regenerateEntryTokens(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>
): Promise<{ updated: number }> {
  return (await postAction(cfg, {
    action: 'regenerateEntryTokens',
    payload: {},
  })) as { updated: number };
}

export async function rotateTentToken(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>
): Promise<{ tentToken: string }> {
  return (await postAction(cfg, {
    action: 'rotateTentToken',
    payload: {},
  })) as { tentToken: string };
}

export async function getEntryUrls(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  baseUrl: string
): Promise<EntryUrls> {
  return (await postAction(cfg, {
    action: 'getEntryUrls',
    payload: { baseUrl },
  })) as EntryUrls;
}
