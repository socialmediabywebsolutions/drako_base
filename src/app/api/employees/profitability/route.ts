export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { listEmployeesProfitability } from "@/lib/employees/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const fromDate = url.searchParams.get("fromDate") ?? undefined;
    const toDate = url.searchParams.get("toDate") ?? undefined;
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    const items = await listEmployeesProfitability(ctx, saasId, { fromDate, toDate });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleEmployeesApiError("PROFITABILITY_LIST", error, "EMPLOYEES_PROFITABILITY_ERROR");
  }
}
