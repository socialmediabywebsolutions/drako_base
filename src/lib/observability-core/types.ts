/**
 * Public vocabulary for observability-core.
 *
 * This file defines the canonical, reusable contracts for:
 * - correlation-aware operational activity
 * - operational incidents
 * - health snapshots
 * - status summaries
 *
 * Neighbor systems such as empire/events, factory incidents, supervisor
 * incidents, and db/health are intentionally outside this contract.
 */
export type ObservabilitySourceType = "automation" | "integration" | "saas";

export type ObservabilityActivityStatus = "info" | "success" | "warning" | "error";

export type ObservabilityIncidentSeverity = "low" | "medium" | "high" | "critical";

export type ObservabilityIncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type ObservabilityHealthStatus = "healthy" | "needs_attention" | "degraded" | "unknown";

export type ObservabilityFreshnessStatus = "fresh" | "stale" | "unknown";

export type ObservabilityJson = Record<string, unknown> | null;

export type ObservabilityActivity = {
  id: string;
  tenantId: string;
  saasId: string;
  sourceType: ObservabilitySourceType;
  sourceKey: string;
  activityType: string;
  status: ObservabilityActivityStatus;
  summary: string;
  metadata: ObservabilityJson;
  createdAt: string;
};

export type RecordObservabilityActivityInput = {
  tenantId: string;
  saasId: string;
  sourceType: ObservabilitySourceType;
  sourceKey: string;
  activityType: string;
  status: ObservabilityActivityStatus;
  summary: string;
  metadata?: ObservabilityJson;
};

export type ObservabilityIncident = {
  id: string;
  tenantId: string;
  saasId: string;
  sourceType: ObservabilitySourceType;
  sourceKey: string;
  incidentType: string;
  severity: ObservabilityIncidentSeverity;
  status: ObservabilityIncidentStatus;
  summary: string;
  details: ObservabilityJson;
  openedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
};

export type OpenObservabilityIncidentInput = {
  tenantId: string;
  saasId: string;
  sourceType: ObservabilitySourceType;
  sourceKey: string;
  incidentType: string;
  severity: ObservabilityIncidentSeverity;
  summary: string;
  details?: ObservabilityJson;
};

export type ObservabilityHealthSnapshot = {
  id: string;
  tenantId: string;
  saasId: string;
  scopeType: ObservabilitySourceType;
  scopeKey: string;
  healthStatus: ObservabilityHealthStatus;
  freshnessStatus: ObservabilityFreshnessStatus;
  lastActivityAt: string | null;
  openIncidentsCount: number;
  summary: string;
  capturedAt: string;
};

export type CaptureHealthSnapshotInput = {
  tenantId: string;
  saasId: string;
  scopeType: ObservabilitySourceType;
  scopeKey: string;
  healthStatus: ObservabilityHealthStatus;
  freshnessStatus: ObservabilityFreshnessStatus;
  lastActivityAt?: string | null;
  openIncidentsCount: number;
  summary: string;
};

export type ObservabilityStatusSummary = {
  tenantId: string;
  saasId: string;
  overallStatus: ObservabilityHealthStatus;
  freshnessStatus: ObservabilityFreshnessStatus;
  openIncidentsCount: number;
  latestActivityAt: string | null;
  latestSnapshotAt: string | null;
  recommendation: string;
};

export class ObservabilityCoreError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ObservabilityCoreError";
    this.code = code;
  }
}
