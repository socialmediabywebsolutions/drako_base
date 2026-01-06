import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { materializeOwnerGrowthAutopilotTasks } from "@/lib/owner/tasks";


type OwnerRow = { id: string };

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerIdParam = url.searchParams.get("ownerId");
    let ownerId = ownerIdParam;
    if (!ownerId) {
      const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
      ownerId = rows[0]?.id ?? null;
      if (!ownerId) {
        ownerId = getDemoOwner(tenantId)?.id ?? null;
      }
    }
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_NOT_FOUND", message: "No owner found for tenant" }, { status: 404 });
    }

    const created = await materializeOwnerGrowthAutopilotTasks({ tenantId, ownerId });
    return NextResponse.json({ created });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_TASKS_MATERIALIZE_ERROR", error);
    return NextResponse.json({ code: "OWNER_TASKS_MATERIALIZE_ERROR", message: "No se pudieron materializar tareas" }, { status: 500 });
  }
}
