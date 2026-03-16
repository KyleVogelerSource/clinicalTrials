# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Requirements

Node.js >= 18 is required. The backend uses Express 5 and TypeScript 5.9, which are incompatible with older Node versions. Use `nvm install 20 && nvm use 20` if needed.

## Project Layout

This is a monorepo with three sub-projects under `clinicalTrials/`:

```
clinicalTrials/
├── src/server.ts        # Express entry point (run from repo root)
├── backend/src/         # Backend services and models
├── shared/src/          # DTOs and static JSON data shared by both sides
│   ├── dto/             # TypeScript interfaces (e.g. ClinicalTrialSearchRequest)
│   └── static/          # MeSH terminology JSON files loaded at runtime
└── frontend/            # Angular 21 SPA
    └── src/
        ├── app/         # Root shell, routing (app.routes.ts)
        ├── pages/       # One component per route (home, designer)
        ├── primitives/  # Reusable UI components (keyword-selector, progress-track, logo)
        └── services/    # Singleton data services (ClinicalStudyService)
```

The root `tsconfig.json` covers `src/`, `backend/src/`, and `shared/src/`. The frontend has its own `tsconfig.json`.

## Commands

### Backend (run from `clinicalTrials/`)
```bash
npm install
npm run dev        # ts-node-dev with --respawn, serves on port 3000
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
The Express server (`src/server.ts`) is minimal scaffolding. Current endpoints: `GET /api/health` and `GET /api/clinical-trials/empty-response`. Business logic lives in `backend/src/services/`.

### Planned pages
The `ProgressTrack` primitive defines three steps: Input → Refine → Results. Only step 1 (Designer) is implemented. The Designer's `onNext()` currently logs to console and needs to be wired to navigate forward.
