import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("smoke-socialflow-nonprod-canary-gated-health", () => {
  const scriptPath = join(process.cwd(), "scripts", "smoke-socialflow-nonprod-canary-gated-health.ts");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("script exists and is executable", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("exports smokeSocialflowNonprodCanaryGatedHealth function", async () => {
    const module = await import("../scripts/smoke-socialflow-nonprod-canary-gated-health");
    expect(typeof module.smokeSocialflowNonprodCanaryGatedHealth).toBe("function");
  });

  it("fails with MISSING_GATE_SECRET when SOCIALFLOW_CANARY_GATE_TOKEN not set", async () => {
    const originalEnv = process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET");
    expect(report.gateSecretAvailable).toBe(false);
    expect(report.errors).toContain("MISSING_GATE_SECRET");
    expect(report.nextAction).toBe("SET_SOCIALFLOW_CANARY_GATE_TOKEN_AND_RETRY");

    if (originalEnv) {
      process.env.SOCIALFLOW_CANARY_GATE_TOKEN = originalEnv;
    }
  });

  it("does not print gate secret in any output", async () => {
    const mockSecret = "test-secret-token-12345";
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = mockSecret;

    const consoleLogSpy = vi.spyOn(console, "log");
    const consoleErrorSpy = vi.spyOn(console, "error");

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ healthy: true }),
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    await smokeSocialflowNonprodCanaryGatedHealth();

    const allLogs = [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]
      .map((call) => call.join(" "))
      .join("\n");

    expect(allLogs).not.toContain(mockSecret);
    expect(allLogs).toContain("secret provided, not printed");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("sends correct gate header without exposing value", async () => {
    const mockSecret = "valid-gate-token";
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = mockSecret;

    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ healthy: true }),
    });
    global.fetch = fetchSpy;

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    await smokeSocialflowNonprodCanaryGatedHealth();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/socialflow/runtime/health"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-socialflow-canary-gate": mockSecret,
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/socialflow/runtime/readiness"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-socialflow-canary-gate": mockSecret,
        }),
      }),
    );

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("passes with HEALTH_OK_WITH_GATE when both endpoints return 200", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "valid-token";

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ healthy: true, ready: true }),
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_CANARY_GATED_HEALTH_OK");
    expect(report.healthResult).toBe("HEALTH_OK_WITH_GATE");
    expect(report.readinessResult).toBe("READINESS_OK_WITH_GATE");
    expect(report.healthStatus).toBe(200);
    expect(report.readinessStatus).toBe(200);
    expect(report.tokenLeakageDetected).toBe(false);
    expect(report.productionTouched).toBe(false);
    expect(report.nextAction).toBe("MONITOR_CANARY_HEALTH_GATED_ENDPOINTS_OPERATIONAL");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("fails with UNAUTHORIZED when gate header is rejected (403)", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "invalid-token";

    global.fetch = vi.fn().mockResolvedValue({
      status: 403,
      text: async () => JSON.stringify({ ok: false, error: "SOCIALFLOW_CANARY_GATE_DENIED" }),
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_CANARY_GATED_HEALTH_UNAUTHORIZED");
    expect(report.healthResult).toBe("HEALTH_GATE_REJECTED_403");
    expect(report.readinessResult).toBe("READINESS_GATE_REJECTED_403");
    expect(report.nextAction).toBe("VERIFY_GATE_TOKEN_CORRECTNESS");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("detects token leakage in health response", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "valid-token";

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/health")) {
        return Promise.resolve({
          status: 200,
          text: async () => JSON.stringify({ access_token: "leaked-token-12345" }),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () => JSON.stringify({ ready: true }),
      });
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.ok).toBe(false);
    expect(report.tokenLeakageDetected).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_CANARY_GATED_HEALTH_TOKEN_LEAKAGE_BLOCKER");
    expect(report.errors).toContain("TOKEN_LEAKAGE_DETECTED_IN_HEALTH");
    expect(report.nextAction).toBe("ROLLBACK_IMMEDIATELY_TOKEN_LEAKAGE");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("detects token leakage in readiness response", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "valid-token";

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/readiness")) {
        return Promise.resolve({
          status: 200,
          text: async () => JSON.stringify({ refresh_token: "leaked-refresh-12345" }),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () => JSON.stringify({ healthy: true }),
      });
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.ok).toBe(false);
    expect(report.tokenLeakageDetected).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_CANARY_GATED_HEALTH_TOKEN_LEAKAGE_BLOCKER");
    expect(report.errors).toContain("TOKEN_LEAKAGE_DETECTED_IN_READINESS");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("generates valid JSON output", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "valid-token";

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ healthy: true }),
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth({ json: true });

    expect(() => JSON.stringify(report)).not.toThrow();
    expect(report).toHaveProperty("ok");
    expect(report).toHaveProperty("status");
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("healthUrl");
    expect(report).toHaveProperty("readinessUrl");
    expect(report).toHaveProperty("productionTouched");
    expect(report).toHaveProperty("tokenLeakageDetected");
    expect(report).toHaveProperty("gateSecretAvailable");

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("confirms productionTouched is always false", async () => {
    process.env.SOCIALFLOW_CANARY_GATE_TOKEN = "valid-token";

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ healthy: true }),
    });

    const { smokeSocialflowNonprodCanaryGatedHealth } = await import(
      "../scripts/smoke-socialflow-nonprod-canary-gated-health"
    );

    const report = await smokeSocialflowNonprodCanaryGatedHealth();

    expect(report.productionTouched).toBe(false);

    delete process.env.SOCIALFLOW_CANARY_GATE_TOKEN;
  });

  it("validates expected URLs", () => {
    const expectedUrls = [
      "https://socialflow-canary.drako.systems/api/socialflow/runtime/health",
      "https://socialflow-canary.drako.systems/api/socialflow/runtime/readiness",
    ];
    expect(expectedUrls.length).toBe(2);
    expect(expectedUrls[0]).toContain("/api/socialflow/runtime/health");
    expect(expectedUrls[1]).toContain("/api/socialflow/runtime/readiness");
    expect(expectedUrls[0]).toContain("socialflow-canary.drako.systems");
    expect(expectedUrls[1]).toContain("socialflow-canary.drako.systems");
  });

  it("validates no production URLs in script", () => {
    const productionUrls = [
      "socialflow.drako.systems",
      "https://drako.systems/socialflow",
      "socialflow-prod.",
    ];

    const scriptContent = existsSync(scriptPath)
      ? require("node:fs").readFileSync(scriptPath, "utf-8")
      : "";

    for (const prodUrl of productionUrls) {
      expect(scriptContent).not.toContain(prodUrl);
    }

    expect(scriptContent).toContain("socialflow-canary.drako.systems");
  });

  it("validates rollback commands structure", () => {
    const expectedRollback = [
      'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
      'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
      "Re-deploy with rollback config",
    ];
    expect(expectedRollback.length).toBe(3);
  });
});
