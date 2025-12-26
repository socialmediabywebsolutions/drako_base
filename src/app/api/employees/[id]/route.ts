import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { getEmployeeById, updateEmployee } from "@/lib/employees/repository";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const context = await resolveEmployeesContext(tenantId, saasId);
    const employee = await getEmployeeById(context, id);
    if (!employee) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Empleado no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEE_GET", error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
      avatarUrl?: string | null;
      notes?: string | null;
      isActive?: boolean;
      saasId?: string | null;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Payload required" }, { status: 400 });
    }
    const url = new URL(request.url);
    const saasId = body?.saasId ?? url.searchParams.get("saasId");
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEmployeesContext(tenantId, saasId);
    const employee = await updateEmployee(context, id, {
      fullName: typeof body.fullName === "string" ? body.fullName.trim() : undefined,
      email: typeof body.email === "string" ? body.email.trim() : body.email,
      phone: typeof body.phone === "string" ? body.phone.trim() : body.phone,
      role: typeof body.role === "string" ? body.role.trim() : undefined,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : body.avatarUrl,
      notes: typeof body.notes === "string" ? body.notes.trim() : body.notes,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    if (!employee) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Empleado no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEE_PATCH", error);
  }
}
