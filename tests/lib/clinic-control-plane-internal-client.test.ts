import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

import {
  buildClinicAppointmentHealthAuditResult,
  ensureClinicControlPlaneIntegration,
  fetchClinicControlPlaneHealth,
  getClinicControlPlaneAutomationRegistration,
  registerClinicControlPlaneAutomation,
  triggerClinicAppointmentHealthAudit,
  ClinicControlPlaneClientError,
  type ClinicAppointmentHealthAuditRequest,
  type ClinicAppointmentHealthAuditResult,
  type ClinicControlPlaneAutomationRegistration,
  type ClinicControlPlaneHealthSnapshot,
  type ClinicControlPlaneIntegrationState,
  type ClinicControlPlaneStatus,
} from "@/lib/capabilities/internal-api-clients/clinic-control-plane";

const clientPath = "src/lib/capabilities/internal-api-clients/clinic-control-plane.ts";
const testPath = "tests/lib/clinic-control-plane-internal-client.test.ts";

describe("clinic control-plane internal client", () => {
  it("does not import from the frozen campobase namespace", () => {
    const clientSource = readFileSync(clientPath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(clientSource).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from "${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import("${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);
  });

  it("exports the expected neutral types and functions", async () => {
    const status: ClinicControlPlaneStatus = "pending";
    const health: ClinicControlPlaneHealthSnapshot = {
      tenantId: "tenant_clinic",
      saasId: "clinic",
      status,
      generatedAt: "2024-01-01T00:00:00.000Z",
      checks: [],
    };
    const integration: ClinicControlPlaneIntegrationState = {
      tenantId: "tenant_clinic",
      saasId: "clinic",
      integrationKey: "whatsapp",
      status: "MISSING",
      hasPrimaryWhatsappIdentity: false,
    };
    const request: ClinicAppointmentHealthAuditRequest = {
      tenantId: "tenant_clinic",
      saasId: "clinic",
      requestedBy: "test",
    };
    const result: ClinicAppointmentHealthAuditResult = buildClinicAppointmentHealthAuditResult(request, {
      upcomingAppointments: 0,
      unconfirmedAppointments: 0,
      overdueFollowups: 0,
    });

    expect(health.status).toBe("pending");
    expect(integration.integrationKey).toBe("whatsapp");
    expect(result.ok).toBe(true);
    expect(fetchClinicControlPlaneHealth).toBeTypeOf("function");
    expect(getClinicControlPlaneAutomationRegistration).toBeTypeOf("function");
    expect(registerClinicControlPlaneAutomation).toBeTypeOf("function");
    expect(ensureClinicControlPlaneIntegration).toBeTypeOf("function");
    expect(triggerClinicAppointmentHealthAudit).toBeTypeOf("function");
  });

  it("registers the neutral Clinic appointment health automation", async () => {
    const input: ClinicControlPlaneAutomationRegistration = {
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationKey: "clinic.daily_appointment_health",
      displayName: "Clinic daily appointment health",
      enabled: true,
      scheduleMode: "scheduled",
      config: {
        lookaheadDays: 0,
        overdueFollowupHours: 0,
      },
    };

    const registration = await registerClinicControlPlaneAutomation(input);

    expect(registration).toMatchObject({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      automationKey: "clinic.daily_appointment_health",
      enabled: true,
      scheduleMode: "scheduled",
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    });
  });

  it("overwrites the neutral automation registration without duplicating state", async () => {
    await registerClinicControlPlaneAutomation({
      tenantId: "tenant_overwrite",
      saasId: "clinic",
      automationKey: "clinic.daily_appointment_health",
      displayName: "Clinic daily appointment health",
      enabled: true,
      scheduleMode: "scheduled",
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    });

    const updated = await registerClinicControlPlaneAutomation({
      tenantId: "tenant_overwrite",
      saasId: "clinic",
      automationKey: "clinic.daily_appointment_health",
      displayName: "Clinic appointment health override",
      enabled: false,
      scheduleMode: "manual",
      config: {
        lookaheadDays: 14,
        overdueFollowupHours: 48,
      },
    });
    const stored = await getClinicControlPlaneAutomationRegistration("tenant_overwrite", "clinic");

    expect(updated).toMatchObject({
      displayName: "Clinic appointment health override",
      enabled: false,
      scheduleMode: "manual",
      config: {
        lookaheadDays: 14,
        overdueFollowupHours: 48,
      },
    });
    expect(stored).toEqual(updated);
  });

  it("represents WhatsApp integration states and primary identity presence", async () => {
    const pending = await ensureClinicControlPlaneIntegration("tenant_clinic", "clinic", {
      hasPrimaryWhatsappIdentity: false,
    });
    const connected = await ensureClinicControlPlaneIntegration("tenant_clinic", "clinic", {
      status: "CONNECTED",
      hasPrimaryWhatsappIdentity: true,
    });
    const missing = await ensureClinicControlPlaneIntegration("tenant_clinic_missing", "clinic", {
      status: "MISSING",
      hasPrimaryWhatsappIdentity: false,
    });

    expect(pending).toMatchObject({
      integrationKey: "whatsapp",
      status: "PENDING",
      hasPrimaryWhatsappIdentity: false,
    });
    expect(connected).toMatchObject({
      integrationKey: "whatsapp",
      status: "CONNECTED",
      hasPrimaryWhatsappIdentity: true,
    });
    expect(missing).toMatchObject({
      integrationKey: "whatsapp",
      status: "MISSING",
      hasPrimaryWhatsappIdentity: false,
    });
  });

  it("builds and fetches a neutral health snapshot with appointment metrics", async () => {
    const result = buildClinicAppointmentHealthAuditResult(
      {
        tenantId: "tenant_health",
        saasId: "clinic",
        requestedBy: "test",
      },
      {
        upcomingAppointments: 3,
        unconfirmedAppointments: 2,
        overdueFollowups: 1,
      },
    );

    const health = await fetchClinicControlPlaneHealth("tenant_health", "clinic");

    expect(result.metrics).toEqual({
      upcomingAppointments: 3,
      unconfirmedAppointments: 2,
      overdueFollowups: 1,
    });
    expect(result.summary).toContain("3 upcoming");
    expect(result.summary).toContain("2 unconfirmed");
    expect(result.summary).toContain("1 overdue followups");
    expect(result.output).toEqual({
      lookaheadDays: 7,
      overdueFollowupHours: 24,
    });
    expect(health).toMatchObject({
      tenantId: "tenant_health",
      saasId: "clinic",
      status: "healthy",
      appointmentHealth: {
        upcomingAppointments: 3,
        unconfirmedAppointments: 2,
        overdueFollowups: 1,
      },
    });
  });

  it("fails explicitly when audit execution is requested without a neutral backend", async () => {
    await expect(triggerClinicAppointmentHealthAudit({
      tenantId: "tenant_clinic",
      saasId: "clinic",
      requestedBy: "test",
    })).rejects.toMatchObject({
      name: "ClinicControlPlaneClientError",
      code: "CLINIC_CONTROL_PLANE_NOT_CONFIGURED",
    } satisfies Partial<ClinicControlPlaneClientError>);
  });

  it("does not create new files with campobase in the filename", () => {
    for (const filePath of [clientPath, testPath]) {
      expect(basename(filePath).toLowerCase()).not.toContain("campobase");
    }
  });
});
