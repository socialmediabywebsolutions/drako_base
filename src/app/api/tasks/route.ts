import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleTasksApiError } from "@/lib/tasks/api-helpers";
import { createTask, listTasks, resolveTasksContext } from "@/lib/tasks/repository";
import type { SaasTaskCategory, SaasTaskStatus } from "@/lib/tasks/types";
export const runtime = "edge";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const statusParam = url.searchParams.get("status");
    const categoryParam = url.searchParams.get("category");
    const assigneeEmployeeId = url.searchParams.get("assigneeEmployeeId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveTasksContext({ tenantId, saasId });
    const items = await listTasks(ctx, {
      status: statusParam && statusParam !== "ALL" ? (statusParam as SaasTaskStatus) : null,
      category: categoryParam && categoryParam !== "ALL" ? (categoryParam as SaasTaskCategory) : null,
      assigneeEmployeeId: assigneeEmployeeId?.trim() || null,
    });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleTasksApiError("TASKS_LIST", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      title?: string;
      description?: string | null;
      category?: SaasTaskCategory;
      status?: SaasTaskStatus;
      severity?: "INFO" | "SUGGESTION" | "WARNING" | "CRITICAL";
      assigneeEmployeeId?: string | null;
      dueDate?: string | null;
      metadata?: Record<string, unknown> | null;
      source?: "MANUAL_OWNER" | "MANUAL_STAFF";
    } | null;
    if (!body?.saasId || !body.title || !body.category || !body.severity) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, title, category and severity are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveTasksContext({ tenantId, saasId: body.saasId });
    const task = await createTask(ctx, {
      saasId: body.saasId,
      title: body.title,
      description: body.description ?? null,
      category: body.category,
      source: body.source ?? "MANUAL_OWNER",
      status: body.status ?? "OPEN",
      severity: body.severity,
      assigneeEmployeeId: body.assigneeEmployeeId ?? null,
      dueDate: body.dueDate ?? null,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ task });
  } catch (error) {
    return handleTasksApiError("TASKS_CREATE", error);
  }
}
