# Testing Guide — Club Champs scoring site

A walkthrough of what the site does and what to test. Written for a QA tester who hasn't played golf before — the first section is a quick golf primer so the rest of this document makes sense.

---

## 1. Golf in 90 seconds (skip if you already know this)

A round of golf is 18 holes. On each hole you try to get the ball into a cup using as **few strokes (hits) as possible** — fewer is better.

| Term | What it means |
| --- | --- |
| **Stroke** | One swing at the ball. |
| **Par** | The "expected" number of strokes for a hole. Holes are par 3, 4, or 5. A standard 18-hole course has a total par around 70–72. |
| **Gross score** | The actual number of strokes taken — the raw count. |
| **Birdie / Eagle / Albatross** | Scoring under par. Birdie = 1 under par, Eagle = 2 under, Albatross = 3 under. |
| **Bogey / Double / Triple** | Scoring over par. Bogey = 1 over, Double = 2 over, Triple = 3 over. |
| **Handicap Index (HI)** | A skill rating for each player. **Lower is better** (a HI of 1 is much better than HI of 30). It's a decimal e.g. `14.2`. |
| **Course Rating (CR)** | What a "scratch" (HI 0) player is expected to shoot on a specific course. Decimal, around 67–80. |
| **Slope** | How much the course punishes higher-handicap players. Number from 55–155. **113 = average difficulty.** |
| **Course Handicap (HC)** | A player's HI adjusted for *this particular course* via a formula. Used to figure out their handicap strokes. |
| **Playing Handicap (PH)** | The number of strokes subtracted from gross to get net. Often equals HC for stroke-play events. |
| **Net score** | `Gross − PH`. **The fair-comparison number** — lets a HI 25 player and a HI 5 player compete on equal terms. |
| **Tees** | Different starting positions on each hole, marked by coloured tee markers (Yellow, White, Blue, Red). Different tees = different distances = different CR / Slope. Traditionally men play from longer tees, women from shorter. |
| **Stroke Index (SI)** | Each hole is ranked 1 (hardest) to 18 (easiest). Used to decide which holes get handicap "bonus strokes" — mostly informational here. |
| **Medal play** | A scoring format: lowest net score over the round wins. This competition is medal play. |
| **Eclectic** | A side competition: take the **best score on each hole across all your rounds** and combine them into one super-round. Then subtract a partial handicap. |

### Why "net" matters

A scratch player might shoot 75; a 25-handicap player might shoot 100. Both are great rounds *for that player*, but you can't compare gross. By subtracting handicap, both players come out around 73 net — now they're directly comparable. **Net is the great equaliser.**

---

## 2. What this site does

It replaces a complex Excel scoresheet with a website for **club championships** — a 2-day, 2-round tournament played over a weekend.

**Two days, eighteen holes each day = 36 holes total.** Players are split into divisions by skill (Gold for low handicaps, Silver for middle, Bronze for higher). Within each division they compete for prizes (Saturday Net winner, Sunday Gross winner, Overall winner, etc.). There's also an Eclectic side competition spanning the weekend.

The site shows live scores during the weekend and stores everything in plain text files (`players.csv`, `scores.csv`, `course.json`) committed to GitHub. No database, no login system for spectators — anyone can view, but only the organiser (with an access key + GitHub token) can enter scores or change config.

---

## 3. Who sees what

Two modes:

### Public / spectator (default)

Anyone visiting the URL sees the public pages. No login, no setup.

| Tab | What it shows |
| --- | --- |
| **Players** | The roster, grouped into division tabs (Gold / Silver / Bronze). Per player: HI, Course Handicap (HC), Playing Handicap (PH), tee colour. |
| **Scores** | The live leaderboard, one tab per division, ranked by overall net. Click a row to expand a hole-by-hole card showing both days' scores with traditional scorecard symbols. |
| **Eclectic** | The Eclectic side comp leaderboard. Shows the per-hole "best of both days" and the eclectic net. |
| **Results** | The prize summary — top 1, 2, or 3 finishers (configurable) per division per category (Sat Gross, Sat Net, Sun Gross, Sun Net, Overall, Eclectic). |

### Admin (organiser)

Add `?key=durban2026` to **any URL** (e.g. `…/club-champs/?key=durban2026`) and the access key is stored in your browser session. Two extra tabs appear:

| Tab | What it does |
| --- | --- |
| **Manage Players** | Add / edit / remove players from the roster. Saves directly to `players.csv` in the repo via a GitHub token. |
| **Config** | Edit course rules, branding, tees, divisions, hole-by-hole par/SI, prize categories. Saves directly to `course.json`. |

The **Scores** tab also gains a pencil icon on each row when admin — clicking opens a modal to edit that player's hole-by-hole scores for either day.

The "real" security on writes is a **GitHub Personal Access Token** the admin pastes once into the browser. Without it, the URL key just makes the admin tabs visible but Save buttons fall back to "download CSV for manual commit." For testing you can ignore the token entirely — saves will just download files instead of committing.

---

## 4. Score symbols (the scorecard shapes)

When a row is expanded on the Scores tab, each hole's score is rendered with a traditional scorecard shape that depends on **score versus par**:

| Score relative to par | Term | Symbol |
| --- | --- | --- |
| 3 or more under | Albatross+ | Solid circle with a frame around it |
| 2 under | Eagle | Solid circle |
| 1 under | Birdie | Open circle (just an outline) |
| Equal to par | Par | No symbol — just the number |
| 1 over | Bogey | Open square |
| 2 over | Double bogey | Solid square |
| 3 or more over | Triple+ | Solid square with a frame around it |

Above the leaderboard there's a small **legend** showing each symbol with its label.

---

## 5. The two competitions running in parallel

### Medal (the main event)

Each day:
- Player's **gross** = sum of their 18 hole scores
- Player's **net** = gross − Playing Handicap

Over the weekend:
- **Overall gross** = Saturday gross + Sunday gross
- **Overall net** = Saturday net + Sunday net

Prizes are awarded for whichever combination the club configures.

### Eclectic (the side comp)

For each of the 18 holes, take the **better of your two scores (Sat or Sun) for that hole**. Sum them = Eclectic Gross. Then subtract a fraction of your Playing Handicap (default 25%) = Eclectic Net.

Example (one hole, par 4):
- Saturday: scored 6 (double bogey)
- Sunday: scored 4 (par)
- Eclectic uses **4** for that hole.

Eclectic only "completes" once a player has both days entered — until then the eclectic gross/net shows as `—`.

---

## 6. Smoke-test scenarios

A pragmatic order to walk through. Do the public flows first, then admin.

### 6.1 Public, no setup

- [ ] Site loads at `https://melissapalmer.github.io/club-champs/`. Navy header with logo, title shows the club + event.
- [ ] **Players tab**: Silver and Bronze tabs both show their rosters. Players sorted alphabetically by surname. Players with `(override)` next to their name are showing a manually-set division.
- [ ] **Scores tab**: Silver/Bronze tabs each show a ranked table. Top of table = lowest net (best). Click any row → expanded card appears below it with Sat / Sun hole-by-hole. Expected: par row at top, then Sat row, then Sun row.
- [ ] In the expanded card, verify symbols line up with the math:
  - A hole where the player scored 3 on a par 4 should be in an open circle (birdie).
  - A 4 on a par 4 should have no symbol.
  - A 5 on a par 4 should be in an open square (bogey).
- [ ] **Legend** above the table — each symbol shows with its label (Albatross+, Eagle, Birdie, Par, Bogey, Double, Triple+).
- [ ] **Eclectic tab**: showing per-hole min(Sat, Sun) for each player. Verify by spot-checking one player against their Scores expanded card.
- [ ] **Results tab**: shows prize categories. If a category is set to Top 2 it lists 1st and 2nd. If a category is missing for a division, the section just isn't there.
- [ ] **Mobile portrait**: open the site on your phone in portrait — table should show Pos / Player / Sat Net / Sun Net / Total Net (5 columns). Tap a row, expanded card scrolls horizontally if needed but is readable.
- [ ] **Mobile landscape**: rotate. Now the table should show **all** columns including HI, HC, PH, plus the gross columns.

### 6.2 Admin, no GitHub token (everything saves as a download)

To enable admin: append `?key=durban2026` to any URL, e.g. `…/club-champs/?key=durban2026`. The URL parameter is stripped from the address bar after it's accepted. **Manage Players** and **Config** tabs should now appear.

- [ ] **Score Entry via the pencil**: on Scores tab, each row has a small pencil icon. Click it. A modal opens with that player pre-selected. Type in 18 hole scores for Sat (or change existing scores). The footer should show running totals: 18/18 holes, In, **Gross**, PH, **Net**. Click Save → since no token is configured, your browser downloads `scores.csv`. Modal stays open with a green "Downloaded scores.csv" note. (To "commit" you'd manually replace `public/data/scores.csv` and push — but for QA, just verify the download happens with the right contents.)
- [ ] Repeat for Sun day for the same player.
- [ ] Open the downloaded `scores.csv`. Find the row for the player+day you just entered. The 18 hole values should match what you typed.
- [ ] **Manage Players tab**: + Add player → opens modal. Try saving with empty name → button is disabled, errors listed. Save with valid values → downloads new `players.csv` with the added row.
- [ ] Edit an existing player → SA ID is greyed out (can't be changed); name and HI are editable.
- [ ] Remove a player → confirmation dialog → Confirm → downloads `players.csv` without that row.
- [ ] **Config tab**: Edit the event title (e.g. "2025 Ladies Club Champs" → "QA Test Event"). Click Save → downloads `course.json`. Discard button → form resets to the saved values.
- [ ] In Config → Holes section, change a par for hole 1 from 4 to 5. The **Total par** indicator at the top of the section should update live.
- [ ] In Config → Branding, click the colour picker for "Primary (navy)" and pick a shockingly different colour (e.g. red). The header bar should NOT change yet (we apply on save). Hit Save → page reloads its data → the header turns red. Switch it back.

### 6.3 Trickier edge cases

- [ ] Open the site in an **incognito** window with no key. Tabs visible should be: Players, Scores, Eclectic, Results. **Manage Players** and **Config** should NOT appear.
- [ ] Visit `…/club-champs/#/manage-players` directly without the key — page should say "Not available · Manage Players is admin-only."
- [ ] Visit `…/club-champs/?key=durban2026` — admin tabs appear. Refresh the page. Still admin (sessionStorage holds it). Close the tab. Open a new tab to the bare URL — admin gone (sessionStorage doesn't survive tab close).
- [ ] In Config, set a division to **Hidden** (the checkbox in the division card) and save. That division's tab should disappear from Players, Scores, Eclectic, and Results. Un-hide and save → tab returns.
- [ ] In Config → Prizes per division, set Eclectic to "Top 1" instead of 2. Results page should now show only one Eclectic winner for that division.
- [ ] In Config, switch event gender from "women" to "men". Course Handicap values for every player should change (because the men's CR/Slope are different per tee).
- [ ] **Tied scores**: if two players have the same net score, they should share a position number on the leaderboard (e.g. both shown as 2., next player as 4. — standard "1224" ranking).

### 6.4 Things to look out for

- The site uses session-based admin auth — pretty bare-bones. Don't expect typical "log in / log out" UX.
- Browser caching can be sticky for assets. If something looks stale, do a **hard refresh** (Cmd-Shift-R / Ctrl-Shift-R).
- After hitting Save in admin, GitHub Pages takes ~30 seconds to rebuild and serve the change. If a fresh refresh doesn't show the update, give it a beat then try again.
- Eclectic gross/net shows `—` for any player who doesn't have both days entered yet. That's correct — the math literally needs both rounds.

---

## 7. Reporting issues

When you find something:

1. Note the **page** (Players / Scores / etc.) and the **tab/division** if applicable.
2. Note **which player** (use full name) if it's a row-specific issue.
3. Note **screen size** — phone portrait, phone landscape, tablet, desktop. Even better: rough viewport width if you have DevTools open.
4. Screenshot is great. If it's an interaction bug ("I clicked X and Y happened"), say what you expected vs. what you got.
5. If it's a number that looks wrong, the spreadsheet originally compared this with is in the repo (`WomenClubChamps_Scoring_2025 v0 0 5.xlsx`) — but verifying against that is the developer's job, not the tester's. Just flag the discrepancy.

Anything that breaks the rendering, doesn't update after a save, or shows wrong numbers is worth flagging — there's no such thing as a too-trivial bug for this kind of bespoke site.
