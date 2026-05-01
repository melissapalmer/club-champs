import { useEffect, useMemo, useState } from 'react';
import { Bracket } from '../components/Bracket';
import { Tabs } from '../components/Tabs';
import type { AppData } from '../data';
import { matchesForDivision } from '../scoring/matchPlay';
import { visibleDivisions } from '../scoring/engine';
import type { DivisionCode } from '../types';

/**
 * Public Match Play page. Each division that has Match Play enabled (or has
 * persisted matches) gets its own sub-tab; the active sub-tab renders that
 * division's bracket.
 */
export function MatchPlay({ data }: { data: AppData }) {
  const { course, players, matches } = data;
  const allDivs = visibleDivisions(course);

  // A division qualifies for the page if it's enabled OR has persisted matches
  // (handles "admin generated but didn't save the flag" / mid-rollout state).
  const mpDivs = useMemo(
    () =>
      allDivs.filter(
        (d) =>
          d.matchPlay?.enabled ||
          matches.some((m) => m.divisionCode === d.code)
      ),
    [allDivs, matches]
  );

  const [active, setActive] = useState<DivisionCode>(
    () => (mpDivs[0]?.code ?? allDivs[0]?.code ?? 'A') as DivisionCode
  );

  // Keep `active` valid as data refreshes (division added / removed).
  useEffect(() => {
    if (!mpDivs.find((d) => d.code === active) && mpDivs.length > 0) {
      setActive(mpDivs[0].code as DivisionCode);
    }
  }, [mpDivs, active]);

  if (mpDivs.length === 0) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Match Play</h1>
        <p className="text-sm text-rd-ink/70">
          Match Play is not enabled for any division. Admin can enable it
          per-division in Config.
        </p>
      </section>
    );
  }

  const activeDivision = mpDivs.find((d) => d.code === active);
  const activeMatches = matchesForDivision(matches, active);
  const headline = activeDivision?.matchPlay?.name ?? `${activeDivision?.name ?? active} Match Play`;

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Match Play</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Knockout bracket — single elimination, per division.
      </p>

      <Tabs
        tabs={mpDivs.map((d) => ({ id: d.code, label: d.name || `Division ${d.code}` }))}
        active={active}
        onChange={(id) => setActive(id as DivisionCode)}
      />

      <h2 className="text-lg text-rd-navy font-serif mt-2 mb-3">{headline}</h2>

      {activeMatches.length === 0 ? (
        <div className="rd-card p-6 text-center text-sm text-rd-ink/60">
          {activeDivision?.name ?? active} bracket not yet generated — admin can
          generate it in Config.
        </div>
      ) : (
        <Bracket matches={activeMatches} players={players} />
      )}
    </section>
  );
}
