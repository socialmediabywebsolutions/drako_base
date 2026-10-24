import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const contractPath = "docs/contracts/clinic-control-plane-internal-client-contract-v1.md";
const testPath = "tests/lib/clinic-control-plane-internal-client-contract.test.ts";

function readContract(): string {
  return readFileSync(contractPath, "utf8");
}

describe("clinic control-plane internal client contract", () => {
  it("keeps the contract document available", () => {
    expect(existsSync(contractPath)).toBe(true);
  });

  it("declares Clinic ownership and Campamento Base orchestration boundaries", () => {
    const source = readContract();

    expect(source).toContain("Clinic es SaaS vertical independiente");
    expect(source).toContain("Campamento Base es orquestador/control-plane");
    expect(source).toContain("Legacy campobase queda como adapter temporal");
  });

  it("proposes a neutral internal client boundary", () => {
    const source = readContract();

    expect(source).toContain("src/lib/capabilities/internal-api-clients/clinic-control-plane.ts");
    expect(source).toContain("frontera neutral");
    expect(source).toContain("fetchClinicControlPlaneHealth");
    expect(source).toContain("registerClinicControlPlaneAutomation");
    expect(source).toContain("ensureClinicControlPlaneIntegration");
    expect(source).toContain("triggerClinicAppointmentHealthAudit");
  });

  it("does not propose moving Clinic product logic into Campamento Base platform code", () => {
    const source = readContract();

    expect(source).toContain("No crear `src/lib/campamento-base/clinic-platform.ts`");
    expect(source).toContain("mover logica Clinic a Campamento Base");
  });

  it("mentions the minimum capabilities required before legacy test migration", () => {
    const source = readContract();

    expect(source).toContain("appointment health");
    expect(source).toContain("automation registration");
    expect(source).toContain("WhatsApp integration bootstrap");
    expect(source).toContain("primary WhatsApp identity");
  });

  it("does not create a new file with campobase in the filename", () => {
    for (const filePath of [contractPath, testPath]) {
      expect(basename(filePath).toLowerCase()).not.toContain("campobase");
    }
  });

  it("does not add an import toward the frozen campobase namespace", () => {
    const source = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(`from "${legacyPrefix}`);
    expect(source).not.toContain(`from '${legacyPrefix}`);
    expect(source).not.toContain(`import("${legacyPrefix}`);
    expect(source).not.toContain(`import('${legacyPrefix}`);
  });
});
