# Campamento Base: Enterprise Holding Architecture

**System Mode**: ENTERPRISE HOLDING ARCHITECT
**Status**: DEFINITIVE
**Last Updated**: 2026-02-16

## 1. Core Philosophy: The Holding Brain
"Campamento Base" is NOT just an admin panel. It is the **Central Holding Brain** that orchestrates multiple independent SaaS subsidiaries.

### Hierarchy
1.  **Level 0: The Holding (Campamento Base)**
    *   **Identity**: Single Owner Profile (You).
    *   **Roles**: Centralized Governance, Billing, DevOps, and Intelligence.
    *   **Responsibilities**: Aggregating revenue, enforcing compliance, managing infrastructure.
2.  **Level 1: The Subsidiaries (Products)**
    *   **Drako**: A conversational SaaS factory for businesses (SaaS Product #1).
    *   **Mentoria**: An EdTech platform (SaaS Product #2).
    *   **SocialFlow**: A marketing automation tool (SaaS Product #3).
    *   **Future Products**: Any new vertical spawned by the factory.
    *   *Note*: These are NOT tenants. They are *products* owned by the Holding.
3.  **Level 2: The Tenants (Clients)**
    *   **Acme Corp**: A client of *Mentoria*.
    *   **Clinic Demo**: A client of *Drako*.
    *   *Note*: A tenant belongs to a specific Subsidiary (SaaS).

---

## 2. Infrastructure Architecture (Shared & Isolated)

We maximize efficiency by sharing infrastructure while enforcing strict logical isolation.

*   **Cloudflare Account**: Single account for the Holding. All domains (`drako.systems`, `mentoria.education`) are zones in this account.
*   **Stripe Account**: Single Stripe account for the Holding.
    *   **Routing**: Products/Subscriptions in Stripe are tagged with `metadata.saas_slug`.
    *   **Webhooks**: Centralized webhook receives all events and routes them to the correct SaaS logic.
*   **Database (D1)**: Unified Multi-Tenant Database (`drako_db_prod`).
    *   **Separation**: All business tables are keyed by `saas_slug` AND `tenant_id`.
    *   **Governance**: `enforce-billing.ts` middleware enforces strict scope.

---

## 3. Central Modules (Campamento Base)

| Module | Function | Data Source |
| :--- | :--- | :--- |
| **Global Billing Orchestrator** | Routes Stripe events to correct SaaS/Tenant. | `saas_subscriptions` |
| **Fiscal Engine** | Calculates VAT/IRPF global liability. | `saas_invoices` (Proposed) |
| **Holding Registry** | Catalogs all active SaaS (`holding_saas_registry`). | `holding_saas_registry` |
| **Tech Error Monitoring** | Aggregates runtime errors from all Workers. | `system_logs` |
| **Revenue Aggregator** | MRR/Churn dashboards for the Owner. | `saas_subscriptions` |
| **DevOps Control Center** | Deployment status of all SaaS Workers/Pages. | Cloudflare API |

---

## 4. SaaS Subsidiary Rules (The Protocol)

Every SaaS (e.g., Drako, Mentoria) must adhere to the **Factory Protocol**:

1.  **Identity**: Must have a unique `saas_slug` registered in `holding_saas_registry`.
2.  **Pricing**: Must define plans in `saas_pricing_plans`.
3.  **Isolation**: All API queries MUST filter by `saas_slug`.
    *   *Correct*: `SELECT * FROM chats WHERE tenant_id = ? AND saas_slug = 'mentoria'`
    *   *Incorrect*: `SELECT * FROM chats WHERE tenant_id = ?` (Leakage risk!)
4.  **Billing**: MUST NOT implement custom billing logic. MUST use the Central Billing Worker.
5.  **Provisioning**: MUST accept standard provisioning events from the Queue.

---

## 5. Revenue & Monetization Model

### The Flow
1.  **Acquisition**: Client signs up for "Mentoria" (SaaS).
2.  **Checkout**: Client pays via Stripe Checkout (hosted by Holding Stripe).
3.  **Webhook**: Stripe sends `checkout.session.completed`.
4.  **Routing**:
    *   Central Webhook Worker receives event.
    *   Extracts `metadata.saas_slug`.
    *   Dispatches to `BILLING_QUEUE`.
5.  **Provisioning**:
    *   Billing Consumer creates Tenant in D1 (`saas_tenants`).
    *   Creates Subscription record (`saas_subscriptions`).
    *   Initializes Quotas (`saas_usage_quotas`).
6.  **Revenue Recognition**:
    *   Transaction recorded.
    *   Owner Dashboard updates "Mentoria" MRR.

### Owner Dashboard (God View)
The Owner sees the Matrix:
*   **Global MRR**: Sum of all SaaS.
*   **Breakdown**: MRR by SaaS (Drako vs Mentoria).
*   **Churn Risk**: Tenants in `past_due`.

---

## 6. Governance & Security (Non-Negotiable)

### Fail Closed Security
*   **Subscription Check**:
    *   Before *any* critical action (AI, DB Write), Middleware checks `saas_subscriptions`.
    *   If `status != 'active' | 'trial'`, REJECT (402).
*   **Quota Check**:
    *   Middleware checks `saas_usage_quotas`.
    *   If `current > limit`, REJECT (429).
*   **Context Resolution**:
    *   `resolveSaasContext` must verify `saas_slug` against `holding_saas_registry`.
    *   Unknown SaaS -> 404/403 (Block).

---

## 7. Scalability Limits
*   **Tenants**: Tested for 1000+ tenants per SaaS.
*   **Isolation**: Enforced by composite primary keys (`saas_slug`, `tenant_id`).
*   **Billing**: Asynchronous processing decouples payment loads from user traffic.
