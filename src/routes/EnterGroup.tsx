import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppData } from '../data';
import { fullName } from '../format';
import {
  courseHandicap,
  divisionFor,
  playingHandicap,
  stablefordHoles,
  teeRatings,
} from '../scoring/engine';
import { submitScoreGroup } from '../sheets/scoresAdapter';
import { loadSubmitScriptUrl } from '../sheets/settings';
import type { DayScore, Player } from '../types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; msg: string }
  | { kind: 'ok'; msg: string }
  | { kind: 'err'; msg: string };

function emptyHoles(): (number | null)[] {
  return Array(18).fill(null);
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Coerce time strings to canonical "HH:mm" so we can compare a URL param
 * (always "HH:mm" — emitted by the Apps Script `formatTime_` helper) against
 * the gviz-CSV value in `data.teeTimes[].time`, which can come back as
 * "08:07", "8:07 AM", "08:07:00", etc. depending on the Sheet's cell format.
 */
function normaliseTime(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const mins = m[2];
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mins}`;
}

function sumOrDash(holes: (number | null)[], from: number, to: number): number | null {
  const slice = holes.slice(from, to);
  if (slice.every((h) => h != null)) {
    return (slice as number[]).reduce((a, b) => a + b, 0);
  }
  return null;
}

export function EnterGroup({ data }: { data: AppData }) {
  const [params] = useSearchParams();
  const dayParam = parseInt(params.get('day') || '0', 10);
  const day: 1 | 2 = dayParam === 2 ? 2 : 1;
  const time = (params.get('time') || '').trim();
  const token = (params.get('t') || '').trim();

  const groupPlayers = useMemo<Player[]>(() => {
    if (!time) return [];
    const want = normaliseTime(time);
    const ids = data.teeTimes
      .filter((t) => t.day === day && normaliseTime(t.time) === want)
      .map((t) => t.saId);
    return ids
      .map((id) => data.players.find((p) => p.saId === id))
      .filter((p): p is Player => !!p);
  }, [data.teeTimes, data.players, day, time]);

  const [holesByPlayer, setHolesByPlayer] = useState<Record<string, (number | null)[]>>({});
  const [holeIdx, setHoleIdx] = useState(0);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [done, setDone] = useState(false);

  // Track which players we've already initialised from `data.scores`, so the
  // periodic AppData reload (which fires after every save) doesn't clobber
  // the marker's in-flight edits with the just-written-back values from the
  // sheet. First time we see a player → seed from the sheet; after that, the
  // wizard's local state is the source of truth.
  const initialised = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (groupPlayers.length === 0) return;
    setHolesByPlayer((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of groupPlayers) {
        if (initialised.current.has(p.saId)) continue;
        const existing = data.scores.find(
          (s) => s.saId === p.saId && s.day === day
        );
        next[p.saId] = existing ? [...existing.holes] : emptyHoles();
        initialised.current.add(p.saId);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [groupPlayers, data.scores, day]);

  // Hole layout (par + SI) for the active hole header.
  const hole = data.course.holes?.[holeIdx];
  const par = hole?.par ?? null;
  const si = hole ? (data.course.gender === 'women' ? hole.siWomen : hole.siMen) : null;

  // PH per player so stableford divisions can show points-per-hole as the
  // marker types — same logic as the admin panel.
  const phByPlayer = useMemo(() => {
    const map = new Map<string, { ph: number | null; isStableford: boolean }>();
    for (const p of groupPlayers) {
      const division = divisionFor(p, data.course);
      if (!division) {
        map.set(p.saId, { ph: null, isStableford: false });
        continue;
      }
      const tee = data.course.tees[division.tee];
      const isStableford = (division.format ?? 'medal') === 'stableford';
      if (!tee) {
        map.set(p.saId, { ph: null, isStableford });
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
      map.set(p.saId, {
        ph: playingHandicap(hc, division.handicapPct),
        isStableford,
      });
    }
    return map;
  }, [groupPlayers, data.course]);

  // ----- Validations / empty states ------------------------------------

  if (!token) {
    return (
      <NotAvailable msg="This link is missing its token. Ask the organiser for the QR." />
    );
  }
  if (!time) {
    return <NotAvailable msg="This link is missing its tee time. Ask the organiser." />;
  }
  if (groupPlayers.length === 0) {
    return (
      <NotAvailable
        msg={`No players found for Day ${day} at ${time}. The draw may have changed — ask the organiser for an updated QR.`}
      />
    );
  }

  // ----- Handlers ------------------------------------------------------

  const setHole = (saId: string, idx: number, val: string) => {
    setHolesByPlayer((prev) => ({
      ...prev,
      [saId]: prev[saId].map((h, i) => (i === idx ? toIntOrNull(val) : h)),
    }));
  };

  /**
   * Save the *full* current state for all 4 players. Safe to call after every
   * hole because the wizard's state was seeded from the existing sheet row
   * on mount — so untouched holes carry their previous value through, not
   * blank. Range='all' overwrites all 18 columns with that merged state.
   *
   * `successMsg` is shown to the marker on success — pass "Saved hole 5" /
   * "Round saved." etc. so they know which save just landed.
   */
  const saveAll = async (successMsg: string): Promise<boolean> => {
    const scriptUrl = loadSubmitScriptUrl();
    if (!scriptUrl) {
      setStatus({
        kind: 'err',
        msg: 'This site isn’t configured for player score entry. Ask the organiser.',
      });
      return false;
    }
    setStatus({ kind: 'busy', msg: 'Saving…' });
    try {
      const scores: DayScore[] = groupPlayers.map((p) => ({
        saId: p.saId,
        day,
        holes: holesByPlayer[p.saId] ?? emptyHoles(),
      }));
      // Server derives the group token from the same HH:mm canonical form
      // it used at QR-print time, so we must normalise here too.
      await submitScoreGroup(
        scriptUrl,
        token,
        { day, time: normaliseTime(time) },
        scores,
        'all'
      );
      setStatus({ kind: 'ok', msg: successMsg });
      void data.reload();
      return true;
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  const goSaveNow = async () => {
    // Manual save — don't advance, just commit current state. The message
    // names the hole the marker is currently on, since that's almost
    // certainly the one they just typed.
    await saveAll(`Saved through hole ${holeIdx + 1}.`);
  };

  const goNext = async () => {
    // Save what's been entered so far before advancing — protects against
    // mid-round signal drops. If the save fails, we still advance so the
    // marker isn't blocked, and the red error stays visible until the next
    // successful save.
    const leavingHole = holeIdx + 1;
    void saveAll(`Saved hole ${leavingHole}.`);
    if (holeIdx < 17) setHoleIdx(holeIdx + 1);
  };

  const goFinish = async () => {
    const ok = await saveAll('Round saved.');
    if (ok) setDone(true);
  };

  const goPrev = () => {
    if (holeIdx > 0) {
      setHoleIdx(holeIdx - 1);
    }
  };

  // ----- Done screen ---------------------------------------------------

  if (done && status.kind !== 'err') {
    return (
      <section className="text-center py-8">
        <h1 className="text-2xl text-rd-navy mb-3">Round saved</h1>
        <p className="text-sm text-rd-ink/70 mb-4">
          Thanks. Spectators see the update on the next refresh (~15 s).
        </p>
        <button
          className="px-3 py-1.5 text-sm rounded border border-rd-navy/30 text-rd-navy"
          onClick={() => {
            setDone(false);
            setHoleIdx(0);
          }}
        >
          Back to scorecard
        </button>
      </section>
    );
  }

  // ----- Active hole ---------------------------------------------------

  const isHoleOne = holeIdx === 0;
  const isHole18 = holeIdx === 17;

  return (
    <section>
      <h1 className="text-xl text-rd-navy mb-1">
        Day {day} · {time}
      </h1>
      <p className="text-sm text-rd-ink/60 mb-3">
        Tap each player&apos;s score for hole {holeIdx + 1}. Saves automatically
        after every hole — Finish when you&apos;re done with the back 9.
      </p>

      <HoleStepper holeIdx={holeIdx} onJump={(i) => setHoleIdx(i)} />

      <div className="rd-card p-4 mb-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg text-rd-navy font-semibold">Hole {holeIdx + 1}</h2>
          <span className="text-xs text-rd-ink/60 tabular-nums">
            {par != null && <>Par {par}</>}
            {si != null && <> · SI {si}</>}
          </span>
        </div>

        <ul className="divide-y divide-rd-cream">
          {groupPlayers.map((p) => {
            const meta = phByPlayer.get(p.saId);
            const stb = meta?.isStableford
              ? stablefordHoles(holesByPlayer[p.saId] ?? emptyHoles(), meta.ph, data.course)
              : null;
            return (
              <li key={p.saId} className="flex items-center gap-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-rd-ink truncate">
                    {fullName(p)}
                  </span>
                  {meta?.ph != null && (
                    <span className="block text-[11px] text-rd-ink/50">PH {meta.ph}</span>
                  )}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  className="w-20 border rounded px-2 py-2 text-center text-lg tabular-nums"
                  value={holesByPlayer[p.saId]?.[holeIdx] ?? ''}
                  onChange={(e) => setHole(p.saId, holeIdx, e.target.value)}
                />
                {meta?.isStableford && stb && (
                  <span className="w-10 text-xs text-rd-navy font-semibold tabular-nums text-right">
                    {stb[holeIdx] ?? '·'} pt
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          className="px-4 py-2 border border-rd-navy/30 text-rd-navy rounded font-medium disabled:opacity-40"
          disabled={isHoleOne || status.kind === 'busy'}
          onClick={goPrev}
        >
          ← Prev
        </button>
        <button
          className="px-3 py-2 border border-rd-navy/30 text-rd-navy rounded font-medium text-sm disabled:opacity-40"
          disabled={status.kind === 'busy'}
          onClick={() => void goSaveNow()}
          title="Save without advancing to the next hole"
        >
          Save
        </button>
        {isHole18 ? (
          <button
            className="px-4 py-2 bg-rd-navy text-white rounded font-medium disabled:opacity-50"
            disabled={status.kind === 'busy'}
            onClick={() => void goFinish()}
          >
            Finish &amp; save
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-rd-navy text-white rounded font-medium disabled:opacity-50"
            onClick={() => void goNext()}
          >
            Next →
          </button>
        )}
      </div>
      <div className="text-xs text-rd-ink/60 text-center mt-2">
        Hole {holeIdx + 1} of 18
        {status.kind !== 'idle' && (
          <span
            className={`block ${
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

      <RunningTotals
        players={groupPlayers}
        holesByPlayer={holesByPlayer}
        phByPlayer={phByPlayer}
        course={data.course}
      />
    </section>
  );
}

function NotAvailable({ msg }: { msg: string }) {
  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
      <p className="text-sm text-rd-ink/70">{msg}</p>
    </section>
  );
}

function HoleStepper({ holeIdx, onJump }: { holeIdx: number; onJump: (i: number) => void }) {
  const renderRow = (start: number, end: number) => (
    <div className="flex gap-1">
      {Array.from({ length: end - start }, (_, i) => start + i).map((i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          className={`flex-1 min-w-0 h-9 text-sm font-semibold rounded tabular-nums border ${
            i === holeIdx
              ? 'bg-rd-navy text-white border-rd-navy'
              : 'border-rd-navy/30 text-rd-navy bg-white hover:bg-rd-cream'
          }`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
  return (
    <div className="mb-3 print:hidden">
      <div className="text-xs uppercase tracking-wide text-rd-ink/60 mb-1">
        Jump to hole
      </div>
      <div className="space-y-1">
        {renderRow(0, 9)}
        {renderRow(9, 18)}
      </div>
    </div>
  );
}

function RunningTotals({
  players,
  holesByPlayer,
  phByPlayer,
  course,
}: {
  players: Player[];
  holesByPlayer: Record<string, (number | null)[]>;
  phByPlayer: Map<string, { ph: number | null; isStableford: boolean }>;
  course: import('../types').Course;
}) {
  // If any division in the group is stableford, show the Pts column instead
  // of Net so the table makes sense for both kinds of player at once.
  const anyStableford = players.some((p) => phByPlayer.get(p.saId)?.isStableford);
  const netHeader = anyStableford ? 'Net / Pts' : 'Net';
  return (
    <div className="rd-card p-3 mt-4">
      <div className="text-xs uppercase tracking-wide text-rd-ink/60 mb-2">
        Running totals
      </div>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-rd-ink/50">
          <tr>
            <th className="text-left font-normal">Player</th>
            <th className="text-right font-normal">PH</th>
            <th className="text-right font-normal">Out</th>
            <th className="text-right font-normal">In</th>
            <th className="text-right font-normal">Gross</th>
            <th className="text-right font-normal">{netHeader}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const holes = holesByPlayer[p.saId] ?? emptyHoles();
            const out = sumOrDash(holes, 0, 9);
            const inn = sumOrDash(holes, 9, 18);
            const gross = out != null && inn != null ? out + inn : null;
            const meta = phByPlayer.get(p.saId);
            const ph = meta?.ph ?? null;
            // For stableford divisions show the running points total (sum
            // over entered holes; unentered count as 0). For medal, show net.
            let netOrPts: number | null = null;
            if (meta?.isStableford && ph != null) {
              netOrPts = stablefordHoles(holes, ph, course).reduce<number>(
                (a, b) => a + (b ?? 0),
                0
              );
            } else if (gross != null && ph != null) {
              netOrPts = gross - ph;
            }
            return (
              <tr key={p.saId} className="border-t border-rd-cream">
                <td className="py-1 truncate">{fullName(p)}</td>
                <td className="text-right text-rd-ink/70">{ph ?? '—'}</td>
                <td className="text-right">{out ?? '—'}</td>
                <td className="text-right">{inn ?? '—'}</td>
                <td className="text-right">{gross ?? '—'}</td>
                <td className="text-right font-semibold text-rd-navy">
                  {netOrPts ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
