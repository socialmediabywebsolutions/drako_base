# D1 Runbook (Drako Base)

## Apply migrations to remote D1
1. Login Cloudflare (if needed):
   ```
   npx wrangler login
   ```
2. Apply migrations to production database:
   ```
   npx wrangler d1 migrations apply drako_db_prod --remote
   ```
3. For preview (if configured with preview_database_id):
   ```
   npx wrangler d1 migrations apply drako_db --remote --env preview
   ```

## Verify migrations applied
```
npx wrangler d1 execute drako_db_prod --remote --command "SELECT name FROM d1_migrations ORDER BY name"
```
For preview:
```
npx wrangler d1 execute drako_db --remote --command "SELECT name FROM d1_migrations ORDER BY name"
```

## Seed minimal data (idempotent)
Ensure demo/public records exist:
```
npx wrangler d1 execute drako_db_prod --remote --command "INSERT OR IGNORE INTO saas (id, name, slug, status) VALUES ('saas_drako_systems','Drako.Systems','drako-systems','active');"
npx wrangler d1 execute drako_db_prod --remote --command "INSERT OR IGNORE INTO saas_domains (domain, saas_id, status) VALUES ('drako.systems','saas_drako_systems','ACTIVE');"
```
Repeat for preview with `drako_db` if needed.

## Health/Diagnostics endpoints
- `/api/health`: returns db status and missingTables snapshot.
- `/api/diag`: admin-only diagnostic (tables presence, seed hints).

## Checklist to unblock /admin
- Migrations applied (no missing tables in `/api/diag`).
- Seeds present for `saas` and `saas_domains`.
- D1 binding `DRACO_DB` points to the correct DB (prod: drako_db_prod; preview: drako_db).
- `/api/health` and `/api/diag` return 200 with `ok:true`.
