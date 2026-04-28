import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsAdmin } from '../admin';
import { ScoreEntryPanel } from '../components/ScoreEntryPanel';
import { SheetSettingsDialog } from '../components/SheetSettingsDialog';
import type { AppData } from '../data';
import { loadSheetsSettings, type SheetsSettings } from '../sheets/settings';

export function Enter({ data }: { data: AppData }) {
  const [params] = useSearchParams();
  const admin = useIsAdmin();
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<SheetsSettings | null>(loadSheetsSettings());

  if (!admin) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
        <p className="text-sm text-rd-ink/70">
          This page isn’t reachable without an access key.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl text-rd-navy">Score Entry</h1>
        <button
          className="text-sm text-rd-navy hover:underline"
          onClick={() => setShowSettings(true)}
        >
          {cfg ? 'Sheet: configured' : 'Configure Google Sheet'}
        </button>
      </div>

      <ScoreEntryPanel data={data} initialSaId={params.get('saId') ?? ''} />

      {showSettings && (
        <SheetSettingsDialog
          initial={cfg}
          onSaved={(s) => {
            setCfg(s);
            setShowSettings(false);
          }}
          onCancel={() => {
            setCfg(loadSheetsSettings());
            setShowSettings(false);
          }}
        />
      )}
    </section>
  );
}
