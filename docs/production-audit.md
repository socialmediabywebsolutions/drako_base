# Production Audit — Drako Base (Workers + OpenNext)

Date: 2026-01-29

## Scope
- Cloudflare Workers build (OpenNext), host routing split, and D1 binding validation.

## Architecture decision
- Migrated from Pages to Workers for better binding control and simpler deployment flow.
- Uses OpenNext with Cloudflare adapter.

## Required Cloudflare Workers settings
- Entry: `.open-next/worker.js` (managed by `wrangler.toml`)
- Bindings: Managed via `wrangler.toml` (Strict D1 IDs)

## Evidence (local)
- `npm run build:worker` ✅
  - `.open-next/worker.js` generated

## Pending verification (Cloudflare)
- `GET /api/health` returns `ok: true`.
- `GET /api/debug/bindings` returns `adapter: "OpenNext"`.

## Binding clarification
- Binding name (code): `DRACO_DB`
- Production ID: `5607a76a-97c7-45a9-a948-e545ba27eae7`
- Preview ID: `10146888-ca79-41d6-b6c2-bf1025eb651b`
