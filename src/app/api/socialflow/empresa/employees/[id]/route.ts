export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { updateEmployee, deleteEmployee } from "@/lib/socialflow/employees/repository";

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
    role?: string | null;
    specialty?: string | null;
    description?: string | null;
    photoUrl?: string | null;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const employee = await updateEmployee(id, session.tenantId, resolveSaasId(req), {
      name: body.name?.trim(),
      role: body.role !== undefined ? body.role?.trim() || null : undefined,
      specialty: body.specialty !== undefined ? body.specialty?.trim() || null : undefined,
      description: body.description !== undefined ? body.description?.trim() || null : undefined,
      photoUrl: body.photoUrl !== undefined ? body.photoUrl?.trim() || null : undefined,
      active: body.active,
    });
    if (!employee) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, employee });
  } catch (err) {
    console.error("[Employees/update] failed", err instanceof Error ? err.message : String(err));
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
    const deleted = await deleteEmployee(id, session.tenantId, resolveSaasId(req));
    if (!deleted) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Employees/delete] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
