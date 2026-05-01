import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ComparisonControls, type ComparisonState } from '../components/charts/ComparisonControls';
import { CumulativeLineChart } from '../components/charts/CumulativeLineChart';
import { DistributionBarChart } from '../components/charts/DistributionBarChart';
import { DistributionPieGrid } from '../components/charts/DistributionPieGrid';
import { seriesColor } from '../components/charts/palette';
import type { CountSeries, CumulativeSeries } from '../components/charts/series';
import type { AppData } from '../data';
import { fullName } from '../format';
import { buildPlayerLines, type PlayerLine } from '../scoring/engine';
import {
  STAT_KEYS,
  STAT_LABELS,
  averageCumulativeSeries,
  averageStats,
  buildCumulativeSeries,
  buildPlayerStats,
  hasAnyHolePlayed,
} from '../scoring/stats';

export function StatsPlayer({ data }: { data: AppData }) {
  const { course, players, scores } = data;
  const { saId } = useParams<{ saId: string }>();

  const lines = useMemo(
    () => buildPlayerLines(players, scores, course),
    [players, scores, course]
  );
  const playedLines = useMemo(() => lines.filter(hasAnyHolePlayed), [lines]);

  const self = useMemo(
    () => playedLines.find((l) => l.player.saId === saId),
    [playedLines, saId]
  );

  const [comparison, setComparison] = useState<ComparisonState>({
    eventAvg: false,
    divisionAvg: false,
    otherSaIds: [],
  });

  const divisionPeers = useMemo<PlayerLine[]>(() => {
    if (!self?.division) return [];
    return playedLines.filter(
      (l) => l.division?.code === self.division?.code
    );
  }, [playedLines, self]);

  const { countsSeries, cumulativeSeries } = useMemo(() => {
    if (!self) return { countsSeries: [] as CountSeries[], cumulativeSeries: [] as CumulativeSeries[] };

    const counts: CountSeries[] = [];
    const cum: CumulativeSeries[] = [];
    let i = 0;
    const push = (key: string, label: string, line: PlayerLine | null, avgSource: PlayerLine[] | null) => {
      const color = seriesColor(i++);
      if (line) {
        counts.push({ key, label, color, counts: buildPlayerStats(line, course) });
        cum.push({ key, label, color, values: buildCumulativeSeries(line) });
      } else if (avgSource) {
        counts.push({ key, label, color, counts: averageStats(avgSource, course) });
        cum.push({ key, label, color, values: averageCumulativeSeries(avgSource) });
      }
    };

    push('self', fullName(self.player), self, null);
    if (comparison.eventAvg) push('event', 'Event average', null, playedLines);
    if (comparison.divisionAvg && self.division) {
      push('division', `${self.division.name} average`, null, divisionPeers);
    }
    for (const otherId of comparison.otherSaIds) {
      const other = playedLines.find((l) => l.player.saId === otherId);
      if (other) push(`p:${otherId}`, fullName(other.player), other, null);
    }
    return { countsSeries: counts, cumulativeSeries: cum };
  }, [self, comparison, playedLines, divisionPeers, course]);

  if (!saId) return <Navigate to="/stats" replace />;
  if (!self) return <Navigate to="/stats" replace />;

  const ownCounts = countsSeries[0]?.counts;

  return (
    <section className="space-y-4">
      <div>
        <Link
          to="/stats"
          className="text-sm text-rd-navy/70 hover:text-rd-navy hover:underline"
        >
          ← Back to Stats
        </Link>
      </div>

      <div className="rd-card p-4 sm:p-5">
        <h1 className="text-2xl text-rd-navy">{fullName(self.player)}</h1>
        <div className="text-sm text-rd-ink/60 mb-4">
          {self.division?.name ?? 'No division'}
        </div>
        {ownCounts && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            {STAT_KEYS.map((k) => (
              <div key={k} className="bg-rd-cream/50 rounded p-2">
                <div className="text-2xl font-semibold text-rd-navy tabular-nums">
                  {ownCounts[k]}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-rd-ink/60 mt-0.5">
                  {STAT_LABELS[k]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ComparisonControls
        selfSaId={self.player.saId}
        hasDivision={!!self.division}
        candidateLines={playedLines}
        value={comparison}
        onChange={setComparison}
      />

      <div className="rd-card p-3 sm:p-4">
        <h2 className="text-base font-semibold text-rd-navy mb-2">
          Score distribution
        </h2>
        <DistributionBarChart series={countsSeries} />
      </div>

      <div className="rd-card p-3 sm:p-4">
        <h2 className="text-base font-semibold text-rd-navy mb-2">
          Cumulative gross strokes
        </h2>
        <CumulativeLineChart series={cumulativeSeries} />
      </div>

      <div className="rd-card p-3 sm:p-4">
        <h2 className="text-base font-semibold text-rd-navy mb-2">
          Distribution by series
        </h2>
        <DistributionPieGrid series={countsSeries} />
      </div>
    </section>
  );
}
