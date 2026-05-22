# P2-35D - LinkedIn Publish Forbidden Root Cause Audit

Fecha: 2026-05-21

Modo: auditoria de integracion + hardening seguro (sin reintento de publish real).
No se ejecuto `confirmPublish=true` en esta fase. No se creo otro post. No se toco DNS, workers.dev ni cutover.

## Resumen del fallo heredado (P2-35C)

- intento controlado unico aprobado sobre `post_id=f029424c-386c-45f7-94b4-d808c1db119a`
- resultado: `HTTP 409`
- `livePublish.ok=false`
- `livePublish.code=LINKEDIN_PUBLISH_FORBIDDEN`
- `external_post_id=null`
- `post.status=FAILED`
- correlation id: `49b568c9-c8ec-4389-8f18-6088cc2ba5ca`

## Fase 1 - Congelacion de estado

- no se modifico manualmente el post `FAILED`
- no se reseteo `external_post_id`
- no se ejecuto nuevo intento de publish
- se mantuvo private pilot mode activo

## Fase 2 - Auditoria de permisos (sin exponer token)

### Evidencia de codigo

- OAuth scope solicitado en runtime antes del fix estaba limitado a OpenID:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts:10`
  - valor anterior: `openid profile email`
- URL de connect usa ese scope:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/client.ts:50`
- scope del token se persiste en `auth_meta.scope`:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/repository.ts:112`

### Evidencia D1 segura (read-only, sin `SELECT *`)

Cuenta LinkedIn (`tenant_socialflow_canary_staff` / `p2-24i-saas`):

- `status=CONNECTED_REAL`
- `oauth_scope=email,openid,profile`
- `access_token_encrypted=1`
- `id_token_encrypted=1`
- `author_urn=urn:li:person:gZCPSE0lWC`
- `profile_id=gZCPSE0lWC`
- `last_error_code=null`

Conclusiones:

- el token conectado no tiene `w_member_social`
- el token fue emitido/actualizado bajo scope legacy sin publish scope

## Fase 3 - Auditoria de author/payload/endpoint

### Author y modo de publish

- author se construye como member URN:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts:653`
  - formato: `urn:li:person:{profileId}`
- en D1, `author_urn` y `profile_id` coinciden (sin mismatch)

### Endpoint y headers actuales

- endpoint de publish:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts:595`
  - `POST https://api.linkedin.com/v2/ugcPosts`
- headers usados:
  - `Authorization: Bearer <token>` (no expuesto)
  - `X-Restli-Protocol-Version: 2.0.0`
  - sin `LinkedIn-Version` (no se envia en este flujo)
  - evidencia: `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts:600`, `:644`

### Payload actual

- payload member UGC:
  - `author`
  - `lifecycleState: PUBLISHED`
  - `specificContent.com.linkedin.ugc.ShareContent.shareCommentary.text`
  - `visibility.com.linkedin.ugc.MemberNetworkVisibility: PUBLIC`
  - evidencia: `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts:603-617`

## Fase 4 - Captura segura de error LinkedIn (implementada)

Problema detectado:

- antes solo quedaban `lastErrorCode` + `lastErrorMessage` en metadata del post
- no se persistian de forma estructurada `status/serviceErrorCode/errorCode/requestId`

Cambios aplicados:

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts`
  - sanitizacion redacted del body de error provider
  - captura segura de `serviceErrorCode`, `errorCode`, `providerMessage`, `requestId`
  - incluye metadata tecnica segura: `endpoint`, `authorType`, `hasLinkedInVersionHeader`, `restliProtocolVersion`
- `apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.ts`
  - persistencia en `metadata.publication` de:
    - `providerStatus`
    - `providerServiceErrorCode`
    - `providerErrorCode`
    - `providerRequestId`
    - `providerEndpoint`
  - sin guardar tokens ni body completo

Tests agregados:

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.test.ts`
  - valida redaccion segura en forbidden y ausencia de campos sensibles
- `apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.test.ts`
  - valida persistencia segura de telemetry redacted en `metadata.publication`

## Fase 5 - Causa raiz y clasificacion de hipotesis

### Hipotesis evaluadas

1. Falta scope `w_member_social` -> **SI (confirmado)**
2. Token emitido sin scope nuevo / requiere reconnect -> **SI (confirmado)**
3. Publish organizacion sin `w_organization_social` -> **NO (no aplica al caso actual)**
4. Falta rol en organizacion -> **NO (no aplica al caso actual)**
5. Author URN mismatch -> **NO (author/profile match)**
6. Endpoint/header version issue -> **PARCIAL / secundario posible**
7. Payload invalido -> **NO hay evidencia primaria**
8. Producto LinkedIn no habilitado -> **DESCONOCIDO**
9. Token valido para validate pero no write -> **SI (observado)**
10. Error body especifico no persistido seguro -> **SI (cerrado con hardening)**

### Causa raiz probable/confirmada

Principal confirmada:

- scope de OAuth para SocialFlow no incluia `w_member_social`, por eso el token activo no tenia permiso de escritura.

Evidencia directa adicional del fallo:

- metadata de post fallido guardo mensaje provider:
  - `Not enough permissions to access: ugcPosts.CREATE.NO_VERSION`
  - `publication_last_error_code=LINKEDIN_PUBLISH_FORBIDDEN`

## Fase 6 - Reconnect (no ejecutado)

No se ejecuto reconnect OAuth en esta fase.
No se invalido conexion actual.
Se deja preparado para fase siguiente bajo aprobacion humana.

## Fase 7 - Hardening aplicado en codigo

### Scope OAuth actualizado para nuevos consentimientos

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts:10`
- `src/lib/socialflow/linkedin/types.ts:10`
- nuevo scope: `openid profile email w_member_social`

### Guard de author/scope en runtime publish

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts`
- member publish exige `w_member_social`
- organization publish exige:
  - `w_organization_social`
  - rol organizacional permitido

Codigos nuevos:

- `LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL`
- `LINKEDIN_SCOPE_MISSING_W_ORGANIZATION_SOCIAL`
- `LINKEDIN_ORGANIZATION_ROLE_MISSING`

Tests:

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.test.ts`
  - scope member obligatorio
  - author member correcto
  - bloqueo organization sin scope/rol

### Scope test de connect

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/client.test.ts`
  - valida inclusion de `w_member_social` en URL OAuth

## Fase 8 - Validaciones ejecutadas

Validacion dirigida:

- `pnpm vitest --run apps/socialflow-runtime/src/lib/socialflow/linkedin/client.test.ts apps/socialflow-runtime/src/lib/socialflow/linkedin/core.test.ts apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.test.ts apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.test.ts apps/socialflow-runtime/src/app/api/socialflow/posts/route.test.ts tests/lib/linkedin-publish.test.ts`
- resultado: PASS (20 tests)

Validacion obligatoria completa: ver seccion final de este documento (fase 9).

## Fase 9 - Que NO cambio

- no reintento de publish real
- no `confirmPublish=true` nuevo
- no DNS
- no workers.dev
- no cutover
- no cambio de tenant allowlist
- no desactivacion de private pilot mode

## Validacion obligatoria de fase

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS

## Dictamen final

- `linkedin-publish-forbidden-root-cause: token de LinkedIn sin scope de escritura (w_member_social) bajo flujo OAuth legacy; write bloqueado por permisos`
- `missing-scope: si`
- `author-mismatch: no`
- `organization-permission-issue: no`
- `reconnect-required: si`
- `code-change-required: si`
- `safe-error-capture-added: si`
- `token-leakage: no`
- `retry-real-publish-allowed: no`
- `next phase: P2-35E LinkedIn OAuth Scope/Reconnection Remediation, solo si aplica`
