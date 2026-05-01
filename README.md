# Royal Durban GC — Club Champs scoring site

Static site (Vite + React + TypeScript) hosted on GitHub Pages, with **Google Sheets as the live data store**. The site reads from a Google Sheet for player roster, scores, and course config; admins write back via a small Google Apps Script web app deployed against the same Sheet.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # scoring engine tests (pinned to spreadsheet values)
npm run build    # produces dist/
```

The dev server needs a Sheet to read from — see "Setup checklist" below. Without a Sheet configured, every page shows a "Site not configured yet" prompt with a button to open the settings dialog (admin only).

## Where the data lives

A single Google Sheet with three tabs:

| Tab | Shape | Notes |
| --- | --- | --- |
| `Players` | `firstName, lastName, saId, hi, division` | One row per player. `division` is an optional override (`A`, `B`, `C`, `D`); leave blank to auto-place by HI. |
| `Scores`  | `saId, day, h1, h2, … h18` | One row per player-day. Empty hole cells = not yet entered. |
| `Course`  | `key, value` | Course rules. Scalar settings (club, event, gender, maxHandicap, eclecticHandicapPct) are individual rows; `tees`, `divisions`, `holes`, `branding` are JSON-encoded values. |

The Sheet is published "to web" so spectators read it directly via `gviz` CSV — no auth, no rebuild delay. Updates appear on the site within ~15 seconds of any edit (in-Sheet or via the admin UI).

## Setup checklist (one-time per club)

### 1. Create the Sheet

- New Google Sheet with the three tab names exactly: **Players**, **Scores**, **Course**.
- Add headers (first row of each tab):
  - **Players:** `firstName | lastName | saId | hi | division`
  - **Scores:** `saId | day | h1 | h2 | h3 | h4 | h5 | h6 | h7 | h8 | h9 | h10 | h11 | h12 | h13 | h14 | h15 | h16 | h17 | h18`
  - **Course:** `key | value`
- Optionally seed the Course tab with rows for `club`, `event`, `gender`, `maxHandicap`, `eclecticHandicapPct`. Editing these later is fine via the Config tab in the app.
- A fourth tab — **TeeTimes** — is created and managed by the app the first time you generate a draw (see "Tee Times" below). You don't need to make it yourself.
- **File → Share → Publish to web → Entire document → Comma-separated values → Publish.** This makes the read URLs work for spectators.

### 2. Deploy the Apps Script web app

- Sheet → **Extensions → Apps Script.**
- Replace the default `Code.gs` with the contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
- At the top of `Code.gs`, set:
  - `SHEET_ID` to your Sheet's ID (the long string in the Sheet URL between `/d/` and `/edit`)
  - `SHARED_SECRET` to a random string of your choice (you'll paste this into the site once)
- **Deploy → New deployment → Type "Web app"**:
  - **Execute as:** Me
  - **Who has access:** Anyone
- Copy the resulting **Web app URL** (ends with `/exec`).

### 3. Wire the site to the Sheet

- Open the deployed site with the admin key: `https://<your-host>/?key=durban2026`
- Open **Score Entry** (or **Config**, or **Manage Players**) — they all expose the same **Configure Google Sheet** button.
- Paste in:
  - **Sheet ID** (the long string from the Sheet URL)
  - **Apps Script web-app URL** (the `/exec` URL from step 2)
  - **Shared secret** (the same value you put into `SHARED_SECRET`)
- Save. The site now reads from the Sheet and writes through the Apps Script. All three values live only in your browser's `localStorage`.

## Admin

The admin URL key activates extra tabs in the nav.

- Add `?key=durban2026` to **any** URL (`/?key=durban2026`, `/#/players?key=durban2026`, etc.).
- Once stored, the param is stripped from the address bar and the key is remembered for the browser session.
- Two extra tabs appear:
  - **Manage Players** — add / edit / remove players (writes directly to the Players tab).
  - **Config** — edit course rules, tees, divisions, holes, prizes, branding (writes the Course tab).
- The **Scores** tab also gains a pencil icon on each row when admin — clicking opens an in-page modal to edit that player's hole-by-hole scores for either day.

## Tee Times (optional, off by default)

Auto-generates the day's draw and publishes it to a public **Tee Times** tab in the site nav.

- Open **Config** → **Tee Times** card (admin only).
- Tick **Enable Tee Times tab**, set **group size** (2 / 3 / 4-balls), **interval** (mins), and the **Day 1 / Day 2 start times**. Save.
- **Generate Day 1 draw** — orders the field by HI ascending within each division (best players off first), packs into groups, writes to the `TeeTimes` Sheet tab. The Day 2 button is disabled until at least one Day-1 score is entered.
- **Generate Day 2 draw** — same but ordered by Day-1 standings (worst-first, best-last) using each division's metric (net for medal, points for stableford). DNS players go to the start of their block.
- Stableford and medal players never share a group — they're packed into separate format blocks.
- Generation overwrites only the requested day's rows; the other day stays put.

The `TeeTimes` Sheet tab is created automatically on first generation with columns `day | time | saId | name`. The `name` column is a snapshot at generation time for human readability — the website always resolves names live from the Players tab, so renames flow through without regenerating.

When the feature flag is off, the Tee Times nav item is hidden and the route shows a "not enabled" message.

## Branding

Edit the **Branding** section on the Config tab to change:

- **Logo** — paste any URL, or upload a PNG/WebP into the Sheet's hosting folder. The site uses Royal Durban's logo from `public/royal-durban-logo.webp` if no logo URL is configured.
- **Colours** — six tokens (Primary navy, Primary darker, Accent gold, Accent lighter, Background, Body text). They apply live across the whole UI via CSS variables.

## Project layout

```
apps-script/
  Code.gs              # Google Apps Script — copy into Apps Script editor
public/
  royal-durban-logo.webp
  apple-touch-icon.png
  favicon-32.png
src/
  scoring/             # pure scoring engine + vitest tests
  csv/                 # CSV parse/serialise (still used by Sheets adapters)
  sheets/              # Sheets API client + per-tab adapters + settings
  components/          # layout, dialogs, score entry panel, etc.
  routes/              # Leaderboard, Eclectic, Results, Players, Enter, ManagePlayers, Config
  data.ts              # live polling hook reading the Sheet
  admin.ts             # URL-key admin gate
  theme.ts             # branding palette + logo URL helper
.github/workflows/deploy.yml
```

## Verifying scoring against the spreadsheet

`src/scoring/engine.test.ts` and `src/scoring/crosscheck.test.ts` pin the scoring formulas against worked examples copied directly from the original workbook (every player from the 2025 spreadsheet's `B Div` / `C Div`). If you change any formula, run `npm test` — failures mean the engine has drifted from Excel.

## Extending later

- **Men's divisions** — switch `gender` to `men` in the Config tab. The site uses the men's CR/Slope per tee and the men's stroke index per hole automatically.
- **Different course / different tees** — edit the relevant rows in the Course tab via the Config UI.
- **Different prize categories** — Config tab → per-division Prizes editor.
