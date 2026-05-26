import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runSmokeSocialflowNonprodExportsSwitch,
  type SocialflowNonprodExportsSwitchReport,
} from "../scripts/smoke-socialflow-nonprod-exports-switch";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";

const mockConfigReport: SocialflowNonprodCanaryConfigReport = {
  configPath: "apps/socialflow-runtime/wrangler.toml",
  workerName: "saas-socialflows-runtime-canary-nonprod",
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
};

const mockParityReport: SocialflowNonprodOwnershipParityReport = {
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
  skippedOAuth: ["socialflow_oauth_connections", "drako_integration_connections", "drako_integration_credentials", "tokens", "credentials", "authMeta"],
  totals: {
    matched: 10,
    missingInSocial: 0,
    missingInCore: 0,
    mismatched: 0,
    emptySources: 0,
  },
  groups: {
    runtimeSeed: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
    exports: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
    legacyDossiers: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
    legacyProgress: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
    legacyWorkLogs: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
    legacyRepositoryContext: {
      sourceRows: 1,
      expectedRows: 1,
      targetRows: 1,
      matched: 1,
      missingInSocial: [],
      missingInCore: [],
      mismatched: [],
      emptySources: [],
      warnings: [],
    },
  },
  warnings: [],
};

describe("socialflow nonprod exports switch smoke", () => {
  let checkConfig: ReturnType<typeof vi.fn>;
  let runParity: ReturnType<typeof vi.fn>;
  let runContractTests: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    checkConfig = vi.fn(() => mockConfigReport);
    runParity = vi.fn(async () => mockParityReport);
    runContractTests = vi.fn();
  });

  it("passes when runtime seed ON, exports ON, OAuth/legacy OFF, parity green", async () => {
    const report = await runSmokeSocialflowNonprodExportsSwitch(
      { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
      { checkConfig, runParity, runContractTests },
    );

    expect(report.ok).toBe(true);
    expect(report.status).toBe("EXPORTS_SWITCH_SMOKE_OK");
    expect(report.runtimeSeedSwitch).toBe("1");
    expect(report.exportsSwitch).toBe("1");
    expect(report.oauthSwitch).toBe("0");
    expect(report.legacySwitch).toBe("0");
    expect(report.deployable).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.deploy).toBe(false);
    expect(report.oauthExcluded).toBe(true);
    expect(report.contractEvidence.switchValue).toBe("1");
    expect(report.contractEvidence.validatesSocialDbFirstRead).toBe(true);
    expect(report.contractEvidence.validatesCoreFallbackOnMissing).toBe(true);
    expect(report.contractEvidence.validatesCoreFallbackOnError).toBe(true);
    expect(report.contractEvidence.validatesZipPayloadIntact).toBe(true);
    expect(report.parityReport.status).toBe("PARITY_OK");
    expect(report.parityReport.exportsGroupMatched).toBe(1);
    expect(report.parityReport.exportsGroupMissingInSocial).toBe(0);
    expect(report.parityReport.exportsGroupMissingInCore).toBe(0);
    expect(report.parityReport.exportsGroupMismatched).toBe(0);
    expect(report.rollbackReady).toBe(true);
    expect(report.rollbackTarget.exportsToOff).toBe(true);
    expect(report.nextPhaseRecommendation).toBe("MONITOR_EXPORTS_SOCIAL_DB_FIRST_THEN_ACTIVATE_LEGACY");
    expect(runContractTests).toHaveBeenCalledTimes(2);
  });

  it("fails when exports switch is OFF", async () => {
    const badConfig = {
      ...mockConfigReport,
      switches: {
        ...mockConfigReport.switches,
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
      },
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_EXPORTS_NOT_ON");
  });

  it("fails when runtime seed switch is OFF", async () => {
    const badConfig = {
      ...mockConfigReport,
      switches: {
        ...mockConfigReport.switches,
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0",
      },
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_RUNTIME_SEED_NOT_ON");
  });

  it("fails when config is deployable", async () => {
    const badConfig = {
      ...mockConfigReport,
      deployable: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG" as const,
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_UNSAFE_STATUS");
  });

  it("fails when parity is not green", async () => {
    const badParity = {
      ...mockParityReport,
      ok: false,
      status: "DRIFT_DETECTED" as const,
      exitCode: 2 as const,
    };
    runParity = vi.fn(async () => badParity);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_PARITY_FAILED:DRIFT_DETECTED");
  });

  it("fails when database contains prod token", async () => {
    const badConfig = {
      ...mockConfigReport,
      bindings: [
        { binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "ca873dbd-2c44-49ae-bf14-e1ce7f217fde" },
        ...mockConfigReport.bindings.slice(1),
      ],
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_PRODUCTIVE_DB");
  });

  it("fails when OAuth switch is ON", async () => {
    const badConfig = {
      ...mockConfigReport,
      switches: {
        ...mockConfigReport.switches,
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_OAUTH_MUST_BE_OFF");
  });

  it("fails when legacy switch is ON", async () => {
    const badConfig = {
      ...mockConfigReport,
      switches: {
        ...mockConfigReport.switches,
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
      },
    };
    checkConfig = vi.fn(() => badConfig);

    await expect(
      runSmokeSocialflowNonprodExportsSwitch(
        { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
        { checkConfig, runParity, runContractTests },
      ),
    ).rejects.toThrow("SOCIALFLOW_EXPORTS_SWITCH_LEGACY_MUST_BE_OFF");
  });

  it("fails when exports parity has missing rows in SOCIAL_DB", async () => {
    const badParity = {
      ...mockParityReport,
      groups: {
        ...mockParityReport.groups,
        exports: {
          ...mockParityReport.groups.exports,
          matched: 0,
          missingInSocial: [{ tenant_id: "tenant_1", saas_id: "saas_1" }],
        },
      },
      totals: {
        ...mockParityReport.totals,
        matched: 9,
        missingInSocial: 1,
      },
    };
    runParity = vi.fn(async () => badParity);

    const report = await runSmokeSocialflowNonprodExportsSwitch(
      { configPaths: ["apps/socialflow-runtime/wrangler.toml"] },
      { checkConfig, runParity, runContractTests },
    );

    expect(report.parityReport.exportsGroupMatched).toBe(0);
    expect(report.parityReport.exportsGroupMissingInSocial).toBe(1);
  });
});
