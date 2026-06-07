# Campamento Base ↔ Clinic Orchestration Contract v1

**Version:** 1.0.0  
**Date:** 2026-06-07  
**Status:** DRAFT (Contract-only)  
**Scope:** Orchestration boundary between Campamento Base (control plane) and Clinic (vertical SaaS)

---

## 1. Purpose

Este contrato existe para:
- evitar meter lógica de producto Clinic dentro de Campamento Base,
- permitir que Campamento Base orqueste Clinic como SaaS vertical independiente,
- preparar separación real/futura de Clinic sin romper operación,
- sustituir gradualmente el legacy `src/lib/campobase/clinic-platform*` por interfaces neutrales.

---

## 2. Ownership rules

- **Campamento Base** = control plane, orquestación, observabilidad, lifecycle y gobierno operativo.
- **Clinic** = SaaS vertical independiente con dominio propio.
- Campamento Base **no debe importar** lógica interna de producto Clinic.
- Clinic **no debe depender** de internals legacy de Campobase.
- La comunicación objetivo entre capas se define vía contrato neutral:
  - API interna,
  - eventos,
  - health checks,
  - métricas/snapshots operativos.

---

## 3. Current legacy state

### 3.1 Legacy files actuales
- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/clinic-platform-service.ts`

### 3.2 Consumidores detectados
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/lib/saas-contract-definitions.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/lib/campobase-clinic-platform-service.test.ts`

### 3.3 Señales de vertical independiente (Clinic)
- `src/app/clinic/*`
- `src/app/api/clinic/*`
- `src/lib/clinic/*`
- `src/lib/site/clinic.ts`
- `/api/site/clinic/leads`
- plan comercial `drako_clinic_starter`

### 3.4 Lectura arquitectónica
- El wrapper legacy `clinic-platform.ts` está en capa de registro/orquestación legacy.
- El service legacy `clinic-platform-service.ts` contiene comportamiento funcional de Clinic (appointments health, bootstrap de integración/contexto).
- La evidencia actual posiciona Clinic como vertical de producto y no como submódulo interno de Campamento Base.

---

## 4. Boundary rules

- No mover lógica de producto Clinic a `src/lib/campamento-base/`.
- No crear nuevo código con nombre `campobase`.
- No crear nuevos imports hacia `@/lib/campobase`.
- Todo artefacto nuevo en Campamento Base para Clinic debe ser **neutral de orquestación/contrato**, no dominio Clinic.
- Namespace vertical recomendado para lógica Clinic: `src/lib/clinic/`.

---

## 5. Contract capabilities

Capacidades mínimas que Campamento Base puede solicitar a Clinic.

### 5.1 Health check
- **Responsabilidad Campamento Base:** consumir estado de salud y decidir alerting/escalado.
- **Responsabilidad Clinic:** exponer salud mínima operativa (ready/not-ready + razones).
- **Datos mínimos:** `tenantId`, `saasId`, `status`, `timestamp`, `checks[]`.
- **Errores esperados:** `CLINIC_UNAVAILABLE`, `CLINIC_UNAUTHORIZED`, `CLINIC_FORBIDDEN`, `CLINIC_TIMEOUT`.
- **Idempotencia:** sí (lectura).

### 5.2 Status/surface snapshot
- **Responsabilidad Campamento Base:** mostrar superficie operativa agregada (operator/control-plane).
- **Responsabilidad Clinic:** proveer snapshot consistente de automations/integrations/incidentes/resumen.
- **Datos mínimos:** `tenantId`, `saasId`, `automations[]`, `integrations[]`, `health`, `incidents[]`, `requestId`.
- **Errores esperados:** `CLINIC_SNAPSHOT_UNAVAILABLE`, `CLINIC_BAD_REQUEST`, `CLINIC_UNAUTHORIZED`.
- **Idempotencia:** sí (lectura).

### 5.3 Onboarding/provisioning status
- **Responsabilidad Campamento Base:** consultar estado de alta y readiness para operaciones.
- **Responsabilidad Clinic:** reportar progreso por etapas y bloqueos.
- **Datos mínimos:** `tenantId`, `saasId`, `stage`, `progress`, `blockingIssues[]`, `updatedAt`.
- **Errores esperados:** `CLINIC_ONBOARDING_NOT_FOUND`, `CLINIC_BAD_REQUEST`.
- **Idempotencia:** sí (lectura).

### 5.4 Metrics/observability snapshot
- **Responsabilidad Campamento Base:** consumir métricas para panel operator y reglas de gobernanza.
- **Responsabilidad Clinic:** exponer snapshot de métricas operativas acordadas por contrato.
- **Datos mínimos:** `tenantId`, `saasId`, `window`, `metrics`, `generatedAt`.
- **Errores esperados:** `CLINIC_METRICS_UNAVAILABLE`, `CLINIC_TIMEOUT`.
- **Idempotencia:** sí (lectura).

### 5.5 Lifecycle action request
- **Responsabilidad Campamento Base:** emitir acciones de ciclo de vida autorizadas (ej. refresh/retry/enable/disable).
- **Responsabilidad Clinic:** validar, ejecutar y responder resultado de acción.
- **Datos mínimos:** `tenantId`, `saasId`, `action`, `payload`, `requestedBy`, `requestId`.
- **Errores esperados:** `CLINIC_ACTION_UNSUPPORTED`, `CLINIC_ACTION_CONFLICT`, `CLINIC_UNAUTHORIZED`.
- **Idempotencia:** debe definirse por acción; preferible `idempotencyKey` en acciones mutables.

### 5.6 Integration validation
- **Responsabilidad Campamento Base:** disparar validaciones de integraciones y mostrar resultado.
- **Responsabilidad Clinic:** ejecutar validación de integración y retornar diagnóstico.
- **Datos mínimos:** `tenantId`, `saasId`, `integrationKey`, `ok`, `details`, `validatedAt`.
- **Errores esperados:** `CLINIC_INTEGRATION_NOT_FOUND`, `CLINIC_VALIDATION_FAILED`, `CLINIC_FORBIDDEN`.
- **Idempotencia:** sí para validación (misma entrada, mismo efecto).

### 5.7 Event reporting
- **Responsabilidad Campamento Base:** recibir eventos de Clinic para timeline/control-plane.
- **Responsabilidad Clinic:** emitir eventos normalizados del dominio acordado.
- **Datos mínimos:** `eventId`, `eventType`, `tenantId`, `saasId`, `occurredAt`, `payload`, `schemaVersion`.
- **Errores esperados:** `CLINIC_EVENT_REJECTED`, `CLINIC_EVENT_SCHEMA_MISMATCH`, `CLINIC_UNAUTHORIZED`.
- **Idempotencia:** sí (deduplicación por `eventId`).

---

## 6. Suggested future endpoints or adapters

Posibles interfaces futuras (no implementadas en este bloque):

### 6.1 Internal endpoints
- `GET /api/internal/clinic/health`
- `GET /api/internal/clinic/operator/snapshot`
- `POST /api/internal/clinic/operator/actions`
- `POST /api/internal/clinic/events`

### 6.2 Internal client
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`

**Nota:** este bloque es solo contractual/documental. No se implementan endpoints ni cliente aquí.

---

## 7. Migration strategy

### Phase A — Contract only
- Crear y aprobar este documento.

### Phase B — Clinic internal API/client design
- Diseñar endpoints internos neutrales y/o cliente interno neutral de control-plane.

### Phase C — Replace `clinic-platform-service` legacy
- Sustituir dependencia legacy por cliente/contrato neutral.

### Phase D — Replace `clinic-platform` legacy
- Convertir wrapper legacy en adapter temporal compatible con el contrato neutral.

### Phase E — Update `platform-bootstrap`
- Solo cuando Clinic y TaskOps estén desacoplados de legacy y con contrato neutral consolidado.

---

## 8. Non-goals

- No crear `src/lib/campamento-base/clinic-platform.ts` con lógica de producto.
- No mover runtime Clinic.
- No tocar rutas Clinic.
- No tocar UI Clinic.
- No eliminar legacy todavía.
- No cambiar `platform-bootstrap` todavía.

---

## 9. First safe implementation block proposal

**Propuesta (sin implementación):**
`design neutral clinic control-plane internal client contract and test harness`

### Objetivo
Definir contrato técnico y cliente interno neutral para Campamento Base ↔ Clinic sin mover lógica de producto Clinic.

### Archivos a crear
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` (cliente interno neutral, solo interfaz/shape)
- `tests/lib/clinic-control-plane-internal-client.test.ts` (contrato, errores y shape)

### Archivos a modificar
- `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md` (ajuste menor de versión si se concreta schema)

### Archivos que NO se deben tocar
- `src/lib/clinic/*`
- `src/app/clinic/*`
- `src/app/api/clinic/*`
- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/clinic-platform-service.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `migrations/*`

### Tests necesarios
- Unit tests del cliente interno (request/response mapping)
- tests de manejo de errores (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `TIMEOUT`)
- guardrail de namespace freeze

### Validaciones
- `pnpm typecheck`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

### Rollback
- Revert de archivos de contrato/cliente/tests del bloque (sin impacto en runtime productivo Clinic).

### Por qué es el paso más seguro
- Alinea ownership sin contaminar Campamento Base con dominio Clinic.
- Reduce incertidumbre arquitectónica antes de tocar legacy runtime.
- Mantiene rollback simple y bajo riesgo operativo.
