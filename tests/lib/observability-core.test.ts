import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  activities: [] as Array<Record<string, unknown>>,
  incidents: [] as Array<Record<string, unknown>>,
  snapshots: [] as Array<Record<string, unknown>>,
}));

const queryOne = vi.hoisted(() => vi.fn());
const queryAll = vi.hoisted(() => vi.fn());
const run = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  queryOne,
  queryAll,
  run,
}));

import {
  acknowledgeObservabilityIncident,
  captureHealthSnapshot,
  getLatestHealthSnapshot,
  getObservabilityStatusSummary,
  listObservabilityActivities,
  listObservabilityIncidents,
  openObservabilityIncident,
  recordObservabilityActivity,
  resolveObservabilityIncidentsByScope,
  resolveObservabilityIncident,
} from "@/lib/observability-core";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_observability_incidents")) {
      if (sql.includes("status IN ('OPEN', 'ACKNOWLEDGED')")) {
        const row = state.incidents.find(
          (item) =>
            item.tenant_id === params[0]
            && item.saas_id === params[1]
            && item.source_type === params[2]
            && item.source_key === params[3]
            && item.incident_type === params[4]
            && (item.status === "OPEN" || item.status === "ACKNOWLEDGED"),
        );
        return row ? clone(row) : null;
      }
      const [id] = params;
      const row = state.incidents.find((item) => item.id === id);
      return row ? clone(row) : null;
    }

    if (sql.includes("FROM drako_observability_health_snapshots")) {
      let rows = [...state.snapshots];
      let cursor = 0;
      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("scope_type = ?")) {
        rows = rows.filter((item) => item.scope_type === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("scope_key = ?")) {
        rows = rows.filter((item) => item.scope_key === params[cursor]);
      }
      rows.sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)));
      return rows[0] ? clone(rows[0]) : null;
    }

    return null;
  });

  queryAll.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_observability_activities")) {
      let rows = [...state.activities];
      let cursor = 0;
      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("source_type = ?")) {
        rows = rows.filter((item) => item.source_type === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("source_key = ?")) {
        rows = rows.filter((item) => item.source_key === params[cursor]);
      }
      const limit = Number(params[params.length - 1] ?? 50);
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return clone(rows.slice(0, limit));
    }

    if (sql.includes("FROM drako_observability_incidents")) {
      let rows = [...state.incidents];
      let cursor = 0;
      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("source_type = ?")) {
        rows = rows.filter((item) => item.source_type === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("source_key = ?")) {
        rows = rows.filter((item) => item.source_key === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("status = ?")) {
        rows = rows.filter((item) => item.status === params[cursor]);
      }
      const limit = Number(params[params.length - 1] ?? 50);
      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return clone(rows.slice(0, limit));
    }

    if (sql.includes("FROM drako_observability_health_snapshots")) {
      let rows = [...state.snapshots];
      let cursor = 0;
      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
      }
      const limit = Number(params[params.length - 1] ?? 50);
      rows.sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)));
      return clone(rows.slice(0, limit));
    }

    return [];
  });

  run.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.startsWith("INSERT INTO drako_observability_activities")) {
      state.activities.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        source_type: params[3],
        source_key: params[4],
        activity_type: params[5],
        status: params[6],
        summary: params[7],
        metadata_json: params[8],
        created_at: params[9],
      });
      return true;
    }

    if (sql.startsWith("INSERT INTO drako_observability_incidents")) {
      state.incidents.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        source_type: params[3],
        source_key: params[4],
        incident_type: params[5],
        severity: params[6],
        status: "OPEN",
        summary: params[7],
        details_json: params[8],
        opened_at: params[9],
        resolved_at: null,
        updated_at: params[10],
      });
      return true;
    }

    if (sql.startsWith("UPDATE drako_observability_incidents")) {
      const row = state.incidents.find((item) => item.id === params[params.length - 1]);
      if (row && params.length === 4) {
        row.status = params[0];
        row.resolved_at = params[1];
        row.updated_at = params[2];
      } else if (row && params.length === 5) {
        row.severity = params[0];
        row.status = "OPEN";
        row.summary = params[1];
        row.details_json = params[2];
        row.resolved_at = null;
        row.updated_at = params[3];
      }
      return true;
    }

    if (sql.startsWith("INSERT INTO drako_observability_health_snapshots")) {
      state.snapshots.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        scope_type: params[3],
        scope_key: params[4],
        health_status: params[5],
        freshness_status: params[6],
        last_activity_at: params[7],
        open_incidents_count: params[8],
        summary: params[9],
        captured_at: params[10],
      });
      return true;
    }

    return true;
  });
}

describe("observability core", () => {
  beforeEach(() => {
    state.activities = [];
    state.incidents = [];
    state.snapshots = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("records activities and lists them by tenant and saas", async () => {
    await recordObservabilityActivity({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "automation",
      sourceKey: "auto.key",
      activityType: "automation_execution",
      status: "success",
      summary: "Automation succeeded",
    });
    await recordObservabilityActivity({
      tenantId: "tenant-a",
      saasId: "saas-b",
      sourceType: "integration",
      sourceKey: "linkedin",
      activityType: "integration_validation",
      status: "error",
      summary: "Validation failed",
    });

    const items = await listObservabilityActivities({ tenantId: "tenant-a", saasId: "saas-a" });
    expect(items).toHaveLength(1);
    expect(items[0].summary).toBe("Automation succeeded");
  });

  it("opens, acknowledges and resolves incidents", async () => {
    const incident = await openObservabilityIncident({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "integration",
      sourceKey: "linkedin",
      incidentType: "integration_invalid",
      severity: "high",
      summary: "LinkedIn connection invalid",
    });

    const acknowledged = await acknowledgeObservabilityIncident(incident.id);
    const resolved = await resolveObservabilityIncident(incident.id);

    expect(acknowledged.status).toBe("ACKNOWLEDGED");
    expect(resolved.status).toBe("RESOLVED");
  });

  it("reuses matching open incidents instead of duplicating them", async () => {
    const first = await openObservabilityIncident({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "integration",
      sourceKey: "linkedin",
      incidentType: "integration_invalid",
      severity: "high",
      summary: "LinkedIn connection invalid",
    });

    const second = await openObservabilityIncident({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "integration",
      sourceKey: "linkedin",
      incidentType: "integration_invalid",
      severity: "high",
      summary: "LinkedIn connection still invalid",
    });

    expect(second.id).toBe(first.id);
    expect(state.incidents).toHaveLength(1);
    expect(second.summary).toBe("LinkedIn connection still invalid");
  });

  it("resolves incidents by scope", async () => {
    await openObservabilityIncident({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "automation",
      sourceKey: "demo.automation",
      incidentType: "automation_failed",
      severity: "medium",
      summary: "Automation failed",
    });

    const resolved = await resolveObservabilityIncidentsByScope({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "automation",
      sourceKey: "demo.automation",
      incidentType: "automation_failed",
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe("RESOLVED");
  });

  it("captures and returns latest health snapshot", async () => {
    await captureHealthSnapshot({
      tenantId: "tenant-a",
      saasId: "saas-a",
      scopeType: "saas",
      scopeKey: "workspace",
      healthStatus: "healthy",
      freshnessStatus: "fresh",
      openIncidentsCount: 0,
      summary: "All good",
    });

    const latest = await getLatestHealthSnapshot({
      tenantId: "tenant-a",
      saasId: "saas-a",
      scopeType: "saas",
      scopeKey: "workspace",
    });

    expect(latest?.summary).toBe("All good");
  });

  it("derives a status summary from snapshot, incidents and activity", async () => {
    await recordObservabilityActivity({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "automation",
      sourceKey: "auto.key",
      activityType: "automation_execution",
      status: "error",
      summary: "Automation failed",
    });
    await openObservabilityIncident({
      tenantId: "tenant-a",
      saasId: "saas-a",
      sourceType: "automation",
      sourceKey: "auto.key",
      incidentType: "automation_failed",
      severity: "medium",
      summary: "Automation failed",
    });
    await captureHealthSnapshot({
      tenantId: "tenant-a",
      saasId: "saas-a",
      scopeType: "saas",
      scopeKey: "workspace",
      healthStatus: "needs_attention",
      freshnessStatus: "stale",
      openIncidentsCount: 1,
      summary: "Needs attention",
    });

    const summary = await getObservabilityStatusSummary({
      tenantId: "tenant-a",
      saasId: "saas-a",
    });

    expect(summary.overallStatus).toBe("needs_attention");
    expect(summary.openIncidentsCount).toBe(1);
    expect(summary.recommendation).toContain("Review 1 open incident");
  });
});
