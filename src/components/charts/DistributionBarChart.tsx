import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STAT_KEYS, STAT_LABELS } from '../../scoring/stats';
import type { CountSeries } from './series';

/**
 * One bar per (bucket, series). For each of the 6 buckets, Recharts groups the
 * series side-by-side. The data row shape is
 *   { bucket: 'Eagles or better', [seriesA.key]: 3, [seriesB.key]: 2.4, … }
 */
export function DistributionBarChart({ series }: { series: CountSeries[] }) {
  const data = STAT_KEYS.map((k) => {
    const row: Record<string, string | number> = { bucket: STAT_LABELS[k] };
    for (const s of series) row[s.key] = round1(s.counts[k]);
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 231 235)" />
          <XAxis dataKey="bucket" tick={{ fill: 'currentColor', fontSize: 11 }} />
          <YAxis allowDecimals tick={{ fill: 'currentColor', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v: number) => v.toFixed(1)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
