# Plan — Match Play feature

## Context

After the 2026-05-03/04 club championship, the same field of players plays a Match Play knockout — the popular "Bronze MP", "Silver MP", etc. brackets the club has historically run on Golf Genius. We want to bring that into our app:

- **Per-player opt-in** so not everyone is in the bracket.
- **Auto-generated bracket** seeded by HI, with byes for the top seeds when opt-ins isn't a power of two.
- **Single-elimination knockout** only (Swiss / round-robin out of scope).
- **Public bracket page** styled like the Golf Genius reference image (round columns, player cards with seed + name + result).
- **Admin Config sub-tab** to enable, generate, reset, and enter results.
- **No time pressure** — branch-and-PR, ship after the championship.

## Approach

### Single PR on `feature/match-play`

One cohesive PR — schema + engine + admin entry + public bracket + Home card all together. You review the whole thing once; the feature lights up the moment it's merged. The implementation order below is a build-order sequence, not separate PRs.

Implementation sequence (within the one branch):
1. **Schema + plumbing** — types, Sheet adapters, Apps Script actions, opt-in checkbox.
2. **Engine** — pure-function `generateBracket`, `seedPlayers`, `propagateWinner`/`propagateAll` with full unit-test coverage.
3. **Admin UI** — Config "Match Play" sub-tab with Generate / Reset / per-match result entry.
4. **Public UI** — `/match-play` route, `Bracket` renderer, nav item, Home card.

Each step is locally reviewable in commits, but everything ships together when the branch merges.

### Data model

**[src/types.ts](../../src/types.ts)** — new types and additions:
```ts
export type MatchPlayConfig = {
  enabled: boolean;
  name?: string;                       // "Bronze MP Final" etc.
  bracketGeneratedAt?: string;         // ISO ts; admin sees "last generated" line
  divisionCode?: DivisionCode;         // optional restrict to one division
};

export type Match = {
  id: string;                          // "round-slot", e.g. "1-0", "3-1"
  round: number;                       // 1-indexed
  slot: number;                        // 0-indexed within round
  playerASaId?: string;                // empty until previous round resolves
  playerBSaId?: string;
  winnerSaId?: string;
  result?: string;                     // free text: "1 up", "3 and 2", "won on 19th", "bye"
};

// Course gains:
matchPlay?: MatchPlayConfig;

// Player gains:
matchPlay?: boolean;                   // opt-in
```

`id = "round-slot"` lets Apps Script upsert by id and lets the engine compute parent links arithmetically (slot `s` in round `r` feeds slot `Math.floor(s/2)` in round `r+1`; even slot → `playerA`, odd slot → `playerB`).

### Sheet + Apps Script

- New tab **`Matches`** with headers: `id, round, slot, playerASaId, playerBSaId, winnerSaId, result`.
- `Players` tab gains a `matchPlay` column (`TRUE` / blank). Existing rows degrade to "not opted in".
- New Apps Script actions in [apps-script/Code.gs](../../apps-script/Code.gs):
  - `saveMatches` — bulk replace (mirrors `saveTeeTimes`). Used for both Generate and per-result save.
  - `clearMatches` — clears data rows, keeps header.
  - (Skipping per-row `saveMatch`: bulk-replace is simpler and atomic at ≤32 rows.)
- Extend `ActionName` in [src/sheets/api.ts](../../src/sheets/api.ts).
- Extend `PLAYERS_HEADERS` in Apps Script with `matchPlay`. `upsertPlayer` already loops over headers, so passing `matchPlay: 'TRUE'|''` from the client just works.
- Add `'matchPlay'` to `JSON_KEYS` in [src/sheets/courseAdapter.ts](../../src/sheets/courseAdapter.ts) (one-line change, mirrors `'teeTimes'`).

### Bracket engine

New file **[src/scoring/matchPlay.ts](../../src/scoring/matchPlay.ts)**:

```ts
export function bracketSize(optInCount: number): number {
  if (optInCount < 2) return 0;
  return 1 << Math.ceil(Math.log2(optInCount));   // round up to next 2^N
}

export function pairingOrder(N: number): number[] {
  // Standard "Swiss" seeding: 1v8, 4v5, 2v7, 3v6 for N=8.
  // Recursive: pairingOrder(N) interleaves pairingOrder(N/2) with N+1 - that.
  if (N === 1) return [1];
  const half = pairingOrder(N / 2);
  const out: number[] = [];
  for (const s of half) { out.push(s); out.push(N + 1 - s); }
  return out;
}

export function seedPlayers(players: Player[]): Player[] {
  // Tiebreaker chain: HI ↑, lastName ↑, firstName ↑, saId ↑ (deterministic).
}

export function generateBracket(seeded: Player[]): Match[] {
  // Round 1 by pairingOrder; missing seeds = bye = auto-winner.
  // Pre-create empty matches for rounds 2..final.
  // Run propagateAll once so byes flow into round 2.
}

export function propagateWinner(matches: Match[], updated: Match): Match[];
export function propagateAll(matches: Match[]): Match[];
// Idempotent. Re-running clears downstream winnerSaId/result if a participant
// changed (admin re-entered an earlier round) and emits a warning that the
// admin UI can pick up.
```

Tests in **[src/scoring/matchPlay.test.ts](../../src/scoring/matchPlay.test.ts)**:
- `bracketSize` boundaries (0/1/2/3/8/9/32/33).
- `pairingOrder(8) === [1,8,4,5,2,7,3,6]`.
- 5 opt-ins → 8-bracket, top 3 seeds get byes.
- `propagateWinner` routes by even/odd slot.
- `propagateAll` idempotency + downstream-clear when a participant changes.

### UI

**[src/components/PlayerEditModal.tsx](../../src/components/PlayerEditModal.tsx)** — new "Opted in to Match Play" checkbox under the division-override row. Threaded through the existing `Draft` shape and `submit()` builder.

**[src/routes/Config.tsx](../../src/routes/Config.tsx)** — new `'match-play'` sub-tab in `CONFIG_TABS` (between Tee Times and Branding). New `MatchPlayEditor` component:
- Settings card: Enabled / Display name / optional Division restrict.
- Generate-Reset card: shows opt-in count + computed bracket size + warnings, with two buttons (`window.confirm` mirrors Tee Times generate). On Generate, sets `bracketGeneratedAt = new Date().toISOString()` and calls `saveMatches` with the freshly-generated bracket.
- Result-entry table: rows = matches, columns = `Round · Match · Player A · Player B · Winner · Result`. Winner is a 3-state radio (None / A / B). Result is free-text. On save: update local state, run `propagateAll`, call `saveMatches` with the full updated array.

**[src/components/Bracket.tsx](../../src/components/Bracket.tsx)** (new) — flexbox-column-per-round renderer:
- Outer `<div className="overflow-x-auto">` for horizontal scroll on phones.
- One column per round; each column `flex-col justify-around`. Vertical match alignment achieved by per-column `gap` proportional to `2^roundIdx` so each match lines up with the midpoint of its two feeders.
- `MatchCard`: stacked PlayerRow A / divider / PlayerRow B. Each row shows seed badge + name + result text (right-aligned, only on the winner). Bye loser shows `BYE` muted.
- Round labels: "Round 1" → … → "Quarter-finals" → "Semi-finals" → "Final" (computed from `totalRounds`).
- No JS measurement; all CSS. Connector lines optional polish (skip for MVP).

**[src/routes/MatchPlay.tsx](../../src/routes/MatchPlay.tsx)** (new) — public route. Renders:
- `<h1>{course.matchPlay.name ?? 'Match Play'}</h1>` plus a one-line subtitle ("Knockout bracket — single elimination.").
- `<Bracket matches={data.matches} players={data.players} />`.
- Empty state when `matches.length === 0`.

**[src/App.tsx](../../src/App.tsx)** — register `/match-play` route.

**[src/components/Layout.tsx](../../src/components/Layout.tsx)** — add nav item:
```ts
{
  to: '/match-play',
  label: 'Match Play',
  end: false,
  visibleWhen: ({course, matches}) =>
    !!course?.matchPlay?.enabled || matches.length > 0,
}
```
Extend `NavCtx` with `matches: Match[]` for the data-driven gate.

**[src/routes/Home.tsx](../../src/routes/Home.tsx)** — add card when enabled:
```ts
course.matchPlay?.enabled && {
  to: '/match-play',
  title: course.matchPlay.name ?? 'Match Play',
  desc: 'Knockout bracket, round-by-round.',
}
```

**[src/data.ts](../../src/data.ts)** — `AppData.matches: Match[]`; included in `fetchAll` and `fingerprint`.

## Files

**New:**
- [src/csv/matches.ts](../../src/csv/matches.ts) — papaparse → `Match[]`.
- [src/sheets/matchesAdapter.ts](../../src/sheets/matchesAdapter.ts) — `loadMatches`, `saveMatches`, `clearMatches`. Empty-array fallback when tab missing.
- [src/scoring/matchPlay.ts](../../src/scoring/matchPlay.ts) — engine.
- [src/scoring/matchPlay.test.ts](../../src/scoring/matchPlay.test.ts) — tests.
- [src/routes/MatchPlay.tsx](../../src/routes/MatchPlay.tsx) — public bracket page.
- [src/components/Bracket.tsx](../../src/components/Bracket.tsx) — bracket renderer.

**Modified:**
- [src/types.ts](../../src/types.ts) — `MatchPlayConfig`, `Match`, additions to `Course` and `Player`.
- [src/csv/players.ts](../../src/csv/players.ts) — read `matchPlay` column.
- [src/sheets/playersAdapter.ts](../../src/sheets/playersAdapter.ts) — write `matchPlay` in `upsertPlayer`.
- [src/sheets/courseAdapter.ts](../../src/sheets/courseAdapter.ts) — `'matchPlay'` in `JSON_KEYS`.
- [src/sheets/api.ts](../../src/sheets/api.ts) — extend `ActionName`.
- [src/data.ts](../../src/data.ts) — `matches` in `AppData`, `fetchAll`, `fingerprint`.
- [apps-script/Code.gs](../../apps-script/Code.gs) — `MATCHES_TAB`, headers, three actions; `matchPlay` in `PLAYERS_HEADERS`.
- [src/components/PlayerEditModal.tsx](../../src/components/PlayerEditModal.tsx) — opt-in checkbox.
- [src/routes/Config.tsx](../../src/routes/Config.tsx) — Match Play sub-tab.
- [src/App.tsx](../../src/App.tsx) — `/match-play` route.
- [src/components/Layout.tsx](../../src/components/Layout.tsx) — nav item.
- [src/routes/Home.tsx](../../src/routes/Home.tsx) — card.

## Edge cases (handled in design)

- **0 / 1 opt-ins**: Generate disabled with tooltip.
- **Player un-opts after generate**: bracket is a snapshot. Their saId stays. Renderer falls back to a placeholder if the player was removed. Don't auto-regenerate (would invalidate results).
- **Identical HI**: deterministic tiebreaker chain (HI ↑, lastName ↑, firstName ↑, saId ↑).
- **Re-entering an earlier round after later round is played**: `propagateAll` clears downstream `winnerSaId`/`result` if a participant changes, with an admin-visible warning banner.
- **Per-division bracket** (e.g. Bronze MP only): optional `MatchPlayConfig.divisionCode`. Filter the opt-in pool: `players.filter(p => p.matchPlay && (config.divisionCode == null || divisionFor(p, course)?.code === config.divisionCode))`.

## Verification

1. **Unit tests** (`npm test`): the new `matchPlay.test.ts` plus the existing 83 stay green.
2. **Type check**: `npx tsc --noEmit` clean at every PR.
3. **Live integration on the test Sheet** (after deploying the updated Apps Script):
   - Opt 5 players in via Manage Players → confirm `matchPlay` column writes to the Sheet.
   - Enable Match Play in Config, click Generate → `Matches` tab populates with an 8-row round 1 (3 byes auto-resolved), 4 empty round-2 rows, 2 empty SF rows, 1 empty final.
   - Enter round-1 results in the admin table → round-2 `playerA`/`playerB` populate.
   - Re-enter a round-1 result after round 2 has a winner → round-2 winner clears with a warning.
   - Public `/match-play` page renders correctly on a phone (320px) and on desktop.
   - Match Play card appears on Home; nav item appears; both gated by `enabled` OR data presence.
4. **Bracket sizes to test live**: 2, 3, 5, 8, 9, 17 opt-ins.

## Rollout

- Branch `feature/match-play` off `main`. One PR into `main` once the live integration test passes.
- Apps Script: paste the new actions and redeploy at the same time the PR merges (mirrors the original `saveTeeTimes` rollout flow).

## Out of scope

- Multiple concurrent brackets (e.g. Bronze MP + Silver MP at the same time). Schema stays single-bracket; if needed later, namespace match ids and turn `matchPlay` into an array.
- Hole-by-hole match-play scoring (winner of each hole). For v1, admin enters the result string directly. Hole-by-hole is a future enhancement that doesn't change this schema.
- Self-serve result entry by players. Admin-only mirrors the rest of the app.
- Connector lines on the bracket. Column alignment alone reads cleanly enough for v1.
- Swiss / round-robin formats.
- Auto-regenerate on opt-in changes after a bracket exists.
