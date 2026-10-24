export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createWorkspaceTenant, ensureTenantMembership, hasRequiredWorkspaceRole, setUserActiveTenant } from "@/lib/auth/campamento-core";
import { requireSession, UnauthorizedError } from "@/lib/auth/session";

type Body = {
  name?: string;
  slug?: string;
  plan?: "STARTER" | "PRO" | "ENTERPRISE";
};

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body?.name?.trim()) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "name is required" }, { status: 400 });
    }

    const tenant = await createWorkspaceTenant({
      name: body.name.trim(),
      slug: body.slug,
      plan: body.plan ?? "STARTER",
      createdBy: session.userId,
    });
    const membership = await ensureTenantMembership({
      tenantId: tenant.id,
      userId: session.userId,
      email: session.email,
      role: "OWNER",
    });
    await setUserActiveTenant(session.userId, tenant.id);

    return NextResponse.json({ ok: true, tenant, membership }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("TENANT_CREATE_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
