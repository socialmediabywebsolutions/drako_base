# Production Checklist (Cloudflare)

## Build
- Install deps:
  - `npm ci`
- Build OpenNext:
  - `npm run build:cloudflare`

## Deploy (OpenNext)
- `npm run deploy:cloudflare`

## Required bindings / env (Pages/Workers)
- D1 binding: `DRACO_DB` -> `drako_db_prod`
- Env:
  - `SESSION_SECRET`
  - `APP_URL`
  - `DEBUG_TOKEN` (required for `/api/debug/bindings` in prod)
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (and optional `CLOUDFLARE_ZONE_ID`)
  - `CLOUDFLARE_PROVISIONING_MODE=live` to enable real provisioning

## Runtime checks
- `GET /api/health` (expect `ok:true`, `build.pages.*` present, `db.status=ok`)
- `GET /api/debug/bindings` (with `x-debug-token`) expect `hasDracoDb:true` and `dbPing.ok:true`
- `GET /api/saas`
- `GET /api/agents`
- `GET /admin` on `base.drako.systems`
- `GET /` on `drako.systems`

## Domain routing checks
- `https://drako.systems/` -> public SaaS
- `https://base.drako.systems/admin` -> Campamento Base
- `https://drako-base-3.pages.dev/admin` -> should NOT expose Campamento Base (redirects/neutral)
