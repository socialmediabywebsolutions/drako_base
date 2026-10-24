import { describe, expect, it } from "vitest";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowNonprodSourceBootstrapReport } from "../scripts/bootstrap-socialflow-nonprod-source-data";
import type { SocialflowNonprodOwnershipBackfillReport } from "../scripts/backfill-socialflow-nonprod-ownership-read-models";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";
import {
  assertSafeSocialflowNonprodSwitchesOffSmokeSql,
  runSmokeSocialflowNonprodCanaryWithSwitchesOff,
  type SocialflowNonprodSmokeDbAccessReport,
} from "../scripts/smoke-socialflow-nonprod-canary-with-switches-off";

const CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

function createConfigReport(configPath: string, overrides: Partial<SocialflowNonprodCanaryConfigReport> = {}): SocialflowNonprodCanaryConfigReport {
  return {
    configPath,
    workerName: "saas-socialflows-runtime-canary-nonprod",
    bindings: [
      {
        binding: "DRACO_DB",
        databaseName: "drako_db_socialflow_canary",
        databaseId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde",
      },
      {
        binding: "SAASES_DB",
        databaseName: "saas_socialflows_registry_canary_db",
        databaseId: "6951995a-141f-4338-acc5-f65be3d8c91e",
      },
      {
        binding: "SOCIAL_DB",
        databaseName: "saas_socialflows_canary_db",
        databaseId: "349fa685-044e-4292-b6e9-b1cafd35896e",
      },
      {
        binding: "SOCIALFLOW_AUTHS_DB",
        databaseName: "saas_socialflow_auths_canary_db",
        databaseId: "213b115b-9363-4a21-82d6-8db58c98d6df",
      },
    ],
    switches: {
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
    },
    placeholders: [],
    deployable: false,
    allowDeployWithRealD1: false,
    status: "NON_DEPLOYABLE_REAL_NONPROD_CONFIG",
    ...overrides,
  };
}

function createSourceVerifyReport(): SocialflowNonprodSourceBootstrapReport {
  return {
    ok: true,
    mode: "verify-only",
    status: "VERIFY_OK",
    targetDbName: "drako_db_socialflow_canary",
    targetDbId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde",
    touchedDatabases: ["drako_db_socialflow_canary"],
    oauthExcluded: true,
    remoteWrites: 0,
    idempotent: true,
    canaryTenantId: "tenant_socialflow_canary",
    canarySaasId: "saas_socialflow_canary",
    canaryDomain: "socialflow-canary.local",
    tables: {
      saas: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      tenants: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      saas_domains: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      tenant_strategic_dossiers: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      agent_work_logs: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      orchestrator_messages: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
      economic_events: { tableExists: true, rowExists: true, inserts: 0, updates: 0, unchanged: 1, sourceRows: 1, warnings: [] },
    },
    warnings: [],
  };
}

function createOwnershipVerifyReport(
  overrides: Partial<SocialflowNonprodOwnershipBackfillReport> = {},
): SocialflowNonprodOwnershipBackfillReport {
  return {
    ok: true,
    mode: "verify-only",
    status: "VERIFY_OK",
    sourceDbName: "drako_db_socialflow_canary",
    sourceDbId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde",
    targetDbName: "saas_socialflows_canary_db",
    targetDbId: "349fa685-044e-4292-b6e9-b1cafd35896e",
    oauthExcluded: true,
    idempotent: true,
    remoteWrites: 0,
    tables: {
      runtimeSeed: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
      exports: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
      legacyDossiers: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
      legacyProgress: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
      legacyWorkLogs: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
      legacyRepositoryContext: { sourceRows: 1, selected: 1, targetRows: 1, inserts: 0, updates: 0, unchanged: 1, warnings: [] },
    },
    targetCounts: {
      socialflow_seed_metadata: 1,
      socialflow_export_read_models: 1,
      socialflow_legacy_strategic_dossiers: 1,
      socialflow_legacy_tenant_progress: 1,
      socialflow_legacy_agent_work_logs: 1,
      socialflow_legacy_repository_context: 1,
    },
    warnings: [],
    ...overrides,
  };
}

function createParityReport(overrides: Partial<SocialflowNonprodOwnershipParityReport> = {}): SocialflowNonprodOwnershipParityReport {
  return {
    ok: true,
    status: "PARITY_OK",
    exitCode: 0,
    sourceDbName: "drako_db_socialflow_canary",
    sourceDbId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde",
    targetDbName: "saas_socialflows_canary_db",
    targetDbId: "349fa685-044e-4292-b6e9-b1cafd35896e",
    readOnly: true,
    remoteWrites: 0,
    oauthExcluded: true,
    skippedOAuth: [
      "socialflow_oauth_connections",
      "drako_integration_connections",
      "drako_integration_credentials",
      "tokens",
      "credentials",
      "authMeta",
    ],
    totals: {
      matched: 6,
      missingInSocial: 0,
      missingInCore: 0,
      mismatched: 0,
      emptySources: 0,
    },
    groups: {
      runtimeSeed: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
      exports: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
      legacyDossiers: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
      legacyProgress: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
      legacyWorkLogs: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
      legacyRepositoryContext: { sourceRows: 1, expectedRows: 1, targetRows: 1, matched: 1, missingInSocial: [], missingInCore: [], mismatched: [], emptySources: [], warnings: [] },
    },
    warnings: [],
    ...overrides,
  };
}

function createDbAccessReport(binding: string, databaseName: string, databaseId: string): SocialflowNonprodSmokeDbAccessReport {
  return {
    binding,
    databaseName,
    databaseId,
    accessible: true,
    sql: "SELECT 1 AS ok;",
    rowCount: 1,
  };
}

describe("socialflow nonprod canary smoke with switches off", () => {
  it("accepts a strict read-only smoke and marks runtime seed as the next phase", async () => {
    const configReports = [
      createConfigReport(CONFIG_PATHS[0]),
      createConfigReport(CONFIG_PATHS[1]),
    ];

    const report = await runSmokeSocialflowNonprodCanaryWithSwitchesOff(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => configReports.find((entry) => entry.configPath === configPath) ?? configReports[0],
        checkDatabaseAccess: (binding) => createDbAccessReport(binding.binding, binding.databaseName, binding.databaseId),
        runSourceVerify: async () => createSourceVerifyReport(),
        runOwnershipVerify: async () => createOwnershipVerifyReport(),
        runParity: async () => createParityReport(),
      },
    );

    expect(report.status).toBe("SMOKE_OK");
    expect(report.readyForNextPhase).toBe(true);
    expect(report.nextPhaseRecommendation).toBe("activate-only-SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH");
    expect(report.remoteWrites).toBe(0);
    expect(report.oauthExcluded).toBe(true);
    expect(report.oauthTouchedDatabases).toEqual([]);
    expect(report.databaseAccess).toHaveLength(4);
    expect(report.touchedDatabases).toEqual([
      "drako_db_socialflow_canary",
      "saas_socialflows_registry_canary_db",
      "saas_socialflows_canary_db",
      "saas_socialflow_auths_canary_db",
    ]);
  });

  it("rejects config drift between the two canary wrangler files", async () => {
    const configReports = [
      createConfigReport(CONFIG_PATHS[0]),
      createConfigReport(CONFIG_PATHS[1], {
        bindings: [
          {
            binding: "DRACO_DB",
            databaseName: "drako_db_socialflow_canary_alt",
            databaseId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde",
          },
          {
            binding: "SAASES_DB",
            databaseName: "saas_socialflows_registry_canary_db",
            databaseId: "6951995a-141f-4338-acc5-f65be3d8c91e",
          },
          {
            binding: "SOCIAL_DB",
            databaseName: "saas_socialflows_canary_db",
            databaseId: "349fa685-044e-4292-b6e9-b1cafd35896e",
          },
          {
            binding: "SOCIALFLOW_AUTHS_DB",
            databaseName: "saas_socialflow_auths_canary_db",
            databaseId: "213b115b-9363-4a21-82d6-8db58c98d6df",
          },
        ],
      }),
    ];

    await expect(runSmokeSocialflowNonprodCanaryWithSwitchesOff(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => configReports.find((entry) => entry.configPath === configPath) ?? configReports[0],
        checkDatabaseAccess: (binding) => createDbAccessReport(binding.binding, binding.databaseName, binding.databaseId),
        runSourceVerify: async () => createSourceVerifyReport(),
        runOwnershipVerify: async () => createOwnershipVerifyReport(),
        runParity: async () => createParityReport(),
      },
    )).rejects.toThrow("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_BINDING_MISMATCH");
  });

  it("rejects empty SOCIAL_DB read models even if parity is mocked green", async () => {
    await expect(runSmokeSocialflowNonprodCanaryWithSwitchesOff(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        checkDatabaseAccess: (binding) => createDbAccessReport(binding.binding, binding.databaseName, binding.databaseId),
        runSourceVerify: async () => createSourceVerifyReport(),
        runOwnershipVerify: async () => createOwnershipVerifyReport({
          targetCounts: {
            socialflow_seed_metadata: 1,
            socialflow_export_read_models: 0,
            socialflow_legacy_strategic_dossiers: 1,
            socialflow_legacy_tenant_progress: 1,
            socialflow_legacy_agent_work_logs: 1,
            socialflow_legacy_repository_context: 1,
          },
        }),
        runParity: async () => createParityReport(),
      },
    )).rejects.toThrow("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_TARGET_COUNT_EMPTY:socialflow_export_read_models");
  });

  it("rejects write-capable SQL in the direct accessibility probe", () => {
    expect(() => assertSafeSocialflowNonprodSwitchesOffSmokeSql("UPDATE saas SET slug = 'x';")).toThrow(
      "SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SQL_NOT_READ_ONLY",
    );
  });
});
