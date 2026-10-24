# CAMPOBASE Platform Route Legacy Bridge Audit

**Fecha:** 2026-06-07  
**Tipo:** Auditoría reducida (solo inspección)  
**Alcance:** `src/app/api/campobase/platform/route.ts`  
**Cambios de código:** ninguno

---

## 1) Inspección de la route legacy

**Archivo auditado:** `src/app/api/campobase/platform/route.ts`  
**Existe:** sí

Contenido actual:

```ts
// LEGACY_CAMPOBASE_COMPAT_ROUTE: keep as operator-only bridge, not as a new canonical entrypoint.
export { dynamic, GET, POST } from "@/app/api/operator/platform/route";
```

### Hallazgos
- **Métodos exportados:** `GET`, `POST` y también `dynamic` (re-exportados).
- **Imports actuales:** no tiene imports propios de servicios; re-exporta directamente desde `@/app/api/operator/platform/route`.
- **¿Importa desde `@/lib/campobase`?:** no.
- **¿Apunta ya a ruta canónica?:** sí, apunta a `@/app/api/operator/platform/route`.
- **¿Actúa como bridge/alias/delegación?:** sí, bridge legacy puro por re-export.
- **Response shape pública (heredada de operator route):**
  - `GET` éxito: `{ surface }`
  - `POST` acción `refresh`: `{ action, surface, result: null }`
  - `POST` otras acciones: `{ action, result, surface }`
  - Errores: objetos con `code` y `message` + status HTTP correspondiente.

### Riesgos al tocarla
- Riesgo de romper consumidores legacy externos que aún llamen `/api/campobase/platform`.
- Riesgo de regresión en contrato público si cambia delegación o shape.
- Riesgo de desalinear inventarios/auditorías que hoy la catalogan como `LEGACY_COMPAT`.
- Riesgo bajo si se mantiene como bridge sin lógica propia.

---

## 2) Tests y referencias relacionadas

Búsqueda orientada por:
- `src/app/api/campobase/platform/route.ts`
- `/api/campobase/platform`
- `campobase/platform`

### Referencias detectadas

| Path | Tipo | Qué valida / consume | Riesgo |
|---|---|---|---|
| `tests/api/campobase-platform-route.test.ts` | test | Prueba comportamiento `GET/POST` para la route legacy y contrato de respuestas. | Alto (si cambia contrato o delegación). |
| `tests/lib/legacy-alias-usage.test.ts` | test | Telemetría de uso de alias legacy, incluye `legacyPath: /api/campobase/platform`. | Medio (si cambia ruta o tracking). |
| `tests/scripts/prepare-legacy-alias-sunset-decision.test.ts` | test | Matriz de decisión de sunset; reconoce esta ruta como legacy compat. | Medio. |
| `tests/scripts/report-legacy-alias-usage.test.ts` | test | Parseo/reporte de eventos de alias legacy para `/api/campobase/platform`. | Medio. |
| `tests/production-readiness.test.ts` | test | Espera que el archivo legacy exista en `expectedCompatRouteFiles`. | Medio. |
| `docs/config/control-plane-route-inventory.json` | docs/config | Inventario de rutas; clasifica `/api/campobase/platform` como `LEGACY_COMPAT`. | Bajo/Medio (drift documental). |
| `docs/config/control-plane-separation-audit.json` | docs/config | Audit entry con sourcePath y canonical target de esta ruta. | Bajo/Medio. |
| `docs/config/legacy-alias-deprecation-matrix.json` | docs/config | Matriz deprecación alias; status `LEGACY_COMPAT_ACCEPTED`. | Bajo/Medio. |
| `docs/architecture/legacy-alias-sunset-decision-pack.md` | docs | Decisión de mantener compat para esta alias route. | Bajo. |
| `scripts/check-production-readiness.ts` | script | Incluye la ruta legacy en checks de superficie de compatibilidad. | Medio. |

### Señales adicionales
- No se detectaron consumidores internos en `src/` que llamen `"/api/campobase/platform"` directamente.
- En UI/flujo actual, el endpoint usado para operator platform es `"/api/operator/platform"`.

---

## 3) Comparación con route canónica

**Comparada contra:** `src/app/api/operator/platform/route.ts`

### Resultado
- `src/app/api/campobase/platform/route.ts` **no duplica lógica**.
- Es un **alias bridge** de una línea hacia la route canónica operator.
- La lógica real (auth, validación de acción, status codes, shape de respuesta) vive en la route canónica.

### Evaluación
- **Mantener bridge temporal:** sí, actualmente es consistente y de bajo costo.
- **Delegar/redirigir:** ya delega por re-export (forma más simple y menos riesgosa en código).
- **Migración interna a servicio canónico:** ya ocurre indirectamente por la route operator (que ya usa servicio canónico).
- **Eliminar más adelante:** posible, pero solo tras evidencia de no consumidores (telemetría + contrato de sunset).
- **Menor riesgo hoy:** conservar bridge actual sin tocar runtime.

---

## 4) Estrategia recomendada (A/B/C/D)

### Opción A
**Mantener `/api/campobase/platform` como legacy bridge usando imports canónicos.**
- Riesgo: bajo.
- Impacto: bajo, continuidad total de compatibilidad.
- Archivos implicados: `src/app/api/campobase/platform/route.ts` (ningún cambio necesario hoy).
- Tests necesarios: mantener `tests/api/campobase-platform-route.test.ts` + guardrails existentes.
- Rollback: trivial (sin cambios o revert de un archivo).

### Opción B
**Delegar a `/api/operator/platform` o compartir handler canónico.**
- Riesgo: bajo/medio (si se cambia mecanismo de delegación podría afectar edge-cases).
- Impacto: bajo si es re-export, medio si se reestructura handlers.
- Archivos implicados: route legacy + posible extracción de handler compartido.
- Tests necesarios: route legacy, route operator, freeze guardrail.
- Rollback: simple si cambios son pequeños.

### Opción C
**Deprecar `/api/campobase/platform` tras confirmar cero consumidores.**
- Riesgo: medio/alto (riesgo de romper integraciones externas no observadas).
- Impacto: potencialmente alto fuera del monolito.
- Archivos implicados: route legacy, docs/config matrices, readiness scripts/tests.
- Tests necesarios: compat, producción/readiness, arquitectura alias.
- Rollback: posible, pero requiere restaurar ruta y estados de inventario.

### Opción D
**No tocarla todavía y priorizar otros imports legacy más seguros.**
- Riesgo: muy bajo.
- Impacto: nulo en runtime; deuda legacy permanece temporalmente.
- Archivos implicados: ninguno de producción.
- Tests necesarios: solo mantenimiento normal.
- Rollback: no aplica.

### Recomendación final
**Recomendada: Opción D inmediata + A como estado operativo.**
- En práctica, dejar la route legacy como bridge actual (ya delega a canónica) y no migrarla aún.
- Ejecutar primero observación/telemetría de uso para decidir sunset con evidencia.

---

## 5) Validaciones ejecutadas (solo auditoría)

Comandos requeridos:
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

> Resultado: ver sección de conclusión (se completan en esta auditoría).

---

## 6) Primer commit propuesto (NO implementado)

**Nombre de commit propuesto:**  
`test(operator): lock legacy campobase platform bridge contract before sunset`

**Objetivo:**
- Congelar explícitamente el contrato de bridge legacy antes de una futura deprecación.
- Asegurar que `src/app/api/campobase/platform/route.ts` siga siendo re-export limpio a route canónica.

**Archivos a crear:**
- `tests/api/operator-platform-legacy-bridge-contract.test.ts` (nombre canónico, sin crear archivos nuevos con nombre `campobase`).

**Archivos a modificar:**
- `tests/api/campobase-platform-route.test.ts` (solo ajuste mínimo si hiciera falta alinear assertions de bridge).

**Archivos que NO se deben tocar:**
- `src/app/api/campobase/platform/route.ts`
- `src/app/api/operator/platform/route.ts`
- `src/lib/campobase/*`
- `src/lib/socialflow/*`
- `src/lib/mentoria/*`
- `src/lib/clinic/*`
- `migrations/*`

**Tests necesarios:**
- `npx vitest run tests/api/campobase-platform-route.test.ts`
- `npx vitest run tests/api/operator-platform-legacy-bridge-contract.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

**Validaciones:**
- `pnpm typecheck`
- Vitest puntual de los tests anteriores.

**Rollback:**
- Revert del nuevo test y de ajustes mínimos de tests existentes.

**Por qué es el paso más seguro:**
- No cambia runtime ni rutas públicas.
- Reduce riesgo futuro al fijar reglas de compatibilidad en tests antes de tocar la route legacy.

---

## 7) Conclusión obligatoria

- **Archivo creado:** sí
- **Ruta exacta:** `docs/audits/CAMPOBASE_PLATFORM_ROUTE_LEGACY_BRIDGE_AUDIT.md`
- **Existe `src/app/api/campobase/platform/route.ts`:** sí
- **¿Es bridge legacy?:** sí
- **Imports legacy detectados (en la route auditada):** ninguno hacia `@/lib/campobase` (re-export a `@/app/api/operator/platform/route`)
- **Tests/consumidores detectados:** sí (tests de route, alias telemetry, readiness scripts/docs/matrices)
- **Opción recomendada:** Opción D inmediata + mantener A operativa
- **¿Se puede migrar esa route después de esta auditoría?:** sí, pero solo tras evidencia de consumo (telemetría) y plan de sunset
- **Siguiente commit recomendado (sin implementarlo):** `test(operator): lock legacy campobase platform bridge contract before sunset`
