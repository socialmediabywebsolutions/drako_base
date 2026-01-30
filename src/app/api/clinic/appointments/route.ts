import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { listClinicAppointments, saveClinicAppointment } from "@/lib/clinic/repository";
import type { ClinicAppointment } from "@/lib/clinic/types";
// export const runtime = "edge"; // OpenNext Migration


const ALLOWED_STATUSES = new Set<ClinicAppointment["status"]>(["booked", "done", "no-show", "cancelled"]);

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const items = await listClinicAppointments(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleClinicApiError("APPOINTMENTS_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as {
      patientName?: string;
      startsAt?: string;
      endsAt?: string | null;
      leadId?: string | null;
      serviceId?: string | null;
      roomLabel?: string | null;
      staffName?: string | null;
      status?: ClinicAppointment["status"];
    } | null;
    if (!body || !body.patientName || !body.startsAt) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "patientName and startsAt are required" },
        { status: 400 },
      );
    }
    const appointment = await saveClinicAppointment(context, {
      saasId: context.saasId,
      patientName: body.patientName.trim(),
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
      leadId: typeof body.leadId === "string" ? body.leadId : null,
      serviceId: typeof body.serviceId === "string" ? body.serviceId : null,
      roomLabel: typeof body.roomLabel === "string" ? body.roomLabel : null,
      staffName: typeof body.staffName === "string" ? body.staffName : null,
      status: body.status && ALLOWED_STATUSES.has(body.status) ? body.status : undefined,
    });
    return NextResponse.json({ appointment });
  } catch (error) {
    return handleClinicApiError("APPOINTMENTS_POST", error);
  }
}
