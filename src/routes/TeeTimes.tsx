import { useMemo, useState } from 'react';
import { Tabs } from '../components/Tabs';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  buildPlayerLines,
  visibleDivisions,
  type PlayerLine,
} from '../scoring/engine';
import type { DivisionConfig, Player, TeeTime } from '../types';

/**
 * Public read-only view of the auto-generated draw, styled to match the
 * Excel-style draw sheet the club historically circulated:
 *   - banner with DAY + COMP
 *   - one table per day with `1st Tee` and `Player A..D` columns
 *   - legend below the table mapping division names to HI ranges + format
 *
 * If `course.teeTimes?.enabled` is false AND no rows exist, we show a
 * disabled empty state. If rows exist (admin clicked Generate but didn't
 * save the Course flag), the draw still renders.
 */
export function TeeTimes({ data }: { data: AppData }) {
  const { course, players, scores, teeTimes } = data;
  const [day, setDay] = useState<1 | 2>(1);

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.saId, p);
    return map;
  }, [players]);

  const lineById = useMemo(() => {
    const lines = buildPlayerLines(players, scores, course);
    const map = new Map<string, PlayerLine>();
    for (const l of lines) map.set(l.player.saId, l);
    return map;
  }, [players, scores, course]);

  if (!course.teeTimes?.enabled && teeTimes.length === 0) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Tee Times</h1>
        <p className="text-sm text-rd-ink/70">
          Tee times are not enabled for this event. Admin can enable them in
          Config.
        </p>
      </section>
    );
  }

  const dayRows = teeTimes.filter((t) => t.day === day);
  const groupsByTime = new Map<string, TeeTime[]>();
  for (const t of dayRows) {
    const arr = groupsByTime.get(t.time) ?? [];
    arr.push(t);
    groupsByTime.set(t.time, arr);
  }
  const sortedTimes = Array.from(groupsByTime.keys()).sort();

  // Number of player columns: prefer the configured group size, fall back to
  // the actual widest group (handles legacy data where the flag isn't set).
  const widestGroup = sortedTimes.reduce(
    (max, t) => Math.max(max, groupsByTime.get(t)?.length ?? 0),
    0
  );
  const playerCols = Math.max(
    course.teeTimes?.groupSize ?? 0,
    widestGroup,
    1
  );
  const colLetters = Array.from({ length: playerCols }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  const renderPlayer = (row: TeeTime | undefined) => {
    if (!row) return null;
    const player = playerById.get(row.saId);
    const line = lineById.get(row.saId);
    const name = player ? fullName(player) : row.name || row.saId;
    return (
      <div className="leading-tight">
        <div className="font-medium">{name}</div>
        <div className="text-[10px] text-rd-ink/60 tabular-nums mt-0.5">
          {line?.division && (
            <span className="uppercase tracking-wide text-rd-ink/50 mr-1.5">
              {line.division.name}
            </span>
          )}
          {player && <>HI {num(player.hi, 1)}</>}
          {line?.ph != null && <> · PH {num(line.ph)}</>}
        </div>
      </div>
    );
  };

  const dayLabel = day === 1 ? 'Saturday' : 'Sunday';

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Tee Times</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Auto-generated draw
        {course.teeTimes?.groupSize && (
          <>
            {' · '}
            {course.teeTimes.groupSize}-balls every{' '}
            {course.teeTimes.intervalMinutes} mins
          </>
        )}
        .
      </p>

      <Tabs
        tabs={[
          { id: '1', label: 'Saturday' },
          { id: '2', label: 'Sunday' },
        ]}
        active={String(day)}
        onChange={(id) => setDay(Number(id) as 1 | 2)}
      />

      <DrawHeader dayLabel={dayLabel} comp={course.event} />

      {sortedTimes.length === 0 ? (
        <div className="rd-card p-6 text-center text-sm text-rd-ink/60">
          Tee times not yet posted for {dayLabel} — admin can generate them in
          Config.
        </div>
      ) : (
        <div className="rd-card overflow-x-auto mb-4">
          <table className="rd-table table-fixed">
            <colgroup>
              {/* Fixed 1st Tee column; player columns share the remainder
                  equally via table-fixed, so Day 1 and Day 2 always render
                  with the same widths regardless of name length. */}
              <col style={{ width: '6rem' }} />
              {colLetters.map((c) => (
                <col key={c} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>1st Tee</th>
                {colLetters.map((c) => (
                  <th key={c}>Player {c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTimes.map((time) => {
                const rows = groupsByTime.get(time) ?? [];
                return (
                  <tr key={time}>
                    <td className="font-semibold tabular-nums text-rd-navy">
                      {time}
                    </td>
                    {colLetters.map((c, i) => (
                      <td key={c} className="break-words">
                        {renderPlayer(rows[i])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DivisionsLegend divisions={visibleDivisions(course)} />
    </section>
  );
}

function DrawHeader({ dayLabel, comp }: { dayLabel: string; comp: string }) {
  return (
    <div className="rd-card overflow-hidden mb-3">
      <table className="w-full text-sm border-collapse">
        <tbody>
          <tr>
            <th className="bg-rd-navy/5 text-left px-3 py-2 w-28 font-semibold text-rd-navy uppercase tracking-wide text-xs border-b border-rd-navy/10">
              Day
            </th>
            <td className="text-center px-3 py-2 font-semibold uppercase tracking-wide border-b border-rd-navy/10">
              {dayLabel}
            </td>
          </tr>
          <tr>
            <th className="bg-rd-navy/5 text-left px-3 py-2 font-semibold text-rd-navy uppercase tracking-wide text-xs">
              Comp
            </th>
            <td className="text-center px-3 py-2 font-semibold uppercase tracking-wide">
              {comp}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function formatHiRange(div: DivisionConfig): string {
  // Treat a very-negative hiMin as "no lower bound" and a very-large hiMax as "no upper bound".
  const noLow = div.hiMin <= -100;
  const noHigh = div.hiMax >= 10000;
  if (noLow && noHigh) return 'all handicaps';
  if (noLow) return `up to ${div.hiMax}`;
  if (noHigh) return `${div.hiMin}+`;
  return `${div.hiMin} – ${div.hiMax}`;
}

function DivisionsLegend({ divisions }: { divisions: DivisionConfig[] }) {
  if (divisions.length === 0) return null;
  return (
    <div className="rd-card p-3 text-xs flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="font-semibold text-rd-navy uppercase tracking-wide">
        Divisions
      </span>
      {divisions.map((d) => (
        <span key={d.code} className="text-rd-ink/80 whitespace-nowrap">
          <span className="font-semibold">{d.name}</span>
          <span className="text-rd-ink/60"> · HI {formatHiRange(d)}</span>
          {d.format === 'stableford' && (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-rd-gold">
              Stableford
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
