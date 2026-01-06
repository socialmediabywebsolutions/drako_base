import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleTasksApiError } from "@/lib/tasks/api-helpers";
import { materializeAutopilotActionsAsTasks } from "@/lib/tasks/autopilot-bridge";
import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";


export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { saasId?: string | null; onlyCritical?: boolean } | null;
    const saasId = body?.saasId ?? new URL(request.url).searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const snapshot = await buildOwnerControlSnapshot({ tenantId, saasId });
    const tasks = await materializeAutopilotActionsAsTasks(
      { tenantId, saasId },
      snapshot,
      { onlyCritical: Boolean(body?.onlyCritical) },
    );
    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    return handleTasksApiError("TASKS_AUTOPILOT_MATERIALIZE", error, "TASKS_AUTOPILOT_ERROR");
  }
}
