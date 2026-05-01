import { fullName } from '../format';
import type { Course, DivisionFormat, TeeTime, TeeTimeConfig } from '../types';
import { rankWithCountOut, visibleDivisions, type PlayerLine } from './engine';

/** Sensible defaults used when `course.teeTimes` is missing. Disabled by default
 *  so existing courses don't see the new tab/nav unless the admin opts in. */
export const DEFAULT_TEE_TIMES: TeeTimeConfig = {
  enabled: false,
  groupSize: 4,
  intervalMinutes: 10,
  day1Start: '08:00',
  day2Start: '08:00',
};

/**
 * Add `mins` minutes to a "HH:MM" 24-hour string. Returned format is also
 * "HH:MM" with zero padding. Wraps modulo 24h — clubs don't tee off across
 * midnight in practice, but wrapping keeps the function total.
 */
export function addMinutes(hhmm: string, mins: number): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const totalMins = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  const outH = Math.floor(totalMins / 60);
  const outM = totalMins % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

const DEFAULT_FORMAT: DivisionFormat = 'medal';

/**
 * Day-1 by HI ascending (best players first — lowest HI off the first tee);
 * Day-2 by Day-1 standing (worst → best, so leaders come home in the last group).
 */
function sortLinesForDay(
  day: 1 | 2,
  lines: PlayerLine[],
  course: Course
): PlayerLine[] {
  if (day === 1) {
    return [...lines].sort((a, b) => a.player.hi - b.player.hi);
  }
  // Day 2: rank within this exact list by Day-1 metric, then sort by rank desc.
  // We pick the metric off the first line's division (all lines in the slice
  // we're called with share a division — the caller groups by division code
  // before calling).
  const format: DivisionFormat = lines[0]?.division?.format ?? DEFAULT_FORMAT;
  const metric: 'net' | 'stableford' = format === 'stableford' ? 'stableford' : 'net';
  const ranks = rankWithCountOut(lines, { kind: 'day', day: 1, metric }, course);
  const indexed = lines.map((l, i) => ({ l, rank: ranks[i].pos }));
  indexed.sort((a, b) => {
    // DNS (null rank) plays first within the division.
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return -1;
    if (b.rank == null) return 1;
    // Higher rank-number = worse score → off first; rank 1 = best → off last.
    return b.rank - a.rank;
  });
  return indexed.map((x) => x.l);
}

/** Codes ordered D, C, B, A so the highest-letter division goes off first within a block. */
function divisionsByCodeDesc(course: Course) {
  return visibleDivisions(course)
    .slice()
    .sort((a, b) => b.code.localeCompare(a.code));
}

function divisionFormatOf(line: PlayerLine): DivisionFormat {
  return line.division?.format ?? DEFAULT_FORMAT;
}

/**
 * Generate a draw for one day from the current state.
 *
 * Field ordering:
 *   - Format blocks (stableford first, medal last). Format boundary is HARD —
 *     no group ever mixes a stableford and medal player.
 *   - Within a block, divisions are ordered by code descending (D, C, B, A).
 *     Division boundary inside a block is SOFT — a leftover from one division
 *     fills with the highest-HI/worst-rank players of the next division.
 *   - Within a division, Day 1 = HI asc (best players off first);
 *     Day 2 = worst-rank-first (DNS first; leaders home in the last group).
 *
 * Hidden divisions and players without a division are skipped.
 *
 * Last group of each block may be partial.
 */
export function generateDraw(
  day: 1 | 2,
  lines: PlayerLine[],
  course: Course,
  config: TeeTimeConfig
): TeeTime[] {
  const eligible = lines.filter((l) => l.division != null);
  const stableford = eligible.filter((l) => divisionFormatOf(l) === 'stableford');
  const medal = eligible.filter((l) => divisionFormatOf(l) === 'medal');

  // Order each format block by [division desc, then sortLinesForDay within division],
  // packing flat across the division boundary inside the block.
  const orderBlock = (block: PlayerLine[]): PlayerLine[] => {
    const out: PlayerLine[] = [];
    for (const div of divisionsByCodeDesc(course)) {
      const slice = block.filter((l) => l.division?.code === div.code);
      if (slice.length === 0) continue;
      out.push(...sortLinesForDay(day, slice, course));
    }
    return out;
  };

  const stablefordOrdered = orderBlock(stableford);
  const medalOrdered = orderBlock(medal);

  const startTime = day === 1 ? config.day1Start : config.day2Start;
  const groupSize = config.groupSize;
  const interval = config.intervalMinutes;

  const teeTimes: TeeTime[] = [];
  let groupIdx = 0;

  // Each format block packs into its OWN groups — the medal block always
  // starts a fresh group at the next interval, never sharing a group with
  // the tail of the stableford block.
  for (const blockOrdered of [stablefordOrdered, medalOrdered]) {
    for (let i = 0; i < blockOrdered.length; i += groupSize) {
      const group = blockOrdered.slice(i, i + groupSize);
      const time = addMinutes(startTime, groupIdx * interval);
      for (const line of group) {
        teeTimes.push({
          day,
          time,
          saId: line.player.saId,
          name: fullName(line.player),
        });
      }
      groupIdx += 1;
    }
  }

  return teeTimes;
}
