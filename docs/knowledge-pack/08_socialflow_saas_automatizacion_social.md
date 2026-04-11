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

### 4) Integración de routing
- Middleware protege fronteras para evitar cross-context.
- APIs de auth final-user no deben consumirse en host base/admin.

## Qué NO debe hacer
- No usar endpoints Mentoría para autenticación SocialFlow.
- No exponer operator controls directamente al tenant final.
- No asumir que marketing page equivale a auth workspace.
- No acoplar SocialFlow a paths legacy (`/dashboard`) sin pasar por redirects oficiales.
