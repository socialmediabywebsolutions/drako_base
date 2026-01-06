import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { AppointmentsContextError, listAppointmentsForEmployee, resolveAppointmentsContext } from "@/lib/appointments/repository";
export const runtime = "edge";


type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveTodayRange(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const { id: employeeId } = await params;
    if (!saasId || !employeeId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and employeeId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveAppointmentsContext({ tenantId, saasId });
    const range = from || to ? { from, to } : resolveTodayRange();
    const items = await listAppointmentsForEmployee(ctx, employeeId, range);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof AppointmentsContextError) {
      return NextResponse.json({ code: "INVALID_APPOINTMENTS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMPLOYEE_APPOINTMENTS_ERROR", error);
    return NextResponse.json({ code: "APPOINTMENTS_ERROR", message: "No se pudieron cargar las citas" }, { status: 500 });
  }
}
