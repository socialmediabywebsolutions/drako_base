import { beforeEach, describe, expect, it, vi } from "vitest";

const capturedHandlers = vi.hoisted(() => new Map<string, Function>());
const registerAutomation = vi.hoisted(() => vi.fn());
const getAutomation = vi.hoisted(() => vi.fn());
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

describe("taskops platform service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandlers.clear();
    vi.resetModules();

    registerAutomationHandler.mockImplementation((automationKey: string, handler: Function) => {
      capturedHandlers.set(automationKey, handler);
    });

    resolveTasksContext.mockResolvedValue({ tenantId: "tenant_taskops", saasId: "saas_taskops", mode: "demo" });
    resolveWhatsappContext.mockResolvedValue({ tenantId: "tenant_taskops", saasId: "saas_taskops", mode: "demo" });
    getAutomation.mockResolvedValue(null);
    getIntegrationConnection.mockResolvedValue(null);
    listWhatsappIdentities.mockResolvedValue([]);
  });

  it("registers TaskOps automation and whatsapp connection from bootstrap", async () => {
    const { TASKOPS_PENDING_TASK_AUDIT_KEY, registerTaskOpsPlatform } = await import("@/lib/campobase/taskops-platform-service");

    await registerTaskOpsPlatform("tenant_taskops", "saas_taskops");

    expect(ensureWhatsappIntegrationAvailable).toHaveBeenCalledTimes(1);
    expect(registerAutomation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
      automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY,
      displayName: "TaskOps pending task audit",
    }));
    expect(connectIntegration).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
      integrationKey: "whatsapp",
    }));
  });

  it("runs the pending task audit through the standard automation contract", async () => {
    listTasks.mockResolvedValue([
      {
        id: "task_open",
        status: "OPEN",
        severity: "WARNING",
        dueDate: "2099-01-08T09:00:00.000Z",
      },
      {
        id: "task_critical",
        status: "IN_PROGRESS",
        severity: "CRITICAL",
        dueDate: "2099-01-07T08:00:00.000Z",
      },
      {
        id: "task_done",
        status: "DONE",
        severity: "INFO",
        dueDate: "2099-01-05T08:00:00.000Z",
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-10T08:00:00.000Z"));

    const { TASKOPS_PENDING_TASK_AUDIT_KEY } = await import("@/lib/campobase/taskops-platform-service");
    const handler = capturedHandlers.get(TASKOPS_PENDING_TASK_AUDIT_KEY);

    expect(handler).toBeTypeOf("function");

    const result = await handler({
      executionId: "execution_taskops_1",
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
      automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY,
      config: {
        overdueAfterHours: 24,
      },
      triggerType: "manual",
    });

    expect(resolveTasksContext).toHaveBeenCalledWith({
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
    });
    expect(result).toMatchObject({
      ok: true,
      metrics: {
        pendingOpenTasks: 2,
        overdueTasks: 2,
        criticalOpenTasks: 1,
      },
    });
    expect(result.summary).toContain("2 pending tasks");
    expect(result.output?.summary).toContain("1 critical open");

    vi.useRealTimers();
  });
});
