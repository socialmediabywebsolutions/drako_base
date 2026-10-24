# Auditoría — Solapamiento entre "Subir foto" y "Campañas" en Socialcors

Fecha: 2026-07-06. Solo lectura, ningún archivo modificado.

## 1. Flujo completo "Subir foto → generar post"

Archivos: `src/app/socialflow/(workspace)/upload/page.tsx` (server, trivial: sesión + `<UploadToPost>`), `src/components/socialflow/upload-to-post.tsx` (cliente, toda la lógica), `src/app/api/socialflow/posts/generate-from-image/route.ts` (servidor, todo el pipeline IA).

Es un pipeline de **dos llamadas HTTP por foto + una tercera manual al aprobar**:

1. **Subida a R2**: `POST /api/socialflow/media/upload` → devuelve `{url, key}`.
2. **Fase "analyze"**: `POST /api/socialflow/posts/generate-from-image` con `mode: "analyze"`. Este primer paso solo corre `ImageAnalysisAgent` (LLaVA) sobre los bytes leídos directo del binding R2, y clasifica la foto en `foto_real` vs `grafico_texto` (regex sobre la descripción). No genera caption ni agenda nada todavía. El cliente hace esta llamada para **todas** las fotos del lote en paralelo antes de continuar (fase 1 de `handleFiles`).
3. **Reordenado por tipo de contenido**: el cliente intercala `foto_real`/`grafico_texto` (`interleaveByCategory`) para que el calendario alterne tipos, independientemente del orden de selección.
4. **Fase "finalize"** (la llamada por defecto, sin `mode`): mismo endpoint, reenviando el `imageAnalysis` ya calculado (para no repetir la llamada a LLaVA) más `batchIndex`/`scheduleIndex`. Aquí es donde corre el resto del pipeline: `TrendAgent` + `ContentGeneratorAgent` + `OptimizationAgent`, cálculo de fecha/hora óptima (lógica de "passes" por mes, código propio, no un agente), y devuelve un `suggestedPost` (título, body, hashtags, `scheduledAt`, provider, contentType) **sin persistir nada en D1 todavía** — es solo una propuesta.
5. El usuario revisa/edita el `suggestedPost` en la UI (`ItemCard`, modo edición) y pulsa "Aprobar" (individual o "Aprobar todo").
6. **Persistencia real**: `approveItem()` llama a `POST /api/socialflow/posts` (la ruta CRUD genérica de posts, la misma que usa el resto de la app) con `status: "SCHEDULED"` y **sin `campaignId`** en el body — por lo que el post nace con `campaignId = null` siempre. El endpoint de `generate-from-image` en sí **nunca escribe en la base de datos**; solo devuelve JSON.

## 2. `src/app/api/socialflow/campaigns/` y `SocialFlowOrchestrator.generateFullCampaign`

**Hallazgo clave: `src/app/api/socialflow/campaigns/route.ts` no genera posts ni invoca ningún agente de IA.** Es CRUD puro sobre la fila de la campaña (`GET`/`POST`/`PATCH`/`DELETE` → `listSaasSocialCampaigns`/`upsertSaasSocialCampaign`/`deleteSaasSocialCampaign`). La generación de posts vía IA para una campaña ocurre en un endpoint completamente distinto y desacoplado:

`POST /api/socialflow/ai/generate` (`src/app/api/socialflow/ai/generate/route.ts`) → crea la fila de campaña en estado `GENERATING` → encola un mensaje en `SOCIALFLOW_AI_QUEUE` → el worker dedicado `workers/socialflow-ai-worker/src/index.ts` consume la cola y llama a `SocialFlowOrchestrator.generateFullCampaign(...)`.

`generateFullCampaign` (líneas 96-124 de `SocialFlowOrchestrator.ts`) es un pipeline secuencial mucho más largo:

```
buildProfile
  → CompetitorAgent.run          (competidores)
  → TrendAgent.run                (tendencias)
  → KeywordAgent.run               (clusters de keywords, usa trends)
  → StrategyAgent.run              (genera N ítems de estrategia, horizonDays = frequencyPerWeek, máx 28)
  → [por cada ítem] ContentGeneratorAgent.run + OptimizationAgent.run
  → SchedulerAgent.run              (calendario completo)
  → persistToDb                    (escribe campaña + todos los posts)
```

`persistToDb` (líneas 129-158) hace `upsertSaasSocialCampaign` (marca la campaña `ACTIVE`) y luego, por cada ítem de estrategia: genera una imagen IA (`generatePostImage`/`buildImagePrompt`) y llama a `upsertSaasSocialPost` con `campaignId: campaign.id`, `status: "DRAFT"`, `id: ai_post_${campaign.id}_${item.id}`.

## 3. ¿Usan los mismos agentes de IA?

**Solapamiento parcial — comparten 3 agentes, cada flujo tiene agentes exclusivos:**

| Agente | Subir foto | Campaña (IA) |
|---|---|---|
| `SocialFlowOrchestrator.buildProfile` | ✅ | ✅ |
| `TrendAgent` | ✅ | ✅ |
| `ContentGeneratorAgent` | ✅ (con params extra: `openerIndex`, `openerCategory`, `specificContext`) | ✅ (sin esos params) |
| `OptimizationAgent` | ✅ | ✅ |
| `ImageAnalysisAgent` (LLaVA, visión) | ✅ — es el corazón del flujo | ❌ nunca se importa en `SocialFlowOrchestrator.ts` |
| `KeywordAgent` | ❌ — **eliminado deliberadamente** (comentario en el código: añadía una llamada secuencial a Mistral que hacía que la request superara el límite de 30s de Cloudflare Workers); se sustituye por clusters sintéticos construidos a mano a partir de `profile.contentPillars` + hashtags de `TrendAgent` | ✅ |
| `CompetitorAgent` | ❌ | ✅ |
| `StrategyAgent` | ❌ — se construye un único `StrategyItem` a mano a partir del `ImageAnalysis` (sin llamada a IA) | ✅ — genera todos los ítems de la campaña |
| `SchedulerAgent` | ❌ — la fecha/hora se calcula con lógica propia de "passes" por mes en el propio route.ts (no es un agente) | ✅ |

Es decir: comparten el generador de contenido y de tendencias (mismo `ContentGeneratorAgent`/`TrendAgent`), pero **la estrategia y el calendario se calculan de formas totalmente distintas** — uno por imagen individual con reglas hardcodeadas de horario por tipo de contenido, el otro con `StrategyAgent`+`SchedulerAgent` para una campaña completa.

## 4. ¿Van a la misma tabla?

**Sí, ambos terminan en `saas_social_posts` vía la misma función `upsertSaasSocialPost`** (`src/lib/socialflow/repository.ts`). Pero llegan por caminos distintos:

- **Subir foto**: el post se crea desde el cliente vía `POST /api/socialflow/posts` (ruta CRUD genérica), en estado `"SCHEDULED"` desde el minuto uno, **sin `campaignId`** (queda `NULL` — huérfano por diseño, no por accidente).
- **Campaña IA**: el post se crea desde `SocialFlowOrchestrator.persistToDb`, directamente contra el repositorio (sin pasar por el endpoint HTTP), en estado `"DRAFT"` (requiere aprobación manual — ver `approvePost`/`rejectPost` en `repository.ts`), **siempre con `campaignId: campaign.id`**, con `id` prefijado `ai_post_<campaignId>_<strategyItemId>` (frente a un UUID genérico en el flujo de subir foto) y con `metadata` enriquecida (`strategyItemId`, `hashtags`, `angle`, `callToAction`, `targetProvider`) que el flujo de subir foto no rellena.

## 5. Diferencia real entre los dos flujos, a nivel de código

No son dos implementaciones del mismo pipeline con distinto trigger — son **dos pipelines de generación de contenido genuinamente distintos** que comparten únicamente `buildProfile` + dos agentes de texto, y que convergen en la misma tabla por la vía de la misma función de upsert. Las diferencias concretas:

1. **Input semilla**: una foto real analizada por visión (`ImageAnalysisAgent`) vs. una estrategia completa generada por LLM sin ninguna imagen de por medio (`StrategyAgent`, que ni siquiera se ejecuta en el flujo de foto).
2. **Cuándo se persiste**: subir foto genera el borrador en memoria/HTTP y solo escribe en D1 cuando el humano pulsa "Aprobar" (el post nace ya `SCHEDULED`, no hay paso de revisión post-persistencia); la campaña IA escribe directamente en D1 desde el worker en background, sin que ningún humano intervenga antes, y el post nace `DRAFT` pendiente de revisión humana posterior (el flujo que integré la semana pasada en `/socialflow/campaigns`).
3. **Quién dispara la escritura**: subir foto pasa por el endpoint HTTP público `POST /api/socialflow/posts` (mismo endpoint que usaría cualquier creación manual de post); la campaña IA llama a `upsertSaasSocialPost` directamente desde el orquestador, sin pasar por ese endpoint — no hay ninguna ruta HTTP intermedia para ese paso.
4. **Relación con campañas**: subir foto no conoce el concepto de campaña en absoluto (no hay ningún parámetro `campaignId` en todo `upload-to-post.tsx` ni en `generate-from-image/route.ts`); todo lo que se sube por ahí queda fuera de cualquier campaña para siempre, salvo que alguien lo reasigne a mano (no existe UI para eso tampoco). La campaña IA vive exclusivamente para producir posts *dentro* de una campaña.
5. **Voz de marca**: ambos calculan `voiceInstruction`, pero con matices distintos — `generate-from-image/route.ts` tiene su propia lógica explícita "empresa → tercera persona forzada / si no, primera persona forzada" (líneas 117-124), que **sobreescribe** lo que `buildProfile` calculó por heurística; `generateFullCampaign` usa tal cual lo que `buildProfile` decidió (heurística de regex), sin ese segundo forzado. Es decir, el propio código reconoce que la heurística de `buildProfile` no es fiable y la corrige solo en el flujo de subir foto, no en el de campañas.
6. **Coste/latencia**: subir foto está deliberadamente recortado (sin `KeywordAgent`, sin `CompetitorAgent`, un único `StrategyItem` sin LLM) porque corre síncrono dentro de una request HTTP de Cloudflare Workers con límite de 30s; la campaña completa corre en un worker de cola dedicado (`socialflow-ai-worker`) sin ese límite, por eso puede permitirse el pipeline completo de 8 agentes secuenciales para hasta 28 posts.

## Resumen de una línea

`src/app/api/socialflow/campaigns/` es solo CRUD de metadatos de campaña y no tiene ninguna relación de código con "Subir foto"; el verdadero solapamiento está entre `generate-from-image/route.ts` y `SocialFlowOrchestrator.generateFullCampaign` — comparten `buildProfile` + `TrendAgent` + `ContentGeneratorAgent` + `OptimizationAgent`, pero cada uno tiene su propia lógica de estrategia/calendario/persistencia, y ambos escriben en `saas_social_posts` por rutas de código distintas (HTTP vs. llamada directa), distinguibles después del hecho solo por si `campaign_id` es `NULL` o no.
