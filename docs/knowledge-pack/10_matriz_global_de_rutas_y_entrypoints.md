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

## 0) Mapa canonico de producto

El runtime vendible del ecosistema no vive en `apps/*`. Las carpetas `apps/*`
son starters/manifests legacy para la vieja iniciativa multi-SaaS y no deben
tratarse como fuente canonica de UI, API, auth, D1 ni deploy.

| Capa/producto | Runtime canonico | Compat/legacy permitido | Nota operativa |
|---|---|---|---|
| Drako marca | raiz publica, marketing y `src/app/site/*` | `drakos` como auth/worker context | Drako es marca/casa central, no SaaS hijo vendible. |
| Campamento Base | `src/app/operator/*`, `src/app/api/operator/*`, `src/lib/campobase/*` | `/bases/*`, `/api/bases/*`, `/campobase/*`, `/api/campobase/*` | Holding/operator; no debe ejecutar motores internos de SaaS hijos. |
| Mentoria | `src/app/mentoria/*`, `src/app/api/mentoria/*`, `src/lib/mentoria/*` | `/mentorias/auths/*`, `/api/mentorias/auths/*`, workers plurales existentes | SaaS educativo independiente; no tocar aula/chat/pizarra sin evidencia critica. |
| SocialFlow | `src/app/socialflow/*`, `src/app/api/socialflow/*`, `src/lib/socialflow/*`, `src/lib/social-core/*` | `/socialflows`, workers plurales existentes, `/api/social/*` bloqueado/bridgeado | SaaS social independiente; Campamento Base consume contratos publicos. |
| Factory | `src/app/api/factory/*`, `src/app/api/owner/factory/*`, workers de provisioning | runbooks/templates legacy | Capacidad futura/provisioning, no home publica de Drako. |

## 0.1) Mapa canonico de dominios y workers (P10.11)

| Producto | Dominio canonico actual | Compat/alias | Worker canonico | Estado operativo |
|---|---|---|---|---|
| Drako marca | `drako.systems` | `drakos.drako.systems` | `saas-drakos-prod` | Marca/marketing activo; `drako-base-3` queda legacy/archived. |
| Campamento Base | `base.drako.systems` | `bases.drako.systems`, `admin.drako.systems` en codigo worker | `saas-bases-prod` | Operator/control plane; no producto publico vendible. |
| Mentoria | `mentoria.drako.systems` | `mentorias.drako.systems` | `saas-mentorias-prod` | SaaS activo, pero no fisicamente independiente hasta completar `MENTORIA_DB`. |
| SocialFlow | `socialflows.drako.systems` confirmado | `socialflow.drako.systems` no aparece en config local | `saas-socialflows-prod` | SaaS activo con dominio plural; falta canon de deploy/smoke para venta bajo dominio propio. |
| Factory | rutas `/api/factory/*`, `/api/owner/factory/*` | `/api/owner/saas-factory/*` | OpenNext + `saas-factory-worker`/provisioner | Capacidad interna/futura, no producto publico final. |

Nota P10.11: el workflow canonico `.github/workflows/drako-factory-deploy.yml`
despliega scheduler, `saas-drakos-prod`, `saas-mentorias-prod` y
`saas-bases-prod`. `saas-socialflows-prod` tiene configuracion de worker, pero
no aparece en ese deploy canonico ni en los smokes de dominio del workflow.

### `apps/*` no es runtime canonico
- No debe contener `package.json`, `wrangler.toml`, `wrangler.jsonc`, `src/*`, APIs ni UI real.
- No debe importarse desde `src/*`, `workers/*` ni rutas productivas.
- Si un SaaS nuevo necesita plantilla, usar `apps/*` solo como referencia legacy o moverlo en una fase futura a templates controlados.
- Los workers plurales productivos (`workers/drakos`, `workers/mentorias`, `workers/bases`, `workers/socialflows`) no se renombran sin plan de deploy y redirects.

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
- API operator: `/api/operator/socialflow`
- Compat Campamento Base: `/api/campobase/socialflow` reexporta la ruta operator.
- Si se consulta con `tenantId` + `saasId`, la respuesta incluye `observability` desde
  `src/lib/socialflow/contracts/observability.ts`.

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
