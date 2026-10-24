# 03_modelo_local_next3000_vs_wrangler8787

## Qué es
Definición operativa del modelo local dual: desarrollo en Next.js (`:3000`) y validación Worker-like en Wrangler (`:8787`).

## Para qué sirve
- Evitar divergencias entre comportamiento local y runtime productivo.
- Definir cuándo usar cada modo de ejecución.
- Prevenir errores de contexto host/auth en pruebas manuales.

## Qué soluciona
- Inconsistencias de routing entre dev server y edge runtime.
- Suposiciones incorrectas sobre entrypoint productivo.
- Problemas de validación de middleware y headers de host.

## Cómo se comporta

### 1) Next.js local (`npm run dev`)
- Script: `next dev` (puerto habitual `3000`).
- Útil para iteración UI/UX y desarrollo de páginas.
- No replica completamente el comportamiento de Worker/OpenNext.

### 2) Wrangler local (`npm run dev:wrangler`)
- Script: `npm run build:factory && wrangler dev --local`.
- Simula mejor el runtime de Cloudflare Worker para middleware + bindings.
- Es el modo recomendado para validar flujos de routing/auth edge.

### 3) Runtime productivo canónico
- Según `WORKERS_RUNTIME_DECISION.md`, el runtime canónico es OpenNext.
- Entrypoint real: `.open-next/worker.js`.
- Superficie activa de negocio: `src/middleware.ts` + `src/app/api/*/route.ts`.

### 4) Regla de verificación local
- Cambios de middleware, host fencing, auth boundaries y redirects:
  - validar siempre en `8787`.
- Cambios puramente de presentación:
  - iterar en `3000`, confirmar en `8787` antes de cerrar.

### 5) Nota de compatibilidad de host local
- Middleware contiene checks específicos para `localhost`/`127.0.0.1` y bypasses controlados.
- Ciertos flujos requieren contexto explícito local (`__drako_host` o cookie `drako_host`).

## Qué NO debe hacer
- No considerar `next dev` como validación suficiente de edge/runtime.
- No forzar shortcuts de host para saltar boundaries.
- No usar Cloudflare Pages como runtime para este proyecto.
- No dejar decisiones de enrutado fuera de middleware.
