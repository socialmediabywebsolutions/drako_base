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

### ISSUE-010 - `apps/*` legacy puede confundirse con runtime canonico
- Severidad: `P2`
- Estado: `OPEN`
- Area: Arquitectura / Factory templates / Separacion vertical
- Riesgo:
  - Un operador podria tratar `apps/base`, `apps/bases`, `apps/drako`, `apps/drakos`, `apps/mentorias` o `apps/socialflows` como fuente de runtime vendible aunque hoy solo sean starters/manifests legacy.
- Estado actual:
  - El mapa canonico queda documentado en `10_matriz_global_de_rutas_y_entrypoints.md`.
  - `tests/architecture/canonical-product-map.test.ts` impide que `apps/*` crezca con `package.json`, wrangler config, `src/*`, API o UI runtime sin decision explicita.
- Criterio de cierre:
  - Mover `apps/*` a templates/archivo controlado o documentar formalmente su rol dentro de Factory sin ambiguedad con productos activos.

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
- Nota 2026-04-12: la entrada WhatsApp de Mentoria ya valida `platform_type`, actor y contexto real; falta documentar el checklist QA para habilitar el flujo completo cuando se implemente la automatizacion.

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

### ISSUE-011 - Mentoria depende fisicamente de `DRACO_DB`
- Severidad: `P1`
- Estado: `OPEN`
- Area: DB ownership / Separacion vertical / Produccion
- Riesgo:
  - Mentoria no puede venderse como SaaS fisicamente independiente mientras su DB educativa/productiva siga viviendo en `DRACO_DB`.
- Estado actual:
  - `getMentoriaDb()` prefiere `MENTORIA_DB`, pero cae a `DRACO_DB`.
  - `workers/mentorias/wrangler.workers.toml` no declara `MENTORIA_DB` y usa `DRACO_DB = drako_db_prod`.
  - `MENTORIAS_AUTHS_DB` existe como binding logico, pero en la configuracion revisada comparte la misma D1 fisica que `DRACO_DB`.
  - Las migraciones Mentoria siguen dentro del stream global `migrations/*`.
- Criterio de cierre:
  - `MENTORIA_DB` existe como binding fisicamente dedicado, con preview/prod aislados, schema Mentoria aplicado por dominio, backfill validado, cutover completado y fallback a `DRACO_DB` eliminado del runtime productivo.

### ISSUE-012 - Dominios y deploys por producto aun no son todos vendibles
- Severidad: `P1`
- Estado: `OPEN`
- Area: Dominios / Workers / Workflows / SaaS readiness
- Riesgo:
  - SocialFlow y Mentoria pueden parecer vendibles como SaaS independientes antes de tener dominio, deploy, smoke y DB/auth ownership completamente canonicos.
- Estado actual:
  - Drako marca: `drako.systems -> saas-drakos-prod`.
  - Campamento Base: `base.drako.systems`/`bases.drako.systems -> saas-bases-prod`.
  - Mentoria: `mentoria.drako.systems`/`mentorias.drako.systems -> saas-mentorias-prod`, pero sigue sin `MENTORIA_DB` fisicamente dedicado.
  - SocialFlow: `socialflow.drako.systems` y `socialflows.drako.systems -> saas-socialflows-prod`; dominio canonico, workflow/smoke/readiness y landing publica piloto premium ya estan activos.
  - P10.26 deja pendiente convertir el piloto en onboarding/panel comercial completo sin abrir APIs ni tocar DB/OAuth.
  - `.github/workflows/drako-factory-deploy.yml` despliega scheduler, Drako, Mentoria y Base, pero no SocialFlow; ademas aplica un hotfix de migracion Mentoria sobre `DRACO_DB`.
- Criterio de cierre:
  - SocialFlow y Mentoria tienen dominio canonico decidido, workflow reproducible por producto, smoke por dominio, expected-state/readiness alineado y bloqueos DB/auth cerrados o aceptados explicitamente para una fase controlada.

### ISSUE-015 - Implementar dominio canonico SocialFlow
- Severidad: `P1`
- Estado: `PARTIAL`
- Area: Dominios / Cloudflare / Workflows / SocialFlow SaaS readiness
- Riesgo:
  - SocialFlow queda con dominio plural operativo (`socialflows.drako.systems`) mientras la marca, rutas y namespace canonicos son singulares.
- Estado actual:
  - ADR aceptada en `docs/decisions/adr-socialflow-canonical-domain.md`.
  - Plan tecnico documentado en `docs/audits/p10-13-socialflow-domain-implementation-plan.md`.
  - Dominio canonico decidido: `socialflow.drako.systems`.
  - Dominio actual confirmado: `socialflows.drako.systems`.
  - Worker esperado: `saas-socialflows-prod`.
  - Dominio canonico creado y validado; phase gate activo; smoke/readiness cubren dominio singular.
  - Worker `saas-socialflows-prod` sirve landing publica controlada premium para `/`, `/socialflow` y `/socialflow/auth`.
  - APIs e internas siguen protegidas por Origin; `socialflows.drako.systems` permanece compat.
- Criterio de cierre:
  - `socialflow.drako.systems` existe y apunta a `saas-socialflows-prod`.
  - `/socialflow` y `/api/socialflow/*` responden bajo dominio canonico.
  - OAuth LinkedIn/callbacks quedan auditados para dominio canonico si aplica.
  - `socialflows.drako.systems` queda compat/legacy mediante redirect o bridge controlado.
  - Readiness/hostname checks y smoke tests cubren el dominio singular.
  - No se rompe compatibilidad existente.
  - Falta decidir redirect/bridge final del dominio compat y completar onboarding/panel cliente real.

## Orden de ataque recomendado
1. `ISSUE-006`
2. `ISSUE-005`
3. `ISSUE-009`
4. `ISSUE-010`
5. `ISSUE-011`
6. `ISSUE-012`
7. `ISSUE-015`
8. `ISSUE-008`

## Regla de continuidad
- Ningun issue pasa a `CLOSED` sin evidencia concreta en `13_progress_log.md`.
- Todo cambio de middleware/auth/DB se valida en `:8787`.
