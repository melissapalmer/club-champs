import { describe, expect, it } from 'vitest';
import type { Course } from '../types';
import type { PlayerLine } from './engine';
import {
  averageCumulativeSeries,
  averageStats,
  buildCumulativeSeries,
  buildPlayerStats,
  hasAnyHolePlayed,
} from './stats';

const par4Course: Course = {
  club: 'Test',
  event: 'Test',
  gender: 'women',
  maxHandicap: 36,
  eclecticHandicapPct: 25,
  tees: {
    yellow: { par: 72, women: { cr: 72, slope: 113 }, men: { cr: 72, slope: 113 } },
    white: { par: 72, women: { cr: 72, slope: 113 }, men: { cr: 72, slope: 113 } },
    blue: { par: 72, women: { cr: 72, slope: 113 }, men: { cr: 72, slope: 113 } },
    red: { par: 72, women: { cr: 72, slope: 113 }, men: { cr: 72, slope: 113 } },
  },
  divisions: [
    { code: 'A', name: 'A', tee: 'red', hiMin: -999, hiMax: 36, handicapPct: 100 },
  ],
  holes: Array.from({ length: 18 }, (_, i) => ({
    par: 4,
    siWomen: i + 1,
    siMen: i + 1,
  })),
};

function lineFrom(
  satHoles: (number | null)[],
  sunHoles: (number | null)[]
): PlayerLine {
  return {
    player: { firstName: 'P', lastName: 'L', saId: 'x', hi: 12 },
    division: par4Course.divisions[0],
    hc: 12,
    ph: 12,
    sat: { gross: null, net: null, holes: satHoles, stableford: null, stablefordHoles: [] },
    sun: { gross: null, net: null, holes: sunHoles, stableford: null, stablefordHoles: [] },
    overall: { gross: null, net: null, stableford: null },
    eclectic: { holes: [], gross: null, net: null },
  };
}

const ALL_NULL = Array(18).fill(null);
const ALL_4 = Array(18).fill(4);

describe('buildPlayerStats', () => {
  it('counts every par when both rounds are scored at par', () => {
    const line = lineFrom(ALL_4, ALL_4);
    expect(buildPlayerStats(line, par4Course)).toEqual({
      eaglesPlus: 0,
      birdies: 0,
      pars: 36,
      bogeys: 0,
      doubleBogeys: 0,
      triplePlus: 0,
    });
  });

  it('classifies each bucket boundary correctly', () => {
    // Sat: 1 (-3 albatross), 2 (-2 eagle), 3 (-1 birdie), 4 (par), 5 (+1 bogey),
    //      6 (+2 DB), 7 (+3 triple), 8 (+4 quad+), then pad with par to 18.
    const sat = [1, 2, 3, 4, 5, 6, 7, 8, ...Array(10).fill(4)];
    const line = lineFrom(sat, ALL_NULL);
    const c = buildPlayerStats(line, par4Course);
    expect(c.eaglesPlus).toBe(2);
    expect(c.birdies).toBe(1);
    expect(c.pars).toBe(11);
    expect(c.bogeys).toBe(1);
    expect(c.doubleBogeys).toBe(1);
    expect(c.triplePlus).toBe(2);
  });

  it('skips null holes', () => {
    const sat: (number | null)[] = [4, null, 4, ...Array(15).fill(4)];
    const line = lineFrom(sat, ALL_NULL);
    expect(buildPlayerStats(line, par4Course).pars).toBe(17);
  });
});

describe('hasAnyHolePlayed', () => {
  it('is false when both days are entirely null', () => {
    expect(hasAnyHolePlayed(lineFrom(ALL_NULL, ALL_NULL))).toBe(false);
  });

  it('is true when any single hole is entered', () => {
    const sat: (number | null)[] = [...Array(17).fill(null), 4];
    expect(hasAnyHolePlayed(lineFrom(sat, ALL_NULL))).toBe(true);
  });
});

describe('buildCumulativeSeries', () => {
  it('runs sums across both rounds when fully entered', () => {
    const line = lineFrom(ALL_4, ALL_4);
    const cum = buildCumulativeSeries(line);
    expect(cum).toHaveLength(36);
    expect(cum[0]).toBe(4);
    expect(cum[17]).toBe(72);
    expect(cum[35]).toBe(144);
  });

  it('stops (returns null) at and after the first unplayed hole', () => {
    const line = lineFrom(ALL_4, ALL_NULL);
    const cum = buildCumulativeSeries(line);
    expect(cum[17]).toBe(72);
    expect(cum[18]).toBeNull();
    expect(cum[35]).toBeNull();
  });
});

describe('averageStats', () => {
  it('excludes lines with no holes played', () => {
    const a = lineFrom(ALL_4, ALL_4);
    const empty = lineFrom(ALL_NULL, ALL_NULL);
    const avg = averageStats([a, empty], par4Course);
    expect(avg.pars).toBe(36); // average over only the contributor
  });

  it('returns zeros when no contributors', () => {
    expect(averageStats([], par4Course).pars).toBe(0);
  });
});

describe('averageCumulativeSeries', () => {
  it('averages only over contributors with a value at each index', () => {
    // a: full 36 holes at 4 → cumulative [4, 8, …, 144]
    // b: only Sat (Sun all null) → cumulative defined only for indices 0..17
    const a = lineFrom(ALL_4, ALL_4);
    const b = lineFrom(ALL_4, ALL_NULL);
    const avg = averageCumulativeSeries([a, b]);
    // index 0: both have 4 → mean 4
    expect(avg[0]).toBe(4);
    // index 17 (end of Sat): both have 72 → mean 72
    expect(avg[17]).toBe(72);
    // index 18 onward: only `a` contributes → equals a's value
    expect(avg[18]).toBe(76);
    expect(avg[35]).toBe(144);
  });

  it('is null at every index when no contributor has data there', () => {
    const empty = lineFrom(ALL_NULL, ALL_NULL);
    const avg = averageCumulativeSeries([empty]);
    expect(avg.every((v) => v == null)).toBe(true);
  });
});
