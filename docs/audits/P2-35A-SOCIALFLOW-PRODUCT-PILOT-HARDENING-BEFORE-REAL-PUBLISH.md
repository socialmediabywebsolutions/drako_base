# P2-35A - SocialFlow Product Pilot Hardening Before Real Publish

Fecha: 2026-05-21

Modo: hardening de codigo + tests + documentacion.  
No se ejecuto publicacion real. No se ejecuto `confirmPublish=true` contra runtime remoto. No se hizo cutover. No se tocaron DNS ni rutas remotas.

## Contexto de entrada (P2-34B)

Blockers principales heredados:

1. Runtime publish guard divergence.
2. Runtime podia publicar por ruta distinta al guard web.
3. Runtime publish aceptaba plaintext legacy para publish.
4. Setup/onboarding fail-closed.
5. Billing/plan faltante.
6. CRM/relationship hub faltante.
7. Intelligence avanzada demo/missing.
8. Web/runtime split no unificado del todo.
9. Persistencia de fallback/demo paths.
10. Lookups sin `saas_id` en primer query.

## Objetivo de P2-35A

Cerrar blockers P0/P1 de seguridad, aislamiento y flujo minimo de piloto controlado, sin publicar en vivo y sin cutover.

## Cambios aplicados

### 1) Publish guard web/runtime unificado (runtime hardening)

- Runtime POST guard reforzado en `apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts`:
  - `confirmPublish=true` obligatorio para publish live.
  - rol `admin` obligatorio.
  - allowlist privada obligatoria (`isRuntimeTenantAllowedInPrivatePilot`).
  - validacion de scope `tenantId + saasId` del post antes de publish.
  - LinkedIn `CONNECTED_REAL` obligatorio.
  - `lastErrorCode` debe ser `null`.
  - tokens en formato cifrado obligatorio.
  - prevalidate (`validateRuntimeLinkedInAccount`) obligatorio antes de publish.
  - bloqueo explícito de publish por scope mismatch en cuenta social.

### 2) Bloqueo de plaintext token en runtime publish

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts`:
  - `publishRuntimeLinkedInPost(...)` ahora exige token cifrado.
  - si token no es `encrypted:v1:aes-gcm:*`, retorna `LINKEDIN_ACCESS_TOKEN_NOT_ENCRYPTED` y falla cerrado.
  - compatibilidad plaintext se mantiene solo para `validateRuntimeLinkedInAccount(...)` (migracion/validacion), no para publish live.

### 3) Tenant + SaaS scope hardening en repositorios

- `src/lib/socialflow/repository.ts`:
  - `getSaasSocialPostById` ahora filtra por `tenant_id + saas_id + id`.
  - `claimScheduledPostForPublishing` ahora filtra por `tenant_id + saas_id + id + status`.
  - `upsertSaasSocialPost`, `upsertSaasSocialCampaign`, `upsertSaasSocialAccount`, `createSaasSocialChannelIdea` agregan `WHERE` en `ON CONFLICT(id) DO UPDATE` para evitar updates cruzados de scope.

- Runtime equivalente:
  - `apps/socialflow-runtime/src/lib/socialflow/posts-repository.ts`
  - `apps/socialflow-runtime/src/lib/socialflow/campaigns-repository.ts`
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/repository.ts`
  - mismo patrón de `WHERE tenant_id + saas_id` en `ON CONFLICT(id) DO UPDATE`.

### 4) Cierre de demo/fallback en producción

- `src/lib/socialflow/auth/server.ts`:
  - `local_demo` bloqueado por defecto en `NODE_ENV=production`.
  - solo habilitable con flag explicita: `SOCIALFLOW_ALLOW_LOCAL_DEMO_AUTH=true`.

- `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`:
  - eliminado fallback de identidad SaaS inventada.
  - si falta seed SaaS: error explicito `SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND`.
  - removida query `SELECT *` del dossier; ahora columnas explicitas.

- `apps/socialflow-runtime/src/app/api/socialflow/exports/current/route.ts`:
  - maneja `SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND` como error controlado (409).

- AI demo paths feature-gated en producción:
  - `src/app/api/socialflow/ai/generate/route.ts`
  - `src/app/api/socialflow/ai/regenerate/route.ts`
  - `apps/socialflow-runtime/src/app/api/socialflow/ai/generate/route.ts`
  - `apps/socialflow-runtime/src/app/api/socialflow/ai/regenerate/route.ts`
  - sin flag explicita (`SOCIALFLOW_ENABLE_DEMO_AI` o `SOCIALFLOW_RUNTIME_ENABLE_DEMO_AI`), dev/test permitido y producción bloquea demo deterministic.

### 5) Minimum pilot UX readiness (setup/status)

- Nuevos endpoints de estado minimo:
  - `src/app/api/socialflow/setup/status/route.ts`
  - `apps/socialflow-runtime/src/app/api/socialflow/setup/status/route.ts`
  - estado expuesto: `profileConfigured`, `linkedInConnected`, `hasDraft`, `publishBlockedByPilotMode`, `requiresHumanApprovalForPublish`.

- Setup pages dejan de estar fail-closed y pasan a flujo minimo guiado:
  - `src/app/socialflow/(workspace)/setup/page.tsx`
  - `apps/socialflow-runtime/src/app/socialflow/(workspace)/setup/page.tsx`
  - incluye checklist minimo + mensaje de human review + bloqueo de autopublish en pilot mode.
  - elimina `RuntimeBoundaryNotice` en setup critico de piloto.

## Tests agregados/actualizados

- Runtime publish guard:
  - `apps/socialflow-runtime/src/app/api/socialflow/posts/route.test.ts`
  - cubre: confirmPublish omitido/false, rol, allowlist, lastErrorCode, token plaintext, scope mismatch, prevalidate fail, path publish permitido.

- Token plaintext publish block:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.test.ts`
  - confirma bloqueo de publish live con plaintext y compatibilidad controlada en validate.

- Scope hardening:
  - `tests/lib/socialflow-repository-scope.test.ts`
  - valida SQL scope en `getSaasSocialPostById` y `claimScheduledPostForPublishing`.

- Fallback gating:
  - `tests/lib/socialflow-auth-server.test.ts`
  - valida bloqueo `local_demo` en producción salvo flag explicita.

- Export fallback:
  - `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`
  - valida fail-closed cuando falta seed SaaS.

- UX setup mínimo:
  - `tests/socialflow-setup-status-page.test.ts`
  - valida presencia de checklist/status/human review y ausencia de fail-closed notice.

## Validaciones ejecutadas

Validacion dirigida de cambios nuevos:

- `pnpm vitest --run apps/socialflow-runtime/src/app/api/socialflow/posts/route.test.ts tests/lib/socialflow-repository-scope.test.ts tests/lib/socialflow-auth-server.test.ts apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.test.ts tests/socialflow-setup-status-page.test.ts`
- Resultado: PASS (17 tests).

Validacion obligatoria completa de fase:

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

Resultados reales ejecutados en esta fase:

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS (sin errores de whitespace; solo warnings de LF/CRLF del arbol de trabajo)

## Blockers cerrados vs abiertos

### Cerrados (P0/P1 directos)

- Divergencia principal de guard runtime/web en publish live (confirm, rol, allowlist, LinkedIn state, lastErrorCode, token encrypted, prevalidate).
- Bloqueo de plaintext token para publish runtime live.
- Scope hardening de lookup/claim y conflict-update cross-scope.
- `local_demo` gated para producción.
- Export fallback identity inventada eliminada.
- Setup minimo operacional habilitado con estado claro y human review.

### Abiertos (no objetivo completo de P2-35A)

- Billing/plan productivo.
- CRM/relationship hub.
- Intelligence avanzada (market/trend/sentiment/prediction/learning/experimentation) en modo productivo real.
- Unificacion total web/runtime en todas las superficies no criticas de publish.

## Decision sobre P2-35 real publish

- **No avanzar aun a P2-35 real publish externo** hasta validar comando completo de build/test global y smoke interno controlado con estos cambios.
- Si la validacion completa queda en verde, P2-35 puede evaluarse en modo estrictamente controlado, sin autopublish y con aprobacion humana explicita.

## Decision sobre private pilot con cliente real

- **Parcialmente habilitado** tras P2-35A para piloto controlado:
  - ya hay setup minimo, guard publish reforzado y bloqueo de paths inseguros.
  - todavia no es commercial beta ready (billing/CRM/intelligence avanzada pendientes).

## Estado final (dictamen P2-35A)

- `runtime-web-publish-guard-unified: si (en flujo publish live protegido)`
- `plaintext-token-publish-blocked: si`
- `tenant-saas-scope-hardened: si (lookup/claim/conflict-updates sensibles)`
- `production-demo-fallbacks-blocked: parcial-si (local_demo/export/AI demo gated; quedan otros no-P0 fuera de esta fase)`
- `minimum-pilot-ux-ready: si (setup/status minimo + human review messaging)`
- `private-pilot-ready: no`
- `commercial-beta-ready: no`
- `should-proceed-to-p2-35-real-publish-workflow: no (hasta validar full suite y smoke interno controlado)`
- `production-cutover-ready: no`
