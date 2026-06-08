import {
  calculateClinicAppointmentHealth,
  type ClinicAppointmentHealthAppointment,
  type ClinicAppointmentHealthConfig,
  type ClinicAppointmentHealthResult,
} from "@/lib/clinic/appointment-health";

export type ClinicControlPlaneContextResolutionInput = {
  tenantId: string;
  saasId: string;
  appointments: ClinicAppointmentHealthAppointment[];
  config?: ClinicAppointmentHealthConfig;
};

export type ClinicControlPlaneResolvedContext = {
  tenantId: string;
  saasId: string;
};

export type ClinicControlPlaneHandlerOutput = {
  tenantId: string;
  saasId: string;
  health: ClinicAppointmentHealthResult;
  summary: string;
  output: {
    upcomingAppointments: number;
    unconfirmedAppointments: number;
    overdueFollowups: number;
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
};

function assertIdentity(tenantId: string, saasId: string): void {
  if (!tenantId.trim() || !saasId.trim()) {
    throw new Error("Clinic context-resolution requires tenantId and saasId.");
  }
}

function prepareAppointments(
  appointments: ClinicAppointmentHealthAppointment[],
): ClinicAppointmentHealthAppointment[] {
  return appointments.map((appointment) => ({
    id: appointment.id,
    status: appointment.status,
    scheduledAt: appointment.scheduledAt ?? null,
    followUpAt: appointment.followUpAt ?? null,
    updatedAt: appointment.updatedAt ?? null,
    confirmedAt: appointment.confirmedAt ?? null,
  }));
}

export function resolveClinicControlPlaneContext(
  input: Pick<ClinicControlPlaneContextResolutionInput, "tenantId" | "saasId">,
): ClinicControlPlaneResolvedContext {
  assertIdentity(input.tenantId, input.saasId);

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
  };
}

export function resolveClinicControlPlaneHandlerOutput(
  input: ClinicControlPlaneContextResolutionInput,
): ClinicControlPlaneHandlerOutput {
  const context = resolveClinicControlPlaneContext(input);
  const health = calculateClinicAppointmentHealth(prepareAppointments(input.appointments), input.config);

  return {
    tenantId: context.tenantId,
    saasId: context.saasId,
    health,
    summary: health.summary,
    output: {
      upcomingAppointments: health.metrics.upcomingAppointments,
      unconfirmedAppointments: health.metrics.unconfirmedAppointments,
      overdueFollowups: health.metrics.overdueFollowups,
      lookaheadDays: health.config.lookaheadDays,
      overdueFollowupHours: health.config.overdueFollowupHours,
    },
  };
}
