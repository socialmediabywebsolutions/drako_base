import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

type SocialReadModelFixture = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  status: "pending" | "ready" | "stale";
  dossier_json: string;
  blueprint_json: string;
  work_logs_csv: string;
  orchestrator_messages_csv: string;
  financials_csv: string;
  economic_events_csv: string;
  domains_json: string;
  meta_json: string;
  source_revision: string;
  created_at: string;
  updated_at: string;
};

const state = vi.hoisted(() => ({
  socialDb: {} as D1Database,
  socialReadModel: null as SocialReadModelFixture | null,
  socialReadError: null as Error | null,
  runtimeSeed: {
    id: "saas_1",
    slug: "socialflow",
    name: "SocialFlow",
    blueprint_snapshot: null,
  } as { id: string; slug: string; name: string; blueprint_snapshot: string | null } | null,
  socialQueryCount: 0,
  coreQueryOneCount: 0,
  coreQueryAllCount: 0,
  runCount: 0,
}));

const ensureSocialDb = vi.hoisted(() =>
  vi.fn(() => state.socialDb),
);

const queryOne = vi.hoisted(() =>
  vi.fn(async (db: D1Database) => {
    if (db === state.socialDb) {
      state.socialQueryCount += 1;
      if (state.socialReadError) {
        throw state.socialReadError;
      }
      return state.socialReadModel;
    }

    state.coreQueryOneCount += 1;
    return null;
  }),
);

const queryAll = vi.hoisted(() =>
  vi.fn(async () => {
    state.coreQueryAllCount += 1;
    return [];
  }),
);

const run = vi.hoisted(() =>
  vi.fn(async () => {
    state.runCount += 1;
    return true;
  }),
);

const resolveRuntimeSocialSaasSeedContract = vi.hoisted(() =>
  vi.fn(async () => state.runtimeSeed),
);

vi.mock("../db/runtime-db", () => ({
  ensureSocialDb,
  queryOne,
  queryAll,
  run,
}));

vi.mock("./contracts/runtime-seed-contract", () => ({
  resolveRuntimeSocialSaasSeedContract,
}));

import { generateRuntimeSocialFlowExportForTenant } from "./exports-service";

function resetState() {
  state.socialReadModel = null;
  state.socialReadError = null;
  state.runtimeSeed = {
    id: "saas_1",
    slug: "socialflow",
    name: "SocialFlow",
    blueprint_snapshot: null,
  };
  state.socialQueryCount = 0;
  state.coreQueryOneCount = 0;
  state.coreQueryAllCount = 0;
  state.runCount = 0;
}

function buildPreparedReadModel(overrides: Partial<SocialReadModelFixture> = {}): SocialReadModelFixture {
  return {
    id: "model_1",
    tenant_id: "tenant_1",
    saas_id: "saas_1",
    slug: "socialflow",
    status: "ready",
    dossier_json: "{\"from\":\"social\"}",
    blueprint_json: "{\"from\":\"social\"}",
    work_logs_csv: "id,source\n1,social\n",
    orchestrator_messages_csv: "role\nassistant\n",
    financials_csv: "metric,value\nmrr,99\n",
    economic_events_csv: "id\nevt_social\n",
    domains_json: "[{\"domain\":\"social.example\"}]",
    meta_json: "{\"source\":\"social\"}",
    source_revision: "rev_social",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

async function unzipEntries(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return {
    blueprint: await zip.file("blueprint/blueprint.json")?.async("text"),
    workLogs: await zip.file("execution/work_logs.csv")?.async("text"),
    financials: await zip.file("economics/financials.csv")?.async("text"),
    economicEvents: await zip.file("economics/economic_events.csv")?.async("text"),
    meta: await zip.file("meta.json")?.async("text"),
    domains: await zip.file("domains/domain_status.json")?.async("text"),
  };
}

describe("runtime exports service hardening", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("fails with explicit error when SocialFlow SaaS seed is missing", async () => {
    state.runtimeSeed = null;

    await expect(generateRuntimeSocialFlowExportForTenant("tenant-missing-seed")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND",
    );
    expect(state.socialQueryCount).toBe(0);
    expect(state.coreQueryOneCount).toBe(0);
    expect(state.coreQueryAllCount).toBe(0);
    expect(state.runCount).toBe(0);
  });

  it("uses prepared SOCIAL_DB read model when it is ready", async () => {
    state.socialReadModel = buildPreparedReadModel();

    const result = await generateRuntimeSocialFlowExportForTenant("tenant_1");
    const entries = await unzipEntries(result.buffer);

    expect(resolveRuntimeSocialSaasSeedContract).toHaveBeenCalledWith("tenant_1");
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(0);
    expect(state.coreQueryAllCount).toBe(0);
    expect(state.runCount).toBe(0);
    expect(entries.blueprint).toBe("{\"from\":\"social\"}");
    expect(entries.workLogs).toBe("id,source\n1,social\n");
    expect(entries.financials).toBe("metric,value\nmrr,99\n");
    expect(entries.economicEvents).toBe("id\nevt_social\n");
    expect(entries.meta).toBe("{\"source\":\"social\"}");
    expect(entries.domains).toBe("[{\"domain\":\"social.example\"}]");
    expect(result.filename.startsWith("drako-export-socialflow-")).toBe(true);
    expect(result.filename.endsWith(".zip")).toBe(true);
  });

  it("fails with explicit error when prepared read model is missing", async () => {
    state.socialReadModel = null;

    await expect(generateRuntimeSocialFlowExportForTenant("tenant_1")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_READ_MODEL_NOT_READY",
    );
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(0);
    expect(state.coreQueryAllCount).toBe(0);
    expect(state.runCount).toBe(0);
  });

  it("fails with explicit error when prepared read model is not ready", async () => {
    state.socialReadModel = buildPreparedReadModel({
      status: "pending",
    });

    await expect(generateRuntimeSocialFlowExportForTenant("tenant_1")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_READ_MODEL_NOT_READY",
    );
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(0);
    expect(state.coreQueryAllCount).toBe(0);
    expect(state.runCount).toBe(0);
  });

  it("fails with explicit error when prepared read model read errors", async () => {
    state.socialReadError = new Error("SOCIAL_READ_FAILURE");

    await expect(generateRuntimeSocialFlowExportForTenant("tenant_1")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_READ_MODEL_NOT_READY",
    );
    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(0);
    expect(state.coreQueryAllCount).toBe(0);
    expect(state.runCount).toBe(0);
  });
});
