# Drako Factory P0 Readiness Audit

Date: 2026-02-26

## Objective

Validate that Drako Factory is operational with strict separation between holding and tenant factory operations, and that production readiness gate no longer fails on legacy table expectations.

## Real Changes Applied

### D1 schema updates in `drako_db_prod`

Applied: `migrations/0136_drako_factory_tenants_foundations.sql`

Created or updated:

- `tenants` (added `owner_user_id`, `saas_slug`)
- `tenant_profiles`
- `tenant_domains`
- `tenant_integrations`
- `tenant_stripe_connect`
- `tenant_knowledge_bases` (added `kb_id`, `status_name`)
- `tenant_jobs`
- `tenant_audit_logs`

### D1 schema updates in `drako_holding_db`

Applied: `migrations/0137_holding_control_tower_foundations.sql`

Created:

- `holding_saases`
- `holding_billing_rollups`
- `holding_ops_tickets`
- `holding_event_logs`

### Production gate source-of-truth alignment

Updated: `docs/config/production-audits-expected-state.json`

- Legacy blockers removed (`users`, `client_profiles`, `jobs`, `documents` for Drako Factory path)
- Critical tables aligned to MVP tenant factory model and holding model
- `drako-base-3` remains blocked via `blockedMappings`

## Tenant Example (Real)

Tenant provisioned in `drako_db_prod`:

- `tenant_id`: `tenant_factory_demo_20260226`
- `saas_slug`: `tenant-fitness-lab-20260226`
- `owner_user_id`: `owner_demo_001`
- `domain`: `fitnesslab.demo.drako.systems`
- `domain_status`: `attached`
- `stripe_connect_account_id`: `acct_demo_factory_20260226`
- `stripe_onboarding_status`: `pending`

Provisioning states recorded (`tenant_jobs`):

- `draft`
- `validated`
- `provisioning`
- `live`
- `suspended`

## Holding Inventory Evidence

Rows present in `drako_holding_db.holding_saases`:

- `drakos -> saas-drakos-prod -> drako.systems`
- `bases -> saas-bases-prod -> bases.drako.systems`
- `mentorias -> saas-mentorias-prod -> mentorias.drako.systems`

## Runtime Evidence

- `GET https://bases.drako.systems/api/health` => `ok=true`
- `GET https://mentorias.drako.systems/api/health` => `ok=true`
- `GET https://drakos.drako.systems/clients` => `307` redirect to `/drakos/auths/logins`
- Local shell could not resolve `https://drako.systems` directly in this environment (host-level override/network path), but alias `drakos.drako.systems` is live.

## Gate Evidence

Command: `npm run check:production`

Latest report (`docs/audits/production-readiness-latest.json`):

- `mode`: `real`
- `productionReady`: `true`
- `blockers`: `0`
- `warnings`: `1`
- `warning`: `criticalRouteMissing` for `drako.systems/*` (custom domains active, zone routes empty)

