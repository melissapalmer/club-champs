import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import { courseHandicap, divisionFor, playingHandicap } from '../scoring/engine';

export function Players({ data }: { data: AppData }) {
  const { course, players } = data;
  const rows = useMemo(
    () =>
      players.map((player) => {
        const division = divisionFor(player, course);
        const tee = division ? course.tees[division.tee] : undefined;
        const hc = tee
          ? courseHandicap(player.hi, tee.slope, tee.cr, tee.par, course.maxHandicap)
          : null;
        const ph = hc != null && division ? playingHandicap(hc, division.handicapPct) : null;
        return { player, division, hc, ph };
      }),
    [players, course]
  );

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Players</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        {players.length} entered · division derived from HI (overrides honoured).
      </p>
      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th className="text-right">HI</th>
              <th>Division</th>
              <th className="text-right">HC</th>
              <th className="text-right">PH</th>
              <th>Tee</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, division, hc, ph }) => (
              <tr key={player.saId}>
                <td>{fullName(player)}</td>
                <td className="text-rd-ink/60 tabular-nums">{player.saId}</td>
                <td className="text-right">{num(player.hi, 1)}</td>
                <td>
                  {division?.name ?? '—'}
                  {player.divisionOverride && (
                    <span className="ml-1 text-xs text-rd-gold">(override)</span>
                  )}
                </td>
                <td className="text-right">{num(hc, 1)}</td>
                <td className="text-right">{num(ph)}</td>
                <td className="capitalize">{division?.tee ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
