import { useMemo, useState } from 'react';
import { DivisionTabs } from '../components/DivisionTabs';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import { buildPlayerLines, linesByDivision, rankWithTies } from '../scoring/engine';

const HOLE_HEADERS = Array.from({ length: 18 }, (_, i) => i + 1);

export function Eclectic({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );
  const byDiv = useMemo(() => linesByDivision(lines), [lines]);

  const [activeDiv, setActiveDiv] = useState<string>(course.divisions[1]?.code ?? 'B');
  const divLines = byDiv.get(activeDiv) ?? [];

  const netRanks = rankWithTies(divLines.map((l) => l.eclectic.net));
  const sorted = divLines
    .map((line, i) => ({ line, rank: netRanks[i] }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return 0;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Eclectic</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Best of Day 1 / Day 2 per hole · net = gross less {course.eclecticHandicapPct}% of PH.
      </p>
      <DivisionTabs divisions={course.divisions} active={activeDiv} onChange={setActiveDiv} />

      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th className="text-right">PH</th>
              {HOLE_HEADERS.map((h) => (
                <th key={h} className="text-right">{h}</th>
              ))}
              <th className="text-right">Gross</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={23} className="text-center py-8 text-rd-ink/50">
                  No players in this division.
                </td>
              </tr>
            )}
            {sorted.map(({ line, rank }) => (
              <tr key={line.player.saId}>
                <td className="font-semibold text-rd-navy">{rank ?? '—'}</td>
                <td className="whitespace-nowrap">{fullName(line.player)}</td>
                <td className="text-right">{num(line.ph)}</td>
                {line.eclectic.holes.map((h, i) => (
                  <td key={i} className="text-right tabular-nums">{h ?? '·'}</td>
                ))}
                <td className="text-right font-medium">{num(line.eclectic.gross)}</td>
                <td className="text-right font-semibold text-rd-navy">
                  {num(line.eclectic.net, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
