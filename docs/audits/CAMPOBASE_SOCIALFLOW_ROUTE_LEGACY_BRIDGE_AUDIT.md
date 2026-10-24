# CAMPOBASE SocialFlow Route Legacy Bridge Audit

**Fecha:** 2026-06-07  
**Tipo:** Auditoría reducida (solo inspección)  
**Alcance:** `src/app/api/campobase/socialflow/route.ts`  
**Cambios en producción:** ninguno

---

## 1) Inspección de la route legacy

**Archivo auditado:** `src/app/api/campobase/socialflow/route.ts`  
**Existe:** sí

Contenido actual:

```ts
// LEGACY_CAMPOBASE_COMPAT_ROUTE: keep as operator-only bridge, not as a new canonical entrypoint.
export { dynamic, GET, POST } from "@/app/api/operator/socialflow/route";
```

### Hallazgos
- **Métodos exportados:** `dynamic`, `GET`, `POST` (re-export).
- **Imports propios de la route legacy:** ninguno; solo re-export.
- **¿Importa desde `@/lib/campobase`?:** no.
- **¿Apunta a route canónica?:** sí, delega a `@/app/api/operator/socialflow/route`.
- **¿Es bridge/alias/delegación?:** sí, bridge legacy puro.
- **¿Tiene lógica propia?:** no.

### Response shape vigente (heredada de la route operator)
La route legacy no define shape propio; hereda la de `src/app/api/operator/socialflow/route.ts`:
- **GET (éxito):** `{ status, history, summary, observability }`
- **POST (acción `run_all`, `run_one`, `register`, `register_health`, `enable`, `disable`):** `{ action, result, status }`
- **POST (acción `refresh_observability`, `linkedin_health_check`, `recover_stale_publishing`, `retry_failed_posts`):** `{ action, result, status, observability }`
- **Errores de auth:** `{ code: "UNAUTHORIZED", message }` con status de `UnauthorizedError`.
- **Errores de acción/negocio:** objetos con `{ code, message }` y status resuelto por `resolveActionError`.

### Riesgos de tocarla ahora
- Riesgo de romper compatibilidad de clientes legacy que aún llamen `/api/campobase/socialflow`.
- Riesgo de divergencia con route operator si se introduce lógica local en la legacy.
- Riesgo de desalinear controles de readiness/inventario de alias (`LEGACY_COMPAT_ACCEPTED`).
- Riesgo bajo si se mantiene exactamente como bridge por re-export.

---

## 2) Tests/referencias relacionadas

Búsqueda enfocada en:
- `src/app/api/campobase/socialflow/route.ts`
- `/api/campobase/socialflow`
- `campobase/socialflow`

| Path | Tipo | Qué valida/consume | Riesgo |
|---|---|---|---|
| `tests/api/campobase-socialflow-route.test.ts` | test | Cubre GET/POST y shape de `/api/campobase/socialflow`; importa la route legacy. | Alto |
| `tests/production-readiness.test.ts` | test | Espera `src/app/api/campobase/socialflow/route.ts` en superficie de compat. | Medio |
| `scripts/check-production-readiness.ts` | script | Verifica presencia de route legacy en checklist de compatibilidad. | Medio |
| `docs/config/control-plane-route-inventory.json` | docs/config | Inventario: `/api/campobase/socialflow` clasificada como `LEGACY_COMPAT`. | Bajo/Medio |
| `docs/config/control-plane-separation-audit.json` | docs/config | Mapea alias legacy a canonical target `/api/operator/socialflow`. | Bajo/Medio |
| `docs/config/legacy-alias-deprecation-matrix.json` | docs/config | Marca route como `LEGACY_CAMPOBASE_ALIAS` y `LEGACY_COMPAT_ACCEPTED`. | Bajo/Medio |
| `docs/architecture/legacy-alias-sunset-decision-pack.md` | docs | Decisión actual: mantener compat para `/api/campobase/socialflow`. | Bajo |
| `docs/audits/production-readiness-latest.json` | docs/audit | Snapshot de readiness incluyendo esta route compat. | Bajo |
| `src/middleware.ts` | route infra | Redirección de path UI `/campobase/socialflow` a `/operator/socialflow`. | Medio (si se tocara routing legacy) |

Notas de consumo:
- No se observaron consumidores internos de UI llamando `/api/campobase/socialflow`; el consumo actual de UI va a `/api/operator/socialflow`.
- La principal superficie activa de la route legacy se mantiene por compatibilidad y por contrato de inventario/readiness.

---

## 3) Comparación con route canónica

**Comparada contra:** `src/app/api/operator/socialflow/route.ts`

### Resultado
- `src/app/api/campobase/socialflow/route.ts` **no duplica lógica**.
- Es un alias bridge de 1 línea.
- Toda la lógica operativa vive en la route canónica operator.
- La route operator usa namespace canónico de librería:
  - `@/lib/campamento-base/socialflow-control-plane-service`

### Evaluación
- **Mantener como bridge temporal:** sí, es consistente con estado actual.
- **Delegar/redirigir:** ya delega por re-export (mínimo riesgo técnico).
- **Migrarse internamente al servicio canónico:** ya ocurre indirectamente vía route operator.
- **Eliminarse más adelante:** posible tras evidencia de no consumo legacy y decisión de sunset.
- **Opción de menor riesgo actual:** conservar bridge sin cambios de runtime.

---

## 4) Estrategia recomendada (A/B/C/D)

### Opción A
**Mantener `/api/campobase/socialflow` como bridge legacy asegurando delegación canónica.**
- Riesgo: bajo.
- Impacto: bajo; conserva compatibilidad.
- Archivos implicados: route legacy (idealmente sin cambios), tests de contrato.
- Tests necesarios: route legacy socialflow + guardrail namespace + readiness.
- Rollback: trivial (revert cambios mínimos).

### Opción B
**Delegar explícitamente a `/api/operator/socialflow` o compartir handler canónico.**
- Riesgo: bajo/medio (si cambia mecanismo de export/delegación).
- Impacto: bajo si sigue re-export; medio si se reestructura handler.
- Archivos implicados: `src/app/api/campobase/socialflow/route.ts`, potencial extracción de handler compartido.
- Tests necesarios: route socialflow legacy/operator + freeze + readiness.
- Rollback: simple si el cambio es acotado.

### Opción C
**Deprecar `/api/campobase/socialflow` tras confirmar no consumidores.**
- Riesgo: medio/alto (consumidores externos no visibles).
- Impacto: potencialmente alto fuera de repo.
- Archivos implicados: route legacy + docs/config + readiness scripts/tests.
- Tests necesarios: compatibilidad, arquitectura, readiness, telemetry reports.
- Rollback: posible, pero requiere restaurar surface + documentación + checks.

### Opción D
**No tocarla todavía y priorizar legacy de menor riesgo.**
- Riesgo: muy bajo.
- Impacto: nulo en runtime; deuda legacy se mantiene temporalmente.
- Archivos implicados: ninguno productivo.
- Tests necesarios: mantenimiento normal de guardrails/readiness.
- Rollback: no aplica.

### Recomendación final
**Recomendada: Opción D inmediata + A como estado operativo.**
- Mantener la route legacy como bridge re-export.
- No migrar ni eliminar hasta contar con evidencia de consumo (telemetría) y decisión formal de sunset.

---

## 5) Validaciones ejecutadas (solo auditoría)

Comandos requeridos:
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

> Resultado: ver sección final (ambos OK).

---

## 6) Primer commit propuesto (NO implementado)

**Commit propuesto:**  
`test(operator): lock legacy socialflow bridge contract before sunset`

**Objetivo**
- Añadir guardrail canónico de contrato para la route legacy `/api/campobase/socialflow` sin tocar código productivo.

**Archivos a crear**
- `tests/api/operator-socialflow-legacy-bridge-contract.test.ts`

**Archivos a modificar (mínimo, si hiciera falta)**
- Ninguno idealmente. Solo ajuste puntual de test existente si aparece incompatibilidad real.

**Archivos que NO se deben tocar**
- `src/app/api/campobase/socialflow/route.ts`
- `src/app/api/operator/socialflow/route.ts`
- `src/lib/campobase/*`
- `src/lib/campamento-base/*`
- `src/lib/socialflow/*`
- `src/lib/mentoria/*`
- `src/lib/clinic/*`
- `migrations/*`

**Tests necesarios**
- `npx vitest run tests/api/operator-socialflow-legacy-bridge-contract.test.ts`
- `npx vitest run tests/api/campobase-socialflow-route.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

**Validaciones**
- `pnpm typecheck`
- Vitest puntual de los tests anteriores.

**Rollback**
- Revert del test nuevo (y de cualquier ajuste mínimo de tests, si existiera).

**Por qué es el paso más seguro**
- No cambia runtime ni endpoints.
- Congela contrato de compatibilidad legacy antes de cualquier decisión de sunset.

---

## 7) Conclusión obligatoria

- **Archivo creado:** sí
- **Ruta exacta:** `docs/audits/CAMPOBASE_SOCIALFLOW_ROUTE_LEGACY_BRIDGE_AUDIT.md`
- **Existe `src/app/api/campobase/socialflow/route.ts`:** sí
- **¿Es bridge legacy?:** sí
- **Imports legacy detectados (en route auditada):** ninguno hacia `@/lib/campobase`
- **Tests/consumidores detectados:** sí (tests de API, readiness scripts/tests, inventarios/config y docs de sunset)
- **Opción recomendada:** D inmediata + A operativa
- **¿Se puede migrar luego de esta auditoría?:** sí, con evidencia de telemetría/consumo y plan de sunset
- **Siguiente commit recomendado (sin implementarlo):** `test(operator): lock legacy socialflow bridge contract before sunset`
