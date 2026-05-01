import { useMemo } from 'react';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import { defaultAwards, PRIZE_LABELS, PRIZE_PICK, PRIZE_SCOPE } from '../prizes';
import {
  buildPlayerLines,
  linesByDivision,
  rankWithCountOut,
  visibleDivisions,
  type PlayerLine,
  type RankResult,
} from '../scoring/engine';
import { resolveAssetUrl } from '../theme';
import type { Course, DivisionConfig, PrizeCategory } from '../types';

function podium(
  lines: PlayerLine[],
  category: PrizeCategory,
  topN: number,
  course: Course
) {
  const ranks = rankWithCountOut(lines, PRIZE_SCOPE[category], course);
  const pick = PRIZE_PICK[category];
  const all = lines
    .map((line, i) => ({ line, value: pick(line), rank: ranks[i] }))
    .filter((r) => r.rank.pos != null);

  // Count-out gives the winner the higher slot; the tied loser drops to the
  // next slot. Effective pos = winner's pos + 1 for losers, otherwise = pos.
  // Drop losers only when their effective pos falls outside topN — so a
  // top-3 prize with a tie at pos 2 still awards three places.
  const posWithCountOutWinner = new Set(
    all.filter((r) => r.rank.brokenByCountOut).map((r) => r.rank.pos)
  );
  const withEffective = all.map((r) => ({
    ...r,
    effectivePos:
      posWithCountOutWinner.has(r.rank.pos) && !r.rank.brokenByCountOut
        ? (r.rank.pos as number) + 1
        : (r.rank.pos as number),
  }));

  return withEffective
    .filter((r) => r.effectivePos <= topN)
    .sort((a, b) => a.effectivePos - b.effectivePos);
}

function PosBadge({ rank }: { rank: RankResult }) {
  if (rank.pos == null) return null;
  return (
    <>
      {rank.tied && 'T'}
      {rank.pos}.
    </>
  );
}

function CountOutBadge() {
  return (
    <span
      className="ml-1.5 align-middle text-[10px] uppercase tracking-wide px-1 rounded bg-rd-gold/20 text-rd-navy"
      title="Won the count-out tie-break"
    >
      c/o
    </span>
  );
}

function DivisionResults({
  division,
  lines,
  course,
}: {
  division: DivisionConfig;
  lines: PlayerLine[];
  course: Course;
}) {
  const awards = division.prizes?.awards ?? defaultAwards(division.format);

  return (
    <div className="rd-card overflow-hidden">
      <h2 className="text-base uppercase tracking-wide text-center py-2 px-2 text-rd-navy font-sans font-semibold border-b-2 border-rd-gold">
        {division.name} Division
      </h2>
      {awards.length === 0 ? (
        <p className="text-sm text-rd-ink/50 p-4">No prizes configured for this division.</p>
      ) : (
        <div className="space-y-3 p-3">
          {awards.map(({ category, topN }) => {
            const winners = podium(lines, category, topN, course);
            return (
              <div key={category} className="border border-rd-navy/30 rounded overflow-hidden">
                <h3 className="text-xs uppercase tracking-wide text-center py-1 px-2 bg-rd-navy/10 text-rd-navy font-sans font-semibold border-b border-rd-navy/30">
                  {PRIZE_LABELS[category]}
                </h3>
                {winners.length === 0 ? (
                  <p className="text-sm text-rd-ink/50 px-2 py-1">—</p>
                ) : (
                  <ol>
                    {winners.map((w, idx) => (
                      <li
                        key={w.line.player.saId}
                        className={`flex items-baseline justify-between text-sm px-2 py-1 ${
                          idx > 0 ? 'border-t border-rd-navy/15' : ''
                        }`}
                      >
                        <span>
                          <span className="font-semibold text-rd-gold mr-2 whitespace-nowrap">
                            <PosBadge rank={w.rank} />
                          </span>
                          {fullName(w.line.player)}
                          {w.rank.brokenByCountOut && <CountOutBadge />}
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
  const divs = visibleDivisions(course);

  // One column per division on wide screens; collapse to fewer columns
  // on narrower viewports so cards stay readable.
  const gridCols =
    divs.length >= 4
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      : divs.length === 3
        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        : divs.length === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1';

  const logoUrl =
    resolveAssetUrl(course.branding?.logoUrl) ?? resolveAssetUrl('royal-durban-logo.webp');

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-4 flex items-center gap-3">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={course.club ?? 'Club logo'}
            className="h-14 w-auto shrink-0"
            // Tint the navy/cream-on-transparent logo to rd-navy so it stays
            // visible on the cream page body (it was designed for the dark header).
            style={{
              filter:
                'brightness(0) saturate(100%) invert(13%) sepia(86%) saturate(2200%) hue-rotate(216deg) brightness(95%) contrast(95%)',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <span>
          {course.club ? `${course.club} — ` : ''}
          {course.event} Winners
        </span>
      </h1>
      <div className={`grid gap-4 ${gridCols}`}>
        {divs.map((d) => (
          <DivisionResults
            key={d.code}
            division={d}
            lines={byDiv.get(d.code) ?? []}
            course={course}
          />
        ))}
      </div>
    </section>
  );
}
