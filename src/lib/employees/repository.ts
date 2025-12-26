import { queryAll, run } from "@/lib/db";
import {
  addDemoEmployeeSchedule,
  addDemoEmployeeSkill,
  getDemoEmployee,
  getDemoEmployeeContract,
  getDemoHrSettings,
  getDemoEmployeeHrFlag,
  listDemoSaasInventoryMovements,
  listDemoSaasServiceProducts,
  listDemoClinicAppointments,
  listDemoEmployeeContracts,
  listDemoEmployeeRoles,
  listDemoEmployeeSchedules,
  listDemoEmployeeSkills,
  listDemoEmployees,
  upsertDemoHrSettings,
  upsertDemoEmployee,
} from "@/lib/admin/demo-data";
import { listAppointmentsForEmployee as listSaasAppointmentsForEmployee, resolveAppointmentsContext } from "@/lib/appointments/repository";
import {
  listSaasInventoryItems,
  listSaasServiceProducts,
  listSaasServices,
  resolveEconomyContext,
  getSaasPricingSettings,
} from "@/lib/economy/repository";
import type {
  DemoClinicAppointment,
  DemoEmployee,
  DemoEmployeeContract,
  DemoEmployeeRole,
  DemoEmployeeSchedule,
  DemoEmployeeSkill,
  DemoHrSettings,
  DemoEmployeeHrFlag,
} from "@/lib/admin/demo-data";
import { EmployeesContextError } from "@/lib/employees/context";
import type { EmployeesContext } from "@/lib/employees/context";
import type {
  Employee,
  EmployeeContract,
  EmployeeRole,
  EmployeeSchedule,
  EmployeeSkill,
  EmployeeWorkloadSnapshot,
  EmployeeWithContext,
  HRSettings,
  EmployeeHRFlags,
  EmployeeProfitabilitySnapshot,
  EmployeeProfitabilityListItem,
  EmployeeProfitabilityStatus,
} from "@/lib/employees/types";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type EmployeeSkillRow = {
  id: string;
  employee_id: string;
  tenant_id: string;
  skill: string;
  level: string;
  created_at: string;
};

type EmployeeScheduleRow = {
  id: string;
  employee_id: string;
  tenant_id: string;
  saas_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
  created_at: string;
  updated_at: string;
};

type EmployeeRoleRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  label: string;
  description: string | null;
  permissions: string | null;
  created_at: string;
  updated_at: string;
};

type EmployeeContractRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  contract_type: string;
  base_salary_monthly: number | null;
  hourly_rate: number | null;
  commission_percent: number | null;
  max_hours_week: number | null;
  min_hours_week: number | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type HrSettingsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  min_hourly_wage: number | null;
  max_weekly_hours: number | null;
  low_activity_appointments: number | null;
  block_overwork: number | null;
  block_underpay: number | null;
  min_rest_hours_between_shifts: number | null;
  created_at: string;
  updated_at: string;
};

type EmployeeHrFlagRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  is_underpaid_suspected: number;
  is_overworked_suspected: number;
  is_low_performance_suspected: number;
  last_review_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_MIN_HOURLY_WAGE = 10;
export const DEFAULT_MAX_WEEKLY_HOURS = 40;
export const DEFAULT_MIN_REST_HOURS = 0;

function buildHrSettings(record: HrSettingsRow | null): HRSettings {
  return {
    minHourlyWage: record?.min_hourly_wage ?? DEFAULT_MIN_HOURLY_WAGE,
    maxWeeklyHoursDefault: record?.max_weekly_hours ?? DEFAULT_MAX_WEEKLY_HOURS,
    blockOverwork: (record?.block_overwork ?? 1) === 1,
    blockUnderpay: (record?.block_underpay ?? 0) === 1,
    minRestHoursBetweenShifts: record?.min_rest_hours_between_shifts ?? DEFAULT_MIN_REST_HOURS,
  };
}

function mapHrFlag(row: EmployeeHrFlagRow): EmployeeHRFlags {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    employeeId: row.employee_id,
    isUnderpaidSuspected: row.is_underpaid_suspected === 1,
    isOverworkedSuspected: row.is_overworked_suspected === 1,
    isLowPerformanceSuspected: row.is_low_performance_suspected === 1,
    lastReviewAt: row.last_review_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoHrFlag(row: DemoEmployeeHrFlag): EmployeeHRFlags {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    employeeId: row.employee_id,
    isUnderpaidSuspected: row.is_underpaid_suspected === 1,
    isOverworkedSuspected: row.is_overworked_suspected === 1,
    isLowPerformanceSuspected: row.is_low_performance_suspected === 1,
    lastReviewAt: row.last_review_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function demoHrSettingsToRow(record: DemoHrSettings): HrSettingsRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    min_hourly_wage: record.min_hourly_wage,
    max_weekly_hours: record.max_weekly_hours,
    low_activity_appointments: record.low_activity_appointments,
    block_overwork: record.block_overwork ?? 1,
    block_underpay: record.block_underpay ?? 0,
    min_rest_hours_between_shifts: record.min_rest_hours_between_shifts ?? DEFAULT_MIN_REST_HOURS,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function shouldFallbackToDemo(error: unknown, ctx: EmployeesContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: EmployeesContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: EmployeesContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new EmployeesContextError("saasId is required to access HR settings.");
  }
  return saasId;
}

async function fetchHrSettingsRowFromDb(ctx: EmployeesContext, saasId: string): Promise<HrSettingsRow | null> {
  const rows = await queryAll<HrSettingsRow>(
    `SELECT id, tenant_id, saas_id, min_hourly_wage, max_weekly_hours, low_activity_appointments,
            block_overwork, block_underpay, min_rest_hours_between_shifts, created_at, updated_at
     FROM employee_hr_settings
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    ctx.tenantId,
    saasId,
  );
  return rows[0] ?? null;
}

function fetchHrSettingsRowFromDemo(ctx: EmployeesContext, saasId: string): HrSettingsRow | null {
  const record = getDemoHrSettings(demoTenantId(ctx), saasId);
  return record ? demoHrSettingsToRow(record) : null;
}

async function fetchHrSettingsRow(ctx: EmployeesContext): Promise<HrSettingsRow | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return fetchHrSettingsRowFromDemo(ctx, saasId);
  }
  try {
    return await fetchHrSettingsRowFromDb(ctx, saasId);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return fetchHrSettingsRowFromDemo(ctx, saasId);
    }
    throw error;
  }
}

export async function loadHrSettings(ctx: EmployeesContext): Promise<HRSettings> {
  const row = await fetchHrSettingsRow(ctx);
  return buildHrSettings(row);
}

export async function saveHrSettings(
  ctx: EmployeesContext,
  updates: Partial<{
    minHourlyWage: number;
    maxWeeklyHoursDefault: number;
    blockOverwork: boolean;
    blockUnderpay: boolean;
    minRestHoursBetweenShifts: number;
  }>,
): Promise<HRSettings> {
  const saasId = requireSaasId(ctx);
  const existingRow = await fetchHrSettingsRow(ctx);
  const nextMin = typeof updates.minHourlyWage === "number" ? updates.minHourlyWage : existingRow?.min_hourly_wage ?? DEFAULT_MIN_HOURLY_WAGE;
  const nextMax = typeof updates.maxWeeklyHoursDefault === "number" ? updates.maxWeeklyHoursDefault : existingRow?.max_weekly_hours ?? DEFAULT_MAX_WEEKLY_HOURS;
  const lowActivity = existingRow?.low_activity_appointments ?? null;
  const nextBlockOverwork =
    typeof updates.blockOverwork === "boolean" ? (updates.blockOverwork ? 1 : 0) : existingRow?.block_overwork ?? 1;
  const nextBlockUnderpay =
    typeof updates.blockUnderpay === "boolean" ? (updates.blockUnderpay ? 1 : 0) : existingRow?.block_underpay ?? 0;
  const nextMinRest =
    typeof updates.minRestHoursBetweenShifts === "number"
      ? updates.minRestHoursBetweenShifts
      : existingRow?.min_rest_hours_between_shifts ?? DEFAULT_MIN_REST_HOURS;

  if (ctx.mode === "demo") {
    const record = upsertDemoHrSettings(demoTenantId(ctx), {
      id: existingRow?.id ?? generateUuid(),
      saas_id: saasId,
      min_hourly_wage: nextMin,
      max_weekly_hours: nextMax,
      low_activity_appointments: lowActivity,
      block_overwork: nextBlockOverwork,
      block_underpay: nextBlockUnderpay,
      min_rest_hours_between_shifts: nextMinRest,
    });
    return buildHrSettings(demoHrSettingsToRow(record));
  }

  const now = new Date().toISOString();
  if (existingRow) {
    await run(
      `UPDATE employee_hr_settings
       SET min_hourly_wage = ?, max_weekly_hours = ?, block_overwork = ?, block_underpay = ?, min_rest_hours_between_shifts = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      nextMin,
      nextMax,
      nextBlockOverwork,
      nextBlockUnderpay,
      nextMinRest,
      now,
      existingRow.id,
      ctx.tenantId,
    );
    return buildHrSettings({
      ...existingRow,
      min_hourly_wage: nextMin,
      max_weekly_hours: nextMax,
      block_overwork: nextBlockOverwork,
      block_underpay: nextBlockUnderpay,
      min_rest_hours_between_shifts: nextMinRest,
      updated_at: now,
    });
  }

  const id = generateUuid();
  await run(
    `INSERT INTO employee_hr_settings
     (id, tenant_id, saas_id, min_hourly_wage, max_weekly_hours, low_activity_appointments,
      block_overwork, block_underpay, min_rest_hours_between_shifts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    nextMin,
    nextMax,
    lowActivity,
    nextBlockOverwork,
    nextBlockUnderpay,
    nextMinRest,
    now,
    now,
  );
  const insertedRow: HrSettingsRow = {
    id,
    tenant_id: ctx.tenantId,
    saas_id: saasId,
    min_hourly_wage: nextMin,
    max_weekly_hours: nextMax,
    low_activity_appointments: lowActivity,
    block_overwork: nextBlockOverwork,
    block_underpay: nextBlockUnderpay,
    min_rest_hours_between_shifts: nextMinRest,
    created_at: now,
    updated_at: now,
  };
  return buildHrSettings(insertedRow);
}

export async function getEmployeeHrFlags(ctx: EmployeesContext, employeeId: string): Promise<EmployeeHRFlags | null> {
  if (ctx.mode === "demo") {
    const record = getDemoEmployeeHrFlag(demoTenantId(ctx), employeeId);
    return record ? mapDemoHrFlag(record) : null;
  }
  try {
    const rows = await queryAll<EmployeeHrFlagRow>(
      `SELECT id, tenant_id, saas_id, employee_id, is_underpaid_suspected, is_overworked_suspected, is_low_performance_suspected, last_review_at, notes, created_at, updated_at
       FROM employee_hr_flags
       WHERE tenant_id = ? AND employee_id = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
      ctx.tenantId,
      employeeId,
    );
    const row = rows[0];
    return row ? mapHrFlag(row) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoEmployeeHrFlag(demoTenantId(ctx), employeeId);
      return record ? mapDemoHrFlag(record) : null;
    }
    throw error;
  }
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url,
    notes: row.notes,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSkill(row: EmployeeSkillRow): EmployeeSkill {
  return {
    id: row.id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    skill: row.skill,
    level: row.level,
    createdAt: row.created_at,
  };
}

function parsePermissions(raw: string | null): Record<string, boolean> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, boolean>;
    }
  } catch {
    // ignore malformed
  }
  return null;
}

function mapSchedule(row: EmployeeScheduleRow): EmployeeSchedule {
  return {
    id: row.id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRole(row: EmployeeRoleRow): EmployeeRole {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    permissions: parsePermissions(row.permissions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContract(row: EmployeeContractRow): EmployeeContract {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    employeeId: row.employee_id,
    contractType: row.contract_type as EmployeeContract["contractType"],
    baseSalaryMonthly: row.base_salary_monthly,
    hourlyRate: row.hourly_rate,
    commissionPercent: row.commission_percent,
    maxHoursWeek: row.max_hours_week,
    minHoursWeek: row.min_hours_week,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWithRelations(employees: Employee[], skills: EmployeeSkill[], schedules: EmployeeSchedule[]): EmployeeWithContext[] {
  const skillsMap = new Map<string, EmployeeSkill[]>();
  skills.forEach((skill) => {
    if (!skillsMap.has(skill.employeeId)) skillsMap.set(skill.employeeId, []);
    skillsMap.get(skill.employeeId)!.push(skill);
  });
  const scheduleMap = new Map<string, EmployeeSchedule[]>();
  schedules.forEach((schedule) => {
    if (!scheduleMap.has(schedule.employeeId)) scheduleMap.set(schedule.employeeId, []);
    scheduleMap.get(schedule.employeeId)!.push(schedule);
  });
  return employees.map((employee) => ({
    ...employee,
    skills: skillsMap.get(employee.id) ?? [],
    schedules: scheduleMap.get(employee.id) ?? [],
  }));
}
function mapDemoEmployee(record: DemoEmployee): Employee {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    saasId: record.saas_id,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone,
    role: record.role,
    avatarUrl: record.avatar_url,
    notes: record.notes,
    isActive: record.is_active === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoSkill(record: DemoEmployeeSkill): EmployeeSkill {
  return {
    id: record.id,
    employeeId: record.employee_id,
    tenantId: record.tenant_id,
    skill: record.skill,
    level: record.level,
    createdAt: record.created_at,
  };
}

function mapDemoSchedule(record: DemoEmployeeSchedule): EmployeeSchedule {
  return {
    id: record.id,
    employeeId: record.employee_id,
    tenantId: record.tenant_id,
    saasId: record.saas_id,
    dayOfWeek: record.day_of_week,
    startTime: record.start_time,
    endTime: record.end_time,
    breakMinutes: record.break_minutes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoContract(record: DemoEmployeeContract): EmployeeContract {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    saasId: record.saas_id,
    employeeId: record.employee_id,
    contractType: record.contract_type,
    baseSalaryMonthly: record.base_salary_monthly,
    hourlyRate: record.hourly_rate,
    commissionPercent: record.commission_percent,
    maxHoursWeek: record.max_hours_week,
    minHoursWeek: record.min_hours_week,
    startDate: record.start_date,
    endDate: record.end_date,
    isActive: record.is_active === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoRole(record: DemoEmployeeRole): EmployeeRole {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    saasId: record.saas_id,
    slug: record.slug,
    label: record.label,
    description: record.description,
    permissions: record.permissions ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function listEmployeesFromDemo(ctx: EmployeesContext): EmployeeWithContext[] {
  const tenant = demoTenantId(ctx);
  const employees = listDemoEmployees(tenant, ctx.saasId ?? undefined).map(mapDemoEmployee);
  const skills = employees.flatMap((emp) => listDemoEmployeeSkills(tenant, emp.id).map(mapDemoSkill));
  const schedules = employees.flatMap((emp) => listDemoEmployeeSchedules(tenant, emp.id).map(mapDemoSchedule));
  return mapWithRelations(employees, skills, schedules);
}

function buildDemoEmployee(ctx: EmployeesContext, record: DemoEmployee): EmployeeWithContext {
  const tenant = demoTenantId(ctx);
  const employee = mapDemoEmployee(record);
  const skills = listDemoEmployeeSkills(tenant, record.id).map(mapDemoSkill);
  const schedules = listDemoEmployeeSchedules(tenant, record.id).map(mapDemoSchedule);
  return { ...employee, skills, schedules };
}

export async function listEmployees(ctx: EmployeesContext): Promise<EmployeeWithContext[]> {
  if (ctx.mode === "demo") {
    return listEmployeesFromDemo(ctx);
  }

  try {
    const whereClauses = ["tenant_id = ?"];
    const params: (string | null)[] = [ctx.tenantId];
    if (ctx.saasId) {
      whereClauses.push("saas_id = ?");
      params.push(ctx.saasId);
    }
    const employees = await queryAll<EmployeeRow>(
      `SELECT id, tenant_id, saas_id, full_name, email, phone, role, avatar_url, notes, is_active, created_at, updated_at
       FROM employees
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY datetime(created_at) DESC`,
      ...params,
    );
    if (employees.length === 0) return [];
    const ids = employees.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    const skillsRows = await queryAll<EmployeeSkillRow>(
      `SELECT id, employee_id, tenant_id, skill, level, created_at
       FROM employee_skills
       WHERE employee_id IN (${placeholders})`,
      ...ids,
    );
    const scheduleRows = await queryAll<EmployeeScheduleRow>(
      `SELECT id, employee_id, tenant_id, saas_id, day_of_week, start_time, end_time, break_minutes, created_at, updated_at
       FROM employee_schedules
       WHERE employee_id IN (${placeholders})`,
      ...ids,
    );
    return mapWithRelations(employees.map(mapEmployee), skillsRows.map(mapSkill), scheduleRows.map(mapSchedule));
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listEmployeesFromDemo(ctx);
    }
    throw error;
  }
}

export async function getEmployeeById(ctx: EmployeesContext, employeeId: string): Promise<EmployeeWithContext | null> {
  if (ctx.mode === "demo") {
    const record = getDemoEmployee(demoTenantId(ctx), employeeId);
    return record ? buildDemoEmployee(ctx, record) : null;
  }

  try {
    const rows = await queryAll<EmployeeRow>(
      `SELECT id, tenant_id, saas_id, full_name, email, phone, role, avatar_url, notes, is_active, created_at, updated_at
       FROM employees
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      employeeId,
    );
    if (!rows[0]) return null;
    const employee = mapEmployee(rows[0]);
    const skillsRows = await queryAll<EmployeeSkillRow>(
      "SELECT id, employee_id, tenant_id, skill, level, created_at FROM employee_skills WHERE employee_id = ?",
      employeeId,
    );
    const scheduleRows = await queryAll<EmployeeScheduleRow>(
      "SELECT id, employee_id, tenant_id, saas_id, day_of_week, start_time, end_time, break_minutes, created_at, updated_at FROM employee_schedules WHERE employee_id = ?",
      employeeId,
    );
    return { ...employee, skills: skillsRows.map(mapSkill), schedules: scheduleRows.map(mapSchedule) };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoEmployee(demoTenantId(ctx), employeeId);
      return record ? buildDemoEmployee(ctx, record) : null;
    }
    throw error;
  }
}

export async function createEmployee(
  ctx: EmployeesContext,
  payload: {
    saasId?: string | null;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    avatarUrl?: string | null;
    notes?: string | null;
  },
): Promise<EmployeeWithContext> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  if (!saasId) {
    throw new Error("saasId is required to create an employee");
  }

  const demoCreate = () =>
    buildDemoEmployee(
      ctx,
      upsertDemoEmployee(demoTenantId(ctx), {
        saas_id: saasId,
        full_name: payload.fullName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        role: payload.role ?? null,
        avatar_url: payload.avatarUrl ?? null,
        notes: payload.notes ?? null,
      }),
    );

  if (ctx.mode === "demo") {
    return demoCreate();
  }

  try {
    const id = generateUuid();
    await run(
      `INSERT INTO employees (id, tenant_id, saas_id, full_name, email, phone, role, avatar_url, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      payload.fullName,
      payload.email ?? null,
      payload.phone ?? null,
      payload.role ?? null,
      payload.avatarUrl ?? null,
      payload.notes ?? null,
      now,
      now,
    );
    const created = await getEmployeeById(ctx, id);
    if (!created) {
      throw new Error("Employee could not be loaded after creation");
    }
    return created;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoCreate();
    }
    throw error;
  }
}

export async function updateEmployee(
  ctx: EmployeesContext,
  employeeId: string,
  payload: Partial<{
    fullName: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    avatarUrl: string | null;
    notes: string | null;
    isActive: boolean;
  }>,
): Promise<EmployeeWithContext | null> {
  const demoUpdate = () =>
    buildDemoEmployee(
      ctx,
      upsertDemoEmployee(demoTenantId(ctx), {
        id: employeeId,
        full_name: payload.fullName,
        email: typeof payload.email === "undefined" ? undefined : payload.email,
        phone: typeof payload.phone === "undefined" ? undefined : payload.phone,
        role: payload.role,
        avatar_url: typeof payload.avatarUrl === "undefined" ? undefined : payload.avatarUrl,
        notes: typeof payload.notes === "undefined" ? undefined : payload.notes,
        is_active: typeof payload.isActive === "boolean" ? (payload.isActive ? 1 : 0) : undefined,
      }),
    );

  if (ctx.mode === "demo") {
    return demoUpdate();
  }

  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (typeof payload.fullName !== "undefined") {
      fields.push("full_name = ?");
      values.push(payload.fullName);
    }
    if (typeof payload.email !== "undefined") {
      fields.push("email = ?");
      values.push(payload.email);
    }
    if (typeof payload.phone !== "undefined") {
      fields.push("phone = ?");
      values.push(payload.phone);
    }
    if (typeof payload.role !== "undefined") {
      fields.push("role = ?");
      values.push(payload.role);
    }
    if (typeof payload.avatarUrl !== "undefined") {
      fields.push("avatar_url = ?");
      values.push(payload.avatarUrl);
    }
    if (typeof payload.notes !== "undefined") {
      fields.push("notes = ?");
      values.push(payload.notes);
    }
    if (typeof payload.isActive === "boolean") {
      fields.push("is_active = ?");
      values.push(payload.isActive ? 1 : 0);
    }
    if (fields.length === 0) {
      return getEmployeeById(ctx, employeeId);
    }
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(employeeId, ctx.tenantId);
    await run(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    return getEmployeeById(ctx, employeeId);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoUpdate();
    }
    throw error;
  }
}

export async function addEmployeeSkill(
  ctx: EmployeesContext,
  employeeId: string,
  payload: { skill: string; level: string },
): Promise<EmployeeSkill> {
  const demoInsert = () =>
    mapDemoSkill(
      addDemoEmployeeSkill(demoTenantId(ctx), {
        employee_id: employeeId,
        skill: payload.skill,
        level: payload.level,
      }),
    );

  if (ctx.mode === "demo") {
    return demoInsert();
  }

  const id = generateUuid();
  const now = new Date().toISOString();
  try {
    await run(
      "INSERT INTO employee_skills (id, employee_id, tenant_id, skill, level, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      employeeId,
      ctx.tenantId,
      payload.skill,
      payload.level,
      now,
    );
    return { id, employeeId, tenantId: ctx.tenantId, skill: payload.skill, level: payload.level, createdAt: now };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoInsert();
    }
    throw error;
  }
}

export async function listEmployeeRoles(ctx: EmployeesContext, saasId: string | null): Promise<EmployeeRole[]> {
  if (ctx.mode === "demo") {
    return listDemoEmployeeRoles(demoTenantId(ctx), saasId ?? undefined).map(mapDemoRole);
  }

  try {
    const rows = await queryAll<EmployeeRoleRow>(
      `SELECT id, tenant_id, saas_id, slug, label, description, permissions, created_at, updated_at
       FROM employee_roles
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY label ASC`,
      ctx.tenantId,
      saasId ?? ctx.saasId,
    );
    return rows.map(mapRole);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoEmployeeRoles(demoTenantId(ctx), saasId ?? ctx.saasId ?? undefined).map(mapDemoRole);
    }
    throw error;
  }
}

export async function listEmployeeContracts(ctx: EmployeesContext, saasId: string | null): Promise<EmployeeContract[]> {
  if (ctx.mode === "demo") {
    return listDemoEmployeeContracts(demoTenantId(ctx), saasId ?? ctx.saasId ?? undefined).map(mapDemoContract);
  }

  try {
    const rows = await queryAll<EmployeeContractRow>(
      `SELECT id, tenant_id, saas_id, employee_id, contract_type, base_salary_monthly, hourly_rate, commission_percent, max_hours_week, min_hours_week,
              start_date, end_date, is_active, created_at, updated_at
       FROM employee_contracts
       WHERE tenant_id = ? AND saas_id = ?`,
      ctx.tenantId,
      saasId ?? ctx.saasId,
    );
    return rows.map(mapContract);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoEmployeeContracts(demoTenantId(ctx), saasId ?? ctx.saasId ?? undefined).map(mapDemoContract);
    }
    throw error;
  }
}

export async function getEmployeeContract(ctx: EmployeesContext, employeeId: string): Promise<EmployeeContract | null> {
  if (ctx.mode === "demo") {
    const contract = getDemoEmployeeContract(demoTenantId(ctx), ctx.saasId ?? null, employeeId);
    return contract ? mapDemoContract(contract) : null;
  }

  try {
    const rows = await queryAll<EmployeeContractRow>(
      `SELECT id, tenant_id, saas_id, employee_id, contract_type, base_salary_monthly, hourly_rate, commission_percent, max_hours_week, min_hours_week,
              start_date, end_date, is_active, created_at, updated_at
       FROM employee_contracts
       WHERE tenant_id = ? AND employee_id = ? AND is_active = 1
       ORDER BY datetime(start_date) DESC
       LIMIT 1`,
      ctx.tenantId,
      employeeId,
    );
    const row = rows[0];
    return row ? mapContract(row) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const contract = getDemoEmployeeContract(demoTenantId(ctx), ctx.saasId ?? null, employeeId);
      return contract ? mapDemoContract(contract) : null;
    }
    throw error;
  }
}

export async function listEmployeeSchedules(ctx: EmployeesContext, saasId: string | null): Promise<EmployeeSchedule[]> {
  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const employees = listDemoEmployees(tenant, saasId ?? ctx.saasId ?? undefined);
    return employees.flatMap((emp) => listDemoEmployeeSchedules(tenant, emp.id).map(mapDemoSchedule));
  }

  try {
    const rows = await queryAll<EmployeeScheduleRow>(
      `SELECT id, employee_id, tenant_id, saas_id, day_of_week, start_time, end_time, break_minutes, created_at, updated_at
       FROM employee_schedules
       WHERE tenant_id = ? AND saas_id = ?`,
      ctx.tenantId,
      saasId ?? ctx.saasId,
    );
    return rows.map(mapSchedule);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const tenant = demoTenantId(ctx);
      const employees = listDemoEmployees(tenant, saasId ?? ctx.saasId ?? undefined);
      return employees.flatMap((emp) => listDemoEmployeeSchedules(tenant, emp.id).map(mapDemoSchedule));
    }
    throw error;
  }
}

export async function getEmployeeSchedulesByEmployee(ctx: EmployeesContext, employeeId: string): Promise<EmployeeSchedule[]> {
  if (ctx.mode === "demo") {
    return listDemoEmployeeSchedules(demoTenantId(ctx), employeeId).map(mapDemoSchedule);
  }

  try {
    const rows = await queryAll<EmployeeScheduleRow>(
      `SELECT id, employee_id, tenant_id, saas_id, day_of_week, start_time, end_time, break_minutes, created_at, updated_at
       FROM employee_schedules
       WHERE tenant_id = ? AND employee_id = ?`,
      ctx.tenantId,
      employeeId,
    );
    return rows.map(mapSchedule);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoEmployeeSchedules(demoTenantId(ctx), employeeId).map(mapDemoSchedule);
    }
    throw error;
  }
}

function resolveDefaultProfitabilityPeriod(now = new Date()): { fromDate: string; toDate: string; label: string } {
  const to = now;
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate: from.toISOString(), toDate: to.toISOString(), label: "last_30_days" };
}

function hoursBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return diff / (1000 * 60 * 60);
}

function hoursFromTimeRange(start: string, end: string): number {
  const [startH, startM] = start.split(":").map((value) => Number(value));
  const [endH, endM] = end.split(":").map((value) => Number(value));
  if (!Number.isFinite(startH) || !Number.isFinite(endH)) return 0;
  const startMinutes = startH * 60 + (Number.isFinite(startM) ? startM : 0);
  const endMinutes = endH * 60 + (Number.isFinite(endM) ? endM : 0);
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff / 60 : 0;
}

function estimateWeeklyScheduleHours(schedules: EmployeeSchedule[]): number {
  return schedules.reduce((acc, schedule) => {
    const hours = hoursFromTimeRange(schedule.startTime, schedule.endTime);
    const breakHours = schedule.breakMinutes ? schedule.breakMinutes / 60 : 0;
    return acc + Math.max(0, hours - breakHours);
  }, 0);
}

function resolveStatus(marginPercent: number, utilizationPercent: number | null, totalRevenue: number, minMarginPercent: number): EmployeeProfitabilityStatus {
  if (totalRevenue === 0) return "LOW_ACTIVITY";
  if (marginPercent < 0) return "UNPROFITABLE";
  if (marginPercent < minMarginPercent || (utilizationPercent !== null && utilizationPercent < 0.3)) return "TIGHT";
  return "HEALTHY";
}

function buildNotes(status: EmployeeProfitabilityStatus): string {
  switch (status) {
    case "HEALTHY":
      return "Genera buen margen y tiene uso sano.";
    case "TIGHT":
      return "Genera ingresos pero el margen está muy ajustado.";
    case "UNPROFITABLE":
      return "Destruye margen; revisa precios o distribución de servicios.";
    case "LOW_ACTIVITY":
      return "Casi sin actividad; revisa agenda o campañas.";
    default:
      return "";
  }
}

async function getEmployeeAppointmentsInPeriod(
  ctx: EmployeesContext,
  employeeId: string,
  fromDate: string,
  toDate: string,
) {
  const appointmentsCtx = await resolveAppointmentsContext({ tenantId: ctx.tenantId, saasId: ctx.saasId });
  return listSaasAppointmentsForEmployee(appointmentsCtx, employeeId, { from: fromDate, to: toDate });
}

async function getEmployeeProductCostsInPeriod(
  ctx: EmployeesContext,
  employeeId: string,
  fromDate: string,
  toDate: string,
  appointments: Awaited<ReturnType<typeof getEmployeeAppointmentsInPeriod>>,
): Promise<number> {
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId: ctx.saasId }).catch(() => null);
  if (!economyCtx) return 0;
  const inventoryItems = await listSaasInventoryItems(economyCtx).catch(() => []);
  const costMap = new Map(inventoryItems.map((item) => [item.id, item.costPerUnit]));

  if (ctx.mode === "demo") {
    const movements = listDemoSaasInventoryMovements(demoTenantId(ctx), requireSaasId(ctx))
      .filter((movement) => movement.related_employee_id === employeeId)
      .filter((movement) => {
        const ts = new Date(movement.created_at).getTime();
        return ts >= new Date(fromDate).getTime() && ts <= new Date(toDate).getTime();
      });
    const movementCost = movements
      .filter((movement) => movement.type === "OUT")
      .reduce((acc, movement) => acc + Math.abs(movement.quantity) * (costMap.get(movement.inventory_item_id) ?? 0), 0);
    if (movementCost > 0) return movementCost;
  } else {
    const rows = await queryAll<{ inventory_item_id: string; quantity: number; type: string; created_at: string }>(
      `SELECT inventory_item_id, quantity, type, created_at
       FROM saas_inventory_movements
       WHERE tenant_id = ? AND saas_id = ? AND related_employee_id = ? AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)`,
      ctx.tenantId,
      requireSaasId(ctx),
      employeeId,
      fromDate,
      toDate,
    );
    const movementCost = rows
      .filter((row) => row.type === "OUT")
      .reduce((acc, row) => acc + Math.abs(row.quantity) * (costMap.get(row.inventory_item_id) ?? 0), 0);
    if (movementCost > 0) return movementCost;
  }

  const serviceProductMap = new Map<string, { inventoryItemId: string; quantity: number }[]>();
  const uniqueServiceIds = Array.from(new Set(appointments.map((appointment) => appointment.serviceId)));
  for (const serviceId of uniqueServiceIds) {
    const products = ctx.mode === "demo"
      ? listDemoSaasServiceProducts(demoTenantId(ctx), requireSaasId(ctx), serviceId)
      : await listSaasServiceProducts(economyCtx, serviceId).catch(() => []);
    const mapped = products.map((product) => {
      const inventoryItemId = "inventoryItemId" in product ? product.inventoryItemId : product.inventory_item_id;
      const quantity = "quantityPerService" in product ? product.quantityPerService : product.quantity_per_service;
      return { inventoryItemId, quantity };
    });
    serviceProductMap.set(serviceId, mapped);
  }

  return appointments
    .filter((appointment) => appointment.status === "DONE")
    .reduce((acc, appointment) => {
      const products = serviceProductMap.get(appointment.serviceId) ?? [];
      const cost = products.reduce((sum, product) => sum + product.quantity * (costMap.get(product.inventoryItemId) ?? 0), 0);
      return acc + cost;
    }, 0);
}

async function estimateEmployeePayrollCostForPeriod(
  ctx: EmployeesContext,
  employeeId: string,
  fromDate: string,
  toDate: string,
  schedules: EmployeeSchedule[],
): Promise<number> {
  const contract = await getEmployeeContract(ctx, employeeId);
  if (!contract) return 0;
  const days = Math.max(1, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)));
  const scheduleHoursWeek = estimateWeeklyScheduleHours(schedules);
  const contractHoursWeek = contract.maxHoursWeek ?? contract.minHoursWeek ?? scheduleHoursWeek;
  const periodHours = contractHoursWeek > 0 ? contractHoursWeek * (days / 7) : scheduleHoursWeek * (days / 7);
  if (contract.hourlyRate) {
    const hours = periodHours > 0 ? periodHours : scheduleHoursWeek * (days / 7);
    return contract.hourlyRate * hours;
  }
  if (contract.baseSalaryMonthly) {
    return contract.baseSalaryMonthly * (days / 30);
  }
  return 0;
}

export async function getEmployeeProfitabilitySnapshot(
  ctx: EmployeesContext,
  employeeId: string,
  options?: { fromDate?: string; toDate?: string },
): Promise<EmployeeProfitabilitySnapshot> {
  const period = resolveDefaultProfitabilityPeriod();
  const saasId = requireSaasId(ctx);
  const fromDate = options?.fromDate ?? period.fromDate;
  const toDate = options?.toDate ?? period.toDate;
  const appointments = await getEmployeeAppointmentsInPeriod(ctx, employeeId, fromDate, toDate);
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId });
  const [services, pricingSettings, schedules, contract] = await Promise.all([
    listSaasServices(economyCtx).catch(() => []),
    getSaasPricingSettings(economyCtx).catch(() => null),
    getEmployeeSchedulesByEmployee(ctx, employeeId),
    getEmployeeContract(ctx, employeeId),
  ]);
  const servicePriceMap = new Map(services.map((service) => [service.id, service.currentPrice]));
  const completed = appointments.filter((appointment) => appointment.status === "DONE");
  const totalRevenue = completed.reduce((acc, appointment) => {
    const price = appointment.priceAtBooking ?? servicePriceMap.get(appointment.serviceId) ?? 0;
    return acc + price;
  }, 0);
  const hoursBooked = completed.reduce((acc, appointment) => acc + hoursBetween(appointment.scheduledStart, appointment.scheduledEnd), 0);
  const productCosts = await getEmployeeProductCostsInPeriod(ctx, employeeId, fromDate, toDate, appointments);
  const payrollCosts = await estimateEmployeePayrollCostForPeriod(ctx, employeeId, fromDate, toDate, schedules);
  const otherAllocatedCosts = 0;
  const totalCosts = productCosts + payrollCosts + otherAllocatedCosts;
  const marginAbsolute = totalRevenue - totalCosts;
  const marginPercent = totalRevenue > 0 ? (marginAbsolute / totalRevenue) * 100 : 0;
  const daysInPeriod = Math.max(1, (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24));
  const scheduleHoursWeek = estimateWeeklyScheduleHours(schedules);
  const contractHoursWeek = contract?.maxHoursWeek ?? contract?.minHoursWeek ?? scheduleHoursWeek;
  const hoursContractual = contractHoursWeek > 0 ? contractHoursWeek * (daysInPeriod / 7) : scheduleHoursWeek * (daysInPeriod / 7);
  const utilizationPercent = hoursContractual > 0 ? hoursBooked / hoursContractual : null;
  const minMarginPercent = pricingSettings?.minMarginPercent ?? 10;
  const status = resolveStatus(marginPercent, utilizationPercent, totalRevenue, minMarginPercent);
  const notes = buildNotes(status);

  return {
    employeeId,
    tenantId: ctx.tenantId,
    saasId,
    periodLabel: period.label,
    fromDate,
    toDate,
    totalRevenue,
    productCosts,
    payrollCosts,
    otherAllocatedCosts,
    totalCosts,
    marginAbsolute,
    marginPercent,
    appointmentsCount: completed.length,
    hoursBooked,
    hoursWorkedEstimate: hoursContractual,
    effectiveHourlyMargin: hoursBooked > 0 ? marginAbsolute / hoursBooked : 0,
    utilizationPercent,
    status,
    notes,
  };
}

export async function listEmployeesProfitability(
  ctx: EmployeesContext,
  saasId: string,
  options?: { fromDate?: string; toDate?: string },
): Promise<EmployeeProfitabilityListItem[]> {
  const employees = await listEmployees(ctx);
  const active = employees.filter((employee) => employee.saasId === saasId && employee.isActive);
  const period = resolveDefaultProfitabilityPeriod();
  const fromDate = options?.fromDate ?? period.fromDate;
  const toDate = options?.toDate ?? period.toDate;
  const snapshots = await Promise.all(active.map((employee) => getEmployeeProfitabilitySnapshot(ctx, employee.id, { fromDate, toDate })));
  return active.map((employee, index) => ({
    employeeId: employee.id,
    name: employee.fullName,
    roleSlug: employee.role ?? null,
    periodLabel: period.label,
    totalRevenue: snapshots[index]?.totalRevenue ?? 0,
    marginPercent: snapshots[index]?.totalRevenue ? snapshots[index].marginPercent : null,
    utilizationPercent: snapshots[index]?.utilizationPercent ?? null,
    status: snapshots[index]?.status ?? "LOW_ACTIVITY",
  }));
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function calculateWeeklyPlannedMinutes(schedules: EmployeeSchedule[]): number {
  return schedules.reduce((acc, schedule) => acc + Math.max(0, minutesBetween(schedule.startTime, schedule.endTime) - schedule.breakMinutes), 0);
}

function calculatePeriodMultiplier(period: "week" | "month"): number {
  return period === "week" ? 1 : 4;
}

function durationFromAppointment(appointment: DemoClinicAppointment): number {
  if (!appointment.starts_at || !appointment.ends_at) return 0;
  const start = new Date(appointment.starts_at).getTime();
  const end = appointment.ends_at ? new Date(appointment.ends_at).getTime() : start;
  return Math.max(0, end - start);
}

async function listAppointmentsForEmployee(ctx: EmployeesContext, employeeId: string, period: "week" | "month"): Promise<number> {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate() - (period === "week" ? 7 : 30));

  if (ctx.mode === "demo") {
    const tenant = demoTenantId(ctx);
    const saas = ctx.saasId ?? listDemoEmployees(tenant)[0]?.saas_id ?? "";
    const appointments = listDemoClinicAppointments(tenant, saas).filter((appt) => {
      const anyAppointment = appt as DemoClinicAppointment & { employee_id?: string | null };
      return anyAppointment.employee_id === employeeId || appt.staff_name === employeeId;
    });
    return appointments
      .filter((appt) => new Date(appt.starts_at).getTime() >= rangeStart.getTime() && appt.status === "done")
      .reduce((acc, appt) => acc + durationFromAppointment(appt) / (60 * 60 * 1000), 0);
  }

  const rows = await queryAll<{
    starts_at: string;
    ends_at: string | null;
    status: string;
  }>(
    `SELECT starts_at, ends_at, status
     FROM clinic_appointments
     WHERE tenant_id = ? AND saas_id = ? AND employee_id = ? AND status = 'done' AND datetime(starts_at) >= datetime(?)`,
    ctx.tenantId,
    ctx.saasId,
    employeeId,
    rangeStart.toISOString(),
  );

  return rows.reduce((acc, row) => {
    const startTs = new Date(row.starts_at).getTime();
    const endTs = row.ends_at ? new Date(row.ends_at).getTime() : startTs;
    return acc + Math.max(0, endTs - startTs) / (60 * 60 * 1000);
  }, 0);
}

export async function getEmployeeWorkloadSnapshot(
  ctx: EmployeesContext,
  employeeId: string,
  period: "week" | "month",
): Promise<EmployeeWorkloadSnapshot> {
  const schedules = await getEmployeeSchedulesByEmployee(ctx, employeeId);
  const plannedWeeklyMinutes = calculateWeeklyPlannedMinutes(schedules);
  const plannedHours = (plannedWeeklyMinutes / 60) * calculatePeriodMultiplier(period);
  const actualHours = await listAppointmentsForEmployee(ctx, employeeId, period);
  const extraHours = Math.max(0, actualHours - plannedHours);

  return {
    plannedHours,
    actualHours,
    extraHours,
  };
}

export async function addEmployeeSchedule(
  ctx: EmployeesContext,
  employeeId: string,
  payload: { dayOfWeek: number; startTime: string; endTime: string; breakMinutes?: number },
): Promise<EmployeeSchedule> {
  const demoTenant = demoTenantId(ctx);
  const resolvedSaasId =
    ctx.saasId ?? (ctx.mode === "demo" ? getDemoEmployee(demoTenant, employeeId)?.saas_id : undefined);

  if (!resolvedSaasId) {
    throw new Error("saasId is required to add an employee schedule");
  }

  const demoInsert = () =>
    mapDemoSchedule(
      addDemoEmployeeSchedule(demoTenant, {
        employee_id: employeeId,
        saas_id: resolvedSaasId,
        day_of_week: payload.dayOfWeek,
        start_time: payload.startTime,
        end_time: payload.endTime,
        break_minutes: payload.breakMinutes ?? 0,
      }),
    );

  if (ctx.mode === "demo") {
    return demoInsert();
  }

  const id = generateUuid();
  const now = new Date().toISOString();
  try {
    await run(
      "INSERT INTO employee_schedules (id, employee_id, tenant_id, saas_id, day_of_week, start_time, end_time, break_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      employeeId,
      ctx.tenantId,
      resolvedSaasId,
      payload.dayOfWeek,
      payload.startTime,
      payload.endTime,
      payload.breakMinutes ?? 0,
      now,
      now,
    );
    return {
      id,
      employeeId,
      tenantId: ctx.tenantId,
      saasId: resolvedSaasId,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      breakMinutes: payload.breakMinutes ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoInsert();
    }
    throw error;
  }
}
