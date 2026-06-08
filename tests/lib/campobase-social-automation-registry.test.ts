import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("campobase social automation registry adapter", () => {
  const adapterPath = "src/lib/campobase/social-automation-registry.ts";

  it("keeps the legacy adapter file available", () => {
    expect(existsSync(adapterPath)).toBe(true);
  });

  it("delegates to the canonical campamento-base registry module", () => {
    const source = readFileSync(adapterPath, "utf8");

    expect(source).toContain("@/lib/campamento-base/social-automation-registry");
    expect(source).toContain("temporary compatibility adapter");
  });

  it("keeps legacy public names available for compatibility", () => {
    const source = readFileSync(adapterPath, "utf8");

    expect(source).toContain("CampoBaseSocialAutomationRegistryItem");
    expect(source).toContain("UpsertCampoBaseSocialAutomationRegistryInput");
    expect(source).toContain("upsertCampoBaseSocialAutomationRegistry");
    expect(source).toContain("getCampoBaseSocialAutomationRegistryItem");
    expect(source).toContain("listCampoBaseSocialAutomationRegistryItems");
    expect(source).toContain("listEnabledCampoBaseSocialAutomationRegistryItems");
    expect(source).toContain("setCampoBaseSocialAutomationEnabled");
    expect(source).toContain("removeCampoBaseSocialAutomationRegistryItem");
  });

  it("does not keep legacy D1 registry implementation as source of truth", () => {
    const source = readFileSync(adapterPath, "utf8");

    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("getDb");
    expect(source).not.toContain("campobase_social_automation_registry");
    expect(source).not.toContain("CREATE TABLE");
    expect(source).not.toContain("DELETE FROM");
  });

  it("does not import runtime from the frozen campobase namespace", () => {
    const testSource = readFileSync(
      "tests/lib/campobase-social-automation-registry.test.ts",
      "utf8",
    );
    const legacyImportPrefix = ["@/lib", "campobase"].join("/");

    expect(testSource).not.toContain(`${legacyImportPrefix}/`);
  });
});
