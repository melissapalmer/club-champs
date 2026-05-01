import { describe, expect, it } from 'vitest';
import { addMinutes, generateDraw } from './teeTimes';
import { buildPlayerLines } from './engine';
import type { Course, DayScore, Player, TeeTimeConfig } from '../types';

const baseCourse: Course = {
  club: 'Test GC',
  event: '2026 Test',
  gender: 'women',
  maxHandicap: 36,
  eclecticHandicapPct: 25,
  tees: {
    yellow: { par: 72, women: { cr: 72.7, slope: 124 }, men: { cr: 79.0, slope: 136 } },
    white: { par: 72, women: { cr: 77.7, slope: 137 }, men: { cr: 71.6, slope: 119 } },
    blue: { par: 72, women: { cr: 75.0, slope: 130 }, men: { cr: 68.7, slope: 116 } },
    red: { par: 72, women: { cr: 72.7, slope: 123 }, men: { cr: 67.0, slope: 111 } },
  },
  divisions: [
    { code: 'A', name: 'Gold', tee: 'red', hiMin: -999, hiMax: 6.5, handicapPct: 100, format: 'medal' },
    { code: 'B', name: 'Silver', tee: 'red', hiMin: 6.6, hiMax: 15.3, handicapPct: 100, format: 'medal' },
    { code: 'C', name: 'Bronze', tee: 'red', hiMin: 15.4, hiMax: 24, handicapPct: 100, format: 'medal' },
    { code: 'D', name: 'Copper', tee: 'red', hiMin: 24.01, hiMax: 36, handicapPct: 100, format: 'stableford' },
  ],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, siWomen: i + 1, siMen: i + 1 })),
};

const cfg = (overrides?: Partial<TeeTimeConfig>): TeeTimeConfig => ({
  enabled: true,
  groupSize: 4,
  intervalMinutes: 10,
  day1Start: '08:00',
  day2Start: '08:00',
  ...overrides,
});

function p(saId: string, hi: number): Player {
  return { firstName: 'P', lastName: saId, saId, hi };
}

describe('addMinutes', () => {
  it('adds minutes within the same hour', () => {
    expect(addMinutes('08:00', 10)).toBe('08:10');
    expect(addMinutes('08:50', 5)).toBe('08:55');
  });

  it('rolls into the next hour', () => {
    expect(addMinutes('09:55', 10)).toBe('10:05');
    expect(addMinutes('23:50', 30)).toBe('00:20');
  });

  it('zero-pads', () => {
    expect(addMinutes('07:00', 5)).toBe('07:05');
    expect(addMinutes('00:00', 0)).toBe('00:00');
  });

  it('returns input unchanged when malformed', () => {
    expect(addMinutes('not-a-time', 10)).toBe('not-a-time');
  });
});

describe('generateDraw — Day 1', () => {
  it('orders by HI ascending within a division (best players off first)', () => {
    const players: Player[] = [
      p('m1', 14.0),  // Silver
      p('m2', 10.0),  // Silver — best
      p('m3', 12.5),  // Silver
    ];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg({ groupSize: 3 }));
    expect(draw.map((t) => t.saId)).toEqual(['m2', 'm3', 'm1']);
    // All in one group.
    expect(new Set(draw.map((t) => t.time))).toEqual(new Set(['08:00']));
    expect(draw[0].name).toBe('P m2');
  });

  it('default best-first orders divisions A→D and best→worst within each division', () => {
    const players: Player[] = [
      p('a1', 5),   // Gold (medal)
      p('a2', 3),   // Gold (medal)
      p('b1', 10),  // Silver (medal)
      p('b2', 12),  // Silver (medal)
      p('c1', 18),  // Bronze (medal)
      p('c2', 20),  // Bronze (medal)
      p('d1', 28),  // Copper (stableford)
      p('d2', 30),  // Copper (stableford)
    ];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg({ groupSize: 4 }));
    // Field follows division order A→D end-to-end. Format boundary between C
    // (medal) and D (stableford) forces a fresh group, so the C tail doesn't
    // pack with D players.
    expect(draw.map((t) => t.saId)).toEqual([
      // Group 1: A (best HI first), then B fills the rest.
      'a2', 'a1', 'b1', 'b2',
      // Group 2: C alone — flushes before D since formats differ.
      'c1', 'c2',
      // Group 3: D (stableford) at the back of the field.
      'd1', 'd2',
    ]);
  });

  it('day1Order=worst-first orders divisions D→A and worst→best within each division', () => {
    const players: Player[] = [
      p('a1', 5), p('a2', 3),
      p('b1', 10), p('b2', 12),
      p('c1', 18), p('c2', 20),
      p('d1', 28), p('d2', 30),
    ];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(
      1,
      lines,
      baseCourse,
      cfg({ groupSize: 4, day1Order: 'worst-first' })
    );
    expect(draw.map((t) => t.saId)).toEqual([
      // Stableford D worst→best.
      'd2', 'd1',
      // Medal C, then B, then A — worst→best within each.
      'c2', 'c1', 'b2', 'b1',
      'a1', 'a2',
    ]);
  });

  it('format boundary is hard — no group mixes stableford and medal', () => {
    const players: Player[] = [
      p('d1', 30), p('d2', 28), p('d3', 27),  // 3 Copper (stableford)
      p('c1', 20), p('c2', 18),               // 2 Bronze (medal)
    ];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg({ groupSize: 4 }));
    // Default best-first: medal C first (08:00), then stableford D (08:10).
    // Within each, lowest HI first.
    const byTime = new Map<string, string[]>();
    for (const t of draw) {
      const arr = byTime.get(t.time) ?? [];
      arr.push(t.saId);
      byTime.set(t.time, arr);
    }
    expect(byTime.get('08:00')).toEqual(['c2', 'c1']);
    expect(byTime.get('08:10')).toEqual(['d3', 'd2', 'd1']);
  });

  it('soft division boundary inside a format block — leftover Silver plays with Bronze', () => {
    // Sparse Silver (3) + Bronze (5) + group size 4.
    // Day-1 default best-first → divisions B(3) then C(5), within each HI asc.
    // Flat: b1,b2,b3,c1,c2,c3,c4,c5. Packed by 4: [b1,b2,b3,c1] [c2,c3,c4,c5].
    // The 3 Silvers share a group with C's leading player (c1).
    const players: Player[] = [
      p('c1', 16), p('c2', 17), p('c3', 18), p('c4', 19), p('c5', 20),
      p('b1', 7),  p('b2', 9),  p('b3', 11),
    ];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg({ groupSize: 4 }));
    expect(draw.map((t) => t.saId)).toEqual([
      'b1', 'b2', 'b3', 'c1',
      'c2', 'c3', 'c4', 'c5',
    ]);
    expect(draw.slice(0, 4).every((t) => t.time === '08:00')).toBe(true);
    expect(draw.slice(4, 8).every((t) => t.time === '08:10')).toBe(true);
  });

  it('does not include hidden divisions in the iteration order', () => {
    // We hide D entirely. With no D players in the field, the draw should be
    // just the medal block (A → B → C under default best-first).
    const courseHiddenD: Course = {
      ...baseCourse,
      divisions: baseCourse.divisions.map((d) =>
        d.code === 'D' ? { ...d, hidden: true } : d
      ),
    };
    const players: Player[] = [
      p('a1', 5), p('b1', 10), p('c1', 20),
    ];
    const lines = buildPlayerLines(players, [], courseHiddenD);
    const draw = generateDraw(1, lines, courseHiddenD, cfg({ groupSize: 3 }));
    expect(draw.map((t) => t.saId)).toEqual(['a1', 'b1', 'c1']);
  });

  it('time math: 12 players, group size 4, interval 10, start 08:00 → 08:00 / 08:10 / 08:20', () => {
    const players: Player[] = Array.from({ length: 12 }, (_, i) => p(`b${i}`, 10 + i * 0.1));
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg({ groupSize: 4 }));
    const times = Array.from(new Set(draw.map((t) => t.time)));
    expect(times).toEqual(['08:00', '08:10', '08:20']);
  });
});

describe('generateDraw — Day 2', () => {
  function holes(scores: number[]): (number | null)[] {
    if (scores.length !== 18) throw new Error('need 18');
    return scores;
  }

  it('orders by Day-1 standing within a division — best score off last', () => {
    // Use identical HI for all three so PH is the same and net order = gross order.
    const players: Player[] = [
      p('c1', 18), p('c2', 18), p('c3', 18),
    ];
    const scores: DayScore[] = [
      { saId: 'c1', day: 1, holes: holes(Array(18).fill(5)) }, // gross 90 — worst
      { saId: 'c2', day: 1, holes: holes(Array(18).fill(4)) }, // gross 72 — best
      { saId: 'c3', day: 1, holes: holes([5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]) }, // 73 — middle
    ];
    const lines = buildPlayerLines(players, scores, baseCourse);
    const draw = generateDraw(2, lines, baseCourse, cfg({ groupSize: 3 }));
    // Worst (c1) first, best (c2) last.
    expect(draw.map((t) => t.saId)).toEqual(['c1', 'c3', 'c2']);
  });

  it('places DNS players (no Day-1 score) at the START of their division', () => {
    const players: Player[] = [
      p('c1', 18), p('c2', 18), p('c3', 18),
    ];
    // c2 has no Day-1 score → DNS.
    const scores: DayScore[] = [
      { saId: 'c1', day: 1, holes: holes(Array(18).fill(4)) }, // best
      { saId: 'c3', day: 1, holes: holes(Array(18).fill(5)) }, // worse
    ];
    const lines = buildPlayerLines(players, scores, baseCourse);
    const draw = generateDraw(2, lines, baseCourse, cfg({ groupSize: 3 }));
    // DNS first, then worst-to-best of the scored players.
    expect(draw.map((t) => t.saId)).toEqual(['c2', 'c3', 'c1']);
  });

  it('day2Order=best-first puts the Day-1 leader off in the first group', () => {
    const players: Player[] = [
      p('c1', 18), p('c2', 18), p('c3', 18),
    ];
    const scores: DayScore[] = [
      { saId: 'c1', day: 1, holes: holes(Array(18).fill(5)) }, // worst
      { saId: 'c2', day: 1, holes: holes(Array(18).fill(4)) }, // best
      { saId: 'c3', day: 1, holes: holes([5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]) }, // middle
    ];
    const lines = buildPlayerLines(players, scores, baseCourse);
    const draw = generateDraw(
      2,
      lines,
      baseCourse,
      cfg({ groupSize: 3, day2Order: 'best-first' })
    );
    expect(draw.map((t) => t.saId)).toEqual(['c2', 'c3', 'c1']);
  });

  it('uses the stableford metric for stableford divisions', () => {
    // Two Copper players: d2 has all-pars (high points), d1 has all-doubles (low points).
    // For stableford: higher points = better. After Day 1, d1 (low pts) off first, d2 last.
    const players: Player[] = [p('d1', 30), p('d2', 28)];
    const scores: DayScore[] = [
      { saId: 'd1', day: 1, holes: holes(Array(18).fill(8)) }, // many doubles → 0 pts each
      { saId: 'd2', day: 1, holes: holes(Array(18).fill(4)) }, // all pars (with strokes → many pts)
    ];
    const lines = buildPlayerLines(players, scores, baseCourse);
    const draw = generateDraw(2, lines, baseCourse, cfg({ groupSize: 4 }));
    expect(draw.map((t) => t.saId)).toEqual(['d1', 'd2']);
  });
});

describe('generateDraw — disabled / empty edge cases', () => {
  it('returns empty when no eligible lines', () => {
    const draw = generateDraw(1, [], baseCourse, cfg());
    expect(draw).toEqual([]);
  });

  it('writes the snapshot name on each row', () => {
    const players: Player[] = [{ firstName: 'Kay', lastName: 'Dunkley', saId: 'k1', hi: 14 }];
    const lines = buildPlayerLines(players, [], baseCourse);
    const draw = generateDraw(1, lines, baseCourse, cfg());
    expect(draw[0].name).toBe('Kay Dunkley');
  });
});
