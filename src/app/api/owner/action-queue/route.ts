import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { getOwnerActionQueueSnapshot } from "@/lib/owner/action-queue";
import { transitionActionStatus, type CampamentoActionStatus } from "@/lib/owner/action-queue-repository";


type OwnerRow = {
  id: string;
};

type PatchPayload = {
  id?: string;
  status?: CampamentoActionStatus;
  snoozedUntil?: string | null;
};

async function resolveOwnerId(tenantId: string, ownerIdParam: string | null): Promise<string | null> {
  let ownerId = ownerIdParam;
  if (!ownerId) {
    const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
    ownerId = rows[0]?.id ?? null;
    if (!ownerId) {
      ownerId = getDemoOwner(tenantId)?.id ?? null;
    }
  }
  return ownerId ?? null;
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerId = await resolveOwnerId(tenantId, url.searchParams.get("ownerId"));
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_ACTIONS_CONTEXT_ERROR", message: "No owner found for tenant" }, { status: 404 });
    }
    const snapshot = await getOwnerActionQueueSnapshot({ tenantId, ownerId, now: new Date() });
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTION_QUEUE_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTION_QUEUE_ERROR", message: "No se pudo construir la action queue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }
    const payload = (await request.json().catch(() => null)) as PatchPayload | null;
    if (!payload?.id || !payload.status) {
      return NextResponse.json({ code: "INVALID_PAYLOAD", message: "Datos incompletos" }, { status: 400 });
    }
    const updated = await transitionActionStatus({
      tenantId,
      id: payload.id,
      status: payload.status,
      snoozedUntil: payload.snoozedUntil ?? null,
      now: new Date(),
      actor: session.email,
      correlationId: `action_${payload.id}`,
    });
    if (!updated) {
      return NextResponse.json({ code: "ACTION_NOT_FOUND", message: "Accion no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTION_QUEUE_PATCH_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTION_QUEUE_PATCH_ERROR", message: "No se pudo actualizar la accion" }, { status: 500 });
  }
}
