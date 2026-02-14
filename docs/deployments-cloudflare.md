# Cloudflare Pages (next-on-pages) Deployment

## Build
- Generate Pages output:
  ```
  npm run pages:build
  ```
  Output in `.open-next/assets` (consumed by Pages).

## Deploy
- Run:
  ```
  npx wrangler pages deploy .open-next/assets --project-name drako-base-3
  ```

## Wrangler config (wrangler.toml)
- `pages_build_output_dir = ".open-next/assets"`
- `compatibility_flags = ["nodejs_compat"]`
- D1 bindings are configured per environment:
  - Production: `DRACO_DB` → `drako_db_prod`
  - Preview: `DRACO_DB` → `drako_db`

## Bindings / Env
- D1 binding `DRACO_DB` required.
- Add other vars/secrets in Pages → Settings → Variables.

## Checklist post-deploy
- `/admin` loads (200).
- `/api/health` 200.
- `/api/agents` 200.
- `/api/saas` 200.
- AI Gateway endpoint `/api/ai/chat` (fast/smart) responds 200 with content.

