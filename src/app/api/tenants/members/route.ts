export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  listTenantMembers,
  updateTenantMemberRole,
  type WorkspaceRole,
} from "@/lib/auth/campamento-core";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

const ALLOWED_ROLES = new Set<WorkspaceRole>(["OWNER", "ADMIN", "MEMBER"]);

export async function GET(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const membership = await findMembershipByTenantAndUser(tenantId, session.userId);
    if (!membership || !hasRequiredWorkspaceRole(membership.role, "ADMIN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    const members = await listTenantMembers(tenantId);
    return NextResponse.json({ ok: true, items: members });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("TENANT_MEMBERS_LIST_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (!session.userId) {
      return NextResponse.json({ ok: false, code: "WORKSPACE_SESSION_REQUIRED" }, { status: 403 });
    }
    const currentMembership = await findMembershipByTenantAndUser(tenantId, session.userId);
    if (!currentMembership || !hasRequiredWorkspaceRole(currentMembership.role, "ADMIN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { userId?: string; role?: WorkspaceRole } | null;
    if (!body?.userId || !body.role || !ALLOWED_ROLES.has(body.role)) {
      return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
    }

    const members = await listTenantMembers(tenantId);
    const target = members.find((item) => item.userId === body.userId);
    if (!target) {
      return NextResponse.json({ ok: false, code: "MEMBER_NOT_FOUND" }, { status: 404 });
    }
    if (target.role === "OWNER" && body.role !== "OWNER") {
      const owners = members.filter((item) => item.role === "OWNER");
      if (owners.length <= 1) {
        return NextResponse.json({ ok: false, code: "LAST_OWNER_PROTECTED" }, { status: 409 });
      }
    }
    await updateTenantMemberRole({
      tenantId,
      userId: body.userId,
      role: body.role,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("TENANT_MEMBERS_UPDATE_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
