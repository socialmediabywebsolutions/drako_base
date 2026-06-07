import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

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

    if (!normalized.startsWith("select") || !normalized.includes("from campamento_base_social_automation_history_runs")) {
      throw new Error(`Unsupported SQL: ${this.sql}`);
    }

    let rows = [...this.db.runRows];

    if (normalized.includes("where tenant_id = ? and saas_id = ? and automation_key = ? and request_id = ?")) {
      const [tenantId, saasId, automationKey, requestId] = this.params as [string, string, string, string];
      rows = rows.filter((row) =>
        row.tenant_id === tenantId
        && row.saas_id === saasId
        && row.automation_key === automationKey
        && row.request_id === requestId,
      );
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return rows.slice(0, 1);
    }

    let index = 0;

    if (normalized.includes("where tenant_id = ? and saas_id = ?")) {
      const tenantId = this.params[index] as string;
      const saasId = this.params[index + 1] as string;
      rows = rows.filter((row) => row.tenant_id === tenantId && row.saas_id === saasId);
      index += 2;
    }

    if (normalized.includes("status = ?")) {
      const status = this.params[index] as string;
      rows = rows.filter((row) => row.status === status);
      index += 1;
    }

    if (normalized.includes("automation_key = ?")) {
      const automationKey = this.params[index] as string;
      rows = rows.filter((row) => row.automation_key === automationKey);
      index += 1;
    }

    if (normalized.includes("request_id = ?")) {
      const requestId = this.params[index] as string;
      rows = rows.filter((row) => row.request_id === requestId);
      index += 1;
    }

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const limitCandidate = this.params[this.params.length - 1];
    if (typeof limitCandidate === "number") {
      rows = rows.slice(0, limitCandidate);
    }

    return rows;
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
  getSocialAutomationHistorySummary,
  listSocialAutomationRuns,
  listSocialAutomationRunsForSaas,
  recordSocialAutomationFailure,
  recordSocialAutomationRun,
} from "@/lib/campamento-base/social-automation-history";

describe("campamento-base social automation history", () => {
  beforeEach(() => {
    db.reset();
  });

  it("does not import legacy namespace in canonical module", () => {
    const source = readFileSync(
      "src/lib/campamento-base/social-automation-history.ts",
      "utf8",
    );
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(`${legacyPrefix}/`);
  });

  it("exports expected canonical functions", () => {
    expect(typeof listSocialAutomationRuns).toBe("function");
    expect(typeof listSocialAutomationRunsForSaas).toBe("function");
    expect(typeof recordSocialAutomationRun).toBe("function");
    expect(typeof recordSocialAutomationFailure).toBe("function");
    expect(typeof getSocialAutomationHistorySummary).toBe("function");
  });

  it("records successful run with stable shape", async () => {
    const run = await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:05.000Z",
      result: {
        campaignId: "campaign-1",
        postsCount: 3,
        scheduledCount: 2,
      },
      triggeredBy: {
        actorType: "OPERATOR",
        actorId: "owner-1",
      },
      requestId: "req-1",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    expect(run.id).toBeTruthy();
    expect(run.status).toBe("SUCCESS");
    expect(run.tenantId).toBe("tenant-a");
    expect(run.saasId).toBe("saas-a");
    expect(run.automationKey).toBe("socialflow.content_generation");
    expect(run.durationMs).toBe(5000);
    expect(run.result?.postsCount).toBe(3);
    expect(run.error).toBeNull();
    expect(run.triggeredBy.actorType).toBe("OPERATOR");
    expect(run.requestId).toBe("req-1");
  });

  it("supports idempotent record by requestId", async () => {
    const first = await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:01.000Z",
      requestId: "req-idempotent",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const second = await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "FAILED",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:02.000Z",
      error: {
        code: "SOCIAL_AUTOMATION_UNKNOWN_ERROR",
        message: "should-not-write-second-row",
      },
      requestId: "req-idempotent",
      createdAt: "2024-01-01T00:00:01.000Z",
    });

    expect(second.id).toBe(first.id);
    expect(db.runRows).toHaveLength(1);
    expect(second.status).toBe("SUCCESS");
  });

  it("records failure run", async () => {
    const run = await recordSocialAutomationFailure({
      tenantId: "tenant-b",
      saasId: "saas-b",
      automationKey: "socialflow.content_generation",
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:00:03.000Z",
      error: {
        code: "SOCIAL_AUTOMATION_STORAGE_ERROR",
        message: "write failed",
        retryable: true,
      },
      requestId: "req-fail",
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    expect(run.status).toBe("FAILED");
    expect(run.error?.code).toBe("SOCIAL_AUTOMATION_STORAGE_ERROR");
    expect(run.error?.retryable).toBe(true);
  });

  it("lists global history ordered by createdAt desc", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:02.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordSocialAutomationRun({
      tenantId: "tenant-c",
      saasId: "saas-c",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-03T00:00:00.000Z",
      completedAt: "2024-01-03T00:00:03.000Z",
      createdAt: "2024-01-03T00:00:00.000Z",
    });

    const runs = await listSocialAutomationRuns();

    expect(runs).toHaveLength(2);
    expect(runs[0].saasId).toBe("saas-c");
    expect(runs[1].saasId).toBe("saas-a");
  });

  it("lists history filtered by tenant and saas", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:02.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      automationKey: "socialflow.content_generation",
      status: "FAILED",
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:00:02.000Z",
      error: {
        code: "SOCIAL_AUTOMATION_UNKNOWN_ERROR",
        message: "boom",
      },
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    const runs = await listSocialAutomationRunsForSaas({
      tenantId: "tenant-a",
      saasId: "saas-a",
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].tenantId).toBe("tenant-a");
    expect(runs[0].saasId).toBe("saas-a");
  });

  it("returns basic summary", async () => {
    await recordSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      status: "SUCCESS",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:02.000Z",
      result: {
        postsCount: 3,
        scheduledCount: 2,
      },
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordSocialAutomationFailure({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      startedAt: "2024-01-02T00:00:00.000Z",
      completedAt: "2024-01-02T00:00:03.000Z",
      error: {
        code: "SOCIAL_AUTOMATION_UNKNOWN_ERROR",
        message: "boom",
      },
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    const summary = await getSocialAutomationHistorySummary({
      tenantId: "tenant-a",
      saasId: "saas-a",
    });

    expect(summary.totalRuns).toBe(2);
    expect(summary.successRuns).toBe(1);
    expect(summary.failedRuns).toBe(1);
    expect(summary.totalPosts).toBe(3);
    expect(summary.totalScheduled).toBe(2);
    expect(summary.latestFailedRunAt).toBe("2024-01-02T00:00:00.000Z");
  });

  it("does not create any new file named campobase", () => {
    const createdFiles = [
      "src/lib/campamento-base/social-automation-history.ts",
      "tests/lib/campamento-base-social-automation-history.test.ts",
    ];

    expect(createdFiles.some((file) => file.toLowerCase().includes("campobase"))).toBe(false);
  });

  it("does not introduce legacy import prefix in this test", () => {
    const source = readFileSync(
      "tests/lib/campamento-base-social-automation-history.test.ts",
      "utf8",
    );
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(`${legacyPrefix}/`);
  });
});
