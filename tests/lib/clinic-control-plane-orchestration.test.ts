import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { planClinicControlPlaneBootstrap } from "@/lib/clinic/control-plane-orchestration";

const orchestrationPath = "src/lib/clinic/control-plane-orchestration.ts";
const testPath = "tests/lib/clinic-control-plane-orchestration.test.ts";

describe("clinic control-plane orchestration", () => {
  it("plans automation registration and pending WhatsApp integration when nothing exists", () => {
    const plan = planClinicControlPlaneBootstrap({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: false,
      whatsappProviderAvailable: true,
      whatsappIntegrationExists: false,
      hasPrimaryWhatsappIdentity: false,
    });

    expect(plan).toMatchObject({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationKey: "clinic.daily_appointment_health",
      shouldRegisterAutomation: true,
      shouldEnsureWhatsappProvider: true,
      shouldCreateWhatsappIntegration: true,
      integrationStatus: "PENDING",
      hasPrimaryWhatsappIdentity: false,
    });
    expect(plan.summary).toContain("registerAutomation=yes");
    expect(plan.summary).toContain("integrationStatus=PENDING");
  });

  it("plans connected integration when primary WhatsApp identity exists", () => {
    const plan = planClinicControlPlaneBootstrap({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: true,
      whatsappProviderAvailable: true,
      whatsappIntegrationExists: true,
      hasPrimaryWhatsappIdentity: true,
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: false,
      shouldEnsureWhatsappProvider: true,
      shouldCreateWhatsappIntegration: false,
      integrationStatus: "CONNECTED",
      hasPrimaryWhatsappIdentity: true,
    });
  });

  it("returns missing status when WhatsApp provider is unavailable", () => {
    const plan = planClinicControlPlaneBootstrap({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: false,
      whatsappProviderAvailable: false,
      whatsappIntegrationExists: false,
      hasPrimaryWhatsappIdentity: true,
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: true,
      shouldEnsureWhatsappProvider: true,
      shouldCreateWhatsappIntegration: false,
      integrationStatus: "MISSING",
      hasPrimaryWhatsappIdentity: true,
    });
  });

  it("uses safe defaults when optional fields are omitted", () => {
    const plan = planClinicControlPlaneBootstrap({
      tenantId: "tenant_default",
      saasId: "clinic",
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: true,
      shouldEnsureWhatsappProvider: true,
      shouldCreateWhatsappIntegration: true,
      integrationStatus: "PENDING",
      hasPrimaryWhatsappIdentity: false,
    });
  });

  it("fails when tenantId or saasId is blank", () => {
    expect(() => planClinicControlPlaneBootstrap({
      tenantId: "",
      saasId: "clinic",
    })).toThrow("Clinic bootstrap plan requires tenantId and saasId.");

    expect(() => planClinicControlPlaneBootstrap({
      tenantId: "tenant",
      saasId: "  ",
    })).toThrow("Clinic bootstrap plan requires tenantId and saasId.");
  });

  it("does not import frozen campobase namespace or create campobase-named files", () => {
    const orchestrationSource = readFileSync(orchestrationPath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(orchestrationSource).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from "${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import("${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);

    expect(basename(orchestrationPath).toLowerCase()).not.toContain("campobase");
    expect(basename(testPath).toLowerCase()).not.toContain("campobase");
  });
});
