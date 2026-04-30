import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../data';
import { fullName } from '../format';
import {
  courseHandicap,
  divisionFor,
  playingHandicap,
  stablefordHoles,
  stablefordTotal,
  teeRatings,
} from '../scoring/engine';
import { upsertScore } from '../sheets/scoresAdapter';
import { loadSheetsSettings } from '../sheets/settings';
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

  // Compute PH for every player up-front so the dropdown can show it
  // alongside each name (preferred over HI for organisers entering scores).
  const phByPlayer = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of players) {
      const division = divisionFor(p, data.course);
      const tee = division ? data.course.tees[division.tee] : undefined;
      if (!division || !tee) {
        map.set(p.saId, null);
        continue;
      }
      const ratings = teeRatings(tee, data.course.gender);
      const hc = courseHandicap(
        p.hi,
        ratings.slope,
        ratings.cr,
        tee.par,
        data.course.maxHandicap
      );
      map.set(p.saId, playingHandicap(hc, division.handicapPct));
    }
    return map;
  }, [players, data.course]);

  // Look up the player's playing handicap (and division format) so we can show
  // net or stableford points alongside gross.
  const { ph, isStableford } = useMemo(() => {
    if (!player) return { ph: null as number | null, isStableford: false };
    const division = divisionFor(player, data.course);
    if (!division) return { ph: null, isStableford: false };
    const tee = data.course.tees[division.tee];
    if (!tee) return { ph: null, isStableford: (division.format ?? 'medal') === 'stableford' };
    const ratings = teeRatings(tee, data.course.gender);
    const hc = courseHandicap(
      player.hi,
      ratings.slope,
      ratings.cr,
      tee.par,
      data.course.maxHandicap
    );
    return {
      ph: playingHandicap(hc, division.handicapPct),
      isStableford: (division.format ?? 'medal') === 'stableford',
    };
  }, [player, data.course]);

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
  const net = total != null && ph != null ? total - ph : null;
  // Stableford running totals — null until PH is known. Partial rounds count
  // unentered holes as 0 (intentional: gives organisers a live read-out).
  const stbHoles = isStableford ? stablefordHoles(holes, ph, data.course) : null;
  const stablefordPts = isStableford ? stablefordTotal(holes, ph, data.course) : null;
  const front9Pts = stbHoles
    ? stbHoles.slice(0, 9).reduce<number>((a, b) => a + (b ?? 0), 0)
    : null;
  const back9Pts = stbHoles
    ? stbHoles.slice(9).reduce<number>((a, b) => a + (b ?? 0), 0)
    : null;

  // Per-hole par + stroke index (gender-picked) for the score entry grid.
  // Only used when the active division is stableford — handicap strokes are
  // distributed by SI, so seeing both gives organisers the full picture.
  const courseHoles = data.course.holes ?? [];
  const parAt = (i: number) => courseHoles[i]?.par ?? null;
  const siAt = (i: number) => {
    const h = courseHoles[i];
    if (!h) return null;
    return data.course.gender === 'women' ? h.siWomen : h.siMen;
  };

  const onSave = async () => {
    if (!player) return;
    const cfg = loadSheetsSettings();
    if (!cfg) {
      setStatus({
        kind: 'err',
        msg: 'No Sheet configured. Open the Settings dialog to set Sheet ID + Apps Script URL.',
      });
      return;
    }
    const updated: DayScore = { saId: player.saId, day, holes };
    setStatus({ kind: 'busy', msg: 'Saving…' });
    try {
      await upsertScore(cfg, updated);
      setStatus({
        kind: 'ok',
        msg: 'Saved. Spectators see the update on the next refresh (~15 s).',
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
              {players.map((p) => {
                const playerPh = phByPlayer.get(p.saId);
                return (
                  <option key={p.saId} value={p.saId}>
                    {fullName(p)} (PH {playerPh ?? '—'})
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          <div>
            <span className="text-sm font-medium block">Player</span>
            <div className="border rounded px-2 py-2 mt-1 bg-rd-cream/40 text-rd-ink">
              {player ? fullName(player) : '—'}
              {player && (
                <span className="text-rd-ink/60"> · PH {phByPlayer.get(player.saId) ?? '—'}</span>
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
              {HOLE_NUMS.slice(0, 9).map((h) => {
                const i = h - 1;
                return (
                  <div key={h}>
                    <label className="text-xs text-rd-ink/60 block text-center">{h}</label>
                    {isStableford && (
                      <div className="text-[10px] text-rd-ink/50 text-center leading-tight mb-0.5 tabular-nums">
                        <div>Par {parAt(i) ?? '·'}</div>
                        <div>SI {siAt(i) ?? '·'}</div>
                      </div>
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      className="w-full border rounded px-1 py-1.5 text-center text-base tabular-nums"
                      value={holes[i] ?? ''}
                      onChange={(e) => updateHole(i, e.target.value)}
                    />
                    {isStableford && (
                      <div className="text-xs text-center mt-1 tabular-nums text-rd-navy font-semibold">
                        {stbHoles?.[i] ?? '·'} pt
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-right text-sm mb-3 text-rd-ink/70">
              Out: <span className="font-semibold">{front9Sum ?? '—'}</span>
              {isStableford && (
                <>
                  {' · '}Pts:{' '}
                  <span className="font-semibold text-rd-navy">{front9Pts ?? '—'}</span>
                </>
              )}
            </div>
            <div className="grid grid-cols-9 gap-2 mb-3">
              {HOLE_NUMS.slice(9).map((h) => {
                const i = h - 1;
                return (
                  <div key={h}>
                    <label className="text-xs text-rd-ink/60 block text-center">{h}</label>
                    {isStableford && (
                      <div className="text-[10px] text-rd-ink/50 text-center leading-tight mb-0.5 tabular-nums">
                        <div>Par {parAt(i) ?? '·'}</div>
                        <div>SI {siAt(i) ?? '·'}</div>
                      </div>
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      className="w-full border rounded px-1 py-1.5 text-center text-base tabular-nums"
                      value={holes[i] ?? ''}
                      onChange={(e) => updateHole(i, e.target.value)}
                    />
                    {isStableford && (
                      <div className="text-xs text-center mt-1 tabular-nums text-rd-navy font-semibold">
                        {stbHoles?.[i] ?? '·'} pt
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-rd-ink/70">{filledCount}/18 holes entered</span>
              <span className="text-rd-ink/70">
                In: <span className="font-semibold">{back9Sum ?? '—'}</span>
                {isStableford && (
                  <>
                    {' · '}Pts:{' '}
                    <span className="font-semibold text-rd-navy">{back9Pts ?? '—'}</span>
                  </>
                )}
                {' · '}
                Gross: <span className="font-semibold text-rd-navy">{total ?? '—'}</span>
                {' · '}
                PH: <span className="font-semibold">{ph ?? '—'}</span>
                {' · '}
                {isStableford ? (
                  <>
                    Pts: <span className="font-semibold text-rd-navy">{stablefordPts ?? '—'}</span>
                  </>
                ) : (
                  <>
                    Net: <span className="font-semibold text-rd-navy">{net ?? '—'}</span>
                  </>
                )}
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
