# Production Audit — Drako Base

Date: 2026-01-06

## Scope
- Cloudflare Pages (OpenNext) build, D1 runtime access, routing for public/private domains, /api context, and provisioning mode.

## Findings (previous)
- P0: Pages build failed because routes were not configured to run on Edge (next-on-pages).
- P0: Cloudflare provisioning stuck in dry-run.
- P1: Middleware skipped `/api`, so tenant/saas context was missing in APIs.

## Changes applied
- Switched Cloudflare Pages build to OpenNext output packaged for Pages (`.pages-output` with `_worker.js`).
- Middleware now processes `/api` requests to inject `x-drako-*` headers and correlation id; incoming spoofed headers are overwritten.
- Public/private routing:
  - `drako.systems` and `*.pages.dev` treated as public.
  - Campamento Base only on `base.drako.systems` / `admin.drako.systems`.
  - `/admin` not exposed on `.pages.dev`.
- Cloudflare provisioning now supports live mode with `CLOUDFLARE_PROVISIONING_MODE=live` and uses Cloudflare API in an idempotent way.

## Build evidence (Pages / OpenNext)
- `npm run pages:build` ✅
  - `.pages-output/_worker.js` generated for Pages deployment.

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
- Requires deployment to production and a valid `DEBUG_TOKEN` to confirm:
  - `GET /api/health`
  - `GET /api/debug/bindings` (with token)

## Veredicto
- **NO-GO** until production deploy and runtime checks succeed.

## Next actions
1) Deploy latest commits to production.
2) Validate:
   - `/api/health` (build stamp, db ok)
   - `/api/debug/bindings` (hasDracoDb true, dbPing ok)
   - `drako.systems` public UI
   - `base.drako.systems/admin` private admin
