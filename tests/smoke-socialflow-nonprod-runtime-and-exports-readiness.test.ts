import { describe, expect, it, vi } from "vitest";
import {
  runSmokeSocialflowNonprodRuntimeAndExportsReadiness,
  type SocialflowNonprodRuntimeAndExportsReadinessReport,
} from "../scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";

const CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

function createConfigReport(
  configPath: string,
  overrides: Partial<SocialflowNonprodCanaryConfigReport> = {},
): SocialflowNonprodCanaryConfigReport {
  return {
    configPath,
    bindings: [
      { binding: "DRACO_DB", databaseName: "drako_db_socialflow_canary", databaseId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde" },
      { binding: "SAASES_DB", databaseName: "saas_socialflows_registry_canary_db", databaseId: "6951995a-141f-4338-acc5-f65be3d8c91e" },
      { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "349fa685-044e-4292-b6e9-b1cafd35896e" },
      { binding: "SOCIALFLOW_AUTHS_DB", databaseName: "saas_socialflow_auths_canary_db", databaseId: "213b115b-9363-4a21-82d6-8db58c98d6df" },
    ],
    switches: {
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
      SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
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

function createParityReport(
  overrides: Partial<SocialflowNonprodOwnershipParityReport> = {},
): SocialflowNonprodOwnershipParityReport {
  return {
    ok: true,
    status: "PARITY_OK",
    exitCode: 0,
    groups: {
      runtimeSeed: { matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
      exports: { matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
      legacyDossiers: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
      legacyProgress: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
      legacyWorkLogs: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
      legacyRepositoryContext: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, drift: [] },
    },
    totals: {
      matched: 2,
      missingInSocial: 0,
      missingInCore: 0,
      mismatched: 0,
      emptySources: 0,
    },
    remoteWrites: 0,
    oauthExcluded: true,
    warnings: [],
    ...overrides,
  };
}

describe("socialflow nonprod runtime and exports readiness", () => {
  it("passes when runtime seed ON + exports ON + parity green + contracts pass", async () => {
    const runContractTests = vi.fn();

    const report = await runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport(),
        runContractTests,
      },
    );

    expect(report.status).toBe("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK");
    expect(report.runtimeSeedSwitch).toBe("1");
    expect(report.exportsSwitch).toBe("1");
    expect(report.oauthSwitch).toBe("0");
    expect(report.legacySwitch).toBe("0");
    expect(report.deployable).toBe(false);
    expect(report.runtimeSeedSource).toBe("SOCIAL_DB");
    expect(report.exportsSource).toBe("SOCIAL_DB");
    expect(report.fallbacksAvailable).toBe(true);
    expect(report.fallbacksUsedInHealthyPath).toBe(false);
    expect(report.parityReport.status).toBe("PARITY_OK");
    expect(report.parityReport.runtimeSeedGroupMatched).toBe(1);
    expect(report.parityReport.exportsGroupMatched).toBe(1);
    expect(report.parityReport.missingInSocial).toBe(0);
    expect(report.parityReport.mismatched).toBe(0);
    expect(report.remoteWrites).toBe(0);
    expect(report.deploy).toBe(false);
    expect(report.oauthExcluded).toBe(true);
    expect(report.configuredDatabases).toEqual([
      "drako_db_socialflow_canary",
      "saas_socialflows_registry_canary_db",
      "saas_socialflows_canary_db",
      "saas_socialflow_auths_canary_db",
    ]);
    expect(report.rollbackReady).toBe(true);
    expect(report.rollbackTarget.runtimeSeedToOff).toBe(true);
    expect(report.rollbackTarget.exportsToOff).toBe(true);
    expect(report.nextPhaseRecommendation).toBe("PREPARE_LEGACY_SWITCH_NONPROD");
    expect(report.contractEvidence.runtimeSeedValidatesSocialFirstRead).toBe(true);
    expect(report.contractEvidence.runtimeSeedValidatesCoreFallback).toBe(true);
    expect(report.contractEvidence.runtimeSeedValidatesSocialDbFailureFallback).toBe(true);
    expect(report.contractEvidence.exportsValidatesSocialDbFirstRead).toBe(true);
    expect(report.contractEvidence.exportsValidatesCoreFallbackOnMissing).toBe(true);
    expect(report.contractEvidence.exportsValidatesCoreFallbackOnError).toBe(true);
    expect(report.contractEvidence.exportsValidatesZipPayloadIntact).toBe(true);
    expect(report.contractEvidence.exportsSocialReadPrepValidatesSocialDbTable).toBe(true);
    expect(report.contractEvidence.exportsSocialReadPrepValidatesFailClosed).toBe(true);

    expect(runContractTests).toHaveBeenCalledTimes(3);
    expect(runContractTests).toHaveBeenCalledWith("tests/lib/socialflow-runtime-seed-contract.test.ts");
    expect(runContractTests).toHaveBeenCalledWith("apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts");
    expect(runContractTests).toHaveBeenCalledWith("tests/lib/socialflow-export-social-read-prep-contract.test.ts");
  });

  it("fails when runtime seed switch is OFF", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_RUNTIME_SEED_NOT_ON");
  });

  it("fails when exports switch is OFF", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_EXPORTS_NOT_ON");
  });

  it("fails when OAuth switch is ON", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_FORBIDDEN_SWITCH_ON");
  });

  it("fails when legacy switch is ON", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_FORBIDDEN_SWITCH_ON");
  });

  it("fails when config is deployable", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, { deployable: true }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_DEPLOYABLE_BLOCKED");
  });

  it("fails when database contains prod token", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          bindings: [
            { binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde" },
            { binding: "SAASES_DB", databaseName: "saas_socialflows_registry_canary_db", databaseId: "6951995a-141f-4338-acc5-f65be3d8c91e" },
            { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "349fa685-044e-4292-b6e9-b1cafd35896e" },
            { binding: "SOCIALFLOW_AUTHS_DB", databaseName: "saas_socialflow_auths_canary_db", databaseId: "213b115b-9363-4a21-82d6-8db58c98d6df" },
          ],
        }),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PRODUCTIVE_DB");
  });

  it("fails when parity is not OK", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport({ status: "PARITY_DRIFT" }),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_NOT_OK");
  });

  it("fails when parity has missing rows in SOCIAL_DB", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport({
          totals: {
            matched: 1,
            missingInSocial: 1,
            missingInCore: 0,
            mismatched: 0,
            emptySources: 0,
          },
        }),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_MISSING_IN_SOCIAL");
  });

  it("fails when parity has mismatched rows", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport({
          totals: {
            matched: 0,
            missingInSocial: 0,
            missingInCore: 0,
            mismatched: 1,
            emptySources: 0,
          },
        }),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_MISMATCHED");
  });

  it("reports runtime seed and exports source selection", async () => {
    const report = await runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    );

    expect(report.runtimeSeedSource).toBe("SOCIAL_DB");
    expect(report.exportsSource).toBe("SOCIAL_DB");
    expect(report.fallbacksAvailable).toBe(true);
    expect(report.fallbacksUsedInHealthyPath).toBe(false);
  });

  it("reports remoteWrites as 0", async () => {
    const report = await runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    );

    expect(report.remoteWrites).toBe(0);
  });

  it("reports oauthExcluded as true", async () => {
    const report = await runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runParity: async () => createParityReport(),
        runContractTests: vi.fn(),
      },
    );

    expect(report.oauthExcluded).toBe(true);
  });
});
