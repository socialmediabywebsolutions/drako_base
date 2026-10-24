# Phase 23: Holding Monetization Report

**Objective**: Validate the "One Holding, Many SaaS" monetization engine.

## Core Schema Tables
1.  **`holding_saas_registry`**: Catalog of active subsidiaries.
2.  **`saas_tenants`**: Clients belonging to a specific SaaS.
3.  **`saas_pricing_plans`**: Tiers per SaaS.
4.  **`saas_subscriptions`**: Billing state per Tenant/SaaS.
5.  **`saas_usage_quotas`**: Enforcement counters.

## Critical Endpoints
1.  **`POST /api/billing/webhook`**: Central Stripe receiver.
2.  **`GET /api/owner/revenue`**: Global Revenue Dashboard (Owner Only).

## Validation Logic
*   **Fail Closed**: `enforceBilling()` throws 402 if no active subscription exists.
*   **Quota Limit**: `enforceBilling()` throws 429 if `current_value >= limit_value`.
*   **Isolation**: All DB Ops use `WHERE saas_slug = ? AND tenant_id = ?`.

## Testing Commands
See `scripts/verify-holding-monetization.ts` for automated verification.
