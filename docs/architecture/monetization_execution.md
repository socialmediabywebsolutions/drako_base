# Monetization Execution Master Plan
## Campamento Base Enterprise Holding

> LEGACY DOCUMENT
> The billing ideas here are historical context. Active factory/runtime truth no longer depends on `holding_saas_registry`; use the canonical Drako runtime tables and current workspace billing flow instead.

**Status**: Definitive Execution
**Architect**: Drako AI

This document outlines the **Technical Execution Structure** that ensures infinite scalability, central governance, and specialized monetization for every SaaS within the Holding.

---

## 1. The Core Hierarchy (Data-Level)

All data is housed in `drako_db_prod` (D1), governed by `migrations/0126...`.

| Entity | Table | Key Constraint | Meaning |
| :--- | :--- | :--- | :--- |
| **Holding** | `holding_saas_registry` | `saas_slug` (PK) | Defines valid subsidiaries (Drako, Mentoria...). |
| **Offer** | `saas_pricing_plans` | `(saas_slug, plan_code)` | Standardized plans (Starter, Pro, Scale) per SaaS. |
| **Contract** | `saas_subscriptions` | `(saas_slug, tenant_id)` | Single source of truth for billing status. |
| **Limit** | `saas_usage_quotas` | `(saas_slug, tenant_id, key)` | Hard limits for enforcement. |
| **Log** | `billing_audit_logs` | `(correlation_id)` | Immutable proof of all billing events. |

---

## 2. The Billing Flow (Producer to Consumer)

### A. Producer (Checkout) - `src/lib/billing/checkout.ts`
**Goal**: Enforce metadata consistency at the moment of creation.
**Rules**:
1.  **Mandatory Metadata**: Every Stripe Session MUST include:
    *   `saas_slug`: Which product?
    *   `tenant_id`: Which client?
    *   `plan_code`: Which tier?
2.  **Propagation**: By using `subscription_data.metadata`, we ensure these fields stick to the resulting Subscription and Invoice events.

### B. Routing (Webhook) - `api/billing/webhook`
**Goal**: Route the "Firehose" of Stripe events to the correct logic.
**Logic**:
1.  Receive Event.
2.  Extract `saas_slug` from Metadata.
3.  **Fail-Closed**: If `saas_slug` missing/invalid, log error and drop (or alert owner).
4.  Enqueue to `BILLING_QUEUE` with normalized payload.

### C. Consumer (Worker) - `workers/billing-consumer.ts`
**Goal**: Idempotent State Management.
**Logic**:
1.  **Events Handled**:
    *   `checkout.session.completed`: **Provision** Tenant + **Initialize** Sub + **Set** Quotas.
    *   `invoice.payment_succeeded`: **Mark Active**.
    *   `invoice.payment_failed`: **Mark Past Due**.
    *   `customer.subscription.deleted`: **Mark Canceled**.
2.  **Audit**: Every state change is written to `billing_audit_logs`.

---

## 3. Enforcement Engine (Fail-Closed)

Located in `src/lib/billing/enforce-billing.ts`.

### Standard Check
Every protected API (`/api/ai/chat`, `/api/workspaces`, etc.) MUST call `enforceBilling`.

**Algorithm**:
1.  **Identify Context**: `resolveSaasContext(req)` -> `saas_slug`.
2.  **Check Subscription**:
    *   Query `saas_subscriptions` for `(saas_slug, tenant_id)`.
    *   **IF** status NOT IN ('active', 'trial', 'past_due') -> **THROW 402**.
3.  **Check Quota** (Optional):
    *   Query `saas_usage_quotas`.
    *   **IF** `current + inc > limit` -> **THROW 429**.
4.  **Audit**: Log denial if thrown.

---

## 4. The Revenue View (Owner God-Mode)

Located in `src/app/api/owner/revenue`.

**Metrics**:
1.  **MRR**: Sum of `monthly_price_cents` for all `active` subscriptions.
2.  **Churn Risk**: Count of `past_due` subscriptions.
3.  **Churn Rate**: `Canceled / (Active + Canceled)` (Naive).
4.  **Drilldown**: Stats grouped by `saas_slug`.

---

## 5. Deployment & Scalability

**Why this scales to 10k tenants:**
1.  **D1**: Shared database, but index-optimized queries on `(saas_slug, tenant_id)` are extremely fast.
2.  **Queues**: Webhook ingestion is decoupled. Spike in signups won't crash the API.
3.  **Edge Enforcement**: `enforceBilling` runs on Cloudflare Workers (low latency).
4.  **Single Global Config**: No new infrastructure needed for new SaaS. Just insert row in `holding_saas_registry`.
