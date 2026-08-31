export type InternalApiErrorCode =
  | "INTERNAL_API_BAD_REQUEST"
  | "INTERNAL_API_UNAUTHORIZED"
  | "INTERNAL_API_FORBIDDEN";

export type InternalApiError = {
  code: InternalApiErrorCode;
  message: string;
  requestId?: string;
};

export type SocialFlowHealthStatus = "ok" | "degraded" | "down";

export type SocialFlowHealthCheckKey = "contract" | "runtime" | "auth";

export type SocialFlowHealthCheck = {
  status: SocialFlowHealthStatus;
  detail: string;
};

export type SocialFlowHealthChecks = Record<SocialFlowHealthCheckKey, SocialFlowHealthCheck>;

export type SocialFlowHealthResponse = {
  service: "socialflow";
  status: SocialFlowHealthStatus;
  runtime: "monolith";
  version: string;
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
  runtime: "monolith";
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
export type SocialFlowObservabilitySnapshot = {
  service: "socialflow";
  runtime: "monolith";
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
  runtime: "monolith";
  accepted: true;
  automationId: string;
  automationType: SocialFlowAutomationType;
  requestId: string;
  tenantId: string | null;
  timestamp: string;
  status: "queued" | "accepted";
};

export type SocialFlowOperatorActionType =
  | "pause_automation"
  | "resume_automation"
  | "force_health_check"
  | "refresh_connection_status"
  | "request_diagnostics";

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
  runtime: "monolith";
  accepted: true;
  actionId: string;
  actionType: SocialFlowOperatorActionType;
  requestId: string;
  tenantId: string | null;
  timestamp: string;
  status: "queued" | "accepted";
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
