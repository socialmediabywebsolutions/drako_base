import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSmokeSocialflowNonprodLegacySwitch } from "../scripts/smoke-socialflow-nonprod-legacy-switch";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";

const VALID_NONPROD_CONFIG_LEGACY_ON = `
name = "saas-socialflows-runtime-canary-nonprod"

[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_socialflow_canary"
database_id = "11111111-1111-4111-8111-111111111187"

[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_socialflows_registry_canary_db"
database_id = "22222222-2222-4222-8222-222222222188"

[[d1_databases]]
binding = "SOCIAL_DB"
database_name = "saas_socialflows_canary_db"
database_id = "33333333-3333-4333-8333-333333333188"

[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB"
database_name = "saas_socialflow_auths_canary_db"
database_id = "44444444-4444-4444-8444-444444444189"

[vars]
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
`;

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-legacy-smoke-"));
  const configPath = path.join(tmpDir, "wrangler.toml");
  await fs.writeFile(configPath, source, "utf8");
  return configPath;
}

function createMockConfigReport(configPath: string, overrides?: Partial<SocialflowNonprodCanaryConfigReport>): SocialflowNonprodCanaryConfigReport {
  return {
    configPath,
    workerName: "saas-socialflows-runtime-canary-nonprod",
    bindings: [
      { binding: "DRACO_DB", databaseName: "drako_db_socialflow_canary", databaseId: "11111111-1111-4111-8111-111111111187" },
      { binding: "SAASES_DB", databaseName: "saas_socialflows_registry_canary_db", databaseId: "22222222-2222-4222-8222-222222222188" },
      { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "33333333-3333-4333-8333-333333333188" },
      { binding: "SOCIALFLOW_AUTHS_DB", databaseName: "saas_socialflow_auths_canary_db", databaseId: "44444444-4444-4444-8444-444444444189" },
    ],
    switches: {
      SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
      SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
      SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE: "all-switches-off",
    },
    placeholders: [],
    deployable: false,
    allowDeployWithRealD1: false,
    status: "NON_DEPLOYABLE_REAL_NONPROD_CONFIG",
    ...overrides,
  };
}

function createMockParityReport(overrides?: Partial<SocialflowNonprodOwnershipParityReport>): SocialflowNonprodOwnershipParityReport {
  return {
    status: "PARITY_OK",
    groups: [
      { sourceTable: "saas", targetTable: "socialflow_seed_metadata", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
      { sourceTable: "tenant_strategic_dossiers", targetTable: "socialflow_export_read_models", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
      { sourceTable: "tenant_strategic_dossiers", targetTable: "socialflow_legacy_strategic_dossiers", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
      { sourceTable: "tenants", targetTable: "socialflow_legacy_tenant_progress", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
      { sourceTable: "agent_work_logs", targetTable: "socialflow_legacy_agent_work_logs", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
      { sourceTable: "saas", targetTable: "socialflow_legacy_repository_context", status: "matched", matched: 1, missingInSocial: 0, missingInCore: 0, mismatched: 0 },
    ],
    totals: { matched: 6, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
    remoteWrites: 0,
    exitCode: 0,
    warnings: [],
    ...overrides,
  };
}

describe("socialflow nonprod legacy switch smoke", () => {
  it("passes with runtime seed + exports + legacy ON and OAuth OFF", async () => {
    const configPath = await writeTempConfig(VALID_NONPROD_CONFIG_LEGACY_ON);

    const report = await runSmokeSocialflowNonprodLegacySwitch(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
        runContractTests: () => {},
      },
    );

    expect(report.ok).toBe(true);
    expect(report.status).toBe("LEGACY_SWITCH_SMOKE_OK");
    expect(report.runtimeSeedSwitch).toBe("1");
    expect(report.exportsSwitch).toBe("1");
    expect(report.legacySwitch).toBe("1");
    expect(report.oauthSwitch).toBe("0");
    expect(report.deployable).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.deploy).toBe(false);
    expect(report.oauthExcluded).toBe(true);
    expect(report.parityReport.status).toBe("PARITY_OK");
    expect(report.parityReport.legacyGroupMatched).toBe(4);
    expect(report.parityReport.legacyGroupMissingInSocial).toBe(0);
    expect(report.parityReport.legacyGroupMismatched).toBe(0);
    expect(report.rollbackReady).toBe(true);
    expect(report.rollbackTarget.legacyToOff).toBe(true);
    expect(report.nextPhaseRecommendation).toBe("PREPARE_OAUTH_SWITCH_LAST");
  });

  it("fails if legacy switch is OFF", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace('SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"', 'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"'),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { switches: { ...createMockConfigReport(configPath).switches, SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0" } }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_NOT_ON");
  });

  it("fails if OAuth switch is ON", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace('SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1"'),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { switches: { ...createMockConfigReport(configPath).switches, SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1" } }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_OAUTH_NOT_OFF");
  });

  it("fails if runtime seed switch is OFF", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"'),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { switches: { ...createMockConfigReport(configPath).switches, SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0" } }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_RUNTIME_SEED_NOT_ON");
  });

  it("fails if exports switch is OFF", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace('SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"', 'SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"'),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { switches: { ...createMockConfigReport(configPath).switches, SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0" } }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_EXPORTS_NOT_ON");
  });

  it("fails if deployable is true", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace('SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"', 'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"'),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { deployable: true }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_DEPLOYABLE_NOT_ALLOWED");
  });

  it("fails if database contains prod token", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG_LEGACY_ON.replace("drako_db_socialflow_canary", "drako_db_prod"),
    );

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { bindings: [{ binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "11111111-1111-4111-8111-111111111187" }, ...createMockConfigReport(configPath).bindings.slice(1)] }),
          runParity: async () => createMockParityReport(),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_PRODUCTIVE_DATABASE");
  });

  it("fails if parity is not OK", async () => {
    const configPath = await writeTempConfig(VALID_NONPROD_CONFIG_LEGACY_ON);

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath),
          runParity: async () => createMockParityReport({ status: "PARITY_DRIFT" }),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_PARITY_NOT_OK");
  });

  it("fails if remote writes detected", async () => {
    const configPath = await writeTempConfig(VALID_NONPROD_CONFIG_LEGACY_ON);

    await expect(
      runSmokeSocialflowNonprodLegacySwitch(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath),
          runParity: async () => createMockParityReport({ remoteWrites: 1 }),
          runContractTests: () => {},
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_SWITCH_REMOTE_WRITES_DETECTED");
  });

  it("validates remoteWrites=0 and oauthExcluded=true", async () => {
    const configPath = await writeTempConfig(VALID_NONPROD_CONFIG_LEGACY_ON);

    const report = await runSmokeSocialflowNonprodLegacySwitch(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
        runContractTests: () => {},
      },
    );

    expect(report.remoteWrites).toBe(0);
    expect(report.oauthExcluded).toBe(true);
  });
});
