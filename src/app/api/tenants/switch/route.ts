export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { findMembershipByTenantAndUser, setUserActiveTenant } from "@/lib/auth/campamento-core";
import { requireSession, UnauthorizedError } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as { tenantId?: string } | null;
    const tenantId = body?.tenantId?.trim();
    if (!tenantId) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "tenantId is required" }, { status: 400 });
    }
    const membership = await findMembershipByTenantAndUser(tenantId, session.userId);
    if (!membership) {
      return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
    }
    await setUserActiveTenant(session.userId, tenantId);
    return NextResponse.json({ ok: true, tenantId, membership });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("TENANT_SWITCH_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
