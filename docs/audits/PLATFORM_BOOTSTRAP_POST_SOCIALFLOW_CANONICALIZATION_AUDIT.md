# Platform Bootstrap Post-SocialFlow Canonicalization Audit

**Fecha:** 2026-06-07  
**Bloque:** `audit platform-bootstrap blockers after socialflow-platform canonicalization`  
**Tipo:** inspección reducida (sin cambios de código productivo)

---

## 1) Estado actual de `platform-bootstrap`

### Archivos inspeccionados
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/campamento-base/socialflow-platform.ts`
- `src/lib/campobase/socialflow-platform.ts`
- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/taskops-platform.ts`

### Imports actuales de `src/lib/campobase/platform-bootstrap.ts`
- `@/lib/saas-contract` (estáticos)
- `@/lib/campobase/socialflow-platform` (dynamic import)
- `@/lib/campobase/clinic-platform` (dynamic import)
- `@/lib/campobase/taskops-platform` (dynamic import)

### ¿Sigue importando `@/lib/campobase/socialflow-platform`?
- **Sí.**

### ¿Ya puede apuntar a `@/lib/campamento-base/socialflow-platform`?
- **Sí, técnicamente.**
- Razón: existe `src/lib/campamento-base/socialflow-platform.ts` canónico y `src/lib/campobase/socialflow-platform.ts` ya es adapter temporal.

### Imports legacy que siguen bloqueando la canonicalización completa
- `@/lib/campobase/clinic-platform`
- `@/lib/campobase/taskops-platform`
- Además, ambos módulos arrastran dependencias legacy internas:
  - `clinic-platform` -> `@/lib/campobase/clinic-platform-service`
  - `taskops-platform` -> `@/lib/campobase/taskops-platform-service`

### Comportamiento que debe mantenerse
- Registro lazy único de definiciones/bootstraps por `defaultsRegistered`.
- Registro de 3 plataformas (`socialflow`, `clinic`, `taskops`) en `saas-contract`.
- Helpers públicos:
  - `registerSocialFlowPlatform`
  - `registerClinicPlatform`
  - `registerTaskOpsPlatform`
  - `loadPlatformForSaas`
- Resolución por `matchesSaasId`/`saasId` y ejecución de `bootstrap.connect({ tenantId, saasId })`.

### ¿Puede canonizarse parcialmente `platform-bootstrap`?
- **Parcialmente sí** (solo reducir dependencia legacy de SocialFlow en el archivo legacy actual).
- **Canonicalización completa no** (mientras Clinic y TaskOps no tengan módulos canónicos equivalentes sin imports a `@/lib/campobase/*`).

---

## 2) Blockers por módulo

| Módulo | Estado | Path canónico | Path legacy | ¿Bloquea `platform-bootstrap`? | Riesgo | Acción recomendada |
|---|---|---|---|---|---|---|
| `socialflow-platform` | canónico + adapter legacy | `src/lib/campamento-base/socialflow-platform.ts` | `src/lib/campobase/socialflow-platform.ts` (adapter) | bloquea solo por referencia legacy aún existente en `platform-bootstrap` | low | migrar import de `platform-bootstrap` al canónico |
| `clinic-platform` | legacy pendiente | no existe | `src/lib/campobase/clinic-platform.ts` | sí | high | preparar y crear canónico de Clinic antes de `platform-bootstrap` canónico |
| `taskops-platform` | legacy pendiente | no existe | `src/lib/campobase/taskops-platform.ts` | sí | high/critical | preparar canónico TaskOps en bloque dedicado (por signalHandlers/automation) |

---

## 3) Evaluación de opciones

### Opción A
**Actualizar solo `src/lib/campobase/platform-bootstrap.ts` para usar el `socialflow-platform` canónico, sin crear aún `platform-bootstrap` canónico.**

- **Riesgo:** low
- **Impacto:** medium (reduce 1 edge legacy real y prepara siguiente etapa)
- **Archivos implicados:**
  - `src/lib/campobase/platform-bootstrap.ts`
  - tests puntuales de bootstrap/contrato/freeze
- **Tests necesarios:**
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- **Rollback:** revert de un archivo + tests si aplica
- **Evaluación:** mejor siguiente paso seguro inmediato

### Opción B
**Canonizar `clinic-platform.ts` primero.**

- **Riesgo:** high
- **Impacto:** high (desbloquea parte crítica de bootstrap)
- **Archivos implicados:**
  - nuevo `src/lib/campamento-base/clinic-platform.ts`
  - adapter `src/lib/campobase/clinic-platform.ts`
  - probablemente bloque previo para servicio canónico equivalente
- **Tests necesarios:**
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - tests de clinic bootstrap/service
  - freeze
- **Rollback:** posible, pero más superficie
- **Evaluación:** recomendable después de A, no como primer siguiente bloque

### Opción C
**Canonizar `taskops-platform.ts` primero.**

- **Riesgo:** high/critical
- **Impacto:** high, pero con mayor riesgo operativo
- **Archivos implicados:**
  - nuevo `src/lib/campamento-base/taskops-platform.ts`
  - adapter legacy taskops
  - coordinación con dependencia service legacy y signalHandlers
- **Tests necesarios:**
  - `tests/lib/cross-saas-taskops-flow.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - freeze
- **Rollback:** más costoso por lógica de señales
- **Evaluación:** no recomendado como siguiente inmediato

### Opción D
**Esperar y crear interfaces compartidas antes de tocar Clinic/TaskOps.**

- **Riesgo:** low inmediato
- **Impacto:** low inmediato / medium de deuda si se extiende
- **Archivos implicados:** docs/contratos previos
- **Tests necesarios:** mínimos
- **Rollback:** trivial
- **Evaluación:** válida si prioridad es riesgo cero; retrasa reducción legacy

### Opción E
**Crear `platform-bootstrap` canónico parcial solo si no importa `@/lib/campobase/*`.**

- **Riesgo:** medium/high
- **Impacto:** incierto
- **Archivos implicados:** nuevo `src/lib/campamento-base/platform-bootstrap.ts` incompleto o divergente
- **Tests necesarios:** bootstrap + contrato + freeze + compatibilidad funcional
- **Rollback:** posible pero con riesgo de semántica distinta
- **Evaluación:** no recomendado ahora; alto riesgo de cambiar comportamiento o dejar bootstrap incompleto

### Recomendación final
1. **Siguiente bloque seguro: Opción A** (migrar solo import de SocialFlow en `platform-bootstrap` legacy hacia canónico).  
2. Después, bloque dedicado para **Clinic**.  
3. Luego bloque dedicado para **TaskOps**.  
4. Recién entonces crear `platform-bootstrap` canónico completo.

---

## 4) Conclusión

- `platform-bootstrap` **sigue bloqueado** para canonicalización completa.
- SocialFlow ya está preparado en canónico; el bloqueo real restante está en Clinic + TaskOps.
- Existe un siguiente paso incremental seguro (Opción A) que reduce legacy sin tocar runtime de Clinic/TaskOps.
