# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Requirements

Node.js >= 18 is required. The backend uses Express 5 and TypeScript 5.9, which are incompatible with older Node versions. Use `nvm install 20 && nvm use 20` if needed.

## Project Layout

This is a monorepo with three sub-projects under `clinicalTrials/`:

```
clinicalTrials/
├── backend/                    # Express.js backend
│   ├── src/
│   │   ├── auth/              # JWT authentication
│   │   ├── client/            # ClinicalTrials.gov API client
│   │   ├── models/            # Data models
│   │   ├── services/          # Business logic
│   │   ├── storage/           # PostgreSQL client
│   │   ├── validators/        # Request validation
│   │   └── server.ts          # Express entry point (port 3000)
│   └── package.json
├── frontend/                   # Angular 21 SPA
│   └── src/
│       ├── app/               # Root shell, routing (app.routes.ts)
│       ├── pages/             # Route components (home, designer, selection, results, admin)
│       ├── primitives/        # Reusable UI components
│       ├── services/          # Singleton data services
│       └── interceptors/      # HTTP interceptors (auth)
├── shared/src/                 # Shared DTOs and static data
│   ├── dto/                   # TypeScript interfaces
│   └── static/                # MeSH terminology JSON files
├── docker/                    # Nginx reverse proxy config
├── terraform/                 # AWS infrastructure (AppRunner, RDS, CloudFront)
└── docker-compose.yml         # Local dev stack (Postgres + backend + frontend + Nginx)
```

The backend has its own `tsconfig.json` under `backend/`. The frontend has its own under `frontend/`.

## Commands

### Backend (run from `clinicalTrials/backend/`)
```bash
npm install
DB_HOST=localhost npm run dev   # ts-node-dev with --respawn, serves on port 3000
```

### Frontend (run from `clinicalTrials/frontend/`)
```bash
npm install
npm start          # ng serve (dev server)
npm run build      # ng build
npm test           # vitest via ng test (runs all *.spec.ts)
```

To run a single frontend test file, use the Angular test runner and filter by filename — or invoke vitest directly if a vitest config is present.

## Architecture Notes

### Data flow
The frontend `ClinicalStudyService` loads MeSH terminology from `shared/src/static/` JSON files at startup and exposes fuzzy-search (Fuse.js, threshold 0.3, max 10 results) via two methods:
- `getMatchingConditions()` — used by the Designer's condition text input
- `getSuggestedKeywords()` — used by the `KeywordSelector` primitive

### Frontend conventions
- All components use `ChangeDetectionStrategy.OnPush` and Angular standalone components (no NgModules).
- State within components uses Angular signals. Form state uses `ReactiveFormsModule` (`FormGroup`/`FormControl`).
- `pages/` depend on `primitives/` and `services/`. `primitives/` are self-contained except `KeywordSelector`, which injects `ClinicalStudyService`. Services have no UI dependencies.

### Shared DTOs
Any type shared between frontend and backend belongs in `shared/src/dto/`. The `ClinicalTrialSearchRequest` interface maps directly to ClinicalTrials.gov API query/filter parameters (comments in the file indicate the corresponding API field names).

### Backend
The Express server (`backend/src/server.ts`) runs on port 3000. Current endpoints:
- `GET /api/health`
- `GET /api/debug/status` — detailed health check including DB connectivity
- `POST /api/auth/register` / `POST /api/auth/login` / `GET /api/auth/has-action/:action`
- `GET/POST /api/admin/*` — user/role management (requires `user_roles` permission)
- `POST /api/clinical-trials/search` — calls ClinicalTrials.gov API with validation
- `POST /api/clinical-trials/candidate-pool` — builds candidate pool
- `POST /api/clinical-trials/results` — placeholder (returns 501, not yet implemented)

### Page flow
The app follows a multi-step workflow managed by `TrialWorkflowService`:

```
Designer (step 1) → Selection (step 2) → Results (step 3)
```

- **Designer** (`pages/designer/`) — collects search parameters, navigates to Selection
- **Selection** (`pages/selection/`) — displays matched trials in a table with filter controls:
  - **Date range**: filters by `startDate` (from/to, both optional)
  - **Keywords**: must match ALL keywords against trial title + conditions (case-insensitive)
  - `filteredTrials = computed()` derives from the full `trials` signal — full collection is never mutated, so filters are instantly reversible
  - Counter shows "X of N Results" live
- **Results** (`pages/results/`) — displays three Chart.js histograms using mock data from `frontend/src/services/mock-trial-results.ts` via `ResultsApiService`. To wire real backend: swap `of(mockTrialResultsResponse)` → `this.http.post(API_URL, request)` in that service.
- **Admin** (`pages/admin/`) — lazy-loaded, visible only to users with `user_roles` permission

### Authentication
JWT-based auth. `AuthInterceptor` attaches Bearer tokens to all HTTP requests. `AuthService` manages login state with Angular signals. Login/register via `LoginModal` primitive in the app header.

### Chart export
Each chart primitive has built-in export buttons (top-right corner):

- **BarChart** (`primitives/bar-chart/`) — PNG via `chart.toBase64Image()`, CSV serialized from `chartData` input
- **ScatterChart** (`primitives/scatter-chart/`) — PNG via `chart.toBase64Image()`, CSV with columns `Dataset,X,Y`
- **Heatmap** (`primitives/heatmap/`) — PNG via `leaflet-image` library; button shows `Exporting…` while rasterizing; `leaflet-image` is allowlisted in `angular.json` under `allowedCommonJsDependencies`

### Scatter chart zoom
`ScatterChart` uses `chartjs-plugin-zoom` (+ `hammerjs` for touch) for interactive zooming:

| Interaction | Behavior |
|---|---|
| Scroll wheel | Zoom in/out centered on cursor |
| Pinch (touch) | Zoom in/out |
| Shift + drag | Box-select zoom into a region |
| Click + drag | Pan while zoomed |
| Reset button | Returns to full view (only shown when zoomed/panned) |

`hammerjs` is allowlisted in `angular.json` under `allowedCommonJsDependencies`. `isZoomed` signal drives the Reset button visibility.

### Debug mode
Add `?debug=true` to the URL to show a debug bar polling `/api/debug/status` every 10s.

## Local development (no Docker)

PostgreSQL 16 is installed via Homebrew. Start all three services before running the app:

```bash
brew services start postgresql@16
cd clinicalTrials/backend && DB_HOST=localhost npm run dev   # port 3000
cd clinicalTrials/frontend && npm start                      # port 4200
```

Start Postgres **before** the backend — the backend connects at startup and won't retry if Postgres isn't ready.

To stop everything:
```bash
brew services stop postgresql@16
kill $(lsof -ti:3000)
kill $(lsof -ti:4200)
```

DB credentials (local): host `localhost`, db/user/password all `clinicaltrials`.

## Repository
**GitHub:** https://github.com/KyleVogelerSource/clinicalTrials
**Active branch:** `FE-Scatter-Plot-Zoom`
