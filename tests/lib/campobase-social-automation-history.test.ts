import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeD1Database {
  lastCreateTableSql: string | null = null;
  runRows: Array<{
    id: string;
    tenant_id: string;
    saas_id: string;
    status: string;
    campaign_id: string | null;
    posts_count: number;
    scheduled_count: number;
    error: string | null;
    started_at: string;
    finished_at: string;
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

    if (normalized.startsWith("select") && normalized.includes("from campobase_social_automation_runs")) {
      let rows = [...this.db.runRows];

      if (normalized.includes("where tenant_id = ? and saas_id = ?")) {
        const [tenantId, saasId] = this.params as [string, string];
        rows = rows.filter((row) => row.tenant_id === tenantId && row.saas_id === saasId);
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

    if (normalized.startsWith("insert into campobase_social_automation_runs")) {
      const [
        id,
        tenantId,
        saasId,
        status,
        campaignId,
        postsCount,
        scheduledCount,
        error,
        startedAt,
        finishedAt,
        createdAt,
      ] = this.params as [
        string,
        string,
        string,
        string,
        string | null,
        number,
        number,
        string | null,
        string,
        string,
        string,
      ];
      this.db.runRows.push({
        id,
        tenant_id: tenantId,
        saas_id: saasId,
        status,
        campaign_id: campaignId,
        posts_count: postsCount,
        scheduled_count: scheduledCount,
        error,
        started_at: startedAt,
        finished_at: finishedAt,
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
  listCampoBaseSocialAutomationRuns,
  listCampoBaseSocialAutomationRunsForSaas,
  recordCampoBaseSocialAutomationRun,
  type CampoBaseSocialAutomationRunStatus,
} from "@/lib/campobase/social-automation-history";

describe("campobase social automation history", () => {
  beforeEach(() => {
    db.reset();
  });

  it("creates schema with status CHECK constraint", async () => {
    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-check",
      saasId: "saas-check",
      status: "SUCCESS",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:01:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const sql = (db.lastCreateTableSql ?? "").toLowerCase();
    expect(sql).toContain("check (status in ('success', 'failed'))");
  });

  it("rejects invalid status", async () => {
    await expect(
      recordCampoBaseSocialAutomationRun({
        tenantId: "tenant-invalid",
        saasId: "saas-invalid",
        status: "PENDING" as unknown as CampoBaseSocialAutomationRunStatus,
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
        error: null,
        startedAt: "2024-01-01T00:00:00.000Z",
        finishedAt: "2024-01-01T00:01:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("INVALID_CAMPOBASE_SOCIAL_AUTOMATION_STATUS");
  });

  it("records success run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const run = await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      status: "SUCCESS",
      campaignId: "campaign-1",
      postsCount: 3,
      scheduledCount: 2,
      error: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:05:00.000Z",
    });

    expect(run.id).toBeTruthy();
    expect(run.status).toBe("SUCCESS");
    expect(run.campaignId).toBe("campaign-1");
    expect(run.error).toBeNull();
    expect(run.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(db.runRows[0].id).toBe(run.id);

    vi.useRealTimers();
  });

  it("records failed run", async () => {
    const run = await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      status: "FAILED",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: "ENGINE_FAIL",
      startedAt: "2024-01-02T00:00:00.000Z",
      finishedAt: "2024-01-02T00:01:00.000Z",
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    expect(run.status).toBe("FAILED");
    expect(run.campaignId).toBeNull();
    expect(run.error).toBe("ENGINE_FAIL");
  });

  it("stores null campaignId and error as real nulls", async () => {
    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-null",
      saasId: "saas-null",
      status: "SUCCESS",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: null,
      startedAt: "2024-01-04T00:00:00.000Z",
      finishedAt: "2024-01-04T00:01:00.000Z",
      createdAt: "2024-01-04T00:00:00.000Z",
    });

    expect(db.runRows[0].campaign_id).toBeNull();
    expect(db.runRows[0].error).toBeNull();
  });

  it("lists runs ordered by created_at desc", async () => {
    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      status: "SUCCESS",
      campaignId: "campaign-1",
      postsCount: 1,
      scheduledCount: 1,
      error: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:05:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      status: "SUCCESS",
      campaignId: "campaign-2",
      postsCount: 2,
      scheduledCount: 2,
      error: null,
      startedAt: "2024-01-03T00:00:00.000Z",
      finishedAt: "2024-01-03T00:06:00.000Z",
      createdAt: "2024-01-03T00:00:00.000Z",
    });

    const list = await listCampoBaseSocialAutomationRuns();
    expect(list[0].saasId).toBe("saas-b");
    expect(list[1].saasId).toBe("saas-a");
  });

  it("lists runs by tenant + saas", async () => {
    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-a",
      saasId: "saas-a",
      status: "SUCCESS",
      campaignId: "campaign-1",
      postsCount: 1,
      scheduledCount: 1,
      error: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:05:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await recordCampoBaseSocialAutomationRun({
      tenantId: "tenant-b",
      saasId: "saas-b",
      status: "FAILED",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: "ENGINE_FAIL",
      startedAt: "2024-01-02T00:00:00.000Z",
      finishedAt: "2024-01-02T00:05:00.000Z",
      createdAt: "2024-01-02T00:00:00.000Z",
    });

    const list = await listCampoBaseSocialAutomationRunsForSaas("tenant-a", "saas-a");
    expect(list).toHaveLength(1);
    expect(list[0].tenantId).toBe("tenant-a");
    expect(list[0].saasId).toBe("saas-a");
  });
});
