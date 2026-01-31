import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { listClinicLeads, saveClinicLead } from "@/lib/clinic/repository";
import type { ClinicLead } from "@/lib/clinic/types";
// export const runtime = "edge"; // OpenNext Migration


const ALLOWED_STATUSES = new Set(["new", "contacted", "booked", "lost"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && ALLOWED_STATUSES.has(statusParam) ? statusParam : null;
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const leads = await listClinicLeads(context);
    const filtered = status ? leads.filter((lead) => lead.status === status) : leads;
    return NextResponse.json({ items: filtered, count: filtered.length });
  } catch (error) {
    return handleClinicApiError("LEADS_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as {
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string;
      interest?: string | null;
      priority?: string;
      notes?: string | null;
    } | null;
    if (!body || !body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "name is required" },
        { status: 400 },
      );
    }
    const lead = await saveClinicLead(context, {
      saasId: context.saasId,
      name: body.name.trim(),
      email: typeof body.email === "string" ? body.email : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      source: typeof body.source === "string" ? body.source : undefined,
      interest: typeof body.interest === "string" ? body.interest : null,
      priority:
        typeof body.priority === "string" && ALLOWED_PRIORITIES.has(body.priority)
          ? (body.priority as ClinicLead["priority"])
          : undefined,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return handleClinicApiError("LEADS_POST", error);
  }
}
