import { beforeEach, describe, expect, it, vi } from "vitest";

type AutomationRegistrationRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  automation_key: string;
  display_name: string;
  description: string | null;
  enabled: number;
  schedule_mode: "manual" | "scheduled";
  frequency_unit: "hour" | "day" | "week" | null;
  frequency_value: number | null;
  config_json: string | null;
  owner_scope: "OWNER";
  created_at: string;
  updated_at: string;
};

type AutomationExecutionRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  automation_key: string;
  trigger_type: "manual" | "scheduled" | "retry" | "system";
  triggered_by: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  summary: string | null;
  metrics_json: string | null;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityRecord = {
  id: string;
  tenantId: string;
  saasId: string;
  sourceType: string;
  sourceKey: string;
  activityType: string;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type IncidentRecord = {
  id: string;
  tenantId: string;
  saasId: string;
  sourceType: string;
  sourceKey: string;
  incidentType: string;
  severity: string;
  status: "OPEN" | "RESOLVED";
  summary: string;
  details: Record<string, unknown> | null;
  openedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
};

const state = vi.hoisted(() => ({
  registrations: [] as AutomationRegistrationRow[],
  executions: [] as AutomationExecutionRow[],
  activities: [] as ActivityRecord[],
  incidents: [] as IncidentRecord[],
  integrationConnections: [] as Array<Record<string, unknown>>,
}));

function resetState() {
  state.registrations.length = 0;
  state.executions.length = 0;
  state.activities.length = 0;
  state.incidents.length = 0;
  state.integrationConnections.length = 0;
}

vi.mock("@/lib/db", () => ({
  run: vi.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("INSERT INTO drako_automation_registrations")) {
      state.registrations.push({
        id: params[0] as string,
        tenant_id: params[1] as string,
        saas_id: params[2] as string,
        automation_key: params[3] as string,
        display_name: params[4] as string,
        description: params[5] as string | null,
        enabled: params[6] as number,
        schedule_mode: params[7] as "manual" | "scheduled",
        frequency_unit: params[8] as "hour" | "day" | "week" | null,
        frequency_value: params[9] as number | null,
        config_json: params[10] as string | null,
        owner_scope: params[11] as "OWNER",
        created_at: params[12] as string,
        updated_at: params[13] as string,
      });
      return;
    }

    if (sql.includes("UPDATE drako_automation_registrations")) {
      const target = state.registrations.find(
        (row) => row.tenant_id === params[9] && row.saas_id === params[10] && row.automation_key === params[11],
      );
      if (target) {
        target.display_name = params[0] as string;
        target.description = params[1] as string | null;
        target.enabled = params[2] as number;
        target.schedule_mode = params[3] as "manual" | "scheduled";
        target.frequency_unit = params[4] as "hour" | "day" | "week" | null;
        target.frequency_value = params[5] as number | null;
        target.config_json = params[6] as string | null;
        target.owner_scope = params[7] as "OWNER";
        target.updated_at = params[8] as string;
      }
      return;
    }

    if (sql.includes("INSERT INTO drako_automation_executions")) {
      state.executions.push({
        id: params[0] as string,
        tenant_id: params[1] as string,
        saas_id: params[2] as string,
        automation_key: params[3] as string,
        trigger_type: params[4] as "manual" | "scheduled" | "retry" | "system",
        triggered_by: params[5] as string | null,
        status: "RUNNING",
        summary: null,
        metrics_json: null,
        output_json: null,
        error_code: null,
        error_message: null,
        started_at: params[6] as string,
        finished_at: null,
        created_at: params[7] as string,
        updated_at: params[8] as string,
      });
      return;
    }

    if (sql.includes("UPDATE drako_automation_executions")) {
      const target = state.executions.find((row) => row.id === params[8]);
      if (target) {
        target.status = params[0] as "SUCCESS" | "FAILED";
        target.summary = params[1] as string | null;
        target.metrics_json = params[2] as string | null;
        target.output_json = params[3] as string | null;
        target.error_code = params[4] as string | null;
        target.error_message = params[5] as string | null;
        target.finished_at = params[6] as string;
        target.updated_at = params[7] as string;
      }
    }
  }),
  queryOne: vi.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_automation_registrations")) {
      return state.registrations.find(
        (row) => row.tenant_id === params[0] && row.saas_id === params[1] && row.automation_key === params[2],
      ) ?? null;
    }

    if (sql.includes("FROM drako_automation_executions") && sql.includes("status = 'RUNNING'")) {
      return state.executions.find(
        (row) => row.tenant_id === params[0] && row.saas_id === params[1] && row.automation_key === params[2] && row.status === "RUNNING",
      ) ?? null;
    }

    if (sql.includes("FROM drako_automation_executions") && sql.includes("WHERE id = ?")) {
      return state.executions.find((row) => row.id === params[0]) ?? null;
    }

    return null;
  }),
  queryAll: vi.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_automation_registrations")) {
      return state.registrations
        .filter((row) => {
          if (!params.length) {
            return true;
          }
          let index = 0;
          if (sql.includes("tenant_id = ?")) {
            if (row.tenant_id !== params[index]) return false;
            index += 1;
          }
          if (sql.includes("saas_id = ?")) {
            if (row.saas_id !== params[index]) return false;
            index += 1;
          }
          if (sql.includes("automation_key = ?")) {
            if (row.automation_key !== params[index]) return false;
            index += 1;
          }
          if (sql.includes("enabled = ?")) {
            if (row.enabled !== params[index]) return false;
          }
          return true;
        });
    }

    return [];
  }),
}));

vi.mock("@/lib/integration-core", () => ({
  getIntegrationConnection: vi.fn(async (tenantId: string, saasId: string, integrationKey: string) => {
    return state.integrationConnections.find(
      (item) => item.tenantId === tenantId && item.saasId === saasId && item.integrationKey === integrationKey,
    ) ?? null;
  }),
  connectIntegration: vi.fn(async (input: Record<string, unknown>) => {
    state.integrationConnections.push(input);
    return input;
  }),
}));

vi.mock("@/lib/integration-core/providers/whatsapp", () => ({
  WHATSAPP_INTEGRATION_KEY: "whatsapp",
  ensureWhatsappIntegrationAvailable: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tasks/repository", () => ({
  resolveTasksContext: vi.fn(async ({ tenantId, saasId }) => ({ tenantId, saasId, mode: "demo" })),
  listTasks: vi.fn(async () => [
    {
      id: "task_1",
      status: "OPEN",
      severity: "CRITICAL",
      dueDate: "2024-01-01T08:00:00.000Z",
    },
    {
      id: "task_2",
      status: "IN_PROGRESS",
      severity: "WARNING",
      dueDate: "2024-01-02T08:00:00.000Z",
    },
  ]),
}));

vi.mock("@/lib/whatsapp/repository", () => ({
  resolveWhatsappContext: vi.fn(async ({ tenantId, saasId }) => ({ tenantId, saasId, mode: "demo" })),
  listWhatsappIdentities: vi.fn(async () => []),
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity: vi.fn(async (input: Omit<ActivityRecord, "id" | "createdAt"> & { metadata?: Record<string, unknown> | null }) => {
    state.activities.unshift({
      id: `activity_${state.activities.length + 1}`,
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? null,
      ...input,
    });
  }),
  listObservabilityActivities: vi.fn(async (filters?: {
    tenantId?: string;
    saasId?: string;
    sourceType?: string;
    sourceKey?: string;
    limit?: number;
  }) => {
    const items = state.activities.filter((item) => {
      if (filters?.tenantId && item.tenantId !== filters.tenantId) return false;
      if (filters?.saasId && item.saasId !== filters.saasId) return false;
      if (filters?.sourceType && item.sourceType !== filters.sourceType) return false;
      if (filters?.sourceKey && item.sourceKey !== filters.sourceKey) return false;
      return true;
    });
    return items.slice(0, filters?.limit ?? items.length);
  }),
  openObservabilityIncident: vi.fn(async (input: Omit<IncidentRecord, "id" | "status" | "openedAt" | "resolvedAt" | "updatedAt"> & { details?: Record<string, unknown> | null }) => {
    state.incidents.unshift({
      id: `incident_${state.incidents.length + 1}`,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      updatedAt: new Date().toISOString(),
      details: input.details ?? null,
      ...input,
    });
  }),
  resolveObservabilityIncidentsByScope: vi.fn(async (filters: {
    tenantId: string;
    saasId: string;
    sourceType: string;
    sourceKey: string;
    incidentType?: string;
  }) => {
    for (const incident of state.incidents) {
      if (
        incident.tenantId === filters.tenantId
        && incident.saasId === filters.saasId
        && incident.sourceType === filters.sourceType
        && incident.sourceKey === filters.sourceKey
        && (!filters.incidentType || incident.incidentType === filters.incidentType)
      ) {
        incident.status = "RESOLVED";
        incident.resolvedAt = new Date().toISOString();
        incident.updatedAt = new Date().toISOString();
      }
    }
  }),
  getObservabilityStatusSummary: vi.fn(async ({ tenantId, saasId }: { tenantId: string; saasId: string }) => {
    const latestActivity = state.activities.find((item) => item.tenantId === tenantId && item.saasId === saasId) ?? null;
    const openIncidentsCount = state.incidents.filter(
      (item) => item.tenantId === tenantId && item.saasId === saasId && item.status === "OPEN",
    ).length;
    return {
      tenantId,
      saasId,
      overallStatus: openIncidentsCount > 0 ? "degraded" : "healthy",
      freshnessStatus: latestActivity ? "fresh" : "stale",
      openIncidentsCount,
      latestActivityAt: latestActivity?.createdAt ?? null,
      latestSnapshotAt: null,
      recommendation: openIncidentsCount > 0 ? "Review open incidents." : "Operational activity looks recent.",
    };
  }),
}));

vi.mock("@/lib/factory/registry", () => ({
  listFactorySaas: vi.fn(async () => [
    {
      saasId: "taskops",
      displayName: "TaskOps",
      template: "basic-operational-saas",
      status: "ACTIVE",
      createdBy: null,
      supportsOperatorSurface: true,
      metadata: { operatorTenantId: "tenant_taskops" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ]),
  getFactorySaas: vi.fn(async (saasId: string) => saasId === "taskops"
    ? {
        saasId: "taskops",
        displayName: "TaskOps",
        template: "basic-operational-saas",
        status: "ACTIVE",
        createdBy: null,
        supportsOperatorSurface: true,
        metadata: { operatorTenantId: "tenant_taskops" },
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }
    : null),
  setFactorySaasStatus: vi.fn(),
  archiveFactorySaas: vi.fn(),
}));

describe("cross-saas taskops flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    resetState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00.000Z"));
  });

  it("emits task.overdue, routes it to TaskOps, runs the automation and exposes activity in the control plane", async () => {
    const { registerSaasPlatformDefinition, registerSaasPlatformBootstrap } = await import("@/lib/saas-contract");
    const { taskOpsPlatformDefinition, taskOpsPlatformBootstrap } = await import("@/lib/campobase/taskops-platform");
    const { emitSignal } = await import("@/lib/execution/signal-bus");
    const { listFactoryControlPlane } = await import("@/lib/factory/control-plane");

    registerSaasPlatformDefinition(taskOpsPlatformDefinition);
    registerSaasPlatformBootstrap(taskOpsPlatformBootstrap);
    await taskOpsPlatformBootstrap.connect({ tenantId: "tenant_taskops", saasId: "taskops" });

    const signal = await emitSignal({
      type: "task.overdue",
      sourceSaasId: "clinic",
      sourceTenantId: "tenant_taskops",
      payload: { taskId: "task_1", severity: "CRITICAL" },
    });

    expect(signal.type).toBe("task.overdue");
    expect(state.executions).toHaveLength(1);
    expect(state.executions[0]).toMatchObject({
      tenant_id: "tenant_taskops",
      saas_id: "taskops",
      automation_key: "taskops.pending_task_audit",
      trigger_type: "system",
      triggered_by: "signal:task.overdue",
      status: "SUCCESS",
    });

    expect(state.activities.some((item) =>
      item.saasId === "clinic" && item.activityType === "signal_emitted" && item.metadata?.signalId === signal.signalId,
    )).toBe(true);
    expect(state.activities.some((item) =>
      item.saasId === "taskops" && item.activityType === "signal_handled" && item.metadata?.signalId === signal.signalId,
    )).toBe(true);
    expect(state.activities.some((item) =>
      item.saasId === "taskops" && item.activityType === "automation_execution",
    )).toBe(true);
    expect(state.incidents).toHaveLength(0);

    const items = await listFactoryControlPlane();
    expect(items).toHaveLength(1);
    expect(items[0].saasId).toBe("taskops");
    expect(items[0].participatesInExecutionLayer).toBe(true);
    expect(items[0].operationalSummary?.overallStatus).toBe("healthy");
    expect(items[0].recentSignals).toHaveLength(1);
    expect(items[0].recentSignals[0]).toMatchObject({
      activityType: "signal_handled",
      saasId: "taskops",
      status: "success",
    });
  });
});
