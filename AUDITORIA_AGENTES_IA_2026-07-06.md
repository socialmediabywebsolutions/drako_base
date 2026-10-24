# Auditoría — Agentes de IA de Socialcors

Fecha: 2026-07-06. Solo lectura, ningún archivo modificado.

**Nota de ruta:** `workers/socialflows/src/` solo contiene `workers.ts`, un guard-file que devuelve `500 SOCIALFLOW_RUNTIME_MISWIRED` si alguien despliega ese entry point por error — el worker real se sirve desde `../../.open-next/socialflows-standalone/worker.js` (build de la app Next.js raíz). Los agentes reales viven en **`src/lib/socialflow/ai/agents/`**, que es lo que auditamos aquí (11 archivos).

**Nota adicional:** existe un segundo orquestador, `src/lib/social/ai/SocialFlowOrchestrator.ts` (nótese `lib/social`, no `lib/socialflow`), que importa y llama a varios de estos mismos agentes — pero **no lo usa ningún archivo del proyecto** (verificado con grep). Es código muerto duplicado; todo lo que sigue se refiere al orquestador real, `src/lib/socialflow/ai/SocialFlowOrchestrator.ts`.

**Backends de modelo usados por estos agentes** (importante para entender "qué IA" hay detrás de cada uno):
- `defaultLocalModel` (`src/lib/socialflow/ai/models/localModel.ts`, clase `WorkersAiLocalModel`): llama a **`@cf/mistralai/mistral-small-3.1-24b-instruct`** vía el binding `AI` de Cloudflare Workers. El objeto `base` que cada agente define no es un mock permanente — es (a) el ejemplo de forma JSON que se le pasa al modelo y (b) el fallback determinista si el binding falta, la llamada falla o el JSON no parsea (`mergeAiStructuredOutput` superpone la respuesta real del modelo sobre ese `base`, preservando ids).
- `intelligenceModel` (`src/lib/socialflow/ai/models/anthropicModel.ts`, clase `AnthropicLocalModel`): llama directamente a la **API de Anthropic, modelo `claude-sonnet-4-6`**, con fallback en cascada al `defaultLocalModel` (Workers AI → stub determinista) si falta `ANTHROPIC_API_KEY` o la llamada falla.
- Modelo de visión propio (`@cf/llava-hf/llava-1.5-7b-hf`), llamado directamente por `ImageAnalysisAgent` sin pasar por `defaultLocalModel`.

---

## 1. CompetitorAgent

- **Qué hace:** genera un análisis de patrones de competidores para un nicho dado — formatos que funcionan, hooks, hashtags, fortalezas/debilidades, oportunidades de diferenciación.
- **Flujos:** solo campaña IA (`SocialFlowOrchestrator.generateFullCampaign` y `generateStrategyOnly`). No se usa en el flujo de subir foto ni en cron.
- **Input:** `{ niche: string }`.
- **Output:** `CompetitorInsights[]` — un array de objetos con `name, platform, contentPatterns, hashtagsUsed, visualStyle, postingFrequency, engagementSignals, strengths, differentiationOpportunities, patterns, winningFormats, hookStyles, hashtagStrategies, weaknesses, opportunities`.
- **Modelo:** Workers AI Mistral (vía `defaultLocalModel`). El `base` hardcodeado es un competidor de ejemplo ("TopLocalSalon") usado como seed/fallback, no como resultado fijo.

## 2. ContentGeneratorAgent

- **Qué hace:** redacta el caption/post en español a partir de un ítem de estrategia (o de un análisis de imagen), aplicando reglas estrictas de voz (primera persona para influencer / tercera persona para empresa), apertura no genérica (rotando por categoría de foto: gym/cocina/outdoor/lifestyle), longitud corta (3-4 líneas) y hashtags de nicho.
- **Flujos:** **compartido** — campaña IA (`generateFullCampaign`, `generateSinglePost`) y subir foto (`generate-from-image/route.ts`). En subir foto recibe parámetros extra que la campaña no usa: `openerIndex`, `openerCategory`, `specificContext` (el detalle concreto extraído de la imagen por `ImageAnalysisAgent`).
- **Input:** `{ profile: BrandProfile, strategyItem: {id,theme,angle,callToAction}, keywordEngine, trends, openerIndex?, openerCategory?, specificContext? }`.
- **Output:** `GeneratedPost` — `{ id, strategyItemId, variants: [{ id, hook, text, callToAction }] }`.
- **Modelo:** Workers AI Mistral.

## 3. ImageAnalysisAgent

- **Qué hace:** analiza los bytes de una foto con un modelo de visión (LLaVA) y clasifica la imagen en una de 5 categorías (gym/fuerza, cuerdas/funcional, cocina/nutrición, running/outdoor, otras), extrayendo un detalle concreto y honesto (`specificContext`, con regla anti-invención explícita: si no puede identificar algo con certeza, usa lenguaje aproximado en vez de inventar cifras). También decide `recommendedPostType` (FEED/REEL/STORY).
- **Flujos:** **solo subir foto** (`generate-from-image/route.ts`, tanto en el modo `"analyze"` como en `"finalize"`). No se usa en absoluto en el flujo de campaña — `SocialFlowOrchestrator.ts` ni siquiera lo importa.
- **Input:** `{ imageBytes: number[], profile: BrandProfile }`.
- **Output:** `ImageAnalysis` — `{ description, emotion, context, recommendedPostType, suggestedThemes, specificContext }`.
- **Modelo:** `@cf/llava-hf/llava-1.5-7b-hf` (Workers AI), llamado directamente (no pasa por `defaultLocalModel`). Si el binding falla o no hay `AI`, devuelve un fallback honesto basado en `profile.contentPillars` (sin inventar detalles visuales).

## 4. KeywordAgent

- **Qué hace:** construye 3 clusters de keywords/hashtags por intención (awareness/consideration/conversion), combinando keywords base del perfil con las tendencias de `TrendAgent`.
- **Flujos:** solo campaña IA (`generateFullCampaign`, `generateStrategyOnly`, `generateSinglePost`). **Explícitamente excluido** del flujo de subir foto — el comentario en `generate-from-image/route.ts` lo dice sin ambigüedad: se quitó porque añadía una llamada secuencial a Mistral que hacía que la request superara el límite de 30s de Cloudflare Workers. En su lugar, ese endpoint construye un `KeywordEngineOutput` sintético a mano.
- **Input:** `{ profile: BrandProfile, trends: TrendInsights }`.
- **Output:** `{ research: KeywordResearch, engine: KeywordEngineOutput }`.
- **Modelo:** Workers AI Mistral.

## 5. MarketResearchAgent

- **Qué hace:** generaría tendencias de mercado, competidores y huecos de contenido a partir del perfil (nicho, audiencia, servicios).
- **Flujos: NINGUNO.** Se instancia como propiedad privada en `SocialFlowOrchestrator` (`private marketResearch = new MarketResearchAgent();`) pero **`.run()` no se llama en ningún punto** de `generateFullCampaign`, `generateStrategyOnly`, `generateSinglePost` ni `persistToDb` — verificado con grep sobre el archivo completo. Es el único de los 11 agentes que está completamente huérfano en producción: código funcional, cero invocaciones reales.
- **Input:** `{ profile: BrandProfile }` (definido, nunca ejercitado).
- **Output:** `MarketResearch` — `{ trends: string[], competitors: string[], contentGaps: string[] }`.
- **Modelo:** Workers AI Mistral (si algún día se invocara).

## 6. OptimizationAgent

- **Qué hace:** toma el texto generado por `ContentGeneratorAgent` y lo "pule": fuerza tono/voz otra vez, recorta a 3-4 líneas, evita temas/palabras prohibidas del perfil, y normaliza el conteo de hashtags a 10-15 (rellena con hashtags de fitness por defecto si el LLM devuelve menos de 10, trunca si devuelve más de 15).
- **Flujos:** **compartido** — campaña IA y subir foto, con la misma firma en ambos.
- **Input:** `{ profile: BrandProfile, variant: {id,text,hook,callToAction}, keywordEngine: KeywordEngineOutput }`.
- **Output:** `OptimizedPost` — `{ id, baseText, improvedText, hashtags, tone }`.
- **Modelo:** Workers AI Mistral.

## 7. ProfileChatAgent

- **Qué hace:** es una entrevista conversacional por bloques (identidad, nicho, audiencia, negocio, competidores, objetivos) que va completando el `ChannelProfile` del usuario turno a turno. Separa explícitamente lo que el usuario dijo literalmente (`extractedFields`) de lo que la IA propone/infiere cuando la respuesta es genérica (`proposedFields`), y normaliza campos libres a los valores fijos de los `<select>` de la UI (ej. "30 a 50 años" → `"35-45"`, con nota de aproximación si tuvo que adivinar).
- **Flujos:** el chat de perfil en **`/socialflow/profile`** (componente `ProfileAiChat.tsx` → `POST /api/socialflow/profile/chat`). Es una vía alternativa/complementaria al formulario manual de perfil y al wizard de onboarding de 4 pasos — **no interviene en absoluto en la generación de posts** (ni campaña ni subir foto), solo en completar el perfil de marca que luego consumen los demás agentes vía `buildProfile`.
- **Input:** `{ tenantId, saasId, accountType, currentProfile: ChannelProfile, history: ProfileChatMessage[], userMessage }`.
- **Output:** `{ assistantMessage, blockKey, extractedFields, proposedFields, proposedCompetitors, done }`.
- **Modelo:** **Anthropic Claude Sonnet 4.6** directo (único agente que no usa Workers AI como primera opción), con fallback a Workers AI Mistral y luego al stub determinista.

## 8. SchedulerAgent

- **Qué hace:** calcula fecha y hora de publicación para cada post de una campaña, repartiendo por oleadas (todas las fechas con la hora 1 del pool antes de asignar la hora 2, etc.), evitando colisión con slots ya ocupados en BD, con fallback a reparto lineal si se agotan los slots de la ventana de 62 días.
- **Flujos:** solo campaña IA (`generateFullCampaign`).
- **Input:** `{ strategy: StrategyItem[], frequencyPerWeek, startDate?, endDate?, niche?, occupiedSlots?, optimalHours? }`.
- **Output:** `ScheduledPostPlan[]` — `{ id, postId, scheduledAt }[]`.
- **Modelo: NINGUNO.** Es el único de los 11 "agentes" que no llama a ningún LLM — `run()` ni siquiera es `async`. Es lógica de fechas 100% determinista en TypeScript puro, etiquetada como "agente" solo por consistencia arquitectónica con el resto del pipeline.

## 9. StrategyAgent

- **Qué hace:** diseña el calendario editorial de una campaña — genera N ítems (uno por día del horizonte) con `theme`, `angle` (específico del nicho, no genérico), `callToAction` y `format` (carousel/reel), variando el enfoque entre posts consecutivos.
- **Flujos:** solo campaña IA (`generateFullCampaign`, `generateStrategyOnly`, `generateSinglePost`). El flujo de subir foto construye su propio `StrategyItem` único a mano a partir del `ImageAnalysis`, sin llamar a este agente.
- **Input:** `{ profile: BrandProfile, horizonDays: number }`.
- **Output:** `ContentStrategy` — `{ horizonDays, items: StrategyItem[] }`.
- **Modelo:** Workers AI Mistral. El fallback (`buildBaseStrategy`) no es genérico — usa una pool de 7 ángulos ya específicos del nicho (errores comunes, guía práctica, tendencias, caso de éxito, mitos vs realidad, tips rápidos, estrategia avanzada) rotados por índice.

## 10. StyleLearningAgent

- **Qué hace:** es un agente de *analítica*, no de generación — analiza hasta 30 posts ya publicados (`POSTED`/`PUBLISHED`) de un tenant: longitud media de caption, patrones de hook más usados (clasificador por regex: lista numerada, pregunta directa, revelación/secreto, condicional, anuncio directo, afirmación directa), hashtags con mejor engagement medio (cruzando con `saas_social_metrics`), temas recurrentes (frecuencia de palabras con stopwords en español/inglés) y mejores horas históricas por engagement. Solo al final usa un LLM para redactar en prosa el resumen de estos datos ya calculados (con instrucción explícita de no inventar cifras nuevas). El resultado se persiste de vuelta en la Knowledge Base (`upsertKnowledgeDocByType`, tipo `auto_learned_style`), cerrando un bucle de realimentación hacia `buildProfile` → `getKnowledgeContext`.
- **Flujos:** **cron**, exclusivamente — `GET /api/cron/social/style-learning` (`src/app/api/cron/social/style-learning/route.ts`), autenticado con `verifyCronAuth`, requiere mínimo 10 posts publicados por tenant. El worker `saas-socialflows-prod` tiene configurados dos crons (`*/5 * * * *` y `0 3 * * *` en `wrangler.workers.toml`); por su naturaleza de análisis histórico diario, todo apunta a que corresponde al de `0 3 * * *` (el de `*/5 * * * *` coincide con la cadencia típica de reintento/publicación de posts programados, no de análisis).
- **Input:** `{ tenantId: string, saasId: string }`.
- **Output:** `StyleLearningResult | null` (null si no hay posts publicados aún) — `{ postsAnalyzed, avgCaptionLength, topHookPatterns, topHashtags, recurringTopics, bestPerformingHours, summaryText }`.
- **Modelo:** Workers AI Mistral, solo para la última frase de resumen — todo el análisis numérico es JS puro sin IA.

## 11. TrendAgent

- **Qué hace:** genera tendencias, ángulos virales, patrones emergentes, oportunidades de formato corto y hooks para el nicho/audiencia, más 2-3 horas UTC óptimas de publicación (con validación estricta: si el LLM no devuelve 2-3 enteros válidos en rango 0-23, usa el fallback heurístico por nicho).
- **Flujos:** **compartido** — campaña IA y subir foto (en ambos casos alimenta a `ContentGeneratorAgent` y, en campaña, también a `SchedulerAgent` vía `optimalHours`; en subir foto, la lógica de horario del propio route.ts consume `trends.optimalHours` directamente).
- **Input:** `{ profile: BrandProfile }`.
- **Output:** `TrendInsights` — `{ trendingTopics, viralAngles, emergingPatterns, shortFormOpportunities, hookIdeas, optimalHours }`.
- **Modelo:** Workers AI Mistral.

---

## Tabla resumen

| Agente | Modelo | Campaña IA | Subir foto | Cron | Chat perfil | Nunca invocado |
|---|---|:-:|:-:|:-:|:-:|:-:|
| CompetitorAgent | Mistral (Workers AI) | ✅ | | | | |
| ContentGeneratorAgent | Mistral (Workers AI) | ✅ | ✅ | | | |
| ImageAnalysisAgent | LLaVA (Workers AI, visión) | | ✅ | | | |
| KeywordAgent | Mistral (Workers AI) | ✅ | ❌ (excluido a propósito) | | | |
| MarketResearchAgent | Mistral (Workers AI) | | | | | ⚠️ **sí — huérfano** |
| OptimizationAgent | Mistral (Workers AI) | ✅ | ✅ | | | |
| ProfileChatAgent | **Claude Sonnet 4.6** (Anthropic) | | | | ✅ | |
| SchedulerAgent | **ninguno** (lógica pura) | ✅ | | | | |
| StrategyAgent | Mistral (Workers AI) | ✅ | | | | |
| StyleLearningAgent | Mistral (Workers AI, solo el resumen) | | | ✅ | | |
| TrendAgent | Mistral (Workers AI) | ✅ | ✅ | | | |

## Hallazgos a destacar

1. **`MarketResearchAgent` está muerto en producción**: se instancia pero nunca se ejecuta. Si algún día se quiere usar, hay que añadir la llamada `.run()` en el orquestador; si no, es candidato a limpieza.
2. **`SchedulerAgent` no es un agente de IA** pese al nombre y a estar en la misma carpeta — es lógica de fechas determinista. Solo `ImageAnalysisAgent` (visión) y `ProfileChatAgent` (Claude) rompen el patrón "todos usan Mistral vía `defaultLocalModel`".
3. **Hay un orquestador duplicado muerto** (`src/lib/social/ai/SocialFlowOrchestrator.ts`) que replica parte de este pipeline pero no lo llama nadie — no confundirlo con el real al auditar o modificar agentes.
4. **`ContentGeneratorAgent`, `OptimizationAgent` y `TrendAgent` son los únicos tres agentes verdaderamente compartidos** entre campaña IA y subir foto; el resto son exclusivos de un flujo.
