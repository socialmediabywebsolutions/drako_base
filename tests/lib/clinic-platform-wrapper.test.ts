import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

import {
  CLINIC_PLATFORM_SAAS_ID,
  clinicPlatformBootstrap,
  clinicPlatformDefinition,
} from "@/lib/clinic/platform-wrapper";
import { getClinicControlPlaneAutomationRegistration } from "@/lib/capabilities/internal-api-clients/clinic-control-plane";

const wrapperPath = "src/lib/clinic/platform-wrapper.ts";
const testPath = "tests/lib/clinic-platform-wrapper.test.ts";

describe("clinic platform wrapper", () => {
  it("exists and does not import frozen campobase namespace", () => {
    const source = readFileSync(wrapperPath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from \"${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import(\"${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);

    expect(source).not.toContain("taskops");
    expect(source).not.toContain("socialflow");

    expect(basename(wrapperPath).toLowerCase()).not.toContain("campobase");
    expect(basename(testPath).toLowerCase()).not.toContain("campobase");
  });

  it("exports clinicPlatformDefinition with expected clinic metadata and keys", () => {
    expect(CLINIC_PLATFORM_SAAS_ID).toBe("clinic");
    expect(clinicPlatformDefinition).toMatchObject({
      saasId: "clinic",
      displayName: "Clinic",
      category: "operations",
      supportsOperatorSurface: true,
      automations: [
        expect.objectContaining({
          automationKey: "clinic.daily_appointment_health",
          displayName: "Clinic daily appointment health",
          enabledByDefault: true,
        }),
      ],
      integrations: [
        expect.objectContaining({
          integrationKey: "whatsapp",
          required: false,
        }),
      ],
    });

    expect(clinicPlatformDefinition.matchesSaasId?.("clinic")).toBe(true);
    expect(clinicPlatformDefinition.matchesSaasId?.("tenant_clinic_alpha")).toBe(true);
    expect(clinicPlatformDefinition.matchesSaasId?.("socialflow")).toBe(false);
  });

  it("exports clinicPlatformBootstrap and connects deterministically through neutral clinic service", async () => {
    const tenantId = "tenant_clinic_wrapper_alpha";
    const saasId = "clinic";

    expect(clinicPlatformBootstrap.saasId).toBe("clinic");

    await clinicPlatformBootstrap.connect({ tenantId, saasId });
    await clinicPlatformBootstrap.connect({ tenantId, saasId });

    const registration = await getClinicControlPlaneAutomationRegistration(tenantId, saasId);
    expect(registration).toMatchObject({
      tenantId,
      saasId,
      automationKey: "clinic.daily_appointment_health",
    });
  });
});
