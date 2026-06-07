import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeD1Database {
  lastCreateTableSql: string | null = null;
  runRows: Array<{
    id: string;
    tenant_id: string;
    saas_id: string;
    automation_key: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    result_json: string | null;
    error_code: string | null;
    error_message: string | null;
    error_details_json: string | null;
    error_retryable: number | null;
    triggered_by_actor_type: string;
    triggered_by_actor_id: string | null;
    request_id: string | null;
    created_at: string;
  }> = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  reset() {
    this.lastCreateTableSql = null;
    this.runRows = [];
  }
}

class FakeStatement {
  constructor(
    private db: FakeD1Database,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new FakeStatement(this.db, this.sql, values);
  }

  async all<T>() {
    return { results: this.executeSelect() as T[] };
  }

  async run() {
    this.executeRun();
    return { success: true };
  }

  private executeSelect() {
    const normalized = this.sql.toLowerCase();

    if (normalized.startsWith("select") && normalized.includes("from campamento_base_social_automation_history_runs")) {
      let rows = [...this.db.runRows];

      if (normalized.includes("where tenant_id = ? and saas_id = ? and automation_key = ?")) {
        const [tenantId, saasId, automationKey] = this.params as [string, string, string, number];
        rows = rows.filter((row) => row.tenant_id === tenantId && row.saas_id === saasId);
        rows = rows.filter((row) => row.automation_key === automationKey);
      } else if (normalized.includes("where tenant_id = ? and saas_id = ?")) {
        const [tenantId, saasId] = this.params as [string, string, number];
        rows = rows.filter((row) => row.tenant_id === tenantId && row.saas_id === saasId);
      } else if (normalized.includes("where automation_key = ?")) {
        const [automationKey] = this.params as [string, number];
        rows = rows.filter((row) => row.automation_key === automationKey);
      }

      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

      const lastParam = this.params[this.params.length - 1];
      if (typeof lastParam === "number") {
        rows = rows.slice(0, lastParam);
      }

      return rows;
    }

    throw new Error(`Unsupported SQL: ${this.sql}`);
  }

  private executeRun() {
    const normalized = this.sql.toLowerCase();

    if (normalized.startsWith("create table") || normalized.startsWith("create index")) {
      if (normalized.startsWith("create table")) {
        this.db.lastCreateTableSql = this.sql;
      }
      return;
    }

    if (normalized.startsWith("insert into campamento_base_social_automation_history_runs")) {
      const [
        id,
        tenantId,
        saasId,
        automationKey,
        status,
        startedAt,
        completedAt,
        durationMs,
        resultJson,
        errorCode,
        errorMessage,
        errorDetailsJson,
        errorRetryable,
        triggeredByActorType,
        triggeredByActorId,
        requestId,
        createdAt,
      ] = this.params as [
        string,
        string,
        string,
        string,
        string,
        string,
        string | null,
        number | null,
        string | null,
        string | null,
        string | null,
        string | null,
        number | null,
        string,
        string | null,
        string | null,
        string,
      ];
      this.db.runRows.push({
        id,
        tenant_id: tenantId,
        saas_id: saasId,
        automation_key: automationKey,
        status,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        result_json: resultJson,
        error_code: errorCode,
        error_message: errorMessage,
        error_details_json: errorDetailsJson,
        error_retryable: errorRetryable,
        triggered_by_actor_type: triggeredByActorType,
        triggered_by_actor_id: triggeredByActorId,
        request_id: requestId,
        created_at: createdAt,
      });
      return;
    }

    throw new Error(`Unsupported SQL: ${this.sql}`);
  }
}

const db = new FakeD1Database();

vi.mock("@/lib/db", () => ({
  getDb: () => db as unknown as D1Database,
}));

import {
  listSocialAutomationRuns,
  listSocialAutomationRunsForSaas,
  recordSocialAutomationRun,
  type SocialAutomationHistoryStatus,
} from "@/lib/campamento-base/social-automation-history";

const SOCIALFLOW_AUTOMATION_KEY = "socialflow.content_generation";

describe("campobase social automation history", () => {
  beforeEach(() => {
    db.reset();
  });

  it("creates schema with status CHECK constraint", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-check",
      saasId: "saas-check",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:01:00.000Z",
      result: {
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
      },
      error: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const sql = (db.lastCreateTableSql ?? "").toLowerCase();
    expect(sql).toContain("check (status in");
    expect(sql).toContain("'success'");
    expect(sql).toContain("'failed'");
  });

  it("rejects invalid status", async () => {
    await expect(
      recordSocialAutomationRun({
        tenantId: "tenant-invalid",
        saasId: "saas-invalid",
        automationKey: SOCIALFLOW_AUTOMATION_KEY,
        status: "INVALID" as unknown as SocialAutomationHistoryStatus,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:01:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("INVALID_SOCIAL_AUTOMATION_HISTORY_STATUS");
  });

  it("records success run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const run = await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:05:00.000Z",
      result: {
        campaignId: "campaign-1",
        postsCount: 3,
        scheduledCount: 2,
      },
      error: null,
    });

    expect(run.id).toBeTruthy();
    expect(run.status).toBe("SUCCESS");
    expect(run.result?.campaignId).toBe("campaign-1");
    expect(run.error).toBeNull();
    expect(run.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(db.runRows[0].id).toBe(run.id);

    vi.useRealTimers();
  });

  it("records failed run", async () => {
    const run = await recordSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "FAILED",
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:01:00.000Z",
      result: {
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
      },
      error: {
        code: "SOCIAL_AUTOMATION_ENGINE_FAIL",
        message: "ENGINE_FAIL",
      },
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    expect(run.status).toBe("FAILED");
    expect(run.result?.campaignId).toBeNull();
    expect(run.error?.message).toBe("ENGINE_FAIL");
  });

  it("stores null campaignId and error as real nulls", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-null",
      saasId: "saas-null",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-04T00:00:00.000Z",
      completedAt: "2024-01-04T00:01:00.000Z",
      result: {
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
      },
      error: null,
      createdAt: "2024-01-04T00:00:00.000Z",
    });

    const persistedResult = JSON.parse(db.runRows[0].result_json ?? "{}") as {
      campaignId?: string | null;
    };
    expect(persistedResult.campaignId ?? null).toBeNull();
    expect(db.runRows[0].error_message).toBeNull();
  });

  it("lists runs ordered by created_at desc", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:05:00.000Z",
      result: {
        campaignId: "campaign-1",
        postsCount: 1,
        scheduledCount: 1,
      },
      error: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-03T00:00:00.000Z",
      completedAt: "2024-01-03T00:06:00.000Z",
      result: {
        campaignId: "campaign-2",
        postsCount: 2,
        scheduledCount: 2,
      },
      error: null,
      createdAt: "2024-01-03T00:00:00.000Z",
    });

    const list = await listSocialAutomationRuns();
    expect(list[0].saasId).toBe("saas-b");
    expect(list[1].saasId).toBe("saas-a");
  });

  it("lists runs by tenant + saas", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:05:00.000Z",
      result: {
        campaignId: "campaign-1",
        postsCount: 1,
        scheduledCount: 1,
      },
      error: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      automationKey: SOCIALFLOW_AUTOMATION_KEY,
      status: "FAILED",
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:05:00.000Z",
      result: {
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
      },
      error: {
        code: "SOCIAL_AUTOMATION_ENGINE_FAIL",
        message: "ENGINE_FAIL",
      },
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    const list = await listSocialAutomationRunsForSaas({
      tenantId: "tenant-a",
      saasId: "saas-a",
    });
    expect(list).toHaveLength(1);
    expect(list[0].tenantId).toBe("tenant-a");
    expect(list[0].saasId).toBe("saas-a");
  });
});
