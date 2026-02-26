# Workers Inventory (Holding)

Date: 2026-02-26

| Worker | Scope | Status | workers.dev | Routes | Domains | Schedules | D1 | Notes |
| ------ | ----- | ------ | ----------- | ------ | ------- | --------- | -- | ----- |
| drako-core-worker | Holding | ACTIVE | enabled | 0 | 0 | 0 | drako_holding_db | Source of truth for registry/governance/audit/loop. |
| drako-billing-worker | Holding | ACTIVE | enabled | 0 | 0 | 0 | drako_billing_db | Central billing worker (holding scope). |
| drako-observability-worker | Holding | ACTIVE | enabled | 0 | 0 | 0 | drako_observability_db | Global observability worker (holding scope). |
| drako-ai-orchestrator-worker | Holding | ACTIVE | enabled | 0 | 0 | 0 | drako_ai_orchestrator_db | Global AI orchestration worker (holding scope). |
| drako-base-3 | Holding (Legacy) | ARCHIVED | disabled | 0 | 0 | 0 | drako_db_prod (legacy) | Tomb worker. `workers_dev=false`, no schedules, no routes, no domains. |

Verification source:

- Cloudflare API checks:
  - `/accounts/{account_id}/workers/scripts/{worker}/subdomain`
  - `/accounts/{account_id}/workers/scripts/{worker}/schedules`
  - `/zones/{zone_id}/workers/routes`
  - `/accounts/{account_id}/workers/domains`
