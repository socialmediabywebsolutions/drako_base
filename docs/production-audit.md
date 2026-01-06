# Production Audit — Drako Base (OpenNext)

Date: 2026-01-06

## Scope
- Cloudflare Pages build (OpenNext), host routing split, and public UI legibility.

## Architecture decision
- Pages build uses OpenNext only.

## Required Cloudflare Pages settings
- Build command: `npm run pages:build`
- Output directory: `.vercel/output/static`

## Host routing expectations
- `drako.systems` -> PUBLIC_SAAS (public shell)
- `base.drako.systems` / `admin.drako.systems` -> CAMPAMENTO_BASE (internal shell)
- `*.pages.dev` -> PREVIEW (diagnostics only, no admin)

## Evidence (local)
- `npm run pages:build` ✅
  - `.vercel/output/static/_worker.js` generated

## Pending verification (Cloudflare)
- Build logs show `npm run pages:build`.
- `https://drako.systems` renders public shell.
- `https://base.drako.systems/admin` renders Campamento Base.
- `https://drako-base-3.pages.dev/admin` rewrites to `/preview`.
- `GET /api/health` returns build stamp for latest commit.

## Binding clarification
- Binding name (code): `DRACO_DB`
- D1 database name (Cloudflare): `drako_db_prod`

## Output clarification
- The `.vercel/output/static` directory includes `_worker.js`, so it is not static-only.
