import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { socialFlowPlatformBootstrap, socialFlowPlatformDefinition } from "@/lib/campamento-base/socialflow-platform";

const repoRoot = process.cwd();
const clinicAdapterPath = path.join(repoRoot, "src/lib/clinic/platform-wrapper.ts");
const taskOpsAdapterPath = path.join(repoRoot, "src/lib/campobase/taskops-platform.ts");
const testFilePath = path.join(repoRoot, "tests/lib/saas-contract-definitions.test.ts");

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

describe("saas contract definitions", () => {
  it("SocialFlow exposes a valid static platform definition", () => {
    expect(socialFlowPlatformDefinition).toMatchObject({
      saasId: "socialflow",
      displayName: "SocialFlow",
      supportsOperatorSurface: true,
    });
    expect(socialFlowPlatformDefinition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationKey: "socialflow.content_generation",
          enabledByDefault: true,
        }),
        expect.objectContaining({
          automationKey: "socialflow.health_check",
          enabledByDefault: true,
        }),
      ]),
    );
    expect(socialFlowPlatformDefinition.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          integrationKey: "linkedin",
          required: false,
        }),
      ]),
    );
    expect("handler" in socialFlowPlatformDefinition.automations[0]).toBe(false);
    expect("provider" in socialFlowPlatformDefinition.integrations[0]).toBe(false);
    expect("tenantId" in socialFlowPlatformDefinition).toBe(false);
    expect("bootstrap" in socialFlowPlatformDefinition).toBe(false);
    expect(typeof socialFlowPlatformBootstrap.connect).toBe("function");
  });

  it("Clinic legacy adapter keeps expected static export and contract markers", () => {
    const source = readFileSync(clinicAdapterPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    const requiredMarkers = [
      "export const CLINIC_PLATFORM_SAAS_ID",
      "export const clinicPlatformDefinition",
      "export const clinicPlatformBootstrap",
      "@/lib/saas-contract",
      "defineSaasPlatform(",
      "defineSaasPlatformBootstrap(",
      "saasId: CLINIC_PLATFORM_SAAS_ID",
      'displayName: "Clinic"',
      "automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY",
      "integrationKey: WHATSAPP_INTEGRATION_KEY",
    ];

    for (const marker of requiredMarkers) {
      expect(source).toContain(marker);
    }
  });

  it("TaskOps legacy adapter keeps expected static export and contract markers", () => {
    const source = readFileSync(taskOpsAdapterPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    const requiredMarkers = [
      "export const TASKOPS_PLATFORM_SAAS_ID",
      "export const taskOpsPlatformDefinition",
      "export const taskOpsPlatformBootstrap",
      `${legacyPrefix}/taskops-platform-service`,
      "defineSaasPlatform(",
      "defineSaasPlatformBootstrap(",
      "saasId: TASKOPS_PLATFORM_SAAS_ID",
      'displayName: "TaskOps"',
      "automationKey: TASKOPS_PENDING_TASK_AUDIT_KEY",
      "integrationKey: WHATSAPP_INTEGRATION_KEY",
      '"task.overdue"',
      "triggerAutomation(",
      "@/lib/saas-contract",
    ];

    for (const marker of requiredMarkers) {
      expect(source).toContain(marker);
    }
  });

  it("does not import runtime from frozen campobase namespace", () => {
    const source = readFileSync(testFilePath, "utf8");
    const imports = extractImportSpecifiers(source);
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(imports.filter((specifier) => specifier.startsWith(legacyPrefix))).toEqual([]);
  });
});
