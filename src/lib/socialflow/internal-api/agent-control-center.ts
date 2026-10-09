import { env } from "@/lib/cf";

// Nivel 3 — Centro de control de agentes del Cerebro Socialcors. Lee de SOCIAL_DB dentro
// de SocialCors; el panel del holding lo consulta por el contrato interno
// (GET /api/internal/socialflow/agents/status, P6) — antes vivía en el holding y leía
// SOCIAL_DB directamente. Cada función
// de contenido devuelve la fila real más reciente de su tabla (cross-tenant, no
// solo Socialcors) porque la mayoría de estas tablas todavía no tienen ninguna fila
// del tenant piloto — mostrar la fila global más reciente es honesto: es lo último
// que ese agente produjo de verdad, en cualquier cuenta.

import type {
  AgentControlCenterAgent,
  AgentControlCenterGroup,
  AgentControlCenterRun,
  AgentControlCenterStatus,
} from "@/lib/capabilities/internal-api-types/socialflow";

export type { AgentControlCenterAgent, AgentControlCenterGroup, AgentControlCenterRun, AgentControlCenterStatus };

type AgentExecutionLogRow = {
  agent_name: string;
  status: "success" | "error" | "skipped";
  started_at: string;
  rows_written: number | null;
  error_message: string | null;
};

type ContentResult = {
  contentSummary: string;
  contentAt: string | null;
  contentTenantId: string | null;
  hasData: boolean;
};

const NO_DATA: ContentResult = { contentSummary: "Sin datos — la tabla todavía no tiene filas.", contentAt: null, contentTenantId: null, hasData: false };
const NO_TABLE = (why: string): ContentResult => ({ contentSummary: why, contentAt: null, contentTenantId: null, hasData: false });

function truncate(value: string, max = 240): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// Extractor genérico para tablas *_snapshot_json cuando no hay una forma más
// específica que mostrar (StrategicPlanningAgent, BrandConsistencyAgent, etc. usan
// versiones a medida más abajo con sus campos reales).
function summarizeSnapshot(json: Record<string, unknown> | null): string {
  if (!json) return "Fila presente, pero el snapshot no es JSON legible.";
  const priorityKeys = ["executiveSummary", "summary", "recommendation", "insight", "monthlyObjective"];
  for (const key of priorityKeys) {
    const value = json[key];
    if (typeof value === "string" && value.trim()) return truncate(value);
  }
  try {
    return truncate(JSON.stringify(json));
  } catch {
    return "Fila presente, contenido no serializable.";
  }
}

async function fetchExecutionLogByAgent(db: D1Database, agentNames: string[]): Promise<Map<string, AgentControlCenterRun>> {
  if (agentNames.length === 0) return new Map();
  const placeholders = agentNames.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT agent_name, status, started_at, rows_written, error_message
       FROM agent_execution_log
       WHERE agent_name IN (${placeholders})
       ORDER BY datetime(started_at) DESC`,
    )
    .bind(...agentNames)
    .all<AgentExecutionLogRow>();

  const map = new Map<string, AgentControlCenterRun>();
  for (const row of results ?? []) {
    if (map.has(row.agent_name)) continue;
    map.set(row.agent_name, {
      startedAt: row.started_at,
      status: row.status,
      rowsWritten: row.rows_written,
      errorMessage: row.error_message,
    });
  }
  return map;
}

async function fetchLatestSnapshotRow(
  db: D1Database,
  table: string,
  jsonColumn: string,
  orderColumn: string,
): Promise<{ tenantId: string | null; json: Record<string, unknown> | null; at: string } | null> {
  const row = await db
    .prepare(
      `SELECT tenant_id, ${jsonColumn} as payload, ${orderColumn} as at
       FROM ${table}
       ORDER BY datetime(${orderColumn}) DESC
       LIMIT 1`,
    )
    .first<{ tenant_id: string | null; payload: string | null; at: string }>();
  if (!row) return null;
  return { tenantId: row.tenant_id ?? null, json: parseJson(row.payload), at: row.at };
}

async function genericSnapshotContent(db: D1Database, table: string, orderColumn = "created_at"): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, table, "snapshot_json", orderColumn);
  if (!row) return NO_DATA;
  return { contentSummary: summarizeSnapshot(row.json), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

// --- Grupo 1 — Tendencias y mercado -----------------------------------------

async function nicheIntelligenceRow(db: D1Database): Promise<{ tenantId: null; json: Record<string, unknown> | null; niche: string; accountType: string; at: string } | null> {
  const row = await db
    .prepare(
      `SELECT niche, account_type, analysis_json, trend_last_fetched, updated_at
       FROM socialcors_niche_intelligence
       WHERE analysis_json IS NOT NULL
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
    )
    .first<{ niche: string; account_type: string; analysis_json: string | null; trend_last_fetched: string | null; updated_at: string }>();
  if (!row) return null;
  return { tenantId: null, json: parseJson(row.analysis_json), niche: row.niche, accountType: row.account_type, at: row.trend_last_fetched ?? row.updated_at };
}

async function trendKeywordContent(db: D1Database): Promise<ContentResult> {
  const row = await db
    .prepare(
      `SELECT niche, account_type, analysis_json, trend_last_fetched
       FROM socialcors_niche_intelligence
       WHERE trend_last_fetched IS NOT NULL
       ORDER BY datetime(trend_last_fetched) DESC
       LIMIT 1`,
    )
    .first<{ niche: string; account_type: string; analysis_json: string | null; trend_last_fetched: string }>();
  if (!row) return NO_DATA;
  const json = parseJson(row.analysis_json);
  const signals = (json?.trendSignals ?? null) as { youtubeHooks?: unknown; redditTopics?: unknown; globalTrends?: unknown; youtubeDegraded?: unknown } | null;
  const youtubeHooks = asStringArray(signals?.youtubeHooks).slice(0, 3);
  const redditTopics = asStringArray(signals?.redditTopics).slice(0, 3);
  const globalTrends = asStringArray(signals?.globalTrends).slice(0, 3);
  const parts: string[] = [`${row.niche}/${row.account_type}`];
  if (youtubeHooks.length) parts.push(`YouTube: ${youtubeHooks.join(" · ")}`);
  if (redditTopics.length) parts.push(`Reddit: ${redditTopics.join(" · ")}`);
  if (globalTrends.length) parts.push(`Google Trends: ${globalTrends.join(" · ")}`);
  if (!youtubeHooks.length && !redditTopics.length && !globalTrends.length) parts.push("fila fresca, sin trendSignals embebidos todavía");
  if (signals?.youtubeDegraded === true) parts.push("(YouTube degradado — sin API key o falló la llamada)");
  return { contentSummary: truncate(parts.join(" — ")), contentAt: row.trend_last_fetched, contentTenantId: null, hasData: true };
}

async function nicheIntelligenceSummaryContent(db: D1Database): Promise<ContentResult> {
  const row = await nicheIntelligenceRow(db);
  if (!row) return NO_DATA;
  const summary = typeof row.json?.summary === "string" ? row.json.summary : null;
  const text = summary ? `${row.niche}/${row.accountType}: ${summary}` : `${row.niche}/${row.accountType}: fila presente, sin summary de texto.`;
  return { contentSummary: truncate(text), contentAt: row.at, contentTenantId: null, hasData: true };
}

async function crossTenantContent(db: D1Database): Promise<ContentResult> {
  const row = await nicheIntelligenceRow(db);
  if (!row) return NO_DATA;
  const patterns = row.json?.engagementPatterns;
  if (patterns && typeof patterns === "object") {
    return { contentSummary: truncate(`${row.niche}/${row.accountType}: engagementPatterns fusionado — ${JSON.stringify(patterns)}`), contentAt: row.at, contentTenantId: null, hasData: true };
  }
  return {
    contentSummary: `Fila de ${row.niche}/${row.accountType} existe, pero engagementPatterns todavía no se fusionó en analysis_json.`,
    contentAt: null,
    contentTenantId: null,
    hasData: false,
  };
}

async function intelligenceFeedContent(db: D1Database, sourcePrefix: string): Promise<ContentResult> {
  const row = await db
    .prepare(
      `SELECT tenant_id, title, description, created_at
       FROM socialflow_intelligence_feed
       WHERE source LIKE ?
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .bind(`${sourcePrefix}%`)
    .first<{ tenant_id: string; title: string; description: string | null; created_at: string }>();
  if (!row) return NO_DATA;
  const text = row.description ? `${row.title} — ${row.description}` : row.title;
  return { contentSummary: truncate(text), contentAt: row.created_at, contentTenantId: row.tenant_id, hasData: true };
}

async function viralMomentContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_viral_moments", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const moments = Array.isArray(row.json?.viralMoments) ? (row.json!.viralMoments as unknown[]) : [];
  const alerts = typeof row.json?.alertsGenerated === "number" ? row.json!.alertsGenerated : moments.length;
  const text = moments.length
    ? `${moments.length} momento(s) viral(es) detectado(s), ${alerts} alerta(s) generada(s).`
    : `Corrió y no encontró ningún momento viral esta vez (${alerts} alertas).`;
  return { contentSummary: text, contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function weeklyBriefingContent(db: D1Database): Promise<ContentResult> {
  const row = await db
    .prepare(
      `SELECT tenant_id, briefing_json, sent_via, week_number, year, sent_at
       FROM socialcors_briefing_history
       ORDER BY datetime(sent_at) DESC
       LIMIT 1`,
    )
    .first<{ tenant_id: string; briefing_json: string | null; sent_via: string | null; week_number: number; year: number; sent_at: string }>();
  if (!row) return NO_DATA;
  const json = parseJson(row.briefing_json);
  const period = typeof json?.period === "string" ? json.period : `semana ${row.week_number}/${row.year}`;
  const niche = typeof json?.niche === "string" ? ` · nicho ${json.niche}` : "";
  const via = row.sent_via ? ` · enviado vía ${row.sent_via}` : "";
  return { contentSummary: truncate(`${period}${niche}${via}`), contentAt: row.sent_at, contentTenantId: row.tenant_id, hasData: true };
}

async function trendAutoApproveContent(db: D1Database): Promise<ContentResult> {
  const counts = await db
    .prepare(
      `SELECT status, COUNT(*) as cnt FROM socialcors_trend_triggers GROUP BY status`,
    )
    .all<{ status: string; cnt: number }>();
  const latest = await db
    .prepare(`SELECT tenant_id, created_at FROM socialcors_trend_triggers ORDER BY datetime(created_at) DESC LIMIT 1`)
    .first<{ tenant_id: string; created_at: string }>();
  const rows = counts.results ?? [];
  if (!latest || rows.length === 0) return NO_DATA;
  const breakdown = rows.map((r) => `${r.status}: ${r.cnt}`).join(", ");
  return { contentSummary: `socialcors_trend_triggers por estado — ${breakdown}.`, contentAt: latest.created_at, contentTenantId: latest.tenant_id, hasData: true };
}

// --- Grupo 2 — Aprendizaje del cliente ---------------------------------------

async function styleLearningContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_style_history", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const analyzed = typeof row.json?.postsAnalyzed === "number" ? row.json.postsAnalyzed : null;
  const hooks = asStringArray(row.json?.topHookPatterns).slice(0, 3);
  const parts = [analyzed !== null ? `${analyzed} posts analizados` : "snapshot presente"];
  if (hooks.length) parts.push(`hooks: ${hooks.join(", ")}`);
  return { contentSummary: truncate(parts.join(" — ")), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function voiceExtractionContent(db: D1Database): Promise<ContentResult> {
  const row = await db
    .prepare(
      `SELECT tenant_id, content_text, created_at
       FROM socialflow_knowledge_documents
       WHERE type = 'voice_profile'
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .first<{ tenant_id: string; content_text: string | null; created_at: string }>();
  if (!row) return NO_DATA;
  return { contentSummary: truncate(row.content_text ?? "Documento presente sin texto."), contentAt: row.created_at, contentTenantId: row.tenant_id, hasData: true };
}

async function hashtagIntelligenceContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_hashtag_intelligence", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const overused = asStringArray(row.json?.overusedHashtags).slice(0, 6);
  const text = overused.length ? `Hashtags sobreusados: ${overused.join(", ")}` : summarizeSnapshot(row.json);
  return { contentSummary: truncate(text), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

// --- Grupo 3 — Planificación y estrategia ------------------------------------

async function strategicPlanContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_strategic_plan", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const objective = typeof row.json?.monthlyObjective === "string" ? row.json.monthlyObjective : null;
  const priorities = asStringArray(row.json?.priorities).slice(0, 2);
  const parts = [objective ?? summarizeSnapshot(row.json)];
  if (priorities.length) parts.push(`prioridades: ${priorities.join(" / ")}`);
  return { contentSummary: truncate(parts.join(" — ")), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function brandConsistencyContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_brand_consistency", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const score = typeof row.json?.avgConsistencyScore === "number" ? row.json.avgConsistencyScore : null;
  const rec = typeof row.json?.recommendation === "string" ? row.json.recommendation : null;
  const text = [score !== null ? `Score ${score}` : null, rec].filter(Boolean).join(" — ") || summarizeSnapshot(row.json);
  return { contentSummary: truncate(text), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function contentDiversityContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_content_diversity", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const score = typeof row.json?.overallDiversityScore === "number" ? row.json.overallDiversityScore : null;
  const formatDiv = row.json?.formatDiversity as { recommendation?: unknown } | undefined;
  const rec = typeof formatDiv?.recommendation === "string" ? formatDiv.recommendation : null;
  const text = [score !== null ? `Score de diversidad ${score}` : null, rec].filter(Boolean).join(" — ") || summarizeSnapshot(row.json);
  return { contentSummary: truncate(text), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function churnPredictionContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_churn_predictions", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const score = typeof row.json?.churnRiskScore === "number" ? row.json.churnRiskScore : null;
  const factors = asStringArray(row.json?.riskFactors).slice(0, 3);
  const parts = [score !== null ? `Riesgo de abandono: ${score}` : summarizeSnapshot(row.json)];
  if (factors.length) parts.push(factors.join(" · "));
  return { contentSummary: truncate(parts.join(" — ")), contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

async function seasonalOpportunityContent(db: D1Database): Promise<ContentResult> {
  const row = await fetchLatestSnapshotRow(db, "socialcors_seasonal_opportunities", "snapshot_json", "created_at");
  if (!row) return NO_DATA;
  const opportunities = Array.isArray(row.json?.upcomingOpportunities) ? (row.json!.upcomingOpportunities as unknown[]) : [];
  const text = opportunities.length
    ? `${opportunities.length} oportunidad(es) estacional(es) próxima(s): ${truncate(JSON.stringify(opportunities), 160)}`
    : "Corrió y no hay eventos estacionales dentro de la ventana de 21 días.";
  return { contentSummary: text, contentAt: row.at, contentTenantId: row.tenantId, hasData: true };
}

// --- Grupo 4 — Benchmarking ---------------------------------------------------

async function influencerBenchmarkContent(db: D1Database): Promise<ContentResult> {
  const row = await db
    .prepare(
      `SELECT niche, snapshot_json, created_at
       FROM socialcors_influencer_benchmarks
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .first<{ niche: string; snapshot_json: string | null; created_at: string }>();
  if (!row) return NO_DATA;
  const json = parseJson(row.snapshot_json);
  const channels = Array.isArray(json?.topChannels) ? (json!.topChannels as Array<{ name?: unknown }>) : [];
  const names = channels.map((c) => (typeof c.name === "string" ? c.name : null)).filter((n): n is string => Boolean(n));
  const text = names.length ? `${row.niche}: ${names.join(", ")}` : `${row.niche}: ${summarizeSnapshot(json)}`;
  return { contentSummary: truncate(text), contentAt: row.created_at, contentTenantId: null, hasData: true };
}

// --- Ensamblado ---------------------------------------------------------------

type AgentDef = {
  key: string;
  nameEs: string;
  flow: string;
  loadContent: ((db: D1Database) => Promise<ContentResult>) | null;
  staticNote?: string;
};

const GROUP_1: AgentDef[] = [
  {
    key: "TrendKeywordAgent",
    nameEs: "Palabras clave de tendencia",
    flow: "Lee YouTube Data API + Reddit + Google Trends → escribe trendSignals (youtubeHooks/redditTopics/globalTrends) y trend_last_fetched en socialcors_niche_intelligence.analysis_json.",
    loadContent: trendKeywordContent,
  },
  {
    key: "NicheIntelligenceCronAgent",
    nameEs: "Inteligencia de nicho",
    flow: "Lee su fila previa en socialcors_niche_intelligence (incluidos los trendSignals de arriba) + Mistral → escribe summary/hashtags/formatos/hooks en la misma fila.",
    loadContent: nicheIntelligenceSummaryContent,
  },
  {
    key: "CrossTenantIntelligenceAgent",
    nameEs: "Inteligencia cruzada entre cuentas",
    flow: "Agrega patrones de engagement anonimizados de varios tenants del mismo nicho → intenta fusionar engagementPatterns en la fila que ya escribió NicheIntelligenceCronAgent.",
    loadContent: crossTenantContent,
  },
  {
    key: "ViralOpportunityAgent",
    nameEs: "Oportunidades virales",
    flow: "Lee engagementPatterns (de CrossTenantIntelligenceAgent) → escribe hooks/formatos sin probar en socialflow_intelligence_feed (source: viral_opportunity:*).",
    loadContent: (db) => intelligenceFeedContent(db, "viral_opportunity:"),
  },
  {
    key: "ViralMomentAgent",
    nameEs: "Momentos virales",
    flow: "Lee trendSignals (niche_intelligence) + posts del tenant → escribe socialcors_viral_moments y trackea temas en socialcors_viral_topic_tracking.",
    loadContent: viralMomentContent,
  },
  {
    key: "WeeklyBriefingAgent",
    nameEs: "Resumen semanal",
    flow: "Sintetiza los snapshots de la semana de otros agentes del tenant → escribe y envía socialcors_briefing_history.",
    loadContent: weeklyBriefingContent,
  },
  {
    key: "TrendAutoApproveCron",
    nameEs: "Auto-aprobación de tendencias",
    flow: "Lee socialcors_trend_triggers en TRIGGERED dentro de la ventana de veto de 45min → si nadie vetó, mueve el post a SCHEDULED (auto-aprobación).",
    loadContent: trendAutoApproveContent,
  },
];

const GROUP_2: AgentDef[] = [
  {
    key: "StyleLearningAgent",
    nameEs: "Aprendizaje de estilo",
    flow: "Lee posts publicados del tenant (gate: ≥10 posts) → escribe snapshot en socialcors_style_history.",
    loadContent: styleLearningContent,
  },
  {
    key: "VoiceExtractionAgent",
    nameEs: "Extracción de voz de marca",
    flow: "Lee posts del tenant → escribe perfil de voz en socialflow_knowledge_documents (type='voice_profile').",
    loadContent: voiceExtractionContent,
  },
  {
    key: "ContentFatigueAgent",
    nameEs: "Fatiga de contenido",
    flow: "Lee socialcors_style_history reciente del tenant → escribe alertas en socialflow_intelligence_feed (source: content_fatigue:*) solo si detecta fatiga real.",
    loadContent: (db) => intelligenceFeedContent(db, "content_fatigue:"),
  },
  {
    key: "HashtagIntelligenceAgent",
    nameEs: "Inteligencia de hashtags",
    flow: "Lee posts del tenant → escribe hashtags sobreusados y mezcla recomendada en socialcors_hashtag_intelligence.",
    loadContent: hashtagIntelligenceContent,
  },
  {
    key: "ContentPerformanceAgent",
    nameEs: "Rendimiento de contenido",
    flow: "Lee posts + métricas del tenant → escribe socialcors_performance_snapshots.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_performance_snapshots"),
  },
  {
    key: "AudienceGrowthAgent",
    nameEs: "Crecimiento de audiencia",
    flow: "Lee posts + métricas del tenant → escribe socialcors_audience_growth.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_audience_growth"),
  },
  {
    key: "OptimalPostingScheduleAgent",
    nameEs: "Horario óptimo de publicación",
    flow: "Lee posts + métricas del tenant → escribe socialcors_posting_schedule.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_posting_schedule"),
  },
  {
    key: "SentimentTrendAgent",
    nameEs: "Tendencia de sentimiento",
    flow: "Lee comentarios/posts del tenant → escribe socialcors_sentiment_trend.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_sentiment_trend"),
  },
  {
    key: "EngagementLearningAgent",
    nameEs: "Aprendizaje de interacción",
    flow: "Función pura (computeEngagementPatterns), sin tabla propia — la usan StyleLearningAgent (embebido en su snapshot) y CrossTenantIntelligenceAgent antes de agregar.",
    loadContent: null,
    staticNote: "Sin tabla propia por diseño — no es un cron, es una función que usan otros agentes.",
  },
];

const GROUP_3: AgentDef[] = [
  {
    key: "StrategicPlanningAgent",
    nameEs: "Planificación estratégica",
    flow: "1 llamada a Mistral que sintetiza el snapshot más reciente de cada agente del Cerebro del tenant → escribe socialcors_strategic_plan.",
    loadContent: strategicPlanContent,
  },
  {
    key: "BrandConsistencyAgent",
    nameEs: "Consistencia de marca",
    flow: "Lee contenido generado reciente + perfil de marca del tenant → escribe socialcors_brand_consistency.",
    loadContent: brandConsistencyContent,
  },
  {
    key: "ContentDiversityAgent",
    nameEs: "Diversidad de contenido",
    flow: "Lee posts recientes del tenant → escribe score de sobreuso de formato/tema en socialcors_content_diversity.",
    loadContent: contentDiversityContent,
  },
  {
    key: "ContentSeriesAgent",
    nameEs: "Series de contenido",
    flow: "Lee posts del tenant buscando series recurrentes → escribe socialcors_content_series.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_content_series"),
  },
  {
    key: "ChurnPredictionAgent",
    nameEs: "Predicción de abandono",
    flow: "Lee actividad del tenant (días desde último post/login, ratio de rechazo, drafts abandonados) → escribe socialcors_churn_predictions.",
    loadContent: churnPredictionContent,
  },
  {
    key: "RevenueOpportunityAgent",
    nameEs: "Oportunidades de ingresos",
    flow: "Lee snapshots de AudienceGrowthAgent + SentimentTrendAgent del mismo ciclo (solo accountType=empresa) → escribe socialcors_revenue_opportunities.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_revenue_opportunities"),
  },
  {
    key: "BestPracticesAgent",
    nameEs: "Mejores prácticas",
    flow: "Lee snapshots de ContentPerformanceAgent de otros tenants del mismo niche+accountType, compara contra el tenant → escribe socialcors_best_practices.",
    loadContent: (db) => genericSnapshotContent(db, "socialcors_best_practices"),
  },
  {
    key: "SeasonalOpportunityAgent",
    nameEs: "Oportunidades estacionales",
    flow: "Calendario fijo de eventos por nicho (San Valentín, Black Friday...) + perfil del tenant → escribe socialcors_seasonal_opportunities con countdown 21/14/7 días.",
    loadContent: seasonalOpportunityContent,
  },
];

const GROUP_4: AgentDef[] = [
  {
    key: "InfluencerBenchmarkAgent",
    nameEs: "Referencia de influencers",
    flow: "Lee YouTube Data API (top 3 canales por nicho) + Mistral → escribe socialcors_influencer_benchmarks. Solo aplica a accountType=influencer.",
    loadContent: influencerBenchmarkContent,
  },
  {
    key: "CompetitorIntelligenceAgent",
    nameEs: "Inteligencia de competencia",
    flow: "Lee dirección del negocio + Google Places API (competidores reales cercanos) + Mistral → devuelve el resultado al caller, no persiste nada él mismo.",
    loadContent: null,
    staticNote: "Sin tabla propia por diseño — bajo demanda, no un cron. Requiere GOOGLE_MAPS_API_KEY configurada.",
  },
  {
    key: "NicheInitializationTrigger",
    nameEs: "Inicialización de nicho",
    flow: "Se dispara cuando un tenant conecta su primera cuenta social (no es cron) → resuelve el nicho y escribe la primera fila en socialcors_niche_intelligence.",
    loadContent: null,
    staticNote: "No es un agente de cron — trigger on-demand, comparte tabla con TrendKeywordAgent/NicheIntelligenceCronAgent (Grupo 1).",
  },
];

const GROUPS: { key: string; titleEs: string; agents: AgentDef[] }[] = [
  { key: "trends", titleEs: "Tendencias y mercado", agents: GROUP_1 },
  { key: "learning", titleEs: "Aprendizaje del cliente", agents: GROUP_2 },
  { key: "planning", titleEs: "Planificación y estrategia", agents: GROUP_3 },
  { key: "benchmarking", titleEs: "Benchmarking", agents: GROUP_4 },
];

// Agentes con una anomalía real ya diagnosticada — se marcan "investigando" en
// lugar de "conectado"/"sin_datos" aunque tengan filas, porque su cadencia de
// ejecución no es la esperada todavía. TrendKeywordAgent: cron cada 20min, pero
// agent_execution_log solo tiene 4 corridas reales en las últimas ~15h (se
// esperarían ~45) — ver la investigación del cron en la Parte 3 de este cambio.
const INVESTIGATING: ReadonlySet<string> = new Set(["TrendKeywordAgent"]);

function resolveStatus(key: string, content: ContentResult): AgentControlCenterStatus {
  if (INVESTIGATING.has(key)) return "investigando";
  return content.hasData ? "conectado" : "sin_datos";
}

export async function getSocialCorsAgentControlCenter(): Promise<AgentControlCenterGroup[]> {
  const bindings = env();
  const db = bindings?.SOCIAL_DB;
  if (!db) {
    return GROUPS.map((group) => ({
      key: group.key,
      titleEs: group.titleEs,
      agents: group.agents.map((agent) => ({
        key: agent.key,
        nameEs: agent.nameEs,
        status: "sin_datos" as const,
        lastRun: null,
        contentSummary: "SOCIAL_DB no disponible en este entorno.",
        contentAt: null,
        contentTenantId: null,
        flow: agent.flow,
        note: agent.staticNote ?? null,
      })),
    }));
  }

  const allAgentKeys = GROUPS.flatMap((group) => group.agents.map((agent) => agent.key));
  const loadOneAgentContent = async (agent: AgentDef): Promise<ContentResult> => {
    if (!agent.loadContent) return NO_TABLE(agent.staticNote ?? "Sin tabla propia.");
    try {
      return await agent.loadContent(db);
    } catch (error) {
      console.error(`[getCampoBaseAgentControlCenter] ${agent.key} query failed`, error instanceof Error ? error.message : String(error));
      return { contentSummary: "No se pudo leer la tabla de este agente — ver logs del servidor.", contentAt: null, contentTenantId: null, hasData: false };
    }
  };

  const [executionByAgent, ...contents] = await Promise.all([
    fetchExecutionLogByAgent(db, allAgentKeys).catch((error) => {
      console.error("[getCampoBaseAgentControlCenter] agent_execution_log query failed", error instanceof Error ? error.message : String(error));
      return new Map<string, AgentControlCenterRun>();
    }),
    ...GROUPS.flatMap((group) => group.agents.map(loadOneAgentContent)),
  ]);

  let cursor = 0;
  return GROUPS.map((group) => ({
    key: group.key,
    titleEs: group.titleEs,
    agents: group.agents.map((agent) => {
      const content = contents[cursor] as ContentResult;
      cursor += 1;
      const lastRun = executionByAgent.get(agent.key) ?? null;
      return {
        key: agent.key,
        nameEs: agent.nameEs,
        status: resolveStatus(agent.key, content),
        lastRun,
        contentSummary: content.contentSummary,
        contentAt: content.contentAt,
        contentTenantId: content.contentTenantId,
        flow: agent.flow,
        note: agent.staticNote ?? null,
      };
    }),
  }));
}
