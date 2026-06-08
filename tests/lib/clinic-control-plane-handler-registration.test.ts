import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

import {
  planClinicControlPlaneHandlerRegistration,
  type ClinicControlPlaneExpectedEffect,
} from "@/lib/clinic/control-plane-handler-registration";

const helperPath = "src/lib/clinic/control-plane-handler-registration.ts";
const testPath = "tests/lib/clinic-control-plane-handler-registration.test.ts";

describe("clinic control-plane handler registration", () => {
  it("models full runtime parity effects when automation and handler are missing", () => {
    const plan = planClinicControlPlaneHandlerRegistration({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: false,
      handlerRegistered: false,
      whatsappProviderAvailable: true,
      whatsappIntegrationExists: false,
      hasPrimaryWhatsappIdentity: false,
    });

    expect(plan).toMatchObject({
      automationKey: "clinic.daily_appointment_health",
      shouldRegisterAutomation: true,
      shouldRegisterHandler: true,
      integrationStatus: "PENDING",
    });

    expect(plan.expectedEffects).toEqual([
      "REGISTER_AUTOMATION_HANDLER",
      "ENSURE_WHATSAPP_PROVIDER",
      "REGISTER_AUTOMATION",
      "CREATE_WHATSAPP_INTEGRATION",
    ] satisfies ClinicControlPlaneExpectedEffect[]);
  });

  it("avoids repeated registration effects when handler, automation and integration already exist", () => {
    const plan = planClinicControlPlaneHandlerRegistration({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: true,
      handlerRegistered: true,
      whatsappProviderAvailable: true,
      whatsappIntegrationExists: true,
      hasPrimaryWhatsappIdentity: true,
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: false,
      shouldRegisterHandler: false,
      integrationStatus: "CONNECTED",
    });

    expect(plan.expectedEffects).toEqual([
      "ENSURE_WHATSAPP_PROVIDER",
    ] satisfies ClinicControlPlaneExpectedEffect[]);
  });

  it("keeps provider effect but marks integration as missing when provider is unavailable", () => {
    const plan = planClinicControlPlaneHandlerRegistration({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationExists: true,
      handlerRegistered: false,
      whatsappProviderAvailable: false,
      whatsappIntegrationExists: false,
      hasPrimaryWhatsappIdentity: true,
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: false,
      shouldRegisterHandler: true,
      integrationStatus: "MISSING",
    });

    expect(plan.expectedEffects).toEqual([
      "REGISTER_AUTOMATION_HANDLER",
      "ENSURE_WHATSAPP_PROVIDER",
    ] satisfies ClinicControlPlaneExpectedEffect[]);
  });

  it("uses safe defaults for omitted optional flags", () => {
    const plan = planClinicControlPlaneHandlerRegistration({
      tenantId: "tenant_default",
      saasId: "clinic",
    });

    expect(plan).toMatchObject({
      shouldRegisterAutomation: true,
      shouldRegisterHandler: true,
      integrationStatus: "PENDING",
    });

    expect(plan.expectedEffects).toEqual([
      "REGISTER_AUTOMATION_HANDLER",
      "ENSURE_WHATSAPP_PROVIDER",
      "REGISTER_AUTOMATION",
      "CREATE_WHATSAPP_INTEGRATION",
    ] satisfies ClinicControlPlaneExpectedEffect[]);
  });

  it("fails when tenantId or saasId is blank", () => {
    expect(() => planClinicControlPlaneHandlerRegistration({
      tenantId: "",
      saasId: "clinic",
    })).toThrow("Clinic handler registration plan requires tenantId and saasId.");

    expect(() => planClinicControlPlaneHandlerRegistration({
      tenantId: "tenant",
      saasId: "  ",
    })).toThrow("Clinic handler registration plan requires tenantId and saasId.");
  });

  it("does not import frozen campobase namespace and uses non-campobase filenames", () => {
    const helperSource = readFileSync(helperPath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(helperSource).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from "${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import("${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);

    expect(basename(helperPath).toLowerCase()).not.toContain("campobase");
    expect(basename(testPath).toLowerCase()).not.toContain("campobase");
  });
});
