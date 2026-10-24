import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeSeedRow = {
  id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
  status?: string | null;
};

const state = vi.hoisted(() => ({
  socialDb: {} as D1Database,
  socialSeed: null as RuntimeSeedRow | null,
  socialError: null as Error | null,
  socialQueryCount: 0,
  coreQueryCount: 0,
}));

const ensureSocialDb = vi.hoisted(() =>
  vi.fn(() => {
    if (!state.socialDb) {
      throw new Error("SOCIAL_DB_MISSING");
    }
    return state.socialDb;
  }),
);

const queryOne = vi.hoisted(() =>
  vi.fn(async (_db: D1Database, sql: string) => {
    if (sql.includes("FROM socialflow_seed_metadata")) {
      state.socialQueryCount += 1;
      if (state.socialError) throw state.socialError;
      return state.socialSeed;
    }
    return null;
  }),
);

vi.mock("../../apps/socialflow-runtime/src/lib/db/runtime-db", () => ({
  ensureSocialDb,
  queryOne,
}));

import { resolveRuntimeSocialSaasSeedContract } from "../../apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract";
import { setSocialFlowRuntimeEnv } from "../../apps/socialflow-runtime/src/lib/runtime-env";

describe("socialflow runtime seed contract", () => {
  const tenantId = "tenant_socialflow_canary";

  beforeEach(() => {
    state.socialDb = {} as D1Database;
    state.socialSeed = null;
    state.socialError = null;
    state.socialQueryCount = 0;
    state.coreQueryCount = 0;
    setSocialFlowRuntimeEnv(null);
    delete process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH;
    vi.clearAllMocks();
  });

  it("returns null when switch is off instead of falling back to core", async () => {
    state.socialSeed = {
      id: "saas_social_1",
      slug: "socialflow",
      name: "Social Seed",
      blueprint_snapshot: null,
      status: "active",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed).toBeNull();
    expect(state.socialQueryCount).toBe(0);
    expect(state.coreQueryCount).toBe(0);
  });

  it("uses SOCIAL_DB when switch is on and active seed exists", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.socialSeed = {
      id: "saas_social_1",
      slug: "socialflow",
      name: "Social Seed",
      blueprint_snapshot: null,
      status: "active",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_social_1");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });

  it("uses SOCIAL_DB when switch is on via Cloudflare-like env binding", async () => {
    setSocialFlowRuntimeEnv({
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
    });
    state.socialSeed = {
      id: "saas_social_binding_1",
      slug: "socialflow",
      name: "Social Seed Binding",
      blueprint_snapshot: null,
      status: "active",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_social_binding_1");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });

  it("uses SOCIAL_DB when switch is on via Cloudflare-like numeric env binding", async () => {
    setSocialFlowRuntimeEnv({
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: 1 as unknown as string,
    });
    state.socialSeed = {
      id: "saas_social_binding_num_1",
      slug: "socialflow",
      name: "Social Seed Binding Numeric",
      blueprint_snapshot: null,
      status: "active",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_social_binding_num_1");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });

  it("returns null when switch is on but social seed is missing", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed).toBeNull();
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });

  it("returns null when switch is on but social seed is inactive", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.socialSeed = {
      id: "saas_social_2",
      slug: "socialflow",
      name: "Social Seed 2",
      blueprint_snapshot: null,
      status: "inactive",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed).toBeNull();
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });

  it("returns null when SOCIAL_DB read errors instead of falling back to core", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.socialError = new Error("SOCIAL_DB_READ_FAILED");

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed).toBeNull();
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(0);
  });
});
