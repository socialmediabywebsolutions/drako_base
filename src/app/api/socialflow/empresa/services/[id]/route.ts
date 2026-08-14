export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { updateService, deleteService } from "@/lib/socialflow/services/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
  }

  let body: {
    name?: string;
    description?: string | null;
    category?: string | null;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const service = await updateService(id, session.tenantId, resolveSaasId(req), {
      name: body.name?.trim(),
      description: body.description !== undefined ? body.description?.trim() || null : undefined,
      category: body.category !== undefined ? body.category?.trim() || null : undefined,
      active: body.active,
    });
    if (!service) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, service });
  } catch (err) {
    console.error("[Services/update] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
  }

  try {
    const deleted = await deleteService(id, session.tenantId, resolveSaasId(req));
    if (!deleted) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Services/delete] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
