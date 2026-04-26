import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithTies,
  type PlayerLine,
} from '../scoring/engine';
import type { DivisionConfig } from '../types';

const TOP_N = 2;

type Category = {
  key: string;
  label: string;
  pick: (l: PlayerLine) => number | null;
};

const CATEGORIES: Category[] = [
  { key: 'satGross', label: 'Saturday Gross', pick: (l) => l.sat.gross },
  { key: 'satNet', label: 'Saturday Net', pick: (l) => l.sat.net },
  { key: 'sunGross', label: 'Sunday Gross', pick: (l) => l.sun.gross },
  { key: 'sunNet', label: 'Sunday Net', pick: (l) => l.sun.net },
  { key: 'overGross', label: 'Overall Gross', pick: (l) => l.overall.gross },
  { key: 'overNet', label: 'Overall Net', pick: (l) => l.overall.net },
  { key: 'eclectic', label: 'Eclectic (Net)', pick: (l) => l.eclectic.net },
];

function podium(lines: PlayerLine[], pick: (l: PlayerLine) => number | null) {
  const values = lines.map(pick);
  const ranks = rankWithTies(values);
  return lines
    .map((line, i) => ({ line, value: values[i], rank: ranks[i] }))
    .filter((r) => r.rank != null && r.rank <= TOP_N)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

function DivisionResults({
  division,
  lines,
}: {
  division: DivisionConfig;
  lines: PlayerLine[];
}) {
  return (
    <div className="rd-card p-4">
      <h2 className="text-xl text-rd-navy mb-3">{division.name} Division</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const winners = podium(lines, cat.pick);
          return (
            <div key={cat.key}>
              <h3 className="text-sm uppercase tracking-wide text-rd-gold mb-1 font-sans font-semibold">
                {cat.label}
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
                        {num(w.value, cat.key === 'eclectic' ? 1 : 0)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
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
        Top {TOP_N} per division across each prize category.
      </p>
      <div className="space-y-4">
        {course.divisions.map((d) => (
          <DivisionResults key={d.code} division={d} lines={byDiv.get(d.code) ?? []} />
        ))}
      </div>
    </section>
  );
}
