import { useMemo, useState } from 'react';
import { useIsAdmin } from '../admin';
import { GitHubSettingsDialog } from '../components/GitHubSettingsDialog';
import { PlayerEditModal } from '../components/PlayerEditModal';
import { serialisePlayersCsv } from '../csv/players';
import type { AppData } from '../data';
import { fullName } from '../format';
import {
  commitFile,
  loadGitHubSettings,
  saveGitHubSettings,
  type GitHubSettings,
} from '../github';
import { divisionFor } from '../scoring/engine';
import type { Player } from '../types';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Mode = { kind: 'idle' } | { kind: 'add' } | { kind: 'edit'; player: Player };

export function ManagePlayers({ data }: { data: AppData }) {
  const admin = useIsAdmin();
  const { course, players } = data;
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: 'idle' | 'ok' | 'err';
    msg?: string;
  }>({ kind: 'idle' });
  const [gh, setGh] = useState<GitHubSettings | null>(loadGitHubSettings());
  const [showSettings, setShowSettings] = useState(false);

  const sorted = useMemo(
    () =>
      players.slice().sort((a, b) => {
        const la = a.lastName.localeCompare(b.lastName);
        return la !== 0 ? la : a.firstName.localeCompare(b.firstName);
      }),
    [players]
  );

  if (!admin) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
        <p className="text-sm text-rd-ink/70">Manage Players is admin-only.</p>
      </section>
    );
  }

  const commit = async (next: Player[], message: string) => {
    const csv = serialisePlayersCsv(next);
    if (!gh) {
      downloadCsv('players.csv', csv);
      setStatus({
        kind: 'ok',
        msg: 'No GitHub token configured. Downloaded players.csv — commit it manually.',
      });
      return;
    }
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      await commitFile(gh, 'public/data/players.csv', csv, message);
      setStatus({ kind: 'ok', msg: 'Committed. Pages will rebuild in ~30s.' });
      await data.reload();
    } catch (e) {
      setStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const onSavePlayer = async (player: Player) => {
    const isEdit = mode.kind === 'edit';
    const next = isEdit
      ? players.map((p) => (p.saId === player.saId ? player : p))
      : [...players, player];
    setMode({ kind: 'idle' });
    await commit(
      next,
      `${isEdit ? 'Update' : 'Add'} player: ${fullName(player)}`
    );
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const next = players.filter((p) => p.saId !== target.saId);
    setPendingDelete(null);
    await commit(next, `Remove player: ${fullName(target)}`);
  };

  const existingSaIds = new Set(players.map((p) => p.saId));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl text-rd-navy mb-1">Manage Players</h1>
          <p className="text-sm text-rd-ink/60">
            Add, edit, or remove players. Saving commits{' '}
            <code>public/data/players.csv</code> via the configured GitHub token.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            className="text-sm text-rd-navy hover:underline"
            onClick={() => setShowSettings(true)}
          >
            {gh ? 'GitHub: configured' : 'Configure GitHub token'}
          </button>
          <button
            className="px-3 py-1.5 bg-rd-navy text-white rounded text-sm font-medium"
            onClick={() => setMode({ kind: 'add' })}
          >
            + Add player
          </button>
        </div>
      </div>

      {status.msg && (
        <p
          className={`text-sm ${
            status.kind === 'err' ? 'text-red-700' : 'text-green-700'
          }`}
        >
          {status.msg}
        </p>
      )}

      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th>HI</th>
              <th>Division</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-rd-ink/50">
                  No players yet — click <strong>+ Add player</strong> to start.
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                const division = divisionFor(p, course);
                return (
                  <tr key={p.saId}>
                    <td>{fullName(p)}</td>
                    <td className="text-rd-ink/60 tabular-nums">{p.saId}</td>
                    <td className="tabular-nums">{p.hi}</td>
                    <td>
                      {division?.name ?? '—'}
                      {p.divisionOverride && (
                        <span className="ml-1 text-xs text-rd-gold">(override)</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="text-sm text-rd-navy hover:underline mr-3 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setMode({ kind: 'edit', player: p })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-red-700 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setPendingDelete(p)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(mode.kind === 'add' || mode.kind === 'edit') && (
        <PlayerEditModal
          initial={mode.kind === 'edit' ? mode.player : null}
          existingSaIds={existingSaIds}
          busy={busy}
          onSave={onSavePlayer}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="rd-card p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl text-rd-navy mb-2">Remove player</h2>
            <p className="text-sm text-rd-ink/70 mb-2">
              Remove <strong>{fullName(pendingDelete)}</strong> from the roster?
            </p>
            <p className="text-xs text-rd-ink/50 mb-4">
              Any scores already entered for this player stay in{' '}
              <code>scores.csv</code> (harmless — they just won't appear on the
              leaderboard).
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded border border-rd-cream"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-red-700 text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void onConfirmDelete()}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

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
