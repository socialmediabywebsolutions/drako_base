import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

import {
  CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
  registerClinicPlatform,
  resolveClinicServiceHandlerOutput,
} from "@/lib/clinic/service";
import {
  getClinicControlPlaneAutomationRegistration,
  fetchClinicControlPlaneHealth,
} from "@/lib/capabilities/internal-api-clients/clinic-control-plane";

const servicePath = "src/lib/clinic/service.ts";
const testPath = "tests/lib/clinic-service.test.ts";

describe("clinic service", () => {
  it("exists, uses neutral modules, and avoids frozen campobase imports", () => {
    const source = readFileSync(servicePath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from \"${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import(\"${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);

    expect(source).toContain("@/lib/clinic/control-plane-orchestration");
    expect(source).toContain("@/lib/clinic/control-plane-handler-registration");
    expect(source).toContain("@/lib/clinic/control-plane-context-resolution");
    expect(source).toContain("@/lib/capabilities/internal-api-clients/clinic-control-plane");

    expect(source).not.toContain("@/lib/automation-core");
    expect(source).not.toContain("@/lib/integration-core");
    expect(source).not.toContain("@/lib/db");

    expect(basename(servicePath).toLowerCase()).not.toContain("campobase");
    expect(basename(testPath).toLowerCase()).not.toContain("campobase");
  });

  it("registers clinic control-plane automation and integration deterministically", async () => {
    const tenantId = "tenant_clinic_service_alpha";
    const saasId = "clinic";

    const result = await registerClinicPlatform(tenantId, saasId, {
      automationExists: false,
      handlerRegistered: false,
      whatsappProviderAvailable: true,
      whatsappIntegrationExists: false,
      hasPrimaryWhatsappIdentity: false,
    });

    expect(CLINIC_DAILY_APPOINTMENT_HEALTH_KEY).toBe("clinic.daily_appointment_health");
    expect(result).toMatchObject({
      tenantId,
      saasId,
      bootstrapPlan: {
        automationKey: "clinic.daily_appointment_health",
        shouldRegisterAutomation: true,
        shouldEnsureWhatsappProvider: true,
        shouldCreateWhatsappIntegration: true,
        integrationStatus: "PENDING",
      },
      handlerRegistrationPlan: {
        automationKey: "clinic.daily_appointment_health",
        shouldRegisterAutomation: true,
        shouldRegisterHandler: true,
      },
      integrationState: {
        tenantId,
        saasId,
        integrationKey: "whatsapp",
        status: "PENDING",
      },
    });

    const registration = await getClinicControlPlaneAutomationRegistration(tenantId, saasId);
    expect(registration).toMatchObject({
      tenantId,
      saasId,
      automationKey: "clinic.daily_appointment_health",
      scheduleMode: "scheduled",
      enabled: true,
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    });

    const health = await fetchClinicControlPlaneHealth(tenantId, saasId);
    expect(health.status).toBe("pending");
  });

  it("returns deterministic handler output from neutral context resolution", () => {
    const input = {
      tenantId: "tenant_clinic_service_beta",
      saasId: "clinic",
      appointments: [
        {
          id: "appt_1",
          status: "PENDING",
          scheduledAt: "2099-01-10T11:00:00.000Z",
        },
      ],
      config: {
        now: "2099-01-10T08:00:00.000Z",
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    } as const;

    const first = resolveClinicServiceHandlerOutput(input);
    const second = resolveClinicServiceHandlerOutput(input);

    expect(first).toEqual(second);
    expect(first.summary).toBe("Clinic appointment health: 1 upcoming, 1 unconfirmed, 0 overdue followups.");
    expect(first.output).toEqual({
      upcomingAppointments: 1,
      unconfirmedAppointments: 1,
      overdueFollowups: 0,
      lookaheadDays: 7,
      overdueFollowupHours: 24,
    });
  });
});
