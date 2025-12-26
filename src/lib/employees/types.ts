export type Employee = {
  id: string;
  tenantId: string;
  saasId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatarUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeSkill = {
  id: string;
  employeeId: string;
  tenantId: string;
  skill: string;
  level: string;
  createdAt: string;
};

export type EmployeeRole = {
  id: string;
  tenantId: string;
  saasId: string;
  slug: string;
  label: string;
  description: string | null;
  permissions: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeSchedule = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeWithContext = Employee & {
  skills: EmployeeSkill[];
  schedules: EmployeeSchedule[];
};

export type EmployeeContractType = "FULL_TIME" | "PART_TIME" | "FREELANCE" | "EXTRA";

export type EmployeeContract = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  contractType: EmployeeContractType;
  baseSalaryMonthly: number | null;
  hourlyRate: number | null;
  commissionPercent: number | null;
  maxHoursWeek: number | null;
  minHoursWeek: number | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeHRFlags = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  isUnderpaidSuspected: boolean;
  isOverworkedSuspected: boolean;
  isLowPerformanceSuspected: boolean;
  lastReviewAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeTimesheet = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  date: string;
  scheduledMinutes: number;
  workedMinutes: number;
  extraMinutes: number;
  lateMinutes: number;
  breakMinutes: number;
  source: "MANUAL" | "AUTO" | "ADJUSTMENT";
  createdAt: string;
  updatedAt: string;
};

export type EmployeePayrollRunStatus = "DRAFT" | "CONFIRMED" | "PAID";

export type EmployeePayrollRun = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseGrossAmount: number;
  overtimeAmount: number;
  commissionAmount: number;
  otherAdjustments: number;
  totalGrossAmount: number;
  status: EmployeePayrollRunStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeProfitabilityStatus = "HEALTHY" | "TIGHT" | "UNPROFITABLE" | "LOW_ACTIVITY";

export type EmployeeProfitabilitySnapshot = {
  employeeId: string;
  tenantId: string;
  saasId: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  productCosts: number;
  payrollCosts: number;
  otherAllocatedCosts: number;
  totalCosts: number;
  marginAbsolute: number;
  marginPercent: number;
  appointmentsCount: number;
  hoursBooked: number;
  hoursWorkedEstimate: number;
  effectiveHourlyMargin: number;
  utilizationPercent: number | null;
  status: EmployeeProfitabilityStatus;
  notes?: string;
};

export type EmployeeProfitabilityListItem = {
  employeeId: string;
  name: string;
  roleSlug: string | null;
  periodLabel: string;
  totalRevenue: number;
  marginPercent: number | null;
  utilizationPercent: number | null;
  status: EmployeeProfitabilityStatus;
};

export type EmployeeHrEvent = {
  id: string;
  tenantId: string;
  saasId: string;
  employeeId: string;
  eventType: string;
  severity: "INFO" | "NOTICE" | "ALERT" | "CRITICAL";
  message: string;
  createdBy: "SYSTEM" | "OWNER" | "MANAGER" | "EMPLOYEE";
  createdAt: string;
};

export type HRSettings = {
  minHourlyWage: number;
  maxWeeklyHoursDefault: number;
  blockOverwork: boolean;
  blockUnderpay: boolean;
  minRestHoursBetweenShifts: number;
};

export type EmployeeWorkloadSnapshot = {
  plannedHours: number;
  actualHours: number;
  extraHours: number;
};

export type ComplianceStatus = "OK" | "WARNING" | "CRITICAL";

export type EmployeeComplianceIssueType = "UNDERPAID" | "OVERWORKED" | "LOW_ACTIVITY" | "OTHER";

export type EmployeeComplianceIssueLevel = "INFO" | "WARNING" | "CRITICAL";

export type EmployeeComplianceIssue = {
  type: EmployeeComplianceIssueType;
  level: EmployeeComplianceIssueLevel;
  message: string;
};

export type EmployeeComplianceReport = {
  employeeId: string;
  status: ComplianceStatus;
  issues: EmployeeComplianceIssue[];
  metrics: {
    effectiveHourlyRate?: number;
    plannedHours?: number;
    actualHours?: number;
    extraHours?: number;
    maxHoursWeek?: number;
  };
};

export type ComplianceSummary = {
  saasId: string;
  totalEmployees: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  employees: {
    employeeId: string;
    status: ComplianceStatus;
    mainIssue?: string;
  }[];
};

export type EmployeePerformanceMetrics = {
  revenueLastWeek?: number;
  hoursWorkedLastWeek?: number;
  appointmentsHandled?: number;
  leadsConverted?: number;
};

export type HrRules = {
  minWageHour?: number | null;
  maxHoursPerWeekLegal?: number | null;
  maxOvertimePerWeek?: number | null;
  blockIllegalWage?: boolean | null;
  blockIllegalOvertime?: boolean | null;
  minRestHoursBetweenShifts?: number | null;
};

export type ComplianceFinding = {
  type: string;
  severity: "BLOCKER" | "ALERT" | "NOTICE" | "INFO";
  message: string;
  suggestedActions: string[];
};

export type EmployeePayrollDraft = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseGrossAmount: number;
  overtimeAmount: number;
  commissionAmount: number;
  otherAdjustments: number;
  totalGrossAmount: number;
  notes?: string | null;
};
