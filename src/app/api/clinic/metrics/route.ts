import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { getClinicMetrics } from "@/lib/clinic/repository";


export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const metrics = await getClinicMetrics(context);
    return NextResponse.json({ metrics });
  } catch (error) {
    return handleClinicApiError("METRICS_GET", error);
  }
}
