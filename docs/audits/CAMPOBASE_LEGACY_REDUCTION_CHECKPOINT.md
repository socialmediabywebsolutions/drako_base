# CAMPOBASE Legacy Reduction Checkpoint

**Fecha:** 2026-06-07  
**Tipo:** Checkpoint de reducción legacy (solo inspección)  
**Ámbito:** `@/lib/campobase`, `src/lib/campobase`, `/api/campobase`, `src/app/api/campobase`  
**Cambios en producción:** ninguno

---

## 1) Inventario actual de legacy Campobase

### 1.1 Imports runtime hacia `@/lib/campobase`

**Resultado:** 9 referencias en 7 archivos de `src/`.

**Paths principales**
- `src/lib/operator/social-automation-history.ts` (re-export legacy)
- `src/lib/campobase/taskops-platform.ts`
- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/platform-bootstrap.ts` (3 imports dinámicos)
- `src/lib/campobase/socialflow-platform.ts`
- `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
- `src/components/campobase/PlatformOperatorControlSurface.tsx`

**Riesgo:** medio (acoplamiento residual en runtime, especialmente bootstrap/plataformas legacy).  
**Acción recomendada:** reducir primero en `lib` no visual y mantener componentes para etapa posterior.

---

### 1.2 Imports en tests hacia `@/lib/campobase`

**Resultado:** 20 referencias en 11 archivos de `tests/`.

**Paths principales**
- `tests/components/campobase-social-page.test.tsx`
- `tests/components/operator-socialflow-health-panel.test.tsx`
- `tests/lib/campobase-*.test.ts` (familia legacy)
- `tests/lib/saas-contract-definitions.test.ts`
- `tests/lib/factory-orchestrator.test.ts`
- `tests/lib/cross-saas-taskops-flow.test.ts`

**Riesgo:** bajo/medio (principalmente cobertura de compatibilidad).  
**Acción recomendada:** migrar tests no-compat a canónico cuando exista equivalente; mantener tests explícitos de compat legacy.

---

### 1.3 Rutas API legacy `src/app/api/campobase/*`

**Resultado:** 2 rutas.

**Lista**
- `src/app/api/campobase/platform/route.ts`
- `src/app/api/campobase/socialflow/route.ts`

**Estado:** ambas son bridges legacy puros (re-export a operator canónico).  
**Riesgo:** medio si se tocan sin telemetría de sunset.  
**Acción recomendada:** mantener bridge + contrato bloqueado por test.

---

### 1.4 Tests legacy con nombre `campobase`

**Resultado:** 11 archivos.

**Lista principal**
- `tests/api/campobase-platform-route.test.ts`
- `tests/api/campobase-socialflow-route.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- `tests/components/campobase-platform-page.test.tsx`
- `tests/components/campobase-social-page.test.tsx`
- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/lib/campobase-social-automation-history.test.ts`
- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/lib/campobase-socialflow-service.test.ts`
- `tests/lib/campobase-taskops-platform-service.test.ts`

**Riesgo:** bajo/medio (muchos son parte de compatibilidad heredada).  
**Acción recomendada:** mantener los de compatibilidad; migrar gradualmente los que validan comportamiento ya canónico.

---

### 1.5 Docs/config/scripts que mencionan compat legacy

**Resultado:** núcleo de compat con 26 referencias en 6 archivos clave (más tests/readiness asociados).

**Archivos clave**
- `docs/config/control-plane-route-inventory.json`
- `docs/config/control-plane-separation-audit.json`
- `docs/config/legacy-alias-deprecation-matrix.json`
- `docs/architecture/legacy-alias-sunset-decision-pack.md`
- `docs/audits/production-readiness-latest.json`
- `scripts/check-production-readiness.ts`

**Riesgo:** bajo funcional / alto de gobernanza (si se desalinea inventario vs runtime).  
**Acción recomendada:** no tocar sin cambio real de compat/sunset; actualizar solo junto al commit de migración aprobado.

---

## 2) Confirmación de migraciones ya hechas

Estado verificado: **completado**

1. `src/lib/campobase/socialflow-service.ts` -> adapter temporal (re-export canónico).  
2. `src/lib/campamento-base/socialflow-control-plane-service.ts` -> servicio canónico creado.  
3. `src/lib/campamento-base/orchestrator/snapshot-db.ts` -> migrado a servicio canónico.  
4. `src/lib/operator/socialflow-service.ts` -> migrado a servicio canónico (re-export canónico).  
5. `src/app/api/operator/socialflow/route.ts` -> usa servicio canónico.  
6. `src/lib/campobase/platform-operator-service.ts` -> adapter temporal.  
7. `src/lib/campamento-base/platform-operator-service.ts` -> servicio canónico creado.  
8. `src/app/api/operator/platform/route.ts` -> usa servicio canónico.  
9. `src/app/api/campobase/platform/route.ts` -> protegido como bridge legacy.  
10. `src/app/api/campobase/socialflow/route.ts` -> protegido como bridge legacy.

---

## 3) Estado de guardrails existentes

### `tests/architecture/campobase-namespace-freeze.test.ts`
- **Protege:** congelación de imports `@/lib/campobase` por allowlist.
- **Reduce legacy:** sí (bloquea crecimiento accidental).
- **Mantiene compatibilidad:** sí (allowlist explícita).
- **Riesgo cubierto:** reintroducción silenciosa de dependencias legacy.

### `tests/api/operator-platform-legacy-bridge-contract.test.ts`
- **Protege:** bridge `/api/campobase/platform` sin lógica propia y delegación canónica.
- **Reduce legacy:** sí (fuerza delegación limpia).
- **Mantiene compatibilidad:** sí (preserva endpoint legacy).
- **Riesgo cubierto:** regresión del bridge o import legacy no permitido.

### `tests/api/operator-socialflow-legacy-bridge-contract.test.ts`
- **Protege:** bridge `/api/campobase/socialflow` sin lógica propia y delegación canónica.
- **Reduce legacy:** sí.
- **Mantiene compatibilidad:** sí.
- **Riesgo cubierto:** desvío del bridge legacy.

### `tests/lib/campamento-base-socialflow-control-plane-service.test.ts`
- **Protege:** servicio canónico socialflow sin imports legacy/prohibidos.
- **Reduce legacy:** sí.
- **Mantiene compatibilidad:** sí (shape legacy-compatible en resultados).
- **Riesgo cubierto:** acoplamiento al contrato legacy socialflow.

### `tests/lib/campamento-base-platform-operator-service.test.ts`
- **Protege:** servicio canónico platform operator y adapter legacy intacto.
- **Reduce legacy:** sí.
- **Mantiene compatibilidad:** sí.
- **Riesgo cubierto:** fallback accidental al namespace legacy.

### `tests/lib/campamento-base-snapshot-db-socialflow-dependency.test.ts`
- **Protege:** snapshot-db usa servicio canónico socialflow.
- **Reduce legacy:** sí.
- **Mantiene compatibilidad:** sí (adapter legacy sigue presente).
- **Riesgo cubierto:** dependencia residual en adapter legacy desde snapshot.

### `tests/lib/operator-socialflow-service-canonical-dependency.test.ts`
- **Protege:** `src/lib/operator/socialflow-service.ts` depende del canónico.
- **Reduce legacy:** sí.
- **Mantiene compatibilidad:** sí.
- **Riesgo cubierto:** retorno a `@/lib/campobase/socialflow-service`.

---

## 4) Próximos 5 candidatos seguros

> Priorizados evitando tocar componentes visuales en esta fase.

### 1) `src/lib/campobase/socialflow-platform.ts`
- **Tipo:** lib
- **Legacy actual:** `await import("@/lib/campobase/socialflow-service")`
- **Equivalente canónico:** `@/lib/campamento-base/socialflow-control-plane-service`
- **Riesgo:** bajo
- **Test necesario:** `tests/lib/campobase-platform-bootstrap.test.ts` + freeze
- **Recomendación:** **migrar ahora**

### 2) `src/lib/operator/social-automation-history.ts`
- **Tipo:** lib
- **Legacy actual:** re-export desde `@/lib/campobase/social-automation-history`
- **Equivalente canónico:** no explícito aún
- **Riesgo:** medio
- **Test necesario:** nuevo test canónico de dependencia + pruebas de historial social
- **Recomendación:** **auditar primero**

### 3) `src/lib/campobase/platform-bootstrap.ts`
- **Tipo:** lib
- **Legacy actual:** imports dinámicos de módulos `@/lib/campobase/*-platform`
- **Equivalente canónico:** parcial/no consolidado
- **Riesgo:** medio-alto (loader transversal)
- **Test necesario:** `tests/lib/campobase-platform-bootstrap.test.ts` + `tests/lib/saas-contract-definitions.test.ts`
- **Recomendación:** **auditar primero**

### 4) `src/lib/campobase/clinic-platform.ts`
- **Tipo:** lib
- **Legacy actual:** import de `@/lib/campobase/clinic-platform-service`
- **Equivalente canónico:** no detectado
- **Riesgo:** medio
- **Test necesario:** `tests/lib/campobase-clinic-platform-service.test.ts`
- **Recomendación:** **mantener bridge** hasta crear equivalente canónico

### 5) `src/lib/campobase/taskops-platform.ts`
- **Tipo:** lib
- **Legacy actual:** import de `@/lib/campobase/taskops-platform-service`
- **Equivalente canónico:** no detectado
- **Riesgo:** medio
- **Test necesario:** `tests/lib/campobase-taskops-platform-service.test.ts` + `tests/lib/cross-saas-taskops-flow.test.ts`
- **Recomendación:** **esperar telemetría** / contrato canónico previo

---

## 5) Candidatos que NO deben tocarse todavía

1. `src/app/api/campobase/platform/route.ts`  
   - Bridge legacy aceptado y protegido por contrato.

2. `src/app/api/campobase/socialflow/route.ts`  
   - Bridge legacy aceptado y protegido por contrato.

3. `docs/config/legacy-alias-deprecation-matrix.json`  
   - Fuente de verdad de sunset/compat; no editar sin cambio aprobado de ciclo.

4. `docs/config/control-plane-route-inventory.json` y `docs/config/control-plane-separation-audit.json`  
   - Inventario/auditoría de control plane; tocar solo con cambio de runtime real.

5. `scripts/check-production-readiness.ts` y `tests/production-readiness.test.ts`  
   - Guardrails operativos de compatibilidad; no tocar sin plan de rollout.

6. `tests/api/campobase-platform-route.test.ts` y `tests/api/campobase-socialflow-route.test.ts`  
   - Cobertura de compat legacy activa; deben permanecer mientras exista alias.

7. Componentes visuales `src/components/campobase/*`  
   - Dependencia UX/estado de interfaz aún no auditada para migración segura.

---

## 6) Validaciones ejecutadas para este checkpoint

Comandos requeridos:
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `npx vitest run tests/api/operator-platform-legacy-bridge-contract.test.ts`
- `npx vitest run tests/api/operator-socialflow-legacy-bridge-contract.test.ts`

> Resultado: ver sección de conclusión (todos OK).

---

## 7) Siguiente commit recomendado (NO implementado)

**Commit propuesto:**  
`refactor(legacy): point socialflow legacy platform bootstrap to canonical control-plane service`

**Objetivo**
- Reducir 1 dependencia runtime a `@/lib/campobase` con rollback simple.

**Archivos a tocar**
- `src/lib/campobase/socialflow-platform.ts` (cambio mínimo de import dinámico hacia canónico)
- `tests/architecture/campobase-namespace-freeze.test.ts` (shrink controlado de allowlist)

**Archivos que NO se deben tocar**
- `src/app/api/campobase/*`
- `src/app/api/operator/*`
- `src/components/*`
- `src/lib/mentoria/*`
- `src/lib/clinic/*`
- `src/lib/socialflow/*`
- `migrations/*`

**Tests necesarios**
- `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
- `npx vitest run tests/lib/saas-contract-definitions.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

**Validaciones**
- `pnpm typecheck`
- vitest puntual de los tests listados.

**Rollback**
- revert de `src/lib/campobase/socialflow-platform.ts` + ajuste allowlist.

**Por qué es el paso más seguro**
- Impacto acotado a un import dinámico en un archivo legacy existente.
- No toca rutas públicas ni componentes visuales.
- Tiene cobertura directa de bootstrap + contrato + freeze.

---

## 8) Conclusión obligatoria

- **Archivo creado:** sí  
- **Ruta exacta:** `docs/audits/CAMPOBASE_LEGACY_REDUCTION_CHECKPOINT.md`
- **Imports runtime actuales hacia `@/lib/campobase`:** 9 referencias en 7 archivos (lista en 1.1)
- **Rutas `src/app/api/campobase/*` actuales:** 2 (`platform`, `socialflow`)
- **Bridges legacy protegidos:** 2 (`src/app/api/campobase/platform/route.ts`, `src/app/api/campobase/socialflow/route.ts`)
- **Servicios canónicos creados:** 2 principales (`src/lib/campamento-base/socialflow-control-plane-service.ts`, `src/lib/campamento-base/platform-operator-service.ts`)
- **Consumidores migrados verificados:** 4
  - `src/lib/campamento-base/orchestrator/snapshot-db.ts`
  - `src/lib/operator/socialflow-service.ts`
  - `src/app/api/operator/socialflow/route.ts`
  - `src/app/api/operator/platform/route.ts`
- **Guardrails activos (checkpoint):** 7
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - `tests/api/operator-platform-legacy-bridge-contract.test.ts`
  - `tests/api/operator-socialflow-legacy-bridge-contract.test.ts`
  - `tests/lib/campamento-base-socialflow-control-plane-service.test.ts`
  - `tests/lib/campamento-base-platform-operator-service.test.ts`
  - `tests/lib/campamento-base-snapshot-db-socialflow-dependency.test.ts`
  - `tests/lib/operator-socialflow-service-canonical-dependency.test.ts`
- **Próximos candidatos seguros:** ver sección 4 (5 candidatos priorizados)
- **Validaciones ejecutadas y resultado:** ver sección 6 (todos OK)
- **¿Se puede continuar reduciendo legacy?:** sí, de forma incremental y con guardrails
- **Siguiente commit recomendado (sin implementarlo):** `refactor(legacy): point socialflow legacy platform bootstrap to canonical control-plane service`
