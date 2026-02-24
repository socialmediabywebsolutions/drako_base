export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { getSaasComplianceSummary } from "@/lib/employees/compliance";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    const summary = await getSaasComplianceSummary(ctx, saasId);
    return NextResponse.json(summary);
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEES_COMPLIANCE_SUMMARY_GET", error, "EMPLOYEES_COMPLIANCE_UNEXPECTED_ERROR");
  }
}
