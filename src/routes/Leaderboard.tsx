import { useMemo, useState } from 'react';
import { DivisionTabs } from '../components/DivisionTabs';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithTies,
  visibleDivisions,
} from '../scoring/engine';

export function Leaderboard({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const divs = useMemo(() => visibleDivisions(course), [course]);
  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );
  const byDiv = useMemo(() => linesByDivision(lines), [lines]);

  const [activeDiv, setActiveDiv] = useState<string>(divs[0]?.code ?? '');
  const divLines = byDiv.get(activeDiv) ?? [];

  const overallNetRanks = rankWithTies(divLines.map((l) => l.overall.net));

  const sorted = divLines
    .map((line, i) => ({ line, rank: overallNetRanks[i] }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return 0;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Scores</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Medal scoring across two days · ranked by overall net.
      </p>
      <DivisionTabs divisions={divs} active={activeDiv} onChange={setActiveDiv} />

      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>HI</th>
              <th>HC</th>
              <th>PH</th>
              <th>Sat&nbsp;Gross</th>
              <th>Sat&nbsp;Net</th>
              <th>Sun&nbsp;Gross</th>
              <th>Sun&nbsp;Net</th>
              <th>Total&nbsp;Gross</th>
              <th>Total&nbsp;Net</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-rd-ink/50">
                  No players in this division.
                </td>
              </tr>
            )}
            {sorted.map(({ line, rank }) => (
              <tr key={line.player.saId}>
                <td className="font-semibold text-rd-navy">{rank ?? '—'}</td>
                <td>{fullName(line.player)}</td>
                <td>{num(line.player.hi, 1)}</td>
                <td>{num(line.hc, 1)}</td>
                <td>{num(line.ph)}</td>
                <td>{num(line.sat.gross)}</td>
                <td>{num(line.sat.net)}</td>
                <td>{num(line.sun.gross)}</td>
                <td>{num(line.sun.net)}</td>
                <td className="font-medium">{num(line.overall.gross)}</td>
                <td className="font-semibold text-rd-navy">{num(line.overall.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
