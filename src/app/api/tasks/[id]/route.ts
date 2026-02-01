import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleTasksApiError } from "@/lib/tasks/api-helpers";
import { appendTaskEvent, getTaskById, listTaskEvents, resolveTasksContext, updateTask } from "@/lib/tasks/repository";
import type { SaasTaskCategory, SaasTaskSeverity, SaasTaskStatus } from "@/lib/tasks/types";
// export const runtime = "edge"; // OpenNext: disabled for bundling


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveTasksContext({ tenantId, saasId });
    const task = await getTaskById(ctx, id);
    if (!task) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
    }
    const events = await listTaskEvents(ctx, id);
    return NextResponse.json({ task, events });
  } catch (error) {
    return handleTasksApiError("TASKS_DETAIL", error, "TASKS_DETAIL_ERROR");
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      title?: string;
      description?: string | null;
      category?: SaasTaskCategory;
      status?: SaasTaskStatus;
      severity?: SaasTaskSeverity;
      assigneeEmployeeId?: string | null;
      dueDate?: string | null;
      metadata?: Record<string, unknown> | null;
      comment?: string | null;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveTasksContext({ tenantId, saasId });
    const current = await getTaskById(ctx, id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
    }

    const updated = await updateTask(ctx, id, {
      title: body.title,
      description: typeof body.description === "undefined" ? undefined : body.description,
      category: body.category,
      status: body.status,
      severity: body.severity,
      assigneeEmployeeId: typeof body.assigneeEmployeeId === "undefined" ? undefined : body.assigneeEmployeeId,
      dueDate: typeof body.dueDate === "undefined" ? undefined : body.dueDate,
      metadata: typeof body.metadata === "undefined" ? undefined : body.metadata,
    });

    const eventPayload: Record<string, unknown> = {};
    let eventType: "STATUS_CHANGED" | "REASSIGNED" | "UPDATED" | null = null;
    if (body.status && body.status !== current.status) {
      eventType = "STATUS_CHANGED";
      eventPayload.from = current.status;
      eventPayload.to = body.status;
    }
    if (typeof body.assigneeEmployeeId !== "undefined" && body.assigneeEmployeeId !== current.assigneeEmployeeId) {
      eventType = eventType ?? "REASSIGNED";
      eventPayload.assigneeEmployeeId = body.assigneeEmployeeId;
    }
    if (
      typeof body.title !== "undefined" ||
      typeof body.description !== "undefined" ||
      typeof body.category !== "undefined" ||
      typeof body.severity !== "undefined" ||
      typeof body.dueDate !== "undefined" ||
      typeof body.metadata !== "undefined"
    ) {
      eventType = eventType ?? "UPDATED";
    }

    if (eventType) {
      await appendTaskEvent(ctx, id, eventType, eventPayload);
    }
    if (body.comment && body.comment.trim()) {
      await appendTaskEvent(ctx, id, "COMMENT", { message: body.comment.trim() });
    }

    return NextResponse.json({ task: updated });
  } catch (error) {
    return handleTasksApiError("TASKS_UPDATE", error, "TASKS_UPDATE_ERROR");
  }
}
