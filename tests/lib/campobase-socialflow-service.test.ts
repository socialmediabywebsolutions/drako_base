import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeD1Database {
  rows: Array<{
    tenant_id: string;
    saas_id: string;
    niche: string;
    tone: string;
    frequency_per_week: number;
    enabled: number;
    created_at: string;
    updated_at: string;
  }> = [];
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
    this.rows = [];
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

    if (normalized.startsWith("select")) {
      if (normalized.includes("from campobase_social_automation_runs")) {
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

      if (normalized.includes("from campobase_social_automation_registry") && normalized.includes("where tenant_id = ? and saas_id = ?")) {
        const [tenantId, saasId] = this.params as [string, string];
        const row = this.db.rows.find(
          (item) => item.tenant_id === tenantId && item.saas_id === saasId,
        );
        if (!row) {
          return [];
        }
        if (normalized.includes("niche") || normalized.includes("frequency_per_week")) {
          return [row];
        }
        return [{ tenant_id: row.tenant_id }];
      }

      if (normalized.includes("from campobase_social_automation_registry")) {
        let rows = [...this.db.rows];
        if (normalized.includes("where enabled = 1")) {
          rows = rows.filter((row) => row.enabled === 1);
        }
        rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return rows;
      }
    }

    throw new Error(`Unsupported SQL: ${this.sql}`);
  }

  private executeRun() {
    const normalized = this.sql.toLowerCase();

    if (
      normalized.startsWith("create table") ||
      normalized.startsWith("create index") ||
      normalized.startsWith("create unique index")
    ) {
      return;
    }

    if (normalized.startsWith("insert into campobase_social_automation_registry")) {
      const [
        tenantId,
        saasId,
        niche,
        tone,
        frequencyPerWeek,
        enabled,
        createdAt,
        updatedAt,
      ] = this.params as [
        string,
        string,
        string,
        string,
        number,
        number,
        string,
        string,
      ];
      const existingIndex = this.db.rows.findIndex(
        (item) => item.tenant_id === tenantId && item.saas_id === saasId,
      );
      if (existingIndex >= 0) {
        const existing = this.db.rows[existingIndex];
        this.db.rows[existingIndex] = {
          ...existing,
          niche,
          tone,
          frequency_per_week: frequencyPerWeek,
          enabled,
          updated_at: updatedAt,
        };
        return;
      }
      this.db.rows.push({
        tenant_id: tenantId,
        saas_id: saasId,
        niche,
        tone,
        frequency_per_week: frequencyPerWeek,
        enabled,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return;
    }

    if (normalized.startsWith("update campobase_social_automation_registry")) {
      const [enabled, updatedAt, tenantId, saasId] = this.params as [
        number,
        string,
        string,
        string,
      ];
      const index = this.db.rows.findIndex(
        (item) => item.tenant_id === tenantId && item.saas_id === saasId,
      );
      if (index >= 0) {
        this.db.rows[index] = {
          ...this.db.rows[index],
          enabled,
          updated_at: updatedAt,
        };
      }
      return;
    }

    if (normalized.startsWith("delete from campobase_social_automation_registry")) {
      const [tenantId, saasId] = this.params as [string, string];
      this.db.rows = this.db.rows.filter(
        (item) => !(item.tenant_id === tenantId && item.saas_id === saasId),
      );
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
const runSocialFlowEngine = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: () => db as unknown as D1Database,
}));

vi.mock("@/lib/social/ai/socialflow-engine", () => ({
  runSocialFlowEngine,
}));

import {
  upsertCampoBaseSocialAutomationRegistry,
} from "@/lib/campobase/social-automation-registry";
import { listCampoBaseSocialAutomationRuns } from "@/lib/campobase/social-automation-history";
import {
  disableCampoBaseSocialAutomationForSaas,
  enableCampoBaseSocialAutomationForSaas,
  getCampoBaseSocialAutomationStatus,
  runCampoBaseSocialAutomationForAllRegisteredSaas,
  runCampoBaseSocialAutomationForRegisteredSaas,
  runCampoBaseSocialAutomationForSelectedSaas,
} from "@/lib/campobase/socialflow-service";

describe("campobase socialflow service", () => {
  beforeEach(() => {
    db.reset();
    runSocialFlowEngine.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runCampoBaseSocialAutomationForRegisteredSaas fails with NOT_CONFIGURED", async () => {
    await expect(
      runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a"),
    ).rejects.toThrow("NOT_CONFIGURED");
  });

  it("runCampoBaseSocialAutomationForRegisteredSaas fails with DISABLED", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      enabled: false,
    });

    await expect(
      runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a"),
    ).rejects.toThrow("DISABLED");
  });

  it("runCampoBaseSocialAutomationForRegisteredSaas executes when enabled", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      enabled: true,
    });

    runSocialFlowEngine.mockResolvedValue({
      campaignId: "campaign-1",
      posts: [{ id: "post-1" }],
      schedule: [{ postId: "post-1", scheduledAt: "2024-01-01T00:00:00Z" }],
    });

    const result = await runCampoBaseSocialAutomationForRegisteredSaas(
      "tenant-a",
      "saas-a",
    );

    expect(result.campaignId).toBe("campaign-1");
    expect(result.postsCount).toBe(1);
    expect(result.scheduledCount).toBe(1);
    expect(runSocialFlowEngine).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
    });
  });

  it("runCampoBaseSocialAutomationForAllRegisteredSaas executes sequential batch and aggregates results", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    vi.setSystemTime(new Date("2024-01-02T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "b",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: false,
    });

    vi.setSystemTime(new Date("2024-01-03T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-c",
      saasId: "saas-c",
      niche: "c",
      tone: "t3",
      frequencyPerWeek: 3,
      enabled: true,
    });

    runSocialFlowEngine.mockImplementation(async (input: { saasId: string }) => {
      if (input.saasId === "saas-a") {
        throw new Error("ENGINE_FAIL");
      }
      return {
        campaignId: `campaign-${input.saasId}`,
        posts: [{ id: `post-${input.saasId}` }],
        schedule: [
          { postId: `post-${input.saasId}`, scheduledAt: "2024-01-01T00:00:00Z" },
        ],
      };
    });

    const result = await runCampoBaseSocialAutomationForAllRegisteredSaas();

    expect(result.total).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].saasId).toBe("saas-c");
    expect(result.results[1].saasId).toBe("saas-a");
    expect(runSocialFlowEngine.mock.calls.map((call) => call[0].saasId)).toEqual([
      "saas-c",
      "saas-a",
    ]);
  });

  it("runCampoBaseSocialAutomationForSelectedSaas filters by saasIds", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    vi.setSystemTime(new Date("2024-01-02T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "b",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: true,
    });

    vi.setSystemTime(new Date("2024-01-03T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-c",
      saasId: "saas-c",
      niche: "c",
      tone: "t3",
      frequencyPerWeek: 3,
      enabled: true,
    });

    runSocialFlowEngine.mockResolvedValue({
      campaignId: "campaign",
      posts: [{ id: "post" }],
      schedule: [{ postId: "post", scheduledAt: "2024-01-01T00:00:00Z" }],
    });

    const result = await runCampoBaseSocialAutomationForSelectedSaas(["saas-b", "saas-c"]);

    expect(result.total).toBe(2);
    expect(runSocialFlowEngine.mock.calls.map((call) => call[0].saasId)).toEqual([
      "saas-c",
      "saas-b",
    ]);
  });

  it("getCampoBaseSocialAutomationStatus returns total, enabled and disabled", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "b",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: false,
    });
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-c",
      saasId: "saas-c",
      niche: "c",
      tone: "t3",
      frequencyPerWeek: 3,
      enabled: true,
    });

    const status = await getCampoBaseSocialAutomationStatus();

    expect(status.total).toBe(3);
    expect(status.enabled).toBe(2);
    expect(status.disabled).toBe(1);
    expect(status.items).toHaveLength(3);
  });

  it("enableCampoBaseSocialAutomationForSaas activates and returns output", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: false,
    });

    vi.setSystemTime(new Date("2024-01-05T00:00:00Z"));
    const enabled = await enableCampoBaseSocialAutomationForSaas("tenant-a", "saas-a");

    expect(enabled.enabled).toBe(true);
    expect(enabled.updatedAt).toBe("2024-01-05T00:00:00.000Z");
  });

  it("disableCampoBaseSocialAutomationForSaas disables and returns output", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    vi.setSystemTime(new Date("2024-01-06T00:00:00Z"));
    const disabled = await disableCampoBaseSocialAutomationForSaas("tenant-a", "saas-a");

    expect(disabled.enabled).toBe(false);
    expect(disabled.updatedAt).toBe("2024-01-06T00:00:00.000Z");
  });

  it("records success run history for registered saas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T00:00:00Z"));

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      enabled: true,
    });

    runSocialFlowEngine.mockResolvedValue({
      campaignId: "campaign-1",
      posts: [{ id: "post-1" }],
      schedule: [{ postId: "post-1", scheduledAt: "2024-02-01T00:00:00Z" }],
    });

    await runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a");

    const history = await listCampoBaseSocialAutomationRuns();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("SUCCESS");
    expect(history[0].campaignId).toBe("campaign-1");
    expect(history[0].postsCount).toBe(1);

    vi.useRealTimers();
  });

  it("records failed run history when engine throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-02T00:00:00Z"));

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      enabled: true,
    });

    runSocialFlowEngine.mockRejectedValue(new Error("ENGINE_FAIL"));

    await expect(
      runCampoBaseSocialAutomationForRegisteredSaas("tenant-a", "saas-a"),
    ).rejects.toThrow("ENGINE_FAIL");

    const history = await listCampoBaseSocialAutomationRuns();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("FAILED");
    expect(history[0].error).toBe("ENGINE_FAIL");

    vi.useRealTimers();
  });

  it("records history for batch runs", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "a",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "b",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: true,
    });

    runSocialFlowEngine.mockImplementation(async (input: { saasId: string }) => {
      if (input.saasId === "saas-b") {
        throw new Error("ENGINE_FAIL");
      }
      return {
        campaignId: `campaign-${input.saasId}`,
        posts: [{ id: `post-${input.saasId}` }],
        schedule: [{ postId: `post-${input.saasId}`, scheduledAt: "2024-01-01T00:00:00Z" }],
      };
    });

    await runCampoBaseSocialAutomationForAllRegisteredSaas();

    const history = await listCampoBaseSocialAutomationRuns();
    expect(history).toHaveLength(2);
    expect(history.some((run) => run.status === "SUCCESS")).toBe(true);
    expect(history.some((run) => run.status === "FAILED")).toBe(true);
  });
});
