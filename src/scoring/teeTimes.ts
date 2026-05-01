import { fullName } from '../format';
import type { Course, DivisionFormat, DrawOrder, TeeTime, TeeTimeConfig } from '../types';
import { rankWithCountOut, visibleDivisions, type PlayerLine } from './engine';

/** Sensible defaults used when `course.teeTimes` is missing. Disabled by default
 *  so existing courses don't see the new tab/nav unless the admin opts in. */
export const DEFAULT_TEE_TIMES: TeeTimeConfig = {
  enabled: false,
  groupSize: 4,
  intervalMinutes: 10,
  day1Start: '08:00',
  day2Start: '08:00',
  day1Order: 'best-first',
  day2Order: 'worst-first',
};

const DEFAULT_DAY1_ORDER: DrawOrder = 'best-first';
const DEFAULT_DAY2_ORDER: DrawOrder = 'worst-first';

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
 * Sort one division's lines by the day's metric, biased by `order`:
 *   - 'best-first':  best score → first (lowest HI on Day 1; rank 1 on Day 2)
 *   - 'worst-first': worst score → first (highest HI on Day 1; worst rank on Day 2)
 * On Day 2, DNS players (no Day-1 score) always tee off at the front of their
 * division — both because they have no standing to slot in by, and because
 * pairing them with mid-field groups would disrupt the rest of the order.
 */
function sortLinesForDay(
  day: 1 | 2,
  lines: PlayerLine[],
  course: Course,
  order: DrawOrder
): PlayerLine[] {
  if (day === 1) {
    return [...lines].sort((a, b) =>
      order === 'best-first' ? a.player.hi - b.player.hi : b.player.hi - a.player.hi
    );
  }
  const format: DivisionFormat = lines[0]?.division?.format ?? DEFAULT_FORMAT;
  const metric: 'net' | 'stableford' = format === 'stableford' ? 'stableford' : 'net';
  const ranks = rankWithCountOut(lines, { kind: 'day', day: 1, metric }, course);
  const indexed = lines.map((l, i) => ({ l, rank: ranks[i].pos }));
  indexed.sort((a, b) => {
    // DNS first regardless of order.
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return -1;
    if (b.rank == null) return 1;
    return order === 'best-first' ? a.rank - b.rank : b.rank - a.rank;
  });
  return indexed.map((x) => x.l);
}

/** Divisions in code order, asc or desc. 'best-first' → A,B,C,D; 'worst-first' → D,C,B,A. */
function divisionsByOrder(course: Course, order: DrawOrder) {
  const sorted = visibleDivisions(course).slice();
  sorted.sort((a, b) =>
    order === 'best-first' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code)
  );
  return sorted;
}

function divisionFormatOf(line: PlayerLine): DivisionFormat {
  return line.division?.format ?? DEFAULT_FORMAT;
}

/**
 * Generate a draw for one day from the current state.
 *
 * Field ordering follows the day's `DrawOrder` end-to-end:
 *   - 'best-first':  divisions A→D, best→worst within division (A-scratch
 *                    tees off in the first group).
 *   - 'worst-first': divisions D→A, worst→best within division (A-scratch
 *                    tees off in the last group — leaders home last).
 * Division boundary is SOFT — a leftover from one division fills with the
 * next division's leading players, except across a format boundary: stableford
 * and medal players never share a group, so we flush to a fresh group whenever
 * the next player's format differs.
 *
 * Day 2 additionally puts DNS players (no Day-1 score) at the very front of
 * their division regardless of order — they have no standing to slot in by.
 *
 * Hidden divisions and players without a division are skipped.
 *
 * The last group at each format boundary may be partial.
 */
export function generateDraw(
  day: 1 | 2,
  lines: PlayerLine[],
  course: Course,
  config: TeeTimeConfig
): TeeTime[] {
  const order: DrawOrder =
    day === 1
      ? config.day1Order ?? DEFAULT_DAY1_ORDER
      : config.day2Order ?? DEFAULT_DAY2_ORDER;

  const eligible = lines.filter((l) => l.division != null);
  const orderedDivs = divisionsByOrder(course, order);

  // Build the full field in division order, sorted within each division.
  const fieldOrdered: PlayerLine[] = [];
  for (const div of orderedDivs) {
    const slice = eligible.filter((l) => l.division?.code === div.code);
    if (slice.length === 0) continue;
    fieldOrdered.push(...sortLinesForDay(day, slice, course, order));
  }

  const startTime = day === 1 ? config.day1Start : config.day2Start;
  const groupSize = config.groupSize;
  const interval = config.intervalMinutes;

  const teeTimes: TeeTime[] = [];
  let groupIdx = 0;
  let pending: PlayerLine[] = [];
  let pendingFormat: DivisionFormat | null = null;

  const flush = () => {
    if (pending.length === 0) return;
    const time = addMinutes(startTime, groupIdx * interval);
    for (const line of pending) {
      teeTimes.push({ day, time, saId: line.player.saId, name: fullName(line.player) });
    }
    groupIdx += 1;
    pending = [];
    pendingFormat = null;
  };

  for (const line of fieldOrdered) {
    const lineFormat = divisionFormatOf(line);
    if (pendingFormat != null && pendingFormat !== lineFormat) {
      // Format boundary: never mix in the same group.
      flush();
    }
    pending.push(line);
    pendingFormat = lineFormat;
    if (pending.length === groupSize) flush();
  }
  flush();

  return teeTimes;
}
