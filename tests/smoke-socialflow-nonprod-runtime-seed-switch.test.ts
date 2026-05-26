import { describe, expect, it, vi } from "vitest";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import { runSmokeSocialflowNonprodRuntimeSeedSwitch } from "../scripts/smoke-socialflow-nonprod-runtime-seed-switch";

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
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
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

describe("socialflow nonprod runtime seed switch smoke", () => {
  it("accepts only runtime seed switch on and records rollback target", async () => {
    const runContractTests = vi.fn();

    const report = await runSmokeSocialflowNonprodRuntimeSeedSwitch(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath),
        runContractTests,
      },
    );

    expect(report.status).toBe("RUNTIME_SEED_SWITCH_SMOKE_OK");
    expect(report.runtimeSeedSwitch).toBe("1");
    expect(report.exportsSwitch).toBe("0");
    expect(report.requiredOffSwitches).toEqual({
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
    });
    expect(report.remoteWrites).toBe(0);
    expect(report.configuredDatabases).toEqual([
      "drako_db_socialflow_canary",
      "saas_socialflows_registry_canary_db",
      "saas_socialflows_canary_db",
      "saas_socialflow_auths_canary_db",
    ]);
    expect(report.deploy).toBe(false);
    expect(report.oauthExcluded).toBe(true);
    expect(report.rollbackReady).toBe(true);
    expect(report.rollbackTarget).toEqual({
      switchName: "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
      switchValue: "0",
      configPaths: [...CONFIG_PATHS],
    });
    expect(report.contractEvidence.validatesSocialFirstRead).toBe(true);
    expect(report.contractEvidence.validatesCoreFallback).toBe(true);
    expect(report.contractEvidence.validatesSocialDbFailureFallback).toBe(true);
    expect(runContractTests).toHaveBeenCalledWith("tests/lib/socialflow-runtime-seed-contract.test.ts");
  });

  it("rejects runtime seed switch off", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeSeedSwitch(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_RUNTIME_SWITCH_NOT_ON");
  });

  it("rejects OAuth or legacy switches on", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeSeedSwitch(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, {
          switches: {
            SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
            SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
            SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
          },
        }),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_FORBIDDEN_SWITCH_ON");
  });

  it("rejects binding drift between canary configs", async () => {
    await expect(runSmokeSocialflowNonprodRuntimeSeedSwitch(
      { configPaths: [...CONFIG_PATHS] },
      {
        checkConfig: ({ configPath }) => createConfigReport(configPath, configPath === CONFIG_PATHS[1]
          ? {
              bindings: [
                {
                  binding: "DRACO_DB",
                  databaseName: "drako_db_socialflow_canary_other",
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
            }
          : {}),
        runContractTests: vi.fn(),
      },
    )).rejects.toThrow("SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_BINDING_MISMATCH");
  });
});
