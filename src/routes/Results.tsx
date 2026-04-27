import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import { defaultAwards, PRIZE_LABELS, PRIZE_PICK } from '../prizes';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithTies,
  visibleDivisions,
  type PlayerLine,
} from '../scoring/engine';
import type { DivisionConfig } from '../types';

function podium(
  lines: PlayerLine[],
  pick: (l: PlayerLine) => number | null,
  topN: number
) {
  const values = lines.map(pick);
  const ranks = rankWithTies(values);
  return lines
    .map((line, i) => ({ line, value: values[i], rank: ranks[i] }))
    .filter((r) => r.rank != null && r.rank <= topN)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

function DivisionResults({
  division,
  lines,
}: {
  division: DivisionConfig;
  lines: PlayerLine[];
}) {
  const awards = division.prizes?.awards ?? defaultAwards();

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
            const winners = podium(lines, PRIZE_PICK[category], topN);
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
                          <span className="font-semibold text-rd-navy mr-2">
                            {w.rank}.
                          </span>
                          {fullName(w.line.player)}
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
          <DivisionResults key={d.code} division={d} lines={byDiv.get(d.code) ?? []} />
        ))}
      </div>
    </section>
  );
}
