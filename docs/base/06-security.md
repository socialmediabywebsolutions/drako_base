# Seguridad y Tenancy

## Principios
- Multi-tenant por diseño: toda request opera en un `tenantId`.
- No mezclar datos entre tenants.
- No “admin global” sin control.

## Cómo se obtiene tenantId (orden recomendado)
1) Header `x-tenant-id`
2) Cookie/sesión (si aplica)
3) Query param (solo dev/debug)
4) Default dev: `demo-tenant`

## Sesiones (dev vs prod)
- Dev: se puede habilitar demo-session por env flag (controlado).
- Prod: SESSION_SECRET real + cookies seguras + HTTPS.

## Hard rules
- Falta D1 binding o tablas → 503 con reason + hint
- Falta sesión → 401 claro
- Falta permisos → 403 claro
- Siempre correlationId en respuestas de error


## Sesión demo (solo dev)
- En preview local puedes usar `.dev.vars` con `SESSION_SECRET=dev-secret` y `DRAKO_ENABLE_DEMO_SESSION=1`.
- En producción, `SESSION_SECRET` debe ir como *secret* en Cloudflare (nunca en repo).
