import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  registrations: [] as Array<Record<string, unknown>>,
  executions: [] as Array<Record<string, unknown>>,
}));

const queryOne = vi.hoisted(() => vi.fn());
const run = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const openObservabilityIncident = vi.hoisted(() => vi.fn());
const resolveObservabilityIncidentsByScope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  queryOne,
  run,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
  openObservabilityIncident,
  resolveObservabilityIncidentsByScope,
}));

import { registerAutomationHandler } from "@/lib/automation-core/handlers";
import { registerAutomation } from "@/lib/automation-core/registry";
import { triggerAutomation } from "@/lib/automation-core/execution";

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_automation_registrations")) {
      const [tenantId, saasId, automationKey] = params;
      const row = dbState.registrations.find(
        (item) => item.tenant_id === tenantId && item.saas_id === saasId && item.automation_key === automationKey,
      );
      return row ?? null;
    }
    if (sql.includes("FROM drako_automation_executions")) {
      if (sql.includes("status = 'RUNNING'")) {
        return dbState.executions.find(
          (item) => item.tenant_id === params[0] && item.saas_id === params[1] && item.automation_key === params[2] && item.status === "RUNNING",
        ) ?? null;
      }
      return dbState.executions.find((item) => item.id === params[0]) ?? null;
    }
    return null;
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
      const row = dbState.executions.find((item) => item.id === params[8]);
      if (row) {
        row.status = params[0];
        row.summary = params[1];
        row.error_code = params[4];
        row.error_message = params[5];
      }
      return true;
    }
    return true;
  });
}

describe("automation core observability integration", () => {
  beforeEach(() => {
    dbState.registrations = [];
    dbState.executions = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("records activity on successful execution", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.success",
      displayName: "Demo success",
      enabled: true,
    });
    registerAutomationHandler("demo.success", async () => ({ ok: true, summary: "Done" }));

    await triggerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.success",
    });

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        saasId: "saas-a",
        sourceType: "automation",
        sourceKey: "demo.success",
        status: "success",
      }),
    );
    expect(openObservabilityIncident).not.toHaveBeenCalled();
    expect(resolveObservabilityIncidentsByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        saasId: "saas-a",
        sourceType: "automation",
        sourceKey: "demo.success",
        incidentType: "automation_execution_failed",
      }),
    );
  });

  it("records activity and incident on failed execution", async () => {
    await registerAutomation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "demo.fail",
      displayName: "Demo fail",
      enabled: true,
    });
    registerAutomationHandler("demo.fail", async () => {
      throw new Error("BOOM");
    });

    await expect(
      triggerAutomation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        automationKey: "demo.fail",
      }),
    ).rejects.toBeTruthy();

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "demo.fail",
        status: "error",
      }),
    );
    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "automation",
        sourceKey: "demo.fail",
      }),
    );
  });
});
