export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { getEmployeeProfitabilitySnapshot } from "@/lib/employees/repository";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const fromDate = url.searchParams.get("fromDate") ?? undefined;
    const toDate = url.searchParams.get("toDate") ?? undefined;
    const { id: employeeId } = await params;
    if (!saasId || !employeeId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and employeeId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    const snapshot = await getEmployeeProfitabilitySnapshot(ctx, employeeId, { fromDate, toDate });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return handleEmployeesApiError("PROFITABILITY_DETAIL", error, "EMPLOYEE_PROFITABILITY_ERROR");
  }
}
