import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppData } from '../data';
import { fullName } from '../format';
import { buildPlayerLines, type PlayerLine } from '../scoring/engine';
import {
  STAT_KEYS,
  STAT_LABELS,
  buildPlayerStats,
  hasAnyHolePlayed,
  type PlayerStatCounts,
} from '../scoring/stats';

type SortKey = 'name' | 'division' | keyof PlayerStatCounts;
type SortDir = 'asc' | 'desc';

type Row = {
  line: PlayerLine;
  counts: PlayerStatCounts;
};

export function Stats({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const navigate = useNavigate();

  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );

  const rows = useMemo<Row[]>(
    () =>
      lines
        .filter(hasAnyHolePlayed)
        .map((line) => ({ line, counts: buildPlayerStats(line, course) })),
    [lines, course]
  );

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'name',
    dir: 'asc',
  });

  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => cmp(a, b, sort.key));
    if (sort.dir === 'desc') arr.reverse();
    return arr;
  }, [rows, sort]);

  const onHeader = (key: SortKey) =>
    setSort((curr) =>
      curr.key === key
        ? { key, dir: curr.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: defaultDir(key) }
    );

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Stats</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Score-bucket counts across both rounds. Click a player for charts and
        comparison overlays.
      </p>

      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <SortHeader label="Player" sortKey="name" sort={sort} onClick={onHeader} align="left" />
              <SortHeader label="Division" sortKey="division" sort={sort} onClick={onHeader} align="left" />
              {STAT_KEYS.map((k) => (
                <SortHeader
                  key={k}
                  label={STAT_LABELS[k]}
                  sortKey={k}
                  sort={sort}
                  onClick={onHeader}
                  align="center"
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={2 + STAT_KEYS.length} className="text-center py-8 text-rd-ink/50">
                  No scored holes yet.
                </td>
              </tr>
            )}
            {sorted.map(({ line, counts }) => (
              <tr
                key={line.player.saId}
                onClick={() => navigate(`/stats/${encodeURIComponent(line.player.saId)}`)}
                className="cursor-pointer"
              >
                <td className="text-rd-navy">{fullName(line.player)}</td>
                <td className="text-rd-ink/70">{line.division?.name ?? '—'}</td>
                {STAT_KEYS.map((k) => (
                  <td key={k} className="text-center tabular-nums">
                    {counts[k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function defaultDir(key: SortKey): SortDir {
  return key === 'name' || key === 'division' ? 'asc' : 'desc';
}

function cmp(a: Row, b: Row, key: SortKey): number {
  if (key === 'name') {
    return fullName(a.line.player).localeCompare(fullName(b.line.player));
  }
  if (key === 'division') {
    const an = a.line.division?.name ?? '';
    const bn = b.line.division?.name ?? '';
    const byDiv = an.localeCompare(bn);
    if (byDiv !== 0) return byDiv;
    return fullName(a.line.player).localeCompare(fullName(b.line.player));
  }
  const av = a.counts[key];
  const bv = b.counts[key];
  if (av !== bv) return av - bv;
  return fullName(a.line.player).localeCompare(fullName(b.line.player));
}

function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onClick: (key: SortKey) => void;
  align: 'left' | 'center';
}) {
  const active = sort.key === sortKey;
  const indicator = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      className={`cursor-pointer select-none ${align === 'center' ? 'text-center' : ''}`}
      onClick={() => onClick(sortKey)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span className="text-rd-ink/40">{indicator}</span>
    </th>
  );
}
