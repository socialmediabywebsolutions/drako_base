# P0 Meta-Audit + Fix Report (2026-02-27)

## Resumen ejecutivo técnico
- Se cerraron vectores P0 de aislamiento multi-tenant en rutas sensibles eliminando overrides no confiables (`x-tenant-id`, query/body) y forzando `requireTenantAccess`.
- Se cerraron fugas por ID/email/session en endpoints críticos (`reports/[id]/pdf`, `research/jobs`, `company-profile`), añadiendo filtros de pertenencia por tenant/sesión.
- Se eliminó bypass de dominios premium en `/api/domains/request` y `/api/domains/verify` con gate real de entitlement (`plan + suscripción + Stripe Connect para tenant drako`).
- Se consolidó webhook a un procesador canónico (`/api/stripe/webhook`) con verificación de firma sobre raw-body + dedupe idempotente y alias legacy sin lógica duplicada.
- Se endureció auth de cron/internal eliminando secrets por query y fallbacks inseguros.

## Endpoints corregidos (P0)
- `POST /api/ai/chat`: ahora exige `requireTenantAccess`; se eliminó confianza directa en header.
  - Evidencia: `src/app/api/ai/chat/route.ts:23`
- `GET/POST /api/departments`: ahora exige `requireTenantAccess`; se eliminó override por body.
  - Evidencia: `src/app/api/departments/route.ts:16`, `src/app/api/departments/route.ts:35`
- `POST/PATCH /api/campamento-base/contracts`: ahora exige `requireTenantAccess`.
  - Evidencia: `src/app/api/campamento-base/contracts/route.ts:11`, `src/app/api/campamento-base/contracts/route.ts:39`
- `GET/POST /api/dev-architects/{metrics,projects,sessions,checklists,alerts}`: se eliminó fallback `demo-tenant`; ahora guard uniforme `requireTenantAccess`.
  - Evidencia: `src/app/api/dev-architects/metrics/route.ts:17`, `src/app/api/dev-architects/projects/route.ts:18`, `src/app/api/dev-architects/sessions/route.ts:18`, `src/app/api/dev-architects/checklists/route.ts:18`, `src/app/api/dev-architects/alerts/route.ts:18`
- `GET /api/reports/[id]/pdf`: ahora filtra por `tenant_id` en join con `reports`.
  - Evidencia: `src/app/api/reports/[id]/pdf/route.ts:14`, `src/app/api/reports/[id]/pdf/route.ts:20`
- `GET/POST /api/research/jobs`: ahora valida sesión onboarding del tenant y filtra por `tenant_id`.
  - Evidencia: `src/app/api/research/jobs/route.ts:23`, `src/app/api/research/jobs/route.ts:28`, `src/app/api/research/jobs/route.ts:83`
- `GET/POST /api/company-profile`: ahora usa email de sesión autenticada; no acepta email arbitrario por query/body.
  - Evidencia: `src/app/api/company-profile/route.ts:27`, `src/app/api/company-profile/route.ts:68`, `src/app/api/company-profile/route.ts:112`
- `GET /api/saas/export`: guard reforzada con `requireTenantAccess` y audit insert corregido.
  - Evidencia: `src/app/api/saas/export/route.ts:26`, `src/app/api/saas/export/route.ts:49`
- `POST /api/domains/request` y `POST /api/domains/verify`: se elimina bypass hardcoded.
  - Evidencia: `src/app/api/domains/request/route.ts:20`, `src/app/api/domains/verify/route.ts:20`, `src/app/api/domains/verify/route.ts:29`
- `POST /api/stripe/webhook`: tenant público explícito, firma centralizada, dedupe activo.
  - Evidencia: `src/app/api/stripe/webhook/route.ts:252`, `src/app/api/stripe/webhook/route.ts:277`, `src/app/api/stripe/webhook/route.ts:308`
- `POST /api/billing/webhook`: neutralizado como alias al webhook canónico.
  - Evidencia: `src/app/api/billing/webhook/route.ts:5`
- Worker legacy `workers/stripe-webhook`: neutralizado a forward del endpoint canónico.
  - Evidencia: `workers/stripe-webhook/src/index.ts:5`, `workers/stripe-webhook/src/index.ts:21`
- Cron/internal (`/api/cron/domains`, `/api/cron/growth`, `/api/cron/overseer`) y scheduler worker: auth robusta sin query secret ni fallback.
  - Evidencia: `src/lib/security/cron-auth.ts:55`, `src/app/api/cron/domains/route.ts:12`, `src/app/api/cron/growth/route.ts:11`, `src/app/api/cron/overseer/route.ts:17`, `workers/drako-scheduler/src/index.ts:14`

## Antes / después de guardas (extracto)
- `resolveTenantId`:
  - Antes: aceptaba `x-tenant-id` y `tenantId` query, con fallback implícito a `demo-tenant`.
  - Después: fuente confiable principal `x-drako-tenant-id`; overrides legacy solo con `allowUntrustedOverride`.
  - Evidencia: `src/lib/tenants/services.ts:43`, `src/lib/tenants/services.ts:49`, `src/lib/tenants/services.ts:53`
- `requireTenantAccess`:
  - Antes: comparaba contra `resolveTenantId()` con fallback demo.
  - Después: compara contra tenant resuelto sin fallback (`fallbackTenantId: null`) y usa tenant de sesión como autoridad.
  - Evidencia: `src/lib/auth/session.ts:210`, `src/lib/auth/session.ts:212`
- `campamento-base/saas-factory/chat` (partner mode):
  - Antes: fallback automático a demo.
  - Después: exige contexto de tenant confiable y falla con `TENANT_CONTEXT_REQUIRED`.
  - Evidencia: `src/app/api/campamento-base/saas-factory/chat/route.ts:90`, `src/app/api/campamento-base/saas-factory/chat/route.ts:92`

## Rutas públicas que permanecen públicas (justificadas)
- `/api/auth/login`, `/api/health`, `/api/core-departments`, `/api/packs`, `/api/catalog/saas`, `/api/saas/public/[slug]`, `/api/site/clinic/leads`, `/api/stripe/webhook`, `/api/billing/webhook`.
- Justificación y mitigaciones en policy:
  - Evidencia: `src/lib/security/public-endpoints-policy.json:53`, `src/lib/security/public-endpoints-policy.json:60`

## Drift vs Gate (evidencia real)
- Método: escaneo local de `src/app/api/**/route.ts` buscando rutas sin `requireTenantAccess|requireAdmin|requireOwner|requireSession` y comparación con `public-endpoints-policy.json`.
- Resultado actual:
  - `PUBLIC_ROUTE_COUNT = 66`
  - `POLICY_ROUTE_COUNT = 9`
  - `MISSING_COUNT = 57`
- Diferencias estructurales críticas detectadas (muestra):
  - `/api/cron/domains`
  - `/api/cron/growth`
  - `/api/cron/overseer`
  - `/api/saas/growth/track`
  - `/api/checkout/start`
  - `/api/checkout/confirm`

## Tabla de riesgos clasificados
| Prioridad | Riesgo | Evidencia | Estado |
|---|---|---|---|
| P0 | Override tenant no confiable en rutas sensibles | `src/lib/auth/session.ts:212`, `src/app/api/departments/route.ts:35`, `src/app/api/ai/chat/route.ts:23` | Cerrado |
| P0 | Fuga por lectura por ID/session/email | `src/app/api/reports/[id]/pdf/route.ts:20`, `src/app/api/research/jobs/route.ts:83`, `src/app/api/company-profile/route.ts:27` | Cerrado |
| P0 | Bypass de planes en domains API | `src/app/api/domains/request/route.ts:20`, `src/app/api/domains/verify/route.ts:20` | Cerrado |
| P0 | Duplicación de webhook Stripe | `src/app/api/billing/webhook/route.ts:5`, `workers/stripe-webhook/src/index.ts:21` | Cerrado (canónico único) |
| P0 | Secret por query/fallback inseguro en cron/internal | `src/lib/security/cron-auth.ts:55`, `workers/drako-scheduler/src/index.ts:19` | Cerrado |
| P1 | Gate de endpoints públicos incompleto vs rutas reales | Drift scan: `MISSING_COUNT=57` | Abierto |
| P1 | Rutas owner/internal sin guard owner uniforme en todo el árbol | Hallazgos en inventario de rutas sin `requireOwner/requireAdmin` | Abierto |
| P2 | Deuda histórica demo/legacy fuera del camino P0 tocado | Uso demo en módulos no sensibles/legacy | Parcial |

## Incoherencias estructurales reales
- Policy pública (`public-endpoints-policy.json`) no cubre 57 rutas detectadas como públicas por escaneo estático.
- Alias legacy de webhook coexistía sin marca explícita en policy; se agregó entrada dedicada para visibilidad.
  - Evidencia: `src/lib/security/public-endpoints-policy.json:60`
- Había mezcla de auth patterns (`x-tenant-id`/query/body) y guardas de sesión; quedó unificado en rutas P0.

## Riesgos silenciosos (post-fix)
- Rutas no incluidas en P0 siguen potencialmente accesibles sin guard owner/tenant estricto (ver drift).
- El escaneo estático por guard textual puede subestimar/sobreestimar algunos casos con auth delegada no explícita.
- `tenant_stripe_connect` depende de migración desplegada para enforcement full drako-factory (si falta tabla, entitlement drako se deniega).

## Pruebas ejecutadas
- `npx vitest run src/lib/tenants/services.test.ts src/lib/auth/session.test.ts src/lib/domains/entitlement-gate.test.ts src/lib/billing/stripe-webhook-security.test.ts src/lib/billing/stripe-webhook-processor.test.ts tests/api/reports-pdf-isolation.test.ts tests/api/research-jobs-isolation.test.ts`
- Resultado: `7 files passed`, `15 tests passed`.

## Recomendaciones concretas
- Bloquear en CI el drift de rutas públicas: fail build si `MISSING_COUNT > 0`.
- Extender enforcement owner/admin uniforme en rutas `/api/owner/**` con helper único.
- Formalizar allowlist de rutas públicas por dominio/capa (holding vs factory vs verticales) y testear en gate.
- Añadir tests de integración para `/api/domains/request` y `/api/stripe/webhook` con fixtures end-to-end.

## Orden estratégico de ejecución
1. Gate CI de rutas públicas (bloqueante).
2. Uniformar guard owner/admin en `/api/owner/**`.
3. End-to-end tests de domains + webhook.
4. Limpieza P1/P2 de paths legacy/demo fuera de producción.

## Estimación aproximada de esfuerzo
- P0 aplicado: 1 jornada.
- P1 (gate+owner uniform): 2 a 3 jornadas.
- P2 (legacy cleanup integral): 3 a 5 jornadas.
