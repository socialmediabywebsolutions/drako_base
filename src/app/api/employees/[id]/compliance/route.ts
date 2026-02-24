export const dynamic = "force-dynamic";
import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { checkEmployeeCompliance } from "@/lib/employees/compliance";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    const report = await checkEmployeeCompliance(ctx, id);
    return NextResponse.json(report);
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEE_COMPLIANCE_GET", error, "EMPLOYEES_COMPLIANCE_UNEXPECTED_ERROR");
  }
}
