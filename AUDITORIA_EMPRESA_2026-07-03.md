# Auditoría de solo lectura — Flujo Empresa de SocialFlow

**Fecha:** 2026-07-03
**Alcance:** Exclusivamente el segmento B2B/"Empresa" de SocialFlow (`src/app/socialflow`, `src/app/api/socialflow`, `src/lib/socialflow`, `workers/socialflows`). No se ha auditado ni modificado nada del flujo de Influencer salvo para señalar de pasada componentes compartidos. No se ha tocado código, configuración ni datos — auditoría 100% de lectura. No se ha consultado ningún dato del tenant `ea85eb95-3c1e-4192-a2de-333bba37b842` (Sofía Maren).

---

## 1. ¿Existe onboarding diferenciado para empresa?

**Respuesta: Parcial.**

Hay una pantalla de selección de tipo de cuenta real: `src/app/socialflow/(workspace)/onboarding/type/page.tsx` (`OnboardingTypePage`), con dos tarjetas ("Soy Influencer" / "Soy Empresa o Negocio") que llaman a `POST /api/socialflow/onboarding/account-type` (`src/app/api/socialflow/onboarding/account-type/route.ts`), el cual persiste `account_type` ("influencer"|"empresa") en la tabla `socialflow_users`. Según el tipo elegido, el usuario es enrutado a `/socialflow/onboarding/plans` o `/socialflow/onboarding/plans-empresa` (`OnboardingPlansEmpresaPage`, que sí muestra planes y copy exclusivos de empresa).

Sin embargo, el formulario real de recogida de datos de marca — `src/app/socialflow/(workspace)/onboarding/page.tsx` (`SocialFlowOnboardingPage`) y su endpoint `src/app/api/socialflow/onboarding/route.ts` — es **exactamente el mismo formulario genérico** para ambos tipos: `brandName`, `websiteUrl`, `niche`, `toneOfVoice`, `audienceDescription`, `activeSocialNetworks`, `competitors`. No hay campos estructurados específicos de empresa (nombre legal de empresa, sector como campo tipado, tamaño, NIF, etc.) — "sector" se recoge únicamente como texto libre dentro de `niche`. El tipo `ChannelProfile` (`src/lib/socialflow/profile/types.ts`) es un único esquema compartido sin distinción por `accountType`.

**Riesgo/gap:** La diferenciación es solo cosmética/de routing (tarjeta de selección + planes), no hay un wizard de negocio realmente distinto.

---

## 2. ¿La Knowledge Base ingesta PDFs/URLs de verdad y ese conocimiento llega al generador de contenido?

**Respuesta: Sí, con matices.**

- Extracción de PDF real (no wrapper de librería externa, parser de streams de contenido PDF hecho a mano): `src/lib/socialflow/knowledge/pdf-extract.ts` (`extractTextFromPdf`, `extractTextFromStream`). No soporta PDFs escaneados (solo texto embebido), lo declara explícitamente en comentario.
- Scraping de URL real vía `fetch` + regex/HTML parsing: `src/lib/socialflow/knowledge/scraper.ts` (`scrapeUrl`, `extractHtmlContent`).
- Ambos se guardan en D1 vía `saveKnowledgeDoc` (`src/lib/socialflow/knowledge/repository.ts`), invocados desde `src/app/api/socialflow/knowledge/upload/route.ts` y `src/app/api/socialflow/knowledge/url/route.ts`.
- El contexto se recupera con `getKnowledgeContext` (mismo repository.ts), que concatena y trunca (no hay embeddings/vector search, es RAG básico por concatenación con límites de caracteres: `CONTEXT_SNIPPET=800`, `CONTEXT_DOCS=5`).
- Este contexto **sí llega al generador**: `SocialFlowOrchestrator.buildProfile` (`src/lib/socialflow/ai/SocialFlowOrchestrator.ts`, líneas ~28-40) llama a `getKnowledgeContext` y lo concatena a `longDescription`, que luego `ContentGeneratorAgent.run` (`src/lib/socialflow/ai/agents/ContentGeneratorAgent.ts`, función `richProfileLines`) inyecta en el prompt como "Contexto de marca". No es un campo decorativo.

**Riesgo/gap:** No hay chunking inteligente ni embeddings — es texto truncado a 800/2000 caracteres por documento; con catálogos grandes se pierde información. No hay OCR para PDFs escaneados (frecuente en catálogos de producto impresos/escaneados).

---

## 3. ¿El tono de tercera persona para empresa está realmente implementado, o es el mismo pipeline que influencer?

**Respuesta: No — es prácticamente el mismo pipeline, con un mecanismo endeble y una regla hardcodeada que lo contradice.**

- `voiceInstruction` no se decide por `accountType` en ningún punto del código. Se decide por una **heurística de regex** sobre texto libre en `SocialFlowOrchestrator.buildProfile` (líneas 42-47): si `personality`, `toneOfVoice`, `shortDescription` o el contexto de KB contienen palabras como "primera persona", "influencer", "creador/a", "mi marca", "mis seguidores" → fuerza primera persona; si no, `voiceInstruction = ""` (comentario en `src/lib/socialflow/ai/types.ts:11`: `"" = brand/third-person (default)`).
- El problema central: en `ContentGeneratorAgent.ts` línea 103, el prompt que se envía al modelo tiene **hardcodeada** la regla: `"⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de ... en tercera persona ni como si fuera una empresa."` — esta línea se envía **siempre**, independientemente de `profile.voiceInstruction`. Solo *después* de esa regla se añade `voiceInstruction` si no está vacío (línea 104), pero nunca se añade una instrucción equivalente que diga "tercera persona" explícitamente cuando está vacío. Es decir: el LLM recibe una instrucción explícita de primera persona en el 100% de los casos; el único lugar donde de verdad cambia el texto por "tercera persona" es en el **fallback local no-LLM** (líneas 142-172 del mismo archivo), que sí bifurca entre plantilla con "yo" y plantilla neutra según `profile.voiceInstruction`.
- Además, `src/app/api/socialflow/posts/generate-from-image/route.ts` (líneas 116-120, comentario: *"The upload flow is always a creator posting their own photo — force first-person voice regardless of what the profile heuristic derived"*) **fuerza primera persona siempre** en el flujo de subir foto, sin importar el `accountType`. Como el flujo de subida de foto es el mismo componente (`UploadToPost`) para ambos segmentos (ver punto 8), una empresa que sube una foto de producto recibirá un caption forzado en primera persona ("Te comparto...").

**Riesgo/gap (bloqueante para credibilidad de marca):** Una empresa que usa el flujo de "Subir foto" recibirá contenido en primera persona pese a que el plan promete "Voz de marca en tercera persona" (`onboarding/plans-empresa/page.tsx` línea 30). El pipeline de generación por IA vía prompt no tiene ninguna rama real de "tercera persona"; solo el texto de fallback local (no generado por IA) la respeta.

---

## 4. ¿Existe un CRM Social real (leads, pipeline) o solo comentarios aislados?

**Respuesta: Parcial — existe un CRM básico y funcional, pero minimalista.**

- Modelo de datos real: tabla `socialflow_leads` (`src/lib/socialflow/leads/repository.ts`, `ensureLeadsSchema`) con columnas `thread_id`, `provider`, `sender_name/handle`, `incoming_message`, `intent_score`, `temperature` (HOT/WARM/COLD), `status` (NEW/CONTACTED/CONVERTED/LOST).
- Detección automática de intención por regex ponderada: `src/lib/socialflow/leads/detector.ts` (`detectLeadSignals`, `scoreMessage`) — nota de paso: los patrones de señal mezclan intención de compra ("comprar", "precio") con señales típicas de influencer ("colaboración", "patrocinio", "embajadora"), es decir el detector es compartido entre segmentos, no específico de empresa.
- Endpoints CRUD: `src/app/api/socialflow/leads/route.ts` y `src/app/api/socialflow/leads/[id]/route.ts`; UI en `src/app/socialflow/(workspace)/leads/page.tsx` (`SocialFlowLeadsPage`) usando `LeadsPanel`.
- Ingesta real desde webhooks: `src/app/api/socialflow/conversations/inbound/route.ts` valida firma HMAC de Meta y crea el lead automáticamente al detectar señales.

**Riesgo/gap:** No hay pipeline visual de etapas (kanban), ni asignación a usuarios del equipo, ni notas/actividad/histórico de seguimiento, ni recordatorios — es una lista filtrable con 4 estados. La copy de la UI (`"Seguidores con intención de colaborar o contratarte"`) es texto de influencer reusado literalmente en la página de leads de empresa (compartido entre segmentos, solo se menciona de pasada).

---

## 5. ¿El dashboard de empresa es una UI distinta o el mismo componente reutilizado?

**Respuesta: Es el mismo componente, sin ninguna ramificación por `accountType`.**

`src/app/socialflow/(workspace)/page.tsx` (`SocialFlowDashboardPage`) no lee `accountType` en ningún punto — solo lee `planCode` (vía `resolveSocialFlowPlanCode`) para mostrar la etiqueta del plan y para que `DashboardMetrics` (`src/app/socialflow/(workspace)/_components/DashboardMetrics.tsx`, función `buildMetrics`) elija entre dos sets de métricas, pero la bifurcación es por **tier de plan** (`*_pro` vs el resto), no por segmento influencer/empresa: `influencer_pro` y `empresa_pro` comparten exactamente el mismo set de métricas. `SidebarNav` (`src/app/socialflow/(workspace)/_components/sidebar-nav.tsx`) tiene una única navegación fija (`mainNav`, `settingsNav`) sin ninguna condición por tipo de cuenta. `SocialFlowOperationsPanel.tsx` e `IntelligenceFeedPanel.tsx` tampoco contienen ninguna referencia a `accountType`/`empresa`/`influencer`.

**Riesgo/gap:** No hay diferenciación de UI/UX por segmento en absoluto — un cliente empresa ve literalmente el mismo dashboard, con el mismo ítem de menú "Subir foto" (icono de cámara) que un influencer.

---

## 6. ¿Existe multi-usuario con roles (admin/editor/viewer) para empresa?

**Respuesta: Parcial — multi-tenant sí, pero el modelo de roles es mucho más limitado que lo que promete el marketing.**

El tipo de rol en todo el sistema de auth es `role: "owner" | "admin" | "user"` (`src/lib/socialflow/auth/server.ts:16`, `src/lib/socialflow/auth/request.ts:13`, `src/lib/auths/repositories.ts:167`) — no existen roles "editor" ni "viewer" en ningún esquema. La página `src/app/socialflow/(workspace)/settings/team/page.tsx` (`SocialFlowTeamSettingsPage`) es **de solo lectura**: lista usuarios del tenant vía `listAuthsUsersByTenant` y lo declara explícitamente en el propio texto de la UI: *"La invitación y gestión de roles requiere un flujo nativo antes de habilitar acciones de escritura aquí"* / *"el flujo de invitación nativo está pendiente"*. No hay endpoint de invitación, ni de cambio de rol, ni tabla de "membership" con permisos granulares.

Además, la exigencia de "aprobación humana con rol admin" para publicar en vivo, declarada en `src/app/socialflow/(workspace)/setup/page.tsx` (*"Publicar en vivo requiere aprobación humana explícita (`confirmPublish=true`) y rol admin"*) **no está implementada en el endpoint real**: `src/app/api/socialflow/posts/[id]/publish/route.ts` no comprueba `session.role` en ningún punto antes de invocar `publishSocialPostLive`; cualquier usuario autenticado del tenant puede publicar. `src/app/api/socialflow/setup/status/route.ts` devuelve `requiresHumanApprovalForPublish: true` como valor **hardcodeado**, no derivado de ninguna comprobación real de rol.

**Riesgo/gap (bloqueante):** "2 usuarios (dueño + community manager)" y "usuarios ilimitados con roles y permisos" (copy de `empresa_pro`) no tienen ningún control de permisos diferenciado en código — no encontrado en código ningún endpoint de invitación o gestión de roles.

---

## 7. ¿Existen informes PDF mensuales generados de verdad?

**Respuesta: No — no encontrado en código.**

Búsqueda exhaustiva de librerías de generación de PDF (`jspdf`, `pdfkit`, `puppeteer`, `pdf-lib`) en `src/lib/socialflow`, `src/app/api/socialflow` y `package.json`: sin resultados. La única función real relacionada con PDF en todo el árbol de SocialFlow es `extractTextFromPdf` (lectura de PDFs subidos por el usuario para la Knowledge Base, no generación). "Informe mensual PDF" aparece únicamente como texto de marketing en tres sitios: `src/app/socialflow/(workspace)/onboarding/plans-empresa/page.tsx:34`, `src/app/socialflow/(workspace)/_components/trial-paywall.tsx:65` y el script del chatbot público `src/app/api/socialflow/public/chat/route.ts:35`. No existe cron, endpoint `reports`, ni ninguna lógica que genere ese informe.

**Riesgo/gap (bloqueante):** Se está vendiendo una feature ("Informe mensual PDF") de la que no existe ni una línea de implementación.

---

## 8. ¿El flujo de subida de contenido para empresa es distinto al de influencer?

**Respuesta: No — es exactamente el mismo endpoint y componente, sin ninguna rama por segmento.**

`src/app/socialflow/(workspace)/upload/page.tsx` renderiza `UploadToPost` (`src/components/socialflow/upload-to-post.tsx`, 1138 líneas) — una búsqueda de `accountType|empresa|influencer|catalog|catálogo` en ese archivo no arroja ninguna coincidencia. El endpoint que procesa la imagen, `src/app/api/socialflow/posts/generate-from-image/route.ts`, tampoco lee `accountType` en ningún punto, y como se detalla en el punto 3, fuerza voz en primera persona de forma incondicional para "el flujo de subida" completo. No hay ningún endpoint separado tipo "subir catálogo de productos" o "generar post de empresa desde imagen de producto" — la funcionalidad de "la IA conoce tu catálogo" (copy de `onboarding/type/page.tsx` línea 32) depende enteramente de que el catálogo se haya subido antes como documento a la Knowledge Base (punto 2), no de un flujo de subida diferenciado.

**Riesgo/gap:** Coincide totalmente con el hallazgo del punto 3 — mismo endpoint, mismo componente, sin diferenciación real de segmento.

---

## 9. ¿Qué redes sociales están REALMENTE conectables y publicables hoy?

**Respuesta: Solo 2 redes tienen publicación real end-to-end (Instagram y LinkedIn); Facebook solo conecta pero no publica; TikTok, Pinterest y X no existen en absoluto en código.**

- **Instagram**: OAuth completo (`src/lib/socialflow/instagram/oauth.ts`, 357 líneas; también vía Meta en `src/lib/socialflow/meta/oauth.ts`) + publicación real contra Graph API con creación de contenedor, polling de video y publish (`src/lib/socialflow/meta/publishing.ts`, función `publishInstagramContent`). Wired en `src/lib/socialflow/live-publishing.ts`.
- **LinkedIn**: OAuth completo (`src/lib/socialflow/linkedin/oauth.ts`, 447 líneas) + publicación real (`src/lib/socialflow/linkedin/publishing.ts`).
- **Facebook Page**: Tiene botón de conexión OAuth real (`src/components/settings/socialflow-connected-accounts.tsx`, provider `FACEBOOK_PAGE` → `/api/socialflow/meta/connect`) y se persiste en `src/lib/socialflow/meta/repository.ts`, pero **no tiene ninguna función de publicación**: `SUPPORTED_PROVIDERS` en `src/lib/socialflow/live-publishing.ts:19` es literalmente `new Set(["LINKEDIN", "INSTAGRAM"])` — Facebook Page queda excluido de la publicación en vivo. Solo se usa para leer métricas/insights (`src/lib/socialflow/meta/metrics-collector.ts`).
- **TikTok, Pinterest, X/Twitter**: no encontrado en código ningún cliente de API, OAuth ni publish — las únicas menciones son texto de marketing/copy (`billing/plans.ts`, `public/chat/route.ts`) o el scraper de competidores (que solo permite elegirlas como *plataforma de un competidor*, no conectar cuenta propia).

**Riesgo/gap (bloqueante):** El plan Empresa Básico se vende con "Instagram + Facebook + LinkedIn" pero Facebook no publica contenido real hoy — solo Instagram y LinkedIn lo hacen.

---

## 10. ¿Qué es lo mínimo que existe HOY para vender "Empresa Básico" (79€/mes)?

Definiciones de plan en `src/lib/socialflow/billing/plans.ts` (`empresa_basica`) y enforcement en `src/lib/socialflow/billing/enforce.ts`:
- `PLAN_MAX_CHANNELS.empresa_basica = 5` (no 1 — el código permite hasta 5 canales, muy por encima de lo que asumía el enunciado de esta auditoría; y de hecho por encima de los 3 canales anunciados —IG+FB+LinkedIn— en el copy del propio plan).
- `PLAN_MAX_UPLOADS_PER_BATCH.empresa_basica = 30` (límite de imágenes por lote de subida, no un límite de "posts/día"; **no existe en código ningún límite de "2 posts/día"** — no encontrado tras revisar `enforce.ts`, `posts/route.ts`, `campaigns/route.ts`, `generate-from-image/route.ts` y `SocialFlowOrchestrator.ts`). El único tope real de cadencia es `numPosts = Math.max(1, Math.min(28, frequencyPerWeek))` en `SocialFlowOrchestrator.generateFullCampaign`, es decir máx. 4/día de media si se pide 28/semana, sin relación con el plan contratado.
- `PLAN_AI_ALLOWED.empresa_basica = true`.
- El guard de canal (`guardChannelLimit`) solo se invoca al conectar cuentas (`oauth/instagram/connect`, `meta/connect`); el guard de IA (`guardAiAccess`) solo se invoca en `ai/generate` y `ai/chat`. El endpoint de subida de foto (`generate-from-image/route.ts`), que es el flujo principal de contenido, **no llama a ningún guard de plan** — no hay enforcement de "30 posts/mes por red" en ese path.

### Funciona end-to-end hoy para Empresa Básico:
- Registro, login, selección de tipo de cuenta "empresa", checkout Stripe con el price ID de `empresa_basica` (`src/app/api/socialflow/billing/checkout/route.ts`).
- Onboarding genérico de marca (marca, web con scraping real, nicho, competidores).
- Ingesta de Knowledge Base (PDF/URL) con extracción real de texto, inyectada en el prompt de generación.
- Conexión OAuth real de Instagram y LinkedIn, y publicación real en ambas.
- Generación de captions por IA a partir de una foto subida (aunque forzando primera persona, ver punto 3).
- Detección básica de leads desde comentarios/DMs entrantes vía webhook con firma verificada.
- Exportación de datos (`settings/ownership`, `/api/socialflow/exports/current`).

### Falta o está roto/incompleto para ese plan específico:
- **Bloqueante:** Voz de marca en tercera persona — el pipeline de IA fuerza primera persona en el prompt real (punto 3).
- **Bloqueante:** Facebook no publica (solo Instagram + LinkedIn), pese a estar en el nombre del plan.
- **Bloqueante:** "Informe mensual PDF" — no existe ninguna línea de código (punto 7).
- **Bloqueante:** Roles/permisos multi-usuario ("dueño + community manager") — no hay invitación ni control de acceso diferenciado; la página de equipo es de solo lectura (punto 6).
- **No bloqueante pero engañoso:** Límite de "30 posts/mes por red" y "2 posts/día" no están aplicados en ningún guard — el sistema no impedirá ni facturará de más ni de menos según el uso real de contenido.
- **No bloqueante:** CRM Social es básico (lista con 4 estados, sin pipeline visual ni asignación de equipo) — cumple mínimamente la promesa de "CRM Social básico" pero es rudimentario.
- **No bloqueante:** "Análisis reseñas Google Business" y "Campañas por temporada automáticas" (copy de `plans-empresa/page.tsx`) no se pudieron verificar en el código revisado — no encontrado.

---

## Resumen ejecutivo: qué falta para vender Empresa Básico hoy

### Gaps bloqueantes (impiden vender honestamente el plan tal como está anunciado)
1. **Voz de tercera persona no implementada realmente** — el prompt del `ContentGeneratorAgent` fuerza primera persona siempre; solo el fallback no-IA respeta el tono de empresa (`src/lib/socialflow/ai/agents/ContentGeneratorAgent.ts:103`).
2. **Facebook no publica** — solo conecta; `SUPPORTED_PROVIDERS` en `live-publishing.ts` excluye `FACEBOOK_PAGE`.
3. **Informe mensual PDF inexistente** — cero código, solo copy de marketing.
4. **Multi-usuario con roles inexistente en la práctica** — página de equipo de solo lectura, sin invitación ni control de permisos; el "requiere rol admin para publicar" no está implementado en el endpoint de publish.
5. **Flujo de subida de contenido idéntico al de influencer** — mismo componente (`upload-to-post.tsx`), mismo endpoint, sin ninguna adaptación a "catálogo de empresa" o tono corporativo.

### Gaps no bloqueantes (mejorables pero no impiden operar el plan)
6. Límites de plan (posts/mes, posts/día, "1 red social" asumido en el enunciado) no están aplicados en ningún guard de código — riesgo de sobreuso/infrafacturación, no de venta imposible.
7. CRM Social es un listado simple sin pipeline visual, notas ni asignación — cumple la letra mínima de "CRM básico" pero es rudimentario.
8. Knowledge Base usa concatenación truncada en vez de embeddings/chunking — funcional para catálogos pequeños, degradará con catálogos grandes.
9. Onboarding sin campos estructurados propios de empresa (comparte esquema 100% con influencer).
10. No se pudo verificar en código "análisis de reseñas Google Business" ni "campañas por temporada automáticas" — features anunciadas sin evidencia encontrada.
