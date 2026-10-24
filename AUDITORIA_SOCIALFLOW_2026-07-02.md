# Auditoría técnica de SocialFlow — 2026-07-02

Auditoría de solo lectura sobre el código real (no documentación, no nombres de archivo) de `workers/socialflows`, `src/lib/socialflow`, `src/app/socialflow`, `src/app/api/socialflow` y `src/app/operator/socialflow`. Se evaluaron 27 capacidades definidas en el documento de visión estratégica de SocialFlow. No se modificó ningún archivo ni se consultaron datos de producción de usuarios reales.

## Resumen ejecutivo

**~50-54% de la visión estratégica está construida**, con una asimetría importante:

- **Capa de infraestructura/producto** (auth, aislamiento de tenants, routing, billing, superficies de UI): sólida, ~65% construida. Esta es la parte que hace que el producto sea *operable y seguro* hoy.
- **Capa de "inteligencia" diferenciadora** (los 15 primeros puntos: ingesta de conocimiento, inteligencia de mercado, tendencias, keywords, aprendizaje, predicción, experimentación): mucho más débil, ~43% construida, y de ese 43% una parte relevante es generación de LLM sin fuente de datos externa verificable (es decir, "inteligencia" que en realidad es el modelo de lenguaje opinando sin datos reales detrás).

De 27 puntos: **8 Construidos, 13 Parciales, 6 No existen.**

El producto **puede operar hoy** de forma segura (aislamiento de tenants correcto, billing con Stripe real, auth robusto) y **genera y publica contenido real en Instagram** (incluida la parte más sólida: auditoría social con métricas reales de Graph API). Pero varias promesas centrales de venta — WhatsApp, aprendizaje continuo, memoria de relación con el cliente, Reels/Stories automáticos, experimentación A/B — **no existen o están rotas de forma silenciosa**, lo cual es más peligroso comercialmente que si simplemente no existieran, porque el usuario puede creer que están funcionando.

---

## Tabla de los 27 puntos

| # | Capacidad | Estado | Evidencia clave |
|---|---|---|---|
| 1 | Knowledge Ingestion Engine | 🟡 Parcial | `knowledge/pdf-extract.ts` y `knowledge/scraper.ts` parsean PDF/URL de verdad y persisten en `socialflow_knowledge_documents`; falta ingesta de redes sociales y catálogos estructurados. |
| 2 | Market Intelligence Layer (competidores) | 🟡 Parcial | `knowledge/analyze-competitor/route.ts` solo soporta 1 competidor por llamada; si no hay URL, el LLM "infiere desde conocimiento de industria" (línea 110) sin dato real. |
| 3 | Global Trend Intelligence | ❌ No existe | `ai/agents/TrendAgent.ts` genera tendencias vía LLM sin ninguna fuente externa real (no Google Trends, no APIs de redes); no hay endpoint ni tabla de persistencia, es efímero por request. |
| 4 | Keyword Intelligence Engine | 🟡 Parcial | `ai/agents/KeywordAgent.ts` usa valores de `difficulty`/`trendScore` hardcodeados; según comentario en `posts/generate-from-image/route.ts:150`, fue **removido del pipeline principal** por límite de tiempo de Cloudflare Workers. |
| 5 | Social Audit Engine | ✅ Construido | `audit/engine.ts` combina heurística de completitud de perfil + LLM real (Claude vía Anthropic API) + métricas reales de Instagram Graph API (`meta/metrics-collector.ts`) cuando hay cuenta conectada; degrada honestamente si no hay datos. |
| 6 | Sentiment & Community Analysis | 🟡 Parcial | `conversational/sentiment.ts:analyzeSentiment` clasifica con LLM real, pero solo corre sobre comentarios de Instagram vía cron; no cubre DMs ni el webhook `inbound`. |
| 7 | Audience Intent Intelligence | 🟡 Parcial | `leads/detector.ts` usa reglas regex con pesos (no ML) para distinguir intención de compra vs. cumplido; hay una segunda vía vía LLM (categoría `"lead"` en sentiment) no unificada con la primera. |
| 8 | Lead Intelligence Engine | 🟡 Parcial | Detección real y tabla `socialflow_leads`, pero **solo se dispara desde el webhook `inbound`** — el cron real de comentarios de Instagram nunca crea leads. Sin integración a CRM/WhatsApp/email externo. |
| 9 | Conversational AI Engine | 🟡 Parcial (con bug de supervisión) | `conversational/engine.ts` genera respuestas con contexto de marca real; **el botón "Aprobar" en la bandeja de conversaciones solo actualiza la base de datos, no publica nada en Instagram** cuando el auto-envío está desactivado. |
| 10 | Community & Relationship Memory | ❌ No existe | El campo `sender_handle` se guarda en cada interacción pero nunca se consulta para recuperar historial; cada comentario/DM se trata como evento aislado. |
| 11 | AI Campaign Orchestrator | 🟡 Parcial | `ai/SocialFlowOrchestrator.ts:generateFullCampaign()` sí coordina múltiples posts con calendario real (hasta 28/semana) vía cola async; el objetivo de campaña está hardcodeado siempre a `"AWARENESS"`. |
| 12 | Learning Engine | ❌ No existe | Ningún agente de `ai/agents/*` lee la tabla de métricas históricas; no hay feedback loop de rendimiento pasado ni capa de "inteligencia global" entre tenants. |
| 13 | Prediction Engine | 🟡 Parcial | Solo existen "mejores horarios" (heurística por nicho + opinión del LLM en `TrendAgent`); no hay score de potencial viral ni detección de fatiga de contenido. |
| 14 | Autonomous Experimentation (A/B) | ❌ No existe | `GeneratedPost.variants[]` solo contiene un elemento en la práctica; nunca se generan variantes B/C ni se mide/compara desempeño automáticamente. |
| 15 | Multi-Agent System | ✅ Construido (real, pipeline fijo) | 9 agentes reales en `ai/agents/*` (Market Research —huérfano, no usado—, Competitor, Trend, Keyword, Strategy, ContentGenerator, Optimization, Scheduler, ImageAnalysis). Comparten `BrandProfile`/contexto de conocimiento del tenant en un pipeline secuencial fijo, no memoria dinámica compartida. |
| 16 | UX y Dashboard | 🟡 Parcial | Feed de inteligencia accionable real (`IntelligenceFeedPanel` + `intelligence-feed/route.ts`); **no existen dashboards distintos** para empresa vs. influencer — la única bifurcación real es por plan de pago, no por tipo de cuenta. |
| 17 | Human Override | ✅ Construido | Gate de publicación con `confirmPublish`, rol admin y allowlist de piloto; estados de hilo (`PENDING`/`NEEDS_HUMAN`/etc.) con aprobación explícita; toggle `autoSendEnabled` advertido en UI. |
| 18 | Relationship Hub / CRM Social | 🟡 Parcial (triage ligero) | `leads-panel.tsx` + tabla `socialflow_leads`: pipeline con 4 estados fijos, sin notas, historial, email/teléfono, valor de deal ni integraciones — lejos de un CRM real. |
| 19 | Auth Boundary | ✅ Construido (con matices menores) | 38/53 endpoints usan `requireCurrentSocialFlowSession` (incluye `validateSocialFlowTenantIsolation`, añadido tras el bug de fuga de tenant documentado en memoria del proyecto); `enforceAuthBoundary` solo en 3 endpoints de auth por diseño. `oauth/instagram/callback` no verifica sesión y depende de un `state` sin firma HMAC — punto a reforzar. |
| 20 | Superficies funcionales | ✅ Confirmado | 20 rutas reales en `(workspace)` + auth + reset-password, todas mapeadas con función real (ver detalle en informe de agente); `settings/team` es solo lectura (invitaciones pendientes), `settings/ownership` con transferencia desactivada. |
| 21 | Separación con Campamento Base | ✅ Correcta | Bases de datos físicamente separadas (`DRACO_DB` vs `SOCIALFLOW_AUTHS_DB` vs `SOCIAL_DB`); único puente intencional es `sso_tokens` (handoff de un solo uso, TTL 60s) y `saas_subscriptions` como capa de entitlement compartida. |
| 22 | Integración de routing | ✅ Correcta | `src/middleware.ts` aplica aislamiento cross-tenant (403) y cross-producto (bloquea `/api/socialflow/auths/` desde host de Campamento Base), reforzado por chequeo independiente en el layout del workspace. |
| 23 | Reels/Stories | 🟡 Parcial (bug funcional) | Publicación vía Graph API totalmente real (`meta/publishing.ts`, soporta REEL/STORY/FEED/CAROUSEL); **pero la IA nunca genera video** — el generador de imágenes solo produce PNG, por lo que un post marcado como Reel fallaría al publicarse contra la Graph API real. Sin UI para subir video. |
| 24 | Stripe/Billing | ✅ Construido | 4 planes con Price IDs reales (`billing/plans.ts`), checkout y portal reales, webhook robusto con verificación de firma (`api/stripe/webhook/route.ts`), paywall que sí bloquea canales/IA por plan. Nota: el copy promete TikTok/YouTube/Pinterest/WhatsApp que no existen. |
| 25 | Instagram Graph API | 🟡 Parcial | OAuth ✅, publicación ✅, métricas ✅ y comentarios ✅ son reales y están enganchados a crons reales. El webhook de DMs (`conversations/inbound`) espera un formato de body que **no coincide con el webhook real de Meta** — probablemente no funcional contra Meta en producción tal como está. |
| 26 | WhatsApp orchestrator | ❌ No existe | `socialflow-whatsapp-handler.ts` es un stub explícito (`NOT_IMPLEMENTED`, nunca despachado por el router). Existe infraestructura de WhatsApp (Twilio) para otros productos del monorepo, pero no está conectada a SocialFlow — pese a que se vende como feature del plan Empresa Pro. |
| 27 | i18n / multi-idioma | ❌ No existe | Sin `next-intl`/`i18next` en el producto SocialFlow; todo el texto (UI y hasta los prompts de IA, ej. `"...EN ESPAÑOL"` en `StrategyAgent.ts`) está hardcodeado en español directamente en JSX. |

---

## Top 5 gaps más críticos (priorizados por impacto en poder vender a un cliente real)

**1. WhatsApp orchestrator vendido en el plan Empresa Pro pero con 0% de implementación real.**
El handler es un stub que devuelve `NOT_IMPLEMENTED` y nunca se despacha. Es el gap de mayor riesgo comercial directo: un cliente que pague el plan más caro esperando esta feature descubrirá que no existe nada detrás. Requiere decidir entre construirlo o retirar la promesa del copy de venta de inmediato.

**2. La aprobación humana de respuestas en conversaciones no envía nada al canal real.**
Cuando el auto-envío está desactivado (el modo "supervisado" que se vende como más seguro), el botón "Aprobar" solo actualiza el estado en base de datos — la respuesta nunca llega a Instagram. Esto es peor que un gap: es una función que **parece funcionar y no funciona**, lo cual puede generar quejas de clientes que creen haber respondido a un comentario/DM real.

**3. Reels/Stories fallarían al publicarse en producción.**
La infraestructura de publicación (Graph API) soporta Reels/Stories correctamente, pero el generador de imágenes de IA siempre produce una imagen estática (PNG), nunca video. Si el pipeline automático marca un post como "reel", el intento de publicación real contra Meta fallaría. Es un bug latente, no solo una funcionalidad ausente — se activaría en cuanto el `StrategyAgent` eligiera formato "reel" en un cliente real.

**4. No existe aprendizaje continuo ni predicción real (Learning Engine, Prediction Engine, A/B testing).**
Cada generación de contenido es independiente del rendimiento histórico: no hay score de potencial viral, no hay detección de fatiga de contenido, no hay experimentación de variantes. Esto ataca directamente al argumento de venta de "IA que mejora con el tiempo" — hoy el sistema no mejora, solo repite el mismo pipeline con el mismo nivel de calidad indefinidamente.

**5. No hay memoria de relación / CRM social real (Community & Relationship Memory + Relationship Hub).**
Cada lead o conversación se trata como un evento aislado — el sistema no reconoce si un usuario ya escribió antes, ya es un lead conocido, o ya tuvo una conversación previa. Para un producto que se posiciona como "CRM social inteligente" esto es una limitación central y, a diferencia de otros gaps, es relativamente barato de resolver (los datos ya se guardan, solo falta la capa de consulta/agregación).

### Menciones honorables (no en el top 5 pero relevantes)
- El webhook de DMs de Instagram (`conversations/inbound`) espera un formato de payload que no coincide con el webhook real de Meta — riesgo de que la mensajería directa nunca haya funcionado en producción tal como está.
- "Global Trend Intelligence" y buena parte de "Market Intelligence" son generación de LLM sin fuente de datos externa verificable cuando no hay URL de referencia — si se vende como "inteligencia de mercado basada en datos", hay una brecha de integridad entre el discurso comercial y la implementación.
- El dashboard es idéntico para cuentas de empresa e influencer pese a venderse como experiencias diferenciadas.

---

*Metodología: 5 subagentes especializados leyeron el código fuente completo de las carpetas indicadas (no solo nombres de archivo), incluyendo migraciones de base de datos, para verificar con evidencia concreta (archivo:función) cada uno de los 27 puntos. No se realizaron cambios de código ni se consultaron datos de tenants de producción.*
