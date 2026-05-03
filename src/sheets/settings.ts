const STORAGE_KEY = 'rd-cc-sheets';

/**
 * Production Sheet ID baked into the build so spectators see live scores
 * without any per-browser setup. Reads only — the Sheet is shared "Anyone
 * with the link → Viewer" so this ID is not a secret (anyone watching the
 * gviz network call can read it anyway).
 *
 * Admins still need to configure their Apps Script URL + secret in the
 * Settings dialog before they can WRITE (those genuinely are sensitive).
 *
 * To point a different deployment at a different Sheet, change this constant.
 * Per-browser overrides via the Settings dialog still take precedence.
 */
export const DEFAULT_SHEET_ID = '1yBRZBkMm4QW86uS968aZDGFVEcDx4wgdusKZ6kye-5A';

/**
 * Production deployment URL with trailing slash. Used when admin is on
 * localhost AND not running `npm run dev` (i.e. a real prod-build hosted
 * locally). Phones can't reach localhost so the QR codes have to encode
 * something they can actually open.
 */
export const DEFAULT_SITE_BASE_URL = 'https://melissapalmer.github.io/club-champs/';

/**
 * LAN URL used during `npm run dev` when admin's browser is parked on
 * `localhost:5173` but their phone needs a reachable host. Set to the
 * laptop's LAN IP + Vite port. Only applied when `import.meta.env.DEV`
 * is true, so it never leaks into a production build.
 *
 * Update when the laptop's IP changes (or just navigate to the IP in
 * the browser instead — `siteBaseUrl()` uses the current origin when it's
 * not localhost).
 */
export const DEV_BASE_URL_OVERRIDE = 'http://10.0.0.7:5173/';

/**
 * Production Apps Script /exec URL baked into the build so the token-gated
 * entry channels (per-player magic link, per-group QR, tent URL) work on
 * any visitor's browser without per-device setup.
 *
 * Why baking is OK: the new entry channels gate each write on a per-player
 * token, per-group token, or tent token verified server-side — without one
 * of those, knowing the scriptUrl alone gets you nothing. Admin actions
 * (upsertPlayer, saveCourse, etc.) still require the SHARED_SECRET that
 * lives only in admin localStorage.
 *
 * IMPORTANT: this URL is stable only if you redeploy via
 *   Apps Script → Manage deployments → ✏️ edit existing → Version: New version
 * Creating a *new* deployment instead generates a fresh /exec URL and the
 * baked default goes stale (you'd need to update this constant + rebuild).
 *
 * Leave empty in dev / forks to disable the public entry flow.
 */
export const DEFAULT_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbykGOrLGoxSzZPg4LNJN6w07iisSzcb3wXYwtz7OD77BPituZDseggFQJ70Vbjr9txWWw/exec';

export type SheetsSettings = {
  /** Google Sheet ID (the long string from the sheet URL). */
  sheetId: string;
  /** Apps Script web-app URL (ends with /exec). */
  scriptUrl: string;
  /** Shared secret stored in the Apps Script and required on every write. */
  secret: string;
};

/**
 * Strict loader for WRITE flows: returns null unless all three pieces are
 * present. Apps Script URL and secret are admin-only and have no defaults.
 */
export function loadSheetsSettings(): SheetsSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SheetsSettings>;
    if (!parsed.sheetId || !parsed.scriptUrl || !parsed.secret) return null;
    return {
      sheetId: parsed.sheetId,
      scriptUrl: parsed.scriptUrl,
      secret: parsed.secret,
    };
  } catch {
    return null;
  }
}

/**
 * Loose loader for READ flows: returns a usable Sheet ID even when the
 * visitor has no localStorage configured. Order:
 *   1. localStorage.sheetId (so admins can override the default for testing)
 *   2. DEFAULT_SHEET_ID baked into the build
 */
export function loadSheetIdForReads(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SheetsSettings>;
      if (parsed.sheetId) return parsed.sheetId;
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_SHEET_ID;
}

/**
 * Loose loader for token-gated SUBMIT flows (magic link / group QR / tent URL).
 * Returns the scriptUrl any visitor can use to call `submitScore` /
 * `submitScoreGroup`, regardless of whether they're configured as admin.
 *
 * Order:
 *   1. localStorage.scriptUrl (admin override, e.g. for testing a
 *      different deployment)
 *   2. DEFAULT_SCRIPT_URL baked into the build
 * Returns "" when neither is set — the entry pages show a not-configured
 * message in that case.
 */
export function loadSubmitScriptUrl(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SheetsSettings>;
      if (parsed.scriptUrl) return parsed.scriptUrl;
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_SCRIPT_URL;
}

export function saveSheetsSettings(s: SheetsSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSheetsSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
