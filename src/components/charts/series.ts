import type { PlayerStatCounts } from '../../scoring/stats';

export type CountSeries = {
  key: string;
  label: string;
  color: string;
  counts: PlayerStatCounts;
};

export type CumulativeSeries = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
};
