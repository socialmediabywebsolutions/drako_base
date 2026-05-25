import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  runtimeEnv: null as Record<string, unknown> | null,
  coreStrategicRow: null as Record<string, unknown> | null,
  socialStrategicRow: null as Record<string, unknown> | null,
  coreTenantProgressRow: null as Record<string, unknown> | null,
  socialTenantProgressRow: null as Record<string, unknown> | null,
  coreAgentWorkLogs: [] as Array<Record<string, unknown>>,
  socialAgentWorkLogs: [] as Array<Record<string, unknown>>,
  socialRepositoryContextRow: null as Record<string, unknown> | null,
  socialStrategicError: null as Error | null,
  socialTenantProgressError: null as Error | null,
  socialAgentWorkLogsError: null as Error | null,
  socialRepositoryContextError: null as Error | null,
  socialQueryCounts: {
    strategic: 0,
    tenantProgress: 0,
    agentWorkLogs: 0,
    repositoryContext: 0,
  },
  coreQueryCounts: {
    strategic: 0,
    tenantProgress: 0,
    agentWorkLogs: 0,
  },
}));

const envMock = vi.hoisted(() => vi.fn(() => state.runtimeEnv));

vi.mock("@/lib/cf", () => ({
  env: envMock,
}));

import { createSocialFlowLegacyActionsCoreAdapter } from "@/lib/socialflow/contracts/legacy-actions-core";
import { resolveLegacyRepositoryContextReadModel } from "@/lib/socialflow/contracts/repository-core-context";

function selectFirst(kind: "core" | "social", sql: string): Record<string, unknown> | null {
  if (kind === "social") {
    if (sql.includes("FROM socialflow_legacy_strategic_dossiers")) {
      state.socialQueryCounts.strategic += 1;
      if (state.socialStrategicError) throw state.socialStrategicError;
      return state.socialStrategicRow;
    }
    if (sql.includes("FROM socialflow_legacy_tenant_progress")) {
      state.socialQueryCounts.tenantProgress += 1;
      if (state.socialTenantProgressError) throw state.socialTenantProgressError;
      return state.socialTenantProgressRow;
    }
    if (sql.includes("FROM socialflow_legacy_repository_context")) {
      state.socialQueryCounts.repositoryContext += 1;
      if (state.socialRepositoryContextError) throw state.socialRepositoryContextError;
      return state.socialRepositoryContextRow;
    }
    return null;
  }

  if (sql.includes("FROM tenant_strategic_dossiers")) {
    state.coreQueryCounts.strategic += 1;
    return state.coreStrategicRow;
  }
  if (sql.includes("SELECT materialization_step FROM tenants")) {
    state.coreQueryCounts.tenantProgress += 1;
    return state.coreTenantProgressRow;
  }
  return null;
}

function selectAll(kind: "core" | "social", sql: string): Array<Record<string, unknown>> {
  if (kind === "social") {
    if (sql.includes("FROM socialflow_legacy_agent_work_logs")) {
      state.socialQueryCounts.agentWorkLogs += 1;
      if (state.socialAgentWorkLogsError) throw state.socialAgentWorkLogsError;
      return state.socialAgentWorkLogs;
    }
    return [];
  }

  if (sql.includes("FROM agent_work_logs")) {
    state.coreQueryCounts.agentWorkLogs += 1;
    return state.coreAgentWorkLogs;
  }
  return [];
}

function createDb(kind: "core" | "social"): D1Database {
  return {
    prepare(sql: string) {
      const execute = (params: unknown[]) => ({
        first: async <T>() => {
          void params;
          return selectFirst(kind, sql) as T | null;
        },
        all: async <T>() => {
          void params;
          return { results: selectAll(kind, sql) as T[] };
        },
        run: async () => ({ success: true }),
      });

      const unbound = execute([]);
      return {
        bind: (...params: unknown[]) => execute(params),
        first: unbound.first,
        all: unbound.all,
        run: unbound.run,
      };
    },
  } as unknown as D1Database;
}

describe("socialflow legacy read models switch", () => {
  beforeEach(() => {
    delete process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH;
    state.coreStrategicRow = {
      id: "core_dossier_1",
      tenant_id: "tenant_1",
      status: "active",
      form_data: "{}",
      analysis_data: "{}",
      plan_data: "{}",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    };
    state.socialStrategicRow = {
      id: "legacy_dossier_id_1",
      tenant_id: "tenant_1",
      dossier_id: "core_dossier_1",
      status: "active",
      version: 2,
      form_data_json: "{}",
      analysis_data_json: "{}",
      plan_data_json: "{}",
      source_updated_at: "2026-05-01T00:00:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    };
    state.coreTenantProgressRow = { materialization_step: 3 };
    state.socialTenantProgressRow = {
      tenant_id: "tenant_1",
      materialization_step: 4,
      updated_at: "2026-05-01T00:00:00.000Z",
    };
    state.coreAgentWorkLogs = [
      {
        id: "core_log_1",
        tenant_id: "tenant_1",
        output_json: "{\"source\":\"core\"}",
      },
    ];
    state.socialAgentWorkLogs = [
      {
        id: "legacy_log_id_1",
        tenant_id: "tenant_1",
        log_id: "core_log_1",
        saas_id: "socialflow",
        agent_name: "planner",
        action_type: "build",
        status: "ok",
        output_json: "{\"source\":\"social\"}",
        cost_eur: 0,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ];
    state.socialRepositoryContextRow = {
      id: "legacy_repo_1",
      tenant_id: "tenant_1",
      saas_id: "socialflow",
      slug: "socialflow",
      domain: "socialflow.drako.systems",
      status: "active",
      metadata_json: "{}",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    };
    state.socialStrategicError = null;
    state.socialTenantProgressError = null;
    state.socialAgentWorkLogsError = null;
    state.socialRepositoryContextError = null;
    state.socialQueryCounts = {
      strategic: 0,
      tenantProgress: 0,
      agentWorkLogs: 0,
      repositoryContext: 0,
    };
    state.coreQueryCounts = {
      strategic: 0,
      tenantProgress: 0,
      agentWorkLogs: 0,
    };
    state.runtimeEnv = {
      DRACO_DB: createDb("core"),
      SOCIAL_DB: createDb("social"),
    };
    vi.clearAllMocks();
  });

  it("keeps core-backed reads when switch is OFF", async () => {
    const adapter = createSocialFlowLegacyActionsCoreAdapter();
    const dossier = await adapter.findLatestActiveStrategicDossier("tenant_1");

    expect(dossier?.id).toBe("core_dossier_1");
    expect(state.socialQueryCounts.strategic).toBe(0);
    expect(state.coreQueryCounts.strategic).toBe(1);
  });

  it("uses SOCIAL_DB read models when switch is ON", async () => {
    process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1";
    const adapter = createSocialFlowLegacyActionsCoreAdapter();
    const dossier = await adapter.findLatestActiveStrategicDossier("tenant_1");
    const step = await adapter.getTenantMaterializationStep("tenant_1");
    const logs = await adapter.listLatestAgentWorkLogs("tenant_1", 10);

    expect(dossier?.id).toBe("core_dossier_1");
    expect(step).toBe(4);
    expect(logs[0]?.id).toBe("core_log_1");
    expect(state.socialQueryCounts.strategic).toBe(1);
    expect(state.socialQueryCounts.tenantProgress).toBe(1);
    expect(state.socialQueryCounts.agentWorkLogs).toBe(1);
    expect(state.coreQueryCounts.strategic).toBe(0);
    expect(state.coreQueryCounts.tenantProgress).toBe(0);
    expect(state.coreQueryCounts.agentWorkLogs).toBe(0);
  });

  it("falls back to core when switch is ON and SOCIAL_DB read model is missing", async () => {
    process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1";
    state.socialStrategicRow = null;
    state.socialTenantProgressRow = null;
    state.socialAgentWorkLogs = [];

    const adapter = createSocialFlowLegacyActionsCoreAdapter();
    const dossier = await adapter.findLatestActiveStrategicDossier("tenant_1");
    const step = await adapter.getTenantMaterializationStep("tenant_1");
    const logs = await adapter.listLatestAgentWorkLogs("tenant_1", 10);

    expect(dossier?.id).toBe("core_dossier_1");
    expect(step).toBe(3);
    expect(logs[0]?.id).toBe("core_log_1");
    expect(state.socialQueryCounts.strategic).toBe(1);
    expect(state.socialQueryCounts.tenantProgress).toBe(1);
    expect(state.socialQueryCounts.agentWorkLogs).toBe(1);
    expect(state.coreQueryCounts.strategic).toBe(1);
    expect(state.coreQueryCounts.tenantProgress).toBe(1);
    expect(state.coreQueryCounts.agentWorkLogs).toBe(1);
  });

  it("falls back to core when switch is ON and SOCIAL_DB read fails", async () => {
    process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1";
    state.socialStrategicError = new Error("SOCIAL_STRATEGIC_READ_FAILED");
    state.socialTenantProgressError = new Error("SOCIAL_PROGRESS_READ_FAILED");
    state.socialAgentWorkLogsError = new Error("SOCIAL_LOGS_READ_FAILED");

    const adapter = createSocialFlowLegacyActionsCoreAdapter();
    const dossier = await adapter.findLatestActiveStrategicDossier("tenant_1");
    const step = await adapter.getTenantMaterializationStep("tenant_1");
    const logs = await adapter.listLatestAgentWorkLogs("tenant_1", 10);

    expect(dossier?.id).toBe("core_dossier_1");
    expect(step).toBe(3);
    expect(logs[0]?.id).toBe("core_log_1");
    expect(state.coreQueryCounts.strategic).toBe(1);
    expect(state.coreQueryCounts.tenantProgress).toBe(1);
    expect(state.coreQueryCounts.agentWorkLogs).toBe(1);
  });

  it("keeps repository context core-backed when switch is OFF", async () => {
    const coreRead = vi.fn().mockResolvedValue({
      id: "core_repo_1",
      tenant_id: "tenant_1",
      saas_id: "socialflow",
      slug: "socialflow",
      domain: "core.socialflow.local",
      status: "active",
      metadata_json: "{}",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    });

    const row = await resolveLegacyRepositoryContextReadModel({
      tenantId: "tenant_1",
      saasId: "socialflow",
      socialDb: state.runtimeEnv?.SOCIAL_DB as D1Database,
      runtimeEnv: state.runtimeEnv,
      coreRead,
    });

    expect(row?.id).toBe("core_repo_1");
    expect(state.socialQueryCounts.repositoryContext).toBe(0);
    expect(coreRead).toHaveBeenCalledOnce();
  });

  it("uses SOCIAL_DB repository context when switch is ON", async () => {
    process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1";
    const coreRead = vi.fn().mockResolvedValue(null);

    const row = await resolveLegacyRepositoryContextReadModel({
      tenantId: "tenant_1",
      saasId: "socialflow",
      socialDb: state.runtimeEnv?.SOCIAL_DB as D1Database,
      runtimeEnv: state.runtimeEnv,
      coreRead,
    });

    expect(row?.id).toBe("legacy_repo_1");
    expect(state.socialQueryCounts.repositoryContext).toBe(1);
    expect(coreRead).not.toHaveBeenCalled();
  });

  it("falls back to core repository context when SOCIAL_DB row is missing or fails", async () => {
    process.env.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1";
    state.socialRepositoryContextRow = null;
    const coreRead = vi.fn().mockResolvedValue({
      id: "core_repo_2",
      tenant_id: "tenant_1",
      saas_id: "socialflow",
      slug: "socialflow",
      domain: "core.socialflow.local",
      status: "active",
      metadata_json: "{}",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    });

    const rowMissing = await resolveLegacyRepositoryContextReadModel({
      tenantId: "tenant_1",
      saasId: "socialflow",
      socialDb: state.runtimeEnv?.SOCIAL_DB as D1Database,
      runtimeEnv: state.runtimeEnv,
      coreRead,
    });
    expect(rowMissing?.id).toBe("core_repo_2");

    state.socialRepositoryContextError = new Error("SOCIAL_REPO_READ_FAILED");
    const rowError = await resolveLegacyRepositoryContextReadModel({
      tenantId: "tenant_1",
      saasId: "socialflow",
      socialDb: state.runtimeEnv?.SOCIAL_DB as D1Database,
      runtimeEnv: state.runtimeEnv,
      coreRead,
    });
    expect(rowError?.id).toBe("core_repo_2");
    expect(coreRead).toHaveBeenCalledTimes(2);
  });
});
