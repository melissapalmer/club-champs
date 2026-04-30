import { describe, expect, it } from 'vitest';
import {
  buildPlayerLines,
  countOutSegmentValue,
  courseHandicap,
  dayTotals,
  DEFAULT_COUNT_OUT_STEPS,
  divisionFor,
  eclecticGross,
  eclecticNet,
  playingHandicap,
  rankWithCountOut,
  rankWithTies,
  type PlayerLine,
} from './engine';
import type { Course, DayScore, Player } from '../types';

const course: Course = {
  club: 'Royal Durban Golf Club',
  event: '2026 Ladies Club Champs',
  gender: 'women',
  maxHandicap: 36,
  eclecticHandicapPct: 25,
  tees: {
    yellow: {
      par: 72,
      women: { cr: 72.7, slope: 124 },
      men: { cr: 79.0, slope: 136 },
    },
    white: {
      par: 72,
      women: { cr: 77.7, slope: 137 },
      men: { cr: 71.6, slope: 119 },
    },
    blue: {
      par: 72,
      women: { cr: 75.0, slope: 130 },
      men: { cr: 68.7, slope: 116 },
    },
    red: {
      par: 72,
      women: { cr: 72.7, slope: 123 },
      men: { cr: 67.0, slope: 111 },
    },
  },
  divisions: [
    { code: 'A', name: 'Gold', tee: 'red', hiMin: -999, hiMax: 6.5, handicapPct: 100 },
    { code: 'B', name: 'Silver', tee: 'red', hiMin: 6.6, hiMax: 15.3, handicapPct: 100 },
    { code: 'C', name: 'Bronze', tee: 'red', hiMin: 15.4, hiMax: 10001, handicapPct: 100 },
  ],
  holes: Array.from({ length: 18 }, (_, i) => ({
    par: 4,
    siWomen: i + 1,
    siMen: i + 1,
  })),
};

// Hole-by-hole values copied directly from `Eclectic B` row 5 (Kay Dunkley) of the spreadsheet.
const KAY_DAY1 = [6, 5, 6, 6, 5, 3, 6, 5, 5, 7, 4, 4, 4, 4, 5, 4, 5, 7];
const KAY_DAY2 = [5, 4, 5, 5, 7, 4, 5, 5, 5, 6, 8, 3, 6, 4, 6, 4, 6, 7];

describe('courseHandicap', () => {
  it('matches the Excel formula MIN((HI*Slope/113)+(CR-Par), MaxHC)', () => {
    expect(courseHandicap(14.2, 123, 72.7, 72, 36)).toBeCloseTo(16.1566, 3);
  });

  it('caps at the max handicap', () => {
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

  it('rolls a low-HI player into the lowest visible division when Gold is hidden', () => {
    const courseHidden: Course = {
      ...course,
      divisions: course.divisions.map((d) =>
        d.code === 'A' ? { ...d, hidden: true } : d
      ),
    };
    const lowHi: Player = { firstName: 'LOW', lastName: 'HI', saId: 'x', hi: 1 };
    expect(divisionFor(lowHi, courseHidden)?.code).toBe('B');
  });

  it('ignores an override pointing to a hidden division', () => {
    const courseHidden: Course = {
      ...course,
      divisions: course.divisions.map((d) =>
        d.code === 'A' ? { ...d, hidden: true } : d
      ),
    };
    const player: Player = {
      firstName: 'X',
      lastName: 'Y',
      saId: 'x',
      hi: 12,
      divisionOverride: 'A',
    };
    expect(divisionFor(player, courseHidden)?.code).toBe('B');
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

describe('countOutSegmentValue', () => {
  // Holes 10..18 of KAY_DAY1: 7+4+4+4+4+5+4+5+7 = 44.
  it('sums back-9 (gross) from holes 10–18', () => {
    expect(countOutSegmentValue(KAY_DAY1, 'back-9', null, null)).toBe(44);
  });

  it('sums back-6 (gross) from holes 13–18', () => {
    expect(countOutSegmentValue(KAY_DAY1, 'back-6', null, null)).toBe(4 + 4 + 5 + 4 + 5 + 7);
  });

  it('sums back-3 (gross) from holes 16–18', () => {
    expect(countOutSegmentValue(KAY_DAY1, 'back-3', null, null)).toBe(4 + 5 + 7);
  });

  it('subtracts the right fraction of PH for net (½ × 18 = 9 off back-9)', () => {
    expect(countOutSegmentValue(KAY_DAY1, 'back-9', 18, 0.5)).toBe(35);
  });

  it('returns null when any hole in the window is unentered', () => {
    const partial: (number | null)[] = [...KAY_DAY1];
    partial[12] = null;
    expect(countOutSegmentValue(partial, 'back-6', null, null)).toBeNull();
    expect(countOutSegmentValue(partial, 'back-3', null, null)).toBe(4 + 5 + 7);
  });

  it('returns null for net when ph is null', () => {
    expect(countOutSegmentValue(KAY_DAY1, 'back-9', null, 0.5)).toBeNull();
  });
});

describe('rankWithCountOut', () => {
  const baseCourse: Course = {
    ...course,
    countOut: { enabled: true, steps: DEFAULT_COUNT_OUT_STEPS },
  };

  function lineFor({
    saId,
    sat,
    sun,
    ph = 18,
  }: {
    saId: string;
    sat: (number | null)[];
    sun: (number | null)[];
    ph?: number | null;
  }): PlayerLine {
    const satGross = dayTotals(sat).gross;
    const sunGross = dayTotals(sun).gross;
    const satNet = satGross != null && ph != null ? satGross - ph : null;
    const sunNet = sunGross != null && ph != null ? sunGross - ph : null;
    const eclHoles = sat.map((s, i) => {
      const u = sun[i];
      if (s == null || u == null) return null;
      return Math.min(s, u);
    });
    const eclGross = eclHoles.every((h) => h != null)
      ? (eclHoles as number[]).reduce((a, b) => a + b, 0)
      : null;
    return {
      player: { firstName: saId, lastName: '', saId, hi: 18 },
      division: undefined,
      hc: 18,
      ph,
      sat: { gross: satGross, net: satNet, holes: sat },
      sun: { gross: sunGross, net: sunNet, holes: sun },
      overall: {
        gross: satGross != null && sunGross != null ? satGross + sunGross : null,
        net: satNet != null && sunNet != null ? satNet + sunNet : null,
      },
      eclectic: { holes: eclHoles, gross: eclGross, net: null },
    };
  }

  it('breaks an overall-gross tie at back-9 — A wins, both stay T1', () => {
    // Day-1 sums equal (74), day-2 sums equal (76). A's day-2 back-9 = 36, B's = 38.
    const aDay1 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6]; // 74
    const aDay2 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // 72; back-9 = 36
    const bDay1 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // 72
    const bDay2 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 5]; // 74; back-9 = 38

    const a = lineFor({ saId: 'A', sat: aDay1, sun: aDay2 });
    const b = lineFor({ saId: 'B', sat: bDay1, sun: bDay2 });

    // Sanity: overall ties at 146.
    expect(a.overall.gross).toBe(146);
    expect(b.overall.gross).toBe(146);

    const r = rankWithCountOut([a, b], { kind: 'overall', metric: 'gross' }, baseCourse);
    expect(r[0].pos).toBe(1);
    expect(r[1].pos).toBe(1);
    expect(r[0].tied).toBe(true);
    expect(r[1].tied).toBe(true);
    expect(r[0].brokenByCountOut).toBe(true);
    expect(r[1].brokenByCountOut).toBe(false);
  });

  it('does nothing when count-out is disabled', () => {
    const sat = Array(18).fill(4);
    const sun = Array(18).fill(4);
    const a = lineFor({ saId: 'A', sat, sun });
    const b = lineFor({ saId: 'B', sat, sun });
    const r = rankWithCountOut(
      [a, b],
      { kind: 'overall', metric: 'gross' },
      { ...course, countOut: { enabled: false, steps: DEFAULT_COUNT_OUT_STEPS } }
    );
    expect(r[0].tied).toBe(true);
    expect(r[0].brokenByCountOut).toBe(false);
    expect(r[1].brokenByCountOut).toBe(false);
  });

  it('does nothing when course.countOut is undefined', () => {
    const sat = Array(18).fill(4);
    const sun = Array(18).fill(4);
    const a = lineFor({ saId: 'A', sat, sun });
    const b = lineFor({ saId: 'B', sat, sun });
    const r = rankWithCountOut([a, b], { kind: 'overall', metric: 'gross' }, course);
    expect(r[0].tied).toBe(true);
    expect(r[0].brokenByCountOut).toBe(false);
  });

  it('falls through to back-3 when back-9 and back-6 are equal', () => {
    // C h13–15: [3,3,3]=9, h16–18: [5,5,5]=15 → back-6 = 24, back-3 = 15.
    // D h13–15: [5,5,5]=15, h16–18: [3,3,3]=9 → back-6 = 24, back-3 = 9.
    // back-9 also equal (h10–12 the same), so resolution is at back-3 → D wins.
    const cSun = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 5, 5, 5];
    const dSun = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 3, 3, 3];
    const sat = Array(18).fill(4);
    const cLine = lineFor({ saId: 'C', sat, sun: cSun });
    const dLine = lineFor({ saId: 'D', sat, sun: dSun });

    const r = rankWithCountOut(
      [cLine, dLine],
      { kind: 'overall', metric: 'gross' },
      baseCourse
    );
    expect(r[0].pos).toBe(1);
    expect(r[1].pos).toBe(1);
    expect(r[0].brokenByCountOut).toBe(false);
    expect(r[1].brokenByCountOut).toBe(true);
  });

  it('marks no winner when all back-9 / back-6 / back-3 are equal', () => {
    const sun = Array(18).fill(4);
    const sat = Array(18).fill(4);
    const e = lineFor({ saId: 'E', sat, sun });
    const f = lineFor({ saId: 'F', sat, sun });
    const r = rankWithCountOut([e, f], { kind: 'overall', metric: 'gross' }, baseCourse);
    expect(r[0].pos).toBe(1);
    expect(r[1].pos).toBe(1);
    expect(r[0].tied).toBe(true);
    expect(r[1].tied).toBe(true);
    expect(r[0].brokenByCountOut).toBe(false);
    expect(r[1].brokenByCountOut).toBe(false);
  });

  it('uses day-1 holes for the day-1 scope', () => {
    // A day-1: front=36, back-9=36 → total 72.
    // B day-1: front=34, back-9=38 → total 72 (tied), but back-9 is worse → A wins count-out.
    const aSat = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    const bSat = [4, 4, 4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 6];
    const sun = Array(18).fill(4);
    const a = lineFor({ saId: 'A', sat: aSat, sun });
    const b = lineFor({ saId: 'B', sat: bSat, sun });
    expect(a.sat.gross).toBe(72);
    expect(b.sat.gross).toBe(72);
    const r = rankWithCountOut([a, b], { kind: 'day', day: 1, metric: 'gross' }, baseCourse);
    expect(r[0].brokenByCountOut).toBe(true);
    expect(r[1].brokenByCountOut).toBe(false);
  });

  it('subtracts net handicap fraction when ranking by net (½ PH off back-9)', () => {
    // Day-1 net tied at 62: A gross 72 / PH 10; B gross 82 / PH 20.
    // Day-1 back-9 gross: A = 36, B = 42. Net back-9: A = 36 - 5 = 31; B = 42 - 10 = 32 → A wins.
    const aSat = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // back-9 = 36
    const bSat = [5, 5, 5, 5, 4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 4, 5, 5, 5]; // front 40, back 42, total 82
    const sun = Array(18).fill(4);
    const aLine = lineFor({ saId: 'A', sat: aSat, sun, ph: 10 });
    const bLine = lineFor({ saId: 'B', sat: bSat, sun, ph: 20 });

    expect(aLine.sat.net).toBe(62);
    expect(bLine.sat.net).toBe(62);

    const r = rankWithCountOut(
      [aLine, bLine],
      { kind: 'day', day: 1, metric: 'net' },
      baseCourse
    );
    expect(r[0].brokenByCountOut).toBe(true);
    expect(r[1].brokenByCountOut).toBe(false);
  });

  it('uses the eclectic best-of-each-hole array for eclectic scope', () => {
    // G eclectic back-9 = 36 (eight 4s and one 4), H eclectic back-9 = 37 (eight 4s and one 5).
    // Make eclectic gross tied at 73 by giving G a 5 on hole 1 (eclectic), and H a 5 on hole 18 (eclectic).
    const gD1 = [5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5]; // hole18=5
    const gD2 = [5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // hole18=4 → eclectic hole18 = 4
    const hD1 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5];
    const hD2 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5]; // both 5 → eclectic hole18 = 5

    const g = lineFor({ saId: 'G', sat: gD1, sun: gD2 });
    const h = lineFor({ saId: 'H', sat: hD1, sun: hD2 });

    expect(g.eclectic.gross).toBe(73);
    expect(h.eclectic.gross).toBe(73);

    const r = rankWithCountOut([g, h], { kind: 'eclectic', metric: 'gross' }, baseCourse);
    expect(r[0].pos).toBe(1);
    expect(r[1].pos).toBe(1);
    expect(r[0].brokenByCountOut).toBe(true); // G eclectic back-9 = 36 < H = 37
    expect(r[1].brokenByCountOut).toBe(false);
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
