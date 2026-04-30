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

export function saveSheetsSettings(s: SheetsSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSheetsSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
