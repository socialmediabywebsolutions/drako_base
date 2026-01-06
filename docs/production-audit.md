# Production Audit — Drako Base (next-on-pages)

Date: 2026-01-06

## Scope
- Cloudflare Pages build (next-on-pages), host routing split, and public UI legibility.

## Architecture decision
- Pages build uses `@cloudflare/next-on-pages@1`.
- Dynamic routes must export `runtime = \"edge\"`.

## Required Cloudflare Pages settings
- Build command: `npx @cloudflare/next-on-pages@1`
- Output directory: `.vercel/output/static`

## Host routing expectations
- `drako.systems` -> PUBLIC_SAAS (public shell)
- `base.drako.systems` / `admin.drako.systems` -> CAMPAMENTO_BASE (internal shell)
- `*.pages.dev` -> PREVIEW (diagnostics only, no admin)

## Evidence (local)
- `npx @cloudflare/next-on-pages@1` ✅
  - `.vercel/output/static/_worker.js` generated

## Pending verification (Cloudflare)
- Build logs show `npx @cloudflare/next-on-pages@1`.
- `https://drako.systems` renders public shell.
- `https://base.drako.systems/admin` renders Campamento Base.
- `https://drako-base-3.pages.dev/admin` rewrites to `/preview`.
- `GET /api/health` returns build stamp for latest commit.

## Binding clarification
- Binding name (code): `DRACO_DB`
- D1 database name (Cloudflare): `drako_db_prod`
