import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const legacyServicePath = path.join(repoRoot, "src/lib/campobase/clinic-platform-service.ts");
const testFilePath = path.join(repoRoot, "tests/lib/campobase-clinic-platform-service.test.ts");

function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["'`]([^"'`]+)["'`]/g,
    /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort();
}

describe("campobase clinic legacy adapter static verification", () => {
  it("keeps the frozen legacy clinic adapter file present", () => {
    expect(existsSync(legacyServicePath)).toBe(true);
  });

  it("keeps expected static legacy adapter markers without runtime execution assertions", () => {
    const source = readFileSync(legacyServicePath, "utf8");

    const requiredMarkers = [
      "export const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY",
      "clinic.daily_appointment_health",
      "registerAutomationHandler(",
      "registerClinicPlatform(",
      "ensureWhatsappIntegrationAvailable",
      "getIntegrationConnection",
      "connectIntegration",
      "resolveAppointmentsContext",
      "listAppointmentsForSaas",
      "listWhatsappIdentities",
      "automation-core",
      "integration-core",
      "Clinic appointment health",
      "CONNECTED",
      "PENDING",
    ];

    for (const marker of requiredMarkers) {
      expect(source).toContain(marker);
    }
  });

  it("does not import runtime from frozen campobase namespace", () => {
    const source = readFileSync(testFilePath, "utf8");
    const imports = extractImportSpecifiers(source);
    const legacyPrefix = ["@/lib", "campobase"].join("/");
    const legacyImports = imports.filter((specifier) => specifier.startsWith(legacyPrefix));

    expect(legacyImports).toEqual([]);
  });
});
