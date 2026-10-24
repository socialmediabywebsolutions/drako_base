# Auditoría de solo lectura — Configuración OAuth Facebook Page y LinkedIn

**Fecha:** 2026-07-03
**Alcance:** Configuración OAuth (scopes, callback, app) para Facebook Page y LinkedIn en SocialFlow. Auditoría 100% de lectura, ningún archivo fue modificado. No se ha consultado ni tocado ningún dato del tenant `ea85eb95-3c1e-4192-a2de-333bba37b842` (Sofía Maren).

---

## FACEBOOK PAGE

### 1. Permisos OAuth solicitados

`SOCIALFLOW_META_SCOPES` (`src/lib/socialflow/meta/types.ts:10-11`):

```
pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights, instagram_content_publish, business_management
```

Usados en `buildSocialFlowMetaAuthorizationUrl` (`src/lib/socialflow/meta/client.ts:35`).

**Hallazgo crítico:** esta lista **no incluye `pages_manage_posts`**, que es el permiso que Meta exige para crear/publicar contenido en una Facebook Page (`POST /{page-id}/photos` o `/{page-id}/feed`, usados por el `publishFacebookPageContent` implementado recientemente en `meta/publishing.ts`). Con el scope actual, el token de página obtenido en el OAuth **no tendrá permiso de escritura** — las llamadas de publicación a Facebook fallarán en producción con un error de permisos de Graph API (probablemente `403`/`OAuthException`) hasta que se añada `pages_manage_posts` (y, si se publican fotos etiquetando ubicación o contenido patrocinado, posiblemente `pages_manage_ads`/`pages_manage_metadata`, no necesarios para el caso básico).

**Nota:** `instagram_content_publish` sí está presente y es correcto — ese permiso es el que permite la publicación real en Instagram vía el mismo flujo (`meta/connect` conecta Página + cuenta de Instagram vinculada en una sola llamada).

### 2. URL de callback/redirect

`SOCIALFLOW_META_CALLBACK_PATH = "/api/socialflow/meta/callback"` (`src/lib/socialflow/meta/types.ts:8`).

La URL completa se construye dinámicamente en `resolveMetaCallback` (`src/lib/socialflow/meta/core.ts:296-328`):
1. Primero intenta derivar el origin de la propia request entrante (`X-Forwarded-Host`, header `Origin`, o `request.url`).
2. Si no hay request, cae a variables de entorno en este orden: `APP_URL`, `NEXT_PUBLIC_APP_URL`, `BASE_URL`, `SITE_URL`, `NEXTAUTH_URL`, `CF_PAGES_URL`.
3. Último fallback: `http://localhost:3000`.

En producción, `APP_URL = "https://socialflows.drako.systems"` está configurado como variable de entorno del worker (`workers/socialflows/wrangler.workers.toml`, confirmado también en el log del último deploy: `env.APP_URL ("https://socialflows.drako.systems")`). Como las requests reales llegan con ese host, la URL de callback efectiva en producción es:

```
https://socialflows.drako.systems/api/socialflow/meta/callback
```

Esta misma URL debe estar registrada exactamente (incluyendo `https://` y sin barra final) en "Valid OAuth Redirect URIs" de la app de Meta — no puedo verificar desde el código si ya está registrada ahí, eso vive en el panel de developers.facebook.com, fuera del repositorio.

### 3. ¿Misma app que Instagram?

**Depende de qué "Instagram" te refieres — hay DOS integraciones de Instagram distintas en el código, con DOS apps distintas:**

- **Vía Facebook Login / Meta (`meta/connect`)**: usa `META_APP_ID` / `META_APP_SECRET` (`src/lib/socialflow/meta/core.ts:201-217`, `getMetaAppIdWithSource`/`getMetaAppSecretWithSource`). Esta es la MISMA app que Facebook Page — de hecho `handleSocialFlowMetaCallback` (`meta/oauth.ts:229-283`) conecta la Página **y** la cuenta de Instagram Business vinculada a ella **en la misma llamada OAuth**, persistiendo ambas cuentas (`meta/repository.ts:36-79`).
- **Vía Instagram Business Login standalone (`/api/socialflow/oauth/instagram/connect`)**: usa una app **completamente distinta**, `INSTAGRAM_APP_ID` (`src/lib/socialflow/instagram/oauth.ts:73`), cuyo valor en producción es `1534853271675778` (visible como variable de entorno en `workers/socialflows/wrangler.workers.toml:72` y confirmado en el log del deploy). Este flujo usa `graph.instagram.com` directamente (`authType: "instagram_business_login"`, ver `meta/publishing.ts:301`).

**No puedo confirmar desde el código si `META_APP_ID` (el usado por Facebook Page) es igual a `1613373934121074`** — ese valor no está en el repositorio (es un secreto de Cloudflare Worker, no una variable plana en `wrangler.workers.toml`), y el ID `1534853271675778` que sí aparece en el repo pertenece a la OTRA app (Instagram standalone), no a Facebook Page. Para confirmar el valor real de `META_APP_ID` hay que consultar los secretos del Worker en el dashboard de Cloudflare (`wrangler secret list` no expone valores) o el panel de Meta for Developers.

**Conclusión:** Facebook Page comparte app con la integración de Instagram-vía-Meta, pero **no** con la integración de Instagram standalone — son dos apps de Meta distintas configuradas en el mismo Worker.

### 4. Permisos mínimos que necesita la app de Meta para publicar en una Facebook Page

Según lo que el código intenta hacer (`publishFacebookPageContent`, `meta/publishing.ts`, llamadas a `/{pageId}/photos` y `/{pageId}/feed`):

- `pages_show_list` — listar páginas del usuario (ya solicitado).
- `pages_manage_posts` — **crear posts en la página (falta, ver punto 1)**.
- `pages_read_engagement` — ya solicitado, usado para leer métricas, no estrictamente necesario para publicar pero sí para el resto de la integración (`metrics-collector.ts`).
- La app de Meta necesita estar en modo "Live" (no Development) para que usuarios ajenos al equipo de desarrollo puedan autorizarla, y `pages_manage_posts` requiere **revisión de App Review de Meta** (permiso "Advanced Access") para funcionar con páginas de terceros — en modo Development solo funciona con páginas administradas por roles de la propia app. Esto no es verificable desde el código, es configuración del panel de Meta.

---

## LINKEDIN

### 1. Permisos OAuth solicitados

`SOCIALFLOW_LINKEDIN_SCOPES = "openid profile email w_member_social"` (`src/lib/socialflow/linkedin/types.ts:10`), usado en `buildSocialFlowLinkedInAuthorizationUrl` (`src/lib/socialflow/linkedin/client.ts:33`).

**Hallazgo crítico:** `w_member_social` permite publicar **como el perfil personal** del usuario que autoriza (`urn:li:person:...`). El código confirma esto explícitamente: `resolveLinkedInIdentity` construye `authorUrn: \`urn:li:person:${profileId}\`` (`src/lib/socialflow/linkedin/core.ts:758`), y `publishing.ts` usa ese `authorUrn` tal cual, sin ninguna rama para Company Page. **No hay ningún scope `w_organization_social` ni lógica de URN de organización (`urn:li:organization:...`) en ninguna parte del código.** Esto significa que hoy, para una cuenta empresa, LinkedIn se conecta y publica como el perfil personal de quien haga el OAuth — no como la Company Page de la empresa, aunque el marketing lo sugiera ("perfil o Página de empresa de LinkedIn", `socialflow-connected-accounts.tsx:44`).

### 2. URL de callback/redirect

`SOCIALFLOW_LINKEDIN_CALLBACK_PATH = "/api/socialflow/linkedin/callback"` (`src/lib/socialflow/linkedin/types.ts:8`).

Misma lógica de resolución dinámica que Meta (`resolveLinkedInOAuthDiagnostics`, patrón idéntico en `linkedin/core.ts`): origin de la request entrante, luego variables de entorno (`APP_URL` y equivalentes), luego `localhost:3000`.

En producción: `https://socialflows.drako.systems/api/socialflow/linkedin/callback`.

### 3. Tipo de app de LinkedIn necesaria

Con el scope actual (`w_member_social`, sin `w_organization_social`), basta una **LinkedIn Developer App estándar** con el producto **"Share on LinkedIn"** habilitado (da acceso a `w_member_social` para posts de perfil personal). No se necesita el **Marketing Developer Platform** ni la aprobación de **Community Management API** — esos solo son necesarios si en el futuro se quiere publicar como **Company Page** (`w_organization_social`), lo cual requeriría solicitar acceso a Marketing Developer Platform a LinkedIn (proceso de aprobación manual, no instantáneo) y añadir el flujo de selección de organización + URN `urn:li:organization:...`, ninguno de los cuales existe hoy en el código.

### 4. ¿Está el callback correctamente configurado para producción?

El **código** resuelve correctamente la URL de producción (`https://socialflows.drako.systems/api/socialflow/linkedin/callback`) siempre que la request llegue con ese host o que `APP_URL` esté seteado — ambas condiciones se cumplen hoy (confirmado en el deploy). Lo que **no puedo verificar desde el repositorio** es si esa URL exacta está registrada en "Authorized redirect URLs for your app" en el panel de LinkedIn Developers — eso vive fuera del código, en la configuración de la app en linkedin.com/developers. Si no coincide carácter por carácter (incluyendo el `https://` y la ausencia de barra final), LinkedIn rechazará el intercambio de código con `redirect_uri` mismatch — el código ya contempla y clasifica ese error (`LINKEDIN_AUTHORIZATION_CODE_INVALID`, `linkedin/core.ts:228`), lo que sugiere que este tipo de fallo ya se ha dado o se anticipó.

---

## Resumen de hallazgos (ordenados por severidad)

1. **Bloqueante para Facebook Page:** falta el scope `pages_manage_posts` en `SOCIALFLOW_META_SCOPES` (`meta/types.ts:10-11`). Sin él, la función de publicación en Facebook Page implementada recientemente fallará en producción con cualquier cuenta empresa real que conecte su página — el token nunca tuvo permiso de escritura. Hay que añadir el scope Y volver a autorizar las páginas ya conectadas (los tokens existentes no se actualizan retroactivamente al cambiar el scope solicitado).
2. **Limitación de diseño en LinkedIn:** no existe soporte para publicar como Company Page, solo como perfil personal (`w_member_social` + `urn:li:person`). Si el plan Empresa promete "voz de marca" también en LinkedIn, esto es inconsistente con lo que el código realmente hace ahí.
3. **No verificable desde el código:** el valor real de `META_APP_ID` (para confirmar si coincide con `1613373934121074`) y si las URLs de callback de producción están efectivamente registradas en los paneles de Meta y LinkedIn — ambos viven en configuración externa, no en el repositorio.
4. Facebook Page **sí** comparte app con Instagram-vía-Meta (mismo `META_APP_ID`), pero existe una tercera vía de Instagram completamente aparte (`INSTAGRAM_APP_ID = 1534853271675778`, standalone) que es una app de Meta distinta.
