# 04_reglas_de_middleware_y_enrutamiento

## Qué es
Especificación técnica de las reglas activas en `src/middleware.ts` para routing, auth boundaries, host resolution y protección multitenant.

## Para qué sirve
- Documentar la lógica de entrada única de requests.
- Estandarizar comportamiento de redirects/rewrite por host y ruta.
- Facilitar auditorías de seguridad y aislamiento.

## Qué soluciona
- Enlaces legacy rotos y rutas ambiguas.
- Acceso indebido entre superficies admin y tenant.
- Falta de correlación y contexto en requests.

## Cómo se comporta

### 1) Principios operativos
- Fail-safe global: middleware nunca debe romper tráfico por excepción no controlada.
- Correlation ID obligatorio salvo bypass explícito.
- Resolución de host + modo (`PUBLIC_SAAS`, `CAMPAMENTO_BASE`, `PREVIEW`, etc.).

### 2) Reglas de redirect/rewrite legacy
- Workspace legacy:
  - `/dashboard*` -> `/socialflow*`
  - `/profile/setup*` -> `/socialflow/setup*`
- Operator legacy:
  - `/owner*` -> `/operator*`
  - `/campobase/platform*` -> `/operator/platform*`
  - `/campobase/socialflow*` -> `/operator/socialflow*`
  - `/campobase/social*` -> `/operator/social*`

### 3) Reglas Mentoria host-bound
Con `isRoutingsSubdomainsEnabled()` y host Mentoria:
- `/` -> rewrite `/site/mentoria`
- `/app*` -> rewrite `/mentoria/app*`
- `/onboarding*` -> rewrite `/mentoria/onboarding*`
- `/share*` -> rewrite `/mentoria/share*`
- `/signup` -> **redirect 308** `/mentorias/auths/registrations`
- `/login` -> rewrite `/mentorias/auths/logins`
- `/auth/register` -> rewrite `/mentorias/auths/registrations`
- `/auth/login` -> rewrite `/mentorias/auths/logins`

### 4) Reglas de auth/contexto
- En host base/admin:
  - se bloquea auth final-user por contexto con `403`.
- En API:
  - se adjuntan headers de contexto (`tenant`, `saas`, correlation).
- Tenant isolation:
  - rechazo `403` para acceso cross-tenant sin rol autorizado.

### 5) Protección de panel/admin
- `/site/panel*` requiere sesión y rol permitido.
- Sin sesión: redirección a login contextual.
- Con rol insuficiente: redirección a workspace cliente.

### 6) Guardrails de runtime
- Si detecta Cloudflare Pages env, responde `503` indicando workers-only enforcement.
- Si bindings no disponibles, continúa en modo mínimo sin romper request.

## Qué NO debe hacer
- No introducir lógica pesada o no determinista en middleware.
- No abrir rutas admin en host público.
- No eliminar rewrite/redirect legacy mientras existan entradas antiguas activas.
- No omitir chequeos de contexto en APIs de auth.
