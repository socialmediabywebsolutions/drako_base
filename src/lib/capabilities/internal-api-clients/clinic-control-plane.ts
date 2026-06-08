export type ClinicControlPlaneStatus = "healthy" | "degraded" | "pending" | "unavailable";

export type ClinicControlPlaneHealthSnapshot = {
  tenantId: string;
  saasId: string;
  status: ClinicControlPlaneStatus;
  generatedAt: string;
  appointmentHealth?: ClinicAppointmentHealthMetrics;
  checks: Array<{
    key: string;
    ok: boolean;
    message?: string;
  }>;
};

export type ClinicControlPlaneAutomationRegistration = {
  tenantId: string;
  saasId: string;
  automationKey: "clinic.daily_appointment_health";
  displayName: string;
  enabled: boolean;
  scheduleMode: "scheduled" | "manual";
  config: {
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
};

export type ClinicControlPlaneIntegrationState = {
  tenantId: string;
  saasId: string;
  integrationKey: "whatsapp";
  status: "CONNECTED" | "PENDING" | "MISSING";
  hasPrimaryWhatsappIdentity: boolean;
  connectionLabel?: string;
};

export type ClinicAppointmentHealthAuditRequest = {
  tenantId: string;
  saasId: string;
  lookaheadDays?: number;
  overdueFollowupHours?: number;
  requestedBy: string;
};

export type ClinicAppointmentHealthMetrics = {
  upcomingAppointments: number;
  unconfirmedAppointments: number;
  overdueFollowups: number;
};

export type ClinicAppointmentHealthAuditResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  summary: string;
  metrics: ClinicAppointmentHealthMetrics;
  output: {
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
};

export class ClinicControlPlaneClientError extends Error {
  constructor(
    message: string,
    public readonly code: "CLINIC_CONTROL_PLANE_NOT_CONFIGURED" | "CLINIC_CONTROL_PLANE_BAD_REQUEST",
  ) {
    super(message);
    this.name = "ClinicControlPlaneClientError";
  }
}

const CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health";
const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_OVERDUE_FOLLOWUP_HOURS = 24;

const automationRegistrations = new Map<string, ClinicControlPlaneAutomationRegistration>();
const integrationStates = new Map<string, ClinicControlPlaneIntegrationState>();
const healthSnapshots = new Map<string, ClinicControlPlaneHealthSnapshot>();

function keyFor(tenantId: string, saasId: string): string {
  return `${tenantId.trim()}::${saasId.trim()}`;
}

function assertIdentity(tenantId: string, saasId: string): void {
  if (!tenantId.trim() || !saasId.trim()) {
    throw new ClinicControlPlaneClientError(
      "Clinic control-plane calls require tenantId and saasId.",
      "CLINIC_CONTROL_PLANE_BAD_REQUEST",
    );
  }
}

function normalizeAutomationRegistration(
  input: ClinicControlPlaneAutomationRegistration,
): ClinicControlPlaneAutomationRegistration {
  assertIdentity(input.tenantId, input.saasId);

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: CLINIC_DAILY_APPOINTMENT_HEALTH_KEY,
    displayName: input.displayName || "Clinic daily appointment health",
    enabled: input.enabled,
    scheduleMode: input.scheduleMode,
    config: {
      lookaheadDays: input.config.lookaheadDays > 0
        ? Math.floor(input.config.lookaheadDays)
        : DEFAULT_LOOKAHEAD_DAYS,
      overdueFollowupHours: input.config.overdueFollowupHours > 0
        ? Math.floor(input.config.overdueFollowupHours)
        : DEFAULT_OVERDUE_FOLLOWUP_HOURS,
    },
  };
}

function emptyHealthSnapshot(tenantId: string, saasId: string): ClinicControlPlaneHealthSnapshot {
  return {
    tenantId,
    saasId,
    status: "pending",
    generatedAt: new Date(0).toISOString(),
    checks: [
      {
        key: "clinic.control_plane.backend",
        ok: false,
        message: "Neutral Clinic control-plane backend is not configured yet.",
      },
    ],
  };
}

// Neutral boundary only: this module must not own Clinic product logic or import legacy campobase runtime.
export async function fetchClinicControlPlaneHealth(
  tenantId: string,
  saasId: string,
): Promise<ClinicControlPlaneHealthSnapshot> {
  assertIdentity(tenantId, saasId);
  return healthSnapshots.get(keyFor(tenantId, saasId)) ?? emptyHealthSnapshot(tenantId, saasId);
}

export async function registerClinicControlPlaneAutomation(
  input: ClinicControlPlaneAutomationRegistration,
): Promise<ClinicControlPlaneAutomationRegistration> {
  const registration = normalizeAutomationRegistration(input);
  automationRegistrations.set(keyFor(registration.tenantId, registration.saasId), registration);
  return registration;
}

export async function ensureClinicControlPlaneIntegration(
  tenantId: string,
  saasId: string,
  input?: Partial<Pick<ClinicControlPlaneIntegrationState, "status" | "hasPrimaryWhatsappIdentity" | "connectionLabel">>,
): Promise<ClinicControlPlaneIntegrationState> {
  assertIdentity(tenantId, saasId);
  const current = integrationStates.get(keyFor(tenantId, saasId));
  const hasPrimaryWhatsappIdentity = input?.hasPrimaryWhatsappIdentity ?? current?.hasPrimaryWhatsappIdentity ?? false;
  const status = input?.status ?? current?.status ?? (hasPrimaryWhatsappIdentity ? "CONNECTED" : "PENDING");

  const next: ClinicControlPlaneIntegrationState = {
    tenantId,
    saasId,
    integrationKey: "whatsapp",
    status,
    hasPrimaryWhatsappIdentity,
    connectionLabel: input?.connectionLabel ?? current?.connectionLabel ?? "Clinic WhatsApp",
  };

  integrationStates.set(keyFor(tenantId, saasId), next);
  return next;
}

export async function triggerClinicAppointmentHealthAudit(
  input: ClinicAppointmentHealthAuditRequest,
): Promise<ClinicAppointmentHealthAuditResult> {
  assertIdentity(input.tenantId, input.saasId);
  throw new ClinicControlPlaneClientError(
    "Clinic appointment health audit requires a neutral Clinic backend; legacy campobase runtime is intentionally not called here.",
    "CLINIC_CONTROL_PLANE_NOT_CONFIGURED",
  );
}

export function buildClinicAppointmentHealthAuditResult(
  input: ClinicAppointmentHealthAuditRequest,
  metrics: ClinicAppointmentHealthMetrics,
): ClinicAppointmentHealthAuditResult {
  assertIdentity(input.tenantId, input.saasId);
  const lookaheadDays = input.lookaheadDays && input.lookaheadDays > 0
    ? Math.floor(input.lookaheadDays)
    : DEFAULT_LOOKAHEAD_DAYS;
  const overdueFollowupHours = input.overdueFollowupHours && input.overdueFollowupHours > 0
    ? Math.floor(input.overdueFollowupHours)
    : DEFAULT_OVERDUE_FOLLOWUP_HOURS;
  const summary = `Clinic appointment health: ${metrics.upcomingAppointments} upcoming, ${metrics.unconfirmedAppointments} unconfirmed, ${metrics.overdueFollowups} overdue followups.`;

  const result: ClinicAppointmentHealthAuditResult = {
    tenantId: input.tenantId,
    saasId: input.saasId,
    ok: true,
    summary,
    metrics,
    output: {
      lookaheadDays,
      overdueFollowupHours,
    },
  };

  healthSnapshots.set(keyFor(input.tenantId, input.saasId), {
    tenantId: input.tenantId,
    saasId: input.saasId,
    status: "healthy",
    generatedAt: new Date(0).toISOString(),
    appointmentHealth: metrics,
    checks: [
      {
        key: "clinic.appointment_health",
        ok: true,
      },
    ],
  });

  return result;
}
