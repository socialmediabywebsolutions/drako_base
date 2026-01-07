# Fix missing DRACO_DB binding (Cloudflare Pages)

This runbook fixes the "binding-missing" / "Falta el enlace DRACO_DB" error reported by `/api/health` or `/api/diag`.

## Symptoms
- `/api/health` returns `ok:false` and `db.status: "missing_binding"`.
- `/api/diag` returns `db.status: "unavailable"` with `bindingName: "DRACO_DB"`.
- Cloudflare build log shows: `wrangler.toml ... missing pages_build_output_dir ... Skipping file`.

## Pages dashboard steps (recommended)
1) Open **Cloudflare Dashboard** → **Pages** → **drako-base-3**.
2) Go to **Settings** → **Functions** → **D1 bindings**.
3) Add binding:
   - Binding name: `DRACO_DB`
   - Production database: `drako_db_prod`
   - Preview database: `drako_db`
4) Save changes and trigger a new deploy.

## CLI alternative
1) Ensure `wrangler.toml` is valid and includes:
   - `pages_build_output_dir = ".vercel/output/static"`
   - `[env.production]` and `[env.preview]` with `DRACO_DB` pointing to the correct production/preview DB IDs.
2) Deploy:
   ```bash
   npm run pages:build
   npx wrangler pages deploy .vercel/output/static --project-name drako-base-3
   ```

## Checklist
- `/api/health` returns `200` with `db.status: "ok"`.
- `/api/diag` returns `200` with non-empty core catalog counts.
- `/api/core-departments` returns the core department list.
- `/api/core-agents` returns the core agents list.
- `/admin` loads without a server-side exception.
