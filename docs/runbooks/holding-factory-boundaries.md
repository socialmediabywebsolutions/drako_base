# Holding Factory Boundaries

Date: 2026-02-26  
Scope: Campamento Base (holding), Drako Factory, vertical SaaS platforms

## Boundary Model

### Campamento Base (holding owner console)

- Runtime: `saas-bases-prod`
- Domain: `bases.drako.systems` (alias: `base.drako.systems`)
- Owns:
  - holding portfolio inventory
  - holding billing rollups for owned vertical SaaS platforms
  - internal operations tickets and incident tracking
  - global operating events for owner visibility
- Does not own:
  - tenant lifecycle of SaaS products created by Drako clients
  - tenant-level customer operations

### Drako Factory (client SaaS factory)

- Runtime: `saas-drakos-prod`
- Domain: `drako.systems` (alias: `drakos.drako.systems`)
- Owns:
  - tenant onboarding and tenant lifecycle
  - blueprint and provisioning states (`draft -> validated -> provisioning -> live -> suspended`)
  - tenant integrations and Stripe Connect onboarding
  - tenant knowledge bases, tenant jobs, tenant audit logs
- Does not own:
  - holding owner internal operations for owned vertical SaaS portfolio

### Vertical SaaS platforms (owned by holding)

- Runtime example: `saas-mentorias-prod`
- Domain: `mentorias.drako.systems` (alias: `mentoria.drako.systems`)
- Owns:
  - product customers and product operations
  - vertical subscriptions through holding Stripe account
- Does not own:
  - Drako tenant provisioning internals

### SaaS products created by Drako clients

- Provisioned per tenant by Drako Factory lifecycle
- Billing model: Stripe Connect account per client SaaS owner
- Platform fee can be collected by Drako platform without turning holding Stripe into merchant of record

## Billing Separation

- Holding-owned vertical SaaS platforms use one holding Stripe account.
- Drako-created SaaS tenants use `tenant_stripe_connect` with per-tenant Connect accounts.
- `tenant_integrations` tracks integration states per tenant/provider.

## Data Isolation Rules

- Drako Factory isolation keys:
  - `tenant_id`
  - `saas_slug`
- Holding tables never store tenant operational rows as source of truth.
- Vertical SaaS tables remain independent from Drako tenant lifecycle tables.

## Production Gate References

- Worker drift gate: `npm run check:workers`
- Hostname ownership gate: `npm run check:hostnames`
- Production readiness gate: `npm run check:production`

All three gates are read-only and fail-closed on critical ownership or schema drift.
