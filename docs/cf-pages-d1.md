# Cloudflare Pages + D1 Runbook

## Bind DRACO_DB in Cloudflare Pages
- Go to the Cloudflare Pages project → Settings → Functions → D1 Database Bindings.
- Create a binding named `DRACO_DB` and select the D1 database `drako_db` (id: `10146888-ca79-41d6-b6c2-bf1025eb651b`).
- Save and redeploy so the binding is available to Pages Functions.

## Apply D1 migrations remotely
- Make sure you are authenticated (`wrangler login`) and using the repo root as cwd.
- Run pending migrations against the production D1 database:  
  `wrangler d1 migrations apply drako_db --remote`
- To inspect migrations: `wrangler d1 migrations list drako_db --remote`

## Local preview with persisted D1 state
- Build the Pages output: `npm run cf:build`
- Start a local Pages preview with a persisted D1 instance (keeps state under `.wrangler/state`):  
  `npm run cf:preview -- --port 8788 --persist-to .wrangler/state`
- The preview already binds `DRACO_DB` for you via `wrangler pages dev`.

## Validate the deployment
- Health check: `curl -i http://localhost:8788/api/health`
- Agents API (returns 503 with diagnostics if D1/bindings/tables are missing):  
  `curl -i http://localhost:8788/api/agents`
- Once migrations are applied and DRACO_DB is bound, both endpoints should return 200 JSON payloads instead of 503 diagnostics.
