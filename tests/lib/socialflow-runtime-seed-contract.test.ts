import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeSeedRow = {
  id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
  status?: string | null;
};

const state = vi.hoisted(() => ({
  coreDb: {} as D1Database,
  socialDb: {} as D1Database,
  coreSeed: null as RuntimeSeedRow | null,
  socialSeed: null as RuntimeSeedRow | null,
  socialError: null as Error | null,
  coreError: null as Error | null,
  socialQueryCount: 0,
  coreQueryCount: 0,
}));

const ensureDracoDb = vi.hoisted(() =>
  vi.fn(() => {
    if (!state.coreDb) {
      throw new Error("DRACO_DB_MISSING");
    }
    return state.coreDb;
  }),
);

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
    if (sql.includes("FROM saas")) {
      state.coreQueryCount += 1;
      if (state.coreError) throw state.coreError;
      return state.coreSeed;
    }
    return null;
  }),
);

vi.mock("../../apps/socialflow-runtime/src/lib/db/runtime-db", () => ({
  ensureDracoDb,
  ensureSocialDb,
  queryOne,
}));

import { resolveRuntimeSocialSaasSeedContract } from "../../apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract";

describe("socialflow runtime seed contract", () => {
  const tenantId = "tenant_socialflow_canary";

  beforeEach(() => {
    state.coreDb = {} as D1Database;
    state.socialDb = {} as D1Database;
    state.coreSeed = null;
    state.socialSeed = null;
    state.socialError = null;
    state.coreError = null;
    state.socialQueryCount = 0;
    state.coreQueryCount = 0;
    delete process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH;
    vi.clearAllMocks();
  });

  it("uses core fallback when switch is off", async () => {
    state.coreSeed = {
      id: "saas_core_1",
      slug: "socialflow",
      name: "Core Seed",
      blueprint_snapshot: null,
    };
    state.socialSeed = {
      id: "saas_social_1",
      slug: "socialflow",
      name: "Social Seed",
      blueprint_snapshot: null,
      status: "active",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_core_1");
    expect(state.socialQueryCount).toBe(0);
    expect(state.coreQueryCount).toBe(1);
  });

  it("uses SOCIAL_DB when switch is on and active seed exists", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.coreSeed = {
      id: "saas_core_1",
      slug: "socialflow",
      name: "Core Seed",
      blueprint_snapshot: null,
    };
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

  it("falls back to core when switch is on but social seed is missing or inactive", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.coreSeed = {
      id: "saas_core_2",
      slug: "socialflow",
      name: "Core Seed 2",
      blueprint_snapshot: null,
    };
    state.socialSeed = {
      id: "saas_social_2",
      slug: "socialflow",
      name: "Social Seed 2",
      blueprint_snapshot: null,
      status: "inactive",
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_core_2");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(1);
  });

  it("keeps working when SOCIAL_DB read errors and core fallback is available", async () => {
    process.env.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1";
    state.socialError = new Error("SOCIAL_DB_READ_FAILED");
    state.coreSeed = {
      id: "saas_core_3",
      slug: "socialflow",
      name: "Core Seed 3",
      blueprint_snapshot: null,
    };

    const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);

    expect(seed?.id).toBe("saas_core_3");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryCount).toBe(1);
  });
});
