import type { EmployeesContext } from "@/lib/employees/context";
import {
  DEFAULT_MAX_WEEKLY_HOURS,
  DEFAULT_MIN_HOURLY_WAGE,
  getEmployeeContract,
  getEmployeeWorkloadSnapshot,
  listEmployees,
  loadHrSettings,
} from "@/lib/employees/repository";
import type {
  ComplianceSummary,
  EmployeeComplianceIssue,
  EmployeeComplianceReport,
  HRSettings,
} from "@/lib/employees/types";

const CRITICAL_UNDERPAID_RATIO = 0.7;
const CRITICAL_OVERWORK_RATIO = 1.2;

export async function getHrSettings(ctx: EmployeesContext): Promise<HRSettings> {
  return loadHrSettings(ctx);
}

function buildUnderpaidIssue(effectiveRate: number, minHourlyWage: number): EmployeeComplianceIssue | null {
  if (!Number.isFinite(effectiveRate) || effectiveRate >= minHourlyWage) return null;
  const ratio = effectiveRate / minHourlyWage;
  const level = ratio < CRITICAL_UNDERPAID_RATIO ? "CRITICAL" : "WARNING";
  return {
    type: "UNDERPAID",
    level,
    message: `Tarifa efectiva ${(effectiveRate).toFixed(2)} €/h por debajo del mínimo configurado (${minHourlyWage.toFixed(2)} €/h).`,
  };
}

function buildOverworkedIssue(actualHours: number, maxHoursWeek: number): EmployeeComplianceIssue | null {
  if (!Number.isFinite(actualHours) || !Number.isFinite(maxHoursWeek) || maxHoursWeek <= 0) return null;
  if (actualHours <= maxHoursWeek) return null;
  const ratio = actualHours / maxHoursWeek;
  const level = ratio > CRITICAL_OVERWORK_RATIO ? "CRITICAL" : "WARNING";
  return {
    type: "OVERWORKED",
    level,
    message: `Horas efectivas ${actualHours.toFixed(1)}h superan el límite semanal ${maxHoursWeek.toFixed(1)}h.`,
  };
}

function buildLowActivityIssue(plannedHours: number, actualHours: number): EmployeeComplianceIssue | null {
  if (!Number.isFinite(plannedHours) || plannedHours <= 0) return null;
  if (!Number.isFinite(actualHours)) return null;
  const threshold = plannedHours * 0.3;
  if (actualHours >= threshold) return null;
  return {
    type: "LOW_ACTIVITY",
    level: "INFO",
    message: `Actividad baja: ${actualHours.toFixed(1)}h real vs ${plannedHours.toFixed(1)}h planificadas esta semana.`,
  };
}

function resolveStatus(issues: EmployeeComplianceIssue[]): EmployeeComplianceReport["status"] {
  if (issues.some((issue) => issue.level === "CRITICAL")) return "CRITICAL";
  if (issues.length > 0) return "WARNING";
  return "OK";
}

export async function checkEmployeeCompliance(ctx: EmployeesContext, employeeId: string): Promise<EmployeeComplianceReport> {
  const [contract, workload, settings] = await Promise.all([
    getEmployeeContract(ctx, employeeId),
    getEmployeeWorkloadSnapshot(ctx, employeeId, "week"),
    getHrSettings(ctx),
  ]);

  const metrics: EmployeeComplianceReport["metrics"] = {};
  const plannedHours = Number.isFinite(workload.plannedHours) ? workload.plannedHours : 0;
  const actualHours = Number.isFinite(workload.actualHours) ? workload.actualHours : 0;
  const extraHours = Number.isFinite(workload.extraHours) ? workload.extraHours : Math.max(0, actualHours - plannedHours);

  if (plannedHours > 0) metrics.plannedHours = plannedHours;
  if (actualHours > 0 || plannedHours > 0) metrics.actualHours = actualHours;
  if (extraHours > 0) metrics.extraHours = extraHours;

  let effectiveHourlyRate: number | undefined;
  if (contract?.hourlyRate !== null && typeof contract?.hourlyRate === "number") {
    effectiveHourlyRate = contract.hourlyRate;
  } else if (contract?.baseSalaryMonthly) {
    const hoursPerWeek = contract.maxHoursWeek ?? settings.maxWeeklyHoursDefault ?? DEFAULT_MAX_WEEKLY_HOURS;
    const hoursPerMonth = Math.max(1, hoursPerWeek * 4);
    effectiveHourlyRate = contract.baseSalaryMonthly / hoursPerMonth;
  }
  if (typeof effectiveHourlyRate === "number" && Number.isFinite(effectiveHourlyRate)) {
    metrics.effectiveHourlyRate = effectiveHourlyRate;
  }

  const maxHoursWeek = contract?.maxHoursWeek ?? settings.maxWeeklyHoursDefault ?? DEFAULT_MAX_WEEKLY_HOURS;
  metrics.maxHoursWeek = maxHoursWeek;

  const issues: EmployeeComplianceIssue[] = [];
  if (typeof effectiveHourlyRate === "number" && Number.isFinite(effectiveHourlyRate)) {
    const underpaid = buildUnderpaidIssue(effectiveHourlyRate, settings.minHourlyWage ?? DEFAULT_MIN_HOURLY_WAGE);
    if (underpaid) issues.push(underpaid);
  }

  const overworked = buildOverworkedIssue(actualHours, maxHoursWeek ?? DEFAULT_MAX_WEEKLY_HOURS);
  if (overworked) issues.push(overworked);

  const lowActivity = buildLowActivityIssue(plannedHours, actualHours);
  if (lowActivity) issues.push(lowActivity);

  return {
    employeeId,
    status: resolveStatus(issues),
    issues,
    metrics,
  };
}

export async function getSaasComplianceSummary(ctx: EmployeesContext, saasId: string): Promise<ComplianceSummary> {
  if (!saasId) {
    throw new Error("saasId is required to generate compliance summary");
  }
  const employees = await listEmployees(ctx);
  const reports = await Promise.all(employees.map((employee) => checkEmployeeCompliance(ctx, employee.id)));

  let okCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  reports.forEach((report) => {
    if (report.status === "CRITICAL") {
      criticalCount += 1;
    } else if (report.status === "WARNING") {
      warningCount += 1;
    } else {
      okCount += 1;
    }
  });

  return {
    saasId,
    totalEmployees: employees.length,
    okCount,
    warningCount,
    criticalCount,
    employees: reports.map((report) => ({
      employeeId: report.employeeId,
      status: report.status,
      mainIssue: report.issues[0]?.message,
    })),
  };
}

export async function getOverworkedEmployeeCount(ctx: EmployeesContext, saasId: string): Promise<number> {
  if (!saasId) {
    throw new Error("saasId is required to compute overworked employees");
  }
  const employees = await listEmployees(ctx);
  const reports = await Promise.all(employees.map((employee) => checkEmployeeCompliance(ctx, employee.id)));
  return reports.reduce((acc, report) => {
    const hasOverworked = report.issues.some((issue) => issue.type === "OVERWORKED");
    return acc + (hasOverworked ? 1 : 0);
  }, 0);
}
