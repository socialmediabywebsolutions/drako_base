# PLATFORM_BOOTSTRAP_BLOCKERS_CHECKPOINT

**Date:** 2026-06-07  
**Block:** `checkpoint platform-bootstrap blockers after socialflow edge reduction`  
**Scope:** inspección + documentación + validaciones (sin cambios productivos)

## 1) Estado actual (post SocialFlow edge reduction)

### 1.1 Import de SocialFlow ya reducido
En `src/lib/campobase/platform-bootstrap.ts` la carga dinámica de SocialFlow ya apunta al namespace canónico:

- `await import("@/lib/campamento-base/socialflow-platform")`

Esto elimina el edge legacy previo hacia `@/lib/campobase/socialflow-platform` dentro de `platform-bootstrap`.

### 1.2 Imports legacy que siguen en `platform-bootstrap`
En el mismo archivo siguen activos:

- `await import("@/lib/campobase/clinic-platform")`
- `await import("@/lib/campobase/taskops-platform")`

Estos dos imports son los blockers directos para la canonicalización completa de `platform-bootstrap`.

### 1.3 Confirmación de paridad SocialFlow canónico
`src/lib/campamento-base/socialflow-platform.ts` expone `socialFlowPlatformDefinition` y `socialFlowPlatformBootstrap` y mantiene comportamiento de bootstrap (connect) sobre módulos canónicos de Campamento Base.

## 2) Por qué Clinic y TaskOps no deben moverse dentro de Campamento Base

### 2.1 Clinic
Según `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md`:

- Clinic es un SaaS vertical independiente con dominio propio.
- Campamento Base debe actuar como control-plane/orquestador, no absorber lógica de producto Clinic.
- La migración objetivo es por contrato neutral (API/eventos/snapshots), no por traslado de runtime vertical a `src/lib/campamento-base/`.

### 2.2 TaskOps
Según `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md`:

- TaskOps es motor transversal (ejecución/automatización/workflows), no submódulo interno de Campamento Base.
- Campamento Base no debe incorporar lógica operativa TaskOps.
- La dirección objetivo es contrato neutral + eventual namespace propio `src/lib/taskops/`, no mover runtime a `src/lib/campamento-base/`.

## 3) Contratos ya existentes

Existen y permanecen vigentes:

- `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md`
- `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md`

Ambos fijan ownership, límites, capacidades contractuales y estrategia de migración por fases.

## 4) Qué falta para desbloquear `platform-bootstrap`

Para quitar el bloqueo remanente se requiere, en orden lógico:

1. Definir/estabilizar cliente(s) técnicos neutrales de control-plane para Clinic y/o TaskOps.
2. Reemplazar dependencias legacy de `clinic-platform-service` y `taskops-platform-service` por esas fronteras neutrales.
3. Convertir wrappers legacy (`clinic-platform.ts`, `taskops-platform.ts`) a adapters compatibles con contrato neutral.
4. Recién entonces mover/remover imports legacy restantes dentro de `src/lib/campobase/platform-bootstrap.ts`.

---

## 5) Evaluación de próximo bloque recomendado

### Opción A — Diseñar cliente/contrato técnico neutral para Clinic
- **Riesgo:** Bajo
- **Impacto:** Medio (reduce incertidumbre arquitectónica en vertical Clinic)
- **Archivos implicados:**
  - `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` (nuevo)
  - `tests/lib/clinic-control-plane-internal-client.test.ts` (nuevo)
  - `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md` (ajuste menor)
- **Tests necesarios:** unit del cliente, mapeo request/response, errores (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `TIMEOUT`), `campobase-namespace-freeze`.
- **Rollback:** Revert de cliente/test/doc; sin impacto de runtime productivo.

### Opción B — Diseñar cliente/contrato técnico neutral para TaskOps
- **Riesgo:** Bajo
- **Impacto:** Medio-Alto (prepara desacople de módulo transversal y camino a sacar service legacy)
- **Archivos implicados:**
  - `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts` (nuevo)
  - `tests/lib/taskops-control-plane-internal-client.test.ts` (nuevo)
  - `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md` (ajuste menor)
- **Tests necesarios:** unit del cliente, compatibilidad de shape, errores (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `TIMEOUT`, `CONFLICT`), `campobase-namespace-freeze`.
- **Rollback:** Revert de cliente/test/doc; sin impacto de runtime productivo.

### Opción C — Crear namespace `src/lib/taskops/`
- **Riesgo:** Medio-Alto
- **Impacto:** Alto (avance estructural real), pero con mayor superficie y chance de regresión.
- **Archivos implicados:** nuevos módulos `src/lib/taskops/*`, adapters legacy, posibles consumers/tests cruzados.
- **Tests necesarios:** unit + integración cross-saas (`task.overdue`), compatibilidad de bootstrap, `campobase-namespace-freeze`.
- **Rollback:** Más costoso (múltiples archivos y acoplamientos).

### Opción D — Congelar Clinic/TaskOps y priorizar otro import runtime `@/lib/campobase`
- **Riesgo:** Bajo
- **Impacto:** Medio en reducción global legacy, bajo para desbloquear `platform-bootstrap`.
- **Archivos implicados:** depende del import elegido fuera de este flujo.
- **Tests necesarios:** específicos del módulo elegido + `campobase-namespace-freeze`.
- **Rollback:** Simple si se limita a edge único.

### Opción E — Auditar imports runtime restantes a `@/lib/campobase` y elegir menor riesgo
- **Riesgo:** Muy bajo
- **Impacto:** Medio (mejora priorización y secuencia de migración con evidencia actualizada)
- **Archivos implicados:** documento de auditoría + (eventualmente) tests de guardrail si se endurece allowlist.
- **Tests necesarios:** `pnpm typecheck` + `campobase-namespace-freeze` + tests puntuales del edge seleccionado.
- **Rollback:** Trivial (documental).

## 6) Recomendación final

**Recomendación:** **Opción E** como siguiente paso inmediato de bajo riesgo (auditoría runtime restante), y luego ejecutar **Opción B** como primer bloque técnico de implementación.

Motivo:
- E minimiza riesgo y evita elegir a ciegas.
- B mantiene coherencia con el contrato TaskOps ya definido y prepara mejor el desbloqueo real de `platform-bootstrap` sin mover runtime prematuramente.
