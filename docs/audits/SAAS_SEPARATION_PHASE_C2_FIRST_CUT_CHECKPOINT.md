# SAAS Separation — Phase C.2 First Cut Checkpoint

Fecha: 2026-06-06  
Scope: cierre documental del primer corte C.2 (sin migrar consumidores, sin tocar rutas/operator/components/runtime).

---

## 1) Confirmación de archivos clave

### `src/lib/capabilities/internal-api-clients/socialflow-control-plane.ts`
- Propósito: cliente interno neutral para endpoints `/api/internal/socialflow/*`.
- Estado: activo y validado por tests (22/22).
- Naturaleza: canónico (control-plane neutral).
- Riesgo: medio-bajo (depende de contrato v1 neutral/queued).
- ¿Importa lógica prohibida?: no (`@/lib/socialflow/contracts/*` y `@/lib/campobase/*` no aparecen).

### `src/lib/campamento-base/socialflow-control-plane-service.ts`
- Propósito: servicio canónico Campamento Base que expone shape legacy usando cliente neutral + automation-core donde aplica.
- Estado: activo y validado por tests (7/7).
- Naturaleza: canónico.
- Riesgo: medio (compatibilidad mantenida, pero parte del contrato interno aún es neutral/limitado).
- ¿Importa lógica prohibida?: no (`@/lib/socialflow/contracts/*` y `@/lib/campobase/*` no aparecen).

### `src/lib/campobase/socialflow-service.ts`
- Propósito: adapter legacy temporal para consumidores existentes.
- Estado: activo, reducido a re-export del servicio canónico.
- Naturaleza: legacy congelado.
- Riesgo: bajo (sin lógica propia, rollback simple).
- ¿Importa lógica prohibida?: no.

### `tests/lib/socialflow-control-plane-internal-client.test.ts`
- Propósito: validar headers, requestId, errores HTTP/network/JSON, restricciones de imports y estado adapter.
- Estado: passing (22/22).
- Naturaleza: test de capa canónica neutral.
- Riesgo: bajo.
- ¿Importa lógica prohibida?: no.

### `tests/lib/campamento-base-socialflow-control-plane-service.test.ts`
- Propósito: validar servicio canónico (uso del cliente neutral, shape legacy compatible, manejo controlado de errores, imports prohibidos).
- Estado: passing (7/7).
- Naturaleza: test canónico.
- Riesgo: bajo.
- ¿Importa lógica prohibida?: no.

### `tests/lib/campobase-socialflow-service.test.ts`
- Propósito: validar compatibilidad del path legacy y contrato público, además de confirmar eliminación de import crítico.
- Estado: passing (10/10).
- Naturaleza: test legacy de compatibilidad.
- Riesgo: bajo-medio (protege backward-compat).
- ¿Importa lógica prohibida?: no (solo import del path legacy permitido por guardrail).

### `tests/architecture/campobase-namespace-freeze.test.ts`
- Propósito: guardrail de freeze para evitar crecimiento de imports `@/lib/campobase`.
- Estado: passing (2/2).
- Naturaleza: guardrail arquitectónico.
- Riesgo: bajo (control preventivo).
- ¿Importa lógica prohibida?: no (define política y allowlist).

---

## 2) Eliminación del import crítico

Verificado explícitamente en `src/lib/campobase/socialflow-service.ts`:

- Ya **NO** importa:
  - `@/lib/socialflow/contracts/campobase`
  - `@/lib/socialflow/contracts/owner-dashboard`
  - `@/lib/socialflow/*`
- Ahora delega vía re-export canónico a:
  - `@/lib/campamento-base/socialflow-control-plane-service`

Resultado: **import crítico eliminado**.

---

## 3) Confirmación del servicio canónico

Verificado en `src/lib/campamento-base/socialflow-control-plane-service.ts`:

- Usa cliente neutral:
  - `@/lib/capabilities/internal-api-clients/socialflow-control-plane`
- No importa desde `@/lib/campobase/*`.
- No importa lógica interna de SocialFlow (`@/lib/socialflow/*` contracts/runtime).
- Mantiene shape compatible con legacy (constantes, tipos y funciones públicas esperadas por consumidores).
- Limitaciones contractuales documentadas en código:
  - `runCampoBaseSocialAutomation`: endpoint interno v1 devuelve estado queued; `schedule` detallado queda pendiente de respuesta interna más rica.
  - observabilidad/operator actions: mapping compat sobre snapshots/acciones internas v1.

---

## 4) Confirmación adapter legacy

Verificado en `src/lib/campobase/socialflow-service.ts`:

- Queda como adapter temporal: **sí**.
- Mantiene exports públicos actuales: **sí**, por `export *` del servicio canónico.
- No introduce lógica nueva productiva: **sí** (archivo sin lógica propia).
- Conserva compatibilidad para los 9 consumidores detectados: **sí** (path legacy intacto).
- Incluye comentario claro de legacy congelado: **sí**.

---

## 5) Consumidores actuales (9) y clasificación

1. `src/app/api/operator/socialflow/route.ts`  
   - Clasificación: debe migrar pronto  
   - Riesgo: alto

2. `src/components/campobase/CampoBaseSocialAutomationControl.tsx`  
   - Clasificación: puede esperar  
   - Riesgo: bajo (type-driven + vía API route)

3. `src/lib/campamento-base/orchestrator/snapshot-db.ts`  
   - Clasificación: debe migrar pronto  
   - Riesgo: medio

4. `src/lib/campobase/socialflow-platform.ts`  
   - Clasificación: puede esperar  
   - Riesgo: medio-alto (bootstrap/dynamic import)

5. `src/lib/operator/socialflow-service.ts`  
   - Clasificación: puede esperar  
   - Riesgo: medio (re-export bridge)

6. `tests/api/campobase-socialflow-route.test.ts`  
   - Clasificación: solo test  
   - Riesgo: bajo

7. `tests/components/campobase-social-page.test.tsx`  
   - Clasificación: solo test  
   - Riesgo: bajo

8. `tests/components/operator-socialflow-health-panel.test.tsx`  
   - Clasificación: solo test  
   - Riesgo: bajo

9. `tests/lib/campobase-socialflow-service.test.ts`  
   - Clasificación: solo test  
   - Riesgo: medio (contrato legacy)

---

## 6) Validaciones ejecutadas

Comandos exactos solicitados:

- `pnpm typecheck` → ✅ OK
- `npx vitest run tests/lib/socialflow-control-plane-internal-client.test.ts` → ✅ 22/22
- `npx vitest run tests/lib/campamento-base-socialflow-control-plane-service.test.ts` → ✅ 7/7
- `npx vitest run tests/lib/campobase-socialflow-service.test.ts` → ✅ 10/10
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` → ✅ 2/2

---

## 7) Próximo paso recomendado (evaluación)

### Opción A — Migrar primer consumidor runtime de bajo riesgo al servicio canónico
- Riesgo: medio-bajo
- Impacto: medio
- Archivos: 1 consumidor runtime + tests directos
- Tests: unit/integration del consumidor + freeze
- Rollback: simple (revert del consumidor)

### Opción B — Migrar primero tests hacia canónico
- Riesgo: bajo
- Impacto: bajo-medio
- Archivos: tests `campobase*` y mocks asociados
- Tests: mismos tests migrados + freeze
- Rollback: muy simple

### Opción C — Migrar `src/app/api/operator/socialflow/route.ts`
- Riesgo: medio-alto
- Impacto: alto (surface principal runtime)
- Archivos: route operator + tests API
- Tests: route test + regresión básica de contrato
- Rollback: manejable, pero con más superficie

### Opción D — Migrar `src/lib/campamento-base/orchestrator/snapshot-db.ts`
- Riesgo: bajo-medio
- Impacto: medio
- Archivos: `snapshot-db.ts` + tests relacionados
- Tests: snapshot/orchestrator + freeze
- Rollback: simple

### Recomendación final
- **Recomendada: Opción D** como siguiente commit (primer runtime de bajo riesgo real dentro del namespace canónico), antes de tocar la route operator.

---

## 8) Conclusión obligatoria

- Archivo creado: **sí**
- Ruta exacta: `docs/audits/SAAS_SEPARATION_PHASE_C2_FIRST_CUT_CHECKPOINT.md`
- Import crítico eliminado: **sí**
- Servicio canónico activo: **sí**
- Adapter legacy preservado: **sí**
- Consumidores legacy restantes: **9**
  - `src/app/api/operator/socialflow/route.ts`
  - `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
  - `src/lib/campamento-base/orchestrator/snapshot-db.ts`
  - `src/lib/campobase/socialflow-platform.ts`
  - `src/lib/operator/socialflow-service.ts`
  - `tests/api/campobase-socialflow-route.test.ts`
  - `tests/components/campobase-social-page.test.tsx`
  - `tests/components/operator-socialflow-health-panel.test.tsx`
  - `tests/lib/campobase-socialflow-service.test.ts`
- Archivos nuevos con nombre `campobase`: **no**
- Nuevos imports hacia `@/lib/campobase`: **no**
- Validaciones ejecutadas y resultado: **todas OK** (typecheck + 4 suites vitest puntuales)
- Phase C.2 first cut cerrado: **sí**
- ¿SocialFlow puede moverse ya a Worker?: **no** (contrato interno aún v1/neutral en partes; falta migración progresiva de consumidores y madurez contractual)
- Siguiente commit recomendado (sin implementar):
  - `feat(control-plane): migrate campamento-base snapshot-db socialflow dependency to canonical service path`
