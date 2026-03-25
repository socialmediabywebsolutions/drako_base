import { beforeEach, describe, expect, it, vi } from "vitest";

const capturedHandlers = vi.hoisted(() => new Map<string, Function>());
const getAutomation = vi.hoisted(() => vi.fn());
const registerAutomation = vi.hoisted(() => vi.fn());
const registerAutomationHandler = vi.hoisted(() => vi.fn((automationKey: string, handler: Function) => {
  capturedHandlers.set(automationKey, handler);
}));
const getIntegrationConnection = vi.hoisted(() => vi.fn());
const connectIntegration = vi.hoisted(() => vi.fn());
const ensureWhatsappIntegrationAvailable = vi.hoisted(() => vi.fn());
const resolveTasksContext = vi.hoisted(() => vi.fn());
const listTasks = vi.hoisted(() => vi.fn());
const resolveWhatsappContext = vi.hoisted(() => vi.fn());
const listWhatsappIdentities = vi.hoisted(() => vi.fn());
const registerFactorySaas = vi.hoisted(() => vi.fn());

vi.mock("@/lib/automation-core", () => ({
  getAutomation,
  registerAutomation,
  registerAutomationHandler,
}));

vi.mock("@/lib/integration-core", () => ({
  getIntegrationConnection,
  connectIntegration,
}));

vi.mock("@/lib/integration-core/providers/whatsapp", () => ({
  WHATSAPP_INTEGRATION_KEY: "whatsapp",
  ensureWhatsappIntegrationAvailable,
}));

vi.mock("@/lib/tasks/repository", () => ({
  resolveTasksContext,
  listTasks,
}));

vi.mock("@/lib/whatsapp/repository", () => ({
  resolveWhatsappContext,
  listWhatsappIdentities,
}));

vi.mock("@/lib/factory/registry", () => ({
  registerFactorySaas,
}));

describe("factory orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandlers.clear();
    vi.resetModules();

    registerAutomationHandler.mockImplementation((automationKey: string, handler: Function) => {
      capturedHandlers.set(automationKey, handler);
    });
    getAutomation.mockResolvedValue(null);
    getIntegrationConnection.mockResolvedValue(null);
    resolveTasksContext.mockResolvedValue({ tenantId: "tenant_factory", saasId: "runtime_ops_alpha", mode: "demo" });
    resolveWhatsappContext.mockResolvedValue({ tenantId: "tenant_factory", saasId: "runtime_ops_alpha", mode: "demo" });
    listWhatsappIdentities.mockResolvedValue([]);
    registerFactorySaas.mockResolvedValue({
      saasId: "runtime_ops_alpha",
      status: "ACTIVE",
    });
  });

  it("creates a SaaS instance in runtime and makes it resolvable through the contract", async () => {
    const { createSaasInstance } = await import("@/lib/factory/orchestrator");
    const { resolveSaasPlatform } = await import("@/lib/saas-contract");

    const created = await createSaasInstance({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      initialIntegrations: ["whatsapp"],
    });

    expect(created.definition).toMatchObject({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      supportsOperatorSurface: true,
    });
    expect(created.definition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationKey: "runtime_ops_alpha.daily_health_check",
        }),
      ]),
    );

    const resolved = resolveSaasPlatform("runtime_ops_alpha");
    expect(resolved?.definition.saasId).toBe("runtime_ops_alpha");
    expect(resolved?.bootstrap).not.toBeNull();
    expect(registerFactorySaas).toHaveBeenCalledWith(expect.objectContaining({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      status: "ACTIVE",
      supportsOperatorSurface: true,
    }));
  });

  it("loads the runtime SaaS via the shared loader and registers automation + integration", async () => {
    const { createSaasInstance } = await import("@/lib/factory/orchestrator");
    const { loadPlatformForSaas } = await import("@/lib/campobase/platform-bootstrap");

    await createSaasInstance({
      saasId: "runtime_ops_beta",
      displayName: "Runtime Ops Beta",
      initialIntegrations: ["whatsapp"],
    });

    await loadPlatformForSaas("tenant_factory", "runtime_ops_beta");

    expect(registerAutomation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_factory",
      saasId: "runtime_ops_beta",
      automationKey: "runtime_ops_beta.daily_health_check",
    }));
    expect(ensureWhatsappIntegrationAvailable).toHaveBeenCalledTimes(1);
    expect(connectIntegration).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_factory",
      saasId: "runtime_ops_beta",
      integrationKey: "whatsapp",
    }));
  });

  it("executes the runtime automation handler with standard output", async () => {
    listTasks.mockResolvedValue([
      { id: "task_1", status: "OPEN", severity: "INFO" },
      { id: "task_2", status: "IN_PROGRESS", severity: "CRITICAL" },
      { id: "task_3", status: "DONE", severity: "INFO" },
    ]);

    const { createSaasInstance } = await import("@/lib/factory/orchestrator");
    await createSaasInstance({
      saasId: "runtime_ops_gamma",
      displayName: "Runtime Ops Gamma",
    });

    const handler = capturedHandlers.get("runtime_ops_gamma.daily_health_check");
    expect(handler).toBeTypeOf("function");

    const result = await handler({
      executionId: "execution_runtime_ops_gamma_1",
      tenantId: "tenant_factory",
      saasId: "runtime_ops_gamma",
      automationKey: "runtime_ops_gamma.daily_health_check",
      config: null,
      triggerType: "manual",
    });

    expect(result).toMatchObject({
      ok: true,
      metrics: {
        openTasks: 1,
        inProgressTasks: 1,
        criticalOpenTasks: 1,
      },
    });
    expect(result.summary).toContain("Runtime Ops Gamma health check");
  });
});
