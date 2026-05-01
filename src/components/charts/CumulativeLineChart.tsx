import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CumulativeSeries } from './series';

const HOLE_COUNT = 36;
const TICKS = [1, 9, 18, 27, 36];

/**
 * Running gross strokes across both rounds (1..36). Series with a `null` at
 * any index leave a real gap (`connectNulls={false}`); the comparison series
 * are pre-trimmed so each point is averaged only over contributors who reached
 * that hole.
 */
export function CumulativeLineChart({ series }: { series: CumulativeSeries[] }) {
  const data = Array.from({ length: HOLE_COUNT }, (_, i) => {
    const row: Record<string, number | null> = { hole: i + 1 };
    for (const s of series) row[s.key] = roundOrNull(s.values[i]);
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 231 235)" />
          <XAxis
            dataKey="hole"
            type="number"
            domain={[1, HOLE_COUNT]}
            ticks={TICKS}
            tick={{ fill: 'currentColor', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: 'currentColor', fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(label) => `Hole ${label}`}
            formatter={(v: number) => v?.toFixed(0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            x={18}
            stroke="rgb(156 163 175)"
            strokeDasharray="4 4"
            label={{ value: 'End of Sat', position: 'insideTop', fontSize: 10, fill: 'rgb(107 114 128)' }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function roundOrNull(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v);
}
