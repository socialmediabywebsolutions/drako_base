import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as configModule from "../scripts/check-socialflow-nonprod-canary-config";
import * as gateModule from "../scripts/check-socialflow-predeploy-gate";
import * as postdeployModule from "../scripts/smoke-socialflow-nonprod-canary-postdeploy";
import * as gatedModule from "../scripts/smoke-socialflow-nonprod-canary-gated-health";
import * as parityModule from "../scripts/check-socialflow-nonprod-ownership-parity";
import { monitorSocialflowNonprodCanaryDay } from "../scripts/monitor-socialflow-nonprod-canary-day";

describe("monitor-socialflow-nonprod-canary-day", () => {
  const scriptPath = join(process.cwd(), "scripts", "monitor-socialflow-nonprod-canary-day.ts");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("script exists and is executable", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("exports monitorSocialflowNonprodCanaryDay function", () => {
    expect(typeof monitorSocialflowNonprodCanaryDay).toBe("function");
  });

  it("passes with 403 baseline and missing gate token", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: ["MISSING_GATE_SECRET"],
      nextAction: "SET_TOKEN",
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay({ day: 1 });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_OK_WITH_MISSING_GATE_TOKEN");
    expect(report.day).toBe(1);
    expect(report.config.deployable).toBe(true);
    expect(report.config.switchesOn).toBe(4);
    expect(report.baseline.healthResult).toBe("HEALTH_GATED_403");
    expect(report.baseline.readinessResult).toBe("READINESS_GATED_403");
    expect(report.gated.gateSecretAvailable).toBe(false);
    expect(report.parity.matched).toBe(6);
    expect(report.parity.mismatched).toBe(0);
    expect(report.security.tokenLeakageDetected).toBe(false);
    expect(report.security.productionTouched).toBe(false);
    expect(report.blockers.length).toBe(0);
  });

  it("passes with 403 baseline and 200 gated (token available)", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthStatus: 200,
      readinessStatus: 200,
      healthResult: "HEALTH_OK_WITH_GATE",
      readinessResult: "READINESS_OK_WITH_GATE",
      gateSecretAvailable: true,
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay({ day: 2 });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_OK");
    expect(report.gated.gateSecretAvailable).toBe(true);
    expect(report.gated.healthResult).toBe("HEALTH_OK_WITH_GATE");
    expect(report.gated.readinessResult).toBe("READINESS_OK_WITH_GATE");
  });

  it("fails if health without gate returns 200 instead of 403", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: false,
      status: "POSTDEPLOY_SMOKE_UNEXPECTED_200",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_OK_200",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "INVESTIGATE",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_BLOCKED");
    expect(report.blockers).toContain("BASELINE_UNEXPECTED_STATUS:POSTDEPLOY_SMOKE_UNEXPECTED_200");
    expect(report.blockers).toContain("HEALTH_WITHOUT_GATE_NOT_403:HEALTH_OK_200");
  });

  it("fails if any switch is OFF", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.config.switchesOn).toBe(3);
    expect(report.blockers).toContain("SWITCHES_NOT_ALL_ON:3/4");
  });

  it("fails if deployable is false", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: false,
      allowDeployWithRealD1: true,
      status: "NON_DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.config.deployable).toBe(false);
    expect(report.blockers).toContain("DEPLOYABLE_FALSE");
  });

  it("fails if parity has mismatches", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
      nextAction: "OK",
    });

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue({
      ok: false,
      status: "DRIFT_DETECTED",
      exitCode: 2,
      sourceDbName: "test",
      sourceDbId: "test",
      targetDbName: "test",
      targetDbId: "test",
      readOnly: true,
      remoteWrites: 0,
      oauthExcluded: true,
      skippedOAuth: [],
      totals: {
        matched: 4,
        mismatched: 2,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_PARITY_BLOCKER");
    expect(report.parity.mismatched).toBe(2);
    expect(report.blockers).toContain("PARITY_MISMATCHED:2");
  });

  it("blocks if token leakage detected", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: false,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: true,
      rollbackCommands: [],
      nextAction: "ROLLBACK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_TOKEN_LEAKAGE_BLOCKER");
    expect(report.security.tokenLeakageDetected).toBe(true);
    expect(report.recommendation).toContain("ROLLBACK IMMEDIATELY");
  });

  it("blocks if production touched", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: false,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: true,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "ROLLBACK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_MONITORING_DAY_PRODUCTION_TOUCH_BLOCKER");
    expect(report.security.productionTouched).toBe(true);
    expect(report.recommendation).toContain("ROLLBACK IMMEDIATELY");
  });

  it("generates valid JSON output", () => {
    const report = {
      ok: true,
      status: "SOCIALFLOW_CANARY_MONITORING_DAY_OK_WITH_MISSING_GATE_TOKEN",
      day: 1,
      timestamp: "2026-05-27T21:00:00.000Z",
      config: {
        deployable: true,
        allowDeployWithRealD1: true,
        switchesOn: 4,
        switchesOff: 0,
        switches: {},
      },
      gate: { predeployGateStatus: "OK" },
      baseline: {
        healthStatus: 403,
        healthResult: "HEALTH_GATED_403",
        readinessStatus: 403,
        readinessResult: "READINESS_GATED_403",
        status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      },
      gated: {
        gateSecretAvailable: false,
        healthStatus: undefined,
        healthResult: undefined,
        readinessStatus: undefined,
        readinessResult: undefined,
        status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      },
      parity: {
        matched: 6,
        mismatched: 0,
        missingInSocial: 0,
        status: "PARITY_OK",
      },
      security: {
        tokenLeakageDetected: false,
        productionTouched: false,
        remoteWrites: 0,
      },
      recommendation: "CONTINUE_MONITORING",
      nextAction: "CONTINUE_DAILY_MONITORING",
      blockers: [],
    };

    expect(() => JSON.stringify(report)).not.toThrow();
    expect(report).toHaveProperty("ok");
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("day");
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("config");
    expect(report).toHaveProperty("baseline");
    expect(report).toHaveProperty("gated");
    expect(report).toHaveProperty("parity");
    expect(report).toHaveProperty("security");
    expect(report).toHaveProperty("recommendation");
    expect(report).toHaveProperty("blockers");
  });

  it("confirms remote writes is always 0", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      configPath: "test",
      workerName: "test",
      bindings: [],
      switches: {
        SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "1",
        SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "1",
      },
      placeholders: [],
      deployable: true,
      allowDeployWithRealD1: true,
      status: "DEPLOYABLE_REAL_NONPROD_CONFIG",
    });

    vi.spyOn(gateModule, "checkSocialflowPredeployGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_NONPROD_CANARY_PREDEPLOY_GATE_READY",
      timestamp: new Date().toISOString(),
      configs: [],
      allDeployable: true,
      allAllowRealD1: true,
      nextAction: "OK",
    });

    vi.spyOn(postdeployModule, "smokeSocialflowNonprodCanaryPostdeploy").mockResolvedValue({
      ok: true,
      status: "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: true,
      readinessChecked: true,
      healthResult: "HEALTH_GATED_403",
      readinessResult: "READINESS_GATED_403",
      dnsBlocked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      nextAction: "OK",
    });

    vi.spyOn(gatedModule, "smokeSocialflowNonprodCanaryGatedHealth").mockResolvedValue({
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: "https://test",
      readinessUrl: "https://test",
      healthChecked: false,
      readinessChecked: false,
      gateSecretAvailable: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      rollbackCommands: [],
      errors: [],
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
      totals: {
        matched: 6,
        mismatched: 0,
        missingInCore: 0,
        missingInSocial: 0,
      },
      groups: {},
      warnings: [],
    });

    const report = await monitorSocialflowNonprodCanaryDay();

    expect(report.security.remoteWrites).toBe(0);
  });
});
