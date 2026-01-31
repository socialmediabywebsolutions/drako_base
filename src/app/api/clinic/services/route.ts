import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { listClinicServices, saveClinicService } from "@/lib/clinic/repository";
// export const runtime = "edge"; // OpenNext Migration


export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const items = await listClinicServices(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleClinicApiError("SERVICES_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      name?: string;
      durationMinutes?: number;
      basePrice?: number;
      isActive?: boolean;
    } | null;
    if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "name is required" },
        { status: 400 },
      );
    }
    const service = await saveClinicService(context, {
      id: body.id,
      saasId: context.saasId,
      name: body.name.trim(),
      durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
      basePrice: typeof body.basePrice === "number" ? body.basePrice : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return NextResponse.json({ service });
  } catch (error) {
    return handleClinicApiError("SERVICES_POST", error);
  }
}
