import { useState } from 'react';
import {
  clearSheetsSettings,
  saveSheetsSettings,
  type SheetsSettings,
} from '../sheets/settings';

const CHANGE_EVENT = 'rd-sheets-change';

export function SheetSettingsDialog({
  initial,
  onSaved,
  onCancel,
}: {
  initial: SheetsSettings | null;
  onSaved: (s: SheetsSettings) => void;
  onCancel: () => void;
}) {
  const [sheetId, setSheetId] = useState(initial?.sheetId ?? '');
  const [scriptUrl, setScriptUrl] = useState(initial?.scriptUrl ?? '');
  const [secret, setSecret] = useState(initial?.secret ?? '');

  const submit = () => {
    const next: SheetsSettings = { sheetId, scriptUrl, secret };
    saveSheetsSettings(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    onSaved(next);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="rd-card p-5 w-full max-w-md">
        <h2 className="text-xl text-rd-navy mb-3">Google Sheet settings</h2>
        <p className="text-sm text-rd-ink/70 mb-4">
          Tell the site which Sheet to read from and which Apps Script web app
          to post writes to. All three values stay in this browser — they're
          never sent anywhere else from this site.
        </p>
        <label className="block mb-3">
          <span className="text-sm font-medium">Sheet ID</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1 font-mono text-sm"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="1abcDEF...XYZ"
          />
          <span className="text-[11px] text-rd-ink/50">
            The long string in the Sheet's URL between <code>/d/</code> and{' '}
            <code>/edit</code>.
          </span>
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Apps Script web-app URL</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1 font-mono text-sm"
            value={scriptUrl}
            onChange={(e) => setScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfy.../exec"
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-medium">Shared secret</span>
          <input
            type="password"
            className="w-full border rounded px-2 py-1 mt-1 font-mono text-sm"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="must match SHARED_SECRET in your Apps Script"
          />
        </label>
        <div className="flex justify-between">
          <button
            className="text-sm text-red-700 hover:underline"
            onClick={() => {
              clearSheetsSettings();
              window.dispatchEvent(new Event(CHANGE_EVENT));
              onCancel();
            }}
          >
            Forget settings
          </button>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded border border-rd-cream"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded bg-rd-navy text-white disabled:opacity-50"
              disabled={!sheetId || !scriptUrl || !secret}
              onClick={submit}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
