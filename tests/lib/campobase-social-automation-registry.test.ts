import { beforeEach, describe, expect, it, vi } from "vitest";

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

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  reset() {
    this.rows = [];
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
      if (normalized.includes("where tenant_id = ? and saas_id = ?")) {
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

    if (normalized.startsWith("create table") || normalized.startsWith("create index") || normalized.startsWith("create unique index")) {
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
      const [enabled, updatedAt, tenantId, saasId] = this.params as [number, string, string, string];
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

    throw new Error(`Unsupported SQL: ${this.sql}`);
  }
}

const db = new FakeD1Database();

vi.mock("@/lib/db", () => ({
  getDb: () => db as unknown as D1Database,
}));

import {
  getCampoBaseSocialAutomationRegistryItem,
  listCampoBaseSocialAutomationRegistryItems,
  listEnabledCampoBaseSocialAutomationRegistryItems,
  removeCampoBaseSocialAutomationRegistryItem,
  setCampoBaseSocialAutomationEnabled,
  upsertCampoBaseSocialAutomationRegistry,
} from "@/lib/campobase/social-automation-registry";

describe("campobase social automation registry", () => {
  beforeEach(() => {
    db.reset();
  });

  it("upsert inserts new record with createdAt and updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const item = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    expect(item.tenantId).toBe("tenant-a");
    expect(item.saasId).toBe("saas-a");
    expect(item.enabled).toBe(true);
    expect(item.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(item.updatedAt).toBe("2024-01-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  it("upsert preserves createdAt and updates updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const initial = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    vi.setSystemTime(new Date("2024-01-02T00:00:00Z"));
    const updated = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "health",
      tone: "calm",
      frequencyPerWeek: 5,
      enabled: false,
    });

    expect(updated.createdAt).toBe(initial.createdAt);
    expect(updated.updatedAt).toBe("2024-01-02T00:00:00.000Z");
    expect(updated.niche).toBe("health");
    expect(updated.tone).toBe("calm");
    expect(updated.frequencyPerWeek).toBe(5);
    expect(updated.enabled).toBe(false);

    vi.useRealTimers();
  });

  it("get returns item or null", async () => {
    const missing = await getCampoBaseSocialAutomationRegistryItem("tenant-x", "saas-x");
    expect(missing).toBeNull();

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    const found = await getCampoBaseSocialAutomationRegistryItem("tenant-a", "saas-a");
    expect(found?.saasId).toBe("saas-a");
  });

  it("list returns items ordered by updatedAt desc", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
    });

    vi.setSystemTime(new Date("2024-01-03T00:00:00Z"));
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "two",
      tone: "t2",
      frequencyPerWeek: 2,
    });

    const list = await listCampoBaseSocialAutomationRegistryItems();
    expect(list[0].saasId).toBe("saas-b");
    expect(list[1].saasId).toBe("saas-a");

    vi.useRealTimers();
  });

  it("listEnabled returns only enabled items", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "two",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: false,
    });

    const list = await listEnabledCampoBaseSocialAutomationRegistryItems();
    expect(list).toHaveLength(1);
    expect(list[0].saasId).toBe("saas-a");
  });

  it("setCampoBaseSocialAutomationEnabled updates enabled and updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    vi.setSystemTime(new Date("2024-01-05T00:00:00Z"));
    const updated = await setCampoBaseSocialAutomationEnabled("tenant-a", "saas-a", false);

    expect(updated?.enabled).toBe(false);
    expect(updated?.updatedAt).toBe("2024-01-05T00:00:00.000Z");

    const missing = await setCampoBaseSocialAutomationEnabled("tenant-x", "saas-x", true);
    expect(missing).toBeNull();

    vi.useRealTimers();
  });

  it("removeCampoBaseSocialAutomationRegistryItem returns true when removed and false when missing", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
    });

    const removed = await removeCampoBaseSocialAutomationRegistryItem("tenant-a", "saas-a");
    expect(removed).toBe(true);

    const missing = await removeCampoBaseSocialAutomationRegistryItem("tenant-a", "saas-a");
    expect(missing).toBe(false);
  });
});
