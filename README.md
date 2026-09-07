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
