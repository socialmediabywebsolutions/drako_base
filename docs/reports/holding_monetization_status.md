# Holding Monetization Status Report

**System**: Campamento Base Enterprise Holding
**Date**: 2026-02-16
**Status**: ✅ READY FOR DEPLOYMENT (CANON)

## 1. Architecture Alignment
*   **Holding**: Campamento Base (Brain/Admin)
*   **Subsidiaries (Registered)**:
    *   `drako` (SaaS Factory Product)
    *   `mentoria` (EdTech Product)
    *   `socialflow` (Marketing Product)
*   **Infrastructure**: Single Stripe + Cloudflare. Separation via `saas_slug`.

## 2. Database Schema (D1)
Refactored to "Canon" spec in `migrations/0126_holding_multi_saas_monetization.sql`.
*   `holding_saas_registry`: Single source of truth for subsidiaries.
*   `saas_pricing_plans`: Includes `departments_json` for department-based monetization.
*   `saas_subscriptions`: Strict `(saas_slug, tenant_id)` isolation.
*   `billing_audit_logs`: Centralized audit trail.
*   `owner_events`: System-wide event log.

## 3. Billing Engine
*   **Protocol**: Stripe Webhook -> Queue -> Async Worker.
*   **Webhook**: `src/app/api/billing/webhook/route.ts` extracts `saas_slug` from metadata.
*   **Consumer**: `src/workers/billing-consumer.ts` provisions tenants, updates sub status, and writes to `billing_audit_logs`.
*   **Idempotency**: Handled via `stripe_subscription_id` lookups.

## 4. Security (Fail-Closed)
*   **Middleware**: `src/lib/billing/enforce-billing.ts`
*   **Rules**:
    1.  No Subscription -> **402 Block**
    2.  Status != active/trial/past_due -> **402 Block**
    3.  Quota Exceeded -> **429 Block**
*   **Protection**: Applied to `/api/ai/chat` and `/api/departments`.

## 5. Owner Dashboard
*   **API**: `/api/owner/revenue`
*   **Metrics**: Aggregates MRR from `saas_subscriptions` + `saas_pricing_plans`.

## 6. How to Validate
Run the verification script:
```bash
npx tsx scripts/verify-holding.ts
```

## 7. Deployment Instructions
1.  **Migrate DB**: `wrangler d1 migrations apply drako_db_prod`
2.  **Deploy Workers**: `npm run deploy`
3.  **Config Stripe**: Point webhook to `https://<YOUR_DOMAIN>/api/billing/webhook`.
