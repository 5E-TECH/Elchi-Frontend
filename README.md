# Elchi Frontend

Admin & logistics web client for the Elchi delivery platform.
React 19 + TypeScript + Vite, organized with **Feature-Sliced Design**
(`app → pages → widgets → features → entities → shared`).

**Stack:** React 19 · Vite · Redux Toolkit (client state) · TanStack React Query
(server state) · Ant Design v6 · react-hook-form + yup · react-i18next (uz/ru/en)
· react-router-dom v7.

Backend: NestJS microservices (see `../Elchi-Backend`). The API contract lives in
`../Elchi-Backend/docs/frontend/openapi.json`; run `npm run audit:frontend` there
to check endpoint coverage. An audit of this codebase is in
[`docs/FRONTEND_AUDIT.md`](docs/FRONTEND_AUDIT.md).

**Design system v2** (tokens, colours, typography, money format, rules for every PR):
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) · short mandatory rules: [`AGENTS.md`](AGENTS.md).

## Getting started

```bash
npm install
npm run dev        # start Vite dev server
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) + `vite build --mode production` |
| `npm run build:staging` | Type-check + `vite build --mode staging` (TEST site, see below) |
| `npm run check:target -- <production\|staging> [dir]` | Verifies `dist` was built for that environment (CI runs it before every deploy) |
| `npm run preview` | Build then serve via `wrangler dev` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run deploy` | Build + `wrangler deploy` (see below) |

## Environment

All `VITE_*` variables are embedded into the client bundle and are therefore
**public — never put secrets in them.**

| File | Purpose | Tracked? |
|---|---|---|
| `.env.production` | Production API URL (`VITE_BASE_URL`) used by `npm run build` | ✅ committed (public URL only) |
| `.env.staging` | TEST API URL + `VITE_APP_ENV=staging`, used by `npm run build:staging` | ✅ committed (public URL only) |
| `.env` | Local dev override (e.g. an internal API IP) | ❌ git-ignored |
| `.env.development` | Shared dev defaults | ✅ committed |
| `.env.example` | Template | ✅ committed |

`src/shared/const/index.ts` also falls back to the production API when the built
URL is missing or would be blocked as mixed content.

## Deployment

**Automatic.** Every push to `main` runs `.github/workflows/deploy.yml`: lint →
tests → build → `wrangler deploy`. A pull request runs the same checks but stops
before deploying. Until this workflow was added (Sep 2026) every release was a
manual `npm run deploy` from someone's laptop, so `main` regularly sat weeks
ahead of production.

Two repository secrets drive it — `CLOUDFLARE_API_TOKEN` (Cloudflare → My
Profile → API Tokens → **Edit Cloudflare Workers** template) and
`CLOUDFLARE_ACCOUNT_ID` (`npx wrangler whoami`). The build itself needs no
secrets: `.env.production` is committed and holds only public `VITE_*` values.

**Target: Cloudflare Workers**, Worker name `elchi-frontend`, config in
`wrangler.jsonc`. `not_found_handling: single-page-application` makes deep links
work with react-router. `npm run deploy` still works for a manual release.

This project is **not** on Cloudflare Pages, Netlify or Vercel. A stale
`wrangler.toml` (Pages, project `elchi-pochta`), `netlify.toml` and `vercel.json`
used to sit alongside the real config and were removed — wrangler prefers
`wrangler.jsonc`, so the extra files only misled readers about where the site
actually runs.

### Staging (TEST site)

Flow: `dev` → merge into `test` → https://test-admin.elchipochta.uz (API https://test-api.elchipochta.uz);
`test` → merge into `main` → production, exactly as before.

- A push to `test` runs the same quality gate, then `npm run build:staging` and
  `npx wrangler deploy --env staging` — a **separate** Worker `elchi-frontend-test` with the custom domain
  `test-admin.elchipochta.uz` (`wrangler.jsonc` → `env.staging`). The deploy step runs only when the repository
  variable `STAGING_ENABLED` is `true` (Settings → Secrets and variables → Actions → Variables); until the test
  backend exists the variable stays unset and `test` pushes only build and check.
- The staging build is visibly different and cannot be mistaken for production: a «TEST muhit» marker on every
  page (`src/widgets/staging-banner`, staging-only chunk), `[TEST]` title prefix, `noindex` (meta, `X-Robots-Tag`,
  `robots.txt`), PWA name «Elchi TEST», `[TEST]` push notification titles, and CSP hosts pointing at the test API
  (`scripts/staging-build.mjs`). The production `dist` is unchanged — none of this code reaches it.
- Before every deploy CI runs `npm run check:target`, so a staging `dist` can never be deployed to production
  (or the other way round). A production-mode build on the `test` branch inside Cloudflare Workers Builds fails on
  purpose (`WORKERS_CI_BRANCH`).

Owner checklist before enabling (`STAGING_ENABLED=true`):

1. Cloudflare → Workers & Pages → `elchi-frontend` → Settings → Build: if a Git repository is connected
   (Workers Builds), it deploys `main` on its own, outside this workflow and its quality gate. Either disconnect it
   (GitHub Actions is the single deploy path) or at least turn off builds for non-production branches, so `test`/`dev`
   pushes never upload versions to the production Worker.
2. The `CLOUDFLARE_API_TOKEN` must also be allowed to create the custom domain: zone `elchipochta.uz` →
   Workers Routes: Edit, Zone: Read, DNS: Edit (or add the domain once by hand: `elchi-frontend-test` → Settings →
   Domains & Routes). No DNS record may already exist for `test-admin.elchipochta.uz`.
3. The test backend must accept the origin `https://test-admin.elchipochta.uz` (CORS, socket.io) and serve
   `POST /csp-report`.
4. Create the `test` branch from `dev`, then set `STAGING_ENABLED` to `true`.
