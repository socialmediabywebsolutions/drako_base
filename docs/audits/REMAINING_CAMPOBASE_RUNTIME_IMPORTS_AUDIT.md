# REMAINING_CAMPOBASE_RUNTIME_IMPORTS_AUDIT

**Date:** 2026-06-07  
**Block:** `audit remaining runtime campobase imports before next reduction`  
**Scope:** inspección + clasificación + priorización (sin cambios productivos)

## 1) Inventario runtime hacia `@/lib/campobase`

### 1.1 Criterio de búsqueda
- Incluido: `src/**/*.ts`, `src/**/*.tsx`.
- Excluido del conteo principal: tests, docs, scripts, comentarios, strings documentales.
- Separación explícita: imports dentro de `src/lib/campobase/*` se reportan aparte como **legacy congelado**.

### 1.2 Resultado resumido
- **Total edges runtime detectados:** **7**
- **Edges fuera de `src/lib/campobase/*` (candidatos reales de reducción):** **3**
- **Edges dentro de `src/lib/campobase/*` (legacy congelado / no tocar ahora):** **4**

## 2) Detalle por import runtime

### 2.1 Fuera de `src/lib/campobase/*` (prioritarios)

| Path origen | Import exacto | Módulo legacy usado | Capa | Equivalente canónico | Riesgo | Acción recomendada |
|---|---|---|---|---|---|---|
| `src/components/campobase/PlatformOperatorControlSurface.tsx` | `import type { PlatformOperatorSurface } from "@/lib/campobase/platform-operator-service";` | `platform-operator-service` (adapter legacy) | component | **Sí**: `@/lib/campamento-base/platform-operator-service` | low | migrar ahora |
| `src/components/campobase/CampoBaseSocialAutomationControl.tsx` | `import type { ... } from "@/lib/campobase/socialflow-service";` | `socialflow-service` (adapter legacy) | component | **Sí**: `@/lib/campamento-base/socialflow-control-plane-service` (también existe `@/lib/operator/socialflow-service`) | medium | auditar primero |
| `src/lib/operator/social-automation-history.ts` | `export * from "@/lib/campobase/social-automation-history";` | `social-automation-history` (runtime legacy real) | lib | **No directo** (no hay módulo canónico equivalente aún) | high | mantener bridge |

### 2.2 Dentro de `src/lib/campobase/*` (legacy congelado, separar/no tocar ahora)

| Path origen | Import exacto | Módulo legacy usado | Capa | Equivalente canónico | Riesgo | Acción recomendada |
|---|---|---|---|---|---|---|
| `src/lib/campobase/platform-bootstrap.ts` | `await import("@/lib/campobase/clinic-platform")` | `clinic-platform` | lib | No (bloqueado por contrato Clinic) | critical | esperar contrato |
| `src/lib/campobase/platform-bootstrap.ts` | `await import("@/lib/campobase/taskops-platform")` | `taskops-platform` | lib | No (bloqueado por contrato TaskOps) | critical | esperar contrato |
| `src/lib/campobase/clinic-platform.ts` | `from "@/lib/campobase/clinic-platform-service"` | `clinic-platform-service` | service/lib | No neutral client implementado aún | high | esperar contrato |
| `src/lib/campobase/taskops-platform.ts` | `from "@/lib/campobase/taskops-platform-service"` | `taskops-platform-service` | service/lib | No neutral client implementado aún | high | esperar contrato |

## 3) Clasificación por categorías solicitadas

### 3.1 Imports con equivalente canónico
- `src/components/campobase/PlatformOperatorControlSurface.tsx` → `platform-operator-service` canónico ya existe.
- `src/components/campobase/CampoBaseSocialAutomationControl.tsx` → `socialflow-control-plane-service` canónico ya existe (vía `campamento-base`/`operator`).

### 3.2 Relacionados con Clinic
- `src/lib/campobase/platform-bootstrap.ts` → `@/lib/campobase/clinic-platform`.
- `src/lib/campobase/clinic-platform.ts` → `@/lib/campobase/clinic-platform-service`.

### 3.3 Relacionados con TaskOps
- `src/lib/campobase/platform-bootstrap.ts` → `@/lib/campobase/taskops-platform`.
- `src/lib/campobase/taskops-platform.ts` → `@/lib/campobase/taskops-platform-service`.

### 3.4 Dentro de componentes visuales
- `src/components/campobase/PlatformOperatorControlSurface.tsx`.
- `src/components/campobase/CampoBaseSocialAutomationControl.tsx`.

### 3.5 Dentro de rutas bridge legacy
- **No se detectaron imports directos a `@/lib/campobase` dentro de `src/app/api/**`.**
- Existen bridges legacy de ruta (`src/app/api/campobase/*/route.ts`) pero re-exportan rutas operator; no agregan edge a `@/lib/campobase`.

### 3.6 Dentro de módulos legacy congelados
- `src/lib/campobase/platform-bootstrap.ts` (2 imports).
- `src/lib/campobase/clinic-platform.ts` (1 import).
- `src/lib/campobase/taskops-platform.ts` (1 import).

### 3.7 Riesgo bajo y migración 1:1 posible
- `src/components/campobase/PlatformOperatorControlSurface.tsx` (type import, servicio canónico ya consolidado).

## 4) Top 3 candidatos más seguros para siguiente bloque

## Candidate 1
- **Path:** `src/components/campobase/PlatformOperatorControlSurface.tsx`
- **Import legacy actual:** `@/lib/campobase/platform-operator-service`
- **Equivalente canónico/estrategia:** cambiar a `@/lib/campamento-base/platform-operator-service` (1:1, type-only).
- **Archivos a tocar:**
  - `src/components/campobase/PlatformOperatorControlSurface.tsx`
  - (opcional) test de contrato UI/operator si existe cobertura de import path.
- **Tests necesarios:**
  - `pnpm typecheck`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - test puntual del surface operator (si existe).
- **Rollback:** revert de 1 archivo.
- **Por qué es seguro/no:** seguro (canónico existente, adapter legacy ya estable, cambio superficial de tipo).

## Candidate 2
- **Path:** `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
- **Import legacy actual:** `@/lib/campobase/socialflow-service`
- **Equivalente canónico/estrategia:** cambiar a `@/lib/operator/socialflow-service` (bridge canónico) o directo a `@/lib/campamento-base/socialflow-control-plane-service`.
- **Archivos a tocar:**
  - `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
- **Tests necesarios:**
  - `pnpm typecheck`
  - test puntual del control socialflow (si existe)
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- **Rollback:** revert de 1 archivo.
- **Por qué es seguro/no:** razonablemente seguro, pero en componente visual (riesgo medio por tipados/UX indirecta).

## Candidate 3
- **Path:** `src/lib/operator/social-automation-history.ts`
- **Import legacy actual:** `@/lib/campobase/social-automation-history`
- **Equivalente canónico/estrategia:** no hay equivalente canónico directo; requeriría definir módulo neutral/canónico antes de migrar.
- **Archivos a tocar (si se abordara):**
  - `src/lib/operator/social-automation-history.ts`
  - nuevo módulo destino (a definir)
  - tests de historial social automation.
- **Tests necesarios:**
  - unit/integration del historial
  - `pnpm typecheck`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- **Rollback:** moderado (más de un archivo si se crea destino nuevo).
- **Por qué es seguro/no:** **no es el más seguro hoy** (no existe paridad canónica 1:1 aún).

## 5) Qué NO debe tocarse todavía (blockers)

- **Clinic**: requiere contrato/cliente neutral antes de tocar `clinic-platform-service` y su edge en `platform-bootstrap`.
- **TaskOps**: requiere contrato/cliente neutral antes de tocar `taskops-platform-service` y su edge en `platform-bootstrap`.
- **Componentes visuales**: cualquier cambio debe ser mínimo y validado, porque pueden introducir regresiones UX (especialmente en bloques operator).
- **Rutas bridge legacy**: mantener estables mientras sigan protegidas por tests/contrato; no son el cuello de botella principal del runtime import audit.
- **`platform-bootstrap`**: no tocar mientras dependa de Clinic/TaskOps legacy.

## 6) Recomendación final del siguiente bloque

**Siguiente bloque técnico más seguro:**
1. Migrar primero **Candidate 1** (`PlatformOperatorControlSurface` → import canónico de `platform-operator-service`) por ser 1:1 y low risk.
2. Luego evaluar **Candidate 2** en bloque separado.
3. Dejar **Candidate 3** para una etapa posterior con diseño de destino canónico explícito.
