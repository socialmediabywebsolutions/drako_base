export const dynamic = "force-dynamic";
import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  buildEmployeePartnerContext,
  getEmployeeCustomerCareSuggestions,
  getEmployeeDayPlan,
  getEmployeeEconomySuggestions,
  getEmployeeHrSuggestions,
  getEmployeeInventorySuggestions,
  getEmployeeOperationalSuggestions,
  getEmployeePhaseSuggestions,
  getEmployeeRealtimeSuggestions,
} from "@/lib/agents/employee-partner";
import { EmployeesContextError } from "@/lib/employees/context";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id: employeeId } = await params;
    if (!saasId || !employeeId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and employeeId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await buildEmployeePartnerContext({ tenantId, saasId, employeeId });
    const response = {
      partner: context,
      dayPlan: getEmployeeDayPlan(context),
      inventorySuggestions: getEmployeeInventorySuggestions(context),
      hrSuggestions: getEmployeeHrSuggestions(context),
      customerCareSuggestions: getEmployeeCustomerCareSuggestions(context),
      economySuggestions: getEmployeeEconomySuggestions(context),
      phaseSuggestions: getEmployeePhaseSuggestions(context),
      operationalSuggestions: getEmployeeOperationalSuggestions(context),
      realtimeSuggestions: getEmployeeRealtimeSuggestions(context),
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof EmployeesContextError) {
      return NextResponse.json({ code: "INVALID_EMPLOYEES_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
    }
    console.error("EMPLOYEE_PARTNER_ERROR", error);
    return NextResponse.json({ code: "EMPLOYEE_PARTNER_ERROR", message: "No se pudo cargar el partner." }, { status: 500 });
  }
}
