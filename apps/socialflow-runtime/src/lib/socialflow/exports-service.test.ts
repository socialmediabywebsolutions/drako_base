import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const SWITCH_ENV_KEY = "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH";

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
  primaryDb: {} as D1Database,
  socialDb: {} as D1Database,
  contextEnv: {} as Record<string, unknown> | undefined,
  coreQueryOneQueue: [] as Array<unknown>,
  coreQueryAllQueue: [] as Array<unknown[]>,
  socialReadModel: null as SocialReadModelFixture | null,
  socialReadError: null as Error | null,
  coreQueryOneCount: 0,
  coreQueryAllCount: 0,
  socialQueryCount: 0,
  runCount: 0,
}));

const ensureDracoDb = vi.hoisted(() =>
  vi.fn(() => state.primaryDb),
);

const ensureSocialDb = vi.hoisted(() =>
  vi.fn(() => state.socialDb),
);

const queryAll = vi.hoisted(() =>
  vi.fn(async (db: D1Database) => {
    if (db !== state.primaryDb) {
      return [];
    }
    state.coreQueryAllCount += 1;
    return state.coreQueryAllQueue.shift() ?? [];
  }),
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

    if (db === state.primaryDb) {
      state.coreQueryOneCount += 1;
      return state.coreQueryOneQueue.shift() ?? null;
    }

    return null;
  }),
);

const run = vi.hoisted(() =>
  vi.fn(async () => {
    state.runCount += 1;
    return true;
  }),
);

vi.mock("../db/runtime-db", () => ({
  ensureDracoDb,
  ensureSocialDb,
  queryAll,
  queryOne,
  run,
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareContextSafeSync: () => (state.contextEnv ? { env: state.contextEnv } : null),
}));

import { generateRuntimeSocialFlowExportForTenant } from "./exports-service";

function resetState() {
  state.contextEnv = undefined;
  state.coreQueryOneQueue = [];
  state.coreQueryAllQueue = [];
  state.socialReadModel = null;
  state.socialReadError = null;
  state.coreQueryOneCount = 0;
  state.coreQueryAllCount = 0;
  state.socialQueryCount = 0;
  state.runCount = 0;
  delete process.env[SWITCH_ENV_KEY];
}

function primeCoreFallbackDataset() {
  state.coreQueryAllQueue = [
    [
      { name: "id" },
      { name: "tenant_id" },
      { name: "slug" },
      { name: "name" },
      { name: "blueprint_snapshot" },
      { name: "plan_tier" },
      { name: "mrr_eur" },
      { name: "cost_eur" },
      { name: "risk_level" },
    ],
    [
      {
        id: "log_1",
        tenant_id: "tenant_1",
        saas_id: "saas_1",
        agent_name: "agent",
        action_type: "publish",
        status: "ok",
        output_json: "{\"ok\":true}",
        cost_eur: 1.2,
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    [
      {
        tenant_id: "tenant_1",
        role: "assistant",
        content: "message",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    [
      {
        id: "evt_1",
        tenant_id: "tenant_1",
        saas_id: "saas_1",
        type: "info",
        severity: "low",
        payload_json: "{\"k\":1}",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    [
      {
        tenant_id: "tenant_1",
        saas_id: "saas_1",
        domain: "tenant.example",
        is_primary: 1,
        status: "active",
      },
    ],
  ];

  state.coreQueryOneQueue = [
    {
      id: "saas_1",
      tenant_id: "tenant_1",
      slug: "socialflow",
      name: "SocialFlow",
      blueprint_snapshot: "{\"blueprint\":true}",
      plan_tier: "growth",
      mrr_eur: 10,
      cost_eur: 2,
      risk_level: "low",
    },
    {
      id: "dossier_1",
      tenant_id: "tenant_1",
      form_data: "{\"form\":true}",
      analysis_data: "{\"analysis\":true}",
      plan_data: "{\"plan\":true}",
    },
  ];
}

function primeCoreMinimalDataset() {
  state.coreQueryAllQueue = [[
    { name: "id" },
    { name: "tenant_id" },
    { name: "slug" },
    { name: "name" },
    { name: "blueprint_snapshot" },
    { name: "plan_tier" },
    { name: "mrr_eur" },
    { name: "cost_eur" },
    { name: "risk_level" },
  ]];

  state.coreQueryOneQueue = [
    {
      id: "saas_1",
      tenant_id: "tenant_1",
      slug: "socialflow",
      name: "SocialFlow",
      blueprint_snapshot: "{\"blueprint\":true}",
      plan_tier: "growth",
      mrr_eur: 10,
      cost_eur: 2,
      risk_level: "low",
    },
  ];
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

  it("fails closed when SocialFlow SaaS seed is missing instead of inventing fallback identity", async () => {
    state.coreQueryAllQueue = [[
      { name: "id" },
      { name: "tenant_id" },
      { name: "slug" },
      { name: "name" },
      { name: "blueprint_snapshot" },
      { name: "plan_tier" },
      { name: "mrr_eur" },
      { name: "cost_eur" },
      { name: "risk_level" },
    ]];
    state.coreQueryOneQueue = [null];

    await expect(generateRuntimeSocialFlowExportForTenant("tenant-missing-seed")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND",
    );
    expect(state.runCount).toBe(0);
  });

  it("keeps core-backed behavior when switch is off", async () => {
    primeCoreFallbackDataset();
    state.socialReadModel = {
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
    };

    const result = await generateRuntimeSocialFlowExportForTenant("tenant_1");
    const entries = await unzipEntries(result.buffer);

    expect(state.socialQueryCount).toBe(0);
    expect(state.coreQueryOneCount).toBe(2);
    expect(state.coreQueryAllCount).toBe(5);
    expect(state.runCount).toBe(1);
    expect(result.filename.startsWith("drako-export-socialflow-")).toBe(true);
    expect(result.filename.endsWith(".zip")).toBe(true);
    expect(entries.blueprint).toContain("\"blueprint\": true");
    expect(entries.workLogs).toContain("id,agent_name,action_type,status,cost_eur,created_at,output_snippet");
    expect(entries.financials).toContain("metric,value,unit");
    expect(entries.economicEvents).toContain("id,type,severity,created_at,payload");
  });

  it("uses SOCIAL_DB read models when switch is on and prepared model is valid", async () => {
    process.env[SWITCH_ENV_KEY] = "1";
    primeCoreMinimalDataset();
    state.socialReadModel = {
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
    };

    const result = await generateRuntimeSocialFlowExportForTenant("tenant_1");
    const entries = await unzipEntries(result.buffer);

    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(1);
    expect(state.coreQueryAllCount).toBe(1);
    expect(state.runCount).toBe(1);
    expect(entries.blueprint).toBe("{\"from\":\"social\"}");
    expect(entries.workLogs).toBe("id,source\n1,social\n");
    expect(entries.financials).toBe("metric,value\nmrr,99\n");
    expect(entries.economicEvents).toBe("id\nevt_social\n");
    expect(entries.meta).toBe("{\"source\":\"social\"}");
    expect(entries.domains).toBe("[{\"domain\":\"social.example\"}]");
    expect(result.filename.startsWith("drako-export-socialflow-")).toBe(true);
    expect(result.filename.endsWith(".zip")).toBe(true);
  });

  it("falls back to core when switch is on and SOCIAL_DB read model is missing", async () => {
    process.env[SWITCH_ENV_KEY] = "1";
    primeCoreFallbackDataset();
    state.socialReadModel = null;

    const result = await generateRuntimeSocialFlowExportForTenant("tenant_1");
    const entries = await unzipEntries(result.buffer);

    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(2);
    expect(state.coreQueryAllCount).toBe(5);
    expect(state.runCount).toBe(1);
    expect(entries.blueprint).toContain("\"blueprint\": true");
    expect(entries.workLogs).toContain("id,agent_name,action_type,status,cost_eur,created_at,output_snippet");
    expect(entries.financials).toContain("metric,value,unit");
    expect(entries.economicEvents).toContain("id,type,severity,created_at,payload");
  });

  it("falls back to core when switch is on and SOCIAL_DB read fails", async () => {
    state.contextEnv = {
      [SWITCH_ENV_KEY]: "1",
    };
    primeCoreFallbackDataset();
    state.socialReadError = new Error("SOCIAL_READ_FAILURE");

    const result = await generateRuntimeSocialFlowExportForTenant("tenant_1");
    const entries = await unzipEntries(result.buffer);

    expect(state.socialQueryCount).toBe(1);
    expect(state.coreQueryOneCount).toBe(2);
    expect(state.coreQueryAllCount).toBe(5);
    expect(state.runCount).toBe(1);
    expect(entries.blueprint).toContain("\"blueprint\": true");
    expect(entries.workLogs).toContain("id,agent_name,action_type,status,cost_eur,created_at,output_snippet");
    expect(entries.financials).toContain("metric,value,unit");
    expect(entries.economicEvents).toContain("id,type,severity,created_at,payload");
  });
});
