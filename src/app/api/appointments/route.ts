import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  listAppointmentsForSaas,
  resolveAppointmentsContext,
  upsertAppointment,
  AppointmentsContextError,
} from "@/lib/appointments/repository";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { evaluateSchedulingGuardrails } from "@/lib/employees/guardrails";


const SOURCE_CHANNELS = ["SOCIAL", "EMAIL", "DIRECT", "REFERRAL", "OTHER"] as const;

function normalizeSourceChannel(value?: string | null) {
  if (!value) return null;
  const upper = value.toUpperCase();
  return SOURCE_CHANNELS.includes(upper as (typeof SOURCE_CHANNELS)[number]) ? (upper as (typeof SOURCE_CHANNELS)[number]) : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const employeeId = url.searchParams.get("employeeId") ?? undefined;
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveAppointmentsContext({ tenantId, saasId });
    const items = await listAppointmentsForSaas(ctx, { from, to, employeeId });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof AppointmentsContextError) {
      return NextResponse.json({ code: "INVALID_APPOINTMENTS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("APPOINTMENTS_LIST_ERROR", error);
    return NextResponse.json({ code: "APPOINTMENTS_ERROR", message: "No se pudieron cargar las citas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string;
      serviceId?: string;
      employeeId?: string;
      customerId?: string | null;
      clientName?: string;
      clientContact?: string | null;
      scheduledStart?: string;
      scheduledEnd?: string;
      status?: string;
      priceAtBooking?: number | null;
      socialCampaignId?: string | null;
      socialPostId?: string | null;
      sourceChannel?: string | null;
      notes?: string | null;
    } | null;
    if (!body || !body.saasId || !body.serviceId || !body.employeeId || !body.clientName || !body.scheduledStart || !body.scheduledEnd) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "Missing appointment fields" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveAppointmentsContext({ tenantId, saasId: body.saasId });
    const start = new Date(body.scheduledStart);
    const end = new Date(body.scheduledEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "Invalid scheduled start/end" }, { status: 400 });
    }
    let guardrails: Awaited<ReturnType<typeof evaluateSchedulingGuardrails>> | null = null;
    if (body.employeeId && body.employeeId !== "employee_unassigned") {
      const employeesCtx = await resolveEmployeesContext(tenantId, body.saasId);
      guardrails = await evaluateSchedulingGuardrails(
        { employeesCtx, appointmentsCtx: ctx },
        body.employeeId,
        { start, end },
      );
      if (guardrails.finalDecision === "BLOCK") {
        return NextResponse.json(
          { code: "HARD_GUARDRAIL_VIOLATION", guardrails: guardrails.decisions },
          { status: 422 },
        );
      }
    }
    const appointment = await upsertAppointment(ctx, {
      id: body.id,
      saasId: body.saasId,
      serviceId: body.serviceId,
      employeeId: body.employeeId,
      customerId: body.customerId ?? null,
      clientName: body.clientName,
      clientContact: typeof body.clientContact === "string" ? body.clientContact : null,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      status: body.status as
        | "REQUESTED"
        | "PENDING"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "DONE"
        | "NO_SHOW"
        | "CANCELLED"
        | undefined,
      priceAtBooking: typeof body.priceAtBooking === "number" ? body.priceAtBooking : null,
      socialCampaignId: body.socialCampaignId ?? null,
      socialPostId: body.socialPostId ?? null,
      sourceChannel: normalizeSourceChannel(body.sourceChannel),
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({
      appointment,
      guardrails: guardrails?.finalDecision === "WARN" ? guardrails.decisions : undefined,
    });
  } catch (error) {
    if (error instanceof AppointmentsContextError) {
      return NextResponse.json({ code: "INVALID_APPOINTMENTS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("APPOINTMENTS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "APPOINTMENTS_ERROR", message: "No se pudo guardar la cita" }, { status: 500 });
  }
}
