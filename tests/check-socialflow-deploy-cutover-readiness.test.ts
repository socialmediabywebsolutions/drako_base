import { describe, expect, it } from "vitest";
import { checkSocialflowDeployCutoverReadiness } from "../scripts/check-socialflow-deploy-cutover-readiness";
import type { SocialflowNonprodCanaryConfigReport } from "../scripts/check-socialflow-nonprod-canary-config";
import type { SocialflowAllSwitchesReadinessReport } from "../scripts/smoke-socialflow-nonprod-all-switches-readiness";
import type { SocialflowNonprodOwnershipParityReport } from "../scripts/check-socialflow-nonprod-ownership-parity";

function mockConfigReport(overrides?: Partial<SocialflowNonprodCanaryConfigReport>): SocialflowNonprodCanaryConfigReport {
  return {
    configPath: "test-config.toml",
    workerName: "test-worker",
    bindings: [
      { binding: "DRACO_DB", databaseName: "drako_db_canary", databaseId: "test-id-1" },
      { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "test-id-2" },
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

function mockAllSwitchesReadiness(): SocialflowAllSwitchesReadinessReport {
  return {
    ok: true,
    status: "SOCIALFLOW_ALL_SWITCHES_READINESS_OK",
    configReports: [mockConfigReport()],
    runtimeSeedSource: "SOCIAL_DB",
    exportsSource: "SOCIAL_DB",
    legacySource: "SOCIAL_DB",
    oauthSource: "SOCIAL_DB",
    allSwitchesOn: true,
    deployable: false,
    fallbacksAvailable: true,
    fallbacksUsedInHealthyPath: false,
    tokenSafe: true,
    authMetaSafe: true,
    remoteWrites: 0,
    deploy: false,
    parityReport: { status: "PARITY_OK" },
    nextPhaseRecommendation: "MONITOR_ALL_SWITCHES_BEFORE_DEPLOY",
  };
}

function mockParityReport(): SocialflowNonprodOwnershipParityReport {
  return {
    status: "PARITY_OK",
    groups: [],
    totals: { matched: 6, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
    remoteWrites: 0,
    exitCode: 0,
    warnings: [],
  };
}

describe("socialflow deploy cutover readiness", () => {
  it("passes with deploy blocked by design", async () => {
    const report = await checkSocialflowDeployCutoverReadiness(
      { configPaths: ["test.toml"] },
      {
        checkConfig: () => mockConfigReport(),
        runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
        runParity: async () => mockParityReport(),
      },
    );

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_DEPLOY_CUTOVER_READINESS_BLOCKED_INTENTIONALLY");
    expect(report.allSwitchesOn).toBe(true);
    expect(report.deployable).toBe(false);
    expect(report.deployBlockedByDesign).toBe(true);
    expect(report.canaryConfigReady).toBe(true);
    expect(report.rollbackReady).toBe(true);
    expect(report.productionTouched).toBe(false);
    expect(report.remoteWrites).toBe(0);
    expect(report.tokenSafe).toBe(true);
    expect(report.authMetaSafe).toBe(true);
    expect(report.parityOk).toBe(true);
  });

  it("fails if deployable=true", async () => {
    await expect(
      checkSocialflowDeployCutoverReadiness(
        { configPaths: ["test.toml"] },
        {
          checkConfig: () => mockConfigReport({ deployable: true }),
          runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
          runParity: async () => mockParityReport(),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_DEPLOY_CUTOVER_DEPLOYABLE_TRUE_UNEXPECTED");
  });

  it("fails if DB contains prod", async () => {
    await expect(
      checkSocialflowDeployCutoverReadiness(
        { configPaths: ["test.toml"] },
        {
          checkConfig: () => mockConfigReport({ bindings: [{ binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "test-id-1" }] }),
          runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
          runParity: async () => mockParityReport(),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_DEPLOY_CUTOVER_PRODUCTIVE_DATABASE");
  });

  it("fails if placeholder DB", async () => {
    await expect(
      checkSocialflowDeployCutoverReadiness(
        { configPaths: ["test.toml"] },
        {
          checkConfig: () => mockConfigReport({ placeholders: ["DRACO_DB"] }),
          runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
          runParity: async () => mockParityReport(),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_DEPLOY_CUTOVER_PLACEHOLDER_DETECTED");
  });

  it("fails if parity not OK", async () => {
    await expect(
      checkSocialflowDeployCutoverReadiness(
        { configPaths: ["test.toml"] },
        {
          checkConfig: () => mockConfigReport(),
          runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
          runParity: async () => ({ ...mockParityReport(), status: "PARITY_DRIFT" }),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_DEPLOY_CUTOVER_PARITY_NOT_OK");
  });

  it("fails if remoteWrites > 0", async () => {
    await expect(
      checkSocialflowDeployCutoverReadiness(
        { configPaths: ["test.toml"] },
        {
          checkConfig: () => mockConfigReport(),
          runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
          runParity: async () => ({ ...mockParityReport(), remoteWrites: 1 }),
        },
      ),
    ).rejects.toThrow("SOCIALFLOW_DEPLOY_CUTOVER_REMOTE_WRITES_DETECTED");
  });

  it("confirms rollbackReady=true", async () => {
    const report = await checkSocialflowDeployCutoverReadiness(
      { configPaths: ["test.toml"] },
      {
        checkConfig: () => mockConfigReport(),
        runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
        runParity: async () => mockParityReport(),
      },
    );

    expect(report.rollbackReady).toBe(true);
  });

  it("generates valid JSON", async () => {
    const report = await checkSocialflowDeployCutoverReadiness(
      { configPaths: ["test.toml"], json: true },
      {
        checkConfig: () => mockConfigReport(),
        runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
        runParity: async () => mockParityReport(),
      },
    );

    const jsonString = JSON.stringify(report);
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });

  it("lists blockers before deployable=true", async () => {
    const report = await checkSocialflowDeployCutoverReadiness(
      { configPaths: ["test.toml"] },
      {
        checkConfig: () => mockConfigReport(),
        runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
        runParity: async () => mockParityReport(),
      },
    );

    expect(report.blockersBeforeDeployableTrue).toContain("MONITOR_ALL_SWITCHES_3_7_DAYS_STABLE");
    expect(report.blockersBeforeDeployableTrue).toContain("VALIDATE_NO_TOKEN_LEAKAGE");
  });

  it("lists blockers before production", async () => {
    const report = await checkSocialflowDeployCutoverReadiness(
      { configPaths: ["test.toml"] },
      {
        checkConfig: () => mockConfigReport(),
        runAllSwitchesReadiness: async () => mockAllSwitchesReadiness(),
        runParity: async () => mockParityReport(),
      },
    );

    expect(report.blockersBeforeProduction).toContain("SET_DEPLOYABLE_TRUE");
    expect(report.blockersBeforeProduction).toContain("DNS_ROUTING_CUTOVER");
  });
});
