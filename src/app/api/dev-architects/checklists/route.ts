export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listDevArchitectChecklists, updateDevArchitectChecklistStatus } from "@/lib/dev-architects/store";
import type { DevArchitectChecklistStatus } from "@/lib/dev-architects/types";

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "projectId requerido" }, { status: 400 });
    }
    const bindings = env();
    const items = await listDevArchitectChecklists(tenantId, bindings, projectId);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_CHECKLISTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as { projectId?: string; key?: string; status?: DevArchitectChecklistStatus } | null;
    if (!body?.projectId || !body?.key || !body?.status) {
      return NextResponse.json({ ok: false, error: "projectId, key y status requeridos" }, { status: 400 });
    }
    if (!["ok", "pending"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "status inválido" }, { status: 400 });
    }
    const bindings = env();
    const items = await updateDevArchitectChecklistStatus(tenantId, bindings, {
      project_id: body.projectId,
      key: body.key,
      status: body.status,
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_CHECKLISTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}
