# Compare Achievements

Angular 21 (standalone components) app with an Express server for comparing Steam game
achievements across multiple friends. Deployed as a static SPA to GitHub Pages (custom
domain via `CNAME`); Angular SSR/Express (`server.ts`) exists in the codebase but is not
used by the production deploy.

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
- `src/app/services/steam-api.service.ts` — Angular `HttpClient` wrapper that calls the
  backend's `/api/steam/*` endpoints and maps raw Steam API shapes (`SteamUser`, etc.) into
  the app's own models (`User`, `Game`, `Achievement`) via a `toUser()`-style mapper.
- `src/app/models` — plain TypeScript interfaces shared between frontend and (via relative
  import) backend code, e.g. `src/server/services/steam-api.service.ts` imports
  `Game` from `../../app/models/game.interface`. Keep model shapes in `src/app/models` as
  the single source of truth for both sides.
- `src/server` — a parallel Express implementation of the same Steam operations
  (`src/server/services/steam-api.service.ts`, routed by `src/server/routes/steam-api.routes.ts`).
  Every Steam Web API call goes through this server-side service, never directly from the
  browser, to keep `STEAM_API_KEY` off the client. All responses use a consistent
  `{ success: boolean, error?: string, ... }` envelope that the Angular service unwraps.
- Steam's Web API has no free-text username search: `searchUsers` resolves a 17-digit
  SteamID64 directly, otherwise treats the input as a vanity URL and calls
  `ResolveVanityURL` first (see comments in `src/server/services/steam-api.service.ts`).
- Environment/config: `src/environments/environment.ts` (and `.prod.ts`) hold
  `apiEndpoints.steam` used by the Angular service; `STEAM_API_KEY` is read server-side from
  `.env` via `dotenv` (see `.env.example`).

## Conventions

- Components are standalone (`standalone: true`, explicit `imports: [...]`), not declared in NgModules.
- Frontend Steam response typing uses a generic `ApiResult<T>` wrapper with an indexable
  `[key: string]: any` for the variable payload key (`results`, `players`, `games`, etc.).
- User search/suggestion lists must show friends first, sorted alphabetically by name (not
  by id or insertion order).
- CI (`.github/workflows/deploy.yml`, Node 22) builds and deploys on every push to `master`
  using `npm run deploy` (build only) + the `peaceiris/actions-gh-pages` action to publish —
  it does **not** call `npm run prod` or the local `gh-pages` script. It writes
  `STEAM_API_KEY` into a fresh `.env` from a GitHub secret before building.
