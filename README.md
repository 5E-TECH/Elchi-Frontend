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

**Primary target: Cloudflare Workers** (`npm run deploy`, config in
`wrangler.jsonc`). `not_found_handling: single-page-application` makes deep links
work with react-router.

`netlify.toml` and `vercel.json` are **SPA-rewrite fallbacks** kept only so the
app still routes correctly if it is also built on Netlify or Vercel. They are not
the primary pipeline — the `deploy` script targets Cloudflare. Remove them if
those platforms are not used.
