import type { PlayerLine, RankScope } from './scoring/engine';
import type { PrizeAward, PrizeCategory } from './types';

export const PRIZE_CATEGORIES: PrizeCategory[] = [
  'satGross',
  'satNet',
  'sunGross',
  'sunNet',
  'overallGross',
  'overallNet',
  'eclectic',
];

export const PRIZE_LABELS: Record<PrizeCategory, string> = {
  satGross: 'Saturday Gross',
  satNet: 'Saturday Net',
  sunGross: 'Sunday Gross',
  sunNet: 'Sunday Net',
  overallGross: 'Overall Gross',
  overallNet: 'Overall Net',
  eclectic: 'Eclectic (Net)',
};

export const PRIZE_PICK: Record<PrizeCategory, (l: PlayerLine) => number | null> = {
  satGross: (l) => l.sat.gross,
  satNet: (l) => l.sat.net,
  sunGross: (l) => l.sun.gross,
  sunNet: (l) => l.sun.net,
  overallGross: (l) => l.overall.gross,
  overallNet: (l) => l.overall.net,
  eclectic: (l) => l.eclectic.net,
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
};

export const DEFAULT_TOP_N = 2;

/** When a division has no `prizes` set, award top 2 across every category. */
export function defaultAwards(): PrizeAward[] {
  return PRIZE_CATEGORIES.map((category) => ({ category, topN: DEFAULT_TOP_N }));
}
