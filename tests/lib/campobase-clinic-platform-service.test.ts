import { beforeEach, describe, expect, it, vi } from "vitest";

const capturedHandlers = vi.hoisted(() => new Map<string, Function>());
const registerAutomation = vi.hoisted(() => vi.fn());
const getAutomation = vi.hoisted(() => vi.fn());
const registerAutomationHandler = vi.hoisted(() => vi.fn((automationKey: string, handler: Function) => {
  capturedHandlers.set(automationKey, handler);
}));
const getIntegrationConnection = vi.hoisted(() => vi.fn());
const connectIntegration = vi.hoisted(() => vi.fn());
const ensureWhatsappIntegrationAvailable = vi.hoisted(() => vi.fn());
const resolveClinicContext = vi.hoisted(() => vi.fn());
const resolveAppointmentsContext = vi.hoisted(() => vi.fn());
const listAppointmentsForSaas = vi.hoisted(() => vi.fn());
const resolveWhatsappContext = vi.hoisted(() => vi.fn());
const listWhatsappIdentities = vi.hoisted(() => vi.fn());

vi.mock("@/lib/automation-core", () => ({
  getAutomation,
  registerAutomation,
  registerAutomationHandler,
}));

vi.mock("@/lib/integration-core", () => ({
  getIntegrationConnection,
  connectIntegration,
}));

vi.mock("@/lib/integration-core/providers/whatsapp", () => ({
  WHATSAPP_INTEGRATION_KEY: "whatsapp",
  ensureWhatsappIntegrationAvailable,
}));

vi.mock("@/lib/clinic/context", () => ({
  resolveClinicContext,
}));

vi.mock("@/lib/appointments/repository", () => ({
  resolveAppointmentsContext,
  listAppointmentsForSaas,
}));

vi.mock("@/lib/whatsapp/repository", () => ({
  resolveWhatsappContext,
  listWhatsappIdentities,
}));

describe("clinic platform service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandlers.clear();
    vi.resetModules();

    registerAutomationHandler.mockImplementation((automationKey: string, handler: Function) => {
      capturedHandlers.set(automationKey, handler);
    });

    resolveClinicContext.mockResolvedValue({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      clientId: "client_1",
      mode: "demo",
      allowDemoFallback: true,
    });
    resolveAppointmentsContext.mockResolvedValue({ tenantId: "tenant_clinic", saasId: "saas_clinic", mode: "demo" });
    resolveWhatsappContext.mockResolvedValue({ tenantId: "tenant_clinic", saasId: "saas_clinic", mode: "demo" });
    getAutomation.mockResolvedValue(null);
    getIntegrationConnection.mockResolvedValue(null);
    listWhatsappIdentities.mockResolvedValue([]);
  });

  it("registers clinic platform automation and whatsapp connection", async () => {
    const { CLINIC_DAILY_APPOINTMENT_HEALTH_KEY, registerClinicPlatform } = await import("@/lib/campobase/clinic-platform-service");

    await registerClinicPlatform("tenant_clinic", "saas_clinic");

    expect(ensureWhatsappIntegrationAvailable).toHaveBeenCalledTimes(1);
    expect(registerAutomation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
      displayName: "Clinic daily appointment health",
    }));
    expect(connectIntegration).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      status: "PENDING",
    }));
  });

  it("computes clinic appointment health metrics through the automation handler", async () => {
    listAppointmentsForSaas.mockResolvedValue([
      {
        id: "appt_upcoming_confirmed",
        scheduledStart: "2099-01-10T10:00:00.000Z",
        status: "CONFIRMED",
      },
      {
        id: "appt_upcoming_pending",
        scheduledStart: "2099-01-10T12:00:00.000Z",
        status: "PENDING",
      },
      {
        id: "appt_upcoming_requested",
        scheduledStart: "2099-01-11T09:00:00.000Z",
        status: "REQUESTED",
      },
      {
        id: "appt_overdue_requested",
        scheduledStart: "2024-01-01T09:00:00.000Z",
        status: "REQUESTED",
      },
      {
        id: "appt_done",
        scheduledStart: "2099-01-12T09:00:00.000Z",
        status: "DONE",
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-10T08:00:00.000Z"));

    const { CLINIC_DAILY_APPOINTMENT_HEALTH_KEY } = await import("@/lib/campobase/clinic-platform-service");
    const handler = capturedHandlers.get(CLINIC_DAILY_APPOINTMENT_HEALTH_KEY);

    expect(handler).toBeTypeOf("function");

    const result = await handler({
      executionId: "execution_1",
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
      triggerType: "manual",
    });

    expect(resolveAppointmentsContext).toHaveBeenCalledWith({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
    });
    expect(result).toMatchObject({
      ok: true,
      metrics: {
        upcomingAppointments: 3,
        unconfirmedAppointments: 2,
        overdueFollowups: 1,
      },
    });
    expect(result.summary).toContain("3 upcoming");
    expect(result.output?.summary).toContain("2 unconfirmed");

    vi.useRealTimers();
  });
});
