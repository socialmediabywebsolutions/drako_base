export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEconomyContext, listSaasServices } from "@/lib/economy/repository";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { listEmployees, listEmployeeRoles } from "@/lib/employees/repository";
import { handleKnowledgeApiError } from "@/lib/knowledge/api-helpers";
import {
  createKnowledgeLink,
  deleteKnowledgeLink,
  listKnowledgeLinksForDocument,
  resolveKnowledgeContext,
} from "@/lib/knowledge/repository";
import { resolveTasksContext, getTaskById } from "@/lib/tasks/repository";
import type { SaasKnowledgeLinkTargetType } from "@/lib/knowledge/types";



type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_TARGETS: SaasKnowledgeLinkTargetType[] = ["SERVICE", "ROLE", "EMPLOYEE", "TASK", "AUTOPILOT_KEY"];

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const links = await listKnowledgeLinksForDocument(ctx, id);
    if (links.length === 0) {
      return NextResponse.json({ links: [] });
    }

    const serviceIds = Array.from(new Set(links.filter((link) => link.targetType === "SERVICE").map((link) => link.targetId)));
    const employeeIds = Array.from(new Set(links.filter((link) => link.targetType === "EMPLOYEE").map((link) => link.targetId)));
    const roleIds = Array.from(new Set(links.filter((link) => link.targetType === "ROLE").map((link) => link.targetId)));
    const taskIds = Array.from(new Set(links.filter((link) => link.targetType === "TASK").map((link) => link.targetId)));

    const labelByTarget = new Map<string, string>();

    if (serviceIds.length > 0) {
      const economyCtx = await resolveEconomyContext({ tenantId, saasId });
      const services = await listSaasServices(economyCtx);
      services.forEach((service) => {
        labelByTarget.set(`SERVICE:${service.id}`, service.name);
      });
    }

    if (employeeIds.length > 0 || roleIds.length > 0) {
      const employeesCtx = await resolveEmployeesContext(tenantId, saasId);
      if (employeeIds.length > 0) {
        const employees = await listEmployees(employeesCtx);
        employees.forEach((employee) => {
          labelByTarget.set(`EMPLOYEE:${employee.id}`, employee.fullName);
        });
      }
      if (roleIds.length > 0) {
        const roles = await listEmployeeRoles(employeesCtx, saasId);
        roles.forEach((role) => {
          labelByTarget.set(`ROLE:${role.id}`, role.label);
        });
      }
    }

    if (taskIds.length > 0) {
      const tasksCtx = await resolveTasksContext({ tenantId, saasId });
      await Promise.all(
        taskIds.map(async (taskId) => {
          const task = await getTaskById(tasksCtx, taskId);
          if (task) labelByTarget.set(`TASK:${task.id}`, task.title);
        }),
      );
    }

    const payload = links.map((link) => ({
      id: link.id,
      targetType: link.targetType,
      targetId: link.targetId,
      targetLabel:
        link.targetType === "AUTOPILOT_KEY"
          ? `Autopilot: ${link.targetId}`
          : labelByTarget.get(`${link.targetType}:${link.targetId}`) ?? link.targetId,
    }));

    return NextResponse.json({ links: payload });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENT_LINKS_LIST", error, "KNOWLEDGE_DOCUMENT_LINKS_LIST_ERROR");
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as { targetType?: SaasKnowledgeLinkTargetType; targetId?: string } | null;
    if (!body?.targetType || !body?.targetId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "targetType and targetId are required" }, { status: 400 });
    }
    if (!ALLOWED_TARGETS.includes(body.targetType)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "targetType no es válido" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const link = await createKnowledgeLink(ctx, {
      saasId,
      documentId: id,
      targetType: body.targetType,
      targetId: body.targetId,
    });
    return NextResponse.json({ link });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENT_LINKS_CREATE", error, "KNOWLEDGE_DOCUMENT_LINKS_CREATE_ERROR");
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const linkId = url.searchParams.get("linkId");
    const { id } = await params;
    if (!saasId || !id || !linkId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId, id and linkId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    await deleteKnowledgeLink(ctx, linkId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENT_LINKS_DELETE", error, "KNOWLEDGE_DOCUMENT_LINKS_DELETE_ERROR");
  }
}
