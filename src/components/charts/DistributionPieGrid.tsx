import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { STAT_KEYS, STAT_LABELS } from '../../scoring/stats';
import { bucketColors } from './palette';
import type { CountSeries } from './series';

/**
 * Small-multiples grid: one pie per active series. Bucket colours stay
 * consistent across pies (an Eagle slice is always navy); the per-series
 * identity comes from the title above each pie. Empty pies (a comparison
 * series with all-zero counts) are skipped.
 */
export function DistributionPieGrid({ series }: { series: CountSeries[] }) {
  const colors = bucketColors();
  const renderable = series.filter((s) =>
    STAT_KEYS.some((k) => s.counts[k] > 0)
  );

  if (renderable.length === 0) {
    return (
      <p className="text-sm text-rd-ink/50 text-center py-6">
        No scored holes yet.
      </p>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
      }}
    >
      {renderable.map((s) => {
        const data = STAT_KEYS.map((k) => ({
          key: k,
          name: STAT_LABELS[k],
          value: round1(s.counts[k]),
        })).filter((d) => d.value > 0);
        return (
          <div key={s.key} className="text-center">
            <div className="text-sm font-medium text-rd-navy mb-1">{s.label}</div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    isAnimationActive={false}
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.key}
                        fill={colors[d.key as keyof typeof colors]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: number) => v.toFixed(1)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
