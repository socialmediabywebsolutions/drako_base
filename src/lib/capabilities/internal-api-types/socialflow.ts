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

export type SocialFlowObservabilitySnapshot = {
  service: "socialflow";
  runtime: "monolith";
  timestamp: string;
  requestId: string;
  tenantId: string | null;
  status: SocialFlowHealthStatus;
  metrics: SocialFlowObservabilityMetrics;
  recentErrors: SocialFlowObservabilityRecentError[];
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
