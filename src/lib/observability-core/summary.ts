import { listObservabilityActivities } from "@/lib/observability-core/activities";
import { getLatestHealthSnapshot } from "@/lib/observability-core/health";
import { listObservabilityIncidents } from "@/lib/observability-core/incidents";
import { ObservabilityCoreError, type ObservabilityActivity, type ObservabilityHealthSnapshot, type ObservabilityIncident, type ObservabilityStatusSummary } from "@/lib/observability-core/types";

export function deriveObservabilityStatusSummary(input: {
  tenantId: string;
  saasId: string;
  latestSnapshot: ObservabilityHealthSnapshot | null;
  openIncidents: ObservabilityIncident[];
  recentActivity: ObservabilityActivity[];
}): ObservabilityStatusSummary {
  const latestActivityAt = input.recentActivity[0]?.createdAt ?? input.latestSnapshot?.lastActivityAt ?? null;
  const overallStatus = input.latestSnapshot?.healthStatus
    ?? (input.openIncidents.length > 0 ? "needs_attention" : "unknown");
  const freshnessStatus = input.latestSnapshot?.freshnessStatus ?? "unknown";

  let recommendation = "Capture a health snapshot for this SaaS.";
  if (input.openIncidents.length > 0) {
    recommendation = `Review ${input.openIncidents.length} open incident(s).`;
  } else if (freshnessStatus === "stale") {
    recommendation = "Refresh stale operational signals.";
  } else if (latestActivityAt) {
    recommendation = "Operational activity looks recent.";
  }

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    overallStatus,
    freshnessStatus,
    openIncidentsCount: input.openIncidents.length,
    latestActivityAt,
    latestSnapshotAt: input.latestSnapshot?.capturedAt ?? null,
    recommendation,
  };
}

export async function getObservabilityStatusSummary(input: {
  tenantId: string;
  saasId: string;
}): Promise<ObservabilityStatusSummary> {
  if (!input.tenantId?.trim()) {
    throw new ObservabilityCoreError("OBSERVABILITY_TENANT_REQUIRED");
  }
  if (!input.saasId?.trim()) {
    throw new ObservabilityCoreError("OBSERVABILITY_SAAS_REQUIRED");
  }

  const [latestSnapshot, openIncidents, recentActivity] = await Promise.all([
    getLatestHealthSnapshot({ tenantId: input.tenantId, saasId: input.saasId }),
    listObservabilityIncidents({ tenantId: input.tenantId, saasId: input.saasId, status: "OPEN", limit: 20 }),
    listObservabilityActivities({ tenantId: input.tenantId, saasId: input.saasId, limit: 10 }),
  ]);

  return deriveObservabilityStatusSummary({
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    latestSnapshot,
    openIncidents,
    recentActivity,
  });
}
