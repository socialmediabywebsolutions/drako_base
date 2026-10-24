import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  display_name: string | null;
  brand_name: string | null;
  business_type: string | null;
  website_url: string | null;
  description: string | null;
  tone: string | null;
  audience: string | null;
  goals_json: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

class FakeD1Statement {
  private params: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeD1Database,
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run() {
    const normalizedSql = this.sql.toLowerCase();
    if (normalizedSql.includes("create table if not exists socialflow_profiles")) {
      this.db.tableCreated = true;
      return { success: true };
    }
    if (normalizedSql.includes("create index if not exists idx_socialflow_profiles_tenant_saas")) {
      this.db.indexCreated = true;
      return { success: true };
    }
    if (normalizedSql.includes("insert into socialflow_profiles")) {
      const [
        id,
        tenant_id,
        saas_id,
        display_name,
        brand_name,
        business_type,
        website_url,
        description,
        tone,
        audience,
        goals_json,
        metadata_json,
        created_at,
        updated_at,
      ] = this.params as [
        string, string, string, string | null, string | null, string | null, string | null,
        string | null, string | null, string | null, string | null, string | null, string, string,
      ];
      this.db.rows.set(`${tenant_id}::${saas_id}`, {
        id,
        tenant_id,
        saas_id,
        display_name,
        brand_name,
        business_type,
        website_url,
        description,
        tone,
        audience,
        goals_json,
        metadata_json,
        created_at,
        updated_at,
      });
      return { success: true };
    }
    return { success: true };
  }

  async all<T>() {
    const normalizedSql = this.sql.toLowerCase();
    if (normalizedSql.includes("from socialflow_profiles where tenant_id = ? and saas_id = ?")) {
      const [tenantId, saasId] = this.params as [string, string];
      const row = this.db.rows.get(`${tenantId}::${saasId}`) as T | undefined;
      return { results: row ? [row] : [] };
    }
    return { results: [] as T[] };
  }
}

class FakeD1Database {
  public rows = new Map<string, StoredRow>();
  public tableCreated = false;
  public indexCreated = false;

  prepare(sql: string) {
    return new FakeD1Statement(sql, this);
  }
}

const resolveSocialContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  SocialContextError: class SocialContextError extends Error {},
}));

import {
  getChannelKnowledge,
  upsertChannelCompetitor,
  upsertChannelProfile,
} from "@/lib/socialflow/profile/repository";

describe("socialflow profile repository (D1)", () => {
  const fakeDb = new FakeD1Database();

  beforeEach(() => {
    fakeDb.rows.clear();
    fakeDb.tableCreated = false;
    fakeDb.indexCreated = false;
    resolveSocialContext.mockResolvedValue({
      tenantId: "tenant-socialflow",
      saasId: "socialflow",
      socialDb: fakeDb as unknown as D1Database,
    });
  });

  it("returns controlled empty-state when no row exists", async () => {
    const snapshot = await getChannelKnowledge("tenant-socialflow", "socialflow");

    expect(snapshot.profile.tenantId).toBe("tenant-socialflow");
    expect(snapshot.profile.saasId).toBe("socialflow");
    expect(snapshot.profile.brandName).toBe("");
    expect(snapshot.competitors).toEqual([]);
    expect(snapshot.assets).toEqual([]);
  });

  it("upserts and reads profile from D1", async () => {
    const updated = await upsertChannelProfile("tenant-socialflow", {
      brandName: "Brand X",
      channelName: "@brandx",
      shortDescription: "Desc",
      toneOfVoice: "Direct",
      audienceDescription: "Owners",
      niche: "Beauty",
      targetMarkets: ["beauty", "health"],
    }, "socialflow");

    expect(updated.brandName).toBe("Brand X");
    expect(updated.channelName).toBe("@brandx");

    const snapshot = await getChannelKnowledge("tenant-socialflow", "socialflow");
    expect(snapshot.profile.brandName).toBe("Brand X");
    expect(snapshot.profile.targetMarkets).toEqual(["beauty", "health"]);
    expect(fakeDb.tableCreated).toBe(true);
    expect(fakeDb.indexCreated).toBe(true);
  });

  it("persists competitors in D1 metadata", async () => {
    await upsertChannelProfile("tenant-socialflow", { brandName: "Brand X" }, "socialflow");
    const competitor = await upsertChannelCompetitor("tenant-socialflow", {
      name: "Competitor A",
      platform: "linkedin",
      strengths: ["frequency"],
    }, "socialflow");

    expect(competitor.name).toBe("Competitor A");

    const snapshot = await getChannelKnowledge("tenant-socialflow", "socialflow");
    expect(snapshot.competitors.length).toBe(1);
    expect(snapshot.competitors[0].name).toBe("Competitor A");
  });

  it("keeps repository free from demo imports and SELECT *", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/socialflow/profile/repository.ts"),
      "utf8",
    );

    expect(source).not.toContain("@/lib/admin/demo-data");
    expect(source).not.toMatch(/SELECT\s+\*/i);
  });
});
