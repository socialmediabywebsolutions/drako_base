export type ClinicAppointmentHealthConfig = {
  lookaheadDays?: number;
  overdueFollowupHours?: number;
  now?: Date | string;
};

export type ClinicAppointmentHealthAppointment = {
  id: string;
  status: string;
  scheduledAt?: string | null;
  updatedAt?: string | null;
  confirmedAt?: string | null;
  followUpAt?: string | null;
};

export type ClinicAppointmentHealthMetrics = {
  upcomingAppointments: number;
  unconfirmedAppointments: number;
  overdueFollowups: number;
};

export type ClinicAppointmentHealthResult = {
  config: {
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
  metrics: ClinicAppointmentHealthMetrics;
  summary: string;
};

const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_OVERDUE_FOLLOWUP_HOURS = 24;

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function resolveNow(input: Date | string | undefined): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/-/g, "_");
}

function resolveScheduledAt(appointment: ClinicAppointmentHealthAppointment): string | null {
  return appointment.scheduledAt ?? appointment.followUpAt ?? null;
}

export function calculateClinicAppointmentHealth(
  appointments: ClinicAppointmentHealthAppointment[],
  config?: ClinicAppointmentHealthConfig,
): ClinicAppointmentHealthResult {
  const lookaheadDays = normalizePositiveInt(config?.lookaheadDays, DEFAULT_LOOKAHEAD_DAYS);
  const overdueFollowupHours = normalizePositiveInt(config?.overdueFollowupHours, DEFAULT_OVERDUE_FOLLOWUP_HOURS);
  const now = resolveNow(config?.now);
  const lookaheadEnd = addDays(now, lookaheadDays);
  const overdueCutoff = new Date(now.getTime() - overdueFollowupHours * 60 * 60 * 1000);

  let upcomingAppointments = 0;
  let unconfirmedAppointments = 0;
  let overdueFollowups = 0;

  for (const appointment of appointments) {
    const scheduledValue = resolveScheduledAt(appointment);
    if (!scheduledValue) {
      continue;
    }

    const scheduledAt = Date.parse(scheduledValue);
    if (Number.isNaN(scheduledAt)) {
      continue;
    }

    const status = normalizeStatus(appointment.status);
    const isUnconfirmed = status === "REQUESTED" || status === "PENDING";

    if (
      scheduledAt >= now.getTime()
      && scheduledAt <= lookaheadEnd.getTime()
      && status !== "CANCELLED"
      && status !== "NO_SHOW"
      && status !== "DONE"
    ) {
      upcomingAppointments += 1;
    }

    if (scheduledAt >= now.getTime() && isUnconfirmed) {
      unconfirmedAppointments += 1;
    }

    if (scheduledAt < now.getTime() && scheduledAt <= overdueCutoff.getTime() && isUnconfirmed) {
      overdueFollowups += 1;
    }
  }

  const metrics: ClinicAppointmentHealthMetrics = {
    upcomingAppointments,
    unconfirmedAppointments,
    overdueFollowups,
  };

  return {
    config: {
      lookaheadDays,
      overdueFollowupHours,
    },
    metrics,
    summary: `Clinic appointment health: ${upcomingAppointments} upcoming, ${unconfirmedAppointments} unconfirmed, ${overdueFollowups} overdue followups.`,
  };
}
