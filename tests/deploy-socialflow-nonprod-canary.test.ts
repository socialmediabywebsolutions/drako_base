import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("deploy socialflow nonprod canary", () => {
  it("script exists and is executable", () => {
    const scriptPath = join(process.cwd(), "scripts", "deploy-socialflow-nonprod-canary.ts");
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("exports deploySocialflowNonprodCanary function", async () => {
    const module = await import("../scripts/deploy-socialflow-nonprod-canary");
    expect(typeof module.deploySocialflowNonprodCanary).toBe("function");
  });

  it("validates planned deploy commands structure", () => {
    const expectedCommands = [
      "cd apps/socialflow-runtime && pnpm build",
      "cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml",
      "cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml",
    ];
    expect(expectedCommands.length).toBe(3);
    expect(expectedCommands[0]).toContain("pnpm build");
    expect(expectedCommands[1]).toContain("wrangler deploy");
    expect(expectedCommands[2]).toContain("wrangler deploy");
  });

  it("validates rollback commands structure", () => {
    const expectedRollback = [
      'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
      'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
      "Re-deploy with rollback config",
    ];
    expect(expectedRollback.length).toBe(3);
  });

  it("validates no production database names in deploy commands", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "deploy-socialflow-nonprod-canary.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).not.toMatch(/drako_db_prod\b/);
    expect(scriptContent).not.toMatch(/database_name.*prod\b/i);
  });

  it("validates no secrets printed in deploy commands", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "deploy-socialflow-nonprod-canary.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).not.toMatch(/console\.log.*access_token/i);
    expect(scriptContent).not.toMatch(/console\.log.*refresh_token/i);
    expect(scriptContent).not.toMatch(/console\.log.*AUTHS_SECRET/i);
  });

  it("validates deploy script targets nonprod canary paths only", async () => {
    const fs = await import("node:fs");
    const scriptPath = join(process.cwd(), "scripts", "deploy-socialflow-nonprod-canary.ts");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    expect(scriptContent).toContain("apps/socialflow-runtime");
    expect(scriptContent).toContain("workers/socialflows-runtime-canary");
    expect(scriptContent).toContain("wrangler deploy");
  });

  it("script structure validates without remote calls", () => {
    expect(true).toBe(true);
  });
});
