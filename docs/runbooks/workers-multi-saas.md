# Workers Multi-SaaS Runbook (Workers-only)

## Scope
This runbook defines a Cloudflare Workers-first architecture with one Worker per SaaS for a holding model.

- Runtime policy: Workers-only.
- Pages policy: fail closed when `CF_PAGES_*` variables are present.
- Isolation policy: host fencing + auth isolation per SaaS worker.

## Initial SaaS Catalogs (8)

| SaaS slug | Worker name | Domain | Auth secret | Optional secrets | Bindings |
|---|---|---|---|---|---|
| drakos | saas-drakos-prod | drakos.drako.systems | DRAKOS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| mentorias | saas-mentorias-prod | mentorias.drako.systems | MENTORIAS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| bases | saas-bases-prod | bases.drako.systems | BASES_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| socialflows | saas-socialflows-prod | socialflows.drako.systems | SOCIALFLOWS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| cryptos | saas-cryptos-prod | cryptos.drako.systems | CRYPTOS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| invoices | saas-invoices-prod | invoices.drako.systems | INVOICES_AUTHS_SECRET | STRIPE_WEBHOOK_SECRET, GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| analytics | saas-analytics-prod | analytics.drako.systems | ANALYTICS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| automations | saas-automations-prod | automations.drako.systems | AUTOMATIONS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |

## Directory Layouts

- `apps/<saas-slug>/` for SaaS-specific routings and dashboards templates.
- `workers/<saas-slug>/wrangler.workers.toml` for worker-specific deploy settings.
- `packages/shared/` for host fencing, auth isolation, and workers handlers.
- `docs/runbooks/` for deployment and operations guides.

## Create a New SaaS Worker

1. Copy one worker folder:
   - `cp -R workers/drakos workers/<new-slug>`
2. Update `workers/<new-slug>/src/workers.ts`:
   - `saasSlug`, `workerName`, `domainName`, `authsSecretName`.
3. Update `workers/<new-slug>/wrangler.workers.toml`:
   - worker `name`, `routes`, and bindings IDs.
4. Add app metadata:
   - `apps/<new-slug>/routings.json`
   - `apps/<new-slug>/dashboards/clients.html`
   - `apps/<new-slug>/dashboards/admins.html`

## Add Custom Domains

For each worker:

1. Open Cloudflare Dashboard -> Workers & Pages -> target Worker.
2. Go to `Settings` -> `Domains & Routes`.
3. Add custom domain `<slug>.drako.systems`.
4. Confirm there is no Pages project using the same domain.

## DNS Configurations

1. In Cloudflare DNS zone `drako.systems`, verify worker custom domain records exist.
2. Remove any stale records pointing to legacy runtimes.
3. Confirm no record points to Pages endpoints.

## Secrets Configurations

Per worker directory:

```bash
cd workers/<slug>
wrangler secret put <SLUG>_AUTHS_SECRET
wrangler secret put GIT_SHA
```

For invoices worker:

```bash
cd workers/invoices
wrangler secret put INVOICES_AUTHS_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put GIT_SHA
```

## Deploy Commands

Run per SaaS:

```bash
cd workers/drakos && wrangler deploy --config wrangler.workers.toml
cd workers/mentorias && wrangler deploy --config wrangler.workers.toml
cd workers/bases && wrangler deploy --config wrangler.workers.toml
cd workers/socialflows && wrangler deploy --config wrangler.workers.toml
cd workers/cryptos && wrangler deploy --config wrangler.workers.toml
cd workers/invoices && wrangler deploy --config wrangler.workers.toml
cd workers/analytics && wrangler deploy --config wrangler.workers.toml
cd workers/automations && wrangler deploy --config wrangler.workers.toml
```

## Healths Verifications

Each worker exposes `/api/health` with `host`, `resolvedContext`, `workerName`, and `gitSha`.

```bash
curl -sS https://drakos.drako.systems/api/health | jq .
curl -sS https://mentorias.drako.systems/api/health | jq .
curl -sS https://bases.drako.systems/api/health | jq .
bash scripts/check-workers-multi-saas.sh
```

Expected fields:

- `workersOnly: true`
- `resolvedContext` matches SaaS slug
- `workerName` matches deployed worker

## Host Fencings Guarantees

- Each worker accepts only its own domain (plus explicit migration aliases).
- Foreign hosts return `403 HOSTS_FENCINGS_REJECTED`.

Validation example:

```bash
curl -i https://drakos.drako.systems/api/health -H 'Host: mentorias.drako.systems'
```

## Auth Isolation Guarantees

- Cookie name: `__Host-<slug>_session`.
- Token checks: `aud`, `iss`, `context`, and `exp`.
- Foreign SaaS cookies are rejected with `401 FOREIGN_COOKIE_REJECTED`.

Validation examples:

```bash
# Login and set cookie
curl -i -X POST https://drakos.drako.systems/api/auths/logins \
  -H 'content-type: application/json' \
  --data '{"email":"owner@drakos.io","tenantId":"tenant-drakos","role":"admins"}'

# Read current session
curl -i https://drakos.drako.systems/api/auths/sessions --cookie '__Host-drakos_session=<TOKEN>'

# Foreign cookie should fail
curl -i https://drakos.drako.systems/api/auths/sessions --cookie '__Host-mentorias_session=<TOKEN>'
```

## Migration Checklist (Monolith to Multi-Worker, no downtime)

1. Deploy all new workers before switching traffic.
2. Attach secondary domains first (`<slug>.drako.systems`) and run health checks.
3. Keep old monolith worker serving legacy domains temporarily.
4. Add `308` redirects from legacy hostnames to new SaaS domains.
5. Validate auths cookies on each domain:
   - login on source domain;
   - verify no session on other domain.
6. Switch primary DNS traffic per domain in this order:
   - low-risk SaaS first (analytics, socialflows)
   - then mentorias, invoices, cryptos, automations
   - finally drakos and bases.
7. Observe each worker with:

```bash
cd workers/<slug>
wrangler tail --format pretty
```

8. Disable legacy auth endpoints in monolith after stable cutover window.

## Recommended Data Strategy

- Preferred: one D1 database per SaaS worker.
- Transitional: shared D1 with strict `saas_slug` + `tenant_id` boundaries.
- Never allow cross-SaaS auth tables or shared session stores.

## Control Tower Boundaries (Campamento Base)

- `bases` worker acts as control tower only.
- It consumes aggregate telemetry and orchestration events.
- It does not accept final-user auth from other SaaS domains.
