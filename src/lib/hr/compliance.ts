import type {
  ComplianceFinding,
  EmployeeContract,
  EmployeePerformanceMetrics,
  EmployeeTimesheet,
  HrRules,
} from "@/lib/employees/types";

function ensureAdvisorAction(findings: ComplianceFinding[]): ComplianceFinding[] {
  return findings.map((finding) => {
    if (finding.severity === "BLOCKER") {
      return {
        ...finding,
        suggestedActions: [...finding.suggestedActions, "Consulta con tu asesor laboral para ajustar este punto."],
      };
    }
    return finding;
  });
}

export function checkContractCompliance(contract: EmployeeContract | null, hrRules: HrRules | null): ComplianceFinding[] {
  if (!contract || !hrRules) return [];
  const findings: ComplianceFinding[] = [];
  if (hrRules.minWageHour && contract.hourlyRate !== null) {
    if (contract.hourlyRate < hrRules.minWageHour) {
      findings.push({
        type: "wage_floor",
        severity: hrRules.blockIllegalWage ? "BLOCKER" : "ALERT",
        message: `El valor hora (${contract.hourlyRate.toFixed(2)} €/h) es inferior al mínimo configurado (${hrRules.minWageHour.toFixed(2)} €/h).`,
        suggestedActions: ["Actualiza el salario por hora o revisa las reglas configuradas."],
      });
    }
  } else if (hrRules.minWageHour && contract.baseSalaryMonthly && contract.maxHoursWeek) {
    const estimatedHour = contract.baseSalaryMonthly / (4.33 * contract.maxHoursWeek);
    if (estimatedHour < hrRules.minWageHour) {
      findings.push({
        type: "wage_floor_estimated",
        severity: hrRules.blockIllegalWage ? "BLOCKER" : "ALERT",
        message: `El salario mensual equivale a ${estimatedHour.toFixed(2)} €/h, por debajo del mínimo configurado.`,
        suggestedActions: ["Revisa salario base, horas máximas o reglas de HR."],
      });
    }
  }

  if (hrRules.maxHoursPerWeekLegal && contract.maxHoursWeek && contract.maxHoursWeek > hrRules.maxHoursPerWeekLegal) {
    findings.push({
      type: "contract_hours_limit",
      severity: "NOTICE",
      message: `El contrato permite ${contract.maxHoursWeek}h/semana y tus reglas indican un máximo de ${hrRules.maxHoursPerWeekLegal}h.`,
      suggestedActions: ["Ajusta max_hours_per_week o documenta la excepción en el convenio."],
    });
  }

  return ensureAdvisorAction(findings);
}

export function checkScheduleCompliance(
  contract: EmployeeContract | null,
  hrRules: HrRules | null,
  timesheets: EmployeeTimesheet[],
): ComplianceFinding[] {
  if (!hrRules || timesheets.length === 0) return [];
  const findings: ComplianceFinding[] = [];
  const totalWorked = timesheets.reduce((acc, item) => acc + item.workedMinutes, 0);
  const totalExtra = timesheets.reduce((acc, item) => acc + item.extraMinutes, 0);
  const hoursWorked = totalWorked / 60;
  const hoursExtra = totalExtra / 60;

  if (hrRules.maxHoursPerWeekLegal && hoursWorked > hrRules.maxHoursPerWeekLegal) {
    findings.push({
      type: "week_hours_overflow",
      severity: hrRules.blockIllegalOvertime ? "BLOCKER" : "ALERT",
      message: `La semana acumula ${hoursWorked.toFixed(1)}h trabajadas vs máximo configurado ${hrRules.maxHoursPerWeekLegal}h.`,
      suggestedActions: ["Reprograma turnos o compensa con días de descanso."],
    });
  }

  if (hrRules.maxOvertimePerWeek && hoursExtra > hrRules.maxOvertimePerWeek) {
    findings.push({
      type: "overtime_overflow",
      severity: "ALERT",
      message: `Se registraron ${hoursExtra.toFixed(1)}h extra y el máximo permitido es ${hrRules.maxOvertimePerWeek}h.`,
      suggestedActions: ["Aprueba horas extra justificadas y bloquea nuevas asignaciones."],
    });
  }

  if (hrRules.minRestHoursBetweenShifts && timesheets.length > 1) {
    const sorted = [...timesheets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = new Date(sorted[i - 1].date).getTime();
      const current = new Date(sorted[i].date).getTime();
      const diffHours = (current - previous) / (1000 * 60 * 60);
      if (diffHours <= 0) continue;
      const restHours = Math.max(0, diffHours - sorted[i - 1].workedMinutes / 60);
      if (restHours < hrRules.minRestHoursBetweenShifts) {
        findings.push({
          type: "rest_gap",
          severity: "NOTICE",
          message: `Entre ${sorted[i - 1].date} y ${sorted[i].date} sólo hay ${restHours.toFixed(1)}h de descanso.`,
          suggestedActions: ["Revisa pausas o distribuye huecos más largos entre turnos."],
        });
      }
    }
  }

  if (contract?.maxHoursWeek && hoursWorked > contract.maxHoursWeek) {
    findings.push({
      type: "contract_overflow",
      severity: "ALERT",
      message: `Este contrato limita a ${contract.maxHoursWeek}h y se han registrado ${hoursWorked.toFixed(1)}h.`,
      suggestedActions: ["Solicita autorización del empleado y documenta compensaciones."],
    });
  }

  return ensureAdvisorAction(findings);
}

export function checkPerformanceSignals(
  metrics: EmployeePerformanceMetrics | null,
  timesheets: EmployeeTimesheet[],
): ComplianceFinding[] {
  if (!metrics && timesheets.length === 0) return [];
  const findings: ComplianceFinding[] = [];
  const totalLateMinutes = timesheets.reduce((acc, item) => acc + item.lateMinutes, 0);
  if (totalLateMinutes > 30) {
    findings.push({
      type: "late_arrivals",
      severity: "NOTICE",
      message: `Se acumulan ${totalLateMinutes} minutos de retraso recientes.`,
      suggestedActions: ["Habla con la persona, revisa transporte o flexibilidad horaria."],
    });
  }

  if (metrics?.revenueLastWeek !== undefined && metrics.hoursWorkedLastWeek) {
    const revenuePerHour = metrics.revenueLastWeek / metrics.hoursWorkedLastWeek;
    if (revenuePerHour < 50) {
      findings.push({
        type: "low_productivity",
        severity: "INFO",
        message: `Ingresos por hora (${revenuePerHour.toFixed(2)} €) por debajo del objetivo de 50 €/h.`,
        suggestedActions: ["Planifica coaching comercial o revisa la asignación de servicios."],
      });
    }
  }

  if ((metrics?.leadsConverted ?? 0) <= 0 && metrics?.appointmentsHandled && metrics.appointmentsHandled > 5) {
    findings.push({
      type: "conversion_drop",
      severity: "NOTICE",
      message: "Varias citas atendidas sin cierres registrados. Puede requerir refuerzo comercial.",
      suggestedActions: ["Revisa guiones de venta o acompaña una llamada para detectar bloqueos."],
    });
  }

  return findings;
}
