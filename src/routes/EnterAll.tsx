import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScoreEntryPanel } from '../components/ScoreEntryPanel';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithCountOut,
  visibleDivisions,
  type PlayerLine,
} from '../scoring/engine';
import type { Course, DivisionConfig } from '../types';

export function EnterAll({ data }: { data: AppData }) {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';

  if (!token) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
        <p className="text-sm text-rd-ink/70">
          This page needs a valid token. Ask the organiser for the tent URL.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Tent score entry</h1>
      <p className="text-sm text-rd-ink/70 mb-4">
        Pick a player, type their card, save. The form stays on the same
        player after each save so you can keep adding or correcting holes.
      </p>

      <ScoreEntryPanel data={data} submitToken={token} />

      <MiniLeaderboards data={data} />
    </section>
  );
}

/**
 * Compact one-card-per-division leaderboard shown under the entry panel so
 * the tent volunteer can sanity-check their saves at a glance — without
 * leaving the page or wading into the per-hole detail.
 */
function MiniLeaderboards({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );
  const byDiv = useMemo(() => linesByDivision(lines), [lines]);
  const divs = visibleDivisions(course);
  if (divs.length === 0) return null;

  const cols =
    divs.length >= 3
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : divs.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1';

  return (
    <div className="mt-6">
      <h2 className="text-lg text-rd-navy font-serif mb-2">Scoreboards</h2>
      <div className={`grid gap-3 ${cols}`}>
        {divs.map((d) => (
          <MiniDivisionTable
            key={d.code}
            division={d}
            lines={byDiv.get(d.code) ?? []}
            course={course}
          />
        ))}
      </div>
    </div>
  );
}

function MiniDivisionTable({
  division,
  lines,
  course,
}: {
  division: DivisionConfig;
  lines: PlayerLine[];
  course: Course;
}) {
  const isStableford = (division.format ?? 'medal') === 'stableford';
  const ranks = rankWithCountOut(
    lines,
    { kind: 'overall', metric: isStableford ? 'stableford' : 'net' },
    course
  );
  const sorted = lines
    .map((line, i) => ({ line, rank: ranks[i] }))
    .sort((a, b) => {
      const ap = a.rank.pos;
      const bp = b.rank.pos;
      // No scores yet → alphabetical by surname for a predictable pre-
      // tournament order. Matches the public Scores page's behaviour.
      if (ap == null && bp == null) {
        const ln = (a.line.player.lastName || '').localeCompare(
          b.line.player.lastName || ''
        );
        if (ln !== 0) return ln;
        return (a.line.player.firstName || '').localeCompare(
          b.line.player.firstName || ''
        );
      }
      if (ap == null) return 1;
      if (bp == null) return -1;
      return ap - bp;
    });

  return (
    <div className="rd-card overflow-hidden">
      <h3 className="text-sm uppercase tracking-wide text-center py-1.5 px-2 text-rd-navy font-sans font-semibold border-b-2 border-rd-gold">
        {division.name}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-rd-ink/60 bg-rd-cream/50">
            <tr>
              <th className="text-left px-2 py-1 font-normal w-10">Pos</th>
              <th className="text-left px-2 py-1 font-normal">Player</th>
              <th className="text-right px-2 py-1 font-normal">Sat</th>
              <th className="text-right px-2 py-1 font-normal">Sun</th>
              <th className="text-right px-2 py-1 font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-rd-ink/50 text-xs">
                  No players in this division.
                </td>
              </tr>
            ) : (
              sorted.map(({ line, rank }) => (
                <tr key={line.player.saId} className="border-t border-rd-cream">
                  <td className="px-2 py-1 text-rd-navy font-semibold tabular-nums whitespace-nowrap">
                    {rank.pos == null ? '—' : `${rank.tied ? 'T' : ''}${rank.pos}`}
                  </td>
                  <td className="px-2 py-1 truncate">{fullName(line.player)}</td>
                  <DayCell
                    gross={line.sat.gross}
                    rankValue={isStableford ? line.sat.stableford : line.sat.net}
                  />
                  <DayCell
                    gross={line.sun.gross}
                    rankValue={isStableford ? line.sun.stableford : line.sun.net}
                  />
                  <DayCell
                    gross={line.overall.gross}
                    rankValue={
                      isStableford ? line.overall.stableford : line.overall.net
                    }
                    emphasised
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayCell({
  gross,
  rankValue,
  emphasised = false,
}: {
  gross: number | null;
  rankValue: number | null;
  emphasised?: boolean;
}) {
  return (
    <td className="px-2 py-1 text-right tabular-nums text-xs leading-tight">
      <div className="text-rd-ink/55">{num(gross) ?? '—'}</div>
      <div
        className={
          emphasised ? 'font-semibold text-rd-navy' : 'font-medium text-rd-ink'
        }
      >
        {num(rankValue) ?? '—'}
      </div>
    </td>
  );
}
