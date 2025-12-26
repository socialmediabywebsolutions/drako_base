import type { EmployeesContext } from "@/lib/employees/context";
import type { AppointmentsContext } from "@/lib/appointments/repository";
import { listAppointmentsForEmployee } from "@/lib/appointments/repository";
import { checkEmployeeCompliance } from "@/lib/employees/compliance";
import { getEmployeeContract, loadHrSettings } from "@/lib/employees/repository";
import type { SaasAppointment } from "@/lib/appointments/types";

export type GuardrailKind = "OVERWORK" | "UNDERPAY" | "REST_TIME";

export type GuardrailDecisionType = "ALLOW" | "WARN" | "BLOCK";

export interface GuardrailDecision {
  kind: GuardrailKind;
  decision: GuardrailDecisionType;
  message: string;
  details?: Record<string, unknown>;
}

export interface SchedulingGuardrailResult {
  decisions: GuardrailDecision[];
  finalDecision: GuardrailDecisionType;
}

type GuardrailsContext = {
  employeesCtx: EmployeesContext;
  appointmentsCtx: AppointmentsContext;
};

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return end;
}

function appointmentDurationHours(appointment: Pick<SaasAppointment, "scheduledStart" | "scheduledEnd">): number {
  const start = new Date(appointment.scheduledStart).getTime();
  const end = new Date(appointment.scheduledEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start) / (60 * 60 * 1000);
}

function resolveFinalDecision(decisions: GuardrailDecision[]): GuardrailDecisionType {
  if (decisions.some((item) => item.decision === "BLOCK")) return "BLOCK";
  if (decisions.some((item) => item.decision === "WARN")) return "WARN";
  return "ALLOW";
}

export async function evaluateOverworkGuardrail(
  ctx: GuardrailsContext,
  employeeId: string,
  proposedAppointment: { start: Date; end: Date },
): Promise<GuardrailDecision | null> {
  const [contract, settings] = await Promise.all([
    getEmployeeContract(ctx.employeesCtx, employeeId),
    loadHrSettings(ctx.employeesCtx),
  ]);
  const maxHoursWeek = contract?.maxHoursWeek ?? settings.maxWeeklyHoursDefault;
  if (!maxHoursWeek || maxHoursWeek <= 0) return null;

  const weekStart = startOfWeek(proposedAppointment.start);
  const weekEnd = endOfWeek(proposedAppointment.start);
  const scheduled = await listAppointmentsForEmployee(ctx.appointmentsCtx, employeeId, {
    from: weekStart.toISOString(),
    to: weekEnd.toISOString(),
  });
  const scheduledHours = scheduled
    .filter((appt) => appt.status !== "CANCELLED" && appt.status !== "NO_SHOW")
    .reduce((acc, appt) => acc + appointmentDurationHours(appt), 0);
  const proposedHours = appointmentDurationHours({
    scheduledStart: proposedAppointment.start.toISOString(),
    scheduledEnd: proposedAppointment.end.toISOString(),
  });
  const projectedHours = scheduledHours + proposedHours;
  const ratio = maxHoursWeek > 0 ? projectedHours / maxHoursWeek : 0;

  if (ratio <= 1) {
    return {
      kind: "OVERWORK",
      decision: "ALLOW",
      message: "Carga semanal dentro del límite configurado.",
      details: { projectedHours, maxHoursWeek },
    };
  }

  if (ratio <= 1.1) {
    return {
      kind: "OVERWORK",
      decision: "WARN",
      message: "Estás sobrepasando ligeramente el límite semanal configurado.",
      details: { projectedHours, maxHoursWeek },
    };
  }

  if (settings.blockOverwork) {
    return {
      kind: "OVERWORK",
      decision: "BLOCK",
      message: "Fairness Guard bloquea la cita: se supera el límite semanal de horas.",
      details: { projectedHours, maxHoursWeek },
    };
  }

  return {
    kind: "OVERWORK",
    decision: "WARN",
    message: "Se supera el límite semanal de horas. Ajusta agenda o contrato.",
    details: { projectedHours, maxHoursWeek },
  };
}

export async function evaluateRestTimeGuardrail(
  ctx: GuardrailsContext,
  employeeId: string,
  proposedAppointment: { start: Date; end: Date },
): Promise<GuardrailDecision | null> {
  const settings = await loadHrSettings(ctx.employeesCtx);
  if (!settings.minRestHoursBetweenShifts || settings.minRestHoursBetweenShifts <= 0) return null;

  const windowStart = new Date(proposedAppointment.start.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(proposedAppointment.end.getTime() + 24 * 60 * 60 * 1000);
  const appointments = await listAppointmentsForEmployee(ctx.appointmentsCtx, employeeId, {
    from: windowStart.toISOString(),
    to: windowEnd.toISOString(),
  });
  const sameEmployee = appointments.filter((appt) => appt.status !== "CANCELLED" && appt.status !== "NO_SHOW");

  const previous = sameEmployee
    .filter((appt) => new Date(appt.scheduledEnd).getTime() <= proposedAppointment.start.getTime())
    .sort((a, b) => new Date(b.scheduledEnd).getTime() - new Date(a.scheduledEnd).getTime())[0];
  const next = sameEmployee
    .filter((appt) => new Date(appt.scheduledStart).getTime() >= proposedAppointment.end.getTime())
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())[0];

  const restToPrev =
    previous ? Math.max(0, (proposedAppointment.start.getTime() - new Date(previous.scheduledEnd).getTime()) / (60 * 60 * 1000)) : null;
  const restToNext =
    next ? Math.max(0, (new Date(next.scheduledStart).getTime() - proposedAppointment.end.getTime()) / (60 * 60 * 1000)) : null;

  const restHoursCandidates = [restToPrev, restToNext].filter((value): value is number => typeof value === "number");
  if (restHoursCandidates.length === 0) return null;
  const restHours = Math.min(...restHoursCandidates);

  if (restHours >= settings.minRestHoursBetweenShifts) {
    return {
      kind: "REST_TIME",
      decision: "ALLOW",
      message: "Descanso entre citas dentro del mínimo configurado.",
      details: { restHours, minRestHoursBetweenShifts: settings.minRestHoursBetweenShifts },
    };
  }

  if (restHours < settings.minRestHoursBetweenShifts * 0.5) {
    return {
      kind: "REST_TIME",
      decision: "BLOCK",
      message: "Fairness Guard bloquea la cita: descanso insuficiente entre turnos.",
      details: { restHours, minRestHoursBetweenShifts: settings.minRestHoursBetweenShifts },
    };
  }

  return {
    kind: "REST_TIME",
    decision: "WARN",
    message: "Descanso entre citas por debajo del mínimo configurado.",
    details: { restHours, minRestHoursBetweenShifts: settings.minRestHoursBetweenShifts },
  };
}

export async function evaluateUnderpayGuardrail(ctx: GuardrailsContext, employeeId: string): Promise<GuardrailDecision | null> {
  const [settings, compliance] = await Promise.all([
    loadHrSettings(ctx.employeesCtx),
    checkEmployeeCompliance(ctx.employeesCtx, employeeId),
  ]);
  const hasUnderpayIssue = compliance.issues.some((issue) => issue.type === "UNDERPAID");
  if (!hasUnderpayIssue) return null;

  if (settings.blockUnderpay) {
    return {
      kind: "UNDERPAY",
      decision: "BLOCK",
      message: "No programes más horas hasta ajustar el salario al mínimo configurado.",
      details: { effectiveHourlyRate: compliance.metrics.effectiveHourlyRate, minHourlyWage: settings.minHourlyWage },
    };
  }

  return {
    kind: "UNDERPAY",
    decision: "WARN",
    message: "Tarifa por debajo del mínimo configurado. Revisa salario antes de añadir más horas.",
    details: { effectiveHourlyRate: compliance.metrics.effectiveHourlyRate, minHourlyWage: settings.minHourlyWage },
  };
}

export async function evaluateSchedulingGuardrails(
  ctx: GuardrailsContext,
  employeeId: string,
  proposedAppointment: { start: Date; end: Date },
): Promise<SchedulingGuardrailResult> {
  const [overwork, restTime, underpay] = await Promise.all([
    evaluateOverworkGuardrail(ctx, employeeId, proposedAppointment),
    evaluateRestTimeGuardrail(ctx, employeeId, proposedAppointment),
    evaluateUnderpayGuardrail(ctx, employeeId),
  ]);

  const decisions = [overwork, restTime, underpay].filter((item): item is GuardrailDecision => Boolean(item));
  return {
    decisions,
    finalDecision: resolveFinalDecision(decisions),
  };
}
