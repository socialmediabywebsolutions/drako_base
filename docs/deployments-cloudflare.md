# Cloudflare Workers (OpenNext) Deployment

## Build
- Generate OpenNext output:
  ```
  npm run build:cloudflare
  ```
  Output in `.open-next/` (ignored in git).

## Preview (Workers runtime)
- Run:
  ```
  npm run preview:cloudflare
  ```
  Base URL: `http://localhost:8787`.
- Smoke tests:
  ```
  BASE_URL=http://localhost:8787 npm run smoke:cloudflare
  ```

## Deploy
- Run:
  ```
  npm run deploy:cloudflare
  ```

## Wrangler config (wrangler.toml)
- `main = ".open-next/worker.js"`
- `assets`:
  - directory: `.open-next/assets`
  - binding: `ASSETS`
- compatibility_flags: `["nodejs_compat"]`
- D1:
  - binding: `DRACO_DB`
  - database_name: `drako_db`
  - database_id: `10146888-ca79-41d6-b6c2-bf1025eb651b`

## Bindings / Env
- D1 binding `DRACO_DB` required.
- Add other vars/secrets in Wrangler/Workers as needed (same names used in code).

## Checklist post-deploy
- `/admin` loads (200).
- `/api/health` 200.
- `/api/agents` 200.
- `/api/saas` 200.
- AI Gateway endpoint `/api/ai/chat` (fast/smart) responds 200 with content.
