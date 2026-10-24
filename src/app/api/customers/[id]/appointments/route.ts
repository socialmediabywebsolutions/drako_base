export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSaasCustomer,
  listCustomerAppointments,
  resolveCustomersContext,
  CustomersContextError,
} from "@/lib/customers/repository";
import { resolveAppointmentsContext, upsertAppointment, AppointmentsContextError } from "@/lib/appointments/repository";
import { resolveEmployeesContext, EmployeesContextError } from "@/lib/employees/context";
import { listEmployees } from "@/lib/employees/repository";
import { evaluateSchedulingGuardrails } from "@/lib/employees/guardrails";



type RouteContext = {
  params: Promise<{ id: string }>;
};

const SOURCE_CHANNELS = ["SOCIAL", "EMAIL", "DIRECT", "REFERRAL", "OTHER"] as const;

function normalizeSourceChannel(value?: string | null) {
  if (!value) return null;
  const upper = value.toUpperCase();
  return SOURCE_CHANNELS.includes(upper as (typeof SOURCE_CHANNELS)[number]) ? (upper as (typeof SOURCE_CHANNELS)[number]) : null;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const { id: customerId } = await params;
    if (!saasId || !customerId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and customerId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId });
    const items = await listCustomerAppointments(ctx, customerId, { from, to });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_APPOINTMENTS_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudieron cargar las citas" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      serviceId?: string;
      employeeId?: string | null;
      scheduledStart?: string;
      scheduledEnd?: string;
      clientContact?: string | null;
      socialCampaignId?: string | null;
      socialPostId?: string | null;
      sourceChannel?: string | null;
      notes?: string | null;
      priceAtBooking?: number | null;
    } | null;
    const { id: customerId } = await params;
    if (!body?.saasId || !customerId || !body.serviceId || !body.scheduledStart || !body.scheduledEnd) {
      return NextResponse.json(
        { code: "INVALID_PARAMS", message: "saasId, customerId, serviceId, scheduledStart, scheduledEnd are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const customersCtx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const customer = await getSaasCustomer(customersCtx, customerId);
    if (!customer) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Cliente no encontrado" }, { status: 404 });
    }
    const employeesCtx = await resolveEmployeesContext(tenantId, body.saasId);
    let resolvedEmployeeId = body.employeeId?.trim() ?? "";
    if (!resolvedEmployeeId) {
      // Prioridad: preferred_employee_id → primer employee activo → employee_unassigned (último recurso).
      resolvedEmployeeId = customer.preferredEmployeeId ?? "";
    }
    if (!resolvedEmployeeId) {
      const employees = await listEmployees(employeesCtx);
      resolvedEmployeeId = employees.find((employee) => employee.isActive)?.id ?? "employee_unassigned";
    }
    const start = new Date(body.scheduledStart);
    const end = new Date(body.scheduledEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "Invalid scheduled start/end" }, { status: 400 });
    }
    const appointmentsCtx = await resolveAppointmentsContext({ tenantId, saasId: body.saasId });
    let guardrails: Awaited<ReturnType<typeof evaluateSchedulingGuardrails>> | null = null;
    if (resolvedEmployeeId && resolvedEmployeeId !== "employee_unassigned") {
      guardrails = await evaluateSchedulingGuardrails(
        { employeesCtx, appointmentsCtx },
        resolvedEmployeeId,
        { start, end },
      );
      if (guardrails.finalDecision === "BLOCK") {
        return NextResponse.json(
          { code: "HARD_GUARDRAIL_VIOLATION", guardrails: guardrails.decisions },
          { status: 422 },
        );
      }
    }
    const appointment = await upsertAppointment(appointmentsCtx, {
      saasId: body.saasId,
      serviceId: body.serviceId,
      employeeId: resolvedEmployeeId,
      customerId,
      clientName: customer.fullName,
      clientContact: body.clientContact ?? customer.email ?? customer.phone ?? null,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      status: "REQUESTED",
      priceAtBooking: typeof body.priceAtBooking === "number" ? body.priceAtBooking : null,
      socialCampaignId: body.socialCampaignId ?? null,
      socialPostId: body.socialPostId ?? null,
      sourceChannel: normalizeSourceChannel(body.sourceChannel) ?? "DIRECT",
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({
      appointment,
      guardrails: guardrails?.finalDecision === "WARN" ? guardrails.decisions : undefined,
    });
  } catch (error) {
    if (error instanceof CustomersContextError || error instanceof AppointmentsContextError || error instanceof EmployeesContextError) {
      return NextResponse.json({ code: "INVALID_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_APPOINTMENT_CREATE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo crear la cita" }, { status: 500 });
  }
}
