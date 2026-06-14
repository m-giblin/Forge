# Testing

Two layers, by design.

## 1. Unit tests (fast, no external services) — `npm run test`

Pure logic, runs anywhere including CI with no secrets:

- `src/lib/api/keys.test.ts` — key hashing, scope checks, bearer parsing
- `src/lib/api/schemas.test.ts` — API request validation
- `src/lib/providers/rate-limiter.test.ts` — rate-limiter behavior

The full local gate is **`npm run check`** (`tsc --noEmit` + lint + unit tests). Run it before every commit.

## 2. Security gates (need a real Supabase DB) — the isolation proof

These create & delete throwaway data, so point them at a **dedicated test project**, never production.

- **`npm run test:isolation`** — proves a signed-in user of tenant A cannot read/write tenant B's data (RLS, human path).
- **`npm run test:api`** — proves the integration API enforces auth, scopes, validation, **tenant isolation**, and revocation (machine path). Requires the dev server running.
- **`npm run test:smoke`** — signs in as the dev founder and runs the board/list pages' read set through RLS (the human path). Catches the class of bug that broke `loadBoard` (missing table / RLS regression) which the other gates don't exercise. Needs `seed:dev` + `seed:forge` data.

Both read credentials from `.env.local` locally.

## CI

`.github/workflows/ci.yml`:

- **`unit`** job runs on every push/PR — types, lint, unit tests.
- **`integration`** job runs the two security gates against a real DB. It is **off by default**. To enable: create a dedicated test Supabase project, add `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` secrets, and set repository variable `RUN_INTEGRATION=true`.

Until the integration job is enabled in CI, **run `npm run test:isolation` and `npm run test:api` locally before merging anything that touches data access, RLS, or the API.**
