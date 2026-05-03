# 08_socialflow_saas_automatizacion_social

## Qué es
Documento técnico de SocialFlow como SaaS de automatización social dentro del ecosistema Drako.

## Para qué sirve
- Delimitar su frontera de producto y auth.
- Alinear rutas de marketing, auth y workspace.
- Mantener separación con Mentoría y Campamento Base.

## Qué soluciona
- Confusión entre operator social y producto SocialFlow.
- Errores por reutilizar rutas de auth de otros contextos.
- Derivas entre superficie comercial y superficie productiva.

## Cómo se comporta

### 1) Superficies funcionales
- Marketing/producto:
  - `src/app/products/socialflow/page.tsx`
- Auth de producto:
  - `src/app/socialflow/auth/page.tsx`
  - API: `/api/socialflow/auths/registrations`, `/api/socialflow/auths/logins`
- Workspace:
  - `src/app/socialflow/*`
- Operator social:
  - `src/app/operator/socialflow/page.tsx`

### 2) Auth boundary SocialFlow
- Endpoints implementan `enforceAuthBoundary(... expectedContext: "socialflow")`.
- Registro/login usan `socialflowAuths`.
- Emisión de sesión con cookie de contexto `socialflow`.
- Redirect post-login hacia `/socialflow`.

### 3) Diferencia con Campamento Base
- SocialFlow producto ≠ control plane.
- Operator social (`/operator/socialflow`) opera capacidades internas, no reemplaza auth/UX de tenant.
- Campamento Base no importa motores internos de SocialFlow. Cuando necesita ejecutar automatizacion usa el contrato
  `src/lib/socialflow/contracts/automation.ts`.
- Cuando Campamento Base necesita observar salud, scheduler, publicaciones, conexiones LinkedIn o eventos recientes,
  usa el contrato `src/lib/socialflow/contracts/observability.ts`.

### 3.1) Frontera de librerias
- `src/lib/social-core/*`: contratos neutrales reutilizables de social publishing.
- `src/lib/socialflow/*`: runtime de producto SocialFlow, auth, repositorios publicos del producto, scheduler, publishing reliability, LinkedIn publishing y AI.
- `src/lib/socialflow/contracts/*`: frontera publica para operator/Campamento Base; expone automatizacion y observabilidad sin imports directos a motores internos.
- `src/lib/social/*`: compatibilidad legacy durante la verticalizacion; `repository`, `live-publishing`, `scheduler` y `linkedin-service` son facades deprecated hacia `src/lib/socialflow/*`.
- El estado `PUBLISHING`, el claim atomico, la recuperacion de posts atascados, los retries y la observabilidad de publicacion viven en `src/lib/socialflow/*`.
- El contrato de observabilidad operator devuelve health, scheduler status, conteo de posts por estado, publicaciones recientes, fallos recientes,
  posts atascados en `PUBLISHING`, resumen LinkedIn, metricas 7/30 dias y eventos/incidentes recientes.

### 4) Integración de routing
- Middleware protege fronteras para evitar cross-context.
- APIs de auth final-user no deben consumirse en host base/admin.
- OAuth de LinkedIn para SocialFlow se canoniza en `/api/socialflow/linkedin/connect` y `/api/socialflow/linkedin/callback`.
- Los bridges `/api/social/linkedin/connect`, `/api/social/linkedin/callback` y `/auth/linkedin/callback` solo deben redirigir con `308` hacia las rutas canonicas.

## Qué NO debe hacer
- No usar endpoints Mentoría para autenticación SocialFlow.
- No exponer operator controls directamente al tenant final.
- No asumir que marketing page equivale a auth workspace.
- No acoplar SocialFlow a paths legacy (`/dashboard`) sin pasar por redirects oficiales.
- No reactivar `/api/social/posts` ni `/api/social/linkedin/publish`; ambas rutas legacy deben seguir devolviendo `410`.
