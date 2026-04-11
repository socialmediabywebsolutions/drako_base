# 10_matriz_global_de_rutas_y_entrypoints

## Qué es
Matriz técnica de rutas globales y entrypoints para operación diaria, QA y auditoría de wiring.

## Para qué sirve
- Verificar coherencia de navegación por sistema.
- Detectar desvíos legacy en CTAs y redirects.
- Facilitar pruebas de regresión funcional.

## Qué soluciona
- Duplicidad de entrypoints por producto.
- Ambigüedad entre rutas públicas, auth y app.
- Errores de SSL/localhost por links hardcodeados.

## Cómo se comporta

## 1) Mentoría — rutas canónicas
### Público (landing)
- `/site/mentoria`
- `/site/mentoria-es`
- `/site/mentoria-mx`
- `/site/mentoria-ar`
- `/site/mentoria-cl`
- `/site/mentoria-co`

### Auth
- Registro: `/mentorias/auths/registrations`
- Login: `/mentorias/auths/logins`

### App
- Onboarding: `/mentoria/onboarding`
- Workspace: `/mentoria/app`
- Share: `/mentoria/share/*`

### Legacy controlado por middleware
- `/signup` en host Mentoria -> `308 /mentorias/auths/registrations`
- `/login` en host Mentoria -> rewrite `/mentorias/auths/logins`
- `/auth/register` -> rewrite `/mentorias/auths/registrations`
- `/auth/login` -> rewrite `/mentorias/auths/logins`

## 2) SocialFlow — rutas canónicas
### Producto/marketing
- `/products/socialflow`

### Auth
- UI: `/socialflow/auth`
- API: `/api/socialflow/auths/registrations`
- API: `/api/socialflow/auths/logins`

### Workspace
- `/socialflow`
- subrutas workspace en `src/app/socialflow/*`

### Operator social
- `/operator/socialflow`

## 3) Campamento Base — rutas operator
- Superficies operator/admin bajo prefijos de control (`/operator/*`, admin prefixes en middleware).
- En host público, prefixes admin se redirigen para evitar exposición.

## 4) Reglas globales de no-regresión
- Ningún CTA público de Mentoría debe apuntar a `/signup` legacy.
- Ningún CTA público de Mentoría debe apuntar a `https://localhost`.
- Entrypoints de auth deben respetar contexto de producto.

## Qué NO debe hacer
- No publicar nuevas rutas sin registrar su boundary de host y auth.
- No reutilizar rutas de producto en operator surfaces.
- No mantener CTAs con paths legacy fuera de compatibilidad controlada por middleware.
- No introducir shortcuts que omitan redirects/rewrite oficiales.
