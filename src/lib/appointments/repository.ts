import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import {
  getDemoSaasAppointment,
  listDemoAppointmentsForEmployee,
  listDemoSaasAppointments,
  upsertDemoSaasAppointment,
} from "@/lib/admin/demo-data";
import { resolveEconomyContext, listSaasServiceProducts, recordInventoryMovement } from "@/lib/economy/repository";
import type { SaasInventoryMovement } from "@/lib/economy/types";
import type { SaasAppointment, AppointmentStatus, AppointmentListFilter } from "@/lib/appointments/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type AppointmentsContextMode = "d1" | "demo";

export type AppointmentsContext = {
  tenantId: string;
  saasId: string | null;
  mode: AppointmentsContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class AppointmentsContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentsContextError";
  }
}

type AppointmentRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  service_id: string;
  employee_id: string;
  customer_id: string | null;
  client_name: string;
  client_contact: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  price_at_booking: number | null;
  social_campaign_id: string | null;
  social_post_id: string | null;
  source_channel: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: AppointmentsContext): boolean {
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

function demoTenantId(ctx: AppointmentsContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: AppointmentsContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new AppointmentsContextError("saasId is required for appointments.");
  }
  return saasId;
}

async function queryAllWithCtx<T>(ctx: AppointmentsContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: AppointmentsContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

function mapAppointmentRow(row: AppointmentRow): SaasAppointment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    serviceId: row.service_id,
    employeeId: row.employee_id,
    customerId: row.customer_id,
    clientName: row.client_name,
    clientContact: row.client_contact,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    status: row.status as AppointmentStatus,
    priceAtBooking: row.price_at_booking,
    socialCampaignId: row.social_campaign_id,
    socialPostId: row.social_post_id,
    sourceChannel: (row.source_channel as SaasAppointment["sourceChannel"]) ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildDateFilter(filter?: AppointmentListFilter): { clause: string; params: unknown[] } {
  if (!filter) return { clause: "", params: [] };
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (filter.from) {
    clauses.push("datetime(scheduled_start) >= datetime(?)");
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push("datetime(scheduled_start) <= datetime(?)");
    params.push(filter.to);
  }
  if (!clauses.length) return { clause: "", params: [] };
  return { clause: ` AND ${clauses.join(" AND ")}`, params };
}

export async function resolveAppointmentsContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<AppointmentsContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env,
    };
  }

  if (!demoEnabled) {
    throw new AppointmentsContextError("Appointments module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

export async function listAppointmentsForEmployee(
  ctx: AppointmentsContext,
  employeeId: string,
  filter?: AppointmentListFilter,
): Promise<SaasAppointment[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoAppointmentsForEmployee(demoTenantId(ctx), saasId, employeeId, filter).map((row) => mapAppointmentRow(row));
  }
  try {
    const dateFilter = buildDateFilter(filter);
    const rows = await queryAllWithCtx<AppointmentRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, employee_id, customer_id, client_name, client_contact, scheduled_start, scheduled_end,
              status, price_at_booking, social_campaign_id, social_post_id, source_channel, notes, created_at, updated_at
       FROM saas_appointments
       WHERE tenant_id = ? AND saas_id = ? AND employee_id = ?${dateFilter.clause}
       ORDER BY datetime(scheduled_start) ASC`,
      ctx.tenantId,
      saasId,
      employeeId,
      ...dateFilter.params,
    );
    return rows.map(mapAppointmentRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoAppointmentsForEmployee(demoTenantId(ctx), saasId, employeeId, filter).map((row) => mapAppointmentRow(row));
    }
    throw error;
  }
}

export async function listAppointmentsForSaas(
  ctx: AppointmentsContext,
  filter?: AppointmentListFilter,
): Promise<SaasAppointment[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasAppointments(demoTenantId(ctx), saasId, filter).map((row) => mapAppointmentRow(row));
  }
  try {
    const dateFilter = buildDateFilter(filter);
    const rows = await queryAllWithCtx<AppointmentRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, employee_id, customer_id, client_name, client_contact, scheduled_start, scheduled_end,
              status, price_at_booking, social_campaign_id, social_post_id, source_channel, notes, created_at, updated_at
       FROM saas_appointments
       WHERE tenant_id = ? AND saas_id = ?${dateFilter.clause}
       ORDER BY datetime(scheduled_start) ASC`,
      ctx.tenantId,
      saasId,
      ...dateFilter.params,
    );
    return rows.map(mapAppointmentRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasAppointments(demoTenantId(ctx), saasId, filter).map((row) => mapAppointmentRow(row));
    }
    throw error;
  }
}

export async function getAppointmentById(ctx: AppointmentsContext, id: string): Promise<SaasAppointment | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoSaasAppointment(demoTenantId(ctx), id, saasId);
    return record ? mapAppointmentRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<AppointmentRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, employee_id, customer_id, client_name, client_contact, scheduled_start, scheduled_end,
              status, price_at_booking, social_campaign_id, social_post_id, source_channel, notes, created_at, updated_at
       FROM saas_appointments
       WHERE tenant_id = ? AND saas_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      id,
    );
    return rows[0] ? mapAppointmentRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasAppointment(demoTenantId(ctx), id, saasId);
      return record ? mapAppointmentRow(record) : null;
    }
    throw error;
  }
}

export async function upsertAppointment(
  ctx: AppointmentsContext,
  input: {
    id?: string;
    saasId?: string | null;
    serviceId: string;
    employeeId: string;
    customerId?: string | null;
    clientName: string;
    clientContact?: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    status?: AppointmentStatus;
    priceAtBooking?: number | null;
    socialCampaignId?: string | null;
    socialPostId?: string | null;
    sourceChannel?: SaasAppointment["sourceChannel"];
    notes?: string | null;
  },
): Promise<SaasAppointment> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasAppointment(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      service_id: input.serviceId,
      employee_id: input.employeeId,
      customer_id: input.customerId ?? null,
      client_name: input.clientName,
      client_contact: input.clientContact ?? null,
      scheduled_start: input.scheduledStart,
      scheduled_end: input.scheduledEnd,
      status: input.status ?? "PENDING",
      price_at_booking: typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
      social_campaign_id: input.socialCampaignId ?? null,
      social_post_id: input.socialPostId ?? null,
      source_channel: input.sourceChannel ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    });
    return mapAppointmentRow(record);
  }
  try {
    const existing = await queryAllWithCtx<Pick<AppointmentRow, "created_at">>(
      ctx,
      `SELECT created_at FROM saas_appointments WHERE tenant_id = ? AND saas_id = ? AND id = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
      id,
    );
    const createdAt = existing[0]?.created_at ?? now;
    await runWithCtx(
      ctx,
      `INSERT INTO saas_appointments (
         id, tenant_id, saas_id, service_id, employee_id, customer_id, client_name, client_contact,
         scheduled_start, scheduled_end, status, price_at_booking, social_campaign_id, social_post_id, source_channel, notes, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         service_id = excluded.service_id,
         employee_id = excluded.employee_id,
         customer_id = excluded.customer_id,
         client_name = excluded.client_name,
         client_contact = excluded.client_contact,
         scheduled_start = excluded.scheduled_start,
         scheduled_end = excluded.scheduled_end,
         status = excluded.status,
         price_at_booking = excluded.price_at_booking,
         social_campaign_id = excluded.social_campaign_id,
         social_post_id = excluded.social_post_id,
         source_channel = excluded.source_channel,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.serviceId,
      input.employeeId,
      input.customerId ?? null,
      input.clientName,
      input.clientContact ?? null,
      input.scheduledStart,
      input.scheduledEnd,
      input.status ?? "PENDING",
      typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
      input.socialCampaignId ?? null,
      input.socialPostId ?? null,
      input.sourceChannel ?? null,
      input.notes ?? null,
      createdAt,
      now,
    );
    const row = await getAppointmentById(ctx, id);
    if (!row) {
      throw new Error("Appointment not found after upsert");
    }
    return row;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasAppointment(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        service_id: input.serviceId,
        employee_id: input.employeeId,
        customer_id: input.customerId ?? null,
        client_name: input.clientName,
        client_contact: input.clientContact ?? null,
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
        status: input.status ?? "PENDING",
        price_at_booking: typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
        social_campaign_id: input.socialCampaignId ?? null,
        social_post_id: input.socialPostId ?? null,
        source_channel: input.sourceChannel ?? null,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      });
      return mapAppointmentRow(record);
    }
    throw error;
  }
}

export async function updateAppointmentStatus(
  ctx: AppointmentsContext,
  id: string,
  status: AppointmentStatus,
): Promise<SaasAppointment | null> {
  const appointment = await getAppointmentById(ctx, id);
  if (!appointment) return null;
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasAppointment(demoTenantId(ctx), {
      id: appointment.id,
      saas_id: appointment.saasId,
      service_id: appointment.serviceId,
      employee_id: appointment.employeeId,
      customer_id: appointment.customerId ?? null,
      client_name: appointment.clientName,
      client_contact: appointment.clientContact ?? null,
      scheduled_start: appointment.scheduledStart,
      scheduled_end: appointment.scheduledEnd,
      status,
      price_at_booking: appointment.priceAtBooking,
      social_campaign_id: appointment.socialCampaignId ?? null,
      social_post_id: appointment.socialPostId ?? null,
      source_channel: appointment.sourceChannel ?? null,
      notes: appointment.notes,
      created_at: appointment.createdAt,
      updated_at: new Date().toISOString(),
    });
    return mapAppointmentRow(record);
  }
  try {
    const now = new Date().toISOString();
    await runWithCtx(
      ctx,
      `UPDATE saas_appointments
       SET status = ?, updated_at = ?
       WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
      status,
      now,
      ctx.tenantId,
      appointment.saasId,
      appointment.id,
    );
    return await getAppointmentById(ctx, id);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasAppointment(demoTenantId(ctx), {
        id: appointment.id,
        saas_id: appointment.saasId,
        service_id: appointment.serviceId,
        employee_id: appointment.employeeId,
        customer_id: appointment.customerId ?? null,
        client_name: appointment.clientName,
        client_contact: appointment.clientContact ?? null,
        scheduled_start: appointment.scheduledStart,
        scheduled_end: appointment.scheduledEnd,
        status,
        price_at_booking: appointment.priceAtBooking,
        social_campaign_id: appointment.socialCampaignId ?? null,
        social_post_id: appointment.socialPostId ?? null,
        source_channel: appointment.sourceChannel ?? null,
        notes: appointment.notes,
        created_at: appointment.createdAt,
        updated_at: new Date().toISOString(),
      });
      return mapAppointmentRow(record);
    }
    throw error;
  }
}

export async function recordServiceConsumptionForAppointment(
  ctx: AppointmentsContext,
  appointmentId: string,
): Promise<SaasInventoryMovement[]> {
  const appointment = await getAppointmentById(ctx, appointmentId);
  if (!appointment) return [];
  const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId: appointment.saasId, env: ctx.env }).catch(() => null);
  if (!economyCtx) return [];
  const products = await listSaasServiceProducts(economyCtx, appointment.serviceId).catch(() => []);
  if (products.length === 0) return [];
  const movements = await Promise.all(
    products.map((product) =>
      recordInventoryMovement(economyCtx, {
        saasId: appointment.saasId,
        inventoryItemId: product.inventoryItemId,
        type: "OUT",
        quantity: product.quantityPerService,
        reason: "SERVICE_USAGE",
        source: "SERVICE_USAGE",
        relatedServiceId: appointment.serviceId,
        relatedEmployeeId: appointment.employeeId,
      }),
    ),
  );
  return movements;
}
