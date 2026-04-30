import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import { defaultAwards, PRIZE_LABELS, PRIZE_PICK, PRIZE_SCOPE } from '../prizes';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithCountOut,
  visibleDivisions,
  type PlayerLine,
  type RankResult,
} from '../scoring/engine';
import type { Course, DivisionConfig, PrizeCategory } from '../types';

function podium(
  lines: PlayerLine[],
  category: PrizeCategory,
  topN: number,
  course: Course
) {
  const ranks = rankWithCountOut(lines, PRIZE_SCOPE[category], course);
  const pick = PRIZE_PICK[category];
  return lines
    .map((line, i) => ({ line, value: pick(line), rank: ranks[i] }))
    .filter((r) => r.rank.pos != null && r.rank.pos <= topN)
    .sort((a, b) => {
      const ap = a.rank.pos ?? 0;
      const bp = b.rank.pos ?? 0;
      if (ap !== bp) return ap - bp;
      // Within a shared position, render the count-out winner first.
      if (a.rank.brokenByCountOut !== b.rank.brokenByCountOut) {
        return a.rank.brokenByCountOut ? -1 : 1;
      }
      return 0;
    });
}

function PosBadge({ rank }: { rank: RankResult }) {
  if (rank.pos == null) return null;
  return (
    <>
      {rank.tied && 'T'}
      {rank.pos}.
    </>
  );
}

function CountOutBadge() {
  return (
    <span
      className="ml-1.5 align-middle text-[10px] uppercase tracking-wide px-1 rounded bg-rd-gold/20 text-rd-navy"
      title="Won the count-out tie-break"
    >
      c/o
    </span>
  );
}

function DivisionResults({
  division,
  lines,
  course,
}: {
  division: DivisionConfig;
  lines: PlayerLine[];
  course: Course;
}) {
  const awards = division.prizes?.awards ?? defaultAwards(division.format);

  return (
    <div className="rd-card p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h2 className="text-xl text-rd-navy">{division.name} Division</h2>
        <span className="text-xs text-rd-ink/60">
          {awards.length} {awards.length === 1 ? 'prize' : 'prizes'}
        </span>
      </div>
      {awards.length === 0 ? (
        <p className="text-sm text-rd-ink/50">No prizes configured for this division.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {awards.map(({ category, topN }) => {
            const winners = podium(lines, category, topN, course);
            return (
              <div key={category}>
                <h3 className="text-sm uppercase tracking-wide text-rd-gold mb-1 font-sans font-semibold flex items-baseline justify-between">
                  <span>{PRIZE_LABELS[category]}</span>
                  <span className="text-[11px] text-rd-ink/50 font-normal">Top {topN}</span>
                </h3>
                {winners.length === 0 ? (
                  <p className="text-sm text-rd-ink/50">—</p>
                ) : (
                  <ol className="space-y-0.5">
                    {winners.map((w) => (
                      <li
                        key={w.line.player.saId}
                        className="flex items-baseline justify-between text-sm"
                      >
                        <span>
                          <span className="font-semibold text-rd-navy mr-2 whitespace-nowrap">
                            <PosBadge rank={w.rank} />
                          </span>
                          {fullName(w.line.player)}
                          {w.rank.brokenByCountOut && <CountOutBadge />}
                        </span>
                        <span className="font-medium tabular-nums">
                          {num(w.value, category === 'eclectic' ? 1 : 0)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Results({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );
  const byDiv = useMemo(() => linesByDivision(lines), [lines]);

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Results</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Prize categories per division — configurable from the Config tab.
      </p>
      <div className="space-y-4">
        {visibleDivisions(course).map((d) => (
          <DivisionResults
            key={d.code}
            division={d}
            lines={byDiv.get(d.code) ?? []}
            course={course}
          />
        ))}
      </div>
    </section>
  );
}
