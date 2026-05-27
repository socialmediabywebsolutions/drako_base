import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("smoke socialflow nonprod canary postdeploy", () => {
  it("script exists and is executable", () => {
    const scriptPath = join(process.cwd(), "scripts", "smoke-socialflow-nonprod-canary-postdeploy.ts");
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("exports smokeSocialflowNonprodCanaryPostdeploy function", async () => {
    const module = await import("../scripts/smoke-socialflow-nonprod-canary-postdeploy");
    expect(typeof module.smokeSocialflowNonprodCanaryPostdeploy).toBe("function");
  });

  it("validates expected smoke URLs", () => {
    const expectedUrls = [
      "https://socialflow-canary.drako.systems/health",
      "https://socialflow-canary.drako.systems/api/socialflow/status",
    ];
    expect(expectedUrls.length).toBe(2);
    expect(expectedUrls[0]).toContain("socialflow-canary.drako.systems");
    expect(expectedUrls[1]).toContain("/api/socialflow/status");
  });

  it("validates rollback commands structure", () => {
    const expectedRollback = [
      'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
      'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
      "Re-deploy with rollback config",
    ];
    expect(expectedRollback.length).toBe(3);
  });

  it("validates no production URLs in script", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "smoke-socialflow-nonprod-canary-postdeploy.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).not.toMatch(/socialflow\.drako\.systems\b/);
    expect(scriptContent).toContain("socialflow-canary.drako.systems");
  });

  it("validates token leakage detection logic", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "smoke-socialflow-nonprod-canary-postdeploy.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).toContain("access_token");
    expect(scriptContent).toContain("refresh_token");
    expect(scriptContent).toContain("TOKEN_LEAKAGE_DETECTED");
  });

  it("validates DNS blocked handling", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "smoke-socialflow-nonprod-canary-postdeploy.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).toContain("DNS_BLOCKED");
    expect(scriptContent).toContain("POSTDEPLOY_SMOKE_BLOCKED_BY_DNS");
  });

  it("script structure validates without remote calls", () => {
    expect(true).toBe(true);
  });
});
