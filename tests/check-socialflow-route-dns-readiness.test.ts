import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRouteDnsReadiness } from "../scripts/check-socialflow-route-dns-readiness";
import * as configModule from "../scripts/check-socialflow-nonprod-canary-config";

describe("check-socialflow-route-dns-readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates canary routes are correct", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness();

    expect(report.ok).toBe(true);
    expect(report.status).toBe("CANARY_ROUTE_READY");
    expect(report.canaryRoutes.canaryHostKnown).toBe(true);
    expect(report.canaryRoutes.canaryHost).toBe("socialflow-canary.drako.systems");
    expect(report.canaryRoutes.healthRoute).toBe("/api/socialflow/runtime/health");
    expect(report.canaryRoutes.readinessRoute).toBe("/api/socialflow/runtime/readiness");
    expect(report.canaryRoutes.healthRouteCorrect).toBe(true);
    expect(report.canaryRoutes.readinessRouteCorrect).toBe(true);
    expect(report.canaryRoutes.gateProtected).toBe(true);
  });

  it("uses correct health endpoint (not legacy /health)", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness();

    expect(report.canaryRoutes.healthRoute).not.toBe("/health");
    expect(report.canaryRoutes.healthRoute).not.toBe("/api/socialflow/status");
    expect(report.canaryRoutes.healthRoute).toBe("/api/socialflow/runtime/health");
  });

  it("uses correct readiness endpoint (not legacy /readiness)", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness();

    expect(report.canaryRoutes.readinessRoute).not.toBe("/readiness");
    expect(report.canaryRoutes.readinessRoute).toBe("/api/socialflow/runtime/readiness");
  });

  it("confirms production route not ready by design", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness();

    expect(report.productionRoutes.productionHostNotReady).toBe(true);
    expect(report.productionRoutes.notReadyByDesign).toBe(true);
    expect(report.productionRoutes.productionHostValue).toBeNull();
  });

  it("generates valid JSON output", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness({ json: true });

    expect(report).toHaveProperty("ok");
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("canaryRoutes");
    expect(report).toHaveProperty("productionRoutes");
    expect(report).toHaveProperty("blockers");
    expect(report).toHaveProperty("recommendation");
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("has no blockers with correct setup", async () => {
    vi.spyOn(configModule, "checkSocialflowNonprodCanaryConfig").mockReturnValue({
      deployable: true,
      allowDeployWithRealD1: true,
      target: "canary-nonprod",
      switchesOn: 4,
      switchesOff: 0,
      switches: {} as any,
      databases: {} as any,
    });

    const report = await checkRouteDnsReadiness();

    expect(report.blockers).toHaveLength(0);
  });
});
