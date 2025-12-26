import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { saveClinicLead } from "@/lib/clinic/repository";
import type { ClinicLead } from "@/lib/clinic/types";

export const runtime = "edge";

const ALLOWED_STATUSES = new Set<ClinicLead["status"]>(["new", "contacted", "booked", "lost"]);
const ALLOWED_PRIORITIES = new Set<ClinicLead["priority"]>(["low", "medium", "high"]);

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
    const body = (await request.json().catch(() => null)) as Partial<ClinicLead> | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Payload required" }, { status: 400 });
    }
    const lead = await saveClinicLead(context, {
      id,
      saasId: context.saasId,
      status: body.status && ALLOWED_STATUSES.has(body.status) ? body.status : undefined,
      priority: body.priority && ALLOWED_PRIORITIES.has(body.priority) ? body.priority : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      interest: typeof body.interest === "string" ? body.interest : undefined,
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return handleClinicApiError("LEAD_PATCH", error);
  }
}
