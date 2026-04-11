# 11_current_state

## Objetivo de este archivo
Snapshot operativo del estado actual del sistema para retomar trabajo sin perder contexto tecnico.

## Estado global
- Runtime canonico: Next.js App Router + OpenNext Worker.
- Runtime local canonico para validacion real: `wrangler.jsonc` en repo root con `DRACO_DB -> drako_db_local`, levantado en `:8787` con `pnpm dev:wrangler`.
- Control de entrada: `src/middleware.ts`.
- Superficies activas de Mentoria:
  - Publico: `src/app/site/mentoria*`
  - Auth: `src/app/mentorias/auths/*` y `src/app/api/mentorias/auths/*`
  - App: `src/app/mentoria/onboarding`, `src/app/mentoria/app`

## Estado Mentoria al 2026-04-11
- signup: PASS
- login: PASS
- onboarding GET: PASS
- onboarding POST: PASS
- workspace: PASS
- `/mentoria/app`: PASS

## Fixes que dejaron este estado
- Sesion local:
  - Cookie emitida por host real.
  - En `localhost` o `127.0.0.1` la sesion no fuerza `Secure` ni `__Host-`.
  - En produccion se mantiene fail-closed con cookie segura.
- Persistencia tenant/family:
  - `src/lib/mentoria/family-repository.ts` crea o asegura la fila hermana en `tenants` al crear `families`.
  - Esto cierra la FK de `student_trials.tenant_id -> tenants.id`.
- Runtime DB local:
  - `workers/mentorias/migrations/0001_local_mentoria_schema_bootstrap.sql`
  - `workers/mentorias/migrations/0002_local_runtime_metrics.sql`
  - `workers/mentorias/migrations/0003_local_resilience_feedback.sql`
  - Estas migraciones dejan disponibles `mentoria_session_state`, `drako_events`, `mentoria_feedback_jobs` y `mentoria_system_events` en la D1 local usada por OpenNext/Wrangler.

## Regla critica de continuidad
- El repo mantiene dos estados locales de D1:
  - `.wrangler/state/v3/d1/...` en repo root
  - `workers/mentorias/.wrangler/state/v3/d1/...`
- `workers/mentorias/package.json` expone `migrations:local`, pero ese flujo hidrata el estado local del worker y no sustituye por si solo la D1 local canonica del runtime raiz.

## Flujo local canonico
- Bootstrap canonico:
  - `pnpm mentoria:local:bootstrap`
- Bootstrap + alineacion opcional del worker aislado:
  - `pnpm mentoria:local:bootstrap:align-worker`
- QA completa canonica:
  - `pnpm mentoria:local:qa`
- QA completa + alineacion opcional del worker aislado:
  - `pnpm mentoria:local:qa:align-worker`
- Regla:
  - La D1 que manda para la validacion real de Mentoria es la del runtime root (`drako_db_local`).
  - La D1 de `workers/mentorias` solo se alinea cuando se va a ejecutar ese worker de forma aislada o se quiere evitar drift operativo entre ambos estados.

## Artefactos canonicos
- `src/lib/mentoria/family-repository.ts`
- `workers/mentorias/migrations/0001_local_mentoria_schema_bootstrap.sql`
- `workers/mentorias/migrations/0002_local_runtime_metrics.sql`
- `workers/mentorias/migrations/0003_local_resilience_feedback.sql`
- `wrangler.jsonc`
- `workers/mentorias/wrangler.workers.toml`

## Siguiente foco recomendado
- Estandarizar el bootstrap/QA local para que una maquina nueva no tenga que inferir el doble estado root vs worker.
