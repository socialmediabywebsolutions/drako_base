# P2-35B - Deploy P2-35A Hardening + Internal Smoke Before Real Publish

Fecha: 2026-05-21

Modo: deploy controlado + smoke interno + validacion completa.
No se ejecuto publicacion real. No se ejecuto `confirmPublish=true`. No se hizo cutover. No se tocaron DNS, workers.dev, wildcard global ni rutas externas de otros SaaS.

## Objetivo de fase

Desplegar en `saas-socialflows-prod` los cambios de hardening P2-35A y validar en produccion (interno, controlado) que:

- el guard de publish sigue fail-closed sin confirmacion explicita;
- no hay leakage de tokens/sesion sensible;
- setup/status minimo funciona en prod;
- scheduler autopublish sigue bloqueado por private pilot mode;
- no se ejecuta publish real.

## Fase 1 - Pre-deploy validation

Comandos ejecutados antes de deploy:

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS (solo warnings LF/CRLF, sin errores)

## Fase 2 - Deploy productivo controlado

Comando ejecutado:

- `pnpm exec wrangler deploy --config=workers/socialflows/wrangler.workers.toml`

Evidencia inicial de deploy:

- `Uploaded saas-socialflows-prod`
- Triggers: `socialflow.drako.systems`, `socialflows.drako.systems`
- No deploy de `saas-socialflows-runtime-canary`
- No deploy de `drakosystems`

Hallazgo durante smoke inicial:

- `/api/socialflow/setup/status` devolvia `404` por artefacto `.open-next/socialflows-standalone` desactualizado (manifest local previo con `generatedAt` 2026-05-20).

Remediacion aplicada en la misma fase:

- `pnpm build:factory` para regenerar artefacto OpenNext activo.
- Verificacion de artefacto regenerado:
  - `.open-next/socialflows-standalone/artifact-manifest.json` `generatedAt` = `2026-05-21T12:02:41.682Z`
  - manifest incluye `"/api/socialflow/setup/status/route": "/api/socialflow/setup/status"`
- Redeploy controlado ejecutado de nuevo con el mismo comando.

Evidencia de deploy final:

- `Uploaded saas-socialflows-prod`
- `Current Version ID: 280f1a7a-86c1-4db8-89d1-a786cd504d3d`
- Triggers limitados a hosts SocialFlow (sin cambios de DNS/wildcard)

## Fase 3 - Smoke interno sin sesion

Checks ejecutados:

- `GET https://socialflow.drako.systems/` -> `308`
- `GET https://socialflows.drako.systems/` -> `308`
- `GET /api/socialflow/profile` sin sesion -> `401`
- `POST /api/socialflow/linkedin/validate-connection` sin sesion -> `401`
- `POST /api/socialflow/posts` sin sesion (body valido) -> `401`

Leakage check (response bodies):

- `accessToken` -> no
- `idToken` -> no
- `auth_meta` -> no

## Fase 4 - Smoke interno con sesion staff/admin

Login staff/admin tenant-bound:

- `POST /api/socialflow/auths/logins` -> `200`
- `ok=true`
- `role=admin`
- `tenantId=tenant_socialflow_canary_staff`

Setup/status:

- `GET /api/socialflow/setup/status?saasId=p2-24i-saas` -> `200`
- `profileConfigured=false`
- `linkedInConnected=true`
- `hasDraft=true`
- `publishBlockedByPilotMode=true`
- `requiresHumanApprovalForPublish=true`

Profile:

- `GET /api/socialflow/profile?saasId=p2-24i-saas` -> `200`

LinkedIn validate:

- `POST /api/socialflow/linkedin/validate-connection` -> `200`
- `status=CONNECTED_REAL`
- `tokenEncrypted=true`
- `lastErrorCode=null`

Posts sin publish real:

1) `POST /api/socialflow/posts` (sin `confirmPublish`)
- `200`
- `post.status=DRAFT`
- `livePublish.ok=false`
- `livePublish.code=PUBLISH_CONFIRMATION_REQUIRED`
- `livePublish.dryRun=true`
- `externalPostId=null`

2) `POST /api/socialflow/posts` (`confirmPublish=false`)
- `200`
- `post.status=DRAFT`
- `livePublish.ok=false`
- `livePublish.code=PUBLISH_CONFIRMATION_REQUIRED`
- `livePublish.dryRun=true`
- `externalPostId=null`

Resultado:

- no publish real ejecutado
- guard de confirmacion operativo en prod

## Fase 5 - Validacion de guards P2-35A

### Validado por smoke prod

- confirmPublish omitido -> bloquea publish real
- confirmPublish=false -> bloquea publish real
- setup/status prod operativo
- LinkedIn `CONNECTED_REAL` + `tokenEncrypted=true`
- no externalPostId en drafts de smoke

### Validado por tests dirigidos (local)

Comando:

- `pnpm vitest --run apps/socialflow-runtime/src/app/api/socialflow/posts/route.test.ts apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.test.ts tests/lib/social-scheduler.test.ts apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts tests/lib/socialflow-repository-scope.test.ts tests/lib/socialflow-auth-server.test.ts`

Resultado: PASS (18 tests)

Cobertura concreta:

- tenant no allowlisted bloquea publish
- `lastErrorCode` no-null bloquea publish
- token plaintext bloqueado para publish (`LINKEDIN_ACCESS_TOKEN_NOT_ENCRYPTED`)
- scope mismatch tenant/saas bloquea publish
- scheduler autopublish en pilot mode -> `SKIPPED`
- `local_demo` bloqueado en produccion sin flag explicita
- export sin seed -> fail-closed (`SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND`)

### AI demo production gate

Smoke controlado con sesion:

- `POST /api/socialflow/ai/generate` -> `503`
- `error=SOCIALFLOW_AI_DEMO_DISABLED_IN_PRODUCTION`

## Fase 6 - D1 safe verification (remote, read-only)

Se ejecutaron queries explicitas (`--remote`, solo lectura, sin `SELECT *`).

### socialflow_profiles

Query filtrada por tenant piloto:

- fila encontrada para `tenant_socialflow_canary_staff` / `saas_id=socialflow`
- ejemplo: `brand_name=SocialFlow Private Pilot`

### saas_social_posts (drafts)

- ultimos drafts de `tenant_socialflow_canary_staff` + `saas_id=p2-24i-saas`
- `status=DRAFT`
- `external_post_id=null`

### saas_social_accounts (sin exponer token)

Query con columnas minimas + flags derivados sobre `auth_meta`:

- `status=CONNECTED_REAL`
- `last_error_code=null`
- `access_token_encrypted=1`
- `id_token_encrypted=1`

No se imprimieron tokens ni `auth_meta` completo.

## Fase 7 - Leakage + observability

- no `accessToken` en respuestas auditadas
- no `idToken` en respuestas auditadas
- no `auth_meta` en respuestas auditadas
- header de correlacion presente:
  - `x-drako-correlation-id: 7727073a-a209-4de5-8afe-4be6cd3ddf32`
- errores observados en smoke fueron seguros (401/503 con payload controlado)

## Que NO cambio en esta fase

- no DNS
- no workers.dev
- no wildcard global
- no drakosystems worker
- no Campamento Base / Mentoria deploy
- no cutover global
- no desactivacion de private pilot mode
- no alta de tenants
- no publicacion real externa

## Fase 9 - Validacion post-smoke

Comandos re-ejecutados luego del deploy+smoke:

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS (solo warnings LF/CRLF)

## Blockers abiertos relevantes

- `GET /api/socialflow/exports/current?saasId=p2-24i-saas` en prod retorna `503` por `DRACO_DB` binding missing en este worker.
  - No afecta el guard de publish, pero sigue siendo gap de runtime/export para flujo de producto completo.

## Decision sobre P2-35C

Decision: **SI, con control estricto**.

Condiciones para ejecutar P2-35C:

- mantener `private pilot mode` activo;
- ejecutar un solo caso controlado staff/admin tenant-bound;
- registrar evidencia completa de prevalidate + confirm path;
- rollback plan listo;
- sin abrir trafico general;
- sin declarar production-cutover-ready.

## Dictamen final P2-35B

- `p2-35a-hardening-deployed: si`
- `internal-smoke-pass: si`
- `setup-status-prod-valid: si`
- `publish-guard-prod-valid: si`
- `plaintext-token-publish-blocked-prod: si (validado por tests dirigidos + evidencias de tokenEncrypted en prod)`
- `scheduler-autopublish-blocked-prod: si (validado por tests con estado SKIPPED en private pilot)`
- `token-leakage: no`
- `should-proceed-to-p2-35C-controlled-real-publish-approval: si (controlado)`
- `production-cutover-ready: no`
