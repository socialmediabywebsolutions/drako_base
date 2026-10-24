# P2-35C - Controlled Real Publish Approval Workflow

Fecha: 2026-05-21

Modo: ejecucion controlada en produccion con aprobacion humana explicita.
Se mantuvo private pilot mode activo. No se toco DNS, workers.dev, wildcard global, cutover ni otros SaaS.

## Aprobacion humana capturada

Frase exacta recibida del operador:

`APRUEBO PUBLICAR ESTE POST REAL EN LINKEDIN`

Scope aprobado:

- `post_id`: `f029424c-386c-45f7-94b4-d808c1db119a`
- `tenant_id`: `tenant_socialflow_canary_staff`
- `saas_id`: `p2-24i-saas`
- `provider`: `LINKEDIN`
- un solo intento controlado con `confirmPublish=true`

## Preflight final read-only (antes del intento)

Validaciones confirmadas:

- post candidato existente en D1, `status=DRAFT`, `external_post_id=null`
- tenant/saas scope correcto
- LinkedIn `CONNECTED_REAL`
- `tokenEncrypted=true`
- `lastErrorCode=null`
- private pilot mode activo (`publishBlockedByPilotMode=true`)
- human approval requerido (`requiresHumanApprovalForPublish=true`)
- sin leakage de `accessToken`, `idToken`, `auth_meta`

## Ejecucion controlada de publish real (unico intento)

Request ejecutado:

- `POST https://socialflow.drako.systems/api/socialflow/posts`
- body con:
  - `id=f029424c-386c-45f7-94b4-d808c1db119a`
  - `saasId=p2-24i-saas`
  - `provider=LINKEDIN`
  - `status=DRAFT`
  - contenido aprobado exacto
  - `confirmPublish=true`

Resultado:

- `HTTP 409`
- `livePublish.ok=false`
- `livePublish.code=LINKEDIN_PUBLISH_FORBIDDEN`
- `externalPostId` ausente/vacio en respuesta
- `post.id=f029424c-386c-45f7-94b4-d808c1db119a`
- `post.status=FAILED`
- `x-drako-correlation-id=49b568c9-c8ec-4389-8f18-6088cc2ba5ca`

Interpretacion:

- El intento controlado se ejecuto una sola vez.
- No se completo publicacion externa en LinkedIn.

## D1 safe verification post-intento

Query remota read-only (sin `SELECT *`):

```sql
SELECT id, tenant_id, saas_id, provider, status, external_post_id, updated_at
FROM saas_social_posts
WHERE id = 'f029424c-386c-45f7-94b4-d808c1db119a'
  AND tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
LIMIT 1;
```

Resultado:

- `id=f029424c-386c-45f7-94b4-d808c1db119a`
- `tenant_id=tenant_socialflow_canary_staff`
- `saas_id=p2-24i-saas`
- `provider=LINKEDIN`
- `status=FAILED`
- `external_post_id=null`
- `updated_at=2026-05-21T15:53:25.283Z`

## Leakage audit

- `accessToken`: no
- `idToken`: no
- `auth_meta`: no

## Scheduler/autopublish guard

- setup/status en prod mantiene `publishBlockedByPilotMode=true`
- test dirigido `tests/lib/social-scheduler.test.ts` en verde con caso `SKIPPED` en private pilot mode

## Freeze/rollback plan

- no reintentar publish automatico
- mantener private pilot mode activo
- no habilitar scheduler/autopublish
- conservar correlation id del intento para trazabilidad
- cualquier nuevo intento requiere nueva aprobacion humana explicita

## Que NO cambio

- no DNS
- no workers.dev
- no wildcard global
- no cutover global
- no cambio de allowlist de tenants
- no desactivacion de private pilot mode

## Validacion obligatoria de fase

Ejecutada despues del intento controlado:

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS

## Dictamen final P2-35C

- `controlled-real-publish-executed: si (1 intento controlado)`
- `explicit-human-approval-captured: si`
- `published-post-id: f029424c-386c-45f7-94b4-d808c1db119a`
- `external-post-id-present: no`
- `tenant-scope-valid: si`
- `token-leakage: no`
- `scheduler-autopublish-remained-blocked: si`
- `private-pilot-can-continue: si (controlado, sin autopublish)`
- `production-cutover-ready: no`
- `next phase: P2-36 post-publish monitoring and pilot learning loop`
