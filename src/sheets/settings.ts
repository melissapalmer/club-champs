const STORAGE_KEY = 'rd-cc-sheets';

export type SheetsSettings = {
  /** Google Sheet ID (the long string from the sheet URL). */
  sheetId: string;
  /** Apps Script web-app URL (ends with /exec). */
  scriptUrl: string;
  /** Shared secret stored in the Apps Script and required on every write. */
  secret: string;
};

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

export function saveSheetsSettings(s: SheetsSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSheetsSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
