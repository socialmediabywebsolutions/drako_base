import { NextResponse, type NextRequest } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { addEmployeeSkill, getEmployeeById } from "@/lib/employees/repository";
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
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEmployeesContext(tenantId, saasId);
    const employee = await getEmployeeById(context, id);
    if (!employee) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Empleado no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ skills: employee.skills });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEE_SKILLS_GET", error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as { skill?: string; level?: string; saasId?: string | null } | null;
    if (!body?.skill?.trim() || !body.level?.trim()) {
      return NextResponse.json({ code: "INVALID_BODY", message: "skill and level are required" }, { status: 400 });
    }
    const url = new URL(request.url);
    const saasId = body.saasId ?? url.searchParams.get("saasId");
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEmployeesContext(tenantId, saasId);
    const skill = await addEmployeeSkill(context, id, {
      skill: body.skill.trim(),
      level: body.level.trim(),
    });
    const employee = await getEmployeeById(context, id);
    return NextResponse.json({ skill, skills: employee?.skills ?? [] });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEE_SKILLS_POST", error);
  }
}
