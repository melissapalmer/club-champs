import { useEffect, useMemo, useState } from 'react';
import { serialiseScoresCsv, upsertScore } from '../csv/scores';
import type { AppData } from '../data';
import { fullName } from '../format';
import { commitFile, loadGitHubSettings } from '../github';
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

export function ScoreEntryPanel({
  data,
  lockedSaId,
  initialSaId,
  initialDay = 1,
  onSaved,
}: {
  data: AppData;
  /** When set, the player is fixed (no dropdown). Used by the modal flow. */
  lockedSaId?: string;
  /** When set (and lockedSaId is not), the dropdown starts on this player. */
  initialSaId?: string;
  initialDay?: 1 | 2;
  /** Called after a successful save (commit OR download). */
  onSaved?: () => void;
}) {
  const { players, scores } = data;

  const [saId, setSaId] = useState<string>(lockedSaId ?? initialSaId ?? '');
  const [day, setDay] = useState<1 | 2>(initialDay);
  const [holes, setHoles] = useState<(number | null)[]>(emptyHoles());
  const [status, setStatus] = useState<{
    kind: 'idle' | 'busy' | 'ok' | 'err';
    msg?: string;
  }>({ kind: 'idle' });

  // Stay in sync with the parent's locked or initial player selection.
  useEffect(() => {
    if (lockedSaId !== undefined) {
      setSaId(lockedSaId);
    } else if (initialSaId && !saId) {
      setSaId(initialSaId);
    }
  }, [lockedSaId, initialSaId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const front9Sum = front9.every((h) => h != null)
    ? (front9 as number[]).reduce((a, b) => a + b, 0)
    : null;
  const back9Sum = back9.every((h) => h != null)
    ? (back9 as number[]).reduce((a, b) => a + b, 0)
    : null;
  const total = front9Sum != null && back9Sum != null ? front9Sum + back9Sum : null;

  const onSave = async () => {
    if (!player) return;
    const updated: DayScore = { saId: player.saId, day, holes };
    const nextScores = upsertScore(scores, updated);
    const csv = serialiseScoresCsv(nextScores);

    const gh = loadGitHubSettings();
    if (!gh) {
      downloadCsv('scores.csv', csv);
      setStatus({
        kind: 'ok',
        msg: 'No GitHub token configured. Downloaded scores.csv — commit it manually.',
      });
      onSaved?.();
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
      await data.reload();
      onSaved?.();
    } catch (e) {
      setStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {!lockedSaId ? (
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
        ) : (
          <div>
            <span className="text-sm font-medium block">Player</span>
            <div className="border rounded px-2 py-2 mt-1 bg-rd-cream/40 text-rd-ink">
              {player ? fullName(player) : '—'}
              {player && (
                <span className="text-rd-ink/60"> · HI {player.hi}</span>
              )}
            </div>
          </div>
        )}
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
              <span className="text-rd-ink/70">{filledCount}/18 holes entered</span>
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
    </div>
  );
}
