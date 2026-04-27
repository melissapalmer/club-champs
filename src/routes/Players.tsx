import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  courseHandicap,
  divisionFor,
  playingHandicap,
  visibleDivisions,
} from '../scoring/engine';
import type { Course, DivisionConfig, Player } from '../types';

type Row = {
  player: Player;
  hc: number | null;
  ph: number | null;
};

function rowFor(player: Player, division: DivisionConfig | undefined, course: Course): Row {
  const tee = division ? course.tees[division.tee] : undefined;
  const hc = tee
    ? courseHandicap(player.hi, tee.slope, tee.cr, tee.par, course.maxHandicap)
    : null;
  const ph = hc != null && division ? playingHandicap(hc, division.handicapPct) : null;
  return { player, hc, ph };
}

function DivisionGroup({
  division,
  rows,
}: {
  division: DivisionConfig;
  rows: Row[];
}) {
  return (
    <div className="rd-card overflow-x-auto">
      <div className="px-4 pt-3 pb-2 border-b border-rd-cream flex items-baseline justify-between">
        <h2 className="text-xl text-rd-navy font-serif">{division.name} Division</h2>
        <span className="text-sm text-rd-ink/60">
          {rows.length} {rows.length === 1 ? 'player' : 'players'}
          {' · '}
          {division.hiMin > -100 ? `HI ${division.hiMin}–${division.hiMax}` : `HI ≤ ${division.hiMax}`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-rd-ink/50">No players in this division.</p>
      ) : (
        <table className="rd-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th className="text-right">HI</th>
              <th className="text-right">HC</th>
              <th className="text-right">PH</th>
              <th>Tee</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((a, b) => {
                const la = a.player.lastName.localeCompare(b.player.lastName);
                return la !== 0 ? la : a.player.firstName.localeCompare(b.player.firstName);
              })
              .map(({ player, hc, ph }) => (
                <tr key={player.saId}>
                  <td>
                    {fullName(player)}
                    {player.divisionOverride && (
                      <span className="ml-1 text-xs text-rd-gold">(override)</span>
                    )}
                  </td>
                  <td className="text-rd-ink/60 tabular-nums">{player.saId}</td>
                  <td className="text-right">{num(player.hi, 1)}</td>
                  <td className="text-right">{num(hc, 1)}</td>
                  <td className="text-right">{num(ph)}</td>
                  <td className="capitalize">{division.tee}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Players({ data }: { data: AppData }) {
  const { course, players } = data;
  const divs = useMemo(() => visibleDivisions(course), [course]);

  const rowsByDiv = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const d of divs) map.set(d.code, []);
    for (const player of players) {
      const division = divisionFor(player, course);
      if (!division) continue;
      const list = map.get(division.code);
      if (list) list.push(rowFor(player, division, course));
    }
    return map;
  }, [players, course, divs]);

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Players</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        {players.length} entered · grouped by division (derived from HI, overrides honoured).
      </p>
      <div className="space-y-4">
        {divs.map((d) => (
          <DivisionGroup key={d.code} division={d} rows={rowsByDiv.get(d.code) ?? []} />
        ))}
      </div>
    </section>
  );
}
