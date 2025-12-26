import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import {
  addDemoSaasCustomerBooking,
  addDemoSaasCustomerStyleNote,
  getDemoSaasCustomer,
  getDemoSaasCustomerMetrics,
  getDemoSaasCustomerProfile,
  listDemoSaasAppointments,
  listDemoSaasCustomerStyleNotes,
  listDemoSaasCustomerBookings,
  listDemoSaasCustomers,
  upsertDemoSaasCustomer,
  upsertDemoSaasCustomerMetrics,
  upsertDemoSaasCustomerProfile,
} from "@/lib/admin/demo-data";
import { consumeInventoryForBooking, resolveEconomyContext } from "@/lib/economy/repository";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type { AppointmentStatus, SaasAppointment } from "@/lib/appointments/types";
import type {
  CustomerStyleProfile,
  CustomerBookingStatus,
  SaasCustomerInput,
  CustomerValueSnapshot,
  SaasCustomer,
  SaasCustomerBooking,
  SaasCustomerMetrics,
  SaasCustomerProfile,
  SaasCustomerStyleNote,
  SaasCustomerVipLevel,
} from "@/lib/customers/types";

export type CustomersContextMode = "d1" | "demo";

export type CustomersContext = {
  tenantId: string;
  saasId: string | null;
  mode: CustomersContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class CustomersContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomersContextError";
  }
}

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

function shouldFallbackToDemo(error: unknown, ctx: CustomersContext): boolean {
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

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function serializeJson(input: Record<string, unknown> | unknown[] | null | undefined): string | null {
  if (!input) return null;
  try {
    return JSON.stringify(input);
  } catch {
    return null;
  }
}

function requireSaasId(ctx: CustomersContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new CustomersContextError("saasId is required for customers operations.");
  }
  return saasId;
}

function resolveDayRange(day?: string | null): { start: Date; end: Date } | null {
  if (!day) return null;
  if (day === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed);
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function queryAllWithCtx<T>(ctx: CustomersContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: CustomersContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveCustomersContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<CustomersContext> {
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
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new CustomersContextError("Customers module is not enabled for this tenant");
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

type SaasCustomerRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  preferred_employee_id: string | null;
  preferred_services: string | null;
  style_profile: string | null;
  is_vip: number;
  vip_level: string | null;
  created_at: string;
  updated_at: string;
};

type SaasCustomerProfileRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  tags: string | null;
  preferences: string | null;
  birthday: string | null;
  style_profile_json: string | null;
  last_style_review_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SaasCustomerStyleNoteRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  note_type: string;
  content: string;
  source: string;
  created_at: string;
};

function normalizeVipLevel(value?: string | null, isVip?: number | boolean | null): SaasCustomerVipLevel {
  const raw = value?.toUpperCase();
  if (raw === "VIP" || raw === "VVIP" || raw === "REGULAR") return raw;
  if (isVip) return "VIP";
  return "REGULAR";
}

type SaasCustomerBookingRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  service_id: string;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  status: CustomerBookingStatus;
  price_at_booking: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SaasCustomerMetricsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  total_visits: number;
  total_revenue: number;
  last_visit_at: string | null;
  avg_ticket: number | null;
  no_show_count: number;
  created_at: string;
  updated_at: string;
};

type SaasAppointmentRow = {
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
  status: AppointmentStatus;
  price_at_booking: number | null;
  social_campaign_id: string | null;
  social_post_id: string | null;
  source_channel: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapCustomerRow(row: SaasCustomerRow): SaasCustomer {
  const vipLevel = normalizeVipLevel(row.vip_level, row.is_vip);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    preferredEmployeeId: row.preferred_employee_id,
    preferredServices: parseJson<string[]>(row.preferred_services),
    styleProfile: parseJson<CustomerStyleProfile>(row.style_profile),
    isVip: row.is_vip === 1 || vipLevel !== "REGULAR",
    vipLevel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileRow(row: SaasCustomerProfileRow): SaasCustomerProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    customerId: row.customer_id,
    tags: parseJson<string[]>(row.tags),
    preferences: parseJson<Record<string, unknown>>(row.preferences),
    birthday: row.birthday,
    styleProfile: parseJson<Record<string, unknown>>(row.style_profile_json),
    lastStyleReviewAt: row.last_style_review_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStyleNoteRow(row: SaasCustomerStyleNoteRow): SaasCustomerStyleNote {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    customerId: row.customer_id,
    noteType: row.note_type,
    content: row.content,
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapBookingRow(row: SaasCustomerBookingRow): SaasCustomerBooking {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    employeeId: row.employee_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    priceAtBooking: row.price_at_booking,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMetricsRow(row: SaasCustomerMetricsRow): SaasCustomerMetrics {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    customerId: row.customer_id,
    totalVisits: row.total_visits,
    totalRevenue: row.total_revenue,
    lastVisitAt: row.last_visit_at,
    avgTicket: row.avg_ticket,
    noShowCount: row.no_show_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointmentRow(row: SaasAppointmentRow): SaasAppointment {
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
    status: row.status,
    priceAtBooking: row.price_at_booking,
    socialCampaignId: row.social_campaign_id,
    socialPostId: row.social_post_id,
    sourceChannel: (row.source_channel as SaasAppointment["sourceChannel"]) ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function computeMetricsFromBookings(bookings: SaasCustomerBooking[]): Omit<SaasCustomerMetrics, "id" | "tenantId" | "saasId" | "customerId" | "createdAt" | "updatedAt"> {
  const completed = bookings.filter((booking) => booking.status === "DONE");
  const totalVisits = completed.length;
  const totalRevenue = completed.reduce((acc, booking) => acc + (booking.priceAtBooking ?? 0), 0);
  const lastVisitAt =
    completed.length > 0 ? completed.map((b) => b.endTime ?? b.startTime).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] : null;
  const avgTicket = totalVisits > 0 ? totalRevenue / totalVisits : null;
  const noShowCount = bookings.filter((booking) => booking.status === "NO_SHOW").length;
  return { totalVisits, totalRevenue, lastVisitAt, avgTicket, noShowCount };
}

function demoTenantId(ctx: CustomersContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

export async function listSaasCustomers(
  ctx: CustomersContext,
  filters?: { search?: string | null; isVip?: boolean },
): Promise<SaasCustomer[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const items = listDemoSaasCustomers(demoTenantId(ctx), saasId);
    const normalized = filters?.search?.trim().toLowerCase();
    const filtered = normalized
      ? items.filter(
          (item) =>
            item.full_name.toLowerCase().includes(normalized) ||
            item.email?.toLowerCase().includes(normalized) ||
            item.phone?.toLowerCase().includes(normalized),
        )
      : items;
    return (filters?.isVip === undefined ? filtered : filtered.filter((item) => item.is_vip === (filters.isVip ? 1 : 0))).map(mapCustomerRow);
  }
  const conditions = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [ctx.tenantId, saasId];
  if (filters?.search?.trim()) {
    const search = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push("(lower(full_name) LIKE ? OR lower(email) LIKE ? OR phone LIKE ?)");
    params.push(search, search, `%${filters.search.trim()}%`);
  }
  if (filters?.isVip !== undefined) {
    conditions.push("is_vip = ?");
    params.push(filters.isVip ? 1 : 0);
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, full_name, email, phone, notes, preferred_employee_id, preferred_services, style_profile,
              is_vip, vip_level, created_at, updated_at
       FROM saas_customers
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC`,
      ...params,
    );
    return rows.map(mapCustomerRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const items = listDemoSaasCustomers(demoTenantId(ctx), saasId);
      return items.map(mapCustomerRow);
    }
    throw error;
  }
}

export async function findCustomerByContact(ctx: CustomersContext, contact: { email?: string | null; phone?: string | null }): Promise<SaasCustomer | null> {
  const saasId = requireSaasId(ctx);
  const normalizedEmail = contact.email?.trim().toLowerCase();
  const normalizedPhone = contact.phone?.trim();

  if (ctx.mode === "demo") {
    const items = listDemoSaasCustomers(demoTenantId(ctx), saasId);
    const match = items.find((item) => {
      const emailMatch = normalizedEmail && item.email?.toLowerCase() === normalizedEmail;
      const phoneMatch = normalizedPhone && item.phone === normalizedPhone;
      return emailMatch || phoneMatch;
    });
    return match ? mapCustomerRow(match) : null;
  }
  const conditions = ["tenant_id = ?", "saas_id = ?"];
  const params: unknown[] = [ctx.tenantId, saasId];
  if (normalizedEmail) {
    conditions.push("lower(email) = ?");
    params.push(normalizedEmail);
  }
  if (normalizedPhone) {
    conditions.push("phone = ?");
    params.push(normalizedPhone);
  }
  if (conditions.length <= 2) return null;
  try {
    const rows = await queryAllWithCtx<SaasCustomerRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, full_name, email, phone, notes, preferred_employee_id, preferred_services, style_profile,
              is_vip, vip_level, created_at, updated_at
       FROM saas_customers
       WHERE ${conditions.join(" OR ")}
       LIMIT 1`,
      ...params,
    );
    return rows[0] ? mapCustomerRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const items = listDemoSaasCustomers(demoTenantId(ctx), saasId);
      const match = items.find((item) => {
        const emailMatch = normalizedEmail && item.email?.toLowerCase() === normalizedEmail;
        const phoneMatch = normalizedPhone && item.phone === normalizedPhone;
        return emailMatch || phoneMatch;
      });
      return match ? mapCustomerRow(match) : null;
    }
    throw error;
  }
}

export async function getSaasCustomer(ctx: CustomersContext, customerId: string): Promise<SaasCustomer | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoSaasCustomer(demoTenantId(ctx), customerId, saasId);
    return record ? mapCustomerRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, full_name, email, phone, notes, preferred_employee_id, preferred_services, style_profile,
              is_vip, vip_level, created_at, updated_at
       FROM saas_customers
       WHERE id = ? AND tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      customerId,
      ctx.tenantId,
      saasId,
    );
    return rows[0] ? mapCustomerRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasCustomer(demoTenantId(ctx), customerId, saasId);
      return record ? mapCustomerRow(record) : null;
    }
    throw error;
  }
}

export async function upsertSaasCustomer(ctx: CustomersContext, input: SaasCustomerInput): Promise<SaasCustomer> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasCustomer(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      full_name: input.fullName.trim(),
      email: input.email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      preferred_employee_id: input.preferredEmployeeId ?? null,
      preferred_services: serializeJson(input.preferredServices),
      style_profile: serializeJson(input.styleProfile),
      is_vip: input.isVip ? 1 : 0,
      vip_level: input.vipLevel ?? (input.isVip ? "VIP" : "REGULAR"),
    });
    return mapCustomerRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_customers (
         id, tenant_id, saas_id, full_name, email, phone, notes,
         preferred_employee_id, preferred_services, style_profile, is_vip, vip_level, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         full_name = excluded.full_name,
         email = excluded.email,
         phone = excluded.phone,
         notes = excluded.notes,
         preferred_employee_id = excluded.preferred_employee_id,
         preferred_services = excluded.preferred_services,
         style_profile = excluded.style_profile,
         is_vip = excluded.is_vip,
         vip_level = excluded.vip_level,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.fullName.trim(),
      input.email?.trim() ?? null,
      input.phone?.trim() ?? null,
      input.notes?.trim() ?? null,
      input.preferredEmployeeId ?? null,
      serializeJson(input.preferredServices),
      serializeJson(input.styleProfile),
      input.isVip ? 1 : 0,
      input.vipLevel ?? (input.isVip ? "VIP" : "REGULAR"),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasCustomerRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, full_name, email, phone, notes, preferred_employee_id, preferred_services, style_profile,
              is_vip, vip_level, created_at, updated_at
       FROM saas_customers
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapCustomerRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasCustomer(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        full_name: input.fullName.trim(),
        email: input.email?.trim() ?? null,
        phone: input.phone?.trim() ?? null,
        notes: input.notes?.trim() ?? null,
        preferred_employee_id: input.preferredEmployeeId ?? null,
        preferred_services: serializeJson(input.preferredServices),
        style_profile: serializeJson(input.styleProfile),
        is_vip: input.isVip ? 1 : 0,
        vip_level: input.vipLevel ?? (input.isVip ? "VIP" : "REGULAR"),
      });
      return mapCustomerRow(record);
    }
    throw error;
  }
}

export async function createSaasCustomer(ctx: CustomersContext, input: SaasCustomerInput): Promise<SaasCustomer> {
  return upsertSaasCustomer(ctx, { ...input, id: input.id?.trim() || undefined });
}

export async function updateSaasCustomer(
  ctx: CustomersContext,
  customerId: string,
  input: Partial<SaasCustomerInput>,
): Promise<SaasCustomer> {
  const current = await getSaasCustomer(ctx, customerId);
  if (!current) {
    throw new CustomersContextError("Customer not found");
  }
  return upsertSaasCustomer(ctx, {
    id: customerId,
    saasId: input.saasId ?? current.saasId,
    fullName: input.fullName ?? current.fullName,
    email: typeof input.email === "undefined" ? current.email : input.email,
    phone: typeof input.phone === "undefined" ? current.phone : input.phone,
    notes: typeof input.notes === "undefined" ? current.notes : input.notes,
    preferredEmployeeId:
      typeof input.preferredEmployeeId === "undefined" ? current.preferredEmployeeId : input.preferredEmployeeId,
    preferredServices: typeof input.preferredServices === "undefined" ? current.preferredServices : input.preferredServices,
    styleProfile: typeof input.styleProfile === "undefined" ? current.styleProfile : input.styleProfile,
    isVip: typeof input.isVip === "undefined" ? current.isVip : input.isVip,
    vipLevel: input.vipLevel ?? current.vipLevel,
  });
}

export async function findOrCreateCustomerByContact(
  ctx: CustomersContext,
  input: Pick<SaasCustomerInput, "saasId" | "fullName" | "email" | "phone">,
): Promise<SaasCustomer> {
  const existing = await findCustomerByContact(ctx, { email: input.email, phone: input.phone });
  if (existing) return existing;
  return createSaasCustomer(ctx, {
    saasId: input.saasId,
    fullName: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
  });
}

export async function getSaasCustomerProfile(ctx: CustomersContext, customerId: string): Promise<SaasCustomerProfile | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoSaasCustomerProfile(demoTenantId(ctx), customerId, saasId);
    return record ? mapProfileRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerProfileRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, tags, preferences, birthday, style_profile_json, last_style_review_at, metadata, created_at, updated_at
       FROM saas_customer_profiles
       WHERE tenant_id = ? AND saas_id = ? AND customer_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      customerId,
    );
    return rows[0] ? mapProfileRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasCustomerProfile(demoTenantId(ctx), customerId, saasId);
      return record ? mapProfileRow(record) : null;
    }
    throw error;
  }
}

export async function upsertSaasCustomerProfile(
  ctx: CustomersContext,
  input: {
    id?: string;
    saasId: string;
    customerId: string;
    tags?: string[] | null;
    preferences?: Record<string, unknown> | null;
    birthday?: string | null;
    styleProfile?: Record<string, unknown> | null;
    lastStyleReviewAt?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasCustomerProfile> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasCustomerProfile(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      customer_id: input.customerId,
      tags: serializeJson(input.tags),
      preferences: serializeJson(input.preferences),
      birthday: input.birthday ?? null,
      style_profile_json: serializeJson(input.styleProfile),
      last_style_review_at: typeof input.lastStyleReviewAt === "undefined" ? null : input.lastStyleReviewAt,
      metadata: serializeJson(input.metadata),
    });
    return mapProfileRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_customer_profiles (id, tenant_id, saas_id, customer_id, tags, preferences, birthday, style_profile_json, last_style_review_at, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         tags = excluded.tags,
         preferences = excluded.preferences,
         birthday = excluded.birthday,
         style_profile_json = excluded.style_profile_json,
         last_style_review_at = excluded.last_style_review_at,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.customerId,
      serializeJson(input.tags),
      serializeJson(input.preferences),
      input.birthday ?? null,
      serializeJson(input.styleProfile),
      typeof input.lastStyleReviewAt === "undefined" ? null : input.lastStyleReviewAt,
      serializeJson(input.metadata),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasCustomerProfileRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, tags, preferences, birthday, style_profile_json, last_style_review_at, metadata, created_at, updated_at
       FROM saas_customer_profiles
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapProfileRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasCustomerProfile(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        customer_id: input.customerId,
        tags: serializeJson(input.tags),
        preferences: serializeJson(input.preferences),
        birthday: input.birthday ?? null,
        style_profile_json: serializeJson(input.styleProfile),
        last_style_review_at: typeof input.lastStyleReviewAt === "undefined" ? null : input.lastStyleReviewAt,
        metadata: serializeJson(input.metadata),
      });
      return mapProfileRow(record);
    }
    throw error;
  }
}

export async function getCustomerWithProfile(
  ctx: CustomersContext,
  customerId: string,
): Promise<{ customer: SaasCustomer | null; profile: SaasCustomerProfile | null }> {
  const [customer, profile] = await Promise.all([getSaasCustomer(ctx, customerId), getSaasCustomerProfile(ctx, customerId)]);
  return { customer, profile };
}

export async function listCustomerBookings(
  ctx: CustomersContext,
  customerId: string,
  options?: { limit?: number; from?: string | null; to?: string | null },
): Promise<SaasCustomerBooking[]> {
  const saasId = requireSaasId(ctx);
  const limit = options?.limit && options.limit > 0 ? options.limit : null;
  const from = options?.from ?? null;
  const to = options?.to ?? null;
  if (ctx.mode === "demo") {
    let items = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
    if (from) items = items.filter((booking) => new Date(booking.startTime) >= new Date(from));
    if (to) items = items.filter((booking) => new Date(booking.startTime) <= new Date(to));
    items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return limit ? items.slice(0, limit) : items;
  }
  try {
    const clauses = ["tenant_id = ?", "saas_id = ?", "customer_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId, customerId];
    if (from) {
      clauses.push("start_time >= ?");
      params.push(from);
    }
    if (to) {
      clauses.push("start_time <= ?");
      params.push(to);
    }
    const rows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(start_time) DESC`,
      ...params,
    );
    const mapped = rows.map(mapBookingRow);
    return limit ? mapped.slice(0, limit) : mapped;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      let items = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
      if (from) items = items.filter((booking) => new Date(booking.startTime) >= new Date(from));
      if (to) items = items.filter((booking) => new Date(booking.startTime) <= new Date(to));
      items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      return limit ? items.slice(0, limit) : items;
    }
    throw error;
  }
}

export async function listCustomerAppointments(
  ctx: CustomersContext,
  customerId: string,
  options?: { from?: string | null; to?: string | null },
): Promise<SaasAppointment[]> {
  const saasId = requireSaasId(ctx);
  const from = options?.from ?? null;
  const to = options?.to ?? null;
  if (ctx.mode === "demo") {
    return listDemoSaasAppointments(demoTenantId(ctx), saasId, { from, to, customerId }).map(mapAppointmentRow);
  }
  try {
    const clauses = ["tenant_id = ?", "saas_id = ?", "customer_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId, customerId];
    if (from) {
      clauses.push("datetime(scheduled_start) >= datetime(?)");
      params.push(from);
    }
    if (to) {
      clauses.push("datetime(scheduled_start) <= datetime(?)");
      params.push(to);
    }
    const rows = await queryAllWithCtx<SaasAppointmentRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, employee_id, customer_id, client_name, client_contact, scheduled_start, scheduled_end,
              status, price_at_booking, social_campaign_id, social_post_id, source_channel, notes, created_at, updated_at
       FROM saas_appointments
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(scheduled_start) ASC`,
      ...params,
    );
    return rows.map(mapAppointmentRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasAppointments(demoTenantId(ctx), saasId, { from, to, customerId }).map(mapAppointmentRow);
    }
    throw error;
  }
}

export async function listCustomerStyleNotes(ctx: CustomersContext, customerId: string): Promise<SaasCustomerStyleNote[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasCustomerStyleNotes(demoTenantId(ctx), customerId, saasId).map(mapStyleNoteRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerStyleNoteRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, note_type, content, source, created_at
       FROM saas_customer_style_notes
       WHERE tenant_id = ? AND saas_id = ? AND customer_id = ?
       ORDER BY datetime(created_at) DESC`,
      ctx.tenantId,
      saasId,
      customerId,
    );
    return rows.map(mapStyleNoteRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasCustomerStyleNotes(demoTenantId(ctx), customerId, saasId).map(mapStyleNoteRow);
    }
    throw error;
  }
}

export async function addCustomerStyleNote(
  ctx: CustomersContext,
  input: {
    customerId: string;
    saasId: string;
    noteType: string;
    content: string;
    source: string;
    createdAt?: string;
  },
): Promise<SaasCustomerStyleNote> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = generateUuid();
  if (ctx.mode === "demo") {
    const record = addDemoSaasCustomerStyleNote(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      customer_id: input.customerId,
      note_type: input.noteType,
      content: input.content,
      source: input.source,
      created_at: createdAt,
    });
    return mapStyleNoteRow(record);
  }
  await runWithCtx(
    ctx,
    `INSERT INTO saas_customer_style_notes (id, tenant_id, saas_id, customer_id, note_type, content, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.customerId,
    input.noteType,
    input.content,
    input.source,
    createdAt,
  );
  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    customerId: input.customerId,
    noteType: input.noteType,
    content: input.content,
    source: input.source,
    createdAt,
  };
}

export async function getCustomerValueSnapshot(ctx: CustomersContext, customerId: string): Promise<CustomerValueSnapshot> {
  const bookings = await listCustomerBookings(ctx, customerId);
  const completed = bookings.filter((booking) => booking.status === "DONE");
  const totalVisits = completed.length;
  const totalRevenue = completed.reduce((acc, booking) => acc + (booking.priceAtBooking ?? 0), 0);
  const lastVisitAt =
    completed.length > 0
      ? completed.map((b) => b.endTime ?? b.startTime).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;
  let frequencyWeeks: number | null = null;
  if (completed.length >= 2) {
    const sorted = completed
      .map((booking) => new Date(booking.startTime).getTime())
      .sort((a, b) => a - b);
    const intervals = sorted.slice(1).map((value, idx) => value - sorted[idx]);
    const avgIntervalMs = intervals.reduce((acc, value) => acc + value, 0) / intervals.length;
    frequencyWeeks = avgIntervalMs / (1000 * 60 * 60 * 24 * 7);
  }
  const estimatedLtv = totalRevenue * (totalVisits > 0 ? 1.5 : 1);
  return { totalVisits, totalRevenue, lastVisitAt, frequencyWeeks, estimatedLtv };
}

export async function listSaasCustomerBookings(ctx: CustomersContext, customerId: string): Promise<SaasCustomerBooking[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       WHERE tenant_id = ? AND saas_id = ? AND customer_id = ?
       ORDER BY datetime(start_time) DESC`,
      ctx.tenantId,
      saasId,
      customerId,
    );
    return rows.map(mapBookingRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
    }
    throw error;
  }
}

export async function listSaasCustomerBookingsForSaas(
  ctx: CustomersContext,
  input: { employeeId?: string | null; day?: string | null },
): Promise<SaasCustomerBooking[]> {
  const saasId = requireSaasId(ctx);
  const range = resolveDayRange(input.day ?? null);
  if (ctx.mode === "demo") {
    return listDemoSaasCustomerBookings(demoTenantId(ctx), saasId)
      .filter((booking) => (input.employeeId ? booking.employee_id === input.employeeId : true))
      .filter((booking) => {
        if (!range) return true;
        const ts = new Date(booking.start_time);
        return ts >= range.start && ts <= range.end;
      })
      .map(mapBookingRow);
  }
  try {
    const clauses = ["tenant_id = ?", "saas_id = ?"];
    const params: unknown[] = [ctx.tenantId, saasId];
    if (input.employeeId) {
      clauses.push("employee_id = ?");
      params.push(input.employeeId);
    }
    if (range) {
      clauses.push("start_time >= ? AND start_time <= ?");
      params.push(range.start.toISOString(), range.end.toISOString());
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       ${where}
       ORDER BY datetime(start_time) ASC`,
      ...params,
    );
    return rows.map(mapBookingRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasCustomerBookings(demoTenantId(ctx), saasId)
        .filter((booking) => (input.employeeId ? booking.employee_id === input.employeeId : true))
        .filter((booking) => {
          if (!range) return true;
          const ts = new Date(booking.start_time);
          return ts >= range.start && ts <= range.end;
        })
        .map(mapBookingRow);
    }
    throw error;
  }
}

export async function createSaasCustomerBooking(
  ctx: CustomersContext,
  input: {
    saasId: string;
    customerId: string;
    serviceId: string;
    employeeId?: string | null;
    startTime: string;
    endTime: string;
    status?: CustomerBookingStatus;
    priceAtBooking?: number | null;
    notes?: string | null;
  },
): Promise<SaasCustomerBooking> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const status = input.status ?? "REQUESTED";
  if (ctx.mode === "demo") {
    const record = addDemoSaasCustomerBooking(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      customer_id: input.customerId,
      service_id: input.serviceId,
      employee_id: input.employeeId ?? null,
      start_time: input.startTime,
      end_time: input.endTime,
      status,
      price_at_booking: typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    });
    return mapBookingRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_customer_bookings (id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      input.customerId,
      input.serviceId,
      input.employeeId ?? null,
      input.startTime,
      input.endTime,
      status,
      typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
      input.notes ?? null,
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapBookingRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = addDemoSaasCustomerBooking(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        customer_id: input.customerId,
        service_id: input.serviceId,
        employee_id: input.employeeId ?? null,
        start_time: input.startTime,
        end_time: input.endTime,
        status,
        price_at_booking: typeof input.priceAtBooking === "number" ? input.priceAtBooking : null,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      });
      return mapBookingRow(record);
    }
    throw error;
  }
}

export async function updateSaasCustomerBookingStatus(
  ctx: CustomersContext,
  bookingId: string,
  status: CustomerBookingStatus,
): Promise<SaasCustomerBooking | null> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  if (ctx.mode === "demo") {
    const bookings = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId);
    const record = bookings.find((item) => item.id === bookingId);
    if (!record) return null;
    const previousStatus = record.status;
    record.status = status;
    record.updated_at = now;
    const updated = mapBookingRow(record);
    if (previousStatus !== "DONE" && status === "DONE") {
      try {
        const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env });
        const result = await consumeInventoryForBooking(economyCtx, updated);
        if (result.reason) {
          console.warn("BOOKING_INVENTORY_USAGE", result.reason, { bookingId, saasId });
        }
      } catch (error) {
        console.warn("BOOKING_INVENTORY_USAGE_ERROR", error);
      }
    }
    return updated;
  }
  try {
    const existingRows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       WHERE id = ?
       LIMIT 1`,
      bookingId,
    );
    const previousStatus = existingRows[0]?.status;
    await runWithCtx(
      ctx,
      `UPDATE saas_customer_bookings
       SET status = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND saas_id = ?`,
      status,
      now,
      bookingId,
      ctx.tenantId,
      saasId,
    );
    const rows = await queryAllWithCtx<SaasCustomerBookingRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, service_id, employee_id, start_time, end_time, status, price_at_booking, notes, created_at, updated_at
       FROM saas_customer_bookings
       WHERE id = ?
       LIMIT 1`,
      bookingId,
    );
    const updated = rows[0] ? mapBookingRow(rows[0]) : null;
    if (updated && previousStatus !== "DONE" && status === "DONE") {
      try {
        const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env });
        const result = await consumeInventoryForBooking(economyCtx, updated);
        if (result.reason) {
          console.warn("BOOKING_INVENTORY_USAGE", result.reason, { bookingId, saasId });
        }
      } catch (error) {
        console.warn("BOOKING_INVENTORY_USAGE_ERROR", error);
      }
    }
    return updated;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const bookings = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId);
      const record = bookings.find((item) => item.id === bookingId);
      if (!record) return null;
      const previousStatus = record.status;
      record.status = status;
      record.updated_at = now;
      const updated = mapBookingRow(record);
      if (previousStatus !== "DONE" && status === "DONE") {
        try {
          const economyCtx = await resolveEconomyContext({ tenantId: ctx.tenantId, saasId, env: ctx.env });
          const result = await consumeInventoryForBooking(economyCtx, updated);
          if (result.reason) {
            console.warn("BOOKING_INVENTORY_USAGE", result.reason, { bookingId, saasId });
          }
        } catch (err) {
          console.warn("BOOKING_INVENTORY_USAGE_ERROR", err);
        }
      }
      return updated;
    }
    throw error;
  }
}

export async function getSaasCustomerMetrics(ctx: CustomersContext, customerId: string): Promise<SaasCustomerMetrics> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  if (ctx.mode === "demo") {
    const record = getDemoSaasCustomerMetrics(demoTenantId(ctx), customerId, saasId);
    if (record) return mapMetricsRow(record);
    const bookings = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
    const computed = computeMetricsFromBookings(bookings);
    const newRecord = upsertDemoSaasCustomerMetrics(demoTenantId(ctx), {
      id: generateUuid(),
      saas_id: saasId,
      customer_id: customerId,
      total_visits: computed.totalVisits,
      total_revenue: computed.totalRevenue,
      last_visit_at: computed.lastVisitAt,
      avg_ticket: computed.avgTicket,
      no_show_count: computed.noShowCount,
      created_at: now,
      updated_at: now,
    });
    return mapMetricsRow(newRecord);
  }
  try {
    const rows = await queryAllWithCtx<SaasCustomerMetricsRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, customer_id, total_visits, total_revenue, last_visit_at, avg_ticket, no_show_count, created_at, updated_at
       FROM saas_customer_metrics
       WHERE tenant_id = ? AND saas_id = ? AND customer_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      customerId,
    );
    if (rows[0]) return mapMetricsRow(rows[0]);
    const bookings = await listSaasCustomerBookings(ctx, customerId);
    const computed = computeMetricsFromBookings(bookings);
    const id = generateUuid();
    await runWithCtx(
      ctx,
      `INSERT INTO saas_customer_metrics (id, tenant_id, saas_id, customer_id, total_visits, total_revenue, last_visit_at, avg_ticket, no_show_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      customerId,
      computed.totalVisits,
      computed.totalRevenue,
      computed.lastVisitAt,
      computed.avgTicket,
      computed.noShowCount,
      now,
      now,
    );
    return {
      id,
      tenantId: ctx.tenantId,
      saasId,
      customerId,
      totalVisits: computed.totalVisits,
      totalRevenue: computed.totalRevenue,
      lastVisitAt: computed.lastVisitAt,
      avgTicket: computed.avgTicket,
      noShowCount: computed.noShowCount,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasCustomerMetrics(demoTenantId(ctx), customerId, saasId);
      if (record) return mapMetricsRow(record);
      const bookings = listDemoSaasCustomerBookings(demoTenantId(ctx), saasId, customerId).map(mapBookingRow);
      const computed = computeMetricsFromBookings(bookings);
      const newRecord = upsertDemoSaasCustomerMetrics(demoTenantId(ctx), {
        id: generateUuid(),
        saas_id: saasId,
        customer_id: customerId,
        total_visits: computed.totalVisits,
        total_revenue: computed.totalRevenue,
        last_visit_at: computed.lastVisitAt,
        avg_ticket: computed.avgTicket,
        no_show_count: computed.noShowCount,
        created_at: now,
        updated_at: now,
      });
      return mapMetricsRow(newRecord);
    }
    throw error;
  }
}
