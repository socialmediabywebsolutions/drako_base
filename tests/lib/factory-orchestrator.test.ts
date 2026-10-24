import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("factory orchestrator legacy adapter static verification", () => {
  const legacyPrefix = ["@/lib", "campobase"].join("/") + "/";

  it("does not import frozen campobase namespace in this test file", () => {
    const testSource = readFileSync(
      "tests/lib/factory-orchestrator.test.ts",
      "utf8",
    );

    expect(testSource).not.toContain(legacyPrefix);
  });

  it("keeps legacy adapter with canonical SocialFlow and legacy Clinic/TaskOps imports", () => {
    const adapterSource = readFileSync(
      "src/lib/campobase/platform-bootstrap.ts",
      "utf8",
    );

    expect(adapterSource).toContain("@/lib/campamento-base/socialflow-platform");
    expect(adapterSource).toContain("@/lib/clinic/platform-wrapper");
    expect(adapterSource).toContain(legacyPrefix + "taskops-platform");
  });

  it("keeps legacy adapter with loadPlatformForSaas export and platform registration logic", () => {
    const adapterSource = readFileSync(
      "src/lib/campobase/platform-bootstrap.ts",
      "utf8",
    );

    expect(adapterSource).toContain("export async function loadPlatformForSaas");
    expect(adapterSource).toContain("registerSocialFlowPlatform");
    expect(adapterSource).toContain("registerClinicPlatform");
    expect(adapterSource).toContain("registerTaskOpsPlatform");
    expect(adapterSource).toContain("ensureDefaultPlatformDefinitionsRegistered");
  });

  it("keeps legacy adapter with saas-contract integration signals", () => {
    const adapterSource = readFileSync(
      "src/lib/campobase/platform-bootstrap.ts",
      "utf8",
    );

    expect(adapterSource).toContain("@/lib/saas-contract");
    expect(adapterSource).toContain("getSaasPlatformBootstrapByKey");
    expect(adapterSource).toContain("getSaasPlatformDefinitionByKey");
    expect(adapterSource).toContain("registerSaasPlatformDefinition");
    expect(adapterSource).toContain("registerSaasPlatformBootstrap");
    expect(adapterSource).toContain("resolveSaasPlatform");
  });

  it("keeps legacy adapter with platform-specific bootstrap and connect logic", () => {
    const adapterSource = readFileSync(
      "src/lib/campobase/platform-bootstrap.ts",
      "utf8",
    );

    expect(adapterSource).toContain("socialFlowPlatformDefinition");
    expect(adapterSource).toContain("socialFlowPlatformBootstrap");
    expect(adapterSource).toContain("clinicPlatformDefinition");
    expect(adapterSource).toContain("clinicPlatformBootstrap");
    expect(adapterSource).toContain("taskOpsPlatformDefinition");
    expect(adapterSource).toContain("taskOpsPlatformBootstrap");
    expect(adapterSource).toContain("bootstrap?.connect");
  });
});
