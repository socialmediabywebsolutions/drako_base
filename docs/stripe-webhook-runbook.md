# Stripe Webhook Runbook

Objetivo: diagnosticar, deduplicar y reconciliar eventos Stripe sin exponer PII.

## Verificacion de firma
1) Asegura `STRIPE_WEBHOOK_SECRET` en el entorno.
2) Confirma que el header `Stripe-Signature` llega al endpoint.
3) Si la firma falla:
   - Respuesta 400.
   - Evento `security.webhook.invalid_signature` en `campamento_events`.

## Dedupe (stripe_webhook_events)
- Tabla: `stripe_webhook_events`
- Campos clave: `stripe_event_id`, `status`, `attempts`, `last_error`, `tenant_id`, `saas_slug`.
- Para comprobar si un evento ya se proceso:
  - `SELECT * FROM stripe_webhook_events WHERE stripe_event_id = ?`
- Un event.id no se procesa dos veces (idempotencia).

## Reintento seguro
- Stripe reintenta automaticamente si recibe 5xx.
- El webhook marca `failed` con `last_error`.
- No reiniciar el mismo event.id manualmente: crea uno nuevo desde Stripe o reintenta con el replay oficial.

## Re-sync de mapping (drift)
Si hay `billing.stripe.drift_detected`:
1) Verifica `saas_stripe_mapping` para el SaaS.
2) Re-ejecuta la Factory Stripe (live) para re-sincronizar product/prices.
3) Confirma que `stripe_price_ids` incluye el price correcto.

## Action Queue
Anomalias crean items:
- `Billing attribution missing` (CRITICAL)
- `Billing attribution mismatch` (HIGH)
- `Stripe mapping drift` (HIGH)

Para confirmar:
- `/owner` -> Action Queue
- Filtra por categoria `BILLING`

## Eventos internos esperados
- `billing.invoice.paid`
- `billing.invoice.failed`
- `billing.subscription.updated`
- `billing.checkout.completed`
- `billing.webhook.unattributed`
- `billing.webhook.attribution_mismatch`
- `billing.stripe.drift_detected`

