import type { PlayerLine, RankScope } from './scoring/engine';
import type { DivisionFormat, PrizeAward, PrizeCategory } from './types';

export const PRIZE_CATEGORIES: PrizeCategory[] = [
  'satGross',
  'satNet',
  'sunGross',
  'sunNet',
  'overallGross',
  'overallNet',
  'eclectic',
  'satStableford',
  'sunStableford',
  'overallStableford',
];

export const PRIZE_LABELS: Record<PrizeCategory, string> = {
  satGross: 'Saturday Gross',
  satNet: 'Saturday Net',
  sunGross: 'Sunday Gross',
  sunNet: 'Sunday Net',
  overallGross: 'Overall Gross',
  overallNet: 'Overall Net',
  eclectic: 'Eclectic (Net)',
  satStableford: 'Saturday Stableford',
  sunStableford: 'Sunday Stableford',
  overallStableford: 'Overall Stableford',
};

export const PRIZE_PICK: Record<PrizeCategory, (l: PlayerLine) => number | null> = {
  satGross: (l) => l.sat.gross,
  satNet: (l) => l.sat.net,
  sunGross: (l) => l.sun.gross,
  sunNet: (l) => l.sun.net,
  overallGross: (l) => l.overall.gross,
  overallNet: (l) => l.overall.net,
  eclectic: (l) => l.eclectic.net,
  satStableford: (l) => l.sat.stableford,
  sunStableford: (l) => l.sun.stableford,
  overallStableford: (l) => l.overall.stableford,
};

/** Scope used to drive count-out tie-breaking for each prize category. */
export const PRIZE_SCOPE: Record<PrizeCategory, RankScope> = {
  satGross: { kind: 'day', day: 1, metric: 'gross' },
  satNet: { kind: 'day', day: 1, metric: 'net' },
  sunGross: { kind: 'day', day: 2, metric: 'gross' },
  sunNet: { kind: 'day', day: 2, metric: 'net' },
  overallGross: { kind: 'overall', metric: 'gross' },
  overallNet: { kind: 'overall', metric: 'net' },
  eclectic: { kind: 'eclectic', metric: 'net' },
  satStableford: { kind: 'day', day: 1, metric: 'stableford' },
  sunStableford: { kind: 'day', day: 2, metric: 'stableford' },
  overallStableford: { kind: 'overall', metric: 'stableford' },
};

/**
 * Categories that make sense for each format. Drives Config's PrizesEditor
 * and `defaultAwards`. Stableford divisions exclude net + eclectic; medal
 * divisions exclude the stableford trio.
 */
export const CATEGORIES_FOR_FORMAT: Record<DivisionFormat, PrizeCategory[]> = {
  medal: ['satGross', 'satNet', 'sunGross', 'sunNet', 'overallGross', 'overallNet', 'eclectic'],
  stableford: ['satStableford', 'sunStableford', 'overallStableford'],
};

export const DEFAULT_TOP_N = 2;

/**
 * When a division has no `prizes` set, award top 2 across every category
 * applicable to the division's format. Medal divisions get gross + net +
 * eclectic; stableford divisions get the three stableford categories only.
 */
export function defaultAwards(format: DivisionFormat = 'medal'): PrizeAward[] {
  return CATEGORIES_FOR_FORMAT[format].map((category) => ({
    category,
    topN: DEFAULT_TOP_N,
  }));
}
