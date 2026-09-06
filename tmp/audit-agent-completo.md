# Auditoría de solo lectura — Intelligence Feed / AuditAgent (SocialFlow)

Fecha: 2026-08-21
Alcance: repo `/home/drako/workspace/drako_base`. Auditoría de solo lectura, sin cambios en código.

## Nota previa importante

No existe un archivo `AuditAgent.ts` ni una carpeta de agentes dentro de `workers/socialflows/`.
Esa carpeta solo contiene el entrypoint del Cloudflare Worker (`workers/socialflows/src/workers.ts`)
más config/migraciones. Toda la lógica de generación de tarjetas del Intelligence Feed vive bajo
`src/lib/socialflow/`, repartida en varios archivos independientes (no un único "AuditAgent").

---

## 1. Dónde se generan los textos de las tarjetas

No están hardcodeados en el frontend. El frontend es un renderer puro:

- `src/app/socialflow/(workspace)/_components/IntelligenceFeedPanel.tsx` (línea ~79) — panel
  "Intelligence Feed", hace `fetch` a `GET /api/socialflow/intelligence-feed` y pinta
  `title` / `description` / `priority` (badge HIGH/MEDIUM) tal cual vienen de la API.
- `src/components/socialflow/intelligence-feed-section.tsx` — variante read-only, mismo patrón.

Generadores (múltiples, cada uno independiente):

| Generador | Archivo | Tipo de generación |
|---|---|---|
| Auditoría general | `src/lib/socialflow/audit/engine.ts` (`generateSocialAudit`) | LLM (Claude, vía `intelligenceModel`) con fallback heurístico determinista |
| Mapeo auditoría → tarjetas | `src/lib/socialflow/intelligence/engine.ts` (`buildFeedItemsFromAudit`) | Determinista (código) |
| Insights de audiencia | `src/lib/socialflow/ai/agents/AudienceInsightAgent.ts` | LLM (`defaultLocalModel`, Workers AI/Mistral) sobre comentarios reales de Instagram |
| Fatiga de contenido | `src/lib/socialflow/ai/agents/ContentFatigueAgent.ts` | Puramente heurístico (rachas de posts repetitivos), sin LLM |
| Oportunidad viral / nicho | `src/lib/socialflow/intelligence/ViralOpportunityAgent.ts` | Puramente heurístico/template, sin LLM directo |
| Alertas de token Instagram | `src/lib/socialflow/instagram/token-health.ts` | Strings 100% hardcodeados, sin IA |
| Alertas de token LinkedIn | `src/lib/socialflow/linkedin/token-health.ts` | Strings 100% hardcodeados, sin IA |

Persistencia: tabla D1 **`socialflow_intelligence_feed`** (definida en
`migrations/0191_socialflow_intelligence_core.sql`, extendida por
`workers/socialflows/migrations/0218_socialflow_intelligence_feed_network.sql`), leída/escrita vía
`src/lib/socialflow/intelligence/repository.ts` (`seedFeedItems()`, `listFeedItems()`).

Cron jobs que disparan la generación (Cloudflare Workers `scheduled` triggers, wiring en
`scripts/patch-socialflow-cron-handler.mjs` según `wrangler.workers.toml`):

| Cron | Ruta | Agente |
|---|---|---|
| Diario `0 3 * * *` | `src/app/api/cron/social/style-learning/route.ts` | `ContentFatigueAgent.ts` |
| Diario `0 3 * * *` | `src/app/api/cron/social/audience-insights/route.ts` | `AudienceInsightAgent.ts` |
| Semanal lunes `0 3 * * 1` | `src/app/api/cron/social/viral-opportunity/route.ts` | `ViralOpportunityAgent.ts` |
| On-demand (dashboard vacío) | `src/app/api/socialflow/intelligence-feed/route.ts` (GET) | `generateSocialAudit` (Claude) → `buildFeedItemsFromAudit` |

---

## 2. Prompt exacto

No hay un único prompt "genera título/descripción de tarjeta". Hay dos prompts LLM distintos que
alimentan tarjetas de forma diferente.

### A) Auditoría general (Claude / `intelligenceModel`)

Archivo: `src/lib/socialflow/audit/engine.ts`, función `generateSocialAudit()`, líneas 211-234.

**System prompt** (líneas 232-234):
```
Eres el motor de auditoria social estrategica de SocialFlow. Analiza perfiles de marca y devuelve diagnosticos
honestos, especificos y orientados a accion. Responde SOLO con JSON valido que coincida exactamente con la forma solicitada.
```

**User prompt** (líneas 211-230, con interpolación de variables tal cual aparece en el código):
```
Analiza el siguiente perfil de marca y genera una auditoria social estrategica.

Perfil de marca:
- Nombre: ${profile.brandName || "(sin definir)"}
- Nicho: ${profile.niche || "(sin definir)"}
- Descripcion: ${profile.shortDescription || "(sin definir)"}
- Tono de comunicacion: ${profile.toneOfVoice || "(sin definir)"}
- Publico objetivo: ${profile.audienceDescription || "(sin definir)"}
- Redes activas: ${profile.activeSocialNetworks?.join(", ") || "(ninguna)"}
- Palabras clave: ${profile.baseKeywords?.join(", ") || "(ninguna)"}
- Temas principales: ${profile.mainTopics?.join(", ") || "(ninguno)"}
${metricsSection}
Competidores (${competitors.length}):
${competitors.map(c => `- ${c.name} (${c.platform}${c.handle ? `, ${c.handle}` : ""})`).join("\n") || "(sin competidores)"}

Devuelve un JSON con: score global (0-100), desglose por area (areaScores con area/score/notes), fortalezas (strengths),
debilidades (weaknesses), oportunidades (opportunities), top 5 recomendaciones priorizadas (recommendations con
title/description/impact), y comparativa con competidores (competitorComparison con competitor/comparison), y un
resumen ejecutivo (summary). Se especifico y orientado a acciones concretas. Si hay metricas reales, basate en ellas
para calibrar el score y las recomendaciones.
```

Modelo: `claude-sonnet-4-6` vía `src/lib/socialflow/ai/models/anthropicModel.ts`
(`ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"`), activo si hay `ANTHROPIC_API_KEY`.
Si no hay API key, cae a heurística determinista (`buildHeuristicBase`, líneas ~145-193 del mismo archivo).

Solo las tarjetas `type: "recommendation"` pasan el `title`/`description` del LLM directo sin tocar
(ver `src/lib/socialflow/intelligence/engine.ts:42-43`).

### B) Insights de audiencia (Workers AI / `defaultLocalModel`)

Archivo: `src/lib/socialflow/ai/agents/AudienceInsightAgent.ts`, líneas 66-95.

```
Eres un analista de la audiencia de una cuenta de Instagram. A continuación tienes comentarios reales de seguidores que contienen preguntas, agrupados de forma aproximada por similitud de tema (la agrupación es solo una pista, no es definitiva — tú decides la clasificación real):

${bucketLines}

Identifica los patrones de pregunta MÁS FRECUENTES y genuinamente recurrentes (máximo 3) — no listes preguntas triviales, únicas o que no representen una oportunidad de contenido real. Puedes fusionar varios de los "temas aproximados" de arriba en un solo patrón si en realidad preguntan lo mismo.

Para cada patrón, responde con estos campos exactos:
- "pattern": descripción corta del patrón de pregunta, en español (ej. "Preguntan qué ejercicio hacer para brazos")
- "frequency": número aproximado de comentarios que encajan en este patrón — usa los conteos reales de arriba, no inventes cifras mayores
- "title": título corto y accionable para una sugerencia de contenido (máximo 8 palabras)
- "description": descripción accionable de qué contenido crear para responder esta pregunta recurrente, en español, ~50 palabras
- "content_type": exactamente uno de "post", "carrusel" o "reel" — el formato que mejor encaja para responder esta pregunta

Responde SOLO con un array JSON válido, sin markdown, sin backticks, sin texto fuera del JSON, con esta forma exacta:
[{"pattern": "...", "frequency": 0, "title": "...", "description": "...", "content_type": "post"}]

Si ningún patrón es genuinamente recurrente (todas las preguntas son distintas y aisladas), responde con un array vacío: [].
Responde TODO en español.
```

No usa parámetro `system` separado. **No pide un campo `priority` en absoluto** — la prioridad se
calcula aparte en código (ver sección 4).

---

## 3. Estructura de categorías / tipos

Enum de tipo (`src/lib/socialflow/intelligence/types.ts:3`):
```ts
export type IntelligenceFeedType = "opportunity" | "recommendation" | "alert";
```

**No existe un tipo dedicado a "setup incompleto".** Un token OAuth caducado (problema de
configuración) y una racha de contenido repetitivo (problema de rendimiento activo) caen en el
**mismo `type: "alert"`**. La distinción no está codificada en el enum; es implícita en:
1. qué código/agente escribió la tarjeta, y
2. el string `source` usado para upserts idempotentes (prefijo estable por generador, ej.
   `"content_fatigue:hook"`).

Mapeo concreto de cada código a su `type` fijo:

| Escenario | Archivo / líneas | `type` | ¿Es "setup" o "activo"? |
|---|---|---|---|
| Token Instagram caducado/inválido | `src/lib/socialflow/instagram/token-health.ts:16-34` | `alert` | Setup incompleto (implícito, no marcado como tal) |
| Token LinkedIn caducado/inválido | `src/lib/socialflow/linkedin/token-health.ts:11-30,67-71,125-129` | `alert` | Setup incompleto (implícito) |
| Área de perfil con score < 40 | `src/lib/socialflow/intelligence/engine.ts:13-25` (umbral `CRITICAL_AREA_SCORE_THRESHOLD = 40`, línea 4) | `alert` | Setup incompleto (implícito) |
| Fatiga de contenido (hook/formato repetido) | `src/lib/socialflow/ai/agents/ContentFatigueAgent.ts:72-105` | `alert` | Problema activo |
| Oportunidades de la auditoría | `src/lib/socialflow/intelligence/engine.ts:27-33` | `opportunity` | Oportunidad activa |
| Recomendaciones de la auditoría (LLM) | `src/lib/socialflow/intelligence/engine.ts:35-49` | `recommendation` | Oportunidad activa |
| Oportunidad de nicho/viral | `src/lib/socialflow/intelligence/ViralOpportunityAgent.ts:92-124` | `opportunity` | Oportunidad activa |
| Pregunta recurrente de audiencia | `src/lib/socialflow/ai/agents/AudienceInsightAgent.ts:163-172` | `opportunity` (`as const`) | Oportunidad activa |

El comentario en `src/lib/socialflow/intelligence/types.ts:19-23` documenta que solo los writers de
token-health de Instagram/LinkedIn pueblan el campo `network`, lo cual es otra forma indirecta de
distinguir esas tarjetas de las basadas en auditoría/genéricas.

**Conclusión:** cada agente hardcodea su propio `type`; no hay un clasificador central que separe
"setup incompleto" de "problema/oportunidad detectada en el análisis".

---

## 4. Cómo se decide `priority` (HIGH/MEDIUM/LOW)

Tipo (`src/lib/socialflow/intelligence/types.ts:4`):
```ts
export type IntelligenceFeedPriority = "high" | "medium" | "low";
```

Mayormente **hardcodeado en código determinista**, con una única excepción real donde lo decide el LLM.

### Hardcodeado literal (sin LLM)
- `src/lib/socialflow/intelligence/engine.ts:19` — alertas de área crítica → siempre `"high"`.
- `src/lib/socialflow/intelligence/engine.ts:32` — oportunidades de auditoría → siempre `"medium"`.
- `src/lib/socialflow/instagram/token-health.ts:21` — alertas de token IG → siempre `"high"`.
- `src/lib/socialflow/linkedin/token-health.ts:17` — alertas de token LinkedIn → siempre `"high"`.
- `src/lib/socialflow/ai/agents/ContentFatigueAgent.ts:77,94` — alertas de fatiga → siempre `"high"`.
- `src/lib/socialflow/intelligence/ViralOpportunityAgent.ts:97,114` — oportunidades de nicho → siempre `"medium"`.

### Calculado por código a partir de una señal numérica (no elegido directamente por el LLM)
`src/lib/socialflow/ai/agents/AudienceInsightAgent.ts:112-116`:
```ts
function priorityForFrequency(frequency: number): IntelligenceFeedPriority {
  if (frequency >= 5) return "high";
  if (frequency >= 3) return "medium";
  return "low";
}
```
Usado en la línea 165: `priority: priorityForFrequency(insight.frequency)`. El LLM aporta el número
`frequency`, pero el umbral que decide high/medium/low es código fijo, no el modelo.

### Decidido por el LLM (único caso real)
Schema de tipo (`src/lib/socialflow/audit/types.ts:7-11`):
```ts
export type AuditRecommendation = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};
```
El prompt de auditoría (sección 2A, línea que pide `recommendations con title/description/impact`)
instruye al modelo a devolver `impact` como parte del JSON estructurado — es el único campo de
prioridad que realmente elige el LLM. Se pasa directo como `priority` de la tarjeta en
`src/lib/socialflow/intelligence/engine.ts:44`:
```ts
priority: recommendation.impact
```

Si la llamada a Claude falla, el fallback heurístico `buildHeuristicBase()`
(`src/lib/socialflow/audit/engine.ts:173-181`) calcula `impact` de forma determinista:
```ts
impact: area.score < 40 ? "high" : area.score < 70 ? "medium" : "low"
```
pero cuando la llamada a Claude tiene éxito, se usa la elección propia del LLM para cada recomendación.

---

## Resumen del flujo de datos

```
Frontend (IntelligenceFeedPanel.tsx)
  → GET /api/socialflow/intelligence-feed
  → listFeedItems() lee de D1 (tabla socialflow_intelligence_feed)
     ← poblada previamente por crons:
        - AudienceInsightAgent (LLM Workers AI) — priority calculado por frequency
        - ContentFatigueAgent (heurística) — priority hardcodeado "high"
        - ViralOpportunityAgent (heurística) — priority hardcodeado "medium"
        - token-health.ts IG/LinkedIn (hardcodeado) — priority hardcodeado "high"
  → si la tabla está vacía, fallback síncrono a generateSocialAudit (Claude)
     cuyas recommendations (priority = impact elegido por el LLM) y opportunities
     (priority hardcodeado "medium") se siembran en la misma tabla.
```

Nada fue modificado durante esta auditoría — todo el proceso fue de solo lectura.
