import type { Course } from '../types';
import type { PlayerLine } from './engine';

export type PlayerStatCounts = {
  eaglesPlus: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  triplePlus: number;
};

export const STAT_KEYS = [
  'eaglesPlus',
  'birdies',
  'pars',
  'bogeys',
  'doubleBogeys',
  'triplePlus',
] as const satisfies readonly (keyof PlayerStatCounts)[];

export const STAT_LABELS: Record<keyof PlayerStatCounts, string> = {
  eaglesPlus: 'Eagles or better',
  birdies: 'Birdies',
  pars: 'Pars',
  bogeys: 'Bogeys',
  doubleBogeys: 'Double Bogeys',
  triplePlus: 'Triple or worse',
};

const ZERO: PlayerStatCounts = {
  eaglesPlus: 0,
  birdies: 0,
  pars: 0,
  bogeys: 0,
  doubleBogeys: 0,
  triplePlus: 0,
};

function bucketFor(diff: number): keyof PlayerStatCounts {
  if (diff <= -2) return 'eaglesPlus';
  if (diff === -1) return 'birdies';
  if (diff === 0) return 'pars';
  if (diff === 1) return 'bogeys';
  if (diff === 2) return 'doubleBogeys';
  return 'triplePlus';
}

export function buildPlayerStats(line: PlayerLine, course: Course): PlayerStatCounts {
  const counts: PlayerStatCounts = { ...ZERO };
  const both = [...line.sat.holes, ...line.sun.holes];
  for (let i = 0; i < both.length; i++) {
    const score = both[i];
    if (score == null || !Number.isFinite(score)) continue;
    const par = course.holes[i % 18]?.par;
    if (par == null) continue;
    counts[bucketFor(score - par)]++;
  }
  return counts;
}

export function hasAnyHolePlayed(line: PlayerLine): boolean {
  return (
    line.sat.holes.some((h) => h != null) ||
    line.sun.holes.some((h) => h != null)
  );
}

/**
 * Running gross strokes across both rounds (length 36; index 0 = after Sat hole 1,
 * index 17 = after Sat hole 18, index 35 = after Sun hole 18). Returns null at
 * every index from the first unplayed hole onward — the caller decides how to
 * render the gap (we use connectNulls={false}).
 */
export function buildCumulativeSeries(line: PlayerLine): (number | null)[] {
  const both = [...line.sat.holes, ...line.sun.holes];
  const out: (number | null)[] = new Array(both.length).fill(null);
  let running = 0;
  let stopped = false;
  for (let i = 0; i < both.length; i++) {
    if (stopped) {
      out[i] = null;
      continue;
    }
    const score = both[i];
    if (score == null || !Number.isFinite(score)) {
      stopped = true;
      out[i] = null;
      continue;
    }
    running += score;
    out[i] = running;
  }
  return out;
}

/** Mean count per bucket across lines that have played at least one hole. */
export function averageStats(
  lines: PlayerLine[],
  course: Course
): PlayerStatCounts {
  const contributors = lines.filter(hasAnyHolePlayed);
  if (contributors.length === 0) return { ...ZERO };
  const totals: PlayerStatCounts = { ...ZERO };
  for (const line of contributors) {
    const c = buildPlayerStats(line, course);
    for (const k of STAT_KEYS) totals[k] += c[k];
  }
  const out: PlayerStatCounts = { ...ZERO };
  for (const k of STAT_KEYS) out[k] = totals[k] / contributors.length;
  return out;
}

/**
 * Element-wise mean cumulative-strokes across lines, restricted at each index
 * to lines that have a value at that index. So at hole 30 the value is the
 * mean for whoever has actually reached hole 30. Indices with no contributor
 * are null (the line ends there).
 */
export function averageCumulativeSeries(
  lines: PlayerLine[]
): (number | null)[] {
  const series = lines.map(buildCumulativeSeries);
  const length = series[0]?.length ?? 36;
  const out: (number | null)[] = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    let n = 0;
    for (const s of series) {
      const v = s[i];
      if (v == null) continue;
      sum += v;
      n++;
    }
    out[i] = n > 0 ? sum / n : null;
  }
  return out;
}
