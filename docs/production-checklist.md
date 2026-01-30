# Production Checklist (Cloudflare Workers / OpenNext)

## Build
- Install deps:
  - `npm ci`
- Worker build (OpenNext):
  - `npm run build:worker`

## Deploy (Workers)
- Use wrangler for deployment (build output in `.open-next/`).
  - `npm run deploy`

## Required bindings / env (Workers)
- D1 binding: `DRACO_DB` -> `drako_db_prod` (Production) or `drako_db` (Preview)
- Env:
  - `SESSION_SECRET`
  - `APP_URL`
  - `DEBUG_TOKEN` (required for `/api/debug/bindings` in prod)
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Runtime checks
- `GET /api/health` 
  - Expect `ok:true`, `dbPing.ok:true`.
- `GET /api/debug/bindings` (with `x-debug-token`)
  - Expect `adapter:"OpenNext"`, `hasDracoDb:true`, `dbPing.ok:true`.
- `GET /api/saas`
- `GET /api/agents`

## Domain routing checks
- `https://drako.systems/` -> public SaaS
- `https://base.drako.systems/admin` -> Campamento Base
- `https://[worker-name].[user].workers.dev/admin` -> should NOT expose Campamento Base (diagnostics only)
