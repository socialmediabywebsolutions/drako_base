# Auditoría — Flujo de Campañas en Socialcors/SocialFlow

Fecha: 2026-07-06. Solo lectura, ningún archivo fue modificado.

## 0. Hallazgo previo importante: hay DOS implementaciones paralelas

Antes de entrar en el detalle de cada archivo, esto condiciona todo lo demás:

- **`src/app/api/socialflow/campaigns/route.ts`** (+ `src/lib/socialflow/repository.ts`, tipos en `src/lib/social-core/types.ts`) es la implementación que corre en **producción**. La UI real (`SocialFlowDashboard` → `SocialFlowWorkspaceClient.tsx`) se renderiza desde `src/app/socialflow/(workspace)/page.tsx`, que es parte del Next.js raíz. El worker `saas-socialflows-prod` (`workers/socialflows/wrangler.workers.toml`, `main = ../../.open-next/socialflows-standalone/worker.js`) se construye a partir de este árbol raíz vía `opennextjs-cloudflare build`.
- **`apps/socialflow-runtime/...`** (`campaigns-service.ts`, `campaigns-repository.ts`, su propio `route.ts`) es una **app Next.js separada** (`@drako/socialflow-runtime`, con su propio `package.json`/`next dev`/`next build`). No está referenciada por el worker de producción actual; todo apunta a que es un runtime "canary" en construcción (existe un worker `socialflows-runtime-canary` y un `socialflows-runtime-scaffold` en `build/`).

**Conclusión:** cualquier trabajo de negocio (UI real de campañas) debe hacerse sobre `src/app/api/socialflow/campaigns/route.ts` + `src/lib/socialflow/repository.ts` + `SocialFlowWorkspaceClient.tsx`. El código en `apps/socialflow-runtime` es un sistema aparte, con su propio modelo de tipos (`RuntimeSocialCampaign` en `apps/socialflow-runtime/src/lib/socialflow/contracts.ts`) que **solo soporta 5 estados** (`DRAFT | ACTIVE | PAUSED | FINISHED | ARCHIVED`), sin `GENERATING` ni `FAILED`. No confundir ambos al planificar cambios.

---

## 1. `src/app/api/socialflow/campaigns/route.ts` y archivos relacionados

Ruta real de producción. Implementa `GET`, `POST`, `PATCH` (no hay `DELETE`).

- **GET**: requiere `saasId` en query + sesión (`requireCurrentSocialFlowSession`). Llama a `listSaasSocialCampaigns(ctx)` (`src/lib/socialflow/repository.ts:121`). Devuelve `{ items, count }`.
- **POST**: crea/actualiza (upsert) vía `upsertSaasSocialCampaign`. **Solo acepta `status` `ACTIVE` o `PAUSED`** en `ALLOWED_CAMPAIGN_STATUSES` (línea 7) — si el body trae `DRAFT`, `FINISHED`, `ARCHIVED`, `GENERATING` o `FAILED`, la API responde `400 INVALID_STATUS`. Esto es una restricción de la API, no solo de la UI.
- **PATCH**: busca la campaña actual con `listSaasSocialCampaigns(ctx).find(...)` (o sea, hace un `SELECT *` completo solo para encontrar un id — no hay `getCampaignById`), y aplica la misma validación `ALLOWED_CAMPAIGN_STATUSES` de solo 2 estados.
- **No existe `DELETE`** ni endpoint por id (`/api/socialflow/campaigns/[id]`).

En `src/lib/socialflow/repository.ts`:
- Tabla real: `saas_social_campaigns`, columnas exactamente como describe la auditoría previa.
- `upsertSaasSocialCampaign` hace `INSERT ... ON CONFLICT(id) DO UPDATE` con guarda `WHERE tenant_id = excluded.tenant_id AND saas_id = excluded.saas_id` (aislamiento multi-tenant correcto a nivel SQL).
- El tipo real de estado — `SaasSocialCampaignStatus` en `src/lib/social-core/types.ts:81` — tiene **7 valores**: `DRAFT | GENERATING | ACTIVE | PAUSED | FINISHED | ARCHIVED | FAILED`. Coincide con lo que reportó la auditoría previa.
- Otras funciones relevantes ya existentes: `getSocialCampaignPerformance` (cruza campañas con posts y con `appointments` vía `socialCampaignId` para estimar revenue), `getSocialProductSummary` (cuenta `activeCampaigns`, `archivedCampaigns`, usa el conteo de campañas como paso de onboarding).

## 2. Componente de formulario de campaña

Hay **dos** formularios de campaña, y uno de ellos es código muerto:

- **`src/app/components/socialflow/CampaignForm.tsx`**: componente standalone, `POST /api/socialflow/campaigns` con solo `name` + `status` (`ACTIVE`/`PAUSED`). **Confirmado por grep: no se importa desde ningún lado del árbol `src/` ni `apps/`.** Es código huérfano — no está montado en ninguna página ni componente actualmente.
- **El formulario real en uso** está **inline** dentro de `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx` (no es un componente separado):
  - `CampaignFormState` (línea 71) sí modela 5 estados en el `<select>` de creación/edición (línea 2330-2340: Draft, Active, Paused, Finished, Archived) — **le falta `GENERATING` y `FAILED`** de los 7 reales, pero al menos permite elegir Draft/Finished, no solo Active/Paused.
  - Sin embargo, las **acciones post-creación** (línea 2409-2432) solo ofrecen dos botones: **"Activate"** (fuerza `ACTIVE`) y **"Archive"** (fuerza `ARCHIVED`) — de ahí el "solo 2 estados accesibles desde UI" que señaló la auditoría previa: aunque el formulario de creación permite elegir 5, una vez creada la campaña la única forma de cambiar el estado desde la UI es Activar o Archivar. No hay botón para "Pausar", "Finalizar" o volver a "Draft", ni indicador visual de `GENERATING`/`FAILED` (el badge de estado en línea 2400 solo tiene estilos especiales para `ACTIVE` y `ARCHIVED`; cualquier otro estado cae al estilo genérico `sky`).
  - `handleCampaignStatus` (línea 957) es genérico y acepta cualquier `CampaignFormState["status"]`, así que el límite es solo de UI/botones, no del backend (aparte del límite de la API mencionado en el punto 1).

## 3. Cómo se generan posts desde una campaña actualmente

Hay **dos caminos** completamente distintos, y no se comunican entre sí:

### a) Manual, vía UI
En `SocialFlowWorkspaceClient.tsx`, el formulario de creación de post (`PostFormState`, línea 81) tiene un campo `campaignId` con un `<select>` (línea 2476) poblado con `data.campaigns`. Al enviar, llama a `POST /api/socialflow/posts` (`src/app/api/socialflow/posts/route.ts`) pasando `campaignId: body.campaignId ?? null`. Es decir: el usuario redacta el post a mano y opcionalmente lo asocia a una campaña existente. No hay generación automática de contenido en este flujo.

### b) Generación por IA (pipeline asíncrono completo)
1. `POST /api/socialflow/ai/generate` (`src/app/api/socialflow/ai/generate/route.ts`): recibe `{ niche, tone, frequencyPerWeek, saasId }`, valida acceso vía `guardAiAccess`, genera un `campaignId = ai_campaign_${Date.now()}` y **crea de inmediato** la campaña con `upsertSaasSocialCampaign(..., status: "GENERATING")` (única vía en todo el código donde se usa el estado `GENERATING`). Encola el job en `SOCIALFLOW_AI_QUEUE` (Cloudflare Queue) y responde `202` sin esperar.
2. **Consumidor**: `workers/socialflow-ai-worker/src/index.ts`, worker Cloudflare independiente (para no estar atado al límite de tiempo HTTP — el pipeline completo son "~26 llamadas secuenciales a Workers AI, 50-280s+" según el comentario del propio archivo). Su handler `queue()` llama a `SocialFlowOrchestrator.generateFullCampaign(...)`.
3. `SocialFlowOrchestrator.generateFullCampaign` (`src/lib/socialflow/ai/SocialFlowOrchestrator.ts:96`): pipeline multi-agente — `buildProfile` → `competitorAgent` → `trendAgent` → `keywordAgent` → `strategyAgent` (genera `numPosts = min(28, frequencyPerWeek)` ítems de estrategia) → por cada ítem: `contentGenerator` + `optimizationAgent` → `schedulerAgent` (arma el calendario) → `persistToDb`.
4. `persistToDb` (línea 129): hace `upsertSaasSocialCampaign` marcando la campaña como **`ACTIVE`** (sobrescribe el `GENERATING` inicial) y luego, por cada ítem de estrategia, genera un `imageHint` (`generatePostImage`) y hace `upsertSaasSocialPost` con `campaignId: campaign.id`, `status: "DRAFT"`, `scheduledAt` calculado por el scheduler agent. Los posts nacen en `DRAFT`, no publicados.
5. **Manejo de error**: si `generateFullCampaign` lanza una excepción, el `catch` del worker marca la campaña como **`FAILED`** (única vía donde se usa ese estado) con una nota truncada a 500 caracteres del error, y hace `ack()` del mensaje igualmente ("ya quedó registrado como fallo terminal, evitar storms de reintento" según el comentario).

### Puntos a tener en cuenta para la implementación
- El flujo de IA usa **su propio `upsertSaasSocialCampaign`**, con `objective` fijo (`AWARENESS`) y `targetSegment` fijo (`DEFAULT`) — no hay forma de que el usuario configure esos campos antes de generar. Si la tarea es "completar el flujo de campañas", probablemente haya que decidir si el formulario de creación manual y el de generación por IA deben convergir (misma campaña, ¿o siguen siendo dos entidades con distinto ciclo de vida?).
- No existe endpoint `GET /api/socialflow/campaigns/[id]` para leer una sola campaña (todo pasa por listar+filtrar en memoria), lo que además es ineficiente en `PATCH`.
- No hay endpoint de borrado de campañas.
- El estado `GENERATING` no tiene representación visual dedicada en `SocialFlowWorkspaceClient.tsx` — si el usuario refresca durante la generación (que puede tardar minutos), verá un badge genérico sin indicación de progreso ni polling que lo actualice automáticamente.

## Archivos tocados en esta auditoría (solo lectura)
- `src/app/api/socialflow/campaigns/route.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/campaigns/route.ts`
- `apps/socialflow-runtime/src/lib/socialflow/{campaigns-service,campaigns-repository,contracts,validators}.ts`
- `src/app/components/socialflow/CampaignForm.tsx`
- `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx`
- `src/lib/socialflow/repository.ts`
- `src/lib/social-core/types.ts`
- `src/app/api/socialflow/ai/generate/route.ts`
- `workers/socialflow-ai-worker/src/index.ts`
- `src/lib/socialflow/ai/SocialFlowOrchestrator.ts`
- `src/app/api/socialflow/posts/route.ts`
