import type { DivisionCode, Match, Player } from '../types';

/**
 * Bracket engine for the Match Play knockout.
 *
 * - `bracketSize` rounds the opt-in count up to the next power of two; that's
 *   the number of slots in round 1, including byes for the missing seeds.
 * - `pairingOrder` produces the standard "Swiss" seeding sequence used by the
 *   USGA / R&A and Golf Genius (1v8, 4v5, 2v7, 3v6 for an 8-bracket) so the
 *   top half avoids meeting until the semis.
 * - `seedPlayers` orders players for seeding, with a deterministic tiebreaker
 *   chain so reruns of `generateBracket` on the same input produce the same
 *   bracket.
 * - `generateBracket` produces the full bracket (round 1 + empty rounds 2..final)
 *   and pre-resolves byes so the bye-getter is already slotted into round 2.
 * - `propagateAll` walks rounds in order and slots the winner of each match
 *   into the corresponding playerA/playerB of the next round. Idempotent.
 *   When a participant changes (admin re-entered an earlier round), the
 *   downstream match's winnerSaId/result get cleared.
 */

export function bracketSize(optInCount: number): number {
  if (optInCount < 2) return 0;
  return 1 << Math.ceil(Math.log2(optInCount));
}

/**
 * Standard "Swiss" seeding sequence for an N-bracket. Returns seed numbers
 * (1-indexed) in slot order. For N=8: [1,8,4,5,2,7,3,6]. The construction
 * is recursive: pair each seed s in the half-size order with N+1-s.
 *
 * Defensive: only positive integer powers of 2 are valid bracket sizes.
 * Any other input returns `[]` — callers should treat that as "can't
 * compute" rather than risk infinite recursion (a bracket with a stale
 * non-power-of-2 round-1 row used to crash the renderer).
 */
export function pairingOrder(N: number): number[] {
  if (!Number.isInteger(N) || N < 1) return [];
  if ((N & (N - 1)) !== 0) return [];
  if (N === 1) return [1];
  const half = pairingOrder(N / 2);
  const out: number[] = [];
  for (const s of half) {
    out.push(s);
    out.push(N + 1 - s);
  }
  return out;
}

/**
 * Sort players for seeding. Lowest HI wins. Tiebreaker chain (deterministic):
 * HI ↑, lastName ↑, firstName ↑, saId ↑.
 */
export function seedPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (a.hi !== b.hi) return a.hi - b.hi;
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    const fn = a.firstName.localeCompare(b.firstName);
    if (fn !== 0) return fn;
    return a.saId.localeCompare(b.saId);
  });
}

/**
 * Generate the full bracket for one division. All returned matches are
 * tagged with `divisionCode`. Round 1 has players + auto-resolved byes;
 * rounds 2..final are empty placeholders that fill in as winners are
 * entered.
 */
export function generateBracket(opted: Player[], divisionCode: DivisionCode): Match[] {
  const seeded = seedPlayers(opted);
  const K = seeded.length;
  const N = bracketSize(K);
  if (N < 2) return [];

  const order = pairingOrder(N);
  const round1Slots = N / 2;
  const matches: Match[] = [];

  // IDs use an `m` prefix (e.g. `m1-0`, not `1-0`). The Sheet's gviz CSV
  // export coerces values like "1-0" / "2-0" / "3-0" as invalid dates and
  // returns them as empty strings, which silently drops those matches on read.
  // The non-numeric prefix forces gviz to treat the column as text.

  for (let s = 0; s < round1Slots; s++) {
    const seedA = order[2 * s];
    const seedB = order[2 * s + 1];
    const playerA = seeded[seedA - 1];
    const playerB = seeded[seedB - 1];
    const m: Match = { id: `m1-${s}`, divisionCode, round: 1, slot: s };
    if (playerA) m.playerASaId = playerA.saId;
    if (playerB) m.playerBSaId = playerB.saId;
    if (playerA && !playerB) {
      m.winnerSaId = playerA.saId;
      m.result = 'bye';
    } else if (playerB && !playerA) {
      m.winnerSaId = playerB.saId;
      m.result = 'bye';
    }
    matches.push(m);
  }

  let prevCount = round1Slots;
  let round = 2;
  while (prevCount > 1) {
    const count = prevCount / 2;
    for (let s = 0; s < count; s++) {
      matches.push({ id: `m${round}-${s}`, divisionCode, round, slot: s });
    }
    prevCount = count;
    round += 1;
  }

  return propagateAll(matches);
}

/**
 * Walk every bracket in round order. Operates on the full matches array
 * (all divisions) but propagates within each division independently —
 * round-1 slot 0 in division C feeds round-2 slot 0 in division C, etc.
 *
 * For each match:
 *   1. If its stored winner is no longer one of its participants (because
 *      an earlier-round re-entry just changed who's playing here), clear
 *      the winner + result.
 *   2. Propagate the winner (or undefined) into the next round's match —
 *      playerA for an even slot, playerB for an odd slot.
 *
 * Single forward pass within each division means a chain of changes
 * (re-enter round 1 → round 2 invalidates → round 3 invalidates) cascades
 * correctly in one call. Idempotent.
 */
export function propagateAll(matches: Match[]): Match[] {
  const next = matches.map((m) => ({ ...m }));
  const byKey = new Map<string, Match>();
  for (const m of next) byKey.set(`${m.divisionCode}|${m.id}`, m);

  const sorted = [...next].sort(
    (a, b) =>
      a.divisionCode.localeCompare(b.divisionCode) ||
      a.round - b.round ||
      a.slot - b.slot
  );

  for (const m of sorted) {
    if (m.winnerSaId) {
      const stillPlaying =
        m.winnerSaId === m.playerASaId || m.winnerSaId === m.playerBSaId;
      if (!stillPlaying) {
        m.winnerSaId = undefined;
        m.result = undefined;
      }
    }
    const childKey = `${m.divisionCode}|m${m.round + 1}-${Math.floor(m.slot / 2)}`;
    const child = byKey.get(childKey);
    if (!child) continue;
    const side = m.slot % 2 === 0 ? 'playerASaId' : 'playerBSaId';
    if (child[side] !== m.winnerSaId) {
      child[side] = m.winnerSaId;
    }
  }

  return next;
}

/** Round labels for display: Final / Semi-finals / Quarter-finals / Round N. */
export function roundLabel(round1Indexed: number, totalRounds: number): string {
  const fromEnd = totalRounds - round1Indexed + 1;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semi-finals';
  if (fromEnd === 3) return 'Quarter-finals';
  return `Round ${round1Indexed}`;
}

/** Group matches by round, sorted ascending; result[0] is round 1. */
export function matchesByRound(matches: Match[]): Match[][] {
  const out: Map<number, Match[]> = new Map();
  for (const m of matches) {
    const arr = out.get(m.round) ?? [];
    arr.push(m);
    out.set(m.round, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.slot - b.slot);
  }
  return Array.from(out.entries())
    .sort(([a], [b]) => a - b)
    .map(([, arr]) => arr);
}

/** Filter the full matches array down to one division's bracket. */
export function matchesForDivision(matches: Match[], code: DivisionCode): Match[] {
  return matches.filter((m) => m.divisionCode === code);
}
