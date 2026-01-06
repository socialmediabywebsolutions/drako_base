import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { getOwnerActionQueueSnapshot } from "@/lib/owner/action-queue";
export const runtime = "edge";


type OwnerRow = {
  id: string;
};

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerIdParam = url.searchParams.get("ownerId");
    const statusParam = url.searchParams.get("status");
    const priorityParam = url.searchParams.get("priority");
    const categoryParam = url.searchParams.get("category");
    const sourceParam = url.searchParams.get("source");
    let ownerId = ownerIdParam;
    if (!ownerId) {
      const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
      ownerId = rows[0]?.id ?? null;
      if (!ownerId) {
        ownerId = getDemoOwner(tenantId)?.id ?? null;
      }
    }
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_ACTIONS_CONTEXT_ERROR", message: "No owner found for tenant" }, { status: 404 });
    }
    const snapshot = await getOwnerActionQueueSnapshot({ tenantId, ownerId, now: new Date() });
    let items = snapshot.items;
    const defaultStatus = statusParam ?? "OPEN";
    if (defaultStatus !== "ALL") {
      items = items.filter((item) => item.status === defaultStatus);
    }
    if (priorityParam && priorityParam !== "ALL") {
      items = items.filter((item) => item.priority === priorityParam);
    }
    if (categoryParam && categoryParam !== "ALL") {
      items = items.filter((item) => item.category === categoryParam);
    }
    if (sourceParam && sourceParam !== "ALL") {
      items = items.filter((item) => item.source === sourceParam);
    }
    const topCritical = items.filter((item) => item.priority === "CRITICAL").slice(0, 5);
    return NextResponse.json({ snapshot: { ...snapshot, items, topCritical } });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTIONS_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTIONS_ERROR", message: "No se pudo construir la action queue" }, { status: 500 });
  }
}
