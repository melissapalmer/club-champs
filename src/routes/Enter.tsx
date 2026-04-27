import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ACCESS_KEY, setAdmin, useIsAdmin } from '../admin';
import { GitHubSettingsDialog } from '../components/GitHubSettingsDialog';
import { ScoreEntryPanel } from '../components/ScoreEntryPanel';
import type { AppData } from '../data';
import {
  loadGitHubSettings,
  saveGitHubSettings,
  type GitHubSettings,
} from '../github';

export function Enter({ data }: { data: AppData }) {
  const [params] = useSearchParams();
  const admin = useIsAdmin();
  const [showSettings, setShowSettings] = useState(false);
  const [gh, setGh] = useState<GitHubSettings | null>(loadGitHubSettings());

  // If a fresh ?key=… arrives, store it and re-render with admin true.
  useEffect(() => {
    if (params.get('key') === ACCESS_KEY) {
      setAdmin(true);
    }
  }, [params]);

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
          {gh ? 'GitHub: configured' : 'Configure GitHub token'}
        </button>
      </div>

      <ScoreEntryPanel data={data} initialSaId={params.get('saId') ?? ''} />

      {showSettings && (
        <GitHubSettingsDialog
          initial={gh}
          onSave={(s) => {
            saveGitHubSettings(s);
            setGh(s);
            setShowSettings(false);
          }}
          onCancel={() => {
            setGh(loadGitHubSettings());
            setShowSettings(false);
          }}
        />
      )}
    </section>
  );
}
