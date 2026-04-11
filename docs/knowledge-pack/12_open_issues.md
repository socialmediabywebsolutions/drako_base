# 12_open_issues

## Objetivo de este archivo
Backlog tecnico vivo para continuidad entre chats, con foco en Mentoria y riesgo de drift runtime/middleware/DB.

## Issues cerrados al 2026-04-11

### ISSUE-001 - Drift de ejecucion 3000 vs 8787 en flujos Mentoria
- Severidad: `P0`
- Estado: `CLOSED`
- Cierre:
  - Validacion real completada en OpenNext/Wrangler local (`:8787`) con signup, login, onboarding GET/POST, workspace y `/mentoria/app` en PASS.

### ISSUE-002 - Drift middleware -> DB bindings en registro Mentoria
- Severidad: `P0`
- Estado: `CLOSED`
- Cierre:
  - Sesion local alineada por host real.
  - D1 local raiz materializada con el esquema requerido por Mentoria.

### ISSUE-003 - Consistencia tenant/family post-login Mentoria
- Severidad: `P0`
- Estado: `CLOSED`
- Cierre:
  - `createFamily()` asegura fila hermana en `tenants`.
  - Se elimina la FK rota de `student_trials.tenant_id -> tenants.id`.

### ISSUE-007 - Gap entre documentacion y estado real del runtime
- Severidad: `P2`
- Estado: `CLOSED`
- Cierre:
  - Knowledge pack actualizado con baseline real, riesgos y canon de reproduccion local.

## Issues abiertos

### ISSUE-005 - Observabilidad insuficiente en fallos de finalizeRegistration
- Severidad: `P1`
- Estado: `OPEN`
- Area: API Mentoria / Logging / Telemetry
- Riesgo:
  - Debug mas lento si reaparece un fallo intermitente fuera del recorrido ya validado.

### ISSUE-006 - Contrato de verificacion manual no estandarizado
- Severidad: `P1`
- Estado: `OPEN`
- Area: QA operativo
- Riesgo:
  - El flujo local puede volver a derivar si el siguiente operador no sigue una checklist fija.

### ISSUE-008 - Riesgo de regresion en CTAs regionales por cambios de contenido
- Severidad: `P2`
- Estado: `OPEN`
- Area: Front marketing Mentoria
- Riesgo:
  - Reintroduccion futura de rutas legacy fuera del funnel canonico.

### ISSUE-009 - Doble estado D1 local root vs worker Mentoria
- Severidad: `P1`
- Estado: `OPEN`
- Area: Runtime local / DB bootstrap
- Sintoma:
  - El repo mantiene dos estados locales de D1 en `.wrangler/...` (root) y `workers/mentorias/.wrangler/...` (worker).
- Impacto:
  - Una maquina nueva puede aplicar `workers/mentorias` `migrations:local` y seguir dejando incompleta la D1 que usa realmente OpenNext/Wrangler raiz si no sigue el script root canonico.
- Criterio de cierre:
  - Script o procedimiento unico, explicito y adoptado para hidratar tanto el runtime local canonico como el worker local cuando haga falta.
 - Estado actual:
  - Existe flujo root canonico (`pnpm mentoria:local:bootstrap`, `pnpm mentoria:local:qa`) y alineacion opcional del worker (`:align-worker`).
  - Permanece como riesgo operativo mientras existan dos estados fisicos de D1 separados.

## Orden de ataque recomendado
1. `ISSUE-006`
2. `ISSUE-005`
3. `ISSUE-009`
4. `ISSUE-008`

## Regla de continuidad
- Ningun issue pasa a `CLOSED` sin evidencia concreta en `13_progress_log.md`.
- Todo cambio de middleware/auth/DB se valida en `:8787`.
