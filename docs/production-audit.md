# Production Audit — Drako Base (OpenNext)

Date: 2026-01-06

## Scope
- Cloudflare Pages build (OpenNext), host routing split, and public UI legibility.

## Architecture decision
- Single adapter: OpenNext for Pages.
- No `@cloudflare/next-on-pages` in build pipeline.

## Required Cloudflare Pages settings
- Build command: `npm run pages:build`
- Output directory: `.pages-output`
- Expected log: no `@cloudflare/next-on-pages` usage

## Host routing expectations
- `drako.systems` -> PUBLIC_SAAS (public shell)
- `base.drako.systems` / `admin.drako.systems` -> CAMPAMENTO_BASE (internal shell)
- `*.pages.dev` -> PREVIEW (diagnostics only, no admin)

## Evidence (local)
- `npm run pages:build` ✅
  - `.pages-output/_worker.js` generated

## Pending verification (Cloudflare)
- Build logs show `npm run pages:build` and no `@cloudflare/next-on-pages`.
- `https://drako.systems` renders public shell.
- `https://base.drako.systems/admin` renders Campamento Base.
- `https://drako-base-3.pages.dev/admin` rewrites to `/preview`.
- `GET /api/health` returns build stamp for latest commit.
