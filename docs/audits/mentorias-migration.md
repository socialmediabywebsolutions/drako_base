# Mentorias Migration Audit

Date: 2026-02-25
Scope: Migrate Mentoria from legacy `drako-base-3` to `saas-mentorias-prod` with Workers-only routing and auth isolation.

## 1) Host Overrides (Local Validation Risk)

Checked override files:

- Linux/WSL: `/etc/hosts`
- Windows: `C:\Windows\System32\drivers\etc\hosts`

Result:

- No entries found for `mentoria.drako.systems`
- No entries found for `mentorias.drako.systems`

If you ever see local overrides, temporarily comment lines like:

```txt
127.0.0.1 mentoria.drako.systems
127.0.0.1 mentorias.drako.systems
```

and re-run production checks.

## 2) Source of Truth: Domains and Routes

Cloudflare zone-level workers routes containing `mentoria`: none (custom domains are used for this worker).

Cloudflare custom domains:

- `mentoria.drako.systems -> saas-mentorias-prod`
- `mentorias.drako.systems -> saas-mentorias-prod` (compatibility alias)

Legacy worker ownership check:

- `drako-base-3` has no Mentoria custom domains.

## 3) Deployments

`wrangler deployments list --config workers/mentorias/wrangler.workers.toml`

Latest active deployment:

- Version: `a85e5e38-e61f-4e4c-b13b-5db395ec3598`
- Created: `2026-02-25T21:17:18.110Z`
- Worker: `saas-mentorias-prod`

## 4) Runtime Health Evidence

Command:

```bash
curl -i https://mentoria.drako.systems/api/health
```

Key payload fields:

```json
{
  "ok": true,
  "resolution": {
    "status": "ACTIVE",
    "tenantId": "demo-tenant",
    "saasId": "saas-mentoria-core",
    "saasSlug": "mentoria",
    "reason": "CUSTOM_DOMAIN_MATCH"
  },
  "host": {
    "effective": "mentoria.drako.systems"
  }
}
```

## 5) Host Fencing Evidence

Command:

```bash
curl -i https://mentoria.drako.systems/api/health -H "Host: invalid.drako.systems"
```

Result:

- `HTTP/2 530` (Cloudflare fail-closed on invalid host/header mismatch).

## 6) Home Route Evidence

Command:

```bash
curl -i https://mentoria.drako.systems/
```

Result:

- `HTTP/2 200`
- Mentoria landing rendered from the real OpenNext app (not the placeholder skeleton).

## 7) Auth Evidence

Issue detected and fixed:

- Initial error: `D1_ERROR: no such table: mentorias_users`
- Action: applied migration `migrations/0136_auths_isolations.sql` to `drako_db_prod`.
- Action: set worker secret `MENTORIAS_AUTHS_SECRET` for `saas-mentorias-prod`.

Validation:

- `POST /api/mentorias/auths/registrations` -> `201`
- `POST /api/mentorias/auths/logins` -> `200`
- Session cookie returned: `__Host-mentorias_session=...`

## 8) Data/Domain Mapping for Mentoria Context

Updated remote DB records:

- `saas_instances.id = saas-mentoria-core`
  - `custom_domain = mentoria.drako.systems`
  - `domain_status = active`
- Added alias in `saas_domains`:
  - `mentorias.drako.systems` -> `saas-mentoria-core` (active, verified)

## 9) Minimal Files Changed

- `workers/mentorias/wrangler.workers.toml`
- `src/middleware.ts`
- `src/lib/auths/contexts.ts`
- `scripts/check-workers-multi-saas.sh`
- `scripts/check-workers-multi-saas.ps1`
