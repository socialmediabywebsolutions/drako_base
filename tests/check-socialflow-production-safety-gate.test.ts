import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkProductionSafetyGate } from "../scripts/check-socialflow-production-safety-gate";
import * as configModule from "../scripts/check-socialflow-nonprod-canary-config";
import * as postdeployModule from "../scripts/smoke-socialflow-nonprod-canary-postdeploy";
import * as parityModule from "../scripts/check-socialflow-nonprod-ownership-parity";

const createConfigMock = (overrides = {}) => ({
  configPath: "apps/socialflow-runtime/wrangler.toml",
  workerName: "test-worker",
  bindings: [
    { binding: "DRACO_DB", databaseName: "drako_db_socialflow_canary", databaseId: "test-id" },
    { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "test-id" },
    { binding: "SAASES_DB", databaseName: "saas_socialflows_registry_canary_db", databaseId: "test-id" },
    { binding: "SOCIALFLOW_AUTHS_DB", databaseName: "saas_socialflow_auths_canary_db", databaseId: "test-id" },
  ],
  switches: {
    SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
    SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
    SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
    SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
    SOCIALFLOW_RUNTIME_TARGET: "canary-nonprod",
  },
  placeholders: [],
  deployable: true,
  allowDeployWithRealD1: true,
  status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
  ...overrides,
});

const createPostdeployMock = (overrides = {}) => ({
  ok: true,
  status: "OK",
  timestamp: new Date().toISOString(),
  healthUrl: "test",
  readinessUrl: "test",
  healthChecked: true,
  readinessChecked: true,
  dnsBlocked: false,
  productionTouched: false,
  tokenLeakageDetected: false,
  rollbackCommands: [],
  nextAction: "OK",
  ...overrides,
});

const createParityMock = (overrides = {}) => ({
  ok: true,
  status: "PARITY_OK",
  exitCode: 0,
  sourceDbName: "test",
  sourceDbId: "test",
  targetDbName: "test",
  targetDbId: "test",
  readOnly: true,
  remoteWrites: 0,
  oauthExcluded: true,
  skippedOAuth: [],
  totals: { matched: 6, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
  groups: {} as any,
  warnings: [],
  ...overrides,
});

describe("check-socialflow-production-safety-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes with healthy canary configuration", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());
    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());
    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_SAFETY_GATE_OK");
    expect(report.blockers).toHaveLength(0);
    expect(report.checks.productionNotTouched).toBe(true);
    expect(report.checks.remoteWritesZero).toBe(true);
    expect(report.checks.tokenLeakageNotDetected).toBe(true);
    expect(report.checks.noProductionDbsInCanaryConfig).toBe(true);
    expect(report.checks.gateProtectionActive).toBe(true);
    expect(report.checks.parityOk).toBe(true);
    expect(report.checks.allSwitchesOn).toBe(true);
    expect(report.checks.deployable).toBe(true);
    expect(report.checks.canaryTargetConfirmed).toBe(true);
    expect(report.checks.productionTargetNotEnabled).toBe(true);
  });

  it("fails if productionTouched is true", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock({ productionTouched: true }));

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_SAFETY_GATE_PRODUCTION_TOUCH_BLOCKER");
    expect(report.blockers).toContain("PRODUCTION_TOUCH_BLOCKER");
    expect(report.findings.productionTouched).toBe(true);
  });

  it("fails if remoteWrites is greater than 0", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock({ remoteWrites: 5 }));

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_SAFETY_GATE_REMOTE_WRITE_BLOCKER");
    expect(report.blockers).toContain("REMOTE_WRITE_BLOCKER");
    expect(report.findings.remoteWrites).toBe(5);
  });

  it("fails if token leakage is detected", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock({ tokenLeakageDetected: true }));

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_SAFETY_GATE_TOKEN_LEAKAGE_BLOCKER");
    expect(report.blockers).toContain("TOKEN_LEAKAGE_BLOCKER");
    expect(report.findings.tokenLeakageDetected).toBe(true);
  });

  it("fails if production DB appears in canary config", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock({
      bindings: [
        { binding: "DRACO_DB", databaseName: "drako_db_prod", databaseId: "test-id" },
        { binding: "SOCIAL_DB", databaseName: "saas_socialflows_canary_db", databaseId: "test-id" },
        { binding: "SAASES_DB", databaseName: "saas_socialflows_registry_canary_db", databaseId: "test-id" },
        { binding: "SOCIALFLOW_AUTHS_DB", databaseName: "saas_socialflow_auths_canary_db", databaseId: "test-id" },
      ],
    }));

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain("PRODUCTION_DB_IN_CANARY_CONFIG_BLOCKER");
    expect(report.findings.productionDbsFound).toContain("DRACO_DB");
  });

  it("fails if any switch is OFF", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock({
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
        SOCIALFLOW_RUNTIME_TARGET: "canary-nonprod",
      },
    }));

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain("SWITCHES_OFF_BLOCKER");
    expect(report.findings.switchesOff).toBe(1);
  });

  it("fails if deployable is false", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock({
      deployable: false,
    }));

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate();

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain("DEPLOYABLE_FALSE_BLOCKER");
    expect(report.findings.deployableFalse).toBe(true);
  });

  it("generates valid JSON output", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue(createPostdeployMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionSafetyGate({ json: true });

    expect(report).toHaveProperty("ok");
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("checks");
    expect(report).toHaveProperty("blockers");
    expect(report).toHaveProperty("recommendation");
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("does not print secrets or tokens", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "apps/socialflow-runtime/wrangler.toml",
      workerName: "test-worker",
      bindings: [],
      switches: {},
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      healthUrl: "test",
      readinessUrl: "test",
      healthChecked: true,
      readinessChecked: true,
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue({
      ok: true,
      status: "PARITY_OK",
      exitCode: 0,
      sourceDbName: "test",
      sourceDbId: "test",
      targetDbName: "test",
      targetDbId: "test",
      readOnly: true,
      remoteWrites: 0,
      oauthExcluded: true,
      skippedOAuth: [],
      totals: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
      groups: {} as any,
      warnings: [],
    });

    const report = await checkProductionSafetyGate();
    const reportStr = JSON.stringify(report);

    // Detect real secret values (key=value patterns), not safe phrases
    expect(reportStr).not.toMatch(/access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(reportStr).not.toMatch(/refresh_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(reportStr).not.toMatch(/encrypted_access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(reportStr).not.toMatch(/SOCIALFLOW_CANARY_GATE_TOKEN\s*[:=]\s*[a-zA-Z0-9_-]{20,}/);
    expect(reportStr).not.toMatch(/password\s*[:=]\s*[a-zA-Z0-9_-]{10,}/);
    expect(reportStr).not.toMatch(/secret\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]/); 
  });
});
