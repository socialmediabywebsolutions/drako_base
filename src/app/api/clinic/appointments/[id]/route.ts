export const dynamic = "force-dynamic";
import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { saveClinicAppointment } from "@/lib/clinic/repository";
import type { ClinicAppointment } from "@/lib/clinic/types";



const ALLOWED_STATUSES = new Set<ClinicAppointment["status"]>(["booked", "done", "no-show", "cancelled"]);

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as Partial<ClinicAppointment> | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Payload required" }, { status: 400 });
    }
    const appointment = await saveClinicAppointment(context, {
      id,
      saasId: context.saasId,
      status: body.status && ALLOWED_STATUSES.has(body.status) ? body.status : undefined,
      roomLabel: typeof body.roomLabel === "string" ? body.roomLabel : undefined,
      staffName: typeof body.staffName === "string" ? body.staffName : undefined,
      endsAt: typeof body.endsAt === "string" ? body.endsAt : undefined,
    });
    return NextResponse.json({ appointment });
  } catch (error) {
    return handleClinicApiError("APPOINTMENT_PATCH", error);
  }
}
