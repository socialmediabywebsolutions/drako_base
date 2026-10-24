# Campamento Base ↔ TaskOps Orchestration Contract v1

**Version:** 1.0.0  
**Date:** 2026-06-07  
**Status:** DRAFT (Contract-only)  
**Scope:** Campamento Base orchestration boundary for TaskOps transversal engine

---

## 1. Purpose

Este contrato existe para:
- evitar meter lógica operativa de TaskOps dentro de Campamento Base,
- permitir que Campamento Base orqueste TaskOps como motor transversal,
- preparar separación futura de TaskOps hacia namespace propio,
- sustituir gradualmente el legacy `src/lib/campobase/taskops-platform*`.

---

## 2. Ownership rules

- **Campamento Base** = control plane, orquestador, observabilidad, lifecycle y gobierno operativo.
- **TaskOps** = motor transversal de tareas/automatizaciones/workflows.
- Campamento Base **no debe importar** lógica interna operativa de TaskOps.
- TaskOps **no debe depender** de internals legacy de Campobase.
- Comunicación objetivo entre capas vía contrato neutral:
  - API interna,
  - eventos,
  - health checks,
  - snapshots de métricas/estado.

---

## 3. Current legacy state

### 3.1 Legacy files actuales
- `src/lib/campobase/taskops-platform.ts`
- `src/lib/campobase/taskops-platform-service.ts`

### 3.2 Consumidores detectados
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/lib/saas-contract-definitions.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/lib/cross-saas-taskops-flow.test.ts`
- `tests/lib/campobase-taskops-platform-service.test.ts`

### 3.3 Estado técnico resumido
- `taskops-platform.ts` define metadata de plataforma + bootstrap + handler de señal (`task.overdue`).
- `taskops-platform-service.ts` contiene lógica operativa real (pending task audit, wiring de automation e integración).
- `platform-bootstrap` depende aún de imports legacy TaskOps, manteniendo bloqueo para canonicalización completa.

---

## 4. Boundary rules

- No mover lógica TaskOps a `src/lib/campamento-base/`.
- No crear nuevo código con nombre `campobase`.
- No crear nuevos imports hacia `@/lib/campobase`.
- Si se crea algo en Campamento Base debe ser contrato/orquestación neutral, no runtime TaskOps.
- Namespace recomendado para lógica TaskOps: `src/lib/taskops/`.

---

## 5. Contract capabilities

Capacidades mínimas que Campamento Base puede solicitar a TaskOps.

### 5.1 Health check
- **Responsabilidad Campamento Base:** consultar salud y aplicar alerting/escalado.
- **Responsabilidad TaskOps:** exponer disponibilidad operativa y checks mínimos.
- **Datos mínimos:** `tenantId`, `saasId`, `status`, `timestamp`, `checks[]`.
- **Errores esperados:** `TASKOPS_UNAVAILABLE`, `TASKOPS_UNAUTHORIZED`, `TASKOPS_FORBIDDEN`, `TASKOPS_TIMEOUT`.
- **Idempotencia:** sí (lectura).

### 5.2 Task/workflow status snapshot
- **Responsabilidad Campamento Base:** consumir snapshot para surface operator/control-plane.
- **Responsabilidad TaskOps:** proveer estado agregado de tareas/workflows/health.
- **Datos mínimos:** `tenantId`, `saasId`, `pendingTasks`, `overdueTasks`, `criticalOpenTasks`, `recentSignals`, `requestId`.
- **Errores esperados:** `TASKOPS_SNAPSHOT_UNAVAILABLE`, `TASKOPS_BAD_REQUEST`, `TASKOPS_UNAUTHORIZED`.
- **Idempotencia:** sí (lectura).

### 5.3 Pending task audit
- **Responsabilidad Campamento Base:** solicitar ejecución/auditoría y registrar resultado de control.
- **Responsabilidad TaskOps:** ejecutar auditoría pendiente bajo contrato acordado.
- **Datos mínimos:** `tenantId`, `saasId`, `auditKey`, `config`, `requestedBy`, `requestId`.
- **Errores esperados:** `TASKOPS_AUDIT_UNSUPPORTED`, `TASKOPS_AUDIT_CONFLICT`, `TASKOPS_AUDIT_FAILED`.
- **Idempotencia:** recomendable con `idempotencyKey` para ejecuciones mutables.

### 5.4 Automation execution request
- **Responsabilidad Campamento Base:** emitir solicitud de ejecución para automations soportadas.
- **Responsabilidad TaskOps:** validar precondiciones y disparar ejecución.
- **Datos mínimos:** `tenantId`, `saasId`, `automationKey`, `triggerType`, `triggeredBy`, `requestId`.
- **Errores esperados:** `TASKOPS_AUTOMATION_NOT_FOUND`, `TASKOPS_AUTOMATION_IN_PROGRESS`, `TASKOPS_UNAUTHORIZED`.
- **Idempotencia:** sí para reintentos con clave idempotente.

### 5.5 Lifecycle action request
- **Responsabilidad Campamento Base:** solicitar acciones operativas autorizadas (`refresh`, `retry`, `enable`, `disable`).
- **Responsabilidad TaskOps:** ejecutar acción y retornar estado/resultados.
- **Datos mínimos:** `tenantId`, `saasId`, `action`, `payload`, `requestedBy`, `requestId`.
- **Errores esperados:** `TASKOPS_ACTION_UNSUPPORTED`, `TASKOPS_ACTION_CONFLICT`, `TASKOPS_FORBIDDEN`.
- **Idempotencia:** por acción; mutables deben aceptar `idempotencyKey`.

### 5.6 Metrics/observability snapshot
- **Responsabilidad Campamento Base:** visualizar y gobernar KPIs de ejecución transversal.
- **Responsabilidad TaskOps:** exponer métricas acordadas (latencia, éxito/error, backlog, señales).
- **Datos mínimos:** `tenantId`, `saasId`, `window`, `metrics`, `generatedAt`.
- **Errores esperados:** `TASKOPS_METRICS_UNAVAILABLE`, `TASKOPS_TIMEOUT`.
- **Idempotencia:** sí (lectura).

### 5.7 Event reporting
- **Responsabilidad Campamento Base:** recibir eventos para timeline/observabilidad agregada.
- **Responsabilidad TaskOps:** emitir eventos normalizados de ejecución.
- **Datos mínimos:** `eventId`, `eventType`, `tenantId`, `saasId`, `occurredAt`, `payload`, `schemaVersion`.
- **Errores esperados:** `TASKOPS_EVENT_REJECTED`, `TASKOPS_EVENT_SCHEMA_MISMATCH`, `TASKOPS_UNAUTHORIZED`.
- **Idempotencia:** sí (deduplicación por `eventId`).

---

## 6. Suggested future endpoints or adapters

Posibles interfaces futuras (no implementadas en este bloque):

### 6.1 Internal endpoints
- `GET /api/internal/taskops/health`
- `GET /api/internal/taskops/operator/snapshot`
- `POST /api/internal/taskops/operator/actions`
- `POST /api/internal/taskops/events`

### 6.2 Internal client
- `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts`

### 6.3 Future namespace
- `src/lib/taskops/`

**Nota:** este bloque es solo contractual/documental. No se implementan endpoints, clientes ni namespace aquí.

---

## 7. Migration strategy

### Phase A — Contract only
- Crear y aprobar este documento.

### Phase B — TaskOps internal API/client design
- Diseñar endpoints internos y/o cliente neutral de control-plane.

### Phase C — Create `src/lib/taskops/` namespace
- Definir namespace transversal propio para lógica operativa TaskOps.

### Phase D — Replace `taskops-platform-service` legacy
- Sustituir dependencia legacy por cliente/contrato neutral.

### Phase E — Replace `taskops-platform` legacy
- Convertir wrapper legacy en adapter temporal compatible con contrato neutral.

### Phase F — Update `platform-bootstrap`
- Solo cuando Clinic y TaskOps estén desacoplados de legacy.

---

## 8. Non-goals

- No crear `src/lib/campamento-base/taskops-platform.ts` con lógica operativa.
- No mover runtime TaskOps.
- No tocar rutas.
- No tocar UI.
- No eliminar legacy todavía.
- No cambiar `platform-bootstrap` todavía.

---

## 9. First safe implementation block proposal

**Propuesta (sin implementación):**
`design taskops neutral control-plane client contract and compatibility tests`

### Objetivo
Definir contrato técnico + cliente interno neutral para Campamento Base ↔ TaskOps sin modificar runtime TaskOps actual.

### Archivos a crear
- `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts`
- `tests/lib/taskops-control-plane-internal-client.test.ts`

### Archivos a modificar
- `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md` (ajuste menor de versión/schema si aplica)

### Archivos que NO se deben tocar
- `src/lib/campobase/taskops-platform.ts`
- `src/lib/campobase/taskops-platform-service.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/tasks/*`
- `src/app/api/tasks/*`
- `src/app/*`
- `src/components/*`
- `migrations/*`

### Tests necesarios
- Unit tests del cliente interno (shape request/response)
- Tests de errores (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `TIMEOUT`, `CONFLICT`)
- Guardrail de namespace freeze

### Validaciones
- `pnpm typecheck`
- `npx vitest run tests/lib/taskops-control-plane-internal-client.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

### Rollback
- Revert de archivos de contrato/cliente/tests del bloque, sin impacto en runtime TaskOps legado.

### Por qué es el paso más seguro
- Desacopla ownership antes de mover código operativo.
- Evita contaminar Campamento Base con lógica transversal.
- Mantiene rollback simple y de bajo riesgo.
