export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  createTenantInvite,
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  type WorkspaceRole,
} from "@/lib/auth/campamento-core";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getRequestBaseUrl } from "@/lib/http/base-url";

const ALLOWED_ROLES = new Set<WorkspaceRole>(["ADMIN", "MEMBER"]);

export async function POST(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const membership = await findMembershipByTenantAndUser(tenantId, session.userId);
    if (!membership || !hasRequiredWorkspaceRole(membership.role, "ADMIN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as { email?: string; role?: WorkspaceRole } | null;
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role ?? "MEMBER";
    if (!email || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
    }
    const invite = await createTenantInvite({
      tenantId,
      email,
      role,
      createdBy: session.userId,
    });
    const baseUrl = getRequestBaseUrl(request);
    return NextResponse.json({
      ok: true,
      invite,
      inviteUrl: `${baseUrl}/bases/login?invite=${invite.token}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("INVITE_SEND_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
