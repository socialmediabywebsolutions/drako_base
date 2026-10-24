import { beforeEach, describe, expect, it, vi } from "vitest";

const listFactorySaas = vi.hoisted(() => vi.fn());
const getFactorySaas = vi.hoisted(() => vi.fn());
const setFactorySaasStatus = vi.hoisted(() => vi.fn());
const archiveFactorySaas = vi.hoisted(() => vi.fn());
const getObservabilityStatusSummary = vi.hoisted(() => vi.fn());
const listObservabilityActivities = vi.hoisted(() => vi.fn());
const resolveSaasPlatform = vi.hoisted(() => vi.fn());

vi.mock("@/lib/factory/registry", () => ({
  listFactorySaas,
  getFactorySaas,
  setFactorySaasStatus,
  archiveFactorySaas,
}));

vi.mock("@/lib/observability-core", () => ({
  getObservabilityStatusSummary,
  listObservabilityActivities,
}));

vi.mock("@/lib/saas-contract", () => ({
  resolveSaasPlatform,
}));

describe("factory control plane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFactorySaas.mockResolvedValue([
      {
        saasId: "runtime_ops_alpha",
        displayName: "Runtime Ops Alpha",
        template: "basic-operational-saas",
        status: "ACTIVE",
        createdBy: null,
        supportsOperatorSurface: true,
        metadata: { operatorTenantId: "tenant_factory" },
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    getFactorySaas.mockResolvedValue({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      template: "basic-operational-saas",
      status: "ACTIVE",
      createdBy: null,
      supportsOperatorSurface: true,
      metadata: { operatorTenantId: "tenant_factory" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    setFactorySaasStatus.mockResolvedValue({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      template: "basic-operational-saas",
      status: "DEGRADED",
      createdBy: null,
      supportsOperatorSurface: true,
      metadata: { operatorTenantId: "tenant_factory" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    });
    archiveFactorySaas.mockResolvedValue({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      template: "basic-operational-saas",
      status: "ARCHIVED",
      createdBy: null,
      supportsOperatorSurface: true,
      metadata: { operatorTenantId: "tenant_factory" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    });
    getObservabilityStatusSummary.mockResolvedValue({
      tenantId: "tenant_factory",
      saasId: "runtime_ops_alpha",
      overallStatus: "healthy",
      freshnessStatus: "fresh",
      openIncidentsCount: 0,
      latestActivityAt: "2024-01-02T10:00:00.000Z",
      latestSnapshotAt: "2024-01-02T10:05:00.000Z",
      recommendation: "Operational activity looks recent.",
    });
    listObservabilityActivities.mockResolvedValue([
      {
        id: "activity_signal",
        tenantId: "tenant_factory",
        saasId: "runtime_ops_alpha",
        sourceType: "saas",
        sourceKey: "runtime_ops_alpha",
        activityType: "signal_handled",
        status: "success",
        summary: "Signal task.overdue handled by runtime_ops_alpha.",
        metadata: { signalId: "signal_1" },
        createdAt: "2024-01-02T10:01:00.000Z",
      },
      {
        id: "activity_other",
        tenantId: "tenant_factory",
        saasId: "runtime_ops_alpha",
        sourceType: "automation",
        sourceKey: "runtime_ops_alpha",
        activityType: "automation_executed",
        status: "success",
        summary: "Automation executed.",
        metadata: null,
        createdAt: "2024-01-02T09:00:00.000Z",
      },
    ]);
    resolveSaasPlatform.mockReturnValue({
      definition: { saasId: "runtime_ops_alpha" },
      bootstrap: { signalHandlers: { "task.overdue": vi.fn() } },
    });
  });

  it("lists control-plane items with lifecycle and operational summary", async () => {
    const { listFactoryControlPlane } = await import("@/lib/factory/control-plane");
    const items = await listFactoryControlPlane();

    expect(items).toHaveLength(1);
    expect(items[0].runtimeRegistered).toBe(true);
    expect(items[0].participatesInExecutionLayer).toBe(true);
    expect(items[0].operationalSummary?.overallStatus).toBe("healthy");
    expect(items[0].latestActivityAt).toBe("2024-01-02T10:00:00.000Z");
    expect(items[0].recentSignals).toHaveLength(1);
    expect(items[0].recentSignals[0].activityType).toBe("signal_handled");
  });

  it("updates lifecycle status through the control plane", async () => {
    const { setFactoryControlPlaneStatus, archiveFactoryControlPlaneSaas } = await import("@/lib/factory/control-plane");

    const degraded = await setFactoryControlPlaneStatus("runtime_ops_alpha", "DEGRADED");
    const archived = await archiveFactoryControlPlaneSaas("runtime_ops_alpha");

    expect(degraded.status).toBe("DEGRADED");
    expect(archived.status).toBe("ARCHIVED");
  });
});
