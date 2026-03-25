import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  registrations: [] as Array<Record<string, unknown>>,
  executions: [] as Array<Record<string, unknown>>,
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
  AutomationCoreError,
  disableAutomation,
  enableAutomation,
  getAutomationExecutionSummary,
  listAutomationExecutions,
  listAutomations,
  registerAutomation,
  registerAutomationHandler,
  triggerAutomation,
} from "@/lib/automation-core";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_automation_registrations")) {
      const [tenantId, saasId, automationKey] = params;
      const row = dbState.registrations.find(
        (item) => item.tenant_id === tenantId && item.saas_id === saasId && item.automation_key === automationKey,
      );
      return row ? clone(row) : null;
    }

    if (sql.includes("FROM drako_automation_executions")) {
      if (sql.includes("status = 'RUNNING'")) {
        const [tenantId, saasId, automationKey] = params;
        const running = dbState.executions.find(
          (item) =>
            item.tenant_id === tenantId
            && item.saas_id === saasId
            && item.automation_key === automationKey
            && item.status === "RUNNING",
        );
        return running ? clone(running) : null;
      }

      const [executionId] = params;
      const row = dbState.executions.find((item) => item.id === executionId);
      return row ? clone(row) : null;
    }

    return null;
  });

  queryAll.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_automation_registrations")) {
      let rows = [...dbState.registrations];
      let cursor = 0;

      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("automation_key = ?")) {
        rows = rows.filter((item) => item.automation_key === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("enabled = ?")) {
        rows = rows.filter((item) => item.enabled === params[cursor]);
      }

      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return clone(rows);
    }

    if (sql.includes("FROM drako_automation_executions")) {
      let rows = [...dbState.executions];
      let cursor = 0;

      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("automation_key = ?")) {
        rows = rows.filter((item) => item.automation_key === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("status = ?")) {
        rows = rows.filter((item) => item.status === params[cursor]);
        cursor += 1;
      }

      const limit = Number(params[params.length - 1] ?? 50);
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return clone(rows.slice(0, limit));
    }

    return [];
  });

  run.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.startsWith("INSERT INTO drako_automation_registrations")) {
      dbState.registrations.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        automation_key: params[3],
        display_name: params[4],
        description: params[5],
        enabled: params[6],
        schedule_mode: params[7],
        frequency_unit: params[8],
        frequency_value: params[9],
        config_json: params[10],
        owner_scope: params[11],
        created_at: params[12],
        updated_at: params[13],
      });
      return true;
    }

    if (sql.startsWith("UPDATE drako_automation_registrations")) {
      const registration = dbState.registrations.find(
        (item) => item.tenant_id === params[9] && item.saas_id === params[10] && item.automation_key === params[11],
      );
      if (registration) {
        registration.display_name = params[0];
        registration.description = params[1];
        registration.enabled = params[2];
        registration.schedule_mode = params[3];
        registration.frequency_unit = params[4];
        registration.frequency_value = params[5];
        registration.config_json = params[6];
        registration.owner_scope = params[7];
        registration.updated_at = params[8];
      }
      return true;
    }

    if (sql.includes("SET enabled = ?, updated_at = ?")) {
      const registration = dbState.registrations.find(
        (item) => item.tenant_id === params[2] && item.saas_id === params[3] && item.automation_key === params[4],
      );
      if (registration) {
        registration.enabled = params[0];
        registration.updated_at = params[1];
      }
      return true;
    }

    if (sql.startsWith("INSERT INTO drako_automation_executions")) {
      dbState.executions.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        automation_key: params[3],
        trigger_type: params[4],
        triggered_by: params[5],
        status: "RUNNING",
        summary: null,
        metrics_json: null,
        output_json: null,
        error_code: null,
        error_message: null,
        started_at: params[6],
        finished_at: null,
        created_at: params[7],
        updated_at: params[8],
      });
      return true;
    }

    if (sql.startsWith("UPDATE drako_automation_executions")) {
      const execution = dbState.executions.find((item) => item.id === params[8]);
      if (execution) {
        execution.status = params[0];
        execution.summary = params[1];
        execution.metrics_json = params[2];
        execution.output_json = params[3];
        execution.error_code = params[4];
        execution.error_message = params[5];
        execution.finished_at = params[6];
        execution.updated_at = params[7];
      }
      return true;
    }

    return true;
  });
}

describe("automation core", () => {
  beforeEach(() => {
    dbState.registrations = [];
    dbState.executions = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("registers, enables and lists automations", async () => {
    const registration = await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.automation",
      displayName: "Demo automation",
      enabled: false,
      scheduleMode: "scheduled",
      frequencyUnit: "week",
      frequencyValue: 2,
      config: { tone: "direct" },
    });

    expect(registration.enabled).toBe(false);

    const enabled = await enableAutomation("tenant-a", "saas-a", "demo.automation");
    expect(enabled.enabled).toBe(true);

    const disabled = await disableAutomation("tenant-a", "saas-a", "demo.automation");
    expect(disabled.enabled).toBe(false);

    const list = await listAutomations({ automationKey: "demo.automation" });
    expect(list).toHaveLength(1);
  });

  it("triggers automation and stores execution history", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.automation",
      displayName: "Demo automation",
      enabled: true,
      config: { niche: "fitness" },
    });

    registerAutomationHandler("demo.automation", async ({ tenantId, saasId }) => ({
      ok: true,
      summary: "Executed",
      metrics: { processed: 3 },
      output: { tenantId, saasId },
    }));

    const triggered = await triggerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.automation",
      triggerType: "manual",
      triggeredBy: "owner",
    });

    expect(triggered.result.ok).toBe(true);

    const history = await listAutomationExecutions({ automationKey: "demo.automation" });
    const summary = await getAutomationExecutionSummary({ automationKey: "demo.automation" });

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("SUCCESS");
    expect(history[0].metrics.processed).toBe(3);
    expect(summary.totalRuns).toBe(1);
    expect(summary.successRuns).toBe(1);
  });

  it("rejects trigger when automation does not exist", async () => {
    await expect(
      triggerAutomation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: "missing.automation",
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_NOT_REGISTERED" satisfies AutomationCoreError["code"] });
  });

  it("rejects trigger when automation is disabled", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "disabled.automation",
      displayName: "Disabled automation",
      enabled: false,
    });

    registerAutomationHandler("disabled.automation", async () => ({
      ok: true,
      summary: "Should not run",
    }));

    await expect(
      triggerAutomation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: "disabled.automation",
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_DISABLED" satisfies AutomationCoreError["code"] });
  });

  it("rejects trigger when handler is missing", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "no.handler",
      displayName: "No handler automation",
      enabled: true,
    });

    await expect(
      triggerAutomation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: "no.handler",
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HANDLER_MISSING" satisfies AutomationCoreError["code"] });
  });

  it("rejects trigger when an execution is already running", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.running",
      displayName: "Demo running",
      enabled: true,
    });

    dbState.executions.push({
      id: "execution_running",
      tenant_id: "tenant-a",
      saas_id: "saas-a",
      automation_key: "demo.running",
      trigger_type: "manual",
      triggered_by: "owner",
      status: "RUNNING",
      summary: null,
      metrics_json: null,
      output_json: null,
      error_code: null,
      error_message: null,
      started_at: "2024-01-01T00:00:00.000Z",
      finished_at: null,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    });

    registerAutomationHandler("demo.running", async () => ({
      ok: true,
      summary: "Should not run twice",
    }));

    await expect(
      triggerAutomation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: "demo.running",
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_EXECUTION_IN_PROGRESS" satisfies AutomationCoreError["code"] });
  });

  it("keeps history separated by automation key for parallel automations", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.content",
      displayName: "Demo content",
      enabled: true,
    });
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.health",
      displayName: "Demo health",
      enabled: true,
    });

    registerAutomationHandler("demo.content", async () => ({
      ok: true,
      summary: "Content ok",
      metrics: { postsCount: 2 },
      output: { campaignId: "campaign-1" },
    }));
    registerAutomationHandler("demo.health", async () => ({
      ok: true,
      summary: "Health ok",
      metrics: { checksPassed: 3 },
      output: { recommendedAction: "Ready" },
    }));

    await triggerAutomation({ tenantId: "tenant-a", saasId: "saas-a", automationKey: "demo.content" });
    await triggerAutomation({ tenantId: "tenant-a", saasId: "saas-a", automationKey: "demo.health" });

    const contentHistory = await listAutomationExecutions({ automationKey: "demo.content" });
    const healthHistory = await listAutomationExecutions({ automationKey: "demo.health" });

    expect(contentHistory).toHaveLength(1);
    expect(healthHistory).toHaveLength(1);
    expect(contentHistory[0].output).toEqual({ campaignId: "campaign-1" });
    expect(healthHistory[0].output).toEqual({ recommendedAction: "Ready" });
  });
});
