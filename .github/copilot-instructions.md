# Compare Achievements

Angular 22 (standalone components) app with an Express server for comparing Steam and
PlayStation Network (PSN) game achievements/trophies across multiple friends. Deployed as
a static SPA to GitHub Pages (custom domain via `CNAME`); `src/server.ts` (Angular
SSR/Express) is not used by the GitHub Pages deploy, but it IS the actual server that Render
runs for the `/api/steam` and `/api/psn` endpoints (see `render.yaml`) — the GitHub Pages
build calls out to that separately-hosted Render server instead of using its own backend.
`src/server/server.ts` is a separate, unused legacy Express entry point — do not wire new
routes into it; wire them into `src/server.ts` instead.

## Commands

- Install: `npm install`
- Run locally (Angular dev server): `npm start` (= `ng serve`)
- Build: `npm run build` (= `ng build`, output to `dist/`)
- Unit tests (Karma/Jasmine): `npm run test` (= `ng test`)
  - Run a single spec: `ng test --include='**/comparison.component.spec.ts'`
  - Run tests matching a name: `ng test --include='**/*.spec.ts'` then filter with Jasmine's `fit`/`fdescribe` in the spec file
- Manual build + publish to GitHub Pages: `npm run prod` (= `npm run deploy` + `gh-pages` package;
  run this locally from an up-to-date `master` if you need to publish outside of CI)

There is no separate lint script configured in `package.json`.

## Architecture

- `src/app` — the Angular frontend (standalone components, no NgModules). `app.routes.ts`
  is currently empty; `AppComponent` renders `ComparisonComponent` directly — this is
  effectively a single-view app, not a multi-route SPA.
- `src/app/services/platform-api.interface.ts` — the `PlatformApiService` interface (search,
  player summaries, owned games, common games, achievements, schema, friends) implemented in
  parallel by `steam-api.service.ts` and `psn-api.service.ts`. `ComparisonComponent` picks
  between the two Angular services at runtime via its `activeService` getter, keyed off the
  selected platform, so the rest of the component never branches on platform.
- `src/app/services/steam-api.service.ts` — Angular `HttpClient` wrapper that calls the
  backend's `/api/steam/*` endpoints and maps raw Steam API shapes (`SteamUser`, etc.) into
  the app's own models (`User`, `Game`, `Achievement`) via a `toUser()`-style mapper.
- `src/app/services/psn-api.service.ts` — Angular `HttpClient` wrapper for `/api/psn/*`. Unlike
  the Steam service, the PSN backend service already normalizes responses into `User`/`Game`/
  `Achievement`, so this is a thin pass-through with no client-side mapper.
- `src/app/models` — plain TypeScript interfaces shared between frontend and (via relative
  import) backend code, e.g. `src/server/services/steam-api.service.ts` imports
  `Game` from `../../app/models/game.interface`. Keep model shapes in `src/app/models` as
  the single source of truth for both sides.
- `src/server` — parallel Express implementations of the platform operations:
  `src/server/services/steam-api.service.ts` (routed by `steam-api.routes.ts`) and
  `src/server/services/psn-api.service.ts` (routed by `psn-api.routes.ts`), both mounted in
  `src/server.ts`. Every Steam/PSN API call goes through these server-side services, never
  directly from the browser, to keep `STEAM_API_KEY`/`PSN_NPSSO` off the client. All responses
  use a consistent `{ success: boolean, error?: string, ... }` envelope that the Angular
  services unwrap.
- Steam's Web API has no free-text username search: `searchUsers` resolves a 17-digit
  SteamID64 directly, otherwise treats the input as a vanity URL and calls
  `ResolveVanityURL` first (see comments in `src/server/services/steam-api.service.ts`).
- PSN has no official public API. `src/server/services/psn-api.service.ts` uses the
  community `psn-api` package, authenticating as a single PSN account via an `npsso` token
  (`PSN_NPSSO`, analogous to `STEAM_API_KEY`) exchanged at runtime for access/refresh tokens
  that are cached in memory and refreshed as they expire. A PSN "game" (trophy title) is
  identified by an `npCommunicationId` plus an `npServiceName` (`"trophy"` for PS3/PS4/Vita,
  `"trophy2"` for PS5); both are packed into the opaque `Game.id` string sent to the frontend
  since the trophy endpoints need both values back to fetch schema/achievements.
- Environment/config: `src/environments/environment.ts` (and `.prod.ts`) hold
  `apiEndpoints.steam`/`apiEndpoints.psn` used by the Angular services; `STEAM_API_KEY` and
  `PSN_NPSSO` are read server-side from `.env` via `dotenv` (see `.env.example`).

## Conventions

- Components are standalone (`standalone: true`, explicit `imports: [...]`), not declared in NgModules.
- Frontend Steam response typing uses a generic `ApiResult<T>` wrapper with an indexable
  `[key: string]: any` for the variable payload key (`results`, `players`, `games`, etc.).
- User search/suggestion lists must show friends first, sorted alphabetically by name (not
  by id or insertion order).
- CI (`.github/workflows/deploy.yml`, Node version pinned in `.nvmrc`) builds and deploys on every push to `master`
  using `npm run deploy` (build only) + the `peaceiris/actions-gh-pages` action to publish —
  it does **not** call `npm run prod` or the local `gh-pages` script. It writes
  `STEAM_API_KEY` into a fresh `.env` from a GitHub secret before building.
