# Billing (Stripe) — Edge Safe Mode

## Objetivo
Stripe debe funcionar en Cloudflare sin romper el runtime.
Si faltan secrets o SDK: NO 500 → **503 stripe_not_configured** con hint.

## Reglas
1) Stripe routes en **Edge runtime**.
2) Si falta:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   ⇒ responder 503 con reason/hint.
3) Webhooks:
   - Verificar firma
   - Idempotencia por `event.id`
   - Registrar resultado en D1 si aplica

## Respuesta estándar (no configurado)
HTTP 503 JSON:
- reason: `stripe_not_configured`
- hint: “Añade STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en Cloudflare Pages env/secrets.”

## Checklist prod
- Secrets en Pages
- Webhook endpoint en Stripe configurado a la URL correcta
- D1 binding OK (si se persisten eventos/entitlements)
