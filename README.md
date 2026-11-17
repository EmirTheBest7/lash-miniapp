# lash-miniapp

Telegram Mini App for a lash studio: a native-looking booking app for clients (with an optional specialist choice when the studio has several people) and a staff app (`src/admin/`, a lazy chunk clients never download): day calendar with every person's column, manual booking, reassignment, staff profiles and weekly hours, days off and blocks, service duration/buffer and booking settings.
Vite + TypeScript + Preact, deployed to GitHub Pages. **Public repo: no secrets, no real data, only synthetic fixtures.** The API (PHP) lives in a separate private repo and is documented in its `docs/miniapp.md`.

## Principles
- **Native Telegram look:** every colour is a `themeParams` value (`src/theme.ts`, Telegram's own light/dark palettes as fallback), native BackButton / MainButton / confirm / haptics, grouped list "sections", no UI framework.
- **Few, simple requests:** every API call is a CORS *simple* request (POST, `text/plain` JSON body, no custom headers, no query string). `src/api.ts` documents the rule; unit and browser tests fail on a non-simple request.
- **Small:** client entry ~27 KB gzip (all four languages included), admin chunk ~7 KB (budgets enforced by `scripts/check-size.mjs`). No calendar library: FullCalendar's side-by-side staff columns are a Premium feature, so the day grid is hand-built; `scripts/check-licenses.mjs` still guards the allowlist.
- **Stale-cache safe:** hashed assets + `version.json` fetched uncached; a newer build forces one reload; the API can answer `426 client_outdated`.

## Develop
Nothing needs to be installed on your machine besides Docker:
```sh
docker run --rm -v "$PWD":/w -w /w node:22-alpine sh -c "npm ci && npm test && npm run build && npm run check"
```
Dev server with mock Telegram + mock API (no backend): `npm run dev`, open `http://localhost:5173/lash-miniapp/?mock=1&lang=cs&theme=dark&platform=android` (switches: `role=client|master|owner` (staff roles open the admin app), `staff=2` a studio with two people, `new=1` first-time gate, `full=1` booked-out day, `taken=1` slot taken, `again=1` book-again card; `?gallery=1` shows every component).
On a phone through the backend repo: `scripts/dev-miniapp.sh` there (PHP API + this dev server + tunnel + dev bot menu button).

## Tests
- `npm test`: Vitest (API client discipline, theme, i18n parity/placeholders/length budgets, stale-bundle guard).
- `npm run e2e`: Playwright over two builds (mock API / cross-origin API): all client flows, 4 languages x light/dark x iOS/Android screenshots (`e2e-artifacts/`, synthetic), overflow and label-width budgets, call counts, no-preflight proof. Run it in the Playwright image: `docker run --rm --ipc=host -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.65.1-noble npx playwright test` after building `dist-e2e` and `dist-xo` (see `.github/workflows/ci.yml`).
- **Live test** (manual, not CI): `playwright.live.config.ts` runs the real client AND admin flows (add a person, customer picks her, owner sees and reassigns the booking, services, master restrictions) against a REAL PHP API with synthetic `initData` signed locally. Needs a throwaway copy of the backend with `OWNER_IDS=900001`, `MASTER_IDS=900002`, `dev-seed.php --reset --me=424242 --returning`, plus `LIVE_URL` and `BOT_TOKEN` (dev bot) in the environment.

## Deploy
GitHub Pages via `.github/workflows/pages.yml`. The API base URL is the Actions **variable** `API_BASE_URL` (`https://pixelite.cz/tg/<path>/api`), read at build time and never committed; it ends up in the public bundle, so the backend does not rely on its path being secret. Origin: `https://emirthebest7.github.io` (shared by every Pages site of this account; each call still needs valid `initData`).
