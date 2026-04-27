import { Fragment, useMemo, useState } from 'react';
import { useIsAdmin } from '../admin';
import { DivisionTabs } from '../components/DivisionTabs';
import { ScoreEditModal } from '../components/ScoreEditModal';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  buildPlayerLines,
  dayTotals,
  linesByDivision,
  rankWithTies,
  visibleDivisions,
  type PlayerLine,
} from '../scoring/engine';
import type { Player } from '../types';

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

const HOLE_NUMS = Array.from({ length: 18 }, (_, i) => i + 1);

function HoleByHoleCard({ line }: { line: PlayerLine }) {
  const sat = dayTotals(line.sat.holes);
  const sun = dayTotals(line.sun.holes);
  const cell = (v: number | null | undefined) => (v == null ? '·' : v);

  const Row = ({
    label,
    holes,
    out,
    in: in_,
    gross,
    net,
  }: {
    label: string;
    holes: (number | null)[];
    out: number | null;
    in: number | null;
    gross: number | null;
    net: number | null;
  }) => (
    <tr>
      <th className="text-left whitespace-nowrap pr-3">{label}</th>
      {holes.slice(0, 9).map((h, i) => (
        <td key={`f${i}`} className="text-center tabular-nums">{cell(h)}</td>
      ))}
      <td className="text-center font-semibold tabular-nums bg-rd-navy/5">{cell(out)}</td>
      {holes.slice(9, 18).map((h, i) => (
        <td key={`b${i}`} className="text-center tabular-nums">{cell(h)}</td>
      ))}
      <td className="text-center font-semibold tabular-nums bg-rd-navy/5">{cell(in_)}</td>
      <td className="text-center font-semibold tabular-nums">{cell(gross)}</td>
      <td className="text-center font-semibold text-rd-navy tabular-nums">{cell(net)}</td>
    </tr>
  );

  return (
    <div className="bg-rd-cream/40 -mx-3 -my-2 px-3 py-3 overflow-x-auto">
      <table className="text-xs sm:text-sm border-collapse min-w-full">
        <thead>
          <tr className="text-rd-ink/60">
            <th className="text-left pr-3"></th>
            {HOLE_NUMS.slice(0, 9).map((h) => (
              <th key={h} className="text-center font-medium px-1">{h}</th>
            ))}
            <th className="text-center font-medium px-1 bg-rd-navy/5">Out</th>
            {HOLE_NUMS.slice(9).map((h) => (
              <th key={h} className="text-center font-medium px-1">{h}</th>
            ))}
            <th className="text-center font-medium px-1 bg-rd-navy/5">In</th>
            <th className="text-center font-medium px-1">Gross</th>
            <th className="text-center font-medium px-1">Net</th>
          </tr>
        </thead>
        <tbody className="[&_td]:py-1 [&_th]:py-1 [&_td]:border-t [&_td]:border-rd-cream">
          <Row
            label="Sat (Day 1)"
            holes={line.sat.holes}
            out={sat.out}
            in={sat.in}
            gross={line.sat.gross}
            net={line.sat.net}
          />
          <Row
            label="Sun (Day 2)"
            holes={line.sun.holes}
            out={sun.out}
            in={sun.in}
            gross={line.sun.gross}
            net={line.sun.net}
          />
        </tbody>
      </table>
    </div>
  );
}

export function Leaderboard({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const admin = useIsAdmin();
  const [editing, setEditing] = useState<Player | null>(null);
  const [expandedSaId, setExpandedSaId] = useState<string | null>(null);
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

  const colCount = admin ? 12 : 11;

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Scores</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Medal scoring across two days · ranked by overall net · click a row for hole-by-hole.
      </p>
      <DivisionTabs divisions={divs} active={activeDiv} onChange={setActiveDiv} />

      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th></th>
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
              {admin && <th aria-label="Edit"></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colCount + 1} className="text-center py-8 text-rd-ink/50">
                  No players in this division.
                </td>
              </tr>
            )}
            {sorted.map(({ line, rank }) => {
              const isExpanded = expandedSaId === line.player.saId;
              const toggle = () =>
                setExpandedSaId((curr) =>
                  curr === line.player.saId ? null : line.player.saId
                );
              return (
                <Fragment key={line.player.saId}>
                  <tr
                    onClick={toggle}
                    className="cursor-pointer hover:bg-rd-cream/40"
                    aria-expanded={isExpanded}
                  >
                    <td className="text-rd-ink/50 w-6">
                      <Chevron open={isExpanded} />
                    </td>
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
                    <td className="font-semibold text-rd-navy">
                      {num(line.overall.net)}
                    </td>
                    {admin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditing(line.player)}
                          className="inline-flex items-center justify-center text-rd-navy/60 hover:text-rd-navy"
                          title={`Edit scores for ${fullName(line.player)}`}
                          aria-label={`Edit scores for ${fullName(line.player)}`}
                        >
                          <PencilIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={colCount + 1} className="p-0">
                        <HoleByHoleCard line={line} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ScoreEditModal
          data={data}
          player={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
