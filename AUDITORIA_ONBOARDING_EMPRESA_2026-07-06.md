# Auditoría — Onboarding de Empresa en Socialcors

Fecha: 2026-07-06. Solo lectura, ningún archivo modificado.

## 1. Pasos actuales del flujo de onboarding

Archivos: `src/app/socialflow/(workspace)/onboarding/{type,plans,plans-empresa}/page.tsx`, `src/app/socialflow/(workspace)/onboarding/page.tsx`, `src/app/api/socialflow/onboarding/{route.ts,account-type/route.ts}`.

El flujo real, en orden, es:

1. **`/socialflow/onboarding/type`** — dos tarjetas ("Soy Influencer" / "Soy Empresa o Negocio"). Al elegir, hace `POST /api/socialflow/onboarding/account-type` (guarda `account_type` en `socialflow_users`, fire-and-forget) y navega a `plans` o `plans-empresa`.
2. **`/socialflow/onboarding/plans-empresa`** — 3 planes (Básico/Pro/Elite, 99–199€) con checkout de Stripe. El copy es 100% específico de empresa ("Voz de marca en tercera persona", "CRM Social básico", "Base de Conocimiento (web + PDFs + catálogos)"...). El CTA secundario "Empezar gratis 7 días" lleva a `/socialflow/onboarding`.
3. **`/socialflow/onboarding`** — wizard de 4 pasos, **genérico**, exactamente el mismo componente para influencer y empresa (no hay ningún `if (accountType === "empresa")` en este archivo):
   - Paso 1 "Tu marca": `brandName` (requerido), `websiteUrl`, `niche` (requerido, texto libre).
   - Paso 2 "Tono y audiencia": `toneOfVoice`, `audienceDescription`, checkboxes de "redes sociales activas" (Instagram/TikTok/LinkedIn/Facebook/YouTube/X) — **es solo una etiqueta informativa sobre qué redes usa la marca, no conecta nada**.
   - Paso 3 "Competidores": mínimo 3 competidores (nombre, handle, plataforma) — validación bloqueante.
   - Paso 4 "Confirmar": resumen + botón "Generar mi auditoría".
   - Al enviar (`POST /api/socialflow/onboarding`), si hay `websiteUrl` se scrapea la web (`scrapeWebsite`) para keywords/topics, se marca `onboardingCompletedAt`, y se redirige a `/socialflow/audit`.
4. **`/socialflow/audit`** — auditoría IA de presencia social (score, fortalezas/debilidades, recomendaciones, comparativa con competidores). Único CTA al final: **"Ir al dashboard"**.

A partir de ahí el usuario cae en `/socialflow` (dashboard), donde el único checklist de onboarding que existe es el de `getSocialProductSummary` (`src/lib/socialflow/repository.ts`): *Conectar una cuenta → Crear una campaña → Programar un post → Revisar analíticas*. Ese es todo el guiado post-onboarding que existe.

**Conclusión punto 1:** la diferenciación empresa vs. influencer es **solo cosmética** — una tarjeta de selección y una página de planes con copy distinto. El wizard de datos, el perfil de marca (`ChannelProfile` en `src/lib/socialflow/profile/types.ts`) y el destino final son idénticos para ambos tipos. Esto coincide con el hallazgo ya documentado en `AUDITORIA_EMPRESA_2026-07-03.md` (sección 1), y sigue vigente hoy.

## 2. Qué falta para guiar al cliente empresa

### a) Configurar su negocio
**Falta casi todo lo estructural.** El wizard solo pide `brandName`, `websiteUrl`, `niche` (texto libre), `toneOfVoice`, `audienceDescription`. Revisando `ChannelProfile` completo (60+ campos), **no existe ni un solo campo** de: nombre legal/fiscal, dirección o ubicación física, horario de atención, teléfono/WhatsApp de contacto, sector como campo tipado (select), tamaño de equipo, o logo. "Sector" se cuela como texto libre dentro de `niche`. Nada de esto se pide en ningún punto del onboarding ni se persiste en ningún sitio del esquema actual.

### b) Subir fotos del local/equipo
**No existe en absoluto**, ni en onboarding ni en ningún otro punto del producto. Verifiqué las dos rutas de imagen que sí existen:
- `/socialflow/upload` (`UploadToPost`, en `src/components/socialflow/upload-to-post.tsx`) es "Foto → Post IA": sube una foto **para generar un post concreto**, no para enriquecer el perfil de marca.
- `/socialflow/knowledge` (Base de Conocimiento) tiene un tipo de asset `ChannelAsset.kind` que incluye `"image" | "screenshot" | "brand_guide"` a nivel de tipo, pero el cliente real (`knowledge-client.tsx`) **no expone ningún panel para subir imágenes** — sus paneles (`Panel` type) son solo `upload` (PDF/texto), `url`, `competitor`, `market`, `catalog`. La capacidad de subir imágenes de local/equipo no está conectada a ninguna UI, ni en onboarding ni en Knowledge Base.

### c) Subir catálogo CSV/Excel
**La funcionalidad ya existe y funciona (commit `a4f690b`, hoy), pero está desconectada del onboarding.** `/socialflow/knowledge` tiene un panel "Subir catálogo de productos (CSV o Excel)" (`knowledge-client.tsx` línea ~360) que acepta `.csv`/`.xlsx` y lo persiste vía `POST /api/socialflow/knowledge/upload` → `csv-extract.ts`/`xlsx-extract.ts`. Es real y utilizable. El problema es puramente de descubribilidad: el wizard de onboarding no lo menciona, no enlaza a `/socialflow/knowledge`, y no hay ningún checklist que le diga a la empresa "ahora sube tu catálogo". Un cliente empresa que termine el onboarding y vaya directo al dashboard puede no enterarse nunca de que esta pantalla existe, salvo que explore el menú lateral ("Base de conocimiento").

### d) Conectar redes sociales
**El onboarding no conecta nada — solo pregunta cuáles usas.** El paso 2 del wizard es un conjunto de checkboxes ("Redes sociales activas") que se guarda como metadato de perfil (`activeSocialNetworks`), pero no dispara ningún flujo OAuth. La conexión real de cuentas vive en `/socialflow/redes` (`src/app/socialflow/(workspace)/redes/page.tsx`, componente `SocialNetworksBoard`), con endpoints reales (`/api/socialflow/oauth/instagram/connect`, `/api/socialflow/meta/connect`, `/api/socialflow/linkedin/connect`). Esa página sí filtra por tipo de cuenta (empresa ve Instagram/Facebook/LinkedIn/TikTok/YouTube; influencer ve un subconjunto distinto), así que la diferenciación empresa **sí existe ahí** — pero de nuevo, el onboarding no enlaza ni redirige nunca a esta página. El único puntero indirecto es el ítem "Conectar una cuenta" del checklist del dashboard (`getSocialProductSummary`), que aparece después de terminar el onboarding, no durante.

## Resumen del gap

El onboarding actual termina en 4 pasos → auditoría → "Ir al dashboard", y ahí se detiene. Ninguno de los cuatro objetivos que pides guiar (negocio, fotos, catálogo, redes) tiene un paso dedicado dentro del wizard:

| Objetivo | Estado |
|---|---|
| Configurar negocio | Campos insuficientes (solo nombre/nicho/tono/audiencia); sin campos legales/ubicación/horario |
| Subir fotos local/equipo | No existe ninguna UI para esto, ni en onboarding ni fuera de él |
| Subir catálogo CSV/Excel | Existe y funciona, pero vive en `/socialflow/knowledge`, sin enlace desde onboarding |
| Conectar redes sociales | Existe y funciona (con diferenciación real empresa/influencer), pero vive en `/socialflow/redes`, sin enlace desde onboarding |

El patrón que se repite en c) y d) es el mismo: la funcionalidad ya está construida y funciona, pero el wizard de onboarding no la enlaza ni la menciona — el cliente empresa tiene que descubrirla por su cuenta en el menú lateral. No hay ningún paso final tipo "checklist de arranque" dentro del propio flujo de onboarding (el único checklist existente vive en el dashboard, después, y solo cubre conectar cuenta / crear campaña / programar post / revisar analíticas — ni fotos ni catálogo aparecen ahí tampoco).
