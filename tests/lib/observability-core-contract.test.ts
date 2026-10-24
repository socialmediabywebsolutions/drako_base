import { describe, expect, it } from "vitest";

import * as ObservabilityCore from "@/lib/observability-core";
import type {
  CaptureHealthSnapshotInput,
  ObservabilityActivity,
  ObservabilityHealthSnapshot,
  ObservabilityIncident,
  ObservabilityStatusSummary,
  RecordObservabilityActivityInput,
} from "@/lib/observability-core";

describe("observability-core public contract", () => {
  it("exports the canonical runtime surface explicitly", () => {
    expect(ObservabilityCore).toMatchObject({
      CORRELATION_HEADER: expect.any(String),
      TENANT_HEADER: expect.any(String),
      SAAS_HEADER: expect.any(String),
      CORRELATION_ID_REGEX: expect.any(RegExp),
      generateCorrelationId: expect.any(Function),
      isValidCorrelationId: expect.any(Function),
      normalizeCorrelationId: expect.any(Function),
      shouldBypassCorrelation: expect.any(Function),
      ObservabilityCoreError: expect.any(Function),
      recordObservabilityActivity: expect.any(Function),
      listObservabilityActivities: expect.any(Function),
      openObservabilityIncident: expect.any(Function),
      acknowledgeObservabilityIncident: expect.any(Function),
      resolveObservabilityIncident: expect.any(Function),
      resolveObservabilityIncidentsByScope: expect.any(Function),
      listObservabilityIncidents: expect.any(Function),
      captureHealthSnapshot: expect.any(Function),
      getLatestHealthSnapshot: expect.any(Function),
      listHealthSnapshots: expect.any(Function),
      deriveObservabilityStatusSummary: expect.any(Function),
      getObservabilityStatusSummary: expect.any(Function),
    });
  });

  it("does not expose internal or neighbor-system symbols from the public barrel", () => {
    expect("generateId" in ObservabilityCore).toBe(false);
    expect("nowIso" in ObservabilityCore).toBe(false);
    expect("parseJsonObject" in ObservabilityCore).toBe(false);
    expect("stringifyJson" in ObservabilityCore).toBe(false);
    expect("recordCampamentoEvent" in ObservabilityCore).toBe(false);
    expect("getFactoryIncidents" in ObservabilityCore).toBe(false);
    expect("IncidentService" in ObservabilityCore).toBe(false);
    expect("getDbHealthSnapshot" in ObservabilityCore).toBe(false);
  });

  it("re-exports the canonical types through the public barrel", () => {
    const activityInput: RecordObservabilityActivityInput = {
      tenantId: "tenant_a",
      saasId: "saas_a",
      sourceType: "automation",
      sourceKey: "auto.workflow",
      activityType: "run",
      status: "success",
      summary: "Automation completed",
      metadata: { correlationId: "corr_1" },
    };

    const activity: ObservabilityActivity = {
      id: "activity_1",
      tenantId: activityInput.tenantId,
      saasId: activityInput.saasId,
      sourceType: activityInput.sourceType,
      sourceKey: activityInput.sourceKey,
      activityType: activityInput.activityType,
      status: activityInput.status,
      summary: activityInput.summary,
      metadata: activityInput.metadata ?? null,
      createdAt: "2026-04-03T00:00:00.000Z",
    };

    const incident: ObservabilityIncident = {
      id: "incident_1",
      tenantId: "tenant_a",
      saasId: "saas_a",
      sourceType: "integration",
      sourceKey: "linkedin",
      incidentType: "integration_invalid",
      severity: "high",
      status: "OPEN",
      summary: "LinkedIn connection invalid",
      details: null,
      openedAt: "2026-04-03T00:00:00.000Z",
      resolvedAt: null,
      updatedAt: "2026-04-03T00:00:00.000Z",
    };

    const snapshotInput: CaptureHealthSnapshotInput = {
      tenantId: "tenant_a",
      saasId: "saas_a",
      scopeType: "saas",
      scopeKey: "workspace",
      healthStatus: "needs_attention",
      freshnessStatus: "stale",
      lastActivityAt: activity.createdAt,
      openIncidentsCount: 1,
      summary: "Needs attention",
    };

    const snapshot: ObservabilityHealthSnapshot = {
      id: "health_1",
      tenantId: snapshotInput.tenantId,
      saasId: snapshotInput.saasId,
      scopeType: snapshotInput.scopeType,
      scopeKey: snapshotInput.scopeKey,
      healthStatus: snapshotInput.healthStatus,
      freshnessStatus: snapshotInput.freshnessStatus,
      lastActivityAt: snapshotInput.lastActivityAt ?? null,
      openIncidentsCount: snapshotInput.openIncidentsCount,
      summary: snapshotInput.summary,
      capturedAt: "2026-04-03T00:00:00.000Z",
    };

    const summary: ObservabilityStatusSummary = {
      tenantId: "tenant_a",
      saasId: "saas_a",
      overallStatus: snapshot.healthStatus,
      freshnessStatus: snapshot.freshnessStatus,
      openIncidentsCount: 1,
      latestActivityAt: activity.createdAt,
      latestSnapshotAt: snapshot.capturedAt,
      recommendation: "Review 1 open incident(s).",
    };

    expect(activity.sourceType).toBe("automation");
    expect(incident.status).toBe("OPEN");
    expect(snapshot.scopeType).toBe("saas");
    expect(summary.overallStatus).toBe("needs_attention");
  });
});
