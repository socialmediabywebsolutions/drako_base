import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  AppointmentsContextError,
  getAppointmentById,
  recordServiceConsumptionForAppointment,
  resolveAppointmentsContext,
  upsertAppointment,
} from "@/lib/appointments/repository";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { evaluateSchedulingGuardrails } from "@/lib/employees/guardrails";
// export const runtime = "edge"; // OpenNext: edge runtime not supported in bundled routes


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveAppointmentsContext({ tenantId, saasId });
    const appointment = await getAppointmentById(ctx, id);
    if (!appointment) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Appointment not found" }, { status: 404 });
    }
    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof AppointmentsContextError) {
      return NextResponse.json({ code: "INVALID_APPOINTMENTS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("APPOINTMENT_DETAIL_ERROR", error);
    return NextResponse.json({ code: "APPOINTMENTS_ERROR", message: "No se pudo cargar la cita" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as { status?: string; notes?: string | null } | null;
    if (!body || (!body.status && typeof body.notes === "undefined")) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "status or notes are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveAppointmentsContext({ tenantId, saasId });
    const current = await getAppointmentById(ctx, id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Appointment not found" }, { status: 404 });
    }
    const nextStatus =
      (body.status as
        | "REQUESTED"
        | "PENDING"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "DONE"
        | "NO_SHOW"
        | "CANCELLED"
        | undefined) ?? current.status;
    const nextNotes = typeof body.notes === "string" ? body.notes : current.notes;
    let guardrails: Awaited<ReturnType<typeof evaluateSchedulingGuardrails>> | null = null;
    if (nextStatus === "CONFIRMED" && current.employeeId !== "employee_unassigned") {
      const start = new Date(current.scheduledStart);
      const end = new Date(current.scheduledEnd);
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
        const employeesCtx = await resolveEmployeesContext(tenantId, saasId);
        guardrails = await evaluateSchedulingGuardrails(
          { employeesCtx, appointmentsCtx: ctx },
          current.employeeId,
          { start, end },
        );
        if (guardrails.finalDecision === "BLOCK") {
          return NextResponse.json(
            { code: "HARD_GUARDRAIL_VIOLATION", guardrails: guardrails.decisions },
            { status: 422 },
          );
        }
      }
    }

    const updated = await upsertAppointment(ctx, {
      id: current.id,
      saasId: current.saasId,
      serviceId: current.serviceId,
      employeeId: current.employeeId,
      clientName: current.clientName,
      clientContact: current.clientContact,
      scheduledStart: current.scheduledStart,
      scheduledEnd: current.scheduledEnd,
      status: nextStatus,
      priceAtBooking: current.priceAtBooking,
      notes: nextNotes,
    });

    if (current.status !== "DONE" && nextStatus === "DONE") {
      await recordServiceConsumptionForAppointment(ctx, current.id);
    }

    return NextResponse.json({
      appointment: updated,
      guardrails: guardrails?.finalDecision === "WARN" ? guardrails.decisions : undefined,
    });
  } catch (error) {
    if (error instanceof AppointmentsContextError) {
      return NextResponse.json({ code: "INVALID_APPOINTMENTS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("APPOINTMENT_UPDATE_ERROR", error);
    return NextResponse.json({ code: "APPOINTMENTS_ERROR", message: "No se pudo actualizar la cita" }, { status: 500 });
  }
}
