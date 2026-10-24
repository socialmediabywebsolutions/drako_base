# drako-billing-worker Runbook

## Scope
- Holding worker for billing domain only.
- No SaaS runtime logic.
- Workers-only execution.

## Resource IDs
- Worker name: `drako-billing-worker`
- D1 binding: `DRKO_BILLING_DB`
- D1 database name: `drako_billing_db`
- D1 database id: `60e1c9bb-9799-41b7-9d20-f0f525f6434b`
- KV binding: `DRKO_GLOBAL_CONFIG` (`2a333512ad9c4c25a166496c1c121781`)
- Queue producer binding: `DRKO_GLOBAL_EVENTS` (`drako-global-events`)
- Migrations table: `drko_billing_migrations`

## Migration Strategy
- Dedicated D1 for billing.
- Bootstrap-only mirrors in `0000_bootstrap.sql` for dependency resolution.
- No copy of full holding core tables.
- No cross-database FKs to holding D1.

## Commands Executed
```bash
pnpm exec wrangler d1 create drako_billing_db
pnpm exec wrangler deploy --dry-run --config workers/drako-billing-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations apply drako_billing_db --remote --config workers/drako-billing-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations list drako_billing_db --remote --config workers/drako-billing-worker/wrangler.workers.toml
pnpm exec wrangler deploy --config workers/drako-billing-worker/wrangler.workers.toml
curl -sS https://drako-billing-worker.socialmediabywebsolutions.workers.dev/healths
```

## Migration Apply Result
- Applied files:
  - `0000_bootstrap.sql`
  - `0001_billing_support_notes.sql` ... `0015_stripe_invoicing.sql`
- Result: `No migrations to apply` after apply.

## Schema Verification
Remote table inventory contains expected domain tables:
- `drko_billing_migrations`
- `drako_subscriptions`
- `saas_plans`
- `client_saas_subscriptions`
- `saas_tax_profiles`
- `saas_tax_periods`
- `drako_vendor_expenses`
- `drako_treasury_accounts`
- `drako_treasury_movements`
- `drako_treasury_config`
- `saas_stripe_mapping`
- `stripe_webhook_events`
- `stripe_setup_templates`
- `stripe_setup_log`
- `economic_events`
- `intervention_actions`
- `saas_economic_events`
- `saas_economics_snapshots`
- `mentoria_pricing_plans`
- `stripe_invoice_runs`

Migration registry rows:
- `0000_bootstrap.sql` through `0015_stripe_invoicing.sql` are present in `drko_billing_migrations`.

## Smoke Test
`GET /healths` response:
```json
{
  "ok": true,
  "workerName": "drako-billing-worker",
  "context": "holding",
  "workersOnly": true
}
```

## DoD Checklist
- [x] Dedicated D1 created and bound
- [x] Bootstrap minimal dependency layer created
- [x] Remote migrations applied with dedicated migrations table
- [x] Worker deployed
- [x] `/healths` smoke test returns `ok: true`
- [x] No SaaS workers changed in this gate
