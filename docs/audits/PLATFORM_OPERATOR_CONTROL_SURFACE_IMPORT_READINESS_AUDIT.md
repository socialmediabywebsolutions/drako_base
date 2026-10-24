# PLATFORM_OPERATOR_CONTROL_SURFACE_IMPORT_READINESS_AUDIT

**Date:** 2026-06-07  
**Block:** `audit platform operator control surface canonical import readiness`  
**Scope:** inspección reducida para readiness de import canónico (sin cambios productivos)

## 1) Inspección del componente y servicios

### 1.1 Import legacy actual detectado
En `src/components/campobase/PlatformOperatorControlSurface.tsx` existe:

- `import type { PlatformOperatorSurface } from "@/lib/campobase/platform-operator-service";`

Conclusión:
- Sí, el import legacy apunta exactamente a `platform-operator-service`.
- Es **type-only import**.

### 1.2 Qué usa realmente el componente
El componente usa únicamente el tipo `PlatformOperatorSurface` para:
- estado local (`useState<PlatformOperatorSurface | null>`),
- shape de respuesta (`SurfaceResponse.surface?: PlatformOperatorSurface`).

No llama funciones del servicio en runtime desde el componente.
El runtime del componente consume `fetch` a:
- `GET /api/operator/platform`
- `POST /api/operator/platform`

### 1.3 Paridad canónica
`src/lib/campamento-base/platform-operator-service.ts` exporta `PlatformOperatorSurface`.

`src/lib/campobase/platform-operator-service.ts` es adapter temporal con:
- `export * from "@/lib/campamento-base/platform-operator-service";`

Conclusión de paridad:
- El tipo viene del canónico vía adapter.
- Migrar import del componente a canónico es **1:1** en shape/tipos.

### 1.4 Impacto esperado (import vs runtime)
- Cambio esperado: solo referencia de import de tipo.
- Runtime UI: no debería cambiar, porque el componente no ejecuta servicio local; usa API `/api/operator/platform`.
- Riesgo UI/UX: **low** (acotado a compilación/tipado).

## 2) Tests relacionados detectados

### 2.1 Tests directos del componente
1. `tests/components/campobase-platform-page.test.tsx`
   - **Qué cubre:** render, carga inicial, submit del formulario inspect, acciones operator (`run_automation`, `validate_integration`), payloads de fetch.
   - **¿Habría que ajustarlo?:** en principio **no** para un cambio 1:1 de type import.
   - **Riesgo:** low.

### 2.2 Guardrail de namespace
2. `tests/architecture/campobase-namespace-freeze.test.ts`
   - **Qué cubre:** allowlist congelada de edges `@/lib/campobase`.
   - **¿Habría que ajustarlo?:** **sí**, si se migra este import debe removerse este edge:
     - `src/components/campobase/PlatformOperatorControlSurface.tsx::@/lib/campobase/platform-operator-service`
     y actualizar tamaño pinned de allowlist.
   - **Riesgo:** medium (si no se ajusta, falla el test).

### 2.3 Tests de contrato relacionados al servicio/ruta operator
3. `tests/api/campobase-platform-route.test.ts`
   - **Qué cubre:** ruta operator usa servicio canónico y adapter legacy se mantiene.
   - **¿Habría que ajustarlo?:** no necesariamente.
   - **Riesgo:** low.

4. `tests/api/operator-platform-legacy-bridge-contract.test.ts`
   - **Qué cubre:** bridge legacy de ruta y adapter legacy de platform operator service.
   - **¿Habría que ajustarlo?:** no para este cambio puntual del componente.
   - **Riesgo:** low.

## 3) Evaluación de opciones

### Opción A — Migrar componente directamente (1:1)
- **Riesgo:** low
- **Archivos a tocar:**
  - `src/components/campobase/PlatformOperatorControlSurface.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts` (allowlist shrink)
- **Tests necesarios:**
  - `pnpm typecheck`
  - `npx vitest run tests/components/campobase-platform-page.test.tsx`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- **Validaciones:** las anteriores + verificación puntual del edge removido.
- **Rollback:** revert de 1-2 archivos.
- **Lectura:** bloque corto y seguro.

### Opción B — Crear test estático primero, migrar después
- **Riesgo:** low-medium
- **Archivos a tocar:** nuevo test estático + luego los de Opción A.
- **Tests necesarios:** los de Opción A + nuevo test.
- **Validaciones:** mismas, con más superficie.
- **Rollback:** simple pero más ruido en historial.
- **Lectura:** agrega seguridad, pero puede ser sobrecarga para un cambio de tipo 1:1.

### Opción C — No tocar componente todavía
- **Riesgo:** low (inmediato)
- **Archivos a tocar:** ninguno.
- **Tests necesarios:** ninguno adicional.
- **Validaciones:** no aporta reducción de edge.
- **Rollback:** n/a.
- **Lectura:** conserva deuda legacy existente y retrasa reducción de bajo riesgo.

## 4) Recomendación final

**Recomendación:** **Opción A**.

Motivo:
- Import actual es type-only y el canónico exporta el mismo tipo vía paridad exacta.
- No toca runtime de API ni lógica de servicio.
- Permite reducción real del edge legacy con rollback simple.
- Único punto sensible es actualizar correctamente el `campobase-namespace-freeze` al reducir allowlist.

## 5) Decisión de readiness

- ¿El componente puede migrarse 1:1?: **Sí**.
- Import legacy actual: `@/lib/campobase/platform-operator-service`.
- Equivalente canónico: `@/lib/campamento-base/platform-operator-service`.
- Tipo de cambio: import/type-level (sin cambio de comportamiento esperado de UI).
