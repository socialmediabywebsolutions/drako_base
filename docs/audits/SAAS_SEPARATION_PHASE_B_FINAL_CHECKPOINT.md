# SAAS Separation — Phase B Final Checkpoint

Date: 2026-06-06
Scope: Cierre final de Phase B para contrato interno Campobase ↔ SocialFlow v1 dentro del monolito.

---

## 1) Verificación contrato v1 implementado

Referencia: `docs/contracts/campobase-socialflow-internal-api-v1.md`

### 1. `GET /internal/socialflow/health`
- Estado: `implemented`
- Ruta real Next.js: `GET /api/internal/socialflow/health`
- Route file: `src/app/api/internal/socialflow/health/route.ts`
- Test file: `tests/api/internal/socialflow/health.test.ts`
- Tipos usados: `SocialFlowHealthResponse`, `SocialFlowHealthStatus`
- Auth helper usado: `validateInternalServiceTokenRequest` (`src/lib/capabilities/internal-api-auth/service-token.ts`)
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/health.test.ts`
- Resultado: `OK (7/7)`
- Limitaciones conocidas:
  - Health mínimo contractual (checks contract/runtime/auth) sin dependencia de lógica profunda.

### 2. `GET /internal/socialflow/observability/snapshot`
- Estado: `implemented`
- Ruta real Next.js: `GET /api/internal/socialflow/observability/snapshot`
- Route file: `src/app/api/internal/socialflow/observability/snapshot/route.ts`
- Test file: `tests/api/internal/socialflow/observability-snapshot.test.ts`
- Tipos usados: `SocialFlowObservabilitySnapshot`, `SocialFlowObservabilityMetrics`, `SocialFlowObservabilityRecentError`
- Auth helper usado: `validateInternalServiceTokenRequest`
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/observability-snapshot.test.ts`
- Resultado: `OK (7/7)`
- Limitaciones conocidas:
  - Snapshot con valores neutros/seguros.
  - Sin acople a repositorio operativo profundo todavía.

### 3. `POST /internal/socialflow/automation/trigger`
- Estado: `implemented`
- Ruta real Next.js: `POST /api/internal/socialflow/automation/trigger`
- Route file: `src/app/api/internal/socialflow/automation/trigger/route.ts`
- Test file: `tests/api/internal/socialflow/automation-trigger.test.ts`
- Tipos usados: `SocialFlowAutomationTriggerRequest`, `SocialFlowAutomationTriggerResponse`, `SocialFlowAutomationType`
- Auth helper usado: `validateInternalServiceTokenRequest`
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/automation-trigger.test.ts`
- Resultado: `OK (9/9)`
- Limitaciones conocidas:
  - Aceptación contractual (`202`) sin ejecución real profunda aún.

### 4. `POST /internal/socialflow/operator/actions`
- Estado: `implemented`
- Ruta real Next.js: `POST /api/internal/socialflow/operator/actions`
- Route file: `src/app/api/internal/socialflow/operator/actions/route.ts`
- Test file: `tests/api/internal/socialflow/operator-actions.test.ts`
- Tipos usados: `SocialFlowOperatorActionRequest`, `SocialFlowOperatorActionResponse`, `SocialFlowOperatorActionType`
- Auth helper usado: `validateInternalServiceTokenRequest`
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/operator-actions.test.ts`
- Resultado: `OK (9/9)`
- Limitaciones conocidas:
  - Aceptación contractual (`202`) sin ejecución operativa profunda aún.

### 5. `GET /internal/socialflow/owner/snapshot`
- Estado: `implemented`
- Ruta real Next.js: `GET /api/internal/socialflow/owner/snapshot`
- Route file: `src/app/api/internal/socialflow/owner/snapshot/route.ts`
- Test file: `tests/api/internal/socialflow/owner-snapshot.test.ts`
- Tipos usados: `SocialFlowOwnerSnapshotResponse`, `SocialFlowOwnerSnapshot`
- Auth helper usado: `validateInternalServiceTokenRequest`
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/owner-snapshot.test.ts`
- Resultado: `OK (7/7)`
- Limitaciones conocidas:
  - Snapshot con valores neutros/seguros.
  - Sin integración con fuente desacoplada final todavía.

### 6. `POST /internal/socialflow/events`
- Estado: `implemented`
- Ruta real Next.js: `POST /api/internal/socialflow/events`
- Route file: `src/app/api/internal/socialflow/events/route.ts`
- Test file: `tests/api/internal/socialflow/events.test.ts`
- Tipos usados: `SocialFlowEventRequest`, `SocialFlowEventResponse`, `SocialFlowEventType`
- Auth helper usado: `validateInternalServiceTokenRequest`
- Validación ejecutada: `npx vitest run tests/api/internal/socialflow/events.test.ts`
- Resultado: `OK (9/9)`
- Limitaciones conocidas:
  - Aceptación contractual (`202`) sin persistencia/event store desacoplado aún.

---

## 2) Verificación de archivos creados en Phase B

### Routes
1. `src/app/api/internal/socialflow/health/route.ts`
- Propósito: health contractual interno
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: bajo

2. `src/app/api/internal/socialflow/owner/snapshot/route.ts`
- Propósito: snapshot owner contractual
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: bajo

3. `src/app/api/internal/socialflow/observability/snapshot/route.ts`
- Propósito: snapshot observabilidad contractual
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: bajo

4. `src/app/api/internal/socialflow/events/route.ts`
- Propósito: aceptación/validación contractual de eventos
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: bajo-medio (persistencia aún diferida)

5. `src/app/api/internal/socialflow/automation/trigger/route.ts`
- Propósito: aceptación/validación contractual de trigger
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: medio (ejecución real aún diferida)

6. `src/app/api/internal/socialflow/operator/actions/route.ts`
- Propósito: aceptación/validación contractual de acciones operativas
- Estado archivo: nuevo
- Imports prohibidos: no
- Riesgo: medio (acción real aún diferida)

### Shared capabilities
7. `src/lib/capabilities/internal-api-auth/service-token.ts`
- Propósito: auth interna por service token y headers de control plane
- Estado archivo: nuevo (Phase B)
- Imports prohibidos: no
- Riesgo: bajo

8. `src/lib/capabilities/internal-api-types/socialflow.ts`
- Propósito: tipos compartidos internos para contrato v1
- Estado archivo: nuevo en Phase B y ampliado en commits posteriores
- Imports prohibidos: no
- Riesgo: bajo

### Tests
9. `tests/api/internal/socialflow/health.test.ts`
- Propósito: contrato health + auth + no import prohibido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: bajo

10. `tests/api/internal/socialflow/owner-snapshot.test.ts`
- Propósito: contrato owner snapshot + auth + no import prohibido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: bajo

11. `tests/api/internal/socialflow/observability-snapshot.test.ts`
- Propósito: contrato observability snapshot + auth + no import prohibido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: bajo

12. `tests/api/internal/socialflow/events.test.ts`
- Propósito: contrato events + auth + validación de eventType permitido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: bajo-medio

13. `tests/api/internal/socialflow/automation-trigger.test.ts`
- Propósito: contrato automation trigger + auth + validación de automationType permitido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: medio

14. `tests/api/internal/socialflow/operator-actions.test.ts`
- Propósito: contrato operator actions + auth + validación de actionType permitido
- Estado archivo: nuevo
- Imports prohibidos en route: verificados
- Riesgo: medio

---

## 3) Verificación de imports prohibidos en endpoints nuevos

Búsqueda sobre `src/app/api/internal/socialflow/**/route.ts` para:
- `@/lib/socialflow/contracts/campobase`
- `@/lib/socialflow/contracts/owner-dashboard`
- `@/lib/campobase/socialflow-service`
- `@/lib/owner/control-dashboard`

Resultado:
- No se encontraron esos imports en ninguno de los endpoints nuevos.

---

## 4) Verificación de imports legacy aislados

Confirmación de existencia (no tocados en Phase B):
- `src/lib/campobase/socialflow-service.ts`
  - Sigue importando `@/lib/socialflow/contracts/campobase`
- `src/lib/owner/control-dashboard.ts`
  - Sigue importando `@/lib/socialflow/contracts/owner-dashboard`

Conclusión:
- Los imports legacy siguen aislados y son objetivo de `Phase C` (no de `Phase B`).

---

## 5) Validaciones ejecutadas (exactas)

Comandos ejecutados:
1. `pnpm typecheck`
2. `npx vitest run tests/api/internal/socialflow/health.test.ts`
3. `npx vitest run tests/api/internal/socialflow/owner-snapshot.test.ts`
4. `npx vitest run tests/api/internal/socialflow/observability-snapshot.test.ts`
5. `npx vitest run tests/api/internal/socialflow/events.test.ts`
6. `npx vitest run tests/api/internal/socialflow/automation-trigger.test.ts`
7. `npx vitest run tests/api/internal/socialflow/operator-actions.test.ts`

Resultado:
- `pnpm typecheck`: OK
- `health.test.ts`: OK (7/7)
- `owner-snapshot.test.ts`: OK (7/7)
- `observability-snapshot.test.ts`: OK (7/7)
- `events.test.ts`: OK (9/9)
- `automation-trigger.test.ts`: OK (9/9)
- `operator-actions.test.ts`: OK (9/9)

No se ejecutaron validaciones adicionales.

---

## 6) Readiness para Phase C

### Opción A
- Import a sustituir primero:
  - `src/lib/owner/control-dashboard.ts`
  - legacy: `@/lib/socialflow/contracts/owner-dashboard`

**Riesgo**
- Bajo-medio.
- Flujo acotado a owner snapshot/read-model, menor superficie operativa.

**Impacto**
- Medio.
- Afecta Owner Dashboard (lectura), no dispara acciones operativas profundas.

**Archivos implicados**
- Modificar:
  - `src/lib/owner/control-dashboard.ts`
- Crear (recomendado):
  - `src/lib/capabilities/internal-api-client/socialflow.ts`
  - (opcional) util/adaptador de mapeo owner snapshot

**Tests necesarios**
- Test unitario/route de client (`getOwnerSnapshot`)
- Test de integración del flujo owner (sin import directo legacy)
- Re-ejecutar tests de endpoint owner/snapshot existentes

**Rollback**
- Revertir cambios de client + `control-dashboard.ts`
- Restaurar import legacy directo

### Opción B
- Import a sustituir primero:
  - `src/lib/campobase/socialflow-service.ts`
  - legacy: `@/lib/socialflow/contracts/campobase`

**Riesgo**
- Medio-alto.
- Superficie más grande (events, trigger, actions, observability; semántica operativa).

**Impacto**
- Alto.
- Afecta coordinación central de Campobase y flujos de automatización.

**Archivos implicados**
- Modificar:
  - `src/lib/campobase/socialflow-service.ts`
- Crear:
  - `src/lib/capabilities/internal-api-client/socialflow.ts`
  - adaptadores de respuesta/errores para Campobase

**Tests necesarios**
- Cobertura de todos los métodos Campobase socialflow-service
- Tests de fallback/errores/idempotencia
- Revalidación amplia de endpoints y flujos Campobase dependientes

**Rollback**
- Revertir cambios de client + `socialflow-service.ts`
- Restaurar import legacy directo

### Recomendación final
- Recomendada: **Opción A primero** (`owner/control-dashboard.ts`), por menor riesgo inicial y menor blast radius.

---

## 7) Próximo commit recomendado (Phase C.1, no implementado)

**Nombre del commit**
- `phase-c1: add socialflow internal api client and switch owner dashboard snapshot path`

**Objetivo**
- Introducir cliente interno estable para SocialFlow y sustituir primero el import legacy de Owner Dashboard.

**Archivos a crear**
- `src/lib/capabilities/internal-api-client/socialflow.ts`
- `tests/lib/capabilities/internal-api-client/socialflow.test.ts` (o ubicación equivalente de tests del repo)

**Archivos a modificar**
- `src/lib/owner/control-dashboard.ts`
- (si aplica) `src/lib/capabilities/internal-api-types/socialflow.ts` para ajustes no breaking de tipado cliente

**Archivos que NO se deben tocar**
- `src/lib/campobase/socialflow-service.ts`
- `src/lib/socialflow/*`
- `src/lib/mentoria/*`
- `src/lib/clinic/*`
- `migrations/*`
- endpoints internos ya implementados en Phase B

**Tests nuevos o modificados**
- Nuevo test de client interno
- Test del flujo owner que valide consumo vía API client (sin import legacy)
- Mantener y correr `tests/api/internal/socialflow/owner-snapshot.test.ts`

**Validaciones**
- `pnpm typecheck`
- tests del client + tests owner relacionados
- `npx vitest run tests/api/internal/socialflow/owner-snapshot.test.ts`

**Rollback**
- Revertir client y cambios en `control-dashboard.ts`
- Restaurar import directo `@/lib/socialflow/contracts/owner-dashboard`

**Razón de seguridad**
- Es el primer corte con menor riesgo operacional: reemplaza un flujo de lectura (owner snapshot) antes de tocar orchestration crítica de Campobase.

---

## 8) Conclusión obligatoria

- Archivo creado: **sí**
- Ruta exacta: `docs/audits/SAAS_SEPARATION_PHASE_B_FINAL_CHECKPOINT.md`
- Endpoints del contrato v1 implementados: **6/6**
  - `GET /api/internal/socialflow/health`
  - `GET /api/internal/socialflow/observability/snapshot`
  - `POST /api/internal/socialflow/automation/trigger`
  - `POST /api/internal/socialflow/operator/actions`
  - `GET /api/internal/socialflow/owner/snapshot`
  - `POST /api/internal/socialflow/events`
- Endpoints pendientes: **0**
- Imports prohibidos encontrados en endpoints nuevos: **no**
- Imports legacy todavía existentes: **sí**
- Validaciones ejecutadas y resultado: **todas OK** (`typecheck` + 6 suites puntuales vitest)
- ¿Phase B queda cerrada?: **sí**
- ¿SocialFlow puede moverse ya a Worker?: **no**
  - Primero debe completarse Phase C (sustitución de imports legacy por cliente interno estable).
- Siguiente commit recomendado para Phase C:
  - `phase-c1: add socialflow internal api client and switch owner dashboard snapshot path`
