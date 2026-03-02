# Checklist P0 - Drako Factory

Fecha: 2026-02-27

## Tenant isolation hardening
- [x] Eliminado override de tenant por query/header/body en rutas P0 tocadas
- [x] Endpoints Dev Architects migrados a `requireTenantAccess` estricto
- [x] `resolveTenantId` restringido a header confiable (`x-drako-tenant-id`) por defecto

## Domains plan enforcement
- [x] Eliminado bypass hardcoded en `/api/domains/request`
- [x] Eliminado bypass hardcoded en `/api/domains/verify`
- [x] Gate de entitlement implementado (`plan_tier + subscription status + Stripe Connect para tenant drako`)

## Stripe webhooks
- [x] Endpoint canónico único: `/api/stripe/webhook`
- [x] Verificación de firma Stripe con raw body
- [x] Dedupe idempotente por `stripe_event_id`
- [x] Alias legacy `/api/billing/webhook` sin lógica duplicada
- [x] Worker legacy reenviado al endpoint canónico

## Estado
- P0 Drako Factory: DONE (bloque crítico cerrado, pendientes P1 en drift de policy pública)

## P0.5 Validación estructural final
- [x] Eliminado parámetro booleano ambiguo en `requestCustomDomain(...)`
- [x] Eliminado parámetro booleano ambiguo en `verifyAndActivate(...)` (reemplazado por opciones explícitas)
- [x] Confirmado: sin llamadas `requestCustomDomain(..., true)` en `src/`
- [x] Test crítico `/api/domains/request` sin entitlement => `403`
- [x] Test crítico `/api/stripe/webhook` con firma inválida => `400`
- [x] Webhook único activo con firma + dedupe, legacy en modo alias/forward
