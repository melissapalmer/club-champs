import { useMemo, useState } from 'react';
import { DivisionTabs } from '../components/DivisionTabs';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  courseHandicap,
  divisionFor,
  playingHandicap,
  teeRatings,
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
  const ratings = tee ? teeRatings(tee, course.gender) : undefined;
  const hc =
    tee && ratings
      ? courseHandicap(player.hi, ratings.slope, ratings.cr, tee.par, course.maxHandicap)
      : null;
  const ph = hc != null && division ? playingHandicap(hc, division.handicapPct) : null;
  return { player, hc, ph };
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

  const [activeDiv, setActiveDiv] = useState<string>(divs[0]?.code ?? '');
  const division = divs.find((d) => d.code === activeDiv);
  const rows = rowsByDiv.get(activeDiv) ?? [];

  const sortedRows = rows.slice().sort((a, b) => {
    const la = a.player.lastName.localeCompare(b.player.lastName);
    return la !== 0 ? la : a.player.firstName.localeCompare(b.player.firstName);
  });

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Players</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        {players.length} entered · {division ? `${rows.length} in ${division.name}` : 'select a division'}
        {division && (
          <>
            {' · '}
            {division.hiMin > -100
              ? `HI ${division.hiMin}–${division.hiMax}`
              : `HI ≤ ${division.hiMax}`}
          </>
        )}
      </p>
      <DivisionTabs divisions={divs} active={activeDiv} onChange={setActiveDiv} />

      <div className="rd-card overflow-x-auto">
        <table className="rd-table table-fixed">
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th>HI</th>
              <th>HC</th>
              <th>PH</th>
              <th>Tee</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-rd-ink/50">
                  No players in this division.
                </td>
              </tr>
            ) : (
              sortedRows.map(({ player, hc, ph }) => (
                <tr key={player.saId}>
                  <td>
                    {fullName(player)}
                    {player.divisionOverride && (
                      <span className="ml-1 text-xs text-rd-gold">(override)</span>
                    )}
                  </td>
                  <td className="text-rd-ink/60 tabular-nums">{player.saId}</td>
                  <td>{num(player.hi, 1)}</td>
                  <td>{num(hc, 1)}</td>
                  <td>{num(ph)}</td>
                  <td className="capitalize">{division?.tee}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
