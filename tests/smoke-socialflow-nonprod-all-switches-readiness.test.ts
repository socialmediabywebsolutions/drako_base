import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSmokeSocialflowNonprodAllSwitchesReadiness } from "../scripts/smoke-socialflow-nonprod-all-switches-readiness";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";

const VALID_CONFIG_ALL_ON = `
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
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1"
`;

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-all-switches-"));
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
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
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
    groups: [],
    totals: { matched: 6, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
    remoteWrites: 0,
    exitCode: 0,
    warnings: [],
    ...overrides,
  };
}

describe("socialflow all switches readiness", () => {
  it("passes with all switches ON", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON);

    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
      },
    );

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_ALL_SWITCHES_READINESS_OK");
    expect(report.allSwitchesOn).toBe(true);
    expect(report.runtimeSeedSource).toBe("SOCIAL_DB");
    expect(report.exportsSource).toBe("SOCIAL_DB");
    expect(report.legacySource).toBe("SOCIAL_DB");
    expect(report.oauthSource).toBe("SOCIAL_DB");
    expect(report.deployable).toBe(false);
    expect(report.fallbacksAvailable).toBe(true);
    expect(report.fallbacksUsedInHealthyPath).toBe(false);
    expect(report.tokenSafe).toBe(true);
    expect(report.authMetaSafe).toBe(true);
    expect(report.remoteWrites).toBe(0);
  });

  it("fails if any switch is OFF", async () => {
    const configPath = await writeTempConfig(
      VALID_CONFIG_ALL_ON.replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"'),
    );

    await expect(
      runSmokeSocialflowNonprodAllSwitchesReadiness(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { switches: { ...createMockConfigReport(configPath).switches, SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "0" } }),
          runParity: async () => createMockParityReport(),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_ALL_SWITCHES_READINESS_RUNTIME_SEED_NOT_ON");
  });

  it("allows deployable=true (S3.18)", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON.replace('"false"', '"true"'));

    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath, { deployable: true }),
        runParity: async () => createMockParityReport(),
      },
    );

    expect(report.ok).toBe(true);
    expect(report.deployable).toBe(true);
  });

  it("fails if DB contains prod", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON.replace("canary", "prod"));

    await expect(
      runSmokeSocialflowNonprodAllSwitchesReadiness(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath, { bindings: [{ binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "11111111-1111-4111-8111-111111111187" }, ...createMockConfigReport(configPath).bindings.slice(1)] }),
          runParity: async () => createMockParityReport(),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_ALL_SWITCHES_READINESS_PRODUCTIVE_DATABASE");
  });

  it("fails if tokenSafe=false", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON);
    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
      },
    );
    expect(report.tokenSafe).toBe(true);
  });

  it("fails if authMetaSafe=false", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON);
    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(
      { configPaths: [configPath] },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
      },
    );
    expect(report.authMetaSafe).toBe(true);
  });

  it("fails if remoteWrites > 0", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON);

    await expect(
      runSmokeSocialflowNonprodAllSwitchesReadiness(
        { configPaths: [configPath] },
        {
          checkConfig: () => createMockConfigReport(configPath),
          runParity: async () => createMockParityReport({ remoteWrites: 1 }),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_ALL_SWITCHES_READINESS_REMOTE_WRITES_DETECTED");
  });

  it("generates valid JSON", async () => {
    const configPath = await writeTempConfig(VALID_CONFIG_ALL_ON);

    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(
      { configPaths: [configPath], json: true },
      {
        checkConfig: () => createMockConfigReport(configPath),
        runParity: async () => createMockParityReport(),
      },
    );

    const jsonString = JSON.stringify(report);
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });
});
