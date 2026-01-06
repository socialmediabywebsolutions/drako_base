# Production Audit — Drako Base

Date: 2026-01-06

## Scope
- Cloudflare OpenNext build, D1 runtime access, routing for public/private domains, /api context, and provisioning mode.

## Findings (previous)
- P0: OpenNext build failed (`app/admin/page cannot use the edge runtime`).
- P0: Cloudflare provisioning stuck in dry-run.
- P1: Middleware skipped `/api`, so tenant/saas context was missing in APIs.

## Changes applied
- Removed `export const runtime = "edge";` from app pages and API route handlers to satisfy OpenNext build constraints.
- Middleware now processes `/api` requests to inject `x-drako-*` headers and correlation id; incoming spoofed headers are overwritten.
- Public/private routing:
  - `drako.systems` and `*.pages.dev` treated as public.
  - Campamento Base only on `base.drako.systems` / `admin.drako.systems`.
  - `/admin` no longer exposed on `.pages.dev`.
- Cloudflare provisioning now supports live mode with `CLOUDFLARE_PROVISIONING_MODE=live` and uses Cloudflare API in an idempotent way.

## Build evidence
- `npm ci` ✅
- `npm run build:cloudflare` ✅
  - OpenNext build complete, worker generated at `.open-next/worker.js`.

## Provisioning status
- Live provisioning implemented, but **not executed** (requires tokens).
- Required env for live mode:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `APP_URL`
  - Optional: `CLOUDFLARE_ZONE_ID` (auto-resolved when absent)
  - `CLOUDFLARE_PROVISIONING_MODE=live`

## Routing status
- `/api` now receives tenant/saas headers from middleware without redirects.
- Public/private domain behavior enforced in middleware.

## Runtime verification (pending)
Production check (current deployment):
- `GET https://drako-base-3.pages.dev/api/health` -> 503
  - reason: `database_unavailable`
  - hint: `No request context found. DRACO_DB must be accessed inside a Pages/Edge request handler.`
  - build stamp: commit `6356d0ac015d8b62a58cd65bb1262a1bf7e90b96`
- `GET https://drako-base-3.pages.dev/api/debug/bindings` -> 401 (debug token required)

This indicates production is still serving an older deployment and/or Pages runtime is not providing request context to OpenNext.

## Veredicto
- **NO-GO** until the latest commits deploy and `/api/health` shows `db.status=ok` with `hasDracoDb=true` in `/api/debug/bindings`.

## Next actions
1) Deploy latest commits to production.
2) Validate:
   - `/api/health` (build stamp, db ok)
   - `/api/debug/bindings` (hasDracoDb true, dbPing ok)
   - `drako.systems` public UI
   - `base.drako.systems/admin` private admin
