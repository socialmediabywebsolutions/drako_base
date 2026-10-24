# Auth SSOT Contract (P1)

Fecha: 2026-02-27

## Alcance de capas
- Campamento Base (holding): `bases.drako.systems`
- Drako Factory: `drako.systems` y frontera `drakos`
- Vertical Mentorías: `mentoria*.drako.systems` y frontera `mentorias`

## SSOT de usuarios por capa
- `drakos`:
  - API canónica: `/api/drakos/auths/{registrations,logins,logouts}`
  - Tablas SSOT: `drakos_users`, `drakos_credentials`, `drakos_sessions`
  - Binding DB esperado: `DRAKOS_AUTHS_DB` (fallback bloqueable por política)
- `mentorias`:
  - API canónica: `/api/mentorias/auths/{registrations,logins,logouts}`
  - Tablas SSOT: `mentorias_users`, `mentorias_credentials`, `mentorias_sessions`
  - Binding DB esperado: `MENTORIAS_AUTHS_DB` (fallback bloqueable por política)
- `bases` (holding):
  - API canónica: `/api/bases/auths/{logins,logouts}`
  - Registro final-user deshabilitado: `/api/bases/auths/registrations` => `403`
  - Binding DB esperado: `BASES_AUTHS_DB` para sesión administrativa

## Claims de sesión obligatorias
- `tenant_id` (`tenantId` en token interno)
- `saas_slug` (`saasSlug` en token interno; valores: `drako`, `mentorias`, `campo_base`)
- `role`

Validación obligatoria en verificación de token:
- `iss` y `aud` por contexto.
- `context` y `saasSlug` deben coincidir con frontera (`drakos`/`mentorias`/`bases`).

## Service bindings permitidos
- Holding <-> Factory:
  - permitido para métricas, billing interno, eventos, soporte.
- Factory <-> Vertical:
  - permitido solo para aprovisionamiento y operaciones internas autorizadas.
- Auth final-user:
  - NO usa service-binding cross-context.
  - Cada frontera resuelve su propio endpoint y su propio contexto.

## Prohibiciones explícitas
- Cross-register (`drako -> mentorias` o `mentorias -> drako`) en UI o middleware.
- Cross-login entre fronteras (`drakos` token/cookie válido en `mentorias`, o viceversa).
- Campamento Base registrando usuarios finales de verticales.
- Uso de endpoints legacy `/api/auth/register` y `/api/auth/login` como flujo activo.
- Overrides de contexto por query/body/header no confiables.

## Guardrails técnicos activos
- `enforceAuthBoundary(...)` en endpoints auth por frontera:
  - bloquea `HOST_CONTEXT_MISMATCH`
  - log estructurado `AUTH_BOUNDARY_VIOLATION`
- `AUTHS_REQUIRE_CONTEXT_DB=true` para exigir binding contextual de auth.
- `verify-auth-ssot` (script) y `auth-cross-redirects.test.ts` (test) para drift guard en CI.
