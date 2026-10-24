# P2-35E - LinkedIn OAuth Scope Reconnection Remediation

Fecha: 2026-05-21

Modo: remediacion controlada sin publish real.
No se ejecuto `confirmPublish=true`. No se publico contenido real. No se creo nuevo post. No se toco DNS, workers.dev ni cutover.

## Contexto heredado (P2-35D)

- causa raiz confirmada: token OAuth conectado sin `w_member_social`
- scope detectado en cuenta conectada: `email,openid,profile`
- fallo heredado de publish: `LINKEDIN_PUBLISH_FORBIDDEN`
- reconnect requerido: si

## Fase 1 - Verificacion de codigo y necesidad de deploy

### Scope en codigo

Confirmado en codigo local:

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts:10`
- `src/lib/socialflow/linkedin/types.ts:10`
- valor: `openid profile email w_member_social`

### Necesidad de deploy

Para que `socialflow.drako.systems` sirva el scope nuevo en runtime, el worker productivo debe incluir estos cambios.

Comando preparado (no ejecutado en esta fase sin aprobacion):

`pnpm exec wrangler deploy --config=workers/socialflows/wrangler.workers.toml`

## Fase 2 - Deploy controlado

- estado: **pendiente de aprobacion humana**
- no se ejecuto deploy en esta fase

## Fase 3 - Connect OAuth en produccion (evidencia real)

Se intento validar flujo remoto:

- `POST /api/socialflow/auths/logins` -> `401`
- `GET /api/socialflow/linkedin/connect?saasId=p2-24i-saas` -> `401 SESSION_REQUIRED`
- `POST /api/socialflow/linkedin/validate-connection` -> `401 SESSION_REQUIRED`

Implicacion:

- sin sesion staff/admin valida no es posible generar `authorizationUrl` productiva desde API en esta fase
- el reconnect manual asistido queda bloqueado hasta resolver acceso de sesion

## Fase 4 - Reconnect manual asistido

No ejecutado por bloqueo de sesion (`SESSION_REQUIRED`).

Flujo preparado para ejecutar en cuanto haya sesion valida:

1. abrir `GET https://socialflow.drako.systems/api/socialflow/linkedin/connect?saasId=p2-24i-saas`
2. completar consentimiento LinkedIn con la cuenta correcta
3. confirmar callback exitoso
4. validar post-reconnect (API + D1 safe query)

## Fase 5 - D1 safe verification (read-only, sin `SELECT *`)

Query segura ejecutada sobre `saas_social_accounts` (tenant piloto):

- `tenant_id=tenant_socialflow_canary_staff`
- `saas_id=p2-24i-saas`
- `provider=LINKEDIN`
- `status=CONNECTED_REAL`
- `oauth_scope=email,openid,profile`
- `access_token_encrypted=1`
- `id_token_encrypted=1`
- `author_urn=urn:li:person:gZCPSE0lWC`
- `profile_id=gZCPSE0lWC`
- `last_error_code=null`
- `updated_at=2026-05-21T12:48:53.746Z`

Conclusiones:

- scope de escritura aun ausente en token activo (`w_member_social` no presente)
- cifrado de tokens correcto
- author/profile consistentes

## Fase 6 - No retry publish

Confirmado:

- no se reintento publish real
- no se ejecuto `confirmPublish=true`
- no se toco el post FAILED heredado

## Leakage audit

- `accessToken`: no
- `idToken`: no
- `auth_meta`: no

## Que NO cambio

- no deploy remoto
- no reconnect OAuth completado
- no publish real
- no scheduler/autopublish
- no DNS/workers.dev/wildcard/cutover

## Validaciones ejecutadas en esta fase

- evidencia remota read-only de login/connect/validate (sin sesion valida)
- evidencia D1 read-only de scope/token flags/author-profile
- no cambios de runtime remoto aplicados

## Fase 7 - Validacion obligatoria

- `pnpm socialflow-runtime:build` -> PASS
- `pnpm typecheck` -> PASS
- `pnpm build` -> PASS
- `pnpm test` -> PASS
- `git diff --check` -> PASS

## Decision sobre nuevo intento real

- **no permitido todavia**
- condicion necesaria antes de P2-35F:
  - reconnect completado con scope que incluya `w_member_social`
  - `validate-connection` en `200` con `CONNECTED_REAL` y token cifrado

## Dictamen final P2-35E (estado actual)

- `linkedin-reconnect-executed: no`
- `w_member_social-present: no`
- `connected-real-after-reconnect: no` (reconnect no ejecutado)
- `encrypted-token-after-reconnect: no` (reconnect no ejecutado; cifrado actual si)
- `author-match-after-reconnect: no` (reconnect no ejecutado; match actual si)
- `token-leakage: no`
- `retry-real-publish-allowed: no`
- `next phase: P2-35E continuation (deploy + manual reconnect + post-reconnect validation), luego P2-35F si pasa`
- `production-cutover-ready: no`
