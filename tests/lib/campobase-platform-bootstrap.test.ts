import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  listPlatformBootstrapDefinitions,
  runPlatformBootstrap,
  validatePlatformBootstrapRegistry,
} from "@/lib/campamento-base/platform-bootstrap-loader";

describe("platform bootstrap contract", () => {
  const bootstrapPath = join(process.cwd(), "src", "lib", "campobase", "platform-bootstrap.ts");
  const legacyPrefix = ["@/lib", "campobase"].join("/") + "/";
  const canonicalPrefix = ["@/lib", "campamento-base"].join("/") + "/";

  it("exposes neutral loader definitions for SocialFlow, Clinic and TaskOps", () => {
    const definitions = listPlatformBootstrapDefinitions();

    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ saasId: "socialflow", status: "READY" }),
        expect.objectContaining({ saasId: "clinic", status: "SKIPPED" }),
        expect.objectContaining({ saasId: "taskops", status: "SKIPPED" }),
      ]),
    );
  });

  it("runs neutral bootstrap status smoke for SocialFlow, Clinic and TaskOps", async () => {
    const socialflowResult = await runPlatformBootstrap("socialflow");
    const clinicResult = await runPlatformBootstrap("clinic");
    const taskopsResult = await runPlatformBootstrap("taskops");

    expect(socialflowResult.status).toBe("READY");
    expect(clinicResult.status).toBe("SKIPPED");
    expect(taskopsResult.status).toBe("SKIPPED");
  });

  it("keeps neutral registry validation deterministic", () => {
    const firstPass = validatePlatformBootstrapRegistry();
    const secondPass = validatePlatformBootstrapRegistry();

    expect(firstPass).toEqual(secondPass);
    expect(firstPass).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ saasId: "socialflow", status: "READY", success: true }),
        expect.objectContaining({ saasId: "clinic", status: "SKIPPED", success: true }),
        expect.objectContaining({ saasId: "taskops", status: "SKIPPED", success: true }),
      ]),
    );
  });

  it("keeps static legacy adapter signals for canonical SocialFlow and legacy Clinic/TaskOps", () => {
    expect(existsSync(bootstrapPath)).toBe(true);
    const source = readFileSync(bootstrapPath, "utf8");

    expect(source).toContain(`import("${canonicalPrefix}socialflow-platform")`);
    expect(source).toContain(`import("${legacyPrefix}clinic-platform")`);
    expect(source).toContain(`import("${legacyPrefix}taskops-platform")`);

    expect(source).toContain("socialflow-platform");
    expect(source).toContain("clinic-platform");
    expect(source).toContain("taskops-platform");
    expect(source.includes(`${legacyPrefix}socialflow-platform`)).toBe(false);
  });

  it("keeps static legacy adapter registration and public export signals", () => {
    const source = readFileSync(bootstrapPath, "utf8");

    expect(source).toContain('from "@/lib/saas-contract"');
    expect(source).toContain("registerSaasPlatformDefinition(");
    expect(source).toContain("registerSaasPlatformBootstrap(");
    expect(source).toContain("resolveSaasPlatform(");

    expect(source).toContain("export async function registerSocialFlowPlatform");
    expect(source).toContain("export async function registerClinicPlatform");
    expect(source).toContain("export async function registerTaskOpsPlatform");
    expect(source).toContain("export async function loadPlatformForSaas");
  });
});
