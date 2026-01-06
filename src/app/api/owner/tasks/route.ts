import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { listOwnerTasks, getOwnerTasksSummary } from "@/lib/owner/tasks";
import type { SaasTaskCategory, SaasTaskStatus } from "@/lib/tasks/types";


type OwnerRow = { id: string };

type OwnerTasksStatusFilter = SaasTaskStatus | "ALL";
type OwnerTasksCategoryFilter = SaasTaskCategory | "ALL";

export async function GET(request: Request) {
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

    const statusParam = url.searchParams.get("status");
    const rawStatus = ((statusParam ?? "ALL") as OwnerTasksStatusFilter) ?? "ALL";
    const statusFilter: SaasTaskStatus | undefined = rawStatus === "ALL" ? undefined : rawStatus;

    const categoryParam = url.searchParams.get("category");
    const rawCategory = ((categoryParam ?? "ALL") as OwnerTasksCategoryFilter) ?? "ALL";
    const categoryFilter: SaasTaskCategory | undefined = rawCategory === "ALL" ? undefined : rawCategory;

    const saasIdParam = url.searchParams.get("saasId");
    const saasIdFilter = !saasIdParam || saasIdParam === "ALL" ? undefined : saasIdParam;

    const tasks = await listOwnerTasks({
      tenantId,
      ownerId,
      filters: {
        status: statusFilter,
        category: categoryFilter,
        saasId: saasIdFilter,
      },
    });
    const summary = await getOwnerTasksSummary({ tenantId, ownerId });

    return NextResponse.json({ tasks, summary });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_TASKS_ERROR", error);
    return NextResponse.json({ code: "OWNER_TASKS_ERROR", message: "No se pudo cargar el tablero de tareas" }, { status: 500 });
  }
}
