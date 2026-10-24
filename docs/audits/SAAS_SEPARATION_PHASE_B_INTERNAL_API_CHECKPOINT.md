# SAAS Separation — Phase B Internal API Checkpoint

Date: 2026-06-06
Scope: Checkpoint de Phase B para endpoints internos SocialFlow en monolito.

---

## 1) Verificación de endpoints creados

### A. GET `/api/internal/socialflow/health`
- Route file: `src/app/api/internal/socialflow/health/route.ts`
- Test file: `tests/api/internal/socialflow/health.test.ts`
- Tipos usados:
  - `SocialFlowHealthResponse`
  - `SocialFlowHealthStatus`
  - `InternalApiError` (vía helper auth)
- Helper auth usado:
  - `validateInternalServiceTokenRequest` desde `src/lib/capabilities/internal-api-auth/service-token.ts`
- Status de validación:
  - `pnpm typecheck`: OK
  - `npx vitest run tests/api/internal/socialflow/health.test.ts`: OK (7/7)
- ¿Importa lógica interna prohibida?:
  - No (`@/lib/socialflow/contracts/campobase`: no)
  - No (`@/lib/socialflow/contracts/owner-dashboard`: no)
  - No (`@/lib/campobase/socialflow-service`: no)
  - No (`@/lib/owner/control-dashboard`: no)

### B. GET `/api/internal/socialflow/owner/snapshot`
- Route file: `src/app/api/internal/socialflow/owner/snapshot/route.ts`
- Test file: `tests/api/internal/socialflow/owner-snapshot.test.ts`
- Tipos usados:
  - `SocialFlowOwnerSnapshotResponse`
  - `SocialFlowHealthStatus` (indirecto vía tipo snapshot)
  - `InternalApiError` (vía helper auth)
- Helper auth usado:
  - `validateInternalServiceTokenRequest` desde `src/lib/capabilities/internal-api-auth/service-token.ts`
- Status de validación:
  - `pnpm typecheck`: OK
  - `npx vitest run tests/api/internal/socialflow/owner-snapshot.test.ts`: OK (7/7)
- ¿Importa lógica interna prohibida?:
  - No (`@/lib/socialflow/contracts/campobase`: no)
  - No (`@/lib/socialflow/contracts/owner-dashboard`: no)
  - No (`@/lib/campobase/socialflow-service`: no)
  - No (`@/lib/owner/control-dashboard`: no)

### C. GET `/api/internal/socialflow/observability/snapshot`
- Route file: `src/app/api/internal/socialflow/observability/snapshot/route.ts`
- Test file: `tests/api/internal/socialflow/observability-snapshot.test.ts`
- Tipos usados:
  - `SocialFlowObservabilitySnapshot`
  - `SocialFlowObservabilityMetrics`
  - `SocialFlowObservabilityRecentError`
  - `SocialFlowHealthStatus` (campo `status`)
  - `InternalApiError` (vía helper auth)
- Helper auth usado:
  - `validateInternalServiceTokenRequest` desde `src/lib/capabilities/internal-api-auth/service-token.ts`
- Status de validación:
  - `pnpm typecheck`: OK
  - `npx vitest run tests/api/internal/socialflow/observability-snapshot.test.ts`: OK (7/7)
- ¿Importa lógica interna prohibida?:
  - No (`@/lib/socialflow/contracts/campobase`: no)
  - No (`@/lib/socialflow/contracts/owner-dashboard`: no)
  - No (`@/lib/campobase/socialflow-service`: no)
  - No (`@/lib/owner/control-dashboard`: no)

---

## 2) Verificación contra contrato v1

Referencia: `docs/contracts/campobase-socialflow-internal-api-v1.md`

> Nota de checkpoint: la implementación actual usa rutas Next en `/api/internal/...` y respuestas mínimas/neutras para estabilizar frontera y auth antes de acoplar repositorios/contratos ricos.

| Endpoint contrato v1 | Estado | Observación |
|---|---|---|
| `GET /internal/socialflow/health` | partial | Implementado como `GET /api/internal/socialflow/health`; auth correcta; shape mínima distinta al schema rico del contrato v1. |
| `GET /internal/socialflow/observability/snapshot` | partial | Implementado como `GET /api/internal/socialflow/observability/snapshot`; auth correcta; snapshot mínimo neutro sin query params `tenantId/saasId`. |
| `POST /internal/socialflow/automation/trigger` | deferred | Pendiente por planificación de Phase B; no implementado aún. |
| `POST /internal/socialflow/operator/actions` | deferred | Pendiente por planificación de Phase B; no implementado aún. |
| `GET /internal/socialflow/owner/snapshot` | partial | Implementado como `GET /api/internal/socialflow/owner/snapshot`; auth correcta; snapshot mínimo neutro sin query params `tenantId/saasId`. |
| `POST /internal/socialflow/events` | deferred | Pendiente por planificación de Phase B; no implementado aún. |

Fuera de contrato v1:
- No se detectaron endpoints nuevos fuera de esta lista en `src/app/api/internal/socialflow/*`.

---

## 3) Verificación de imports prohibidos

### En endpoints nuevos (`src/app/api/internal/socialflow/*`)
Búsqueda realizada para:
- `@/lib/socialflow/contracts/campobase`
- `@/lib/socialflow/contracts/owner-dashboard`
- `@/lib/campobase/socialflow-service`
- `@/lib/owner/control-dashboard`

Resultado:
- No encontrados en los tres endpoints nuevos (`health`, `owner/snapshot`, `observability/snapshot`).

### En imports legacy (deben seguir existiendo por ahora)
- `src/lib/campobase/socialflow-service.ts`
  - Sigue importando `@/lib/socialflow/contracts/campobase`.
- `src/lib/owner/control-dashboard.ts`
  - Sigue importando `@/lib/socialflow/contracts/owner-dashboard`.

Conclusión:
- Endpoints nuevos cumplen no-acoplamiento prohibido.
- Imports legacy siguen presentes (esperado en fase previa a sustitución).

---

## 4) Validaciones ejecutadas (exactas)

Comandos ejecutados:
1. `pnpm typecheck`
2. `npx vitest run tests/api/internal/socialflow/health.test.ts`
3. `npx vitest run tests/api/internal/socialflow/owner-snapshot.test.ts`
4. `npx vitest run tests/api/internal/socialflow/observability-snapshot.test.ts`

Resultados:
- `pnpm typecheck`: OK
- `health.test.ts`: OK (7/7)
- `owner-snapshot.test.ts`: OK (7/7)
- `observability-snapshot.test.ts`: OK (7/7)

No se ejecutaron validaciones adicionales.

---

## 5) Próximo commit recomendado (sin implementar)

Endpoint elegido (solo uno del contrato v1):
- `POST /api/internal/socialflow/events`

### Por qué debe ir ahora
- Es el endpoint menos intrusivo para avanzar contrato v1 sin acoplar lógica interna profunda.
- Permite abrir canal formal de señalización Campobase → SocialFlow con payload estable.
- Reduce riesgo frente a `automation/trigger` y `operator/actions`, que implican semántica operativa más sensible (idempotencia, ejecución, estados).

### Riesgo
- Bajo a medio.
- Riesgo principal: definir validación mínima de payload sin bloquear evolución futura de tipos de evento.
- Riesgo de acoplamiento: bajo si se mantiene como contrato de ingestión neutra sin importar capas de negocio internas.

### Archivos a crear
- `src/app/api/internal/socialflow/events/route.ts`
- `tests/api/internal/socialflow/events.test.ts`

### Archivos a modificar
- `src/lib/capabilities/internal-api-types/socialflow.ts` (agregar `SocialFlowEventRequest` y `SocialFlowEventResponse` mínimos si faltan)

### Tests necesarios
- 202 con headers válidos + payload válido.
- 401 sin `Authorization`.
- 403 token inválido.
- 403 control-plane inválido.
- 400 sin request id.
- 400 payload inválido.
- Verificación de shape response.
- Verificación de no imports prohibidos en el route.

### Qué NO se debe tocar
- `src/lib/campobase/socialflow-service.ts`
- `src/lib/owner/control-dashboard.ts`
- `src/lib/socialflow/*`
- `src/lib/mentoria/*`
- `src/lib/clinic/*`
- `migrations/*`
- Sin workers, sin refactor, sin cambios de imports existentes.

### Validaciones
- `pnpm typecheck`
- `npx vitest run tests/api/internal/socialflow/events.test.ts`

### Rollback
- Revertir únicamente:
  - `src/app/api/internal/socialflow/events/route.ts`
  - `tests/api/internal/socialflow/events.test.ts`
  - cambios puntuales en `src/lib/capabilities/internal-api-types/socialflow.ts`
- Confirmar que los tres GET actuales siguen pasando con los tests ya existentes.

---

## 6) Conclusión obligatoria

- Archivo creado: Sí
- Ruta exacta: `docs/audits/SAAS_SEPARATION_PHASE_B_INTERNAL_API_CHECKPOINT.md`
- Endpoints implementados actualmente:
  - `GET /api/internal/socialflow/health`
  - `GET /api/internal/socialflow/owner/snapshot`
  - `GET /api/internal/socialflow/observability/snapshot`
- Endpoints pendientes del contrato v1:
  - `POST /api/internal/socialflow/automation/trigger`
  - `POST /api/internal/socialflow/operator/actions`
  - `POST /api/internal/socialflow/events`
- Validaciones ejecutadas y resultado:
  - `pnpm typecheck`: OK
  - `health`: OK (7/7)
  - `owner/snapshot`: OK (7/7)
  - `observability/snapshot`: OK (7/7)
- Imports prohibidos encontrados en endpoints nuevos: No
- Siguiente commit recomendado: `POST /api/internal/socialflow/events`
- ¿SocialFlow puede moverse ya a Worker?: No
  - Falta completar endpoints POST críticos de contrato v1 y posterior fase de sustitución de imports legacy por cliente interno.
