import { queryAll, run } from "@/lib/db";
import {
  addDemoClinicFinanceEntry,
  getDemoClinicProfile,
  listDemoClinicAppointments,
  listDemoClinicFinanceEntries,
  listDemoClinicLeads,
  listDemoClinicServices,
  upsertDemoClinicAppointment,
  upsertDemoClinicLead,
  upsertDemoClinicProfile,
  upsertDemoClinicService,
  type DemoClinicAppointment,
  type DemoClinicFinanceEntry as DemoFinanceEntry,
  type DemoClinicLead,
  type DemoClinicProfile,
  type DemoClinicService,
} from "@/lib/admin/demo-data";
import type { ClinicContext } from "@/lib/clinic/context";
import type {
  ClinicAppointment,
  ClinicFinanceEntry,
  ClinicFinanceSummary,
  ClinicLead,
  ClinicMetrics,
  ClinicProfile,
  ClinicService,
} from "@/lib/clinic/types";

type ClinicProfileInput = {
  id?: string;
  saasId?: string;
  clientId?: string;
  displayName: string;
  city?: string | null;
  roomsCount?: number;
  staffCount?: number;
  primaryGoal?: string | null;
  channels?: Record<string, boolean> | null;
};

type ClinicServiceInput = {
  id?: string;
  saasId?: string;
  name?: string;
  durationMinutes?: number;
  basePrice?: number;
  isActive?: boolean;
};

type ClinicLeadInput = {
  id?: string;
  saasId?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  source?: string;
  interest?: string | null;
  status?: ClinicLead["status"];
  priority?: ClinicLead["priority"];
  notes?: string | null;
};

type ClinicAppointmentInput = {
  id?: string;
  saasId?: string;
  leadId?: string | null;
  patientName?: string;
  serviceId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  status?: ClinicAppointment["status"];
  roomLabel?: string | null;
  staffName?: string | null;
};

type ClinicFinanceInput = {
  saasId?: string;
  appointmentId?: string | null;
  serviceName?: string | null;
  amount: number;
  currency?: string;
  paidAt: string;
  method?: string | null;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function parseChannels(value: string | null): Record<string, boolean> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, boolean>;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

function stringifyChannels(value: Record<string, boolean> | null | undefined): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function shouldFallbackToDemo(error: unknown, ctx: ClinicContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function demoTenantId(ctx: ClinicContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function mapProfileRow(row: {
  id: string;
  client_id: string | null;
  saas_id: string;
  display_name: string;
  city: string | null;
  rooms_count: number | null;
  staff_count: number | null;
  primary_goal: string | null;
  channels: string | null;
  created_at: string;
  updated_at: string;
}): ClinicProfile {
  return {
    id: row.id,
    saasId: row.saas_id,
    clientId: row.client_id,
    displayName: row.display_name,
    city: row.city,
    roomsCount: row.rooms_count ?? 0,
    staffCount: row.staff_count ?? 0,
    primaryGoal: row.primary_goal,
    channels: parseChannels(row.channels),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapServiceRow(row: {
  id: string;
  saas_id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}): ClinicService {
  return {
    id: row.id,
    saasId: row.saas_id,
    name: row.name,
    durationMinutes: row.duration_minutes ?? 0,
    basePrice: row.base_price ?? 0,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadRow(row: {
  id: string;
  saas_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): ClinicLead {
  return {
    id: row.id,
    saasId: row.saas_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    interest: row.interest,
    status: (row.status as ClinicLead["status"]) ?? "new",
    priority: (row.priority as ClinicLead["priority"]) ?? "medium",
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointmentRow(row: {
  id: string;
  saas_id: string;
  lead_id: string | null;
  patient_name: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  room_label: string | null;
  staff_name: string | null;
  created_at: string;
  updated_at: string;
}): ClinicAppointment {
  return {
    id: row.id,
    saasId: row.saas_id,
    leadId: row.lead_id,
    patientName: row.patient_name,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: (row.status as ClinicAppointment["status"]) ?? "booked",
    roomLabel: row.room_label,
    staffName: row.staff_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFinanceRow(row: {
  id: string;
  saas_id: string;
  appointment_id: string | null;
  service_name: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  method: string | null;
  created_at: string;
}): ClinicFinanceEntry {
  return {
    id: row.id,
    saasId: row.saas_id,
    appointmentId: row.appointment_id,
    serviceName: row.service_name,
    amount: row.amount ?? 0,
    currency: row.currency ?? "EUR",
    paidAt: row.paid_at,
    method: row.method,
    createdAt: row.created_at,
  };
}

function mapDemoProfile(record: DemoClinicProfile): ClinicProfile {
  return {
    id: record.id,
    saasId: record.saas_id,
    clientId: record.client_id,
    displayName: record.display_name,
    city: record.city,
    roomsCount: record.rooms_count ?? 0,
    staffCount: record.staff_count ?? 0,
    primaryGoal: record.primary_goal,
    channels: record.channels,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoService(record: DemoClinicService): ClinicService {
  return {
    id: record.id,
    saasId: record.saas_id,
    name: record.name,
    durationMinutes: record.duration_minutes ?? 0,
    basePrice: record.base_price ?? 0,
    isActive: record.is_active === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoLead(record: DemoClinicLead): ClinicLead {
  return {
    id: record.id,
    saasId: record.saas_id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    source: record.source,
    interest: record.interest,
    status: record.status as ClinicLead["status"],
    priority: record.priority as ClinicLead["priority"],
    notes: record.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoAppointment(record: DemoClinicAppointment): ClinicAppointment {
  return {
    id: record.id,
    saasId: record.saas_id,
    leadId: record.lead_id,
    patientName: record.patient_name,
    serviceId: record.service_id,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    status: record.status as ClinicAppointment["status"],
    roomLabel: record.room_label,
    staffName: record.staff_name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function mapDemoFinance(record: DemoFinanceEntry): ClinicFinanceEntry {
  return {
    id: record.id,
    saasId: record.saas_id,
    appointmentId: record.appointment_id,
    serviceName: record.service_name,
    amount: record.amount,
    currency: record.currency ?? "EUR",
    paidAt: record.paid_at,
    method: record.method,
    createdAt: record.created_at,
  };
}

export async function getClinicProfile(ctx: ClinicContext): Promise<ClinicProfile | null> {
  const demoFetch = () => {
    const profile = getDemoClinicProfile(demoTenantId(ctx), ctx.saasId);
    return profile ? mapDemoProfile(profile) : null;
  };

  if (ctx.mode === "demo") {
    return demoFetch();
  }
  try {
    const rows = await queryAll<Parameters<typeof mapProfileRow>[0]>(
      `SELECT id, client_id, saas_id, display_name, city, rooms_count, staff_count, primary_goal, channels, created_at, updated_at
       FROM clinic_profiles
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      ctx.saasId,
    );
    if (!rows[0]) return null;
    return mapProfileRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoFetch();
    }
    throw error;
  }
}

export async function saveClinicProfile(ctx: ClinicContext, payload: ClinicProfileInput): Promise<ClinicProfile> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  const clientId = payload.clientId ?? ctx.clientId;
  const channelsJson = stringifyChannels(payload.channels);

  const demoSave = () =>
    mapDemoProfile(
      upsertDemoClinicProfile(demoTenantId(ctx), {
        id: payload.id,
        client_id: clientId,
        saas_id: saasId,
        display_name: payload.displayName,
        city: payload.city ?? null,
        rooms_count: payload.roomsCount ?? 0,
        staff_count: payload.staffCount ?? 0,
        primary_goal: payload.primaryGoal ?? "fill_agenda",
        channels: payload.channels ?? null,
      }),
    );

  if (ctx.mode === "demo") {
    return demoSave();
  }

  try {
    const existing = await queryAll<{ id: string }>(
      "SELECT id FROM clinic_profiles WHERE tenant_id = ? AND saas_id = ? LIMIT 1",
      ctx.tenantId,
      saasId,
    );
    if (existing[0]) {
      await run(
        `UPDATE clinic_profiles
         SET display_name = COALESCE(?, display_name),
             city = COALESCE(?, city),
             rooms_count = COALESCE(?, rooms_count),
             staff_count = COALESCE(?, staff_count),
             primary_goal = COALESCE(?, primary_goal),
             channels = COALESCE(?, channels),
             client_id = COALESCE(?, client_id),
             updated_at = ?
         WHERE tenant_id = ? AND saas_id = ?`,
        payload.displayName ?? null,
        payload.city ?? null,
        typeof payload.roomsCount === "number" ? payload.roomsCount : null,
        typeof payload.staffCount === "number" ? payload.staffCount : null,
        payload.primaryGoal ?? null,
        channelsJson,
        clientId ?? null,
        now,
        ctx.tenantId,
        saasId,
      );
    } else {
      await run(
        `INSERT INTO clinic_profiles (
           id, tenant_id, client_id, saas_id, display_name, city,
           rooms_count, staff_count, primary_goal, channels, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        payload.id?.trim() ?? crypto.randomUUID(),
        ctx.tenantId,
        clientId ?? null,
        saasId,
        payload.displayName ?? "Clinic",
        payload.city ?? null,
        typeof payload.roomsCount === "number" ? payload.roomsCount : 0,
        typeof payload.staffCount === "number" ? payload.staffCount : 0,
        payload.primaryGoal ?? "fill_agenda",
        channelsJson,
        now,
        now,
      );
    }

    const rows = await queryAll<Parameters<typeof mapProfileRow>[0]>(
      `SELECT id, client_id, saas_id, display_name, city, rooms_count, staff_count, primary_goal, channels, created_at, updated_at
       FROM clinic_profiles
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    if (!rows[0]) {
      throw new Error("Failed to persist clinic profile");
    }
    return mapProfileRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoSave();
    }
    throw error;
  }
}

export async function listClinicServices(ctx: ClinicContext): Promise<ClinicService[]> {
  const demoList = () => listDemoClinicServices(demoTenantId(ctx), ctx.saasId).map(mapDemoService);
  if (ctx.mode === "demo") {
    return demoList();
  }
  try {
    const rows = await queryAll<Parameters<typeof mapServiceRow>[0]>(
      `SELECT id, saas_id, name, duration_minutes, base_price, is_active, created_at, updated_at
       FROM clinic_services
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY name ASC`,
      ctx.tenantId,
      ctx.saasId,
    );
    return rows.map(mapServiceRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoList();
    }
    throw error;
  }
}

export async function saveClinicService(ctx: ClinicContext, payload: ClinicServiceInput): Promise<ClinicService> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  const demoSave = () =>
    mapDemoService(
      upsertDemoClinicService(demoTenantId(ctx), {
        id: payload.id,
        saas_id: saasId,
        name: payload.name ?? "Servicio",
        duration_minutes: payload.durationMinutes ?? 60,
        base_price: payload.basePrice ?? 0,
        is_active: payload.isActive === false ? 0 : 1,
      }),
    );

  if (ctx.mode === "demo") {
    return demoSave();
  }
  try {
    let recordId = payload.id;
    if (recordId) {
      await run(
        `UPDATE clinic_services
         SET name = COALESCE(?, name),
             duration_minutes = COALESCE(?, duration_minutes),
             base_price = COALESCE(?, base_price),
             is_active = CASE WHEN ? IS NULL THEN is_active ELSE ? END,
             updated_at = ?
         WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
        payload.name ?? null,
        typeof payload.durationMinutes === "number" ? payload.durationMinutes : null,
        typeof payload.basePrice === "number" ? payload.basePrice : null,
        typeof payload.isActive === "boolean" ? (payload.isActive ? 1 : 0) : null,
        typeof payload.isActive === "boolean" ? (payload.isActive ? 1 : 0) : null,
        now,
        ctx.tenantId,
        saasId,
        recordId,
      );
    } else {
      recordId = crypto.randomUUID();
      await run(
        `INSERT INTO clinic_services (id, tenant_id, saas_id, name, duration_minutes, base_price, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        ctx.tenantId,
        saasId,
        payload.name ?? "Servicio",
        payload.durationMinutes ?? 60,
        payload.basePrice ?? 0,
        payload.isActive === false ? 0 : 1,
        now,
        now,
      );
    }

    const rows = await queryAll<Parameters<typeof mapServiceRow>[0]>(
      `SELECT id, saas_id, name, duration_minutes, base_price, is_active, created_at, updated_at
       FROM clinic_services
       WHERE tenant_id = ? AND saas_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      recordId,
    );
    if (!rows[0]) {
      throw new Error("Clinic service not found after save");
    }
    return mapServiceRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoSave();
    }
    throw error;
  }
}

export async function listClinicLeads(ctx: ClinicContext): Promise<ClinicLead[]> {
  const demoList = () => listDemoClinicLeads(demoTenantId(ctx), ctx.saasId).map(mapDemoLead);
  if (ctx.mode === "demo") {
    return demoList();
  }
  try {
    const rows = await queryAll<Parameters<typeof mapLeadRow>[0]>(
      `SELECT id, saas_id, name, email, phone, source, interest, status, priority, notes, created_at, updated_at
       FROM clinic_leads
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY datetime(updated_at) DESC`,
      ctx.tenantId,
      ctx.saasId,
    );
    return rows.map(mapLeadRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoList();
    }
    throw error;
  }
}

export async function saveClinicLead(ctx: ClinicContext, payload: ClinicLeadInput): Promise<ClinicLead> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  const demoSave = () =>
    mapDemoLead(
      upsertDemoClinicLead(demoTenantId(ctx), {
        id: payload.id,
        saas_id: saasId,
        name: payload.name ?? "Nuevo lead",
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        source: payload.source ?? "web",
        interest: payload.interest ?? null,
        status: payload.status ?? "new",
        priority: payload.priority ?? "medium",
        notes: payload.notes ?? null,
      }),
    );

  if (ctx.mode === "demo") {
    return demoSave();
  }
  try {
    let recordId = payload.id;
    if (recordId) {
      await run(
        `UPDATE clinic_leads
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             source = COALESCE(?, source),
             interest = COALESCE(?, interest),
             status = COALESCE(?, status),
             priority = COALESCE(?, priority),
             notes = COALESCE(?, notes),
             updated_at = ?
         WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
        payload.name ?? null,
        typeof payload.email === "undefined" ? null : payload.email,
        typeof payload.phone === "undefined" ? null : payload.phone,
        payload.source ?? null,
        typeof payload.interest === "undefined" ? null : payload.interest,
        payload.status ?? null,
        payload.priority ?? null,
        typeof payload.notes === "undefined" ? null : payload.notes,
        now,
        ctx.tenantId,
        saasId,
        recordId,
      );
    } else {
      recordId = crypto.randomUUID();
      await run(
        `INSERT INTO clinic_leads (
           id, tenant_id, saas_id, name, email, phone, source, interest, status, priority, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        ctx.tenantId,
        saasId,
        payload.name ?? "Nuevo lead",
        payload.email ?? null,
        payload.phone ?? null,
        payload.source ?? "web",
        payload.interest ?? null,
        payload.status ?? "new",
        payload.priority ?? "medium",
        payload.notes ?? null,
        now,
        now,
      );
    }
    const rows = await queryAll<Parameters<typeof mapLeadRow>[0]>(
      `SELECT id, saas_id, name, email, phone, source, interest, status, priority, notes, created_at, updated_at
       FROM clinic_leads
       WHERE tenant_id = ? AND saas_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      recordId,
    );
    if (!rows[0]) {
      throw new Error("Clinic lead not found after save");
    }
    return mapLeadRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoSave();
    }
    throw error;
  }
}

export async function listClinicAppointments(ctx: ClinicContext): Promise<ClinicAppointment[]> {
  const demoList = () => listDemoClinicAppointments(demoTenantId(ctx), ctx.saasId).map(mapDemoAppointment);
  if (ctx.mode === "demo") {
    return demoList();
  }
  try {
    const rows = await queryAll<Parameters<typeof mapAppointmentRow>[0]>(
      `SELECT id, saas_id, lead_id, patient_name, service_id, starts_at, ends_at, status, room_label, staff_name, created_at, updated_at
       FROM clinic_appointments
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY datetime(starts_at) DESC`,
      ctx.tenantId,
      ctx.saasId,
    );
    return rows.map(mapAppointmentRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoList();
    }
    throw error;
  }
}

export async function saveClinicAppointment(ctx: ClinicContext, payload: ClinicAppointmentInput): Promise<ClinicAppointment> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  const demoSave = () =>
    mapDemoAppointment(
      upsertDemoClinicAppointment(demoTenantId(ctx), {
        id: payload.id,
        saas_id: saasId,
        lead_id: typeof payload.leadId === "undefined" ? null : payload.leadId,
        patient_name: payload.patientName ?? "Paciente",
        service_id: typeof payload.serviceId === "undefined" ? null : payload.serviceId,
        starts_at: payload.startsAt ?? new Date().toISOString(),
        ends_at: typeof payload.endsAt === "undefined" ? null : payload.endsAt,
        status: payload.status ?? "booked",
        room_label: payload.roomLabel ?? null,
        staff_name: payload.staffName ?? null,
      }),
    );

  if (ctx.mode === "demo") {
    return demoSave();
  }
  try {
    let recordId = payload.id;
    if (recordId) {
      await run(
        `UPDATE clinic_appointments
         SET lead_id = COALESCE(?, lead_id),
             patient_name = COALESCE(?, patient_name),
             service_id = COALESCE(?, service_id),
             starts_at = COALESCE(?, starts_at),
             ends_at = COALESCE(?, ends_at),
             status = COALESCE(?, status),
             room_label = COALESCE(?, room_label),
             staff_name = COALESCE(?, staff_name),
             updated_at = ?
         WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
        typeof payload.leadId === "undefined" ? null : payload.leadId,
        payload.patientName ?? null,
        typeof payload.serviceId === "undefined" ? null : payload.serviceId,
        payload.startsAt ?? null,
        typeof payload.endsAt === "undefined" ? null : payload.endsAt,
        payload.status ?? null,
        typeof payload.roomLabel === "undefined" ? null : payload.roomLabel,
        typeof payload.staffName === "undefined" ? null : payload.staffName,
        now,
        ctx.tenantId,
        saasId,
        recordId,
      );
    } else {
      recordId = crypto.randomUUID();
      await run(
        `INSERT INTO clinic_appointments (
           id, tenant_id, saas_id, lead_id, patient_name, service_id, starts_at, ends_at, status, room_label, staff_name, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        ctx.tenantId,
        saasId,
        typeof payload.leadId === "undefined" ? null : payload.leadId,
        payload.patientName ?? "Paciente",
        typeof payload.serviceId === "undefined" ? null : payload.serviceId,
        payload.startsAt ?? new Date().toISOString(),
        typeof payload.endsAt === "undefined" ? null : payload.endsAt,
        payload.status ?? "booked",
        payload.roomLabel ?? null,
        payload.staffName ?? null,
        now,
        now,
      );
    }
    const rows = await queryAll<Parameters<typeof mapAppointmentRow>[0]>(
      `SELECT id, saas_id, lead_id, patient_name, service_id, starts_at, ends_at, status, room_label, staff_name, created_at, updated_at
       FROM clinic_appointments
       WHERE tenant_id = ? AND saas_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      recordId,
    );
    if (!rows[0]) {
      throw new Error("Clinic appointment not found after save");
    }
    return mapAppointmentRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoSave();
    }
    throw error;
  }
}

export async function listClinicFinanceEntries(ctx: ClinicContext): Promise<ClinicFinanceEntry[]> {
  const demoList = () => listDemoClinicFinanceEntries(demoTenantId(ctx), ctx.saasId).map(mapDemoFinance);
  if (ctx.mode === "demo") {
    return demoList();
  }
  try {
    const rows = await queryAll<Parameters<typeof mapFinanceRow>[0]>(
      `SELECT id, saas_id, appointment_id, service_name, amount, currency, paid_at, method, created_at
       FROM clinic_finance_entries
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY datetime(paid_at) DESC`,
      ctx.tenantId,
      ctx.saasId,
    );
    return rows.map(mapFinanceRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoList();
    }
    throw error;
  }
}

export async function addClinicFinanceEntry(ctx: ClinicContext, payload: ClinicFinanceInput): Promise<ClinicFinanceEntry> {
  const now = new Date().toISOString();
  const saasId = payload.saasId ?? ctx.saasId;
  const demoSave = () =>
    mapDemoFinance(
      addDemoClinicFinanceEntry(demoTenantId(ctx), {
        saas_id: saasId,
        appointment_id: typeof payload.appointmentId === "undefined" ? null : payload.appointmentId,
        service_name: payload.serviceName ?? null,
        amount: payload.amount,
        currency: payload.currency ?? "EUR",
        paid_at: payload.paidAt,
        method: payload.method ?? "card",
      }),
    );

  if (ctx.mode === "demo") {
    return demoSave();
  }
  try {
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO clinic_finance_entries (
         id, tenant_id, saas_id, appointment_id, service_name, amount, currency, paid_at, method, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      typeof payload.appointmentId === "undefined" ? null : payload.appointmentId,
      payload.serviceName ?? null,
      payload.amount,
      payload.currency ?? "EUR",
      payload.paidAt,
      payload.method ?? "card",
      now,
    );
    const rows = await queryAll<Parameters<typeof mapFinanceRow>[0]>(
      `SELECT id, saas_id, appointment_id, service_name, amount, currency, paid_at, method, created_at
       FROM clinic_finance_entries
       WHERE tenant_id = ? AND saas_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      id,
    );
    if (!rows[0]) {
      throw new Error("Clinic finance entry not found after insert");
    }
    return mapFinanceRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return demoSave();
    }
    throw error;
  }
}

export function summarizeFinance(entries: ClinicFinanceEntry[]): ClinicFinanceSummary {
  const totalRevenue = entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const averageTicket = entries.length ? totalRevenue / entries.length : 0;
  return { totalRevenue, averageTicket };
}

export async function getClinicMetrics(ctx: ClinicContext): Promise<ClinicMetrics> {
  const [leads, appointments, finance] = await Promise.all([
    listClinicLeads(ctx),
    listClinicAppointments(ctx),
    listClinicFinanceEntries(ctx),
  ]);

  const totalLeads = leads.length;
  const bookedLeads = leads.filter((lead) => lead.status === "booked").length;
  const leadToBookingRate = totalLeads ? bookedLeads / totalLeads : 0;

  const totalAppointments = appointments.length;
  const noShows = appointments.filter((appt) => appt.status === "no-show").length;
  const noShowRate = totalAppointments ? noShows / totalAppointments : 0;

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const appointmentsPerWeek = appointments.filter((appt) => new Date(appt.startsAt) >= weekAgo).length;

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenueCurrentMonth = finance
    .filter((entry) => new Date(entry.paidAt) >= startOfMonth)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const patientVisits = new Map<string, number>();
  appointments.forEach((appt) => {
    if (!appt.patientName) return;
    const key = appt.patientName.toLowerCase();
    patientVisits.set(key, (patientVisits.get(key) ?? 0) + 1);
  });
  let repeatCount = 0;
  patientVisits.forEach((count) => {
    if (count > 1) repeatCount += 1;
  });
  const patientRepeatRate = patientVisits.size ? repeatCount / patientVisits.size : 0;

  return {
    leadToBookingRate,
    noShowRate,
    appointmentsPerWeek,
    revenueCurrentMonth,
    patientRepeatRate,
    totalLeads,
    totalAppointments,
  };
}
