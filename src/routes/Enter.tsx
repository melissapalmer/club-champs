import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../data';
import { fullName } from '../format';
import {
  clearGitHubSettings,
  commitFile,
  loadGitHubSettings,
  saveGitHubSettings,
  type GitHubSettings,
} from '../github';
import { serialiseScoresCsv, upsertScore } from '../csv/scores';
import type { DayScore, Player } from '../types';

const HOLE_NUMS = Array.from({ length: 18 }, (_, i) => i + 1);

function emptyHoles(): (number | null)[] {
  return Array(18).fill(null);
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SettingsDialog({
  initial,
  onSave,
  onCancel,
}: {
  initial: GitHubSettings | null;
  onSave: (s: GitHubSettings) => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState(initial?.owner ?? '');
  const [repo, setRepo] = useState(initial?.repo ?? '');
  const [branch, setBranch] = useState(initial?.branch ?? 'main');
  const [pat, setPat] = useState(initial?.pat ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="rd-card p-5 w-full max-w-md">
        <h2 className="text-xl text-rd-navy mb-3">GitHub settings</h2>
        <p className="text-sm text-rd-ink/70 mb-4">
          Used so the entry page can commit <code>data/scores.csv</code> directly.
          Token stays in this browser. Use a <em>fine-grained PAT</em> scoped to
          this repo with <strong>Contents: Read &amp; Write</strong>.
        </p>
        <label className="block mb-3">
          <span className="text-sm font-medium">Owner</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="your-github-username"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Repo</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="club-champs"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Branch</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-medium">Personal Access Token</span>
          <input
            type="password"
            className="w-full border rounded px-2 py-1 mt-1 font-mono text-sm"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="github_pat_..."
          />
        </label>
        <div className="flex justify-between">
          <button
            className="text-sm text-red-700 hover:underline"
            onClick={() => {
              clearGitHubSettings();
              onCancel();
            }}
          >
            Forget token
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
              disabled={!owner || !repo || !pat}
              onClick={() => onSave({ owner, repo, branch: branch || 'main', pat })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Enter({ data }: { data: AppData }) {
  const { players, scores } = data;
  const [saId, setSaId] = useState<string>('');
  const [day, setDay] = useState<1 | 2>(1);
  const [holes, setHoles] = useState<(number | null)[]>(emptyHoles());
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({
    kind: 'idle',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [gh, setGh] = useState<GitHubSettings | null>(loadGitHubSettings());

  const player: Player | undefined = useMemo(
    () => players.find((p) => p.saId === saId),
    [players, saId]
  );

  // Load existing scores into the form whenever the player or day changes.
  useEffect(() => {
    if (!saId) {
      setHoles(emptyHoles());
      return;
    }
    const existing = scores.find((s) => s.saId === saId && s.day === day);
    setHoles(existing ? [...existing.holes] : emptyHoles());
    setStatus({ kind: 'idle' });
  }, [saId, day, scores]);

  const updateHole = (i: number, value: string) => {
    const next = [...holes];
    next[i] = toIntOrNull(value);
    setHoles(next);
  };

  const filledCount = holes.filter((h) => h != null).length;
  const front9 = holes.slice(0, 9);
  const back9 = holes.slice(9);
  const front9Sum = front9.every((h) => h != null) ? (front9 as number[]).reduce((a, b) => a + b, 0) : null;
  const back9Sum = back9.every((h) => h != null) ? (back9 as number[]).reduce((a, b) => a + b, 0) : null;
  const total = front9Sum != null && back9Sum != null ? front9Sum + back9Sum : null;

  const onSave = async () => {
    if (!player) return;
    const updated: DayScore = { saId: player.saId, day, holes };
    const nextScores = upsertScore(scores, updated);
    const csv = serialiseScoresCsv(nextScores);

    if (!gh) {
      downloadCsv('scores.csv', csv);
      setStatus({
        kind: 'ok',
        msg: 'No GitHub token configured. Downloaded scores.csv — commit it manually.',
      });
      return;
    }

    setStatus({ kind: 'busy', msg: 'Committing…' });
    try {
      await commitFile(
        gh,
        'public/data/scores.csv',
        csv,
        `Score: ${fullName(player)} day ${day}`
      );
      setStatus({
        kind: 'ok',
        msg: 'Committed. GitHub Pages will rebuild in ~30s.',
      });
      // Refresh in-memory data so the entry page reflects the new state.
      await data.reload();
    } catch (e) {
      setStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

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

      <div className="rd-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Player</span>
          <select
            className="w-full border rounded px-2 py-2 mt-1"
            value={saId}
            onChange={(e) => setSaId(e.target.value)}
          >
            <option value="">— choose a player —</option>
            {players.map((p) => (
              <option key={p.saId} value={p.saId}>
                {fullName(p)} (HI {p.hi})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Day</span>
          <div className="mt-1 flex gap-2">
            {[1, 2].map((d) => (
              <button
                key={d}
                onClick={() => setDay(d as 1 | 2)}
                className={`flex-1 px-3 py-2 rounded border text-sm font-medium ${
                  day === d
                    ? 'bg-rd-navy text-white border-rd-navy'
                    : 'border-rd-cream'
                }`}
              >
                {d === 1 ? 'Saturday (Day 1)' : 'Sunday (Day 2)'}
              </button>
            ))}
          </div>
        </label>
      </div>

      {!player ? (
        <p className="text-sm text-rd-ink/60">Pick a player to enter scores.</p>
      ) : (
        <>
          <div className="rd-card p-4 mb-4">
            <div className="grid grid-cols-9 gap-2 mb-3">
              {HOLE_NUMS.slice(0, 9).map((h) => (
                <div key={h}>
                  <label className="text-xs text-rd-ink/60 block text-center">{h}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    className="w-full border rounded px-1 py-1.5 text-center text-base tabular-nums"
                    value={holes[h - 1] ?? ''}
                    onChange={(e) => updateHole(h - 1, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="text-right text-sm mb-3 text-rd-ink/70">
              Out: <span className="font-semibold">{front9Sum ?? '—'}</span>
            </div>
            <div className="grid grid-cols-9 gap-2 mb-3">
              {HOLE_NUMS.slice(9).map((h) => (
                <div key={h}>
                  <label className="text-xs text-rd-ink/60 block text-center">{h}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    className="w-full border rounded px-1 py-1.5 text-center text-base tabular-nums"
                    value={holes[h - 1] ?? ''}
                    onChange={(e) => updateHole(h - 1, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-baseline text-sm">
              <span className="text-rd-ink/70">
                {filledCount}/18 holes entered
              </span>
              <span className="text-rd-ink/70">
                In: <span className="font-semibold">{back9Sum ?? '—'}</span>
                {' · '}
                Total: <span className="font-semibold text-rd-navy">{total ?? '—'}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="px-4 py-2 bg-rd-navy text-white rounded font-medium disabled:opacity-50"
              disabled={status.kind === 'busy'}
              onClick={() => void onSave()}
            >
              {status.kind === 'busy' ? 'Saving…' : 'Save'}
            </button>
            {status.msg && (
              <span
                className={`text-sm ${
                  status.kind === 'err'
                    ? 'text-red-700'
                    : status.kind === 'ok'
                      ? 'text-green-700'
                      : 'text-rd-ink/70'
                }`}
              >
                {status.msg}
              </span>
            )}
          </div>
        </>
      )}

      {showSettings && (
        <SettingsDialog
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
