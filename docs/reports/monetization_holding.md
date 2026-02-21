# Monetización Holding Campamento Base (Canon)

**Estado**: ✅ Implementado y Verificado
**Arquitectura**: Fail-Closed, One-Stripe, Multi-SaaS

## 1. Variables de Entorno (Required)

| Variable | Descripción |
| :--- | :--- |
| `STRIPE_SECRET_KEY` | Clave secreta (sk_live_...) del Holding. |
| `STRIPE_WEBHOOK_SECRET` | Firma para validar eventos en `/api/billing/webhook`. |
| `BILLING_QUEUE` | Binding de Cloudflare Queue para desacoplar billing. |
| `DRACO_DB` | Binding de la base de datos D1 principal. |

## 2. Endpoints Críticos

### A. Webhook (`POST /api/billing/webhook`)
*   **Seguridad**: Valida firma Stripe. Valida Metadata.
*   **Fail-Closed**: Si `metadata.saas_slug` falta → 400 Bad Request + Log Crítico.
*   **Flujo**: Stripe → Webhook → Queue (`BILLING_QUEUE`).

### B. Owner Dashboard (`GET /api/owner/revenue`)
*   **Seguridad**: Requiere autenticación de Owner.
*   **Datos**: MRR global, desglose por SaaS, Active vs Past Due, Churn Rate.

## 3. Flujo de Datos (Billing Pipeline)

1.  **Checkout** (`src/lib/billing/checkout.ts`):
    *   Valida que `saas_slug` exista en `holding_saas_registry`.
    *   Busca `stripe_price_id` en `saas_pricing_plans`.
    *   **Inyecta Metadata**: `saas_slug`, `tenant_id`, `plan_code`, `origin='campamento_base'`.

2.  **Deliverables:**
*   `docs/reports/monetization_holding.md`: The requested short documentation.
*   `migrations/0127...` & `0128...`: Schema updates.
*   Updated `package.json` with utility scripts.

3.  **Procesamiento** (`src/workers/billing-consumer.ts`):
    *   Consume de la Queue.
    *   **Formato**: `{ stripeEventId, type, saasSlug, tenantId, planCode, payload }`
    *   **Idempotencia**: Verifica `stripe_event_id` en `billing_audit_logs`.
    *   **Lógica**:
        *   `checkout.session.completed` → Crea Tenant + Sub (Active) + Quotas.
        *   `payment_failed` → Status `past_due`.
        *   `subscription.deleted` → Status `canceled`.

4.  **Enforcement** (`src/lib/billing/enforce-billing.ts`):
    *   Consulta `saas_subscriptions` y `saas_usage_quotas`.
    *   **Reglas**:
        *   Unpaid/Canceled → 402 Block.
        *   Past Due → Permite lectura, bloquea creación de nuevos recursos (`workspaces`).
        *   Quota Exceeded → 429 Block.

## 4. Verificación (.ts script)

Se ha creado el script `scripts/verify-holding-monetization.ts` que utiliza `wrangler d1 execute` para validar la integridad de la base de datos local sin dependencias de Node.js bindings.

**Comando de verificación:**
```bash
npm run verify:monetization
```

**Comando de Seed (Local):**
```bash
npm run seed:canon
```

## 5. Pruebas Manuales (Curl)

**Simular Webhook (Requiere firma real o test local):**
*(Nota: En local se recomienda usar `stripe trigger`)*

```bash
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.saas_slug=drako \
  --add checkout_session:metadata.tenant_id=t_123 \
  --add checkout_session:metadata.plan_code=pro
```

La arquitectura garantiza escalabilidad infinita y aislamiento total financiero entre filiales.
