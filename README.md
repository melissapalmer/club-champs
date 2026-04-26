# Royal Durban GC — 2026 Ladies Club Champs

Web replacement for the `WomenClubChamps_Scoring_2025` Excel workbook.
Static site (Vite + React + TypeScript) hosted on GitHub Pages.
All scoring is pure client-side maths over a few CSV files in `public/data/`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # scoring engine tests (pinned to spreadsheet values)
npm run build    # produces dist/
```

## Where the data lives

| File                       | What it is                                                                    |
|----------------------------|-------------------------------------------------------------------------------|
| `public/data/course.json`  | Tee tables, division thresholds, max handicap, eclectic %                      |
| `public/data/players.csv`  | `firstName,lastName,saId,hi,division` — division optional override            |
| `public/data/scores.csv`   | One row per `saId,day` with columns `h1`…`h18`. Empty cells = not yet entered |

Anyone comfortable with a spreadsheet can edit any of these files in Excel/Sheets and commit them.

### Division placement

By default a player's division is derived from `hi` against the ranges in `course.json`. To force a placement (e.g. a low-handicap player joining Silver because Gold has too few entries), put the division code in the `division` column of `players.csv`:

```csv
TARA,SMITH,2700438384,1,B
```

## Score entry workflow

The `/enter` page is a simple in-browser form. Pick a player and a day, type the 18 hole scores, click **Save**.

- **With a GitHub token configured:** the page commits the updated `public/data/scores.csv` directly to the repo. GitHub Pages rebuilds in ~30 s and the leaderboard updates on the next refresh.
- **Without a token:** Save downloads `scores.csv` for you to commit by hand.

### Setting up the token (one-time, organiser only)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → **Generate new token**.
2. **Repository access:** select only this repo.
3. **Permissions → Repository permissions → Contents:** Read **and** Write.
4. Copy the token (`github_pat_…`).
5. Open the deployed site, go to **Score Entry**, click **Configure GitHub token**, fill in:
   - Owner (your GitHub username or org)
   - Repo (e.g. `club-champs`)
   - Branch (default `main`)
   - The token
6. **Save**. The token lives only in your browser's `localStorage`. You can wipe it with **Forget token**.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. The first push to `main` runs `.github/workflows/deploy.yml`, which tests, builds, and publishes `dist/`.
4. Subsequent score commits trigger the same workflow automatically.

## Project layout

```
public/
  data/                # CSV + JSON read at runtime
  royal-durban-logo.webp
src/
  scoring/             # pure scoring engine + vitest tests
  csv/                 # CSV parse/serialise
  components/          # layout, division tabs
  routes/              # Leaderboard, Eclectic, Results, Players, Enter
  data.ts              # fetch + cache for data files
  github.ts            # GitHub Contents API helper for /enter
.github/workflows/deploy.yml
```

## Verifying scoring against the spreadsheet

`src/scoring/engine.test.ts` pins the scoring formulas against worked examples copied directly from the original workbook (Kay Dunkley row 5 of `B Div` / `Eclectic B`). If you change any formula, run `npm test` — failures mean the engine has drifted from Excel.

## Extending later

- **Men's divisions** — change `gender` to `men` in `course.json`, edit the `divisions` array, list men's players in `players.csv`. No code changes needed.
- **Different course / different tees** — edit `course.json`.
- **Different prize categories** — edit the `CATEGORIES` array in `src/routes/Results.tsx`.
- **Live multi-device entry** — would need a small backend (Cloudflare Workers, Vercel) writing to the same CSVs. Out of scope for 2026.
