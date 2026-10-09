/**
 * Contrato interno DracoBase (holding) ↔ SocialCors (P6).
 *
 * Única superficie por la que el holding consulta o pide cosas a SocialCors. Reglas:
 * - El holding NO importa módulos de SocialCors ni accede a SOCIAL_DB / SOCIALFLOW_AUTHS_DB:
 *   solo estos endpoints y estos tipos.
 * - Autenticación: Authorization: Bearer <SOCIALFLOW_INTERNAL_SERVICE_TOKEN>,
 *   X-Drako-Control-Plane: campobase y X-Drako-Request-Id obligatorios.
 * - Transporte: service binding SOCIALCORS_INTERNAL (saas-drakos-prod → saas-socialflows-prod,
 *   sin pasar por el WAF) o, si no existe, SOCIALFLOW_INTERNAL_API_BASE_URL.
 * - Toda respuesta lleva la cabecera X-SocialCors-Contract-Version. Un cambio incompatible
 *   de forma exige nueva versión; añadir campos opcionales no.
 */
export const SOCIALCORS_INTERNAL_CONTRACT_VERSION = "2026-10-09";
export const SOCIALCORS_CONTRACT_VERSION_HEADER = "X-SocialCors-Contract-Version";

export const SOCIALCORS_INTERNAL_ENDPOINTS = {
  health: { method: "GET", path: "/api/internal/socialflow/health" },
  ownerSnapshot: { method: "GET", path: "/api/internal/socialflow/owner/snapshot" },
  observabilitySnapshot: { method: "GET", path: "/api/internal/socialflow/observability/snapshot" },
  trendTriggers: { method: "GET", path: "/api/internal/socialflow/trend-triggers" },
  events: { method: "POST", path: "/api/internal/socialflow/events" },
  automationTrigger: { method: "POST", path: "/api/internal/socialflow/automation/trigger" },
  operatorActions: { method: "POST", path: "/api/internal/socialflow/operator/actions" },
  tenants: { method: "GET", path: "/api/internal/socialflow/tenants" },
  agentsStatus: { method: "GET", path: "/api/internal/socialflow/agents/status" },
  churnRisk: { method: "GET", path: "/api/internal/socialflow/churn-risk" },
  whatsappReply: { method: "POST", path: "/api/internal/socialflow/whatsapp/reply" },
} as const;

export type SocialCorsInternalEndpoint = keyof typeof SOCIALCORS_INTERNAL_ENDPOINTS;

// "monolith": respuestas servidas por el build del monolito (antes de P3).
// "socialcors": app propia apps/socialcors.
export type SocialFlowRuntime = "monolith" | "socialcors";

export type InternalApiErrorCode =
  | "INTERNAL_API_BAD_REQUEST"
  | "INTERNAL_API_UNAUTHORIZED"
  | "INTERNAL_API_FORBIDDEN"
  | "INTERNAL_API_NOT_SUPPORTED"
  | "INTERNAL_API_UNAVAILABLE";

export type InternalApiError = {
  code: InternalApiErrorCode;
  message: string;
  requestId?: string;
};

export type SocialFlowHealthStatus = "ok" | "degraded" | "down";

export type SocialFlowHealthCheckKey = "contract" | "runtime" | "auth" | "database" | "scheduler";

export type SocialFlowHealthCheck = {
  status: SocialFlowHealthStatus;
  detail: string;
};

export type SocialFlowHealthChecks = Record<SocialFlowHealthCheckKey, SocialFlowHealthCheck>;

export type SocialFlowHealthResponse = {
  service: "socialflow";
  status: SocialFlowHealthStatus;
  runtime: SocialFlowRuntime;
  version: string;
  contractVersion?: string;
  timestamp: string;
  requestId: string;
  checks: SocialFlowHealthChecks;
};

export type SocialFlowOwnerSnapshot = {
  status: SocialFlowHealthStatus;
  activeCampaigns: number;
  scheduledPosts: number;
  failedPostsLast24h: number;
  connectedProfiles: number;
  lastRunAt: string | null;
};

export type SocialFlowOwnerSnapshotResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion?: string;
  timestamp: string;
  requestId: string;
  tenantId: string | null;
  snapshot: SocialFlowOwnerSnapshot;
  warnings: string[];
};

export type SocialFlowObservabilityRecentError = {
  code: string;
  message: string;
  occurredAt: string;
};

export type SocialFlowObservabilityMetrics = {
  activeAutomations: number;
  queuedJobs: number;
  failedJobsLast24h: number;
  successfulJobsLast24h: number;
  averageLatencyMs: number | null;
};

export type SocialFlowObservabilityPostSnapshot = {
  id: string;
  title: string;
  provider: string;
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  updatedAt: string;
  externalPostId: string | null;
  attempts: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SocialFlowObservabilityConnectionSnapshot = {
  id: string;
  provider: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  isPrimary: boolean;
  updatedAt: string;
};

// Shape real, respaldado por consultas reales a SOCIAL_DB — ver
// getSocialFlowOperatorObservability() en src/lib/socialflow/contracts/observability.ts,
// que este endpoint envuelve directamente. No hay campos "sin fuente" aquí: cada uno
// viene de saas_social_posts / saas_social_accounts / saas_social_metrics /
// observability-core.
export type SocialFlowAgentRun = {
  agentName: string;
  tenantId: string | null;
  status: "success" | "error" | "skipped" | "started" | "completed";
  startedAt: string;
  finishedAt: string | null;
  rowsWritten: number | null;
  errorMessage: string | null;
};

export type SocialFlowObservabilitySnapshot = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion?: string;
  requestId: string;
  tenantId: string;
  saasId: string;
  capturedAt: string;
  health: {
    status: "healthy" | "needs_attention" | "degraded" | "unknown";
    freshnessStatus: "fresh" | "stale" | "unknown";
    schedulerStatus: "idle" | "active" | "needs_attention";
    recommendation: string;
    openIncidentsCount: number;
    latestActivityAt: string | null;
    latestSnapshotAt: string | null;
  };
  scheduler: {
    scheduledPosts: number;
    dueScheduledPosts: number;
    publishingPosts: number;
    stalePublishingPosts: number;
    nextScheduledAt: string | null;
    lastPublishedAt: string | null;
  };
  posts: {
    total: number;
    byStatus: Record<string, number>;
    recentPublished: SocialFlowObservabilityPostSnapshot[];
    recentFailed: SocialFlowObservabilityPostSnapshot[];
    stalePublishing: SocialFlowObservabilityPostSnapshot[];
  };
  publishing: {
    successLast30Days: number;
    failedLast30Days: number;
    successRateLast30Days: number;
    lastFailureAt: string | null;
  };
  linkedin: {
    connected: boolean;
    totalConnections: number;
    primaryStatus: string | null;
    connections: SocialFlowObservabilityConnectionSnapshot[];
  };
  metrics: {
    last7Days: { engagement: number; publishedPosts: number; topProvider: string | null };
    last30Days: { engagement: number; publishedPosts: number; topProvider: string | null };
  };
  recentEvents: Array<{ id: string; activityType: string; summary: string; createdAt: string }>;
  recentIncidents: Array<{ id: string; severity: string; summary: string; openedAt: string }>;
  // Últimas ejecuciones de agentes (agent_execution_log): agregadas (tenant NULL) + del tenant.
  recentAgentRuns?: SocialFlowAgentRun[];
  warnings: string[];
};

export type SocialFlowEventType =
  | "socialflow.automation.requested"
  | "socialflow.automation.started"
  | "socialflow.automation.completed"
  | "socialflow.automation.failed"
  | "socialflow.health.degraded"
  | "socialflow.owner.snapshot.requested";

export type SocialFlowEventSource = "campobase" | "owner" | "system";

export type SocialFlowEventRequest = {
  eventType: SocialFlowEventType;
  source: SocialFlowEventSource;
  occurredAt: string;
  tenantId: string | null;
  correlationId: string | null;
  payload: Record<string, unknown>;
};

export type SocialFlowEventResponse = {
  service: "socialflow";
  runtime: "monolith";
  accepted: true;
  eventId: string;
  eventType: SocialFlowEventType;
  requestId: string;
  tenantId: string | null;
  timestamp: string;
};

export type SocialFlowAutomationType =
  | "publish_due_posts"
  | "sync_profiles"
  | "refresh_metrics"
  | "validate_connections"
  | "generate_schedule";

export type SocialFlowAutomationTriggerSource = "campobase" | "system";

export type SocialFlowAutomationTriggerRequest = {
  automationType: SocialFlowAutomationType;
  source: SocialFlowAutomationTriggerSource;
  tenantId: string | null;
  correlationId: string | null;
  requestedBy: string | null;
  payload: Record<string, unknown>;
};

export type SocialFlowAutomationTriggerResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion?: string;
  accepted: true;
  automationId: string;
  automationType: SocialFlowAutomationType;
  requestId: string;
  tenantId: string | null;
  timestamp: string;
  status: "queued" | "accepted" | "completed";
  // generate_schedule: campaña creada y job encolado; validate_connections: resultado del chequeo.
  result?: SocialFlowGenerateScheduleResult | SocialFlowConnectionCheckResult;
};

export type SocialFlowGenerateScheduleResult = { campaignId: string };

export type SocialFlowConnectionCheckResult = {
  checksPassed: number;
  checksFailed: number;
  recommendedAction: string;
  accounts: Array<{ id: string; provider: string; status: string; expiresAt: string | null; ok: boolean; reason: string | null }>;
};

// P6: acciones reales que el operator puede pedir a SocialCors (antes: tipos sin ejecución).
export type SocialFlowOperatorActionType =
  | "recover_stale_publishing"
  | "retry_failed_posts"
  | "launch_campaign"
  | "test_ai_reply";

export type SocialFlowPostActionResult = {
  scanned: number;
  affected: number;
  skipped: number;
  items: Array<{ id: string; title: string; previousStatus: string; nextStatus: string | null; ok: boolean; reason: string | null }>;
  message: string;
};

export type SocialFlowLaunchCampaignResult = {
  results: Array<{ tenantId: string; ok: boolean; campaignId?: string; error?: string }>;
};

export type SocialFlowTestAiReplyResult =
  | { kind: "BLOCKED_INTENT"; suggestedReply: string }
  | { kind: "AI_GENERATED"; suggestedReply: string; aiMetadata: Record<string, unknown> | null };

export type SocialFlowOperatorActionResult =
  | SocialFlowPostActionResult
  | SocialFlowLaunchCampaignResult
  | SocialFlowTestAiReplyResult;

export type SocialFlowOperatorActionSource = "campobase" | "owner" | "system";

export type SocialFlowOperatorActionRequest = {
  actionType: SocialFlowOperatorActionType;
  source: SocialFlowOperatorActionSource;
  tenantId: string | null;
  correlationId: string | null;
  requestedBy: string | null;
  reason: string | null;
  payload: Record<string, unknown>;
};

export type SocialFlowOperatorActionResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion?: string;
  accepted: true;
  actionId: string;
  actionType: SocialFlowOperatorActionType;
  requestId: string;
  tenantId: string | null;
  timestamp: string;
  status: "completed";
  result: SocialFlowOperatorActionResult;
};

// ── Lecturas del panel del operator (P6) ──────────────────────────────────────────────

export type SocialFlowTenantListItem = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  niche: string | null;
  plan: string | null;
};

export type SocialFlowTenantsResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion: string;
  requestId: string;
  tenants: SocialFlowTenantListItem[];
};

// result = ChurnPredictionResult de SocialCors (score de riesgo y señales), opaco para el holding.
export type SocialFlowChurnRiskTenant = { tenantId: string; saasId: string; result: Record<string, unknown> };

export type SocialFlowChurnRiskResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion: string;
  requestId: string;
  minScore: number;
  tenants: SocialFlowChurnRiskTenant[];
};

// Centro de control de agentes (Cerebro): grupos → agentes con estado, última ejecución y
// resumen del contenido real que producen. Calculado en SocialCors (agent-control-center.ts).
export type AgentControlCenterStatus = "conectado" | "sin_datos" | "investigando";

export type AgentControlCenterRun = {
  startedAt: string;
  status: "success" | "error" | "skipped";
  rowsWritten: number | null;
  errorMessage: string | null;
};

export type AgentControlCenterAgent = {
  key: string;
  nameEs: string;
  status: AgentControlCenterStatus;
  lastRun: AgentControlCenterRun | null;
  contentSummary: string;
  contentAt: string | null;
  contentTenantId: string | null;
  flow: string;
  note: string | null;
};

export type AgentControlCenterGroup = {
  key: string;
  titleEs: string;
  agents: AgentControlCenterAgent[];
};

export type SocialFlowAgentsStatusResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion: string;
  requestId: string;
  groups: AgentControlCenterGroup[];
};

// ── Canal WhatsApp (router del holding → SocialCors) ───────────────────────────────────

export type SocialFlowWhatsappReplyRequest = {
  tenantId: string;
  saasId: string;
  message: string;
};

export type SocialFlowWhatsappReplyResponse = {
  service: "socialflow";
  runtime: SocialFlowRuntime;
  contractVersion: string;
  requestId: string;
  handled: boolean;
  reply: string | null;
  error: string | null;
};

// Resumen del propietario que usa el panel owner del holding (antes importado de
// src/lib/socialflow/contracts/owner-dashboard).
export type SocialOwnerSummary = {
  accountsConnected: number;
  activeCampaigns: number;
  scheduledPostsThisWeek: number;
  recentEngagementScore: number;
};

// Nivel 3 — panel de solo lectura /operator/socialflow para el conector de tendencias
// (socialcors_trend_triggers). "VETOED" está en el contrato porque la columna status de
// esa tabla lo admite (rejectPost() humano deja el post en REJECTED, pero ningún código
// hoy reescribe el trigger correspondiente a VETOED) — puede no aparecer nunca en la
// práctica hasta que se cierre ese gap conocido.
export type SocialFlowTrendTriggerStatus = "TRIGGERED" | "AUTO_APPROVED" | "GENERATION_FAILED" | "VETOED";

export type SocialFlowTrendTriggerPost = {
  id: string;
  status: string;
  provider: string;
  title: string;
  scheduledAt: string | null;
  postedAt: string | null;
};

export type SocialFlowTrendTrigger = {
  id: string;
  tenantId: string;
  saasId: string;
  niche: string;
  score: number;
  status: SocialFlowTrendTriggerStatus;
  trendFetchedAt: string;
  createdAt: string;
  resolvedAt: string | null;
  campaignId: string;
  // null cuando la generación nunca llegó a producir un post (GENERATION_FAILED, o un
  // TRIGGERED todavía en curso) — no siempre que status !== TRIGGERED hay post.
  post: SocialFlowTrendTriggerPost | null;
};

// Opción B del indicador de salud (sin instrumentar TrendTriggerConnector.ts): solo
// las 3 métricas calculables con lo que ya se persiste hoy. "Último score calculado"
// se queda fuera — socialcors_trend_triggers solo guarda filas cuando el score supera
// el umbral, así que no hay histórico de scores por debajo del umbral que mostrar.
export type SocialFlowTrendTriggerHealth = {
  niche: string;
  // null si el nicho todavía no tiene fila en socialcors_niche_intelligence.
  trendLastFetchedAt: string | null;
  trendSignalAgeHours: number | null;
  stuckTriggeredCount: number;
  nichesAheadInQueue: number;
};

export type SocialFlowTrendTriggersSnapshot = {
  service: "socialflow";
  runtime: "monolith";
  timestamp: string;
  requestId: string;
  tenantId: string | null;
  triggers: SocialFlowTrendTrigger[];
  health: SocialFlowTrendTriggerHealth;
  warnings: string[];
};
