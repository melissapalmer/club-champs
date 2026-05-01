# Plan — Configurable N-day events (1, 2, 3+ days)

## Context

The site currently hardcodes a 2-day event end-to-end (~40 touch-points): `DayScore.day: 1 | 2`, `PlayerLine.sat`/`.sun`, `PrizeCategory` literal strings (`'satGross'`, `'sunNet'`, …), `TeeTimeConfig.day1Start/day2Start/day1Order/day2Order`, hardcoded "Saturday"/"Sunday" tabs, leaderboard Sat/Sun columns, etc.

The user wants **N-day support** (1, 2, 3+ days), with day labels **auto-derived from a configurable start date** (no per-day text override).

**Critical constraint** — the Royal Durban Ladies Club Champs is **2026-05-03/04** (a couple days from today, 2026-05-01). This refactor must not land on `main` until after the competition. All work happens on `feat/n-day-events` branch.

Existing 2-day Sheet data must keep working after the migration without manual intervention.

## Approach

Three sequential PRs on `feat/n-day-events`. Each PR's regression oracle is *"existing 2-day data renders identical numbers and same UI."*

### PR 1 — Foundations (types + migration + helpers, no UI change)

Adds new types alongside old ones, runs migration on load, but no consumer reads the new fields yet. Existing tests pass unchanged.

**[src/types.ts](../../src/types.ts)** — additions/changes:
```ts
// Course gets:
numberOfDays: number;            // default 2 if missing
startDate?: string;              // 'YYYY-MM-DD' calendar date, no TZ

// PrizeCategory becomes structured:
type PrizeCategory =
  | { kind: 'day'; day: number; metric: 'gross'|'net'|'stableford' }
  | { kind: 'overall'; metric: 'gross'|'net'|'stableford' }
  | { kind: 'eclectic'; metric: 'net' };

// TeeTimeConfig becomes:
type TeeDayConfig = { start: string; order?: DrawOrder };
type TeeTimeConfig = {
  enabled: boolean;
  groupSize: 2 | 3 | 4;
  intervalMinutes: number;
  days: TeeDayConfig[];          // length === course.numberOfDays
};

// DayScore.day, TeeTime.day → number (1-indexed).
```

**New [src/days.ts](../../src/days.ts)** — helpers:
- `dayLabels(course)` → `{ short, long }[]` per day. Uses `Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })` so a clock-skewed admin browser doesn't shift weekdays. Parses ISO with `new Date(`${iso}T00:00:00Z`)`. Falls back to `"Day N"` if `startDate` absent.
- `isOverallMeaningful(course)` → `course.numberOfDays >= 2`. (1-day events hide overall everywhere — overall would be mathematically identical to Day 1, double-prize.)

**[src/sheets/courseAdapter.ts](../../src/sheets/courseAdapter.ts)** — `migrateCourse(raw)` runs after JSON parse on every load:
- Default `numberOfDays = 2` if missing.
- Migrate `teeTimes.day1Start` etc. → `teeTimes.days[]`. Pad with sensible defaults (`{start:'08:00', order:'best-first'}`) if `numberOfDays` exceeds existing day count.
- Migrate string `PrizeCategory` → structured (`'satGross'` → `{kind:'day', day:1, metric:'gross'}`, etc.). Idempotent — already-structured categories pass through.
- `console.warn` once per load when migration runs, as a rollout signal.

`flattenCourse` adds `'numberOfDays'` and `'startDate'` to `SCALAR_KEYS`. `teeTimes` and `divisions` keep their JSON encoding — the new nested structures serialise fine.

**[src/prizes.ts](../../src/prizes.ts)** — replace object maps with functions:
```ts
prizeLabel(course, c)   // "Saturday Gross" or "Day 1 Gross"
prizePick(c)            // (line) => number | null
prizeScope(c)           // RankScope
defaultAwards(course, format)
categoriesForFormat(course, format)
```
`defaultAwards` skips overall when `numberOfDays === 1`.

**Tests** — new [src/sheets/courseAdapter.test.ts](../../src/sheets/courseAdapter.test.ts):
- Legacy course (no `numberOfDays`, `teeTimes.day1Start`, string categories) loads correctly.
- New-format course passes through.
- Mixed already-migrated course doesn't double-migrate.

**Verification:** `npm test` green, `npx tsc --noEmit` clean. Open existing Royal Durban Sheet in dev — Leaderboard/Results/Eclectic/TeeTimes render identically (no consumer reads new fields yet). Save Course once, inspect Sheet — confirm `numberOfDays=2` row, new `teeTimes.days[]` shape, structured prize categories.

### PR 2 — Engine + scoring refactor

Switches `PlayerLine` to day-indexed shape. Updates all readers in lock-step. Tests assert **same numbers** for existing 2-day data.

**[src/scoring/engine.ts](../../src/scoring/engine.ts)**:
```ts
type DaySlice = {
  gross: number | null;
  net: number | null;
  holes: (number | null)[];
  stableford: number | null;
  stablefordHoles: (number | null)[];
};
type PlayerLine = {
  player; division; hc; ph;
  days: DaySlice[];             // length === course.numberOfDays
  overall: { gross; net; stableford };
  eclectic: { holes; gross; net };
};
```
- `buildPlayerLines` loops `for (let d = 1; d <= course.numberOfDays; d++)`.
- `overall.{gross,net,stableford}` = sum across `days[]` if all non-null else null.
- `eclecticHoles(daysHoles: (number|null)[][])` generalises to per-hole min across all provided days; returns null if any day missing for that hole.
- Drop `overallGross`/`overallNet` helpers (one-line sums now).

**`RankScope`** — same shape as new `PrizeCategory` (intentional parallelism).

**`primaryValue` / `holesForCountOut`** — switch on `kind`. The "most recent round" rule for overall count-out becomes "walk `days[]` backwards, pick the last day with any non-null hole." This correctly generalises 2-day behaviour and handles "Day 3 not yet started → tie-break on Day 2."

**[src/scoring/teeTimes.ts](../../src/scoring/teeTimes.ts)**:
- `generateDraw(dayIndex, lines, course, config)` — `dayIndex` is 1-indexed.
- Reads `config.days[dayIndex - 1]` for start/order.
- For `dayIndex >= 2`, sorts by **immediately preceding** day's standings (not cumulative), preserving the "leaders home last yesterday" semantics. Document this as a deliberate choice.
- DNS-first rule applies for any `dayIndex >= 2`.

**Guard updates** (the upper-bound `day !== 2` checks):
- [src/csv/scores.ts](../../src/csv/scores.ts) — `day < 1` only.
- [src/csv/teeTimes.ts](../../src/csv/teeTimes.ts) — same.
- [apps-script/Code.gs](../../apps-script/Code.gs) `saveTeeTimes` — `Number.isInteger(day) && day >= 1`.

**Mechanical updates** (everywhere `line.sat.x` / `line.sun.x` is read) — switch to `line.days[i].x`. Consumers in this PR:
- [src/routes/Leaderboard.tsx](../../src/routes/Leaderboard.tsx) (still 2-day shaped, just reads `days[0]`/`days[1]`)
- [src/routes/Results.tsx](../../src/routes/Results.tsx)
- [src/routes/Eclectic.tsx](../../src/routes/Eclectic.tsx)

UX should look identical after this PR — only the shape changed.

**Tests:**
- Rewrite [src/scoring/engine.test.ts](../../src/scoring/engine.test.ts), [src/scoring/teeTimes.test.ts](../../src/scoring/teeTimes.test.ts), [src/scoring/crosscheck.test.ts](../../src/scoring/crosscheck.test.ts) to use `line.days[0]`/`line.days[1]`. **Same expected numbers** (Kay's 91/95/186/154/84/80, etc.) — this is the regression oracle.
- New tests:
  - `buildPlayerLines` with `numberOfDays: 3` — `line.days.length === 3`.
  - `numberOfDays: 1` — `line.days.length === 1`, `line.overall` matches `days[0]` (acceptable; UI hides it).
  - Eclectic with 3 days picks per-hole min across all three.
  - `generateDraw(3, …)` ranks by Day-2 standings.
  - `holesForCountOut` overall-scope falls back through `days[]` backwards.

**Verification:** all tests green; numbers identical to spreadsheet for existing data; UI manually verified unchanged.

### PR 3 — UI generalisation + admin support

Now the user-visible part — config, dynamic tabs, dynamic columns.

**[src/routes/Config.tsx](../../src/routes/Config.tsx)** — Event tab additions:
- `numberOfDays` numeric input (1–7 cap).
- `startDate` HTML5 `<input type="date">`.
- Live preview: "Day 1 = Saturday, Day 2 = Sunday, …" so admin sees what the rest of the site will display.
- `onNumberOfDaysChange(prev, next, draft)` — extracted helper, separately testable. Truncates `teeTimes.days[]` on shrink; pads with defaults on grow. Drops `prizes.awards[]` for now-out-of-range days; adds `dayNGross/dayNNet` defaults for newly-added days.
- `TeeTimesEditor` becomes day-array driven: `config.days.map((d, i) => <DayRow ... />)`.
- `PrizesEditor` reads `categoriesForFormat(course, format)` and `prizeLabel(course, cat)`. Drops the direct `PRIZE_LABELS[cat]` lookup.
- `hasDay1Scores` gate becomes `hasPriorDayScores(d)` — ungated for day 1; gated on day-`d-1` scores otherwise.

**[src/routes/Leaderboard.tsx](../../src/routes/Leaderboard.tsx)**:
- Header `colSpan` blocks rendered from `dayLabels(course)`.
- Per-day `<th>Gross</th><th>Net|Pts</th>` repeated.
- Hide Total block when `!isOverallMeaningful(course)` (i.e. 1-day).
- `MedalHoleCard`/`StablefordHoleCard` map `line.days` and use short labels (`'Sat'`, `'Mon'`, `'D3'`).
- Copy: `'Medal scoring across N days · ranked by overall net'` templated.

**[src/routes/Results.tsx](../../src/routes/Results.tsx)**:
- `awards.map(...)` reads `prizeLabel(course, category)`.
- `category === 'eclectic'` → `category.kind === 'eclectic'`.

**[src/routes/TeeTimes.tsx](../../src/routes/TeeTimes.tsx)**:
- `Tabs` source: `dayLabels(course).map((l, i) => ({ id: String(i+1), label: l.long }))`.
- `dayLabel` → `labels[day-1].long`.

**[src/routes/Eclectic.tsx](../../src/routes/Eclectic.tsx)**:
- Description: `"Best of " + labels.map(l => l.long).join(', ') + " per hole · …"`.

**[src/components/ScoreEntryPanel.tsx](../../src/components/ScoreEntryPanel.tsx)**:
- Day picker: `course.numberOfDays` buttons; label = `labels[d-1].long`. flex-wrap layout for N >= 5.
- `initialDay` default: first day with no entry for the player (small UX win for N-day events).

**Tests:**
- E2E synthetic: 3-day course, scores for all three days, eclectic per-hole min across all three, overall sums all three, day-3 prizes render with weekday name.
- Day labels: `startDate='2026-05-01'` (Friday) + `numberOfDays=3` → `['Friday','Saturday','Sunday']`.
- 1-day course: `defaultAwards` includes `day1Gross/Net/eclectic` only; `overall*` absent.
- `onNumberOfDaysChange` shrink/grow logic.

**Verification:** `npm test` green. Manual on a test sheet:
- Bump to `numberOfDays=3`, add a Day-3 score → Leaderboard shows 3 day columns, Results shows day-3 weekday prize, TeeTimes has 3 tabs.
- Bump to `numberOfDays=1` → Overall columns hidden, prize defaults skip overall.
- Edit `startDate` → labels update everywhere.
- Royal Durban (2-day) Sheet still loads and renders identically.

### PR 4 (small, post-competition) — Drop legacy migration

Once PR 1–3 have shipped and run through one real event, remove the legacy-shape migration in `migrateCourse` (the string-`PrizeCategory` and `day1Start/day2Start` paths). Keep the `numberOfDays` default (still useful for any course that never opened Config).

## Branching + rollout

- **Branch**: `git checkout -b feat/n-day-events` off `main`. **All three PRs merge into the branch, NOT into main**, until after the 2026-05-04 competition.
- After the competition, fast-forward `main` to the branch.
- **No Apps Script changes** until PR 2 ships. The single guard bump (`day < 1`) is one-line.
- **Mixed-deployment risk**: if an admin keeps an old browser tab open after a new save, the 15-second poll will fail to parse the structured prize categories. Mitigation: refresh all admin tabs before saving Config the first time after deploying PR 1. Acceptable since admin = one person.

## Files

**New:**
- [src/days.ts](../../src/days.ts) — `dayLabels`, `isOverallMeaningful`.
- [src/sheets/courseAdapter.test.ts](../../src/sheets/courseAdapter.test.ts) — migration tests.

**Modified across the three PRs:**
- [src/types.ts](../../src/types.ts) — Course gains `numberOfDays`/`startDate`; `PrizeCategory` structured; `TeeTimeConfig.days[]`; `DayScore.day`/`TeeTime.day` → number.
- [src/sheets/courseAdapter.ts](../../src/sheets/courseAdapter.ts) — `migrateCourse` on load; new `SCALAR_KEYS` entries.
- [src/prizes.ts](../../src/prizes.ts) — functions replace maps.
- [src/scoring/engine.ts](../../src/scoring/engine.ts) — `PlayerLine.days[]`; `buildPlayerLines` loop; eclectic generalisation; `RankScope` parallel to `PrizeCategory`.
- [src/scoring/teeTimes.ts](../../src/scoring/teeTimes.ts) — `generateDraw(dayIndex, …)` + previous-day standings.
- [src/scoring/teeTimes.test.ts](../../src/scoring/teeTimes.test.ts), [src/scoring/engine.test.ts](../../src/scoring/engine.test.ts), [src/scoring/crosscheck.test.ts](../../src/scoring/crosscheck.test.ts) — shape rewrites + N-day tests.
- [src/csv/scores.ts](../../src/csv/scores.ts), [src/csv/teeTimes.ts](../../src/csv/teeTimes.ts) — drop upper-bound day guard.
- [apps-script/Code.gs](../../apps-script/Code.gs) — drop upper-bound day guard in `saveTeeTimes`.
- [src/routes/Config.tsx](../../src/routes/Config.tsx) — Event-tab fields, dynamic Tee Times day rows, dynamic prize editor, `onNumberOfDaysChange`.
- [src/routes/Leaderboard.tsx](../../src/routes/Leaderboard.tsx) — N-column rendering + hole-card.
- [src/routes/Results.tsx](../../src/routes/Results.tsx) — `prizeLabel(course, cat)`.
- [src/routes/TeeTimes.tsx](../../src/routes/TeeTimes.tsx) — dynamic day tabs.
- [src/routes/Eclectic.tsx](../../src/routes/Eclectic.tsx) — labels in copy.
- [src/components/ScoreEntryPanel.tsx](../../src/components/ScoreEntryPanel.tsx) — day picker.

## Verification

1. `npm test` green at every PR boundary.
2. `npx tsc --noEmit` clean at every PR boundary.
3. Existing 2-day Sheet (Royal Durban) renders identically through all three PRs.
4. Test sheets at `numberOfDays = 1` and `numberOfDays = 3` exercise the full UI.
5. Date-derived labels: `startDate='2026-05-01'` → Friday, Saturday, Sunday.
6. Migration: load a Sheet saved by the old code, save through the new code, reload — no data loss, structured shape persists.

## Out of scope (explicit)

- Per-day eclectic handicap percentage (one course-wide percentage stays).
- Skipping a day (numbering is contiguous).
- Per-day-only prizes mechanism (existing per-category toggle scales fine).
- Backward serialisation (saving old shape from new code).
