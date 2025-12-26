import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { createEmployee, listEmployees } from "@/lib/employees/repository";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEmployeesContext(tenantId, saasId);
    const items = await listEmployees(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEES_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
      avatarUrl?: string | null;
      notes?: string | null;
    } | null;
    if (!body?.saasId || !body.fullName?.trim()) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId and fullName are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEmployeesContext(tenantId, body.saasId);
    const employee = await createEmployee(context, {
      saasId: body.saasId,
      fullName: body.fullName.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      role: body.role?.trim() || null,
      avatarUrl: body.avatarUrl?.trim() || null,
      notes: body.notes?.trim() || null,
    });
    return NextResponse.json({ employee });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEES_POST", error);
  }
}
