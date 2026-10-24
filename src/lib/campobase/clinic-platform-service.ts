import {
  getAutomation,
  registerAutomation,
  registerAutomationHandler,
  type AutomationExecutionResult,
} from "@/lib/automation-core";
import { connectIntegration, getIntegrationConnection } from "@/lib/integration-core";
import { ensureWhatsappIntegrationAvailable, WHATSAPP_INTEGRATION_KEY } from "@/lib/integration-core/providers/whatsapp";
import { resolveClinicContext } from "@/lib/clinic/context";
import { listAppointmentsForSaas, resolveAppointmentsContext } from "@/lib/appointments/repository";
import { listWhatsappIdentities, resolveWhatsappContext } from "@/lib/whatsapp/repository";

export const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health";

type ClinicAutomationConfig = {
  lookaheadDays?: number;
  overdueFollowupHours?: number;
};

function normalizeClinicAutomationConfig(config: Record<string, unknown> | null): Required<ClinicAutomationConfig> {
  const lookaheadDays = typeof config?.lookaheadDays === "number" && config.lookaheadDays > 0
    ? Math.floor(config.lookaheadDays)
    : 7;
  const overdueFollowupHours = typeof config?.overdueFollowupHours === "number" && config.overdueFollowupHours > 0
    ? Math.floor(config.overdueFollowupHours)
    : 24;

  return { lookaheadDays, overdueFollowupHours };
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

registerAutomationHandler(CLINIC_DAILY_APPOINTMENT_HEALTH_KEY, async ({ tenantId, saasId, config }) => {
  const normalized = normalizeClinicAutomationConfig(config as Record<string, unknown> | null);
  const now = new Date();
  const lookaheadEnd = addDays(now, normalized.lookaheadDays);
  const overdueCutoff = new Date(now.getTime() - normalized.overdueFollowupHours * 60 * 60 * 1000);
  const appointmentsCtx = await resolveAppointmentsContext({ tenantId, saasId });
  const appointments = await listAppointmentsForSaas(appointmentsCtx, {
    from: overdueCutoff.toISOString(),
    to: lookaheadEnd.toISOString(),
  });

  const upcomingAppointments = appointments.filter((appointment) => {
    const scheduledAt = Date.parse(appointment.scheduledStart);
    return !Number.isNaN(scheduledAt)
      && scheduledAt >= now.getTime()
      && appointment.status !== "CANCELLED"
      && appointment.status !== "NO_SHOW"
      && appointment.status !== "DONE";
  }).length;

  const unconfirmedAppointments = appointments.filter((appointment) => {
    const scheduledAt = Date.parse(appointment.scheduledStart);
    return !Number.isNaN(scheduledAt)
      && scheduledAt >= now.getTime()
      && (appointment.status === "REQUESTED" || appointment.status === "PENDING");
  }).length;

  const overdueFollowups = appointments.filter((appointment) => {
    const scheduledAt = Date.parse(appointment.scheduledStart);
    return !Number.isNaN(scheduledAt)
      && scheduledAt < now.getTime()
      && scheduledAt <= overdueCutoff.getTime()
      && (appointment.status === "REQUESTED" || appointment.status === "PENDING");
  }).length;

  const summary = `Clinic appointment health: ${upcomingAppointments} upcoming, ${unconfirmedAppointments} unconfirmed, ${overdueFollowups} overdue followups.`;

  const result: AutomationExecutionResult = {
    ok: true,
    summary,
    metrics: {
      upcomingAppointments,
      unconfirmedAppointments,
      overdueFollowups,
    },
    output: {
      summary,
      lookaheadDays: normalized.lookaheadDays,
      overdueFollowupHours: normalized.overdueFollowupHours,
    },
  };

  return result;
});

export async function registerClinicPlatform(tenantId: string, saasId: string): Promise<void> {
  const clinicCtx = await resolveClinicContext(tenantId, saasId);
  await ensureWhatsappIntegrationAvailable();

  const existingAutomation = await getAutomation(clinicCtx.tenantId, clinicCtx.saasId, CLINIC_DAILY_APPOINTMENT_HEALTH_KEY);
  if (!existingAutomation) {
    await registerAutomation({
      tenantId: clinicCtx.tenantId,
      saasId: clinicCtx.saasId,
      automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
      displayName: "Clinic daily appointment health",
      description: "Audits upcoming appointments, unconfirmed bookings and overdue followups.",
      enabled: true,
      scheduleMode: "scheduled",
      frequencyUnit: "day",
      frequencyValue: 1,
      config: {
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
      ownerScope: "OWNER",
    });
  }

  const existingIntegration = await getIntegrationConnection(clinicCtx.tenantId, clinicCtx.saasId, WHATSAPP_INTEGRATION_KEY);
  if (!existingIntegration) {
    const whatsappCtx = await resolveWhatsappContext({ tenantId: clinicCtx.tenantId, saasId: clinicCtx.saasId });
    const identities = await listWhatsappIdentities(whatsappCtx);
    const primaryIdentity = identities[0] ?? null;

    await connectIntegration({
      tenantId: clinicCtx.tenantId,
      saasId: clinicCtx.saasId,
      integrationKey: WHATSAPP_INTEGRATION_KEY,
      connectionLabel: "Clinic WhatsApp",
      status: primaryIdentity ? "CONNECTED" : "PENDING",
      metadata: {
        platform: "clinic",
        bootstrap: "platform",
      },
      credentials: primaryIdentity
        ? {
            phoneNumber: primaryIdentity.phoneNumber,
            actorType: primaryIdentity.actorType,
            actorId: primaryIdentity.actorId,
          }
        : {
            phoneNumber: "",
          },
    });
  }
}
