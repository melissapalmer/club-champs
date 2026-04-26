import { describe, expect, it } from 'vitest';
import {
  buildPlayerLines,
  courseHandicap,
  dayTotals,
  divisionFor,
  eclecticGross,
  eclecticNet,
  playingHandicap,
  rankWithTies,
} from './engine';
import type { Course, DayScore, Player } from '../types';

const course: Course = {
  club: 'Royal Durban Golf Club',
  event: '2026 Ladies Club Champs',
  gender: 'women',
  maxHandicap: 36,
  eclecticHandicapPct: 25,
  tees: {
    yellow: { par: 72, cr: 72.7, slope: 124 },
    white: { par: 72, cr: 77.7, slope: 137 },
    blue: { par: 72, cr: 75, slope: 130 },
    red: { par: 72, cr: 72.7, slope: 123 },
  },
  divisions: [
    { code: 'A', name: 'Gold', tee: 'red', hiMin: -999, hiMax: 6.5, handicapPct: 100 },
    { code: 'B', name: 'Silver', tee: 'red', hiMin: 6.6, hiMax: 15.3, handicapPct: 100 },
    { code: 'C', name: 'Bronze', tee: 'red', hiMin: 15.4, hiMax: 10001, handicapPct: 100 },
  ],
};

// Hole-by-hole values copied directly from `Eclectic B` row 5 (Kay Dunkley) of the spreadsheet.
const KAY_DAY1 = [6, 5, 6, 6, 5, 3, 6, 5, 5, 7, 4, 4, 4, 4, 5, 4, 5, 7];
const KAY_DAY2 = [5, 4, 5, 5, 7, 4, 5, 5, 5, 6, 8, 3, 6, 4, 6, 4, 6, 7];

describe('courseHandicap', () => {
  it('matches the Excel formula MIN((HI*Slope/113)+(CR-Par), MaxHC)', () => {
    // Kay (HI 14.2, Red tees): (14.2 * 123/113) + (72.7 - 72) ≈ 16.156
    expect(courseHandicap(14.2, 123, 72.7, 72, 36)).toBeCloseTo(16.1566, 3);
  });

  it('caps at the max handicap', () => {
    // Rene Ladell HI 33: (33 * 123/113) + 0.7 ≈ 36.62 → capped to 36
    expect(courseHandicap(33, 123, 72.7, 72, 36)).toBe(36);
  });
});

describe('playingHandicap', () => {
  it('rounds HC * pct/100 to nearest whole', () => {
    expect(playingHandicap(16.1566, 100)).toBe(16);
    expect(playingHandicap(13.108, 100)).toBe(13);
    expect(playingHandicap(1.7885, 100)).toBe(2);
  });

  it('respects the handicap percentage', () => {
    // Used by men's Div A which historically applies 25%
    expect(playingHandicap(16.1566, 25)).toBe(4);
  });
});

describe('divisionFor', () => {
  it('places by HI when no override', () => {
    const kay: Player = { firstName: 'KAY', lastName: 'D', saId: '1', hi: 14.2 };
    expect(divisionFor(kay, course)?.code).toBe('B');
  });

  it('honours an explicit override (Tara@HI 1 plays in Silver this year)', () => {
    const tara: Player = {
      firstName: 'TARA',
      lastName: 'S',
      saId: '2',
      hi: 1,
      divisionOverride: 'B',
    };
    expect(divisionFor(tara, course)?.code).toBe('B');
  });
});

describe('dayTotals', () => {
  it('returns out/in/gross when all 18 holes are entered', () => {
    expect(dayTotals(KAY_DAY1)).toEqual({ out: 47, in: 44, gross: 91 });
    expect(dayTotals(KAY_DAY2)).toEqual({ out: 45, in: 50, gross: 95 });
  });

  it('returns nulls when any hole is missing', () => {
    const partial = [...KAY_DAY1];
    partial[5] = null as unknown as number;
    const t = dayTotals(partial);
    expect(t.out).toBeNull();
    expect(t.gross).toBeNull();
  });
});

describe('eclectic', () => {
  it('sums per-hole min(d1, d2) — matches Eclectic B row 5 (Kay = 84)', () => {
    expect(eclecticGross(KAY_DAY1, KAY_DAY2)).toBe(84);
  });

  it('subtracts 25% of PH for net — matches Eclectic B BT5 (Kay = 80)', () => {
    expect(eclecticNet(84, 16, 25)).toBe(80);
  });

  it('returns null if any hole is missing on either day', () => {
    const partial = [...KAY_DAY1];
    partial[0] = null as unknown as number;
    expect(eclecticGross(partial, KAY_DAY2)).toBeNull();
  });
});

describe('rankWithTies', () => {
  it('shares ranks for ties and skips the next position (1, 2, 2, 4)', () => {
    expect(rankWithTies([90, 80, 80, 100])).toEqual([3, 1, 1, 4]);
  });

  it('leaves nulls as null', () => {
    expect(rankWithTies([90, null, 80])).toEqual([2, null, 1]);
  });
});

describe('buildPlayerLines (Kay, end to end)', () => {
  const kay: Player = {
    firstName: 'KAY',
    lastName: 'DUNKLEY',
    saId: '2700149294',
    hi: 14.2,
  };
  const scores: DayScore[] = [
    { saId: kay.saId, day: 1, holes: KAY_DAY1 },
    { saId: kay.saId, day: 2, holes: KAY_DAY2 },
  ];
  const [line] = buildPlayerLines([kay], scores, course);

  it('places Kay in Silver', () => {
    expect(line.division?.code).toBe('B');
  });

  it('computes HC ≈ 16.16 and PH = 16', () => {
    expect(line.hc).toBeCloseTo(16.1566, 3);
    expect(line.ph).toBe(16);
  });

  it('computes per-day gross and net to match the spreadsheet', () => {
    expect(line.sat.gross).toBe(91);
    expect(line.sat.net).toBe(75);
    expect(line.sun.gross).toBe(95);
    expect(line.sun.net).toBe(79);
  });

  it('computes overall to match the spreadsheet (gross 186, net 154)', () => {
    expect(line.overall.gross).toBe(186);
    expect(line.overall.net).toBe(154);
  });

  it('computes eclectic to match the spreadsheet (gross 84, net 80)', () => {
    expect(line.eclectic.gross).toBe(84);
    expect(line.eclectic.net).toBe(80);
  });
});
