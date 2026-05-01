import { describe, expect, it } from 'vitest';
import {
  bracketSize,
  generateBracket,
  matchesByRound,
  pairingOrder,
  propagateAll,
  roundLabel,
  seedPlayers,
} from './matchPlay';
import type { Match, Player } from '../types';

function p(saId: string, hi: number, last = saId, first = 'P'): Player {
  return { firstName: first, lastName: last, saId, hi };
}

describe('bracketSize', () => {
  it('returns 0 below 2 opt-ins', () => {
    expect(bracketSize(0)).toBe(0);
    expect(bracketSize(1)).toBe(0);
  });
  it('rounds up to next power of 2', () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(4)).toBe(4);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(9)).toBe(16);
    expect(bracketSize(16)).toBe(16);
    expect(bracketSize(17)).toBe(32);
    expect(bracketSize(32)).toBe(32);
    expect(bracketSize(33)).toBe(64);
  });
});

describe('pairingOrder', () => {
  it('produces [1] for N=1', () => {
    expect(pairingOrder(1)).toEqual([1]);
  });
  it('produces [1,2] for N=2', () => {
    expect(pairingOrder(2)).toEqual([1, 2]);
  });
  it('produces [1,4,2,3] for N=4', () => {
    expect(pairingOrder(4)).toEqual([1, 4, 2, 3]);
  });
  it('produces standard 8-bracket order [1,8,4,5,2,7,3,6]', () => {
    expect(pairingOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('produces 16-bracket where seed 1 meets 16, seed 8 meets 9, etc.', () => {
    const order = pairingOrder(16);
    expect(order.length).toBe(16);
    // Pairs sum to 17.
    for (let i = 0; i < 16; i += 2) {
      expect(order[i] + order[i + 1]).toBe(17);
    }
  });
});

describe('seedPlayers', () => {
  it('orders by HI ascending', () => {
    const players = [p('a', 18), p('b', 6), p('c', 12)];
    const seeded = seedPlayers(players);
    expect(seeded.map((x) => x.saId)).toEqual(['b', 'c', 'a']);
  });
  it('breaks ties deterministically by lastName, firstName, saId', () => {
    const players = [
      p('a', 10, 'Smith', 'Alice'),
      p('b', 10, 'Adams', 'Zoe'),
      p('c', 10, 'Adams', 'Bob'),
    ];
    const seeded = seedPlayers(players);
    expect(seeded.map((x) => x.saId)).toEqual(['c', 'b', 'a']);
  });
});

describe('generateBracket', () => {
  it('returns empty when fewer than 2 opt-ins', () => {
    expect(generateBracket([])).toEqual([]);
    expect(generateBracket([p('a', 10)])).toEqual([]);
  });

  it('produces a 2-bracket with one final match for 2 opt-ins', () => {
    const matches = generateBracket([p('a', 10), p('b', 12)]);
    expect(matches.length).toBe(1);
    expect(matches[0]).toMatchObject({ id: '1-0', round: 1, slot: 0, playerASaId: 'a', playerBSaId: 'b' });
  });

  it('produces an 8-bracket for 8 opt-ins, no byes', () => {
    const players: Player[] = [
      p('s1', 1), p('s2', 2), p('s3', 3), p('s4', 4),
      p('s5', 5), p('s6', 6), p('s7', 7), p('s8', 8),
    ];
    const matches = generateBracket(players);
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1.length).toBe(4);
    expect(r1[0]).toMatchObject({ playerASaId: 's1', playerBSaId: 's8' });
    expect(r1[1]).toMatchObject({ playerASaId: 's4', playerBSaId: 's5' });
    expect(r1[2]).toMatchObject({ playerASaId: 's2', playerBSaId: 's7' });
    expect(r1[3]).toMatchObject({ playerASaId: 's3', playerBSaId: 's6' });
    // No byes resolved.
    expect(r1.every((m) => m.winnerSaId == null)).toBe(true);
    // Rounds 2 and 3 exist and are empty.
    expect(matches.filter((m) => m.round === 2).length).toBe(2);
    expect(matches.filter((m) => m.round === 3).length).toBe(1);
  });

  it('gives top seeds byes when opt-ins is not a power of 2', () => {
    // 5 opt-ins → 8-bracket, top 3 seeds (1, 2, 3) get byes (paired with seeds 8, 7, 6).
    const players: Player[] = [
      p('s1', 1), p('s2', 2), p('s3', 3), p('s4', 4), p('s5', 5),
    ];
    const matches = generateBracket(players);
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1.length).toBe(4);
    // The bye-getters: seeds 1, 2, 3 paired against missing seeds 8, 7, 6.
    const byes = r1.filter((m) => m.result === 'bye');
    expect(byes.length).toBe(3);
    expect(byes.map((m) => m.winnerSaId).sort()).toEqual(['s1', 's2', 's3']);
    // The one real match: seed 4 vs seed 5 in slot 1.
    const realMatch = r1.find((m) => m.result == null);
    expect(realMatch).toMatchObject({ playerASaId: 's4', playerBSaId: 's5' });
    // Round 2 has byes already propagated.
    const r2 = matches.filter((m) => m.round === 2);
    expect(r2.length).toBe(2);
    // Round 2 slot 0 = winners of (1-0, 1-1). 1-0 is bye for s1, 1-1 still open.
    expect(r2[0].playerASaId).toBe('s1');
    expect(r2[0].playerBSaId).toBeUndefined();
    // Round 2 slot 1 = winners of (1-2, 1-3). Both byes — so playerA and playerB both filled.
    expect(r2[1].playerASaId).toBe('s2');
    expect(r2[1].playerBSaId).toBe('s3');
  });

  it('handles 2-vs-3 opt-ins yielding a 4-bracket with seed 1 getting a bye', () => {
    const players: Player[] = [p('s1', 1), p('s2', 2), p('s3', 3)];
    const matches = generateBracket(players);
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1.length).toBe(2);
    // Seed 1 paired against seed 4 (missing) → bye.
    const bye = r1.find((m) => m.result === 'bye');
    expect(bye?.winnerSaId).toBe('s1');
    // Seed 2 vs seed 3.
    const real = r1.find((m) => m.result == null);
    expect(real).toMatchObject({ playerASaId: 's2', playerBSaId: 's3' });
  });
});

describe('propagateAll', () => {
  function seedDataPropagateRound1(): Match[] {
    // 8-bracket round 1 with deterministic results: lower-seed wins each match.
    const players: Player[] = [
      p('s1', 1), p('s2', 2), p('s3', 3), p('s4', 4),
      p('s5', 5), p('s6', 6), p('s7', 7), p('s8', 8),
    ];
    const matches = generateBracket(players);
    // Resolve round 1: lower-seed wins.
    return matches.map((m) => {
      if (m.round !== 1) return m;
      return { ...m, winnerSaId: m.playerASaId, result: '1 up' };
    });
  }

  it('routes round-1 winners into round-2 playerA / playerB by even/odd slot', () => {
    const after = propagateAll(seedDataPropagateRound1());
    const r2 = after.filter((m) => m.round === 2);
    // Round 2 slot 0 = winners of round-1 slots 0 (→A) and 1 (→B).
    expect(r2[0].playerASaId).toBe('s1');
    expect(r2[0].playerBSaId).toBe('s4');
    // Round 2 slot 1 = winners of round-1 slots 2 (→A) and 3 (→B).
    expect(r2[1].playerASaId).toBe('s2');
    expect(r2[1].playerBSaId).toBe('s3');
  });

  it('is idempotent — running propagateAll twice produces the same result', () => {
    const once = propagateAll(seedDataPropagateRound1());
    const twice = propagateAll(once);
    expect(twice).toEqual(once);
  });

  it('clears downstream winner when an earlier-round winner is changed', () => {
    // Resolve round 1 + round 2 + final, then change round-1 slot 0 winner
    // (was s1 → now s8) and re-propagate.
    const players: Player[] = [
      p('s1', 1), p('s2', 2), p('s3', 3), p('s4', 4),
      p('s5', 5), p('s6', 6), p('s7', 7), p('s8', 8),
    ];
    let matches = generateBracket(players);
    matches = matches.map((m) => {
      if (m.round !== 1) return m;
      return { ...m, winnerSaId: m.playerASaId, result: '1 up' };
    });
    matches = propagateAll(matches);
    // Resolve round 2: again lower-seed-A wins.
    matches = matches.map((m) => {
      if (m.round !== 2) return m;
      return { ...m, winnerSaId: m.playerASaId, result: '2 up' };
    });
    matches = propagateAll(matches);
    // Resolve final: A wins.
    matches = matches.map((m) => {
      if (m.round !== 3) return m;
      return { ...m, winnerSaId: m.playerASaId, result: '3 and 2' };
    });
    // Now flip round-1 slot 0 winner from s1 to s8.
    matches = matches.map((m) =>
      m.id === '1-0' ? { ...m, winnerSaId: 's8', result: '4 and 3' } : m
    );
    const after = propagateAll(matches);
    // Round-2 slot 0 should now have s8 as playerA.
    const r2s0 = after.find((m) => m.id === '2-0')!;
    expect(r2s0.playerASaId).toBe('s8');
    // Its previous winner s1 is no longer a participant — winner cleared.
    expect(r2s0.winnerSaId).toBeUndefined();
    expect(r2s0.result).toBeUndefined();
    // The final's playerA was the round-2 slot-0 winner; that's now empty,
    // so the final's playerA is empty and final winner cleared too.
    const finalMatch = after.find((m) => m.id === '3-0')!;
    expect(finalMatch.playerASaId).toBeUndefined();
    expect(finalMatch.winnerSaId).toBeUndefined();
  });
});

describe('roundLabel', () => {
  it('labels finals / semis / quarters by distance from the end', () => {
    // 8-bracket: 3 rounds total. Round 1 IS the quarter-finals.
    expect(roundLabel(3, 3)).toBe('Final');
    expect(roundLabel(2, 3)).toBe('Semi-finals');
    expect(roundLabel(1, 3)).toBe('Quarter-finals');
    // 16-bracket: 4 rounds total.
    expect(roundLabel(4, 4)).toBe('Final');
    expect(roundLabel(3, 4)).toBe('Semi-finals');
    expect(roundLabel(2, 4)).toBe('Quarter-finals');
    expect(roundLabel(1, 4)).toBe('Round 1');
    // 32-bracket: 5 rounds total.
    expect(roundLabel(1, 5)).toBe('Round 1');
    expect(roundLabel(2, 5)).toBe('Round 2');
    expect(roundLabel(3, 5)).toBe('Quarter-finals');
  });
});

describe('matchesByRound', () => {
  it('groups by round and sorts slots ascending within each round', () => {
    const matches: Match[] = [
      { id: '2-1', round: 2, slot: 1 },
      { id: '1-3', round: 1, slot: 3 },
      { id: '1-0', round: 1, slot: 0 },
      { id: '2-0', round: 2, slot: 0 },
      { id: '1-1', round: 1, slot: 1 },
      { id: '1-2', round: 1, slot: 2 },
      { id: '3-0', round: 3, slot: 0 },
    ];
    const grouped = matchesByRound(matches);
    expect(grouped.length).toBe(3);
    expect(grouped[0].map((m) => m.id)).toEqual(['1-0', '1-1', '1-2', '1-3']);
    expect(grouped[1].map((m) => m.id)).toEqual(['2-0', '2-1']);
    expect(grouped[2].map((m) => m.id)).toEqual(['3-0']);
  });
});
