import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsAdmin } from '../admin';
import { ScoreEntryPanel } from '../components/ScoreEntryPanel';
import { SheetSettingsDialog } from '../components/SheetSettingsDialog';
import type { AppData } from '../data';
import { fullName } from '../format';
import { loadSheetsSettings, type SheetsSettings } from '../sheets/settings';

export function Enter({ data }: { data: AppData }) {
  const [params] = useSearchParams();
  const admin = useIsAdmin();
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<SheetsSettings | null>(loadSheetsSettings());

  const saIdParam = params.get('saId') ?? '';
  const tokenParam = params.get('t') ?? '';
  const tokenPlayer = tokenParam && saIdParam
    ? data.players.find((p) => p.saId === saIdParam)
    : undefined;

  // Player magic-link flow: ?saId=X&t=TOKEN — render the form locked to this
  // player. Token validation happens server-side on save; the worst a bad
  // token can do here is render the form, only to fail on Save.
  if (tokenPlayer && !admin) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-1">Score Entry</h1>
        <p className="text-sm text-rd-ink/70 mb-4">
          Entering scores for <strong>{fullName(tokenPlayer)}</strong>. Save
          the front 9 when you make the turn, then the back 9 when you finish.
        </p>
        <ScoreEntryPanel
          data={data}
          lockedSaId={tokenPlayer.saId}
          submitToken={tokenParam}
        />
      </section>
    );
  }

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

      <ScoreEntryPanel data={data} initialSaId={saIdParam} />

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
