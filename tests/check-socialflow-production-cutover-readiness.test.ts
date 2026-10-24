import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkProductionCutoverReadiness } from "../scripts/check-socialflow-production-cutover-readiness";
import * as safetyGateModule from "../scripts/check-socialflow-production-safety-gate";
import * as routeDnsModule from "../scripts/check-socialflow-route-dns-readiness";
import * as configModule from "../scripts/check-socialflow-nonprod-canary-config";
import * as parityModule from "../scripts/check-socialflow-nonprod-ownership-parity";

const createConfigMock = () => ({
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
});

const createParityMock = (exitCode = 0) => ({
  ok: exitCode === 0,
  status: exitCode === 0 ? "PARITY_OK" : "PARITY_FAILED",
  exitCode,
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
});

describe("check-socialflow-production-cutover-readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is ready for planning after 3 stable days", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: true,
      status: "SOCIALFLOW_PRODUCTION_SAFETY_GATE_OK",
      timestamp: new Date().toISOString(),
      checks: {
        productionNotTouched: true,
        remoteWritesZero: true,
        tokenLeakageNotDetected: true,
        noProductionDbsInCanaryConfig: true,
        gateProtectionActive: true,
        parityOk: true,
        allSwitchesOn: true,
        deployable: true,
        canaryTargetConfirmed: true,
        productionTargetNotEnabled: true,
      },
      findings: {},
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "CANARY_ROUTE_READY",
      timestamp: new Date().toISOString(),
      canaryRoutes: {
        canaryHostKnown: true,
        canaryHost: "socialflow-canary.drako.systems",
        healthRoute: "/api/socialflow/runtime/health",
        readinessRoute: "/api/socialflow/runtime/readiness",
        healthRouteCorrect: true,
        readinessRouteCorrect: true,
        gateProtected: true,
      },
      productionRoutes: {
        productionHostNotReady: true,
        productionHostValue: null,
        notReadyByDesign: true,
      },
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(true);
    expect(report.readyForExecution).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_CUTOVER_READY_FOR_PLANNING");
    expect(report.monitoring.minimumMonitoringReached).toBe(true);
    expect(report.monitoring.daysCompleted).toBe(3);
    expect(report.blockedBy).toContain("STAKEHOLDER_APPROVAL_REQUIRED");
    expect(report.blockedBy).toContain("PRODUCTION_DEPLOY_WINDOW_REQUIRED");
    expect(report.blockedBy).toContain("ON_CALL_REQUIRED");
  });

  it("is not ready for execution without approval", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {},
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForExecution).toBe(false);
    expect(report.blockedBy).toContain("STAKEHOLDER_APPROVAL_REQUIRED");
  });

  it("blocks if parity fails", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {},
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock(1));

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("PARITY_FAILED");
  });

  it("blocks if route checker fails", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {},
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: false,
      status: "ROUTING_BLOCKER",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: ["ROUTING_ISSUE"],
      recommendation: "BLOCKED",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("ROUTE_DNS_NOT_READY");
  });

  it("blocks if safety gate fails", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: false,
      status: "BLOCKED",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {},
      blockers: ["SAFETY_ISSUE"],
      recommendation: "BLOCKED",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("SAFETY_GATE_BLOCKED");
  });

  it("blocks if token leakage detected", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: false,
      status: "TOKEN_LEAKAGE",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {
        tokenLeakageDetected: true,
      },
      blockers: ["TOKEN_LEAKAGE"],
      recommendation: "BLOCKED",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("TOKEN_LEAKAGE_DETECTED");
    expect(report.blockedBy).toContain("SAFETY_GATE_BLOCKED");
  });

  it("blocks if productionTouched is true", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: false,
      status: "PRODUCTION_TOUCHED",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {
        productionTouched: true,
      },
      blockers: ["PRODUCTION_TOUCHED"],
      recommendation: "BLOCKED",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("PRODUCTION_TOUCHED");
    expect(report.blockedBy).toContain("SAFETY_GATE_BLOCKED");
  });

  it("blocks if remoteWrites > 0", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: false,
      status: "REMOTE_WRITES",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {
        remoteWrites: 3,
      },
      blockers: ["REMOTE_WRITES"],
      recommendation: "BLOCKED",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness();

    expect(report.readyForPlanning).toBe(false);
    expect(report.blockedBy).toContain("REMOTE_WRITES_DETECTED");
    expect(report.blockedBy).toContain("SAFETY_GATE_BLOCKED");
  });

  it("generates valid JSON output", async () => {
    vi.spyOn(safetyGateModule, "checkProductionSafetyGate").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      checks: {} as any,
      findings: {},
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(routeDnsModule, "checkRouteDnsReadiness").mockResolvedValue({
      ok: true,
      status: "OK",
      timestamp: new Date().toISOString(),
      canaryRoutes: {} as any,
      productionRoutes: {} as any,
      blockers: [],
      recommendation: "OK",
    });

    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue(createConfigMock());

    vi.spyOn(parityModule, "runCheckSocialflowNonprodOwnershipParity").mockResolvedValue(createParityMock());

    const report = await checkProductionCutoverReadiness({ json: true });

    expect(report).toHaveProperty("readyForPlanning");
    expect(report).toHaveProperty("readyForExecution");
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("monitoring");
    expect(report).toHaveProperty("configuration");
    expect(report).toHaveProperty("gates");
    expect(report).toHaveProperty("security");
    expect(report).toHaveProperty("blockedBy");
    expect(() => JSON.stringify(report)).not.toThrow();
  });
});
